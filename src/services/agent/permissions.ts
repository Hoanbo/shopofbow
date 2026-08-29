// src/services/agent/permissions.ts — Bảng phân quyền gọi Tool của BOW Agent
import type { AgentContext, AgentRole } from './types';

export type { AgentContext, AgentRole };
export type UserRole = AgentRole;

export type AgentToolName =
  | 'searchProducts'
  | 'getMyOrders'
  | 'checkWarrantyPolicy'
  | 'searchPromptsLibrary'
  | 'getActiveCoupons'
  | 'getMyWalletBalance'
  | 'getFaqsAndGuides'
  | 'getSupportChannels';

/**
 * Bảng phân quyền cho từng Tool của BOW Agent
 */
const TOOL_PERMISSIONS: Record<AgentToolName, { requiresAuth: boolean; description: string }> = {
  searchProducts: { requiresAuth: false, description: 'Tra cứu danh mục sản phẩm và bảng giá' },
  getMyOrders: { requiresAuth: true, description: 'Tra cứu lịch sử đơn hàng của chính bạn' },
  checkWarrantyPolicy: { requiresAuth: false, description: 'Tra cứu chính sách bảo hành' },
  searchPromptsLibrary: { requiresAuth: false, description: 'Tìm kiếm prompt trong thư viện Prompt AI' },
  getActiveCoupons: { requiresAuth: false, description: 'Lấy danh sách mã giảm giá đang kích hoạt' },
  getMyWalletBalance: { requiresAuth: true, description: 'Xem số dư ví của tài khoản' },
  getFaqsAndGuides: { requiresAuth: false, description: 'Câu hỏi thường gặp và hướng dẫn kích hoạt' },
  getSupportChannels: { requiresAuth: false, description: 'Kênh liên hệ hỗ trợ trực tiếp' },
};

/**
 * Kiểm tra xem người dùng hiện tại có đủ quyền gọi tool không
 */
export function checkToolPermission(
  toolName: AgentToolName,
  context: AgentContext
): { allowed: boolean; reason?: string } {
  const toolRule = TOOL_PERMISSIONS[toolName];
  if (!toolRule) {
    return { allowed: false, reason: 'Công cụ không tồn tại.' };
  }

  if (toolRule.requiresAuth && !context.isAuthenticated) {
    return {
      allowed: false,
      reason: `Bạn vui lòng đăng nhập để sử dụng tính năng "${toolRule.description}" nhé! 🔒`,
    };
  }

  return { allowed: true };
}
