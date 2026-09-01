// src/services/agent/adapters/shopAdapter.ts
// BOW AGENT V3.3 — PHASE 7.1 STEP 2: CONCRETE SHOP ADAPTER
//
// Host-side boundary between Shop of BOW (host application) and BOW Agent.
// Wraps Supabase, local catalog, window events, and host storage behind
// the abstract contracts defined in `src/services/agent/contracts/`.

import { supabase } from '../../../lib/supabase';
import type {
  ShopAdapter,
  CatalogProvider,
  OrderProvider,
  WalletProvider,
  KnowledgeProvider,
  AnalyticsProvider,
  ActionHandler,
  StorageAdapter,
  ActionResult,
  AgentOrderSummary,
  WarrantyStatusResult,
  DepositInstructions,
  FaqItem,
  NegativePolicyItem,
  AgentAnalyticsEventInput,
  AnalyticsQueryOptions,
} from '../contracts';
import type {
  ProductItemResult,
  PlanItemResult,
  CategoryInfo,
  AgentAction,
  AgentActionType,
  AgentContext,
} from '../types';
import {
  matchNegativePolicy as matchPolicy,
  getNegativePolicies as fetchNegativePolicies,
} from '../knowledge/negativePolicyService';
import { sanitizeMetadata } from '../monitoring/analyticsSanitizer';
import { normalizeText } from '../intentResolver';

// ============================================================================
// 1. CATALOG PROVIDER IMPLEMENTATION
// ============================================================================

export class ShopCatalogProvider implements CatalogProvider {
  constructor(private client = supabase) {}

  async getAllProducts(): Promise<ProductItemResult[]> {
    const storage = new ShopStorageAdapter(this.client);
    return storage.searchProducts({});
  }

  async findProductsByKeyword(keyword: string): Promise<ProductItemResult[]> {
    const storage = new ShopStorageAdapter(this.client);
    return storage.searchProducts({ keyword });
  }

  async findProductBySlug(slug: string): Promise<ProductItemResult | null> {
    if (!slug) return null;
    const cleanSlug = slug.trim().toLowerCase();
    const storage = new ShopStorageAdapter(this.client);
    const products = await storage.searchProducts({ keyword: cleanSlug });
    const match = (products || []).find(
      (p) => p.slug.toLowerCase() === cleanSlug || p.name.toLowerCase().includes(cleanSlug)
    );
    return match || null;
  }

  async getCategories(): Promise<CategoryInfo[]> {
    try {
      const { data, error } = await this.client
        .from('categories')
        .select('id, name, slug, icon, sort_order')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon || null,
        sortOrder: c.sort_order || 0,
      }));
    } catch {
      return [
        { id: 'cat-ai', name: 'Công cụ AI', slug: 'ai-tools' },
        { id: 'cat-work', name: 'Làm việc & Học tập', slug: 'work-study' },
        { id: 'cat-ent', name: 'Giải trí & Phim ảnh', slug: 'entertainment' },
      ];
    }
  }

  async getPlanById(planId: string): Promise<PlanItemResult | null> {
    if (!planId) return null;
    try {
      const { data, error } = await this.client
        .from('product_plans')
        .select('id, name, duration, price, original_price, is_highlight, is_active, short_description')
        .eq('id', planId)
        .maybeSingle();

      if (error || !data) return null;
      return {
        id: data.id,
        name: data.name,
        duration: data.duration || '',
        price: Number(data.price || 0),
        originalPrice: data.original_price != null ? Number(data.original_price) : null,
        isHighlight: !!data.is_highlight,
        shortDescription: data.short_description || null,
      };
    } catch {
      return null;
    }
  }

  async getPlanPrice(productId: string, durationTag?: string): Promise<number | null> {
    // Invariant Protection: YouTube duration pricing is immutable
    if (productId.toLowerCase().includes('youtube') || productId.toLowerCase().includes('yt')) {
      if (durationTag === '1m' || durationTag === '1_month') return 35000;
      if (durationTag === '6m' || durationTag === '6_months') return 280000;
      if (durationTag === '12m' || durationTag === '12_months') return 450000;
    }

    try {
      let query = this.client
        .from('product_plans')
        .select('price, duration')
        .eq('product_id', productId)
        .eq('is_active', true);

      if (durationTag) {
        query = query.ilike('duration', `%${durationTag}%`);
      }

      const { data, error } = await query.limit(1).maybeSingle();
      if (error || !data) return null;
      return Number(data.price);
    } catch {
      return null;
    }
  }
}

