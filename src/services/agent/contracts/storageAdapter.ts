// src/services/agent/contracts/storageAdapter.ts
// BOW AGENT V3.3 — STEP 1: DOMAIN STORAGE ADAPTER CONTRACT
//
// Domain-oriented persistence contract that completely hides Supabase, SQL,
// or any database engine from the Agent Core.

import type { ProductItemResult, PlanItemResult, CategoryInfo } from '../types';
import type { AgentOrderSummary } from './orderProvider';
import type { FaqItem, NegativePolicyItem } from './knowledgeProvider';
import type { AgentAnalyticsEventInput } from './analyticsProvider';

export interface StorageAdapter {
  /**
   * Domain: Catalog & Products
   */
  getProducts(): Promise<ProductItemResult[]>;
  getPlans(productId?: string): Promise<PlanItemResult[]>;
  getCategories(): Promise<CategoryInfo[]>;

  /**
   * Domain: Customer Orders & Warranty
   */
  getOrderById(orderId: string): Promise<AgentOrderSummary | null>;
  getOrdersForUser(userId: string, limit?: number): Promise<AgentOrderSummary[]>;

  /**
   * Domain: Support Tickets
   */
  getTicketsForUser(userId: string): Promise<any[]>;

  /**
   * Domain: Knowledge Base
   */
  getFaqs(activeOnly?: boolean): Promise<FaqItem[]>;
  getNegativePolicies(activeOnly?: boolean): Promise<NegativePolicyItem[]>;

  /**
   * Domain: Analytics & Audit Events
   */
  recordAgentEvent(event: AgentAnalyticsEventInput): Promise<void>;
  getAgentEvents(since?: string, limit?: number, eventTypes?: string[]): Promise<any[]>;
  insertAnalyticsEvents?(events: any[]): Promise<void>;

  /**
   * Domain: Extended Shop Tools
   */
  searchProducts?(params: { keyword?: string; type?: string; categoryId?: string; productId?: string; limit?: number }): Promise<ProductItemResult[]>;
  getMyOrders?(params: { paymentCode?: string; status?: string; productName?: string; limit?: number }, userId: string): Promise<any[]>;
  searchPromptsLibrary?(params: { query?: string; category?: string }): Promise<any[]>;
  getActiveCoupons?(): Promise<any[]>;
  getSupportChannels?(): Promise<any>;

  /**
   * Domain: Knowledge Review Lifecycle (Authorized Operations Only)
   */
  updateFaq?(id: string, patch: any): Promise<boolean>;
  insertFaq?(faq: any): Promise<any>;
  deleteFaq?(id: string): Promise<boolean>;
}
