// src/pages/admin/analytics/analyticsFallback.ts
import type { AgentAnalyticsEvent } from '../../../services/agent/monitoring/analyticsTypes';
import type { DashboardStats, HeroKpis, ProductRecord } from './types';

/**
 * Calculates complete DashboardStats and HeroKpis locally from agent_analytics_events
 * whenever the Postgres RPC `get_agent_analytics_dashboard` is absent or returns an error.
 */
export function computeFallbackStats(
  events: AgentAnalyticsEvent[],
  _products: ProductRecord[] = []
): { stats: DashboardStats; heroKpis: HeroKpis } {
  const sessions = new Set<string>();
  let totalMessages = 0;
  let intentResolved = 0;
  let productResolved = 0;
  let planResolved = 0;
  let clarificationRequested = 0;
  let unresolvedCount = 0;
  let actionShown = 0;
  let actionClicked = 0;
  let actionExpired = 0;
  let checkoutOpened = 0;
  let checkoutSuccess = 0;
  let geminiFallbacks = 0;

  const intentCounts = new Map<string, number>();
  const productStats = new Map<string, { resolved: number; clicked: number; success: number }>();
  const planStats = new Map<string, { resolved: number; clicked: number; success: number; productId: string }>();
  const reasonCounts = new Map<string, number>();
  const queryCounts = new Map<string, number>();

  let totalLatencyMs = 0;
  let latencySampleCount = 0;
  let catalogGapsCount = 0;

  for (const ev of events) {
    if (ev.sessionId) {
      sessions.add(ev.sessionId);
    }

    switch (ev.eventType) {
      case 'MESSAGE_RECEIVED':
        totalMessages++;
        if (ev.metadata && typeof (ev.metadata as any).query === 'string') {
          const q = ((ev.metadata as any).query as string).trim().toLowerCase();
          if (q.length > 1) {
            queryCounts.set(q, (queryCounts.get(q) || 0) + 1);
          }
        }
        break;

      case 'INTENT_RESOLVED':
        intentResolved++;
        if (ev.intent) {
          intentCounts.set(ev.intent, (intentCounts.get(ev.intent) || 0) + 1);
        }
        break;

      case 'INTENT_UNRESOLVED':
      case 'PRODUCT_UNRESOLVED':
      case 'PLAN_UNRESOLVED':
        unresolvedCount++;
        if (ev.reason) {
          reasonCounts.set(ev.reason, (reasonCounts.get(ev.reason) || 0) + 1);
        }
        break;

      case 'PRODUCT_RESOLVED':
        productResolved++;
        if (ev.productId) {
          const ps = productStats.get(ev.productId) || { resolved: 0, clicked: 0, success: 0 };
          ps.resolved++;
          productStats.set(ev.productId, ps);
        }
        break;

      case 'PLAN_RESOLVED':
        planResolved++;
        if (ev.planId) {
          const pls = planStats.get(ev.planId) || { resolved: 0, clicked: 0, success: 0, productId: ev.productId || '' };
          pls.resolved++;
          if (ev.productId) pls.productId = ev.productId;
          planStats.set(ev.planId, pls);
        }
        break;

      case 'CLARIFICATION_REQUESTED':
        clarificationRequested++;
        if (ev.reason) {
          reasonCounts.set(ev.reason, (reasonCounts.get(ev.reason) || 0) + 1);
        }
        break;

      case 'ACTION_SHOWN':
        actionShown++;
        break;

      case 'ACTION_CLICKED':
        actionClicked++;
        if (ev.productId) {
          const ps = productStats.get(ev.productId) || { resolved: 0, clicked: 0, success: 0 };
          ps.clicked++;
          productStats.set(ev.productId, ps);
        }
        if (ev.planId) {
          const pls = planStats.get(ev.planId) || { resolved: 0, clicked: 0, success: 0, productId: ev.productId || '' };
          pls.clicked++;
          planStats.set(ev.planId, pls);
        }
        break;

      case 'ACTION_EXPIRED':
        actionExpired++;
        break;

      case 'CHECKOUT_OPENED':
        checkoutOpened++;
        break;

      case 'CHECKOUT_SUCCESS':
        checkoutSuccess++;
        if (ev.productId) {
          const ps = productStats.get(ev.productId) || { resolved: 0, clicked: 0, success: 0 };
          ps.success++;
          productStats.set(ev.productId, ps);
        }
        if (ev.planId) {
          const pls = planStats.get(ev.planId) || { resolved: 0, clicked: 0, success: 0, productId: ev.productId || '' };
          pls.success++;
          planStats.set(ev.planId, pls);
        }
        break;

      case 'GEMINI_FALLBACK':
        geminiFallbacks++;
        break;

      case 'GEMINI_RESPONSE':
        if (ev.metadata && typeof (ev.metadata as any).latencyMs === 'number') {
          totalLatencyMs += (ev.metadata as any).latencyMs;
          latencySampleCount++;
        }
        break;

      case 'DEMAND_DISCOVERED':
        if ((ev.metadata as any)?.demandState === 'UNSUPPORTED') {
          catalogGapsCount++;
        }
        break;
    }
  }

  // Build top_intents array
  const top_intents = Array.from(intentCounts.entries())
    .map(([intent, count]) => ({ intent, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Build top_products array
  const top_products = Array.from(productStats.entries())
    .map(([product_id, data]) => ({
      product_id,
      resolved_count: data.resolved,
      clicked_count: data.clicked,
      checkout_success_count: data.success,
    }))
    .sort((a, b) => b.resolved_count - a.resolved_count)
    .slice(0, 15);

  // Build top_plans array
  const top_plans = Array.from(planStats.entries())
    .map(([plan_id, data]) => ({
      plan_id,
      product_id: data.productId,
      resolved_count: data.resolved,
      clicked_count: data.clicked,
      checkout_success_count: data.success,
    }))
    .sort((a, b) => b.resolved_count - a.resolved_count)
    .slice(0, 15);

  // Build unresolved_reasons array
  const unresolved_reasons = Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Build user_phrases array
  const user_phrases = Array.from(queryCounts.entries())
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  const stats: DashboardStats = {
    kpis: {
      total_sessions: Math.max(sessions.size, 1),
      total_messages: Math.max(totalMessages, events.length),
      intent_resolved: intentResolved,
      product_resolved: productResolved,
      plan_resolved: planResolved,
      clarification_requested: clarificationRequested,
      unresolved: unresolvedCount,
      action_shown: actionShown,
      action_clicked: actionClicked,
      action_expired: actionExpired,
      checkout_opened: checkoutOpened,
      checkout_success: checkoutSuccess,
    },
    top_intents,
    top_products,
    top_plans,
    unresolved_reasons,
    user_phrases,
  };

  // Conversion rate: checkout_success / max(checkout_opened, 1)
  const conversionRate = checkoutOpened > 0 ? (checkoutSuccess / checkoutOpened) * 100 : 0;
  const resolutionRate = totalMessages > 0 ? (intentResolved / totalMessages) * 100 : 0;
  const avgLatencyMs = latencySampleCount > 0 ? Math.round(totalLatencyMs / latencySampleCount) : 240;
  const fallbackRate = totalMessages > 0 ? (geminiFallbacks / totalMessages) * 100 : 0;

  const heroKpis: HeroKpis = {
    conversionRate: Math.min(conversionRate, 100),
    avgLatencyMs,
    fallbackRate: Math.min(fallbackRate, 100),
    catalogGapsCount,
    resolutionRate: Math.min(resolutionRate, 100),
    totalMessages: stats.kpis.total_messages,
    totalSessions: stats.kpis.total_sessions,
  };

  return { stats, heroKpis };
}
