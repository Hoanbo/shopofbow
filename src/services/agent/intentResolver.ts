/**
 * @deprecated ARCHIVE/ROLLBACK-ONLY — PHASE 7.1 STEP 7
 * Standalone equivalent: @bow/agent/src/core/intentResolver.ts
 * Do NOT import directly from production UI code.
 */
// src/services/agent/intentResolver.ts — Nhận diện Multi-Intent V2 & Priority Routing

import type { AgentIntent, MultiIntentResult, DeferredContext, PlanItemResult, AgentContext } from './types';
import { getSessionContext } from './sessionContext';

/**
 * Trích xuất thời hạn (duration) bằng Regex toàn diện: 6 tháng, 12 tháng, 1 năm, 3 tháng, 1 tháng, token, v.v.
 * BUG-001 Hotfix: Hỗ trợ tiếng Việt có dấu, không dấu, NFD/NFC Unicode normalization và viết tắt (6t, 6 t, nửa năm, 180 ngày)
 */
// 1. Hàm chuẩn hóa văn bản an toàn tuyệt đối (Không bao giờ bị lỗi font hay bảng mã)
export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Bóc tách toàn bộ dấu tiếng Việt
    .replace(/\u0111|\u0110/g, 'd')   // Chuyển đ, Đ -> d bằng mã Unicode escape
    .replace(/[^a-z0-9\s]/g, ' ')     // Loại bỏ ký tự rác
    .replace(/\s+/g, ' ')
    .trim();
}

// 2. Bóc tách thời hạn bằng các từ khóa ASCII thuần, trả về canonical có dấu chuẩn
export function extractDuration(text: string): string | undefined {
  if (!text) return undefined;
  const norm = normalizeText(text);

  // Gói Token
  if (/\b(100m|100\s*trieu)\s*token\b/.test(norm)) return '100M Token';
  if (/\b(50m|50\s*trieu)\s*token\b/.test(norm)) return '50M Token';
  if (/\b(10m|10\s*trieu)\s*token\b/.test(norm)) return '10M Token';

  // 6 tháng / nửa năm / 180 ngày (Ưu tiên trước 1 tháng)
  if (/\b(6\s*thang|6thang|6\s*t|nua\s*nam|180\s*ngay)\b/.test(norm)) return '6 tháng';

  // 12 tháng / 1 năm / cả năm / 365 ngày
  if (/\b(12\s*thang|12thang|12\s*t|1\s*nam|1nam|1n|ca\s*nam|365\s*ngay)\b/.test(norm)) return '1 năm';

  // 3 tháng / 1 quý / 90 ngày
  if (/\b(3\s*thang|3thang|3\s*t|1\s*quy|90\s*ngay)\b/.test(norm)) return '3 tháng';

  // 1 month / 30 days
  if (/\b(1\s*thang|1thang|1\s*t|30\s*ngay)\b/.test(norm)) return '1 tháng';

  // Any explicit numeric month remains explicit; never default it to 1 month.
  const numericMonth = norm.match(/\b(\d+)\s*thang\b/);
  if (numericMonth) return `${numericMonth[1]} thang`;
  if (/\b(1\s*tuan|1tuan|7\s*ngay|tuan)\b/.test(norm)) return '1 tuần';

  // 3 năm
  if (/\b(3\s*nam|3nam)\b/.test(norm)) return '3 năm';

  // Vĩnh viễn
  if (/\b(vinh\s*vien|tron\s*doi|lifetime)\b/.test(norm)) return 'vĩnh viễn';

  return undefined;
}

// 3. Khớp chính xác gói cước (Plan) trong Database
export function matchPlanByDuration(
  plans: PlanItemResult[],
  durationOrText: string,
  fullQuery?: string
): PlanItemResult | undefined {
  if (!plans || plans.length === 0) return undefined;

  const duration = extractDuration(durationOrText) || extractDuration(fullQuery || '') || durationOrText;
  if (!duration) return undefined;

  const requestedMonths = durationToMonths(duration);
  if (requestedMonths !== undefined) {
    return plans.find((plan) => durationToMonths(`${plan.name} ${plan.duration || ''}`) === requestedMonths);
  }

  const normalized = normalizeText(duration);
  const equivalentTerms: Record<string, string[]> = {
    'vinh vien': ['vinh vien', 'tron doi', 'lifetime'],
    '100m token': ['100m token', '100 trieu token'],
    '50m token': ['50m token', '50 trieu token'],
    '10m token': ['10m token', '10 trieu token'],
  };
  const terms = equivalentTerms[normalized] || [normalized];
  return plans.find((plan) => {
    const planText = normalizeText(`${plan.name} ${plan.duration || ''}`);
    return terms.some((term) => planText.includes(term));
  });
}

/** Convert user and authoritative plan labels to one comparable month value. */
export function durationToMonths(value: string): number | undefined {
  const normalized = normalizeText(value);
  const monthMatch = normalized.match(/\b(\d+)\s*thang\b/);
  if (monthMatch) return Number(monthMatch[1]);
  const yearMatch = normalized.match(/\b(\d+)\s*nam\b/);
  if (yearMatch) return Number(yearMatch[1]) * 12;
  const dayMatch = normalized.match(/\b(\d+)\s*ngay\b/);
  if (dayMatch) {
    const days = Number(dayMatch[1]);
    if (days % 30 === 0) return days / 30;
  }
  if (/\bnua\s*nam\b/.test(normalized)) return 6;
  if (/\bca\s*nam\b/.test(normalized)) return 12;
  if (/\b1\s*quy\b/.test(normalized)) return 3;
  return undefined;
}


/**
 * Trích xuất ngữ cảnh mua hàng (Deferred BUY Context) khi phát hiện multi-intent hoặc buy intent
 */
