import type { SessionContext, ProductItemResult, PlanItemResult } from './types';

const CONTEXT_TTL_MS = 45 * 60 * 1000; // 45 phút

let currentSessionContext: SessionContext = {
  updatedAt: Date.now(),
  productSlug: undefined,
  planContext: null,
};

if (typeof window !== 'undefined') {
  (window as any).__sessionContext = currentSessionContext;
  (window as any).sessionContext = currentSessionContext;
}

/**
 * Lấy ngữ cảnh phiên chat hiện tại (tự động xóa nếu đã hết hạn TTL)
 */
export function getSessionContext(): SessionContext {
  const now = Date.now();
  if (now - currentSessionContext.updatedAt > CONTEXT_TTL_MS) {
    clearSessionContext();
  }
  return currentSessionContext;
}

/**
 * Cập nhật ngữ cảnh phiên chat
 */
export function updateSessionContext(partial: Partial<SessionContext>): SessionContext {
  const now = Date.now();
  currentSessionContext = {
    ...currentSessionContext,
    ...partial,
    updatedAt: now,
  };

  // Đồng bộ productSlug khi có lastMentionedProduct
  if (partial.lastMentionedProduct && !partial.productSlug) {
    currentSessionContext.productSlug = partial.lastMentionedProduct.slug;
  }

  // Đồng bộ planContext và lastMentionedPlan
  if (partial.lastMentionedPlan !== undefined && partial.planContext === undefined) {
    currentSessionContext.planContext = partial.lastMentionedPlan || null;
  } else if (partial.planContext !== undefined && partial.lastMentionedPlan === undefined) {
    currentSessionContext.lastMentionedPlan = partial.planContext || undefined;
  }

  if (typeof window !== 'undefined') {
    (window as any).__sessionContext = currentSessionContext;
    (window as any).sessionContext = currentSessionContext;
  }

  return currentSessionContext;
}

/**
 * Ghi nhận sản phẩm & gói plan vừa được thảo luận
 * FIX 3.1 & 3.5: Khi chuyển sang sản phẩm mới (Topic Switch),
 * BẮT BUỘC reset planContext = null và lastMentionedPlan = undefined
 */
export function rememberProductContext(product: ProductItemResult, plan?: PlanItemResult) {
  const previousProduct = currentSessionContext.lastMentionedProduct;
  const isNewProduct =
    !previousProduct ||
    previousProduct.id !== product.id ||
    (currentSessionContext.productSlug !== undefined && currentSessionContext.productSlug !== product.slug) ||
    previousProduct.slug !== product.slug;

  const isNotInCurrentGroup =
    currentSessionContext.lastRecommendedCandidates &&
    !currentSessionContext.lastRecommendedCandidates.some((c) => c.id === product.id);

  // Khi chuyển sang sản phẩm mới, không bao giờ kế thừa plan của sản phẩm trước
  const nextPlan = isNewProduct
    ? (plan || null)
    : (plan !== undefined ? plan : (currentSessionContext.planContext || null));

  updateSessionContext({
    lastMentionedProduct: product,
    productSlug: product.slug,
    lastMentionedPlan: nextPlan ? nextPlan : undefined,
    planContext: nextPlan,
    // Nếu chuyển sang một sản phẩm độc lập mới không thuộc nhóm đang đề xuất, xóa nhóm cũ
    lastRecommendedCandidates: isNotInCurrentGroup ? undefined : currentSessionContext.lastRecommendedCandidates,
  });
}

/**
 * V3.2: Ghi nhận nhóm sản phẩm vừa được gợi ý (Multi-Product Recommendation Group)
 */
export function rememberRecommendedCandidates(candidates: ProductItemResult[]) {
  if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
    updateSessionContext({ lastRecommendedCandidates: undefined });
    return;
  }

  // Deduplicate theo ID và giới hạn tối đa 6 candidates
  const seenIds = new Set<string>();
  const validCandidates: ProductItemResult[] = [];

  for (const c of candidates) {
    if (c && c.id && c.name && !seenIds.has(c.id)) {
      seenIds.add(c.id);
      validCandidates.push(c);
      if (validCandidates.length >= 6) break;
    }
  }

  const nextProduct = validCandidates[0];
  const isNewProduct =
    !!nextProduct &&
    (!currentSessionContext.lastMentionedProduct ||
      currentSessionContext.lastMentionedProduct.id !== nextProduct.id ||
      currentSessionContext.productSlug !== nextProduct.slug);

  updateSessionContext({
    lastRecommendedCandidates: validCandidates.length > 0 ? validCandidates : undefined,
    // Đặt candidate đầu tiên làm lastMentionedProduct mặc định nếu chưa có
    lastMentionedProduct: nextProduct || currentSessionContext.lastMentionedProduct,
    productSlug: nextProduct?.slug || currentSessionContext.productSlug,
    lastMentionedPlan: isNewProduct ? undefined : currentSessionContext.lastMentionedPlan,
    planContext: isNewProduct ? null : (currentSessionContext.planContext || null),
  });
}

/**
 * Reset planContext về null (dành cho topic switch hoặc explicit clear)
 */
export function resetPlanContext(): void {
  updateSessionContext({
    lastMentionedPlan: undefined,
    planContext: null,
  });
}

/**
 * Ghi nhận đơn hàng vừa được thảo luận
 */
export function rememberOrderContext(order: any) {
  updateSessionContext({
    lastMentionedOrder: order,
  });
}

/**
 * Ghi nhận danh mục vừa được thảo luận
 */
export function rememberCategoryContext(category: { id: string; name: string; slug: string }) {
  updateSessionContext({
    lastMentionedCategory: category,
  });
}

/**
 * Ghi nhận hoặc xóa ngữ cảnh bị trì hoãn (Deferred Context)
 */
export function rememberDeferredContext(deferred: import('./types').DeferredContext) {
  updateSessionContext({
    deferredContext: deferred,
  });
}

export function clearDeferredContext() {
  updateSessionContext({
    deferredContext: undefined,
  });
}

/**
 * Xóa sạch ngữ cảnh (khi làm mới cuộc trò chuyện)
 */
export function clearSessionContext() {
  currentSessionContext = {
    updatedAt: Date.now(),
    productSlug: undefined,
    planContext: null,
    lastMentionedProduct: undefined,
    lastMentionedPlan: undefined,
    lastRecommendedCandidates: undefined,
  };
  if (typeof window !== 'undefined') {
    (window as any).__sessionContext = currentSessionContext;
    (window as any).sessionContext = currentSessionContext;
  }
}
