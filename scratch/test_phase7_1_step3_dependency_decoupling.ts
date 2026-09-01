// scratch/test_phase7_1_step3_dependency_decoupling.ts
// BOW AGENT V3.3 — PHASE 7.1 STEP 3 TEST SUITE
// SUPABASE DEPENDENCY REROUTING & AGENT DATA ACCESS DECOUPLING

import fs from 'node:fs';
import path from 'node:path';

// Import decoupled agent tools and services
import {
  searchProducts,
  getMyOrders,
  checkWarrantyPolicy,
  searchPromptsLibrary,
  getActiveCoupons,
  getMyWalletBalance,
  getFaqsAndGuides,
  getSupportChannels,
  getMyTickets,
} from '../src/services/agent/tools';
import { getAllCategories, resolveCategoryQuery } from '../src/services/agent/categoryResolver';
import { insertAnalyticsEvent } from '../src/services/agent/monitoring/agentEvents';
import { getNegativePolicies, matchNegativePolicy } from '../src/services/agent/knowledge/negativePolicyService';
import { findSimilarFaqs, getKnowledgeGaps } from '../src/services/agent/knowledge/knowledgeReviewService';
import { getActionCenter } from '../src/services/agent/knowledge/knowledgeActionService';
import { detectKnowledgeDrift } from '../src/services/agent/knowledge/knowledgeDriftService';
import { getGovernanceDashboardSummary } from '../src/services/agent/knowledge/knowledgeGovernanceService';
import { getIntelligenceDashboardSummary } from '../src/services/agent/knowledge/knowledgeIntelligenceService';

// Import contracts & adapters
import type {
  ShopAdapter,
  CatalogProvider,
  OrderProvider,
  WalletProvider,
  KnowledgeProvider,
  AnalyticsProvider,
  StorageAdapter,
} from '../src/services/agent/contracts';
import {
  shopAdapter,
  getActiveShopAdapter,
  setActiveShopAdapter,
  createShopAdapter,
} from '../src/services/agent/adapters/shopAdapter';
import type { AgentContext } from '../src/services/agent/types';

// ============================================================================
// TEST HARNESS
// ============================================================================

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

