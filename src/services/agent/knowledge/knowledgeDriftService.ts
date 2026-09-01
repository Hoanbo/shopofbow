// src/services/agent/knowledge/knowledgeDriftService.ts
// BOW AGENT V3.3 — PHASE 6.9: KNOWLEDGE DRIFT DETECTION ENGINE
//
// Detects knowledge degradation across FAQs, Negative Policies, Query distributions,
// Domain Coverages, and Response behaviors.
//
// HARD CONTRACTS:
//   - Zero Auto-Mutation: AI only detects, scores, and alerts. Never mutates knowledge.
//   - Zero DB Migrations: Reads from existing events & faqs tables.
//   - High Performance: In-memory cached with deterministic mathematical scoring.

import { getActiveShopAdapter } from '../adapters/shopAdapter';
import type {
  FaqDriftDetail,
  NegativePolicyDriftDetail,
  QueryDriftDetail,
  CoverageDriftDetail,
  KnowledgeDriftReport,
  DriftSeverity,
  DriftStatus,
  NegativePolicy,
  DomainCoverageReport,
} from '../monitoring/analyticsTypes';
import { calculateKnowledgeCoverage, detectKnowledgeConflicts } from './knowledgeIntelligenceService';
import { getNegativePolicies } from './negativePolicyService';

// ---------------------------------------------------------------------------
// 1. IN-MEMORY CACHING
// ---------------------------------------------------------------------------

let cachedDriftReport: KnowledgeDriftReport | null = null;
let driftCacheExpiry = 0;
const DRIFT_CACHE_TTL_MS = 30_000; // 30 seconds

export function clearKnowledgeDriftCache(): void {
  cachedDriftReport = null;
  driftCacheExpiry = 0;
}

// ---------------------------------------------------------------------------
// 2. SEVERITY & STATUS CLASSIFICATION HELPERS
// ---------------------------------------------------------------------------

export function scoreToDriftSeverity(score: number): DriftSeverity {
  if (score < 20) return 'NONE';
  if (score < 40) return 'LOW';
  if (score < 60) return 'MODERATE';
  if (score < 80) return 'HIGH';
  return 'CRITICAL';
}

export function scoreToDriftStatus(score: number): DriftStatus {
  if (score < 20) return 'STABLE';
  if (score < 40) return 'WATCH';
  if (score < 60) return 'DEGRADED';
  return 'CRITICAL';
}

// ---------------------------------------------------------------------------
// 3. FAQ DRIFT DETECTION
// ---------------------------------------------------------------------------

