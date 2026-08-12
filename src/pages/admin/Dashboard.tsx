import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { fetchStats } from '../../data/admin';

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
  plan_label?: string;
  profiles?: { full_name?: string; email?: string } | null;
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

  // Action items counts (CẦN XỬ LÝ)
  const [actionCounts, setActionCounts] = useState({
    pendingDelivery: 0,
    processing: 0,
    contactMessages: 0,
  });

  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const base = await fetchStats();

      // 1. Fetch orders with profiles
      const { data: ordersData } = await (supabase
        .from('orders')
        .select('id, price, status, created_at, payment_code, product_name, plan_label, profiles:profiles!orders_user_profile_fk(full_name, email)')
        .order('created_at', { ascending: false }) as any);

      const allOrders: OrderRow[] = ordersData || [];
      setRecentOrders(allOrders.slice(0, 5));

      // Compute action counts
      const pendingDelivery = allOrders.filter((o) => o.status === 'pending_delivery').length;
      const processing = allOrders.filter((o) => o.status === 'processing').length;

      // Unread contact messages count from localStorage
      let contactMessages = 0;
      try {
        const savedMsgs = localStorage.getItem('bow_inbox_messages');
        if (savedMsgs) {
          const msgs = JSON.parse(savedMsgs);
          contactMessages = msgs.filter((m: any) => m.unread && !m.archived).length;
        } else {
          contactMessages = 2; // Default seed unread messages
        }
      } catch {
        contactMessages = 0;
      }

      setActionCounts({
        pendingDelivery,
        processing,
        contactMessages,
      });

      // 2. Fetch profiles
      const { data: profilesData } = await (supabase
        .from('profiles')
        .select('id, created_at') as any);
      const allProfiles: ProfileRow[] = profilesData || [];

      // 3. Fetch products
      const { data: productsData } = await (supabase
        .from('products')
        .select('id, created_at') as any);
      const allProducts: ProductRow[] = productsData || [];

      // Filter paid revenue
      const paidOrders = allOrders.filter((o) => ['pending_delivery', 'processing', 'completed'].includes(o.status));
      const totalRev = paidOrders.reduce((sum, o) => sum + Number(o.price || 0), 0);

      setStats({
        totalProducts: allProducts.length || base.totalProducts || 0,
        totalOrders: allOrders.length,
        totalUsers: allProfiles.length,
        totalRevenue: totalRev,
      });

      // 4. Calculate percentage changes
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      const revCurr = paidOrders
        .filter((o) => now - new Date(o.created_at).getTime() <= 30 * dayMs)
        .reduce((sum, o) => sum + Number(o.price || 0), 0);
      const revPrev = paidOrders
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

      // 5. Build charts
      buildCharts(allOrders);

      // 6. Fetch 5-6 recent activities from audit_logs (no metadata — not needed for activity feed)
      const { data: auditData, error: auditErr } = await (supabase
        .from('audit_logs')
        .select('id, description, actor_name, actor_role, created_at')
        .order('created_at', { ascending: false })
        .limit(5) as any);

      const acts: ActivityItem[] = [];
      if (auditData && auditData.length > 0 && !auditErr) {
        auditData.forEach((log: any) => {
          acts.push({
            id: log.id,
            text: log.description,
            tag: log.actor_name || log.actor_role || 'Nhật ký',
            iconBg: log.actor_role === 'admin'
              ? 'bg-purple-500 text-white'
              : log.actor_role === 'user'
              ? 'bg-[#2563EB] text-white'
              : 'bg-emerald-500 text-white',
            time: formatRelativeTime(log.created_at),
          });
        });
      } else {
        // Fallback: notifications or recent order logs
        const { data: notifData } = await (supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5) as any);
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
        }
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
    const isPaid = (status: string) => ['pending_delivery', 'processing', 'completed'].includes(status);

    const val7d = days7.map((day) =>
      orders
        .filter((o) => {
          const t = new Date(o.created_at).getTime();
          return t >= day.start && t <= day.end && isPaid(o.status);
        })
        .reduce((sum, o) => sum + Number(o.price || 0), 0)
    );

    // 30d Chart
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
          return t >= w.start && t < w.end && isPaid(o.status);
        })
        .reduce((sum, o) => sum + Number(o.price || 0), 0)
    );

    // 12m Chart
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
          return d.getFullYear() === m.year && d.getMonth() === m.month && isPaid(o.status);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 text-[9px] font-extrabold text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/30">Chờ thanh toán</span>;
      case 'pending_delivery':
        return <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/20 px-2 py-0.5 text-[9px] font-extrabold text-[#2563EB] dark:text-[#35A8FF] border border-blue-200/60 dark:border-blue-900/30">Chờ bàn giao</span>;
      case 'processing':
        return <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 text-[9px] font-extrabold text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/30">Đang thiết lập</span>;
      case 'completed':
        return <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/30">Đã hoàn thành</span>;
      case 'cancelled':
        return <span className="inline-flex items-center rounded-full bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 text-[9px] font-extrabold text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/30">Đã hủy</span>;
      case 'refunded':
        return <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[9px] font-extrabold text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700">Đã hoàn tiền</span>;
      default:
        return null;
    }
  };

  // Dynamic Chart SVG calculations
  const currentChart = chartData[activeRange];
  const maxVal = Math.max(...(currentChart.values.length ? currentChart.values : [0])) || 100000;
  const chartHeight = 150;
  const chartWidth = 500;

  const points = (currentChart.values.length ? currentChart.values : [0]).map((v, i) => {
    const count = Math.max(currentChart.values.length, 1);
    const x = count > 1 ? (i / (count - 1)) * chartWidth : chartWidth / 2;
    const y = chartHeight - (v / maxVal) * (chartHeight - 30) - 15;
    return `${x},${y}`;
  });

  const pathD = points.length > 0 ? `M ${points.join(' L ')}` : '';
  const areaD = points.length > 0 ? `${pathD} L ${chartWidth},${chartHeight} L 0,${chartHeight} Z` : '';

  const totalActionNeeded = actionCounts.pendingDelivery + actionCounts.processing + actionCounts.contactMessages;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Tổng quan hệ thống</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Theo dõi doanh số, quản lý đơn hàng cần xử lý và xem nhật ký hoạt động hệ thống BOW.</p>
      </div>

      {/* 4 KPI CARDS */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            key: 'revenue',
            label: 'Tổng doanh thu',
            value: `${stats.totalRevenue.toLocaleString('vi-VN')}đ`,
            change: changes.revenue.text,
            isPos: changes.revenue.isPos,
            icon: '💰',
            accentColor: 'from-[#19A7FF]/20 to-[#2563EB]/20 border-[#2563EB]/30 text-[#2563EB] dark:text-[#35A8FF]',
            strokeColor: '#2563EB',
            svgPath: 'M 0,22 Q 20,8 40,25 T 80,10 T 120,28'
          },
          {
            key: 'orders',
            label: 'Tổng đơn hàng',
            value: stats.totalOrders.toLocaleString('vi-VN'),
            change: changes.orders.text,
            isPos: changes.orders.isPos,
            icon: '📦',
            accentColor: 'from-rose-500/20 to-red-600/20 border-rose-500/30 text-rose-500',
            strokeColor: '#EF4444',
            svgPath: 'M 0,30 Q 25,10 50,25 T 100,5 T 120,15'
          },
          {
            key: 'products',
            label: 'Sản phẩm hiện có',
            value: stats.totalProducts.toLocaleString('vi-VN'),
            change: changes.products.text,
            isPos: changes.products.isPos,
            icon: '🛍',
            accentColor: 'from-emerald-500/20 to-teal-600/20 border-emerald-500/30 text-emerald-500',
            strokeColor: '#10B981',
            svgPath: 'M 0,18 Q 30,30 60,10 T 120,5'
          },
          {
            key: 'users',
            label: 'Tổng thành viên',
            value: stats.totalUsers.toLocaleString('vi-VN'),
            change: changes.users.text,
            isPos: changes.users.isPos,
            icon: '👤',
            accentColor: 'from-amber-500/20 to-orange-600/20 border-amber-500/30 text-amber-500',
            strokeColor: '#F59E0B',
            svgPath: 'M 0,25 Q 35,5 70,20 T 120,10'
          },
        ].map((c) => (
          <div
            key={c.key}
            className="group relative rounded-[22px] border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] p-4 shadow-xs hover:shadow-card hover:border-[#2563EB]/40 dark:hover:border-[#35A8FF]/40 transition-all duration-300 flex flex-col justify-between overflow-hidden"
          >
            {/* Top header row: Icon + Label + Change Badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`h-8 w-8 rounded-xl bg-gradient-to-br ${c.accentColor} border flex items-center justify-center text-sm shrink-0 shadow-2xs group-hover:scale-105 transition-transform`}>
                  {c.icon}
                </span>
                <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                  {c.label}
                </span>
              </div>

              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black shrink-0 ${
                c.isPos
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40'
                  : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200/50 dark:border-red-800/40'
              }`}>
                {c.change}
              </span>
            </div>

            {/* Bottom value + sparkline row */}
            <div className="mt-3.5 flex items-baseline justify-between gap-2">
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
                {loading ? <span className="inline-block h-7 w-20 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /> : c.value}
              </span>

              <div className="w-16 h-7 shrink-0 opacity-85 group-hover:opacity-100 transition-opacity">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 120 40">
                  <path
                    d={c.svgPath}
                    fill="none"
                    stroke={c.strokeColor}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* REVENUE CHART (8 COLS) & CẦN XỬ LÝ (4 COLS) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Revenue Chart (8 Cols) */}
        <div className="lg:col-span-8 rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-5 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3.5">
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Doanh thu cửa hàng</h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Biểu đồ dòng tiền luân chuyển từ các đơn hàng thực tế.</p>
            </div>
            
            {/* Chart toggle range */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
              {[
                { key: '7d', label: '7 ngày' },
                { key: '30d', label: '30 ngày' },
                { key: '12m', label: '12 tháng' },
              ].map((r) => (
                <button
                  key={r.key}
                  onClick={() => setActiveRange(r.key as RangeMode)}
                  className={`rounded-lg px-3 py-1 text-[10px] font-bold transition-all ${
                    activeRange === r.key
                      ? 'bg-white dark:bg-[#131C32] text-[#2563EB] shadow-xs font-extrabold'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic SVG chart */}
          <div className="mt-4 w-full h-[160px] relative">
            <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#19A7FF" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              
              <line x1="0" y1={chartHeight - 15} x2={chartWidth} y2={chartHeight - 15} stroke="#E8F1FF" strokeWidth={1} className="dark:stroke-slate-800/40" />
              <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="#E8F1FF" strokeWidth={1} className="dark:stroke-slate-800/40" strokeDasharray="4" />
              <line x1="0" y1="15" x2={chartWidth} y2="15" stroke="#E8F1FF" strokeWidth={1} className="dark:stroke-slate-800/40" />
              
              <path d={areaD} fill="url(#chartGradient)" />
              <path d={pathD} fill="none" stroke="#2563EB" strokeWidth={3} strokeLinecap="round" />
              
              {points.map((p, idx) => {
                const [x, y] = p.split(',');
                const val = currentChart.values[idx] || 0;
                return (
                  <g key={idx} className="group">
                    <circle
                      cx={x}
                      cy={y}
                      r={4.5}
                      fill="#FFFFFF"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      className="cursor-pointer hover:r-6 transition-all"
                    />
                    <title>{`${currentChart.labels[idx] || ''}: ${val.toLocaleString('vi-VN')}đ`}</title>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex justify-between border-t border-slate-100 dark:border-slate-800/60 pt-3 text-[10px] text-slate-400 font-bold px-1">
            {currentChart.labels.map((lbl, idx) => (
              <span key={idx}>{lbl}</span>
            ))}
          </div>
        </div>

        {/* ⚠️ CẦN XỬ LÝ (4 Cols) */}
        <div className="lg:col-span-4 rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span>⚠️</span> CẦN XỬ LÝ
              </h3>
              {totalActionNeeded > 0 && (
                <span className="inline-flex items-center rounded-full bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 text-[10px] font-black text-rose-600 dark:text-rose-400 border border-rose-200/50">
                  {totalActionNeeded} tác vụ
                </span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {/* Item 1: Đơn chờ bàn giao */}
              <Link
                to="/admin/orders?status=pending_delivery"
                className="flex items-center justify-between p-3 rounded-2xl border border-rose-100 dark:border-rose-900/30 bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping shrink-0" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Đơn chờ bàn giao</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/50 px-2 py-0.5 rounded-lg">
                    {actionCounts.pendingDelivery}
                  </span>
                  <span className="text-slate-400 group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </Link>

              {/* Item 2: Đơn cần xử lý (đang thiết lập) */}
              <Link
                to="/admin/orders?status=processing"
                className="flex items-center justify-between p-3 rounded-2xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Đơn cần xử lý</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded-lg">
                    {actionCounts.processing}
                  </span>
                  <span className="text-slate-400 group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </Link>

              {/* Item 3: Yêu cầu liên hệ */}
              <Link
                to="/admin/contact"
                className="flex items-center justify-between p-3 rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Yêu cầu liên hệ</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-[#2563EB] dark:text-[#35A8FF] bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-lg">
                    {actionCounts.contactMessages}
                  </span>
                  <span className="text-slate-400 group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </Link>
            </div>
          </div>

          {totalActionNeeded === 0 ? (
            <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
              🎉 Không có việc cần xử lý!
            </div>
          ) : (
            <p className="mt-4 text-[10px] text-slate-400 text-center font-semibold">
              Bấm vào từng mục để tới trang quản lý xử lý nhanh.
            </p>
          )}
        </div>
      </div>

      {/* ĐƠN HÀNG MỚI NHẤT */}
      <div className="rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3.5">
          <div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Đơn hàng mới nhất</h3>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Top 5 đơn hàng vừa được khởi tạo trên hệ thống.</p>
          </div>
          <Link
            to="/admin/orders"
            className="text-xs font-extrabold text-[#2563EB] dark:text-[#35A8FF] hover:underline"
          >
            Quản lý tất cả đơn hàng →
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="py-6 text-center text-xs font-medium text-slate-400">Chưa có đơn hàng nào trong hệ thống.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs font-semibold">
              <thead>
                <tr className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800/50">
                  <th className="py-2.5 px-2">Mã đơn</th>
                  <th className="py-2.5 px-2">Sản phẩm</th>
                  <th className="py-2.5 px-2">Khách hàng</th>
                  <th className="py-2.5 px-2">Giá tiền</th>
                  <th className="py-2.5 px-2">Trạng thái</th>
                  <th className="py-2.5 px-2 text-right">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                {recentOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/30 transition-colors">
                    <td className="py-3 px-2 font-mono font-bold text-slate-900 dark:text-white">
                      #{ord.payment_code || ord.id.substring(0, 8)}
                    </td>
                    <td className="py-3 px-2">
                      <span className="font-bold text-slate-900 dark:text-white">{ord.product_name || 'N/A'}</span>
                      {ord.plan_label && <span className="block text-[10px] text-slate-400">{ord.plan_label}</span>}
                    </td>
                    <td className="py-3 px-2 text-slate-500 dark:text-slate-400">
                      {ord.profiles?.full_name || 'Thành viên'}
                    </td>
                    <td className="py-3 px-2 font-extrabold text-[#2563EB]">
                      {Number(ord.price || 0).toLocaleString('vi-VN')}đ
                    </td>
                    <td className="py-3 px-2">
                      {getStatusBadge(ord.status)}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-[11px] text-slate-400">
                      {formatRelativeTime(ord.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* HOẠT ĐỘNG GẦN ĐÂY (5 PREVIEW ENTRIES + VIEW ALL BUTTON) */}
      <div className="rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-3.5">
          <div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Hoạt động gần đây</h3>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">5 thao tác mới nhất được ghi nhận từ hệ thống Nhật ký hoạt động.</p>
          </div>
          <Link
            to="/admin/activity"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#2563EB] dark:hover:text-[#35A8FF] transition shadow-2xs shrink-0"
          >
            <span>Xem tất cả →</span>
          </Link>
        </div>
        
        {activities.length === 0 ? (
          <p className="mt-4 text-xs font-medium text-slate-400 text-center py-4">Chưa có hoạt động nào được ghi nhận.</p>
        ) : (
          <div className="mt-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800 space-y-4">
            {activities.map((act) => (
              <div key={act.id} className="flex gap-4 items-start pl-1 relative">
                <span className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold shadow-xs relative z-10 ${act.iconBg}`}>
                  {act.tag.charAt(0)}
                </span>
                <div className="flex-1 text-xs">
                  <p className="font-bold text-slate-800 dark:text-slate-200 leading-snug">{act.text}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400 font-semibold">
                    <span>{act.time}</span>
                    <span>•</span>
                    <span className="text-[#2563EB] dark:text-[#35A8FF]">{act.tag}</span>
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
