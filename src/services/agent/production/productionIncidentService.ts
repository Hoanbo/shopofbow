// src/services/agent/production/productionIncidentService.ts
// BOW AGENT V3.3 — PHASE 7.0: INCIDENT ENGINE & TIMELINE MEMORY
//
// Deduplicated, fingerprint-backed incident management with full audit timeline
// and SRE/Admin lifecycle actions.
//
// HARD CONTRACTS:
//   - Anti-Spam Memory: Deduplicates incidents via deterministic Decision Fingerprints.
//   - Zero Auto-Mutation: Admin incident actions modify incident records only, never knowledge.

import type {
  ProductionIncident,
  IncidentSeverity,
  IncidentType,
  IncidentStatus,
} from '../monitoring/analyticsTypes';
import { calculateDecisionFingerprint, assertAdminAuthorized, sanitizeActionText } from '../knowledge/knowledgeActionService';

let activeIncidents: ProductionIncident[] = [];
const incidentCooldowns = new Map<string, number>(); // fingerprint -> expiresAt timestamp
const INCIDENT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour anti-spam cooldown

export interface CreateIncidentParams {
  title: string;
  severity: IncidentSeverity;
  type: IncidentType;
  affectedComponent: string;
  evidence: string;
}

export function generateIncidentFingerprint(type: IncidentType, component: string, evidence: string): string {
  return calculateDecisionFingerprint(component, type, evidence);
}

export function createProductionIncident(params: CreateIncidentParams): ProductionIncident | null {
  const fp = generateIncidentFingerprint(params.type, params.affectedComponent, params.evidence);
  const now = Date.now();

  // Check cooldown
  const expiresAt = incidentCooldowns.get(fp);
  if (expiresAt && now < expiresAt) {
    // Update existing incident if present
    const existing = activeIncidents.find((i) => i.fingerprint === fp);
    if (existing) {
      existing.lastDetected = new Date().toISOString();
      return existing;
    }
    return null;
  }

  // Sanitize evidence and title
  const sanitizedTitle = sanitizeActionText(params.title);
  const sanitizedEvidence = sanitizeActionText(params.evidence);

  const incident: ProductionIncident = {
    id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: sanitizedTitle,
    severity: params.severity,
    type: params.type,
    status: 'DETECTED',
    affectedComponent: params.affectedComponent,
    firstDetected: new Date().toISOString(),
    lastDetected: new Date().toISOString(),
    evidence: sanitizedEvidence,
    fingerprint: fp,
  };

  activeIncidents.unshift(incident);
  incidentCooldowns.set(fp, now + INCIDENT_COOLDOWN_MS);

  if (activeIncidents.length > 200) {
    activeIncidents = activeIncidents.slice(0, 200);
  }

  return incident;
}

export function getActiveIncidents(filterSeverity?: IncidentSeverity | 'ALL', filterStatus?: IncidentStatus | 'ALL'): ProductionIncident[] {
  return activeIncidents.filter((inc) => {
    const matchSev = !filterSeverity || filterSeverity === 'ALL' || inc.severity === filterSeverity;
    const matchSt = !filterStatus || filterStatus === 'ALL' || inc.status === filterStatus;
    return matchSev && matchSt;
  });
}

export function hasOpenCriticalIncidents(): boolean {
  return activeIncidents.some(
    (i) => i.severity === 'CRITICAL' && (i.status === 'DETECTED' || i.status === 'ACKNOWLEDGED' || i.status === 'INVESTIGATING')
  );
}

export function acknowledgeIncident(incidentId: string, adminUserId: string): { success: boolean; error?: string } {
  assertAdminAuthorized(adminUserId);
  const incident = activeIncidents.find((i) => i.id === incidentId);
  if (!incident) return { success: false, error: 'Incident not found' };

  incident.status = 'ACKNOWLEDGED';
  incident.acknowledgedBy = adminUserId;
  return { success: true };
}

export function resolveIncident(incidentId: string, adminUserId: string): { success: boolean; error?: string } {
  assertAdminAuthorized(adminUserId);
  const incident = activeIncidents.find((i) => i.id === incidentId);
  if (!incident) return { success: false, error: 'Incident not found' };

  incident.status = 'RESOLVED';
  incident.resolvedBy = adminUserId;
  return { success: true };
}

export function dismissIncident(incidentId: string, adminUserId: string, reason: string): { success: boolean; error?: string } {
  assertAdminAuthorized(adminUserId);
  const incident = activeIncidents.find((i) => i.id === incidentId);
  if (!incident) return { success: false, error: 'Incident not found' };

  incident.status = 'DISMISSED';
  incident.resolvedBy = adminUserId;
  incident.dismissReason = sanitizeActionText(reason);
  return { success: true };
}

export function clearIncidentStore(): void {
  activeIncidents = [];
  incidentCooldowns.clear();
}
