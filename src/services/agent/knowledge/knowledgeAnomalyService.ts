// src/services/agent/knowledge/knowledgeAnomalyService.ts
// BOW AGENT V3.3 — PHASE 6.9: KNOWLEDGE ANOMALY DETECTION ENGINE
//
// Detects statistical anomalies across traffic, knowledge gap surges,
// conflict spikes, match rate drops, and policy activation anomalies.
//
// HARD CONTRACTS:
//   - Zero Auto-Mutation: AI only observes, scores, and alerts. Never mutates knowledge.
//   - Deterministic / Statistical: Uses moving averages and threshold rules.
//   - Insufficient Data Guard: Flags INSUFFICIENT_DATA when sample size is low to avoid false certainty.

import type {
  KnowledgeAnomalyItem,
  KnowledgeAnomalyReport,
  AlertSeverity,
} from '../monitoring/analyticsTypes';

// ---------------------------------------------------------------------------
// 1. STATISTICAL HELPER FUNCTIONS
// ---------------------------------------------------------------------------

export function calculatePercentageChange(current: number, baseline: number): number {
  if (baseline <= 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - baseline) / baseline) * 100);
}

// ---------------------------------------------------------------------------
// 2. INDIVIDUAL ANOMALY DETECTORS
// ---------------------------------------------------------------------------

export function detectGapSpike(
  currentGapCount: number,
  baselineGapCount: number,
  totalQueries = 100
): KnowledgeAnomalyItem | null {
  if (totalQueries < 5) return null;

  const pctChange = calculatePercentageChange(currentGapCount, baselineGapCount);
  const gapRate = totalQueries > 0 ? (currentGapCount / totalQueries) * 100 : 0;

  // Anomaly condition: Gap count surges by > 30% or gap rate exceeds 25%
  if (pctChange >= 30 || gapRate >= 25) {
    const severity: AlertSeverity = pctChange >= 75 || gapRate >= 40 ? 'CRITICAL' : pctChange >= 50 ? 'HIGH' : 'WARNING';
    return {
      id: `anom-gap-${Date.now()}`,
      type: 'GAP_SPIKE',
      magnitude: pctChange,
      baselineValue: baselineGapCount,
      currentValue: currentGapCount,
      confidence: Math.min(0.95, 0.6 + Math.min(totalQueries, 100) / 250),
      severity,
      description: `Đột biến câu hỏi chưa có lời giải đáp (+${pctChange}%, Tỷ lệ Gap: ${Math.round(gapRate)}%)`,
      detectedAt: new Date().toISOString(),
    };
  }
  return null;
}

export function detectConflictSpike(
  currentConflicts: number,
  baselineConflicts: number
): KnowledgeAnomalyItem | null {
  const diff = currentConflicts - baselineConflicts;
  if (diff >= 2 || (currentConflicts >= 3 && diff > 0)) {
    const severity: AlertSeverity = diff >= 4 || currentConflicts >= 5 ? 'CRITICAL' : 'HIGH';
    return {
      id: `anom-conflict-${Date.now()}`,
      type: 'CONFLICT_SPIKE',
      magnitude: diff,
      baselineValue: baselineConflicts,
      currentValue: currentConflicts,
      confidence: 0.9,
      severity,
      description: `Phát hiện gia tăng đột biến ${diff} xung đột chính sách kiến thức mới`,
      detectedAt: new Date().toISOString(),
    };
  }
  return null;
}

export function detectMatchRateDrop(
  currentMatchRate: number,
  baselineMatchRate: number,
  totalQueries = 100
): KnowledgeAnomalyItem | null {
  if (totalQueries < 5) return null;

  const drop = Math.max(0, Math.round(baselineMatchRate - currentMatchRate));
  // Anomaly condition: match rate drops by > 10%
  if (drop >= 10) {
    const severity: AlertSeverity = drop >= 25 ? 'CRITICAL' : drop >= 15 ? 'HIGH' : 'WARNING';
    return {
      id: `anom-match-${Date.now()}`,
      type: 'MATCH_RATE_DROP',
      magnitude: drop,
      baselineValue: baselineMatchRate,
      currentValue: currentMatchRate,
      confidence: Math.min(0.95, 0.7 + Math.min(totalQueries, 100) / 300),
      severity,
      description: `Tỷ lệ khớp tri thức suy giảm ${drop}% so với mức cơ sở (${baselineMatchRate}% → ${currentMatchRate}%)`,
      detectedAt: new Date().toISOString(),
    };
  }
  return null;
}

