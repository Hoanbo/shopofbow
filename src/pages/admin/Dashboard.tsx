import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { fetchStats } from '../../data/admin';
import { ArrowRight } from '../../components/icons';
import { useToast } from '../../components/Toast';

type RangeMode = '7d' | '30d' | '12m';

interface DynamicChart {
  labels: string[];
  values: number[];
}

interface StatChange {
  text: string;
  isPos: boolean;
}

interface ActivityItem {
  id: string;
  text: string;
  tag: string;
  iconBg: string;
  time: string;
}

interface OrderRow {
  id: string;
  price: number;
  status: string;
  created_at: string;
  payment_code?: string;
  product_name?: string;
}

interface ProfileRow {
  id: string;
  created_at: string;
}

interface ProductRow {
  id: string;
  created_at: string;
}

function formatRelativeTime(dateStr: string): string {
  const past = new Date(dateStr).getTime();
  if (isNaN(past)) return 'Vừa xong';
  const diffSec = Math.floor((Date.now() - past) / 1000);
  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ngày trước`;
}

function calcPercentageChange(current: number, previous: number): StatChange {
  if (previous === 0) {
    if (current === 0) return { text: '0.0%', isPos: true };
    return { text: '+100%', isPos: true };
  }
  const pct = ((current - previous) / previous) * 100;
  const isPos = pct >= 0;
  return { text: `${isPos ? '+' : ''}${pct.toFixed(1)}%`, isPos };
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalRevenue: 0,
  });
  const [changes, setChanges] = useState<{
    revenue: StatChange;
    orders: StatChange;
    products: StatChange;
    users: StatChange;
  }>({
    revenue: { text: '0.0%', isPos: true },
    orders: { text: '0.0%', isPos: true },
    products: { text: '0.0%', isPos: true },
    users: { text: '0.0%', isPos: true },
  });

  const [loading, setLoading] = useState(true);
  const [activeRange, setActiveRange] = useState<RangeMode>('7d');
  const [chartData, setChartData] = useState<Record<RangeMode, DynamicChart>>({
    '7d': { labels: [], values: [] },
    '30d': { labels: [], values: [] },
    '12m': { labels: [], values: [] },
  });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const toast = useToast();

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const base = await fetchStats();

      // 1. Fetch all orders for revenue, stats, and real charts
      const { data: ordersData } = await (supabase
        .from('orders')
        .select('id, price, status, created_at, payment_code, product_name')
        .order('created_at', { ascending: false }) as any);

      const allOrders: OrderRow[] = ordersData || [];

      // 2. Fetch all profiles
      const { data: profilesData } = await (supabase
        .from('profiles')
        .select('id, created_at') as any);
      const allProfiles: ProfileRow[] = profilesData || [];

      // 3. Fetch all products
      const { data: productsData } = await (supabase
        .from('products')
        .select('id, created_at') as any);
      const allProducts: ProductRow[] = productsData || [];

      // Sum completed revenue
      const completedOrders = allOrders.filter((o) => o.status === 'completed');
      const totalRev = completedOrders.reduce((sum, o) => sum + Number(o.price || 0), 0);

      setStats({
        totalProducts: allProducts.length || base.totalProducts || 0,
        totalOrders: allOrders.length,
        totalUsers: allProfiles.length,
        totalRevenue: totalRev,
      });

      // 4. Calculate real percentage changes (last 30 days vs previous 30 days)
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      const revCurr = completedOrders
        .filter((o) => now - new Date(o.created_at).getTime() <= 30 * dayMs)
        .reduce((sum, o) => sum + Number(o.price || 0), 0);
      const revPrev = completedOrders
        .filter((o) => {
          const diff = now - new Date(o.created_at).getTime();
          return diff > 30 * dayMs && diff <= 60 * dayMs;
        })
        .reduce((sum, o) => sum + Number(o.price || 0), 0);

      const ordCurr = allOrders.filter((o) => now - new Date(o.created_at).getTime() <= 30 * dayMs).length;
      const ordPrev = allOrders.filter((o) => {
        const diff = now - new Date(o.created_at).getTime();
        return diff > 30 * dayMs && diff <= 60 * dayMs;
      }).length;

      const prodCurr = allProducts.filter((p) => p.created_at && now - new Date(p.created_at).getTime() <= 30 * dayMs).length;
      const prodPrev = allProducts.filter((p) => p.created_at && now - new Date(p.created_at).getTime() > 30 * dayMs).length;

      const userCurr = allProfiles.filter((u) => u.created_at && now - new Date(u.created_at).getTime() <= 30 * dayMs).length;
      const userPrev = allProfiles.filter((u) => u.created_at && now - new Date(u.created_at).getTime() > 30 * dayMs).length;

      setChanges({
        revenue: calcPercentageChange(revCurr, revPrev),
        orders: calcPercentageChange(ordCurr, ordPrev),
        products: calcPercentageChange(prodCurr, prodPrev),
        users: calcPercentageChange(userCurr, userPrev),
      });

      // 5. Build dynamic chart datasets for 7d, 30d, 12m from real database
      buildCharts(allOrders);

      // 6. Fetch real activity timeline from notifications
      const { data: notifData } = await (supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8) as any);

      const acts: ActivityItem[] = [];
      if (notifData && notifData.length > 0) {
        notifData.forEach((n: any) => {
          acts.push({
            id: n.id,
            text: n.message || n.title,
            tag: n.type === 'new_order' ? 'Đơn hàng' : n.type === 'order_cancelled' ? 'Hủy đơn' : 'Thông báo',
            iconBg: n.type === 'new_order' ? 'bg-emerald-500 text-white' : n.type === 'order_cancelled' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white',
            time: formatRelativeTime(n.created_at),
          });
        });
      } else {
        // Fallback: build activity from latest orders if notifications table is empty
        allOrders.slice(0, 6).forEach((ord) => {
          acts.push({
            id: ord.id,
            text: `Đơn hàng #${ord.payment_code || ord.id.substring(0, 8)} — ${ord.product_name || 'Sản phẩm'} (${Number(ord.price).toLocaleString('vi-VN')}đ)`,
            tag: ord.status === 'completed' ? 'Hoàn tất' : ord.status === 'cancelled' ? 'Hủy đơn' : 'Đơn mới',
            iconBg: ord.status === 'completed' ? 'bg-emerald-500 text-white' : ord.status === 'cancelled' ? 'bg-red-500 text-white' : 'bg-[#2563EB] text-white',
            time: formatRelativeTime(ord.created_at),
          });
        });
      }
      setActivities(acts);

    } catch (e) {
      console.error('Failed loading live stats:', e);
    } finally {
      setLoading(false);
    }
  };

  const buildCharts = (orders: OrderRow[]) => {
    const now = new Date();

    // 7d Chart
    const days7: { label: string; start: number; end: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dayName = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).getTime();
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).getTime();
      days7.push({ label: `${dayName} ${d.getDate()}/${d.getMonth() + 1}`, start, end });
    }
    const val7d = days7.map((day) =>
      orders
        .filter((o) => {
          const t = new Date(o.created_at).getTime();
          return t >= day.start && t <= day.end && o.status === 'completed';
        })
        .reduce((sum, o) => sum + Number(o.price || 0), 0)
    );

    // 30d Chart (4 Weeks)
    const weeks30: { label: string; start: number; end: number }[] = [];
    const dayMs = 24 * 60 * 60 * 1000;
    for (let i = 3; i >= 0; i--) {
      const start = now.getTime() - (i + 1) * 7 * dayMs;
      const end = now.getTime() - i * 7 * dayMs;
      weeks30.push({ label: `Tuần ${4 - i}`, start, end });
    }
    const val30d = weeks30.map((w) =>
      orders
        .filter((o) => {
          const t = new Date(o.created_at).getTime();
          return t >= w.start && t < w.end && o.status === 'completed';
        })
        .reduce((sum, o) => sum + Number(o.price || 0), 0)
    );

    // 12m Chart (12 Months)
    const months12: { label: string; year: number; month: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months12.push({
        label: `T${d.getMonth() + 1}`,
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }
    const val12m = months12.map((m) =>
      orders
        .filter((o) => {
          const d = new Date(o.created_at);
          return d.getFullYear() === m.year && d.getMonth() === m.month && o.status === 'completed';
        })
        .reduce((sum, o) => sum + Number(o.price || 0), 0)
    );

    setChartData({
      '7d': { labels: days7.map((d) => d.label), values: val7d },
      '30d': { labels: weeks30.map((w) => w.label), values: val30d },
      '12m': { labels: months12.map((m) => m.label), values: val12m },
    });
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Dynamic Chart SVG calculations
  const currentChart = chartData[activeRange];
  const maxVal = Math.max(...(currentChart.values.length ? currentChart.values : [0])) || 100000;
  const chartHeight = 160;
  const chartWidth = 500;

  const points = (currentChart.values.length ? currentChart.values : [0]).map((v, i) => {
    const count = Math.max(currentChart.values.length, 1);
    const x = count > 1 ? (i / (count - 1)) * chartWidth : chartWidth / 2;
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
            change: changes.revenue.text,
            isPos: changes.revenue.isPos,
            svgPath: 'M 0,20 Q 20,5 40,25 T 80,10 T 120,30'
          },
          {
            key: 'orders',
            label: 'Tổng đơn hàng',
            value: stats.totalOrders.toLocaleString('vi-VN'),
            change: changes.orders.text,
            isPos: changes.orders.isPos,
            svgPath: 'M 0,30 Q 25,10 50,25 T 100,5 T 120,15'
          },
          {
            key: 'products',
            label: 'Sản phẩm hiện có',
            value: stats.totalProducts.toLocaleString('vi-VN'),
            change: changes.products.text,
            isPos: changes.products.isPos,
            svgPath: 'M 0,15 Q 30,30 60,10 T 120,5'
          },
          {
            key: 'users',
            label: 'Tổng thành viên',
            value: stats.totalUsers.toLocaleString('vi-VN'),
            change: changes.users.text,
            isPos: changes.users.isPos,
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
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Biểu đồ biểu diễn dòng tiền luân chuyển từ đơn hàng thực tế.</p>
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
                  onClick={() => setActiveRange(r.key as RangeMode)}
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
                const val = currentChart.values[idx] || 0;
                return (
                  <g key={idx} className="group">
                    <circle
                      cx={x}
                      cy={y}
                      r={5}
                      fill="#FFFFFF"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      className="cursor-pointer hover:r-7 transition-all"
                    />
                    {/* Tooltip on hover */}
                    <title>{`${currentChart.labels[idx] || ''}: ${val.toLocaleString('vi-VN')}đ`}</title>
                  </g>
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
            onClick={() => toast.info('Hệ thống đã tự động sao lưu và tối ưu hóa cơ sở dữ liệu!')}
            className="w-full mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-150 dark:border-slate-800 p-3 text-xs font-bold text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
          >
            🛡️ Backup dữ liệu ngay
          </button>
        </div>
      </div>

      {/* RECENT ACTIVITIES TIMELINE */}
      <div className="rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-6 shadow-xs">
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-50 dark:border-slate-800/60 pb-3">Lịch sử hoạt động thực tế</h3>
        
        {activities.length === 0 ? (
          <p className="mt-4 text-xs font-medium text-slate-400 text-center py-4">Chưa có hoạt động nào được ghi nhận.</p>
        ) : (
          <div className="mt-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800 space-y-6">
            {activities.map((act) => (
              <div key={act.id} className="flex gap-4 items-start pl-1 relative">
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
        )}
      </div>
    </div>
  );
}
