/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import EntryBelanjaPage from '../app/entry-data/belanja/page';
import PengaturanPage from '../app/pengaturan/page';
import MasterDataPage from '../app/master/page';
import EntryPendapatanPage from '../app/entry-data/pendapatan/page';
import LaporanPage from '../app/laporan/page';
import LihatDataPage from '../app/laporan/lihat-data/page';
import DashboardPage from '../app/dashboard/page';
import LoginPage from '../app/login/page';
import { AuthProvider, useAuth } from './lib/AuthContext';

function ProtectedRoute({ children, permission }: { children: React.ReactNode, permission?: string }) {
  const { user, canAccess, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <div className="h-screen w-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 rounded-full border-4 border-blue-200 border-t-blue-600 animate-spin"></div></div>;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !canAccess(permission)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<ProtectedRoute permission="dashboard"><DashboardPage /></ProtectedRoute>} />
            <Route path="entry/pendapatan" element={<ProtectedRoute permission="entry-data"><EntryPendapatanPage /></ProtectedRoute>} />
            <Route path="entry/belanja" element={<ProtectedRoute permission="entry-data"><EntryBelanjaPage /></ProtectedRoute>} />
            <Route path="laporan" element={<ProtectedRoute permission="laporan"><LaporanPage /></ProtectedRoute>} />
            <Route path="laporan/lihat-data" element={<ProtectedRoute permission="laporan"><LihatDataPage /></ProtectedRoute>} />
            <Route path="master" element={<ProtectedRoute permission="master"><MasterDataPage /></ProtectedRoute>} />
            <Route path="pengaturan" element={<ProtectedRoute permission="pengaturan"><PengaturanPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

