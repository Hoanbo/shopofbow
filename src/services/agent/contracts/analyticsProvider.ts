// src/services/agent/contracts/analyticsProvider.ts
// BOW AGENT V3.3 — STEP 1: ANALYTICS & TELEMETRY PROVIDER CONTRACT
//
// Abstracts analytics event storage, demand aggregations, and telemetry ingestion.

import type { AgentAnalyticsEventType } from '../monitoring/analyticsTypes';

export interface AgentAnalyticsEventInput {
  eventType: AgentAnalyticsEventType;
  sessionId: string;
  userId?: string | null;
  intent?: string;
  query?: string;
  route?: string;
  latencyMs?: number;
  metadata?: Record<string, any>;
  reason?: string;
}

export interface AnalyticsQueryOptions {
  sessionId?: string;
  userId?: string;
  eventType?: AgentAnalyticsEventType;
  since?: string;
  limit?: number;
}

export interface AnalyticsProvider {
  /**
   * Record an agent analytics or telemetry event asynchronously
   */
  recordEvent(event: AgentAnalyticsEventInput): Promise<void>;

  /**
   * Retrieve historical agent events matching query options
   */
  getEvents(options?: AnalyticsQueryOptions): Promise<any[]>;

  /**
   * Retrieve aggregated product demand signals
   */
  getDemandSummary(since?: string): Promise<Record<string, number>>;
}