export function detectFaqDrift(
  faq: { id: string; question: string; created_at?: string; usageCount?: number },
  recentEvents: any[] = [],
  baselineUsageCount = 10,
  conflictCount = 0
): FaqDriftDetail {
  const reasons: string[] = [];
  let penaltyPoints = 0;

  // 1. Usage drop
  const actualUsage = faq.usageCount ?? 0;
  const usageDelta = baselineUsageCount > 0 ? ((baselineUsageCount - actualUsage) / baselineUsageCount) * 100 : 0;
  const usageDrop = Math.max(0, Math.min(100, Math.round(usageDelta)));
  if (usageDrop >= 50 && baselineUsageCount >= 5) {
    penaltyPoints += 25;
    reasons.push(`Tần suất sử dụng giảm ${usageDrop}% so với baseline`);
  }

  // 2. Match rate drop based on events
  const faqEvents = recentEvents.filter(
    (e) => e.metadata?.faqId === faq.id || (e.event_type === 'FAQ_USED' && e.metadata?.question === faq.question)
  );
  const gapEvents = recentEvents.filter((e) => e.event_type === 'KNOWLEDGE_GAP_DETECTED');
  const matchedCount = faqEvents.length;
  const totalRelevant = matchedCount + Math.min(gapEvents.length, 10);
  const matchRate = totalRelevant > 0 ? (matchedCount / totalRelevant) * 100 : 80;
  const matchRateDrop = Math.max(0, Math.min(100, Math.round(100 - matchRate)));

  if (matchRateDrop >= 40) {
    penaltyPoints += 30;
    reasons.push(`Tỷ lệ khớp câu hỏi giảm ${matchRateDrop}%`);
  } else if (matchRateDrop >= 20) {
    penaltyPoints += 15;
    reasons.push(`Tỷ lệ khớp câu hỏi giảm nhẹ (${matchRateDrop}%)`);
  }

  // 3. Age degradation
  const createdAtMs = faq.created_at ? new Date(faq.created_at).getTime() : Date.now();
  const ageInDays = Math.max(0, Math.floor((Date.now() - createdAtMs) / (1000 * 60 * 60 * 24)));
  if (ageInDays > 120 && actualUsage === 0) {
    penaltyPoints += 25;
    reasons.push(`FAQ đã tồn tại ${ageInDays} ngày mà không có lượt sử dụng`);
  } else if (ageInDays > 90) {
    penaltyPoints += 10;
    reasons.push(`FAQ đã hơn ${ageInDays} ngày chưa được rà soát nội dung`);
  }

  // 4. Conflicts
  if (conflictCount > 0) {
    penaltyPoints += conflictCount * 15;
    reasons.push(`Phát hiện ${conflictCount} mâu thuẫn chính sách liên quan`);
  }

  const normalizedScore = Math.min(100, penaltyPoints);
  const driftSeverity = scoreToDriftSeverity(normalizedScore);

  return {
    faqId: faq.id,
    question: faq.question,
    matchRateDrop,
    usageDrop,
    unmatchedVariantsCount: Math.max(0, Math.floor(matchRateDrop / 10)),
    ageInDays,
    driftSeverity,
    reasons: reasons.length > 0 ? reasons : ['FAQ hoạt động ổn định'],
  };
}

// ---------------------------------------------------------------------------
// 4. NEGATIVE POLICY DRIFT DETECTION
// ---------------------------------------------------------------------------

export function detectNegativePolicyDrift(
  policy: NegativePolicy,
  recentEvents: any[] = [],
  conflictCount = 0
): NegativePolicyDriftDetail {
  const reasons: string[] = [];
  let penaltyPoints = 0;

  // Usage and match tracking
  const policyHits = recentEvents.filter(
    (e) => e.event_type === 'NEGATIVE_POLICY_MATCHED' && (e.metadata?.policyKey === policy.policyKey || e.metadata?.policyId === policy.id)
  ).length;

  const matchRateDrop = policyHits === 0 ? 30 : 0;
  if (policyHits === 0) {
    penaltyPoints += 15;
    reasons.push('Không có lượt kích hoạt trong chu kỳ quan sát');
  }

  // Scope drift: Check if policy scope is too broad or too narrow
  let scopeDrift: 'TOO_BROAD' | 'TOO_NARROW' | 'STABLE' = 'STABLE';
  if (policy.scopeValue.length <= 3 && policy.scopeType === 'GLOBAL') {
    scopeDrift = 'TOO_BROAD';
    penaltyPoints += 30;
    reasons.push('Phạm vi chính sách quá rộng, có nguy cơ chặn nhầm câu hỏi hợp lệ');
  } else if (policy.normalizedQuestion.length > 80) {
    scopeDrift = 'TOO_NARROW';
    penaltyPoints += 20;
    reasons.push('Mẫu câu hỏi quá chi tiết, có thể bỏ sót các biến thể tương đương');
  }

  // Conflict penalty
  if (conflictCount > 0) {
    penaltyPoints += conflictCount * 20;
    reasons.push(`Xung đột với ${conflictCount} FAQ chính sách có sẵn`);
  }

  const normalizedScore = Math.min(100, penaltyPoints);
  const driftSeverity = scoreToDriftSeverity(normalizedScore);

  return {
    policyId: policy.id,
    policyKey: policy.policyKey,
    matchRateDrop,
    falseInterceptCount: scopeDrift === 'TOO_BROAD' ? 5 : 0,
    scopeDrift,
    driftSeverity,
    reasons: reasons.length > 0 ? reasons : ['Negative Policy hiệu lực tốt'],
  };
}

