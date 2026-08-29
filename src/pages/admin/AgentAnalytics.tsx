import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { SparkIcon, AppIcon } from '../../components/icons';
import type { AgentAnalyticsEvent } from '../../services/agent/monitoring/analyticsTypes';

interface DashboardStats {
  kpis: {
    total_sessions: number;
    total_messages: number;
    intent_resolved: number;
    product_resolved: number;
    plan_resolved: number;
    clarification_requested: number;
    unresolved: number;
    action_shown: number;
    action_clicked: number;
    action_expired: number;
    checkout_opened: number;
    checkout_success: number;
  };
  top_intents: Array<{ intent: string; count: number }>;
  top_products: Array<{
    product_id: string;
    resolved_count: number;
    clicked_count: number;
    checkout_success_count: number;
  }>;
  top_plans: Array<{
    plan_id: string;
    product_id: string;
    resolved_count: number;
    clicked_count: number;
    checkout_success_count: number;
  }>;
  unresolved_reasons: Array<{ reason: string; count: number }>;
  user_phrases: Array<{ query: string; count: number }>;
}

export default function AgentAnalytics() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentEvents, setRecentEvents] = useState<AgentAnalyticsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Date filter state
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | '90days' | 'all'>('7days');

  useEffect(() => {
    fetchDashboard();
    fetchRecentEvents();
  }, [dateRange]);

  const getDateBounds = () => {
    if (dateRange === 'all') return { start: null, end: null };
    const end = new Date();
    const start = new Date();
    if (dateRange === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (dateRange === '7days') {
      start.setDate(start.getDate() - 7);
    } else if (dateRange === '30days') {
      start.setDate(start.getDate() - 30);
    } else if (dateRange === '90days') {
      start.setDate(start.getDate() - 90);
    }
    return { start: start.toISOString(), end: end.toISOString() };
  };

  async function fetchDashboard() {
    setLoading(true);
    try {
      const bounds = getDateBounds();
      const { data, error } = await (supabase as any).rpc('get_agent_analytics_dashboard', {
        p_start_date: bounds.start,
        p_end_date: bounds.end,
      });

      if (!error && data) {
        setStats(data as DashboardStats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRecentEvents() {
    try {
      const bounds = getDateBounds();
      let query = supabase
        .from('agent_analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (bounds.start) query = query.gte('created_at', bounds.start);
      if (bounds.end) query = query.lte('created_at', bounds.end);

      const { data, error } = await query;
      if (!error && data) {
        const parsed = (data as any[]).map(d => ({
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
        setRecentEvents(parsed as AgentAnalyticsEvent[]);
      }
    } catch (err) {
      console.error(err);
    }
  }

  const kpis = stats?.kpis;
  const resolutionRate = kpis && kpis.total_messages > 0 ? (kpis.intent_resolved / kpis.total_messages) * 100 : 0;
  const clickRate = kpis && kpis.action_shown > 0 ? (kpis.action_clicked / kpis.action_shown) * 100 : 0;
  const conversionRate = kpis && kpis.checkout_opened > 0 ? (kpis.checkout_success / kpis.checkout_opened) * 100 : 0;
  const clarificationRate = kpis && kpis.total_messages > 0 ? (kpis.clarification_requested / kpis.total_messages) * 100 : 0;
  const expirationRate = kpis && kpis.action_shown > 0 ? (kpis.action_expired / kpis.action_shown) * 100 : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto animate-fade-up">
      {/* HEADER & FILTERS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SparkIcon className="w-8 h-8 text-[#2563EB]" />
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white">BOW Agent Analytics</h1>
            <p className="text-sm font-medium text-slate-500">Giám sát toàn diện hành vi người dùng và hiệu suất trợ lý AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl">
          {[
            { id: 'today', label: 'Hôm nay' },
            { id: '7days', label: '7 Ngày' },
            { id: '30days', label: '30 Ngày' },
            { id: 'all', label: 'Toàn thời gian' }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setDateRange(opt.id as any)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                dateRange === opt.id 
                  ? 'bg-white dark:bg-slate-700 text-[#2563EB] dark:text-[#3B82F6] shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !stats ? (
        <div className="py-20 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-500" />
        </div>
      ) : (
        <>
          {/* OVERVIEW KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <KpiCard label="TỔNG SỐ CHAT" value={kpis?.total_messages || 0} sub={`${kpis?.total_sessions || 0} Phiên làm việc`} color="blue" />
            <KpiCard label="TỶ LỆ PHÂN GIẢI INTENT" value={`${resolutionRate.toFixed(1)}%`} sub={`${kpis?.intent_resolved || 0} Tin nhắn rõ ý`} color="emerald" />
            <KpiCard label="TỶ LỆ HỎI LẠI (CLARIFY)" value={`${clarificationRate.toFixed(1)}%`} sub={`${kpis?.clarification_requested || 0} Lần yêu cầu làm rõ`} color="amber" />
            <KpiCard label="ACTION CLICK RATE" value={`${clickRate.toFixed(1)}%`} sub={`${kpis?.action_clicked || 0} Clicks / ${kpis?.action_shown || 0} Actions`} color="indigo" />
            <KpiCard label="TỶ LỆ ACTION HẾT HẠN" value={`${expirationRate.toFixed(1)}%`} sub={`${kpis?.action_expired || 0} / ${kpis?.action_shown || 0} Actions`} color="rose" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* FUNNEL & CONVERSION */}
            <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4">🛒 Checkout Funnel (BUY Intent)</h3>
              <div className="flex-1 space-y-4">
                <FunnelStep label="1. Có ý định mua (BUY)" count={kpis?.intent_resolved || 0} max={kpis?.intent_resolved || 1} color="bg-blue-500" />
                <FunnelStep label="2. Chọn đúng sản phẩm" count={kpis?.product_resolved || 0} max={kpis?.intent_resolved || 1} color="bg-indigo-500" />
                <FunnelStep label="3. Chọn đúng gói (Plan)" count={kpis?.plan_resolved || 0} max={kpis?.intent_resolved || 1} color="bg-violet-500" />
                <FunnelStep label="4. Bấm Mua (Click Action)" count={kpis?.action_clicked || 0} max={kpis?.intent_resolved || 1} color="bg-fuchsia-500" />
                <FunnelStep label="5. Mở Popup Thanh toán" count={kpis?.checkout_opened || 0} max={kpis?.intent_resolved || 1} color="bg-pink-500" />
                <FunnelStep label="6. Thanh toán thành công" count={kpis?.checkout_success || 0} max={kpis?.intent_resolved || 1} color="bg-emerald-500" />
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Conversion Rate (Mở Popup → Mua)</p>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{conversionRate.toFixed(1)}%</p>
              </div>
            </div>

            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* TOP INTENTS */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                <h3 className="font-bold text-slate-800 dark:text-white mb-4">🎯 Top Intent (Ý định)</h3>
                <div className="space-y-3">
                  {stats?.top_intents.map((t, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">{t.intent}</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-white">{t.count}</span>
                    </div>
                  ))}
                  {stats?.top_intents.length === 0 && <p className="text-sm text-slate-500">Chưa có dữ liệu</p>}
                </div>
              </div>

              {/* UNRESOLVED REASONS */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                <h3 className="font-bold text-slate-800 dark:text-white mb-4">⚠️ Lỗi phân giải (Unresolved)</h3>
                <div className="space-y-3">
                  {stats?.unresolved_reasons.map((t, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 rounded-md max-w-[200px] truncate">{t.reason}</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-white">{t.count}</span>
                    </div>
                  ))}
                  {stats?.unresolved_reasons.length === 0 && <p className="text-sm text-slate-500">Mọi thứ đều hoàn hảo!</p>}
                </div>
              </div>

              {/* TOP PRODUCTS */}
              <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><AppIcon className="w-5 h-5"/> Sản phẩm nổi bật</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 font-bold">
                      <tr>
                        <th className="px-3 py-2 rounded-l-lg">Product ID</th>
                        <th className="px-3 py-2 text-right">Lượt tìm (Resolved)</th>
                        <th className="px-3 py-2 text-right">Clicks Action</th>
                        <th className="px-3 py-2 text-right rounded-r-lg">Lượt Mua</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {stats?.top_products.map((p, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-mono text-xs text-blue-600 dark:text-blue-400 truncate max-w-[150px]">{p.product_id}</td>
                          <td className="px-3 py-2 font-bold text-right text-slate-700 dark:text-slate-300">{p.resolved_count}</td>
                          <td className="px-3 py-2 font-bold text-right text-indigo-600 dark:text-indigo-400">{p.clicked_count}</td>
                          <td className="px-3 py-2 font-black text-right text-emerald-600 dark:text-emerald-400">{p.checkout_success_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {stats?.top_products.length === 0 && <p className="text-sm text-slate-500 mt-4 text-center">Chưa có dữ liệu sản phẩm</p>}
                </div>
              </div>
            </div>
          </div>

          {/* USER PHRASES & RECENT EVENTS */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* USER PHRASES */}
            <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4">💬 Cách User diễn đạt</h3>
              <div className="space-y-2 overflow-y-auto max-h-[400px] pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                {stats?.user_phrases.map((p, i) => (
                  <div key={i} className="flex gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                    <span className="font-mono text-xs text-slate-400 mt-0.5">#{i+1}</span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 break-words">{p.query}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{p.count} lần</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RECENT EVENTS */}
            <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-0 shadow-sm overflow-hidden flex flex-col h-[500px]">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                <h3 className="font-bold text-slate-800 dark:text-slate-200">Luồng sự kiện gần nhất (Top 50)</h3>
                <button onClick={fetchRecentEvents} className="text-xs px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition">Làm mới</button>
              </div>
              <div className="overflow-x-auto flex-1 p-0">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400 relative">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase text-slate-500 dark:text-slate-500 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3">Thời gian</th>
                      <th className="px-4 py-3">Event Type</th>
                      <th className="px-4 py-3">Intent</th>
                      <th className="px-4 py-3">Product/Plan</th>
                      <th className="px-4 py-3">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {recentEvents.map((ev, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-mono text-[10px] whitespace-nowrap">
                          {ev.createdAt ? new Date(ev.createdAt).toLocaleString('vi-VN') : '-'}
                        </td>
                        <td className="px-4 py-3 font-bold text-xs text-slate-800 dark:text-slate-200">{ev.eventType}</td>
                        <td className="px-4 py-3">
                          {ev.intent ? (
                            <span className="inline-flex rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-bold">
                              {ev.intent}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {ev.productId && <div className="text-blue-600 dark:text-blue-400 font-mono text-[10px] truncate max-w-[150px]" title={ev.productId}>P: {ev.productId}</div>}
                          {ev.planId && <div className="text-indigo-600 dark:text-indigo-400 font-mono text-[10px] truncate max-w-[150px]" title={ev.planId}>L: {ev.planId}</div>}
                        </td>
                        <td className="px-4 py-3 text-[11px] max-w-[200px] truncate">
                          {ev.reason && <span className="text-rose-500 font-bold block truncate">Lý do: {ev.reason}</span>}
                          {(ev.metadata as any)?.query && <span className="text-slate-500 block truncate">"{(ev.metadata as any).query}"</span>}
                          {ev.actionType && <span className="text-slate-500 block">Action: {ev.actionType}</span>}
                        </td>
                      </tr>
                    ))}
                    {recentEvents.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-medium">
                          Chưa có sự kiện nào trong khoảng thời gian này.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------
// HELPER COMPONENTS
// ----------------------------------------------------

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo' }) {
  const colorMap = {
    blue: 'border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400',
    emerald: 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400',
    amber: 'border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400',
    rose: 'border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400',
    indigo: 'border-indigo-200 dark:border-indigo-900/50 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400',
  };

  return (
    <div className={`p-4 rounded-2xl border ${colorMap[color]} shadow-sm`}>
      <h3 className="text-[10px] font-black uppercase tracking-wider opacity-70 mb-1">{label}</h3>
      <p className="text-3xl font-black">{value}</p>
      <p className="text-[10px] font-bold mt-2 opacity-80">{sub}</p>
    </div>
  );
}

function FunnelStep({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const percent = max > 0 ? (count / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
        <span>{label}</span>
        <span>{count}</span>
      </div>
      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-1000`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
