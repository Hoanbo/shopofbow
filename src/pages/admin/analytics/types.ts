// src/pages/admin/analytics/types.ts

export interface DashboardStats {
  kpis: {
    total_sessions: number;
    total_messages: number;
    intent_resolved: number;
    product_resolved: number;
    plan_resolved: number;
    clarification_requested: number;
    unresolved: number;
    action_shown: number;
    action_clicked: number;
    action_expired: number;
    checkout_opened: number;
    checkout_success: number;
  };
  top_intents: Array<{ intent: string; count: number }>;
  top_products: Array<{
    product_id: string;
    resolved_count: number;
    clicked_count: number;
    checkout_success_count: number;
  }>;
  top_plans: Array<{
    plan_id: string;
    product_id: string;
    resolved_count: number;
    clicked_count: number;
    checkout_success_count: number;
  }>;
  unresolved_reasons: Array<{ reason: string; count: number }>;
  user_phrases: Array<{ query: string; count: number }>;
}

export interface ProductPlanRecord {
  id: string;
  name: string;
  duration: string;
  price: number;
  original_price?: number;
  is_highlight?: boolean;
  is_active?: boolean;
}

export interface ProductRecord {
  id: string;
  name: string;
  slug: string;
  base_price: number;
  category_id: string;
  is_active: boolean;
  categories?: { id: string; name: string; slug: string; icon?: string } | null;
  product_plans?: ProductPlanRecord[];
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

export interface HeroKpis {
  conversionRate: number;
  avgLatencyMs: number;
  fallbackRate: number;
  catalogGapsCount: number;
  resolutionRate: number;
  totalMessages: number;
  totalSessions: number;
}

export interface PlanLookupItem {
  id: string;
  name: string;
  duration: string;
  price: number;
  productId: string;
  productName: string;
}

export type DateRange = 'today' | '24h' | '7days' | '30days' | '90days' | 'all';
export type AnalyticsTab = 'overview' | 'products' | 'demand' | 'language' | 'events';
