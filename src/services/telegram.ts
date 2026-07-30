// src/services/telegram.ts
// Gọi Netlify serverless function — KHÔNG expose token ra browser

export interface TelegramOrderPayload {
  payment_code: string;
  customer_name: string;
  customer_email: string;
  product_name: string;
  plan_label: string;
  price: number;
  payment_method: 'wallet' | 'vietqr';
  notes?: string;
  created_at?: string;
}

/**
 * Gửi thông báo Telegram khi có đơn hàng mới.
 * Token hoàn toàn ẩn — chạy qua Netlify Function (server-side).
 */
export async function notifyTelegramNewOrder(order: TelegramOrderPayload): Promise<void> {
  try {
    await fetch('/.netlify/functions/telegram-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'new_order', order }),
    });
  } catch (err) {
    // Non-blocking — không được làm hỏng luồng mua hàng nếu Telegram fail
    console.warn('[telegram] Failed to notify:', err);
  }
}

export async function notifyTelegramOrderCancelled(order: Pick<TelegramOrderPayload, 'payment_code' | 'product_name' | 'customer_name'>): Promise<void> {
  try {
    await fetch('/.netlify/functions/telegram-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'order_cancelled', order }),
    });
  } catch (err) {
    console.warn('[telegram] Failed to notify cancel:', err);
  }
}