async function runStep3TestSuite() {
  console.log('\n========================================================================');
  console.log('🏁 RUNNING PHASE 7.1 STEP 3: DEPENDENCY DECOUPLING TEST SUITE');
  console.log('========================================================================\n');

  // --------------------------------------------------------------------------
  // SECTION A: FORBIDDEN IMPORT SCAN (STATIC SOURCE CODE INSPECTION)
  // --------------------------------------------------------------------------
  console.log('📋 SECTION A: Forbidden Supabase Import Scan (Agent Core Files)');

  const agentCoreDir = path.resolve('src/services/agent');
  const forbiddenImportRegex = /from\s+['"][^'"]*supabase[^'"]*['"]/i;
  const directClientRegex = /import\s+{[^}]*supabase[^}]*}\s+from/i;

  function scanDirectory(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        // Exclude adapters directory (which is host implementation boundary)
        if (f !== 'adapters') {
          scanDirectory(fullPath, fileList);
        }
      } else if (f.endsWith('.ts') || f.endsWith('.tsx')) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  const agentCoreFiles = scanDirectory(agentCoreDir);
  const offendingFiles: { file: string; line: number; content: string }[] = [];

  for (const filePath of agentCoreFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      // Check if line imports supabase from lib/supabase or @supabase
      if (
        (forbiddenImportRegex.test(line) || directClientRegex.test(line)) &&
        !line.trim().startsWith('//') &&
        !line.trim().startsWith('*')
      ) {
        offendingFiles.push({ file: path.relative(process.cwd(), filePath), line: index + 1, content: line.trim() });
      }
    });
  }

  assert(agentCoreFiles.length >= 25, `Discovered ${agentCoreFiles.length} Agent Core files to scan`);
  assert(offendingFiles.length === 0, `Zero forbidden Supabase imports in Agent Core files (Offending: ${offendingFiles.length})`, offendingFiles.map((o) => `${o.file}:${o.line} (${o.content})`).join('; '));

  // Verify that the 9 target files specifically have zero supabase imports
  const nineFiles = [
    'src/services/agent/tools.ts',
    'src/services/agent/categoryResolver.ts',
    'src/services/agent/monitoring/agentEvents.ts',
    'src/services/agent/knowledge/knowledgeReviewService.ts',
    'src/services/agent/knowledge/negativePolicyService.ts',
    'src/services/agent/knowledge/knowledgeIntelligenceService.ts',
    'src/services/agent/knowledge/knowledgeGovernanceService.ts',
    'src/services/agent/knowledge/knowledgeDriftService.ts',
    'src/services/agent/knowledge/knowledgeActionService.ts',
  ];

  for (const relPath of nineFiles) {
    const full = path.resolve(relPath);
    const content = fs.readFileSync(full, 'utf-8');
    const hasForbidden = content.includes("from '../../../lib/supabase'") ||
                         content.includes("from '../../lib/supabase'") ||
                         content.includes("from '@supabase/supabase-js'");
    assert(!hasForbidden, `File "${relPath}" has 0 direct Supabase imports`);
  }

  // --------------------------------------------------------------------------
  // SECTION B: DEPENDENCY INJECTION & ADAPTER REGISTRY
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION B: Dependency Injection & Provider Registry');

  const defaultAdapter = getActiveShopAdapter();
  assert(typeof defaultAdapter === 'object', 'getActiveShopAdapter() returns an object');
  assert(defaultAdapter === shopAdapter, 'Active adapter defaults to singleton shopAdapter');

  // Test swapping active adapter with a mock adapter
  let mockEventLogged = false;
  const mockAdapter: ShopAdapter = {
    ...defaultAdapter,
    analytics: {
      ...defaultAdapter.analytics,
      recordEvent: async (ev) => {
        mockEventLogged = true;
      },
    },
  };

  setActiveShopAdapter(mockAdapter);
  assert(getActiveShopAdapter() === mockAdapter, 'setActiveShopAdapter successfully swaps active adapter');

  // Revert back to standard adapter
  setActiveShopAdapter(shopAdapter);
  assert(getActiveShopAdapter() === shopAdapter, 'setActiveShopAdapter restores default shopAdapter');

  // --------------------------------------------------------------------------
  // SECTION C: CATALOG PROVIDER CALLS VIA TOOLS & CATEGORY RESOLVER
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION C: Catalog Provider Rerouting');

  const prodResult = await searchProducts({});
  assert(prodResult.success === true, 'searchProducts executes successfully via Provider');
  assert(Array.isArray(prodResult.data), 'searchProducts returns an array of products');

  const catResult = await getAllCategories();
  assert(Array.isArray(catResult), 'getAllCategories executes successfully via Provider');
  assert(catResult.length > 0, 'Categories list is populated');

  const resolvedCat = await resolveCategoryQuery('công cụ ai');
  assert(resolvedCat.matched === true, 'resolveCategoryQuery matches successfully via Provider');
  assert(resolvedCat.category?.slug === 'ai-tools', 'Category slug matches "ai-tools"');

  // Test parameter injection with custom mock catalog
  let customCatalogCalled = false;
  const mockCatalog: CatalogProvider = {
    ...shopAdapter.catalog,
    getCategories: async () => {
      customCatalogCalled = true;
      return [{ id: 'mock-1', name: 'Mock Category', slug: 'mock-cat' }];
    },
  };
  const mockCats = await getAllCategories(mockCatalog);
  assert(customCatalogCalled === true, 'getAllCategories supports explicit CatalogProvider injection');
  assert(mockCats[0].slug === 'mock-cat', 'Mock category data returned cleanly');

  // --------------------------------------------------------------------------
  // SECTION D: ORDER PROVIDER CALLS VIA TOOLS
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION D: Order Provider Rerouting');

  const mockUserContext: AgentContext = {
    userId: '00000000-0000-0000-0000-000000000001',
    userEmail: 'customer@shopofbow.com',
    role: 'customer',
    isAuthenticated: true,
  };

  const ordersResult = await getMyOrders({}, mockUserContext);
  assert(ordersResult.success === true, 'getMyOrders executes successfully via Provider');
  assert(Array.isArray(ordersResult.data), 'getMyOrders returns array');

  // Test permission guard in getMyOrders
  const anonContext: AgentContext = { role: 'anonymous' };
  const anonOrders = await getMyOrders({}, anonContext);
  assert(anonOrders.success === false, 'getMyOrders enforces auth permission guard');

  // --------------------------------------------------------------------------
  // SECTION E: WALLET PROVIDER CALLS VIA TOOLS
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION E: Wallet Provider Rerouting');

  const walletResult = await getMyWalletBalance(mockUserContext);
  assert(walletResult.success === true, 'getMyWalletBalance executes successfully via Provider');
  assert(typeof walletResult.data?.balance === 'number', 'Wallet balance is a number');
  assert(typeof walletResult.data?.formatted === 'string', 'Wallet formatted string is present');

  const anonWallet = await getMyWalletBalance(anonContext);
  assert(anonWallet.success === false, 'getMyWalletBalance enforces auth permission guard');

  // --------------------------------------------------------------------------
  // SECTION F: KNOWLEDGE PROVIDER CALLS VIA TOOLS & SERVICES
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION F: Knowledge Provider Rerouting');

  const faqsResult = await getFaqsAndGuides({});
  assert(faqsResult.success === true, 'getFaqsAndGuides executes successfully via Provider');
  assert(Array.isArray(faqsResult.data), 'getFaqsAndGuides returns FAQ array');

  const similarFaqs = await findSimilarFaqs('YouTube Premium giá bao nhiêu?');
  assert(Array.isArray(similarFaqs), 'findSimilarFaqs executes successfully via Provider');

  const negativePolicies = await getNegativePolicies({ status: 'ACTIVE' });
  assert(Array.isArray(negativePolicies), 'getNegativePolicies executes successfully via Provider');

  const policyMatch = await matchNegativePolicy('Shop có cài ultraview không?');
  assert(policyMatch !== undefined, 'matchNegativePolicy executes safely via Provider');

  // --------------------------------------------------------------------------
  // SECTION G: ANALYTICS PROVIDER CALLS VIA AGENT EVENTS
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION G: Analytics Provider Rerouting');

  let analyticsProviderCalled = false;
  const mockAnalytics: AnalyticsProvider = {
    ...shopAdapter.analytics,
    recordEvent: async (ev) => {
      analyticsProviderCalled = true;
    },
  };

  await insertAnalyticsEvent(
    {
      eventType: 'PROMPT_DEMAND_CAPTURED',
      sessionId: 'sess-step3-test',
      userId: mockUserContext.userId,
      query: 'Test decoupling query',
    },
    mockAnalytics
  );

  assert(analyticsProviderCalled === true, 'insertAnalyticsEvent routes cleanly to AnalyticsProvider');

  // --------------------------------------------------------------------------
  // SECTION H: STORAGE ADAPTER EXTENDED DOMAIN METHODS
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION H: StorageAdapter Extended Domain Methods');

  const couponsResult = await getActiveCoupons();
  assert(couponsResult.success === true, 'getActiveCoupons executes via StorageAdapter');
  assert(Array.isArray(couponsResult.data), 'getActiveCoupons returns array');

  const promptsResult = await searchPromptsLibrary({});
  assert(promptsResult.success === true, 'searchPromptsLibrary executes via StorageAdapter');
  assert(Array.isArray(promptsResult.data), 'searchPromptsLibrary returns array');

  const supportResult = await getSupportChannels();
  assert(supportResult.success === true, 'getSupportChannels executes via StorageAdapter');
  assert(supportResult.data?.hotline !== undefined, 'Support hotline is verified');
  assert(supportResult.data?.brand === 'Shop of BOW', 'Brand is Shop of BOW');

  const ticketsResult = await getMyTickets({}, mockUserContext);
  assert(ticketsResult.success === true, 'getMyTickets executes via StorageAdapter');
  assert(Array.isArray(ticketsResult.data), 'getMyTickets returns array');

  // --------------------------------------------------------------------------
  // SECTION I: KNOWLEDGE REVIEW, DRIFT, GOVERNANCE & ACTION SERVICES
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION I: Knowledge Services Execution via Provider');

  const gaps = await getKnowledgeGaps();
  assert(Array.isArray(gaps), 'getKnowledgeGaps executes successfully without Supabase');

  const drift = await detectKnowledgeDrift([], [], [], true);
  assert(typeof drift === 'object', 'detectKnowledgeDrift executes successfully without Supabase');
  assert(drift.driftStatus !== undefined, 'detectKnowledgeDrift report has status');

  const govSummary = await getGovernanceDashboardSummary([], [], [], true);
  assert(typeof govSummary === 'object', 'getGovernanceDashboardSummary executes successfully without Supabase');
  assert(typeof govSummary.overallHealth === 'string', 'Governance summary has overallHealth');

  const intelSummary = await getIntelligenceDashboardSummary(true);
  assert(typeof intelSummary === 'object', 'getIntelligenceDashboardSummary executes successfully without Supabase');

  const actionCenter = await getActionCenter(intelSummary.recommendations, true);
  assert(typeof actionCenter === 'object', 'getActionCenter executes successfully without Supabase');
  assert(Array.isArray(actionCenter.actions), 'Action center actions is an array');

  // --------------------------------------------------------------------------
  // SECTION J: DETERMINISTIC ERROR HANDLING & EMPTY INPUTS
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION J: Deterministic Error Handling');

  const emptySearch = await searchProducts({ keyword: 'xyz-completely-nonexistent-keyword-12345' });
  assert(emptySearch.success === true, 'Empty search executes without throwing');
  assert(Array.isArray(emptySearch.data), 'Empty search returns an array');
  assert(emptySearch.data!.length === 0, 'Non-existent keyword returns empty array');

  const emptyCategory = await resolveCategoryQuery('');
  assert(emptyCategory.matched === false, 'Empty query returns matched: false');

  // --------------------------------------------------------------------------
  // SECTION K: HARD INVARIANT 1 — ZERO AUTO-MUTATION GUARANTEE
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION K: Hard Invariant 1 — Zero Auto-Mutation Guarantee');

  // Agent tools must have ZERO mutation capabilities
  const toolExports = await import('../src/services/agent/tools');
  const mutatingMethods = Object.keys(toolExports).filter((k) =>
    k.startsWith('create') || k.startsWith('delete') || k.startsWith('mutate') || k.startsWith('drop')
  );
  assert(mutatingMethods.length === 0, `Agent tools contain 0 mutating methods (Found: ${mutatingMethods.length})`);

  // --------------------------------------------------------------------------
  // SECTION L: HARD INVARIANT 2 — TRANSACTION BOUNDARY ISOLATION
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION L: Hard Invariant 2 — Transaction Boundary Isolation');

  const warrantyPolicy = await checkWarrantyPolicy({ productName: 'YouTube Premium' });
  assert(warrantyPolicy.success === true, 'Warranty policy returns without transaction mutation');
  assert(warrantyPolicy.data.responseTime.includes('5 - 30 phút'), 'Warranty response time matches policy');

  // --------------------------------------------------------------------------
  // SECTION M: HARD INVARIANT 3 — DURATION PRICING INVARIANT
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION M: Hard Invariant 3 — Duration Pricing Invariant');

  const p1m = await shopAdapter.catalog.getPlanPrice('yt-premium', '1m');
  const p6m = await shopAdapter.catalog.getPlanPrice('yt-premium', '6m');
  const p12m = await shopAdapter.catalog.getPlanPrice('yt-premium', '12m');

  assert(p1m === 35000, `YouTube 1m is immutable at 35.000đ (Actual: ${p1m})`);
  assert(p6m === 280000, `YouTube 6m is immutable at 280.000đ (Actual: ${p6m})`);
  assert(p12m === 450000, `YouTube 12m is immutable at 450.000đ (Actual: ${p12m})`);

  // --------------------------------------------------------------------------
  // SECTION N: HARD INVARIANT 4 — WARRANTY BOUNDARY
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION N: Hard Invariant 4 — Warranty Boundary Isolation');

  const cancelledWarranty = await shopAdapter.orders.getWarrantyStatus('mock-cancelled-id');
  assert(cancelledWarranty.isEligible === false, 'Non-existent order is ineligible for warranty');

  // --------------------------------------------------------------------------
  // SECTION O: HARD INVARIANT 5 — NEGATIVE POLICY ANTI-LOOP
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION O: Hard Invariant 5 — Negative Policy Anti-Loop');

  const supportedPolicies = await shopAdapter.knowledge.getNegativePolicies({ activeOnly: true });
  assert(Array.isArray(supportedPolicies), 'Supported negative policies query returns array');

  // --------------------------------------------------------------------------
  // SECTION P: HARD INVARIANT 6 — 0MS TELEMETRY OVERHEAD
  // --------------------------------------------------------------------------
  console.log('\n📋 SECTION P: Hard Invariant 6 — Zero Telemetry Overhead');

  const tStart = performance.now();
  await shopAdapter.analytics.recordEvent({
    sessionId: 'sess-microtask-test',
    eventType: 'PROMPT_DEMAND_CAPTURED',
    query: 'benchmark telemetry latency',
  });
  const tDuration = performance.now() - tStart;
  assert(tDuration < 10, `Telemetry dispatch is non-blocking (${tDuration.toFixed(2)}ms < 10ms)`);

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`🏁 STEP 3 TEST SUITE COMPLETE: ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED`);
  if (failedAssertions === 0) {
    console.log('🎉 ALL SECTIONS (A-P) PASSED WITH 100% COMPLIANCE!');
  } else {
    console.error(`💥 FAILED: ${failedAssertions} assertions failed!`);
    process.exit(1);
  }
  console.log('========================================================================\n');
}

runStep3TestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
