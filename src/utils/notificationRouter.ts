/**
 * BOW Notification Deep Linking & Navigation Resolver
 *
 * Ánh xạ mọi loại notification (Order, Ticket, Expiry, Wallet, Review)
 * thành Deep Link chính xác cho cả User Layout và Admin Layout.
 */

export interface NotificationRecord {
  id: string;
  type?: string;
  title?: string;
  message?: string;
  order_id?: string | null;
  ticket_id?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  is_admin?: boolean;
}

export function resolveNotificationDestination(
  notif: NotificationRecord,
  isAdmin: boolean = false,
): string {
  const type = (notif.type || '').toLowerCase();
  const rawTargetType = (notif.target_type || '').toLowerCase();

  // Xác định target_type từ field rõ ràng hoặc type-prefix fallback
  let targetType: 'order' | 'ticket' | 'wallet' | 'review' | 'system' = 'order';

  if (rawTargetType === 'ticket' || notif.ticket_id || type.startsWith('ticket_') || notif.title?.includes('Ticket')) {
    targetType = 'ticket';
  } else if (rawTargetType === 'wallet' || type.startsWith('wallet_') || notif.title?.includes('nạp tiền') || notif.title?.includes('hoàn tiền')) {
    targetType = 'wallet';
  } else if (rawTargetType === 'review' || type.startsWith('review_')) {
    targetType = 'review';
  } else if (rawTargetType === 'order' || notif.order_id || type.startsWith('order_') || type.startsWith('expiry_') || type === 'new_order') {
    targetType = 'order';
  }

  // Xác định target_id (hỗ trợ cả target_id, order_id, ticket_id)
  let targetId = notif.target_id || notif.order_id || notif.ticket_id || null;

  // Nếu targetId chưa có nhưng title có chứa mã Ticket (ví dụ: BOW-1010)
  if (!targetId && targetType === 'ticket' && notif.title) {
    const match = notif.title.match(/BOW-\d+/i);
    if (match) {
      targetId = match[0];
    }
  }

  // 1. ORDER DESTINATION
  if (targetType === 'order') {
    if (isAdmin) {
      return targetId
        ? `/admin/orders?order_id=${encodeURIComponent(targetId)}`
        : '/admin/orders';
    }
    return targetId
      ? `/dashboard?tab=orders&order_id=${encodeURIComponent(targetId)}`
      : '/dashboard?tab=orders';
  }

  // 2. TICKET DESTINATION
  if (targetType === 'ticket') {
    if (isAdmin) {
      return targetId
        ? `/admin/tickets?ticket=${encodeURIComponent(targetId)}`
        : '/admin/tickets';
    }
    return targetId
      ? `/dashboard?tab=tickets&ticket_id=${encodeURIComponent(targetId)}`
      : '/dashboard?tab=tickets';
  }

  // 3. WALLET DESTINATION
  if (targetType === 'wallet') {
    if (isAdmin) {
      return '/admin/users';
    }
    return '/dashboard?tab=wallet';
  }

  // 4. REVIEW DESTINATION
  if (targetType === 'review') {
    if (isAdmin) {
      return '/admin/reviews';
    }
    return targetId
      ? `/products/${encodeURIComponent(targetId)}`
      : '/dashboard?tab=orders';
  }

  // 5. DEFAULT FALLBACK
  return isAdmin ? '/admin' : '/dashboard?tab=orders';
}
