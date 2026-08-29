import type { SessionContext, ProductItemResult, PlanItemResult } from './types';

const CONTEXT_TTL_MS = 45 * 60 * 1000; // 45 phút

let currentSessionContext: SessionContext = {
  updatedAt: Date.now(),
};

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
  return currentSessionContext;
}

/**
 * Ghi nhận sản phẩm & gói plan vừa được thảo luận
 */
export function rememberProductContext(product: ProductItemResult, plan?: PlanItemResult) {
  const isNewProduct = currentSessionContext.lastMentionedProduct?.id !== product.id;
  updateSessionContext({
    lastMentionedProduct: product,
    lastMentionedPlan: isNewProduct
      ? (plan || (product.plans.length === 1 ? product.plans[0] : undefined))
      : (plan || currentSessionContext.lastMentionedPlan),
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
 * Xóa sạch ngữ cảnh (khi làm mới cuộc trò chuyện)
 */
export function clearSessionContext() {
  currentSessionContext = {
    updatedAt: Date.now(),
  };
}
