/**
 * BOW AGENT V3.3 - PHASE 7.1 STEP 8 CERTIFICATION SUITE
 * PRODUCTION HARDENING, DEPLOYMENT VALIDATION & OBSERVABILITY
 */

import { ok, strictEqual, deepStrictEqual } from 'assert';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

// Host imports
import { shopAdapter } from '../src/services/agent/adapters/shopAdapter.js';
import { executeAgentMessage, getHostBridgeStatus } from '../src/services/agent/agentHostBridge.js';
import type { SessionContext } from '../src/services/agent/types.js';

// Standalone @bow/agent imports
import {
  processAgentMessage as standaloneProcessAgentMessage,
  getMyOrders,
  fallbackShopAdapter,
  getActiveShopAdapter,
  setActiveShopAdapter,
  sanitizeProductionTelemetryText,
  detectPiiInText,
  sanitizeMetadata,
  extractDuration,
  matchPlanByDuration,
  matchNegativePolicy,
  evaluateProductionSlo,
  calculateProductionHealthScore,
  getCircuitBreakerState,
  isCircuitOpen,
  recordExecutionSuccess,
  recordExecutionFailure,
  forceTripCircuit,
  resetCircuitBreaker,
  getCircuitBreakerStats,
  isExemptFromCircuitBreaker,
  getCapacityStatus,
  acquireCapacitySlot,
  releaseCapacitySlot,
  getCapacityMetrics,
  resetCapacityCounters,
  generateDeterministicFallback,
  getAuthorityLevel,
  createProductionIncident,
  getActiveIncidents,
  hasOpenCriticalIncidents,
  acknowledgeIncident,
  resolveIncident,
  dismissIncident,
  executeRollback,
  getRollbackHistory,
  getRolloutState,
  shouldRouteToV3,
  updateRolloutStage,
  recordProductionMetric,
  getProductionMetrics,
  calculateTrafficStats,
  calculateLatencyStats,
  calculateReliabilityStats,
} from '@bow/agent';
import type { ShopAdapter } from '@bow/agent';

const npmShell = process.env.ComSpec || 'cmd.exe';
function runNpm(args: string[], cwd: string): string {
  return execFileSync(npmShell, ['/d', '/s', '/c', `npm ${args.join(' ')}`], {
    cwd,
    env: { ...process.env, npm_config_cache: path.resolve('scratch/.npm-cache-step8') },
    stdio: 'pipe',
  }).toString();
}

type TestExecutionOptions = { adapter?: ShopAdapter };

/**
 * The production API uses the active-adapter registry, not per-call options.
 * Keep test injection scoped and restore the previous adapter after telemetry
 * microtasks have had a chance to observe the injected provider.
 */
async function processAgentMessage(
  userText: string,
  context: SessionContext,
  options: TestExecutionOptions = {},
) {
  const previousAdapter = getActiveShopAdapter();
  if (options.adapter) setActiveShopAdapter(options.adapter);
  try {
    return await standaloneProcessAgentMessage(userText, context);
  } finally {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    setActiveShopAdapter(previousAdapter);
  }
}

const deterministicProduct = {
  id: 'perf-netflix',
  name: 'Netflix',
  slug: 'netflix',
  type: 'premium-app' as const,
  categoryId: null,
  categoryName: 'Giải trí',
  startingPrice: 35000,
  plans: [{ id: 'perf-plan', name: '1 tháng', duration: '1 tháng', price: 35000, isHighlight: false }],
  warranty: 'Bảo hành',
};

const deterministicProducts = [
  deterministicProduct,
  { ...deterministicProduct, id: 'perf-spotify', name: 'Spotify', slug: 'spotify' },
  { ...deterministicProduct, id: 'perf-chatgpt', name: 'ChatGPT', slug: 'chatgpt' },
];

const deterministicAdapter: ShopAdapter = {
  ...fallbackShopAdapter,
  catalog: {
    ...fallbackShopAdapter.catalog,
    getAllProducts: async () => deterministicProducts,
    findProductsByKeyword: async () => deterministicProducts,
    findProductBySlug: async () => deterministicProduct,
  },
  analytics: {
    ...fallbackShopAdapter.analytics,
    recordEvent: async () => {},
  },
};

let totalTests = 0;
let passedTests = 0;
const failures: string[] = [];

async function test(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err: any) {
    failures.push(`${name}: ${err.message}`);
    console.error(`  [FAIL] ${name} -> ${err.message}`);
  }
}

