// src/services/agent/production/productionRollbackService.ts
// BOW AGENT V3.3 — PHASE 7.0: PRODUCTION ROLLBACK ENGINE
//
// Deterministic, audited rollback mechanisms that instantly demote rollout stages
// without impacting orders, payments, wallet transactions, or production knowledge.
//
// HARD CONTRACTS:
//   - Idempotent & Deterministic: Rollbacks execute reliably under any system load.
//   - Zero Invariant Impact: Zero effect on orders, transactions, pricing, or FAQs.

import type {
  ProductionRolloutStage,
  RollbackRecord,
} from '../monitoring/analyticsTypes';
import { getRolloutState, updateRolloutStage } from './productionRolloutService';
import { assertAdminAuthorized } from '../knowledge/knowledgeActionService';

let rollbackHistory: RollbackRecord[] = [];

export interface ExecuteRollbackOptions {
  adminUserId: string;
  targetStage?: ProductionRolloutStage;
  reason: string;
  metricsSnapshot?: Record<string, any>;
}

export function executeRollback(options: ExecuteRollbackOptions): { success: boolean; record: RollbackRecord } {
  assertAdminAuthorized(options.adminUserId);

  const currentState = getRolloutState();
  const targetStage: ProductionRolloutStage = options.targetStage || 'OFF';

  const record: RollbackRecord = {
    rollbackId: `rb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    reason: options.reason,
    triggeredBy: options.adminUserId,
    stageBefore: currentState.currentStage,
    stageAfter: targetStage,
    metricsSnapshot: options.metricsSnapshot || {},
    timestamp: new Date().toISOString(),
  };

  // Demote rollout stage
  updateRolloutStage({
    adminUserId: options.adminUserId,
    targetStage,
  });

  rollbackHistory.unshift(record);
  if (rollbackHistory.length > 50) {
    rollbackHistory = rollbackHistory.slice(0, 50);
  }

  return { success: true, record };
}

export function getRollbackHistory(): RollbackRecord[] {
  return [...rollbackHistory];
}

export function clearRollbackHistory(): void {
  rollbackHistory = [];
}