// ---------------------------------------------------------------------------
// 5. QUERY & INTENT DISTRIBUTION DRIFT DETECTION
// ---------------------------------------------------------------------------

export function detectIntentDrift(
  currentEvents: any[] = [],
  baselineEvents: any[] = []
): { intent: string; changePercent: number; isDrift: boolean }[] {
  const currentCounts: Record<string, number> = {};
  const baselineCounts: Record<string, number> = {};

  for (const e of currentEvents) {
    const intent = e.intent || e.metadata?.intent || 'UNKNOWN';
    currentCounts[intent] = (currentCounts[intent] || 0) + 1;
  }
  for (const e of baselineEvents) {
    const intent = e.intent || e.metadata?.intent || 'UNKNOWN';
    baselineCounts[intent] = (baselineCounts[intent] || 0) + 1;
  }

  const allIntents = Array.from(new Set([...Object.keys(currentCounts), ...Object.keys(baselineCounts)]));
  const totalCurrent = Math.max(1, currentEvents.length);
  const totalBaseline = Math.max(1, baselineEvents.length);

  return allIntents.map((intent) => {
    const currPct = ((currentCounts[intent] || 0) / totalCurrent) * 100;
    const basePct = ((baselineCounts[intent] || 0) / totalBaseline) * 100;
    const delta = Math.round(currPct - basePct);
    return {
      intent,
      changePercent: delta,
      isDrift: Math.abs(delta) >= 20,
    };
  });
}

export function detectQueryDistributionDrift(
  currentEvents: any[] = [],
  baselineEvents: any[] = []
): QueryDriftDetail[] {
  const intentDrifts = detectIntentDrift(currentEvents, baselineEvents);

  return intentDrifts.map((id, index) => {
    const absChange = Math.abs(id.changePercent);
    const driftSeverity: DriftSeverity =
      absChange >= 40 ? 'HIGH' : absChange >= 25 ? 'MODERATE' : absChange >= 15 ? 'LOW' : 'NONE';

    return {
      clusterId: `cluster-drift-${index + 1}`,
      canonicalTopic: `Intent: ${id.intent}`,
      volumeChangePercentage: id.changePercent,
      intentShiftDetected: id.isDrift,
      driftSeverity,
    };
  });
}

// ---------------------------------------------------------------------------
// 6. DOMAIN COVERAGE DRIFT DETECTION
// ---------------------------------------------------------------------------

export function detectCoverageDrift(
  currentCoverage: DomainCoverageReport,
  baselineCoverage?: DomainCoverageReport
): CoverageDriftDetail[] {
  const baselineMap = new Map<string, number>();
  if (baselineCoverage) {
    for (const d of baselineCoverage.domainCoverages) {
      baselineMap.set(d.domain, d.coveragePercentage);
    }
  }

  return currentCoverage.domainCoverages.map((curr) => {
    const basePct = baselineMap.get(curr.domain) ?? 85; // Default 85% baseline
    const drop = Math.max(0, Math.round(basePct - curr.coveragePercentage));
    const driftSeverity: DriftSeverity =
      drop >= 30 ? 'CRITICAL' : drop >= 20 ? 'HIGH' : drop >= 10 ? 'MODERATE' : drop > 0 ? 'LOW' : 'NONE';

    return {
      domain: curr.domain,
      coverageDropPercentage: drop,
      gapIncreaseCount: curr.gapCount,
      driftSeverity,
    };
  });
}

export function detectMatchRateDrift(baselineMatchRate: number, currentMatchRate: number): {
  drop: number;
  driftSeverity: DriftSeverity;
} {
  const drop = Math.max(0, Math.round(baselineMatchRate - currentMatchRate));
  const driftSeverity = scoreToDriftSeverity(drop * 2); // 10% drop -> 20pts (LOW), 20% -> 40pts (MODERATE)
  return { drop, driftSeverity };
}

