import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useRealtimeEvent } from '../../services/realtime';

type RangeMode = '7d' | '30d' | '90d' | '12m';
type MetricView = 'revenue' | 'orders';

interface DynamicChart {
  labels: string[];
  values: number[];
  completedValues?: number[];
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
  expires_at?: string;
  payment_code?: string;
  product_name?: string;
  plan_label?: string;
  profiles?: { full_name?: string; email?: string } | null;
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
    .replace(/"pending"/g, '"Chờ phản hồi"')
    .replace(/"resolved"/g, '"Đã giải quyết"')
    .replace(/"closed"/g, '"Đã đóng"')
    .replace(/\bstatus:?\s*pending\b/gi, 'Trạng thái: Chờ phản hồi')
    .replace(/\bstatus:?\s*resolved\b/gi, 'Trạng thái: Đã giải quyết')
    .replace(/\bstatus:?\s*closed\b/gi, 'Trạng thái: Đã đóng')
    .replace(/"approved"/g, '"Đã duyệt"')
    .replace(/"rejected"/g, '"Đã từ chối"')
    .replace(/\bapproved\b/g, 'Đã duyệt')
    .replace(/\brejected\b/g, 'Đã từ chối');
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [activeRange, setActiveRange] = useState<RangeMode>('7d');
  const [metricView, setMetricView] = useState<MetricView>('revenue');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [rawOrders, setRawOrders] = useState<OrderRow[]>([]);
  const [chartRevenueData, setChartRevenueData] = useState<Record<RangeMode, DynamicChart>>({
    '7d': { labels: [], values: [] },
    '30d': { labels: [], values: [] },
    '90d': { labels: [], values: [] },
    '12m': { labels: [], values: [] },
  });
  const [chartOrdersData, setChartOrdersData] = useState<Record<RangeMode, DynamicChart>>({
    '7d': { labels: [], values: [] },
    '30d': { labels: [], values: [] },
    '90d': { labels: [], values: [] },
    '12m': { labels: [], values: [] },
  });

  // Action items counts (HUB CẦN XỬ LÝ NGAY)
  const [actionHub, setActionHub] = useState({
    pendingTickets: 0,
    oldestTicketWait: '',
    pendingDelivery: 0,
    expiringSoon: 0,
    pendingReviews: 0,
  });

  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const isPaidStatus = (status: string) => ['pending_delivery', 'processing', 'completed'].includes(status);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch orders with profiles
      const { data: ordersData } = await (supabase
        .from('orders')
        .select('id, price, status, created_at, expires_at, payment_code, product_name, plan_label, profiles:profiles!orders_user_profile_fk(full_name, email)')
        .order('created_at', { ascending: false }) as any);

      const allOrders: OrderRow[] = ordersData || [];
      setRawOrders(allOrders);
      setRecentOrders(allOrders.slice(0, 5));

      // 2. Fetch pending reviews and tickets
      const [
        { data: pendingReviewsData },
        { data: ticketsData },
      ] = await Promise.all([
        supabase.from('product_reviews').select('id').eq('status', 'pending') as any,
        supabase.from('support_tickets').select('id, status, created_at').order('created_at', { ascending: true }) as any,
      ]);

      // Compute Action Hub metrics
      const pendingDelivery = allOrders.filter((o) => o.status === 'pending_delivery' || o.status === 'processing').length;
      const pendingReviews = pendingReviewsData?.length || 0;

      const nowMs = Date.now();
      const expiringSoon = allOrders.filter((o) => {
        if (o.status !== 'completed' || !o.expires_at) return false;
        const diffDays = (new Date(o.expires_at).getTime() - nowMs) / (24 * 60 * 60 * 1000);
        return diffDays > 0 && diffDays <= 3;
      }).length;

      const pendingTicketsList = (ticketsData || []).filter(
        (t: any) => t.status === 'pending' || t.status === 'processing'
      );
      const pendingTicketsCount = pendingTicketsList.length;
      const oldestTicketWait = pendingTicketsList.length > 0
        ? formatRelativeTime(pendingTicketsList[0].created_at)
        : '';

      setActionHub({
        pendingTickets: pendingTicketsCount,
        oldestTicketWait,
        pendingDelivery,
        expiringSoon,
        pendingReviews,
      });

      // Filter paid revenue
      // Build charts
      buildCharts(allOrders);