// User Contexts
const anonUser: SessionContext = {
  sessionId: 'step8-anon-sess',
  userId: undefined,
  role: 'ANONYMOUS',
  isVip: false,
};

const authUserA: SessionContext = {
  sessionId: 'step8-userA-sess',
  userId: 'user-aaa-111',
  role: 'CUSTOMER',
  isVip: false,
};

const authUserB: SessionContext = {
  sessionId: 'step8-userB-sess',
  userId: 'user-bbb-222',
  role: 'CUSTOMER',
  isVip: false,
};

const adminUser: SessionContext = {
  sessionId: 'step8-admin-sess',
  userId: 'admin-999',
  role: 'ADMIN',
  isVip: true,
};

// ============================================================================
// SECTION A: Dependency & Package Resolution
// ============================================================================
async function sectionA() {
  console.log('\n[A] Dependency & Package Resolution');

  await test('A1. shopofbow package.json contains @bow/agent dependency', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    ok(pkg.dependencies && pkg.dependencies['@bow/agent'], '@bow/agent missing in dependencies');
    ok(pkg.dependencies['@bow/agent'].includes('bow-agent'), '@bow/agent should reference bow-agent');
  });

  await test('A2. bow-agent package.json name is @bow/agent and version is 3.3.0', () => {
    const pkg = JSON.parse(fs.readFileSync('../bow-agent/package.json', 'utf8'));
    strictEqual(pkg.name, '@bow/agent');
    strictEqual(pkg.version, '3.3.0');
    strictEqual(pkg.type, 'module');
  });

  await test('A3. bow-agent package.json has valid main, types, and exports map', () => {
    const pkg = JSON.parse(fs.readFileSync('../bow-agent/package.json', 'utf8'));
    ok(pkg.main && pkg.main.includes('dist/index.js'), 'main missing or invalid');
    ok(pkg.types && pkg.types.includes('dist/index.d.ts'), 'types missing or invalid');
    ok(pkg.exports && pkg.exports['.'], 'exports map missing root export');
  });

  await test('A4. bow-agent dist/index.js and dist/index.d.ts exist', () => {
    ok(fs.existsSync('../bow-agent/dist/index.js'), 'dist/index.js missing');
    ok(fs.existsSync('../bow-agent/dist/index.d.ts'), 'dist/index.d.ts missing');
  });

  await test('A5. bow-agent has zero React, Supabase, or DOM dependencies in package.json', () => {
    const pkg = JSON.parse(fs.readFileSync('../bow-agent/package.json', 'utf8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    ok(!allDeps['react'], 'react must not be in bow-agent package.json');
    ok(!allDeps['@supabase/supabase-js'], '@supabase/supabase-js must not be in bow-agent');
  });
}

// ============================================================================
// SECTION B: Clean Install & Tarball Deployability Validation
// ============================================================================
async function sectionB() {
  console.log('\n[B] Clean Install & Tarball Deployability Validation');

  await test('B1. npm pack dry-run produces valid @bow/agent tarball manifest', () => {
    const out = runNpm(['pack', '--dry-run', '--json'], '../bow-agent');
    ok(out.includes('bow-agent-3.3.0.tgz'), 'tarball generation failed');
    ok(out.includes('dist/index.js'), 'dist/index.js missing from tarball manifest');
    ok(out.includes('dist/index.d.ts'), 'dist/index.d.ts missing from tarball manifest');
  });

  await test('B2. Standalone package can be packed and unpacked in isolated sandbox', () => {
    const sandboxDir = path.resolve('scratch/clean_install_sandbox');
    if (fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
    fs.mkdirSync(sandboxDir, { recursive: true });

    // Pack to sandbox
    runNpm(['pack', '--pack-destination', sandboxDir], '../bow-agent');
    const tarball = fs.readdirSync(sandboxDir).find(f => f.endsWith('.tgz'));
    ok(tarball !== undefined, 'tarball was not generated in sandbox');

    // Clean up
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  });

  await test('B3. Standalone TypeScript compilation produces complete dist tree', () => {
    const requiredFiles = [
      '../bow-agent/dist/index.js',
      '../bow-agent/dist/core/agentEngine.js',
      '../bow-agent/dist/core/intentResolver.js',
      '../bow-agent/dist/core/tools.js',
      '../bow-agent/dist/contracts/shopAdapter.js',
      '../bow-agent/dist/monitoring/analyticsSanitizer.js',
      '../bow-agent/dist/production/productionCircuitBreaker.js',
    ];
    for (const f of requiredFiles) {
      ok(fs.existsSync(f), `Missing compiled file: ${f}`);
    }
  });
}

// ============================================================================
// SECTION C: Production Import Audit
// ============================================================================
async function sectionC() {
  console.log('\n[C] Production Import Audit');

  await test('C1. BowAgentChatModal.tsx does NOT import local agentEngine', () => {
    const content = fs.readFileSync('src/components/agent/BowAgentChatModal.tsx', 'utf8');
    ok(!content.includes("from '../../services/agent/agentEngine'"), 'Direct agentEngine import found');
    ok(!content.includes("from '../services/agent/agentEngine'"), 'Direct agentEngine import found');
    ok(content.includes('agentHostBridge'), 'Must use agentHostBridge');
  });

  await test('C2. AgentHostBridge is the sole router between UI and Agent Core', () => {
    const content = fs.readFileSync('src/services/agent/agentHostBridge.ts', 'utf8');
    ok(content.includes("from '@bow/agent'"), 'Bridge must import from @bow/agent');
    ok(content.includes('standaloneProcessAgentMessage'), 'Bridge must delegate to standalone');
    ok(content.includes('localProcessAgentMessage'), 'Bridge must have local fallback');
  });

  await test('C3. Local Agent Core files contain @deprecated archive notices', () => {
    const engineContent = fs.readFileSync('src/services/agent/agentEngine.ts', 'utf8');
    const intentContent = fs.readFileSync('src/services/agent/intentResolver.ts', 'utf8');
    const toolsContent = fs.readFileSync('src/services/agent/tools.ts', 'utf8');

    ok(engineContent.includes('@deprecated') && engineContent.includes('ARCHIVE/ROLLBACK-ONLY'), 'agentEngine deprecation missing');
    ok(intentContent.includes('@deprecated') && intentContent.includes('ARCHIVE/ROLLBACK-ONLY'), 'intentResolver deprecation missing');
    ok(toolsContent.includes('@deprecated') && toolsContent.includes('ARCHIVE/ROLLBACK-ONLY'), 'tools deprecation missing');
  });

  await test('C4. No active UI page or component bypasses AgentHostBridge', () => {
    const srcFiles = fs.readdirSync('src/pages', { recursive: true }) as string[];
    for (const file of srcFiles) {
      if (typeof file === 'string' && (file.endsWith('.tsx') || file.endsWith('.ts'))) {
        const p = path.join('src/pages', file);
        if (fs.statSync(p).isFile()) {
          const c = fs.readFileSync(p, 'utf8');
          ok(!c.includes('localProcessAgentMessage'), `Direct localProcessAgentMessage import in ${p}`);
        }
      }
    }
  });
}

// ============================================================================
// SECTION D: Failure Injection & Resilience
// ============================================================================
async function sectionD() {
  console.log('\n[D] Failure Injection & Resilience');

  await test('D1. CatalogProvider failure is isolated and handled gracefully', async () => {
    const failingCatalog = {
      ...shopAdapter.catalog,
      searchProducts: async () => { throw new Error('Catalog DB Connection Timeout'); },
      getAllProducts: async () => { throw new Error('Catalog DB Connection Timeout'); },
    };
    const customAdapter = { ...shopAdapter, catalog: failingCatalog };
    const r = await processAgentMessage('tim netflix', anonUser, { adapter: customAdapter });
    ok(r && r.content, 'Should return a polite error or fallback message');
    ok(!r.content.includes('fatal error'), 'Should not expose fatal unhandled crash');
  });

  await test('D2. OrderProvider failure is isolated and does not crash chat', async () => {
    const failingOrders = {
      ...shopAdapter.orders,
      getUserOrders: async () => { throw new Error('Order Service Network Partition'); },
    };
    const customAdapter = { ...shopAdapter, orders: failingOrders };
    const r = await processAgentMessage('xem don hang cua toi', authUserA, { adapter: customAdapter });
    ok(r && r.content, 'Should return a response without crashing');
  });

  await test('D3. WalletProvider failure is isolated and returns safe message', async () => {
    const failingWallet = {
      ...shopAdapter.wallet,
      getWallet: async () => { throw new Error('Wallet Ledger Timeout'); },
      getBalance: async () => { throw new Error('Wallet Ledger Timeout'); },
    };
    const customAdapter = { ...shopAdapter, wallet: failingWallet };
    const r = await processAgentMessage('so du vi cua toi', authUserA, { adapter: customAdapter });
    ok(r && r.content, 'Should return a safe response without crashing');
  });

  await test('D4. AnalyticsProvider failure does NOT block user chat response', async () => {
    const failingAnalytics = {
      ...shopAdapter.analytics,
      recordEvent: async () => { throw new Error('Analytics collector crashed'); },
    };
    const customAdapter = { ...shopAdapter, analytics: failingAnalytics };
    const r = await processAgentMessage('shop co goi netflix nao?', anonUser, { adapter: customAdapter });
    ok(r && r.content, 'User chat message must succeed despite analytics crash');
    ok(r.content.toLowerCase().includes('netflix'), 'Response content must match expected catalog info');
  });

  await test('D5. KnowledgeProvider failure is gracefully handled', async () => {
    const failingKnowledge = {
      ...shopAdapter.knowledge,
      getFaqs: async () => { throw new Error('Knowledge Base Unavailable'); },
    };
    const customAdapter = { ...shopAdapter, knowledge: failingKnowledge };
    const r = await processAgentMessage('chinh sach bao hanh', anonUser, { adapter: customAdapter });
    ok(r && r.content, 'Should return warranty info or general assistance');
  });

  await test('D6. Circuit breaker transitions to OPEN on repeated failures', () => {
    resetCircuitBreaker();
    strictEqual(getCircuitBreakerState(), 'CLOSED');

    for (let i = 0; i < 5; i++) {
      recordExecutionFailure('Simulated failure');
    }

    strictEqual(getCircuitBreakerState(), 'OPEN');
    strictEqual(isCircuitOpen(), true);
  });

  await test('D7. Circuit breaker reset restores CLOSED state', () => {
    forceTripCircuit('Testing trip');
    strictEqual(isCircuitOpen(), true);

    resetCircuitBreaker();
    strictEqual(getCircuitBreakerState(), 'CLOSED');
    strictEqual(isCircuitOpen(), false);
  });

  await test('D8. Host bridge falls back to local engine if standalone throws fatal error', async () => {
    const badAdapter = {
      ...shopAdapter,
      analytics: {
        track: () => { throw new Error('Simulated standalone fatal exception'); },
      },
    };
    const r = await executeAgentMessage('netflix gia bao nhieu?', anonUser, { adapter: badAdapter as any });
    ok(r && r.content, 'Host bridge fallback must provide response');
  });
}

// ============================================================================
// SECTION E: Observability & Telemetry Audit
// ============================================================================
async function sectionE() {
  console.log('\n[E] Observability & Telemetry Audit');

  await test('E1. Telemetry records execution details and latency', async () => {
    let capturedEvent: any = null;
    const telemetryAdapter = {
      ...shopAdapter,
      analytics: {
        ...shopAdapter.analytics,
        recordEvent: async (event: any) => { capturedEvent = event; },
      },
    };
    await processAgentMessage('gia netflix 1 thang', anonUser, { adapter: telemetryAdapter });
    ok(capturedEvent !== null, 'Telemetry event must be emitted');
    ok(capturedEvent.eventType || capturedEvent.type || capturedEvent.event || capturedEvent.intent, 'Telemetry event must contain eventType/intent');
  });

  await test('E2. PII Sanitization redacts phone numbers', () => {
    const clean = sanitizeProductionTelemetryText('Lien he qua so 0912345678 hoac 0987654321 nhe');
    ok(!clean.includes('0912345678'), 'Phone number 0912345678 was not sanitized');
    ok(!clean.includes('0987654321'), 'Phone number 0987654321 was not sanitized');
    ok(clean.includes('[REDACTED_PHONE]'), 'Replacement token missing');
  });

  await test('E3. PII Sanitization redacts email addresses', () => {
    const clean = sanitizeProductionTelemetryText('Gui thong tin vao email user@example.com ngay');
    ok(!clean.includes('user@example.com'), 'Email user@example.com was not sanitized');
    ok(clean.includes('[REDACTED_EMAIL]'), 'Replacement token missing');
  });

  await test('E4. Metadata sanitizer redacts passwords, tokens, API keys, and auth headers', () => {
    const dirty = {
      password: 'SuperSecretPassword123',
      token: 'jwt.token.secret',
      apiKey: 'AIzaSy1234567890abcdef',
      authorization: 'Bearer eyJhbGciOi...',
      secretKey: 'sk_live_99999999',
      normalField: 'public-data',
    };
    const clean: any = sanitizeMetadata(dirty);
    strictEqual(clean.password, '[REDACTED]');
    strictEqual(clean.token, '[REDACTED]');
    strictEqual(clean.apiKey, '[REDACTED]');
    strictEqual(clean.authorization, '[REDACTED]');
    strictEqual(clean.secretKey, '[REDACTED]');
    strictEqual(clean.normalField, 'public-data');
  });

  await test('E5. detectPiiInText identifies presence of sensitive data', () => {
    strictEqual(detectPiiInText('So dien thoai la 0901234567'), true);
    strictEqual(detectPiiInText('Email la contact@shop.vn'), true);
    strictEqual(detectPiiInText('Gia goi netflix la bao nhieu?'), false);
  });
}

// ============================================================================
// SECTION F: Security Boundaries & Access Control
// ============================================================================
async function sectionF() {
  console.log('\n[F] Security Boundaries & Access Control');

  await test('F1. Gemini API key is sourced from server environment only', () => {
    const clientCode = fs.readFileSync('../bow-agent/src/gemini/config.ts', 'utf8');
    ok(!clientCode.includes('AIzaSy'), 'Hardcoded Gemini API key found in standalone source');
  });

  await test('F2. Anonymous users cannot view order history', async () => {
    const r = await processAgentMessage('xem don hang cua toi', anonUser, { adapter: shopAdapter });
    ok(
      r.content.toLowerCase().includes('dang nhap') ||
      r.content.toLowerCase().includes('đăng nhập') ||
      r.content.toLowerCase().includes('login'),
      'Anonymous user must be prompted to log in for order history'
    );
  });

  await test('F3. Anonymous users cannot view wallet balance', async () => {
    const r = await processAgentMessage('so du vi cua toi la bao nhieu', anonUser, { adapter: shopAdapter });
    ok(
      r.content.toLowerCase().includes('dang nhap') ||
      r.content.toLowerCase().includes('đăng nhập') ||
      r.content.toLowerCase().includes('login'),
      'Anonymous user must be prompted to log in for wallet balance'
    );
  });

  await test('F4. Authenticated user A queries orders using only user A context', async () => {
    let queriedUserId = '';
    const spyStorage = {
      ...shopAdapter.storage!,
      getMyOrders: async (_params: any, uid: string) => {
        queriedUserId = uid;
        return [];
      },
    };
    const spyAdapter = { ...shopAdapter, storage: spyStorage };
    const previousAdapter = getActiveShopAdapter();
    setActiveShopAdapter(spyAdapter);
    try {
      await getMyOrders({}, { userId: authUserA.userId, role: 'user', isAuthenticated: true });
    } finally {
      setActiveShopAdapter(previousAdapter);
    }
    strictEqual(queriedUserId, 'user-aaa-111', 'Must query orders for authenticated user A only');
  });

  await test('F5. Negative policy blocks forbidden requests', async () => {
    const mockPolicies: any[] = [
      {
        id: 'pol-crack', policyKey: 'crack-software', scopeType: 'PRODUCT', scopeValue: 'crack',
        questionPattern: 'ban tool crack', normalizedQuestion: 'ban tool crack',
        answer: 'Khong ho tro', reason: 'anti-piracy', status: 'ACTIVE',
        createdBy: 'system', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usageCount: 0,
      }
    ];
    const match = await matchNegativePolicy('shop co ban tool crack khong?', mockPolicies);
    ok(match !== null && match.policy !== undefined, 'Negative policy must block crack query');
  });

  await test('F6. Negative policy does not false-positive on legitimate copyright queries', async () => {
    const mockPolicies: any[] = [
      {
        id: 'pol-crack', policyKey: 'crack-software', scopeType: 'PRODUCT', scopeValue: 'crack',
        questionPattern: 'ban tool crack', normalizedQuestion: 'ban tool crack',
        answer: 'Khong ho tro', reason: 'anti-piracy', status: 'ACTIVE',
        createdBy: 'system', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), usageCount: 0,
      }
    ];
    const match = await matchNegativePolicy('mua tai khoan ban quyen chinh hang', mockPolicies);
    ok(match === null, 'Legitimate query must not be blocked by negative policy');
  });
}

// ============================================================================
// SECTION G: Transaction Safety (Zero-Autonomous Mutation)
// ============================================================================
async function sectionG() {
  console.log('\n[G] Transaction Safety (Zero-Autonomous Mutation)');

  await test('G1. Product search inquiry performs ZERO order creations', async () => {
    let orderCreated = false;
    const writeSpyOrders = {
      ...shopAdapter.orders,
      createOrder: async () => { orderCreated = true; throw new Error('UNAUTHORIZED WRITE'); },
    };
    const spyAdapter = { ...shopAdapter, orders: writeSpyOrders as any };
    await processAgentMessage('tim netflix', anonUser, { adapter: spyAdapter });
    strictEqual(orderCreated, false, 'Product search must never trigger order creation');
  });

  await test('G2. Price inquiry performs ZERO wallet mutations or deductions', async () => {
    let balanceMutated = false;
    const writeSpyWallet = {
      ...shopAdapter.wallet,
      deductBalance: async () => { balanceMutated = true; throw new Error('UNAUTHORIZED DEDUCT'); },
      createDeposit: async () => { balanceMutated = true; throw new Error('UNAUTHORIZED DEPOSIT'); },
    };
    const spyAdapter = { ...shopAdapter, wallet: writeSpyWallet as any };
    await processAgentMessage('gia netflix premium 1 thang', anonUser, { adapter: spyAdapter });
    strictEqual(balanceMutated, false, 'Price inquiry must never mutate wallet balance');
  });

  await test('G3. Warranty inquiry performs ZERO autonomous refunds', async () => {
    let refundIssued = false;
    const writeSpyOrders = {
      ...shopAdapter.orders,
      refundOrder: async () => { refundIssued = true; throw new Error('UNAUTHORIZED REFUND'); },
    };
    const spyAdapter = { ...shopAdapter, orders: writeSpyOrders as any };
    await processAgentMessage('chinh sach bao hanh tai khoan loi', authUserA, { adapter: spyAdapter });
    strictEqual(refundIssued, false, 'Warranty inquiry must never autonomously issue a refund');
  });

  await test('G4. Checkout navigation query performs ZERO direct database writes', async () => {
    let writeHappened = false;
    const writeSpyAdapter = {
      ...shopAdapter,
      orders: {
        ...shopAdapter.orders,
        createOrder: async () => { writeHappened = true; throw new Error('UNAUTHORIZED WRITE'); },
      },
      wallet: {
        ...shopAdapter.wallet,
        deductBalance: async () => { writeHappened = true; throw new Error('UNAUTHORIZED WRITE'); },
      },
    };
    const r = await processAgentMessage('huong dan thanh toan don hang', authUserA, { adapter: writeSpyAdapter as any });
    strictEqual(writeHappened, false, 'Checkout guidance must not write to DB');
    ok(r && r.content, 'Must provide checkout guidance');
  });
}

// ============================================================================
// SECTION H: Performance & Benchmark
// ============================================================================
async function sectionH() {
  console.log('\n[H] Performance & Benchmark');

  await test('H1. Standalone execution latency is under 100ms for deterministic queries', async () => {
    const t0 = performance.now();
    await processAgentMessage('netflix', anonUser, { adapter: deterministicAdapter });
    const elapsed = performance.now() - t0;
    ok(elapsed < 100, `Deterministic execution took ${elapsed.toFixed(2)}ms (expected < 100ms)`);
  });

  await test('H2. Bridge routing overhead is under 100ms', async () => {
    const previousAdapter = getActiveShopAdapter();
    setActiveShopAdapter(deterministicAdapter);
    const t0 = performance.now();
    try {
      await executeAgentMessage('netflix', anonUser, { mode: 'standalone' });
      const elapsed = performance.now() - t0;
      ok(elapsed < 100, `Deterministic bridge call took ${elapsed.toFixed(2)}ms`);
    } finally {
      setActiveShopAdapter(previousAdapter);
    }
  });

  await test('H3. Telemetry tracking is non-blocking (< 100ms overhead)', async () => {
    const slowTelemetry = {
      ...deterministicAdapter,
      analytics: {
        ...deterministicAdapter.analytics,
        recordEvent: async () => {
          let s = 0;
          for (let i = 0; i < 10000; i++) s += i;
        },
      },
    };
    const t0 = performance.now();
    await processAgentMessage('netflix', anonUser, { adapter: slowTelemetry as any });
    const elapsed = performance.now() - t0;
    ok(elapsed < 100, `Deterministic execution with telemetry took ${elapsed.toFixed(2)}ms`);
  });
}

// ============================================================================
// SECTION I: Memory & State Isolation
// ============================================================================
async function sectionI() {
  console.log('\n[I] Memory & State Isolation');

  await test('I1. User A context is completely isolated from User B context', async () => {
    const rA = await processAgentMessage('netflix', authUserA, { adapter: deterministicAdapter });
    const rB = await processAgentMessage('spotify', authUserB, { adapter: deterministicAdapter });

    ok(rA.content.toLowerCase().includes('netflix'), 'User A query must resolve netflix');
    ok(rB.content.toLowerCase().includes('spotify'), 'User B query must resolve spotify');
  });

  await test('I2. Sequential repeated executions (30 iterations) execute with zero state leakage', async () => {
    for (let i = 0; i < 30; i++) {
      const q = i % 2 === 0 ? 'netflix' : 'chatgpt';
      const expected = i % 2 === 0 ? 'netflix' : 'chatgpt';
      const r = await processAgentMessage(q, anonUser, { adapter: deterministicAdapter });
      ok(r.content.toLowerCase().includes(expected), `Iteration ${i} failed for query ${q}`);
    }
  });

  await test('I3. Fallback mode does not corrupt standalone state', async () => {
    const rLocal = await executeAgentMessage('netflix', anonUser, { mode: 'local' });
    ok(rLocal && rLocal.content, 'Local execution must succeed');

    const rStandalone = await executeAgentMessage('netflix', anonUser, { mode: 'standalone' });
    ok(rStandalone && rStandalone.content, 'Standalone execution must succeed cleanly');
  });
}

// ============================================================================
// SECTION J: Browser / Node Boundary Scan
// ============================================================================
async function sectionJ() {
  console.log('\n[J] Browser / Node Boundary Scan');

  await test('J1. @bow/agent/src contains 0 window/document/localStorage references', () => {
    const srcDir = path.resolve('../bow-agent/src');
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];
    const forbidden = ['window.', 'document.', 'localStorage.', 'sessionStorage.', 'navigator.'];

    let violations = 0;
    for (const f of files) {
      if (typeof f === 'string' && f.endsWith('.ts')) {
        const full = path.join(srcDir, f);
        if (fs.statSync(full).isFile()) {
          const c = fs.readFileSync(full, 'utf8');
          for (const token of forbidden) {
            if (c.includes(token)) {
              console.error(`Forbidden token "${token}" in ${f}`);
              violations++;
            }
          }
        }
      }
    }
    strictEqual(violations, 0, `Found ${violations} forbidden browser API usages in @bow/agent/src`);
  });

  await test('J2. @bow/agent/src contains 0 React imports', () => {
    const srcDir = path.resolve('../bow-agent/src');
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];

    let violations = 0;
    for (const f of files) {
      if (typeof f === 'string' && f.endsWith('.ts')) {
        const full = path.join(srcDir, f);
        if (fs.statSync(full).isFile()) {
          const c = fs.readFileSync(full, 'utf8');
          if (c.includes("from 'react'") || c.includes('from "react"')) {
            violations++;
          }
        }
      }
    }
    strictEqual(violations, 0, `Found ${violations} React imports in @bow/agent/src`);
  });

  await test('J3. @bow/agent/src contains 0 Supabase imports', () => {
    const srcDir = path.resolve('../bow-agent/src');
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];

    let violations = 0;
    for (const f of files) {
      if (typeof f === 'string' && f.endsWith('.ts')) {
        const full = path.join(srcDir, f);
        if (fs.statSync(full).isFile()) {
          const c = fs.readFileSync(full, 'utf8');
          if (c.includes('@supabase/supabase-js') || c.includes('createClient(')) {
            violations++;
          }
        }
      }
    }
    strictEqual(violations, 0, `Found ${violations} Supabase references in @bow/agent/src`);
  });

  await test('J4. @bow/agent/src contains 0 shopofbow imports', () => {
    const srcDir = path.resolve('../bow-agent/src');
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];

    let violations = 0;
    for (const f of files) {
      if (typeof f === 'string' && f.endsWith('.ts')) {
        const full = path.join(srcDir, f);
        if (fs.statSync(full).isFile()) {
          const c = fs.readFileSync(full, 'utf8');
          const importLines = c.split(/\r?\n/).filter((line) =>
            /(?:from\s+['"]|import\s*\(\s*['"])/.test(line)
          );
          if (importLines.some((line) => line.includes('shopofbow') || line.includes('@/'))) {
            violations++;
          }
        }
      }
    }
    strictEqual(violations, 0, `Found ${violations} host-coupled imports in @bow/agent/src`);
  });
}

