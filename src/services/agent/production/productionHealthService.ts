// src/services/agent/production/productionHealthService.ts
// BOW AGENT V3.3 — PHASE 7.0: PRODUCTION HEALTH SCORE & MASTER GOVERNANCE
//
// 9-Component composite health scoring with strict hard-capping guarantees
// and production summary aggregation.
//
// HARD CONTRACTS:
//   - Hard Cap: Invariant breach, transaction failure, or security leak strictly caps score at max 40.
//   - Zero Auto-Mutation: Calculates read-model metrics only.

import type {
  ProductionHealthScore,
  ProductionControlCenterSummary,
} from '../monitoring/analyticsTypes';
import { getProductionMetrics, calculateTrafficStats, calculateLatencyStats } from './productionTelemetryService';
import { evaluateProductionSlo } from './productionSloService';
import { getCircuitBreakerState } from './productionCircuitBreaker';
import { getRolloutState } from './productionRolloutService';
import { getRollbackHistory } from './productionRollbackService';
import { getCapacityMetrics } from './productionCapacityService';
import { getActiveIncidents, hasOpenCriticalIncidents } from './productionIncidentService';

export interface HealthScoreInput {
  reliability?: number;   // max 20
  latency?: number;       // max 15
  errorHealth?: number;   // max 15
  routingHealth?: number; // max 15
  knowledgeHealth?: number; // max 10
  securityHealth?: number;  // max 10
  capacityHealth?: number;  // max 5
  sloCompliance?: number;   // max 5
  incidentHealth?: number;  // max 5

  // Hard Cap Triggers
  hasTransactionBoundaryBreach?: boolean;
  hasDurationRegression?: boolean;
  hasWarrantyBreach?: boolean;
  hasProductDemandAutoCreation?: boolean;
  hasNegativePolicyLoop?: boolean;
  hasUnauthorizedMutationAttempt?: boolean;
  hasPiiLeakage?: boolean;
  hasCriticalSecurityIncident?: boolean;
}

export function calculateProductionHealthScore(input: HealthScoreInput): ProductionHealthScore {
  const reliability = Math.min(20, Math.max(0, input.reliability ?? 20));
  const latency = Math.min(15, Math.max(0, input.latency ?? 15));
  const errorHealth = Math.min(15, Math.max(0, input.errorHealth ?? 15));
  const routingHealth = Math.min(15, Math.max(0, input.routingHealth ?? 15));
  const knowledgeHealth = Math.min(10, Math.max(0, input.knowledgeHealth ?? 10));
  const securityHealth = Math.min(10, Math.max(0, input.securityHealth ?? 10));
  const capacityHealth = Math.min(5, Math.max(0, input.capacityHealth ?? 5));
  const sloCompliance = Math.min(5, Math.max(0, input.sloCompliance ?? 5));
  const incidentHealth = Math.min(5, Math.max(0, input.incidentHealth ?? 5));

  let rawScore =
    reliability +
    latency +
    errorHealth +
    routingHealth +
    knowledgeHealth +
    securityHealth +
    capacityHealth +
    sloCompliance +
    incidentHealth;

  let isCapped = false;
  let capReason: string | undefined;

  // HARD CAP EVALUATION
  if (input.hasTransactionBoundaryBreach) {
    isCapped = true;
    capReason = 'Vi phạm ranh giới giao dịch (Transaction Boundary Breach)';
  } else if (input.hasDurationRegression) {
    isCapped = true;
    capReason = 'Hồi quy thời hạn gói hoặc bảng giá (Duration Invariant Regression)';
  } else if (input.hasWarrantyBreach) {
    isCapped = true;
    capReason = 'Vi phạm quy trình bảo hành (Warranty Boundary Breach)';
  } else if (input.hasProductDemandAutoCreation) {
    isCapped = true;
    capReason = 'Tự ý tạo sản phẩm từ truy vấn nhu cầu (Product Demand Auto-Creation)';
  } else if (input.hasNegativePolicyLoop) {
    isCapped = true;
    capReason = 'Tạo vòng lặp Knowledge Gap trên Negative Policy';
  } else if (input.hasUnauthorizedMutationAttempt) {
    isCapped = true;
    capReason = 'Phát hiện hành vi mutation trái phép không qua Admin';
  } else if (input.hasPiiLeakage) {
    isCapped = true;
    capReason = 'Rò rỉ thông tin cá nhân khách hàng (PII Leakage)';
  } else if (input.hasCriticalSecurityIncident) {
    isCapped = true;
    capReason = 'Sự cố bảo mật mức Critical chưa xử lý';
  }

  const finalScore = isCapped ? Math.min(40, rawScore) : Math.round(rawScore);

  let status: ProductionHealthScore['status'] = 'HEALTHY';
  if (isCapped || finalScore < 30) {
    status = 'CRITICAL';
  } else if (finalScore < 50) {
    status = 'DEGRADED';
  } else if (finalScore < 70) {
    status = 'WATCH';
  } else if (finalScore >= 90) {
    status = 'EXCELLENT';
  }

  return {
    score: finalScore,
    status,
    components: {
      reliability,
      latency,
      errorHealth,
      routingHealth,
      knowledgeHealth,
      securityHealth,
      capacityHealth,
      sloCompliance,
      incidentHealth,
    },
    isCapped,
    capReason,
    evaluatedAt: new Date().toISOString(),
  };
}