export function detectNegativePolicySpike(
  currentHits: number,
  baselineHits: number
): KnowledgeAnomalyItem | null {
  const pctChange = calculatePercentageChange(currentHits, baselineHits);
  if (pctChange >= 100 && currentHits >= 5) {
    return {
      id: `anom-policy-${Date.now()}`,
      type: 'POLICY_SPIKE',
      magnitude: pctChange,
      baselineValue: baselineHits,
      currentValue: currentHits,
      confidence: 0.85,
      severity: pctChange >= 200 ? 'HIGH' : 'WARNING',
      description: `Số lượt kích hoạt chính sách từ chối tăng vọt +${pctChange}% (${baselineHits} → ${currentHits} lượt)`,
      detectedAt: new Date().toISOString(),
    };
  }
  return null;
}

export function detectQueryVolumeSpike(
  currentVolume: number,
  baselineVolume: number
): KnowledgeAnomalyItem | null {
  const pctChange = calculatePercentageChange(currentVolume, baselineVolume);
  if (pctChange >= 150 && currentVolume >= 20) {
    return {
      id: `anom-traffic-${Date.now()}`,
      type: 'TRAFFIC_SURGE',
      magnitude: pctChange,
      baselineValue: baselineVolume,
      currentValue: currentVolume,
      confidence: 0.88,
      severity: pctChange >= 300 ? 'HIGH' : 'INFO',
      description: `Lưu lượng truy vấn người dùng tăng vọt +${pctChange}%`,
      detectedAt: new Date().toISOString(),
    };
  }
  return null;
}

export function detectRoutingAnomaly(events: any[] = []): KnowledgeAnomalyItem | null {
  const fallbackCount = events.filter((e) => e.event_type === 'GEMINI_FALLBACK').length;
  if (fallbackCount >= 5) {
    return {
      id: `anom-routing-${Date.now()}`,
      type: 'ROUTING_ANOMALY',
      magnitude: fallbackCount,
      baselineValue: 0,
      currentValue: fallbackCount,
      confidence: 0.95,
      severity: fallbackCount >= 10 ? 'HIGH' : 'WARNING',
      description: `Phát hiện ${fallbackCount} phiên định tuyến dự phòng liên tiếp do lỗi runtime`,
      detectedAt: new Date().toISOString(),
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 3. MASTER ANOMALY DETECTOR PIPELINE
// ---------------------------------------------------------------------------

export function detectTrafficAnomalies(params: {
  currentGapCount: number;
  baselineGapCount: number;
  currentMatchRate: number;
  baselineMatchRate: number;
  currentConflicts: number;
  baselineConflicts: number;
  currentPolicyHits?: number;
  baselinePolicyHits?: number;
  currentVolume?: number;
  baselineVolume?: number;
  events?: any[];
  totalQueries?: number;
}): KnowledgeAnomalyReport {
  const totalQueries = params.totalQueries ?? (params.events ? params.events.length : 20);
  const isInsufficientData = totalQueries < 5;

  if (isInsufficientData) {
    return {
      anomalies: [],
      totalAnomalies: 0,
      highSeverityCount: 0,
      evaluatedAt: new Date().toISOString(),
      isInsufficientData: true,
    };
  }

  const anomalies: KnowledgeAnomalyItem[] = [];

  const gapAnom = detectGapSpike(params.currentGapCount, params.baselineGapCount, totalQueries);
  if (gapAnom) anomalies.push(gapAnom);

  const conflictAnom = detectConflictSpike(params.currentConflicts, params.baselineConflicts);
  if (conflictAnom) anomalies.push(conflictAnom);

  const matchAnom = detectMatchRateDrop(params.currentMatchRate, params.baselineMatchRate, totalQueries);
  if (matchAnom) anomalies.push(matchAnom);

  if (params.currentPolicyHits !== undefined && params.baselinePolicyHits !== undefined) {
    const polAnom = detectNegativePolicySpike(params.currentPolicyHits, params.baselinePolicyHits);
    if (polAnom) anomalies.push(polAnom);
  }

  if (params.currentVolume !== undefined && params.baselineVolume !== undefined) {
    const volAnom = detectQueryVolumeSpike(params.currentVolume, params.baselineVolume);
    if (volAnom) anomalies.push(volAnom);
  }

  if (params.events && params.events.length > 0) {
    const routeAnom = detectRoutingAnomaly(params.events);
    if (routeAnom) anomalies.push(routeAnom);
  }

  const highSeverityCount = anomalies.filter((a) => a.severity === 'HIGH' || a.severity === 'CRITICAL').length;

  return {
    anomalies,
    totalAnomalies: anomalies.length,
    highSeverityCount,
    evaluatedAt: new Date().toISOString(),
    isInsufficientData: false,
  };
}
