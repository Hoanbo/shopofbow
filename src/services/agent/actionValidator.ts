// src/services/agent/actionValidator.ts — Kiểm tra tính toàn vẹn và bảo mật của Action trước khi render
import type { AgentAction, AgentContext } from './types';

/**
 * Sinh ID duy nhất cho mỗi Action (VD: act_9f82c1) để tracking và chống duplicate click
 */
export function generateActionId(): string {
  return 'act_' + Math.random().toString(36).substring(2, 8);
}

/**
 * Kiểm tra tính hợp lệ và quyền sở hữu trước khi phát hành Action
 */
export function validateAndFinalizeAction(
  action: Omit<AgentAction, 'id'>,
  context: AgentContext
): AgentAction | null {
  // 1. Kiểm tra quyền bảo mật: Các action liên quan đến Order hoặc Ticket bắt buộc phải đăng nhập
  if (
    (action.type === 'NAVIGATE_ORDER_DETAIL' ||
      action.type === 'NAVIGATE_RENEWAL' ||
      action.type === 'NAVIGATE_SUPPORT') &&
    !context.isAuthenticated
  ) {
    console.warn('[ActionValidator] Bị từ chối: Yêu cầu đăng nhập để thao tác đơn hàng');
    return null;
  }

  // 2. Kiểm tra Checkout Action: Bắt buộc phải có productId
  if (action.type === 'NAVIGATE_CHECKOUT' && !action.payload.productId && !action.payload.productSlug) {
    console.warn('[ActionValidator] Bị từ chối: Thiếu productId trong NAVIGATE_CHECKOUT');
    return null;
  }

  // 3. Gán Action ID an toàn và TTL
  const now = Date.now();
  return {
    ...action,
    id: generateActionId(),
    createdAt: now,
    expiresAt: now + 10 * 60 * 1000, // Hết hạn sau 10 phút
  };
}

/**
 * Aliases for backward compatibility and QA test harness adapters
 */
export const validateAgentAction = validateAndFinalizeAction;
export const validateAction = validateAndFinalizeAction;