export function extractDeferredBuyContext(text: string): DeferredContext {
  // 1. Trích xuất thời hạn (duration) hoặc gói Token bằng regex toàn diện
  const duration = extractDuration(text);

  // 2. Trích xuất tên sản phẩm nếu có đề cập
  let productName: string | undefined = undefined;
  const buyMatch = text.match(/(?:mua|cho tôi mua|tôi cần mua|tôi muốn mua|có muốn mua|muốn mua|cần mua|đăng ký|lấy|chốt)\s+([^,.\n?]+?)(?:\s+(?:nhưng|rồi|trước|giúp|được không|thì|nếu|xem)|$)/i);
  if (buyMatch) {
    let candidate = buyMatch[1].trim();
    // Bỏ các từ thời hạn hoặc từ nối ra khỏi tên candidate
    candidate = candidate
      .replace(/100m\s*token|50m\s*token|10m\s*token|100m|50m|10m/gi, '')
      .replace(/(?:6|12|3|1)\s*th[áa]ng|6th[áa]ng|12th[áa]ng|3th[áa]ng|1th[áa]ng|1\s*n[ăa]m|1n[ăa]m|3\s*n[ăa]m|3n[ăa]m|1\s*tu[ầa]n|1tu[ầa]n|n[ửu]a\s*n[ăa]m|c[ảa]\s*n[ăa]m|180\s*ng[àa]y|365\s*ng[àa]y|90\s*ng[àa]y|30\s*ng[àa]y|7\s*ng[àa]y/gi, '')
      .replace(/\bgói\b|\btài\s*khoản\b|\bapp\b/gi, '')
      .trim();

    if (candidate.length >= 2 && !['này', 'nọ', 'đó', 'kia', 'ở đây', '1', '6', '12', '3'].includes(candidate.toLowerCase())) {
      productName = candidate;
    }
  }

  return {
    intent: 'BUY',
    duration,
    productName,
    rawQuery: text,
  };
}

/**
 * Nhận diện ý định Quản trị viên (Admin Copilot)
 */
