// src/services/agent/production/productionSloService.ts
// BOW AGENT V3.3 — PHASE 7.0: PRODUCTION SLO & SLA ENGINE
//
// Centralized, configurable SLO thresholds with deterministic evaluation
// and insufficient data guards.
//
// HARD CONTRACTS:
//   - Zero Auto-Mutation: Analyzes and computes SLO compliance only.
//   - Pure Evaluation: Deterministic math without external side effects.

import type {
  SloThresholds,
  SloEvaluationItem,
  ProductionSloReport,
  ProductionRequestMetric,
} from '../monitoring/analyticsTypes';
import { getProductionMetrics } from './productionTelemetryService';

// ---------------------------------------------------------------------------
// 1. CENTRALIZED SLO THRESHOLDS
// ---------------------------------------------------------------------------

export const DEFAULT_SLO_THRESHOLDS: SloThresholds = {
  availabilityTarget: 99.9, // >= 99.9%
  errorRateHealthyMax: 1.0, // < 1%
  errorRateWarningMax: 3.0, // 1% - 3%
  p95LatencyHealthyMax: 500, // < 500ms
  p95LatencyWarningMax: 1000, // 500ms - 1000ms
  p99LatencyHealthyMax: 1000, // < 1000ms
  p99LatencyWarningMax: 2000, // 1000ms - 2000ms
  fallbackRateHealthyMax: 5.0, // < 5%
  fallbackRateWarningMax: 10.0, // 5% - 10%
  knowledgeGapRateHealthyMax: 10.0, // < 10%
  knowledgeGapRateWarningMax: 20.0, // 10% - 20%
};

export function getSloThresholds(): SloThresholds {
  return { ...DEFAULT_SLO_THRESHOLDS };
}

// ---------------------------------------------------------------------------
// 2. DETERMINISTIC SLO EVALUATION
// ---------------------------------------------------------------------------

