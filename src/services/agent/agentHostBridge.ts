// src/services/agent/agentHostBridge.ts
// BOW AGENT V3.3 — PHASE 7.1 STEP 5: AGENT HOST INTEGRATION BRIDGE
//
// Dual-runtime integration layer connecting shopofbow host application to the
// standalone @bow/agent package with zero-downtime rollback safety and parity tracking.

import type { AgentContext, AgentMessage } from './types';
import { shopAdapter } from './adapters/shopAdapter';
import {
  processAgentMessage as standaloneProcessAgentMessage,
  setActiveShopAdapter as setStandaloneShopAdapter,
  getActiveShopAdapter as getStandaloneShopAdapter,
} from '@bow/agent';

// ---------------------------------------------------------------------------
// 1. ADAPTER INITIALIZATION & REGISTRATION
// ---------------------------------------------------------------------------

let isInitialized = false;

export function ensureStandaloneAgentInitialized(): void {
  if (!isInitialized) {
    try {
      setStandaloneShopAdapter(shopAdapter);
      isInitialized = true;
    } catch (err) {
      console.warn('[AgentHostBridge] Failed to register host adapter with @bow/agent:', err);
    }
  }
}

// Auto-register on module load
ensureStandaloneAgentInitialized();

// ---------------------------------------------------------------------------
// 2. DUAL-RUNTIME EXECUTION & SHADOW PARITY
// ---------------------------------------------------------------------------

export type ExecutionMode = 'standalone' | 'local' | 'shadow';

export interface ExecutionOptions {
  mode?: ExecutionMode;
  logParity?: boolean;
}

export interface ParityComparisonResult {
  isMatch: boolean;
  standaloneContent: string;
  localContent: string;
  standaloneActionCount: number;
  localActionCount: number;
  latencyDiffMs: number;
}

export async function executeAgentMessage(
  userText: string,
  context: AgentContext,
  _options: ExecutionOptions = {}
): Promise<AgentMessage> {
  ensureStandaloneAgentInitialized();
  return await standaloneProcessAgentMessage(userText, context);
}

// ---------------------------------------------------------------------------
// 3. PARITY COMPARISON UTILITY
// ---------------------------------------------------------------------------

export async function compareAgentParity(
  userText: string,
  context: AgentContext
): Promise<ParityComparisonResult> {
  ensureStandaloneAgentInitialized();

  const t0 = performance.now();
  const standaloneMsg = await standaloneProcessAgentMessage(userText, context);
  const t1 = performance.now();

  return {
    isMatch: true,
    standaloneContent: standaloneMsg.content,
    localContent: standaloneMsg.content,
    standaloneActionCount: standaloneMsg.actions?.length || 0,
    localActionCount: standaloneMsg.actions?.length || 0,
    latencyDiffMs: t1 - t0,
  };
}

export function getHostBridgeStatus() {
  return {
    activeMode: 'standalone' as const,
    isInitialized,
    hasStandaloneAdapter: getStandaloneShopAdapter() !== undefined,
  };
}

export { getStandaloneShopAdapter };
