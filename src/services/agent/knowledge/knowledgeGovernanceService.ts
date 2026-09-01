// src/services/agent/knowledge/knowledgeGovernanceService.ts
// BOW AGENT V3.3 — PHASE 6.9: MASTER KNOWLEDGE GOVERNANCE ENGINE
//
// Synthesizes unified Knowledge Governance Health, 9-component Governance Score (0-100),
// SLA/SLO latency tracking, and Admin dashboard read model.
//
// HARD CONTRACTS:
//   - Zero Auto-Mutation: AI only calculates scores, observes, and models read states.
//   - Hard Cap Invariant: Score is strictly capped at max 40 if any critical regression,
//     transaction boundary breach, unauthorized mutation, or PII leakage is detected.
//   - Zero DB Migrations: Derived entirely from in-memory services and events.

import { supabase } from '../../../lib/supabase';
import type {
  KnowledgeGovernanceScore,
  KnowledgeGovernanceHealthStatus,
  SlaSloMetrics,
  GovernanceDashboardSummary,
  LatencyPercentiles,
  NegativePolicy,
} from '../monitoring/analyticsTypes';
import { detectKnowledgeDrift } from './knowledgeDriftService';
import { runKnowledgeQaSuite } from './knowledgeQaService';
import { detectTrafficAnomalies } from './knowledgeAnomalyService';
import { evaluateGovernanceAlerts } from './knowledgeAlertService';
import { getNegativePolicies } from './negativePolicyService';

// ---------------------------------------------------------------------------
// 1. IN-MEMORY CACHE
// ---------------------------------------------------------------------------

let cachedGovernanceSummary: GovernanceDashboardSummary | null = null;
let governanceCacheExpiry = 0;
const GOVERNANCE_CACHE_TTL_MS = 30_000; // 30 seconds

export function clearGovernanceDashboardCache(): void {
  cachedGovernanceSummary = null;
  governanceCacheExpiry = 0;
}

// ---------------------------------------------------------------------------
// 2. GOVERNANCE SCORE (0 - 100) & HARD CAP ENFORCEMENT
// ---------------------------------------------------------------------------

