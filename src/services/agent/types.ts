// src/services/agent/types.ts — Trung tâm toàn bộ Type Definitions cho BOW Agent V2

export type AgentRole = 'admin' | 'ctv' | 'user' | 'guest';

export interface AgentContext {
  userId?: string | null;
  email?: string | null;
  fullName?: string | null;
  role: AgentRole;
  balance?: number;
  isAuthenticated: boolean;
}

export type AgentIntent =
  | 'CATALOG'             // Xem tổng quan danh mục sản phẩm
  | 'VIEW_CATEGORY'       // Xem chi tiết một danh mục cụ thể
  | 'PRODUCT_SEARCH'      // Tìm kiếm, hỏi giá hoặc chi tiết sản phẩm
  | 'BUY'                 // Ý định mua hàng cụ thể (VD: "Mua CapCut 1 tháng", "Lấy gói này")
  | 'ORDER_QUERY'         // Tra cứu lịch sử đơn hàng
  | 'RENEW'               // Gia hạn đơn hàng cũ
  | 'WARRANTY'            // Yêu cầu hỗ trợ lỗi / bảo hành
  | 'COUPON'              // Tra cứu / áp dụng mã giảm giá
  | 'WALLET'              // Tra cứu số dư / nạp tiền vào ví
  | 'FAQ'                 // Câu hỏi thường gặp / hướng dẫn sử dụng
  | 'GENERAL';            // Chào hỏi, liên hệ hỗ trợ viên

export type AgentActionType =
  | 'NAVIGATE_CHECKOUT'       // Mở CheckoutModal với đúng productId & planId
  | 'NAVIGATE_ORDER_DETAIL'   // Mở UserOrderDetailModal đúng orderId của user
  | 'NAVIGATE_RENEWAL'        // Mở popup gia hạn đơn cũ kèm ưu đãi -10%
  | 'NAVIGATE_SUPPORT'        // Mở CreateTicketModal với tiêu đề lỗi & orderId điền sẵn
  | 'APPLY_COUPON'            // Kích hoạt couponCode vào Session Context của Checkout
  | 'OPEN_DEPOSIT';           // Mở popup VietQR nạp tiền vào ví

export interface AgentActionPayload {
  productId?: string;
  productSlug?: string;
  productName?: string;
  planId?: string;
  planLabel?: string;
  displayPrice?: number;    // CHỈ để render UI, không dùng cho backend calculation
  orderId?: string;
  paymentCode?: string;
  couponCode?: string;
  amount?: number;
  issueDescription?: string;
}

export interface AgentAction {
  id: string;                 // actionId (VD: "act_8f29c2") để tracking & chống duplicate click
  type: AgentActionType;
  label: string;              // Text nút bấm (VD: "💳 Mua ngay", "🔄 Gia hạn", "🎫 Gửi yêu cầu")
  icon?: string;
  payload: AgentActionPayload;
  requiresConfirmation?: boolean;
  createdAt?: number;
  expiresAt?: number;
}

export interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  sortOrder?: number;
}

export interface CategoryResolution {
  matched: boolean;
  category?: CategoryInfo;
}

export interface PlanItemResult {
  id: string;
  name: string;
  duration: string;
  price: number;
  originalPrice?: number | null;
  isHighlight: boolean;
  shortDescription?: string | null;
}

export interface ProductItemResult {
  id: string;
  name: string;
  slug: string;
  type: 'ai-tool' | 'premium-app' | 'product';
  categoryId?: string | null;
  categoryName?: string | null;
  badge?: string | null;
  tagline?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  startingPrice: number;
  plans: PlanItemResult[];
  features?: string[];
  warranty: string;
  searchAliases?: string[];
}

export interface SessionContext {
  lastMentionedProduct?: ProductItemResult;
  lastMentionedPlan?: PlanItemResult;
  lastMentionedOrder?: any;
  lastMentionedCategory?: CategoryInfo;
  lastActiveAction?: AgentAction;
  updatedAt: number;
}

export interface AgentMessage {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  timestamp: string;
  data?: any;
  suggestions?: string[];
  action?: AgentAction; // Action Card đi kèm tin nhắn bot
  actions?: AgentAction[]; // Hỗ trợ nhiều thẻ Hành Động
}