export function evaluateProductionSlo(
  providedMetrics?: ProductionRequestMetric[],
  thresholds: SloThresholds = DEFAULT_SLO_THRESHOLDS
): ProductionSloReport {
  const metrics = providedMetrics || getProductionMetrics(60);
  const total = metrics.length;
  const isInsufficient = total < 5;

  if (total === 0 || isInsufficient) {
    return {
      overallStatus: 'INSUFFICIENT_DATA',
      availability: {
        name: 'Availability',
        currentValue: 100,
        target: `>= ${thresholds.availabilityTarget}%`,
        status: 'INSUFFICIENT_DATA',
      },
      errorRate: {
        name: 'Error Rate',
        currentValue: 0,
        target: `< ${thresholds.errorRateHealthyMax}%`,
        status: 'INSUFFICIENT_DATA',
      },
      p95Latency: {
        name: 'P95 Latency',
        currentValue: 0,
        target: `< ${thresholds.p95LatencyHealthyMax}ms`,
        status: 'INSUFFICIENT_DATA',
      },
      p99Latency: {
        name: 'P99 Latency',
        currentValue: 0,
        target: `< ${thresholds.p99LatencyHealthyMax}ms`,
        status: 'INSUFFICIENT_DATA',
      },
      fallbackRate: {
        name: 'Fallback Rate',
        currentValue: 0,
        target: `< ${thresholds.fallbackRateHealthyMax}%`,
        status: 'INSUFFICIENT_DATA',
      },
      knowledgeGapRate: {
        name: 'Knowledge Gap Rate',
        currentValue: 0,
        target: `< ${thresholds.knowledgeGapRateHealthyMax}%`,
        status: 'INSUFFICIENT_DATA',
      },
      evaluatedAt: new Date().toISOString(),
    };
  }

  // Calculate values
  const successCount = metrics.filter((m) => m.success).length;
  const errorCount = metrics.filter((m) => !m.success).length;
  const fallbackCount = metrics.filter((m) => m.fallbackUsed).length;
  const knowledgeGapCount = metrics.filter((m) => m.route === 'KNOWLEDGE_GAP').length;

  const availabilityVal = Math.round((successCount / total) * 1000) / 10;
  const errorRateVal = Math.round((errorCount / total) * 1000) / 10;
  const fallbackRateVal = Math.round((fallbackCount / total) * 1000) / 10;
  const gapRateVal = Math.round((knowledgeGapCount / total) * 1000) / 10;

  // Latencies
  const latencies = metrics.map((m) => m.latencyMs).sort((a, b) => a - b);
  const p95Val = latencies[Math.min(total - 1, Math.floor(total * 0.95))];
  const p99Val = latencies[Math.min(total - 1, Math.floor(total * 0.99))];

  // Evaluate Availability
  const availStatus = availabilityVal >= thresholds.availabilityTarget ? 'HEALTHY' : 'CRITICAL';

  // Evaluate Error Rate
  let errStatus: SloEvaluationItem['status'] = 'HEALTHY';
  if (errorRateVal > thresholds.errorRateWarningMax) errStatus = 'CRITICAL';
  else if (errorRateVal > thresholds.errorRateHealthyMax) errStatus = 'WARNING';

  // Evaluate P95 Latency
  let p95Status: SloEvaluationItem['status'] = 'HEALTHY';
  if (p95Val > thresholds.p95LatencyWarningMax) p95Status = 'CRITICAL';
  else if (p95Val > thresholds.p95LatencyHealthyMax) p95Status = 'WARNING';

  // Evaluate P99 Latency
  let p99Status: SloEvaluationItem['status'] = 'HEALTHY';
  if (p99Val > thresholds.p99LatencyWarningMax) p99Status = 'CRITICAL';
  else if (p99Val > thresholds.p99LatencyHealthyMax) p99Status = 'WARNING';

  // Evaluate Fallback Rate
  let fallbackStatus: SloEvaluationItem['status'] = 'HEALTHY';
  if (fallbackRateVal > thresholds.fallbackRateWarningMax) fallbackStatus = 'CRITICAL';
  else if (fallbackRateVal > thresholds.fallbackRateHealthyMax) fallbackStatus = 'WARNING';

  // Evaluate Knowledge Gap Rate
  let gapStatus: SloEvaluationItem['status'] = 'HEALTHY';
  if (gapRateVal > thresholds.knowledgeGapRateWarningMax) gapStatus = 'CRITICAL';
  else if (gapRateVal > thresholds.knowledgeGapRateHealthyMax) gapStatus = 'WARNING';

  // Overall Status
  let overallStatus: ProductionSloReport['overallStatus'] = 'HEALTHY';
  const allStatuses = [availStatus, errStatus, p95Status, p99Status, fallbackStatus, gapStatus];
  if (allStatuses.includes('CRITICAL')) {
    overallStatus = 'CRITICAL';
  } else if (allStatuses.includes('WARNING')) {
    overallStatus = 'WARNING';
  }

  return {
    overallStatus,
    availability: {
      name: 'Availability',
      currentValue: availabilityVal,
      target: `>= ${thresholds.availabilityTarget}%`,
      status: availStatus,
    },
    errorRate: {
      name: 'Error Rate',
      currentValue: errorRateVal,
      target: `< ${thresholds.errorRateHealthyMax}%`,
      status: errStatus,
    },
    p95Latency: {
      name: 'P95 Latency',
      currentValue: p95Val,
      target: `< ${thresholds.p95LatencyHealthyMax}ms`,
      status: p95Status,
    },
    p99Latency: {
      name: 'P99 Latency',
      currentValue: p99Val,
      target: `< ${thresholds.p99LatencyHealthyMax}ms`,
      status: p99Status,
    },
    fallbackRate: {
      name: 'Fallback Rate',
      currentValue: fallbackRateVal,
      target: `< ${thresholds.fallbackRateHealthyMax}%`,
      status: fallbackStatus,
    },
    knowledgeGapRate: {
      name: 'Knowledge Gap Rate',
      currentValue: gapRateVal,
      target: `< ${thresholds.knowledgeGapRateHealthyMax}%`,
      status: gapStatus,
    },
    evaluatedAt: new Date().toISOString(),
  };
}
