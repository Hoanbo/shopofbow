/**
 * BOW Realtime Hub — Event Bus
 *
 * Lightweight pub/sub dispatcher. RealtimeProvider publish events vào đây.
 * Mọi React component subscribe qua useRealtimeEvent(key, handler).
 *
 * Không có dependency vào React — pure TypeScript.
 */

import type { BowRealtimeEventKey, BowRealtimeEventMap } from './types';

type Listener<K extends BowRealtimeEventKey> = (
  data: BowRealtimeEventMap[K],
) => void;

// Dùng Map<string, Set<Function>> để tránh memory leak khi component unmount
const listeners = new Map<BowRealtimeEventKey, Set<Listener<any>>>();

function getSet<K extends BowRealtimeEventKey>(key: K): Set<Listener<K>> {
  if (!listeners.has(key)) {
    listeners.set(key, new Set());
  }
  return listeners.get(key) as Set<Listener<K>>;
}

/** Subscribe một handler cho một event key. Trả về hàm unsubscribe. */
export function subscribe<K extends BowRealtimeEventKey>(
  key: K,
  handler: Listener<K>,
): () => void {
  const set = getSet(key);
  set.add(handler);
  return () => {
    set.delete(handler);
  };
}

/** Phát ra một event. Gọi từ RealtimeProvider khi nhận postgres_changes. */
export function emit<K extends BowRealtimeEventKey>(
  key: K,
  data: BowRealtimeEventMap[K],
): void {
  const set = listeners.get(key);
  if (!set) return;
  // Snapshot to avoid mutation during iteration
  for (const handler of Array.from(set)) {
    try {
      handler(data);
    } catch (err) {
      console.error(`[RealtimeBus] Error in handler for "${key}":`, err);
    }
  }
}

/** Xóa toàn bộ listeners (chỉ dùng trong testing). */
export function _clearAll(): void {
  listeners.clear();
}
