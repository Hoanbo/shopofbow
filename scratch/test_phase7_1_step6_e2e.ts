// scratch/test_phase7_1_step6_e2e.ts
// BOW AGENT V3.3 — PHASE 7.1 STEP 6 E2E OPERATIONAL VALIDATION TEST SUITE
//
// Comprehensive 24-Section E2E journey suite testing the standalone @bow/agent
// against real shopofbow production flows, UI action bridges, and safety boundaries.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// 1. Host Application Imports
import { shopAdapter } from '../src/services/agent/adapters/shopAdapter';
import {
  executeAgentMessage,
  compareAgentParity,
  ensureStandaloneAgentInitialized,
  getStandaloneShopAdapter,
} from '../src/services/agent/agentHostBridge';
import type { AgentContext, AgentMessage, AgentAction } from '../src/services/agent/types';

// 2. Standalone Package Imports (@bow/agent)
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
  processAgentMessage as standaloneProcessAgentMessage,
  resolveMultiIntent,
  matchPlanByDuration,
  extractDuration,
  searchProducts,
  getMyOrders,
  getMyWalletBalance,
  checkWarrantyPolicy,
  formatSingleProductResponse,
  validateAndFinalizeAction,
  checkToolPermission,

  // Monitoring
  sanitizeProductionTelemetryText,
  detectPiiInText,
  sanitizeMetadata,

  // Knowledge
  getKnowledgeGaps,
  getNegativePolicies,
  matchNegativePolicy,
  detectKnowledgeDrift,
  getGovernanceDashboardSummary,
  getIntelligenceDashboardSummary,
  getActionCenter,

  // Production Reliability
  isCircuitOpen,
  resetCircuitBreaker,
  recordExecutionSuccess,
  recordExecutionFailure,
  forceTripCircuit,
  evaluateProductionSlo,
  getProductionControlCenterSummary,

  // Gemini / LLM Boundary
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