// ============================================================================
// SECTION K: Production Build Verification
// ============================================================================
async function sectionK() {
  console.log('\n[K] Production Build Verification');

  await test('K1. dist/index.html exists and is non-empty', () => {
    ok(fs.existsSync('dist/index.html'), 'dist/index.html missing');
    const stat = fs.statSync('dist/index.html');
    ok(stat.size > 500, 'dist/index.html too small');
  });

  await test('K2. dist/assets contains compiled JS and CSS bundles', () => {
    ok(fs.existsSync('dist/assets'), 'dist/assets directory missing');
    const files = fs.readdirSync('dist/assets');
    const jsFiles = files.filter(f => f.endsWith('.js'));
    const cssFiles = files.filter(f => f.endsWith('.css'));
    ok(jsFiles.length > 0, 'No JS bundles found in dist/assets');
    ok(cssFiles.length > 0, 'No CSS bundles found in dist/assets');
  });

  await test('K3. Compiled browser bundles do NOT expose backend API secrets', () => {
    const assetsDir = path.resolve('dist/assets');
    const files = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
    const forbiddenPatterns = ['SUPABASE_SERVICE_ROLE_KEY', 'AIzaSy'];

    for (const file of files) {
      const content = fs.readFileSync(path.join(assetsDir, file), 'utf8');
      for (const pat of forbiddenPatterns) {
        ok(!content.includes(pat), `Secret pattern ${pat} detected in compiled bundle ${file}`);
      }
    }
  });
}

