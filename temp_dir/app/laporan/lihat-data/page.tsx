import React, { useState } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function LihatDataPage() {
  const [bulan, setBulan] = useState(new Date().getMonth().toString());
  const [tahun, setTahun] = useState(new Date().getFullYear().toString());
  const [sumberDana, setSumberDana] = useState("KAPITASI");

  const { data: rawTransaksiList, error: trxError } = useSWR("/api/transaksi", fetcher);
  const { data: silpaList, error: silpaError } = useSWR("/api/master/silpa", fetcher);

  // normalize data
  const transaksiList = React.useMemo(() => {
     if (!rawTransaksiList) return rawTransaksiList;
     return rawTransaksiList.map((trx: any) => {
         if (trx.jenisTransaksi === "PENDAPATAN") {
             return { ...trx, kodeRekening: "1.02.1.03.01.4.1.02.04.01.0001" };
         }
         return trx;
     });
  }, [rawTransaksiList]);

  const stdSdLaporan = (sd: string) => {
    if (!sd) return 'Lainnya';
    const raw = sd.toUpperCase().replace(/\s+/g, '');
    if (raw === 'KAPITASI') return 'KAPITASI';
    if (raw === 'NONKAPITASI' || raw === 'NON-KAPITASI') return 'NON-KAPITASI';
    if (raw === 'RETRIBUSI') return 'RETRIBUSI';
    return sd;
  };

  const getFilteredData = () => {
    if (!transaksiList) return { list: [], pend: 0, bel: 0, silpa: 0 };
    
    // Calculate SILPA (Awal Tahun)
    let initialSilpa = 0;
    if (silpaList && Array.isArray(silpaList)) {
        silpaList.forEach((s: any) => {
           if (stdSdLaporan(s.sumberDana) === stdSdLaporan(sumberDana)) {
               initialSilpa += Number(s.nominal || 0);
           }
        });
    }
    
    let pend = 0;
    let bel = 0;
    let pendYTD = 0;
    let belYTD = 0;
    
    const filtered = (Array.isArray(transaksiList) ? transaksiList : []).filter((trx: any) => {
        const trxDate = new Date(trx.tanggal);
        if (isNaN(trxDate.getTime())) return false;
        
        const isSdMatch = stdSdLaporan(trx.sumberDana) === stdSdLaporan(sumberDana);
        if (!isSdMatch) return false;

        const trxMonth = trxDate.getMonth().toString();
        const trxYear = trxDate.getFullYear().toString();

        if (trxYear === tahun) {
            if (trx.jenisTransaksi === 'PENDAPATAN' && trxDate.getMonth() <= parseInt(bulan)) pendYTD += Number(trx.nominal);
            if (trx.jenisTransaksi === 'BELANJA' && trxDate.getMonth() <= parseInt(bulan)) belYTD += Number(trx.nominal);
            
            if (trxMonth === bulan) {
                if (trx.jenisTransaksi === 'PENDAPATAN') pend += Number(trx.nominal);
                if (trx.jenisTransaksi === 'BELANJA') bel += Number(trx.nominal);
                return true;
            }
        }
        return false;
    }).sort((a: any, b: any) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

    const finalSilpa = initialSilpa + pendYTD - belYTD;

    return { list: filtered, pend, bel, silpa: finalSilpa };
  };

  const { list, pend, bel, silpa } = getFilteredData();

  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  
  if (trxError || silpaError) {
      return (
          <div className="flex flex-col items-center justify-center py-20 text-red-500">
              <p>Gagal memuat data. Silakan refresh halaman.</p>
          </div>
      );
  }

  if (!rawTransaksiList || !silpaList) {
      return (
          <div className="flex flex-col items-center justify-center py-20 text-blue-500">
              <div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin mb-4"></div>
              <p>Memuat data...</p>
          </div>
      );
  }
  
  return (
    <div className="flex flex-col gap-5 sm:gap-6 w-full pb-10">
      <div>
        <h2 className="text-xl font-bold text-gray-800 tracking-tight">Lihat Data Rekapitulasi</h2>
        <p className="text-sm text-gray-500">Melihat rekapan dan rincian transaksi berdasarkan Bulan, Tahun, dan Sumber Dana.</p>
      </div>

      <div className="bg-white border border-[#dfe3e6] rounded shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Bulan</label>
            <select value={bulan} onChange={(e) => setBulan(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
               {monthNames.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
               ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Tahun</label>
            <select value={tahun} onChange={(e) => setTahun(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
               {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                 <option key={y} value={y}>{y}</option>
               ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Sumber Dana</label>
            <select value={sumberDana} onChange={(e) => setSumberDana(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
               <option value="KAPITASI">Kapitasi</option>
               <option value="NON-KAPITASI">Non-Kapitasi</option>
               <option value="RETRIBUSI">Retribusi</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#dfe3e6] rounded shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Total Pendapatan (Bulan Ini)</h3>
            <p className="text-2xl font-bold text-green-600">Rp {pend.toLocaleString('id-ID')}</p>
        </div>
        <div className="bg-white border border-[#dfe3e6] rounded shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Total Belanja (Bulan Ini)</h3>
            <p className="text-2xl font-bold text-orange-500">Rp {bel.toLocaleString('id-ID')}</p>
        </div>
        <div className="bg-white border border-[#dfe3e6] rounded shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">SILPA (Akhir Bulan Ini)</h3>
            <p className="text-2xl font-bold text-blue-600">Rp {silpa.toLocaleString('id-ID')}</p>
        </div>
      </div>

      <div className="bg-white border border-[#dfe3e6] rounded shadow-sm overflow-hidden">
         <div className="p-4 border-b border-[#dfe3e6] bg-gray-50 flex items-center justify-between">
           <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">Rincian Transaksi ({monthNames[parseInt(bulan)]} {tahun})</h3>
           <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">{list.length} Data</span>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
                <thead>
                    <tr className="bg-gray-100/50 text-gray-600 uppercase text-[10px] tracking-wider border-b border-[#dfe3e6]">
                        <th className="p-3 font-bold w-32">Tanggal</th>
                        <th className="p-3 font-bold w-24">Jenis</th>
                        <th className="p-3 font-bold w-40">Kode Rekening</th>
                        <th className="p-3 font-bold">Uraian</th>
                        <th className="p-3 font-bold w-40 text-right">Nominal</th>
                    </tr>
                </thead>
                <tbody>
                   {list.length === 0 ? (
                       <tr>
                           <td colSpan={5} className="p-8 text-center text-gray-500 text-sm">Belum ada transaksi pada periode ini.</td>
                       </tr>
                   ) : (
                       list.map((trx: any) => (
                           <tr key={trx.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                               <td className="p-3">{trx.tanggal}</td>
                               <td className="p-3">
                                   <span className={`px-2 py-1 rounded text-[10px] font-bold ${trx.jenisTransaksi === 'PENDAPATAN' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                       {trx.jenisTransaksi}
                                   </span>
                               </td>
                               <td className="p-3 text-gray-600 break-words">{trx.kodeRekening}</td>
                               <td className="p-3 max-w-[300px] truncate" title={trx.uraian}>{trx.uraian}</td>
                               <td className="p-3 text-right font-bold text-gray-700">Rp {Number(trx.nominal || 0).toLocaleString('id-ID')}</td>
                           </tr>
                       ))
                   )}
                </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}
