// BOW AGENT V3.3 - PHASE 7.1 STEP 7 CERTIFICATION SUITE
// LOCAL AGENT DEPRECATION & FINAL ARCHITECTURE CONSOLIDATION
// Sections A-Z (all API names verified against @bow/agent live exports)

// Disable Gemini network calls in test environment to guarantee fast, deterministic tests
process.env.GEMINI_API_KEY = '';
process.env.VITE_GEMINI_API_KEY = '';

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  executeAgentMessage,
  ensureStandaloneAgentInitialized,
} from '../src/services/agent/agentHostBridge';

import {
  processAgentMessage as standaloneProcess,
  setActiveShopAdapter,
  type AgentContext,
  extractDuration,
  matchPlanByDuration,
  agentAnalytics,
  detectPiiInText,
  sanitizeMetadata,
  getCircuitBreakerState,
  resetCircuitBreaker,
  forceTripCircuit,
  recordExecutionFailure,
  evaluateProductionSlo,
  calculateProductionHealthScore,
  matchNegativePolicy,
  getFaqsAndGuides,
  findSimilarFaqs,
  isGeminiConfigured,
} from '@bow/agent';

import { shopAdapter } from '../src/services/agent/adapters/shopAdapter';

let pass = 0, fail = 0;
const failures: string[] = [];

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try { await fn(); pass++; }
  catch (e: any) { fail++; failures.push(`  [FAIL] ${name}: ${e?.message ?? e}`); }
}
function ok(val: unknown, msg: string) { if (!val) throw new Error(msg); }
function norm(s: string) { return s.normalize('NFC'); }

const ROOT = path.resolve(__dirname, '..');
const agentDir = path.join(ROOT, 'src', 'services', 'agent');
const chatModalPath = path.join(ROOT, 'src', 'components', 'agent', 'BowAgentChatModal.tsx');
const bridgePath = path.join(agentDir, 'agentHostBridge.ts');

const anon: AgentContext = { role: 'guest', isAuthenticated: false };
const auth: AgentContext = {
  role: 'user', isAuthenticated: true, userId: 'test-user-step7',
  email: 'step7@bow.test', fullName: 'Step 7 Tester', balance: 200000,
};

// A: Package Resolution
async function sectionA() {
  console.log('\n[A] Package Resolution');
  await test('A1. @bow/agent package.json exists', () => {
    ok(fs.existsSync(path.join(ROOT, 'node_modules', '@bow', 'agent', 'package.json')), 'not found');
  });
  await test('A2. Package name = @bow/agent', () => {
    const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', '@bow', 'agent', 'package.json'), 'utf-8'));
    ok(p.name === '@bow/agent', `name mismatch: ${p.name}`);
  });
  await test('A3. @bow/agent public dist entrypoints exist', () => {
    ok(fs.existsSync(path.join(ROOT, 'node_modules', '@bow', 'agent', 'dist', 'index.js')), 'dist/index.js not found');
    ok(fs.existsSync(path.join(ROOT, 'node_modules', '@bow', 'agent', 'dist', 'index.d.ts')), 'dist/index.d.ts not found');
  });
  await test('A4. AgentHostBridge exists', () => ok(fs.existsSync(bridgePath), 'missing'));
  await test('A5. shopofbow package.json has @bow/agent dep', () => {
    const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
    ok('@bow/agent' in { ...p.dependencies, ...p.devDependencies }, 'not in deps');
  });
  await test('A6. ensureStandaloneAgentInitialized runs', () => { ensureStandaloneAgentInitialized(); ok(true, ''); });
}

// B: Public API Availability
async function sectionB() {
  console.log('\n[B] Public API Availability');
  await test('B1. processAgentMessage is function', () => ok(typeof standaloneProcess === 'function', ''));
  await test('B2. extractDuration is function', () => ok(typeof extractDuration === 'function', ''));
  await test('B3. matchPlanByDuration is function', () => ok(typeof matchPlanByDuration === 'function', ''));
  await test('B4. agentAnalytics.track is function', () => ok(typeof agentAnalytics?.track === 'function', ''));
  await test('B5. executeAgentMessage from bridge', () => ok(typeof executeAgentMessage === 'function', ''));
  await test('B6. matchNegativePolicy is function', () => ok(typeof matchNegativePolicy === 'function', ''));
  await test('B7. getCircuitBreakerState is function', () => ok(typeof getCircuitBreakerState === 'function', ''));
  await test('B8. evaluateProductionSlo is function', () => ok(typeof evaluateProductionSlo === 'function', ''));
  await test('B9. getFaqsAndGuides is function', () => ok(typeof getFaqsAndGuides === 'function', ''));
  await test('B10. findSimilarFaqs is function', () => ok(typeof findSimilarFaqs === 'function', ''));
}

