import express from 'express';
import path from 'path';
import { connectToSpreadsheet } from './src/lib/googleSheets.js';

async function getOrInitSheet(doc: any, title: string, headerValues: string[]) {
  let sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    sheet = await doc.addSheet({ title, headerValues });
  } else {
    let needsHeaderLoad = false;
    try {
      const hs = sheet.headerValues;
      if (!hs || hs.length === 0 || hs[0] === '') needsHeaderLoad = true;
    } catch (e) {
      needsHeaderLoad = true;
    }
    if (needsHeaderLoad) {
      try {
        await sheet.loadHeaderRow();
        const currentHeaders = sheet.headerValues || [];
        const missingHeaders = headerValues.filter(h => !currentHeaders.includes(h));
        if (missingHeaders.length > 0) {
          await sheet.setHeaderRow([...currentHeaders, ...missingHeaders]);
        }
      } catch (e: any) {
        if (e.message && e.message.includes('No values in the header row')) {
          await sheet.setHeaderRow(headerValues);
        }
      }
    }
  }
  return sheet;
}

const sheetRowsCache = new Map<string, { time: number, rows: any[] }>();
const CACHE_TTL = 10000; // 10 seconds

function invalidateSheetCache(title: string) {
  sheetRowsCache.delete(title);
}

async function getCachedRows(sheet: any) {
  const cacheKey = sheet.title;
  const cached = sheetRowsCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.rows;
  }
  let rows: any[] = [];
  if (sheet.rowCount > 0) {
    rows = await sheet.getRows();
  }
  sheetRowsCache.set(cacheKey, { time: Date.now(), rows });
  return rows;
}
export const app = express();
app.use(express.json());

