"use client";

import React, { useState } from "react";
import useSWR, { mutate } from "swr";
import { Upload, Save, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function MasterDataPage() {
  const { data: dpa, isLoading: dpaLoading } = useSWR("/api/master/dpa", fetcher);
  
  // DPA State
  const [nomorDPA, setNomorDPA] = useState("");
  const [tanggalDPA, setTanggalDPA] = useState("");
  const [tahunPembukuan, setTahunPembukuan] = useState(new Date().getFullYear().toString());
  const [kodeOrganisasi, setKodeOrganisasi] = useState("");
  const [savingDPA, setSavingDPA] = useState(false);

  // Silpa State
  const [sumberDana, setSumberDana] = useState("Kapitasi");
  const [subSumberDana, setSubSumberDana] = useState("");
  const [nominalSilpa, setNominalSilpa] = useState("");
  const [savingSilpa, setSavingSilpa] = useState(false);

  // Import State
  const [importingRekening, setImportingRekening] = useState(false);
  const [importingPagu, setImportingPagu] = useState(false);

  React.useEffect(() => {
    if (dpa) {
      setNomorDPA(dpa.nomorDPA || "");
      setTanggalDPA(dpa.tanggalDPA || "");
      setTahunPembukuan(dpa.tahunPembukuan || new Date().getFullYear().toString());
      setKodeOrganisasi(dpa.kodeOrganisasi || "");
    }
  }, [dpa]);

  const onSaveDPA = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDPA(true);
    try {
      const res = await fetch("/api/master/dpa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomorDPA, tanggalDPA, tahunPembukuan, kodeOrganisasi })
      });
      if (!res.ok) throw new Error("Gagal menyimpan DPA");
      mutate("/api/master/dpa");
      alert("Data DPA berhasil disimpan!");
    } catch(err: any) {
      alert(err.message);
    } finally {
      setSavingDPA(false);
    }
  };

  const onSaveSilpa = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSilpa(true);
    if (!nominalSilpa || isNaN(Number(nominalSilpa))) {
      alert("Masukkan nominal Silpa yang valid");
      setSavingSilpa(false);
      return;
    }
    
    try {
      const finalSubSumberDana = sumberDana === "Non Kapitasi" ? subSumberDana : "";
      if (sumberDana === "Non Kapitasi" && !subSumberDana) {
        throw new Error("Pilih Sub Sumber Dana untuk Non Kapitasi");
      }

      const res = await fetch("/api/master/silpa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sumberDana, 
          subSumberDana: finalSubSumberDana, 
          nominal: Number(nominalSilpa) 
        })
      });
      if (!res.ok) throw new Error("Gagal menyimpan Silpa");
      
      setNominalSilpa("");
      alert("Data Silpa berhasil disimpan!");
    } catch(err: any) {
      alert(err.message);
    } finally {
      setSavingSilpa(false);
    }
  };

  const downloadFormatRekening = () => {
    const ws = XLSX.utils.json_to_sheet([
      { Kode_Rekening: "1.02.02.2.02.33.5", Uraian: "BELANJA DAERAH" },
      { Kode_Rekening: "1.02.02.2.02.33.5.1", Uraian: "BELANJA OPERASI" },
      { Kode_Rekening: "1.02.02.2.02.33.5.1.01", Uraian: "BELANJA PEGAWAI" },
      { Kode_Rekening: "1.02.02.2.02.33.5.1.01.01", Uraian: "Belanja Gaji dan Tunjangan ASN" },
      { Kode_Rekening: "1.02.02.2.02.33.5.1.01.01.09.", Uraian: "Belanja Iuran Jaminan Kesehatan ASN" },
      { Kode_Rekening: "1.02.02.2.02.33.5.1.01.01.09.0001", Uraian: "Belanja Iuran Jaminan Kesehatan PNS" },
    ]);
    // Set column widths
    ws['!cols'] = [{ wch: 35 }, { wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master_Rekening");
    XLSX.writeFile(wb, "Format_Master_Rekening.xlsx");
  };

  const downloadFormatPagu = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["SUMBER DANA", "KODE REKENING", "URAIAN", "ANGGARAN 2026", "", "", ""],
      ["", "", "", "Jumlah Item", "Satuan", "Harga", "Total"],
      ["1", "2", "3", "4", "5", "6", "7"],
      ["Kapitasi", "1.02.0.00.0.00.02.0037.5.1.01.01.09.00001", "Belanja Iuran Jaminan Kesehatan PNS", "-", "-", "-", 25000000],
      ["Kapitasi", "1.02.0.00.0.00.02.0037.5.1.01.01.09.00002", "Belanja Iuran Jaminan Kesehatan PPPK", "-", "-", "-", 18000000],
      ["Non-Kapitasi", "1.02.1.03.01.4.1.02.04.01.0001", "Pendapatan Dana NON-KAPITASI JKN", "-", "-", "-", 0]
    ]);

    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // SUMBER DANA
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // KODE REKENING
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // URAIAN
      { s: { r: 0, c: 3 }, e: { r: 0, c: 6 } }  // ANGGARAN 2026
    ];

    ws['!cols'] = [{ wch: 15 }, { wch: 45 }, { wch: 45 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
    
    // Styling
    for (let r = 0; r <= 6; r++) {
       for (let c = 0; c <= 6; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          if (cell) {
             if (r < 3) {
                cell.s = { font: { bold: true }, alignment: { horizontal: "center", vertical: "center" }, border: { top: {style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} } };
             } else {
                cell.s = { border: { top: {style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} } };
             }
          }
       }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagu_Anggaran");
    XLSX.writeFile(wb, "Format_Pagu_Anggaran.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "rekening" | "pagu") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        let jsonData: any[] = [];
        if (type === "pagu") {
          const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          if (rawData.length === 0) throw new Error("File Excel kosong");
          
          let headerIdx = -1;
          for (let i = 0; i < Math.min(10, rawData.length); i++) {
             if (String(rawData[i]?.[0]).toUpperCase().includes("SUMBER DANA") || String(rawData[i]?.[1]).toUpperCase().includes("KODE REKENING")) {
                 headerIdx = i;
                 break;
             }
          }

          if (headerIdx !== -1) {
             for (let r = headerIdx + 1; r < rawData.length; r++) {
                const row = rawData[r];
                if (!row || row.length === 0) continue;
                
                let val1 = String(row[0] || "").trim();
                let val2 = String(row[1] || "").trim();
                
                // Skip sub-headers or numbering rows
                if (val2 === "" && String(row[3] || "").includes("Jumlah Item")) continue;
                if (val1 === "1" && val2 === "2" && String(row[2] || "").trim() === "3") continue;
                
                let sumberDana = val1;
                let kode = val2;
                let uraian = String(row[2] || "").trim();
                let jumlahItem = String(row[3] || "").trim() || "-";
                let satuan = String(row[4] || "").trim() || "-";
                let harga = typeof row[5] === 'number' ? row[5] : parseFloat(String(row[5] || "0").replace(/[^0-9.-]/g, ''));
                if (isNaN(harga)) harga = 0;
                
                // We use column 6 (Total) as per the template
                let nominal = typeof row[6] === 'number' ? row[6] : parseFloat(String(row[6] || "0").replace(/[^0-9.-]/g, ''));
                if (isNaN(nominal)) nominal = 0;
                
                if (kode && (uraian || nominal > 0)) {
                   jsonData.push({
                      Sumber_Dana: sumberDana || "UMUM", // default if empty
                      Kode_Rekening: kode,
                      Uraian: uraian,
                      Jumlah_Item: jumlahItem,
                      Satuan: satuan,
                      Harga: harga,
                      Nominal_Pagu: nominal
                   });
                }
             }
          } else {
             jsonData = XLSX.utils.sheet_to_json(worksheet);
          }
        } else {
          jsonData = XLSX.utils.sheet_to_json(worksheet);
        }

        if (jsonData.length === 0) throw new Error("File Excel kosong atau format tidak sesuai");

        if (type === "rekening") {
          setImportingRekening(true);
          const res = await fetch("/api/master-rekening/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: jsonData })
          });
          if (!res.ok) throw new Error("Gagal mengunggah Master Rekening");
          alert("Master Rekening berhasil diimpor!");
        } else {
          setImportingPagu(true);
          const res = await fetch("/api/pagu-anggaran/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: jsonData })
          });
          if (!res.ok) throw new Error("Gagal mengunggah Pagu Anggaran");
          alert("Pagu Anggaran berhasil diimpor!");
        }
      } catch (err: any) {
        alert(err.message);
      } finally {
        if (type === "rekening") setImportingRekening(false);
        else setImportingPagu(false);
        
        // Reset file input
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6 w-full max-w-5xl mx-auto pb-10">
      <div>
        <h2 className="text-xl font-bold text-gray-800 tracking-tight">Master Data</h2>
        <p className="text-sm text-gray-500">Kelola DPA, Silpa, Master Rekening, dan Pagu Anggaran.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* DPA Section */}
        <div className="bg-white border border-[#dfe3e6] rounded shadow-sm">
          <div className="p-4 border-b border-[#dfe3e6] bg-gray-50">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">Dokumen Pelaksanaan Anggaran (DPA)</h3>
          </div>
          <form onSubmit={onSaveDPA} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Nomor DPA</label>
              <input required type="text" value={nomorDPA} onChange={(e) => setNomorDPA(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Masukkan Nomor DPA" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Tanggal DPA</label>
              <input required type="date" value={tanggalDPA} onChange={(e) => setTanggalDPA(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Tahun Pembukuan</label>
              <input required type="number" min="2000" max="2100" value={tahunPembukuan} onChange={(e) => setTahunPembukuan(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Kode Organisasi / Instansi</label>
              <input type="text" value={kodeOrganisasi} onChange={(e) => setKodeOrganisasi(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="1.02.0.00.0.00..." />
            </div>
            <div className="pt-2">
              <button type="submit" disabled={savingDPA || dpaLoading} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded text-sm disabled:opacity-50 transition-colors shadow-sm cursor-pointer">
                <Save size={16} />
                {savingDPA ? "Menyimpan..." : "Simpan DPA"}
              </button>
            </div>
          </form>
        </div>

        {/* Silpa Section */}
        <div className="bg-white border border-[#dfe3e6] rounded shadow-sm">
          <div className="p-4 border-b border-[#dfe3e6] bg-gray-50">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">Silpa Tahun Lalu</h3>
          </div>
          <form onSubmit={onSaveSilpa} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Sumber Dana</label>
              <select value={sumberDana} onChange={(e) => setSumberDana(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="Kapitasi">Kapitasi</option>
                <option value="Non Kapitasi">Non Kapitasi</option>
                <option value="Retribusi">Retribusi</option>
              </select>
            </div>
            {sumberDana === "Non Kapitasi" && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Sub Sumber Dana (Non Kapitasi)</label>
                <select value={subSumberDana} onChange={(e) => setSubSumberDana(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">-- Pilih Sub Sumber Dana --</option>
                  <option value="RITP">RITP</option>
                  <option value="Ambulan">Ambulan</option>
                  <option value="Pra Rujukan">Pra Rujukan</option>
                  <option value="ANC dalam gedung">ANC dalam gedung</option>
                  <option value="ANC Luar gedung">ANC Luar gedung</option>
                  <option value="PNC">PNC</option>
                  <option value="Persalinan">Persalinan</option>
                  <option value="KB">KB</option>
                  <option value="GDP">GDP</option>
                  <option value="Kegiatan Kelompok">Kegiatan Kelompok</option>
                  <option value="ORB">ORB</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Nominal Silpa (Rp)</label>
              <input required type="number" min="0" value={nominalSilpa} onChange={(e) => setNominalSilpa(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono tracking-wider" placeholder="0" />
            </div>
            <div className="pt-2">
              <button type="submit" disabled={savingSilpa} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded text-sm disabled:opacity-50 transition-colors shadow-sm cursor-pointer">
                <Save size={16} />
                {savingSilpa ? "Menyimpan..." : "Simpan Silpa"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Import Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-[#dfe3e6] rounded shadow-sm">
          <div className="p-4 border-b border-[#dfe3e6] bg-gray-50 flex items-center gap-2">
            <FileSpreadsheet className="text-gray-500 w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">Import Master Rekening</h3>
          </div>
          <div className="p-5 flex flex-col items-center justify-center space-y-4">
            <p className="text-sm text-center text-gray-600">Unggah file Excel (.xlsx) dengan kolom: <br/><strong className="font-mono bg-gray-100 px-1 rounded text-xs text-blue-700">Kode_Rekening</strong> dan <strong className="font-mono bg-gray-100 px-1 rounded text-xs text-blue-700">Uraian</strong></p>
            
            <button type="button" onClick={downloadFormatRekening} className="text-xs text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2">
              Unduh Format Excel Master Rekening
            </button>

            <label className={`w-full flex flex-col items-center px-4 py-6 bg-white rounded-md border-2 border-dashed ${importingRekening ? 'border-gray-300 bg-gray-50' : 'border-blue-300 hover:border-blue-400 hover:bg-blue-50'} cursor-pointer transition-colors group`}>
               <Upload className={`w-8 h-8 ${importingRekening ? 'text-gray-400' : 'text-blue-500 group-hover:text-blue-600'} mb-2`} />
               <span className="text-sm font-medium text-gray-600">
                 {importingRekening ? "Sedang Mengimpor..." : "Pilih File Excel"}
               </span>
               <input type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => handleFileUpload(e, "rekening")} disabled={importingRekening} />
            </label>
          </div>
        </div>

        <div className="bg-white border border-[#dfe3e6] rounded shadow-sm">
          <div className="p-4 border-b border-[#dfe3e6] bg-gray-50 flex items-center gap-2">
             <FileSpreadsheet className="text-gray-500 w-4 h-4" />
             <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">Import Pagu Anggaran</h3>
          </div>
          <div className="p-5 flex flex-col items-center justify-center space-y-4">
            <p className="text-sm text-center text-gray-600">Terima file Excel (.xlsx) sesuai dengan format baku. Judul (opsional) dengan kata "DANA [Sumber]" untuk mendeteksi sumber dana. Baris header mengandung KODE REKENING, URAIAN, lalu ikuti tabel rincian (gunakan Total di kolom ke-6).</p>

            <button type="button" onClick={downloadFormatPagu} className="text-xs text-green-600 hover:text-green-800 font-medium underline underline-offset-2">
              Unduh Format Excel Pagu Anggaran
            </button>

            <label className={`w-full flex flex-col items-center px-4 py-6 bg-white rounded-md border-2 border-dashed ${importingPagu ? 'border-gray-300 bg-gray-50' : 'border-green-300 hover:border-green-400 hover:bg-green-50'} cursor-pointer transition-colors group`}>
               <Upload className={`w-8 h-8 ${importingPagu ? 'text-gray-400' : 'text-green-500 group-hover:text-green-600'} mb-2`} />
               <span className="text-sm font-medium text-gray-600">
                 {importingPagu ? "Sedang Mengimpor..." : "Pilih File Excel"}
               </span>
               <input type="file" accept=".xlsx, .xls" className="hidden" onChange={(e) => handleFileUpload(e, "pagu")} disabled={importingPagu} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
