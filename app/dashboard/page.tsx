"use client";

import React, { useMemo } from 'react';
import useSWR from 'swr';
import { motion } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, LabelList
} from 'recharts';
import { RefreshCcw, TrendingUp, TrendingDown, Wallet, Activity } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

export default function Dashboard() {
  const { data: transaksi, error: errTrx, mutate: mutTrx, isValidating: valTrx } = useSWR('/api/transaksi', fetcher);
  const { data: silpaData, error: errSilpa, mutate: mutSilpa, isValidating: valSilpa } = useSWR('/api/master/silpa', fetcher);
  const { data: pagu, error: errPagu, mutate: mutPagu, isValidating: valPagu } = useSWR('/api/pagu-anggaran', fetcher);

  const isLoading = (!transaksi && !errTrx) || (!silpaData && !errSilpa) || (!pagu && !errPagu);
  const isRefreshing = valTrx || valSilpa || valPagu;

  const handleRefresh = async () => {
    await Promise.all([mutTrx(), mutSilpa(), mutPagu()]);
  };

  const stdSd = (sd: string) => {
    const raw = sd.toUpperCase().replace(/\s+/g, '');
    if (raw === 'KAPITASI') return 'KAPITASI';
    if (raw === 'NONKAPITASI' || raw === 'NON-KAPITASI') return 'NON-KAPITASI';
    if (raw === 'RETRIBUSI') return 'RETRIBUSI';
    return sd;
  };

  const summaryData = useMemo(() => {
    if (!transaksi || !silpaData) return [];

    const summaryMap: Record<string, { sumberDana: string; silpa: number; pendapatan: number; belanja: number; pagu: number }> = {};

    // Initialize with SILPA
    silpaData.forEach((item: any) => {
      const sd = stdSd(item.sumberDana || 'Lainnya');
      if (!summaryMap[sd]) {
        summaryMap[sd] = { sumberDana: sd, silpa: 0, pendapatan: 0, belanja: 0, pagu: 0 };
      }
      summaryMap[sd].silpa += Number(item.nominal) || 0;
    });

    // Add Pagu
    if (pagu) {
      pagu.forEach((p: any) => {
        const sd = stdSd(p.sumberDana || 'Lainnya');
        if (!summaryMap[sd]) {
          summaryMap[sd] = { sumberDana: sd, silpa: 0, pendapatan: 0, belanja: 0, pagu: 0 };
        }
        summaryMap[sd].pagu += Number(p.nominalPagu) || 0;
      });
    }

    // Process Transaksi
    transaksi.forEach((trx: any) => {
      const sd = stdSd(trx.sumberDana || 'Lainnya');
      if (!summaryMap[sd]) {
        summaryMap[sd] = { sumberDana: sd, silpa: 0, pendapatan: 0, belanja: 0, pagu: 0 };
      }
      
      const nom = Number(trx.nominal) || 0;
      if (trx.jenisTransaksi === 'PENDAPATAN') {
        summaryMap[sd].pendapatan += nom;
      } else if (trx.jenisTransaksi === 'BELANJA') {
        summaryMap[sd].belanja += nom;
      }
    });

    return Object.values(summaryMap).map(item => ({
      ...item,
      saldo: item.silpa + item.pendapatan - item.belanja
    })).sort((a, b) => b.saldo - a.saldo);
  }, [transaksi, silpaData, pagu]);

  const totalSummary = useMemo(() => {
    return summaryData.reduce((acc, curr) => ({
      silpa: acc.silpa + curr.silpa,
      pendapatan: acc.pendapatan + curr.pendapatan,
      belanja: acc.belanja + curr.belanja,
      saldo: acc.saldo + curr.saldo,
    }), { silpa: 0, pendapatan: 0, belanja: 0, saldo: 0 });
  }, [summaryData]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  const formatShortValue = (val: number) => {
    if (val >= 1000000000) return (val / 1000000000).toFixed(1) + 'M';
    if (val >= 1000000) return (val / 1000000).toFixed(0) + 'jt';
    return (val / 1000).toFixed(0) + 'k';
  };

  const renderCustomBarLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (!value) return null;
    return (
      <text x={x + width / 2} y={y - 8} fill="#475569" textAnchor="middle" fontSize={11} fontWeight={600}>
        {formatShortValue(value)}
      </text>
    );
  };

  const renderCustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, value, name }: any) => {
    const RADIAN = Math.PI / 180;
    // Keep labels readable by pushing them outside if they are small
    const radius = percent > 0.1 ? innerRadius + (outerRadius - innerRadius) * 0.5 : outerRadius + 20;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    
    if (percent < 0.05) return null; // don't show label for very tiny slices

    return (
      <text x={x} y={y} fill={percent > 0.1 ? "#fff" : "#475569"} 
            textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" 
            fontSize={12} fontWeight={700}>
        {`${name} (${(percent * 100).toFixed(0)}%)`}
      </text>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-lg">
          <p className="font-bold text-gray-800 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm font-medium">
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto w-full max-w-7xl mx-auto bg-[#f8fafc]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Dashboard Keuangan</h2>
          <p className="text-sm text-gray-500 mt-1">Ringkasan Pendapatan, Belanja, dan Saldo per Sumber Dana</p>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700 transition-all disabled:opacity-50"
        >
          <RefreshCcw size={16} className={isRefreshing ? "animate-spin" : ""} />
          {isRefreshing ? "Memuat..." : "Refresh"}
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Total Pendapatan", value: totalSummary.pendapatan, icon: TrendingUp, color: "text-green-600", bg: "bg-green-100" },
          { title: "Total Belanja", value: totalSummary.belanja, icon: TrendingDown, color: "text-rose-600", bg: "bg-rose-100" },
          { title: "Saldo Akhir", value: totalSummary.saldo, icon: Activity, color: "text-indigo-600", bg: "bg-indigo-100" },
          { title: "Total SILPA", value: totalSummary.silpa, icon: Wallet, color: "text-blue-600", bg: "bg-blue-100" },
        ].map((item, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={idx}
            className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-600">{item.title}</h3>
              <div className={`p-2 rounded-lg ${item.bg}`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 tracking-tight">
              {formatCurrency(item.value)}
            </p>
            <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
              <item.icon className="w-24 h-24" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detailed Saldo Breakdown Cards if they exist */}
      {summaryData.some(d => d.saldo !== 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
             <h3 className="text-base font-bold text-gray-800 font-sans">Rincian Saldo Akhir Berdasarkan Sumber Dana</h3>
          </div>
          {summaryData.filter(d => d.saldo !== 0).map((item, idx) => (
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ delay: 0.2 + (idx * 0.1) }}
               key={`saldo-${idx}`}
               className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl border border-indigo-200 p-5 shadow-sm relative overflow-hidden"
             >
               <div className="flex items-center justify-between mb-2">
                 <h4 className="text-sm font-bold text-indigo-900 uppercase tracking-wider">{item.sumberDana}</h4>
                 <Activity className="w-5 h-5 text-indigo-400" />
               </div>
               <p className="text-2xl font-black text-indigo-950 tracking-tight">
                 {formatCurrency(item.saldo)}
               </p>
               <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
                 <Activity className="w-24 h-24 text-indigo-600" />
               </div>
             </motion.div>
          ))}
        </div>
      )}

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6"
        >
          <h3 className="text-base font-bold text-gray-800 mb-6 font-sans">Komparasi per Sumber Dana</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summaryData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="sumberDana" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${val / 1000000}M`} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}/>
                <Bar dataKey="silpa" name="SILPA" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  <LabelList dataKey="silpa" content={renderCustomBarLabel} />
                </Bar>
                <Bar dataKey="pendapatan" name="Pendapatan" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  <LabelList dataKey="pendapatan" content={renderCustomBarLabel} />
                </Bar>
                <Bar dataKey="belanja" name="Belanja" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  <LabelList dataKey="belanja" content={renderCustomBarLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col"
        >
          <h3 className="text-base font-bold text-gray-800 mb-2 font-sans">Distribusi Saldo Akhir</h3>
          <div className="flex-1 min-h-[250px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={summaryData.filter(d => d.saldo > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="saldo"
                  nameKey="sumberDana"
                  stroke="none"
                  label={renderCustomPieLabel}
                  labelLine={false}
                >
                  {summaryData.filter(d => d.saldo > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Detailed Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
      >
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-base font-bold text-gray-800">Rincian per Sumber Dana</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Sumber Dana</th>
                <th className="px-6 py-4 text-right">SILPA</th>
                <th className="px-6 py-4 text-right">Pendapatan</th>
                <th className="px-6 py-4 text-right">Belanja</th>
                <th className="px-6 py-4 text-right">Saldo Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summaryData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Belum ada data
                  </td>
                </tr>
              ) : summaryData.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-gray-800">{row.sumberDana}</td>
                  <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(row.silpa)}</td>
                  <td className="px-6 py-4 text-right text-green-600 font-medium">{formatCurrency(row.pendapatan)}</td>
                  <td className="px-6 py-4 text-right text-rose-600 font-medium">{formatCurrency(row.belanja)}</td>
                  <td className="px-6 py-4 text-right text-indigo-600 font-bold">{formatCurrency(row.saldo)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-bold text-gray-900 border-t-2 border-gray-200">
              <tr>
                <td className="px-6 py-4">Total</td>
                <td className="px-6 py-4 text-right">{formatCurrency(totalSummary.silpa)}</td>
                <td className="px-6 py-4 text-right text-green-700">{formatCurrency(totalSummary.pendapatan)}</td>
                <td className="px-6 py-4 text-right text-rose-700">{formatCurrency(totalSummary.belanja)}</td>
                <td className="px-6 py-4 text-right text-indigo-700">{formatCurrency(totalSummary.saldo)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
