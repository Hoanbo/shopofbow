// src/services/agent/contracts/catalogProvider.ts
// BOW AGENT V3.3 — STEP 1: CATALOG PROVIDER CONTRACT
//
// Abstracts catalog discovery, product resolution, and plan pricing from
// the underlying database or local mock catalog.

import type {
  ProductItemResult,
  PlanItemResult,
  CategoryInfo,
} from '../types';

export interface CatalogProvider {
  /**
   * Retrieve all active products with their associated plans
   */
  getAllProducts(): Promise<ProductItemResult[]>;

  /**
   * Search products by keyword, name, or search aliases
   */
  findProductsByKeyword(keyword: string): Promise<ProductItemResult[]>;

  /**
   * Retrieve a specific product by its URL-friendly slug
   */
  findProductBySlug(slug: string): Promise<ProductItemResult | null>;

  /**
   * Retrieve all available product categories
   */
  getCategories(): Promise<CategoryInfo[]>;

  /**
   * Retrieve a specific plan by plan ID
   */
  getPlanById(planId: string): Promise<PlanItemResult | null>;

  /**
   * Retrieve verified immutable price for a product and duration tag
   */
  getPlanPrice(productId: string, durationTag?: string): Promise<number | null>;
}
