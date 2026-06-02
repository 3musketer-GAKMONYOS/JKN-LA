"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import * as ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function LaporanPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sumberDana, setSumberDana] = useState("KAPITASI");
  const [jenisLaporan, setJenisLaporan] = useState("Buku Kas Umum");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedStart = localStorage.getItem("laporan_startDate");
    const savedEnd = localStorage.getItem("laporan_endDate");
    const savedSumber = localStorage.getItem("laporan_sumberDana");
    const savedJenis = localStorage.getItem("laporan_jenisLaporan");

    if (savedStart) setStartDate(savedStart);
    if (savedEnd) setEndDate(savedEnd);
    if (savedSumber) setSumberDana(savedSumber);
    if (savedJenis) setJenisLaporan(savedJenis);
  }, []);

  // Save state to localStorage strings whenever they change
  useEffect(() => {
    localStorage.setItem("laporan_startDate", startDate);
    localStorage.setItem("laporan_endDate", endDate);
    localStorage.setItem("laporan_sumberDana", sumberDana);
    localStorage.setItem("laporan_jenisLaporan", jenisLaporan);
  }, [startDate, endDate, sumberDana, jenisLaporan]);

  const { data: rawTransaksiList } = useSWR("/api/transaksi", fetcher);
  const transaksiList = React.useMemo(() => {
     if (!rawTransaksiList) return rawTransaksiList;
     return rawTransaksiList.map((trx: any) => {
         if (trx.jenisTransaksi === "PENDAPATAN") {
             return { ...trx, kodeRekening: "1.02.1.03.01.4.1.02.04.01.0001" };
         }
         return trx;
     });
  }, [rawTransaksiList]);
  const { data: paguAnggaran } = useSWR("/api/pagu-anggaran", fetcher);
  const { data: listPejabat } = useSWR("/api/pengaturan/pejabat", fetcher);
  const { data: dpaData } = useSWR("/api/master/dpa", fetcher);
  const { data: profilData } = useSWR("/api/pengaturan/profil", fetcher);
  const { data: masterRekening } = useSWR("/api/master-rekening", fetcher);
  const { data: silpaList } = useSWR("/api/master/silpa", fetcher);

  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 5000);
  };

  const getDinkesInfo = () => {
    let namaInstansi = "PUSKESMAS KALITENGAH";
    let alamatInstansi = "Jl. Mahkota No. 100 Kalitengah 62255";
    let emailInstansi = "Telp. (0322) 391971 E-mail: puskes.kalitengah@gmail.com";
    if (profilData) {
       if (profilData.namaInstansi) namaInstansi = profilData.namaInstansi.toUpperCase();
       if (profilData.alamatInstansi) alamatInstansi = profilData.alamatInstansi;
       if (profilData.emailInstansi) emailInstansi = profilData.emailInstansi;
    }
    const dinkesStr = "DINAS KESEHATAN KABUPATEN LAMONGAN"; 
    const pemkabStr = "PEMERINTAH KABUPATEN LAMONGAN";
    return { namaInstansi, alamatInstansi, emailInstansi, dinkesStr, pemkabStr };
  };

  const getPejabatInfo = () => {
    let namaKepala = "dr. SESANTI";
    let nipKepala = "19861108 201412 2 001";
    let namaBendahara = "TRI MARIYONO HADI UPOYO";
    let nipBendahara = "19820622 200604 1 006";

    if (listPejabat && Array.isArray(listPejabat)) {
      const kepala = listPejabat.find((p: any) => p.jabatan && p.jabatan.toLowerCase().includes("kepala"));
      const bendahara = listPejabat.find((p: any) => p.jabatan && p.jabatan.toLowerCase().includes("bendahara"));
      
      if (kepala) {
        namaKepala = kepala.nama; nipKepala = kepala.nip;
      }
      if (bendahara) {
        namaBendahara = bendahara.nama; nipBendahara = bendahara.nip;
      }
    }
    return { namaKepala, nipKepala, namaBendahara, nipBendahara };
  };

  const getDpaInfo = () => {
     let noDPA = "900.1.2.4/02/Kep.DPA/413.201/XII/2025";
     let tglDPA = "31 Desember 2025";
     let thn = new Date().getFullYear().toString();
     let kdOrg = "1.02.0.00.0.00.02.0037"; // default
     if (dpaData) {
        if (dpaData.nomorDPA) noDPA = dpaData.nomorDPA;
        if (dpaData.tanggalDPA) tglDPA = format(new Date(dpaData.tanggalDPA), "dd MMMM yyyy", { locale: idLocale });
        if (dpaData.tahunPembukuan) thn = dpaData.tahunPembukuan;
        if (dpaData.kodeOrganisasi) kdOrg = dpaData.kodeOrganisasi;
     }
     return { noDPA, tglDPA, thn, kdOrg };
  };

  const handleExportExcel = async () => {
    if (!transaksiList || !paguAnggaran) {
      alert("Data sedang dimuat, silakan coba lagi.");
      return;
    }

    if (!startDate || !endDate) {
      alert("Pilih range tanggal terlebih dahulu.");
      return;
    }

    const { namaKepala, nipKepala, namaBendahara, nipBendahara } = getPejabatInfo();
    const { namaInstansi, alamatInstansi, emailInstansi, dinkesStr, pemkabStr } = getDinkesInfo();
    const { noDPA, tglDPA, thn, kdOrg } = getDpaInfo();

    const stdSdLaporan = (sd: string) => {
      if (!sd) return 'Lainnya';
      const raw = sd.toUpperCase().replace(/\s+/g, '');
      if (raw === 'KAPITASI') return 'KAPITASI';
      if (raw === 'NONKAPITASI' || raw === 'NON-KAPITASI') return 'NON-KAPITASI';
      if (raw === 'RETRIBUSI') return 'RETRIBUSI';
      return sd;
    };

    const filteredTransaksi = transaksiList.filter((trx: any) => {
      const trxDate = new Date(trx.tanggal);
      const start = new Date(startDate);
      const end = new Date(endDate);
      const isDateValid = trxDate >= start && trxDate <= end;
      const isSumberDanaValid = sumberDana === "SEMUA" || stdSdLaporan(trx.sumberDana) === stdSdLaporan(sumberDana);
      return isDateValid && isSumberDanaValid;
    }).sort((a: any, b: any) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime() || Number(a.id) - Number(b.id));

    const exportFileName = `${jenisLaporan}_${sumberDana}_${startDate}_sd_${endDate}.xlsx`;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(jenisLaporan.substring(0, 31));
    
    let isLandscape = true;
    if (jenisLaporan === "SPTJM" || jenisLaporan === "Laporan Pendapatan") {
       isLandscape = false;
    }

    ws.pageSetup = {
      paperSize: 9, // A4
      orientation: isLandscape ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.5, right: 0.5,
        top: 0.5, bottom: 0.5,
        header: 0.3, footer: 0.3
      }
    };

    ws.properties.defaultColWidth = 15;

    const borderThin: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
    };

    const alignCenter: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true };
    const alignLeft: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'left', wrapText: true };
    const alignRight: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'right' };

    try {
      if (jenisLaporan === "Buku Kas Umum") {
        ws.mergeCells('A1:G1');
        ws.getCell('A1').value = `BUKU PEMBANTU KAS PENERIMAAN DAN PENGELUARAN DANA ${sumberDana}`;
        ws.getCell('A1').alignment = alignCenter; ws.getCell('A1').font = { bold: true };
      
        ws.mergeCells('A2:G2');
        ws.getCell('A2').value = `DALAM RANGKA PENCATATAN PENDAPATAN DAN BELANJA`;
        ws.getCell('A2').alignment = alignCenter; ws.getCell('A2').font = { bold: true };
      
        ws.mergeCells('A3:G3');
        ws.getCell('A3').value = `Periode: ${format(new Date(startDate), "dd MMMM yyyy", { locale: idLocale })} s/d ${format(new Date(endDate), "dd MMMM yyyy", { locale: idLocale })}`;
        ws.getCell('A3').alignment = alignCenter; ws.getCell('A3').font = { bold: true };
      
        ws.addRow([]);
        
        const hkRow1 = ws.addRow(["Kepala FKTP", "", `: ${namaKepala}`]);
        ws.mergeCells(`A${hkRow1.number}:B${hkRow1.number}`);
        
        const hkRow2 = ws.addRow(["Bendahara", "", `: ${namaBendahara}`]);
        ws.mergeCells(`A${hkRow2.number}:B${hkRow2.number}`);
        ws.addRow([]);

        const headerRow = ws.addRow(["NO", "TANGGAL", "NO.BUKTI", "URAIAN", "PENDAPATAN", "BELANJA", "SALDO"]);
        headerRow.eachCell((cell) => { cell.border = borderThin; cell.alignment = alignCenter; cell.font = { bold: true }; });
      
        const numRow = ws.addRow(["1", "2", "3", "4", "5", "6", "7"]);
        numRow.eachCell((cell) => { cell.border = borderThin; cell.alignment = alignCenter; });
      
        ws.getColumn(1).width = 5; ws.getColumn(2).width = 15; ws.getColumn(3).width = 20; ws.getColumn(4).width = 50; ws.getColumn(5).width = 20; ws.getColumn(6).width = 20; ws.getColumn(7).width = 20;
      
        let prevPendapatan = 0;
        let prevBelanja = 0;
        let totalSilpa = 0;

        if (silpaList && Array.isArray(silpaList)) {
          silpaList.forEach((silpa: any) => {
            const isSdValid = sumberDana === "SEMUA" || stdSdLaporan(silpa.sumberDana) === stdSdLaporan(sumberDana);
            if (isSdValid) {
              totalSilpa += Number(silpa.nominal || 0);
            }
          });
        }

        if (transaksiList && Array.isArray(transaksiList)) {
          transaksiList.forEach((trx: any) => {
            const trxDate = new Date(trx.tanggal);
            const start = new Date(startDate);
            const isSdValid = sumberDana === "SEMUA" || stdSdLaporan(trx.sumberDana) === stdSdLaporan(sumberDana);
            if (trxDate < start && isSdValid) {
               if (trx.jenisTransaksi === "PENDAPATAN") prevPendapatan += Number(trx.nominal);
               else if (trx.jenisTransaksi === "BELANJA") prevBelanja += Number(trx.nominal);
            }
          });
        }

        const isJanuari = new Date(startDate).getMonth() === 0;
        
        let showPendapatanLalu = isJanuari ? 0 : prevPendapatan;
        let showBelanjaLalu = isJanuari ? 0 : prevBelanja;
        let saldo = totalSilpa + prevPendapatan - prevBelanja;
        
        const startSaldoRow = ws.addRow([
            "1",
            format(new Date(startDate), "dd-MMM-yy", { locale: idLocale }),
            "-",
            isJanuari ? "Saldo Awal (SILPA)" : "Saldo bulan Lalu",
            showPendapatanLalu,
            showBelanjaLalu,
            saldo
        ]);
        startSaldoRow.eachCell((cell, colNumber) => {
           cell.border = borderThin;
           cell.alignment = [5,6,7].includes(colNumber) ? alignRight : (colNumber === 4 ? alignLeft : alignCenter);
           if ([5,6,7].includes(colNumber)) cell.numFmt = '#,##0';
        });

        let totalPendapatanBulanIni = 0; 
        let totalBelanjaBulanIni = 0;
      
        filteredTransaksi.forEach((trx: any, index: number) => {
          const isPendapatan = trx.jenisTransaksi === "PENDAPATAN";
          const pendapatan = isPendapatan ? Number(trx.nominal) : 0;
          const belanja = !isPendapatan ? Number(trx.nominal) : 0;
          saldo = saldo + pendapatan - belanja;
          totalPendapatanBulanIni += pendapatan;
          totalBelanjaBulanIni += belanja;
      
          let noBukti = "";
          let formattedUraian = trx.uraian;
          
          if (!isPendapatan) {
            // Calculate BKU Sequence for BELANJA
            const d = new Date(trx.tanggal);
            const trxMonth = !isNaN(d.getTime()) ? d.getMonth() : new Date().getMonth();
            const trxYear = !isNaN(d.getTime()) ? d.getFullYear() : new Date().getFullYear();
            
            const allBulanIni = Array.isArray(transaksiList) ? transaksiList.filter((t: any) => {
              if (t.jenisTransaksi !== 'BELANJA') return false;
              const dt = new Date(t.tanggal);
              if (isNaN(dt.getTime())) return false;
              return dt.getMonth() === trxMonth && dt.getFullYear() === trxYear;
            }).sort((a: any, b: any) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime() || Number(a.id) - Number(b.id)) : [];
            
            const idx = allBulanIni.findIndex((t: any) => t.id === trx.id) + 1;
            const seqInt = idx > 0 ? idx : 1; 
            const bukuNoStr = String(seqInt).padStart(2, '0');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
            noBukti = `${bukuNoStr}/BKU/${monthNames[trxMonth]}/${trxYear}`;
            
            // Format Uraian
            const pMaster = Array.isArray(masterRekening) ? masterRekening : [];
            const rek = pMaster.find((r: any) => r.kodeRekening === trx.kodeRekening);
            const uraianRekening = rek ? rek.uraian : trx.kodeRekening;
            formattedUraian = `${uraianRekening} (${trx.uraian})`;
          }

          const row = ws.addRow([
            index + 2, // starts at 2 since Saldo is 1
            format(new Date(trx.tanggal), "dd-MMM-yy", { locale: idLocale }),
            noBukti, 
            formattedUraian,
            pendapatan,
            belanja,
            saldo
          ]);
      
          row.eachCell((cell, colNumber) => {
            cell.border = borderThin;
            cell.alignment = [5,6,7].includes(colNumber) ? alignRight : (colNumber === 4 ? alignLeft : alignCenter);
            if ([5,6,7].includes(colNumber)) cell.numFmt = '#,##0';
          });
        });
      
        const sumBulanIniRow = ws.addRow(["", "", "", "Jumlah bulan ini", totalPendapatanBulanIni, totalBelanjaBulanIni, 0]);
        sumBulanIniRow.eachCell((cell, colNumber) => {
          cell.border = borderThin; cell.font = { bold: true };
          cell.alignment = colNumber >= 5 ? alignRight : (colNumber === 4 ? alignRight : alignCenter);
          if (colNumber >= 5) cell.numFmt = '#,##0';
        });

        const sumBulanLaluRow = ws.addRow(["", "", "", "Jumlah Sampai Bulan Lalu", showPendapatanLalu, showBelanjaLalu, 0]);
        sumBulanLaluRow.eachCell((cell, colNumber) => {
          cell.border = borderThin; cell.font = { bold: true };
          cell.alignment = colNumber >= 5 ? alignRight : (colNumber === 4 ? alignRight : alignCenter);
          if (colNumber >= 5) cell.numFmt = '#,##0';
        });
        
        const sumSDRow = ws.addRow(["", "", "", "Jumlah sampai dengan bulan ini", showPendapatanLalu + totalPendapatanBulanIni, showBelanjaLalu + totalBelanjaBulanIni, saldo]);
        sumSDRow.eachCell((cell, colNumber) => {
          cell.border = borderThin; cell.font = { bold: true };
          cell.alignment = colNumber >= 5 ? alignRight : (colNumber === 4 ? alignRight : alignCenter);
          if (colNumber >= 5) cell.numFmt = '#,##0';
        });

        ws.addRow([]);
        ws.addRow(["", "Kas di Bendahara Pengeluaran Pembantu sebesar", "", `Rp. ${saldo.toLocaleString('id-ID')},00`]);
        ws.addRow(["", "Terdiri dari"]);
        ws.addRow(["", "a. Tunai     :"]);
        ws.addRow(["", `b. Saldo bank:   Rp. ${saldo.toLocaleString('id-ID')},00`]);
        ws.addRow([]);
      
        const tglStr = `Kalitengah, ${format(new Date(endDate), "dd MMMM yyyy", { locale: idLocale })}`;
        const signRow1 = ws.addRow(["", "Mengesahkan,", "", "", tglStr, "", ""]);
        const signRow2 = ws.addRow(["", `Kepala FKTP ${namaInstansi}`, "", "", "Bendahara Pengeluaran", "", ""]);
        const signRow3 = ws.addRow(["", "", "", "", `${namaInstansi}`, "", ""]); 
        ws.addRow([]); ws.addRow([]); ws.addRow([]);
        const signRow4 = ws.addRow(["", namaKepala, "", "", namaBendahara, "", ""]);
        const signRow5 = ws.addRow(["", `NIP. ${nipKepala}`, "", "", `NIP. ${nipBendahara}`, "", ""]);
        
        [signRow1, signRow2, signRow3, signRow4, signRow5].forEach(r => {
           ws.mergeCells(`B${r.number}:D${r.number}`);
           ws.mergeCells(`E${r.number}:G${r.number}`);
           r.eachCell(c => { 
                if(c.value) c.alignment = { vertical: 'middle', horizontal: 'center' }; 
           });
        });

        signRow4.getCell(2).font = { bold: true, underline: true };
        signRow4.getCell(5).font = { bold: true, underline: true };
        
      } else if (jenisLaporan === "Laporan Penjagaan") {
        const puskesmasName = namaInstansi.toUpperCase().replace('PUSKESMAS ', '');
        ws.getCell('A1').value = pemkabStr;
        ws.getCell('A2').value = dinkesStr;
        ws.getCell('A3').value = `Puskesmas : ${puskesmasName}`;
        ws.getCell('A4').value = `Periode : ${format(new Date(startDate), "d MMMM yyyy", { locale: idLocale })} s/d ${format(new Date(endDate), "d MMMM yyyy", { locale: idLocale })}`;
        
        [1,2,3,4].forEach(row => {
          ws.mergeCells(`A${row}:K${row}`);
          ws.getCell(`A${row}`).alignment = alignCenter;
          if (row < 3) ws.getCell(`A${row}`).font = { bold: true };
        });
      
        ws.addRow([]);
        
        const headerRow1 = ws.addRow(["No", "KODE REKENING", "URAIAN", `ANGGARAN ${thn}`, "", "", "", `REALISASI s/d BULAN LALU`, "SISA ANGGARAN BULAN LALU", format(new Date(endDate), "MMMM", { locale: idLocale }), ""]);
        const headerRow2 = ws.addRow(["", "", "", "Jumlah Item", "Satuan", "Harga", "Total", "", "", "REALISASI", "SISA ANGGARAN"]);
        const numRow = ws.addRow(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11=(9-10)"]);

        ws.mergeCells("A6:A7");
        ws.mergeCells("B6:B7");
        ws.mergeCells("C6:C7");
        ws.mergeCells("D6:G6");
        ws.mergeCells("H6:H7");
        ws.mergeCells("I6:I7");
        ws.mergeCells("J6:K6");

        [headerRow1, headerRow2, numRow].forEach(row => {
            row.eachCell((cell) => {
               cell.border = borderThin;
               cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
               cell.font = { bold: true };
            });
        });
        
        ws.getColumn(1).width = 5; ws.getColumn(2).width = 25; ws.getColumn(3).width = 50;
        ws.getColumn(4).width = 12; ws.getColumn(5).width = 12; ws.getColumn(6).width = 15;
        [7,8,9,10,11].forEach(col => ws.getColumn(col).width = 20);

        const itemsMap = new Map<string, any>();
        let no = 1;

        paguAnggaran.forEach((p: any) => {
           if (sumberDana !== "SEMUA" && stdSdLaporan(p.sumberDana) !== stdSdLaporan(sumberDana)) return;
           const key = p.kodeRekening || p.uraian;
           if (!itemsMap.has(key)) {
               itemsMap.set(key, { ...p, anggaran: Number(p.nominalPagu) || 0 });
           } else {
               itemsMap.get(key).anggaran += Number(p.nominalPagu) || 0;
           }
        });

        transaksiList.forEach((trx: any) => {
           if (sumberDana !== "SEMUA" && stdSdLaporan(trx.sumberDana) !== stdSdLaporan(sumberDana)) return;
           const key = (trx.kodeRekening && trx.kodeRekening !== "-") ? trx.kodeRekening : trx.uraian;
           if (!itemsMap.has(key)) {
               itemsMap.set(key, { 
                   kodeRekening: trx.kodeRekening !== "-" ? trx.kodeRekening : "", 
                   uraian: trx.uraian, 
                   anggaran: 0
               });
           }
        });

        let allItems = Array.from(itemsMap.values());
        allItems.sort((a, b) => {
            if (a.kodeRekening && b.kodeRekening) return a.kodeRekening.localeCompare(b.kodeRekening);
            return (a.uraian || "").localeCompare(b.uraian || "");
        });

        allItems.forEach((item: any) => {
           let rLalu = 0;
           let rIni = 0;
           
           transaksiList.forEach((trx: any) => {
              if (sumberDana !== "SEMUA" && stdSdLaporan(trx.sumberDana) !== stdSdLaporan(sumberDana)) return;

              const refKey = (trx.kodeRekening && trx.kodeRekening !== "-") ? trx.kodeRekening : trx.uraian;
              const itemKey = item.kodeRekening || item.uraian;
              
              if (refKey === itemKey) {
                 const trxDate = new Date(trx.tanggal);
                 const start = new Date(startDate);
                 const end = new Date(endDate);
                 if (trxDate < start) {
                     rLalu += Number(trx.nominal) || 0;
                 } else if (trxDate >= start && trxDate <= end) {
                     rIni += Number(trx.nominal) || 0;
                 }
              }
           });

           const anggaran = item.anggaran || 0;
           const sisaLalu = anggaran - rLalu;
           const sisaIni = sisaLalu - rIni;

           const row = ws.addRow([
               no++,
               item.kodeRekening || "-",
               item.uraian || "-",
               "-",
               "-",
               "-",
               anggaran,
               rLalu,
               sisaLalu,
               rIni,
               sisaIni
           ]);

           row.eachCell((cell, colNumber) => {
               cell.border = borderThin;
               if (colNumber === 1 || colNumber === 4 || colNumber === 5) cell.alignment = { vertical: 'middle', horizontal: 'center' };
               else if (colNumber > 5 || colNumber === 2) {
                  cell.alignment = { vertical: 'middle', horizontal: colNumber === 2 ? 'left' : 'right' };
                  if (colNumber > 5) cell.numFmt = '#,##0';
               } else {
                  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
               }
           });
        });
      
        ws.addRow([]); ws.addRow([]);
        const tglStr2 = `Kalitengah, ${format(new Date(endDate), "d MMMM yyyy", { locale: idLocale })}`;
        const signRow1 = ws.addRow(["", "Mengesahkan,", "", "", "", "", "", "", tglStr2]);
        const signRow2 = ws.addRow(["", `Kepala FKTP ${namaInstansi.toUpperCase()}`, "", "", "", "", "", "", "Bendahara Pengeluaran"]);
        const signRow3 = ws.addRow(["", "", "", "", "", "", "", "", `${namaInstansi.toUpperCase()}`]);
        ws.addRow([]); ws.addRow([]); ws.addRow([]);
        const signRow4 = ws.addRow(["", namaKepala, "", "", "", "", "", "", namaBendahara]);
        const signRow5 = ws.addRow(["", `NIP. ${nipKepala}`, "", "", "", "", "", "", `NIP. ${nipBendahara}`]);
        
        [signRow1, signRow2, signRow3, signRow4, signRow5].forEach(r => {
           ws.mergeCells(`B${r.number}:E${r.number}`);
           ws.mergeCells(`I${r.number}:K${r.number}`);
           r.eachCell(c => { 
                if(c.value) c.alignment = { vertical: 'middle', horizontal: 'center' }; 
           });
        });
        signRow4.getCell(2).font = { bold: true, underline: true };
        signRow4.getCell(9).font = { bold: true, underline: true };
        
      } else if (jenisLaporan === "Laporan Realisasi") {
        ws.mergeCells('A1:E1');
        ws.getCell('A1').value = `LAPORAN REALISASI DANA ${sumberDana} JKN PADA FKTP ${namaInstansi}`;
        ws.getCell('A1').font = {bold: true}; ws.getCell('A1').alignment = alignCenter;
        ws.mergeCells('A2:E2');
        ws.getCell('A2').value = pemkabStr.replace("PEMERINTAH ", "");
        ws.getCell('A2').font = {bold: true}; ws.getCell('A2').alignment = alignCenter;
        ws.mergeCells('A3:E3');
        ws.getCell('A3').value = `Periode : ${format(new Date(startDate), "dd MMMM yyyy", { locale: idLocale })} s/d ${format(new Date(endDate), "dd MMMM yyyy", { locale: idLocale })}`;
        ws.getCell('A3').font = {bold: true}; ws.getCell('A3').alignment = alignCenter;
        
        ws.addRow([]);
        const hRow = ws.addRow(["NO", "URAIAN", "JUMLAH ANGGARAN (Rp.)", "JUMLAH REALISASI (Rp.)", "SELISIH KURANG (Rp.)"]);
        hRow.eachCell(c => { c.font={bold:true}; c.border=borderThin; c.alignment=alignCenter; });
      
        ws.getColumn(1).width = 5; ws.getColumn(2).width = 40; ws.getColumn(3).width = 25; ws.getColumn(4).width = 25; ws.getColumn(5).width = 25;
      
        let totalAnggaran = 0;
        if (paguAnggaran && Array.isArray(paguAnggaran)) {
           paguAnggaran.forEach((p: any) => {
              if (sumberDana === "SEMUA" || stdSdLaporan(p.sumberDana) === stdSdLaporan(sumberDana)) {
                 totalAnggaran += Number(p.nominalPagu) || 0;
              }
           });
        }
        
        const totalRealisasiBelanja = filteredTransaksi.filter((t: any) => t.jenisTransaksi === 'BELANJA').reduce((s:number,t:any)=>s+Number(t.nominal),0);
        const totalRealisasiPendapatan = filteredTransaksi.filter((t: any) => t.jenisTransaksi === 'PENDAPATAN').reduce((s:number,t:any)=>s+Number(t.nominal),0);
      
        const formatRow = (dataRow: any[]) => {
           let r = ws.addRow(dataRow);
           r.eachCell((c,i)=>{ c.border=borderThin; c.alignment= i>2?alignRight:alignLeft; if(i>2)c.numFmt='#,##0'; });
           return r;
        };
      
        formatRow(["1", "Anggaran Tahun ini", totalAnggaran, 0, totalAnggaran - 0]).getCell(1).alignment=alignCenter;
        
        let selisihPendapatan = totalAnggaran - totalRealisasiPendapatan;
        formatRow(["", "Pendapatan", totalAnggaran, totalRealisasiPendapatan, selisihPendapatan]);
        
        const rowJump1 = formatRow(["", "Jumlah", totalAnggaran, totalRealisasiPendapatan, selisihPendapatan]);
        rowJump1.eachCell(c=>{c.font={bold:true};});
        
        formatRow(["", "", "", "", ""]);
        
        let selisihBelanja = totalAnggaran - totalRealisasiBelanja;
        const rowJump2 = formatRow(["", "Belanja", totalAnggaran, totalRealisasiBelanja, selisihBelanja]);
        rowJump2.eachCell(c=>{c.font={bold:true};});
      
        ws.addRow([]);
        ws.addRow(["", "Laporan realisasi yang disampaikan telah sesuai dengan sasaran penggunaan yang ditetapkan dengan peraturan"]);
        ws.addRow(["", "perundang-undangan dan didukung oleh kelengkapan dokumen yang sah sesuai ketentuan yang sah sesuai"]);
        ws.addRow(["", "yang berlaku dan bertanggungjawab atas kebenarannya."]);
        ws.addRow([]);
        ws.addRow(["", "Demikian laporan realisasi ini dibuat untuk digunakan sebagaimana mestinya."]);
        ws.addRow([]);
      
        const tglStrRealisasi = `Kalitengah, ${format(new Date(endDate), "dd MMMM yyyy", { locale: idLocale })}`; 
        const signRow1 = ws.addRow(["", "", "", tglStrRealisasi, ""]); 
        const signRow2 = ws.addRow(["", "", "", `Kepala ${namaInstansi}`, ""]);
        ws.addRow([]); ws.addRow([]); ws.addRow([]);
        const signRow3 = ws.addRow(["", "", "", namaKepala, ""]);
        const signRow4 = ws.addRow(["", "", "", `NIP. ${nipKepala}`, ""]);
      
        [signRow1,signRow2,signRow3,signRow4].forEach(r=>{
           ws.mergeCells(`D${r.number}:E${r.number}`);
           r.eachCell(c=>{ if (c.value) c.alignment = { vertical: 'middle', horizontal: 'center' }; });
        });
        signRow3.getCell(4).font = {bold:true, underline:true};
        
      } else if (jenisLaporan === "Laporan Pendapatan") {
        const titleSD = sumberDana.toUpperCase() + (sumberDana.toUpperCase() === 'KAPITASI' || sumberDana.toUpperCase() === 'NON-KAPITASI' ? ' JKN' : '');
        ws.mergeCells('A1:E1'); ws.getCell('A1').value = `PENDAPATAN DAN BELANJA DANA ${titleSD}`; ws.getCell('A1').alignment=alignCenter; ws.getCell('A1').font={bold:true};
        ws.mergeCells('A2:E2'); ws.getCell('A2').value = `PUSKESMAS ${namaInstansi.toUpperCase().replace('PUSKESMAS ', '')}`; ws.getCell('A2').alignment=alignCenter; ws.getCell('A2').font={bold:true};
        
        const bln = format(new Date(endDate), "MMMM", { locale: idLocale });
        const thnLap = format(new Date(endDate), "yyyy", { locale: idLocale });
        ws.mergeCells('A3:E3'); ws.getCell('A3').value = `Bulan ${bln} Tahun ${thnLap}`; ws.getCell('A3').alignment=alignCenter; ws.getCell('A3').font={bold:true};
        
        ws.addRow([]);
        const hRow = ws.addRow(["NO", "KODE REKENING", "URAIAN", "PENDAPATAN", "BELANJA"]);
        hRow.eachCell(c=>{c.font={bold:true}; c.border=borderThin; c.alignment=alignCenter});
        
        ws.getColumn(1).width = 5; ws.getColumn(2).width = 30; ws.getColumn(3).width = 60; ws.getColumn(4).width = 20; ws.getColumn(5).width = 20;
      
        const itemsMap = new Map<string, any>();
        if (paguAnggaran && Array.isArray(paguAnggaran)) {
           paguAnggaran.forEach((p: any) => {
              if (sumberDana !== "SEMUA" && stdSdLaporan(p.sumberDana) !== stdSdLaporan(sumberDana)) return;
              const key = p.kodeRekening || p.uraian;
              if (!itemsMap.has(key)) itemsMap.set(key, { ...p, _key: key });
           });
        }
        
        filteredTransaksi.forEach((trx: any) => {
           if (sumberDana !== "SEMUA" && stdSdLaporan(trx.sumberDana) !== stdSdLaporan(sumberDana)) return;
           const key = (trx.kodeRekening && trx.kodeRekening !== "-") ? trx.kodeRekening : trx.uraian;
           if (!itemsMap.has(key)) {
              itemsMap.set(key, { kodeRekening: trx.kodeRekening !== "-" ? trx.kodeRekening : "", uraian: trx.uraian, _key: key });
           }
        });

        if (masterRekening && Array.isArray(masterRekening)) {
            masterRekening.forEach((m: any) => {
               if (m.isHeader) {
                  const key = m.kodeRekening;
                  if (!itemsMap.has(key)) itemsMap.set(key, { ...m, _key: key });
               }
            });
        }

        let basePrefix = "1.02.0.00.0.00.02.0037"; // default
        const sampleKey = Array.from(itemsMap.keys()).find(k => k && (k.includes(".5.") || k.includes(".4.")));
        if (sampleKey) {
            const match = sampleKey.match(/^(.*?)\.[45]\./);
            if (match) basePrefix = match[1];
        }

        const SDTitle = sumberDana === "SEMUA" ? "JKN" : (sumberDana.toUpperCase() + (sumberDana.toUpperCase() === 'KAPITASI' || sumberDana.toUpperCase() === 'NON-KAPITASI' ? ' JKN' : ''));
        itemsMap.set(`1.02.1.03.01.4.1.02.04.01.0001`, { _key: `1.02.1.03.01.4.1.02.04.01.0001`, kodeRekening: `1 02 1 03 01 4 1 02 04 01 0001`, uraian: `Pendapatan Dana ${SDTitle}`, isTopTitle: true });
        itemsMap.set(`${basePrefix}.5`, { _key: `${basePrefix}.5`, kodeRekening: "", uraian: "BELANJA", isHeader: true });
        itemsMap.set(`${basePrefix}.5.1.00`, { _key: `${basePrefix}.5.1.00`, kodeRekening: `${basePrefix.replace(/\./g, " ")} 5 1 0`, uraian: "BELANJA PEGAWAI", isHeader: true }); 
        itemsMap.set(`${basePrefix}.5.1.02.00`, { _key: `${basePrefix}.5.1.02.00`, kodeRekening: `${basePrefix.replace(/\./g, " ")} 5 1 02`, uraian: "BELANJA BARANG DAN JASA", isHeader: true });
        itemsMap.set(`${basePrefix}.5.2.00`, { _key: `${basePrefix}.5.2.00`, kodeRekening: `${basePrefix.replace(/\./g, " ")} 5 2`, uraian: "BELANJA MODAL", isHeader: true });

        let allItems = Array.from(itemsMap.values());
        allItems.sort((a, b) => {
           const kA = a._key || a.kodeRekening || a.uraian || "";
           const kB = b._key || b.kodeRekening || b.uraian || "";
           return kA.localeCompare(kB);
        });

        let totalPendapatan = 0; let totalBelanja = 0; let no = 1;

        allItems.forEach((item: any) => {
           let rPendapatan = 0;
           let rBelanja = 0;
           
           filteredTransaksi.forEach((trx: any) => {
              if (sumberDana !== "SEMUA" && stdSdLaporan(trx.sumberDana) !== stdSdLaporan(sumberDana)) return;
              const refKey = (trx.kodeRekening && trx.kodeRekening !== "-") ? trx.kodeRekening : trx.uraian;
              const itemKey = item._key || item.kodeRekening || item.uraian;
              if (refKey === itemKey) {
                 if (trx.jenisTransaksi === 'PENDAPATAN') rPendapatan += Number(trx.nominal) || 0;
                 if (trx.jenisTransaksi === 'BELANJA') rBelanja += Number(trx.nominal) || 0;
              }
           });

           totalPendapatan += rPendapatan;
           totalBelanja += rBelanja;

           let type = "";
           let kr = item.kodeRekening || "";
           const ur = (item.uraian || "").toUpperCase();
           if (item.isTopTitle || kr.includes(".4.") || kr.match(/ 4 /) || kr.startsWith("4")) type = "PENDAPATAN";
           else if (item.isHeader || kr.includes(".5.") || kr.match(/ 5 /) || kr.startsWith("5")) type = "BELANJA";
           
           if (!type) {
              if (ur.includes("PENDAPATAN")) type = "PENDAPATAN";
              else if (ur.includes("BELANJA")) type = "BELANJA";
           }
           if (!type) {
              if (rPendapatan > 0) type = "PENDAPATAN";
              else if (rBelanja > 0) type = "BELANJA";
           }

           // Only show Pendapatan row once, through our top title, ignoring duplicates
           if (!item.isTopTitle && type === "PENDAPATAN") return;

           let displayKr = kr;
           if (displayKr && displayKr.includes(basePrefix) && item._key) {
               // Convert standard leaf dots to spaces after basePrefix
               const originalSuffix = item._key.substring(basePrefix.length);
               displayKr = basePrefix.replace(/\./g, " ") + originalSuffix.replace(/\./g, " ");
           }

           let colPendapatan: any = "";
           let colBelanja: any = "";

           if (type === "PENDAPATAN") {
              colPendapatan = rPendapatan === 0 ? "0" : rPendapatan;
           } else if (type === "BELANJA") {
              if (!item.isHeader) {
                 colBelanja = rBelanja === 0 ? "-" : rBelanja;
              }
           }

           let currentNo: string | number = "";
           if (!item.isHeader && !item.isTopTitle && kr && kr.length > 5) {
              currentNo = no++;
           } else if (item.isTopTitle) {
              currentNo = no++;
           }

           const r = ws.addRow([currentNo, displayKr, item.uraian || "-", colPendapatan, colBelanja]);
           r.eachCell((c, colNum) => {
              c.border = borderThin;
              if (item.isTopTitle || item.isHeader) {
                  c.font = { bold: true };
              }
              if (colNum === 1) c.alignment = { vertical: 'middle', horizontal: 'center' };
              else if (colNum === 2 || colNum === 3) c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
              else {
                 c.alignment = { vertical: 'middle', horizontal: 'right' };
                 if (typeof c.value === 'number') c.numFmt = '#,##0';
              }
              if (item.isHeader && item.uraian !== "BELANJA") {
                  if (colNum === 4 || colNum === 5) { // fill empty yellow backgrounds just for exactly format match
                      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
                  }
              }
           });
        });
      
        const totR = ws.addRow(["", "", "JUMLAH", totalPendapatan === 0 ? "-" : totalPendapatan, totalBelanja === 0 ? "-" : totalBelanja]);
        totR.eachCell((c,i)=>{c.border=borderThin; c.alignment= (i===1||i===2)?alignCenter: (i===3?alignCenter:alignRight); c.font={bold:true}; if(typeof c.value==='number')c.numFmt='#,##0';});
      
        ws.addRow([]); ws.addRow([]);
        const tglStrPendapatan = `Kalitengah, ${format(new Date(endDate), "dd MMMM yyyy", { locale: idLocale })}`;
        const sR1 = ws.addRow(["", "Mengetahui,", "", "", tglStrPendapatan]);
        const sR2 = ws.addRow(["", `Kepala ${namaInstansi}`, "", "", "Bendahara Pengeluaran"]);
        ws.addRow([]); ws.addRow([]); ws.addRow([]);
        const sR3 = ws.addRow(["", namaKepala, "", "", namaBendahara]);
        const sR4 = ws.addRow(["", `NIP. ${nipKepala}`, "", "", `NIP. ${nipBendahara}`]);
        
        [sR1, sR2, sR3, sR4].forEach(r => {
           ws.mergeCells(`B${r.number}:C${r.number}`);
           ws.mergeCells(`E${r.number}:F${r.number}`);
           r.eachCell(c => { if (c.value) c.alignment = { vertical: 'middle', horizontal: 'center' }; });
        });
        sR3.getCell(2).font = { bold: true, underline: true };
        sR3.getCell(5).font = { bold: true, underline: true };
        
      } else if (jenisLaporan === "SPTJM") {
        const tahunSptjm = format(new Date(endDate), "yyyy");
        ws.mergeCells('A1:D1'); ws.getCell('A1').value = "SURAT PERNYATAAN TANGGUNG JAWAB"; ws.getCell('A1').alignment=alignCenter; ws.getCell('A1').font={bold:true};
        ws.mergeCells('A2:D2'); ws.getCell('A2').value = `Nomor : 900.1.3.6/           /413.102.5.8/${tahunSptjm}`; ws.getCell('A2').alignment=alignCenter; ws.getCell('A2').font={bold:true};
        ws.addRow([]);
        
        ws.addRow(["1. Nama FKTP", `: ${namaInstansi}`]);
        ws.addRow(["2. Kode Organisasi", `: ${kdOrg}`]);
        ws.addRow(["3. Nomor/Tanggal DPA-SKF", `: ${noDPA}, Tanggal ${tglDPA}`]);
        ws.addRow(["4. Kegiatan", `: Penyediaan Biaya Operasional dan Pemeliharaan Dana ${sumberDana}`]);
        
        ws.addRow([]);
        ws.mergeCells(`A9:D9`); ws.getCell('A9').value = `Yang bertanda tangan dibawah ini Kepala ${namaInstansi}`;
        ws.addRow([]);
        ws.mergeCells(`A11:D11`); ws.getCell('A11').value = "Menyatakan bahwa saya bertanggungjawab atas semua realisasi pendapatan yang telah diterima dan";
        ws.mergeCells(`A12:D12`); ws.getCell('A12').value = `telah dibayar kepada yang berhak menerima, yang dananya bersumber dari Dana ${sumberDana}.`;
        ws.addRow([]);
      
        const ht = ws.addRow(["PENDAPATAN", "", "BELANJA", ""]);
        ht.eachCell(c=>{c.border=borderThin; c.font={bold:true}; c.alignment=alignCenter;});
        ws.mergeCells(`A${ht.number}:B${ht.number}`); ws.mergeCells(`C${ht.number}:D${ht.number}`);
        
        const hb = ws.addRow(["Kode rekening", "Jumlah", "Kode Rekening", "Jumlah"]);
        hb.eachCell(c=>{c.border=borderThin; c.font={bold:true}; c.alignment=alignCenter;});
        
        ws.getColumn(1).width = 40; ws.getColumn(2).width = 25; ws.getColumn(3).width = 40; ws.getColumn(4).width = 25;
      
        const pendMap = new Map<string, number>();
        const belMap = new Map<string, number>();
        let tP = 0, tB = 0;

        filteredTransaksi.forEach((t: any) => {
            const nom = Number(t.nominal);
            if (t.jenisTransaksi === 'PENDAPATAN') {
                pendMap.set(t.kodeRekening, (pendMap.get(t.kodeRekening) || 0) + nom);
                tP += nom;
            } else if (t.jenisTransaksi === 'BELANJA') {
                belMap.set(t.kodeRekening, (belMap.get(t.kodeRekening) || 0) + nom);
                tB += nom;
            }
        });

        const pendapatanT = Array.from(pendMap.entries()).map(([k, v]) => ({ kodeRekening: k, nominal: v }));
        const belanjaT = Array.from(belMap.entries()).map(([k, v]) => ({ kodeRekening: k, nominal: v }));
        
        const maxRows = Math.max(pendapatanT.length, belanjaT.length, 5);
      
        for(let i=0; i<maxRows; i++){
          const p = pendapatanT[i]; const b = belanjaT[i];
          
          const r = ws.addRow([
            p ? p.kodeRekening : "", p ? Number(p.nominal) : "",
            b ? b.kodeRekening : "", b ? Number(b.nominal) : ""
          ]);
          r.eachCell((c,idx)=>{
            c.border=borderThin; c.alignment= idx%2===0?alignRight:alignLeft; 
            if(idx%2===0) { c.numFmt='#,##0'; c.alignment = alignRight; }
          });
        }
      
        const tr = ws.addRow(["Jumlah Pendapatan", tP, "Jumlah Belanja", tB]);
        tr.eachCell((c,idx)=>{c.border=borderThin; c.font={bold:true}; if(idx%2===0) c.numFmt='#,##0';});
      
        ws.addRow([]);
        ws.mergeCells(`A${tr.number+2}:D${tr.number+2}`); ws.getCell(`A${tr.number+2}`).value = "Bukti - bukti pendapatan dan atau belanja di atas disimpan sesuai ketentuan yang berlaku untuk kelengkapan administrasi dan...";
        ws.addRow([]);
        
        const tglStrSPTJM = `Kalitengah, ${format(new Date(endDate), "dd MMMM yyyy", { locale: idLocale })}`;
        const sR1 = ws.addRow(["", "", "", tglStrSPTJM, ""]);
        const sR2 = ws.addRow(["", "", "", `Kepala ${namaInstansi}`, ""]);
        ws.addRow([]); ws.addRow([]); ws.addRow([]);
        const sR3 = ws.addRow(["", "", "", namaKepala, ""]);
        const sR4 = ws.addRow(["", "", "", `NIP. ${nipKepala}`, ""]);
        
        [sR1, sR2, sR3, sR4].forEach(r => {
           ws.mergeCells(`D${r.number}:E${r.number}`);
           r.eachCell(c => { if(c.value) c.alignment = { vertical: 'middle', horizontal: 'center' }; });
        });
        sR3.getCell(4).font = { bold: true, underline: true };
        
      } else if (jenisLaporan === "Laporan Belanja Modal (Kapitasi)") {
        ws.mergeCells('A1:N1'); ws.getCell('A1').value = `BELANJA MODAL DANA ${sumberDana}`; ws.getCell('A1').alignment=alignCenter; ws.getCell('A1').font={bold:true};
        ws.mergeCells('A2:N2'); ws.getCell('A2').value = `TAHUN ANGGARAN ${thn}`; ws.getCell('A2').alignment=alignCenter; ws.getCell('A2').font={bold:true};
        ws.addRow([]);
        ws.addRow(["OPD", `: ${dinkesStr}`]);
        ws.addRow(["PUSKESMAS", `: ${namaInstansi}`]);
        ws.addRow(["BAGIAN BULAN", `: ${format(new Date(endDate), "MMMM yyyy", { locale: idLocale })}`]);
        ws.addRow([]);
      
        const r1 = ws.addRow(["NO", "NOTA/KWITANSI/SPK", "", "BERITA ACARA SERAH TERIMA", "", "NAMA BARANG", "MERK / TIPE", "BAHAN", "QTY", "HARGA SATUAN", "PPN", "JUMLAH", "NIS BELANJA", "KETERANGAN"]);
        const r2 = ws.addRow(["", "NOMOR", "TANGGAL", "NOMOR", "TANGGAL", "", "", "", "", "", "", "", "", ""]);
        
        ws.mergeCells(`A${r1.number}:A${r2.number}`);
        ws.mergeCells(`B${r1.number}:C${r1.number}`); 
        ws.mergeCells(`D${r1.number}:E${r1.number}`); 
        ws.mergeCells(`F${r1.number}:F${r2.number}`); 
        ws.mergeCells(`G${r1.number}:G${r2.number}`); 
        ws.mergeCells(`H${r1.number}:H${r2.number}`); 
        ws.mergeCells(`I${r1.number}:I${r2.number}`); 
        ws.mergeCells(`J${r1.number}:J${r2.number}`);  
        ws.mergeCells(`K${r1.number}:K${r2.number}`); 
        ws.mergeCells(`L${r1.number}:L${r2.number}`); 
        ws.mergeCells(`M${r1.number}:M${r2.number}`); 
        ws.mergeCells(`N${r1.number}:N${r2.number}`); 
      
        [r1,r2].forEach(r=>{
          r.eachCell(c=>{c.border=borderThin; c.alignment=alignCenter; c.font={bold:true, size: 10};});
        });
      
        const nr = ws.addRow([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
        nr.eachCell(c=>{c.border=borderThin; c.alignment=alignCenter; c.font={size:9};});
      
        // Mock data for Belanja Modal since we need actual modal details, we just output blank rows
        for(let i=0; i<5; i++){
          let dr = ws.addRow(["", "", "", "", "", i===2?"NIHIL":"", "", "", "", "", "", "", "", ""]);
          dr.eachCell(c=>{c.border=borderThin; c.alignment=alignCenter;});
        }
      
        const tr = ws.addRow(["", "", "", "", "", "TOTAL", "", "", "", "", "", 0]);
        tr.eachCell((c,i)=>{c.border=borderThin; c.alignment=alignCenter; if(i===6)c.font={bold:true};});
        ws.mergeCells(`A${tr.number}:E${tr.number}`);
        ws.mergeCells(`F${tr.number}:K${tr.number}`);
        ws.mergeCells(`L${tr.number}:N${tr.number}`);
      
        ws.addRow([]); ws.addRow([]);
        const tglStrMod = `Kalitengah, ${format(new Date(endDate), "dd MMMM yyyy", { locale: idLocale })}`;
        const sR1 = ws.addRow(["", "", "", "", "", "", "", "", "", "", tglStrMod, ""]);
        const sR2 = ws.addRow(["", "", "", "", "", "", "", "", "", "", "Mengetahui", ""]);
        const sR3 = ws.addRow(["", "", "", "", "", "", "", "", "", "", `KEPALA ${namaInstansi.toUpperCase()}`, ""]);
        ws.addRow([]); ws.addRow([]);
        const sR4 = ws.addRow(["", "", "", "", "", "", "", "", "", "", namaKepala, ""]);
        const sR5 = ws.addRow(["", "", "", "", "", "", "", "", "", "", `NIP. ${nipKepala}`, ""]);
      
        [sR1, sR2, sR3, sR4, sR5].forEach(r => {
             ws.mergeCells(`K${r.number}:N${r.number}`);
             r.eachCell(c => { if(c.value) c.alignment = { vertical: 'middle', horizontal: 'center' }; });
        });
        sR4.getCell(11).font = { bold: true, underline: true };
      } else {
        alert("Jenis laporan belum didukung");
        return;
      }

      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), exportFileName);
      showSuccess(`Laporan ${jenisLaporan} berhasil diunduh!`);
    } catch (e: any) {
      alert("Gagal melakukan export Excel: " + e.message);
    }
  };

  const handleExportPengantar = async () => {
    if (!startDate || !endDate) {
      alert("Pilih range tanggal terlebih dahulu.");
      return;
    }
    const { namaKepala, nipKepala } = getPejabatInfo();
    const { namaInstansi, alamatInstansi, emailInstansi, dinkesStr, pemkabStr } = getDinkesInfo();
    
    try {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Surat Pengantar");
      
      ws.pageSetup = {
        paperSize: 9, // A4
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.5, right: 0.5,
          top: 0.5, bottom: 0.5,
          header: 0.3, footer: 0.3
        }
      };

      ws.getColumn(1).width = 5;
      ws.getColumn(2).width = 45;
      ws.getColumn(3).width = 15;
      ws.getColumn(4).width = 25;
  
      const alignCenter: Partial<ExcelJS.Alignment> = { vertical: 'middle', horizontal: 'center', wrapText: true };
      const borderThin: Partial<ExcelJS.Borders> = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  
      ws.mergeCells('A1:D1'); ws.getCell('A1').value = pemkabStr; ws.getCell('A1').alignment=alignCenter;
      ws.mergeCells('A2:D2'); ws.getCell('A2').value = (dinkesStr.replace(" KABUPATEN LAMONGAN", "")); ws.getCell('A2').alignment=alignCenter;
      ws.mergeCells('A3:D3'); ws.getCell('A3').value = namaInstansi; ws.getCell('A3').alignment=alignCenter; ws.getCell('A3').font={bold:true, size:14};
      ws.mergeCells('A4:D4'); ws.getCell('A4').value = alamatInstansi; ws.getCell('A4').alignment=alignCenter;
      ws.mergeCells('A5:D5'); ws.getCell('A5').value = emailInstansi; ws.getCell('A5').alignment=alignCenter;
      
      const r5 = ws.addRow([]);
      r5.eachCell((c, i) => { if(i<=4) c.border = { bottom: { style: 'double' } } });
  
      ws.addRow([]);
      const dR = ws.addRow(["", "", `Kalitengah, ${format(new Date(), "dd MMMM yyyy", { locale: idLocale })}`]);
      ws.mergeCells(`C${dR.number}:D${dR.number}`);
      ws.addRow([]);
      ws.addRow(["", "", "Kepada"]);
      ws.addRow(["", "", "Yth. Kepala Dinas Kesehatan"]);
      ws.addRow(["", "", "Kabupaten Lamongan"]);
      ws.addRow(["", "", "Di - LAMONGAN"]);
      [dR.number, dR.number+1, dR.number+2, dR.number+3, dR.number+4].forEach(n=> ws.mergeCells(`C${n}:D${n}`));
      ws.getCell(`C${dR.number+4}`).font = {bold:true, underline:true};
  
      ws.addRow([]); ws.addRow([]);
      const spR = ws.addRow(["", "SURAT PENGANTAR"]);
      ws.mergeCells(`A${spR.number}:D${spR.number}`); ws.getCell(`A${spR.number}`).alignment = alignCenter; ws.getCell(`A${spR.number}`).font = {bold: true, underline: true};
      
      const nsR = ws.addRow(["", `Nomor : 400.7.22.1 / 417 / 413.102.5.8 / ${new Date().getFullYear()}`]);
      ws.mergeCells(`A${nsR.number}:D${nsR.number}`); ws.getCell(`A${nsR.number}`).alignment = alignCenter; ws.getCell(`A${nsR.number}`).font = {bold: true};
  
      ws.addRow([]);
      const tblH = ws.addRow(["No", "Jenis Surat yang dikirim", "Lampiran", "Dikirim"]);
      tblH.eachCell(c=>{c.border=borderThin; c.font={bold:true}; c.alignment=alignCenter;});
  
      const tbl1 = ws.addRow(["1", `Laporan Dana ${sumberDana} bulan ${format(new Date(startDate), "MMMM yyyy", { locale: idLocale })}`, "1 Bendel", "Dikirim dengan hormat untuk menjadikan periksa"]);
      const tbl2 = ws.addRow(["2", `Laporan Penjagaan ${sumberDana} dan SILPA bulan ${format(new Date(startDate), "MMMM yyyy", { locale: idLocale })}`, "2 lembar", ""]);
      ws.mergeCells(`D${tbl1.number}:D${tbl2.number}`);
      
      [tbl1,tbl2].forEach(r=>r.eachCell(c=> {c.border=borderThin; c.alignment={vertical:'top', wrapText:true}; }));
      tbl1.getCell(1).alignment = alignCenter; tbl2.getCell(1).alignment = alignCenter;
  
      ws.addRow([]); ws.addRow([]);
      const sR1 = ws.addRow(["", "Tanda Terima :", "", `Kepala ${namaInstansi}`, ""]);
      const sR2 = ws.addRow(["", "Tanggal", "", "", ""]);
      ws.addRow([]); ws.addRow([]); ws.addRow([]);
      const sR3 = ws.addRow(["", "( .................................... )", "", namaKepala, ""]);
      const sR4 = ws.addRow(["", "", "", `NIP. ${nipKepala}`, ""]);
      
      [sR1, sR2, sR3, sR4].forEach(r => {
         ws.mergeCells(`D${r.number}:F${r.number}`);
         ws.mergeCells(`B${r.number}:C${r.number}`);
      });
      sR3.getCell(4).font = { bold: true, underline: true };
      sR1.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      sR3.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      sR4.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      sR1.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
      sR2.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
      sR3.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
  
      const buffer = await wb.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Surat_Pengantar_${format(new Date(startDate), "MMM_yyyy")}.xlsx`);
      showSuccess(`Surat Pengantar berhasil diunduh!`);
    } catch (e: any) {
        alert("Gagal melakukan export Excel: " + e.message);
    }
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6 w-full max-w-7xl mx-auto pb-10">
      <div>
        <h2 className="text-xl font-bold text-gray-800 tracking-tight">Laporan & Unduh Data {sumberDana !== 'SEMUA' ? sumberDana : ''}</h2>
        <p className="text-sm text-gray-500">Pilih parameter di bawah ini untuk mengunduh laporan dalam format Excel.</p>
      </div>

      {successToast && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded shadow-sm flex items-start justify-between">
          <div>
            <h3 className="text-green-800 font-bold text-sm">Berhasil: {successToast}</h3>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-green-500 hover:text-green-800 font-bold px-2 py-1 bg-green-100 rounded text-xs cursor-pointer">Tutup</button>
        </div>
      )}

      <div className="bg-white border border-[#dfe3e6] rounded shadow-sm">
        <div className="p-4 border-b border-[#dfe3e6] bg-gray-50">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">Parameter Laporan</h3>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
               <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tanggal Mulai (Dari)</label>
                  <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Tanggal Akhir (Sampai)</label>
                  <input required type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
               </div>
               <div>
                 <label className="block text-xs font-bold text-gray-700 mb-1">Sumber Dana</label>
                 <select required value={sumberDana} onChange={(e) => setSumberDana(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                   <option value="SEMUA">Semua Sumber Dana</option>
                   <option value="KAPITASI">Kapitasi</option>
                   <option value="NON-KAPITASI">Non-Kapitasi</option>
                   <option value="RETRIBUSI">Retribusi</option>
                 </select>
               </div>
            </div>

            <div className="space-y-4">
               <div>
                   <label className="block text-xs font-bold text-gray-700 mb-1">Jenis Laporan</label>
                   <select required value={jenisLaporan} onChange={(e) => setJenisLaporan(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                       <option value="Buku Kas Umum">Buku Kas Umum</option>
                       <option value="Laporan Penjagaan">Laporan Penjagaan</option>
                       <option value="Laporan Realisasi">Laporan Realisasi</option>
                       <option value="Laporan Pendapatan">Laporan Pendapatan</option>
                       <option value="SPTJM">SPTJM</option>
                       <option value="Laporan Belanja Modal (Kapitasi)">Laporan Belanja Modal</option>
                   </select>
               </div>
               
               <div className="pt-6 border-t border-gray-100 flex flex-col gap-3">
                   <button 
                       onClick={handleExportExcel}
                       className="w-full bg-[#004e8a] hover:bg-[#003d6d] text-white font-bold py-2.5 px-4 rounded text-sm transition-colors shadow-sm cursor-pointer"
                   >
                       Unduh Laporan ({jenisLaporan})
                   </button>
                   
                   <button 
                       onClick={handleExportPengantar}
                       className="w-full bg-[#1b252e] hover:bg-[#111921] text-white font-bold py-2.5 px-4 rounded text-sm transition-colors shadow-sm cursor-pointer"
                   >
                       Cetak Surat Pengantar
                   </button>
               </div>
            </div>
        </div>
      </div>
    </div>
  );
}
