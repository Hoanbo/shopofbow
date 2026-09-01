// src/pages/admin/AgentAnalytics.tsx — Enterprise Bento Grid Orchestrator (<200 lines)
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { SparkIcon, BarChartIcon, TrendingUpIcon, GlobeIcon, ZapIcon, ActivityIcon, RefreshIcon } from '../../components/icons';
import type { AgentAnalyticsEvent } from '../../services/agent/monitoring/analyticsTypes';
import type {
  DashboardStats,
  ProductRecord,
  CategoryRecord,
  DateRange,
  AnalyticsTab,
  HeroKpis,
} from './analytics/types';
import { computeFallbackStats } from './analytics/analyticsFallback';
import { AgentOverviewTab } from './analytics/AgentOverviewTab';
import { AgentProductsTab } from './analytics/AgentProductsTab';
import { AgentDemandTab } from './analytics/AgentDemandTab';
import { AgentLanguageTab } from './analytics/AgentLanguageTab';
import { AgentEventsTab } from './analytics/AgentEventsTab';
import { SessionForensicDrawer } from './analytics/SessionForensicDrawer';

export default function AgentAnalytics() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [heroKpis, setHeroKpis] = useState<HeroKpis>({
    conversionRate: 0,
    avgLatencyMs: 240,
    fallbackRate: 0,
    catalogGapsCount: 0,
    resolutionRate: 0,
    totalMessages: 0,
    totalSessions: 0,
  });
  const [recentEvents, setRecentEvents] = useState<AgentAnalyticsEvent[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [dateRange, setDateRange] = useState<DateRange>('7days');
  const [selectedPhraseFilter, setSelectedPhraseFilter] = useState<string | null>(null);

  // Forensic Drawer State
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionEvents, setSessionEvents] = useState<AgentAnalyticsEvent[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);

  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const eventBufferRef = useRef<AgentAnalyticsEvent[]>([]);

  // 1. Date Range Boundaries
  const dateBounds = useMemo(() => {
    if (dateRange === 'all') return { start: null, end: null };
    const end = new Date();
    const start = new Date();
    if (dateRange === 'today') start.setHours(0, 0, 0, 0);
    else if (dateRange === '24h') start.setHours(start.getHours() - 24);
    else if (dateRange === '7days') start.setDate(start.getDate() - 7);
    else if (dateRange === '30days') start.setDate(start.getDate() - 30);
    else if (dateRange === '90days') start.setDate(start.getDate() - 90);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [dateRange]);

  // 2. Fetch DB Metadata (Chỉ gọi 1 LẦN DUY NHẤT khi mở trang)
  const fetchDbMetadata = useCallback(async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        supabase.from('products').select('id, name, slug, base_price, category_id, is_active, categories(id, name, slug, icon), product_plans(id, name, duration, price, original_price, is_highlight, is_active)'),
        supabase.from('categories').select('id, name, slug, icon'),
      ]);
      if (prodRes.data) setProducts(prodRes.data as unknown as ProductRecord[]);
      if (catRes.data) setCategories(catRes.data as CategoryRecord[]);
    } catch (err) {
      console.warn('[Analytics] Metadata query error:', err);
    }
  }, []);

  useEffect(() => {
    fetchDbMetadata();
  }, [fetchDbMetadata]);

  // Giữ ref cho products để không làm re-trigger fetchDashboard
  const productsRef = useRef<ProductRecord[]>([]);
  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // 3. Fallback Resilient Dashboard Fetch (Chỉ phụ thuộc vào dateBounds)
  const fetchDashboard = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    try {
      let eventsQuery = supabase.from('agent_analytics_events').select('*').order('created_at', { ascending: false }).limit(200);
      if (dateBounds.start) eventsQuery = eventsQuery.gte('created_at', dateBounds.start);
      if (dateBounds.end) eventsQuery = eventsQuery.lte('created_at', dateBounds.end);

      const [rpcRes, eventsRes] = await Promise.allSettled([
        (supabase as any).rpc('get_agent_analytics_dashboard', { p_start_date: dateBounds.start, p_end_date: dateBounds.end }),
        eventsQuery,
      ]);

      let parsedEvents: AgentAnalyticsEvent[] = [];
      if (eventsRes.status === 'fulfilled' && eventsRes.value.data) {
        parsedEvents = (eventsRes.value.data as any[]).map((d) => ({
          eventType: d.event_type,
          userId: d.user_id,
          sessionId: d.session_id,
          intent: d.intent,
          productId: d.product_id,
          planId: d.plan_id,
          actionId: d.action_id,
          actionType: d.action_type,
          reason: d.reason,
          metadata: d.metadata,
          createdAt: d.created_at,
        }));
        setRecentEvents(parsedEvents);
      }

      const currentProds = productsRef.current;
      // Check if RPC succeeded without error
      if (rpcRes.status === 'fulfilled' && !rpcRes.value.error && rpcRes.value.data) {
        const rawStats = rpcRes.value.data as DashboardStats;
        setStats(rawStats);
        const { heroKpis: computedKpis } = computeFallbackStats(parsedEvents, currentProds);
        setHeroKpis(computedKpis);
      } else {
        // RESILIENCE FALLBACK: Compute metrics locally from events
        const { stats: fallbackStats, heroKpis: computedKpis } = computeFallbackStats(parsedEvents, currentProds);
        setStats(fallbackStats);
        setHeroKpis(computedKpis);
      }
    } catch (err) {
      console.warn('[Analytics] Resilient fallback engaged:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateBounds]);

  // Gọi tải dữ liệu khi thay đổi khoảng ngày
  useEffect(() => {
    fetchDashboard(true);
  }, [fetchDashboard]);

  // Giữ ref cho fetchDashboard để Realtime stream gọi mà KHÔNG làm reconnect channel
  const fetchDashboardRef = useRef(fetchDashboard);
  useEffect(() => {
    fetchDashboardRef.current = fetchDashboard;
  }, [fetchDashboard]);

  // 4. Realtime Stream với 2s Throttle (KHỞI TẠO 1 LẦN DUY NHẤT - Dependency [])
  useEffect(() => {
    const channel = supabase.channel('agent_analytics_realtime_stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_analytics_events' }, (payload) => {
        const row = payload.new as any;
        if (row) {
          eventBufferRef.current.push({
            eventType: row.event_type,
            userId: row.user_id,
            sessionId: row.session_id,
            intent: row.intent,
            productId: row.product_id,
            planId: row.plan_id,
            actionId: row.action_id,
            actionType: row.action_type,
            reason: row.reason,
            metadata: row.metadata,
            createdAt: row.created_at,
          });
          if (!throttleTimerRef.current) {
            throttleTimerRef.current = setTimeout(() => {
              if (eventBufferRef.current.length > 0) {
                const buffered = [...eventBufferRef.current];
                eventBufferRef.current = [];
                setRecentEvents((prev) => [...buffered.reverse(), ...prev].slice(0, 150));
                fetchDashboardRef.current(false); // Gọi qua ref, an toàn tuyệt đối
              }
              throttleTimerRef.current = null;
            }, 2000);
          }
        }
      })
      .subscribe((status) => setIsLive(status === 'SUBSCRIBED'));

    return () => {
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, []); // <--- ĐẶT LÀ MẢNG RỖNG [] ĐỂ CHỐNG RECONNECT VÔ TẬN!

  // 5. Resolvers & Helpers
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const resolveProductName = useCallback((id?: string | null) => (id && productMap.get(id)?.name) || (id ? `SP (${id.slice(0, 8)}...)` : '-'), [productMap]);
  const resolvePlanDetails = useCallback((id?: string | null) => {
    if (!id) return null;
    for (const p of products) {
      const pl = p.product_plans?.find((item) => item.id === id);
      if (pl) return { id: pl.id, name: pl.name, duration: pl.duration, price: pl.price, productId: p.id, productName: p.name };
    }
    return null;
  }, [products]);
  const formatCurrency = (amt?: number | null) => (typeof amt === 'number' && !isNaN(amt) ? `${new Intl.NumberFormat('vi-VN').format(amt)}đ` : '0đ');

  const openSession = async (sId: string) => {
    setSelectedSessionId(sId);
    setLoadingSession(true);
    try {
      const { data } = await supabase.from('agent_analytics_events').select('*').eq('session_id', sId).order('created_at', { ascending: true });
      if (data) setSessionEvents((data as any[]).map((d) => ({ eventType: d.event_type, userId: d.user_id, sessionId: d.session_id, intent: d.intent, productId: d.product_id, planId: d.plan_id, actionId: d.action_id, actionType: d.action_type, reason: d.reason, metadata: d.metadata, createdAt: d.created_at })));
    } finally { setLoadingSession(false); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto animate-fade-in font-sans text-slate-900 dark:text-slate-100">
      {/* HEADER & TIME FILTER — 1 UNIFIED STREAMLINED ROW */}
      <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-4 px-5 py-3.5 rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <SparkIcon className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-2.5 truncate">
            <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
              BOW Agent Analytics
            </h1>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${isLive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {isLive ? 'Live Realtime' : 'Connecting...'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-950/80 p-1 rounded-xl border border-slate-200 dark:border-white/5">
            {[
              { id: 'today', label: 'Hôm nay' },
              { id: '24h', label: '24h' },
              { id: '7days', label: '7 ngày' },
              { id: '30days', label: '30 ngày' },
              { id: '90days', label: '90 ngày' },
              { id: 'all', label: 'Tất cả' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setDateRange(opt.id as DateRange)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  dateRange === opt.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchDashboard(false)}
            disabled={refreshing}
            title="Làm mới dữ liệu"
            className="h-8 px-3 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-950/80 hover:bg-slate-200 dark:hover:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/5 transition flex items-center gap-1.5 shadow-xs"
          >
            <RefreshIcon className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/5 pb-2 overflow-x-auto">
        {[
          { id: 'overview', icon: 'overview', label: 'Tổng quan & Phễu', badge: `${heroKpis.conversionRate.toFixed(0)}% CVR` },
          { id: 'products', icon: 'products', label: '️ Hiệu suất Sản phẩm', badge: `${products.length} SP` },
          { id: 'demand', icon: 'demand', label: 'Cơ hội Kinh doanh', badge: `${heroKpis.catalogGapsCount} Gaps` },
          { id: 'language', icon: 'language', label: 'Ngôn ngữ Khách', badge: `${stats?.user_phrases.length || 0} mẫu` },
          { id: 'events', icon: 'events', label: 'Luồng Sự kiện Live', badge: `${recentEvents.length} live` },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as AnalyticsTab)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900 shadow-xs'}`}>
            {tab.icon === 'overview' && <BarChartIcon className="w-3.5 h-3.5 shrink-0" />}
            {tab.icon === 'products' && <TrendingUpIcon className="w-3.5 h-3.5 shrink-0" />}
            {tab.icon === 'demand' && <ZapIcon className="w-3.5 h-3.5 shrink-0" />}
            {tab.icon === 'language' && <GlobeIcon className="w-3.5 h-3.5 shrink-0" />}
            {tab.icon === 'events' && <ActivityIcon className="w-3.5 h-3.5 shrink-0" />}
            <span>{tab.label}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] ${activeTab === tab.id ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400'}`}>{tab.badge}</span>
          </button>
        ))}
      </div>

      {/* TAB CONTENT WITH RESILIENT FALLBACK */}
      {loading && !stats ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-500" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Đang khởi tạo số liệu quan sát BOW Agent...</p>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && <AgentOverviewTab stats={stats} heroKpis={heroKpis} onNavigateTab={setActiveTab} />}
          {activeTab === 'products' && <AgentProductsTab stats={stats} products={products} categories={categories} formatCurrency={formatCurrency} />}
          {activeTab === 'demand' && <AgentDemandTab recentEvents={recentEvents} dateBounds={dateBounds} />}
          {activeTab === 'language' && <AgentLanguageTab stats={stats} onFilterPhrase={(phrase) => { setSelectedPhraseFilter(phrase); setActiveTab('events'); }} />}
          {activeTab === 'events' && <AgentEventsTab recentEvents={recentEvents} selectedPhraseFilter={selectedPhraseFilter} onClearPhraseFilter={() => setSelectedPhraseFilter(null)} resolveProductName={resolveProductName} resolvePlanDetails={resolvePlanDetails} onOpenSession={openSession} />}
        </>
      )}

      {/* FORENSIC TIMELINE DRAWER */}
      <SessionForensicDrawer sessionId={selectedSessionId} isOpen={Boolean(selectedSessionId)} onClose={() => setSelectedSessionId(null)} sessionEvents={sessionEvents} loading={loadingSession} resolveProductName={resolveProductName} resolvePlanDetails={resolvePlanDetails} />
    </div>
  );
}
