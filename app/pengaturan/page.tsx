"use client";

import React, { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { Save, UserPlus, Trash2, Edit2, ShieldCheck, User } from "lucide-react";
import { useAuth } from "../../src/lib/AuthContext";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PengaturanPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';

  const { data: profil, isLoading: profilLoading } = useSWR("/api/pengaturan/profil", fetcher);
  const { data: pejabatList, isLoading: pejabatLoading } = useSWR("/api/pengaturan/pejabat", fetcher);
  const { data: userList, isLoading: userLoading } = useSWR(isSuperAdmin ? "/api/users" : null, fetcher);

  // Profil Form State
  const [namaInstansi, setNamaInstansi] = useState("");
  const [alamatInstansi, setAlamatInstansi] = useState("");
  const [emailInstansi, setEmailInstansi] = useState("");
  const [logoInstansi, setLogoInstansi] = useState("");
  const [savingProfil, setSavingProfil] = useState(false);

  // Pejabat Form State
  const [namaPejabat, setNamaPejabat] = useState("");
  const [nipPejabat, setNipPejabat] = useState("");
  const [jabatanPejabat, setJabatanPejabat] = useState("Kepala");
  const [savingPejabat, setSavingPejabat] = useState(false);
  const [editingPejabatId, setEditingPejabatId] = useState<string | null>(null);

  // User Form State
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [userRole, setUserRole] = useState("admin");
  const [userPerms, setUserPerms] = useState<string[]>(["dashboard", "entry-data"]);
  const [savingUser, setSavingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const availablePermissions = [
    { id: "dashboard", label: "Dashboard" },
    { id: "entry-data", label: "Entry Data (Input)" },
    { id: "laporan", label: "Laporan" },
    { id: "master", label: "Master Data" },
    { id: "pengaturan", label: "Pengaturan" }
  ];

  const handleTogglePermission = (perm: string) => {
    if (userPerms.includes(perm)) {
      setUserPerms(userPerms.filter(p => p !== perm));
    } else {
      setUserPerms([...userPerms, perm]);
    }
  };

  const onAddOrUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      const url = editingUserId ? `/api/users/${editingUserId}` : "/api/users";
      const method = editingUserId ? "PUT" : "POST";

      const payload: any = { username: usernameInput, role: userRole, permissions: userPerms };
      if (passwordInput) payload.password = passwordInput; // Only update password if provided

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan user");
      
      setUsernameInput("");
      setPasswordInput("");
      setUserRole("admin");
      setUserPerms(["dashboard", "entry-data"]);
      setEditingUserId(null);
      mutate("/api/users");
      alert(editingUserId ? "User diupdate" : "User ditambahkan");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingUser(false);
    }
  };

  const onDeleteUser = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus user ini?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus user");
      mutate("/api/users");
    } catch(err: any) {
      alert(err.message);
    }
  };

  const onEditUser = (u: any) => {
    setUsernameInput(u.username);
    setPasswordInput(""); // Leave empty intentionally unless updating
    setUserRole(u.role);
    setUserPerms(u.permissions.includes("all") ? availablePermissions.map(p => p.id) : u.permissions);
    setEditingUserId(u.id);
  };

  const cancelEditUser = () => {
    setUsernameInput("");
    setPasswordInput("");
    setUserRole("admin");
    setUserPerms(["dashboard", "entry-data"]);
    setEditingUserId(null);
  };

  useEffect(() => {
    if (profil) {
      setNamaInstansi(profil.namaInstansi || "");
      setAlamatInstansi(profil.alamatInstansi || "");
      setEmailInstansi(profil.emailInstansi || "");
      setLogoInstansi(profil.logoInstansi || "");
    }
  }, [profil]);

  const onSaveProfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfil(true);
    try {
      const res = await fetch("/api/pengaturan/profil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ namaInstansi, alamatInstansi, emailInstansi, logoInstansi })
      });
      if (!res.ok) throw new Error("Gagal menyimpan profil");
      mutate("/api/pengaturan/profil");
      alert("Profil instansi berhasil disimpan!");
    } catch(err: any) {
      alert(err.message);
    } finally {
      setSavingProfil(false);
    }
  };

  const onAddOrUpdatePejabat = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPejabat(true);
    try {
      const url = editingPejabatId 
        ? `/api/pengaturan/pejabat/${editingPejabatId}`
        : "/api/pengaturan/pejabat";
      const method = editingPejabatId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: namaPejabat, nip: nipPejabat, jabatan: jabatanPejabat })
      });
      if (!res.ok) throw new Error(editingPejabatId ? "Gagal mengupdate pejabat" : "Gagal menambah pejabat");
      
      setNamaPejabat("");
      setNipPejabat("");
      setJabatanPejabat("Kepala");
      setEditingPejabatId(null);
      mutate("/api/pengaturan/pejabat");
    } catch(err: any) {
      alert(err.message);
    } finally {
      setSavingPejabat(false);
    }
  };

  const onDeletePejabat = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data pejabat ini?")) return;
    try {
      const res = await fetch(`/api/pengaturan/pejabat/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus pejabat");
      mutate("/api/pengaturan/pejabat");
    } catch(err: any) {
      alert(err.message);
    }
  };

  const onEditPejabat = (pejabat: any) => {
    setNamaPejabat(pejabat.nama);
    setNipPejabat(pejabat.nip);
    setJabatanPejabat(pejabat.jabatan);
    setEditingPejabatId(pejabat.id);
  };

  const cancelEditPejabat = () => {
    setNamaPejabat("");
    setNipPejabat("");
    setJabatanPejabat("Kepala");
    setEditingPejabatId(null);
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6 w-full max-w-5xl mx-auto pb-10">
      <div>
        <h2 className="text-xl font-bold text-gray-800 tracking-tight">Pengaturan Sistem</h2>
        <p className="text-sm text-gray-500">Kelola Profil Instansi dan Master Pejabat untuk keperluan pelaporan.</p>
      </div>

      <div className="bg-white border border-[#dfe3e6] rounded shadow-sm">
        <div className="p-4 border-b border-[#dfe3e6] bg-gray-50">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">Profil Instansi</h3>
        </div>
        <form onSubmit={onSaveProfil} className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nama Instansi</label>
                <input required type="text" value={namaInstansi} onChange={(e) => setNamaInstansi(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Cth: Puskesmas Kalitengah" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Logo Instansi</label>
                <div className="flex items-center gap-3">
                  {logoInstansi ? (
                    <img src={logoInstansi} alt="Logo" className="w-12 h-12 object-contain border border-gray-200 rounded p-1 bg-white" />
                  ) : (
                    <div className="w-12 h-12 border border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 bg-gray-50 text-[10px]">
                      Kosong
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const MAX_WIDTH = 150;
                            const MAX_HEIGHT = 150;
                            let width = img.width;
                            let height = img.height;

                            if (width > height) {
                              if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                              }
                            } else {
                              if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                height = MAX_HEIGHT;
                              }
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx?.drawImage(img, 0, 0, width, height);
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                            setLogoInstansi(dataUrl);
                          };
                          img.src = event.target?.result as string;
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="block w-full text-xs text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded file:border-0
                      file:text-xs file:font-bold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100 cursor-pointer"
                  />
                  {logoInstansi && (
                    <button type="button" onClick={() => setLogoInstansi("")} className="text-xs text-red-500 hover:underline">Hapus</button>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 mt-1 italic">Pilih gambar dari perangkat Anda. Akan otomatis dikompresi untuk masuk ke Spreadsheet.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Email Instansi</label>
                <input type="email" value={emailInstansi} onChange={(e) => setEmailInstansi(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="puskesmas@email.com" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Alamat Instansi</label>
                <textarea value={alamatInstansi} onChange={(e) => setAlamatInstansi(e.target.value)} rows={3} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Alamat lengkap instansi..." />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
            <button type="submit" disabled={savingProfil || profilLoading} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded text-sm disabled:opacity-50 transition-colors cursor-pointer shadow-sm">
              <Save size={16} />
              {savingProfil ? "Menyimpan..." : "Simpan Profil"}
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-[#dfe3e6] rounded shadow-sm self-start">
          <div className="p-4 border-b border-[#dfe3e6] bg-gray-50 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">
              {editingPejabatId ? "Update Pejabat" : "Tambah Pejabat"}
            </h3>
            {editingPejabatId && (
              <button 
                type="button" 
                onClick={cancelEditPejabat}
                className="text-xs text-gray-500 hover:text-gray-800"
              >
                Batal Edit
              </button>
            )}
          </div>
          <form onSubmit={onAddOrUpdatePejabat} className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Nama Pejabat</label>
              <input required type="text" value={namaPejabat} onChange={(e) => setNamaPejabat(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nama Lengkap dengan Gelar" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">NIP</label>
              <input required type="text" value={nipPejabat} onChange={(e) => setNipPejabat(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" placeholder="198001....." />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Jabatan</label>
              <select required value={jabatanPejabat} onChange={(e) => setJabatanPejabat(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="Kepala">Kepala</option>
                <option value="PPTK">PPTK</option>
                <option value="Bendahara">Bendahara</option>
                <option value="Pengelola JKN">Pengelola JKN</option>
              </select>
            </div>
            <div className="pt-2">
              <button type="submit" disabled={savingPejabat} className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded text-sm disabled:opacity-50 transition-colors cursor-pointer shadow-sm">
                <UserPlus size={16} />
                {savingPejabat ? "Memproses..." : (editingPejabatId ? "Update Pejabat" : "Tambah Pejabat")}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white border border-[#dfe3e6] rounded shadow-sm flex flex-col">
          <div className="p-4 border-b border-[#dfe3e6] bg-gray-50 flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">Daftar Pejabat</h3>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {pejabatLoading ? (
               <p className="text-sm text-gray-400 text-center py-8">Memuat data pejabat...</p>
            ) : pejabatList && pejabatList.length > 0 ? (
              <div className="space-y-3">
                {pejabatList.map((pejabat: any) => (
                  <div key={pejabat.id} className="flex justify-between items-center p-3 border border-gray-100 bg-gray-50 rounded">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{pejabat.nama}</p>
                      <div className="flex flex-col sm:flex-row sm:gap-3 text-xs text-gray-500 mt-1">
                        <span className="font-mono">{pejabat.nip || '-'}</span>
                        <span className="font-bold text-blue-600 uppercase tracking-widest">{pejabat.jabatan}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isSuperAdmin && (
                        <>
                          <button onClick={() => onEditPejabat(pejabat)} className="p-2 text-blue-500 hover:bg-blue-100 rounded transition-colors cursor-pointer" title="Edit Pejabat">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => onDeletePejabat(pejabat.id)} className="p-2 text-red-500 hover:bg-red-100 rounded transition-colors cursor-pointer" title="Hapus Pejabat">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
               <p className="text-sm text-gray-400 text-center py-8">Belum ada pejabat yang ditambahkan.</p>
            )}
          </div>
        </div>
      </div>
      
      {isSuperAdmin && (
        <div className="mt-6 pt-6 border-t font-sans border-gray-300">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
              <ShieldCheck className="text-blue-600" />
              Manajemen Akses & User
            </h2>
            <p className="text-sm text-gray-500">Super Admin dapat menambah, mengubah akses, dan menghapus user admin.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-[#dfe3e6] rounded shadow-sm self-start">
              <div className="p-4 border-b border-[#dfe3e6] bg-gray-50 flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">
                  {editingUserId ? "Update User" : "Tambah User Baru"}
                </h3>
                {editingUserId && (
                  <button 
                    type="button" 
                    onClick={cancelEditUser}
                    className="text-xs text-gray-500 hover:text-gray-800"
                  >
                    Batal Edit
                  </button>
                )}
              </div>
              <form onSubmit={onAddOrUpdateUser} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Username</label>
                  <input required type="text" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} disabled={editingUserId !== null && userRole === 'superadmin'} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Username login" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Password {editingUserId && <span className="text-gray-400 font-normal">(Kosongkan jika tidak ingin diubah)</span>}</label>
                  <input required={!editingUserId} type="text" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono" placeholder="Password login" />
                </div>
                <div className="py-2">
                  <label className="block text-xs font-bold text-gray-700 mb-2">Akses Menu (Hanya untuk Admin)</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2 border rounded p-3 bg-gray-50">
                    {availablePermissions.map(perm => (
                      <label key={perm.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={userPerms.includes(perm.id) || userRole === 'superadmin'} 
                          onChange={() => handleTogglePermission(perm.id)} 
                          disabled={userRole === 'superadmin'}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className={userRole === 'superadmin' ? 'text-gray-500' : 'text-gray-700'}>{perm.label}</span>
                      </label>
                    ))}
                  </div>
                  {userRole === 'superadmin' && <p className="text-[10px] text-gray-500 mt-1 italic">Super Admin memiliki akses penuh secara otomatis.</p>}
                </div>
                <div className="pt-2">
                  <button type="submit" disabled={savingUser} className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded text-sm disabled:opacity-50 transition-colors cursor-pointer shadow-sm">
                    <UserPlus size={16} />
                    {savingUser ? "Memproses..." : (editingUserId ? "Update User" : "Simpan User")}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white border border-[#dfe3e6] rounded shadow-sm flex flex-col">
              <div className="p-4 border-b border-[#dfe3e6] bg-gray-50 flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-600">Daftar User Sistem</h3>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {userLoading ? (
                  <p className="text-sm text-gray-400 text-center py-8">Memuat data user...</p>
                ) : userList && userList.length > 0 ? (
                  <div className="space-y-3">
                    {userList.map((u: any) => (
                      <div key={u.id} className={`flex justify-between items-center p-3 border rounded ${u.role === 'superadmin' ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                        <div>
                          <p className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            {u.username}
                            {u.role === 'superadmin' && <ShieldCheck size={14} className="text-blue-600" />}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {u.role === 'superadmin' ? (
                              <span className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold uppercase tracking-widest">Akses Penuh</span>
                            ) : (
                              u.permissions.map((p: string, idx: number) => (
                                <span key={idx} className="text-[9px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded uppercase tracking-wider">{p.replace('-', ' ')}</span>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => onEditUser(u)} className="p-2 text-blue-500 hover:bg-blue-100 rounded transition-colors cursor-pointer" title="Edit User">
                            <Edit2 size={16} />
                          </button>
                          {u.role !== 'superadmin' && (
                            <button onClick={() => onDeleteUser(u.id)} className="p-2 text-red-500 hover:bg-red-100 rounded transition-colors cursor-pointer" title="Hapus User">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">Belum ada user tambahan.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
