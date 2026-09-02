export type AgentRole = 'owner' | 'admin' | 'ctv' | 'user' | 'guest' | 'customer';

export type AgentSurface = 'customer' | 'admin' | 'desktop' | 'robot' | 'system';

export interface AgentContext {
  userId?: string | null;
  email?: string | null;
  fullName?: string | null;
  role: AgentRole;
  balance?: number;
  isAuthenticated: boolean;
  surface?: AgentSurface;
  route?: string;
}

export type AgentIntent =
  | 'GREETING'            // Chào hỏi tự nhiên (VD: "chào bạn", "hello", "xin chào")
  | 'SMALL_TALK'           // Hội thoại ngắn, cảm ơn, tạm biệt, xác nhận (VD: "cảm ơn", "ok", "tạm biệt")
  | 'CAPABILITY_DISCOVERY' // Khám phá năng lực của Agent (VD: "bạn có thể giúp gì?", "hôm nay có gì hay?")
  | 'CLARIFICATION'        // Yêu cầu làm rõ thông tin thiếu (VD: "mua gói 6 tháng" chưa rõ sản phẩm)
  | 'CATALOG'              // Xem tổng quan danh mục sản phẩm
  | 'VIEW_CATEGORY'        // Xem chi tiết một danh mục cụ thể
  | 'PRODUCT_SEARCH'       // Tìm kiếm, hỏi giá hoặc chi tiết sản phẩm
  | 'BUY'                  // Ý định mua hàng cụ thể (VD: "Mua CapCut 1 tháng", "Lấy gói này")
  | 'EXPIRING_SOON'        // Tra cứu sản phẩm/gói của user sắp hết hạn
  | 'ORDER_QUERY'          // Tra cứu lịch sử đơn hàng
  | 'RENEW'                // Gia hạn đơn hàng cũ
  | 'WARRANTY'             // Yêu cầu hỗ trợ lỗi / bảo hành
  | 'TICKET'               // Tra cứu hoặc tạo ticket hỗ trợ
  | 'COUPON'               // Tra cứu / áp dụng mã giảm giá
  | 'WALLET'               // Tra cứu số dư / nạp tiền vào ví
  | 'FAQ'                  // Câu hỏi thường gặp / hướng dẫn sử dụng
  | 'ADMIN_PENDING_HANDOVER'    // Hàng đợi đơn chờ bàn giao (Admin Copilot)
  | 'ADMIN_ORDER_HANDOVER'      // Bàn giao tài khoản / gửi key cho khách (Admin Copilot)
  | 'ADMIN_ORDER_LOOKUP'        // Tra cứu trạng thái và chi tiết đơn hàng (Admin Copilot)
  | 'ADMIN_DAILY_SUMMARY'       // Báo cáo tổng hợp vận hành hôm nay (Admin Copilot)
  | 'ADMIN_TASK_PRIORITIZATION' // Đề xuất thứ tự ưu tiên xử lý trong ngày (Admin Copilot)
  | 'ADMIN_REVENUE_REPORT'      // Báo cáo doanh thu & lợi nhuận ròng (Admin Copilot)
  | 'ADMIN_SALES_ANALYTICS'     // Phân tích sản phẩm bán chạy / doanh số (Admin Copilot)
  | 'ADMIN_VOUCHER_CREATE'      // Tạo / quản lý mã khuyến mãi (Admin Copilot)
  | 'ADMIN_CUSTOMER_LOOKUP'     // Tra cứu thông tin lịch sử khách hàng (Admin Copilot)
  | 'ADMIN_DISPUTE_INSPECT'     // Tra cứu xử lý khiếu nại đơn hàng (Admin Copilot)
  | 'ADMIN_INVENTORY_HEALTH'    // [DEFERRED] Kiểm tra sức khỏe tồn kho SKU (Admin Copilot)
  | 'GENERAL';             // Liên hệ hỗ trợ viên, admin

export type AgentActionType =
  | 'NAVIGATE_CHECKOUT'       // Mở CheckoutModal với đúng productId & planId
  | 'NAVIGATE_ORDER_DETAIL'   // Mở UserOrderDetailModal đúng orderId của user
  | 'NAVIGATE_RENEWAL'        // Mở popup xác nhận gia hạn đơn hàng cũ
  | 'NAVIGATE_SUPPORT'        // Mở CreateTicketModal với tiêu đề lỗi & orderId điền sẵn
  | 'NAVIGATE_TICKET_DETAIL'  // Mở UserTicketChatModal xem trao đổi ticket
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
  ticketId?: string;
  ticketTitle?: string;
  supportTitle?: string;
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

export interface DeferredContext {
  intent: AgentIntent;
  productName?: string;
  duration?: string;
  rawQuery?: string;
}

export interface MultiIntentResult {
  primaryIntent: AgentIntent;
  secondaryIntents: AgentIntent[];
  deferredContext?: DeferredContext;
}

export interface SessionContext {
  lastMentionedProduct?: ProductItemResult;
  lastMentionedPlan?: PlanItemResult;
  productSlug?: string;
  planContext?: PlanItemResult | null;
  lastRecommendedCandidates?: ProductItemResult[]; // V3.2: Nhóm sản phẩm vừa được đề xuất đa lựa chọn
  lastMentionedOrder?: any;
  lastMentionedCategory?: CategoryInfo;
  lastActiveAction?: AgentAction;
  deferredContext?: DeferredContext;
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

