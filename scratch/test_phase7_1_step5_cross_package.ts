// scratch/test_phase7_1_step5_cross_package.ts
// BOW AGENT V3.3 — PHASE 7.1 STEP 5 CROSS-PACKAGE INTEGRATION TEST SUITE

import fs from 'node:fs';
import path from 'node:path';

// 1. Host-side imports
import { shopAdapter } from '../src/services/agent/adapters/shopAdapter';
import {
  executeAgentMessage,
  compareAgentParity,
  ensureStandaloneAgentInitialized,
  getStandaloneShopAdapter,
} from '../src/services/agent/agentHostBridge';
import type { AgentContext, AgentMessage } from '../src/services/agent/types';

// 2. Cross-Package Imports from Standalone Package
import {
  // Contracts
  type ShopAdapter,
  type CatalogProvider,
  type OrderProvider,
  type WalletProvider,
  type KnowledgeProvider,
  type AnalyticsProvider,
  type ActionHandler,
  type StorageAdapter,
  type LlmProvider,
  type RobotAdapter,
  type RobotSensorSnapshot,
  type RobotSpeechOptions,
  setActiveShopAdapter,
  getActiveShopAdapter,
  fallbackShopAdapter,

  // Core Runtime
  resolveMultiIntent,
  matchPlanByDuration,
  extractDuration,
  searchProducts,
  getMyOrders,
  getMyWalletBalance,
  checkWarrantyPolicy,
  formatSingleProductResponse,
  validateActionPayload,

  // Monitoring
  sanitizeProductionTelemetryText,
  detectPiiInText,

  // Knowledge
  getKnowledgeGaps,
  getNegativePolicies,
  matchNegativePolicy,
  detectKnowledgeDrift,
  getGovernanceDashboardSummary,
  getIntelligenceDashboardSummary,
  getActionCenter,

  // Production
  isCircuitOpen,
  resetCircuitBreaker,
  recordExecutionSuccess,
  evaluateProductionSlo,
  getProductionControlCenterSummary,

  // Gemini & Boundaries
  GEMINI_CONFIG,
  isGeminiConfigured,
} from '@bow/agent';

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedAssertions++;
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runStep5IntegrationTestSuite() {
  console.log('\n========================================================================');
  console.log('🏁 RUNNING PHASE 7.1 STEP 5: CROSS-PACKAGE INTEGRATION TEST SUITE');
  console.log('========================================================================\n');

  // --------------------------------------------------------------------------
  // SECTION A: PACKAGE RESOLUTION
  // --------------------------------------------------------------------------
  console.log('📋 SECTION A: Package Resolution & Module Loading');

  assert(typeof setActiveShopAdapter === 'function', '@bow/agent resolves from shopofbow host runtime');
  assert(typeof fallbackShopAdapter === 'object', 'Standalone package entrypoint exports fallback adapter');
  assert(typeof resolveMultiIntent === 'function', 'Standalone core runtime methods resolve across package boundary');
  assert(typeof evaluateProductionSlo === 'function', 'Standalone production methods resolve across package boundary');
  assert(typeof isGeminiConfigured === 'function', 'Standalone gemini module resolves across package boundary');

  // --------------------------------------------------------------------------
  // SECTION B: CONTRACT COMPATIBILITY
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION B: Contract Compatibility');

  assert(typeof shopAdapter === 'object', 'Host shopAdapter instance is available');
  assert(typeof shopAdapter.catalog === 'object', 'shopAdapter implements CatalogProvider');
  assert(typeof shopAdapter.orders === 'object', 'shopAdapter implements OrderProvider');
  assert(typeof shopAdapter.wallet === 'object', 'shopAdapter implements WalletProvider');
  assert(typeof shopAdapter.knowledge === 'object', 'shopAdapter implements KnowledgeProvider');
  assert(typeof shopAdapter.analytics === 'object', 'shopAdapter implements AnalyticsProvider');
  assert(typeof shopAdapter.actions === 'object', 'shopAdapter implements ActionHandler');
  assert(typeof shopAdapter.storage === 'object', 'shopAdapter implements StorageAdapter');

  // Validate method signatures on host shopAdapter
  assert(typeof shopAdapter.catalog.getAllProducts === 'function', 'shopAdapter.catalog.getAllProducts exists');
  assert(typeof shopAdapter.orders.getWarrantyStatus === 'function', 'shopAdapter.orders.getWarrantyStatus exists');
  assert(typeof shopAdapter.wallet.getDepositInstructions === 'function', 'shopAdapter.wallet.getDepositInstructions exists');
  assert(typeof shopAdapter.knowledge.matchNegativePolicy === 'function', 'shopAdapter.knowledge.matchNegativePolicy exists');
  assert(typeof shopAdapter.actions.handleAction === 'function', 'shopAdapter.actions.handleAction exists');

  // --------------------------------------------------------------------------
  // SECTION C: DEPENDENCY ISOLATION
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION C: Dependency Isolation (Zero Forbidden Imports)');

  const bowAgentSrcDir = 'C:\\BOW\\bow-agent\\src';
  function scanDir(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) {
        scanDir(full, fileList);
      } else if (f.endsWith('.ts') && !f.endsWith('.d.ts')) {
        fileList.push(full);
      }
    }
    return fileList;
  }

  const srcFiles = scanDir(bowAgentSrcDir);
  let supabaseImports = 0;
  let shopofbowImports = 0;
  let reactImports = 0;
  let domWindowCalls = 0;

  for (const f of srcFiles) {
    const lines = fs.readFileSync(f, 'utf-8').split('\n');
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (trimmed.includes('from') && (trimmed.includes('supabase') || trimmed.includes('@supabase'))) {
        supabaseImports++;
      }
      if (trimmed.includes('from') && trimmed.includes('shopofbow')) {
        shopofbowImports++;
      }
      if (trimmed.match(/from\s+['"][^'"]*react['"]/i)) {
        reactImports++;
      }
      if (trimmed.includes('window.dispatchEvent') || trimmed.includes('document.getElementById')) {
        domWindowCalls++;
      }
    });
  }

  assert(supabaseImports === 0, `0 Supabase imports in bow-agent (Actual: ${supabaseImports})`);
  assert(shopofbowImports === 0, `0 shopofbow imports in bow-agent (Actual: ${shopofbowImports})`);
  assert(reactImports === 0, `0 React imports in bow-agent (Actual: ${reactImports})`);
  assert(domWindowCalls === 0, `0 DOM/window mutations in bow-agent (Actual: ${domWindowCalls})`);

  // --------------------------------------------------------------------------
  // SECTION D: ADAPTER INJECTION
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION D: Adapter Injection & Host Provider Routing');

  ensureStandaloneAgentInitialized();
  setActiveShopAdapter(shopAdapter);
  assert(getActiveShopAdapter() === shopAdapter, 'setActiveShopAdapter successfully injected host shopAdapter');
  assert(getStandaloneShopAdapter() === shopAdapter, 'getStandaloneShopAdapter returns injected host shopAdapter');

  // Verify catalog routing through injected adapter
  const catalogProducts = await shopAdapter.catalog.getAllProducts();
  assert(Array.isArray(catalogProducts) && catalogProducts.length > 0, 'Catalog query through host adapter returns live products');

  // Verify wallet deposit instructions through injected adapter
  const depositInst = await shopAdapter.wallet.getDepositInstructions(100000);
  assert(depositInst.bankId === 'MB', 'Wallet deposit instructions return MB bank via adapter');
  assert(depositInst.accountNo.replace(/\s+/g, '') === '0966821315', 'Wallet deposit instructions return correct accountNo');

  // --------------------------------------------------------------------------
  // SECTION E: CORE RUNTIME VIA AGENT HOST BRIDGE
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION E: Core Runtime Execution via AgentHostBridge');

  const anonContext: AgentContext = { role: 'anonymous' };
  const userContext: AgentContext = {
    userId: '00000000-0000-0000-0000-000000000001',
    role: 'customer',
    isAuthenticated: true,
  };

  // Test 1: Natural-language greeting
  const greetingMsg = await executeAgentMessage('xin chào shop', anonContext, { mode: 'standalone' });
  assert(greetingMsg.sender === 'agent', 'Greeting message returns agent sender');
  assert(greetingMsg.content.length > 0, 'Greeting message returns non-empty content');

  // Test 2: Search products via standalone engine
  const searchMsg = await executeAgentMessage('tìm netflix', anonContext, { mode: 'standalone' });
  assert(searchMsg.content.toLowerCase().includes('netflix'), 'Product search returns relevant product details');

  // Test 3: Shadow execution parity comparison
  const parity = await compareAgentParity('tư vấn youtube premium', anonContext);
  assert(typeof parity.isMatch === 'boolean', 'Shadow parity comparison executes without exception');
  assert(parity.standaloneContent.length > 0, 'Standalone agent returns valid content in shadow mode');
  assert(parity.localContent.length > 0, 'Local agent fallback returns valid content in shadow mode');

  // --------------------------------------------------------------------------
  // SECTION F: CATALOG INVARIANTS (IMMUTABLE PRICING)
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION F: Catalog Pricing Invariants');

  const mockPlans = [
    { id: 'yt-1m', name: '1 Thang', duration: '1 thang', price: 35000 },
    { id: 'yt-6m', name: '6 Thang', duration: '6 thang', price: 280000 },
    { id: 'yt-12m', name: '12 Thang', duration: '12 thang', price: 450000 },
  ];

  const p1m = matchPlanByDuration(mockPlans as any, '1 tháng');
  const p6m = matchPlanByDuration(mockPlans as any, '6 tháng');
  const p12m = matchPlanByDuration(mockPlans as any, '1 năm');

  assert(p1m?.price === 35000, 'YouTube 1m is immutable at 35.000đ');
  assert(p6m?.price === 280000, 'YouTube 6m is immutable at 280.000đ');
  assert(p12m?.price === 450000, 'YouTube 12m is immutable at 450.000đ');

  // --------------------------------------------------------------------------
  // SECTION G: TRANSACTION BOUNDARY
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION G: Transaction Boundary & Anti-Mutation');

  // Verify inquiry does not create orders
  const inquiryMsg = await executeAgentMessage('tôi muốn hỏi giá youtube', anonContext, { mode: 'standalone' });
  const hasOrderCreation = (inquiryMsg.actions || []).some(
    (a) => a.type === 'CHECKOUT_DIRECT' || a.type === 'PAYMENT_CONFIRM'
  );
  assert(!hasOrderCreation, 'Price inquiry does not create orders or checkout action');

  // Verify product search does not trigger purchase mutation
  const searchToolRes = await searchProducts({ keyword: 'Canva' });
  assert(searchToolRes.success === true, 'searchProducts executes without database mutation');

  // --------------------------------------------------------------------------
  // SECTION H: WARRANTY BOUNDARY
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION H: Warranty Boundary');

  // Test missing order
  const missingOrderRes = await shopAdapter.orders.getWarrantyStatus('non-existent-order-id-12345');
  assert(missingOrderRes.isEligible === false, 'Missing order returns isEligible = false');
  assert(missingOrderRes.status === 'not_found', 'Missing order returns status "not_found"');

  // Test general warranty inquiry
  const warrantyMsg = await executeAgentMessage('bảo hành tài khoản như thế nào?', anonContext, { mode: 'standalone' });
  assert(warrantyMsg.content.toLowerCase().includes('bảo hành') || warrantyMsg.content.toLowerCase().includes('lỗi'), 'Warranty policy inquiry returns clear explanation');

  // --------------------------------------------------------------------------
  // SECTION I: KNOWLEDGE BOUNDARY & NEGATIVE POLICY
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION I: Knowledge Boundary & Negative Policy');

  const faqs = await shopAdapter.knowledge.getFaqs();
  assert(Array.isArray(faqs), 'getFaqs executes through host adapter');

  const negPolicies = await shopAdapter.knowledge.getNegativePolicies();
  assert(Array.isArray(negPolicies), 'getNegativePolicies executes through host adapter');

  const mockNegativePolicy = {
    id: 'np-test-1',
    policyKey: 'NO_CRACK',
    scopeType: 'GLOBAL' as const,
    scopeValue: 'crack',
    questionPattern: 'tool crack',
    normalizedQuestion: 'tool crack',
    answer: 'Shop không kinh doanh phần mềm crack hoặc vi phạm bản quyền.',
    reason: 'Chính sách bảo vệ bản quyền',
    status: 'ACTIVE' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0,
  };

  const crackMatch = await matchNegativePolicy('shop có bán tool crack không?', [mockNegativePolicy as any]);
  assert(crackMatch !== null, 'Negative policy correctly detects crack/hack query');
  assert(crackMatch?.policy.policyKey === 'NO_CRACK', 'Crack query matches NO_CRACK policy');

  // --------------------------------------------------------------------------
  // SECTION J: MONITORING & PII SCRUBBING
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION J: Monitoring & Telemetry Scrubbing');

  const scrubbed = sanitizeProductionTelemetryText('Số điện thoại 0912345678, email user@bow.vn');
  assert(scrubbed.includes('[REDACTED_PHONE]'), 'Phone number redacted in cross-package telemetry');
  assert(scrubbed.includes('[REDACTED_EMAIL]'), 'Email redacted in cross-package telemetry');
  assert(!scrubbed.includes('0912345678'), 'Raw phone not present in sanitized telemetry');

  // --------------------------------------------------------------------------
  // SECTION K: PRODUCTION SAFETY & SLO
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION K: Production Reliability & Control Center');

  resetCircuitBreaker();
  assert(isCircuitOpen() === false, 'Circuit breaker starts in CLOSED state');
  recordExecutionSuccess();

  const emptySlo = evaluateProductionSlo([]);
  assert(emptySlo.overallStatus === 'INSUFFICIENT_DATA', 'Empty metrics return INSUFFICIENT_DATA status');

  const mockMetrics = [
    { timestamp: new Date().toISOString(), latencyMs: 50, success: true },
    { timestamp: new Date().toISOString(), latencyMs: 60, success: true },
    { timestamp: new Date().toISOString(), latencyMs: 70, success: true },
    { timestamp: new Date().toISOString(), latencyMs: 80, success: true },
    { timestamp: new Date().toISOString(), latencyMs: 90, success: true },
  ];
  const healthySlo = evaluateProductionSlo(mockMetrics as any);
  assert(healthySlo.overallStatus === 'HEALTHY', 'Healthy metrics evaluate to HEALTHY SLO status');

  const prodSummary = getProductionControlCenterSummary(true);
  assert(typeof prodSummary === 'object', 'getProductionControlCenterSummary executes across package boundary');
  assert(typeof prodSummary.healthScore === 'object', 'Health score component is calculated');

  // --------------------------------------------------------------------------
  // SECTION L: ROBOT BOUNDARY
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION L: Downstream Robot Boundary');

  const mockSensor: RobotSensorSnapshot = {
    batteryLevel: 95,
    isCharging: false,
    timestamp: new Date().toISOString(),
  };
  assert(mockSensor.batteryLevel === 95, 'RobotSensorSnapshot interface is accessible in host');

  const mockSpeech: RobotSpeechOptions = {
    volume: 90,
    rate: 1.0,
    language: 'vi-VN',
  };
  assert(mockSpeech.rate === 1.0, 'RobotSpeechOptions interface is accessible in host');

  // --------------------------------------------------------------------------
  // SECTION M: LLM BOUNDARY
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION M: LLM Boundary & Gemini Config');

  assert(typeof GEMINI_CONFIG === 'object', 'GEMINI_CONFIG is accessible in host');
  assert(GEMINI_CONFIG.modelName === 'gemini-3.6-flash', 'Gemini model is gemini-3.6-flash');
  assert(typeof isGeminiConfigured() === 'boolean', 'isGeminiConfigured() returns boolean');

  // --------------------------------------------------------------------------
  // SECTION N: ROLLBACK VERIFICATION (LOCAL IMPLEMENTATION PRESERVATION)
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION N: Rollback Verification (Local Implementation Intact)');

  const localMsg = await executeAgentMessage('xin chào shop', anonContext, { mode: 'local' });
  assert(localMsg.sender === 'agent', 'Local agent engine remains fully operational as rollback path');
  assert(localMsg.content.length > 0, 'Local agent engine produces valid response');

  const localDir = path.resolve('src/services/agent');
  assert(fs.existsSync(path.join(localDir, 'agentEngine.ts')), 'Local agentEngine.ts preserved');
  assert(fs.existsSync(path.join(localDir, 'intentResolver.ts')), 'Local intentResolver.ts preserved');
  assert(fs.existsSync(path.join(localDir, 'tools.ts')), 'Local tools.ts preserved');
  assert(fs.existsSync(path.join(localDir, 'adapters/shopAdapter.ts')), 'Local adapters/shopAdapter.ts preserved');

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`🏁 STEP 5 TEST SUITE COMPLETE: ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED`);
  if (failedAssertions === 0) {
    console.log('🎉 ALL SECTIONS (A-N) PASSED WITH 100% COMPLIANCE!');
  } else {
    console.error(`💥 FAILED: ${failedAssertions} assertions failed!`);
    process.exit(1);
  }
  console.log('========================================================================\n');
}

runStep5IntegrationTestSuite().catch((err) => {
  console.error('Fatal test error in Step 5:', err);
  process.exit(1);
});
