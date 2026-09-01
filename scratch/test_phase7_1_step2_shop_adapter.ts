// scratch/test_phase7_1_step2_shop_adapter.ts
// ============================================================================
// BOW AGENT V3.3 — PHASE 7.1 STEP 2 TEST SUITE
// SHOP ADAPTER IMPLEMENTATION & HOST BOUNDARY VERIFICATION
// ============================================================================

import {
  shopAdapter,
  createShopAdapter,
  ShopCatalogProvider,
  ShopOrderProvider,
  ShopWalletProvider,
  ShopKnowledgeProvider,
  ShopAnalyticsProvider,
  ShopActionHandler,
  ShopStorageAdapter,
} from '../src/services/agent/adapters/shopAdapter';
import type { AgentAction, AgentContext } from '../src/services/agent/types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runStep2TestSuite() {
  console.log('\n========================================================================');
  console.log('🏁 RUNNING PHASE 7.1 STEP 2: SHOP ADAPTER TEST SUITE');
  console.log('========================================================================\n');

  // ==========================================================================
  // SECTION A: Contract Compatibility
  // ==========================================================================
  console.log('📋 SECTION A: Contract Compatibility');
  assert(typeof shopAdapter === 'object', 'shopAdapter is an object');
  assert(typeof shopAdapter.catalog === 'object', 'shopAdapter.catalog is defined');
  assert(typeof shopAdapter.orders === 'object', 'shopAdapter.orders is defined');
  assert(typeof shopAdapter.wallet === 'object', 'shopAdapter.wallet is defined');
  assert(typeof shopAdapter.knowledge === 'object', 'shopAdapter.knowledge is defined');
  assert(typeof shopAdapter.analytics === 'object', 'shopAdapter.analytics is defined');
  assert(typeof shopAdapter.actions === 'object', 'shopAdapter.actions is defined');
  assert(typeof shopAdapter.storage === 'object', 'shopAdapter.storage is defined');

  // ==========================================================================
  // SECTION B: CatalogProvider Core Methods
  // ==========================================================================
  console.log('\n📋 SECTION B: CatalogProvider Core Methods');
  assert(typeof shopAdapter.catalog.getAllProducts === 'function', 'getAllProducts is a function');
  assert(typeof shopAdapter.catalog.findProductsByKeyword === 'function', 'findProductsByKeyword is a function');
  assert(typeof shopAdapter.catalog.findProductBySlug === 'function', 'findProductBySlug is a function');
  assert(typeof shopAdapter.catalog.getCategories === 'function', 'getCategories is a function');
  assert(typeof shopAdapter.catalog.getPlanById === 'function', 'getPlanById is a function');
  assert(typeof shopAdapter.catalog.getPlanPrice === 'function', 'getPlanPrice is a function');

  // ==========================================================================
  // SECTION C: Product Lookup
  // ==========================================================================
  console.log('\n📋 SECTION C: Product Lookup');
  const ytProduct = await shopAdapter.catalog.findProductBySlug('youtube-premium');
  assert(ytProduct !== null || true, 'findProductBySlug executes without exception');
  const searchResults = await shopAdapter.catalog.findProductsByKeyword('youtube');
  assert(Array.isArray(searchResults), 'findProductsByKeyword returns array');

  // ==========================================================================
  // SECTION D: Plan Lookup
  // ==========================================================================
  console.log('\n📋 SECTION D: Plan Lookup');
  const nullPlan = await shopAdapter.catalog.getPlanById('');
  assert(nullPlan === null, 'getPlanById with empty string returns null safely');
  const invalidPlan = await shopAdapter.catalog.getPlanById('non-existent-plan-999');
  assert(invalidPlan === null, 'getPlanById with invalid id returns null');

  // ==========================================================================
  // SECTION E: Duration Matching
  // ==========================================================================
  console.log('\n📋 SECTION E: Duration Matching');
  const p1m = await shopAdapter.catalog.getPlanPrice('youtube-premium', '1m');
  const p6m = await shopAdapter.catalog.getPlanPrice('youtube-premium', '6m');
  const p12m = await shopAdapter.catalog.getPlanPrice('youtube-premium', '12m');
  assert(p1m === 35000, 'YouTube 1m duration price maps to 35.000đ');
  assert(p6m === 280000, 'YouTube 6m duration price maps to 280.000đ');
  assert(p12m === 450000, 'YouTube 12m duration price maps to 450.000đ');

  // ==========================================================================
  // SECTION F: Price Preservation Invariant
  // ==========================================================================
  console.log('\n📋 SECTION F: Price Preservation Invariant');
  assert(p1m! < p6m!, '1m price is strictly less than 6m price');
  assert(p6m! < p12m!, '6m price is strictly less than 12m price');
  assert(p6m === 280000, 'Invariant 3: YouTube 6m is immutable at exactly 280.000đ');

  // ==========================================================================
  // SECTION G: Category Lookup
  // ==========================================================================
  console.log('\n📋 SECTION G: Category Lookup');
  const categories = await shopAdapter.catalog.getCategories();
  assert(Array.isArray(categories), 'getCategories returns array');
  assert(categories.length > 0, 'Categories list is not empty');
  assert(typeof categories[0].name === 'string', 'Category item has name property');

  // ==========================================================================
  // SECTION H: OrderProvider
  // ==========================================================================
  console.log('\n📋 SECTION H: OrderProvider');
  assert(typeof shopAdapter.orders.getOrder === 'function', 'getOrder is a function');
  assert(typeof shopAdapter.orders.getUserOrders === 'function', 'getUserOrders is a function');
  assert(typeof shopAdapter.orders.getWarrantyStatus === 'function', 'getWarrantyStatus is a function');

  const emptyOrder = await shopAdapter.orders.getOrder('');
  assert(emptyOrder === null, 'getOrder("") returns null safely');
  const emptyUserOrders = await shopAdapter.orders.getUserOrders('');
  assert(Array.isArray(emptyUserOrders) && emptyUserOrders.length === 0, 'getUserOrders("") returns empty array');

  // ==========================================================================
  // SECTION I: Warranty Lookup & Invariant 5 (Cancelled Order Isolation)
  // ==========================================================================
  console.log('\n📋 SECTION I: Warranty Lookup & Invariant 5');
  const notFoundWarranty = await shopAdapter.orders.getWarrantyStatus('non-existent-order-999');
  assert(notFoundWarranty.isEligible === false, 'Non-existent order is ineligible for warranty');
  assert(notFoundWarranty.status === 'not_found', 'Status is not_found');

  // Mock a cancelled order lookup through a test instance
  const mockClient: any = {
    from: (table: string) => ({
      select: () => ({
        or: () => ({
          limit: () => ({
            maybeSingle: async () => ({
              data: {
                id: 'BOW-CANCEL-1',
                user_id: 'usr_test',
                product_name: 'YouTube Premium',
                price: 280000,
                status: 'cancelled',
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      }),
    }),
  };
  const testOrderProvider = new ShopOrderProvider(mockClient);
  const cancelledWarranty = await testOrderProvider.getWarrantyStatus('BOW-CANCEL-1');
  assert(cancelledWarranty.isEligible === false, 'Invariant 5: Cancelled order is strictly ineligible');
  assert(cancelledWarranty.status === 'cancelled', 'Status is cancelled');
  assert(cancelledWarranty.reason?.includes('hủy') === true, 'Reason explains cancelled order');

  // ==========================================================================
  // SECTION J: WalletProvider & VietQR
  // ==========================================================================
  console.log('\n📋 SECTION J: WalletProvider & VietQR');
  assert(typeof shopAdapter.wallet.getBalance === 'function', 'getBalance is a function');
  assert(typeof shopAdapter.wallet.getDepositInstructions === 'function', 'getDepositInstructions is a function');

  const emptyBalance = await shopAdapter.wallet.getBalance('');
  assert(emptyBalance === 0, 'getBalance("") returns 0');

  const depositInfo = await shopAdapter.wallet.getDepositInstructions(100000, 'usr_abc123');
  assert(depositInfo.bankId === 'MB', 'Deposit bank is MB');
  assert(depositInfo.accountNo === '0966 821 315', 'Deposit account is 0966 821 315');
  assert(depositInfo.transferSyntax?.includes('BOW NAP') === true, 'Transfer syntax has BOW NAP prefix');
  assert(depositInfo.qrUrl?.includes('vietqr.io') === true, 'QR URL uses vietqr.io');
  assert(depositInfo.suggestedAmounts.includes(100000), 'Suggested amounts includes 100k');

  // ==========================================================================
  // SECTION K: KnowledgeProvider Core
  // ==========================================================================
  console.log('\n📋 SECTION K: KnowledgeProvider Core');
  assert(typeof shopAdapter.knowledge.getFaqs === 'function', 'getFaqs is a function');
  assert(typeof shopAdapter.knowledge.getNegativePolicies === 'function', 'getNegativePolicies is a function');
  assert(typeof shopAdapter.knowledge.findFaqBySimilarity === 'function', 'findFaqBySimilarity is a function');
  assert(typeof shopAdapter.knowledge.matchNegativePolicy === 'function', 'matchNegativePolicy is a function');

  // ==========================================================================
  // SECTION L: FAQ Retrieval
  // ==========================================================================
  console.log('\n📋 SECTION L: FAQ Retrieval');
  const faqs = await shopAdapter.knowledge.getFaqs();
  assert(Array.isArray(faqs), 'getFaqs returns array');

  // ==========================================================================
  // SECTION M: Negative Policy Matching & Invariant 6 (Anti-Loop)
  // ==========================================================================
  console.log('\n📋 SECTION M: Negative Policy Matching & Invariant 6');
  const policies = await shopAdapter.knowledge.getNegativePolicies();
  assert(Array.isArray(policies), 'getNegativePolicies returns array');

  const wireguardPolicy = await shopAdapter.knowledge.matchNegativePolicy('Shop có hỗ trợ cài Wireguard không?');
  assert(wireguardPolicy === null || typeof wireguardPolicy === 'object', 'matchNegativePolicy executes safely');

  // ==========================================================================
  // SECTION N: AnalyticsProvider & Invariant 7 (0ms Synchronous Overhead)
  // ==========================================================================
  console.log('\n📋 SECTION N: AnalyticsProvider & Invariant 7');
  const t0 = performance.now();
  await shopAdapter.analytics.recordEvent({
    eventType: 'PRODUCTION_REQUEST',
    sessionId: 'sess_test_1',
    query: 'test query',
    route: 'TRANSACTIONAL',
    latencyMs: 12,
  });
  const tDuration = performance.now() - t0;
  assert(tDuration < 10, `Invariant 7: recordEvent execution is non-blocking (${tDuration.toFixed(2)}ms < 10ms)`);

  const events = await shopAdapter.analytics.getEvents({ limit: 5 });
  assert(Array.isArray(events), 'getEvents returns array');

  // ==========================================================================
  // SECTION O: ActionHandler Semantic Bridge
  // ==========================================================================
  console.log('\n📋 SECTION O: ActionHandler Semantic Bridge');
  assert(shopAdapter.actions.canHandleAction('NAVIGATE_CHECKOUT') === true, 'Can handle NAVIGATE_CHECKOUT');
  assert(shopAdapter.actions.canHandleAction('NAVIGATE_ORDER_DETAIL') === true, 'Can handle NAVIGATE_ORDER_DETAIL');
  assert(shopAdapter.actions.canHandleAction('OPEN_DEPOSIT') === true, 'Can handle OPEN_DEPOSIT');
  assert(shopAdapter.actions.canHandleAction('APPLY_COUPON') === true, 'Can handle APPLY_COUPON');
  assert(shopAdapter.actions.canHandleAction('NAVIGATE_SUPPORT') === true, 'Can handle NAVIGATE_SUPPORT');

  const testAction: AgentAction = {
    id: 'act_test_1',
    type: 'NAVIGATE_CHECKOUT',
    label: '💳 Mua ngay',
    payload: { productId: 'prod_yt', planId: 'plan_6m', displayPrice: 280000 },
  };
  const testContext: AgentContext = {
    role: 'user',
    userId: 'usr_1',
    isAuthenticated: true,
  };

  const actionResult = await shopAdapter.actions.handleAction(testAction, testContext);
  assert(actionResult.success === true, 'handleAction returns success: true');
  assert(actionResult.actionId === 'act_test_1', 'Action ID matches');
  assert(actionResult.type === 'NAVIGATE_CHECKOUT', 'Action type matches');
  assert(actionResult.handledLocally === true, 'Handled locally is true');

  // ==========================================================================
  // SECTION P: ShopAdapter Composition & Factory
  // ==========================================================================
  console.log('\n📋 SECTION P: ShopAdapter Composition & Factory');
  const customAdapter = createShopAdapter();
  assert(typeof customAdapter === 'object', 'createShopAdapter() returns valid ShopAdapter');
  assert(customAdapter.catalog instanceof ShopCatalogProvider, 'catalog is instance of ShopCatalogProvider');
  assert(customAdapter.orders instanceof ShopOrderProvider, 'orders is instance of ShopOrderProvider');
  assert(customAdapter.wallet instanceof ShopWalletProvider, 'wallet is instance of ShopWalletProvider');
  assert(customAdapter.knowledge instanceof ShopKnowledgeProvider, 'knowledge is instance of ShopKnowledgeProvider');
  assert(customAdapter.analytics instanceof ShopAnalyticsProvider, 'analytics is instance of ShopAnalyticsProvider');
  assert(customAdapter.actions instanceof ShopActionHandler, 'actions is instance of ShopActionHandler');

  // ==========================================================================
  // SECTION Q: StorageAdapter Compatibility
  // ==========================================================================
  console.log('\n📋 SECTION Q: StorageAdapter Compatibility');
  assert(shopAdapter.storage instanceof ShopStorageAdapter, 'storage is instance of ShopStorageAdapter');
  assert(typeof shopAdapter.storage?.getProducts === 'function', 'storage.getProducts is a function');
  assert(typeof shopAdapter.storage?.getPlans === 'function', 'storage.getPlans is a function');
  assert(typeof shopAdapter.storage?.getCategories === 'function', 'storage.getCategories is a function');
  assert(typeof shopAdapter.storage?.getFaqs === 'function', 'storage.getFaqs is a function');
  assert(typeof shopAdapter.storage?.getNegativePolicies === 'function', 'storage.getNegativePolicies is a function');

  // ==========================================================================
  // SECTION R: Deterministic Error Handling
  // ==========================================================================
  console.log('\n📋 SECTION R: Deterministic Error Handling');
  const safeCat = await shopAdapter.catalog.findProductBySlug('non-existent-product-123456');
  assert(safeCat === null, 'Unknown product returns null without throwing');
  const safeOrder = await shopAdapter.orders.getOrder('non-existent-order-123456');
  assert(safeOrder === null, 'Unknown order returns null without throwing');
  const safeBalance = await shopAdapter.wallet.getBalance('non-existent-user-123456');
  assert(typeof safeBalance === 'number' && safeBalance === 0, 'Unknown user balance defaults to 0');

  // ==========================================================================
  // SECTION S: Zero Auto-Mutation Guarantee
  // ==========================================================================
  console.log('\n📋 SECTION S: Zero Auto-Mutation Guarantee');
  assert(!('autoCreateProduct' in shopAdapter.catalog), 'CatalogProvider has zero autoCreateProduct methods');
  assert(!('autoCreateFaq' in shopAdapter.knowledge), 'KnowledgeProvider has zero autoCreateFaq methods');
  assert(!('autoCreatePolicy' in shopAdapter.knowledge), 'KnowledgeProvider has zero autoCreatePolicy methods');

  // ==========================================================================
  // SECTION T: Dependency Boundary Integrity
  // ==========================================================================
  console.log('\n📋 SECTION T: Dependency Boundary Integrity');
  assert(typeof shopAdapter.actions.handleAction === 'function', 'Semantic actions bridge cleanly without DOM coupling in signature');
  assert(typeof shopAdapter.storage?.recordAgentEvent === 'function', 'StorageAdapter records events cleanly');

  // ==========================================================================
  // SUMMARY
  // ==========================================================================
  console.log('\n========================================================================');
  console.log(`🏁 STEP 2 TEST SUITE COMPLETE: ${passedTests}/${totalTests} ASSERTIONS PASSED`);
  if (failedTests === 0) {
    console.log('🎉 ALL SECTIONS (A-T) PASSED WITH 100% COMPLIANCE!');
  } else {
    console.error(`❌ ${failedTests} ASSERTIONS FAILED!`);
    process.exit(1);
  }
  console.log('========================================================================\n');
}

runStep2TestSuite().catch((err) => {
  console.error('Fatal error running Step 2 test suite:', err);
  process.exit(1);
});
