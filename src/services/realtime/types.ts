/**
 * BOW Realtime Hub — Typed Event Map
 * 
 * Mọi sự kiện Realtime trong toàn bộ ứng dụng đều đi qua bản đồ kiểu này,
 * đảm bảo type-safety cho cả Publisher (RealtimeProvider) lẫn Consumer (useRealtimeEvent).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Payload types (subset của dữ liệu thực tế)
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderPayload {
  id: string;
  user_id: string;
  status: string;
  price: number;
  payment_code?: string;
  product_name?: string;
  plan_label?: string;
  created_at: string;
  superseded_by_order_id?: string | null;
  renewed_from_order_id?: string | null;
  [key: string]: unknown;
}

export interface SupportTicketPayload {
  id: string;
  user_id: string;
  ticket_number: string;
  subject: string;
  status: 'pending' | 'processing' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  updated_at: string;
  [key: string]: unknown;
}

export interface SupportMessagePayload {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: 'user' | 'admin';
  message: string;
  created_at: string;
  [key: string]: unknown;
}

export interface NotificationPayload {
  id: string;
  user_id: string;
  is_admin: boolean;
  type: string;
  title: string;
  message: string;
  order_id?: string | null;
  is_read: boolean;
  created_at: string;
  [key: string]: unknown;
}

export interface ProfilePayload {
  id: string;
  balance: number;
  full_name?: string;
  role?: string;
  [key: string]: unknown;
}

export interface ProductReviewPayload {
  id: string;
  product_id: string;
  status: 'pending' | 'approved' | 'rejected';
  [key: string]: unknown;
}

export interface OrderExpiryNotificationPayload {
  id: string;
  order_id: string;
  user_id: string;
  notification_type: string;
  sent_at: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Map — Tên sự kiện → Payload tương ứng
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quy ước đặt tên event: `table:EVENT_TYPE`
 * EVENT_TYPE là INSERT | UPDATE | DELETE
 */
export interface BowRealtimeEventMap {
  // ── CRITICAL ──────────────────────────────────────────────────────────────
  'orders:INSERT': { eventType: 'INSERT'; payload: OrderPayload };
  'orders:UPDATE': { eventType: 'UPDATE'; payload: OrderPayload; old: Partial<OrderPayload> };

  'support_tickets:INSERT': { eventType: 'INSERT'; payload: SupportTicketPayload };
  'support_tickets:UPDATE': { eventType: 'UPDATE'; payload: SupportTicketPayload; old: Partial<SupportTicketPayload> };

  'support_messages:INSERT': { eventType: 'INSERT'; payload: SupportMessagePayload };

  'notifications:INSERT': { eventType: 'INSERT'; payload: NotificationPayload };
  'notifications:UPDATE': { eventType: 'UPDATE'; payload: NotificationPayload; old: Partial<NotificationPayload> };

  // ── HIGH ──────────────────────────────────────────────────────────────────
  'profiles:UPDATE': { eventType: 'UPDATE'; payload: ProfilePayload; old: Partial<ProfilePayload> };

  'product_reviews:INSERT': { eventType: 'INSERT'; payload: ProductReviewPayload };
  'product_reviews:UPDATE': { eventType: 'UPDATE'; payload: ProductReviewPayload; old: Partial<ProductReviewPayload> };

  'order_expiry_notifications:INSERT': { eventType: 'INSERT'; payload: OrderExpiryNotificationPayload };
}

export type BowRealtimeEventKey = keyof BowRealtimeEventMap;
export type BowRealtimeEventValue<K extends BowRealtimeEventKey> = BowRealtimeEventMap[K];
