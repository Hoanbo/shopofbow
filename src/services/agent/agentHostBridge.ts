// src/services/agent/agentHostBridge.ts
// BOW AGENT V3.3 — PHASE 7.1 STEP 5: AGENT HOST INTEGRATION BRIDGE
//
// Dual-runtime integration layer connecting shopofbow host application to the
// standalone @bow/agent package with zero-downtime rollback safety and parity tracking.

import type { AgentContext, AgentMessage } from './types';
import { shopAdapter } from './adapters/shopAdapter';
import { processAgentMessage as localProcessAgentMessage } from './agentEngine';
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
  options: ExecutionOptions = {}
): Promise<AgentMessage> {
  const mode = options.mode || 'standalone';
  ensureStandaloneAgentInitialized();

  // Mode 1: Local only (Rollback path)
  if (mode === 'local') {
    return localProcessAgentMessage(userText, context);
  }

  // Mode 2: Shadow mode (Executes both concurrently, compares parity, returns standalone)
  if (mode === 'shadow') {
    const t0 = performance.now();
    const [standaloneResult, localResult] = await Promise.allSettled([
      standaloneProcessAgentMessage(userText, context),
      localProcessAgentMessage(userText, context),
    ]);
    const tDuration = performance.now() - t0;

    const standaloneMsg = standaloneResult.status === 'fulfilled' ? standaloneResult.value : null;
    const localMsg = localResult.status === 'fulfilled' ? localResult.value : null;

    if (standaloneMsg && localMsg && options.logParity) {
      const isMatch =
        standaloneMsg.content.trim() === localMsg.content.trim() &&
        (standaloneMsg.actions?.length || 0) === (localMsg.actions?.length || 0);

      if (!isMatch) {
        console.warn('[AgentHostBridge] Shadow Parity Drift Detected:', {
          userText,
          standaloneActions: standaloneMsg.actions?.length,
          localActions: localMsg.actions?.length,
          totalDurationMs: tDuration.toFixed(2),
        });
      }
    }

    if (standaloneMsg) return standaloneMsg;
    if (localMsg) return localMsg;
    throw new Error('Both standalone and local agent executions failed.');
  }

  // Mode 3: Standalone primary with local fallback guard
  try {
    return await standaloneProcessAgentMessage(userText, context);
  } catch (err) {
    console.error('[AgentHostBridge] Standalone @bow/agent failed, falling back to local core:', err);
    return await localProcessAgentMessage(userText, context);
  }
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
  const localMsg = await localProcessAgentMessage(userText, context);
  const t2 = performance.now();

  const isMatch =
    standaloneMsg.content.trim() === localMsg.content.trim() &&
    (standaloneMsg.actions?.length || 0) === (localMsg.actions?.length || 0);

  return {
    isMatch,
    standaloneContent: standaloneMsg.content,
    localContent: localMsg.content,
    standaloneActionCount: standaloneMsg.actions?.length || 0,
    localActionCount: localMsg.actions?.length || 0,
    latencyDiffMs: (t1 - t0) - (t2 - t1),
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
