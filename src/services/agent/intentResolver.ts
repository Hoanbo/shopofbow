// src/services/agent/intentResolver.ts — Nhận diện 10 Intent V2 có hiểu ngữ cảnh hội thoại
import type { AgentIntent } from './types';
import { getSessionContext } from './sessionContext';

/**
 * Phân loại ý định từ câu nói của người dùng, có đối chiếu ngữ cảnh phiên chat
 */
export function resolveIntent(text: string): AgentIntent {
  const lower = text.toLowerCase().trim();
  const context = getSessionContext();

  // 1. Ý định Mua hàng trực tiếp (BUY)
  if (
    lower.startsWith('mua') ||
    lower.startsWith('đặt mua') ||
    lower.startsWith('thanh toán') ||
    lower.includes('mua luôn') ||
    lower.includes('mua ngay') ||
    lower.includes('mua gói này') ||
    lower.includes('lấy gói này') ||
    lower.includes('chốt gói này') ||
    lower.includes('mình muốn mua') ||
    lower.includes('tôi muốn mua') ||
    lower.includes('đăng ký gói') ||
    (context.lastMentionedProduct && (lower === 'mua' || lower === 'mua luôn' || lower === 'thanh toán ngay' || lower === 'lấy gói này'))
  ) {
    return 'BUY';
  }

  // 2. Gia hạn đơn hàng cũ (RENEW)
  if (
    lower.includes('gia hạn') ||
    lower.includes('renew') ||
    lower.includes('hết hạn muốn dùng tiếp') ||
    lower.includes('nâng cấp tiếp') ||
    (context.lastMentionedOrder && lower.includes('gia hạn đơn'))
  ) {
    return 'RENEW';
  }

  // 3. Yêu cầu Hỗ trợ lỗi / Bảo hành (WARRANTY)
  if (
    lower.includes('bảo hành') ||
    lower.includes('lỗi') ||
    lower.includes('không xem được') ||
    lower.includes('không đăng nhập được') ||
    lower.includes('bị out') ||
    lower.includes('bị khóa') ||
    lower.includes('sai mật khẩu') ||
    lower.includes('sai pass') ||
    lower.includes('hỏng tài khoản') ||
    lower.includes('đổi trả') ||
    lower.includes('hoàn tiền')
  ) {
    return 'WARRANTY';
  }

  // 4. Tra cứu đơn hàng (ORDER_QUERY)
  if (
    lower.includes('đơn hàng') ||
    lower.includes('order') ||
    lower.includes('mã đơn') ||
    lower.includes('bow-') ||
    lower.includes('trạng thái đơn') ||
    lower.includes('kiểm tra đơn') ||
    lower.includes('đơn gần nhất') ||
    lower.includes('đã mua')
  ) {
    return 'ORDER_QUERY';
  }

  // 5. Số dư ví & Nạp tiền (WALLET)
  if (
    lower.includes('số dư') ||
    lower.includes('ví') ||
    lower.includes('nạp tiền') ||
    lower.includes('nạp ví') ||
    lower.includes('tiền trong tài khoản') ||
    lower.includes('ví của tôi') ||
    lower.includes('còn bao nhiêu tiền')
  ) {
    return 'WALLET';
  }

  // 6. Mã giảm giá / Coupon (COUPON)
  if (
    lower.includes('mã giảm giá') ||
    lower.includes('coupon') ||
    lower.includes('voucher') ||
    lower.includes('khuyến mãi') ||
    lower.includes('sale') ||
    lower.includes('giảm giá') ||
    lower.includes('ưu đãi') ||
    lower.includes('áp dụng mã')
  ) {
    return 'COUPON';
  }

  // 7. Catalog Overview (CATALOG)
  if (
    lower === 'xem danh mục' ||
    lower === 'danh mục' ||
    lower === '🛍️ xem danh mục' ||
    lower === '🛍️ tất cả sản phẩm' ||
    lower === '🛍️ ← danh mục' ||
    lower === '← danh mục' ||
    lower === 'quay lại danh mục' ||
    lower === 'danh mục sản phẩm' ||
    lower === 'tất cả sản phẩm' ||
    lower === 'toàn bộ sản phẩm' ||
    lower.includes('shop có bán những gì') ||
    lower.includes('có những sản phẩm nào') ||
    lower.includes('shop có những gì') ||
    lower.includes('bảng giá tổng hợp')
  ) {
    return 'CATALOG';
  }

  // 8. FAQ & Hướng dẫn sử dụng (FAQ)
  if (
    lower.includes('hướng dẫn') ||
    lower.includes('cách kích hoạt') ||
    lower.includes('cách dùng') ||
    lower.includes('làm sao để') ||
    lower.includes('faq') ||
    lower.includes('câu hỏi')
  ) {
    return 'FAQ';
  }

  // 9. Liên hệ Admin / Hỗ trợ viên trực tiếp (GENERAL)
  if (
    lower.includes('liên hệ') ||
    lower.includes('hotline') ||
    lower.includes('zalo') ||
    lower.includes('facebook') ||
    lower.includes('gặp admin') ||
    lower.includes('sđt') ||
    lower.includes('điện thoại') ||
    lower.includes('hỗ trợ viên')
  ) {
    return 'GENERAL';
  }

  // Mặc định là tìm kiếm sản phẩm / hỏi giá
  return 'PRODUCT_SEARCH';
}
