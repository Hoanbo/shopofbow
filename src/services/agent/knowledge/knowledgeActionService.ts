// src/services/agent/knowledge/knowledgeActionService.ts
// BOW AGENT V3.3 — PHASE 6.8 KNOWLEDGE ACTION CENTER & CONTINUOUS FEEDBACK LOOP
//
// INVARIANTS (Phase 4.7 → 6.8):
//   1. AI Recommendation != Production Mutation (ZERO AUTO-MUTATION)
//   2. Admin Confirmation → Production Mutation (ONLY path)
//   3. Decision Fingerprint prevents duplicate/loop recommendations
//   4. All telemetry is non-blocking (Promise.resolve().then())
//   5. Fail-closed: errors never auto-mutate production knowledge

import { agentAnalytics } from '../monitoring/agentAnalytics';
import { insertAnalyticsEvent } from '../monitoring/agentEvents';
import type {
  KnowledgeAction,
  KnowledgeActionType,
  KnowledgeActionStatus,
  EstimatedImpact,
  ActionEffectiveness,
  ActionOutcome,
  OutcomeFeedbackType,
  ObservationWindow,
  BeforeAfterSnapshot,
  KnowledgeImprovementScore,
  ActionCenterSummary,
  AdminRecommendation,
  RecommendationPriority,
} from '../monitoring/analyticsTypes';
import { getActiveShopAdapter } from '../adapters/shopAdapter';
import { clearKnowledgeIntelligenceCache } from './knowledgeIntelligenceService';
import { clearNegativePolicyCache } from './negativePolicyService';

export type { KnowledgeActionStatus };

// ---------------------------------------------------------------------------
// In-Memory Action Center Cache
// ---------------------------------------------------------------------------
let cachedActionCenter: ActionCenterSummary | null = null;
let lastActionCacheFetchTime = 0;
const ACTION_CACHE_TTL_MS = 60 * 1000; // 60s

export function clearActionCenterCache(): void {
  cachedActionCenter = null;
  lastActionCacheFetchTime = 0;
}

// ---------------------------------------------------------------------------
// 1. AUTHORIZATION GUARD
// ---------------------------------------------------------------------------

