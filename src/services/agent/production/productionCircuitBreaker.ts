// src/services/agent/production/productionCircuitBreaker.ts
// BOW AGENT V3.3 — PHASE 7.0: PRODUCTION CIRCUIT BREAKER
//
// Protects the system against cascading AI inference failures, upstream timeouts,
// and runaway errors while guaranteeing complete isolation of core business transactions.
//
// HARD CONTRACTS:
//   - Isolation Guarantee: ONLY intercepts optional AI/enrichment layers.
//   - NEVER blocks Payment, Wallet, Transactions, Orders, or Warranty.
//   - Zero Auto-Mutation: State transitions affect circuit state only.

import type { CircuitBreakerState } from '../monitoring/analyticsTypes';

interface CircuitBreakerConfig {
  failureThreshold: number;       // e.g. 5 failures to trip OPEN
  recoveryTimeoutMs: number;      // e.g. 30,000ms in OPEN before HALF_OPEN probe
  successProbeThreshold: number;  // e.g. 3 successes in HALF_OPEN to reset CLOSED
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeoutMs: 30000,
  successProbeThreshold: 3,
};

let state: CircuitBreakerState = 'CLOSED';
let consecutiveFailures = 0;
let consecutiveSuccesses = 0;
let openedAt: number | null = null;
let lastFailureReason: string | null = null;

// ---------------------------------------------------------------------------
// 1. STATE READ & TRANSITION
// ---------------------------------------------------------------------------

export function getCircuitBreakerState(): CircuitBreakerState {
  // If OPEN and recovery timeout has elapsed, transition to HALF_OPEN probe
  if (state === 'OPEN' && openedAt) {
    const elapsed = Date.now() - openedAt;
    if (elapsed >= DEFAULT_CONFIG.recoveryTimeoutMs) {
      state = 'HALF_OPEN';
      consecutiveSuccesses = 0;
    }
  }
  return state;
}

export function isCircuitOpen(): boolean {
  return getCircuitBreakerState() === 'OPEN';
}

export function recordExecutionSuccess(): void {
  const current = getCircuitBreakerState();
  if (current === 'HALF_OPEN') {
    consecutiveSuccesses++;
    if (consecutiveSuccesses >= DEFAULT_CONFIG.successProbeThreshold) {
      state = 'CLOSED';
      consecutiveFailures = 0;
      consecutiveSuccesses = 0;
      openedAt = null;
      lastFailureReason = null;
    }
  } else if (current === 'CLOSED') {
    consecutiveFailures = 0;
  }
}

export function recordExecutionFailure(reason: string): void {
  const current = getCircuitBreakerState();
  lastFailureReason = reason;

  if (current === 'HALF_OPEN') {
    // Immediate trip back to OPEN upon failure in HALF_OPEN probe
    state = 'OPEN';
    openedAt = Date.now();
    consecutiveSuccesses = 0;
  } else if (current === 'CLOSED') {
    consecutiveFailures++;
    if (consecutiveFailures >= DEFAULT_CONFIG.failureThreshold) {
      state = 'OPEN';
      openedAt = Date.now();
    }
  }
}

export function forceTripCircuit(reason = 'Manual trip by Admin / Health Gate'): void {
  state = 'OPEN';
  openedAt = Date.now();
  lastFailureReason = reason;
}

export function resetCircuitBreaker(): void {
  state = 'CLOSED';
  consecutiveFailures = 0;
  consecutiveSuccesses = 0;
  openedAt = null;
  lastFailureReason = null;
}

export function getCircuitBreakerStats() {
  return {
    state: getCircuitBreakerState(),
    consecutiveFailures,
    consecutiveSuccesses,
    openedAt: openedAt ? new Date(openedAt).toISOString() : null,
    lastFailureReason,
  };
}

// ---------------------------------------------------------------------------
// 2. CRITICAL TRANSACTION ISOLATION GUARD
// ---------------------------------------------------------------------------

/**
 * Hard Invariant: Critical business flows must NEVER be intercepted by the circuit breaker.
 */
export function isExemptFromCircuitBreaker(intent: string, route: string): boolean {
  const exemptIntents = ['BUY', 'DEPOSIT', 'WARRANTY', 'CHECKOUT', 'ORDER_STATUS'];
  const exemptRoutes = ['TRANSACTIONAL', 'WARRANTY', 'WALLET'];

  return (
    exemptIntents.includes(intent.toUpperCase()) ||
    exemptRoutes.includes(route.toUpperCase())
  );
}
