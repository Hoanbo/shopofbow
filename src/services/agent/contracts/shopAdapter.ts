// src/services/agent/contracts/shopAdapter.ts
// BOW AGENT V3.3 — STEP 1: COMPOSITE SHOP ADAPTER CONTRACT
//
// Composes domain-specific providers into a unified Shop boundary that isolates
// the Shop implementation (shopofbow) from the Agent Core.

import type { CatalogProvider } from './catalogProvider';
import type { OrderProvider } from './orderProvider';
import type { WalletProvider } from './walletProvider';
import type { KnowledgeProvider } from './knowledgeProvider';
import type { AnalyticsProvider } from './analyticsProvider';
import type { ActionHandler } from './actionHandler';
import type { StorageAdapter } from './storageAdapter';

/**
 * ShopAdapter Interface
 * Represents the complete integration surface of Shop of BOW.
 * The Agent Core interacts exclusively through this composite boundary or its sub-providers,
 * completely unaware of Supabase, Vite, React, or browser window events.
 */
export interface ShopAdapter {
  readonly catalog: CatalogProvider;
  readonly orders: OrderProvider;
  readonly wallet: WalletProvider;
  readonly knowledge: KnowledgeProvider;
  readonly analytics: AnalyticsProvider;
  readonly actions: ActionHandler;
  readonly storage?: StorageAdapter;
  readonly admin?: any;
}
