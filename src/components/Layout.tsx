import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import useSWR from 'swr';
import { 
  LayoutDashboard, 
  Wallet, 
  CreditCard, 
  FileText, 
  Settings, 
  Database,
  Menu,
  X,
  LogOut
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function Layout() {
  const location = useLocation();
  const { data: profil } = useSWR('/api/pengaturan/profil', fetcher);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, canAccess } = useAuth();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'dashboard' },
    { name: 'Entry Pendapatan', path: '/entry/pendapatan', icon: Wallet, permission: 'entry-data' },
    { name: 'Entry Belanja', path: '/entry/belanja', icon: CreditCard, permission: 'entry-data' },
    { name: 'Laporan', path: '/laporan', icon: FileText, permission: 'laporan' },
    { name: 'Lihat Data', path: '/laporan/lihat-data', icon: FileText, permission: 'laporan' },
    { name: 'Master Data', path: '/master', icon: Database, permission: 'master' },
    { name: 'Pengaturan', path: '/pengaturan', icon: Settings, permission: 'pengaturan' },
  ];

  return (
    <div className="flex h-screen w-full bg-[#f1f3f5] text-[#1a1c1e] font-sans overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 bg-[#1a1c1e] text-white flex flex-col border-r border-[#2d2f31]
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 border-b border-[#2d2f31] flex items-center justify-between lg:justify-start gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-xs shrink-0">EF</div>
            <div>
              <h1 className="text-sm font-bold leading-none tracking-tight">e-JKN KALITENGAH</h1>
              <p className="text-[10px] text-gray-400 mt-1">v2.5.0-Enterprise</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-3 py-2 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Navigation</div>
          
          {navItems.filter(item => canAccess(item.permission)).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center px-3 py-2 text-xs rounded transition-colors ${
                  isActive 
                    ? 'bg-blue-600 text-white font-medium' 
                    : 'text-gray-300 hover:bg-[#2d2f31]'
                }`}
              >
                <Icon className={`w-4 h-4 mr-3 shrink-0 ${isActive ? 'opacity-100' : 'opacity-70'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-[#2d2f31] bg-[#141517]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {profil?.logoInstansi ? (
                <img src={profil.logoInstansi} className="w-8 h-8 rounded-full object-cover bg-white p-0.5 shrink-0" alt="Logo" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs text-white shrink-0">
                  {profil?.namaInstansi ? profil.namaInstansi.substring(0, 2).toUpperCase() : 'PK'}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-[11px] font-medium truncate">{profil?.namaInstansi || 'Instansi Belum Diatur'}</p>
                <p className="text-[9px] text-gray-400 mt-0.5 truncate uppercase">{user?.username} ({user?.role})</p>
              </div>
            </div>
            <button onClick={logout} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#2d2f31] rounded" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#f1f3f5] w-full relative">
        <header className="h-14 bg-white border-b border-[#dfe3e6] px-4 lg:px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 -ml-1.5 text-gray-600 hover:bg-gray-100 rounded-md"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 lg:gap-4 ml-1 lg:ml-0">
              <span className="text-[10px] lg:text-xs font-bold text-blue-600 tracking-wide hidden sm:block">LIVE DATA MODE</span>
              <span className="text-[10px] lg:text-xs font-bold text-blue-600 tracking-wide sm:hidden">LIVE</span>
              <div className="h-4 w-[1px] bg-gray-200"></div>
              <span className="text-[10px] lg:text-xs text-gray-500 flex items-center gap-1.5 whitespace-nowrap">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0"></div>
                <span className="hidden sm:inline">Connected to Google Sheets</span>
                <span className="sm:hidden">Connected</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 hidden sm:flex">
             <button className="px-3 py-1.5 text-[11px] font-medium border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition-colors">
               Sync Database
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-6 w-full relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
