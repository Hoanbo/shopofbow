// src/services/agent/contracts/knowledgeProvider.ts
// BOW AGENT V3.3 — STEP 1: KNOWLEDGE PROVIDER CONTRACT
//
// Abstracts official FAQ articles, negative policies, and similarity search
// from the underlying physical storage.

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
  tags?: string[];
  isActive: boolean;
  priority?: string;
  viewCount?: number;
  helpfulCount?: number;
  notHelpfulCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface NegativePolicyItem {
  id: string;
  title: string;
  reason?: string;
  scope: 'GLOBAL' | 'PRODUCT' | 'CATEGORY';
  triggerKeywords: string[];
  suggestedAction?: string;
  responseTemplate?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface KnowledgeProvider {
  /**
   * Retrieve all official FAQs
   */
  getFaqs(options?: { activeOnly?: boolean; category?: string }): Promise<FaqItem[]>;

  /**
   * Retrieve all active negative policies
   */
  getNegativePolicies(options?: { activeOnly?: boolean }): Promise<NegativePolicyItem[]>;

  /**
   * Find an official FAQ matching a natural query by semantic or text similarity
   */
  findFaqBySimilarity(query: string, threshold?: number): Promise<FaqItem | null>;

  /**
   * Check if a query matches an active negative policy
   */
  matchNegativePolicy(query: string): Promise<NegativePolicyItem | null>;
}
