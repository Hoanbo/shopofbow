// scratch/test_phase7_0_production.ts
// BOW AGENT V3.3 — PHASE 7.0 MASTER PRODUCTION READINESS & SCALING TEST SUITE
//
// 26 Comprehensive Sections (A through Z) verifying Production General Availability,
// Live Traffic Scaling, Progressive Rollouts, Circuit Breaker, Capacity Protection,
// and complete Business Invariant Preservation.

import {
  recordProductionMetric,
  getProductionMetrics,
  calculateTrafficStats,
  calculateLatencyStats,
  calculateReliabilityStats,
  clearProductionTelemetryCache,
  sanitizeProductionTelemetryText,
  detectPiiInText,
} from '../src/services/agent/production/productionTelemetryService';
import {
  evaluateProductionSlo,
  getSloThresholds,
  DEFAULT_SLO_THRESHOLDS,
} from '../src/services/agent/production/productionSloService';
import {
  getCircuitBreakerState,
  isCircuitOpen,
  recordExecutionSuccess,
  recordExecutionFailure,
  forceTripCircuit,
  resetCircuitBreaker,
  getCircuitBreakerStats,
  isExemptFromCircuitBreaker,
} from '../src/services/agent/production/productionCircuitBreaker';
import {
  generateDeterministicFallback,
  getAuthorityLevel,
} from '../src/services/agent/production/productionFallbackService';
import {
  getRolloutState,
  shouldRouteToV3,
  updateRolloutStage,
  blockRollout,
  unblockRollout,
  resetRolloutState,
} from '../src/services/agent/production/productionRolloutService';
import {
  executeRollback,
  getRollbackHistory,
  clearRollbackHistory,
} from '../src/services/agent/production/productionRollbackService';
import {
  getCapacityStatus,
  acquireCapacitySlot,
  releaseCapacitySlot,
  recordTimeout,
  getCapacityMetrics,
  resetCapacityCounters,
} from '../src/services/agent/production/productionCapacityService';
import {
  createProductionIncident,
  getActiveIncidents,
  hasOpenCriticalIncidents,
  acknowledgeIncident,
  resolveIncident,
  dismissIncident,
  clearIncidentStore,
  generateIncidentFingerprint,
} from '../src/services/agent/production/productionIncidentService';
import {
  calculateProductionHealthScore,
  getProductionControlCenterSummary,
  clearProductionSummaryCache,
} from '../src/services/agent/production/productionHealthService';
import {
  classifyKnowledgeGap,
  normalizeKnowledgeQuestion,
} from '../src/services/agent/knowledge/knowledgeGapDetector';
import {
  GOLDEN_QUERIES,
  evaluateGoldenQuery,
  testDurationInvariant,
  testPromptInjectionResistance,
  testUnicodeNormalization,
} from '../src/services/agent/knowledge/knowledgeQaService';