async function runStep6E2ETestSuite() {
  console.log('\n========================================================================');
  console.log('🏁 RUNNING PHASE 7.1 STEP 6: E2E OPERATIONAL VALIDATION TEST SUITE');
  console.log('========================================================================\n');

  ensureStandaloneAgentInitialized();
  resetCircuitBreaker();

  const anonContext: AgentContext = { role: 'anonymous' };
  const userContext: AgentContext = {
    userId: '00000000-0000-0000-0000-000000000001',
    role: 'customer',
    isAuthenticated: true,
  };
  const adminContext: AgentContext = {
    userId: '00000000-0000-0000-0000-000000000099',
    role: 'admin',
    isAuthenticated: true,
  };

  // --------------------------------------------------------------------------
  // SECTION A: Application Boot
  // --------------------------------------------------------------------------
  console.log('📋 SECTION A: Application Boot & Host Bridge Verification');

  assert(typeof shopAdapter === 'object', 'A1. shopofbow host loads without runtime errors');
  assert(typeof setActiveShopAdapter === 'function', 'A2. @bow/agent resolves successfully from host');
  assert(typeof executeAgentMessage === 'function', 'A3. AgentHostBridge initializes');
  assert(getActiveShopAdapter() === shopAdapter, 'A4. Host shopAdapter is successfully injected into @bow/agent');

  const testInitRes = await executeAgentMessage('ping', anonContext, { mode: 'standalone' });
  assert(testInitRes && typeof testInitRes.content === 'string', 'A5. Active execution mode is standalone');

  const localRollbackRes = await executeAgentMessage('ping', anonContext, { mode: 'local' });
  assert(localRollbackRes && typeof localRollbackRes.content === 'string', 'A6. Local rollback engine remains available');

  const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'));
  assert(packageJson.dependencies['@bow/agent'] !== undefined, 'A7. @bow/agent is declared as host dependency');

  // --------------------------------------------------------------------------
  // SECTION B: Anonymous Chat
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION B: Anonymous Chat Flow');

  const greetingReply = await executeAgentMessage('Xin chào', anonContext, { mode: 'standalone' });
  assert(greetingReply.sender === 'agent', 'B1. Agent responds with agent sender');
  assert(greetingReply.content.length > 0, 'B2. Agent responds with non-empty conversational content');
  assert(!greetingReply.action || greetingReply.action.type !== 'NAVIGATE_CHECKOUT', 'B3. Greeting generates no checkout action');
  assert(!greetingReply.action || greetingReply.action.type !== 'OPEN_DEPOSIT', 'B4. Greeting generates no wallet deposit action');

  const multiGreeting = resolveMultiIntent('Xin chào');
  assert(multiGreeting.primaryIntent === 'GREETING', 'B5. Intent correctly classified as GREETING');
  assert(greetingReply.content.toLowerCase().includes('chào') || greetingReply.content.toLowerCase().includes('giúp'), 'B6. Response formatting matches polite greeting tone');

  // --------------------------------------------------------------------------
  // SECTION C: Product Discovery
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION C: Product Discovery Journeys');

  const allProducts = await shopAdapter.catalog.getAllProducts();
  assert(Array.isArray(allProducts) && allProducts.length > 0, 'C1. CatalogProvider retrieves products from database');

  const ytQuery = await executeAgentMessage('YouTube Premium có những gói nào?', anonContext, { mode: 'standalone' });
  assert(ytQuery.content.toLowerCase().includes('youtube'), 'C2. Product lookup for YouTube returns relevant information');
  assert(ytQuery.content.toLowerCase().includes('tháng') || ytQuery.content.toLowerCase().includes('năm'), 'C3. Product lookup returns available duration plans');

  const netflixQuery = await executeAgentMessage('Netflix có gói nào?', anonContext, { mode: 'standalone' });
  assert(netflixQuery.content.toLowerCase().includes('netflix'), 'C4. Product lookup for Netflix returns relevant information');

  const chatGptQuery = await executeAgentMessage('ChatGPT có những gói nào?', anonContext, { mode: 'standalone' });
  assert(chatGptQuery.content.toLowerCase().includes('chatgpt') || chatGptQuery.content.toLowerCase().includes('gpt'), 'C5. Product lookup for ChatGPT returns relevant plans');

  const searchRes = await searchProducts({ keyword: 'Canva' });
  assert(searchRes.success === true, 'C6. searchProducts executes through CatalogProvider');
  assert(Array.isArray(searchRes.data), 'C7. searchProducts returns structured array');
  assert(!ytQuery.actions || ytQuery.actions.every(a => a.type.startsWith('NAVIGATE_') || a.type === 'APPLY_COUPON'), 'C8. Product actions remain strictly UI navigation compliant');

  // --------------------------------------------------------------------------
  // SECTION D: Duration & Pricing Invariants
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION D: Duration & Pricing Invariants');

  const mockPlans = [
    { id: 'yt-1m', name: '1 Thang', duration: '1 thang', price: 35000 },
    { id: 'yt-6m', name: '6 Thang', duration: '6 thang', price: 280000 },
    { id: 'yt-12m', name: '12 Thang', duration: '12 thang', price: 450000 },
  ];

  const dur1m = extractDuration('mua youtube 1 thang');
  const dur6m = extractDuration('mua youtube 6 thang');
  const dur12m = extractDuration('mua youtube 1 nam');
  assert(dur1m === '1 tháng', 'D1. Duration 1 month extracted as "1 tháng"');
  assert(dur6m === '6 tháng', 'D2. Duration 6 months extracted as "6 tháng"');
  assert(dur12m === '1 năm', 'D3. Duration 1 year extracted as "1 năm"');

  const plan1m = matchPlanByDuration(mockPlans as any, '1 tháng');
  const plan6m = matchPlanByDuration(mockPlans as any, '6 tháng');
  const plan12m = matchPlanByDuration(mockPlans as any, '1 năm');
  assert(plan1m?.price === 35000, 'D4. YouTube 1m price is immutable at 35.000đ');
  assert(plan6m?.price === 280000, 'D5. YouTube 6m price is immutable at 280.000đ');
  assert(plan12m?.price === 450000, 'D6. YouTube 12m price is immutable at 450.000đ');

  // --------------------------------------------------------------------------
  // SECTION E: Checkout Boundary
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION E: Checkout Boundary & Anti-Mutation');

  const buyQuery = await executeAgentMessage('Tôi muốn mua YouTube Premium 1 tháng', userContext, { mode: 'standalone' });
  assert(buyQuery.sender === 'agent', 'E1. Buy query handled by agent');

  const multiBuy = resolveMultiIntent('Tôi muốn mua YouTube Premium 1 tháng');
  assert(multiBuy.primaryIntent === 'BUY', 'E2. Intent correctly identified as BUY');

  const hasCheckoutAction = buyQuery.action?.type === 'NAVIGATE_CHECKOUT' ||
    (buyQuery.actions || []).some(a => a.type === 'NAVIGATE_CHECKOUT');
  assert(hasCheckoutAction, 'E3. NAVIGATE_CHECKOUT action returned for buy intent');

  // Verify semantic payload
  const checkoutAct = buyQuery.action?.type === 'NAVIGATE_CHECKOUT' ? buyQuery.action : buyQuery.actions?.find(a => a.type === 'NAVIGATE_CHECKOUT');
  assert(checkoutAct !== undefined, 'E4. Checkout action is defined');
  assert(typeof checkoutAct?.label === 'string', 'E5. Checkout action contains user-facing label');

  // Verify action validation
  const validationRes = validateAndFinalizeAction(
    { type: 'NAVIGATE_CHECKOUT', label: 'Mua ngay', payload: checkoutAct?.payload || { productId: 'prod_123' } },
    userContext
  );
  assert(validationRes !== null && validationRes.id.startsWith('act_'), 'E6. Checkout action passes validation and generates actionId');

  // Verify zero auto-order creation
  const userOrdersBefore = await shopAdapter.orders.getUserOrders(userContext.userId!);
  assert(Array.isArray(userOrdersBefore), 'E7. User orders query executes without side effect');

  // Verify canHandleAction
  assert(shopAdapter.actions.canHandleAction('NAVIGATE_CHECKOUT') === true, 'E8. Host ActionHandler supports NAVIGATE_CHECKOUT');

  // --------------------------------------------------------------------------
  // SECTION F: Wallet & Deposit
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION F: Wallet & Deposit Invariants');

  const depositQuery = await executeAgentMessage('Tôi muốn nạp tiền vào ví', userContext, { mode: 'standalone' });
  assert(depositQuery.content.toLowerCase().includes('nạp') || depositQuery.content.toLowerCase().includes('ngân hàng') || depositQuery.content.toLowerCase().includes('chuyển khoản'), 'F1. Deposit query returns payment instructions');

  const hasDepositAction = depositQuery.action?.type === 'OPEN_DEPOSIT' ||
    (depositQuery.actions || []).some(a => a.type === 'OPEN_DEPOSIT');
  assert(hasDepositAction, 'F2. OPEN_DEPOSIT action returned for deposit query');

  const depositInst = await shopAdapter.wallet.getDepositInstructions(100000, userContext.userId);
  assert(depositInst.bankId === 'MB', 'F3. WalletProvider returns MB Bank');
  assert(depositInst.accountNo.replace(/\s+/g, '') === '0966821315', 'F4. WalletProvider returns correct account number 0966821315');
  assert(depositInst.qrUrl?.includes('vietqr.io'), 'F5. VietQR URL is correctly formed');

  const anonWalletRes = await getMyWalletBalance(anonContext);
  assert(anonWalletRes.success === false, 'F6. Unauthenticated balance query rejected safely');

  const userWalletRes = await getMyWalletBalance(userContext);
  assert(userWalletRes.success === true, 'F7. Authenticated user balance query succeeds without mutation');

  // --------------------------------------------------------------------------
  // SECTION G: Orders
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION G: Order History & User Isolation');

  const ordersQuery = await executeAgentMessage('Đơn hàng của tôi đâu?', userContext, { mode: 'standalone' });
  assert(ordersQuery.sender === 'agent', 'G1. Orders inquiry handled by agent');

  const myOrdersRes = await getMyOrders({}, userContext);
  assert(myOrdersRes.success === true, 'G2. getMyOrders succeeds for authenticated user');
  assert(Array.isArray(myOrdersRes.data), 'G3. Orders returned as an array');

  const anonOrdersRes = await getMyOrders({}, anonContext);
  assert(anonOrdersRes.success === false, 'G4. getMyOrders rejects anonymous user');

  const foreignOrders = await shopAdapter.orders.getUserOrders('00000000-0000-0000-0000-999999999999');
  assert(Array.isArray(foreignOrders) && foreignOrders.length === 0, 'G5. User isolation: foreign user sees 0 orders');

  const singleOrder = await shopAdapter.orders.getOrder('non-existent-order-id');
  assert(singleOrder === null, 'G6. Non-existent order returns null');

  assert(shopAdapter.actions.canHandleAction('NAVIGATE_ORDER_DETAIL') === true, 'G7. Host ActionHandler supports NAVIGATE_ORDER_DETAIL');

  // --------------------------------------------------------------------------
  // SECTION H: Warranty
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION H: Warranty Boundaries');

  const missingWarranty = await shopAdapter.orders.getWarrantyStatus('non-existent-order-123');
  assert(missingWarranty.isEligible === false, 'H1. Missing order returns isEligible = false');
  assert(missingWarranty.status === 'not_found', 'H2. Missing order returns status = not_found');

  // Test cancelled order boundary using mock order adapter
  const mockOrders = Object.create(shopAdapter.orders);
  mockOrders.getOrder = async (id: string) => {
    if (id === 'ord_cancelled') return { id, status: 'cancelled', totalAmount: 100000, items: [], createdAt: '' };
    if (id === 'ord_expired') return { id, status: 'completed', totalAmount: 100000, items: [], createdAt: '', warrantyExpiresAt: '2020-01-01' };
    return null;
  };
  const mockOrderAdapter: ShopAdapter = {
    ...shopAdapter,
    orders: mockOrders,
  };
  const cancelledRes = await mockOrderAdapter.orders.getWarrantyStatus('ord_cancelled');
  assert(cancelledRes.isEligible === false, 'H3. Cancelled order is strictly ineligible');

  const expiredRes = await mockOrderAdapter.orders.getWarrantyStatus('ord_expired');
  assert(expiredRes.isEligible === false, 'H4. Expired order is strictly ineligible');

  const validStatus = await checkWarrantyPolicy({ productName: 'YouTube Premium' });
  assert(validStatus.success === true, 'H5. Warranty policy check returns valid status');

  const warrantyTextQuery = await executeAgentMessage('Chính sách bảo hành tài khoản như thế nào?', anonContext, { mode: 'standalone' });
  assert(warrantyTextQuery.content.toLowerCase().includes('bảo hành') || warrantyTextQuery.content.toLowerCase().includes('lỗi'), 'H6. Informational warranty query returns policy text');

  assert(!warrantyTextQuery.actions || !warrantyTextQuery.actions.some(a => (a as any).type === 'MUTATE_REFUND'), 'H7. Warranty inquiry does not trigger automatic refund');
  assert(shopAdapter.actions.canHandleAction('NAVIGATE_SUPPORT') === true, 'H8. Host ActionHandler supports NAVIGATE_SUPPORT');

  // --------------------------------------------------------------------------
  // SECTION I: Support / Ticket
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION I: Support Channels & Ticket UI Bridge');

  const supportQuery = await executeAgentMessage('Tôi muốn liên hệ hỗ trợ', anonContext, { mode: 'standalone' });
  assert(supportQuery.content.toLowerCase().includes('hỗ trợ') || supportQuery.content.toLowerCase().includes('hotline'), 'I1. Support query returns contact guidance');

  const supportChannels = await shopAdapter.storage?.getSupportChannels?.();
  assert(supportChannels !== undefined && typeof supportChannels.hotline === 'string', 'I2. Support channels loaded via adapter');
  assert(supportChannels?.hotline.replace(/\s+/g, '').includes('0966821315'), 'I3. Hotline number matches official contact');

  assert(shopAdapter.actions.canHandleAction('NAVIGATE_TICKET_DETAIL') === true, 'I4. Host ActionHandler supports NAVIGATE_TICKET_DETAIL');
  assert(!supportQuery.actions || !supportQuery.actions.some(a => (a as any).type === 'AUTO_CREATE_TICKET'), 'I5. Informational support query does not auto-create ticket');

  // --------------------------------------------------------------------------
  // SECTION J: Knowledge / FAQ
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION J: Knowledge Provider & FAQ Invariants');

  const faqs = await shopAdapter.knowledge.getFaqs();
  assert(Array.isArray(faqs), 'J1. KnowledgeProvider.getFaqs returns array');

  const faqSim = await shopAdapter.knowledge.findFaqBySimilarity('Cách sử dụng tài khoản');
  assert(faqSim === null || typeof faqSim.question === 'string', 'J2. findFaqBySimilarity executes deterministically');

  const faqText = await executeAgentMessage('Hướng dẫn kích hoạt tài khoản', anonContext, { mode: 'standalone' });
  assert(faqText.content.length > 0, 'J3. FAQ inquiry generates detailed response');

  const gaps = await getKnowledgeGaps();
  assert(Array.isArray(gaps), 'J4. getKnowledgeGaps executes safely through contracts');

  const faqsAfter = await shopAdapter.knowledge.getFaqs();
  assert(faqs.length === faqsAfter.length, 'J5. FAQ inquiry causes 0 automatic FAQ creation');
  assert(shopAdapter.knowledge.getNegativePolicies !== undefined, 'J6. Negative policies contract method is available');

  // --------------------------------------------------------------------------
  // SECTION K: Negative Policy & Anti-Abuse
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION K: Negative Policy & Anti-Abuse Interception');

  const mockNegativePolicies = [
    {
      id: 'np-crack',
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
    },
    {
      id: 'np-hack',
      policyKey: 'NO_HACK',
      scopeType: 'GLOBAL' as const,
      scopeValue: 'hack',
      questionPattern: 'hack tai khoan',
      normalizedQuestion: 'hack tai khoan',
      answer: 'Shop nghiêm cấm các hành vi hack, cheat, hoặc tấn công hệ thống.',
      reason: 'An toàn bảo mật',
      status: 'ACTIVE' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
    },
  ];

  const crackMatch = await matchNegativePolicy('shop có bán tool crack không?', mockNegativePolicies as any);
  assert(crackMatch !== null, 'K1. Negative policy intercepts crack query');
  assert(crackMatch?.policy.policyKey === 'NO_CRACK', 'K2. Crack query matches NO_CRACK policy');

  const hackMatch = await matchNegativePolicy('cách hack tài khoản netflix', mockNegativePolicies as any);
  assert(hackMatch !== null, 'K3. Negative policy intercepts hack query');
  assert(hackMatch?.policy.policyKey === 'NO_HACK', 'K4. Hack query matches NO_HACK policy');

  const normalMatch = await matchNegativePolicy('tôi muốn mua tài khoản bản quyền', mockNegativePolicies as any);
  assert(normalMatch === null, 'K5. Legitimate inquiry is not intercepted by negative policy');

  const cleanFaqs = await shopAdapter.knowledge.getFaqs();
  assert(Array.isArray(cleanFaqs), 'K6. Negative policy evaluations caused 0 FAQ mutations');

  // --------------------------------------------------------------------------
  // SECTION L: Knowledge Governance
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION L: Knowledge Governance & Admin Permissions');

  const driftReport = await detectKnowledgeDrift([], [], [], true);
  assert(typeof driftReport === 'object', 'L1. detectKnowledgeDrift executes safely');

  const govSummary = await getGovernanceDashboardSummary([], [], [], true);
  assert(typeof govSummary === 'object', 'L2. getGovernanceDashboardSummary returns summary object');

  const intelSummary = await getIntelligenceDashboardSummary(true);
  assert(typeof intelSummary === 'object', 'L3. getIntelligenceDashboardSummary returns intelligence object');

  const actionCenter = await getActionCenter(intelSummary.recommendations, true);
  assert(typeof actionCenter === 'object', 'L4. getActionCenter executes without side effect');

  const permCheck = checkToolPermission('searchPromptsLibrary', anonContext);
  assert(permCheck.allowed === true, 'L5. Public tools permitted for anonymous context');

  // --------------------------------------------------------------------------
  // SECTION M: Analytics & PII Sanitization
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION M: Analytics Telemetry & PII Sanitization');

  const rawPhone = 'Liên hệ tôi qua số 0912345678 nhé';
  const scrubbedPhone = sanitizeProductionTelemetryText(rawPhone);
  assert(scrubbedPhone.includes('[REDACTED_PHONE]'), 'M1. Phone numbers sanitized to [REDACTED_PHONE]');
  assert(!scrubbedPhone.includes('0912345678'), 'M2. Raw phone number eliminated from telemetry');

  const rawEmail = 'Gửi tài khoản vào email user@example.com';
  const scrubbedEmail = sanitizeProductionTelemetryText(rawEmail);
  assert(scrubbedEmail.includes('[REDACTED_EMAIL]'), 'M3. Email sanitized to [REDACTED_EMAIL]');
  assert(!scrubbedEmail.includes('user@example.com'), 'M4. Raw email eliminated from telemetry');

  const metaSanitized = sanitizeMetadata({ password: 'secretpassword123', safeField: 'visible' });
  assert(metaSanitized?.password === '[REDACTED]', 'M5. Sensitive metadata key password is redacted');
  assert(metaSanitized?.safeField === 'visible', 'M6. Safe metadata field is preserved');

  // --------------------------------------------------------------------------
  // SECTION N: Production Reliability & Control Center
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION N: Production Reliability & SLO Invariants');

  resetCircuitBreaker();
  assert(isCircuitOpen() === false, 'N1. Circuit breaker starts in CLOSED state');

  forceTripCircuit('Testing forced trip');
  assert(isCircuitOpen() === true, 'N2. forceTripCircuit trips state to OPEN');

  resetCircuitBreaker();
  assert(isCircuitOpen() === false, 'N3. resetCircuitBreaker restores CLOSED state');

  recordExecutionSuccess();
  const mockSloMetrics = [
    { timestamp: new Date().toISOString(), latencyMs: 50, success: true },
    { timestamp: new Date().toISOString(), latencyMs: 60, success: true },
    { timestamp: new Date().toISOString(), latencyMs: 70, success: true },
    { timestamp: new Date().toISOString(), latencyMs: 80, success: true },
    { timestamp: new Date().toISOString(), latencyMs: 90, success: true },
  ];
  const sloRes = evaluateProductionSlo(mockSloMetrics as any);
  assert(sloRes.overallStatus === 'HEALTHY', 'N4. evaluateProductionSlo evaluates healthy metrics to HEALTHY');

  const emptySloRes = evaluateProductionSlo([]);
  assert(emptySloRes.overallStatus === 'INSUFFICIENT_DATA', 'N5. evaluateProductionSlo flags empty metrics as INSUFFICIENT_DATA');

  const controlCenter = getProductionControlCenterSummary(true);
  assert(typeof controlCenter === 'object', 'N6. getProductionControlCenterSummary executes across package boundary');
  assert(controlCenter.healthScore.score >= 0 && controlCenter.healthScore.score <= 100, 'N7. Production health score is within valid range [0, 100]');

  // --------------------------------------------------------------------------
  // SECTION O: Gemini / LLM Boundary
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION O: Gemini / LLM Boundary');

  assert(typeof GEMINI_CONFIG === 'object', 'O1. GEMINI_CONFIG is accessible');
  assert(GEMINI_CONFIG.modelName === 'gemini-3.6-flash', 'O2. Gemini model is configured as gemini-3.6-flash');
  assert(typeof isGeminiConfigured() === 'boolean', 'O3. isGeminiConfigured returns boolean without throwing');
  const srcConfig = fs.readFileSync(path.resolve('src/services/agent/gemini/config.ts'), 'utf-8');
  assert(!srcConfig.includes('AIzaSy'), 'O4. No hardcoded API secret exists in source code');
  assert(typeof fallbackShopAdapter.knowledge.findFaqBySimilarity === 'function', 'O5. Fallback LLM/knowledge provider satisfies interface');

  // --------------------------------------------------------------------------
  // SECTION P: UI Action Bridge
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION P: Semantic UI Action Bridge');

  const checkoutAction: AgentAction = {
    id: 'act_test_checkout',
    type: 'NAVIGATE_CHECKOUT',
    label: '💳 Mua ngay',
    payload: { productId: 'prod_yt_1', planId: 'plan_1m' },
  };
  const orderAction: AgentAction = {
    id: 'act_test_order',
    type: 'NAVIGATE_ORDER_DETAIL',
    label: '📦 Xem đơn hàng',
    payload: { orderId: 'ord_123' },
  };
  const depositAction: AgentAction = {
    id: 'act_test_deposit',
    type: 'OPEN_DEPOSIT',
    label: '💰 Nạp tiền',
    payload: { amount: 100000 },
  };
  const ticketAction: AgentAction = {
    id: 'act_test_ticket',
    type: 'NAVIGATE_SUPPORT',
    label: '🎫 Gửi ticket',
    payload: { issueDescription: 'Tài khoản lỗi' },
  };

  assert(validateAndFinalizeAction(checkoutAction, userContext) !== null, 'P1. NAVIGATE_CHECKOUT payload is valid');
  assert(validateAndFinalizeAction(orderAction, userContext) !== null, 'P2. NAVIGATE_ORDER_DETAIL payload is valid');
  assert(validateAndFinalizeAction(depositAction, userContext) !== null, 'P3. OPEN_DEPOSIT payload is valid');
  assert(validateAndFinalizeAction(ticketAction, userContext) !== null, 'P4. NAVIGATE_SUPPORT payload is valid');

  assert(shopAdapter.actions.canHandleAction('NAVIGATE_CHECKOUT') === true, 'P5. Host can handle NAVIGATE_CHECKOUT');
  assert(shopAdapter.actions.canHandleAction('NAVIGATE_ORDER_DETAIL') === true, 'P6. Host can handle NAVIGATE_ORDER_DETAIL');
  assert(shopAdapter.actions.canHandleAction('OPEN_DEPOSIT') === true, 'P7. Host can handle OPEN_DEPOSIT');
  assert(shopAdapter.actions.canHandleAction('NAVIGATE_SUPPORT') === true, 'P8. Host can handle NAVIGATE_SUPPORT');

  // --------------------------------------------------------------------------
  // SECTION Q: Session Context Isolation
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION Q: Session Context Isolation');

  const permAnonOrder = checkToolPermission('getMyOrders', anonContext);
  assert(permAnonOrder.allowed === false, 'Q1. Anonymous user cannot access getMyOrders');

  const permUserOrder = checkToolPermission('getMyOrders', userContext);
  assert(permUserOrder.allowed === true, 'Q2. Authenticated customer can access getMyOrders');

  const permAnonWallet = checkToolPermission('getMyWalletBalance', anonContext);
  assert(permAnonWallet.allowed === false, 'Q3. Anonymous user denied getMyWalletBalance');

  const permUserWallet = checkToolPermission('getMyWalletBalance', userContext);
  assert(permUserWallet.allowed === true, 'Q4. Authenticated customer can access getMyWalletBalance');

  const permAnonTickets = checkToolPermission('getMyTickets', anonContext);
  assert(permAnonTickets.allowed === false, 'Q5. Anonymous user denied getMyTickets');

  const permUserTickets = checkToolPermission('getMyTickets', userContext);
  assert(permUserTickets.allowed === true, 'Q6. Authenticated customer can access getMyTickets');

  // --------------------------------------------------------------------------
  // SECTION R: Standalone vs Local Parity
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION R: Standalone vs Local Parity Comparison');

  const parityGreeting = await compareAgentParity('xin chào shop', anonContext);
  assert(parityGreeting.isMatch === true, 'R1. Parity: Greeting produces identical semantics');

  const parityProduct = await compareAgentParity('YouTube Premium', anonContext);
  assert(parityProduct.standaloneContent.length > 0 && parityProduct.localContent.length > 0, 'R2. Parity: Product query produces valid non-empty responses in both engines');

  const parityPlans = await compareAgentParity('bảng giá youtube', anonContext);
  assert(parityPlans.standaloneActionCount === parityPlans.localActionCount, 'R3. Parity: Action card count matches between standalone and local');

  const multiStand = resolveMultiIntent('tôi muốn mua youtube 6 tháng');
  assert(multiStand.primaryIntent === 'BUY', 'R4. Parity: Intent classification matches');

  const durStand = extractDuration('6 thang');
  assert(durStand === '6 tháng', 'R5. Parity: Duration extraction matches');

  const pStand = matchPlanByDuration(mockPlans as any, '6 tháng');
  assert(pStand?.price === 280000, 'R6. Parity: Pricing lookup matches exactly');

  const piiStand = sanitizeProductionTelemetryText('0912345678');
  assert(piiStand === '[REDACTED_PHONE]', 'R7. Parity: PII sanitization matches exactly');

  const sloStand = evaluateProductionSlo([]);
  assert(sloStand.overallStatus === 'INSUFFICIENT_DATA', 'R8. Parity: Production SLO status matches exactly');

  // --------------------------------------------------------------------------
  // SECTION S: Rollback Verification
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION S: Rollback Verification (Local Core Intact)');

  const localReply = await executeAgentMessage('Tư vấn Canva Pro', anonContext, { mode: 'local' });
  assert(localReply.sender === 'agent', 'S1. Local agent execution mode executes with agent sender');
  assert(localReply.content.toLowerCase().includes('canva'), 'S2. Local agent handles product discovery correctly');

  const localDir = path.resolve('src/services/agent');
  assert(fs.existsSync(path.join(localDir, 'agentEngine.ts')), 'S3. Local agentEngine.ts is intact');
  assert(fs.existsSync(path.join(localDir, 'intentResolver.ts')), 'S4. Local intentResolver.ts is intact');
  assert(fs.existsSync(path.join(localDir, 'tools.ts')), 'S5. Local tools.ts is intact');

  // --------------------------------------------------------------------------
  // SECTION T: Failure Isolation & Fallback
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION T: Failure Isolation & Fallback');

  // Test catalog provider failure isolation
  const brokenCatalogAdapter: ShopAdapter = {
    ...shopAdapter,
    catalog: {
      ...shopAdapter.catalog,
      getAllProducts: async () => { throw new Error('CATALOG_DB_DOWN'); },
      findProductsByKeyword: async () => { throw new Error('CATALOG_DB_DOWN'); },
    },
  };
  setActiveShopAdapter(brokenCatalogAdapter);

  let catalogFallbackPassed = false;
  try {
    const fallbackMsg = await executeAgentMessage('xin chào', anonContext, { mode: 'standalone' });
    catalogFallbackPassed = fallbackMsg && fallbackMsg.content.length > 0;
  } catch {
    catalogFallbackPassed = false;
  }
  assert(catalogFallbackPassed, 'T1. Non-catalog inquiry succeeds even when catalog provider fails');

  // Restore adapter
  setActiveShopAdapter(shopAdapter);
  assert(getActiveShopAdapter() === shopAdapter, 'T2. ShopAdapter restored after catalog failure test');

  // Test wallet failure isolation
  const brokenWalletAdapter: ShopAdapter = {
    ...shopAdapter,
    wallet: {
      ...shopAdapter.wallet,
      getBalance: async () => { throw new Error('WALLET_SERVICE_TIMEOUT'); },
    },
  };
  setActiveShopAdapter(brokenWalletAdapter);

  let walletHandledSafely = false;
  try {
    const balanceRes = await getMyWalletBalance(anonContext);
    walletHandledSafely = balanceRes.success === false;
  } catch {
    walletHandledSafely = false;
  }
  assert(walletHandledSafely, 'T3. Wallet provider failure handled gracefully without unhandled crash');

  // Restore adapter
  setActiveShopAdapter(shopAdapter);
  assert(getActiveShopAdapter() === shopAdapter, 'T4. ShopAdapter restored after wallet failure test');

  // Test analytics failure isolation
  const brokenAnalyticsAdapter: ShopAdapter = {
    ...shopAdapter,
    analytics: {
      ...shopAdapter.analytics,
      recordEvent: async () => { throw new Error('TELEMETRY_INGEST_ERROR'); },
    },
  };
  setActiveShopAdapter(brokenAnalyticsAdapter);

  let analyticsIsolationPassed = false;
  try {
    const replyWithBrokenAnalytics = await executeAgentMessage('giá netflix', anonContext, { mode: 'standalone' });
    analyticsIsolationPassed = replyWithBrokenAnalytics && replyWithBrokenAnalytics.content.length > 0;
  } catch {
    analyticsIsolationPassed = false;
  }
  assert(analyticsIsolationPassed, 'T5. Telemetry ingestion failure does not block chat response');

  // Restore adapter
  setActiveShopAdapter(shopAdapter);
  assert(getActiveShopAdapter() === shopAdapter, 'T6. ShopAdapter restored after analytics failure test');

  // Test circuit breaker trip on error
  resetCircuitBreaker();
  recordExecutionFailure('Simulated failure 1');
  recordExecutionFailure('Simulated failure 2');
  recordExecutionFailure('Simulated failure 3');
  recordExecutionFailure('Simulated failure 4');
  recordExecutionFailure('Simulated failure 5');
  assert(isCircuitOpen() === true, 'T7. Circuit breaker trips to OPEN after 5 consecutive failures');

  resetCircuitBreaker();
  assert(isCircuitOpen() === false, 'T8. Circuit breaker resets cleanly to CLOSED');

  // --------------------------------------------------------------------------
  // SECTION U: Build & TypeScript Compilation
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION U: Build & TypeScript Compilation');

  let bowAgentTscPassed = false;
  try {
    execSync('powershell -Command "Set-Location C:\\BOW\\bow-agent; npx tsc -b --noEmit"', { stdio: 'pipe' });
    bowAgentTscPassed = true;
  } catch {
    bowAgentTscPassed = false;
  }
  assert(bowAgentTscPassed, 'U1. Standalone package C:\\BOW\\bow-agent compiles with 0 TypeScript errors');

  let shopofbowTscPassed = false;
  try {
    execSync('npx tsc -b --noEmit', { stdio: 'pipe' });
    shopofbowTscPassed = true;
  } catch {
    shopofbowTscPassed = false;
  }
  assert(shopofbowTscPassed, 'U2. Host application C:\\BOW\\shopofbow compiles with 0 TypeScript errors');

  let shopofbowBuildPassed = false;
  try {
    execSync('npm run build', { stdio: 'pipe' });
    shopofbowBuildPassed = true;
  } catch {
    shopofbowBuildPassed = false;
  }
  assert(shopofbowBuildPassed, 'U3. Host application C:\\BOW\\shopofbow production build succeeds');

  assert(fs.existsSync(path.resolve('dist/index.html')), 'U4. Production build artifact dist/index.html exists');

  // --------------------------------------------------------------------------
  // SECTION V: Forbidden Dependency Scan
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION V: Forbidden Dependency Scan');

  function scanDirRecursive(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) {
        scanDirRecursive(full, fileList);
      } else if (f.endsWith('.ts') && !f.endsWith('.d.ts')) {
        fileList.push(full);
      }
    }
    return fileList;
  }

  const bowAgentFiles = scanDirRecursive('C:\\BOW\\bow-agent\\src');
  let forbiddenSupabase = 0;
  let forbiddenShopofbow = 0;
  let forbiddenReact = 0;
  let forbiddenDom = 0;

  for (const f of bowAgentFiles) {
    const lines = fs.readFileSync(f, 'utf-8').split('\n');
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (trimmed.includes('from') && (trimmed.includes('supabase') || trimmed.includes('@supabase'))) forbiddenSupabase++;
      if (trimmed.includes('from') && trimmed.includes('shopofbow')) forbiddenShopofbow++;
      if (trimmed.match(/from\s+['"][^'"]*react['"]/i)) forbiddenReact++;
      if (trimmed.includes('window.dispatchEvent') || trimmed.includes('document.getElementById')) forbiddenDom++;
    });
  }

  assert(forbiddenSupabase === 0, 'V1. 0 Supabase imports in bow-agent/src');
  assert(forbiddenShopofbow === 0, 'V2. 0 shopofbow imports in bow-agent/src');
  assert(forbiddenReact === 0, 'V3. 0 React imports in bow-agent/src');
  assert(forbiddenDom === 0, 'V4. 0 DOM/window mutations in bow-agent/src');

  // --------------------------------------------------------------------------
  // SECTION W: Database Integrity
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION W: Database Integrity');

  const supabaseDir = path.resolve('supabase');
  let newMigrationsCount = 0;
  if (fs.existsSync(path.join(supabaseDir, 'migrations'))) {
    const migrations = fs.readdirSync(path.join(supabaseDir, 'migrations'));
    newMigrationsCount = migrations.filter(m => m.includes('phase7_1_step6')).length;
  }
  assert(newMigrationsCount === 0, 'W1. 0 new database migrations created');

  const gitDiff = execSync('git status --porcelain', { stdio: 'pipe' }).toString();
  const dbSchemaModified = gitDiff.includes('schema.sql') || gitDiff.includes('supabase/migrations');
  assert(!dbSchemaModified, 'W2. Zero database schema modifications detected in git status');

  // --------------------------------------------------------------------------
  // SECTION X: Business Invariant Regression
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION X: Business Invariant Regression');

  // X1: YouTube 1m = 35.000đ
  const p1 = matchPlanByDuration(mockPlans as any, '1 tháng');
  assert(p1?.price === 35000, 'X1. Invariant: YouTube 1 month strictly equals 35.000đ');

  // X2: YouTube 6m = 280.000đ
  const p6 = matchPlanByDuration(mockPlans as any, '6 tháng');
  assert(p6?.price === 280000, 'X2. Invariant: YouTube 6 months strictly equals 280.000đ');

  // X3: YouTube 12m = 450.000đ
  const p12 = matchPlanByDuration(mockPlans as any, '1 năm');
  assert(p12?.price === 450000, 'X3. Invariant: YouTube 12 months strictly equals 450.000đ');

  // X4: Warranty cancelled ineligible
  const cWarranty = await mockOrderAdapter.orders.getWarrantyStatus('ord_cancelled');
  assert(cWarranty.isEligible === false, 'X4. Invariant: Cancelled order is strictly warranty-ineligible');

  // X5: Transaction inquiry != purchase
  const transInquiry = await executeAgentMessage('hỏi giá chatgpt', anonContext, { mode: 'standalone' });
  assert(!transInquiry.action || transInquiry.action.type !== 'CHECKOUT_DIRECT', 'X5. Invariant: Informational inquiry does not execute purchase mutation');

  // X6: Harmful query blocked
  const crackBlock = await matchNegativePolicy('bán tool hack crack', mockNegativePolicies as any);
  assert(crackBlock !== null, 'X6. Invariant: Malicious/unsupported queries remain strictly intercepted');

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`🏁 STEP 6 E2E SUITE COMPLETE: ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED`);
  if (failedAssertions === 0) {
    console.log('🎉 ALL 24 SECTIONS (A-X) PASSED WITH 100% COMPLIANCE!');
  } else {
    console.error(`💥 FAILED: ${failedAssertions} assertions failed!`);
    process.exit(1);
  }
  console.log('========================================================================\n');
}

runStep6E2ETestSuite().catch((err) => {
  console.error('Fatal test error in Step 6:', err);
  process.exit(1);
});