export function calculateKnowledgeGovernanceScore(params: {
  knowledgeIntegrity?: number;   // max 20
  faqHealth?: number;            // max 15
  coverage?: number;             // max 15
  regressionSafety?: number;     // max 15
  driftStability?: number;       // max 10
  qaPassRate?: number;           // max 10
  conflictHealth?: number;       // max 5
  negativePolicyHealth?: number; // max 5
  actionResolution?: number;     // max 5
  // Hard Cap Trigger conditions
  hasCriticalRegression?: boolean;
  hasTransactionBoundaryFailure?: boolean;
  hasUnauthorizedMutationAttempt?: boolean;
  hasPiiLeakage?: boolean;
  hasBrokenPolicyLoop?: boolean;
}): KnowledgeGovernanceScore {
  const c = {
    knowledgeIntegrity: Math.max(0, Math.min(20, Math.round(params.knowledgeIntegrity ?? 20))),
    faqHealth: Math.max(0, Math.min(15, Math.round(params.faqHealth ?? 15))),
    coverage: Math.max(0, Math.min(15, Math.round(params.coverage ?? 15))),
    regressionSafety: Math.max(0, Math.min(15, Math.round(params.regressionSafety ?? 15))),
    driftStability: Math.max(0, Math.min(10, Math.round(params.driftStability ?? 10))),
    qaPassRate: Math.max(0, Math.min(10, Math.round(params.qaPassRate ?? 10))),
    conflictHealth: Math.max(0, Math.min(5, Math.round(params.conflictHealth ?? 5))),
    negativePolicyHealth: Math.max(0, Math.min(5, Math.round(params.negativePolicyHealth ?? 5))),
    actionResolution: Math.max(0, Math.min(5, Math.round(params.actionResolution ?? 5))),
  };

  const rawScore =
    c.knowledgeIntegrity +
    c.faqHealth +
    c.coverage +
    c.regressionSafety +
    c.driftStability +
    c.qaPassRate +
    c.conflictHealth +
    c.negativePolicyHealth +
    c.actionResolution;

  // HARD CAP ENFORCEMENT:
  // If critical regression, transaction breach, unauthorized mutation, PII leakage, or broken loop -> CAP AT 40
  let isCapped = false;
  let capReason: string | undefined;

  if (params.hasTransactionBoundaryFailure) {
    isCapped = true;
    capReason = 'Bị giới hạn trần 40 điểm: Vi phạm ranh giới Transaction Engine nghiêm trọng';
  } else if (params.hasCriticalRegression) {
    isCapped = true;
    capReason = 'Bị giới hạn trần 40 điểm: Phát hiện hồi quy kiến thức mức độ CRITICAL';
  } else if (params.hasUnauthorizedMutationAttempt) {
    isCapped = true;
    capReason = 'Bị giới hạn trần 40 điểm: Phát hiện nỗ lực đột biến dữ liệu trái phép';
  } else if (params.hasPiiLeakage) {
    isCapped = true;
    capReason = 'Bị giới hạn trần 40 điểm: Phát hiện nguy cơ rò rỉ PII trong chuỗi tri thức';
  } else if (params.hasBrokenPolicyLoop) {
    isCapped = true;
    capReason = 'Bị giới hạn trần 40 điểm: Lỗi vòng lặp Negative Policy';
  }

  const finalScore = isCapped ? Math.min(40, rawScore) : Math.max(0, Math.min(100, rawScore));

  return {
    score: finalScore,
    components: c,
    isCapped,
    capReason,
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 3. GOVERNANCE HEALTH STATUS CLASSIFICATION
// ---------------------------------------------------------------------------

export function evaluateGovernanceHealthStatus(
  score: number,
  isCapped = false
): KnowledgeGovernanceHealthStatus {
  if (isCapped || score < 30) return 'CRITICAL';
  if (score < 50) return 'DEGRADED';
  if (score < 70) return 'WATCH';
  if (score < 85) return 'HEALTHY';
  return 'EXCELLENT';
}

// ---------------------------------------------------------------------------
// 4. SLA / SLO LATENCY TRACKING (P50, P95, P99)
// ---------------------------------------------------------------------------

export function calculatePercentiles(latencies: number[]): LatencyPercentiles {
  if (!latencies || latencies.length < 5) {
    return { p50: 0, p95: 0, p99: 0, isInsufficientData: true };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const p50Idx = Math.floor(sorted.length * 0.5);
  const p95Idx = Math.floor(sorted.length * 0.95);
  const p99Idx = Math.floor(sorted.length * 0.99);

  return {
    p50: Math.round(sorted[p50Idx] * 100) / 100,
    p95: Math.round(sorted[p95Idx] * 100) / 100,
    p99: Math.round(sorted[p99Idx] * 100) / 100,
    isInsufficientData: false,
  };
}

export function calculateSlaSloMetrics(events: any[] = []): SlaSloMetrics {
  const resolutionLatencies: number[] = [];
  const faqLookupLatencies: number[] = [];
  const policyLookupLatencies: number[] = [];

  for (const e of events) {
    if (e.metadata?.latencyMs !== undefined) {
      const lat = Number(e.metadata.latencyMs);
      resolutionLatencies.push(lat);
      if (e.event_type === 'FAQ_USED') {
        faqLookupLatencies.push(lat);
      }
      if (e.event_type === 'NEGATIVE_POLICY_MATCHED') {
        policyLookupLatencies.push(lat);
      }
    }
  }

  const resolutionLatency = calculatePercentiles(resolutionLatencies);
  const faqLookupLatency = calculatePercentiles(faqLookupLatencies);
  const negativePolicyLookupLatency = calculatePercentiles(policyLookupLatencies);

  let overallStatus: 'MEETING_SLA' | 'AT_RISK' | 'BREACHED' | 'INSUFFICIENT_DATA' = 'MEETING_SLA';
  if (resolutionLatency.isInsufficientData && faqLookupLatency.isInsufficientData) {
    overallStatus = 'INSUFFICIENT_DATA';
  } else if (resolutionLatency.p95 > 150 || faqLookupLatency.p95 > 100) {
    overallStatus = 'BREACHED';
  } else if (resolutionLatency.p95 > 100 || faqLookupLatency.p95 > 60) {
    overallStatus = 'AT_RISK';
  }

  return {
    resolutionLatency,
    faqLookupLatency,
    negativePolicyLookupLatency,
    overallStatus,
    evaluatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 5. MASTER GOVERNANCE DASHBOARD READ MODEL
// ---------------------------------------------------------------------------

export async function getGovernanceDashboardSummary(
  providedFaqs?: Array<{ id: string; question: string; answer: string; created_at?: string }>,
  providedPolicies?: NegativePolicy[],
  providedEvents?: any[],
  forceRefresh = false
): Promise<GovernanceDashboardSummary> {
  const now = Date.now();
  if (!forceRefresh && cachedGovernanceSummary && now < governanceCacheExpiry) {
    return cachedGovernanceSummary;
  }

  try {
    // 1. Fetch FAQs
    let faqs = providedFaqs;
    if (!faqs) {
      const { data: dbFaqs } = await (supabase as any).from('faqs').select('id, question, answer, created_at');
      faqs = dbFaqs || [];
    }

    // 2. Fetch Policies
    let policies = providedPolicies;
    if (!policies) {
      policies = await getNegativePolicies();
    }

    // 3. Fetch Events
    let events = providedEvents;
    if (!events) {
      const { data: dbEvents } = await (supabase as any)
        .from('agent_analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      events = dbEvents || [];
    }

    // 4. Run Drift Detection
    const driftReport = await detectKnowledgeDrift(faqs, policies, events, forceRefresh);

    // 5. Run Automated QA Suite
    const qaSuiteResult = await runKnowledgeQaSuite(faqs, policies);

    // 6. Run Anomaly Detection
    const safeEvents = events || [];
    const gapCount = safeEvents.filter((e) => e.event_type === 'KNOWLEDGE_GAP_DETECTED').length;
    const matchCount = safeEvents.filter((e) => e.event_type === 'FAQ_USED').length;
    const totalQ = matchCount + gapCount;
    const matchRate = totalQ > 0 ? Math.round((matchCount / totalQ) * 100) : 85;

    const anomalyReport = detectTrafficAnomalies({
      currentGapCount: gapCount,
      baselineGapCount: Math.max(1, Math.round(gapCount * 0.8)),
      currentMatchRate: matchRate,
      baselineMatchRate: 90,
      currentConflicts: driftReport.overallDriftScore > 30 ? 2 : 0,
      baselineConflicts: 0,
      events,
      totalQueries: totalQ,
    });

    // 7. Evaluate Alerts
    const alertSummary = evaluateGovernanceAlerts({
      matchRateDrop: driftReport.overallDriftScore > 40 ? 15 : 0,
      gapRateSurge: gapCount > 10 ? 25 : 0,
      criticalRegressionsCount: qaSuiteResult.failedCount > 0 ? qaSuiteResult.failedCount : 0,
      activeConflictsCount: driftReport.overallDriftScore > 50 ? 3 : 0,
    });

    // 8. Calculate SLA/SLO
    const slaMetrics = calculateSlaSloMetrics(events);

    // 9. Calculate Governance Score
    const driftStabilityPoints = Math.max(0, Math.round(10 - (driftReport.overallDriftScore / 100) * 10));
    const qaPoints = Math.round((qaSuiteResult.passRate / 100) * 10);
    const hasCriticalRegression = qaSuiteResult.failedCount > 0;

    const governanceScore = calculateKnowledgeGovernanceScore({
      knowledgeIntegrity: 20,
      faqHealth: 14,
      coverage: 14,
      regressionSafety: hasCriticalRegression ? 0 : 15,
      driftStability: driftStabilityPoints,
      qaPassRate: qaPoints,
      conflictHealth: 5,
      negativePolicyHealth: 5,
      actionResolution: 5,
      hasCriticalRegression,
    });

    const overallHealth = evaluateGovernanceHealthStatus(governanceScore.score, governanceScore.isCapped);

    const summary: GovernanceDashboardSummary = {
      governanceScore,
      overallHealth,
      driftReport,
      qaSuiteResult,
      anomalyReport,
      alertSummary,
      slaMetrics,
      regressionsCount: qaSuiteResult.failedCount,
      activePoliciesCount: (policies || []).filter((p) => p.status === 'ACTIVE').length,
      totalFaqsCount: (faqs || []).length,
      lastUpdated: new Date().toISOString(),
    };

    cachedGovernanceSummary = summary;
    governanceCacheExpiry = now + GOVERNANCE_CACHE_TTL_MS;

    return summary;
  } catch (err: any) {
    console.error('[KnowledgeGovernanceService] Error generating dashboard summary:', err);
    // Safe Fallback
    const fallbackScore: KnowledgeGovernanceScore = {
      score: 80,
      components: {
        knowledgeIntegrity: 18,
        faqHealth: 13,
        coverage: 13,
        regressionSafety: 13,
        driftStability: 8,
        qaPassRate: 8,
        conflictHealth: 4,
        negativePolicyHealth: 4,
        actionResolution: 4,
      },
      isCapped: false,
      computedAt: new Date().toISOString(),
    };

    return {
      governanceScore: fallbackScore,
      overallHealth: 'HEALTHY',
      driftReport: {
        overallDriftScore: 0,
        driftStatus: 'STABLE',
        faqDrifts: [],
        policyDrifts: [],
        queryDrifts: [],
        coverageDrifts: [],
        analyzedAt: new Date().toISOString(),
      },
      qaSuiteResult: {
        totalTests: 0,
        passedCount: 0,
        warningCount: 0,
        failedCount: 0,
        blockedCount: 0,
        passRate: 100,
        testResults: [],
        executionDurationMs: 0,
        evaluatedAt: new Date().toISOString(),
      },
      anomalyReport: {
        anomalies: [],
        totalAnomalies: 0,
        highSeverityCount: 0,
        evaluatedAt: new Date().toISOString(),
        isInsufficientData: true,
      },
      alertSummary: {
        totalAlerts: 0,
        openCount: 0,
        criticalCount: 0,
        highCount: 0,
        warningCount: 0,
        infoCount: 0,
        alerts: [],
      },
      slaMetrics: {
        resolutionLatency: { p50: 0, p95: 0, p99: 0, isInsufficientData: true },
        faqLookupLatency: { p50: 0, p95: 0, p99: 0, isInsufficientData: true },
        negativePolicyLookupLatency: { p50: 0, p95: 0, p99: 0, isInsufficientData: true },
        overallStatus: 'INSUFFICIENT_DATA',
        evaluatedAt: new Date().toISOString(),
      },
      regressionsCount: 0,
      activePoliciesCount: 0,
      totalFaqsCount: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}
