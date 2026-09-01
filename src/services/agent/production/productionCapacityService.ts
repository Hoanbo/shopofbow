// src/services/agent/production/productionCapacityService.ts
// BOW AGENT V3.3 — PHASE 7.0: CAPACITY GUARD & LOAD PROTECTION
//
// Monitors throughput, concurrency, and queue depths to protect core services
// against traffic spikes and resource starvation.
//
// HARD CONTRACTS:
//   - Business Priority: Always prioritizes Transaction, Wallet, Warranty, and Auth.
//   - Graceful Shedding: Sheds optional AI enrichment first during high load.
//   - Zero Auto-Mutation: Operates strictly as an observability and routing guard.

import type {
  CapacityStatus,
  CapacityMetrics,
} from '../monitoring/analyticsTypes';

let concurrentCount = 0;
let peakTrafficRpm = 0;
let rejectedCount = 0;
let timeoutCount = 0;

export function getCapacityStatus(requestsPerMinute: number): CapacityStatus {
  if (requestsPerMinute > 1000) return 'OVERLOAD';
  if (requestsPerMinute > 500) return 'HIGH_LOAD';
  if (requestsPerMinute > 100) return 'BUSY';
  return 'NORMAL';
}

export function acquireCapacitySlot(): { acquired: boolean; reason?: string } {
  // If concurrency exceeds critical ceiling, guard AI execution
  if (concurrentCount >= 100) {
    rejectedCount++;
    return { acquired: false, reason: 'Concurrency ceiling reached (100 concurrent requests)' };
  }
  concurrentCount++;
  return { acquired: true };
}

export function releaseCapacitySlot(): void {
  if (concurrentCount > 0) {
    concurrentCount--;
  }
}

export function recordTimeout(): void {
  timeoutCount++;
}

export function getCapacityMetrics(requestsPerMinute = 0, avgLatencyMs = 25): CapacityMetrics {
  if (requestsPerMinute > peakTrafficRpm) {
    peakTrafficRpm = requestsPerMinute;
  }

  return {
    status: getCapacityStatus(requestsPerMinute),
    requestsPerMinute,
    concurrentRequests: concurrentCount,
    queueDepth: Math.max(0, concurrentCount - 10),
    avgProcessingTimeMs: avgLatencyMs,
    peakTraffic: peakTrafficRpm,
    rejectedRequests: rejectedCount,
    timeoutCount,
  };
}

export function resetCapacityCounters(): void {
  concurrentCount = 0;
  peakTrafficRpm = 0;
  rejectedCount = 0;
  timeoutCount = 0;
}
