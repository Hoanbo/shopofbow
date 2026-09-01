// src/services/agent/knowledge/knowledgeAlertService.ts
// BOW AGENT V3.3 — PHASE 6.9: GOVERNANCE ALERT & NOTIFICATION ENGINE
//
// Deduplicated, fingerprint-backed alert management with cooldowns,
// anti-spam memory, and Admin lifecycle actions (Acknowledge/Snooze/Dismiss).
//
// HARD CONTRACTS:
//   - Zero Auto-Mutation: AI generates alerts only. Dismissing an alert affects ONLY
//     the alert read-model and NEVER touches production knowledge/FAQs.
//   - Anti-Spam Guarantee: Deduplicates alerts via Decision Fingerprint with TTL.

import type {
  KnowledgeAlert,
  AlertCenterSummary,
  AlertSeverity,
} from '../monitoring/analyticsTypes';
import { calculateDecisionFingerprint, assertAdminAuthorized, sanitizeActionText } from './knowledgeActionService';

// ---------------------------------------------------------------------------
// 1. IN-MEMORY ALERT STORE & COOLDOWN TRACKER
// ---------------------------------------------------------------------------

let activeAlerts: KnowledgeAlert[] = [];
const alertCooldowns = new Map<string, number>(); // fingerprint -> expiresAt timestamp
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown for duplicate alerts

export function clearAlertStore(): void {
  activeAlerts = [];
  alertCooldowns.clear();
}

// ---------------------------------------------------------------------------
// 2. FINGERPRINT & DEDUPLICATION HELPERS
// ---------------------------------------------------------------------------

export function generateAlertFingerprint(entityId: string, alertType: string, evidence: string): string {
  return calculateDecisionFingerprint(entityId, alertType, evidence);
}