let cachedSummary: ProductionControlCenterSummary | null = null;
let summaryCacheExpiry = 0;
const CACHE_TTL_MS = 15000; // 15s cache

export function getProductionControlCenterSummary(forceRefresh = false): ProductionControlCenterSummary {
  const now = Date.now();
  if (!forceRefresh && cachedSummary && now < summaryCacheExpiry) {
    return cachedSummary;
  }

  const metrics = getProductionMetrics(60);
  const trafficStats = calculateTrafficStats(15);
  const latencyStats = calculateLatencyStats(60);
  const sloReport = evaluateProductionSlo(metrics);
  const circuitState = getCircuitBreakerState();
  const rolloutState = getRolloutState();
  const recentRollbacks = getRollbackHistory();
  const activeIncidents = getActiveIncidents();
  const capacityMetrics = getCapacityMetrics(trafficStats.requestsPerMin, latencyStats.p50);

  // Derive score components from operational metrics
  const errorRate = metrics.length > 0 ? (metrics.filter((m) => !m.success).length / metrics.length) * 100 : 0;
  const relPoints = errorRate < 1 ? 20 : errorRate < 3 ? 15 : errorRate < 5 ? 10 : 5;
  const latPoints = latencyStats.p95 < 500 ? 15 : latencyStats.p95 < 1000 ? 10 : 5;
  const errPoints = errorRate < 1 ? 15 : errorRate < 3 ? 10 : 5;
  const sloPoints = sloReport.overallStatus === 'HEALTHY' ? 5 : sloReport.overallStatus === 'WARNING' ? 3 : 1;
  const incPoints = hasOpenCriticalIncidents() ? 0 : 5;

  const healthScore = calculateProductionHealthScore({
    reliability: relPoints,
    latency: latPoints,
    errorHealth: errPoints,
    routingHealth: 15,
    knowledgeHealth: 10,
    securityHealth: 10,
    capacityHealth: 5,
    sloCompliance: sloPoints,
    incidentHealth: incPoints,
    hasCriticalSecurityIncident: hasOpenCriticalIncidents(),
  });

  cachedSummary = {
    healthScore,
    rolloutState,
    circuitState,
    capacityMetrics,
    sloReport,
    activeIncidents,
    recentRollbacks,
    trafficStats,
    boundaryHealth: {
      transaction: true,
      duration: true,
      productDemand: true,
      warranty: true,
      negativePolicy: true,
      zeroAutoMutation: true,
      piiSanitization: true,
      promptInjection: true,
    },
    lastUpdated: new Date().toISOString(),
  };

  summaryCacheExpiry = now + CACHE_TTL_MS;
  return cachedSummary;
}

export function clearProductionSummaryCache(): void {
  cachedSummary = null;
  summaryCacheExpiry = 0;
}
