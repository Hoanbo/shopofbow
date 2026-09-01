const fs = require('fs');
const path = require('path');

const srcDir = path.resolve('src/services/agent');
const targetDir = 'C:\\BOW\\bow-agent\\src';

console.log('Starting extraction from:', srcDir);
console.log('Target package:', targetDir);

// Ensure env.d.ts exists
const typesDir = path.join(targetDir, 'types');
if (!fs.existsSync(typesDir)) {
  fs.mkdirSync(typesDir, { recursive: true });
}
fs.writeFileSync(
  path.join(typesDir, 'env.d.ts'),
  `interface ImportMetaEnv {
  readonly [key: string]: any;
}
interface ImportMeta {
  readonly env?: ImportMetaEnv;
}
`,
  'utf-8'
);

// 1. Copy contracts
console.log('1. Copying contracts...');
const contractFiles = fs.readdirSync(path.join(srcDir, 'contracts'));
for (const f of contractFiles) {
  if (f === 'README.md') continue;
  let content = fs.readFileSync(path.join(srcDir, 'contracts', f), 'utf-8');
  content = content.replace(/from\s+['"]\.\.\/types['"]/g, "from '../core/types'");

  if (f === 'actionHandler.ts') {
    // Remove re-export of core types to avoid TS2308 ambiguity in index.ts
    content = content.replace(/export type \{ AgentAction, AgentActionType, AgentActionPayload \};/g, '// Re-exported via core/types');
  }

  if (f === 'shopAdapter.ts') {
    // Add fallback adapter and registry
    content += `\n
// ============================================================================
// HOST ADAPTER REGISTRY & DETERMINISTIC STANDALONE FALLBACK
// ============================================================================

export const fallbackShopAdapter: ShopAdapter = {
  catalog: {
    getAllProducts: async () => [],
    findProductsByKeyword: async () => [],
    findProductBySlug: async () => null,
    getCategories: async () => [],
    getPlanById: async () => null,
    getPlanPrice: async () => null,
  },
  orders: {
    getOrder: async () => null,
    getUserOrders: async () => [],
    getWarrantyStatus: async () => ({
      orderId: '',
      isEligible: false,
      reason: 'Order not found',
      status: 'not_found',
      ticketCount: 0,
    }),
  },
  wallet: {
    getBalance: async () => 0,
    getDepositInstructions: async () => ({
      bankId: 'MB', accountNo: '0966821315',
      accountName: 'Shop of BOW',
      transferSyntax: 'BOW NAP',
      qrUrl: 'https://img.vietqr.io/image/MB-0966821315-compact2.png',
      suggestedAmounts: [50000, 100000, 200000, 500000],
    }),
  },
  knowledge: {
    getFaqs: async () => [],
    getNegativePolicies: async () => [],
    findFaqBySimilarity: async () => null,
    matchNegativePolicy: async () => null,
  },
  analytics: {
    recordEvent: async () => {},
    getEvents: async () => [],
    getDemandSummary: async () => ({
      
    }),
  },
  actions: {
    canHandleAction: () => false,
    handleAction: async (action: any) => ({
      actionId: action?.id || '',
      type: action?.type || 'NAVIGATE_CHECKOUT',
      success: false,
      handledLocally: false,
    }),
  },
  storage: {
    getProducts: async () => [],
    getPlans: async () => [],
    getCategories: async () => [],
    getFaqs: async () => [],
    getNegativePolicies: async () => [],
    getAgentEvents: async () => [],
    recordAgentEvent: async () => {},
    insertAnalyticsEvents: async () => {},
    getOrderById: async () => null,
    getOrdersForUser: async () => [],
    getTicketsForUser: async () => [],
    searchPromptsLibrary: async () => [],
    getActiveCoupons: async () => [],
    getSupportChannels: async () => ({ hotline: '0966 821 315', brand: 'Shop of BOW' }),
  },
};

let activeShopAdapter: ShopAdapter = fallbackShopAdapter;

export function setActiveShopAdapter(adapter: ShopAdapter): void {
  activeShopAdapter = adapter;
}

export function getActiveShopAdapter(): ShopAdapter {
  return activeShopAdapter;
}
`;
  }
  fs.writeFileSync(path.join(targetDir, 'contracts', f), content, 'utf-8');
}

// 2. Copy core
console.log('2. Copying core modules...');
const coreFiles = [
  'types.ts',
  'sessionContext.ts',
  'permissions.ts',
  'responseFormatter.ts',
  'actionValidator.ts',
  'actionPlanner.ts',
  'intentResolver.ts',
  'productResolver.ts',
  'categoryResolver.ts',
  'tools.ts',
  'agentEngine.ts',
];

for (const f of coreFiles) {
  let content = fs.readFileSync(path.join(srcDir, f), 'utf-8');

  // Adapt imports for core
  content = content.replace(/from\s+['"]\.\/adapters\/shopAdapter['"]/g, "from '../contracts'");
  content = content.replace(/from\s+['"]\.\/contracts\/([^'"]+)['"]/g, "from '../contracts'");
  content = content.replace(/from\s+['"]\.\/contracts['"]/g, "from '../contracts'");
  content = content.replace(/from\s+['"]\.\/monitoring\/([^'"]+)['"]/g, "from '../monitoring/$1'");
  content = content.replace(/from\s+['"]\.\/gemini\/([^'"]+)['"]/g, "from '../gemini/$1'");
  content = content.replace(/from\s+['"]\.\/knowledge\/([^'"]+)['"]/g, "from '../knowledge/$1'");
  content = content.replace(/from\s+['"]\.\/production\/([^'"]+)['"]/g, "from '../production/$1'");

  fs.writeFileSync(path.join(targetDir, 'core', f), content, 'utf-8');
}

// 3. Copy monitoring
console.log('3. Copying monitoring...');
const monitoringFiles = [
  'analyticsTypes.ts',
  'analyticsSanitizer.ts',
  'demandAggregator.ts',
  'agentEvents.ts',
  'agentAnalytics.ts',
];

for (const f of monitoringFiles) {
  let content = fs.readFileSync(path.join(srcDir, 'monitoring', f), 'utf-8');
  content = content.replace(/from\s+['"]\.\.\/adapters\/shopAdapter['"]/g, "from '../contracts'");
  content = content.replace(/from\s+['"]\.\.\/contracts\/([^'"]+)['"]/g, "from '../contracts'");
  content = content.replace(/from\s+['"]\.\.\/contracts['"]/g, "from '../contracts'");
  content = content.replace(/from\s+['"]\.\.\/intentResolver['"]/g, "from '../core/intentResolver'");
  content = content.replace(/from\s+['"]\.\.\/types['"]/g, "from '../core/types'");
  fs.writeFileSync(path.join(targetDir, 'monitoring', f), content, 'utf-8');
}

// 4. Copy knowledge
console.log('4. Copying knowledge...');
const knowledgeFiles = fs.readdirSync(path.join(srcDir, 'knowledge'));
for (const f of knowledgeFiles) {
  let content = fs.readFileSync(path.join(srcDir, 'knowledge', f), 'utf-8');
  content = content.replace(/from\s+['"]\.\.\/adapters\/shopAdapter['"]/g, "from '../contracts'");
  content = content.replace(/from\s+['"]\.\.\/contracts\/([^'"]+)['"]/g, "from '../contracts'");
  content = content.replace(/from\s+['"]\.\.\/contracts['"]/g, "from '../contracts'");
  content = content.replace(/from\s+['"]\.\.\/types['"]/g, "from '../core/types'");
  content = content.replace(/from\s+['"]\.\.\/intentResolver['"]/g, "from '../core/intentResolver'");
  content = content.replace(/from\s+['"]\.\.\/categoryResolver['"]/g, "from '../core/categoryResolver'");
  content = content.replace(/from\s+['"]\.\.\/productResolver['"]/g, "from '../core/productResolver'");
  content = content.replace(/from\s+['"]\.\.\/tools['"]/g, "from '../core/tools'");
  content = content.replace(/from\s+['"]\.\.\/sessionContext['"]/g, "from '../core/sessionContext'");
  fs.writeFileSync(path.join(targetDir, 'knowledge', f), content, 'utf-8');
}

// 5. Copy production
console.log('5. Copying production...');
const productionFiles = fs.readdirSync(path.join(srcDir, 'production'));
for (const f of productionFiles) {
  let content = fs.readFileSync(path.join(srcDir, 'production', f), 'utf-8');
  content = content.replace(/from\s+['"]\.\.\/types['"]/g, "from '../core/types'");
  content = content.replace(/from\s+['"]\.\.\/intentResolver['"]/g, "from '../core/intentResolver'");
  content = content.replace(/from\s+['"]\.\.\/adapters\/shopAdapter['"]/g, "from '../contracts'");
  content = content.replace(/from\s+['"]\.\.\/contracts\/([^'"]+)['"]/g, "from '../contracts'");
  content = content.replace(/from\s+['"]\.\.\/contracts['"]/g, "from '../contracts'");
  fs.writeFileSync(path.join(targetDir, 'production', f), content, 'utf-8');
}

// 6. Copy gemini
console.log('6. Copying gemini...');
const geminiFiles = fs.readdirSync(path.join(srcDir, 'gemini'));
for (const f of geminiFiles) {
  let content = fs.readFileSync(path.join(srcDir, 'gemini', f), 'utf-8');
  content = content.replace(/from\s+['"]\.\.\/types['"]/g, "from '../core/types'");
  content = content.replace(/from\s+['"]\.\.\/intentResolver['"]/g, "from '../core/intentResolver'");
  content = content.replace(/from\s+['"]\.\.\/actionPlanner['"]/g, "from '../core/actionPlanner'");
  content = content.replace(/from\s+['"]\.\.\/sessionContext['"]/g, "from '../core/sessionContext'");
  content = content.replace(/from\s+['"]\.\.\/productResolver['"]/g, "from '../core/productResolver'");
  content = content.replace(/from\s+['"]\.\.\/tools['"]/g, "from '../core/tools'");
  content = content.replace(/from\s+['"]\.\.\/categoryResolver['"]/g, "from '../core/categoryResolver'");
  content = content.replace(/from\s+['"]\.\.\/adapters\/shopAdapter['"]/g, "from '../contracts'");
  content = content.replace(/from\s+['"]\.\.\/contracts\/([^'"]+)['"]/g, "from '../contracts'");
  content = content.replace(/from\s+['"]\.\.\/contracts['"]/g, "from '../contracts'");
  fs.writeFileSync(path.join(targetDir, 'gemini', f), content, 'utf-8');
}

// 7. Create src/index.ts
console.log('7. Creating src/index.ts...');
const indexContent = `// src/index.ts
// BOW AGENT V3.3 — STANDALONE AGENT ENGINE PUBLIC API

// 1. Contracts & Provider Interfaces
export * from './contracts';

// 2. Core Agent Engine & Types
export * from './core/types';
export * from './core/agentEngine';
export * from './core/intentResolver';
export * from './core/actionPlanner';
export * from './core/actionValidator';
export * from './core/permissions';
export * from './core/responseFormatter';
export * from './core/sessionContext';
export * from './core/tools';
export * from './core/productResolver';
export * from './core/categoryResolver';

// 3. Monitoring & Analytics
export * from './monitoring/analyticsTypes';
export * from './monitoring/agentAnalytics';
export * from './monitoring/agentEvents';
export * from './monitoring/analyticsSanitizer';
export * from './monitoring/demandAggregator';

// 4. Knowledge Operations & Intelligence
export * from './knowledge/knowledgeActionService';
export * from './knowledge/knowledgeAlertService';
export * from './knowledge/knowledgeAnomalyService';
export * from './knowledge/knowledgeDriftService';
export * from './knowledge/knowledgeGapAggregator';
export * from './knowledge/knowledgeGapDetector';
export * from './knowledge/knowledgeGovernanceService';
export * from './knowledge/knowledgeIntelligenceService';
export * from './knowledge/knowledgeQaService';
export * from './knowledge/knowledgeReviewService';
export * from './knowledge/negativePolicyService';

// 5. Production Operations & Reliability
export * from './production/productionCapacityService';
export * from './production/productionCircuitBreaker';
export * from './production/productionFallbackService';
export * from './production/productionHealthService';
export * from './production/productionIncidentService';
export * from './production/productionRollbackService';
export * from './production/productionRolloutService';
export * from './production/productionSloService';
export * from './production/productionTelemetryService';

// 6. Gemini Integration
export * from './gemini/config';
export * from './gemini/geminiClient';
export * from './gemini/geminiPrompt';
export * from './gemini/geminiTools';
`;

fs.writeFileSync(path.join(targetDir, 'index.ts'), indexContent, 'utf-8');
console.log('EXTRACTION COMPLETED SUCCESSFULLY!');