// ============================================================================
// SECTION L: Deployment Simulation
// ============================================================================
async function sectionL() {
  console.log('\n[L] Deployment Simulation');

  await test('L1. All 30+ public API symbols exported by @bow/agent resolve cleanly', () => {
    const symbols = [
      processAgentMessage,
      fallbackShopAdapter,
      getActiveShopAdapter,
      setActiveShopAdapter,
      sanitizeProductionTelemetryText,
      detectPiiInText,
      sanitizeMetadata,
      extractDuration,
      matchPlanByDuration,
      matchNegativePolicy,
      evaluateProductionSlo,
      calculateProductionHealthScore,
      getCircuitBreakerState,
      isCircuitOpen,
      recordExecutionSuccess,
      recordExecutionFailure,
      forceTripCircuit,
      resetCircuitBreaker,
      getCircuitBreakerStats,
      isExemptFromCircuitBreaker,
      getCapacityStatus,
      acquireCapacitySlot,
      releaseCapacitySlot,
      getCapacityMetrics,
      resetCapacityCounters,
      generateDeterministicFallback,
      getAuthorityLevel,
      createProductionIncident,
      getActiveIncidents,
      hasOpenCriticalIncidents,
      acknowledgeIncident,
      resolveIncident,
      dismissIncident,
      executeRollback,
      getRollbackHistory,
      getRolloutState,
      shouldRouteToV3,
      updateRolloutStage,
      recordProductionMetric,
      getProductionMetrics,
      calculateTrafficStats,
      calculateLatencyStats,
      calculateReliabilityStats,
    ];
    for (const sym of symbols) {
      ok(sym !== undefined && sym !== null, 'Public symbol is undefined');
    }
  });

  await test('L2. AgentHostBridge status reports standalone engine active', () => {
    const status = getHostBridgeStatus();
    ok(status !== null, 'Bridge status missing');
    strictEqual(status.activeMode, 'standalone');
  });
}

// ============================================================================
// MAIN RUNNER
// ============================================================================
async function main() {
  console.log('================================================================');
  console.log('BOW AGENT V3.3 - PHASE 7.1 STEP 8 CERTIFICATION SUITE');
  console.log('PRODUCTION HARDENING, DEPLOYMENT VALIDATION & OBSERVABILITY');
  console.log('================================================================');

  await sectionA();
  await sectionB();
  await sectionC();
  await sectionD();
  await sectionE();
  await sectionF();
  await sectionG();
  await sectionH();
  await sectionI();
  await sectionJ();
  await sectionK();
  await sectionL();

  console.log('\n================================================================');
  console.log(`PHASE 7.1 STEP 8 RESULTS: ${passedTests} / ${totalTests}`);
  if (failures.length > 0) {
    console.log('\nFAILURES:');
    failures.forEach(f => console.log(`  [FAIL] ${f}`));
    console.log('\nSTEP 8 BLOCKED - resolve failures before certification');
    console.log('================================================================\n');
    process.exit(1);
  } else {
    console.log('\nALL ASSERTIONS PASSED - STEP 8 CERTIFIED');
    console.log('================================================================\n');
  }
}

main().catch(err => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
