/**
 * BOW Realtime Hub — useRealtimeEvent
 *
 * Consumer hook: Đăng ký lắng nghe một event Realtime từ Event Bus.
 *
 * Ví dụ sử dụng:
 *   useRealtimeEvent('orders:INSERT', (e) => {
 *     setOrders(prev => [e.payload, ...prev]);
 *   });
 *
 * Lưu ý:
 * - handler phải được wrap bằng useCallback hoặc khai báo bên ngoài component
 *   để tránh re-subscribe mỗi render.
 * - Không cần cleanup thủ công — hook tự cleanup khi unmount.
 */

import { useEffect, useRef } from 'react';
import { subscribe } from './eventBus';
import type { BowRealtimeEventKey, BowRealtimeEventMap } from './types';

export function useRealtimeEvent<K extends BowRealtimeEventKey>(
  key: K,
  handler: (data: BowRealtimeEventMap[K]) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener = (data: BowRealtimeEventMap[K]) => {
      handlerRef.current?.(data);
    };
    return subscribe(key, listener);
  }, [key]);
}