export function detectConflictDrift(currentConflictCount: number, baselineConflictCount: number): {
  surge: number;
  driftSeverity: DriftSeverity;
} {
  const surge = Math.max(0, currentConflictCount - baselineConflictCount);
  const driftSeverity: DriftSeverity =
    surge >= 3 ? 'CRITICAL' : surge === 2 ? 'HIGH' : surge === 1 ? 'MODERATE' : 'NONE';
  return { surge, driftSeverity };
}

export function detectResponseBehaviorDrift(events: any[] = []): {
  shiftedCount: number;
  severity: DriftSeverity;
  details: string[];
} {
  const details: string[] = [];
  // Inspect events for fallback occurrences or source changes
  const fallbackEvents = events.filter((e) => e.event_type === 'GEMINI_FALLBACK');
  const shiftedCount = fallbackEvents.length;

  if (shiftedCount >= 5) {
    details.push(`Ghi nhận ${shiftedCount} lần fallback sang bộ điều hướng dự phòng`);
  }

  const severity: DriftSeverity =
    shiftedCount >= 10 ? 'HIGH' : shiftedCount >= 4 ? 'MODERATE' : shiftedCount > 0 ? 'LOW' : 'NONE';

  return { shiftedCount, severity, details };
}

// ---------------------------------------------------------------------------
// 7. OVERALL DRIFT SCORE COMPOSITE
// ---------------------------------------------------------------------------

export function calculateDriftScore(params: {
  faqDrifts: FaqDriftDetail[];
  policyDrifts: NegativePolicyDriftDetail[];
  queryDrifts: QueryDriftDetail[];
  coverageDrifts: CoverageDriftDetail[];
}): { score: number; status: DriftStatus; severity: DriftSeverity } {
  let weightedPoints = 0;

  // 1. FAQ Drifts (35% weight)
  if (params.faqDrifts.length > 0) {
    const faqAvg =
      params.faqDrifts.reduce((acc, f) => {
        const factor = f.driftSeverity === 'CRITICAL' ? 100 : f.driftSeverity === 'HIGH' ? 70 : f.driftSeverity === 'MODERATE' ? 45 : f.driftSeverity === 'LOW' ? 25 : 0;
        return acc + factor;
      }, 0) / params.faqDrifts.length;
    weightedPoints += faqAvg * 0.35;
  }

  // 2. Policy Drifts (25% weight)
  if (params.policyDrifts.length > 0) {
    const polAvg =
      params.policyDrifts.reduce((acc, p) => {
        const factor = p.driftSeverity === 'CRITICAL' ? 100 : p.driftSeverity === 'HIGH' ? 70 : p.driftSeverity === 'MODERATE' ? 45 : p.driftSeverity === 'LOW' ? 25 : 0;
        return acc + factor;
      }, 0) / params.policyDrifts.length;
    weightedPoints += polAvg * 0.25;
  }

  // 3. Coverage Drifts (25% weight)
  if (params.coverageDrifts.length > 0) {
    const covAvg =
      params.coverageDrifts.reduce((acc, c) => {
        const factor = c.driftSeverity === 'CRITICAL' ? 100 : c.driftSeverity === 'HIGH' ? 70 : c.driftSeverity === 'MODERATE' ? 45 : c.driftSeverity === 'LOW' ? 25 : 0;
        return acc + factor;
      }, 0) / params.coverageDrifts.length;
    weightedPoints += covAvg * 0.25;
  }

  // 4. Query / Intent Drifts (15% weight)
  if (params.queryDrifts.length > 0) {
    const qAvg =
      params.queryDrifts.reduce((acc, q) => {
        const factor = q.driftSeverity === 'CRITICAL' ? 100 : q.driftSeverity === 'HIGH' ? 70 : q.driftSeverity === 'MODERATE' ? 45 : q.driftSeverity === 'LOW' ? 25 : 0;
        return acc + factor;
      }, 0) / params.queryDrifts.length;
    weightedPoints += qAvg * 0.15;
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(weightedPoints)));
  const status = scoreToDriftStatus(finalScore);
  const severity = scoreToDriftSeverity(finalScore);

  return { score: finalScore, status, severity };
}