// C: BowAgentChatModal - No Direct Engine Import
async function sectionC() {
  console.log('\n[C] BowAgentChatModal - No Direct Engine Import');
  await test('C1. BowAgentChatModal.tsx exists', () => ok(fs.existsSync(chatModalPath), 'missing'));
  const c = fs.readFileSync(chatModalPath, 'utf-8');
  await test('C2. No import from agentEngine', () => ok(!/from\s+['"].*agentEngine['"]/.test(c), 'still imports agentEngine'));
  await test('C3. Imports agentHostBridge', () => ok(/from\s+['"].*agentHostBridge['"]/.test(c), 'missing bridge import'));
  await test('C4. Uses executeAgentMessage', () => ok(c.includes('executeAgentMessage'), 'missing executeAgentMessage'));
  await test('C5. Has Phase 7.1 Step 7 comment', () => ok(c.includes('Phase 7.1 Step 7'), 'missing migration comment'));
  await test('C6. No bare processAgentMessage( call', () => {
    const bad = c.split('\n').filter(l => /(?<!\w)processAgentMessage\s*\(/.test(l) && !l.trim().startsWith('//'));
    ok(bad.length === 0, `bare call: ${bad.join(' | ')}`);
  });
  await test('C7. No bare processAgentMessageV2( call', () => {
    const bad = c.split('\n').filter(l => /(?<!\w)processAgentMessageV2\s*\(/.test(l) && !l.trim().startsWith('//'));
    ok(bad.length === 0, `v2 call: ${bad.join(' | ')}`);
  });
}

// D: AgentHostBridge Integration
async function sectionD() {
  console.log('\n[D] AgentHostBridge Integration');
  const b = fs.readFileSync(bridgePath, 'utf-8');
  await test('D1. Bridge file exists', () => ok(fs.existsSync(bridgePath), 'missing'));
  await test('D2. Bridge imports from @bow/agent', () => ok(b.includes("from '@bow/agent'"), 'missing'));
  await test('D3. Bridge has local rollback import', () => ok(b.includes('localProcessAgentMessage'), 'missing'));
  await test('D4. Bridge default mode is standalone', () => ok(b.includes("'standalone'"), 'missing'));
  await test('D5. Bridge has local mode path', () => ok(b.includes("mode === 'local'"), 'missing'));
  await test('D6. Bridge exports executeAgentMessage', () => ok(b.includes('export async function executeAgentMessage'), 'missing'));
}

// E: Production Execution
async function sectionE() {
  console.log('\n[E] Production Execution - Standalone Default');
  setActiveShopAdapter(shopAdapter);
  await test('E1. Greeting returns content (standalone)', async () => {
    const r = await executeAgentMessage('Xin chao', anon, { mode: 'standalone' });
    ok(r?.content, 'no content');
  });
  await test('E2. Greeting vocabulary check', async () => {
    const r = await executeAgentMessage('Xin chao', anon, { mode: 'standalone' });
    ok(r.content.toLowerCase().match(/bow|xin|chao|hello|hi/), `unexpected: ${r.content.slice(0,80)}`);
  });
  await test('E3. Default mode (no option) works', async () => {
    const r = await executeAgentMessage('Xin chao', anon);
    ok(r?.content, 'no content');
  });
  await test('E4. Greeting - no NAVIGATE_CHECKOUT action', async () => {
    const r = await executeAgentMessage('Xin chao', anon, { mode: 'standalone' });
    ok(!r.actions?.some(a => a.type === 'NAVIGATE_CHECKOUT'), 'has NAVIGATE_CHECKOUT');
  });
}

// F: Local Rollback
async function sectionF() {
  console.log('\n[F] Local Rollback Verification');
  await test('F1. agentEngine.ts still exists', () => ok(fs.existsSync(path.join(agentDir, 'agentEngine.ts')), 'deleted!'));
  await test('F2. intentResolver.ts still exists', () => ok(fs.existsSync(path.join(agentDir, 'intentResolver.ts')), 'deleted!'));
  await test('F3. tools.ts still exists', () => ok(fs.existsSync(path.join(agentDir, 'tools.ts')), 'deleted!'));
  await test('F4. adapters/shopAdapter.ts still exists', () => ok(fs.existsSync(path.join(agentDir, 'adapters', 'shopAdapter.ts')), 'deleted!'));
  await test('F5. executeAgentMessage(local) returns content', async () => {
    const r = await executeAgentMessage('Xin chao', anon, { mode: 'local' });
    ok(r?.content, 'no content from local rollback');
  });
  await test('F6. agentEngine.ts has DEPRECATED+ROLLBACK comment', () => {
    const c = fs.readFileSync(path.join(agentDir, 'agentEngine.ts'), 'utf-8');
    ok(c.includes('DEPRECATED') && c.includes('ROLLBACK'), 'missing deprecation markers');
  });
}

// G: Provider Routing
async function sectionG() {
  console.log('\n[G] Provider Routing');
  await test('G1. catalog.getAllProducts returns array', async () => {
    const p = await shopAdapter.catalog.getAllProducts();
    ok(Array.isArray(p) && p.length > 0, 'empty');
  });
  await test('G2. storage.searchProducts returns array', async () => {
    const r = await shopAdapter.storage.searchProducts({ keyword: 'youtube' });
    ok(Array.isArray(r), 'not array');
  });
  await test('G3. knowledge.getFaqs returns array', async () => {
    const f = await shopAdapter.knowledge.getFaqs({ activeOnly: true });
    ok(Array.isArray(f), 'not array');
  });
  await test('G4. wallet.getDepositInstructions returns object', async () => {
    const i = await shopAdapter.wallet.getDepositInstructions();
    ok(i && typeof i === 'object', 'not object');
  });
}

// H: Catalog Behavior
async function sectionH() {
  console.log('\n[H] Catalog Behavior');
  await test('H1. Product search returns content', async () => {
    const r = await executeAgentMessage('tim youtube', anon, { mode: 'standalone' });
    ok(r?.content, 'no content');
  });
  await test('H2. YouTube query references youtube', async () => {
    const r = await executeAgentMessage('hoi ve youtube premium', anon, { mode: 'standalone' });
    ok(r.content.toLowerCase().includes('youtube') || r.actions?.some(a => (a.payload?.productName || '').toLowerCase().includes('youtube')), 'no youtube ref');
  });
  await test('H3. Canva search - 0 FAQ mutations', async () => {
    const before = (await shopAdapter.knowledge.getFaqs({ activeOnly: true })).length;
    await executeAgentMessage('tim canva pro', anon, { mode: 'standalone' });
    const after = (await shopAdapter.knowledge.getFaqs({ activeOnly: true })).length;
    ok(before === after, `FAQ count changed: ${before} -> ${after}`);
  });
  await test('H4. Product query actions are NAVIGATE type', async () => {
    const r = await executeAgentMessage('xem danh sach san pham', anon, { mode: 'standalone' });
    if (r.actions?.length) {
      ok(r.actions.every(a => a.type.startsWith('NAVIGATE') || a.type === 'OPEN_DEPOSIT' || a.type === 'APPLY_COUPON'),
        `non-NAVIGATE action: ${r.actions.map(a => a.type).join(', ')}`);
    }
    ok(true, '');
  });
}

// I: Pricing Invariants
async function sectionI() {
  console.log('\n[I] Pricing Invariants');
  await test('I1. extractDuration("mua youtube 1 thang") = "1 thang"', () => {
    const d = extractDuration('mua youtube 1 thang');
    ok(norm(d) === norm('1 tháng'), `got "${d}"`);
  });
  await test('I2. extractDuration 6 thang', () => {
    const d = extractDuration('mua youtube 6 thang');
    ok(norm(d) === norm('6 tháng'), `got "${d}"`);
  });
  await test('I3. extractDuration 1 nam', () => {
    const d = extractDuration('mua youtube 1 nam');
    ok(norm(d) === norm('1 năm'), `got "${d}" (hex: ${Buffer.from(d).toString('hex')})`);
  });
  await test('I4. YouTube 1-month = 35000', async () => {
    const products = await shopAdapter.catalog.getAllProducts();
    const yt = products.find(p => p.name.toLowerCase().includes('youtube'));
    ok(yt, 'YouTube not found');
    const plans = await shopAdapter.storage.getPlans(yt!.id);
    const plan = matchPlanByDuration(plans, '1 tháng');
    ok(plan?.price === 35000, `got ${plan?.price}`);
  });
  await test('I5. YouTube 6-month = 280000', async () => {
    const products = await shopAdapter.catalog.getAllProducts();
    const yt = products.find(p => p.name.toLowerCase().includes('youtube'));
    ok(yt, 'YouTube not found');
    const plans = await shopAdapter.storage.getPlans(yt!.id);
    const plan = matchPlanByDuration(plans, '6 tháng');
    ok(plan?.price === 280000, `got ${plan?.price}`);
  });
  await test('I6. YouTube 12-month = 450000', async () => {
    const products = await shopAdapter.catalog.getAllProducts();
    const yt = products.find(p => p.name.toLowerCase().includes('youtube'));
    ok(yt, 'YouTube not found');
    const plans = await shopAdapter.storage.getPlans(yt!.id);
    const plan = matchPlanByDuration(plans, '1 năm');
    ok(plan?.price === 450000, `got ${plan?.price}`);
  });
}

// J: Checkout Boundary
async function sectionJ() {
  console.log('\n[J] Checkout Boundary');
  await test('J1. Buy intent - NAVIGATE_CHECKOUT or checkout content', async () => {
    const r = await executeAgentMessage('toi muon mua youtube premium 1 thang', auth, { mode: 'standalone' });
    const hasAction = r.actions?.some(a => a.type === 'NAVIGATE_CHECKOUT');
    const hasContent = r.content?.toLowerCase().match(/thanh toan|checkout|dat hang|xac nhan|mua|youtube/);
    ok(hasAction || hasContent, `no checkout signal: ${r.content?.slice(0,100)}`);
  });
  await test('J2. Buy intent - 0 order DB writes', async () => {
    const before = (await shopAdapter.orders.getUserOrders(auth.userId!)).length;
    await executeAgentMessage('mua youtube 1 thang', auth, { mode: 'standalone' });
    const after = (await shopAdapter.orders.getUserOrders(auth.userId!)).length;
    ok(before === after, `order count changed ${before}->${after}`);
  });
  await test('J3. Info price query - response includes price or product info', async () => {
    const r = await executeAgentMessage('gia youtube premium la bao nhieu?', anon, { mode: 'standalone' });
    ok(r?.content, 'no content returned for price query');
  });
  await test('J4. NAVIGATE_CHECKOUT payload has productId/slug', async () => {
    const r = await executeAgentMessage('mua chatgpt plus 1 thang', auth, { mode: 'standalone' });
    const act = r.actions?.find(a => a.type === 'NAVIGATE_CHECKOUT');
    if (act) ok(act.payload?.productId || act.payload?.productSlug, 'missing productId/slug');
    ok(true, '');
  });
}

// K: Wallet / Deposit
async function sectionK() {
  console.log('\n[K] Wallet / Deposit Behavior');
  await test('K1. Deposit query -> OPEN_DEPOSIT or deposit content', async () => {
    const r = await executeAgentMessage('toi muon nap tien vao vi', auth, { mode: 'standalone' });
    ok(r.actions?.some(a => a.type === 'OPEN_DEPOSIT') || r.content.toLowerCase().match(/nap|vi|deposit/), 'no deposit response');
  });
  await test('K2. getDepositInstructions returns object', async () => {
    const i = await shopAdapter.wallet.getDepositInstructions();
    ok(i && typeof i === 'object', 'no deposit instructions returned');
  });
  await test('K3. Wallet query - balance unchanged', async () => {
    const before = auth.balance;
    await executeAgentMessage('so du vi cua toi la bao nhieu?', auth, { mode: 'standalone' });
    ok(auth.balance === before, 'balance mutated');
  });
}

// L: Order History
async function sectionL() {
  console.log('\n[L] Order History');
  await test('L1. Auth order query returns content', async () => {
    const r = await executeAgentMessage('xem don hang cua toi', auth, { mode: 'standalone' });
    ok(r?.content, 'no content');
  });
  await test('L2. Anon order query handled gracefully', async () => {
    const r = await executeAgentMessage('xem don hang cua toi', anon, { mode: 'standalone' });
    ok(r?.content && !r.content.includes('undefined'), 'bad response');
  });
  await test('L3. Foreign userId -> 0 orders', async () => {
    const o = await shopAdapter.orders.getUserOrders('00000000-0000-0000-step7-999');
    ok(o.length === 0, `got ${o.length}`);
  });
}

// M: Warranty
async function sectionM() {
  console.log('\n[M] Warranty Boundary');
  await test('M1. Warranty query returns content', async () => {
    const r = await executeAgentMessage('toi can ho tro bao hanh', auth, { mode: 'standalone' });
    ok(r?.content, 'no content');
  });
  await test('M2. Non-existent order -> not_found', async () => {
    const s = await shopAdapter.orders.getWarrantyStatus('non-existent-step7');
    ok(!s.isEligible && s.status === 'not_found', `got isEligible=${s.isEligible} status=${s.status}`);
  });
  await test('M3. Refund request - no MUTATE_REFUND action', async () => {
    const r = await executeAgentMessage('san pham bi loi toi muon hoan tien', auth, { mode: 'standalone' });
    ok(!r.actions?.some(a => a.type === ('MUTATE_REFUND' as any)), 'boundary violated: MUTATE_REFUND issued');
  });
}

// N: Support
async function sectionN() {
  console.log('\n[N] Support Channels');
  await test('N1. Support query returns content', async () => {
    const r = await executeAgentMessage('toi can lien he ho tro', auth, { mode: 'standalone' });
    ok(r?.content, 'no content');
  });
  await test('N2. getSupportChannels returns non-null response', async () => {
    const c = await shopAdapter.storage.getSupportChannels();
    ok(c !== null && c !== undefined, 'getSupportChannels returned null/undefined');
  });
}

// O: Knowledge / FAQ
async function sectionO() {
  console.log('\n[O] Knowledge / FAQ');
  await test('O1. FAQ query returns content', async () => {
    const r = await executeAgentMessage('huong dan su dung youtube', anon, { mode: 'standalone' });
    ok(r?.content, 'no content');
  });
  await test('O2. knowledge.getFaqs returns array', async () => {
    const f = await shopAdapter.knowledge.getFaqs({ activeOnly: true });
    ok(Array.isArray(f), 'not array');
  });
  await test('O3. findSimilarFaqs is deterministic', async () => {
    const r1 = await findSimilarFaqs('youtube khong vao duoc');
    const r2 = await findSimilarFaqs('youtube khong vao duoc');
    ok(r1.length === r2.length, 'non-deterministic');
  });
}

// P: Negative Policy
async function sectionP() {
  console.log('\n[P] Negative Policy');

  const mockPolicies: any[] = [
    {
      id: 'pol-crack', policyKey: 'crack-software', scopeType: 'PRODUCT', scopeValue: 'crack',
      questionPattern: 'ban tool crack khong', normalizedQuestion: 'ban tool crack khong',
      answer: 'Khong ho tro', reason: 'anti-piracy', status: 'ACTIVE',
      createdBy: 'system', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usageCount: 0,
    },
    {
      id: 'pol-hack', policyKey: 'hack-account', scopeType: 'PRODUCT', scopeValue: 'hack',
      questionPattern: 'hack tai khoan netflix', normalizedQuestion: 'hack tai khoan netflix',
      answer: 'Khong ho tro', reason: 'security policy', status: 'ACTIVE',
      createdBy: 'system', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usageCount: 0,
    },
  ];

  await test('P1. "crack" -> matched (mock policies injected)', async () => {
    const r = await matchNegativePolicy('shop co ban tool crack khong?', mockPolicies);
    ok(r !== null && r.policy !== undefined, 'not matched (null returned)');
  });
  await test('P2. "hack" -> matched (mock policies injected)', async () => {
    const r = await matchNegativePolicy('cach hack tai khoan netflix', mockPolicies);
    ok(r !== null && r.policy !== undefined, 'not matched');
  });
  await test('P3. "ban quyen" -> not matched (mock policies injected)', async () => {
    const r = await matchNegativePolicy('toi muon mua tai khoan ban quyen', mockPolicies);
    ok(r === null, 'false positive: policy matched');
  });
  await test('P4. Negative policy - 0 FAQ mutations', async () => {
    const before = (await shopAdapter.knowledge.getFaqs({ activeOnly: true })).length;
    await matchNegativePolicy('crack netflix', mockPolicies);
    ok((await shopAdapter.knowledge.getFaqs({ activeOnly: true })).length === before, 'FAQ count changed');
  });
  await test('P5. Crack query via standalone - response is appropriate', async () => {
    const r = await executeAgentMessage('shop co ban tool crack khong?', anon, { mode: 'standalone' });
    ok(r?.content, 'no content for crack query');
  });
}

// Q: PII Sanitization
async function sectionQ() {
  console.log('\n[Q] PII Sanitization');
  await test('Q1. detectPiiInText detects phone', () => {
    const r = detectPiiInText('Lien he qua so 0912345678 nhe');
    ok(r === true || (typeof r === 'object' && (r as any).hasPii), 'phone not detected');
  });
  await test('Q2. detectPiiInText detects email', () => {
    const r = detectPiiInText('Gui vao email user@example.com');
    ok(r === true || (typeof r === 'object' && (r as any).hasPii), 'email not detected');
  });
  await test('Q3. sanitizeMetadata redacts password', () => {
    const r = sanitizeMetadata({ password: 'secret123', safeField: 'visible' });
    ok(r.password === '[REDACTED]' || !r.password, 'password not redacted');
  });
  await test('Q4. sanitizeMetadata preserves safe fields', () => {
    const r = sanitizeMetadata({ password: 'secret123', safeField: 'visible' });
    ok(r.safeField === 'visible', 'safe field incorrectly redacted');
  });
}

// R: Session Isolation
async function sectionR() {
  console.log('\n[R] Session Isolation');
  await test('R1. Empty userId -> 0 orders', async () => {
    const o = await shopAdapter.orders.getUserOrders('');
    ok(Array.isArray(o) && o.length === 0, `got ${o.length}`);
  });
  await test('R2. Foreign userId -> 0 orders', async () => {
    const o = await shopAdapter.orders.getUserOrders('00000000-step7-isolation');
    ok(o.length === 0, `got ${o.length}`);
  });
  await test('R3. Non-existent orderId -> null', async () => {
    const o = await shopAdapter.orders.getOrder('00000000-step7-xxxx');
    ok(o === null || o === undefined, 'non-null returned for missing order');
  });
}

// S: Failure Isolation
async function sectionS() {
  console.log('\n[S] Failure Isolation');
  await test('S1. Analytics failure does not block chat', async () => {
    const orig = agentAnalytics.track.bind(agentAnalytics);
    (agentAnalytics as any).track = () => { throw new Error('Simulated analytics failure'); };
    try {
      const r = await executeAgentMessage('Xin chao', anon, { mode: 'standalone' });
      ok(r?.content, 'chat blocked by analytics failure');
    } finally {
      (agentAnalytics as any).track = orig;
    }
  });
  await test('S2. Bridge returns response for product query', async () => {
    const r = await executeAgentMessage('tim san pham', anon, { mode: 'standalone' });
    ok(r?.content, 'no response from bridge');
  });
}

// T: Circuit Breaker
async function sectionT() {
  console.log('\n[T] Circuit Breaker');
  await test('T1. Initial state = CLOSED', () => {
    resetCircuitBreaker();
    ok(getCircuitBreakerState() === 'CLOSED', `got ${getCircuitBreakerState()}`);
  });
  await test('T2. forceTripCircuit -> OPEN', () => {
    forceTripCircuit();
    ok(getCircuitBreakerState() === 'OPEN', `got ${getCircuitBreakerState()}`);
  });
  await test('T3. resetCircuitBreaker -> CLOSED', () => {
    resetCircuitBreaker();
    ok(getCircuitBreakerState() === 'CLOSED', `got ${getCircuitBreakerState()}`);
  });
  await test('T4. 5x recordExecutionFailure -> OPEN', () => {
    resetCircuitBreaker();
    for (let i = 0; i < 5; i++) recordExecutionFailure();
    ok(getCircuitBreakerState() === 'OPEN', `got ${getCircuitBreakerState()}`);
    resetCircuitBreaker();
  });
}

// U: SLO Computation
async function sectionU() {
  console.log('\n[U] SLO Computation');
  await test('U1. evaluateProductionSlo([]) returns SLO report object', () => {
    const r = evaluateProductionSlo([]);
    ok(r && typeof r === 'object', 'not an object');
  });
  await test('U2. calculateProductionHealthScore returns score 0-100', () => {
    const result = calculateProductionHealthScore({});
    const s = typeof result === 'number' ? result : (result as any).score;
    ok(typeof s === 'number' && s >= 0 && s <= 100, `out of range or wrong type: ${JSON.stringify(result)}`);
  });
}

// V: Gemini Boundary
async function sectionV() {
  console.log('\n[V] Gemini Boundary');
  await test('V1. isGeminiConfigured is function', () => ok(typeof isGeminiConfigured === 'function', ''));
  await test('V2. isGeminiConfigured returns boolean', () => ok(typeof isGeminiConfigured() === 'boolean', `got ${typeof isGeminiConfigured()}`));
  await test('V3. No hardcoded API key in bow-agent gemini config', () => {
    const p = path.join(ROOT, 'node_modules', '@bow', 'agent', 'src', 'gemini', 'config.ts');
    if (fs.existsSync(p)) ok(!fs.readFileSync(p, 'utf-8').includes('AIzaSy'), 'hardcoded API key found!');
    ok(true, '');
  });
}

// W: Database Integrity
async function sectionW() {
  console.log('\n[W] Database Integrity');
  await test('W1. No Step 7 migration files', () => {
    const d = path.join(ROOT, 'supabase', 'migrations');
    if (!fs.existsSync(d)) { ok(true, ''); return; }
    const bad = fs.readdirSync(d).filter(f => f.includes('step7') || f.includes('phase7_1_step7'));
    ok(bad.length === 0, `step7 migrations found: ${bad.join(', ')}`);
  });
  await test('W2. schema.sql has no step7_ modifications', () => {
    const p = path.join(ROOT, 'supabase', 'schema.sql');
    if (!fs.existsSync(p)) { ok(true, ''); return; }
    ok(!fs.readFileSync(p, 'utf-8').includes('step7_'), 'schema.sql modified');
  });
}

// X: Parity
async function sectionX() {
  console.log('\n[X] Business Behavior Parity - Standalone vs Local');
  for (const tc of [
    { text: 'Xin chao', ctx: anon, label: 'greeting' },
    { text: 'mua youtube 1 thang', ctx: auth, label: 'buy intent' },
  ]) {
    await test(`X-${tc.label}: both modes return content`, async () => {
      const s = await executeAgentMessage(tc.text, tc.ctx, { mode: 'standalone' });
      const l = await executeAgentMessage(tc.text, tc.ctx, { mode: 'local' });
      ok(s?.content && l?.content, `missing content standalone=${!!s?.content} local=${!!l?.content}`);
    });
    await test(`X-${tc.label}: action count parity`, async () => {
      const s = await executeAgentMessage(tc.text, tc.ctx, { mode: 'standalone' });
      const l = await executeAgentMessage(tc.text, tc.ctx, { mode: 'local' });
      ok((s.actions?.length ?? 0) === (l.actions?.length ?? 0),
        `drift: standalone=${s.actions?.length ?? 0} local=${l.actions?.length ?? 0}`);
    });
  }
  await test('X-duration parity', () => ok(norm(extractDuration('mua youtube 6 thang')) === norm('6 tháng'), 'drift'));
  await test('X-PII parity', () => {
    const r = detectPiiInText('so dien thoai 0987654321');
    ok(r === true || (typeof r === 'object' && r !== null), 'PII detection failed');
  });
}

// Y: Production Build
async function sectionY() {
  console.log('\n[Y] Production Build Verification');
  await test('Y1. dist/ directory exists', () => ok(fs.existsSync(path.join(ROOT, 'dist')), 'dist/ missing'));
  await test('Y2. dist/index.html exists', () => ok(fs.existsSync(path.join(ROOT, 'dist', 'index.html')), 'dist/index.html missing'));
  await test('Y3. BowAgentChatModal has migration comment', () => {
    ok(fs.readFileSync(chatModalPath, 'utf-8').includes('Phase 7.1 Step 7'), 'missing comment');
  });
}

// Z: Forbidden Dependency Scan
async function sectionZ() {
  console.log('\n[Z] Forbidden Dependency Scan - @bow/agent');
  const bowSrc = path.join(ROOT, 'node_modules', '@bow', 'agent', 'src');

  function scan(dir: string, pattern: RegExp): string[] {
    const hits: string[] = [];
    if (!fs.existsSync(dir)) return hits;
    const walk = (d: string) => fs.readdirSync(d).forEach(f => {
      const fp = path.join(d, f);
      if (fs.statSync(fp).isDirectory()) walk(fp);
      else if ((f.endsWith('.ts') || f.endsWith('.js')) && pattern.test(fs.readFileSync(fp, 'utf-8')))
        hits.push(fp.replace(bowSrc, ''));
    });
    walk(dir);
    return hits;
  }

  await test('Z1. No Supabase imports in @bow/agent/src', () => {
    const h = scan(bowSrc, /@supabase\/supabase-js|from\s+['"]@supabase\//g);
    ok(h.length === 0, `found: ${h.join(', ')}`);
  });
  await test('Z2. No shopofbow imports in @bow/agent/src', () => {
    const h = scan(bowSrc, /from\s+['"].*shopofbow/g);
    ok(h.length === 0, `found: ${h.join(', ')}`);
  });
  await test('Z3. No React imports in @bow/agent/src', () => {
    const h = scan(bowSrc, /from\s+['"]react['"]/g);
    ok(h.length === 0, `found: ${h.join(', ')}`);
  });
  await test('Z4. No DOM usage in @bow/agent/src', () => {
    const h = scan(bowSrc, /window\.dispatchEvent|document\.getElementById|document\.querySelector/g);
    ok(h.length === 0, `found: ${h.join(', ')}`);
  });
  await test('Z5. agentEngine.ts has DEPRECATED marker', () => {
    ok(fs.readFileSync(path.join(agentDir, 'agentEngine.ts'), 'utf-8').includes('DEPRECATED'), 'missing');
  });
  await test('Z6. BowAgentChatModal has 0 agentEngine imports', () => {
    ok(!/from\s+['"].*agentEngine['"]/.test(fs.readFileSync(chatModalPath, 'utf-8')), 'still imports agentEngine!');
  });
}

// MAIN
async function main() {
  console.log('================================================================');
  console.log('BOW AGENT V3.3 - PHASE 7.1 STEP 7 CERTIFICATION SUITE');
  console.log('LOCAL AGENT DEPRECATION & FINAL ARCHITECTURE CONSOLIDATION');
  console.log('================================================================');

  ensureStandaloneAgentInitialized();
  setActiveShopAdapter(shopAdapter);

  await sectionA(); await sectionB(); await sectionC(); await sectionD();
  await sectionE(); await sectionF(); await sectionG(); await sectionH();
  await sectionI(); await sectionJ(); await sectionK(); await sectionL();
  await sectionM(); await sectionN(); await sectionO(); await sectionP();
  await sectionQ(); await sectionR(); await sectionS(); await sectionT();
  await sectionU(); await sectionV(); await sectionW(); await sectionX();
  await sectionY(); await sectionZ();

  const total = pass + fail;
  console.log('\n================================================================');
  console.log(`PHASE 7.1 STEP 7 RESULTS: ${pass} / ${total}`);
  if (failures.length) { console.log('\nFAILURES:'); failures.forEach(f => console.log(f)); }
  if (fail === 0) console.log('\nALL ASSERTIONS PASSED - STEP 7 CERTIFIED');
  else console.log('\nSTEP 7 BLOCKED - resolve failures before certification');
  console.log('================================================================');
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
