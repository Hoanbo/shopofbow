const fs = require('fs');
const path = require('path');

// 1. Update analyticsSanitizer.ts
const sanitizerPath = 'C:\\BOW\\bow-agent\\src\\monitoring\\analyticsSanitizer.ts';
let sanitizerCode = fs.readFileSync(sanitizerPath, 'utf8');
if (!sanitizerCode.includes("'token',")) {
  sanitizerCode = sanitizerCode.replace(
    "'access_token',",
    "'token',\n    'access_token',"
  );
  fs.writeFileSync(sanitizerPath, sanitizerCode, 'utf8');
  console.log('Updated analyticsSanitizer.ts with token sensitive key');
}

// 2. Update agentEvents.ts
const agentEventsPath = 'C:\\BOW\\bow-agent\\src\\monitoring\\agentEvents.ts';
let agentEventsCode = fs.readFileSync(agentEventsPath, 'utf8');
agentEventsCode = `// src/services/agent/monitoring/agentEvents.ts
// Decoupled Analytics Event Ingestion via StorageAdapter / AnalyticsProvider

import type { AgentAnalyticsEvent } from './analyticsTypes';
import type { AnalyticsProvider } from '../contracts';
import { getActiveShopAdapter } from '../contracts';

export async function insertAnalyticsEvent(
  event: AgentAnalyticsEvent,
  analyticsProvider?: AnalyticsProvider
) {
  try {
    if (analyticsProvider) {
      await analyticsProvider.recordEvent({
        sessionId: event.sessionId || 'session-unknown',
        eventType: event.eventType,
        userId: event.userId || undefined,
        intent: (event.intent as any) || undefined,
        reason: event.reason || undefined,
        metadata: {
          ...(event.metadata || {}),
          productId: event.productId,
          planId: event.planId,
          actionId: event.actionId,
          actionType: event.actionType,
        },
      });
      return;
    }

    const adapter = getActiveShopAdapter();
    if (adapter.analytics && typeof (adapter.analytics as any).recordEvent === 'function') {
      await (adapter.analytics as any).recordEvent({
        sessionId: event.sessionId || 'session-unknown',
        eventType: event.eventType,
        userId: event.userId || undefined,
        intent: (event.intent as any) || undefined,
        reason: event.reason || undefined,
        metadata: event.metadata,
      });
      return;
    }

    if (adapter.analytics && typeof (adapter.analytics as any).track === 'function') {
      (adapter.analytics as any).track(event);
      return;
    }

    await adapter.storage?.recordAgentEvent({
      sessionId: event.sessionId || 'session-unknown',
      eventType: event.eventType,
      userId: event.userId || undefined,
      intent: (event.intent as any) || undefined,
      reason: event.reason || undefined,
      metadata: event.metadata,
      actionId: event.actionId,
      actionType: event.actionType,
      productId: event.productId,
      planId: event.planId,
    } as any);
  } catch (err) {
    console.warn('[Monitoring] Exception during analytics insert:', err);
  }
}
`;
fs.writeFileSync(agentEventsPath, agentEventsCode, 'utf8');
console.log('Updated agentEvents.ts to support adapter.analytics');

// 3. Update intentResolver.ts
const intentResolverPath = 'C:\\BOW\\bow-agent\\src\\core\\intentResolver.ts';
let intentCode = fs.readFileSync(intentResolverPath, 'utf8');

// Replace D. DETECT INDIVIDUAL INTENT FLAGS
const oldFlagsStart = '// D. DETECT INDIVIDUAL INTENT FLAGS';
const oldFlagsEnd = '// E. MULTI-INTENT PRIORITY RESOLUTION';

