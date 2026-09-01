// src/services/agent/actionPlanner.ts — Bộ lập kế hoạch đề xuất hành động (Action Planner V2)
import type {
  AgentAction,
  AgentContext,
  ProductItemResult,
  PlanItemResult,
} from './types';
import { validateAndFinalizeAction } from './actionValidator';

/**
 * Lập kế hoạch mở CheckoutModal mua nhanh 1 sản phẩm & plan cụ thể
 */
export function planCheckoutAction(
  product: ProductItemResult,
  plan: PlanItemResult | undefined,
  context: AgentContext
): AgentAction | null {
  const selectedPlan = plan; // NO FALLBACK per global rule

  if (!selectedPlan) return null;

  return validateAndFinalizeAction(
    {
      type: 'NAVIGATE_CHECKOUT',
      label: 'Mua ngay',
      icon: '💳',
      payload: {
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        planId: selectedPlan?.id,
        planLabel: selectedPlan?.name,
        displayPrice: selectedPlan?.price || product.startingPrice,
      },
      requiresConfirmation: false,
    },
    context
  );
}

/**
 * Lập kế hoạch sinh ra nhiều Checkout Action Cards cho từng gói
 */
export function planMultipleCheckoutActions(
  product: ProductItemResult,
  plans: PlanItemResult[],
  context: AgentContext
): AgentAction[] {
  const actions: AgentAction[] = [];
  for (const p of plans) {
    const act = planCheckoutAction(product, p, context);
    if (act) actions.push(act);
  }
  return actions;
}

/**
 * Lập kế hoạch mở Modal xem chi tiết đơn hàng
 */
export function planOrderDetailAction(
  order: any,
  context: AgentContext
): AgentAction | null {
  return validateAndFinalizeAction(
    {
      type: 'NAVIGATE_ORDER_DETAIL',
      label: 'Xem chi tiết đơn',
      icon: '👁️',
      payload: {
        orderId: order.id,
        paymentCode: order.payment_code,
        productName: order.product_name,
        planLabel: order.plan_label,
        displayPrice: Number(order.price || 0),
      },
      requiresConfirmation: false,
    },
    context
  );
}

/**
 * Lập kế hoạch mở Popup gia hạn đơn hàng cũ
 */
export function planRenewalAction(
  order: any,
  context: AgentContext
): AgentAction | null {
  return validateAndFinalizeAction(
    {
      type: 'NAVIGATE_RENEWAL',
      label: 'Gia hạn ngay',
      icon: '🔄',
      payload: {
        orderId: order.id,
        paymentCode: order.payment_code,
        productName: order.product_name,
        planLabel: order.plan_label,
        displayPrice: Number(order.price || 0),
      },
      requiresConfirmation: true,
    },
    context
  );
}

/**
 * Tập hợp các trạng thái đơn hàng đủ điều kiện áp dụng chính sách bảo hành
 */
export const WARRANTY_ELIGIBLE_STATUSES = new Set(['completed', 'processing', 'paid', 'pending_delivery']);

/**
 * Kiểm tra xem đơn hàng có đủ điều kiện bảo hành không (không cancelled, không refunded, không pending_payment)
 */
export function isOrderWarrantyEligible(order: any): boolean {
  if (!order || !order.status) return false;
  const s = String(order.status).toLowerCase().trim();
  return WARRANTY_ELIGIBLE_STATUSES.has(s);
}

/**
 * Lập kế hoạch mở Popup gửi yêu cầu hỗ trợ lỗi / bảo hành đơn hàng
 * Guard V3.3 Phase 4.3 & 4.7: Chỉ cho phép bảo hành đơn hàng hợp lệ (không cancelled, không refunded, không pending_payment)
 */
export function planSupportTicketAction(
  order: any,
  issueDescription: string,
  context: AgentContext
): AgentAction | null {
  if (!order || !isOrderWarrantyEligible(order)) {
    return null;
  }

  return validateAndFinalizeAction(
    {
      type: 'NAVIGATE_SUPPORT',
      label: 'Gửi yêu cầu bảo hành',
      icon: '🎫',
      payload: {
        orderId: order?.id,
        paymentCode: order?.payment_code,
        productName: order?.product_name || 'Dịch vụ BOW',
        issueDescription: issueDescription || 'Cần hỗ trợ bảo hành tài khoản',
      },
      requiresConfirmation: true,
    },
    context
  );
}

/**
 * Tìm đơn hàng phù hợp nhất để bảo hành từ danh sách đơn hàng của user
 * Hỗ trợ tra theo payment code (vd: BOW-12345), tên sản phẩm, hoặc đơn gần nhất.
 * V3.3 Phase 4.7: Luôn lọc trạng thái hợp lệ trước khi fallback, không để đơn hủy/chưa thanh toán chặn đơn hợp lệ.
 */