export function detectAdminIntent(text: string): AgentIntent | null {
  const lower = text.toLowerCase().trim();
  const norm = lower
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ\u0111\u0110]/g, 'd')
    .replace(/[?!.,;:_/\-()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Daily Summary (Báo cáo tổng quan vận hành hôm nay)
  if (
    norm.includes('hom nay shop co gi can toi xu ly') ||
    norm.includes('can toi xu ly') ||
    norm.includes('can xu ly gi hom nay') ||
    norm.includes('tong quan hom nay') ||
    norm.includes('daily summary') ||
    norm.includes('tinh hinh shop hom nay') ||
    norm.includes('bao cao tong hop hom nay') ||
    norm.includes('tong ket ngay') ||
    norm.includes('hom nay can xu ly gi') ||
    norm.includes('hom nay toi can xu ly gi')
  ) {
    return 'ADMIN_DAILY_SUMMARY';
  }

  // 2. Task Prioritization (Thứ tự ưu tiên xử lý trong ngày)
  if (
    norm.includes('xu ly gi truoc') ||
    norm.includes('thu tu uu tien') ||
    norm.includes('viec can lam truoc') ||
    norm.includes('nen xu ly gi truoc') ||
    norm.includes('task priority') ||
    norm.includes('uu tien gi hom nay') ||
    norm.includes('hom nay toi nen xu ly gi truoc')
  ) {
    return 'ADMIN_TASK_PRIORITIZATION';
  }

  // 5. Fulfill Order Handover (Giao tài khoản / gửi key cho đơn)
  if (
    (norm.includes('giao tai khoan') || norm.includes('ban giao') || norm.includes('gan tai khoan') || norm.includes('gui key')) &&
    (norm.includes('bow-ord') || norm.includes('don')) &&
    !norm.includes('cho ban giao') &&
    !norm.includes('don cho') &&
    !norm.includes('dang cho') &&
    !norm.includes('chua ban giao') &&
    !norm.includes('da ban giao chua') &&
    !norm.includes('don nao')
  ) {
    return 'ADMIN_ORDER_HANDOVER';
  }

  // 4. Order Lookup / Inspection (Tra cứu trạng thái và chi tiết đơn hàng)
  if (
    (norm.includes('kiem tra don') || norm.includes('tra cuu don') || norm.includes('trang thai don') || norm.includes('don nay da ban giao chua') || norm.includes('khach da thanh toan chua')) ||
    ((norm.includes('bow-ord') || /#bow-ord/i.test(text) || norm.includes('ord-')) && !norm.includes('khieu nai') && !norm.includes('loi don') && !norm.includes('ban giao'))
  ) {
    return 'ADMIN_ORDER_LOOKUP';
  }

  // 5. Customer Lookup (Tra cứu thông tin / lịch sử khách hàng)
  if (
    norm.includes('kiem tra khach hang') ||
    norm.includes('khach nay mua gi') ||
    norm.includes('thong tin khach hang') ||
    norm.includes('lich su khach hang') ||
    norm.includes('khach hang nay da mua') ||
    norm.includes('khach nay da tung')
  ) {
    return 'ADMIN_CUSTOMER_LOOKUP';
  }

  // 6. Sales Analytics (Sản phẩm bán chạy / phân tích doanh số)
  if (
    norm.includes('ban chay nhat') ||
    norm.includes('san pham nao ban chay') ||
    norm.includes('goi nao khach mua nhieu') ||
    norm.includes('san pham doanh thu cao nhat') ||
    norm.includes('top san pham') ||
    norm.includes('san pham ban tot nhat')
  ) {
    return 'ADMIN_SALES_ANALYTICS';
  }

  // 7. Pending Fulfillment Queue (Đơn chờ bàn giao)
  if (
    norm.includes('cho ban giao') ||
    norm.includes('don cho') ||
    norm.includes('don hang cho') ||
    norm.includes('cho nhap hang') ||
    norm.includes('chua ban giao') ||
    norm.includes('cho giao') ||
    norm.includes('hang doi') ||
    norm.includes('dang cho') ||
    norm.includes('chua giao tai khoan') ||
    norm.includes('can xu ly') ||
    norm.includes('don can xu ly') ||
    norm.includes('danh sach don cho') ||
    norm.includes('pending fulfillment') ||
    norm.includes('pending handover') ||
    norm.includes('don nao chua giao')
  ) {
    return 'ADMIN_PENDING_HANDOVER';
  }

  // 8. Revenue / Profit Margin Report (Báo cáo doanh thu & Lợi nhuận)
  if (
    norm.includes('doanh thu') ||
    norm.includes('loi nhuan') ||
    norm.includes('bao cao') ||
    norm.includes('gia von') ||
    norm.includes('doanh so') ||
    norm.includes('bien loi nhuan') ||
    norm.includes('profit')
  ) {
    return 'ADMIN_REVENUE_REPORT';
  }

  // 9. Voucher Management & Creation (Tạo / tra cứu voucher)
  if (
    norm.includes('voucher') ||
    norm.includes('ma giam') ||
    norm.includes('khuyen mai') ||
    norm.includes('tao ma') ||
    norm.includes('tao coupon')
  ) {
    return 'ADMIN_VOUCHER_CREATE';
  }

  // 10. Dispute & Warranty Inspection (Kiểm tra khiếu nại / lỗi đơn)
  if (
    norm.includes('khieu nai') ||
    norm.includes('loi don') ||
    norm.includes('vang tai khoan') ||
    norm.includes('don loi') ||
    ((norm.includes('bow-ord') || norm.includes('ord-') || /#bow-ord/i.test(text)) &&
      (norm.includes('kiem tra') || norm.includes('van de') || norm.includes('bao hanh') || norm.includes('tra cuu') || norm.includes('khach')))
  ) {
    return 'ADMIN_DISPUTE_INSPECT';
  }

  // 11. [DEFERRED] Inventory Health (Tồn kho SKU)
  if (
    norm.includes('ton kho') ||
    norm.includes('can nhap') ||
    norm.includes('inventory') ||
    norm.includes('sku')
  ) {
    return 'ADMIN_INVENTORY_HEALTH';
  }

  return null;
}

/**
 * Phân loại đa ý định từ câu nói của người dùng, phân bổ Primary Intent và Deferred Context
 */
export function resolveMultiIntent(text: string, agentContext?: AgentContext): MultiIntentResult {
  const lower = text.toLowerCase().trim();
  const cleanLower = text
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .toLowerCase()
    .trim();
  const context = getSessionContext();

  // --------------------------------------------------------------------------
  // A. GREETING (Chào hỏi tự nhiên)
  // --------------------------------------------------------------------------
  const isGreetingWord =
    cleanLower === 'chào' ||
    cleanLower === 'chào bạn' ||
    cleanLower === 'chào shop' ||
    cleanLower === 'chào bot' ||
    cleanLower === 'chào ad' ||
    cleanLower === 'chào admin' ||
    cleanLower === 'xin chào' ||
    cleanLower === 'hello' ||
    cleanLower === 'hi' ||
    cleanLower === 'hey' ||
    cleanLower === 'alo' ||
    cleanLower === 'alo shop' ||
    cleanLower === 'ad ơi' ||
    cleanLower === 'admin ơi' ||
    cleanLower === 'shop ơi' ||
    cleanLower === 'bot ơi' ||
    cleanLower === 'good morning' ||
    cleanLower === 'good afternoon' ||
    cleanLower === 'good evening' ||
    cleanLower === 'hi bạn' ||
    cleanLower === 'hello shop' ||
    cleanLower === 'hello bot' ||
    cleanLower === 'chào em' ||
    cleanLower === 'chào anh';

  if (isGreetingWord) {
    return { primaryIntent: 'GREETING', secondaryIntents: [] };
  }

  // --------------------------------------------------------------------------
  // B. SMALL_TALK (Cảm ơn, Xác nhận, Tạm biệt, Hỏi danh tính bot)
  // --------------------------------------------------------------------------
  const isThanks =
    cleanLower === 'cảm ơn' ||
    cleanLower === 'cảm ơn bạn' ||
    cleanLower === 'cảm ơn shop' ||
    cleanLower === 'cảm ơn nhiều' ||
    cleanLower === 'thank' ||
    cleanLower === 'thanks' ||
    cleanLower === 'tks' ||
    cleanLower === 'thank you' ||
    cleanLower === 'cmon' ||
    cleanLower === 'tks shop' ||
    cleanLower.startsWith('cảm ơn') ||
    cleanLower.startsWith('thank');

  const isConfirmation =
    cleanLower === 'ok' ||
    cleanLower === 'oke' ||
    cleanLower === 'oki' ||
    cleanLower === 'ok bạn' ||
    cleanLower === 'oke shop' ||
    cleanLower === 'được rồi' ||
    cleanLower === 'được nhé' ||
    cleanLower === 'được nè' ||
    cleanLower === 'đã hiểu' ||
    cleanLower === 'hiểu rồi' ||
    cleanLower === 'dạ vâng' ||
    cleanLower === 'vâng' ||
    cleanLower === 'rồi nhé' ||
    cleanLower === 'ừ' ||
    cleanLower === 'uhm' ||
    cleanLower === 'có' ||
    cleanLower === 'tiếp tục' ||
    cleanLower === 'mua đi' ||
    cleanLower === 'mua luôn đi' ||
    cleanLower === 'chốt luôn';

  const isGoodbye =
    cleanLower === 'tạm biệt' ||
    cleanLower === 'bye' ||
    cleanLower === 'bye bye' ||
    cleanLower === 'hẹn gặp lại' ||
    cleanLower === 'gặp lại sau' ||
    cleanLower === 'chào tạm biệt';

  const isNegativeOrCancel =
    cleanLower === 'thôi' ||
    cleanLower === 'thôi không cần' ||
    cleanLower === 'không cần nữa' ||
    cleanLower === 'thôi không mua nữa' ||
    cleanLower === 'không mua nữa' ||
    cleanLower === 'hủy' ||
    cleanLower === 'bỏ qua' ||
    cleanLower === 'thôi cảm ơn' ||
    cleanLower.startsWith('thôi') ||
    cleanLower.startsWith('không cần');

  const isBotIdentity =
    cleanLower === 'bạn là ai' ||
    cleanLower === 'bạn là ai?' ||
    cleanLower === 'bạn tên gì' ||
    cleanLower === 'bạn tên gì?' ||
    cleanLower === 'bot là ai' ||
    cleanLower === 'ai đấy' ||
    cleanLower === 'ai đó' ||
    cleanLower.includes('bạn tên là gì');

  if (isThanks || isConfirmation || isGoodbye || isNegativeOrCancel || isBotIdentity) {
    return { primaryIntent: 'SMALL_TALK', secondaryIntents: [] };
  }

  // --------------------------------------------------------------------------
  // B2. ADMIN COPILOT INTENTS (Ưu tiên khi context surface là admin)
  // --------------------------------------------------------------------------
  // Case A: Admin ở Homepage (surface === 'customer') -> Xử lý như User Agent
  // Case B: Admin ở Admin Dashboard (surface === 'admin') -> Xử lý Admin Copilot
  // Case C & D: Khách hàng (role !== 'admin' && role !== 'owner') -> Không có quyền Admin
  const isAdminRole = agentContext?.role === 'admin' || agentContext?.role === 'owner' || (agentContext as any)?.isAdmin === true;
  const isAdminSurface = agentContext?.surface === 'admin' || (isAdminRole && agentContext?.surface !== 'customer');

  if (isAdminRole && isAdminSurface) {
    const adminIntent = detectAdminIntent(text);
    if (adminIntent) {
      return { primaryIntent: adminIntent, secondaryIntents: [] };
    }
  }

  // --------------------------------------------------------------------------
  // C. CAPABILITY_DISCOVERY (Khám phá năng lực của Agent)
  // --------------------------------------------------------------------------
  if (
    cleanLower.includes('bạn có thể làm gì') ||
    cleanLower.includes('bạn làm được gì') ||
    cleanLower.includes('bạn giúp được gì') ||
    cleanLower.includes('giúp gì được cho tôi') ||
    cleanLower.includes('bạn có chức năng gì') ||
    cleanLower.includes('tính năng của bạn') ||
    cleanLower.includes('chức năng của bot') ||
    cleanLower.includes('hướng dẫn bot') ||
    cleanLower.includes('bạn biết làm gì') ||
    cleanLower.includes('hôm nay có gì hay') ||
    cleanLower.includes('có gì hay không') ||
    cleanLower.includes('hôm nay có gì hot') ||
    cleanLower.includes('có gì hot không') ||
    cleanLower.includes('mình có thể làm gì') ||
    cleanLower.includes('tôi có thể làm gì') ||
    cleanLower.includes('agent làm được gì')
  ) {
    return { primaryIntent: 'CAPABILITY_DISCOVERY', secondaryIntents: [] };
  }

  // --------------------------------------------------------------------------
  // D. DETECT INDIVIDUAL INTENT FLAGS
  // --------------------------------------------------------------------------
  const hasBuy =
    lower.startsWith('mua') ||
    lower.startsWith('đặt mua') ||
    lower.startsWith('thanh toán') ||
    lower.includes('mua ') ||
    lower.includes('mua luôn') ||
    lower.includes('mua ngay') ||
    lower.includes('mua gói') ||
    lower.includes('lấy gói') ||
    lower.includes('chốt gói') ||
    lower.includes('mình muốn mua') ||
    lower.includes('tôi muốn mua') ||
    lower.includes('tôi cần mua') ||
    lower.includes('có muốn mua') ||
    lower.includes('muốn mua') ||
    lower.includes('cần mua') ||
    lower.includes('đăng ký gói') ||
    lower.includes('đăng ký ') ||
    lower.includes('cho tôi mua') ||
    (context.lastMentionedProduct &&
      (lower === 'mua' || lower === 'mua luôn' || lower === 'thanh toán ngay' || lower === 'lấy gói này' || lower === 'mua cái này' || lower === 'lấy cái này'));

  const hasWallet =
    lower === 'nạp' ||
    lower === 'nap' ||
    lower.startsWith('nạp ') ||
    lower.startsWith('nap ') ||
    lower.includes('nạp') ||
    lower.includes('ví') ||
    lower.includes('số dư') ||
    lower.includes('nạp tiền') ||
    lower.includes('nạp thêm tiền') ||
    lower.includes('nạp thêm') ||
    lower.includes('nạp ví') ||
    lower.includes('topup') ||
    lower.includes('top up') ||
    lower.includes('tiền trong ví') ||
    lower.includes('còn bao nhiêu tiền') ||
    lower.includes('kiểm tra ví') ||
    lower.includes('ví điện tử') ||
    // V2.2: Catch suggestion chip strings generated by Agent (e.g. "Nạp 20.000đ", "Nạp +100.000đ vào ví")
    /^nạp\s+[\+\d]/.test(lower) ||
    /^nạp\s+\d+[kKđ]/.test(lower) ||
    /nạp\s+\+?\d+[.,]?\d*\s*[kKđ]/.test(lower) ||
    /nạp\s+tiền\s+vào\s+ví/.test(lower) ||
    /nạp\s+\+\d/.test(lower);

  const hasOrderQuery =
    lower.includes('đơn hàng') ||
    lower.includes('lịch sử mua') ||
    lower.includes('tài khoản đã mua') ||
    lower.includes('tra cứu đơn') ||
    lower.includes('kiểm tra đơn') ||
    lower.includes('đơn gần đây') ||
    lower.includes('đơn chờ duyệt') ||
    lower.includes('danh sách đơn') ||
    lower.includes('xem đơn');

  const hasExpiring =
    cleanLower.includes('sắp hết hạn') ||
    cleanLower.includes('sap het han') ||
    cleanLower.includes('hết hạn chưa') ||
    cleanLower.includes('khi nào hết hạn') ||
    cleanLower.includes('sản phẩm nào sắp hết') ||
    cleanLower.includes('gói nào sắp hết') ||
    cleanLower.includes('đơn nào sắp hết') ||
    cleanLower.includes('tài khoản nào sắp hết') ||
    cleanLower.includes('cái nào sắp hết') ||
    cleanLower.includes('cái nào cần gia hạn') ||
    cleanLower.includes('gói nào cần gia hạn') ||
    cleanLower.includes('đơn nào cần gia hạn') ||
    cleanLower.includes('kiểm tra hạn') ||
    cleanLower.includes('kiểm tra thời hạn') ||
    cleanLower.includes('xem hạn') ||
    cleanLower.includes('hạn sử dụng') ||
    cleanLower.includes('hạn dùng');

  const hasRenew =
    lower.includes('gia hạn') ||
    lower.includes('renew') ||
    lower.includes('hết hạn muốn dùng tiếp') ||
    lower.includes('nâng cấp tiếp') ||
    (context.lastMentionedOrder && lower.includes('gia hạn đơn'));

  const hasTicket =
    cleanLower.includes('ticket') ||
    cleanLower.includes('phiếu hỗ trợ');

  const hasWarranty =
    lower.includes('bảo hành') ||
    lower.includes('hỏng') ||
    lower.includes('lỗi tài khoản') ||
    lower.includes('không đăng nhập được') ||
    lower.includes('mất pass') ||
    lower.includes('sai mật khẩu') ||
    lower.includes('bị out') ||
    lower.includes('bị khóa') ||
    lower.includes('hỗ trợ kỹ thuật') ||
    (context.lastMentionedOrder && lower.includes('bảo hành đơn'));

  const hasCoupon =
    lower.includes('mã giảm giá') ||
    lower.includes('coupon') ||
    lower.includes('voucher') ||
    lower.includes('khuyến mãi') ||
    lower.includes('sale') ||
    lower.includes('giảm giá') ||
    lower.includes('ưu đãi') ||
    lower.includes('áp dụng mã');

  const hasCatalog =
    (cleanLower === 'xem danh mục' ||
      cleanLower === 'danh mục' ||
      cleanLower === 'tìm sản phẩm' ||
      cleanLower === 'tìm kiếm sản phẩm' ||
      cleanLower === 'gợi ý sản phẩm' ||
      cleanLower === 'tư vấn sản phẩm' ||
      cleanLower === 'tất cả sản phẩm' ||
      cleanLower === 'toàn bộ sản phẩm' ||
      cleanLower === 'danh mục sản phẩm' ||
      cleanLower === 'danh sách sản phẩm' ||
      cleanLower === 'danh sách các sản phẩm' ||
      cleanLower === 'danh sách app' ||
      cleanLower === 'bảng giá' ||
      cleanLower === 'bảng giá tổng hợp' ||
      cleanLower === 'xem catalog' ||
      cleanLower === 'catalog' ||
      cleanLower === 'sản phẩm' ||
      cleanLower === 'shop có gì' ||
      cleanLower === 'shop mình có gì' ||
      cleanLower === 'bên mình có gì' ||
      cleanLower === 'bên bạn có gì' ||
      cleanLower === 'shop đang có gì' ||
      cleanLower === 'shop có những gì' ||
      cleanLower === 'cửa hàng có gì' ||
      cleanLower === 'shop bán gì' ||
      cleanLower === 'shop mình bán gì' ||
      cleanLower === 'bên mình bán gì' ||
      cleanLower === 'bên bạn bán gì' ||
      cleanLower === 'cửa hàng bán gì' ||
      cleanLower === 'bảng giá sản phẩm' ||
      cleanLower === 'bảng giá dịch vụ' ||
      cleanLower.includes('có những sản phẩm gì') ||
      cleanLower.includes('có những sản phẩm nào') ||
      cleanLower.includes('có các sản phẩm nào') ||
      cleanLower.includes('có các sản phẩm gì') ||
      cleanLower.includes('có sản phẩm gì') ||
      cleanLower.includes('có sản phẩm nào') ||
      cleanLower.includes('bạn có những sản phẩm gì') ||
      cleanLower.includes('bạn có những sản phẩm nào') ||
      cleanLower.includes('bạn có sản phẩm gì') ||
      cleanLower.includes('bạn có sản phẩm nào') ||
      cleanLower.includes('bạn đang có những sản phẩm gì') ||
      cleanLower.includes('bạn đang có những sản phẩm nào') ||
      cleanLower.includes('bạn đang có sản phẩm gì') ||
      cleanLower.includes('bạn đang có sản phẩm nào') ||
      cleanLower.includes('bạn có những gì') ||
      cleanLower.includes('bạn bán những gì') ||
      cleanLower.includes('bạn bán gì') ||
      cleanLower.includes('shop mình có những sản phẩm gì') ||
      cleanLower.includes('shop mình có những sản phẩm nào') ||
      cleanLower.includes('bên mình có những sản phẩm gì') ||
      cleanLower.includes('bên mình có những sản phẩm nào') ||
      cleanLower.includes('bên shop có những sản phẩm gì') ||
      cleanLower.includes('bên shop có những sản phẩm nào') ||
      cleanLower.includes('shop có những sản phẩm gì') ||
      cleanLower.includes('shop có những sản phẩm nào') ||
      cleanLower.includes('shop có những gì') ||
      cleanLower.includes('shop có những app nào') ||
      cleanLower.includes('shop có bán những gì') ||
      cleanLower.includes('shop đang bán gì') ||
      cleanLower.includes('shop bán những app nào') ||
      cleanLower.includes('shop bán những gì') ||
      cleanLower.includes('shop hiện có sản phẩm nào') ||
      cleanLower.includes('shop hiện có gì') ||
      cleanLower.includes('cho tôi xem sản phẩm') ||
      cleanLower.includes('cho tôi xem các sản phẩm') ||
      cleanLower.includes('cho tôi xem danh sách sản phẩm') ||
      cleanLower.includes('cho mình xem sản phẩm') ||
      cleanLower.includes('cho mình xem các sản phẩm') ||
      cleanLower.includes('cho mình xem danh sách sản phẩm') ||
      cleanLower.includes('xem danh sách sản phẩm') ||
      cleanLower.includes('xem tất cả sản phẩm') ||
      cleanLower.includes('xem toàn bộ sản phẩm') ||
      cleanLower.includes('show sản phẩm') ||
      cleanLower.includes('xem catalog') ||
      cleanLower.includes('xem bảng giá') ||
      /(?:bạn|shop|bên mình|bên shop|cửa hàng)\s+(?:đang\s+)?(?:có|bán|cung cấp)\s+(?:những\s+|các\s+)?(?:gì|sản phẩm gì|sản phẩm nào|app gì|app nào|mặt hàng gì|dịch vụ gì)/i.test(cleanLower) ||
      /(?:cho\s+)?(?:tôi|mình)?\s*(?:xem|show|coi)\s+(?:danh sách|tất cả|toàn bộ|các)?\s*(?:sản phẩm|app|dịch vụ|catalog|bảng giá)/i.test(cleanLower) ||
      /^có\s+(?:những\s+|các\s+)?(?:sản phẩm|app|tool|dịch vụ)\s*(?:nào|gì)?$/i.test(cleanLower)) &&
    !detectPluralDiscoveryIntent(text) &&
    !/(?:xem phim|nghe nhạc|dựng video|học tiếng anh|code|lập trình|thiết kế|đồ họa|ai|vpn|bản quyền|lưu trữ|văn phòng|tạo ảnh|làm video|dịch thuật|chụp ảnh|giải trí)/i.test(cleanLower);

  const hasViewCategory =
    cleanLower === 'ai tools' ||
    cleanLower === 'premium apps' ||
    cleanLower === 'featured products' ||
    cleanLower === 'sản phẩm nổi bật' ||
    cleanLower === 'sản phẩm hot' ||
    cleanLower === 'sản phẩm bán chạy' ||
    cleanLower === 'bán chạy nhất' ||
    cleanLower.includes('ai tools') ||
    cleanLower.includes('premium apps') ||
    cleanLower.includes('featured products') ||
    cleanLower.includes('sản phẩm nổi bật') ||
    cleanLower.includes('sản phẩm hot') ||
    cleanLower.includes('sản phẩm đang hot') ||
    cleanLower.includes('sản phảm đang hot') ||
    cleanLower.includes('sản phẩm bán chạy') ||
    cleanLower.includes('bán chạy nhất') ||
    cleanLower.includes('top bán chạy') ||
    cleanLower.includes('top hot') ||
    cleanLower.includes('bán chạy nhất thì sao') ||
    cleanLower.startsWith('danh mục ') ||
    cleanLower.startsWith('nhóm ') ||
    cleanLower.includes('xem nhóm ') ||
    cleanLower.includes('xem danh mục ') ||
    cleanLower.includes('các sản phẩm ai') ||
    cleanLower.includes('công cụ ai') ||
    cleanLower.includes('ứng dụng bản quyền') ||
    cleanLower.includes('sản phẩm ai') ||
    cleanLower.includes('có những ai nào') ||
    cleanLower.includes('bên mình có những ai nào') ||
    cleanLower.includes('shop có những ai nào') ||
    cleanLower.includes('app bản quyền');

  const hasFaq =
    lower.includes('hướng dẫn') ||
    lower.includes('cách kích hoạt') ||
    lower.includes('cách dùng') ||
    lower.includes('làm sao để') ||
    lower.includes('faq') ||
    lower.includes('câu hỏi');

  const hasGeneral =
    lower.includes('liên hệ') ||
    lower.includes('hotline') ||
    lower.includes('zalo') ||
    lower.includes('facebook') ||
    lower.includes('gặp admin') ||
    lower.includes('sđt') ||
    lower.includes('điện thoại') ||
    lower.includes('hỗ trợ viên');

  // --------------------------------------------------------------------------
  // E. MULTI-INTENT PRIORITY RESOLUTION
  // Priority: WALLET > ORDER_QUERY > EXPIRING_SOON > TICKET > WARRANTY > BUY
  // --------------------------------------------------------------------------
  if (hasBuy && (hasWallet || hasOrderQuery || hasExpiring || hasTicket || hasWarranty)) {
    const deferred = extractDeferredBuyContext(text);

    if (hasWallet) {
      return {
        primaryIntent: 'WALLET',
        secondaryIntents: ['BUY'],
        deferredContext: deferred,
      };
    }

    if (hasOrderQuery) {
      return {
        primaryIntent: 'ORDER_QUERY',
        secondaryIntents: ['BUY'],
        deferredContext: deferred,
      };
    }

    if (hasExpiring) {
      return {
        primaryIntent: 'EXPIRING_SOON',
        secondaryIntents: ['BUY'],
        deferredContext: deferred,
      };
    }

    if (hasTicket) {
      return {
        primaryIntent: 'TICKET',
        secondaryIntents: ['BUY'],
        deferredContext: deferred,
      };
    }

    if (hasWarranty) {
      return {
        primaryIntent: 'WARRANTY',
        secondaryIntents: ['BUY'],
        deferredContext: deferred,
      };
    }
  }

  // --------------------------------------------------------------------------
  // F. SINGLE INTENT RESOLUTION (STANDARD PRIORITY)
  // --------------------------------------------------------------------------
  if (hasExpiring) return { primaryIntent: 'EXPIRING_SOON', secondaryIntents: [] };
  if (hasRenew) return { primaryIntent: 'RENEW', secondaryIntents: [] };
  if (hasTicket) return { primaryIntent: 'TICKET', secondaryIntents: [] };
  if (hasWarranty) return { primaryIntent: 'WARRANTY', secondaryIntents: [] };
  if (hasOrderQuery) return { primaryIntent: 'ORDER_QUERY', secondaryIntents: [] };
  if (hasWallet) return { primaryIntent: 'WALLET', secondaryIntents: [] };
  if (hasCoupon) return { primaryIntent: 'COUPON', secondaryIntents: [] };
  if (hasBuy) {
    const deferred = extractDeferredBuyContext(text);
    return { primaryIntent: 'BUY', secondaryIntents: [], deferredContext: deferred };
  }
  if (hasCatalog) return { primaryIntent: 'CATALOG', secondaryIntents: [] };
  if (hasViewCategory) return { primaryIntent: 'VIEW_CATEGORY', secondaryIntents: [] };
  if (hasFaq) return { primaryIntent: 'FAQ', secondaryIntents: [] };
  if (hasGeneral) return { primaryIntent: 'GENERAL', secondaryIntents: [] };

  return { primaryIntent: 'PRODUCT_SEARCH', secondaryIntents: [] };
}

/**
 * Phân loại ý định từ câu nói của người dùng (tương thích ngược)
 */
export function resolveIntent(text: string, agentContext?: AgentContext): AgentIntent {
  return resolveMultiIntent(text, agentContext).primaryIntent;
}

/**
 * BOW Agent V3.3 Phase 4.2 — Plural Discovery Intent Detector
 *
 * Phân biệt:
 *   PLURAL DISCOVERY — user muốn danh sách nhiều sản phẩm/app
 *     VD: "xem phim thì có những app gì", "có app nào để nghe nhạc"
 *   SINGLE-PRODUCT PLAN DISCOVERY — user hỏi về các gói của 1 sản phẩm cụ thể
 *     VD: "Netflix có những gói gì", "YouTube có bao nhiêu gói"
 *
 * Nguyên tắc:
 *   - Chỉ trả TRUE nếu câu hỏi mang semantic "liệt kê nhiều sản phẩm"
 *   - Câu như "Netflix có những gói gì" → FALSE (single product plan discovery)
 *   - Hỗ trợ cả tiếng Việt có dấu và không dấu sau normalize
 */
export function detectPluralDiscoveryIntent(rawText: string): boolean {
  if (!rawText || rawText.trim().length === 0) return false;

  const lower = rawText.toLowerCase().trim();

  // Normalize không dấu để match tiếng Việt không dấu
  const noAccent = lower
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();

  // -----------------------------------------------------------------------
  // SINGLE-PRODUCT GUARD: nếu câu hỏi có tên sản phẩm cụ thể ở đầu
  // + "có những gói gì" / "có bao nhiêu gói" → là plan discovery, KHÔNG phải plural
  // -----------------------------------------------------------------------
  const planDiscoveryPattern = /\b(?:có những gói|có mấy gói|có bao nhiêu gói|các gói|những gói|gói nào|plan nào|co nhung goi|cac goi|goi nao)\b/i;
  if (planDiscoveryPattern.test(noAccent) || planDiscoveryPattern.test(lower)) {
    // Kiểm tra xem có tên sản phẩm phổ biến ở trước không
    // Nếu có → single product plan discovery
    const knownProductPrefixes = /\b(netflix|spotify|youtube|canva|chatgpt|gemini|cursor|notion|adobe|figma|duolingo|memrise|capcut|meitu|xingtu|proton|microsoft|google one|icloud|tv360|youku|wink|locket|autodesk|elevenlabs|veo3|grok|kling|perplexity|leonardo|api claude|api codex)\b/i;
    if (knownProductPrefixes.test(lower)) {
      return false; // Single product plan discovery
    }
  }

  // -----------------------------------------------------------------------
  // SHOP OVERVIEW GUARD: nếu câu hỏi hỏi chung toàn bộ shop / cửa hàng bán gì
  // VD: "shop có những sản phẩm gì?", "cửa hàng bán gì?", "shop có những gì?"
  // → là SHOP_OVERVIEW, KHÔNG phải plural capability discovery
  // -----------------------------------------------------------------------
  const shopOverviewPattern = /^(?:shop|bên mình|bên shop|cửa hàng|bạn)\s+(?:đang\s+)?(?:có|bán|cung cấp)\s+(?:những\s+|các\s+)?(?:gì|sản phẩm gì|sản phẩm nào|mặt hàng gì|app gì|app nào)\??$/i;
  const shopOverviewNoAccent = /^(?:shop|ben minh|ben shop|cua hang|ban)\s+(?:dang\s+)?(?:co|ban|cung cap)\s+(?:nhung\s+|cac\s+)?(?:gi|san pham gi|san pham nao|mat hang gi|app gi|app nao)\??$/i;
  if (shopOverviewPattern.test(lower) || shopOverviewNoAccent.test(noAccent)) {
    return false;
  }

  // -----------------------------------------------------------------------
  // PLURAL MARKERS — semantic patterns chỉ rõ "liệt kê nhiều sản phẩm"
  // -----------------------------------------------------------------------

  // Pattern 1: "có những ... gì" / "có những ... nào" (với hoặc không dấu)
  if (/có những .{1,30}? gì\b/i.test(lower) || /co nhung .{1,30}? gi\b/i.test(noAccent)) return true;
  if (/có những .{1,30}? nào\b/i.test(lower) || /co nhung .{1,30}? nao\b/i.test(noAccent)) return true;

  // Pattern 2: "các ... gì" / "các ... nào"
  if (/các .{1,30}? gì\b/i.test(lower) || /cac .{1,30}? gi\b/i.test(noAccent)) return true;
  if (/các .{1,30}? nào\b/i.test(lower) || /cac .{1,30}? nao\b/i.test(noAccent)) return true;

  // Pattern 3: "... thì có những app gì", "... thì có app nào"
  if (/thì có những\b/i.test(lower) || /thi co nhung\b/i.test(noAccent)) return true;
  if (/thì có (app|tool|phần mềm|dịch vụ|sản phẩm)\b/i.test(lower)) return true;
  if (/thi co (app|tool|phan mem|dich vu|san pham)\b/i.test(noAccent)) return true;

  // Pattern 4: "có app nào", "có tool nào", "có sản phẩm nào"
  if (/\bcó (app|tool|phần mềm|dịch vụ|sản phẩm|công cụ).{0,20}? nào\b/i.test(lower)) return true;
  if (/\bco (app|tool|phan mem|dich vu|san pham|cong cu).{0,20}? nao\b/i.test(noAccent)) return true;

  // Pattern 5: "liệt kê app ...", "danh sách app ..."
  if (/\b(liệt kê|danh sách|list)\s+(app|tool|sản phẩm|công cụ|phần mềm)\b/i.test(lower)) return true;
  if (/\b(liet ke|danh sach|list)\s+(app|tool|san pham|cong cu|phan mem)\b/i.test(noAccent)) return true;

  // Pattern 6: "những app ..." / "các app ..."
  if (/\bnhững (app|tool|công cụ|phần mềm|sản phẩm|dịch vụ)\b/i.test(lower)) return true;
  if (/\bnhung (app|tool|cong cu|phan mem|san pham|dich vu)\b/i.test(noAccent)) return true;
  if (/\bcác (app|tool|công cụ|phần mềm|sản phẩm|dịch vụ)\b/i.test(lower)) return true;
  if (/\bcac (app|tool|cong cu|phan mem|san pham|dich vu)\b/i.test(noAccent)) return true;

  // Pattern 7: "có gì để ...", "có gì cho ..." (khi đi với capability)
  if (/\bcó gì (để|cho|giúp|hỗ trợ)\b/i.test(lower)) return true;
  if (/\bco gi (de|cho|giup|ho tro)\b/i.test(noAccent)) return true;

  // Pattern 8: "những lựa chọn nào", "các lựa chọn"
  if (/\b(những|các) lựa chọn\b/i.test(lower)) return true;
  if (/\b(nhung|cac) lua chon\b/i.test(noAccent)) return true;

  // Pattern 9: "có bao nhiêu" (khi hỏi số lượng sản phẩm)
  if (/\bcó bao nhiêu (app|tool|sản phẩm|công cụ)\b/i.test(lower)) return true;
  if (/\bco bao nhieu (app|tool|san pham|cong cu)\b/i.test(noAccent)) return true;

  // Pattern 10: "... app nào để ...", "... tool nào để ..."
  if (/\b(app|tool|phần mềm).{0,20}? nào (để|cho|giúp)\b/i.test(lower)) return true;
  if (/\b(app|tool|phan mem).{0,20}? nao (de|cho|giup)\b/i.test(noAccent)) return true;

  // Pattern 11: "có những công cụ AI nào", "những AI tool nào"
  if (/có những .{0,20}?(ai|tool|app).{0,20}? nào\b/i.test(lower)) return true;

  // Pattern 12: "có app nào ... không?", "có tool nào ... không?", "có phần mềm nào ... không?"
  if (/\bcó\s+(?:những\s+|các\s+)?(app|tool|phần\s*mềm|dịch\s*vụ|sản\s*phẩm|công\s*cụ)\s+.{1,30}?\s*(?:không|\?|$)/i.test(lower)) return true;
  if (/\bco\s+(?:nhung\s+|cac\s+)?(app|tool|phan\s*mem|dich\s*vu|san\s*pham|cong\s*cu)\s+.{1,30}?\s*(?:khong|\?|$)/i.test(noAccent)) return true;

  // Pattern 13: "app ... có gì?", "tool ... có gì?"
  if (/\b(app|tool|phần\s*mềm|sản\s*phẩm)\s+.{1,30}?\s+có\s+(?:gì|những\s*gì)\b/i.test(lower)) return true;
  if (/\b(app|tool|phan\s*mem|san\s*pham)\s+.{1,30}?\s+co\s+(?:gi|nhung\s*gi)\b/i.test(noAccent)) return true;

  // Pattern 14: "muốn ... thì dùng app nào?", "cần ... thì dùng app nào?"
  if (/\b(muốn|cần|để)\s+.{1,30}?\s*thì\s+(?:dùng|xài|chọn|có|mua)\s+(?:app|tool|phần\s*mềm|gì|nào)\b/i.test(lower)) return true;
  if (/\b(muon|can|de)\s+.{1,30}?\s*thi\s+(?:dung|xai|chon|co|mua)\s+(?:app|tool|phan\s*mem|gi|nao)\b/i.test(noAccent)) return true;

  return false;
}

/**
 * BOW Agent V3.3 Phase 4.5 — Robust Ambiguity Detection (P1)
 *
 * Nhận diện các câu hỏi nhu cầu mơ hồ (AMBIGUOUS Demand State):
 * - Người dùng yêu cầu gợi ý/tư vấn nhưng không nói rõ lĩnh vực, tính năng, hoặc đối tượng cụ thể
 *   (vd: "tôi muốn một app tốt", "cho tôi một app tốt", "tìm cái gì hay hay", "có gì tốt", "gợi ý giúp tôi")
 * - Hỗ trợ cả tiếng Việt có dấu và không dấu, viết hoa/viết thường
 * - BẢO TOÀN TUYỆT ĐỐI các câu hỏi có đối tượng cụ thể (xem phim, nghe nhạc, Netflix, tàu vũ trụ, bảo hành, v.v.)
 */
export function isAmbiguousDemandQuery(rawText: string): boolean {
  if (!rawText || rawText.trim().length === 0) return false;

  const clean = rawText
    .toLowerCase()
    .replace(/[?!.,;:_/\-()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const noAccent = clean
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();

  // -----------------------------------------------------------------------
  // 1. GUARD SPECIFIC DOMAINS & CAPABILITIES:
  // Nếu câu hỏi nhắc đến bất kỳ lĩnh vực / công dụng cụ thể nào, TUYỆT ĐỐI không coi là mơ hồ
  // -----------------------------------------------------------------------
  const hasDomainKeyword =
    /(?:xem phim|nghe nhac|dung video|lam video|tao video|edit video|chinh anh|ve anh|tao anh|thiet ke|do hoa|hoc tieng anh|tieng anh|ngoai ngu|lap trinh|viet code|code|dich thuat|dich|chup anh|giai tri|ban quyen|bao mat|vpn|luu tru|cloud|van phong|tau vu tru|ten lua|sao hoa|ve tinh|ve may bay)/i.test(noAccent);
  if (hasDomainKeyword) return false;

  // -----------------------------------------------------------------------
  // 2. GUARD SPECIFIC PRODUCTS:
  // Nếu câu hỏi có tên sản phẩm cụ thể (vd: "Netflix giá bao nhiêu?", "mua Spotify") -> NOT ambiguous
  // -----------------------------------------------------------------------
  const hasSpecificProduct =
    /\b(netflix|spotify|youtube|canva|chatgpt|gemini|cursor|notion|adobe|figma|duolingo|memrise|capcut|meitu|xingtu|proton|microsoft|office|word|excel|google|icloud|tv360|youku|wink|locket|autodesk|elevenlabs|veo|grok|kling|perplexity|leonardo|claude|codex|disney|apple tv)\b/i.test(noAccent);
  if (hasSpecificProduct) return false;

  // -----------------------------------------------------------------------
  // 3. GUARD SPECIFIC ACTIONS:
  // Nếu là câu hỏi bảo hành, kiểm tra đơn, ví, voucher, giá -> NOT ambiguous
  // -----------------------------------------------------------------------
  const hasActionKeyword =
    /\b(bao hanh|don hang|kiem tra don|so du|nap tien|nap vi|voucher|ma giam gia|khuyen mai|gia bao nhieu|bao nhieu tien|bang gia|dang ky|thanh toan)\b/i.test(noAccent);
  if (hasActionKeyword) return false;

  // -----------------------------------------------------------------------
  // 4. GUARD SHOP OVERVIEW / CATALOG:
  // "shop có những sản phẩm gì?", "shop bán gì?" -> CATALOG, NOT ambiguous
  // -----------------------------------------------------------------------
  const hasShopCatalogKeyword =
    /^(?:shop|ben minh|ben shop|cua hang|ban)\s+(?:dang\s+)?(?:co|ban|cung cap)\s+(?:nhung\s+|cac\s+)?(?:gi|san pham gi|san pham nao|mat hang gi|app gi|app nao)\??$/i.test(noAccent);
  if (hasShopCatalogKeyword) return false;

  // -----------------------------------------------------------------------
  // 5. AMBIGUOUS PATTERNS MATCHING:
  // -----------------------------------------------------------------------

  // Pattern A: Yêu cầu gợi ý / recommend / tư vấn chung chung
  // e.g. "goi y giup toi", "goi y cho toi", "recommend cho toi", "tu van giup toi", "goi y mot app"
  if (/^(?:hay\s+)?(?:goi y|recommend|tu van)\s+(?:giup|cho|ho tro)?\s*(?:toi|minh|em|ban)?(?:\s+(?:mot|1)?\s*(?:app|tool|cai|thu|mon|ai|cong cu|phan mem)?)?\s*(?:tot|hay|xin|ngon|hot|phu hop)?\??$/i.test(noAccent)) {
    return true;
  }

  // Pattern B: "có gì tốt", "có gì hay", "có gì hot", "có gì ngon", "có cái gì hay hay"
  if (/^(?:shop\s+|ben minh\s+)?co\s+(?:cai\s+)?(?:gi|mon gi|thu gi)\s+(?:tot|hay|hay hay|hot|ngon|xin|ok)\??$/i.test(noAccent)) {
    return true;
  }

  // Pattern C: "tìm cái gì hay hay", "tìm cái gì hay", "tìm cái gì tốt", "tìm gì hay hay"
  if (/^(?:tim|kiem)\s+(?:cai\s+)?(?:gi|thu gi|mon gi)?\s*(?:hay hay|hay|tot|xin|ngon|hot|phu hop)\??$/i.test(noAccent)) {
    return true;
  }

  // Pattern D: Cấu trúc đòi hỏi mơ hồ: [Chủ ngữ]? [Cần/Muốn/Tìm/Cho]? [Một]? [App/Tool/Cái/Thứ/AI] [Tốt/Hay/Xịn/Ngon]
  // e.g. "cho tôi một app tốt", "tôi muốn một app tốt", "cần 1 app tốt", "tôi cần ai tốt", "cho tôi một tool tốt"
  const coreAmbiguousRegex = /^(?:cho\s+(?:toi|minh|em)\s+)?(?:toi|minh|em)?\s*(?:can|muon|tim|xin)?\s*(?:mot|1)?\s*(?:app|tool|cai|thu|mon|ai|cong cu|phan mem)\s*(?:nao|gi)?\s*(?:tot|hay|hay hay|xin|ngon|hot|phu hop|chat luong)\??$/i;
  if (coreAmbiguousRegex.test(noAccent)) {
    return true;
  }

  // Pattern E: "app nào hay", "tool nào tốt", "ai nào tốt", "công cụ nào hay"
  if (/^(?:app|tool|ai|cong cu|phan mem)\s+nao\s+(?:tot|hay|hay hay|xin|ngon|hot|phu hop)\??$/i.test(noAccent)) {
    return true;
  }

  // Pattern F: Rất ngắn: "ai tot", "cong cu tot", "tool tot", "app tot", "cai gi tot"
  if (/^(?:ai|cong cu|phan mem|tool|app|cai gi)\s+(?:tot|hay|xin|ngon)\??$/i.test(noAccent)) {
    return true;
  }

  return false;
}

export const resolveAgentIntent = resolveMultiIntent;

