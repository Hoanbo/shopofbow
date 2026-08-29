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
      label: `💳 Mua ngay ${selectedPlan?.name ? `(${selectedPlan.name})` : ''}`,
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
      label: '👁️ Xem chi tiết đơn',
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
 * Lập kế hoạch mở Popup gia hạn đơn hàng cũ kèm ưu đãi giảm 10%
 */
export function planRenewalAction(
  order: any,
  context: AgentContext
): AgentAction | null {
  return validateAndFinalizeAction(
    {
      type: 'NAVIGATE_RENEWAL',
      label: '🔄 Gia hạn ngay (-10%)',
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
 * Lập kế hoạch mở Popup gửi yêu cầu hỗ trợ lỗi / bảo hành đơn hàng
 */
export function planSupportTicketAction(
  order: any,
  issueDescription: string,
  context: AgentContext
): AgentAction | null {
  return validateAndFinalizeAction(
    {
      type: 'NAVIGATE_SUPPORT',
      label: '🎫 Gửi yêu cầu bảo hành',
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
      label: `🎟️ Dùng mã ${couponCode} (${discountLabel})`,
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
 * Lập kế hoạch mở nạp tiền ví theo số tiền chỉ định
 */
export function planDepositAction(
  amount: number,
  context: AgentContext
): AgentAction | null {
  return validateAndFinalizeAction(
    {
      type: 'OPEN_DEPOSIT',
      label: `💰 Nạp +${amount.toLocaleString('vi-VN')}đ vào ví`,
      icon: '💰',
      payload: {
        amount,
      },
      requiresConfirmation: false,
    },
    context
  );
}