// Handle Netlify rewrite path logic seamlessly
app.use((req, res, next) => {
  if (req.url.startsWith('/.netlify/functions/api')) {
    req.url = req.url.replace('/.netlify/functions/api', '/api');
  } else if (req.url.startsWith('/.netlify/functions')) {
    req.url = req.url.replace('/.netlify/functions', '');
  }
  next();
});

  // ==========================================
  // API ROUTE: /api/master-rekening
  // ==========================================
  app.get('/api/master-rekening', async (req, res) => {
    try {
      const doc = await connectToSpreadsheet();
      const sheet = await getOrInitSheet(doc, 'Master_Rekening', ['Kode_Rekening', 'Uraian', 'Level', 'Parent_Kode', 'Is_Header']);
      let rows: any[] = [];
      try {
        rows = await getCachedRows(sheet);
      } catch (e: any) {
        console.warn('Could not fetch Master_Rekening rows:', e.message);
      }
      const data = rows.map(r => ({
        kodeRekening: r.get('Kode_Rekening'),
        uraian: r.get('Uraian'),
        level: parseInt(r.get('Level') || '1', 10),
        parentKode: r.get('Parent_Kode'),
        isHeader: r.get('Is_Header') === 'TRUE'
      }));
      res.json(data);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching master rekening' });
    }
  });

  // ==========================================
  // API ROUTE: /api/transaksi
  // ==========================================
  app.get('/api/transaksi', async (req, res) => {
    try {
      const doc = await connectToSpreadsheet();
      const transaksiSheet = await getOrInitSheet(doc, 'Transaksi', ['ID', 'Tanggal', 'Jenis_Transaksi', 'Sumber_Dana', 'Sub_Sumber_Dana', 'Kode_Rekening', 'Uraian', 'Nominal']);
      let rows: any[] = [];
      try {
        rows = await getCachedRows(transaksiSheet);
      } catch (e: any) {
        console.warn('Could not fetch Transaksi rows:', e.message);
      }
      const data = rows.map(r => ({
        id: r.get('ID'),
        tanggal: r.get('Tanggal'),
        jenisTransaksi: r.get('Jenis_Transaksi'),
        sumberDana: r.get('Sumber_Dana'),
        subSumberDana: r.get('Sub_Sumber_Dana'),
        kodeRekening: r.get('Kode_Rekening'),
        uraian: r.get('Uraian'),
        nominal: parseFloat(r.get('Nominal')) || 0,
      })).reverse(); // newest first
      res.json(data);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching transaksi', details: error.message, stack: error.stack });
    }
  });

  app.post('/api/transaksi', async (req, res) => {
    try {
      const { 
        tanggal, 
        jenisTransaksi, 
        sumberDana, 
        subSumberDana, 
        kodeRekening, 
        uraian, 
        nominal 
      } = req.body;

      // Basic validation
      if (!tanggal || !jenisTransaksi || !sumberDana || !subSumberDana || !kodeRekening || nominal == null) {
        return res.status(400).json({ error: 'Data incomplete. Ensure all fields are provided.' });
      }

      const doc = await connectToSpreadsheet();
      const nominalTransaksi = parseFloat(nominal);
      
      // Check Worksheets
      const paguSheet = await getOrInitSheet(doc, 'Pagu_Anggaran', ['Sumber_Dana', 'Kode_Rekening', 'Uraian', 'Nominal_Pagu']);
      const transaksiSheet = await getOrInitSheet(doc, 'Transaksi', ['ID', 'Tanggal', 'Jenis_Transaksi', 'Sumber_Dana', 'Sub_Sumber_Dana', 'Kode_Rekening', 'Uraian', 'Nominal']);

      // 1. BUSINESS LOGIC: PENJAGAAN PAGU (Budget Control)
      if (jenisTransaksi.toUpperCase() === 'BELANJA') {
        let paguRows: any[] = [];
        try {
          if (paguSheet.rowCount > 0) {
             paguRows = await paguSheet.getRows();
          }
        } catch (e) {
          console.warn('Could not fetch Pagu rows:', e);
        }
        
        // Find specific matching budget. Since pagu might be allocated to a parent category, we find the best matching (longest) pagu prefix.
        const validPagus = paguRows.filter(row => {
          const paguSumber = (row.get('Sumber_Dana') || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          let paguKode = (row.get('Kode_Rekening') || '').replace(/\.+$/, '');
          let reqKode = kodeRekening.replace(/\.+$/, '');
          
          if (paguSumber !== sumberDana.toLowerCase().replace(/[^a-z0-9]/g, '')) return false;
          
          // Cross format compatibility
          if (reqKode === paguKode) return true;
          if (reqKode.startsWith(paguKode + '.')) return true;
          if (reqKode.endsWith('.' + paguKode) || reqKode.endsWith(paguKode)) return true;
          
          // Multiple dot handling
          const cleanPagu = paguKode.replace(/\.+/g, '.');
          const cleanNorm = reqKode.replace(/\.+/g, '.');
          return cleanNorm === cleanPagu || cleanNorm.startsWith(cleanPagu + '.') || cleanNorm.endsWith('.' + cleanPagu);
        });

        // Get the most specific (longest) matching pagu code
        validPagus.sort((a, b) => (b.get('Kode_Rekening') || '').length - (a.get('Kode_Rekening') || '').length);
        const matchingPagu = validPagus[0];

        if (!matchingPagu) {
          return res.status(400).json({ 
            error: `Pagu anggaran tidak ditemukan untuk kombinasi: ${sumberDana} - ${subSumberDana} - ${kodeRekening}` 
          });
        }

        const nominalPagu = parseFloat(matchingPagu.get('Nominal_Pagu')) || 0;

        // Calculate total expenditure so far
        let transaksiRows: any[] = [];
        try {
          if (transaksiSheet.rowCount > 0) {
            transaksiRows = await transaksiSheet.getRows();
          }
        } catch (e) {
          console.warn('Could not fetch Transaksi rows:', e);
        }
        let totalBelanja = 0;
        
        for (const row of transaksiRows) {
          const rowSumberDana = (row.get('Sumber_Dana') || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const reqSumberDana = sumberDana.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (row.get('Jenis_Transaksi') !== 'BELANJA' || rowSumberDana !== reqSumberDana) continue;

          let trxKode = (row.get('Kode_Rekening') || '').replace(/\.+$/, '');
          let paguKode = (matchingPagu.get('Kode_Rekening') || '').replace(/\.+$/, '');

          let isMatch = false;
          if (trxKode === paguKode) isMatch = true;
          else if (trxKode.startsWith(paguKode + '.')) isMatch = true;
          else if (trxKode.endsWith('.' + paguKode) || trxKode.endsWith(paguKode)) isMatch = true;
          else {
              const cTrx = trxKode.replace(/\.+/g, '.');
              const cPagu = paguKode.replace(/\.+/g, '.');
              if (cTrx === cPagu || cTrx.startsWith(cPagu + '.') || cTrx.endsWith('.' + cPagu)) isMatch = true;
          }

          if (isMatch) {
            totalBelanja += parseFloat(row.get('Nominal')) || 0;
          }
        }

        const sisaPagu = nominalPagu - totalBelanja;

        // Insert Budget Validation
        if (nominalTransaksi > sisaPagu) {
          return res.status(400).json({ 
            error: 'Transaksi ditolak: Sisa pagu tidak mencukupi',
            detail: {
              nominalPagu,
              totalBelanjaTerjadi: totalBelanja,
              sisaPagu,
              nominalDiminta: nominalTransaksi
            }
          });
        }
      }

      // 2. INSERTION
      const id = new Date().getTime().toString();
      await transaksiSheet.addRow({
        'ID': id,
        'Tanggal': tanggal,
        'Jenis_Transaksi': jenisTransaksi,
        'Sumber_Dana': sumberDana,
        'Sub_Sumber_Dana': subSumberDana,
        'Kode_Rekening': kodeRekening,
        'Uraian': uraian,
        'Nominal': nominalTransaksi
      });
      invalidateSheetCache('Transaksi');

      res.status(201).json({ 
        message: 'Transaksi berhasil disimpan', 
        id 
      });

    } catch (error: any) {
      console.error("Error creating transaction:", error);
      res.status(500).json({ 
        error: 'Terjadi kesalahan pada server saat memproses transaksi.',
        details: error.message 
      });
    }
  });

  // ==========================================
  // API ROUTE: PUT /api/transaksi/:id
  // ==========================================
  app.put('/api/transaksi/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const { 
        tanggal, 
        jenisTransaksi, 
        sumberDana, 
        subSumberDana, 
        kodeRekening, 
        uraian, 
        nominal 
      } = req.body;

      // Basic validation
      if (!tanggal || !jenisTransaksi || !sumberDana || !subSumberDana || !kodeRekening || nominal == null) {
        return res.status(400).json({ error: 'Data incomplete. Ensure all fields are provided.' });
      }

      const doc = await connectToSpreadsheet();
      const transaksiSheet = await getOrInitSheet(doc, 'Transaksi', ['ID', 'Tanggal', 'Jenis_Transaksi', 'Sumber_Dana', 'Sub_Sumber_Dana', 'Kode_Rekening', 'Uraian', 'Nominal']);

      // Budget Control Logic when editing BELANJA
      if (jenisTransaksi.toUpperCase() === 'BELANJA') {
        const paguSheet = await getOrInitSheet(doc, 'Pagu_Anggaran', ['Sumber_Dana', 'Kode_Rekening', 'Uraian', 'Nominal_Pagu']);
        let paguRows: any[] = [];
        try { if (paguSheet.rowCount > 0) paguRows = await paguSheet.getRows(); } catch (e) { console.warn(e); }

        const validPagus = paguRows.filter(row => {
          const paguSumber = (row.get('Sumber_Dana') || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          let paguKode = (row.get('Kode_Rekening') || '').replace(/\.+$/, '');
          let reqKode = kodeRekening.replace(/\.+$/, '');
          
          if (paguSumber !== sumberDana.toLowerCase().replace(/[^a-z0-9]/g, '')) return false;
          
          if (reqKode === paguKode) return true;
          if (reqKode.startsWith(paguKode + '.')) return true;
          if (reqKode.endsWith('.' + paguKode) || reqKode.endsWith(paguKode)) return true;
          
          const cleanPagu = paguKode.replace(/\.+/g, '.');
          const cleanNorm = reqKode.replace(/\.+/g, '.');
          return cleanNorm === cleanPagu || cleanNorm.startsWith(cleanPagu + '.') || cleanNorm.endsWith('.' + cleanPagu);
        });

        validPagus.sort((a, b) => (b.get('Kode_Rekening') || '').length - (a.get('Kode_Rekening') || '').length);
        const matchingPagu = validPagus[0];

        if (!matchingPagu) {
          return res.status(400).json({ 
            error: `Pagu anggaran tidak ditemukan untuk kombinasi: ${sumberDana} - ${subSumberDana} - ${kodeRekening}` 
          });
        }

        const nominalPagu = parseFloat(matchingPagu.get('Nominal_Pagu')) || 0;

        let transaksiRows: any[] = [];
        try { if (transaksiSheet.rowCount > 0) transaksiRows = await transaksiSheet.getRows(); } catch (e) { }
        let totalBelanja = 0;
        
        for (const row of transaksiRows) {
          // exclude the currently edited row from total calculation
          if (row.get('ID') === id) continue;

          const rowSumberDana = (row.get('Sumber_Dana') || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const reqSumberDana = sumberDana.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (row.get('Jenis_Transaksi') !== 'BELANJA' || rowSumberDana !== reqSumberDana) continue;

          let trxKode = (row.get('Kode_Rekening') || '').replace(/\.+$/, '');
          let paguKode = (matchingPagu.get('Kode_Rekening') || '').replace(/\.+$/, '');

          let isMatch = false;
          if (trxKode === paguKode) isMatch = true;
          else if (trxKode.startsWith(paguKode + '.')) isMatch = true;
          else if (trxKode.endsWith('.' + paguKode) || trxKode.endsWith(paguKode)) isMatch = true;
          else {
              const cTrx = trxKode.replace(/\.+/g, '.');
              const cPagu = paguKode.replace(/\.+/g, '.');
              if (cTrx === cPagu || cTrx.startsWith(cPagu + '.') || cTrx.endsWith('.' + cPagu)) isMatch = true;
          }

          if (isMatch) {
            totalBelanja += parseFloat(row.get('Nominal')) || 0;
          }
        }

        const sisaPagu = nominalPagu - totalBelanja;
        const nominalTransaksi = parseFloat(nominal);

        if (sisaPagu < nominalTransaksi) {
          return res.status(400).json({ 
            error: 'Sisa pagu anggaran tidak mencukupi.',
            detail: { nominalPagu, totalBelanjaTerjadi: totalBelanja, sisaPagu, nominalDiminta: nominalTransaksi }
          });
        }
      }

      if (transaksiSheet.rowCount > 0) {
        const rows = await transaksiSheet.getRows();
        const rowIndex = rows.findIndex(r => r.get('ID') === id);
        
        if (rowIndex !== -1) {
          rows[rowIndex].set('Tanggal', tanggal);
          rows[rowIndex].set('Jenis_Transaksi', jenisTransaksi);
          rows[rowIndex].set('Sumber_Dana', sumberDana);
          rows[rowIndex].set('Sub_Sumber_Dana', subSumberDana);
          rows[rowIndex].set('Kode_Rekening', kodeRekening);
          rows[rowIndex].set('Uraian', uraian);
          rows[rowIndex].set('Nominal', parseFloat(nominal));
          await rows[rowIndex].save();
          invalidateSheetCache('Transaksi');
          return res.json({ message: 'Transaksi berhasil diupdate' });
        }
      }

      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });

    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Gagal mengupdate transaksi' });
    }
  });

  // ==========================================
  // API ROUTE: DELETE /api/transaksi/:id
  // ==========================================
  app.delete('/api/transaksi/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const doc = await connectToSpreadsheet();
      const transaksiSheet = await getOrInitSheet(doc, 'Transaksi', ['ID', 'Tanggal', 'Jenis_Transaksi', 'Sumber_Dana', 'Sub_Sumber_Dana', 'Kode_Rekening', 'Uraian', 'Nominal']);

      if (transaksiSheet.rowCount > 0) {
        const rows = await transaksiSheet.getRows();
        const rowIndex = rows.findIndex(r => r.get('ID') === id);
        
        if (rowIndex !== -1) {
          await rows[rowIndex].delete();
          invalidateSheetCache('Transaksi');
          return res.json({ message: 'Transaksi berhasil dihapus' });
        }
      }

      return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Gagal menghapus transaksi', details: error.message });
    }
  });

  // ==========================================
  // API ROUTE: /api/master-rekening/bulk
  // ==========================================
  app.post('/api/master-rekening/bulk', async (req, res) => {
    try {
      const { data } = req.body;
      if (!Array.isArray(data)) return res.status(400).json({error: 'Data must be an array'});
      const doc = await connectToSpreadsheet();
      const sheet = await getOrInitSheet(doc, 'Master_Rekening', ['Kode_Rekening', 'Uraian', 'Level', 'Parent_Kode', 'Is_Header']);
      
      const rows = await sheet.getRows();
      if (rows.length > 0) {
        // clear rows from bottom to top to avoid shifting issues
        for (let i = rows.length - 1; i >= 0; i--) {
          await rows[i].delete();
        }
      }
      
      if (data.length > 0) {
        let baseItems: any[] = [];
        let lastValidCode = '';
        let subItemCounter = 1;

        data.forEach((item: any) => {
          const keys = Object.keys(item);
          let kode = '';
          let uraian = '';
          for (const k of keys) {
             const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
             if (norm.includes('kode') || norm.includes('rekening')) kode = String(item[k]).trim();
             if (norm.includes('uraian') || norm.includes('nama') || norm.includes('deskripsi')) uraian = String(item[k]).trim();
          }

          if (!kode && !uraian) return;

          if (kode) {
              kode = kode.replace(/\.$/, ''); // Remove trailing dot if exists
              lastValidCode = kode;
              subItemCounter = 1; 
          } else {
              if (lastValidCode) {
                  kode = `${lastValidCode}.${subItemCounter.toString().padStart(3, '0')}`;
                  subItemCounter++;
              } else {
                  return; // Skip if there is no parent to attach to
              }
          }

          baseItems.push({ Kode_Rekening: kode, Uraian: uraian });
        });

        const allCodes = baseItems.map(item => item.Kode_Rekening);
        let processedData = baseItems.map(item => {
            const currentCode = item.Kode_Rekening;
            let parentKode = '';
            
            for (const candidate of allCodes) {
                if (candidate !== currentCode && currentCode.startsWith(candidate)) {
                    if (candidate.length > parentKode.length) {
                        parentKode = candidate;
                    }
                }
            }
            
            return {
                Kode_Rekening: currentCode,
                Uraian: item.Uraian,
                Parent_Kode: parentKode,
                Level: 1, // Will be computed below
                Is_Header: 'FALSE'
            };
        });

        const parentCodesSet = new Set(processedData.map(d => d.Parent_Kode).filter(c => c !== ''));
        for (const d of processedData) {
            if (parentCodesSet.has(d.Kode_Rekening)) {
                d.Is_Header = 'TRUE';
            }
        }

        for (const d of processedData) {
            let level = 1;
            let currentParent = d.Parent_Kode;
            let sanityCheck = 0;
            while (currentParent && sanityCheck < 20) {
                level++;
                const parentItem = processedData.find(p => p.Kode_Rekening === currentParent);
                if (parentItem) {
                    currentParent = parentItem.Parent_Kode;
                } else {
                    break;
                }
                sanityCheck++;
            }
            d.Level = level;
        }

        const chunkSize = 500;
        for (let i = 0; i < processedData.length; i += chunkSize) {
          const chunk = processedData.slice(i, i + chunkSize);
          await sheet.addRows(chunk);
        }
      }
      
      res.json({ message: 'Data Master Rekening berhasil diunggah' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Gagal mengunggah Master Rekening', details: error.message });
    }
  });

  // ==========================================
  // API ROUTE: /api/pagu-anggaran/bulk
  // ==========================================
  app.post('/api/pagu-anggaran/bulk', async (req, res) => {
    try {
      const { data } = req.body;
      if (!Array.isArray(data)) return res.status(400).json({error: 'Data must be an array'});
      const doc = await connectToSpreadsheet();
      const sheet = await getOrInitSheet(doc, 'Pagu_Anggaran', ['Sumber_Dana', 'Kode_Rekening', 'Uraian', 'Nominal_Pagu']);
      
      const rows = await sheet.getRows();
      if (rows.length > 0) {
        for (let i = rows.length - 1; i >= 0; i--) {
          await rows[i].delete();
        }
      }
      
      if (data.length > 0) {
        let lastValidCode = '';
        let subItemCounter = 1;

        const processedPagu = data.map((item: any) => {
          const keys = Object.keys(item);
          let sumberDana = '';
          let uraian = '';
          let kodeRekening = '';
          let nominalPagu = 0;
          for (const k of keys) {
            const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (norm.includes('sumber') && !norm.includes('sub')) sumberDana = String(item[k]).trim();
            if (norm.includes('uraian') || norm.includes('nama')) uraian = String(item[k]).trim();
            if (norm.includes('kode') || norm.includes('rekening')) kodeRekening = String(item[k]).trim();
            if (norm.includes('nominal') || norm.includes('pagu') || norm.includes('anggaran') || norm.includes('jumlah')) {
               const val = String(item[k]).replace(/[^0-9.-]/g, '');
               nominalPagu = parseFloat(val) || 0;
            }
          }
          
          if (kodeRekening) {
             kodeRekening = kodeRekening.replace(/\.$/, '');
             lastValidCode = kodeRekening;
             subItemCounter = 1;
          } else {
             if (lastValidCode && (nominalPagu > 0 || uraian)) {
                 kodeRekening = `${lastValidCode}.${subItemCounter.toString().padStart(3, '0')}`;
                 subItemCounter++;
             }
          }

          return {
            Sumber_Dana: sumberDana,
            Kode_Rekening: kodeRekening,
            Uraian: uraian,
            Nominal_Pagu: nominalPagu
          };
        }).filter(p => p.Kode_Rekening && (p.Nominal_Pagu > 0 || p.Uraian));

        const chunkSize = 500;
        for (let i = 0; i < processedPagu.length; i += chunkSize) {
          const chunk = processedPagu.slice(i, i + chunkSize);
          await sheet.addRows(chunk);
        }
      }
      
      res.json({ message: 'Data Pagu Anggaran berhasil diunggah' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Gagal mengunggah Pagu Anggaran', details: error.message });
    }
  });

  // ==========================================
  // API ROUTE: /api/pagu-anggaran
  // ==========================================
  app.get('/api/pagu-anggaran', async (req, res) => {
    try {
      const doc = await connectToSpreadsheet();
      const sheet = await getOrInitSheet(doc, 'Pagu_Anggaran', ['Sumber_Dana', 'Kode_Rekening', 'Uraian', 'Nominal_Pagu']);
      let rows: any[] = [];
      try {
        rows = await getCachedRows(sheet);
      } catch (e: any) {
        console.warn('Could not fetch Pagu_Anggaran rows:', e.message);
      }
      const data = rows.map(r => ({
        sumberDana: r.get('Sumber_Dana'),
        kodeRekening: r.get('Kode_Rekening'),
        uraian: r.get('Uraian'),
        nominalPagu: parseFloat(r.get('Nominal_Pagu')) || 0,
      }));
      res.json(data);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Error fetching Pagu Anggaran' });
    }
  });

  // ==========================================
  // API ROUTE: /api/master/silpa
  // ==========================================
  app.get('/api/master/silpa', async (req, res) => {
    try {
      const doc = await connectToSpreadsheet();
      const sheet = await getOrInitSheet(doc, 'Silpa', ['Sumber_Dana', 'Sub_Sumber_Dana', 'Nominal']);
      let rows: any[] = [];
      try { rows = await getCachedRows(sheet); } catch(e){}
      const data = rows.map(r => ({
        sumberDana: r.get('Sumber_Dana'),
        subSumberDana: r.get('Sub_Sumber_Dana'),
        nominal: parseFloat(r.get('Nominal')) || 0,
      }));
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch Silpa' });
    }
  });

  app.post('/api/master/silpa', async (req, res) => {
    try {
      const { sumberDana, subSumberDana, nominal } = req.body;
      const doc = await connectToSpreadsheet();
      const sheet = await getOrInitSheet(doc, 'Silpa', ['Sumber_Dana', 'Sub_Sumber_Dana', 'Nominal']);
      let rows: any[] = [];
      try { if (sheet.rowCount > 0) rows = await sheet.getRows(); } catch(e){}
      
      const existing = rows.find(r => r.get('Sumber_Dana') === sumberDana && r.get('Sub_Sumber_Dana') === subSumberDana);
      if (existing) {
        existing.set('Nominal', nominal);
        await existing.save();
      } else {
        await sheet.addRow({
          Sumber_Dana: sumberDana,
          Sub_Sumber_Dana: subSumberDana,
          Nominal: nominal
        });
      }
      invalidateSheetCache('Silpa');
      res.json({ message: 'Success' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to save Silpa', details: error.message });
    }
  });

  // ==========================================
  // API ROUTE: /api/master/dpa
  // ==========================================
  app.get('/api/master/dpa', async (req, res) => {
    try {
      const doc = await connectToSpreadsheet();
      const sheet = await getOrInitSheet(doc, 'Master_DPA', ['Nomor_DPA', 'Tanggal_DPA', 'Tahun_Pembukuan', 'Kode_Organisasi']);
      let rows: any[] = [];
      try { rows = await getCachedRows(sheet); } catch(e){}
      if (rows.length > 0) {
        const r = rows[0];
        res.json({
          nomorDPA: r.get('Nomor_DPA') || '',
          tanggalDPA: r.get('Tanggal_DPA') || '',
          tahunPembukuan: r.get('Tahun_Pembukuan') || new Date().getFullYear().toString(),
          kodeOrganisasi: r.get('Kode_Organisasi') || ''
        });
      } else {
        res.json({ nomorDPA: '', tanggalDPA: '', tahunPembukuan: new Date().getFullYear().toString(), kodeOrganisasi: '' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch DPA' });
    }
  });

  app.post('/api/master/dpa', async (req, res) => {
    try {
      const { nomorDPA, tanggalDPA, tahunPembukuan, kodeOrganisasi } = req.body;
      const doc = await connectToSpreadsheet();
      const sheet = await getOrInitSheet(doc, 'Master_DPA', ['Nomor_DPA', 'Tanggal_DPA', 'Tahun_Pembukuan', 'Kode_Organisasi']);
      let rows: any[] = [];
      if (sheet.rowCount > 0) rows = await sheet.getRows();
      if (rows.length > 0) {
        rows[0].set('Nomor_DPA', nomorDPA);
        rows[0].set('Tanggal_DPA', tanggalDPA);
        rows[0].set('Tahun_Pembukuan', tahunPembukuan);
        rows[0].set('Kode_Organisasi', kodeOrganisasi);
        await rows[0].save();
      } else {
        await sheet.addRow({
          Nomor_DPA: nomorDPA,
          Tanggal_DPA: tanggalDPA,
          Tahun_Pembukuan: tahunPembukuan,
          Kode_Organisasi: kodeOrganisasi
        });
      }
      invalidateSheetCache('Master_DPA');
      res.json({ message: 'Success' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to save DPA', details: error.message });
    }
  });

  // ==========================================
  // API ROUTE: Pengaturan (Profil Instansi)
  // ==========================================
  app.get('/api/pengaturan/profil', async (req, res) => {
    try {
      const doc = await connectToSpreadsheet();
      const sheet = await getOrInitSheet(doc, 'Profil_Instansi', ['Nama_Instansi', 'Alamat_Instansi', 'Email_Instansi', 'Logo_Instansi']);
      let rows: any[] = [];
      try {
        rows = await getCachedRows(sheet);
      } catch (e: any) {
        console.warn('Could not fetch Profil_Instansi rows:', e.message);
      }
      if (rows.length > 0) {
        const r = rows[0];
        res.json({
          namaInstansi: r.get('Nama_Instansi') || '',
          alamatInstansi: r.get('Alamat_Instansi') || '',
          emailInstansi: r.get('Email_Instansi') || '',
          logoInstansi: r.get('Logo_Instansi') || '',
        });
      } else {
        res.json({ namaInstansi: '', alamatInstansi: '', emailInstansi: '', logoInstansi: '' });
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Gagal mengambil profil instansi' });
    }
  });

  app.post('/api/pengaturan/profil', async (req, res) => {
    try {
      const { namaInstansi, alamatInstansi, emailInstansi, logoInstansi } = req.body;
      const doc = await connectToSpreadsheet();
      const sheet = await getOrInitSheet(doc, 'Profil_Instansi', ['Nama_Instansi', 'Alamat_Instansi', 'Email_Instansi', 'Logo_Instansi']);
      let rows: any[] = [];
      if (sheet.rowCount > 0) rows = await sheet.getRows();
      if (rows.length > 0) {
        rows[0].set('Nama_Instansi', namaInstansi);
        rows[0].set('Alamat_Instansi', alamatInstansi);
        rows[0].set('Email_Instansi', emailInstansi);
        rows[0].set('Logo_Instansi', logoInstansi);
        await rows[0].save();
      } else {
        await sheet.addRow({
          Nama_Instansi: namaInstansi,
          Alamat_Instansi: alamatInstansi,
          Email_Instansi: emailInstansi,
          Logo_Instansi: logoInstansi
        });
      }
      invalidateSheetCache('Profil_Instansi');
      res.json({ message: 'Profil instansi berhasil disimpan' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Gagal menyimpan profil instansi' });
    }
  });

  // ==========================================
  // API ROUTE: Pengaturan (Master Pejabat)
  // ==========================================
  app.get('/api/pengaturan/pejabat', async (req, res) => {
    try {
      const doc = await connectToSpreadsheet();
      const sheet = await getOrInitSheet(doc, 'Master_Pejabat', ['ID', 'Nama', 'NIP', 'Jabatan']);
      let rows: any[] = [];
      try {
        rows = await getCachedRows(sheet);
      } catch (e: any) {
        console.warn('Could not fetch Master_Pejabat rows:', e.message);
      }
      const data = rows.map(r => ({
        id: r.get('ID'),
        nama: r.get('Nama'),
        nip: r.get('NIP'),
        jabatan: r.get('Jabatan'),
      }));
      res.json(data);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Gagal mengambil data pejabat' });
    }
  });

  app.post('/api/pengaturan/pejabat', async (req, res) => {
    try {
      const { nama, nip, jabatan } = req.body;
      const doc = await connectToSpreadsheet();
      const sheet = await getOrInitSheet(doc, 'Master_Pejabat', ['ID', 'Nama', 'NIP', 'Jabatan']);
      const id = new Date().getTime().toString();
      await sheet.addRow({
        ID: id,
        Nama: nama,
        NIP: nip,
        Jabatan: jabatan
      });
      invalidateSheetCache('Master_Pejabat');
      res.json({ message: 'Data pejabat berhasil ditambahkan' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Gagal menambah data pejabat' });
    }
  });

  app.delete('/api/pengaturan/pejabat/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const doc = await connectToSpreadsheet();
      let sheet = doc.sheetsByTitle['Master_Pejabat'];
      if (sheet && sheet.rowCount > 0) {
        const rows = await sheet.getRows();
        const rowIndex = rows.findIndex(r => r.get('ID') === id);
        if (rowIndex !== -1) {
          await rows[rowIndex].delete();
          invalidateSheetCache('Master_Pejabat');
          return res.json({ message: 'Pejabat berhasil dihapus' });
        }
      }
      return res.status(404).json({ error: 'Data pejabat tidak ditemukan' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Gagal menghapus data pejabat' });
    }
  });

  app.put('/api/pengaturan/pejabat/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { nama, nip, jabatan } = req.body;
      const doc = await connectToSpreadsheet();
      let sheet = doc.sheetsByTitle['Master_Pejabat'];
      if (sheet && sheet.rowCount > 0) {
        const rows = await sheet.getRows();
        const rowIndex = rows.findIndex(r => r.get('ID') === id);
        if (rowIndex !== -1) {
          rows[rowIndex].set('Nama', nama);
          rows[rowIndex].set('NIP', nip);
          rows[rowIndex].set('Jabatan', jabatan);
          await rows[rowIndex].save();
          invalidateSheetCache('Master_Pejabat');
          return res.json({ message: 'Pejabat berhasil diupdate' });
        }
      }
      return res.status(404).json({ error: 'Data pejabat tidak ditemukan' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Gagal mengupdate pejabat' });
    }
  });


  // ==========================================
  // API ROUTE: /api/users
  // ==========================================
  app.get('/api/users', async (req, res) => {
    try {
      const doc = await connectToSpreadsheet();
      const sheet = await getOrInitSheet(doc, 'Users', ['ID', 'Username', 'Password', 'Role', 'Permissions']);
      let rows: any[] = [];
      try {
        if (sheet.rowCount > 0) {
          rows = await sheet.getRows();
        }
      } catch (e: any) {
        console.warn('Could not fetch Users rows:', e.message);
      }
      
      // If no rows, we must create superadmin
      if (rows.length === 0) {
        const id = new Date().getTime().toString();
        await sheet.addRow({
          ID: id,
          Username: 'mastri',
          Password: 'ganteng',
          Role: 'superadmin',
          Permissions: 'all'
        });
        rows = await sheet.getRows();
      }

      const data = rows.map(r => ({
        id: r.get('ID'),
        username: r.get('Username'),
        role: r.get('Role'),
        permissions: (r.get('Permissions') || '').split(',').map((p: string) => p.trim()).filter((p: string) => p)
      }));
      res.json(data);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Gagal mengambil data user' });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const { username, password, role, permissions } = req.body;
      const doc = await connectToSpreadsheet();
      const sheet = await getOrInitSheet(doc, 'Users', ['ID', 'Username', 'Password', 'Role', 'Permissions']);
      
      let rows: any[] = [];
      if (sheet.rowCount > 0) rows = await sheet.getRows();
      
      const existing = rows.find(r => r.get('Username') === username);
      if (existing) {
        return res.status(400).json({ error: 'Username sudah digunakan' });
      }

      const id = new Date().getTime().toString();
      await sheet.addRow({
        ID: id,
        Username: username,
        Password: password,
        Role: role || 'admin',
        Permissions: Array.isArray(permissions) ? permissions.join(',') : permissions
      });
      res.json({ message: 'User berhasil ditambahkan' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Gagal menambah data user' });
    }
  });

  app.put('/api/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { username, password, role, permissions } = req.body;
      const doc = await connectToSpreadsheet();
      let sheet = doc.sheetsByTitle['Users'];
      if (sheet && sheet.rowCount > 0) {
        const rows = await sheet.getRows();
        const rowIndex = rows.findIndex(r => r.get('ID') === id);
        if (rowIndex !== -1) {
          rows[rowIndex].set('Username', username);
          if (password) rows[rowIndex].set('Password', password);
          if (role) rows[rowIndex].set('Role', role);
          if (permissions !== undefined) rows[rowIndex].set('Permissions', Array.isArray(permissions) ? permissions.join(',') : permissions);
          await rows[rowIndex].save();
          return res.json({ message: 'User berhasil diupdate' });
        }
      }
      return res.status(404).json({ error: 'Data user tidak ditemukan' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Gagal mengupdate user' });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const doc = await connectToSpreadsheet();
      let sheet = doc.sheetsByTitle['Users'];
      if (sheet && sheet.rowCount > 0) {
        const rows = await sheet.getRows();
        const rowIndex = rows.findIndex(r => r.get('ID') === id);
        if (rowIndex !== -1) {
          if (rows[rowIndex].get('Role') === 'superadmin' && rows[rowIndex].get('Username') === 'mastri') {
             return res.status(400).json({ error: 'Super Admin utama tidak bisa dihapus' });
          }
          await rows[rowIndex].delete();
          return res.json({ message: 'User berhasil dihapus' });
        }
      }
      return res.status(404).json({ error: 'Data user tidak ditemukan' });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Gagal menghapus data user' });
    }
  });

  // ==========================================
  // API ROUTE: /api/auth/login
  // ==========================================
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const doc = await connectToSpreadsheet();
      const sheet = await getOrInitSheet(doc, 'Users', ['ID', 'Username', 'Password', 'Role', 'Permissions']);
      
      let rows: any[] = [];
      if (sheet.rowCount > 0) rows = await sheet.getRows();
      
      if (rows.length === 0) {
        // Initialize superadmin if empty
        const id = new Date().getTime().toString();
        await sheet.addRow({
          ID: id,
          Username: 'mastri',
          Password: 'ganteng', 
          Role: 'superadmin',
          Permissions: 'all'
        });
        rows = await sheet.getRows();
      }

      const user = rows.find(r => r.get('Username') === username && r.get('Password') === password);
      
      if (user) {
        res.json({
          id: user.get('ID'),
          username: user.get('Username'),
          role: user.get('Role'),
          permissions: (user.get('Permissions') || '').split(',').map((p: string) => p.trim()).filter((p: string) => p)
        });
      } else {
        res.status(401).json({ error: 'Username atau password salah' });
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || 'Login gagal, coba lagi' });
    }
  });

  // ==========================================
  // API ROUTE: /api/reports/download
  // ==========================================
  app.get('/api/reports/download', async (req, res) => {
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const fs = await import('fs');
      
      const templatePath = path.join(process.cwd(), 'templates', 'Laporan_Penjagaan_Template.xlsx');
      
      // If template exists, read it. Otherwise, create a basic fallback template.
      if (fs.existsSync(templatePath)) {
        await workbook.xlsx.readFile(templatePath);
      } else {
        workbook.addWorksheet('Laporan');
        const ws = workbook.getWorksheet(1);
        if (ws) {
          ws.getCell('A1').value = 'LAPORAN REALISASI ANGGARAN';
          ws.getCell('A2').value = 'Instansi: {{NAMA_INSTANSI}}';
          ws.getCell('A3').value = 'Kepala: {{NAMA_KEPALA}}';
          ws.getCell('A4').value = 'Bendahara: {{NAMA_BENDAHARA}}';
          ws.addRow([]); // Row 5
          ws.addRow(['ID', 'Tanggal', 'Jenis Transaksi', 'Sumber Dana', 'Kode Rekening', 'Uraian', 'Nominal']); // Row 6
          
          // Style headers
          ws.getRow(6).font = { bold: true };
          ws.columns = [
            { width: 15 }, { width: 15 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 40 }, { width: 20 }
          ];
        }
      }

      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        return res.status(500).json({ error: 'Worksheet not found in template' });
      }

      // Fetch data from Google Sheets
      const doc = await connectToSpreadsheet();
      
      // 1. Fetch Profil_Instansi
      const profilSheet = doc.sheetsByTitle['Profil_Instansi'];
      let namaInstansi = 'Puskesmas Kalitengah';
      let namaKepala = '-';
      let namaBendahara = '-';
      
      if (profilSheet) {
         // Assuming Row 1 is headers, Row 2 is values
         try {
           if (profilSheet.rowCount > 0) {
             const profilRows = await profilSheet.getRows();
             if (profilRows.length > 0) {
                namaInstansi = profilRows[0].get('Nama_Instansi') || namaInstansi;
                namaKepala = profilRows[0].get('Nama_Kepala') || namaKepala;
                namaBendahara = profilRows[0].get('Bendahara') || namaBendahara;
             }
           }
         } catch(e) {
           console.warn('Could not fetch Profil_Instansi rows:', e);
         }
      }

      // 2. Replace placeholders in the entire sheet
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          if (cell.type === ExcelJS.ValueType.String && cell.value) {
            let strValue = cell.value as string;
            if (strValue.includes('{{NAMA_INSTANSI}}')) {
              cell.value = strValue.replace('{{NAMA_INSTANSI}}', namaInstansi);
            }
            if (strValue.includes('{{NAMA_KEPALA}}')) {
              cell.value = strValue.replace('{{NAMA_KEPALA}}', namaKepala);
            }
            if (strValue.includes('{{NAMA_BENDAHARA}}')) {
              cell.value = strValue.replace('{{NAMA_BENDAHARA}}', namaBendahara);
            }
          }
        });
      });

      // 3. Fetch Transaksi
      const transaksiSheet = doc.sheetsByTitle['Transaksi'];
      let transaksiRows: any[] = [];
      if (transaksiSheet) {
         try {
           if (transaksiSheet.rowCount > 0) {
             transaksiRows = await transaksiSheet.getRows();
           }
         } catch(e) {
           console.warn('Could not fetch Transaksi rows:', e);
         }
      }

      // 4. Insert data starting at a specific index
      // If we used the fallback template, we start at row 7.
      // If using an actual template, user requested e.g., Row 12. Let's start at Row 12 if the sheet has many rows, or fallback index.
      let startRow = fs.existsSync(templatePath) ? 12 : 7; 

      for (let i = 0; i < transaksiRows.length; i++) {
         const row = transaksiRows[i];
         const rowIndex = startRow + i;
         
         // Using worksheet.insertRow to push existing subsequent rows down
         const newRow = worksheet.insertRow(rowIndex, [
            row.get('ID'),
            row.get('Tanggal'),
            row.get('Jenis_Transaksi'),
            row.get('Sumber_Dana'),
            row.get('Kode_Rekening'),
            row.get('Uraian'),
            parseFloat(row.get('Nominal')) || 0
         ]);
         
         // Add borders to the new cells
         newRow.eachCell((cell) => {
           cell.border = {
             top: {style:'thin'},
             left: {style:'thin'},
             bottom: {style:'thin'},
             right: {style:'thin'}
           };
         });
         
         // Format Nominal as Currency
         const nominalCell = newRow.getCell(7);
         nominalCell.numFmt = '"Rp"\\ #,##0.00;[Red]\\-"Rp"\\ #,##0.00';
         
         newRow.commit();
      }

      // 5. Send the workbook as a buffer
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Laporan_Penjagaan.xlsx"');
      
      await workbook.xlsx.write(res);
      res.end();

    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Error generating report' });
    }
  });

  // ==========================================
  
  // Global Error Handler for API
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Unhandled JSON API Error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan internal server', details: err.message });
  });

if (process.env.NODE_ENV !== "production" && !process.env.VERCEL && process.env.NETLIFY !== "true") {
  const setupVite = async () => {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  };
  setupVite();
} else if (!process.env.VERCEL && process.env.NETLIFY !== "true") {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

if (!process.env.VERCEL && process.env.NETLIFY !== "true") {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