// ---------------------------------------------------------------------------
// 8. MASTER DRIFT DETECTION PIPELINE
// ---------------------------------------------------------------------------

export async function detectKnowledgeDrift(
  providedFaqs?: Array<{ id: string; question: string; answer?: string; created_at?: string }>,
  providedPolicies?: NegativePolicy[],
  providedEvents?: any[],
  forceRefresh = false
): Promise<KnowledgeDriftReport> {
  const now = Date.now();
  if (!forceRefresh && cachedDriftReport && now < driftCacheExpiry) {
    return cachedDriftReport;
  }

  try {
    // 1. Fetch FAQs
    let faqs = providedFaqs;
    if (!faqs) {
      const dbFaqs = await getActiveShopAdapter().knowledge.getFaqs({ activeOnly: false });
      faqs = dbFaqs || [];
    }

    // 2. Fetch Negative Policies
    let policies = providedPolicies;
    if (!policies) {
      policies = await getNegativePolicies();
    }

    // 3. Fetch Events
    let events = providedEvents;
    if (!events) {
      const dbEvents = await getActiveShopAdapter().storage!.getAgentEvents(undefined, 200);
      events = dbEvents || [];
    }

    // 4. Detect conflicts
    const conflicts = detectKnowledgeConflicts(faqs as any, policies);

    // 5. Evaluate FAQ drifts
    const faqDrifts: FaqDriftDetail[] = (faqs || []).map((faq) => {
      const relatedConflicts = conflicts.filter((c) => c.entityA?.id === faq.id || c.entityB?.id === faq.id).length;
      return detectFaqDrift(faq, events || [], 10, relatedConflicts);
    });

    // 6. Evaluate Negative Policy drifts
    const policyDrifts: NegativePolicyDriftDetail[] = (policies || []).map((pol) => {
      const relatedConflicts = conflicts.filter((c) => c.entityA?.id === pol.id || c.entityB?.id === pol.id).length;
      return detectNegativePolicyDrift(pol, events || [], relatedConflicts);
    });

    // 7. Evaluate Query drifts
    const midPoint = Math.floor((events || []).length / 2);
    const recentEvents = (events || []).slice(0, midPoint);
    const baselineEvents = (events || []).slice(midPoint);
    const queryDrifts = detectQueryDistributionDrift(recentEvents, baselineEvents);

    // 8. Evaluate Coverage drifts
    const currentCoverage = calculateKnowledgeCoverage(faqs as any, policies, events || [], []);
    const coverageDrifts = detectCoverageDrift(currentCoverage);

    // 9. Calculate Overall Drift Score
    const { score: overallDriftScore, status: driftStatus } = calculateDriftScore({
      faqDrifts,
      policyDrifts,
      queryDrifts,
      coverageDrifts,
    });

    const report: KnowledgeDriftReport = {
      overallDriftScore,
      driftStatus,
      faqDrifts,
      policyDrifts,
      queryDrifts,
      coverageDrifts,
      analyzedAt: new Date().toISOString(),
    };

    cachedDriftReport = report;
    driftCacheExpiry = now + DRIFT_CACHE_TTL_MS;

    return report;
  } catch (err: any) {
    console.error('[KnowledgeDriftService] Error detecting knowledge drift:', err);
    // Resilient Fallback
    return {
      overallDriftScore: 0,
      driftStatus: 'STABLE',
      faqDrifts: [],
      policyDrifts: [],
      queryDrifts: [],
      coverageDrifts: [],
      analyzedAt: new Date().toISOString(),
    };
  }
}