const INJECTION_PATTERNS = [
  /^i\s+am\s+admin/i,
  /^toi\s+la\s+admin/i,
  /^system\s+override/i,
  /ignore\s+previous\s+instructions/i,
  /system\s+prompt/i,
  /api[\s_-]?key/i,
  /access[\s_-]?token/i,
  /sk-[a-zA-Z0-9_\-]{8,}/,
  /bearer\s+[a-zA-Z0-9._-]{10,}/i,
  /<script/i,
  /['"]\s*or\s+['"]?1/i,
  /;\s*drop\s+table/i,
];

export function assertAdminAuthorized(adminUserId: string, _operation?: string): boolean {
  if (!adminUserId || adminUserId.trim() === '') {
    throw new Error('UNAUTHORIZED: adminUserId is required for knowledge actions.');
  }
  const lower = adminUserId.toLowerCase();
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(lower)) {
      throw new Error('UNAUTHORIZED: Invalid or injected adminUserId rejected.');
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// 2. PII SANITIZATION
// ---------------------------------------------------------------------------

export function sanitizeActionText(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .slice(0, 500)
    .replace(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/(?:\+84|0)[1-9]\d{7,9}\b/g, '[REDACTED_PHONE]')
    .replace(/\b(?:\d[ -]*?){13,16}\b/g, '[REDACTED_CARD]')
    .replace(/sk-[a-zA-Z0-9_\-]{8,}/g, '[REDACTED_KEY]')
    .replace(/bearer\s+[a-zA-Z0-9._-]{10,}/gi, '[REDACTED_TOKEN]')
    .replace(/[<>{}`\\;]/g, '');
}

// ---------------------------------------------------------------------------
// 3. DECISION FINGERPRINT (Anti-loop / Anti-duplicate)
// ---------------------------------------------------------------------------

export function calculateDecisionFingerprint(
  entityId: string,
  issueType: string,
  normalizedEvidence: string
): string {
  const raw = `${(entityId || '').trim().toLowerCase()}::${(issueType || '').trim().toLowerCase()}::${(normalizedEvidence || '').trim().toLowerCase().slice(0, 100)}`;
  // djb2 hash: deterministic, O(n), < 1ms
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) + raw.charCodeAt(i);
    hash = hash & hash; // 32-bit integer
  }
  return `fp-${Math.abs(hash).toString(36)}`;
}

// ---------------------------------------------------------------------------
// 4. IMPACT ESTIMATION (Deterministic)
// ---------------------------------------------------------------------------

export function estimateImpact(params: {
  usageCount?: number;
  healthScore?: number;
  gapCount?: number;
  conflictCount?: number;
  coveragePercentage?: number;
}): EstimatedImpact {
  let score = 0;
  if ((params.usageCount || 0) >= 50) score += 3;
  else if ((params.usageCount || 0) >= 10) score += 2;
  else if ((params.usageCount || 0) >= 1) score += 1;

  if ((params.healthScore || 100) < 50) score += 3;
  else if ((params.healthScore || 100) < 75) score += 1;

  if ((params.gapCount || 0) >= 10) score += 2;
  else if ((params.gapCount || 0) >= 3) score += 1;

  if ((params.conflictCount || 0) >= 2) score += 2;
  else if ((params.conflictCount || 0) >= 1) score += 1;

  if ((params.coveragePercentage || 100) < 60) score += 2;

  if (score >= 6) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

// ---------------------------------------------------------------------------
// 5. RISK ASSESSMENT (Deterministic)
// ---------------------------------------------------------------------------

function assessRisk(actionType: KnowledgeActionType): 'LOW' | 'MEDIUM' | 'HIGH' {
  const highRisk: KnowledgeActionType[] = [
    'EDIT_FAQ', 'MERGE_FAQ', 'DEPRECATE_FAQ',
    'EDIT_POLICY', 'DEACTIVATE_POLICY', 'RESOLVE_CONFLICT',
  ];
  const medRisk: KnowledgeActionType[] = [
    'APPROVE_GAP', 'REJECT_AND_REMEMBER', 'RESTORE_FAQ',
    'REACTIVATE_POLICY', 'MERGE_GAP',
  ];
  if (highRisk.includes(actionType)) return 'HIGH';
  if (medRisk.includes(actionType)) return 'MEDIUM';
  return 'LOW';
}

// ---------------------------------------------------------------------------
// 6. ACTION TYPE MAPPING (Recommendation → Action)
// ---------------------------------------------------------------------------

function mapRecommendationToActionType(recType: string): KnowledgeActionType {
  const mapping: Record<string, KnowledgeActionType> = {
    REVIEW_FAQ: 'REVIEW_FAQ',
    UPDATE_FAQ: 'EDIT_FAQ',
    REVIEW_NEGATIVE_POLICY: 'REVIEW_POLICY',
    INVESTIGATE_EMERGING_TOPIC: 'REVIEW_DOMAIN',
    RESOLVE_CONFLICT: 'RESOLVE_CONFLICT',
    IMPROVE_COVERAGE: 'REVIEW_DOMAIN',
    CHECK_REGRESSION: 'REVIEW_FAQ',
    RETIRE_STALE_KNOWLEDGE: 'DEPRECATE_FAQ',
  };
  return mapping[recType] || 'REVIEW_FAQ';
}

// ---------------------------------------------------------------------------
// 7. BEFORE/AFTER SNAPSHOT
// ---------------------------------------------------------------------------

export function captureBeforeSnapshot(params: {
  matchRate?: number;
  usageCount?: number;
  gapCount?: number;
  healthScore?: number;
  conflictCount?: number;
  coverage?: number;
  variantCount?: number;
}): BeforeAfterSnapshot {
  return {
    matchRateBefore: params.matchRate,
    usageCountBefore: params.usageCount,
    gapCountBefore: params.gapCount,
    healthScoreBefore: params.healthScore,
    conflictCountBefore: params.conflictCount,
    coverageBefore: params.coverage,
    variantCountBefore: params.variantCount,
    capturedAt: new Date().toISOString(),
  };
}

export function captureAfterSnapshot(
  before: BeforeAfterSnapshot,
  params: {
    matchRate?: number;
    usageCount?: number;
    gapCount?: number;
    healthScore?: number;
    conflictCount?: number;
    coverage?: number;
    variantCount?: number;
  }
): BeforeAfterSnapshot {
  return {
    matchRateBefore: before.matchRateBefore,
    matchRateAfter: params.matchRate,
    usageCountBefore: before.usageCountBefore,
    usageCountAfter: params.usageCount,
    gapCountBefore: before.gapCountBefore,
    gapCountAfter: params.gapCount,
    healthScoreBefore: before.healthScoreBefore,
    healthScoreAfter: params.healthScore,
    conflictCountBefore: before.conflictCountBefore,
    conflictCountAfter: params.conflictCount,
    coverageBefore: before.coverageBefore,
    coverageAfter: params.coverage,
    variantCountBefore: before.variantCountBefore,
    variantCountAfter: params.variantCount,
    capturedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 8. OUTCOME CALCULATION (Deterministic)
// ---------------------------------------------------------------------------

export function calculateActionOutcome(
  before: BeforeAfterSnapshot,
  after: BeforeAfterSnapshot,
  observationWindow: ObservationWindow = '7D',
  isInsufficientData = false,
  feedbackReason?: string
): ActionOutcome {
  if (isInsufficientData) {
    return {
      effectiveness: 'INSUFFICIENT_DATA',
      feedbackType: 'ACTION_NO_IMPACT',
      observationWindow,
      measuredAt: new Date().toISOString(),
      isInsufficientData: true,
      feedbackReason: feedbackReason ? sanitizeActionText(feedbackReason) : undefined,
    };
  }

  const healthDelta = ((after.healthScoreAfter ?? before.healthScoreBefore ?? 0) - (before.healthScoreBefore ?? 0));
  const matchDelta = ((after.matchRateAfter ?? before.matchRateBefore ?? 0) - (before.matchRateBefore ?? 0));
  const gapDelta = (before.gapCountBefore ?? 0) - (after.gapCountAfter ?? before.gapCountBefore ?? 0);
  const conflictDelta = (before.conflictCountBefore ?? 0) - (after.conflictCountAfter ?? before.conflictCountBefore ?? 0);
  const coverageDelta = ((after.coverageAfter ?? before.coverageBefore ?? 0) - (before.coverageBefore ?? 0));
  const variantDelta = ((after.variantCountAfter ?? before.variantCountBefore ?? 0) - (before.variantCountBefore ?? 0));

  // Composite improvement signal
  let improvementSignal = 0;
  if (healthDelta > 20) improvementSignal += 3;
  else if (healthDelta > 5) improvementSignal += 2;
  else if (healthDelta > 0) improvementSignal += 1;
  else if (healthDelta < -10) improvementSignal -= 2;

  if (matchDelta > 15) improvementSignal += 3;
  else if (matchDelta > 5) improvementSignal += 2;
  else if (matchDelta > 0) improvementSignal += 1;
  else if (matchDelta < -10) improvementSignal -= 2;

  if (gapDelta > 5) improvementSignal += 2;
  else if (gapDelta > 0) improvementSignal += 1;
  else if (gapDelta < -2) improvementSignal -= 1;

  if (conflictDelta > 0) improvementSignal += 1;
  if (coverageDelta > 5) improvementSignal += 1;

  let effectiveness: ActionEffectiveness;
  let feedbackType: OutcomeFeedbackType;

  // Regression: health or match dropped significantly, or variant coverage decreased
  if (healthDelta < -15 || matchDelta < -15 || variantDelta < -3) {
    effectiveness = 'REGRESSED';
    feedbackType = 'ACTION_REGRESSED';
  } else if (healthDelta >= 15 || matchDelta >= 15 || improvementSignal >= 5) {
    effectiveness = 'EXCELLENT';
    feedbackType = 'ACTION_IMPROVED';
  } else if (improvementSignal >= 2 || healthDelta > 0) {
    effectiveness = 'EFFECTIVE';
    feedbackType = 'ACTION_IMPROVED';
  } else if (improvementSignal >= 0) {
    effectiveness = 'NEUTRAL';
    feedbackType = 'ACTION_NO_IMPACT';
  } else {
    effectiveness = 'INEFFECTIVE';
    feedbackType = 'ACTION_FAILED';
  }

  const rawGapDelta =
    after.gapCountAfter !== undefined && before.gapCountBefore !== undefined
      ? after.gapCountAfter - before.gapCountBefore
      : gapDelta !== 0 ? -gapDelta : undefined;

  return {
    effectiveness,
    feedbackType,
    matchRateDelta: matchDelta !== 0 ? Math.round(matchDelta * 10) / 10 : undefined,
    usageDelta: (after.usageCountAfter !== undefined && before.usageCountBefore !== undefined)
      ? after.usageCountAfter - before.usageCountBefore : undefined,
    gapReduction: gapDelta > 0 ? gapDelta : undefined,
    gapCountDelta: rawGapDelta,
    conflictReduction: conflictDelta > 0 ? conflictDelta : undefined,
    healthScoreDelta: healthDelta !== 0 ? Math.round(healthDelta * 10) / 10 : undefined,
    coverageDelta: coverageDelta !== 0 ? Math.round(coverageDelta * 10) / 10 : undefined,
    variantDelta: variantDelta !== 0 ? variantDelta : undefined,
    feedbackReason: feedbackReason ? sanitizeActionText(feedbackReason) : undefined,
    observationWindow,
    measuredAt: new Date().toISOString(),
    isInsufficientData: false,
  };
}

// ---------------------------------------------------------------------------
// 9. KNOWLEDGE IMPROVEMENT SCORE (Deterministic, 0-100)
// ---------------------------------------------------------------------------

export function calculateKnowledgeImprovementScore(
  input: KnowledgeAction[] | {
    healthScore?: number;
    matchRate?: number;
    gapCount?: number;
    conflictCount?: number;
    coveragePercentage?: number;
  }
): KnowledgeImprovementScore {
  if (!Array.isArray(input)) {
    const health = Math.min(30, Math.max(0, Math.round(((input.healthScore ?? 0) / 100) * 30)));
    const match = Math.min(25, Math.max(0, Math.round(((input.matchRate ?? 0) / 100) * 25)));
    const gap = Math.min(20, Math.max(0, Math.round(Math.max(0, 20 - (input.gapCount ?? 0) * 2))));
    const conflict = Math.min(15, Math.max(0, Math.round(Math.max(0, 15 - (input.conflictCount ?? 0) * 5))));
    const coverage = Math.min(10, Math.max(0, Math.round(((input.coveragePercentage ?? 0) / 100) * 10)));
    const totalScore = Math.min(100, health + match + gap + conflict + coverage);
    const trend: 'IMPROVING' | 'STABLE' | 'DEGRADING' =
      totalScore >= 75 ? 'IMPROVING' : totalScore < 50 ? 'DEGRADING' : 'STABLE';
    return {
      score: totalScore,
      components: {
        healthImprovement: health,
        matchImprovement: match,
        gapReduction: gap,
        conflictReduction: conflict,
        coverageImprovement: coverage,
      },
      trend,
      computedAt: new Date().toISOString(),
    };
  }

  const completedActions = input;
  const actionsWithOutcome = completedActions.filter(
    (a) => a.outcome && !a.outcome.isInsufficientData
  );

  if (actionsWithOutcome.length === 0) {
    return {
      score: 0,
      components: {
        healthImprovement: 0,
        matchImprovement: 0,
        gapReduction: 0,
        conflictReduction: 0,
        coverageImprovement: 0,
      },
      trend: 'STABLE',
      computedAt: new Date().toISOString(),
    };
  }

  let totalHealth = 0;
  let totalMatch = 0;
  let totalGap = 0;
  let totalConflict = 0;
  let totalCoverage = 0;

  for (const action of actionsWithOutcome) {
    const o = action.outcome!;
    totalHealth += o.healthScoreDelta ?? 0;
    totalMatch += o.matchRateDelta ?? 0;
    totalGap += o.gapReduction ?? 0;
    totalConflict += o.conflictReduction ?? 0;
    totalCoverage += o.coverageDelta ?? 0;
  }

  const n = actionsWithOutcome.length;
  const healthComponent = Math.min(30, Math.max(0, (totalHealth / n) * 1.5));
  const matchComponent = Math.min(25, Math.max(0, (totalMatch / n) * 1.25));
  const gapComponent = Math.min(20, Math.max(0, Math.min(totalGap, 20)));
  const conflictComponent = Math.min(15, Math.max(0, Math.min(totalConflict * 3, 15)));
  const coverageComponent = Math.min(10, Math.max(0, totalCoverage / n));

  const score = Math.min(100, Math.max(0, Math.round(
    healthComponent + matchComponent + gapComponent + conflictComponent + coverageComponent
  )));

  const regressedCount = actionsWithOutcome.filter(
    (a) => a.outcome?.effectiveness === 'REGRESSED'
  ).length;
  const improvedCount = actionsWithOutcome.filter(
    (a) => a.outcome?.feedbackType === 'ACTION_IMPROVED'
  ).length;

  let trend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  if (regressedCount > improvedCount) trend = 'DEGRADING';
  else if (improvedCount > 0 && score > 20) trend = 'IMPROVING';
  else trend = 'STABLE';

  return {
    score,
    components: {
      healthImprovement: Math.round(healthComponent * 10) / 10,
      matchImprovement: Math.round(matchComponent * 10) / 10,
      gapReduction: Math.round(gapComponent * 10) / 10,
      conflictReduction: Math.round(conflictComponent * 10) / 10,
      coverageImprovement: Math.round(coverageComponent * 10) / 10,
    },
    trend,
    computedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 10. ACTION EVENT-SOURCED READ MODEL
// ---------------------------------------------------------------------------

function buildActionsFromEvents(events: any[]): KnowledgeAction[] {
  const actionsMap = new Map<string, KnowledgeAction>();

  const sorted = [...events].sort(
    (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
  );

  const now = new Date().toISOString();

  for (const ev of sorted) {
    const type = ev.event_type;
    const meta = ev.metadata || {};
    const actionId = meta.actionId;

    if (type === 'KNOWLEDGE_ACTION_CREATED' && actionId) {
      actionsMap.set(actionId, {
        id: actionId,
        type: meta.actionType || 'REVIEW_FAQ',
        recommendationId: meta.recommendationId,
        priority: meta.priority || 'MEDIUM',
        title: meta.title || '',
        reason: meta.reason || '',
        evidence: meta.evidence || '',
        suggestedAction: meta.suggestedAction || '',
        affectedEntityId: meta.affectedEntityId,
        affectedEntityType: meta.affectedEntityType,
        estimatedImpact: meta.estimatedImpact || 'LOW',
        risk: meta.risk || 'LOW',
        status: 'OPEN',
        decisionFingerprint: meta.decisionFingerprint || '',
        createdAt: ev.created_at || now,
        updatedAt: ev.created_at || now,
        adminUserId: ev.user_id || meta.adminUserId,
      });
    } else if (type === 'KNOWLEDGE_ACTION_ACKNOWLEDGED' && actionId && actionsMap.has(actionId)) {
      const a = actionsMap.get(actionId)!;
      actionsMap.set(actionId, { ...a, status: 'ACKNOWLEDGED', acknowledgedAt: ev.created_at || now, updatedAt: ev.created_at || now });
    } else if (type === 'KNOWLEDGE_ACTION_STARTED' && actionId && actionsMap.has(actionId)) {
      const a = actionsMap.get(actionId)!;
      actionsMap.set(actionId, {
        ...a,
        status: 'IN_PROGRESS',
        startedAt: ev.created_at || now,
        updatedAt: ev.created_at || now,
        beforeSnapshot: meta.beforeSnapshot || a.beforeSnapshot,
      });
    } else if (type === 'KNOWLEDGE_ACTION_COMPLETED' && actionId && actionsMap.has(actionId)) {
      const a = actionsMap.get(actionId)!;
      actionsMap.set(actionId, {
        ...a,
        status: 'COMPLETED',
        completedAt: ev.created_at || now,
        updatedAt: ev.created_at || now,
        afterSnapshot: meta.afterSnapshot || a.afterSnapshot,
        outcome: meta.outcome || a.outcome,
        improvementScore: meta.improvementScore,
      });
    } else if (type === 'KNOWLEDGE_ACTION_DISMISSED' && actionId && actionsMap.has(actionId)) {
      const a = actionsMap.get(actionId)!;
      actionsMap.set(actionId, {
        ...a,
        status: 'DISMISSED',
        dismissedBy: ev.user_id || meta.dismissedBy,
        dismissReason: meta.reason || meta.dismissReason,
        dismissedAt: ev.created_at || now,
        updatedAt: ev.created_at || now,
      });
    } else if (type === 'KNOWLEDGE_ACTION_SNOOZED' && actionId && actionsMap.has(actionId)) {
      const a = actionsMap.get(actionId)!;
      actionsMap.set(actionId, {
        ...a,
        status: 'SNOOZED',
        snoozedUntil: meta.snoozedUntil,
        snoozeReason: meta.snoozeReason ? sanitizeActionText(meta.snoozeReason) : undefined,
        updatedAt: ev.created_at || now,
      });
    } else if (type === 'KNOWLEDGE_ACTION_OUTCOME_RECORDED' && actionId) {
      const a: KnowledgeAction = actionsMap.get(actionId) || {
        id: actionId,
        type: (ev.action_type || meta.actionType || 'EDIT_FAQ') as KnowledgeActionType,
        priority: 'MEDIUM',
        title: meta.title || 'Knowledge Action',
        reason: 'Outcome recorded',
        evidence: '',
        suggestedAction: '',
        status: 'COMPLETED',
        estimatedImpact: 'MEDIUM',
        risk: 'LOW',
        decisionFingerprint: meta.decisionFingerprint || `fp-${actionId}`,
        createdAt: ev.created_at || now,
        updatedAt: ev.created_at || now,
      };
      actionsMap.set(actionId, {
        ...a,
        status: 'COMPLETED',
        outcome: meta.outcome || a.outcome,
        afterSnapshot: meta.afterSnapshot || a.afterSnapshot,
        improvementScore: meta.improvementScore ?? a.improvementScore,
        updatedAt: ev.created_at || now,
      });
    }
  }

  // Resolve expired snoozes: SNOOZED → OPEN
  const nowMs = Date.now();
  const result: KnowledgeAction[] = [];
  for (const action of actionsMap.values()) {
    if (action.status === 'SNOOZED' && action.snoozedUntil) {
      if (nowMs >= new Date(action.snoozedUntil).getTime()) {
        result.push({ ...action, status: 'OPEN', snoozedUntil: undefined });
        continue;
      }
    }
    result.push(action);
  }

  return result;
}

// ---------------------------------------------------------------------------
// 11. DUPLICATE/LOOP DETECTION
// ---------------------------------------------------------------------------

function fingerprintExistsInActions(
  fingerprint: string,
  actions: KnowledgeAction[]
): boolean {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  for (const action of actions) {
    if (action.decisionFingerprint !== fingerprint) continue;
    // Active actions block new creation
    if (['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'SNOOZED', 'BLOCKED'].includes(action.status)) return true;
    // Completed blocks forever (issue is resolved)
    if (action.status === 'COMPLETED') return true;
    // Dismissed blocks for 7 days (prevent loop)
    if (action.status === 'DISMISSED') {
      const updatedMs = new Date(action.updatedAt).getTime();
      if (Date.now() - updatedMs < sevenDaysMs) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 12. SYNC RECOMMENDATIONS → ACTIONS (Phase 6.7 bridge)
// ---------------------------------------------------------------------------

export async function syncRecommendationsToActions(
  recommendations: AdminRecommendation[],
  existingActions: KnowledgeAction[]
): Promise<KnowledgeAction[]> {
  const newActions: KnowledgeAction[] = [];

  for (const rec of recommendations) {
    if (rec.status !== 'OPEN') continue;

    const actionType = mapRecommendationToActionType(rec.type);
    const fingerprint = calculateDecisionFingerprint(
      rec.affectedEntityId || rec.type,
      rec.type,
      (rec.evidence || '').slice(0, 100)
    );

    // Skip if fingerprint already tracked
    if (fingerprintExistsInActions(fingerprint, existingActions)) continue;
    if (fingerprintExistsInActions(fingerprint, newActions)) continue;

    const actionId = rec.id || `action-${fingerprint}-${Date.now().toString(36)}`;
    const action: KnowledgeAction = {
      id: actionId,
      type: actionType,
      recommendationId: rec.id,
      priority: rec.priority,
      title: rec.title,
      reason: rec.reason,
      evidence: rec.evidence,
      suggestedAction: rec.actionPrompt,
      affectedEntityId: rec.affectedEntityId,
      affectedEntityType: rec.affectedEntityType as any,
      estimatedImpact: estimateImpact({}),
      risk: assessRisk(actionType),
      status: 'OPEN',
      decisionFingerprint: fingerprint,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    newActions.push(action);

    // Non-blocking telemetry: persist action creation event
    Promise.resolve().then(() => {
      agentAnalytics.track({
        eventType: 'KNOWLEDGE_ACTION_CREATED',
        metadata: {
          actionId,
          actionType,
          recommendationId: rec.id,
          priority: rec.priority,
          title: rec.title,
          reason: rec.reason,
          evidence: rec.evidence,
          suggestedAction: rec.actionPrompt,
          affectedEntityId: rec.affectedEntityId,
          affectedEntityType: rec.affectedEntityType,
          estimatedImpact: action.estimatedImpact,
          risk: action.risk,
          decisionFingerprint: fingerprint,
        },
      });
    }).catch(() => { /* fail-silent, non-blocking */ });
  }

  return [...existingActions, ...newActions];
}

// ---------------------------------------------------------------------------
// 13. LIFECYCLE MUTATIONS (All require Admin authorization)
// ---------------------------------------------------------------------------

export async function acknowledgeAction(
  actionId: string,
  adminUserId: string,
  allActions: KnowledgeAction[]
): Promise<{ success: boolean; error?: string }> {
  try {
    assertAdminAuthorized(adminUserId);
    const action = allActions.find((a) => a.id === actionId);
    if (!action) return { success: false, error: 'Action not found.' };
    if (action.status !== 'OPEN' && action.status !== 'ACKNOWLEDGED') {
      return { success: false, error: `Cannot acknowledge action in status: ${action.status}` };
    }

    await insertAnalyticsEvent({
      eventType: 'KNOWLEDGE_ACTION_ACKNOWLEDGED',
      userId: adminUserId,
      actionId,
      actionType: action.type,
      metadata: { actionId, previousStatus: 'OPEN' },
    });

    clearActionCenterCache();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function startAction(
  actionId: string,
  adminUserId: string,
  allActions: KnowledgeAction[],
  beforeSnapshot?: BeforeAfterSnapshot
): Promise<{ success: boolean; error?: string }> {
  try {
    assertAdminAuthorized(adminUserId);
    const action = allActions.find((a) => a.id === actionId);
    if (!action) return { success: false, error: 'Action not found.' };
    if (action.status !== 'OPEN' && action.status !== 'ACKNOWLEDGED') {
      return { success: false, error: `Cannot start action in status: ${action.status}` };
    }

    await insertAnalyticsEvent({
      eventType: 'KNOWLEDGE_ACTION_STARTED',
      userId: adminUserId,
      actionId,
      actionType: action.type,
      metadata: { actionId, previousStatus: action.status, beforeSnapshot },
    });

    clearActionCenterCache();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function completeAction(
  actionId: string,
  adminUserId: string,
  allActions: KnowledgeAction[],
  params?: {
    afterSnapshot?: BeforeAfterSnapshot;
    outcome?: ActionOutcome;
    improvementScore?: number;
  }
): Promise<{ success: boolean; error?: string; isRegression?: boolean }> {
  try {
    assertAdminAuthorized(adminUserId);
    const action = allActions.find((a) => a.id === actionId);
    if (!action) return { success: false, error: 'Action not found.' };
    if (action.status !== 'IN_PROGRESS') {
      return { success: false, error: `Cannot complete action in status: ${action.status}` };
    }

    await insertAnalyticsEvent({
      eventType: 'KNOWLEDGE_ACTION_COMPLETED',
      userId: adminUserId,
      actionId,
      actionType: action.type,
      metadata: {
        actionId,
        previousStatus: 'IN_PROGRESS',
        afterSnapshot: params?.afterSnapshot,
        outcome: params?.outcome,
        improvementScore: params?.improvementScore,
      },
    });

    const isRegression = params?.outcome?.effectiveness === 'REGRESSED';

    // Post-completion regression/improvement signals
    if (isRegression) {
      await insertAnalyticsEvent({
        eventType: 'KNOWLEDGE_REGRESSION_DETECTED',
        userId: adminUserId,
        actionId,
        actionType: action.type,
        metadata: { actionId, outcome: params?.outcome, afterSnapshot: params?.afterSnapshot },
      });
    } else if (params?.outcome?.feedbackType === 'ACTION_IMPROVED') {
      await insertAnalyticsEvent({
        eventType: 'KNOWLEDGE_IMPROVEMENT_DETECTED',
        userId: adminUserId,
        actionId,
        actionType: action.type,
        metadata: { actionId, outcome: params?.outcome, improvementScore: params?.improvementScore },
      });
    }

    // Invalidate intelligence cache after Admin mutation
    clearKnowledgeIntelligenceCache();
    clearNegativePolicyCache();
    clearActionCenterCache();
    return { success: true, isRegression };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function dismissAction(
  actionId: string,
  adminUserId: string,
  allActions: KnowledgeAction[],
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    assertAdminAuthorized(adminUserId);
    const action = allActions.find((a) => a.id === actionId);
    if (!action) return { success: false, error: 'Action not found.' };
    if (action.status === 'COMPLETED') {
      return { success: false, error: 'Cannot dismiss a completed action.' };
    }

    await insertAnalyticsEvent({
      eventType: 'KNOWLEDGE_ACTION_DISMISSED',
      userId: adminUserId,
      actionId,
      actionType: action.type,
      metadata: { actionId, previousStatus: action.status, reason, dismissedBy: adminUserId },
    });

    clearActionCenterCache();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function snoozeAction(
  actionId: string,
  adminUserId: string,
  allActions: KnowledgeAction[],
  snoozedUntil: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    assertAdminAuthorized(adminUserId);
    const action = allActions.find((a) => a.id === actionId);
    if (!action) return { success: false, error: 'Action not found.' };
    if (action.status !== 'OPEN' && action.status !== 'ACKNOWLEDGED') {
      return { success: false, error: `Cannot snooze action in status: ${action.status}` };
    }

    const snoozedMs = new Date(snoozedUntil).getTime();
    if (isNaN(snoozedMs) || snoozedMs <= Date.now()) {
      return { success: false, error: 'snoozedUntil must be a future timestamp.' };
    }

    const sanitizedReason = reason ? sanitizeActionText(reason) : undefined;

    await insertAnalyticsEvent({
      eventType: 'KNOWLEDGE_ACTION_SNOOZED',
      userId: adminUserId,
      actionId,
      actionType: action.type,
      metadata: { actionId, previousStatus: action.status, snoozedUntil, snoozeReason: sanitizedReason },
    });

    clearActionCenterCache();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function recordOutcome(
  actionId: string,
  adminUserId: string,
  allActions: KnowledgeAction[],
  outcome: ActionOutcome,
  afterSnapshot?: BeforeAfterSnapshot
): Promise<{ success: boolean; error?: string }> {
  try {
    assertAdminAuthorized(adminUserId);
    const action = allActions.find((a) => a.id === actionId);
    if (!action) return { success: false, error: 'Action not found.' };
    if (action.status !== 'COMPLETED') {
      return { success: false, error: 'Outcome can only be recorded for COMPLETED actions.' };
    }

    await insertAnalyticsEvent({
      eventType: 'KNOWLEDGE_ACTION_OUTCOME_RECORDED',
      userId: adminUserId,
      actionId,
      actionType: action.type,
      metadata: { actionId, outcome, afterSnapshot },
    });

    clearActionCenterCache();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// 14. ACTION CENTER READ MODEL (Main API)
// ---------------------------------------------------------------------------

export async function getActionCenter(
  recommendations: AdminRecommendation[],
  forceRefresh = false
): Promise<ActionCenterSummary> {
  const now = Date.now();
  if (!forceRefresh && cachedActionCenter && now - lastActionCacheFetchTime < ACTION_CACHE_TTL_MS) {
    return cachedActionCenter;
  }

  try {
    const eventsData = await getActiveShopAdapter().storage!.getAgentEvents(
      undefined,
      2000,
      [
        'KNOWLEDGE_ACTION_CREATED',
        'KNOWLEDGE_ACTION_ACKNOWLEDGED',
        'KNOWLEDGE_ACTION_STARTED',
        'KNOWLEDGE_ACTION_COMPLETED',
        'KNOWLEDGE_ACTION_DISMISSED',
        'KNOWLEDGE_ACTION_SNOOZED',
        'KNOWLEDGE_ACTION_OUTCOME_RECORDED',
      ]
    );

    const events = eventsData || [];

    // Build action state from event log
    let actions = buildActionsFromEvents(events);

    // Sync pending recommendations into actions (Phase 6.7 bridge, non-mutating)
    actions = await syncRecommendationsToActions(recommendations, actions);

    const openCount = actions.filter((a) => a.status === 'OPEN').length;
    const acknowledgedCount = actions.filter((a) => a.status === 'ACKNOWLEDGED').length;
    const inProgressCount = actions.filter((a) => a.status === 'IN_PROGRESS').length;
    const completedCount = actions.filter((a) => a.status === 'COMPLETED').length;
    const dismissedCount = actions.filter((a) => a.status === 'DISMISSED').length;
    const snoozedCount = actions.filter((a) => a.status === 'SNOOZED').length;
    const blockedCount = actions.filter((a) => a.status === 'BLOCKED').length;

    const regressionsDetected = actions.filter((a) => a.outcome?.effectiveness === 'REGRESSED').length;
    const successfulImprovements = actions.filter((a) => a.outcome?.feedbackType === 'ACTION_IMPROVED').length;

    const completedActions = actions.filter((a) => a.status === 'COMPLETED');
    const improvementScore = calculateKnowledgeImprovementScore(completedActions);

    // Sort: CRITICAL > HIGH > MEDIUM > LOW, then most recent
    const priorityOrder: Record<RecommendationPriority, number> = {
      CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3,
    };
    const sortedActions = [...actions].sort((a, b) => {
      const pd = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
      if (pd !== 0) return pd;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    const summary: ActionCenterSummary = {
      openCount,
      acknowledgedCount,
      inProgressCount,
      completedCount,
      dismissedCount,
      snoozedCount,
      blockedCount,
      regressionsDetected,
      successfulImprovements,
      actions: sortedActions,
      improvementScore,
      lastUpdated: new Date().toISOString(),
    };

    cachedActionCenter = summary;
    lastActionCacheFetchTime = now;
    return summary;
  } catch (err) {
    console.error('[KnowledgeActionService] Error building Action Center:', err);

    // Fail-closed: never auto-mutate, return safe empty summary
    return {
      openCount: 0,
      acknowledgedCount: 0,
      inProgressCount: 0,
      completedCount: 0,
      dismissedCount: 0,
      snoozedCount: 0,
      blockedCount: 0,
      regressionsDetected: 0,
      successfulImprovements: 0,
      actions: [],
      improvementScore: {
        score: 0,
        components: { healthImprovement: 0, matchImprovement: 0, gapReduction: 0, conflictReduction: 0, coverageImprovement: 0 },
        trend: 'STABLE',
        computedAt: new Date().toISOString(),
      },
      lastUpdated: new Date().toISOString(),
    };
  }
}
