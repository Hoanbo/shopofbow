// src/services/agent/production/productionFallbackService.ts
// BOW AGENT V3.3 — PHASE 7.0: GRACEFUL DEGRADATION & DETERMINISTIC FALLBACK
//
// Safe, deterministic fallback routing when AI inference is unavailable,
// timed out, rate-limited, or circuit-broken.
//
// HARD CONTRACTS:
//   - Zero Hallucination: Fallback utilizes canonical catalog and FAQs only.
//   - Authority Hierarchy: Transaction > Catalog > Positive FAQ > Negative Policy > Knowledge Gap.
//   - Zero Auto-Mutation: Never mutates pricing, products, or knowledge.

import type { AgentMessage } from '../types';

export interface FallbackOptions {
  reason?: string;
  originalQuery: string;
  matchedCategory?: string;
  sampleProducts?: Array<{ name: string; startingPrice: number }>;
}

export function generateDeterministicFallback(options: FallbackOptions): AgentMessage {
  const sanitizedQuery = (options.originalQuery || '')
    .slice(0, 80)
    .replace(/[<>{}`\\;]/g, '')
    .trim();

  let content = `🤖 **Hệ thống đang hoạt động ở chế độ an toàn.**\n\n`;

  if (options.sampleProducts && options.sampleProducts.length > 0) {
    content += `Bạn có thể tham khảo một số gói tài khoản nổi bật tại Shop of BOW:\n`;
    options.sampleProducts.slice(0, 3).forEach((p) => {
      const priceStr = p.startingPrice > 0 ? `từ **${p.startingPrice.toLocaleString('vi-VN')}đ**` : 'Liên hệ';
      content += `• **${p.name}** — ${priceStr}\n`;
    });
    content += `\nHoặc bấm **"🛍️ Xem danh mục"** để chọn sản phẩm bạn cần nhé! ✨`;
  } else {
    content += `Rất tiếc mình chưa thể xử lý chi tiết yêu cầu "${sanitizedQuery}".\n` +
      `Bạn có thể xem toàn bộ sản phẩm hoặc liên hệ trực tiếp hỗ trợ viên để được tư vấn nhanh nhất!`;
  }

  return {
    id: `fallback-${Date.now()}`,
    sender: 'agent',
    content,
    timestamp: new Date().toISOString(),
    suggestions: ['🛍️ Xem danh mục', '💰 Bảng giá', 'Gặp hỗ trợ viên'],
  };
}

export function getAuthorityLevel(route: string): number {
  switch (route.toUpperCase()) {
    case 'TRANSACTIONAL':
      return 1; // Highest authority
    case 'CATALOG':
      return 2;
    case 'SUPPORTED_FAQ':
      return 3;
    case 'SUPPORTED_NEGATIVE_POLICY':
      return 4;
    case 'PRODUCT_DEMAND':
      return 5;
    case 'KNOWLEDGE_GAP':
      return 6;
    default:
      return 7;
  }
}