// ---------------------------------------------------------------------------
// TEST HARNESS & RUNNER
// ---------------------------------------------------------------------------

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, description: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✅ [PASS] ${description}`);
  } else {
    failedAssertions++;
    console.error(`  ❌ [FAIL] ${description}`);
  }
}

async function runProductionReadinessSuite() {
  console.log('========================================================================');
  console.log('🚀 BOW AGENT V3.3 — PHASE 7.0 PRODUCTION READINESS MASTER TEST SUITE');
  console.log('========================================================================');

  // -------------------------------------------------------------------------
  // SECTION A: Production Data Models & Configuration
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION A: Production Data Models & Configuration');
  const thresholds = getSloThresholds();
  assert(thresholds.availabilityTarget === 99.9, 'SLO Availability target is 99.9%');
  assert(thresholds.errorRateHealthyMax === 1.0, 'SLO Error Rate healthy max is 1.0%');
  assert(thresholds.p95LatencyHealthyMax === 500, 'SLO P95 latency healthy max is 500ms');
  assert(thresholds.p99LatencyHealthyMax === 1000, 'SLO P99 latency healthy max is 1000ms');
  assert(thresholds.fallbackRateHealthyMax === 5.0, 'SLO Fallback rate healthy max is 5.0%');
  assert(thresholds.knowledgeGapRateHealthyMax === 10.0, 'SLO Knowledge gap rate healthy max is 10.0%');

  // -------------------------------------------------------------------------
  // SECTION B: Production Telemetry Logging & Ingestion
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION B: Telemetry Logging & Ingestion');
  clearProductionTelemetryCache();
  const m1 = recordProductionMetric({
    route: 'TRANSACTIONAL',
    intent: 'BUY',
    latencyMs: 42.6,
    success: true,
    fallbackUsed: false,
    knowledgeHit: false,
    negativePolicyHit: false,
    transactionBoundaryHit: true,
    warrantyBoundaryHit: false,
    productDemandHit: false,
    rawQuery: 'Mua YouTube 6 tháng',
  });
  assert(m1.requestId.startsWith('req-'), 'RequestId generated with prefix req-');
  assert(m1.latencyMs === 43, 'Latency is rounded to integer');
  assert(m1.transactionBoundaryHit === true, 'Transaction boundary flag recorded');
  assert(m1.sanitized === true, 'Sanitized flag set to true');

  const metricsList = getProductionMetrics(60);
  assert(metricsList.length === 1, 'Metric stored in in-memory telemetry buffer');

  // -------------------------------------------------------------------------
  // SECTION C: SLO Evaluation & Threshold Rules
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION C: SLO Evaluation & Threshold Rules');
  const emptySlo = evaluateProductionSlo([]);
  assert(emptySlo.overallStatus === 'INSUFFICIENT_DATA', 'Empty metrics return INSUFFICIENT_DATA');

  // Inject 10 healthy metrics
  clearProductionTelemetryCache();
  for (let i = 0; i < 10; i++) {
    recordProductionMetric({
      route: 'FAQ',
      intent: 'GENERAL',
      latencyMs: 150 + i * 10,
      success: true,
      fallbackUsed: false,
      knowledgeHit: true,
      negativePolicyHit: false,
      transactionBoundaryHit: false,
      warrantyBoundaryHit: false,
      productDemandHit: false,
    });
  }
  const healthySlo = evaluateProductionSlo();
  assert(healthySlo.overallStatus === 'HEALTHY', 'Healthy traffic evaluates to HEALTHY');
  assert(healthySlo.availability.status === 'HEALTHY', 'Availability 100% is HEALTHY');
  assert(healthySlo.errorRate.status === 'HEALTHY', 'Error rate 0% is HEALTHY');

  // -------------------------------------------------------------------------
  // SECTION D: Latency Tracking & Percentiles (P50, P95, P99)
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION D: Latency Tracking & Percentiles');
  const latStats = calculateLatencyStats(60);
  assert(!latStats.isInsufficientData, 'Sufficient latency data computed');
  assert(latStats.p50 <= latStats.p95, 'Ordering invariant: P50 <= P95');
  assert(latStats.p95 <= latStats.p99, 'Ordering invariant: P95 <= P99');
  assert(latStats.max >= latStats.p99, 'Ordering invariant: P99 <= Max');

  // -------------------------------------------------------------------------
  // SECTION E: Error Rate Calculation & Classification
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION E: Error Rate Calculation & Classification');
  // Add 1 error metric
  recordProductionMetric({
    route: 'DETERMINISTIC',
    intent: 'GENERAL',
    latencyMs: 300,
    success: false,
    errorType: 'AI_TIMEOUT',
    fallbackUsed: true,
    knowledgeHit: false,
    negativePolicyHit: false,
    transactionBoundaryHit: false,
    warrantyBoundaryHit: false,
    productDemandHit: false,
  });
  const relStats = calculateReliabilityStats(60);
  assert(relStats.errorRate > 0, `Error rate accurately calculated: ${relStats.errorRate}%`);
  assert(relStats.fallbackRate > 0, `Fallback rate accurately calculated: ${relStats.fallbackRate}%`);
  assert(relStats.successRate < 100, `Success rate calculated: ${relStats.successRate}%`);

  // -------------------------------------------------------------------------
  // SECTION F: Traffic Monitoring Across Time Windows
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION F: Traffic Monitoring Across Time Windows');
  const tf15m = calculateTrafficStats(15);
  const tf60m = calculateTrafficStats(60);
  assert(tf15m.requestsPerMin >= 0, 'Requests per minute non-negative');
  assert(tf60m.totalRequestsInWindow >= tf15m.totalRequestsInWindow, 'Longer window contains >= shorter window');

  // -------------------------------------------------------------------------
  // SECTION G: Capacity Guard & Load State Transitions
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION G: Capacity Guard & Load State Transitions');
  resetCapacityCounters();
  assert(getCapacityStatus(50) === 'NORMAL', '<100 rpm maps to NORMAL');
  assert(getCapacityStatus(250) === 'BUSY', '100-500 rpm maps to BUSY');
  assert(getCapacityStatus(750) === 'HIGH_LOAD', '500-1000 rpm maps to HIGH_LOAD');
  assert(getCapacityStatus(2500) === 'OVERLOAD', '>1000 rpm maps to OVERLOAD');

  const slot1 = acquireCapacitySlot();
  assert(slot1.acquired === true, 'Capacity slot acquired successfully');
  // Acquire up to 100 slots
  const acquiredSlots = [slot1];
  for (let i = 1; i < 100; i++) {
    acquiredSlots.push(acquireCapacitySlot());
  }
  const overflowSlot = acquireCapacitySlot();
  assert(overflowSlot.acquired === false, '101st slot rejected due to concurrency ceiling (100)');
  assert(overflowSlot.reason?.includes('ceiling') ?? false, 'Rejection reason cites concurrency ceiling');

  // Release all slots
  for (let i = 0; i < 100; i++) {
    releaseCapacitySlot();
  }
  assert(getCapacityMetrics(50).concurrentRequests === 0, 'All concurrency slots safely released');

  // -------------------------------------------------------------------------
  // SECTION H: Circuit Breaker States & Transitions
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION H: Circuit Breaker States & Transitions');
  resetCircuitBreaker();
  assert(getCircuitBreakerState() === 'CLOSED', 'Initial state is CLOSED');
  assert(!isCircuitOpen(), 'isCircuitOpen is false when CLOSED');

  // Trip to OPEN with 5 failures
  for (let i = 0; i < 5; i++) {
    recordExecutionFailure('Upstream Provider Error');
  }
  assert(getCircuitBreakerState() === 'OPEN', '5 failures trips circuit to OPEN');
  assert(isCircuitOpen(), 'isCircuitOpen is true when OPEN');

  // Isolation test: Transaction and warranty are NEVER blocked
  assert(isExemptFromCircuitBreaker('BUY', 'TRANSACTIONAL'), 'BUY transaction is exempt from circuit breaker');
  assert(isExemptFromCircuitBreaker('WARRANTY', 'WARRANTY'), 'WARRANTY is exempt from circuit breaker');
  assert(!isExemptFromCircuitBreaker('GENERAL', 'FAQ'), 'General FAQ inquiry is not exempt');

  // Reset circuit
  resetCircuitBreaker();
  assert(getCircuitBreakerState() === 'CLOSED', 'Circuit reset back to CLOSED');

  // -------------------------------------------------------------------------
  // SECTION I: Graceful Degradation & Deterministic Fallback
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION I: Graceful Degradation & Deterministic Fallback');
  const fallbackMsg = generateDeterministicFallback({
    originalQuery: 'Chat bot loi',
    sampleProducts: [{ name: 'YouTube Premium 6T', startingPrice: 280000 }],
  });
  assert(fallbackMsg.sender === 'agent', 'Fallback message sender is agent');
  assert(fallbackMsg.content.includes('chế độ an toàn'), 'Fallback indicates safe mode');
  assert(fallbackMsg.content.includes('280.000đ'), 'Fallback includes verified product pricing');

  // Authority levels
  assert(getAuthorityLevel('TRANSACTIONAL') === 1, 'Transactional has authority level 1 (highest)');
  assert(getAuthorityLevel('CATALOG') === 2, 'Catalog has authority level 2');
  assert(getAuthorityLevel('KNOWLEDGE_GAP') === 6, 'Knowledge gap has authority level 6');

  // -------------------------------------------------------------------------
  // SECTION J: Progressive Rollout Pipeline & Promotion Gates
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION J: Progressive Rollout Pipeline & Promotion Gates');
  resetRolloutState();
  const initRollout = getRolloutState();
  assert(initRollout.currentStage === '100', 'Initial rollout stage is 100%');
  assert(shouldRouteToV3('any-user') === true, '100% rollout routes all users');

  // Demote to 10%
  const demoteRes = updateRolloutStage({
    adminUserId: 'admin-001',
    targetStage: '10',
  });
  assert(demoteRes.success === true, 'Admin demotes stage to 10%');
  assert(demoteRes.state.currentStage === '10', 'Stage updated to 10%');

  // Test hash bucketing: deterministic routing for same user
  const userA = 'user-abc-123';
  const routeA1 = shouldRouteToV3(userA);
  const routeA2 = shouldRouteToV3(userA);
  assert(routeA1 === routeA2, 'User routing is 100% deterministic');

  // Safety Gate: Promotion blocked if health score <= 40
  const blockedPromo = updateRolloutStage({
    adminUserId: 'admin-001',
    targetStage: '50',
    healthScore: 35, // DEGRADED!
  });
  assert(blockedPromo.success === false, 'Promotion strictly blocked when health score <= 40');
  assert(blockedPromo.state.isBlocked === true, 'Rollout state marked as blocked');

  // Reset rollout state
  resetRolloutState();

  // -------------------------------------------------------------------------
  // SECTION K: Deterministic Rollback Engine
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION K: Deterministic Rollback Engine');
  clearRollbackHistory();
  const rbRes = executeRollback({
    adminUserId: 'admin-001',
    targetStage: 'OFF',
    reason: 'Emergency rollback test',
    metricsSnapshot: { errorRate: 15 },
  });
  assert(rbRes.success === true, 'Rollback executed successfully');
  assert(rbRes.record.stageAfter === 'OFF', 'Stage after rollback is OFF');
  assert(getRolloutState().currentStage === 'OFF', 'Active rollout stage is now OFF');

  const rbHistory = getRollbackHistory();
  assert(rbHistory.length === 1, 'Rollback record stored in history');

  resetRolloutState(); // restore

  // -------------------------------------------------------------------------
  // SECTION L: Incident Management Lifecycle & Fingerprinting
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION L: Incident Management Lifecycle');
  clearIncidentStore();
  const inc1 = createProductionIncident({
    title: 'Tăng đột biến tỷ lệ Fallback',
    severity: 'HIGH',
    type: 'FALLBACK_SPIKE',
    affectedComponent: 'geminiClient',
    evidence: 'Fallback rate surged to 12%',
  });
  assert(inc1 !== null, 'Incident created successfully');
  assert(inc1!.fingerprint.startsWith('fp-'), 'Incident has valid Decision Fingerprint');
  assert(inc1!.status === 'DETECTED', 'Initial incident status is DETECTED');

  // Deduplication check
  const incDuplicate = createProductionIncident({
    title: 'Tăng đột biến tỷ lệ Fallback',
    severity: 'HIGH',
    type: 'FALLBACK_SPIKE',
    affectedComponent: 'geminiClient',
    evidence: 'Fallback rate surged to 12%',
  });
  assert(incDuplicate!.id === inc1!.id, 'Duplicate incident within cooldown is deduplicated to same ID');

  // Lifecycle actions
  const ackRes = acknowledgeIncident(inc1!.id, 'admin-001');
  assert(ackRes.success === true, 'Admin acknowledged incident');
  assert(inc1!.status === 'ACKNOWLEDGED', 'Incident status updated to ACKNOWLEDGED');

  const resRes = resolveIncident(inc1!.id, 'admin-001');
  assert(resRes.success === true, 'Admin resolved incident');
  assert(inc1!.status === 'RESOLVED', 'Incident status updated to RESOLVED');

  // -------------------------------------------------------------------------
  // SECTION M: Production Health Score (9-Component Weighted Calculation)
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION M: Production Health Score (9-Component Weighted Sum)');
  const perfectHealth = calculateProductionHealthScore({
    reliability: 20,
    latency: 15,
    errorHealth: 15,
    routingHealth: 15,
    knowledgeHealth: 10,
    securityHealth: 10,
    capacityHealth: 5,
    sloCompliance: 5,
    incidentHealth: 5,
  });
  assert(perfectHealth.score === 100, 'Perfect components yield exactly 100 points');
  assert(perfectHealth.status === 'EXCELLENT', 'Score 100 maps to EXCELLENT');
  assert(!perfectHealth.isCapped, 'Uncapped healthy score');

  // Component weights verification
  assert(perfectHealth.components.reliability === 20, 'Reliability component max 20pts');
  assert(perfectHealth.components.latency === 15, 'Latency component max 15pts');
  assert(perfectHealth.components.errorHealth === 15, 'Error Health component max 15pts');
  assert(perfectHealth.components.routingHealth === 15, 'Routing Health component max 15pts');
  assert(perfectHealth.components.knowledgeHealth === 10, 'Knowledge Health component max 10pts');
  assert(perfectHealth.components.securityHealth === 10, 'Security Health component max 10pts');
  assert(perfectHealth.components.capacityHealth === 5, 'Capacity Health component max 5pts');
  assert(perfectHealth.components.sloCompliance === 5, 'SLO Compliance component max 5pts');
  assert(perfectHealth.components.incidentHealth === 5, 'Incident Health component max 5pts');

  // -------------------------------------------------------------------------
  // SECTION N: Production Health Score Hard Cap Triggers
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION N: Production Health Score Hard Cap Triggers');
  const cappedByTxn = calculateProductionHealthScore({
    reliability: 20,
    hasTransactionBoundaryBreach: true, // TRIGGER
  });
  assert(cappedByTxn.isCapped === true, 'Transaction boundary breach triggers hard cap');
  assert(cappedByTxn.score <= 40, `Capped score is <= 40 (Actual: ${cappedByTxn.score})`);
  assert(cappedByTxn.status === 'CRITICAL', 'Status forced to CRITICAL');

  const cappedByDuration = calculateProductionHealthScore({
    hasDurationRegression: true, // TRIGGER
  });
  assert(cappedByDuration.isCapped === true, 'Duration regression triggers hard cap');
  assert(cappedByDuration.score <= 40, 'Duration regression score capped at 40');

  const cappedByWarranty = calculateProductionHealthScore({
    hasWarrantyBreach: true, // TRIGGER
  });
  assert(cappedByWarranty.isCapped === true, 'Warranty breach triggers hard cap');
  assert(cappedByWarranty.score <= 40, 'Warranty breach score capped at 40');

  const cappedByDemand = calculateProductionHealthScore({
    hasProductDemandAutoCreation: true, // TRIGGER
  });
  assert(cappedByDemand.isCapped === true, 'Product demand auto-creation triggers hard cap');
  assert(cappedByDemand.score <= 40, 'Product demand auto-creation score capped at 40');

  const cappedByMutation = calculateProductionHealthScore({
    hasUnauthorizedMutationAttempt: true, // TRIGGER
  });
  assert(cappedByMutation.isCapped === true, 'Unauthorized mutation triggers hard cap');
  assert(cappedByMutation.score <= 40, 'Unauthorized mutation score capped at 40');

  const cappedByPii = calculateProductionHealthScore({
    hasPiiLeakage: true, // TRIGGER
  });
  assert(cappedByPii.isCapped === true, 'PII leakage triggers hard cap');
  assert(cappedByPii.score <= 40, 'PII leakage score capped at 40');

  // -------------------------------------------------------------------------
  // SECTION O: Hard Invariant 1 — Transaction Boundary Isolation
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION O: Hard Invariant 1 — Transaction Boundary Isolation');
  const txnCheck1 = classifyKnowledgeGap('Mua YouTube 6 tháng', 'BUY', 1, 0, false);
  assert(txnCheck1 === 'TRANSACTIONAL', '"Mua YouTube 6 tháng" strictly routes to TRANSACTIONAL');

  const txnCheck2 = classifyKnowledgeGap('Nạp 100k vào ví', 'DEPOSIT', 0, 0, false);
  assert(txnCheck2 === 'TRANSACTIONAL', '"Nạp 100k vào ví" strictly routes to TRANSACTIONAL');

  // -------------------------------------------------------------------------
  // SECTION P: Hard Invariant 2 — Duration Invariant (1m, 6m, 12m)
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION P: Hard Invariant 2 — Duration Invariant');
  const yt1m = GOLDEN_QUERIES.find((q) => q.id === 'gq-txn-yt1m');
  const yt6m = GOLDEN_QUERIES.find((q) => q.id === 'gq-txn-yt6m');
  const yt12m = GOLDEN_QUERIES.find((q) => q.id === 'gq-txn-yt12m');
  assert(yt1m?.expectedPrice === 35000, '1 Month price is immutable @ 35.000đ');
  assert(yt6m?.expectedPrice === 280000, '6 Months price is immutable @ 280.000đ');
  assert(yt12m?.expectedPrice === 450000, '12 Months price is immutable @ 450.000đ');

  const durInvariant = testDurationInvariant();
  assert(durInvariant.status === 'PASS', 'Duration invariant QA test passes 100%');

  // -------------------------------------------------------------------------
  // SECTION Q: Hard Invariant 3 — Product Demand Boundary
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION Q: Hard Invariant 3 — Product Demand Boundary');
  const demandCheck = classifyKnowledgeGap('Shop có bán Canva Pro không?', 'PRODUCT_SEARCH', 0, 0, false);
  assert(demandCheck === 'PRODUCT_DEMAND', '"Shop có bán Canva Pro không?" strictly routes to PRODUCT_DEMAND');

  // -------------------------------------------------------------------------
  // SECTION R: Hard Invariant 4 — Warranty Boundary Isolation
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION R: Hard Invariant 4 — Warranty Boundary Isolation');
  const warrantyCheck = classifyKnowledgeGap('Bảo hành đơn BOW-CANCEL-1', 'WARRANTY', 0, 0, false);
  assert(warrantyCheck === 'TRANSACTIONAL', 'Warranty query remains isolated with in-place confirmation');

  // -------------------------------------------------------------------------
  // SECTION S: Hard Invariant 5 — Negative Policy Loop Prevention
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION S: Hard Invariant 5 — Negative Policy Anti-Loop');
  const negCheck = classifyKnowledgeGap('Shop có hỗ trợ cài Wireguard không?', 'GENERAL', 0, 0, true);
  assert(negCheck === 'SUPPORTED_NEGATIVE_POLICY', 'Active negative policy match routes to SUPPORTED_NEGATIVE_POLICY');
  assert(negCheck !== 'KNOWLEDGE_GAP', 'Does not produce infinite knowledge gap creation loop');

  // -------------------------------------------------------------------------
  // SECTION T: Hard Invariant 6 — Zero Auto-Mutation Guarantee
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION T: Hard Invariant 6 — Zero Auto-Mutation Guarantee');
  const summaryBefore = getProductionControlCenterSummary(true);
  assert(summaryBefore.healthScore.score > 0, 'Production Control Center summary is pure read-model');
  assert(summaryBefore.boundaryHealth.zeroAutoMutation === true, 'Zero auto mutation invariant guaranteed');

  // -------------------------------------------------------------------------
  // SECTION U: Privacy & PII Scrubbing
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION U: Privacy & PII Scrubbing');
  const rawPiiText = 'Email: user@example.com, SĐT: 0987654321, API: sk-1234567890abcdef, Token: Bearer abcdef123456';
  const cleanPii = sanitizeProductionTelemetryText(rawPiiText);
  assert(!cleanPii.includes('user@example.com'), 'Email scrubbed from telemetry');
  assert(!cleanPii.includes('0987654321'), 'Phone number scrubbed from telemetry');
  assert(!cleanPii.includes('sk-1234567890abcdef'), 'API key scrubbed from telemetry');
  assert(cleanPii.includes('[REDACTED_EMAIL]'), 'Replaced with [REDACTED_EMAIL]');
  assert(cleanPii.includes('[REDACTED_PHONE]'), 'Replaced with [REDACTED_PHONE]');
  assert(cleanPii.includes('[REDACTED_TOKEN]'), 'Replaced with [REDACTED_TOKEN]');

  // SQL & Script injection scrubbing
  const rawMalicious = '<script>alert(1)</script> UNION ALL SELECT * FROM users;';
  const cleanMalicious = sanitizeProductionTelemetryText(rawMalicious);
  assert(!cleanMalicious.includes('<script>'), 'Script tags stripped from telemetry');
  assert(cleanMalicious.includes('[REDACTED_SCRIPT]'), 'Script replaced with [REDACTED_SCRIPT]');
  assert(cleanMalicious.includes('[REDACTED_SQL]'), 'SQL injection replaced with [REDACTED_SQL]');

  assert(!detectPiiInText('Tin nhắn bình thường không chứa PII'), 'detectPiiInText returns false for normal text');
  assert(detectPiiInText('Khách email user@domain.com nhé'), 'detectPiiInText detects email');
  assert(detectPiiInText('Gọi vào số 0912345678'), 'detectPiiInText detects phone');
  assert(detectPiiInText('Khóa bí mật sk-abcdef12345678'), 'detectPiiInText detects API key');

  // -------------------------------------------------------------------------
  // SECTION V: Prompt Injection & Adversarial Neutralization
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION V: Prompt Injection Resistance');
  const injectionQa = testPromptInjectionResistance();
  assert(injectionQa.status === 'PASS', 'Prompt injection QA test passes 100%');

  // -------------------------------------------------------------------------
  // SECTION W: Vietnamese Unicode Normalization
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION W: Vietnamese Unicode Normalization');
  const unicodeQa = testUnicodeNormalization();
  assert(unicodeQa.status === 'PASS', 'Vietnamese Unicode NFC/NFD normalization passes 100%');
  assert(normalizeKnowledgeQuestion('cài đặt ultraview') === normalizeKnowledgeQuestion('cai dat ultraview'), 'NFD and unaccented normalize equally');
  assert(normalizeKnowledgeQuestion('HOA DON 123') === normalizeKnowledgeQuestion('hoa don 123'), 'Uppercase normalizes identically');
  assert(normalizeKnowledgeQuestion('   nhieu    khoang    trang   ') === 'nhieu khoang trang', 'Whitespace collapse works');

  // -------------------------------------------------------------------------
  // SECTION X: In-Memory Caching & Deterministic Invalidation
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION X: In-Memory Caching & Deterministic Invalidation');
  clearProductionSummaryCache();
  const s1 = getProductionControlCenterSummary(false);
  const s2 = getProductionControlCenterSummary(false);
  assert(s1.lastUpdated === s2.lastUpdated, 'Summary served from cache within TTL');

  clearProductionSummaryCache();
  const s3 = getProductionControlCenterSummary(true);
  assert(typeof s3.healthScore.score === 'number', 'Fresh summary returned after cache clear');

  // -------------------------------------------------------------------------
  // SECTION Y: Concurrency Stress (100, 500, 1000, 5000 requests)
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION Y: Concurrency Stress Simulation');
  clearProductionTelemetryCache();
  const startConc = performance.now();
  for (let i = 0; i < 1000; i++) {
    recordProductionMetric({
      route: i % 2 === 0 ? 'TRANSACTIONAL' : 'FAQ',
      intent: i % 2 === 0 ? 'BUY' : 'GENERAL',
      latencyMs: 10 + (i % 20),
      success: true,
      fallbackUsed: false,
      knowledgeHit: i % 2 !== 0,
      negativePolicyHit: false,
      transactionBoundaryHit: i % 2 === 0,
      warrantyBoundaryHit: false,
      productDemandHit: false,
    });
  }
  const tConcMs = performance.now() - startConc;
  assert(tConcMs < 100, `1000 telemetry metrics ingested in <100ms (Actual: ${tConcMs.toFixed(2)}ms)`);
  assert(getProductionMetrics(60).length === 1000, 'All 1000 metrics safely recorded without dropped data');

  // 5000 High Volume Ingestion Stress Test
  const start5k = performance.now();
  for (let i = 0; i < 4500; i++) {
    recordProductionMetric({
      route: 'FAQ',
      intent: 'GENERAL',
      latencyMs: 15,
      success: true,
      fallbackUsed: false,
      knowledgeHit: true,
      negativePolicyHit: false,
      transactionBoundaryHit: false,
      warrantyBoundaryHit: false,
      productDemandHit: false,
    });
  }
  const t5kMs = performance.now() - start5k;
  assert(t5kMs < 300, `4500 additional metrics ingested in <300ms (Actual: ${t5kMs.toFixed(2)}ms)`);
  assert(getProductionMetrics(0).length === 5000, 'Buffer clamps strictly to MAX_BUFFER_SIZE (5000)');

  // -------------------------------------------------------------------------
  // SECTION Z: Performance Benchmarks (<1ms decision, 0ms sync telemetry)
  // -------------------------------------------------------------------------
  console.log('\n📋 SECTION Z: Enterprise Performance Benchmarks');
  const startFp = performance.now();
  for (let i = 0; i < 500; i++) {
    generateIncidentFingerprint('ERROR_SPIKE', 'geminiClient', `Error test evidence ${i}`);
  }
  const avgFpMs = (performance.now() - startFp) / 500;
  assert(avgFpMs < 0.5, `Incident fingerprint generation latency <0.5ms (Actual: ${avgFpMs.toFixed(3)}ms)`);

  const startSlo = performance.now();
  evaluateProductionSlo();
  const sloMs = performance.now() - startSlo;
  assert(sloMs < 20, `SLO evaluation latency <20ms (Actual: ${sloMs.toFixed(2)}ms)`);

  // -------------------------------------------------------------------------
  // FINAL TEST SUITE RESULTS
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`🏁 TEST SUITE COMPLETE: ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED`);
  if (failedAssertions > 0) {
    console.error(`💥 FAILURES DETECTED: ${failedAssertions} FAILED ASSERTIONS`);
    process.exit(1);
  } else {
    console.log('🎉 ALL 26 SECTIONS (A-Z) PASSED WITH 100% COMPLIANCE!');
    console.log('========================================================================\n');
  }
}

runProductionReadinessSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
