// src/services/agent/knowledge/knowledgeGapAggregator.ts
// BOW Agent V3.3 Phase 6.0 — Knowledge Gap Aggregator & Observability Insights

import type { AgentAnalyticsEvent } from '../monitoring/analyticsTypes';
import {
  deduplicateKnowledgeGaps,
  normalizeKnowledgeQuestion,
  type DeduplicatedKnowledgeGap,
  type KnowledgeGapCandidate,
} from './knowledgeGapDetector';

export interface KnowledgeGapCategoryBreakdown {
  policy: number;
  technical: number;
  support: number;
  troubleshooting: number;
  general: number;
  other: number;
}

export interface ObservabilitySummary {
  totalObservabilityEvents: number;
  geminiCallsCount: number;
  geminiFallbackCount: number;
  deterministicCallsCount: number;
  faqHitsCount: number;
  knowledgeGapsDetectedCount: number;
  averageLatencyMs: number;
  topKnowledgeGaps: DeduplicatedKnowledgeGap[];
  categoryBreakdown: KnowledgeGapCategoryBreakdown;
}

/**
 * Tổng hợp sự kiện Knowledge Gap từ Agent Analytics Events
 */
export function aggregateKnowledgeGapEvents(
  events: AgentAnalyticsEvent[],
  timeWindow?: { start: Date | null; end: Date | null }
): ObservabilitySummary {
  let totalEvents = 0;
  let geminiCalls = 0;
  let geminiFallbacks = 0;
  let deterministicCalls = 0;
  let faqHits = 0;
  let knowledgeGapsCount = 0;
  let totalLatency = 0;
  let latencySampleCount = 0;

  const candidates: KnowledgeGapCandidate[] = [];

  for (const ev of events) {
    if (timeWindow?.start && ev.createdAt && new Date(ev.createdAt) < timeWindow.start) continue;
    if (timeWindow?.end && ev.createdAt && new Date(ev.createdAt) > timeWindow.end) continue;

    totalEvents++;

    // Track Gemini vs Deterministic
    if (ev.eventType === 'GEMINI_REQUEST' || ev.eventType === 'GEMINI_RESPONSE') {
      geminiCalls++;
    } else if (ev.eventType === 'GEMINI_FALLBACK') {
      geminiFallbacks++;
    }

    const meta = (ev.metadata || {}) as any;

    if (meta.responseSource === 'DETERMINISTIC') {
      deterministicCalls++;
    } else if (meta.responseSource === 'FAQ' || meta.faqHit) {
      faqHits++;
    }

    if (typeof meta.latencyMs === 'number' && meta.latencyMs > 0) {
      totalLatency += meta.latencyMs;
      latencySampleCount++;
    }

    // Extract Knowledge Gap Candidate
    if (ev.eventType === 'KNOWLEDGE_GAP_DETECTED' || meta.isKnowledgeGap) {
      knowledgeGapsCount++;
      candidates.push({
        originalQuestion: meta.originalQuestion || meta.rawQuery || 'Unknown question',
        normalizedQuestion: meta.normalizedQuestion || normalizeKnowledgeQuestion(meta.originalQuestion || meta.rawQuery || ''),
        category: meta.category || 'general',
        classification: 'KNOWLEDGE_GAP',
        confidence: meta.confidence || 0.85,
        source: meta.source || 'DETERMINISTIC',
        timestamp: ev.createdAt || new Date().toISOString(),
        sessionId: ev.sessionId || undefined,
        userId: ev.userId,
      });
    }
  }

  const topGaps = deduplicateKnowledgeGaps(candidates);

  const categoryBreakdown: KnowledgeGapCategoryBreakdown = {
    policy: 0,
    technical: 0,
    support: 0,
    troubleshooting: 0,
    general: 0,
    other: 0,
  };

  for (const gap of topGaps) {
    if (categoryBreakdown[gap.category] !== undefined) {
      categoryBreakdown[gap.category] += gap.occurrenceCount;
    } else {
      categoryBreakdown.other += gap.occurrenceCount;
    }
  }

  return {
    totalObservabilityEvents: totalEvents,
    geminiCallsCount: geminiCalls,
    geminiFallbackCount: geminiFallbacks,
    deterministicCallsCount: deterministicCalls,
    faqHitsCount: faqHits,
    knowledgeGapsDetectedCount: knowledgeGapsCount,
    averageLatencyMs: latencySampleCount > 0 ? Math.round(totalLatency / latencySampleCount) : 0,
    topKnowledgeGaps: topGaps,
    categoryBreakdown,
  };
}