const newFlagsBlock = `// D. DETECT INDIVIDUAL INTENT FLAGS
  // --------------------------------------------------------------------------
  const hasBuy =
    lower.startsWith('mua') ||
    cleanLower.startsWith('mua') ||
    lower.startsWith('đặt mua') ||
    cleanLower.startsWith('dat mua') ||
    lower.startsWith('thanh toán') ||
    cleanLower.startsWith('thanh toan') ||
    lower.includes('mua ') ||
    cleanLower.includes('mua ') ||
    lower.includes('mua luôn') ||
    cleanLower.includes('mua luon') ||
    lower.includes('mua ngay') ||
    cleanLower.includes('mua ngay') ||
    lower.includes('mua gói') ||
    cleanLower.includes('mua goi') ||
    lower.includes('lấy gói') ||
    cleanLower.includes('lay goi') ||
    lower.includes('chốt gói') ||
    cleanLower.includes('chot goi') ||
    lower.includes('mình muốn mua') ||
    cleanLower.includes('minh muon mua') ||
    lower.includes('tôi muốn mua') ||
    cleanLower.includes('toi muon mua') ||
    lower.includes('tôi cần mua') ||
    cleanLower.includes('toi can mua') ||
    lower.includes('có muốn mua') ||
    cleanLower.includes('co muon mua') ||
    lower.includes('muốn mua') ||
    cleanLower.includes('muon mua') ||
    lower.includes('cần mua') ||
    cleanLower.includes('can mua') ||
    lower.includes('đăng ký gói') ||
    cleanLower.includes('dang ky goi') ||
    lower.includes('đăng ký ') ||
    cleanLower.includes('dang ky ') ||
    lower.includes('cho tôi mua') ||
    cleanLower.includes('cho toi mua') ||
    (context.lastMentionedProduct &&
      (cleanLower === 'mua' || cleanLower === 'mua luon' || cleanLower === 'thanh toan ngay' || cleanLower === 'lay goi nay' || cleanLower === 'mua cai nay' || cleanLower === 'lay cai nay'));

  const hasWallet =
    cleanLower === 'nap' ||
    cleanLower.startsWith('nap ') ||
    cleanLower.includes('nap') ||
    cleanLower.includes('vi') ||
    cleanLower.includes('so du') ||
    cleanLower.includes('nap tien') ||
    cleanLower.includes('nap them tien') ||
    cleanLower.includes('nap them') ||
    cleanLower.includes('nap vi') ||
    cleanLower.includes('topup') ||
    cleanLower.includes('top up') ||
    cleanLower.includes('tien trong vi') ||
    cleanLower.includes('con bao nhieu tien') ||
    cleanLower.includes('kiem tra vi') ||
    cleanLower.includes('vi dien tu') ||
    lower.includes('nạp') ||
    lower.includes('ví') ||
    lower.includes('số dư') ||
    /^n[aạ]p\s+[\+\d]/.test(lower) ||
    /^n[aạ]p\s+\d+[kKdđ]/.test(lower) ||
    /n[aạ]p\s+\+?\d+[.,]?\d*\s*[kKdđ]/.test(lower) ||
    /n[aạ]p\s+ti[eề]n\s+v[aà]o\s+v[ií]/.test(lower) ||
    /n[aạ]p\s+\+\d/.test(lower);

  const hasOrderQuery =
    cleanLower.includes('don hang') ||
    cleanLower.includes('lich su mua') ||
    cleanLower.includes('tai khoan da mua') ||
    cleanLower.includes('tra cuu don') ||
    cleanLower.includes('kiem tra don') ||
    cleanLower.includes('don gan day') ||
    cleanLower.includes('don cho duyet') ||
    cleanLower.includes('danh sach don') ||
    cleanLower.includes('xem don') ||
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
    cleanLower.includes('sap het han') ||
    cleanLower.includes('het han chua') ||
    cleanLower.includes('khi nao het han') ||
    cleanLower.includes('san pham nao sap het') ||
    cleanLower.includes('goi nao sap het') ||
    cleanLower.includes('don nao sap het') ||
    cleanLower.includes('tai khoan nao sap het') ||
    cleanLower.includes('cai nao sap het') ||
    cleanLower.includes('cai nao can gia han') ||
    cleanLower.includes('goi nao can gia han') ||
    cleanLower.includes('don nao can gia han') ||
    cleanLower.includes('kiem tra han') ||
    cleanLower.includes('kiem tra thoi han') ||
    cleanLower.includes('xem han') ||
    cleanLower.includes('han su dung') ||
    cleanLower.includes('han dung') ||
    lower.includes('sắp hết hạn') ||
    lower.includes('hết hạn');

  const hasRenew =
    cleanLower.includes('gia han') ||
    cleanLower.includes('renew') ||
    cleanLower.includes('het han muon dung tiep') ||
    cleanLower.includes('nang cap tiep') ||
    lower.includes('gia hạn') ||
    (context.lastMentionedOrder && (cleanLower.includes('gia han don') || lower.includes('gia hạn đơn')));

  const hasTicket =
    cleanLower.includes('ticket') ||
    cleanLower.includes('phieu ho tro') ||
    lower.includes('phiếu hỗ trợ');

  const hasWarranty =
    cleanLower.includes('bao hanh') ||
    cleanLower.includes('loi') ||
    cleanLower.includes('khong dung duoc') ||
    cleanLower.includes('hong') ||
    cleanLower.includes('mat pass') ||
    cleanLower.includes('doi pass') ||
    cleanLower.includes('khong dang nhap duoc') ||
    cleanLower.includes('mat session') ||
    cleanLower.includes('bi kick') ||
    cleanLower.includes('khong vao duoc') ||
    lower.includes('bảo hành') ||
    lower.includes('lỗi') ||
    lower.includes('hỏng');

  const hasCoupon =
    cleanLower.includes('ma giam gia') ||
    cleanLower.includes('voucher') ||
    cleanLower.includes('khuyen mai') ||
    cleanLower.includes('coupon') ||
    cleanLower.includes('code giam') ||
    cleanLower.includes('uu dai') ||
    lower.includes('mã giảm giá') ||
    lower.includes('khuyến mãi') ||
    lower.includes('ưu đãi');

  const hasFaq =
    cleanLower.includes('huong dan') ||
    cleanLower.includes('cach dung') ||
    cleanLower.includes('faq') ||
    cleanLower.includes('cau hoi thuong gap') ||
    cleanLower.includes('ho tro the nao') ||
    cleanLower.includes('chinh sach') ||
    cleanLower.includes('kich hoat the nao') ||
    lower.includes('hướng dẫn') ||
    lower.includes('cách dùng') ||
    lower.includes('kích hoạt');

  const hasSupport =
    cleanLower.includes('hotline') ||
    cleanLower.includes('zalo') ||
    cleanLower.includes('lien he') ||
    cleanLower.includes('support') ||
    cleanLower.includes('gap admin') ||
    cleanLower.includes('gap nhan vien') ||
    cleanLower.includes('tu van vien') ||
    lower.includes('liên hệ') ||
    lower.includes('tư vấn');
  `;

const startIdx = intentCode.indexOf(oldFlagsStart);
const endIdx = intentCode.indexOf(oldFlagsEnd);

if (startIdx !== -1 && endIdx !== -1) {
  intentCode = intentCode.substring(0, startIdx) + newFlagsBlock + '\n  ' + intentCode.substring(endIdx);
  fs.writeFileSync(intentResolverPath, intentCode, 'utf8');
  console.log('Updated intentResolver.ts flags detection with full cleanLower & lower support');
} else {
  console.error('Could not find flags boundary in intentResolver.ts', { startIdx, endIdx });
}