// ============================================================================
// 2. ORDER & WARRANTY PROVIDER IMPLEMENTATION
// ============================================================================

export class ShopOrderProvider implements OrderProvider {
  constructor(private client = supabase) {}

  async getOrder(orderIdOrCode: string): Promise<AgentOrderSummary | null> {
    if (!orderIdOrCode) return null;
    const clean = orderIdOrCode.trim();
    try {
      const { data, error } = await (this.client as any)
        .from('orders')
        .select('id, user_id, product_name, plan_label, price, payment_code, status, created_at, expires_at, notes')
        .or(`id.eq.${clean},payment_code.ilike.%${clean}%`)
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      return {
        id: data.id,
        userId: data.user_id,
        productName: data.product_name,
        planLabel: data.plan_label || undefined,
        price: Number(data.price || 0),
        status: data.status,
        paymentCode: data.payment_code || undefined,
        notes: data.notes || undefined,
        createdAt: data.created_at,
        warrantyExpiresAt: data.expires_at || undefined,
      };
    } catch {
      return null;
    }
  }

  async getUserOrders(userId: string, limit = 12): Promise<AgentOrderSummary[]> {
    if (!userId) return [];
    try {
      const { data, error } = await (this.client as any)
        .from('orders')
        .select('id, user_id, product_name, plan_label, price, payment_code, status, created_at, expires_at, notes')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map((o: any) => ({
        id: o.id,
        userId: o.user_id,
        productName: o.product_name,
        planLabel: o.plan_label || undefined,
        price: Number(o.price || 0),
        status: o.status,
        paymentCode: o.payment_code || undefined,
        notes: o.notes || undefined,
        createdAt: o.created_at,
        warrantyExpiresAt: o.expires_at || undefined,
      }));
    } catch {
      return [];
    }
  }

  async getWarrantyStatus(orderId: string): Promise<WarrantyStatusResult> {
    const order = await this.getOrder(orderId);
    if (!order) {
      return {
        orderId,
        isEligible: false,
        reason: 'Không tìm thấy thông tin đơn hàng trong hệ thống.',
        ticketCount: 0,
        status: 'not_found',
      };
    }

    // Invariant Protection: Cancelled orders are strictly ineligible
    if (order.status.toLowerCase() === 'cancelled' || order.status.toLowerCase() === 'canceled') {
      return {
        orderId: order.id,
        isEligible: false,
        reason: 'Đơn hàng đã hủy không thuộc phạm vi bảo hành.',
        ticketCount: 0,
        status: 'cancelled',
      };
    }

    const isExpired = order.warrantyExpiresAt ? new Date(order.warrantyExpiresAt) < new Date() : false;
    if (isExpired) {
      return {
        orderId: order.id,
        isEligible: false,
        reason: 'Thời hạn bảo hành của gói sản phẩm đã kết thúc.',
        ticketCount: 0,
        status: 'expired',
      };
    }

    return {
      orderId: order.id,
      isEligible: true,
      reason: 'Đơn hàng còn hiệu lực bảo hành 1 đổi 1.',
      ticketCount: 0,
      status: order.status,
    };
  }
}

// ============================================================================
// 3. WALLET & DEPOSIT PROVIDER IMPLEMENTATION
// ============================================================================

export class ShopWalletProvider implements WalletProvider {
  constructor(private client = supabase) {}

  async getBalance(userId: string): Promise<number> {
    if (!userId) return 0;
    try {
      const { data, error } = await this.client
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) return 0;
      return Number(data.balance || 0);
    } catch {
      return 0;
    }
  }

  async getDepositInstructions(amount?: number, userId?: string): Promise<DepositInstructions> {
    const defaultSyntax = userId ? `BOW NAP ${userId.slice(0, 8).toUpperCase()}` : 'BOW NAP TIEN';
    const targetAmount = amount && amount > 0 ? amount : 50000;
    const qrUrl = `https://img.vietqr.io/image/MB-0966821315-compact2.png?amount=${targetAmount}&addInfo=${encodeURIComponent(
      defaultSyntax
    )}&accountName=${encodeURIComponent('HOANG LE ANH TUAN')}`;

    return {
      bankId: 'MB',
      accountNo: '0966 821 315',
      accountName: 'HOANG LE ANH TUAN',
      transferSyntax: defaultSyntax,
      qrUrl,
      suggestedAmounts: [50000, 100000, 200000, 500000],
    };
  }
}

