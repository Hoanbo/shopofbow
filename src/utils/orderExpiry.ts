import { supabase } from '../lib/supabase';

export interface OrderBasicInfo {
  id: string;
  status: string;
  created_at: string;
}

/** Thời gian tối đa để thanh toán đơn hàng (15 phút) */
export const PAYMENT_EXPIRY_MS = 15 * 60 * 1000;

/**
 * Kiểm tra xem 1 đơn hàng pending_payment đã hết hạn 15 phút chưa
 */
export function isOrderPaymentExpired(order: { status?: string | null; created_at?: string | null }): boolean {
  if (!order || !order.created_at) return false;
  const status = order.status || '';
  if (status !== 'pending_payment' && status !== 'pending') return false;

  const createdAtMs = new Date(order.created_at).getTime();
  if (Number.isNaN(createdAtMs)) return false;

  return Date.now() - createdAtMs > PAYMENT_EXPIRY_MS;
}

/**
 * Lấy trạng thái thực tế của đơn hàng (nếu đang pending_payment quá 15p thì coi như 'cancelled')
 */
export function getEffectiveOrderStatus(order: { status?: string | null; created_at?: string | null }): string {
  if (isOrderPaymentExpired(order)) {
    return 'cancelled';
  }
  return order?.status || 'pending_payment';
}

/**
 * Tự động đồng bộ các đơn hàng pending_payment quá 15 phút thành 'cancelled' trong cơ sở dữ liệu Supabase
 */
export async function syncExpiredPendingOrders<T extends OrderBasicInfo>(
  orders: T[]
): Promise<{ expiredIds: string[]; updatedOrders: T[] }> {
  if (!orders || orders.length === 0) {
    return { expiredIds: [], updatedOrders: orders };
  }

  const expiredIds: string[] = [];
  const updatedOrders = orders.map((o) => {
    if (isOrderPaymentExpired(o)) {
      expiredIds.push(o.id);
      return { ...o, status: 'cancelled' };
    }
    return o;
  });

  if (expiredIds.length > 0) {
    try {
      const { error } = await (supabase.from('orders') as any)
        .update({ status: 'cancelled' })
        .in('id', expiredIds)
        .in('status', ['pending_payment', 'pending']);

      if (error) {
        console.warn('[syncExpiredPendingOrders] DB Update warning:', error.message);
      }
    } catch (err) {
      console.warn('[syncExpiredPendingOrders] Exception:', err);
    }
  }

  return { expiredIds, updatedOrders };
}
