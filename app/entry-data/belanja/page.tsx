"use client";

import React, { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { format } from "date-fns";
import { Trash2, Edit2, Printer } from "lucide-react";
import { useAuth } from "../../../src/lib/AuthContext";
import { KwitansiPrint } from "../../../src/components/KwitansiPrint";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function EntryBelanjaPage() {
  const { canEditOrDelete } = useAuth();
  const allowEditDelete = canEditOrDelete();

  const [tanggal, setTanggal] = useState("");
  const [sumberDana, setSumberDana] = useState("KAPITASI");
  const [subSumberDana, setSubSumberDana] = useState("");
  const [kodeRekening, setKodeRekening] = useState("");
  const [uraian, setUraian] = useState("");
  const [nominal, setNominal] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorToast, setErrorToast] = useState<{ message: string; detail?: any } | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [editingTrxId, setEditingTrxId] = useState<string | null>(null);
  const [printingTrx, setPrintingTrx] = useState<any | null>(null);

  const { data: transaksiList, isValidating: isLoadingTransaksi } = useSWR("/api/transaksi", fetcher);
  const { data: masterRekening } = useSWR("/api/master-rekening", fetcher);
  const { data: paguAnggaran } = useSWR("/api/pagu-anggaran", fetcher);
  const { data: profilData } = useSWR("/api/pengaturan/profil", fetcher);
  const { data: pejabatList } = useSWR("/api/pengaturan/pejabat", fetcher);


  const showSuccess = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => setSuccessToast(null), 5000);
  };

  const showError = (message: string, detail?: any) => {
    setErrorToast({ message, detail });
    setTimeout(() => setErrorToast(null), 8000);
  };


  const selectedSumberDanaNorm = sumberDana.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Filter pagu anggaran based on selected sumber dana
  const validPaguKodes = (Array.isArray(paguAnggaran) ? paguAnggaran : [])
    .filter(p => {
      const paguSumberNorm = (p.sumberDana || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return paguSumberNorm === selectedSumberDanaNorm;
    })
    .map(p => (p.kodeRekening || '').replace(/\.+$/, ''));

  const filteredMasterRekening = Array.isArray(masterRekening)
    ? masterRekening.filter(rek => {
        if (rek.isHeader) return false;
        const normRekKode = (rek.kodeRekening || '').replace(/\.+$/, '');
        return validPaguKodes.some(paguKode => {
           if (!paguKode) return false;
           // 1. Exact match
           if (normRekKode === paguKode) return true;
           // 2. Rekening is a child of Pagu
           if (normRekKode.startsWith(paguKode + '.')) return true;
           // 3. Pagu contains the old format (e.g. 5.1.01...) and Master uses new format (1.02...33.5.1.01...)
           if (normRekKode.endsWith('.' + paguKode) || normRekKode.endsWith(paguKode)) return true;
           // 4. Handle cases where code contains multiple dots
           const cleanPagu = paguKode.replace(/\.+/g, '.');
           const cleanNorm = normRekKode.replace(/\.+/g, '.');
           if (cleanNorm === cleanPagu || cleanNorm.startsWith(cleanPagu + '.') || cleanNorm.endsWith('.' + cleanPagu)) return true;

           return false;
        });
      }).filter((rek, index, self) =>
        index === self.findIndex((t) => t.kodeRekening === rek.kodeRekening)
      )
    : [];

  const formatRupiah = (value: string) => {
    const numberString = String(value).replace(/[^,\d]/g, "").toString();
    const split = numberString.split(",");
    const sisa = split[0].length % 3;
    let rupiah = split[0].substr(0, sisa);
    const ribuan = split[0].substr(sisa).match(/\d{3}/gi);

    if (ribuan) {
      const separator = sisa ? "." : "";
      rupiah += separator + ribuan.join(".");
    }

    return split[1] !== undefined ? rupiah + "," + split[1] : rupiah;
  };

  const handleNominalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNominal(formatRupiah(e.target.value));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorToast(null);

    const rawNominal = nominal.replace(/\./g, "").replace(/,/g, ".");
    
    try {
      const payload = {
        tanggal,
        jenisTransaksi: "BELANJA",
        sumberDana,
        subSumberDana: sumberDana === "NON-KAPITASI" ? subSumberDana : "-",
        kodeRekening,
        uraian,
        nominal: rawNominal,
      };

      const url = editingTrxId ? `/api/transaksi/${editingTrxId}` : "/api/transaksi";
      const method = editingTrxId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "Gagal menyimpan data", data.detail);
      } else {
        // Success
        showSuccess(editingTrxId ? "Transaksi belanja berhasil diupdate!" : "Transaksi belanja berhasil disimpan!");
        setTanggal("");
        setSumberDana("KAPITASI");
        setSubSumberDana("");
        setKodeRekening("");
        setUraian("");
        setNominal("");
        setEditingTrxId(null);
        // Instantly refresh datatable
        mutate("/api/transaksi");
      }
    } catch (err: any) {
      showError("Terjadi kesalahan jaringan atau sistem.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) return;

    try {
      const res = await fetch(`/api/transaksi/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json();
        showError(`Gagal menghapus: ${error.error}`);
      } else {
        showSuccess("Transaksi berhasil dihapus!");
        mutate("/api/transaksi");
      }
    } catch (err) {
      showError("Terjadi kesalahan sistem saat menghapus");
    }
  };

  const handleEdit = (trx: any) => {
    // If the data is in "YYYY-MM-DD" it will set directly, otherwise simple set as is.
    setTanggal(trx.tanggal || "");
    setSumberDana(trx.sumberDana || "KAPITASI");
    setSubSumberDana(trx.subSumberDana === "-" ? "" : (trx.subSumberDana || ""));
    setKodeRekening(trx.kodeRekening || "");
    setUraian(trx.uraian || "");
    setNominal(formatRupiah(trx.nominal?.toString() || "0"));
    setEditingTrxId(trx.id);
  };

  const handleCancelEdit = () => {
    setTanggal("");
    setSumberDana("KAPITASI");
    setSubSumberDana("");
    setKodeRekening("");
    setUraian("");
    setNominal("");
    setEditingTrxId(null);
    setErrorToast(null);
    setSuccessToast(null);
  };

  const belanjaList = Array.isArray(transaksiList) ? transaksiList.filter((t: any) => t.jenisTransaksi === 'BELANJA') : [];
  const paguAll = Array.isArray(paguAnggaran) ? paguAnggaran : [];

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const isCurrentMonth = (dateString: string) => {
    if (!dateString) return false;
    
    // Parse YYYY-MM-DD safely
    if (dateString.includes("-")) {
      const parts = dateString.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        return year === currentYear && month === currentMonth;
      }
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return false;
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  };

  const belanjaBulanIni = belanjaList.filter((t: any) => isCurrentMonth(t.tanggal));

  const totalPagu = paguAll.reduce((acc: number, item: any) => acc + (item.nominalPagu || 0), 0);
  const totalBelanjaYTD = belanjaList.reduce((acc: number, item: any) => acc + (item.nominal || 0), 0);
  const totalBelanjaBulanIni = belanjaBulanIni.reduce((acc: number, item: any) => acc + (item.nominal || 0), 0);
  const sisaPagu = totalPagu - totalBelanjaYTD;

  const summaryBelanjaBySD = belanjaList.reduce((acc: Record<string, number>, curr: any) => {
    const sd = curr.sumberDana || 'Lainnya';
    if (!acc[sd]) acc[sd] = 0;
    acc[sd] += Number(curr.nominal) || 0;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5 sm:gap-6 w-full pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 tracking-tight">Entry Belanja</h2>
          <p className="text-sm text-gray-500">Input transaksi belanja Puskesmas Kalitengah. Sistem akan otomatis memvalidasi ketersediaan pagu anggaran.</p>
        </div>
      </div>

      {successToast && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded shadow-sm flex items-start justify-between">
          <div>
            <h3 className="text-green-800 font-bold text-sm">Berhasil: {successToast}</h3>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-green-500 hover:text-green-800 font-bold px-2 py-1 bg-green-100 rounded text-xs cursor-pointer">Tutup</button>
        </div>
      )}

      {errorToast && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm flex items-start justify-between">
          <div>
            <h3 className="text-red-800 font-bold text-sm">Validasi Gagal: {errorToast.message}</h3>
            {errorToast.detail && (
              <ul className="mt-2 text-xs text-red-700 font-mono space-y-1">
                <li>Pagu Anggaran: Rp {Number(errorToast.detail.nominalPagu).toLocaleString('id-ID')}</li>
                <li>Total Terpakai: Rp {Number(errorToast.detail.totalBelanjaTerjadi).toLocaleString('id-ID')}</li>
                <li>Sisa Pagu Saat Ini: Rp {Number(errorToast.detail.sisaPagu).toLocaleString('id-ID')}</li>
                <li>Nominal Diminta: Rp {Number(errorToast.detail.nominalDiminta).toLocaleString('id-ID')}</li>
              </ul>
            )}
          </div>
          <button onClick={() => setErrorToast(null)} className="text-red-500 hover:text-red-800 font-bold px-2 py-1 bg-red-100 rounded text-xs cursor-pointer">Tutup</button>
        </div>
      )}

      {/* Visual Indicators - Belanja */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#dfe3e6] rounded shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Total Pagu Anggaran (Setahun)</h3>
            <p className="text-xl font-bold text-blue-600">
               Rp {totalPagu.toLocaleString('id-ID')}
            </p>
        </div>
        <div className="bg-white border border-[#dfe3e6] rounded shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Serapan Belanja (Total YTD)</h3>
            <p className="text-xl font-bold text-red-600">
               Rp {totalBelanjaYTD.toLocaleString('id-ID')}
            </p>
        </div>
        <div className="bg-white border border-[#dfe3e6] rounded shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Serapan Belanja (Bulan Ini)</h3>
            <p className="text-xl font-bold text-orange-500">
               Rp {totalBelanjaBulanIni.toLocaleString('id-ID')}
            </p>
        </div>
        <div className="bg-white border border-[#dfe3e6] rounded shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Sisa Pagu Keseluruhan</h3>
            <p className="text-xl font-bold text-gray-800">
               Rp {sisaPagu.toLocaleString('id-ID')}
            </p>
        </div>
      </div>

      {Object.keys(summaryBelanjaBySD).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
             <h3 className="text-sm font-bold text-gray-800 font-sans border-b border-gray-200 pb-2">Rincian Belanja per Sumber Dana (YTD)</h3>
          </div>
          {Object.entries(summaryBelanjaBySD).map(([sd, val]) => (
             <div key={sd} className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg border border-red-200 p-4 shadow-sm">
               <h4 className="text-xs font-bold text-red-900 uppercase tracking-widest">{sd}</h4>
               <p className="text-xl font-bold text-red-800 mt-1">Rp {(val as number).toLocaleString('id-ID')}</p>
             </div>
          ))}
        </div>
      )}

      {/* Form Section */}
      <div className="bg-white border border-[#dfe3e6] rounded shadow-sm">
        <div className="p-4 border-b border-[#dfe3e6] bg-gray-50 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">
            {editingTrxId ? "Update Transaksi" : "Form Input Transaksi"}
          </h3>
          {editingTrxId && (
            <button type="button" onClick={handleCancelEdit} className="text-xs text-gray-500 hover:text-gray-800">
              Batal Edit
            </button>
          )}
        </div>
        <form onSubmit={onSubmit} className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Tanggal Transaksi</label>
              <input required type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Sumber Dana</label>
              <select required value={sumberDana} onChange={(e) => {
                setSumberDana(e.target.value);
                if (e.target.value !== "NON-KAPITASI") setSubSumberDana("");
                setKodeRekening(""); // Reset kode rekening
              }} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="KAPITASI">Kapitasi</option>
                <option value="NON-KAPITASI">Non-Kapitasi</option>
                <option value="RETRIBUSI">Retribusi</option>
              </select>
            </div>

            {sumberDana === "NON-KAPITASI" && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Sub-Sumber Dana</label>
                <select required value={subSumberDana} onChange={(e) => setSubSumberDana(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="" disabled>Pilih Sub-Sumber Dana</option>
                  <option value="RITP">RITP</option>
                  <option value="ORB">ORB</option>
                  <option value="AMBULAN">Ambulan</option>
                  <option value="PRA-RUJUKAN">Pra Rujukan</option>
                  <option value="ANC-DALAM-GEDUNG">ANC dalam Gedung</option>
                  <option value="ANC-LUAR-GEDUNG">ANC Luar Gedung</option>
                  <option value="PNC">PNC</option>
                  <option value="KB">KB</option>
                  <option value="PERSALINAN">Persalinan</option>
                  <option value="KEGIATAN-KELOMPOK">Kegiatan Kelompok</option>
                  <option value="GDA-PROLANIS">GDA/Prolanis</option>
                </select>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Kode Rekening</label>
              <select required value={kodeRekening} onChange={(e) => setKodeRekening(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="" disabled>Pilih Kode Rekening</option>
                {filteredMasterRekening.map((rek: any) => (
                  <option key={rek.kodeRekening} value={rek.kodeRekening}>
                    {rek.kodeRekening} - {rek.uraian}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Uraian Transaksi</label>
              <input required type="text" placeholder="Cth: Belanja Obat-obatan" value={uraian} onChange={(e) => setUraian(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Nominal (Rp)</label>
              <input required type="text" placeholder="0" value={nominal} onChange={handleNominalChange} className="w-full border border-gray-300 rounded p-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" />
              <p className="text-[10px] text-gray-500 mt-1 italic">Diinput dalam Rupiah tanpa desimal.</p>
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end mt-2 pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded text-sm disabled:opacity-50 cursor-pointer shadow-sm transition-colors"
            >
              {loading ? "Memproses..." : (editingTrxId ? "Update Transaksi" : "Simpan Transaksi")}
            </button>
          </div>
        </form>
      </div>

      {/* Datatable Section */}
      <div className="bg-white border border-[#dfe3e6] rounded shadow-sm flex flex-col mb-4">
        <div className="p-4 border-b border-[#dfe3e6] bg-gray-50 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">Riwayat Transaksi Terbaru</h3>
          <span className="text-xs font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded">Live Syncing</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#f8f9fa] text-xs text-gray-600 border-b border-[#dfe3e6]">
              <tr>
                <th className="p-3 font-bold">WAKTU INPUT</th>
                <th className="p-3 font-bold">TANGGAL TRX</th>
                <th className="p-3 font-bold">REKENING</th>
                <th className="p-3 font-bold">URAIAN</th>
                <th className="p-3 font-bold">SUMBER DANA</th>
                <th className="p-3 font-bold text-right">NOMINAL (Rp)</th>
                <th className="p-3 font-bold text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="text-xs font-mono text-gray-700">
              {isLoadingTransaksi && !transaksiList ? (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-gray-400">Loading transaksi...</td>
                </tr>
              ) : Array.isArray(belanjaList) && belanjaList.length > 0 ? (
                belanjaList.map((trx: any) => (
                  <tr key={trx.id} className="border-b border-[#f1f3f5] hover:bg-blue-50 transition-colors">
                    <td className="p-3 text-gray-400">
                      {trx.id ? new Date(parseInt(trx.id)).toLocaleString('id-ID', { hour:'2-digit', minute:'2-digit' }) : '-'}
                    </td>
                    <td className="p-3">{trx.tanggal}</td>
                    <td className="p-3">{trx.kodeRekening}</td>
                    <td className="p-3 truncate max-w-[200px]" title={trx.uraian}>{trx.uraian}</td>
                    <td className="p-3">
                      <span className="bg-gray-100 px-2 py-1 rounded text-[10px] uppercase font-bold text-gray-600 tracking-wider">
                        {trx.sumberDana} {trx.subSumberDana !== '-' ? ` / ${trx.subSumberDana}` : ''}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold text-gray-900">
                      {Number(trx.nominal).toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-center flex items-center justify-center gap-1">
                      <button onClick={(e) => {
                          e.preventDefault();
                          const rek = Array.isArray(masterRekening) ? masterRekening.find(r => r.kodeRekening === trx.kodeRekening) : null;
                          
                          // Calculate BKU and Buku No sequences 
                          const d = new Date(trx.tanggal);
                          const isValidDate = !isNaN(d.getTime());
                          const trxMonth = isValidDate ? d.getMonth() : new Date().getMonth();
                          const trxYear = isValidDate ? d.getFullYear() : new Date().getFullYear();
                          
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
                          const bukuKasNoStr = `${seqInt}/BKU/${monthNames[trxMonth]}/${trxYear}`;

                          setPrintingTrx({
                            ...trx, 
                            namaRekening: rek?.uraian || trx.kodeRekening,
                            bukuNoFormatted: bukuNoStr,
                            bukuKasNoFormatted: bukuKasNoStr
                          });
                        }} className="p-1 px-[6px] bg-green-50 text-green-600 hover:bg-green-600 hover:text-white rounded text-[10px] font-bold transition-colors cursor-pointer print:hidden" title="Cetak Kwitansi">
                        <Printer size={12} className="inline-block" /> CETAK
                      </button>
                      {allowEditDelete && (
                        <>
                          <button onClick={() => handleEdit(trx)} className="p-1 px-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded text-[10px] font-bold transition-colors cursor-pointer print:hidden" title="Edit Transaksi">
                            EDIT
                          </button>
                          <button onClick={() => handleDelete(trx.id)} className="p-1 px-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded text-[10px] font-bold transition-colors cursor-pointer print:hidden" title="Hapus Transaksi">
                            HAPUS
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center p-8 text-gray-400">Belum ada transaksi.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Print Wrapper */}
      {printingTrx && (
         <KwitansiPrint trx={printingTrx} profilData={profilData} pejabatList={pejabatList} onClose={() => setPrintingTrx(null)} />
      )}
    </div>
  );
}