// ============================================================================
// 4. KNOWLEDGE PROVIDER IMPLEMENTATION
// ============================================================================

export class ShopKnowledgeProvider implements KnowledgeProvider {
  constructor(private client = supabase) {}

  async getFaqs(options?: { activeOnly?: boolean; category?: string }): Promise<FaqItem[]> {
    try {
      let query = (this.client as any)
        .from('faqs')
        .select('id, question, answer, category, tags, is_active, priority, view_count, helpful_count, not_helpful_count, created_at, updated_at')
        .order('sort_order', { ascending: true });

      if (options?.activeOnly !== false) {
        query = query.eq('is_active', true);
      }
      if (options?.category) {
        query = query.eq('category', options.category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((f: any) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        category: f.category || undefined,
        tags: Array.isArray(f.tags) ? f.tags : [],
        isActive: f.is_active !== false,
        priority: f.priority || undefined,
        viewCount: f.view_count || 0,
        helpfulCount: f.helpful_count || 0,
        notHelpfulCount: f.not_helpful_count || 0,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      }));
    } catch {
      return [];
    }
  }

  async getNegativePolicies(options?: { activeOnly?: boolean }): Promise<NegativePolicyItem[]> {
    try {
      const policies = await fetchNegativePolicies({
        status: options?.activeOnly !== false ? 'ACTIVE' : 'ALL',
      });
      return policies.map((p) => ({
        id: p.id,
        title: p.policyKey,
        reason: p.reason,
        scope: (p.scopeType as any) || 'GLOBAL',
        triggerKeywords: [p.scopeValue, p.questionPattern],
        suggestedAction: undefined,
        responseTemplate: p.answer,
        isActive: p.status === 'ACTIVE',
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
    } catch {
      return [];
    }
  }

  async findFaqBySimilarity(query: string, _threshold = 0.6): Promise<FaqItem | null> {
    if (!query) return null;
    const faqs = await this.getFaqs({ activeOnly: true });
    const normQ = normalizeText(query);

    for (const faq of faqs) {
      const normFaq = normalizeText(faq.question);
      if (normQ.includes(normFaq) || normFaq.includes(normQ)) {
        return faq;
      }
    }
    return null;
  }

  async matchNegativePolicy(query: string): Promise<NegativePolicyItem | null> {
    if (!query) return null;
    const match = await matchPolicy(query);
    if (!match || !match.policy) return null;

    const p = match.policy;
    return {
      id: p.id,
      title: p.policyKey,
      reason: p.reason,
      scope: (p.scopeType as any) || 'GLOBAL',
      triggerKeywords: [p.scopeValue, p.questionPattern],
      suggestedAction: undefined,
      responseTemplate: p.answer,
      isActive: p.status === 'ACTIVE',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}

// ============================================================================
// 5. ANALYTICS & TELEMETRY PROVIDER IMPLEMENTATION
// ============================================================================

export class ShopAnalyticsProvider implements AnalyticsProvider {
  constructor(private client = supabase) {}

  async recordEvent(event: AgentAnalyticsEventInput): Promise<void> {
    // Invariant Protection: 0ms synchronous latency overhead via microtask
    Promise.resolve().then(async () => {
      try {
        const sanitizedMetadata = sanitizeMetadata(event.metadata);
        const isValidUuid = (id?: string | null) =>
          typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        const payload = {
          event_type: event.eventType,
          user_id: isValidUuid(event.userId) ? event.userId : null,
          session_id: event.sessionId || null,
          intent: event.intent || null,
          reason: event.reason || null,
          metadata: {
            ...(sanitizedMetadata || {}),
            query: event.query,
            route: event.route,
            latencyMs: event.latencyMs,
          },
        };

        await (this.client as any).from('agent_analytics_events').insert([payload]);
      } catch {
        // Telemetry errors must never disrupt customer or host operation
      }
    });
  }

  async getEvents(options?: AnalyticsQueryOptions): Promise<any[]> {
    try {
      let query = this.client
        .from('agent_analytics_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (options?.sessionId) {
        query = query.eq('session_id', options.sessionId);
      }
      if (options?.userId) {
        query = query.eq('user_id', options.userId);
      }
      if (options?.eventType) {
        query = query.eq('event_type', options.eventType);
      }
      if (options?.since) {
        query = query.gte('created_at', options.since);
      }

      const { data, error } = await query.limit(options?.limit || 100);
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  }

  async getDemandSummary(since?: string): Promise<Record<string, number>> {
    try {
      let query = this.client
        .from('agent_analytics_events')
        .select('query, intent, metadata')
        .eq('event_type', 'PRODUCT_DEMAND_RECORDED');

      if (since) {
        query = query.gte('created_at', since);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;

      const summary: Record<string, number> = {};
      for (const ev of (data as any[]) || []) {
        const key = ev.metadata?.keyword || ev.query || 'Khác';
        summary[key] = (summary[key] || 0) + 1;
      }
      return summary;
    } catch {
      return {};
    }
  }
}

// ============================================================================
// 6. ACTION HANDLER IMPLEMENTATION (COMPATIBILITY BRIDGE)
// ============================================================================

export class ShopActionHandler implements ActionHandler {
  canHandleAction(actionType: AgentActionType): boolean {
    const supported: AgentActionType[] = [
      'NAVIGATE_CHECKOUT',
      'NAVIGATE_ORDER_DETAIL',
      'NAVIGATE_RENEWAL',
      'NAVIGATE_SUPPORT',
      'NAVIGATE_TICKET_DETAIL',
      'APPLY_COUPON',
      'OPEN_DEPOSIT',
    ];
    return supported.includes(actionType);
  }

  async handleAction(action: AgentAction, _context: AgentContext): Promise<ActionResult> {
    if (!this.canHandleAction(action.type)) {
      return {
        success: false,
        actionId: action.id,
        type: action.type,
        message: `Hành động ${action.type} không được hỗ trợ trong môi trường này.`,
      };
    }

    // Bridge semantic action to browser window events if running in client UI
    if (typeof window !== 'undefined') {
      try {
        switch (action.type) {
          case 'NAVIGATE_CHECKOUT':
            window.dispatchEvent(
              new CustomEvent('OPEN_CHECKOUT_MODAL', {
                detail: {
                  productId: action.payload.productId,
                  planId: action.payload.planId,
                  displayPrice: action.payload.displayPrice,
                },
              })
            );
            break;
          case 'NAVIGATE_ORDER_DETAIL':
            window.dispatchEvent(
              new CustomEvent('OPEN_ORDER_DETAIL_MODAL', {
                detail: { orderId: action.payload.orderId },
              })
            );
            break;
          case 'OPEN_DEPOSIT':
            window.dispatchEvent(
              new CustomEvent('OPEN_DEPOSIT_MODAL', {
                detail: { amount: action.payload.amount || 50000 },
              })
            );
            break;
          case 'NAVIGATE_SUPPORT':
          case 'NAVIGATE_TICKET_DETAIL':
            window.dispatchEvent(
              new CustomEvent('OPEN_TICKET_MODAL', {
                detail: {
                  ticketTitle: action.payload.ticketTitle || action.payload.supportTitle,
                  orderId: action.payload.orderId,
                },
              })
            );
            break;
          case 'APPLY_COUPON':
            window.dispatchEvent(
              new CustomEvent('APPLY_COUPON_CODE', {
                detail: { couponCode: action.payload.couponCode },
              })
            );
            break;
          default:
            break;
        }
      } catch (err: any) {
        return {
          success: false,
          actionId: action.id,
          type: action.type,
          message: `Lỗi kích hoạt hành động UI: ${err?.message || 'Unknown'}`,
        };
      }
    }

    return {
      success: true,
      actionId: action.id,
      type: action.type,
      message: `Hành động ${action.label} đã được kích hoạt thành công.`,
      handledLocally: true,
      clientPayload: action.payload,
    };
  }
}

// ============================================================================
// 7. STORAGE ADAPTER IMPLEMENTATION
// ============================================================================

export class ShopStorageAdapter implements StorageAdapter {
  constructor(private client = supabase) {}

  async getProducts(): Promise<ProductItemResult[]> {
    return this.searchProducts({});
  }

  async getPlans(productId?: string): Promise<PlanItemResult[]> {
    try {
      let query = this.client
        .from('product_plans')
        .select('id, name, duration, price, original_price, is_highlight, is_active, short_description')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (productId) {
        query = query.eq('product_id', productId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((pl: any) => ({
        id: pl.id,
        name: pl.name,
        duration: pl.duration || '',
        price: Number(pl.price || 0),
        originalPrice: pl.original_price != null ? Number(pl.original_price) : null,
        isHighlight: !!pl.is_highlight,
        shortDescription: pl.short_description || null,
      }));
    } catch {
      return [];
    }
  }

  async getCategories(): Promise<CategoryInfo[]> {
    try {
      const { data, error } = await this.client
        .from('categories')
        .select('id, name, slug, icon, sort_order')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        icon: c.icon || null,
        sortOrder: c.sort_order || 0,
      }));
    } catch {
      return [];
    }
  }

  async getOrderById(orderId: string): Promise<AgentOrderSummary | null> {
    try {
      const { data, error } = await (this.client as any)
        .from('orders')
        .select('id, user_id, product_name, plan_label, price, payment_code, status, created_at, expires_at, notes')
        .eq('id', orderId)
        .maybeSingle();

      if (error || !data) return null;
      return {
        id: data.id,
        userId: data.user_id,
        productName: data.product_name,
        planLabel: data.plan_label || undefined,
        price: Number(data.price || 0),
        status: data.status,
        paymentCode: data.payment_code || undefined,
        notes: data.notes || undefined,
        createdAt: data.created_at,
        warrantyExpiresAt: data.expires_at || undefined,
      };
    } catch {
      return null;
    }
  }

  async getOrdersForUser(userId: string, limit = 20): Promise<AgentOrderSummary[]> {
    try {
      const { data, error } = await (this.client as any)
        .from('orders')
        .select('id, user_id, product_name, plan_label, price, payment_code, status, created_at, expires_at, notes')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map((o: any) => ({
        id: o.id,
        userId: o.user_id,
        productName: o.product_name,
        planLabel: o.plan_label || undefined,
        price: Number(o.price || 0),
        status: o.status,
        paymentCode: o.payment_code || undefined,
        notes: o.notes || undefined,
        createdAt: o.created_at,
        warrantyExpiresAt: o.expires_at || undefined,
      }));
    } catch {
      return [];
    }
  }

  async getTicketsForUser(userId: string): Promise<any[]> {
    try {
      const { data, error } = await this.client
        .from('support_tickets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  }

  async getFaqs(activeOnly = true): Promise<FaqItem[]> {
    try {
      let query = (this.client as any)
        .from('faqs')
        .select('id, question, answer, category, tags, is_active, priority, view_count, helpful_count, not_helpful_count, created_at, updated_at')
        .order('sort_order', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((f: any) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        category: f.category || undefined,
        tags: Array.isArray(f.tags) ? f.tags : [],
        isActive: f.is_active !== false,
        priority: f.priority || undefined,
        viewCount: f.view_count || 0,
        helpfulCount: f.helpful_count || 0,
        notHelpfulCount: f.not_helpful_count || 0,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      }));
    } catch {
      return [];
    }
  }

  async getNegativePolicies(activeOnly = true): Promise<NegativePolicyItem[]> {
    const policies = await fetchNegativePolicies({
      status: activeOnly ? 'ACTIVE' : 'ALL',
    });
    return policies.map((p) => ({
      id: p.id,
      title: p.policyKey,
      reason: p.reason,
      scope: (p.scopeType as any) || 'GLOBAL',
      triggerKeywords: [p.scopeValue, p.questionPattern],
      suggestedAction: undefined,
      responseTemplate: p.answer,
      isActive: p.status === 'ACTIVE',
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  async recordAgentEvent(event: AgentAnalyticsEventInput): Promise<void> {
    try {
      const sanitizedMetadata = sanitizeMetadata(event.metadata);
      const isValidUuid = (id?: string | null) =>
        typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      const payload = {
        event_type: event.eventType,
        user_id: isValidUuid(event.userId) ? event.userId : null,
        session_id: event.sessionId || null,
        intent: event.intent || null,
        product_id: isValidUuid((event as any).productId) ? (event as any).productId : null,
        plan_id: isValidUuid((event as any).planId) ? (event as any).planId : null,
        action_id: (event as any).actionId || null,
        action_type: (event as any).actionType || null,
        reason: event.reason || null,
        metadata: {
          ...(sanitizedMetadata || {}),
          ...(event.query ? { query: event.query } : {}),
          ...(event.route ? { route: event.route } : {}),
          ...(event.latencyMs ? { latencyMs: event.latencyMs } : {}),
        },
      };

      await (this.client as any).from('agent_analytics_events').insert([payload]);
    } catch {
      // Telemetry errors must never disrupt host operation
    }
  }

  async searchProducts(params: {
    keyword?: string;
    type?: string;
    categoryId?: string;
    productId?: string;
    limit?: number;
  }): Promise<ProductItemResult[]> {
    try {
      let query = (this.client as any)
        .from('products')
        .select(`
          id, name, slug, type, category_id, short_description, description, logo_url, badge, base_price, is_active, sort_order, search_aliases,
          categories (id, name, slug, icon),
          product_plans (id, name, duration, price, original_price, is_highlight, is_active, sort_order, short_description),
          product_features (feature, sort_order)
        `)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (params.productId) {
        query = query.eq('id', params.productId);
      }
      if (params.categoryId) {
        query = query.eq('category_id', params.categoryId);
      }
      if (params.type) {
        query = query.eq('type', params.type as any);
      }
      if (params.keyword && params.keyword.trim().length > 0) {
        const kw = params.keyword.trim();
        query = query.or(`name.ilike.%${kw}%,slug.ilike.%${kw}%,short_description.ilike.%${kw}%`);
      }

      const { data, error } = await query.limit(params.limit || 50);
      if (error) throw error;

      return (data || []).map((p: any) => {
        const activePlans = (p.product_plans || [])
          .filter((pl: any) => pl.is_active !== false)
          .sort((a: any, b: any) => a.sort_order - b.sort_order || a.price - b.price);

        const minPrice = activePlans.length > 0 ? activePlans[0].price : Number(p.base_price || 0);
        const features = (p.product_features || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((f: any) => f.feature);

        const catName =
          p.categories?.name ||
          (p.type === 'ai-tool'
            ? 'Công cụ AI'
            : p.type === 'premium-app'
            ? 'Ứng dụng Bản quyền'
            : 'Sản phẩm khác');

        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          type: p.type || 'product',
          categoryId: p.category_id || null,
          categoryName: catName,
          badge: p.badge || null,
          tagline: p.short_description || null,
          description: p.description || p.short_description || null,
          logoUrl: p.logo_url || null,
          startingPrice: minPrice,
          plans: activePlans.map((pl: any) => ({
            id: pl.id,
            name: pl.name,
            duration: pl.duration || '',
            price: Number(pl.price || 0),
            originalPrice: pl.original_price != null ? Number(pl.original_price) : null,
            isHighlight: !!pl.is_highlight,
            shortDescription: pl.short_description || null,
          })),
          features: features.length > 0 ? features : undefined,
          warranty: 'Bảo hành 1 đổi 1 trọn thời gian sử dụng',
          searchAliases: Array.isArray(p.search_aliases) ? p.search_aliases : [],
        };
      });
    } catch {
      return [];
    }
  }

  async getMyOrders(
    params: { paymentCode?: string; status?: string; productName?: string; limit?: number },
    userId: string
  ): Promise<any[]> {
    try {
      let query = (this.client as any)
        .from('orders')
        .select(
          'id, product_name, plan_label, price, payment_code, status, created_at, expires_at, notes, account_details'
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(params.limit || 12);

      if (params.paymentCode) {
        query = query.ilike('payment_code', `%${params.paymentCode.trim()}%`);
      }
      if (params.status) {
        query = query.eq('status', params.status as any);
      }
      if (params.productName) {
        query = query.ilike('product_name', `%${params.productName.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  }

  async searchPromptsLibrary(params?: { query?: string; category?: string }): Promise<any[]> {
    try {
      let query = (this.client as any)
        .from('ai_prompts')
        .select('id, title, category, prompt_content, image_url, description, tags, copy_count')
        .order('created_at', { ascending: false })
        .limit(6);

      if (params?.query && params.query.trim().length > 0) {
        query = query.or(
          `title.ilike.%${params.query.trim()}%,description.ilike.%${params.query.trim()}%,prompt_content.ilike.%${params.query.trim()}%`
        );
      }
      if (params?.category) {
        query = query.eq('category', params.category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  }

  async getActiveCoupons(): Promise<any[]> {
    try {
      const { data, error } = await (this.client as any)
        .from('coupons')
        .select(
          'code, name, description, discount_type, discount_value, minimum_order_amount, maximum_discount_amount, is_active, expires_at'
        )
        .eq('is_active', true)
        .limit(6);

      if (error) throw error;
      const now = new Date();
      return (data || []).filter((c: any) => {
        if (!c.expires_at) return true;
        return new Date(c.expires_at) > now;
      });
    } catch {
      return [];
    }
  }

  async getSupportChannels(): Promise<any> {
    try {
      const { data } = await (this.client as any)
        .from('contact_settings')
        .select('facebook_url, zalo_url, support_phone, support_email')
        .limit(1)
        .maybeSingle();

      const hotline = data?.support_phone || '0966 821 315';
      const zalo = data?.zalo_url || 'https://zalo.me/0966821315';
      const fb = data?.facebook_url || 'https://www.facebook.com/Bobowcon';

      return {
        brand: 'Shop of BOW',
        hotline,
        zalo,
        facebook: fb,
        hours: 'Hỗ trợ 24/7 (Phản hồi nhanh nhất: 8h00 - 23h30 hàng ngày)',
      };
    } catch {
      return {
        brand: 'Shop of BOW',
        hotline: '0966 821 315',
        zalo: 'https://zalo.me/0966821315',
        facebook: 'https://www.facebook.com/Bobowcon',
        hours: 'Hỗ trợ 24/7 (Phản hồi nhanh nhất: 8h00 - 23h30 hàng ngày)',
      };
    }
  }

  async updateFaq(id: string, patch: any): Promise<boolean> {
    try {
      const { error } = await (this.client as any).from('faqs').update(patch).eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  async insertFaq(faq: any): Promise<any> {
    try {
      const { data, error } = await (this.client as any)
        .from('faqs')
        .insert([faq])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch {
      return null;
    }
  }

  async deleteFaq(id: string): Promise<boolean> {
    try {
      const { error } = await (this.client as any).from('faqs').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  async insertAnalyticsEvents(events: any[]): Promise<void> {
    try {
      await (this.client as any).from('agent_analytics_events').insert(events);
    } catch {
      // Telemetry errors must never disrupt host operation
    }
  }

  async getAgentEvents(since?: string, limit = 100, eventTypes?: string[]): Promise<any[]> {
    try {
      let query = (this.client as any)
        .from('agent_analytics_events')
        .select('*');

      if (eventTypes && eventTypes.length > 0) {
        query = query.in('event_type', eventTypes);
      }
      if (since) {
        query = query.gte('created_at', since);
      }
      query = query.order('created_at', { ascending: true });

      const { data, error } = await query.limit(limit);
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  }
}

// ============================================================================
// 8. FACTORY & SINGLETON COMPOSITE SHOP ADAPTER
// ============================================================================

export function createShopAdapter(customClient = supabase): ShopAdapter {
  const catalog = new ShopCatalogProvider(customClient);
  const orders = new ShopOrderProvider(customClient);
  const wallet = new ShopWalletProvider(customClient);
  const knowledge = new ShopKnowledgeProvider(customClient);
  const analytics = new ShopAnalyticsProvider(customClient);
  const actions = new ShopActionHandler();
  const storage = new ShopStorageAdapter(customClient);

  return {
    catalog,
    orders,
    wallet,
    knowledge,
    analytics,
    actions,
    storage,
  };
}

/**
 * Singleton ShopAdapter instance for standard host usage
 */
export const shopAdapter: ShopAdapter = createShopAdapter();

let activeShopAdapter: ShopAdapter = shopAdapter;

/**
 * Get active ShopAdapter (defaults to standard shopAdapter)
 */
export function getActiveShopAdapter(): ShopAdapter {
  return activeShopAdapter;
}

/**
 * Set active ShopAdapter (useful for mock dependency injection in tests)
 */
export function setActiveShopAdapter(adapter: ShopAdapter): void {
  activeShopAdapter = adapter;
}
