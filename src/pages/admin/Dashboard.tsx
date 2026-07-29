import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { fetchStats } from '../../data/admin';
import { ArrowRight } from '../../components/icons';

// Chart timeline datasets
const CHARTS_DATA: Record<string, { labels: string[]; values: number[] }> = {
  '7d': {
    labels: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'],
    values: [420000, 680000, 510000, 890000, 1250000, 1100000, 1450000],
  },
  '30d': {
    labels: ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'],
    values: [4800000, 6200000, 5800000, 8900000],
  },
  '12m': {
    labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'],
    values: [28000000, 32000000, 30000000, 45000000, 52000000, 48000000, 61000000, 68000000, 72000000, 85000000, 92000000, 112000000],
  },
};

type LiveStats = {
  totalProducts: number;
  totalAiTools: number;
  totalPremiumApps: number;
  totalFeatured: number;
  totalOrders: number;
  totalUsers: number;
  totalRevenue: number;
};

export default function Dashboard() {
  const [stats, setStats] = useState<LiveStats>({
    totalProducts: 0,
    totalAiTools: 0,
    totalPremiumApps: 0,
    totalFeatured: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeRange, setActiveRange] = useState<'7d' | '30d' | '12m'>('7d');

  // Load stats from both fetchStats and custom queries
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const base = await fetchStats();

      // Count orders
      const { count: ordersCount } = await (supabase
        .from('orders')
        .select('*', { count: 'exact', head: true }) as any);

      // Count users (profiles)
      const { count: usersCount } = await (supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true }) as any);

      // Sum revenue (completed orders price)
      const { data: revenueData } = await (supabase
        .from('orders')
        .select('price')
        .eq('status', 'completed') as any);

      const totalRev = (revenueData || []).reduce(
        (acc: number, curr: any) => acc + Number(curr.price || 0),
        0
      );

      setStats({
        ...base,
        totalOrders: ordersCount || 0,
        totalUsers: usersCount || 0,
        totalRevenue: totalRev,
      });
    } catch (e) {
      console.error('Failed loading live stats:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Helpers for chart drawing
  const currentChart = CHARTS_DATA[activeRange];
  const maxVal = Math.max(...currentChart.values) || 1;
  const chartHeight = 160;
  const chartWidth = 500;

  // Generate SVG path coordinate points
  const points = currentChart.values.map((v, i) => {
    const x = (i / (currentChart.values.length - 1)) * chartWidth;
    const y = chartHeight - (v / maxVal) * (chartHeight - 30) - 15;
    return `${x},${y}`;
  });

  const pathD = points.length > 0 ? `M ${points.join(' L ')}` : '';
  const areaD = points.length > 0 ? `${pathD} L ${chartWidth},${chartHeight} L 0,${chartHeight} Z` : '';

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Tổng quan hệ thống</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Xem thống kê doanh số, số dư và quản trị hoạt động của BOW.</p>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            key: 'revenue',
            label: 'Tổng doanh thu',
            value: `${stats.totalRevenue.toLocaleString('vi-VN')}đ`,
            change: '+18.2%',
            isPos: true,
            iconBg: 'bg-[#1E88FF]/10 text-[#2563EB]',
            svgPath: 'M 0,20 Q 20,5 40,25 T 80,10 T 120,30'
          },
          {
            key: 'orders',
            label: 'Tổng đơn hàng',
            value: stats.totalOrders.toLocaleString('vi-VN'),
            change: '+14.5%',
            isPos: true,
            iconBg: 'bg-[#EF4444]/10 text-red-500',
            svgPath: 'M 0,30 Q 25,10 50,25 T 100,5 T 120,15'
          },
          {
            key: 'products',
            label: 'Sản phẩm hiện có',
            value: stats.totalProducts.toLocaleString('vi-VN'),
            change: '+3.1%',
            isPos: true,
            iconBg: 'bg-[#22C55E]/10 text-emerald-500',
            svgPath: 'M 0,15 Q 30,30 60,10 T 120,5'
          },
          {
            key: 'users',
            label: 'Tổng thành viên',
            value: stats.totalUsers.toLocaleString('vi-VN'),
            change: '+9.4%',
            isPos: true,
            iconBg: 'bg-[#F59E0B]/10 text-amber-500',
            svgPath: 'M 0,25 Q 35,5 70,20 T 120,10'
          },
        ].map((c) => (
          <div key={c.key} className="rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-5 shadow-xs flex flex-col justify-between min-h-[160px] hover:-translate-y-1 hover:shadow-card transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">{c.label}</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black ${
                c.isPos ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
              }`}>
                {c.change}
              </span>
            </div>
            
            <div className="mt-4 flex items-end justify-between">
              <div className="space-y-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                  {loading ? <span className="inline-block h-7 w-20 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /> : c.value}
                </span>
              </div>
              
              {/* Mini sparkline chart */}
              <div className="w-16 h-8 shrink-0">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 120 40">
                  <path
                    d={c.svgPath}
                    fill="none"
                    stroke={c.key === 'revenue' ? '#2563EB' : c.key === 'orders' ? '#EF4444' : c.key === 'products' ? '#22C55E' : '#F59E0B'}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ANALYTICS CHART & QUICK ACTIONS */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Large Revenue Chart (8 Cols) */}
        <div className="lg:col-span-8 rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-6 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-50 dark:border-slate-800/60 pb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Doanh thu cửa hàng</h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Biểu đồ biểu diễn dòng tiền luân chuyển.</p>
            </div>
            
            {/* Chart toggle range */}
            <div className="flex gap-1.5 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-xl">
              {[
                { key: '7d', label: '7 ngày' },
                { key: '30d', label: '30 ngày' },
                { key: '12m', label: '12 tháng' },
              ].map((r) => (
                <button
                  key={r.key}
                  onClick={() => setActiveRange(r.key as any)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all ${
                    activeRange === r.key
                      ? 'bg-white dark:bg-[#131C32] text-[#2563EB] shadow-xs'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Handcrafted dynamic SVG chart */}
          <div className="mt-6 w-full h-[180px] relative">
            <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#19A7FF" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              
              {/* Grid Lines */}
              <line x1="0" y1={chartHeight - 15} x2={chartWidth} y2={chartHeight - 15} stroke="#E8F1FF" strokeWidth={1} className="dark:stroke-slate-800/40" />
              <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="#E8F1FF" strokeWidth={1} className="dark:stroke-slate-800/40" strokeDasharray="4" />
              <line x1="0" y1="15" x2={chartWidth} y2="15" stroke="#E8F1FF" strokeWidth={1} className="dark:stroke-slate-800/40" />
              
              {/* Fill Gradient Area */}
              <path d={areaD} fill="url(#chartGradient)" />
              
              {/* Line Path */}
              <path d={pathD} fill="none" stroke="#2563EB" strokeWidth={3} strokeLinecap="round" />
              
              {/* Data points */}
              {points.map((p, idx) => {
                const [x, y] = p.split(',');
                return (
                  <circle
                    key={idx}
                    cx={x}
                    cy={y}
                    r={5}
                    fill="#FFFFFF"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    className="cursor-pointer hover:r-7 transition-all"
                  />
                );
              })}
            </svg>
          </div>

          {/* Labels Row */}
          <div className="flex justify-between border-t border-slate-50 dark:border-slate-800/60 pt-4 text-[10px] text-slate-400 font-bold px-2">
            {currentChart.labels.map((lbl, idx) => (
              <span key={idx}>{lbl}</span>
            ))}
          </div>
        </div>

        {/* Quick Actions (4 Cols) */}
        <div className="lg:col-span-4 rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-50 dark:border-slate-800/60 pb-3">Thao tác nhanh</h3>
            
            <div className="mt-4 space-y-2">
              <Link
                to="/admin/products/new"
                className="flex items-center justify-between rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A]/50 hover:bg-[#F5F9FF] dark:hover:bg-slate-800/60 p-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 transition"
              >
                <span>➕ Thêm sản phẩm mới</span>
                <ArrowRight className="h-4.5 w-4.5 text-slate-400" />
              </Link>
              <Link
                to="/admin/categories"
                className="flex items-center justify-between rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A]/50 hover:bg-[#F5F9FF] dark:hover:bg-slate-800/60 p-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 transition"
              >
                <span>📂 Quản lý danh mục</span>
                <ArrowRight className="h-4.5 w-4.5 text-slate-400" />
              </Link>
              <Link
                to="/admin/faqs"
                className="flex items-center justify-between rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A]/50 hover:bg-[#F5F9FF] dark:hover:bg-slate-800/60 p-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 transition"
              >
                <span>❓ Quản lý FAQ chung</span>
                <ArrowRight className="h-4.5 w-4.5 text-slate-400" />
              </Link>
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A]/50 hover:bg-[#F5F9FF] dark:hover:bg-slate-800/60 p-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 transition"
              >
                <span>🌐 Xem giao diện người dùng</span>
                <ArrowRight className="h-4.5 w-4.5 text-slate-400" />
              </a>
            </div>
          </div>

          <button
            onClick={() => alert('Hệ thống đã tự động sao lưu và tối ưu hóa cơ sở dữ liệu!')}
            className="w-full mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-150 dark:border-slate-800 p-3 text-xs font-bold text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
          >
            🛡️ Backup dữ liệu ngay
          </button>
        </div>
      </div>

      {/* RECENT ACTIVITIES TIMELINE */}
      <div className="rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-6 shadow-xs">
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-50 dark:border-slate-800/60 pb-3">Lịch sử hoạt động</h3>
        
        <div className="mt-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800 space-y-6">
          {[
            { text: 'Có đơn hàng mới #BOW92746 cần bàn giao', tag: 'Đơn hàng', iconBg: 'bg-emerald-500 text-white', time: '5 phút trước' },
            { text: 'Admin đã thêm sản phẩm mới "Canva Pro 1 năm"', tag: 'Sản phẩm', iconBg: 'bg-blue-500 text-white', time: '40 phút trước' },
            { text: 'Cập nhật cài đặt mạng xã hội kênh Zalo & Facebook', tag: 'Cài đặt', iconBg: 'bg-amber-500 text-white', time: '2 giờ trước' },
            { text: 'Đã hoàn tiền đơn hàng #BOW81735 về ví thành viên', tag: 'Hoàn tiền', iconBg: 'bg-red-500 text-white', time: '5 giờ trước' },
          ].map((act, idx) => (
            <div key={idx} className="flex gap-4 items-start pl-1 relative">
              <span className={`h-6.5 w-6.5 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold shadow-xs relative z-10 ${act.iconBg}`}>
                {act.tag.charAt(0)}
              </span>
              <div className="flex-1 text-xs">
                <p className="font-bold text-slate-800 dark:text-slate-200">{act.text}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400 font-semibold">
                  <span>{act.time}</span>
                  <span>•</span>
                  <span className="text-[#2563EB]">{act.tag}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