export function isAlertInCooldown(fingerprint: string): boolean {
  const expiresAt = alertCooldowns.get(fingerprint);
  if (!expiresAt) return false;
  if (Date.now() >= expiresAt) {
    alertCooldowns.delete(fingerprint);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 3. ALERT CREATION & INGESTION
// ---------------------------------------------------------------------------

export function createGovernanceAlert(params: {
  title: string;
  severity: AlertSeverity;
  reason: string;
  evidence: string;
  entityId?: string;
  entityType?: string;
  alertType?: string;
}): KnowledgeAlert | null {
  const entityId = params.entityId || 'system';
  const alertType = params.alertType || params.severity;
  const fingerprint = generateAlertFingerprint(entityId, alertType, params.evidence);

  // Anti-spam check
  if (isAlertInCooldown(fingerprint)) {
    return null; // Suppress duplicate alert within cooldown
  }

  const alert: KnowledgeAlert = {
    id: `alt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fingerprint,
    title: sanitizeActionText(params.title),
    severity: params.severity,
    status: 'OPEN',
    reason: sanitizeActionText(params.reason),
    evidence: sanitizeActionText(params.evidence),
    entityId: params.entityId,
    entityType: params.entityType,
    createdAt: new Date().toISOString(),
  };

  activeAlerts.unshift(alert);
  alertCooldowns.set(fingerprint, Date.now() + ALERT_COOLDOWN_MS);

  // Keep max 100 alerts in store
  if (activeAlerts.length > 100) {
    activeAlerts = activeAlerts.slice(0, 100);
  }

  return alert;
}

// ---------------------------------------------------------------------------
// 4. ADMIN ALERT LIFECYCLE ACTIONS
// ---------------------------------------------------------------------------

export function acknowledgeAlert(
  alertId: string,
  adminUserId: string
): { success: boolean; error?: string } {
  try {
    assertAdminAuthorized(adminUserId);
    const alert = activeAlerts.find((a) => a.id === alertId);
    if (!alert) return { success: false, error: 'Alert không tồn tại' };

    alert.status = 'ACKNOWLEDGED';
    alert.acknowledgedAt = new Date().toISOString();
    alert.acknowledgedBy = adminUserId;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function snoozeAlert(
  alertId: string,
  adminUserId: string,
  snoozeHours = 24
): { success: boolean; error?: string } {
  try {
    assertAdminAuthorized(adminUserId);
    const alert = activeAlerts.find((a) => a.id === alertId);
    if (!alert) return { success: false, error: 'Alert không tồn tại' };

    alert.status = 'SNOOZED';
    alert.snoozedUntil = new Date(Date.now() + snoozeHours * 3600 * 1000).toISOString();

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function dismissAlert(
  alertId: string,
  adminUserId: string,
  reason?: string
): { success: boolean; error?: string } {
  try {
    assertAdminAuthorized(adminUserId);
    const alert = activeAlerts.find((a) => a.id === alertId);
    if (!alert) return { success: false, error: 'Alert không tồn tại' };

    alert.status = 'RESOLVED';
    alert.resolvedAt = new Date().toISOString();
    alert.resolvedBy = adminUserId;
    if (reason) {
      alert.reason = `${alert.reason} | Dismiss note: ${sanitizeActionText(reason)}`;
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// 5. MASTER ALERT EVALUATION PIPELINE
// ---------------------------------------------------------------------------

export function evaluateGovernanceAlerts(params: {
  matchRateDrop?: number;
  gapRateSurge?: number;
  criticalRegressionsCount?: number;
  transactionBoundaryFailure?: boolean;
  unauthorizedMutationAttempt?: boolean;
  piiLeakageDetected?: boolean;
  activeConflictsCount?: number;
}): AlertCenterSummary {
  // 1. Transaction Boundary Failure -> CRITICAL
  if (params.transactionBoundaryFailure) {
    createGovernanceAlert({
      title: '🚨 Vi phạm ranh giới Transaction Engine',
      severity: 'CRITICAL',
      reason: 'Phát hiện truy vấn mua hàng bị chuyển hướng sai lệch',
      evidence: 'Transaction boundary breach test triggered',
      entityType: 'TRANSACTION',
      alertType: 'CRITICAL_TXN_BREACH',
    });
  }

  // 2. Critical Regression -> CRITICAL
  if (params.criticalRegressionsCount && params.criticalRegressionsCount > 0) {
    createGovernanceAlert({
      title: `🚨 Phát hiện ${params.criticalRegressionsCount} hồi quy kiến thức nghiêm trọng`,
      severity: 'CRITICAL',
      reason: 'Độ phủ biến thể câu hỏi bị suy giảm sau khi chỉnh sửa kiến thức',
      evidence: `Regressions count: ${params.criticalRegressionsCount}`,
      entityType: 'REGRESSION',
      alertType: 'CRITICAL_REGRESSION',
    });
  }

  // 3. Unauthorized Mutation Attempt -> CRITICAL
  if (params.unauthorizedMutationAttempt) {
    createGovernanceAlert({
      title: '🛡️ Phát hiện nỗ lực đột biến dữ liệu trái phép',
      severity: 'CRITICAL',
      reason: 'Yêu cầu mutation thiếu chữ ký xác thực Admin hợp lệ',
      evidence: 'Unauthorized admin token detected',
      entityType: 'SECURITY',
      alertType: 'UNAUTHORIZED_MUTATION',
    });
  }

  // 4. PII Leakage Detected -> CRITICAL
  if (params.piiLeakageDetected) {
    createGovernanceAlert({
      title: '🔒 Cảnh báo rò rỉ thông tin định danh (PII)',
      severity: 'CRITICAL',
      reason: 'Phát hiện số điện thoại hoặc email chưa được làm sạch trong chuỗi tri thức',
      evidence: 'PII scanner triggered',
      entityType: 'SECURITY',
      alertType: 'PII_LEAKAGE',
    });
  }

  // 5. Gap Rate Surge > 20% -> HIGH
  if (params.gapRateSurge && params.gapRateSurge >= 20) {
    createGovernanceAlert({
      title: `⚠️ Tỷ lệ Knowledge Gap tăng vọt +${params.gapRateSurge}%`,
      severity: 'HIGH',
      reason: 'Khách hàng liên tục hỏi các vấn đề chưa có trong FAQ',
      evidence: `Gap surge: +${params.gapRateSurge}%`,
      entityType: 'KNOWLEDGE_GAP',
      alertType: 'GAP_SURGE_HIGH',
    });
  }

  // 6. Match Rate Drop > 10% -> WARNING
  if (params.matchRateDrop && params.matchRateDrop >= 10) {
    createGovernanceAlert({
      title: `⚡ Tỷ lệ khớp FAQ suy giảm ${params.matchRateDrop}%`,
      severity: 'WARNING',
      reason: 'Các biến thể câu hỏi người dùng có dấu hiệu trượt khỏi FAQ hiện tại',
      evidence: `Match drop: ${params.matchRateDrop}%`,
      entityType: 'FAQ',
      alertType: 'MATCH_RATE_DROP_WARN',
    });
  }

  // 7. Active Conflicts >= 3 -> WARNING
  if (params.activeConflictsCount && params.activeConflictsCount >= 3) {
    createGovernanceAlert({
      title: `⚠️ Phát hiện ${params.activeConflictsCount} mâu thuẫn chính sách tồn đọng`,
      severity: 'WARNING',
      reason: 'Cần giải quyết xung đột giữa FAQ và Negative Policy',
      evidence: `Conflicts: ${params.activeConflictsCount}`,
      entityType: 'CONFLICT',
      alertType: 'CONFLICT_ACCUMULATION',
    });
  }

  // Auto-resolve expired snoozes: SNOOZED -> OPEN if snoozedUntil has passed
  const nowMs = Date.now();
  for (const a of activeAlerts) {
    if (a.status === 'SNOOZED' && a.snoozedUntil) {
      if (nowMs >= new Date(a.snoozedUntil).getTime()) {
        a.status = 'OPEN';
        a.snoozedUntil = undefined;
      }
    }
  }

  const openCount = activeAlerts.filter((a) => a.status === 'OPEN').length;
  const criticalCount = activeAlerts.filter((a) => a.severity === 'CRITICAL' && a.status === 'OPEN').length;
  const highCount = activeAlerts.filter((a) => a.severity === 'HIGH' && a.status === 'OPEN').length;
  const warningCount = activeAlerts.filter((a) => a.severity === 'WARNING' && a.status === 'OPEN').length;
  const infoCount = activeAlerts.filter((a) => a.severity === 'INFO' && a.status === 'OPEN').length;

  return {
    totalAlerts: activeAlerts.length,
    openCount,
    criticalCount,
    highCount,
    warningCount,
    infoCount,
    alerts: [...activeAlerts],
  };
}
