import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { fetchStats } from '../../data/admin';

type RangeMode = '7d' | '30d' | '90d' | '12m';

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
  category: 'ticket' | 'order' | 'review' | 'coupon' | 'user' | 'system';
  role: 'admin' | 'user' | 'system';
  link: string;
  iconBg: string;
  icon: string;
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

interface TopProductStat {
  name: string;
  salesCount: number;
  revenue: number;
  percentage: number;
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

function formatAuditDescription(desc: string | null | undefined): string {
  if (!desc) return '';
  return desc
    // Order & Delivery statuses
    .replace(/"pending_payment"/g, '"Chờ thanh toán"')
    .replace(/"pending_delivery"/g, '"Chờ bàn giao"')
    .replace(/"processing"/g, '"Đang thiết lập"')
    .replace(/"completed"/g, '"Hoàn tất"')
    .replace(/"cancelled"/g, '"Đã hủy"')
    .replace(/"refunded"/g, '"Đã hoàn tiền"')
    .replace(/\bpending_payment\b/g, 'Chờ thanh toán')
    .replace(/\bpending_delivery\b/g, 'Chờ bàn giao')
    .replace(/\bcompleted\b/g, 'Hoàn tất')
    .replace(/\bcancelled\b/g, 'Đã hủy')
    .replace(/\brefunded\b/g, 'Đã hoàn tiền')

    // Ticket Statuses
    .replace(/"pending"/g, '"Chờ phản hồi"')
    .replace(/"resolved"/g, '"Đã giải quyết"')
    .replace(/"closed"/g, '"Đã đóng"')
    .replace(/\bstatus:?\s*pending\b/gi, 'Trạng thái: Chờ phản hồi')
    .replace(/\bstatus:?\s*resolved\b/gi, 'Trạng thái: Đã giải quyết')
    .replace(/\bstatus:?\s*closed\b/gi, 'Trạng thái: Đã đóng')

    // Ticket Priorities
    .replace(/"low"/g, '"Thấp"')
    .replace(/"normal"/g, '"Bình thường"')
    .replace(/"high"/g, '"Cao"')
    .replace(/"urgent"/g, '"Khẩn cấp"')
    .replace(/\bpriority:?\s*urgent\b/gi, 'Mức ưu tiên: Khẩn cấp')
    .replace(/\bpriority:?\s*high\b/gi, 'Mức ưu tiên: Cao')
    .replace(/\bpriority:?\s*normal\b/gi, 'Mức ưu tiên: Bình thường')
    .replace(/\bpriority:?\s*low\b/gi, 'Mức ưu tiên: Thấp')

    // Review Statuses
    .replace(/"approved"/g, '"Đã duyệt"')
    .replace(/"rejected"/g, '"Đã từ chối"')
    .replace(/\bapproved\b/g, 'Đã duyệt')
    .replace(/\brejected\b/g, 'Đã từ chối');
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
    todayRevenue: 0,
    rev7d: 0,
    rev30d: 0,
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
  const [rawOrders, setRawOrders] = useState<OrderRow[]>([]);
  const [chartData, setChartData] = useState<Record<RangeMode, DynamicChart>>({
    '7d': { labels: [], values: [] },
    '30d': { labels: [], values: [] },
    '90d': { labels: [], values: [] },
    '12m': { labels: [], values: [] },
  });

  // Action items counts (CẦN XỬ LÝ)
  const [actionCounts, setActionCounts] = useState({
    pendingDelivery: 0,
    processing: 0,
    contactMessages: 0,
  });

  // Operational KPIs for Command Center Widget
  const [operationalKPIs, setOperationalKPIs] = useState({
    totalUserBalance: 0,
    pendingReviewsCount: 0,
    activeCouponsCount: 0,
  });

  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const isPaidStatus = (status: string) => ['pending_delivery', 'processing', 'completed'].includes(status);

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
      setRawOrders(allOrders);
      setRecentOrders(allOrders.slice(0, 5));

      // Compute action counts
      const pendingDelivery = allOrders.filter((o) => o.status === 'pending_delivery').length;
      const processing = allOrders.filter((o) => o.status === 'processing').length;

      let contactMessages = 0;
      try {
        const savedMsgs = localStorage.getItem('bow_inbox_messages');
        if (savedMsgs) {
          const msgs = JSON.parse(savedMsgs);
          contactMessages = msgs.filter((m: any) => m.unread && !m.archived).length;
        } else {
          contactMessages = 2;
        }
      } catch {
        contactMessages = 0;
      }

      setActionCounts({
        pendingDelivery,
        processing,
        contactMessages,
      });

      // 2. Fetch profiles & operational KPIs
      const [
        { data: profilesData },
        { data: productsData },
        { data: pendingReviewsData },
        { data: couponsData },
      ] = await Promise.all([
        supabase.from('profiles').select('id, created_at, balance') as any,
        supabase.from('products').select('id, created_at') as any,
        supabase.from('product_reviews').select('id').eq('status', 'pending') as any,
        supabase.from('coupons').select('id, is_active, expires_at') as any,
      ]);

      const allProfiles: ProfileRow[] = profilesData || [];
      const allProducts: ProductRow[] = productsData || [];

      const totalUserBalance = (profilesData || []).reduce(
        (sum: number, p: any) => sum + Number(p.balance || 0),
        0
      );
      const pendingReviewsCount = pendingReviewsData?.length || 0;
      const nowDate = new Date();
      const activeCouponsCount = (couponsData || []).filter(
        (c: any) => c.is_active && (!c.expires_at || new Date(c.expires_at) >= nowDate)
      ).length;

      setOperationalKPIs({
        totalUserBalance,
        pendingReviewsCount,
        activeCouponsCount,
      });

      // Filter paid revenue
      const paidOrders = allOrders.filter((o) => isPaidStatus(o.status));
      const totalRev = paidOrders.reduce((sum, o) => sum + Number(o.price || 0), 0);

      // Sub-KPIs
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime();

      const todayRevenue = paidOrders
        .filter((o) => new Date(o.created_at).getTime() >= startOfToday)
        .reduce((sum, o) => sum + Number(o.price || 0), 0);

      const rev7d = paidOrders
        .filter((o) => now - new Date(o.created_at).getTime() <= 7 * dayMs)
        .reduce((sum, o) => sum + Number(o.price || 0), 0);

      const rev30d = paidOrders
        .filter((o) => now - new Date(o.created_at).getTime() <= 30 * dayMs)
        .reduce((sum, o) => sum + Number(o.price || 0), 0);

      setStats({
        totalProducts: allProducts.length || base.totalProducts || 0,
        totalOrders: allOrders.length,
        totalUsers: allProfiles.length,
        totalRevenue: totalRev,
        todayRevenue,
        rev7d,
        rev30d,
      });

      // 4. Calculate percentage changes
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

      // 6. Fetch recent activities from audit_logs
      const { data: auditData, error: auditErr } = await (supabase
        .from('audit_logs')
        .select('id, description, actor_name, actor_role, created_at')
        .order('created_at', { ascending: false })
        .limit(5) as any);

      const acts: ActivityItem[] = [];
      if (auditData && auditData.length > 0 && !auditErr) {
        auditData.forEach((log: any) => {
          const rawDesc = log.description || '';
          const descLower = rawDesc.toLowerCase();
          const actorRole: 'admin' | 'user' | 'system' =
            log.actor_role === 'admin' ? 'admin' : log.actor_role === 'user' ? 'user' : 'system';

          let category: 'ticket' | 'order' | 'review' | 'coupon' | 'user' | 'system' = 'system';
          let icon = '⚡';
          let iconBg = 'bg-gradient-to-tr from-slate-600 to-slate-800 text-white';
          let link = '/admin/activity';

          if (descLower.includes('ticket') || rawDesc.includes('BOW-')) {
            category = 'ticket';
            icon = '🎫';
            iconBg = 'bg-gradient-to-tr from-blue-500 to-indigo-600 text-white shadow-blue-500/20';
            const ticketMatch = rawDesc.match(/BOW-\d+/i);
            link = ticketMatch ? `/admin/tickets?ticket=${ticketMatch[0].toUpperCase()}` : '/admin/tickets';
          } else if (descLower.includes('đánh giá') || descLower.includes('review') || descLower.includes('sao')) {
            category = 'review';
            icon = '⭐';
            iconBg = 'bg-gradient-to-tr from-amber-400 to-orange-500 text-white shadow-amber-500/20';
            link = '/admin/reviews';
          } else if (descLower.includes('đơn') || descLower.includes('order') || rawDesc.includes('#BOW')) {
            category = 'order';
            icon = '📦';
            iconBg = 'bg-gradient-to-tr from-emerald-400 to-teal-600 text-white shadow-emerald-500/20';
            link = '/admin/orders';
          } else if (descLower.includes('coupon') || descLower.includes('mã giảm') || descLower.includes('voucher')) {
            category = 'coupon';
            icon = '🎟️';
            iconBg = 'bg-gradient-to-tr from-purple-500 to-pink-600 text-white shadow-purple-500/20';
            link = '/admin/coupons';
          } else if (descLower.includes('ví') || descLower.includes('nạp tiền') || descLower.includes('balance') || descLower.includes('khóa') || descLower.includes('tài khoản')) {
            category = 'user';
            icon = '👤';
            iconBg = 'bg-gradient-to-tr from-sky-400 to-blue-600 text-white shadow-sky-500/20';
            link = '/admin/users';
          }

          acts.push({
            id: log.id,
            text: formatAuditDescription(log.description),
            tag: log.actor_name || (actorRole === 'admin' ? 'Admin' : actorRole === 'user' ? 'Khách hàng' : 'Hệ thống'),
            category,
            role: actorRole,
            link,
            iconBg,
            icon,
            time: formatRelativeTime(log.created_at),
          });
        });
      } else {
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
              category: 'order',
              role: 'system',
              link: '/admin/orders',
              iconBg: n.type === 'new_order' ? 'bg-emerald-500 text-white' : n.type === 'order_cancelled' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white',
              icon: n.type === 'new_order' ? '📦' : n.type === 'order_cancelled' ? '❌' : '🔔',
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
    const dayMs = 24 * 60 * 60 * 1000;

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
          return t >= day.start && t <= day.end && isPaidStatus(o.status);
        })
        .reduce((sum, o) => sum + Number(o.price || 0), 0)
    );

    // 30d Chart
    const weeks30: { label: string; start: number; end: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const start = now.getTime() - (i + 1) * 7 * dayMs;
      const end = now.getTime() - i * 7 * dayMs;
      weeks30.push({ label: `Tuần ${4 - i}`, start, end });
    }
    const val30d = weeks30.map((w) =>
      orders
        .filter((o) => {
          const t = new Date(o.created_at).getTime();
          return t >= w.start && t < w.end && isPaidStatus(o.status);
        })
        .reduce((sum, o) => sum + Number(o.price || 0), 0)
    );

    // 90d Chart (3 tháng - 6 mốc 15 ngày)
    const points90: { label: string; start: number; end: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = now.getTime() - (i + 1) * 15 * dayMs;
      const end = now.getTime() - i * 15 * dayMs;
      const d = new Date(start);
      points90.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, start, end });
    }
    const val90d = points90.map((p) =>
      orders
        .filter((o) => {
          const t = new Date(o.created_at).getTime();
          return t >= p.start && t < p.end && isPaidStatus(o.status);
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
          return d.getFullYear() === m.year && d.getMonth() === m.month && isPaidStatus(o.status);
        })
        .reduce((sum, o) => sum + Number(o.price || 0), 0)
    );

    setChartData({
      '7d': { labels: days7.map((d) => d.label), values: val7d },
      '30d': { labels: weeks30.map((w) => w.label), values: val30d },
      '90d': { labels: points90.map((p) => p.label), values: val90d },
      '12m': { labels: months12.map((m) => m.label), values: val12m },
    });
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Filtered Analytics per activeRange
  const rangeFilteredOrders = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    let limitMs = 7 * dayMs;
    if (activeRange === '30d') limitMs = 30 * dayMs;
    if (activeRange === '90d') limitMs = 90 * dayMs;
    if (activeRange === '12m') limitMs = 365 * dayMs;

    return rawOrders.filter((o) => now - new Date(o.created_at).getTime() <= limitMs);
  }, [rawOrders, activeRange]);

  // Range Top 5 Products (Sorted strictly by sales count sold, excluding wallet top-ups)
  const rangeTopProducts = useMemo<TopProductStat[]>(() => {
    const paidInRange = rangeFilteredOrders.filter(
      (o) => isPaidStatus(o.status) && o.product_name && !o.product_name.includes('Nạp tiền')
    );
    const totalSalesCountInRange = paidInRange.length;

    const map = new Map<string, { salesCount: number; revenue: number }>();
    paidInRange.forEach((o) => {
      const pName = o.product_name!;
      const curr = map.get(pName) || { salesCount: 0, revenue: 0 };
      map.set(pName, {
        salesCount: curr.salesCount + 1,
        revenue: curr.revenue + Number(o.price || 0),
      });
    });

    return Array.from(map.entries())
      .map(([name, stat]) => ({
        name,
        salesCount: stat.salesCount,
        revenue: stat.revenue,
        percentage: totalSalesCountInRange > 0 ? Math.round((stat.salesCount / totalSalesCountInRange) * 100) : 0,
      }))
      .sort((a, b) => b.salesCount - a.salesCount || b.revenue - a.revenue)
      .slice(0, 5);
  }, [rangeFilteredOrders]);

  // Range Category Performance & AOV Metrics
  const categoryAnalytics = useMemo(() => {
    const paidInRange = rangeFilteredOrders.filter(
      (o) => isPaidStatus(o.status) && o.product_name && !o.product_name.includes('Nạp tiền')
    );
    const totalPaidRev = paidInRange.reduce((sum, o) => sum + Number(o.price || 0), 0);
    const totalPaidSales = paidInRange.length;

    // AOV (Average Order Value)
    const aov = totalPaidSales > 0 ? Math.round(totalPaidRev / totalPaidSales) : 0;

    // Group sales into AI Tools vs Premium Apps
    let aiToolsCount = 0;
    let aiToolsRev = 0;
    let premiumAppsCount = 0;
    let premiumAppsRev = 0;

    const aiKeywords = ['claude', 'chatgpt', 'cursor', 'codex', 'leonardo', 'veo', 'gemini', 'grok', 'kling', 'perplexity', 'meitu', 'youku'];

    paidInRange.forEach((o) => {
      const pNameLower = (o.product_name || '').toLowerCase();
      const isAI = aiKeywords.some((k) => pNameLower.includes(k)) || pNameLower.includes('ai');
      const price = Number(o.price || 0);

      if (isAI) {
        aiToolsCount++;
        aiToolsRev += price;
      } else {
        premiumAppsCount++;
        premiumAppsRev += price;
      }
    });

    const aiRevPct = totalPaidRev > 0 ? Math.round((aiToolsRev / totalPaidRev) * 100) : 0;
    const appRevPct = totalPaidRev > 0 ? Math.round((premiumAppsRev / totalPaidRev) * 100) : 0;

    const totalOrdersCount = rangeFilteredOrders.length;
    const completedCount = rangeFilteredOrders.filter((o) => isPaidStatus(o.status)).length;
    const completionRate = totalOrdersCount > 0 ? Math.round((completedCount / totalOrdersCount) * 100) : 0;

    return {
      aov,
      totalPaidSales,
      totalPaidRev,
      aiToolsCount,
      aiToolsRev,
      aiRevPct,
      premiumAppsCount,
      premiumAppsRev,
      appRevPct,
      completionRate,
    };
  }, [rangeFilteredOrders]);

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
  const currentChart = chartData[activeRange] || { labels: [], values: [] };
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
      {/* Title Header & Time Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Tổng quan hệ thống</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Theo dõi doanh số, phân tích sản phẩm bán chạy và nhật ký hoạt động hệ thống BOW.</p>
        </div>

        {/* Global Time Filter Controls */}
        <div className="flex items-center gap-1 bg-white dark:bg-[#131C32] p-1.5 rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A]/50 shadow-2xs self-start sm:self-auto">
          <span className="text-[10px] font-black uppercase text-slate-400 px-2">Thời gian:</span>
          {[
            { key: '7d', label: '7 ngày' },
            { key: '30d', label: '30 ngày' },
            { key: '90d', label: '3 tháng' },
            { key: '12m', label: '12 tháng' },
          ].map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setActiveRange(r.key as RangeMode)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${activeRange === r.key
                ? 'bg-gradient-to-r from-[#19A7FF] to-[#2563EB] text-white shadow-xs font-black'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 MAIN KPI CARDS */}
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
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`h-8 w-8 rounded-xl bg-gradient-to-br ${c.accentColor} border flex items-center justify-center text-sm shrink-0 shadow-2xs group-hover:scale-105 transition-transform`}>
                  {c.icon}
                </span>
                <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                  {c.label}
                </span>
              </div>

              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black shrink-0 ${c.isPos
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40'
                : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200/50 dark:border-red-800/40'
                }`}>
                {c.change}
              </span>
            </div>

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

      {/* QUICK STATS BAR */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 flex items-center gap-3">
          <span className="text-xl">⚡</span>
          <div>
            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 block">Doanh thu Hôm nay</span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">{stats.todayRevenue.toLocaleString('vi-VN')}đ</span>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/40 dark:bg-blue-950/20 p-3.5 flex items-center gap-3">
          <span className="text-xl">📈</span>
          <div>
            <span className="text-[10px] font-black uppercase text-[#2563EB] dark:text-[#35A8FF] block">Doanh thu 7 Ngày</span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">{stats.rev7d.toLocaleString('vi-VN')}đ</span>
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/40 dark:bg-indigo-950/20 p-3.5 flex items-center gap-3">
          <span className="text-xl">📊</span>
          <div>
            <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 block">Doanh thu 30 Ngày</span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">{stats.rev30d.toLocaleString('vi-VN')}đ</span>
          </div>
        </div>

        <div className="rounded-2xl border border-purple-100 dark:border-purple-900/30 bg-purple-50/40 dark:bg-purple-950/20 p-3.5 flex items-center gap-3">
          <span className="text-xl">🎯</span>
          <div>
            <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 block">Đơn trong kỳ chọn</span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">{rangeFilteredOrders.length} đơn</span>
          </div>
        </div>
      </div>

      {/* REVENUE CHART & ACTION NEEDED */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Revenue Chart (8 Cols) */}
        <div className="lg:col-span-8 rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-5 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3.5">
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Doanh thu dòng tiền</h3>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Biểu đồ tổng hợp doanh số từ các đơn hàng thực tế ({activeRange}).</p>
            </div>

            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
              {[
                { key: '7d', label: '7 ngày' },
                { key: '30d', label: '30 ngày' },
                { key: '90d', label: '3 tháng' },
                { key: '12m', label: '12 tháng' },
              ].map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setActiveRange(r.key as RangeMode)}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${activeRange === r.key
                    ? 'bg-white dark:bg-[#131C32] text-[#2563EB] dark:text-[#35A8FF] shadow-xs font-extrabold'
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

              {/* Item 2: Đơn cần xử lý */}
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
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Ticket cần phản hồi</span>
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

      {/* TOP SẢN PHẨM (6 COLS) & TRẠNG THÁI ĐƠN HÀNG (6 COLS) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* TOP SẢN PHẨM BÁN CHẠY (6 Cols) */}
        <div className="lg:col-span-6 rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3.5">
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span>🏆</span> TOP SẢN PHẨM BÁN CHẠY
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Top 5 sản phẩm có số đơn bán nhiều nhất ({activeRange}).</p>
              </div>
              <Link to="/admin/products" className="text-[11px] font-bold text-[#2563EB] dark:text-[#35A8FF] hover:underline">
                Quản lý ›
              </Link>
            </div>

            {rangeTopProducts.length === 0 ? (
              <p className="py-8 text-center text-xs font-medium text-slate-400">Chưa có dữ liệu bán hàng trong khoảng thời gian này.</p>
            ) : (
              <div className="mt-4 space-y-3.5">
                {rangeTopProducts.map((p, idx) => (
                  <div key={p.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-5 w-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${idx === 0
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
                          : idx === 1
                            ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                            : idx === 2
                              ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate" title={p.name}>
                          {p.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
                        <span className="text-slate-400 font-semibold">{p.salesCount} đơn</span>
                        <span className="font-extrabold text-[#2563EB] dark:text-[#35A8FF]">{p.revenue.toLocaleString('vi-VN')}đ</span>
                      </div>
                    </div>

                    {/* Revenue share progress bar */}
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-gradient-to-r from-[#19A7FF] to-[#2563EB] rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(p.percentage, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* TRUNG TÂM ĐIỀU HÀNH & CƠ CẤU DOANH THU (6 Cols) */}
        <div className="lg:col-span-6 rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span>⚡</span> TRUNG TÂM ĐIỀU HÀNH & CƠ CẤU DOANH MỤC
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Tổng hợp chỉ số vận hành tức thì & cơ cấu doanh thu ({activeRange}).</p>
              </div>
            </div>

            {/* ⚡ Bộ 3 Chỉ số Nhanh (3-in-1 Quick KPI Badges) */}
            <div className="mt-3.5 grid grid-cols-3 gap-2">
              {/* 1. Dòng tiền ví người dùng */}
              <Link
                to="/admin/users"
                className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 sm:p-3 hover:border-emerald-400 dark:hover:border-emerald-600 transition group flex flex-col justify-between shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span>💰</span> <span className="hidden xs:inline">Tổng ví</span>
                  </span>
                  <span className="text-[10px] text-emerald-500 opacity-70 group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
                <div className="mt-1.5">
                  <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white block truncate">
                    {operationalKPIs.totalUserBalance.toLocaleString('vi-VN')}đ
                  </span>
                  <span className="text-[9px] text-slate-400 font-semibold block truncate">Số dư ví người dùng</span>
                </div>
              </Link>

              {/* 2. Đánh giá chờ duyệt */}
              <Link
                to="/admin/reviews"
                className="rounded-2xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 sm:p-3 hover:border-amber-400 dark:hover:border-amber-600 transition group flex flex-col justify-between shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <span>⭐</span> <span className="hidden xs:inline">Đánh giá</span>
                  </span>
                  <span className="text-[10px] text-amber-500 opacity-70 group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
                <div className="mt-1.5">
                  <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white block truncate">
                    {operationalKPIs.pendingReviewsCount > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-black">{operationalKPIs.pendingReviewsCount} chờ duyệt</span>
                    ) : (
                      <span className="text-slate-700 dark:text-slate-200">Đã duyệt hết</span>
                    )}
                  </span>
                  <span className="text-[9px] text-slate-400 font-semibold block truncate">Kiểm duyệt review</span>
                </div>
              </Link>

              {/* 3. Mã giảm giá đang chạy */}
              <Link
                to="/admin/coupons"
                className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 sm:p-3 hover:border-blue-400 dark:hover:border-blue-600 transition group flex flex-col justify-between shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB] dark:text-[#35A8FF] flex items-center gap-1">
                    <span>🎟️</span> <span className="hidden xs:inline">Voucher</span>
                  </span>
                  <span className="text-[10px] text-blue-500 opacity-70 group-hover:translate-x-0.5 transition-transform">→</span>
                </div>
                <div className="mt-1.5">
                  <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white block truncate">
                    {operationalKPIs.activeCouponsCount} mã đang chạy
                  </span>
                  <span className="text-[9px] text-slate-400 font-semibold block truncate">Chiến dịch khuyến mãi</span>
                </div>
              </Link>
            </div>

            {/* AOV & Completion Rate KPI Chips */}
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-[#18243E] p-3">
                <span className="text-[10px] font-black uppercase text-[#2563EB] dark:text-[#35A8FF] block">Giá trị đơn TB (AOV)</span>
                <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">
                  {categoryAnalytics.aov.toLocaleString('vi-VN')}đ
                </span>
                <span className="text-[9px] font-semibold text-slate-400 block mt-0.5">Doanh thu TB mỗi đơn</span>
              </div>

              <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-[#18243E] p-3">
                <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 block">Tỷ lệ hoàn thành</span>
                <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">
                  {categoryAnalytics.completionRate}%
                </span>
                <span className="text-[9px] font-semibold text-slate-400 block mt-0.5">Tỷ lệ đơn bàn giao thành công</span>
              </div>
            </div>

            {/* Category Revenue Breakdown */}
            <div className="mt-3 space-y-2.5">
              {/* Category 1: AI Tools */}
              <div className="rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A] bg-[#F8FAFC] dark:bg-[#18243E] p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">🤖</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">AI Tools</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-slate-400 font-semibold">{categoryAnalytics.aiToolsCount} đơn</span>
                    <span className="font-extrabold text-[#2563EB] dark:text-[#35A8FF]">
                      {categoryAnalytics.aiToolsRev.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                  <span>Tỷ trọng doanh thu</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200">{categoryAnalytics.aiRevPct}%</span>
                </div>

                <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-400 to-[#2563EB] rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(categoryAnalytics.aiRevPct, categoryAnalytics.aiToolsCount > 0 ? 8 : 0)}%` }}
                  />
                </div>
              </div>

              {/* Category 2: Premium Apps */}
              <div className="rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A] bg-[#F8FAFC] dark:bg-[#18243E] p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">📱</span>
                    <span className="font-extrabold text-slate-900 dark:text-white">Premium Apps</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-slate-400 font-semibold">{categoryAnalytics.premiumAppsCount} đơn</span>
                    <span className="font-extrabold text-purple-600 dark:text-purple-400">
                      {categoryAnalytics.premiumAppsRev.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                  <span>Tỷ trọng doanh thu</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200">{categoryAnalytics.appRevPct}%</span>
                </div>

                <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-400 to-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(categoryAnalytics.appRevPct, categoryAnalytics.premiumAppsCount > 0 ? 8 : 0)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
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

      {/* HOẠT ĐỘNG GẦN ĐÂY - TIMELINE HIỆN ĐẠI */}
      <div className="rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60 pb-3.5">
          <div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <span>⚡</span> HOẠT ĐỘNG GẦN ĐÂY
            </h3>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">5 thao tác mới nhất được ghi nhận từ hệ thống Nhật ký hoạt động.</p>
          </div>
          <Link
            to="/admin/activity"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#2563EB] dark:hover:text-[#35A8FF] transition shadow-2xs shrink-0"
          >
            <span>Xem tất cả nhật ký →</span>
          </Link>
        </div>

        {activities.length === 0 ? (
          <p className="mt-4 text-xs font-medium text-slate-400 text-center py-4">Chưa có hoạt động nào được ghi nhận.</p>
        ) : (
          <div className="mt-4 relative before:absolute before:left-4.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800/80 space-y-2.5">
            {activities.map((act) => (
              <Link
                key={act.id}
                to={act.link}
                className="group flex gap-3.5 items-center p-2.5 sm:p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/50 transition relative"
              >
                {/* Semantic Icon with Gradient */}
                <span className={`h-9 w-9 rounded-2xl flex items-center justify-center text-sm shrink-0 font-bold shadow-xs relative z-10 transition-transform group-hover:scale-110 ${act.iconBg}`}>
                  {act.icon}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug group-hover:text-[#2563EB] dark:group-hover:text-[#35A8FF] transition-colors truncate">
                    {act.text}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-semibold flex-wrap">
                    <span className="font-mono">{act.time}</span>
                    <span>•</span>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                      act.role === 'admin'
                        ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/40'
                        : act.role === 'user'
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-[#35A8FF] border border-blue-200/40'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/40'
                    }`}>
                      {act.role === 'admin' ? '🛡️ Admin' : act.role === 'user' ? '👤 Khách hàng' : '⚙️ Hệ thống'}
                    </span>
                    {act.tag && act.tag !== act.role && (
                      <span className="text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                        {act.tag}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Arrow */}
                <span className="text-slate-300 dark:text-slate-600 group-hover:text-[#2563EB] dark:group-hover:text-[#35A8FF] group-hover:translate-x-1 transition-all text-xs font-bold shrink-0">
                  →
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
