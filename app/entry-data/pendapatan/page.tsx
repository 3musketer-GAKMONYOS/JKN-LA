"use client";

import React, { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { format } from "date-fns";
import { Trash2, Edit2 } from "lucide-react";
import { useAuth } from "../../../src/lib/AuthContext";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function EntryPendapatanPage() {
  const { canEditOrDelete } = useAuth();
  const allowEditDelete = canEditOrDelete();

  const [tanggal, setTanggal] = useState("");
  const [sumberDana, setSumberDana] = useState("KAPITASI");
  const [subSumberDana, setSubSumberDana] = useState("");
  const [uraian, setUraian] = useState("");
  const [nominal, setNominal] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorToast, setErrorToast] = useState<{ message: string; detail?: any } | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const [editingTrxId, setEditingTrxId] = useState<string | null>(null);

  const { data: transaksiList, isValidating: isLoadingTransaksi } = useSWR("/api/transaksi", fetcher);
  const { data: silpaList } = useSWR("/api/master/silpa", fetcher);

  const showSuccess = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => setSuccessToast(null), 5000);
  };

  const showError = (message: string, detail?: any) => {
    setErrorToast({ message, detail });
    setTimeout(() => setErrorToast(null), 8000);
  };

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
        jenisTransaksi: "PENDAPATAN",
        sumberDana,
        subSumberDana: sumberDana === "NON-KAPITASI" ? subSumberDana : "-",
        kodeRekening: "1.02.1.03.01.4.1.02.04.01.0001",
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
        showSuccess(editingTrxId ? "Transaksi pendapatan berhasil diupdate!" : "Transaksi pendapatan berhasil disimpan!");
        setTanggal("");
        setSumberDana("KAPITASI");
        setSubSumberDana("");
        setUraian("");
        setNominal("");
        setEditingTrxId(null);
        mutate("/api/transaksi");
      }
    } catch (err: any) {
      showError("Terjadi kesalahan jaringan atau sistem.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus transaksi pendapatan ini?")) return;

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
    setTanggal(trx.tanggal || "");
    setSumberDana(trx.sumberDana || "KAPITASI");
    setSubSumberDana(trx.subSumberDana === "-" ? "" : (trx.subSumberDana || ""));
    setUraian(trx.uraian || "");
    setNominal(formatRupiah(trx.nominal?.toString() || "0"));
    setEditingTrxId(trx.id);
  };

  const handleCancelEdit = () => {
    setTanggal("");
    setSumberDana("KAPITASI");
    setSubSumberDana("");
    setUraian("");
    setNominal("");
    setEditingTrxId(null);
    setErrorToast(null);
    setSuccessToast(null);
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const isCurrentMonth = (dateString: string) => {
    if (!dateString) return false;
    
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

  const pendapatanList = Array.isArray(transaksiList) ? transaksiList.filter((t: any) => t.jenisTransaksi === 'PENDAPATAN') : [];
  const pendapatanBulanIni = pendapatanList.filter((t: any) => isCurrentMonth(t.tanggal));
  
  const totalSilpa = Array.isArray(silpaList) ? silpaList.reduce((sum: number, item: any) => sum + (item.nominal || 0), 0) : 0;
  const totalPendapatanYTD = pendapatanList.reduce((sum: number, item: any) => sum + (item.nominal || 0), 0);
  const totalPemasukanGlobal = totalSilpa + totalPendapatanYTD;

  const summaryPendapatanBySD = pendapatanList.reduce((acc: Record<string, number>, curr: any) => {
    const sd = curr.sumberDana || 'Lainnya';
    if (!acc[sd]) acc[sd] = 0;
    acc[sd] += Number(curr.nominal) || 0;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-5 sm:gap-6 w-full pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 tracking-tight">Entry Pendapatan</h2>
          <p className="text-sm text-gray-500">Input transaksi pendapatan atau pemasukan dana Puskesmas.</p>
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
            <h3 className="text-red-800 font-bold text-sm">Gagal Menyimpan: {errorToast.message}</h3>
          </div>
          <button onClick={() => setErrorToast(null)} className="text-red-500 hover:text-red-800 font-bold px-2 py-1 bg-red-100 rounded text-xs cursor-pointer">Tutup</button>
        </div>
      )}

      {/* Menampilkan Sinkronisasi Silpa */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#dfe3e6] rounded shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Total Silpa Tersedia</h3>
            <p className="text-xl font-bold text-blue-600">
               Rp {totalSilpa.toLocaleString('id-ID')}
            </p>
        </div>
        <div className="bg-white border border-[#dfe3e6] rounded shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Pendapatan (Total YTD)</h3>
            <p className="text-xl font-bold text-green-600">
               Rp {totalPendapatanYTD.toLocaleString('id-ID')}
            </p>
        </div>
        <div className="bg-white border border-[#dfe3e6] rounded shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Pendapatan (Bulan Ini)</h3>
            <p className="text-xl font-bold text-orange-500">
               Rp {pendapatanBulanIni.reduce((sum: number, item: any) => sum + (item.nominal || 0), 0).toLocaleString('id-ID')}
            </p>
        </div>
        <div className="bg-white border border-[#dfe3e6] rounded shadow-sm p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Pemasukan Global (Silpa + Total YTD)</h3>
            <p className="text-xl font-bold text-gray-800">
               Rp {totalPemasukanGlobal.toLocaleString('id-ID')}
            </p>
        </div>
      </div>

      {Object.keys(summaryPendapatanBySD).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
             <h3 className="text-sm font-bold text-gray-800 font-sans border-b border-gray-200 pb-2">Rincian Pendapatan per Sumber Dana</h3>
          </div>
          {Object.entries(summaryPendapatanBySD).map(([sd, val]) => (
             <div key={sd} className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 p-4 shadow-sm">
               <h4 className="text-xs font-bold text-green-900 uppercase tracking-widest">{sd}</h4>
               <p className="text-xl font-bold text-green-800 mt-1">Rp {val.toLocaleString('id-ID')}</p>
             </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-[#dfe3e6] rounded shadow-sm">
        <div className="p-4 border-b border-[#dfe3e6] bg-gray-50 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">
            {editingTrxId ? "Update Pendapatan" : "Form Input Pendapatan"}
          </h3>
          {editingTrxId && (
            <button type="button" onClick={handleCancelEdit} className="text-xs text-gray-500 hover:text-gray-800 cursor-pointer">
              Batal Edit
            </button>
          )}
        </div>
        <form onSubmit={onSubmit} className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Tanggal Transaksi</label>
              <input required type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Sumber Dana</label>
              <select required value={sumberDana} onChange={(e) => {
                setSumberDana(e.target.value);
                if (e.target.value !== "NON-KAPITASI") setSubSumberDana("");
              }} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none p-2">
                <option value="KAPITASI">Kapitasi</option>
                <option value="NON-KAPITASI">Non-Kapitasi</option>
                <option value="RETRIBUSI">Retribusi</option>
                <option value="SILPA">SILPA</option>
              </select>
            </div>

            {sumberDana === "NON-KAPITASI" && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Sub-Sumber Dana</label>
                <select required value={subSumberDana} onChange={(e) => setSubSumberDana(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none p-2">
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
              <label className="block text-xs font-bold text-gray-700 mb-1">Uraian Transaksi</label>
              <input required type="text" placeholder="Cth: Penerimaan Dana Kapitasi" value={uraian} onChange={(e) => setUraian(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
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
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded text-sm disabled:opacity-50 cursor-pointer shadow-sm transition-colors"
            >
              {loading ? "Memproses..." : (editingTrxId ? "Update Pendapatan" : "Simpan Pendapatan")}
            </button>
          </div>
        </form>
      </div>

      {/* Datatable Section */}
    <div className="bg-white border border-[#dfe3e6] rounded shadow-sm flex flex-col mb-4">
        <div className="p-4 border-b border-[#dfe3e6] bg-gray-50 flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">Riwayat Pendapatan Terbaru</h3>
          <span className="text-xs font-mono bg-green-100 text-green-800 px-2 py-1 rounded">Live Syncing</span>
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
                {allowEditDelete && <th className="p-3 font-bold text-center">AKSI</th>}
              </tr>
            </thead>
            <tbody className="text-xs font-mono text-gray-700">
              {isLoadingTransaksi && !transaksiList ? (
                <tr>
                  <td colSpan={allowEditDelete ? 7 : 6} className="text-center p-8 text-gray-400">Loading transaksi...</td>
                </tr>
              ) : pendapatanList.length > 0 ? (
                pendapatanList.map((trx: any) => (
                  <tr key={trx.id} className="border-b border-[#f1f3f5] hover:bg-green-50 transition-colors">
                    <td className="p-3 text-gray-400">
                      {trx.id && !isNaN(parseInt(trx.id)) ? new Date(parseInt(trx.id)).toLocaleString('id-ID', { hour:'2-digit', minute:'2-digit' }) : '-'}
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
                    {allowEditDelete && (
                      <td className="p-3 text-center flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(trx)} className="p-1 px-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded text-[10px] font-bold transition-colors cursor-pointer" title="Edit Pendapatan">
                          <Edit2 size={12} className="inline-block mr-1" />
                          EDIT
                        </button>
                        <button onClick={() => handleDelete(trx.id)} className="p-1 px-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded text-[10px] font-bold transition-colors cursor-pointer" title="Hapus Pendapatan">
                          <Trash2 size={12} className="inline-block mr-1" />
                          HAPUS
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={allowEditDelete ? 7 : 6} className="text-center p-8 text-gray-400">Belum ada pendapatan yang tercatat.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