export function findRelevantWarrantyOrder(
  orders: any[],
  queryText: string,
  lastMentionedOrder?: any
): any | null {
  if (!orders || orders.length === 0) return null;

  // 1. Trích xuất mã đơn hàng nếu có (vd: BOW-123456, BOW-YT-CANCELLED)
  // Nếu user chỉ định đích danh mã đơn: trả về chính đơn đó để hệ thống kiểm tra và thông báo chính xác
  const paymentCodeMatch = queryText.match(/\b(BOW-[A-Z0-9_-]{4,25}|[A-Z0-9]{8,16})\b/i);
  const targetCode = paymentCodeMatch ? paymentCodeMatch[1].toUpperCase() : null;

  if (targetCode) {
    const found = orders.find((o) => o.payment_code?.toUpperCase() === targetCode);
    if (found) return found;
  }

  // Lọc danh sách các đơn hàng đủ điều kiện bảo hành (không cancelled, không refunded, không pending_payment)
  const eligibleOrders = orders.filter(isOrderWarrantyEligible);

  // 2. Tìm theo tên sản phẩm có trong câu nói (vd: "spotify", "netflix", "youtube")
  const cleanLow = queryText.toLowerCase();

  // Ưu tiên đơn đủ điều kiện bảo hành khớp tên sản phẩm
  const matchedProdInEligible = eligibleOrders.find((o) => {
    if (!o.product_name) return false;
    const pNameLow = o.product_name.toLowerCase();
    if (cleanLow.includes(pNameLow)) return true;
    const firstWord = pNameLow.split(/\s+/)[0];
    if (firstWord && firstWord.length >= 3 && cleanLow.includes(firstWord)) return true;
    return false;
  });
  if (matchedProdInEligible) return matchedProdInEligible;

  // Nếu user chỉ định đích danh tên sản phẩm nhưng tất cả đơn của sản phẩm đó đều không đủ điều kiện (vd: đã hủy)
  // thì trả về đơn đó để thông báo từ chối chính xác theo đúng tên sản phẩm, thay vì âm thầm đổi sang sản phẩm khác
  const matchedProdInAll = orders.find((o) => {
    if (!o.product_name) return false;
    const pNameLow = o.product_name.toLowerCase();
    if (cleanLow.includes(pNameLow)) return true;
    const firstWord = pNameLow.split(/\s+/)[0];
    if (firstWord && firstWord.length >= 3 && cleanLow.includes(firstWord)) return true;
    return false;
  });
  if (matchedProdInAll) return matchedProdInAll;

  // 3. Fallback khi hỏi chung chung (vd: "bảo hành"):
  // CHỈ fallback về đơn đủ điều kiện bảo hành (lastMentionedOrder nếu hợp lệ, hoặc eligibleOrders[0])
  if (lastMentionedOrder && isOrderWarrantyEligible(lastMentionedOrder)) {
    return lastMentionedOrder;
  }

  return eligibleOrders[0] || null;
}

/**
 * Lập kế hoạch kích hoạt mã giảm giá vào phiên thanh toán
 */
export function planApplyCouponAction(
  couponCode: string,
  discountLabel: string,
  context: AgentContext
): AgentAction | null {
  return validateAndFinalizeAction(
    {
      type: 'APPLY_COUPON',
      label: `Dùng mã ${couponCode} (${discountLabel})`,
      icon: '🎟️',
      payload: {
        couponCode: couponCode.trim().toUpperCase(),
      },
      requiresConfirmation: false,
    },
    context
  );
}

/**
 * Lập kế hoạch mở nạp tiền ví theo số tiền chỉ định hoặc mở popup nạp tiền
 */
export function planDepositAction(
  amount: number | undefined,
  context: AgentContext
): AgentAction | null {
  const label = amount && amount >= 10000
    ? `Nạp +${amount.toLocaleString('vi-VN')}đ vào ví`
    : 'Nạp tiền vào ví';

  return validateAndFinalizeAction(
    {
      type: 'OPEN_DEPOSIT',
      label,
      icon: '💳',
      payload: {
        amount: amount && amount >= 10000 ? amount : undefined,
      },
      requiresConfirmation: false,
    },
    context
  );
}

/**
 * Lập kế hoạch mở chi tiết Ticket trao đổi hỗ trợ
 */
export function planTicketDetailAction(
  ticket: any,
  context: AgentContext
): AgentAction | null {
  return validateAndFinalizeAction(
    {
      type: 'NAVIGATE_TICKET_DETAIL',
      label: 'Xem trao đổi Ticket',
      icon: '💬',
      payload: {
        ticketId: ticket.id,
        ticketTitle: ticket.title,
      },
      requiresConfirmation: false,
    },
    context
  );
}

/**
 * Lập kế hoạch mở Modal tạo Ticket hỗ trợ mới
 */
export function planCreateTicketAction(
  context: AgentContext
): AgentAction | null {
  return validateAndFinalizeAction(
    {
      type: 'NAVIGATE_SUPPORT',
      label: 'Tạo phiếu hỗ trợ mới',
      icon: '🎫',
      payload: {
        issueDescription: 'Yêu cầu hỗ trợ từ BOW Agent',
      },
      requiresConfirmation: false,
    },
    context
  );
}
