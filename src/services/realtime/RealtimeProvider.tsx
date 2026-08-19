/**
 * BOW Realtime Hub — RealtimeProvider
 *
 * Quản lý toàn bộ Supabase Realtime channels tập trung.
 * Chỉ tạo channel khi user đã đăng nhập, tự dọn sạch khi logout.
 *
 * KIẾN TRÚC:
 *  ┌──────────────────────────────────────────────────────────────────┐
 *  │  RealtimeProvider (singleton, nằm ngay trong AuthProvider)       │
 *  │                                                                  │
 *  │  user-hub-{userId}     → orders, notifications, support_tickets  │
 *  │                          profiles, support_messages              │
 *  │  admin-hub-global      → orders, support_tickets,               │
 *  │                          product_reviews, notifications (admin)  │
 *  │                          order_expiry_notifications              │
 *  └──────────────────────────────────────────────────────────────────┘
 *
 * Tất cả sự kiện được phát ra qua eventBus. Component lắng nghe bằng
 * useRealtimeEvent(key, handler) — không cần tạo channel riêng.
 *
 * SCOPED CHANNELS (user tự tạo khi cần, không đi qua đây):
 *  - chat-{ticketId}          → UserTicketChatModal
 *  - deposit-{orderId}        → Dashboard wallet deposit poller
 *  - checkout-order-{orderId} → CheckoutModal payment poller
 */

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { emit } from './eventBus';
import type {
  OrderPayload,
  SupportTicketPayload,
  SupportMessagePayload,
  NotificationPayload,
  ProfilePayload,
  ProductReviewPayload,
  OrderExpiryNotificationPayload,
} from './types';

// Context chỉ để báo "Provider đang chạy" — consumer không cần giá trị cụ thể
const RealtimeContext = createContext<boolean>(false);

export function useRealtimeHub(): boolean {
  return useContext(RealtimeContext);
}

interface Props {
  children: ReactNode;
}

export function RealtimeProvider({ children }: Props) {
  const { session, isAdmin } = useAuth();
  const userId = session?.user?.id ?? null;

  // Lưu ref đến channel names để cleanup chính xác
  const channelNames = useRef<string[]>([]);

  useEffect(() => {
    // Dọn dẹp function chung
    const teardown = () => {
      const names = channelNames.current;
      if (names.length === 0) return;
      for (const name of names) {
        const ch = supabase.getChannels().find((c: { topic?: string }) => c.topic === `realtime:${name}`);
        if (ch) supabase.removeChannel(ch);
      }
      channelNames.current = [];
    };

    if (!userId) {
      teardown();
      return;
    }

    // ──────────────────────────────────────────────────────────────
    // CHANNEL 1: user-hub-{userId}
    // Lắng nghe mọi bản ghi thuộc về user này
    // ──────────────────────────────────────────────────────────────
    const userHubName = `user-hub-${userId}`;

    const userHub = supabase
      .channel(userHubName)
      // orders của user này
      .on<OrderPayload>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` },
        (p) => emit('orders:INSERT', { eventType: 'INSERT', payload: p.new }),
      )
      .on<OrderPayload>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` },
        (p) => emit('orders:UPDATE', { eventType: 'UPDATE', payload: p.new, old: p.old ?? {} }),
      )
      // notifications của user này (is_admin=false)
      .on<NotificationPayload>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (p) => {
          if (!p.new.is_admin) {
            emit('notifications:INSERT', { eventType: 'INSERT', payload: p.new });
          }
        },
      )
      .on<NotificationPayload>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (p) => {
          if (!p.new.is_admin) {
            emit('notifications:UPDATE', { eventType: 'UPDATE', payload: p.new, old: p.old ?? {} });
          }
        },
      )
      // support_tickets của user này
      .on<SupportTicketPayload>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_tickets', filter: `user_id=eq.${userId}` },
        (p) => emit('support_tickets:INSERT', { eventType: 'INSERT', payload: p.new }),
      )
      .on<SupportTicketPayload>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `user_id=eq.${userId}` },
        (p) => emit('support_tickets:UPDATE', { eventType: 'UPDATE', payload: p.new, old: p.old ?? {} }),
      )
      // profile của user này (số dư, họ tên, role)
      .on<ProfilePayload>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (p) => emit('profiles:UPDATE', { eventType: 'UPDATE', payload: p.new, old: p.old ?? {} }),
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) {
          console.log(`[RealtimeHub] user-hub-${userId}: ${status}`);
        }
      });

    channelNames.current.push(userHubName);

    // ──────────────────────────────────────────────────────────────
    // CHANNEL 2: admin-hub-global  (chỉ khởi tạo nếu isAdmin)
    // Lắng nghe mọi bản ghi trong hệ thống, không cần filter user_id
    // ──────────────────────────────────────────────────────────────
    if (isAdmin) {
      const adminHubName = 'admin-hub-global';

      const adminHub = supabase
        .channel(adminHubName)
        // Tất cả orders trong hệ thống
        .on<OrderPayload>(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'orders' },
          (p) => emit('orders:INSERT', { eventType: 'INSERT', payload: p.new }),
        )
        .on<OrderPayload>(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders' },
          (p) => emit('orders:UPDATE', { eventType: 'UPDATE', payload: p.new, old: p.old ?? {} }),
        )
        // Tất cả support_tickets
        .on<SupportTicketPayload>(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'support_tickets' },
          (p) => emit('support_tickets:INSERT', { eventType: 'INSERT', payload: p.new }),
        )
        .on<SupportTicketPayload>(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'support_tickets' },
          (p) => emit('support_tickets:UPDATE', { eventType: 'UPDATE', payload: p.new, old: p.old ?? {} }),
        )
        // Notifications admin (is_admin = true)
        .on<NotificationPayload>(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'is_admin=eq.true' },
          (p) => emit('notifications:INSERT', { eventType: 'INSERT', payload: p.new }),
        )
        // product_reviews — admin cần phê duyệt
        .on<ProductReviewPayload>(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'product_reviews' },
          (p) => emit('product_reviews:INSERT', { eventType: 'INSERT', payload: p.new }),
        )
        .on<ProductReviewPayload>(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'product_reviews' },
          (p) => emit('product_reviews:UPDATE', { eventType: 'UPDATE', payload: p.new, old: p.old ?? {} }),
        )
        // order_expiry_notifications — tracking reminder gửi ra
        .on<OrderExpiryNotificationPayload>(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'order_expiry_notifications' },
          (p) => emit('order_expiry_notifications:INSERT', { eventType: 'INSERT', payload: p.new }),
        )
        .subscribe((status) => {
          if (import.meta.env.DEV) {
            console.log(`[RealtimeHub] admin-hub-global: ${status}`);
          }
        });

      channelNames.current.push(adminHubName);

      return () => {
        supabase.removeChannel(adminHub);
        supabase.removeChannel(userHub);
        channelNames.current = [];
      };
    }

    return () => {
      supabase.removeChannel(userHub);
      channelNames.current = [];
    };
  }, [userId, isAdmin]);

  return (
    <RealtimeContext.Provider value={true}>
      {children}
    </RealtimeContext.Provider>
  );
}