      // Fetch recent activities from audit_logs
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
            iconBg = 'bg-gradient-to-tr from-rose-500 to-red-600 text-white shadow-rose-500/20';
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
    const rev7d = days7.map((day) =>
      orders
        .filter((o) => {
          const t = new Date(o.created_at).getTime();
          return t >= day.start && t <= day.end && isPaidStatus(o.status);
        })
        .reduce((sum, o) => sum + Number(o.price || 0), 0)
    );
    const ord7d = days7.map((day) =>
      orders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= day.start && t <= day.end;
      }).length
    );
    const completedOrd7d = days7.map((day) =>
      orders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= day.start && t <= day.end && isPaidStatus(o.status);
      }).length
    );

    // 30d Chart
    const weeks30: { label: string; start: number; end: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const start = now.getTime() - (i + 1) * 7 * dayMs;
      const end = now.getTime() - i * 7 * dayMs;
      weeks30.push({ label: `Tuần ${4 - i}`, start, end });
    }
    const rev30d = weeks30.map((w) =>
      orders
        .filter((o) => {
          const t = new Date(o.created_at).getTime();
          return t >= w.start && t < w.end && isPaidStatus(o.status);
        })
        .reduce((sum, o) => sum + Number(o.price || 0), 0)
    );
    const ord30d = weeks30.map((w) =>
      orders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= w.start && t < w.end;
      }).length
    );
    const completedOrd30d = weeks30.map((w) =>
      orders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= w.start && t < w.end && isPaidStatus(o.status);
      }).length
    );

    // 90d Chart (3 tháng - 6 mốc 15 ngày)
    const points90: { label: string; start: number; end: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = now.getTime() - (i + 1) * 15 * dayMs;
      const end = now.getTime() - i * 15 * dayMs;
      const d = new Date(start);
      points90.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, start, end });
    }
    const rev90d = points90.map((p) =>
      orders
        .filter((o) => {
          const t = new Date(o.created_at).getTime();
          return t >= p.start && t < p.end && isPaidStatus(o.status);
        })
        .reduce((sum, o) => sum + Number(o.price || 0), 0)
    );
    const ord90d = points90.map((p) =>
      orders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= p.start && t < p.end;
      }).length
    );
    const completedOrd90d = points90.map((p) =>
      orders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= p.start && t < p.end && isPaidStatus(o.status);
      }).length
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
    const rev12m = months12.map((m) =>
      orders
        .filter((o) => {
          const d = new Date(o.created_at);
          return d.getFullYear() === m.year && d.getMonth() === m.month && isPaidStatus(o.status);
        })
        .reduce((sum, o) => sum + Number(o.price || 0), 0)
    );
    const ord12m = months12.map((m) =>
      orders.filter((o) => {
        const d = new Date(o.created_at);
        return d.getFullYear() === m.year && d.getMonth() === m.month;
      }).length
    );
    const completedOrd12m = months12.map((m) =>
      orders.filter((o) => {
        const d = new Date(o.created_at);
        return d.getFullYear() === m.year && d.getMonth() === m.month && isPaidStatus(o.status);
      }).length
    );

    setChartRevenueData({
      '7d': { labels: days7.map((d) => d.label), values: rev7d },
      '30d': { labels: weeks30.map((w) => w.label), values: rev30d },
      '90d': { labels: points90.map((p) => p.label), values: rev90d },
      '12m': { labels: months12.map((m) => m.label), values: rev12m },
    });

    setChartOrdersData({
      '7d': { labels: days7.map((d) => d.label), values: ord7d, completedValues: completedOrd7d },
      '30d': { labels: weeks30.map((w) => w.label), values: ord30d, completedValues: completedOrd30d },
      '90d': { labels: points90.map((p) => p.label), values: ord90d, completedValues: completedOrd90d },
      '12m': { labels: months12.map((m) => m.label), values: ord12m, completedValues: completedOrd12m },
    });
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Targeted handler: khi có order mới (INSERT)
  const handleOrderInsert = useCallback((e: { payload: OrderRow }) => {
    const o = e.payload;
    setRawOrders((prev) => {
      if (prev.some((r) => r.id === o.id)) return prev;
      return [o, ...prev];
    });
    setRecentOrders((prev) => {
      if (prev.some((r) => r.id === o.id)) return prev;
      return [o, ...prev].slice(0, 5);
    });
    if (o.status === 'pending_delivery' || o.status === 'processing') {
      setActionHub((prev) => ({ ...prev, pendingDelivery: prev.pendingDelivery + 1 }));
    }
  }, []);

  // Targeted handler: khi order thay đổi trạng thái
  const handleOrderUpdate = useCallback((e: { payload: OrderRow }) => {
    const o = e.payload;
    setRawOrders((prev) => {
      const updated = prev.map((r) => (r.id === o.id ? { ...r, ...o } : r));
      const nowMs = Date.now();
      const pd = updated.filter((r) => r.status === 'pending_delivery' || r.status === 'processing').length;
      const es = updated.filter((r) => {
        if (r.status !== 'completed' || !r.expires_at) return false;
        const diffDays = (new Date(r.expires_at).getTime() - nowMs) / (24 * 60 * 60 * 1000);
        return diffDays > 0 && diffDays <= 3;
      }).length;
      setActionHub((ac) => ({ ...ac, pendingDelivery: pd, expiringSoon: es }));
      return updated;
    });
    setRecentOrders((prev) => prev.map((r) => (r.id === o.id ? { ...r, ...o } : r)));
  }, []);

  const refreshTicketCount = useCallback(async () => {
    try {
      const { data } = await (supabase.from('support_tickets').select('id, status, created_at').order('created_at', { ascending: true }) as any);
      if (data) {
        const pendingList = (data || []).filter(
          (t: any) => t.status === 'pending' || t.status === 'processing'
        );
        setActionHub((prev) => ({
          ...prev,
          pendingTickets: pendingList.length,
          oldestTicketWait: pendingList.length > 0 ? formatRelativeTime(pendingList[0].created_at) : '',
        }));
      }
    } catch (err) {
      console.error('Error refreshing ticket count:', err);
    }
  }, []);

  const refreshReviewCount = useCallback(async () => {
    try {
      const { data } = await (supabase.from('product_reviews').select('id').eq('status', 'pending') as any);
      if (data) {
        setActionHub((prev) => ({ ...prev, pendingReviews: data.length }));
      }
    } catch (err) {
      console.error('Error refreshing review count:', err);
    }
  }, []);

  useRealtimeEvent('orders:INSERT', handleOrderInsert as any);
  useRealtimeEvent('orders:UPDATE', handleOrderUpdate as any);
  useRealtimeEvent('support_tickets:INSERT', refreshTicketCount);
  useRealtimeEvent('support_tickets:UPDATE', refreshTicketCount);
  useRealtimeEvent('product_reviews:INSERT', refreshReviewCount);
  useRealtimeEvent('product_reviews:UPDATE', refreshReviewCount);

  // Filtered Analytics per activeRange
  const rangeMetrics = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    let limitMs = 7 * dayMs;
    if (activeRange === '30d') limitMs = 30 * dayMs;
    if (activeRange === '90d') limitMs = 90 * dayMs;
    if (activeRange === '12m') limitMs = 365 * dayMs;

    const currentPeriodOrders = rawOrders.filter((o) => now - new Date(o.created_at).getTime() <= limitMs);
    const previousPeriodOrders = rawOrders.filter((o) => {
      const diff = now - new Date(o.created_at).getTime();
      return diff > limitMs && diff <= 2 * limitMs;
    });

    const currentPaid = currentPeriodOrders.filter((o) => isPaidStatus(o.status));
    const previousPaid = previousPeriodOrders.filter((o) => isPaidStatus(o.status));

    const currentRevenue = currentPaid.reduce((sum, o) => sum + Number(o.price || 0), 0);
    const previousRevenue = previousPaid.reduce((sum, o) => sum + Number(o.price || 0), 0);

    // Revenue % change
    let revenueChangeText = '0.0%';
    let isRevenuePos = true;
    if (previousRevenue === 0) {
      revenueChangeText = currentRevenue > 0 ? '+100%' : '0.0%';
      isRevenuePos = true;
    } else {
      const pct = ((currentRevenue - previousRevenue) / previousRevenue) * 100;
      isRevenuePos = pct >= 0;
      revenueChangeText = `${isRevenuePos ? '+' : ''}${pct.toFixed(1)}%`;
    }

    // Orders count & AOV & breakdown
    const totalOrdersCount = currentPeriodOrders.length;
    const completedOrdersCount = currentPaid.length;
    const cancelledCount = currentPeriodOrders.filter((o) => o.status === 'cancelled').length;
    const refundedCount = currentPeriodOrders.filter((o) => o.status === 'refunded').length;
    const pendingPaymentCount = currentPeriodOrders.filter(
      (o) => o.status === 'pending_payment' || o.status === 'pending'
    ).length;

    const completedPct = totalOrdersCount > 0 ? (completedOrdersCount / totalOrdersCount) * 100 : 0;
    const cancelledPct = totalOrdersCount > 0 ? (cancelledCount / totalOrdersCount) * 100 : 0;
    const refundedPct = totalOrdersCount > 0 ? (refundedCount / totalOrdersCount) * 100 : 0;
    const pendingPct = totalOrdersCount > 0 ? (pendingPaymentCount / totalOrdersCount) * 100 : 0;

    const aov = completedOrdersCount > 0 ? Math.round(currentRevenue / completedOrdersCount) : 0;
    const successRate = totalOrdersCount > 0 ? Math.round((completedOrdersCount / totalOrdersCount) * 100) : 0;

    return {
      currentOrders: currentPeriodOrders,
      currentRevenue,
      revenueChangeText,
      isRevenuePos,
      totalOrdersCount,
      completedOrdersCount,
      cancelledCount,
      refundedCount,
      pendingPaymentCount,
      completedPct,
      cancelledPct,
      refundedPct,
      pendingPct,
      aov,
      successRate,
    };
  }, [rawOrders, activeRange]);

  // Top 5 Products in Range
  const rangeTopProducts = useMemo<TopProductStat[]>(() => {
    const paidInRange = rangeMetrics.currentOrders.filter(
      (o) => isPaidStatus(o.status) && o.product_name && !o.product_name.includes('Nạp tiền')
    );
    const totalSalesCount = paidInRange.length;

    const map = new Map<string, { salesCount: number; revenue: number }>();
    paidInRange.forEach((o) => {
      const pName = o.product_name!;
      const curr = map.get(pName) || { salesCount: 0, revenue: 0 };
      map.set(pName, {
        salesCount: curr.salesCount + (Number(o.price) > 0 ? 1 : 1),
        revenue: curr.revenue + Number(o.price || 0),
      });
    });

    return Array.from(map.entries())
      .map(([name, stat]) => ({
        name,
        salesCount: stat.salesCount,
        revenue: stat.revenue,
        percentage: totalSalesCount > 0 ? Math.round((stat.salesCount / totalSalesCount) * 100) : 0,
      }))
      .sort((a, b) => b.salesCount - a.salesCount || b.revenue - a.revenue)
      .slice(0, 5);
  }, [rangeMetrics]);

  // Category Distribution & Donut Chart calculation
  const categoryDistribution = useMemo(() => {
    const paidInRange = rangeMetrics.currentOrders.filter(
      (o) => isPaidStatus(o.status) && o.product_name && !o.product_name.includes('Nạp tiền')
    );
    const totalPaidRev = paidInRange.reduce((sum, o) => sum + Number(o.price || 0), 0);

    let aiToolsCount = 0;
    let aiToolsRev = 0;
    let appsCount = 0;
    let appsRev = 0;
    let storageCount = 0;
    let storageRev = 0;

    const aiKeywords = ['claude', 'chatgpt', 'cursor', 'codex', 'leonardo', 'veo', 'gemini', 'grok', 'kling', 'perplexity'];
    const storageKeywords = ['icloud', 'google one', 'onedrive', 'storage', 'proton', 'microsoft 365'];

    paidInRange.forEach((o) => {
      const pNameLower = (o.product_name || '').toLowerCase();
      const price = Number(o.price || 0);

      if (aiKeywords.some((k) => pNameLower.includes(k)) || pNameLower.includes('ai')) {
        aiToolsCount++;
        aiToolsRev += price;
      } else if (storageKeywords.some((k) => pNameLower.includes(k))) {
        storageCount++;
        storageRev += price;
      } else {
        appsCount++;
        appsRev += price;
      }
    });

    const aiPct = totalPaidRev > 0 ? Math.round((aiToolsRev / totalPaidRev) * 100) : 0;
    const storagePct = totalPaidRev > 0 ? Math.round((storageRev / totalPaidRev) * 100) : 0;
    const appsPct = totalPaidRev > 0 ? Math.max(0, 100 - aiPct - storagePct) : 0;

    return {
      totalPaidRev,
      items: [
        {
          name: 'AI Tools',
          icon: '🤖',
          color: '#3B82F6', // Blue
          count: aiToolsCount,
          revenue: aiToolsRev,
          percentage: aiPct,
        },
        {
          name: 'Premium Apps',
          icon: '📱',
          color: '#8B5CF6', // Purple
          count: appsCount,
          revenue: appsRev,
          percentage: appsPct,
        },
        {
          name: 'Storage & Cloud',
          icon: '☁️',
          color: '#10B981', // Emerald
          count: storageCount,
          revenue: storageRev,
          percentage: storagePct,
        },
      ],
    };
  }, [rangeMetrics]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return (
          <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/30 px-2.5 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-400 border border-amber-200/70 dark:border-amber-900/40">
            Chờ thanh toán
          </span>
        );
      case 'pending_delivery':
      case 'processing':
        return (
          <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/30 px-2.5 py-0.5 text-[10px] font-black text-[#2563EB] dark:text-[#35A8FF] border border-blue-200/70 dark:border-blue-900/40">
            Chờ bàn giao
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-900/40">
            Hoàn tất
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center rounded-full bg-rose-50 dark:bg-rose-950/30 px-2.5 py-0.5 text-[10px] font-black text-rose-700 dark:text-rose-400 border border-rose-200/70 dark:border-rose-900/40">
            Đã hủy
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-black text-slate-600 dark:text-slate-400 border border-slate-200/70 dark:border-slate-700">
            Đã hoàn tiền
          </span>
        );
      default:
        return null;
    }
  };

  // Area Chart Calculations with Y-Axis & Smooth Spline
  const activeChartData = metricView === 'revenue' ? chartRevenueData[activeRange] : chartOrdersData[activeRange];
  const chartValues = activeChartData?.values?.length ? activeChartData.values : [0];
  const completedChartValues = activeChartData?.completedValues?.length ? activeChartData.completedValues : chartValues.map(() => 0);
  const rawMax = Math.max(...chartValues, ...(metricView === 'orders' ? completedChartValues : []));
  const maxVal = rawMax > 0 ? rawMax : (metricView === 'revenue' ? 100000 : 5);

  const chartHeight = 165;
  const chartWidth = 540;
  const padLeft = 40;
  const padRight = 16;
  const topY = 16;
  const bottomY = chartHeight - 20;
  const midY = topY + (bottomY - topY) / 2;
  const plotWidth = chartWidth - padLeft - padRight;
  const plotHeight = bottomY - topY;

  const rawPointObjs = chartValues.map((v, i) => {
    const count = Math.max(chartValues.length, 1);
    const x = padLeft + (count > 1 ? (i / (count - 1)) * plotWidth : plotWidth / 2);
    const y = bottomY - (v / maxVal) * plotHeight;
    return { x, y };
  });

  const completedRawPointObjs = completedChartValues.map((v, i) => {
    const count = Math.max(completedChartValues.length, 1);
    const x = padLeft + (count > 1 ? (i / (count - 1)) * plotWidth : plotWidth / 2);
    const y = bottomY - (v / maxVal) * plotHeight;
    return { x, y };
  });

  const points = rawPointObjs.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`);
  const completedPoints = completedRawPointObjs.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`);

  // Straight crisp polyline path (Direct & Highly Accurate)
  const pathD = points.length > 0 ? `M ${points.join(' L ')}` : '';
  const lastX = rawPointObjs[rawPointObjs.length - 1]?.x || chartWidth - padRight;
  const firstX = rawPointObjs[0]?.x || padLeft;
  const areaD = pathD ? `${pathD} L ${lastX.toFixed(1)},${bottomY} L ${firstX.toFixed(1)},${bottomY} Z` : '';

  const completedPathD = completedPoints.length > 0 ? `M ${completedPoints.join(' L ')}` : '';
  const completedAreaD = completedPathD ? `${completedPathD} L ${lastX.toFixed(1)},${bottomY} L ${firstX.toFixed(1)},${bottomY} Z` : '';

  const formatYAxis = (val: number) => {
    if (metricView === 'revenue') {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${Math.round(val / 1000)}k`;
      return `${val}đ`;
    }
    return Number.isInteger(val) ? `${val}` : val.toFixed(1);
  };

  const totalUrgentActions = actionHub.pendingTickets + actionHub.pendingDelivery + actionHub.expiringSoon + actionHub.pendingReviews;

  const rangeLabelMap: Record<RangeMode, string> = {
    '7d': '7 ngày',
    '30d': '30 ngày',
    '90d': '3 tháng',
    '12m': '12 tháng',
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-8 w-full max-w-full overflow-x-hidden">
      {/* 🧭 HEADER & GLOBAL FILTER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Tổng Quan Điều Hành Tác Chiến
            </h1>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1">
            Theo dõi dòng tiền, tiếp nhận xử lý đơn hàng khẩn cấp và giám sát hệ thống.
          </p>
        </div>

        {/* Global Time Filter (Mobile-first full scrollable / Desktop compact) */}
        <div className="flex items-center justify-between sm:justify-start gap-1 bg-white dark:bg-[#131C32] p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A]/50 shadow-2xs w-full sm:w-auto overflow-x-auto no-scrollbar scrollbar-none">
          <span className="text-[9.5px] sm:text-[10px] font-black uppercase text-slate-400 px-1.5 sm:px-2 shrink-0">Kỳ xem:</span>
          {(['7d', '30d', '90d', '12m'] as RangeMode[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setActiveRange(r)}
              className={`rounded-lg sm:rounded-xl px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap flex-1 sm:flex-initial text-center ${activeRange === r
                ? 'bg-gradient-to-r from-[#00A3FF] to-[#2563EB] text-white shadow-xs font-black'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
            >
              {rangeLabelMap[r]}
            </button>
          ))}
        </div>
      </div>

      {/* 1️⃣ SINGLE KPI BAR (Gom 1 Hàng Thống Kê Duy Nhất) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        {/* Card 1: Doanh thu trong kỳ */}
        <div className="rounded-[18px] sm:rounded-[22px] border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] p-3 sm:p-4 shadow-xs hover:border-[#2563EB]/40 dark:hover:border-[#35A8FF]/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-800/40 flex items-center justify-center text-xs sm:text-sm shrink-0">
                💰
              </span>
              <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Doanh thu
              </span>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black shrink-0 ${rangeMetrics.isRevenuePos
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50'
                }`}
            >
              {rangeMetrics.revenueChangeText}
            </span>
          </div>

          <div className="mt-2.5 sm:mt-3">
            <span className="text-base sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight block truncate">
              {loading ? (
                <span className="inline-block h-6 sm:h-7 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              ) : (
                `${rangeMetrics.currentRevenue.toLocaleString('vi-VN')}đ`
              )}
            </span>
            <span className="text-[9.5px] sm:text-[10px] text-slate-400 font-semibold block mt-0.5 sm:mt-1 truncate">
              Trong {rangeLabelMap[activeRange]} qua
            </span>
          </div>
        </div>

        {/* Card 2: Tổng đơn hàng + Order Health Breakdown + Drill-down (Ý tưởng 1 & 4) */}
        <div className="rounded-[18px] sm:rounded-[22px] border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] p-3 sm:p-4 shadow-xs hover:border-[#2563EB]/40 dark:hover:border-[#35A8FF]/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/50 dark:border-purple-800/40 flex items-center justify-center text-xs sm:text-sm shrink-0">
                📦
              </span>
              <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Tổng đơn tạo
              </span>
            </div>
            <Link
              to="/admin/orders?status=completed"
              title="Bấm xem các đơn đã hoàn tất"
              className="inline-flex items-center rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black border border-purple-200/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition cursor-pointer shrink-0 whitespace-nowrap"
            >
              {rangeMetrics.completedOrdersCount} xong ↗
            </Link>
          </div>

          <div className="mt-2.5 sm:mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-base sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight block truncate">
                {loading ? (
                  <span className="inline-block h-6 sm:h-7 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                ) : (
                  `${rangeMetrics.totalOrdersCount} đơn`
                )}
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-semibold truncate ml-1">
                {rangeLabelMap[activeRange]}
              </span>
            </div>

            {/* Mini Health Multi-Bar */}
            <div className="mt-2 sm:mt-2.5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
              {rangeMetrics.totalOrdersCount === 0 ? (
                <div className="h-full w-full bg-slate-200 dark:bg-slate-700 opacity-40" />
              ) : (
                <>
                  {rangeMetrics.completedPct > 0 && (
                    <div
                      style={{ width: `${rangeMetrics.completedPct}%` }}
                      className="h-full bg-emerald-500 transition-all duration-500"
                      title={`Đã xong: ${rangeMetrics.completedOrdersCount} đơn`}
                    />
                  )}
                  {rangeMetrics.pendingPct > 0 && (
                    <div
                      style={{ width: `${rangeMetrics.pendingPct}%` }}
                      className="h-full bg-amber-400 transition-all duration-500"
                      title={`Chờ thanh toán: ${rangeMetrics.pendingPaymentCount} đơn`}
                    />
                  )}
                  {rangeMetrics.cancelledPct > 0 && (
                    <div
                      style={{ width: `${rangeMetrics.cancelledPct}%` }}
                      className="h-full bg-rose-500 transition-all duration-500"
                      title={`Đã hủy: ${rangeMetrics.cancelledCount} đơn`}
                    />
                  )}
                  {rangeMetrics.refundedPct > 0 && (
                    <div
                      style={{ width: `${rangeMetrics.refundedPct}%` }}
                      className="h-full bg-purple-500 transition-all duration-500"
                      title={`Hoàn tiền: ${rangeMetrics.refundedCount} đơn`}
                    />
                  )}
                </>
              )}
            </div>

            {/* Breakdown Status Pills with Drill-down Links */}
            <div className="mt-1.5 sm:mt-2 flex items-center justify-between text-[9.5px] sm:text-[10.5px] font-bold">
              <Link
                to="/admin/orders?status=completed"
                className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                title="Xem đơn đã hoàn tất"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                {rangeMetrics.completedOrdersCount} xong
              </Link>
              <Link
                to="/admin/orders?status=cancelled"
                className="flex items-center gap-1 text-rose-500 dark:text-rose-400 hover:underline cursor-pointer"
                title="Xem đơn đã hủy"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                {rangeMetrics.cancelledCount} hủy
              </Link>
              <Link
                to="/admin/orders?status=refunded"
                className="flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                title="Xem đơn đã hoàn tiền"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
                {rangeMetrics.refundedCount} hoàn
              </Link>
            </div>
          </div>
        </div>

        {/* Card 3: AOV (Giá trị TB/Đơn) */}
        <div className="rounded-[18px] sm:rounded-[22px] border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] p-3 sm:p-4 shadow-xs hover:border-[#2563EB]/40 dark:hover:border-[#35A8FF]/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/40 flex items-center justify-center text-xs sm:text-sm shrink-0">
                🎯
              </span>
              <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Giá trị TB/Đơn
              </span>
            </div>
          </div>

          <div className="mt-2.5 sm:mt-3">
            <span className="text-base sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight block truncate">
              {loading ? (
                <span className="inline-block h-6 sm:h-7 w-20 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              ) : rangeMetrics.completedOrdersCount === 0 || rangeMetrics.currentRevenue === 0 ? (
                <span className="text-slate-400 dark:text-slate-500 font-bold">—</span>
              ) : (
                `${rangeMetrics.aov.toLocaleString('vi-VN')}đ`
              )}
            </span>
            <span className="text-[9.5px] sm:text-[10px] text-slate-400 font-semibold block mt-0.5 sm:mt-1 truncate">
              {rangeMetrics.completedOrdersCount > 0
                ? `TB ${rangeMetrics.completedOrdersCount} đơn xong`
                : 'Chưa có đơn xong'}
            </span>
          </div>
        </div>

        {/* Card 4: Tỷ lệ thành công & Phễu vận hành (Ý tưởng 3) */}
        <div className="rounded-[18px] sm:rounded-[22px] border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] p-3 sm:p-4 shadow-xs hover:border-[#2563EB]/40 dark:hover:border-[#35A8FF]/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-800/40 flex items-center justify-center text-xs sm:text-sm shrink-0">
                ⚡
              </span>
              <span className="text-[10px] sm:text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                Tỷ lệ thành công
              </span>
            </div>
            {rangeMetrics.totalOrdersCount === 0 ? (
              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold border border-slate-200/70 dark:border-slate-700 shrink-0">
                Chưa có đơn
              </span>
            ) : rangeMetrics.successRate >= 90 ? (
              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black border border-emerald-200/50 shrink-0">
                Tốt
              </span>
            ) : rangeMetrics.successRate >= 70 ? (
              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black border border-blue-200/50 shrink-0">
                Khá
              </span>
            ) : rangeMetrics.successRate > 0 ? (
              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black border border-amber-200/50 shrink-0">
                Cần cải thiện
              </span>
            ) : (
              <span className="inline-flex items-center whitespace-nowrap rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black border border-rose-200/50 shrink-0">
                Lưu ý
              </span>
            )}
          </div>

          <div className="mt-2.5 sm:mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-base sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight block truncate">
                {loading ? (
                  <span className="inline-block h-6 sm:h-7 w-16 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                ) : (
                  `${rangeMetrics.successRate}%`
                )}
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-semibold truncate ml-1">
                {rangeMetrics.completedOrdersCount}/{rangeMetrics.totalOrdersCount} xong
              </span>
            </div>

            {/* Funnel Sub-Metrics */}
            <div className="mt-2 sm:mt-2.5 pt-1.5 sm:pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[9.5px] sm:text-[10.5px] font-bold">
              <span className="text-slate-500 dark:text-slate-400 truncate">
                🔄 Hoàn:{' '}
                <strong className={rangeMetrics.refundedPct > 5 ? 'text-purple-600 dark:text-purple-400' : 'text-slate-700 dark:text-slate-300'}>
                  {rangeMetrics.refundedPct.toFixed(0)}%
                </strong>
              </span>
              <span className="text-slate-500 dark:text-slate-400 truncate">
                🔴 Hủy:{' '}
                <strong className={rangeMetrics.cancelledPct > 50 ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}>
                  {rangeMetrics.cancelledPct.toFixed(0)}%
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2️⃣ KHỐI PHÂN TÍCH: TỈ LỆ 7:3 (REVENUE CHART & IMMEDIATE ACTIONS) */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-12">
        {/* Cột trái (70% - 8 Cols): Area Chart Doanh thu & Đơn hàng (Ý tưởng 2: Dual Metric Chart) */}
        <div className="lg:col-span-8 rounded-[20px] sm:rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
            <div className="space-y-1">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                <span>📈</span> BIỂU ĐỒ DÒNG TIỀN & ĐƠN HÀNG
              </h3>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10.5px] sm:text-[11px] text-slate-400 font-semibold">
                <span>
                  Xu hướng {metricView === 'revenue' ? 'doanh thu thực tế' : 'số lượng đơn'} ({rangeLabelMap[activeRange]}).
                </span>
                {metricView === 'orders' && (
                  <div className="inline-flex items-center gap-2 text-[9.5px] sm:text-[10px] font-bold bg-slate-50 dark:bg-slate-800/80 px-2 sm:px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-slate-700/60 whitespace-nowrap shrink-0">
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" />
                      {rangeMetrics.totalOrdersCount} đơn tạo
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                      {rangeMetrics.completedOrdersCount} đã xong
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Metric View Toggle - ALWAYS FIXED AT TOP RIGHT */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 sm:p-1 rounded-xl shrink-0 self-start sm:self-auto ml-auto">
              <button
                type="button"
                onClick={() => setMetricView('revenue')}
                className={`rounded-lg px-2 sm:px-2.5 py-1 text-[10.5px] sm:text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${metricView === 'revenue'
                  ? 'bg-white dark:bg-[#131C32] text-[#2563EB] dark:text-[#35A8FF] shadow-xs font-black'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
              >
                💰 Doanh thu (₫)
              </button>
              <button
                type="button"
                onClick={() => setMetricView('orders')}
                className={`rounded-lg px-2 sm:px-2.5 py-1 text-[10.5px] sm:text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${metricView === 'orders'
                  ? 'bg-white dark:bg-[#131C32] text-[#2563EB] dark:text-[#35A8FF] shadow-xs font-black'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
              >
                📦 Số lượng đơn
              </button>
            </div>
          </div>

          {/* Area Chart SVG */}
          <div className="mt-4 w-full h-[180px] relative overflow-hidden" onMouseLeave={() => setHoveredIdx(null)}>
            <svg className="w-full h-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id="cockpitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={metricView === 'revenue' ? '#00A3FF' : '#3B82F6'} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={metricView === 'revenue' ? '#2563EB' : '#1D4ED8'} stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="completedOrdersGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Y-Axis Text Labels */}
              <text x={padLeft - 6} y={topY + 3} fill="#94A3B8" fontSize="8.5" fontWeight="700" textAnchor="end" className="dark:fill-slate-500 font-mono">
                {formatYAxis(maxVal)}
              </text>
              <text x={padLeft - 6} y={midY + 3} fill="#94A3B8" fontSize="8.5" fontWeight="700" textAnchor="end" className="dark:fill-slate-500 font-mono">
                {formatYAxis(maxVal / 2)}
              </text>
              <text x={padLeft - 6} y={bottomY + 3} fill="#94A3B8" fontSize="8.5" fontWeight="700" textAnchor="end" className="dark:fill-slate-500 font-mono">
                0
              </text>

              {/* Grid Lines */}
              <line x1={padLeft} y1={topY} x2={chartWidth - padRight} y2={topY} stroke="#E8F1FF" strokeWidth={1} className="dark:stroke-slate-800/40" strokeDasharray="3 3" />
              <line x1={padLeft} y1={midY} x2={chartWidth - padRight} y2={midY} stroke="#E8F1FF" strokeWidth={1} className="dark:stroke-slate-800/40" strokeDasharray="3 3" />
              <line x1={padLeft} y1={bottomY} x2={chartWidth - padRight} y2={bottomY} stroke="#E8F1FF" strokeWidth={1} className="dark:stroke-slate-800/60" />

              {/* Area Fills */}
              <path d={areaD} fill="url(#cockpitGradient)" />
              {metricView === 'orders' && completedAreaD && (
                <path d={completedAreaD} fill="url(#completedOrdersGradient)" />
              )}

              {/* Primary Line (Smooth Spline) */}
              <path
                d={pathD}
                fill="none"
                stroke={metricView === 'revenue' ? '#2563EB' : '#3B82F6'}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Secondary Line for Completed Orders (Dual Metric Spline) */}
              {metricView === 'orders' && completedPathD && (
                <path
                  d={completedPathD}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Primary Nodes */}
              {points.map((p, idx) => {
                const [x, y] = p.split(',').map(Number);
                const isHovered = hoveredIdx === idx;
                return (
                  <g key={`primary-${idx}`} className="cursor-pointer">
                    {/* Invisible larger hover zone */}
                    <circle
                      cx={x}
                      cy={y}
                      r={14}
                      fill="transparent"
                      onMouseEnter={() => setHoveredIdx(idx)}
                    />
                    {/* Visual node */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 5.5 : 3.5}
                      fill={isHovered ? (metricView === 'revenue' ? '#2563EB' : '#3B82F6') : '#FFFFFF'}
                      stroke={metricView === 'revenue' ? '#2563EB' : '#3B82F6'}
                      strokeWidth={isHovered ? 2.5 : 2}
                      className="transition-all duration-150"
                    />
                  </g>
                );
              })}

              {/* Secondary Nodes (Completed Orders) */}
              {metricView === 'orders' && completedPoints.map((p, idx) => {
                const [x, y] = p.split(',').map(Number);
                const isHovered = hoveredIdx === idx;
                return (
                  <g key={`completed-${idx}`} className="cursor-pointer">
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 5.5 : 3.5}
                      fill={isHovered ? '#10B981' : '#FFFFFF'}
                      stroke="#10B981"
                      strokeWidth={isHovered ? 2.5 : 2}
                      className="transition-all duration-150"
                    />
                  </g>
                );
              })}

              {/* Hover Tooltip in SVG */}
              {hoveredIdx !== null && points[hoveredIdx] && (
                (() => {
                  const [x, y] = points[hoveredIdx].split(',').map(Number);
                  const val = chartValues[hoveredIdx] || 0;
                  const completedVal = completedChartValues[hoveredIdx] || 0;
                  const label = activeChartData?.labels?.[hoveredIdx] || '';
                  const tooltipY = Math.max(22, y - 24);
                  const tooltipX = Math.min(Math.max(x, padLeft + 55), chartWidth - padRight - 55);

                  return (
                    <g className="pointer-events-none transition-all duration-150">
                      {/* Vertical dotted guide line */}
                      <line
                        x1={x}
                        y1={topY}
                        x2={x}
                        y2={bottomY}
                        stroke={metricView === 'revenue' ? '#2563EB' : '#3B82F6'}
                        strokeWidth={1.2}
                        strokeDasharray="3 3"
                        opacity={0.7}
                      />
                      {/* Tooltip background badge */}
                      <rect
                        x={tooltipX - 60}
                        y={tooltipY - (metricView === 'orders' ? 32 : 22)}
                        width={120}
                        height={metricView === 'orders' ? 44 : 28}
                        rx={8}
                        fill="#0F172A"
                        className="dark:fill-[#1E2A4A] shadow-md"
                      />
                      {/* Tooltip text */}
                      <text
                        x={tooltipX}
                        y={tooltipY - (metricView === 'orders' ? 20 : 10)}
                        fill="#94A3B8"
                        fontSize="9"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {label}
                      </text>
                      {metricView === 'revenue' ? (
                        <text
                          x={tooltipX}
                          y={tooltipY + 2}
                          fill="#FFFFFF"
                          fontSize="10"
                          fontWeight="900"
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          {`${val.toLocaleString('vi-VN')}đ`}
                        </text>
                      ) : (
                        <>
                          <text
                            x={tooltipX}
                            y={tooltipY - 6}
                            fill="#60A5FA"
                            fontSize="9.5"
                            fontWeight="800"
                            textAnchor="middle"
                            fontFamily="monospace"
                          >
                            🔵 Đơn tạo: {val}
                          </text>
                          <text
                            x={tooltipX}
                            y={tooltipY + 6}
                            fill="#34D399"
                            fontSize="9.5"
                            fontWeight="800"
                            textAnchor="middle"
                            fontFamily="monospace"
                          >
                            🟢 Đã xong: {completedVal}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })()
              )}
            </svg>
          </div>

          <div
            className="flex justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2.5 sm:pt-3 text-[9px] sm:text-[10px] text-slate-400 font-bold overflow-hidden"
            style={{ paddingLeft: `${padLeft}px`, paddingRight: `${padRight}px` }}
          >
            {activeChartData?.labels?.map((lbl, idx) => (
              <span
                key={idx}
                className={`transition-colors ${hoveredIdx === idx ? 'text-[#2563EB] dark:text-[#35A8FF] font-black scale-105' : ''}`}
              >
                {lbl}
              </span>
            ))}
          </div>
        </div>

        {/* Cột phải (30% - 4 Cols): Hub "Cần xử lý ngay" (Immediate Action Center) */}
        <div className="lg:col-span-4 rounded-[20px] sm:rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  {totalUrgentActions > 0 && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  )}
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${totalUrgentActions > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                </span>
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  CẦN XỬ LÝ NGAY
                </h3>
              </div>
              {totalUrgentActions > 0 ? (
                <span className="inline-flex items-center rounded-full bg-rose-50 dark:bg-rose-950/40 px-2 sm:px-2.5 py-0.5 text-[9.5px] sm:text-[10px] font-black text-rose-600 dark:text-rose-400 border border-rose-200/50">
                  {totalUrgentActions} việc gấp
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 sm:px-2.5 py-0.5 text-[9.5px] sm:text-[10px] font-black text-emerald-600 dark:text-emerald-400 border border-emerald-200/50">
                  Đã sạch việc
                </span>
              )}
            </div>

            {/* List of High-Priority Badges */}
            <div className="mt-3 sm:mt-3.5 space-y-2 sm:space-y-2.5">
              {/* 🔴 Ticket chờ hỗ trợ */}
              <Link
                to="/admin/tickets?status=pending"
                className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-rose-100 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100/60 dark:hover:bg-rose-950/40 transition group shadow-2xs"
              >
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-rose-500 text-white flex items-center justify-center text-xs sm:text-sm font-bold shadow-rose-500/20 shrink-0">
                    🎫
                  </span>
                  <div className="min-w-0">
                    <span className="text-[11.5px] sm:text-xs font-bold text-slate-900 dark:text-slate-100 block truncate">
                      Ticket chờ phản hồi
                    </span>
                    <span className="text-[9.5px] sm:text-[10px] text-rose-600 dark:text-rose-400 font-semibold block truncate">
                      {actionHub.pendingTickets > 0
                        ? `Lâu nhất: ${actionHub.oldestTicketWait}`
                        : 'Không có ticket chờ'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] sm:text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded-lg">
                    {actionHub.pendingTickets}
                  </span>
                  <span className="text-slate-400 group-hover:translate-x-1 transition-transform text-xs">›</span>
                </div>
              </Link>

              {/* 🟡 Đơn hàng chờ bàn giao */}
              <Link
                to="/admin/orders?status=pending_delivery"
                className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 transition group shadow-2xs"
              >
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-amber-500 text-white flex items-center justify-center text-xs sm:text-sm font-bold shadow-amber-500/20 shrink-0">
                    📦
                  </span>
                  <div className="min-w-0">
                    <span className="text-[11.5px] sm:text-xs font-bold text-slate-900 dark:text-slate-100 block truncate">
                      Đơn chờ bàn giao account
                    </span>
                    <span className="text-[9.5px] sm:text-[10px] text-amber-600 dark:text-amber-400 font-semibold block truncate">
                      Cần cấp tài khoản cho khách
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] sm:text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-lg">
                    {actionHub.pendingDelivery}
                  </span>
                  <span className="text-slate-400 group-hover:translate-x-1 transition-transform text-xs">›</span>
                </div>
              </Link>

              {/* ⏰ Đơn sắp hết hạn (1-3 ngày) */}
              <Link
                to="/admin/orders?status=expiring_soon"
                className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/50 dark:bg-sky-950/20 hover:bg-sky-100/60 dark:hover:bg-sky-950/40 transition group shadow-2xs"
              >
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-sky-500 text-white flex items-center justify-center text-xs sm:text-sm font-bold shadow-sky-500/20 shrink-0">
                    ⏰
                  </span>
                  <div className="min-w-0">
                    <span className="text-[11.5px] sm:text-xs font-bold text-slate-900 dark:text-slate-100 block truncate">
                      Đơn sắp hết hạn (1-3 ngày)
                    </span>
                    <span className="text-[9.5px] sm:text-[10px] text-sky-600 dark:text-sky-400 font-semibold block truncate">
                      Nhắc khách gia hạn dịch vụ
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] sm:text-xs font-black text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 rounded-lg">
                    {actionHub.expiringSoon}
                  </span>
                  <span className="text-slate-400 group-hover:translate-x-1 transition-transform text-xs">›</span>
                </div>
              </Link>

              {/* ⭐ Đánh giá chờ duyệt */}
              <Link
                to="/admin/reviews?status=pending"
                className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-purple-100 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-100/60 dark:hover:bg-purple-950/40 transition group shadow-2xs"
              >
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-purple-500 text-white flex items-center justify-center text-xs sm:text-sm font-bold shadow-purple-500/20 shrink-0">
                    ⭐
                  </span>
                  <div className="min-w-0">
                    <span className="text-[11.5px] sm:text-xs font-bold text-slate-900 dark:text-slate-100 block truncate">
                      Review khách hàng mới
                    </span>
                    <span className="text-[9.5px] sm:text-[10px] text-purple-600 dark:text-purple-400 font-semibold block truncate">
                      Duyệt hiển thị sao thực tế
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] sm:text-xs font-black text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded-lg">
                    {actionHub.pendingReviews}
                  </span>
                  <span className="text-slate-400 group-hover:translate-x-1 transition-transform text-xs">›</span>
                </div>
              </Link>
            </div>
          </div>

          <div className="mt-2.5 sm:mt-3 text-center">
            <span className="text-[9.5px] sm:text-[10px] text-slate-400 font-semibold">
              Bấm vào từng mục để xử lý ngay tức thì
            </span>
          </div>
        </div>
      </div>

      {/* 3️⃣ KHỐI CHUYÊN SÂU: SẢN PHẨM & CƠ CẤU DOANH THU (GRID 5:5) */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-12">
        {/* Top Sản phẩm bán chạy (6 Cols - 50%) */}
        <div className="lg:col-span-6 rounded-[20px] sm:rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span>🏆</span> TOP SẢN PHẨM BÁN CHẠY
                </h3>
                <p className="text-[10.5px] sm:text-[11px] text-slate-400 font-semibold mt-0.5">
                  Top 5 sản phẩm đạt doanh số cao nhất ({rangeLabelMap[activeRange]}).
                </p>
              </div>
              <Link to="/admin/products" className="text-[10.5px] sm:text-[11px] font-bold text-[#2563EB] dark:text-[#35A8FF] hover:underline shrink-0 ml-2">
                Quản lý kho ›
              </Link>
            </div>

            {rangeTopProducts.length === 0 ? (
              /* Professional Empty State */
              <div className="py-8 sm:py-10 px-4 text-center flex flex-col items-center justify-center">
                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl sm:text-3xl mb-2 sm:mb-3 shadow-inner">
                  🛍️
                </div>
                <h4 className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Chưa có dữ liệu bán hàng trong {rangeLabelMap[activeRange]} qua
                </h4>
                <p className="text-[10.5px] sm:text-[11px] text-slate-400 max-w-xs mt-1 leading-relaxed">
                  Hãy thử đổi bộ lọc thời gian sang 30 ngày hoặc 12 tháng, hoặc đẩy mạnh chiến dịch khuyến mãi.
                </p>
              </div>
            ) : (
              <div className="mt-3.5 sm:mt-4 space-y-3 sm:space-y-3.5">
                {rangeTopProducts.map((p, idx) => (
                  <div key={p.name} className="space-y-1 sm:space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        <span
                          className={`h-5 w-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${idx === 0
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                            : idx === 1
                              ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                              : idx === 2
                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                        >
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 truncate text-[11px] sm:text-xs" title={p.name}>
                          {p.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 shrink-0 font-mono text-[10.5px] sm:text-[11px] ml-2">
                        <span className="text-slate-400 font-semibold">{p.salesCount} đơn</span>
                        <span className="font-extrabold text-[#2563EB] dark:text-[#35A8FF]">
                          {p.revenue.toLocaleString('vi-VN')}đ
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden flex">
                      <div
                        className="h-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(p.percentage, 4)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tỷ trọng Doanh thu Danh mục (Donut Chart) (6 Cols - 50%) */}
        <div className="lg:col-span-6 rounded-[20px] sm:rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-3.5 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
              <div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span>📊</span> TỶ TRỌNG DOANH THU DANH MỤC
                </h3>
                <p className="text-[10.5px] sm:text-[11px] text-slate-400 font-semibold mt-0.5">
                  Phân bổ dòng tiền theo các nhóm ngành hàng ({rangeLabelMap[activeRange]}).
                </p>
              </div>
            </div>

            {/* Donut Chart & Legend Container */}
            <div className="mt-3.5 sm:mt-4 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-4 sm:gap-6">
              {/* Donut Chart SVG */}
              <div className="relative w-36 h-36 sm:w-44 sm:h-44 shrink-0 mx-auto sm:mx-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background Circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="transparent"
                    stroke="#E2E8F0"
                    strokeWidth="11"
                    className="dark:stroke-slate-800"
                  />

                  {categoryDistribution.totalPaidRev === 0 ? (
                    /* Subtle Placeholder Ring when revenue is 0 */
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#94A3B8"
                      strokeWidth="3"
                      strokeDasharray="4 6"
                      className="opacity-40 dark:opacity-30"
                    />
                  ) : (
                    <>
                      {/* AI Tools Segment */}
                      {categoryDistribution.items[0].percentage > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke="#3B82F6"
                          strokeWidth="11"
                          strokeDasharray={`${(categoryDistribution.items[0].percentage * 238.76) / 100} 238.76`}
                          strokeDashoffset="0"
                          className="transition-all duration-700"
                        />
                      )}

                      {/* Premium Apps Segment */}
                      {categoryDistribution.items[1].percentage > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke="#8B5CF6"
                          strokeWidth="11"
                          strokeDasharray={`${(categoryDistribution.items[1].percentage * 238.76) / 100} 238.76`}
                          strokeDashoffset={`-${(categoryDistribution.items[0].percentage * 238.76) / 100}`}
                          className="transition-all duration-700"
                        />
                      )}

                      {/* Storage Segment */}
                      {categoryDistribution.items[2].percentage > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          fill="transparent"
                          stroke="#10B981"
                          strokeWidth="11"
                          strokeDasharray={`${(categoryDistribution.items[2].percentage * 238.76) / 100} 238.76`}
                          strokeDashoffset={`-${((categoryDistribution.items[0].percentage + categoryDistribution.items[1].percentage) * 238.76) / 100}`}
                          className="transition-all duration-700"
                        />
                      )}
                    </>
                  )}
                </svg>

                {/* Donut Center */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[9.5px] sm:text-[10px] font-black uppercase text-slate-400">
                    {categoryDistribution.totalPaidRev === 0 ? 'Dòng tiền' : 'Doanh thu'}
                  </span>
                  <span className="text-[11px] sm:text-xs font-black text-slate-900 dark:text-white mt-0.5">
                    {categoryDistribution.totalPaidRev === 0
                      ? '0đ'
                      : categoryDistribution.totalPaidRev >= 1000000
                        ? `${(categoryDistribution.totalPaidRev / 1000000).toFixed(1)}M`
                        : `${(categoryDistribution.totalPaidRev / 1000).toFixed(0)}k`}
                  </span>
                </div>
              </div>

              {/* Legend Badges */}
              <div className="flex-1 space-y-2 sm:space-y-2.5 w-full">
                {categoryDistribution.items.map((cat) => (
                  <div
                    key={cat.name}
                    className="flex items-center justify-between p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-[11px] sm:text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                        {cat.icon} {cat.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono shrink-0 ml-2">
                      <span className="text-slate-400 font-semibold">{cat.count} đơn</span>
                      <span className="font-black text-slate-900 dark:text-white">
                        {categoryDistribution.totalPaidRev > 0 ? `${cat.percentage}%` : '0đ'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4️⃣ DƯỚI CÙNG: ĐƠN HÀNG MỚI (60%) & NHẬT KÝ HỆ THỐNG (40%) */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-12">
        {/* Bảng Đơn hàng mới (7 Cols - 60%) */}
        <div className="lg:col-span-7 rounded-[20px] sm:rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-3.5 sm:p-5 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                ĐƠN HÀNG MỚI NHẤT
              </h3>
              <p className="text-[10.5px] sm:text-[11px] text-slate-400 font-semibold mt-0.5">
                Top 5 đơn hàng vừa được khởi tạo trên hệ thống.
              </p>
            </div>
            <Link
              to="/admin/orders"
              className="text-[11px] sm:text-xs font-extrabold text-[#2563EB] dark:text-[#35A8FF] hover:underline shrink-0 ml-2"
            >
              Quản lý tất cả đơn hàng →
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-8 sm:py-10 px-4 text-center flex flex-col items-center justify-center">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl sm:text-3xl mb-2 sm:mb-3 shadow-inner">
                📦
              </div>
              <h4 className="text-xs font-black text-slate-700 dark:text-slate-300">
                Chưa có đơn hàng nào
              </h4>
              <p className="text-[10.5px] sm:text-[11px] text-slate-400 max-w-xs mt-1 leading-relaxed">
                Đơn hàng mới từ khách hàng sẽ hiển thị tại đây theo thời gian thực.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Cards View (< 768px) */}
              <div className="md:hidden mt-3 space-y-2.5">
                {recentOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-extrabold text-xs text-slate-900 dark:text-white block truncate">
                          {ord.product_name || 'Sản phẩm'}
                        </span>
                        {ord.plan_label && (
                          <span className="text-[10px] text-slate-400 block truncate">
                            {ord.plan_label}
                          </span>
                        )}
                      </div>
                      <div className="shrink-0">{getStatusBadge(ord.status)}</div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100/80 dark:border-slate-800/50">
                      <div className="min-w-0">
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block truncate">
                          {ord.profiles?.full_name || 'Khách hàng'}
                        </span>
                        <span className="text-[9.5px] font-mono text-slate-400 block truncate">
                          #{ord.payment_code || ord.id.substring(0, 8)}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-black text-xs text-[#2563EB] dark:text-[#35A8FF] block">
                          {Number(ord.price || 0).toLocaleString('vi-VN')}đ
                        </span>
                        <span className="text-[9.5px] text-slate-400 font-mono">
                          {formatRelativeTime(ord.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table (>= 768px) */}
              <div className="hidden md:block mt-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-blue-400/40 dark:scrollbar-thumb-blue-500/40 scrollbar-track-slate-100 dark:scrollbar-track-slate-800/60">
                <table className="w-full min-w-[560px] text-left text-xs font-semibold">
                  <thead>
                    <tr className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800/50">
                      <th className="py-2.5 px-2">Sản phẩm</th>
                      <th className="py-2.5 px-2">Khách hàng</th>
                      <th className="py-2.5 px-2">Giá tiền</th>
                      <th className="py-2.5 px-2 text-center">Trạng thái</th>
                      <th className="py-2.5 px-2 text-right">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                    {recentOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/30 transition-colors">
                        <td className="py-3 px-2">
                          <span className="font-bold text-slate-900 dark:text-white block truncate max-w-[160px]">
                            {ord.product_name || 'N/A'}
                          </span>
                          {ord.plan_label && (
                            <span className="text-[10px] text-slate-400 block truncate max-w-[160px] mt-0.5">
                              {ord.plan_label}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate max-w-[130px]">
                            {ord.profiles?.full_name || 'Khách hàng'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 block truncate mt-0.5">
                            #{ord.payment_code || ord.id.substring(0, 8)}
                          </span>
                        </td>
                        <td className="py-3 px-2 font-extrabold text-[#2563EB] dark:text-[#35A8FF] whitespace-nowrap">
                          {Number(ord.price || 0).toLocaleString('vi-VN')}đ
                        </td>
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          {getStatusBadge(ord.status)}
                        </td>
                        <td className="py-3 px-2 text-right text-[10px] text-slate-400 font-medium whitespace-nowrap font-mono">
                          {formatRelativeTime(ord.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Timeline Feed Nhật ký Hệ thống (5 Cols - 40%) */}
        <div className="lg:col-span-5 rounded-[20px] sm:rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-3.5 sm:p-5 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span>⚡</span> NHẬT KÝ HỆ THỐNG
              </h3>
              <p className="text-[10.5px] sm:text-[11px] text-slate-400 font-semibold mt-0.5">
                Hoạt động realtime ghi nhận từ Audit Logs.
              </p>
            </div>
            <Link
              to="/admin/activity"
              className="text-[11px] sm:text-xs font-bold text-slate-500 hover:text-[#2563EB] dark:hover:text-[#35A8FF] transition shrink-0 ml-2"
            >
              Chi tiết →
            </Link>
          </div>

          {activities.length === 0 ? (
            <div className="py-8 sm:py-10 px-4 text-center flex flex-col items-center justify-center">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl sm:text-3xl mb-2 sm:mb-3 shadow-inner">
                📋
              </div>
              <h4 className="text-xs font-black text-slate-700 dark:text-slate-300">
                Chưa có hoạt động nào được ghi nhận
              </h4>
              <p className="text-[10.5px] sm:text-[11px] text-slate-400 max-w-xs mt-1 leading-relaxed">
                Các thao tác xử lý đơn, duyệt đánh giá và trả lời ticket sẽ xuất hiện tại đây.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2 sm:space-y-2.5">
              {activities.map((act) => (
                <Link
                  key={act.id}
                  to={act.link}
                  className="group flex gap-2.5 sm:gap-3 items-center p-2 sm:p-2.5 rounded-xl sm:rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-850/50 border border-transparent hover:border-slate-200/60 dark:hover:border-slate-700/50 transition"
                >
                  <span className={`h-7 w-7 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl flex items-center justify-center text-xs shrink-0 font-bold shadow-xs transition-transform group-hover:scale-105 ${act.iconBg}`}>
                    {act.icon}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] sm:text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug group-hover:text-[#2563EB] dark:group-hover:text-[#35A8FF] transition-colors truncate">
                      {act.text}
                    </p>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 text-[9.5px] sm:text-[10px] text-slate-400 font-semibold">
                      <span className="font-mono">{act.time}</span>
                      <span>•</span>
                      <span className="truncate">{act.tag}</span>
                    </div>
                  </div>

                  <span className="text-slate-300 dark:text-slate-600 group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all text-xs font-bold shrink-0">
                    ›
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
