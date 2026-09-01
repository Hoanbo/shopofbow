// src/pages/admin/analytics/AgentOverviewTab.tsx
import React, { useMemo } from 'react';
import { ShoppingCartIcon, ZapIcon, ShieldCheckIcon, AlertTriangleIcon } from '../../../components/icons';
import type { DashboardStats, HeroKpis } from './types';

interface AgentOverviewTabProps {
  stats: DashboardStats | null;
  heroKpis: HeroKpis;
  onNavigateTab: (tab: 'overview' | 'products' | 'demand' | 'language' | 'events') => void;
}

export const AgentOverviewTab: React.FC<AgentOverviewTabProps> = ({
  stats,
  heroKpis,
  onNavigateTab,
}) => {
  const kpis = stats?.kpis;

  // Funnel numbers
  const buyIntentCount = kpis?.intent_resolved || 0;
  const productResolvedCount = kpis?.product_resolved || 0;
  const planResolvedCount = kpis?.plan_resolved || 0;
  const actionClickedCount = kpis?.action_clicked || 0;
  const checkoutOpenedCount = kpis?.checkout_opened || 0;
  const checkoutSuccessCount = kpis?.checkout_success || 0;

  // Conversational Intent Matrix
  const conversationalIntents = useMemo(() => {
    const intents = stats?.top_intents || [];
    const getCount = (name: string) => intents.find((i) => i.intent === name)?.count || 0;
    const greeting = getCount('GREETING');
    const smallTalk = getCount('SMALL_TALK');
    const capability = getCount('CAPABILITY_DISCOVERY');
    const clarification = kpis?.clarification_requested || 0;
    const orderQuery = getCount('ORDER_QUERY');
    const expiring = getCount('EXPIRING_SOON');
    const wallet = getCount('WALLET');
    const ticket = getCount('TICKET');
    const coupon = getCount('COUPON');

    const totalConversational = greeting + smallTalk + capability + clarification;
    return {
      greeting,
      smallTalk,
      capability,
      clarification,
      orderQuery,
      expiring,
      wallet,
      ticket,
      coupon,
      totalConversational,
    };
  }, [stats?.top_intents, kpis]);

  const clarificationRate =
    kpis && kpis.total_messages > 0 ? (kpis.clarification_requested / kpis.total_messages) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Clarification Notice if High */}
      {clarificationRate > 30 && (kpis?.total_messages || 0) >= 5 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <AlertTriangleIcon className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-300">
                Tỷ lệ yêu cầu làm rõ (Clarification Rate) đang ở mức {clarificationRate.toFixed(1)}%
              </p>
              <p className="text-[11px] text-amber-400/80">
                Người dùng thường hỏi chung chung. AI đang mở đối thoại gợi ý làm rõ nhu cầu tự nhiên.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('products')}
            className="px-3.5 py-1.5 text-xs font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 rounded-xl transition shrink-0"
          >
            Xem hiệu suất SP &rarr;
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4 HERO KPIS (BENTO CARDS)                                            */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* HERO 1: Conversion Rate */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 shadow-sm dark:shadow-xl transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition-all" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">Chuyển đổi Mua hàng</span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400"><ShoppingCartIcon className="w-4 h-4" /></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{heroKpis.conversionRate.toFixed(1)}%</span>
            <span className="text-[11px] font-bold text-emerald-400">
              {checkoutSuccessCount} / {Math.max(checkoutOpenedCount, 1)} đơn
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Tỷ lệ thanh toán hoàn tất từ số lần mở giỏ hàng</p>
        </div>

        {/* HERO 2: Response Latency */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 shadow-sm dark:shadow-xl transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/15 transition-all" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">Độ trễ phản hồi AI</span>
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400"><ZapIcon className="w-4 h-4" /></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{heroKpis.avgLatencyMs}</span>
            <span className="text-xs font-bold text-blue-400">ms</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Thời gian xử lý trung bình qua NLU và Tool Engine</p>
        </div>

        {/* HERO 3: V2 Fallback & Health */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 shadow-sm dark:shadow-xl transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/15 transition-all" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">Fallback V2 / Quota</span>
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400"><ShieldCheckIcon className="w-4 h-4" /></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{heroKpis.fallbackRate.toFixed(1)}%</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              heroKpis.fallbackRate < 5
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {heroKpis.fallbackRate < 5 ? 'Ổn định' : 'Có fallback'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Bảo đảm dự phòng mượt mà khi Gemini chạm giới hạn</p>
        </div>

        {/* HERO 4: Catalog Demand Gaps */}
        <div
          onClick={() => onNavigateTab('demand')}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 shadow-sm dark:shadow-xl transition-all relative overflow-hidden group cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/15 transition-all" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">Lỗ hổng Catalog</span>
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 text-sm">💡</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{heroKpis.catalogGapsCount}</span>
            <span className="text-xs font-bold text-purple-400">cơ hội mới &rarr;</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Sản phẩm khách hỏi nhưng shop chưa kinh doanh</p>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* BENTO GRID: FUNNEL & BEHAVIOR MATRIX                                 */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CHECKOUT FUNNEL */}
        <div className="lg:col-span-1 p-6 rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Phễu Mua Hàng (Checkout Funnel)</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                BUY Intent
              </span>
            </div>

            <div className="space-y-3.5">
              <FunnelStepItem
                step="1"
                label="Ý định mua hàng (BUY Intent)"
                count={buyIntentCount}
                prevCount={buyIntentCount}
                maxCount={buyIntentCount || 1}
                barClass="bg-blue-500"
              />
              <FunnelStepItem
                step="2"
                label="Xác định đúng sản phẩm"
                count={productResolvedCount}
                prevCount={buyIntentCount}
                maxCount={buyIntentCount || 1}
                barClass="bg-indigo-500"
              />
              <FunnelStepItem
                step="3"
                label="Xác định đúng gói (Plan)"
                count={planResolvedCount}
                prevCount={productResolvedCount}
                maxCount={buyIntentCount || 1}
                barClass="bg-violet-500"
              />
              <FunnelStepItem
                step="4"
                label="Bấm Mua (Click Action Card)"
                count={actionClickedCount}
                prevCount={planResolvedCount}
                maxCount={buyIntentCount || 1}
                barClass="bg-fuchsia-500"
              />
              <FunnelStepItem
                step="5"
                label="Mở Giao diện Thanh toán"
                count={checkoutOpenedCount}
                prevCount={actionClickedCount}
                maxCount={buyIntentCount || 1}
                barClass="bg-pink-500"
              />
              <FunnelStepItem
                step="6"
                label="Thanh toán thành công"
                count={checkoutSuccessCount}
                prevCount={checkoutOpenedCount}
                maxCount={buyIntentCount || 1}
                barClass="bg-emerald-500"
              />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 grid grid-cols-2 gap-3 text-center">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/5">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Click &rarr; Mở Checkout</p>
              <p className="text-base font-black text-pink-400 mt-0.5">
                {actionClickedCount > 0 ? ((checkoutOpenedCount / actionClickedCount) * 100).toFixed(1) : '0.0'}%
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Checkout &rarr; Hoàn tất</p>
              <p className="text-base font-black text-emerald-300 mt-0.5">{heroKpis.conversionRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* CONVERSATIONAL BEHAVIOR & UNRESOLVED REASONS */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Conversational Behavior */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Hành vi Hội thoại Tự nhiên</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Các lượt tương tác ngoài việc mua hàng thuần túy</p>

              <div className="space-y-2.5">
                <BehaviorRowItem label="Chào hỏi (Greeting)" count={conversationalIntents.greeting} total={kpis?.total_messages || 1} barClass="bg-emerald-500" />
                <BehaviorRowItem label="Cảm ơn / Trò chuyện (Small Talk)" count={conversationalIntents.smallTalk} total={kpis?.total_messages || 1} barClass="bg-blue-500" />
                <BehaviorRowItem label="Khám phá năng lực (Discovery)" count={conversationalIntents.capability} total={kpis?.total_messages || 1} barClass="bg-indigo-500" />
                <BehaviorRowItem label="Đối thoại làm rõ (Clarify)" count={conversationalIntents.clarification} total={kpis?.total_messages || 1} barClass="bg-amber-500" />
                <BehaviorRowItem label="Tra cứu đơn hàng (Orders)" count={conversationalIntents.orderQuery} total={kpis?.total_messages || 1} barClass="bg-purple-500" />
                <BehaviorRowItem label="⏳ Nhắc gia hạn SP (Expiring)" count={conversationalIntents.expiring} total={kpis?.total_messages || 1} barClass="bg-rose-500" />
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-white/5 flex justify-between items-center text-xs">
              <span className="text-slate-400">Tỷ lệ tương tác tự nhiên:</span>
              <span className="font-bold text-indigo-400">
                {kpis?.total_messages
                  ? (((conversationalIntents.totalConversational + conversationalIntents.orderQuery + conversationalIntents.expiring) / kpis.total_messages) * 100).toFixed(1)
                  : '0.0'}
                %
              </span>
            </div>
          </div>

          {/* Unresolved Reasons */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangleIcon className="w-4 h-4 text-rose-400 shrink-0" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Điểm nghẽn Phân giải</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Các trường hợp Agent cần hỏi lại hoặc khách bỏ dở</p>

              <div className="space-y-2.5">
                {(stats?.unresolved_reasons || []).map((t, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/5">
                    <div>
                      <span className="text-xs font-semibold text-rose-400 block">{t.reason}</span>
                      <span className="text-[10px] text-slate-400">
                        {t.reason === 'MULTIPLE_PLANS_AVAILABLE' && 'Có nhiều gói &rarr; Hiển thị danh sách chọn'}
                        {t.reason === 'PRODUCT_NOT_FOUND' && 'Không tìm thấy SP &rarr; Đang gợi ý tương đương'}
                        {t.reason === 'AMBIGUOUS_PRODUCT' && 'Câu hỏi chung chung &rarr; Cần làm rõ'}
                      </span>
                    </div>
                    <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20">
                      {t.count}
                    </span>
                  </div>
                ))}
                {(stats?.unresolved_reasons || []).length === 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-8">Không có điểm nghẽn nào</p>
                )}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-white/5 text-[11px] text-slate-400 flex justify-between items-center">
              <span>Gợi ý:</span>
              <button
                onClick={() => onNavigateTab('language')}
                className="text-blue-400 hover:text-blue-300 font-semibold underline"
              >
                Khám phá Ngôn ngữ User &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------
// HELPER COMPONENTS
// --------------------------------------------------------------------------

function FunnelStepItem({
  step,
  label,
  count,
  prevCount,
  maxCount,
  barClass,
}: {
  step: string;
  label: string;
  count: number;
  prevCount: number;
  maxCount: number;
  barClass: string;
}) {
  const percentTotal = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const percentFromPrev = prevCount > 0 ? (count / prevCount) * 100 : 0;
  const dropOff = 100 - percentFromPrev;

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-300">
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] flex items-center justify-center font-bold text-slate-600 dark:text-slate-400">
            {step}
          </span>
          {label}
        </span>
        <div className="text-right">
          <span className="font-bold text-slate-900 dark:text-white">{count}</span>
          {step !== '1' && prevCount > 0 && (
            <span className="text-[10px] text-slate-400 ml-1.5 font-normal">
              ({percentFromPrev.toFixed(1)}% | -{dropOff.toFixed(1)}%)
            </span>
          )}
        </div>
      </div>
      <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${barClass} rounded-full transition-all duration-700`}
          style={{ width: `${percentTotal}%` }}
        />
      </div>
    </div>
  );
}

function BehaviorRowItem({
  label,
  count,
  total,
  barClass,
}: {
  label: string;
  count: number;
  total: number;
  barClass: string;
}) {
  const percent = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/5 space-y-1">
      <div className="flex justify-between items-center text-xs font-medium text-slate-700 dark:text-slate-300">
        <span className="truncate">{label}</span>
        <span className="font-bold text-slate-900 dark:text-white ml-2">
          {count} <span className="text-[10px] text-slate-400 font-normal">({percent.toFixed(1)}%)</span>
        </span>
      </div>
      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full ${barClass} rounded-full`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
