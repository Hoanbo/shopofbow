// netlify/functions/telegram-callback.ts
// Nhận callback khi admin bấm nút inline trong Telegram (Hướng A).
//   callback_data: "confirm:<order_id>"  -> pending_payment => pending_delivery
//   callback_data: "cancel:<order_id>"   -> pending_payment => cancelled
//
// Telegram gọi tới URL này (đăng ký qua setWebhook). Để chống giả mạo,
// Telegram gửi kèm header "X-Telegram-Bot-Api-Secret-Token" = TELEGRAM_WEBHOOK_SECRET
// (thiết lập lúc setWebhook).
//
// Env (Netlify): TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET,
//                SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TG = (method: string) => `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // ── Xác thực secret token của Telegram ────────────────────
  const secret =
    event.headers['x-telegram-bot-api-secret-token'] ||
    event.headers['X-Telegram-Bot-Api-Secret-Token'] ||
    '';
  if (!TELEGRAM_WEBHOOK_SECRET || secret !== TELEGRAM_WEBHOOK_SECRET) {
    console.error('[telegram-callback] Unauthorized — sai secret token');
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[telegram-callback] Thiếu SUPABASE env');
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  let update: any;
  try {
    update = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const cb = update.callback_query;
  // Chỉ xử lý sự kiện bấm nút inline. Update khác -> bỏ qua (trả 200).
  if (!cb || !cb.data) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: true }) };
  }

  const callbackId = cb.id;
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  const [action, orderId] = String(cb.data).split(':');

  if (!orderId || (action !== 'confirm' && action !== 'cancel')) {
    await answerCallback(callbackId, 'Yêu cầu không hợp lệ.');
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Đọc đơn hiện tại
  const { data: order, error: findErr } = await supabase
    .from('orders')
    .select('id, product_name, plan_label, price, status, payment_code')
    .eq('id', orderId)
    .maybeSingle();

  if (findErr || !order) {
    await answerCallback(callbackId, 'Không tìm thấy đơn hàng.');
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  // ── Idempotency guard: chỉ xử lý khi đơn còn pending_payment ──
  // Nếu webhook SePay đã xác nhận trước đó, status != pending_payment
  // -> đây là no-op an toàn, chỉ báo lại cho admin.
  if (order.status !== 'pending_payment') {
    await answerCallback(callbackId, `Đơn đã được xử lý trước đó (${statusLabel(order.status)}).`);
    // Cập nhật lại nút cho khớp trạng thái thực tế (gỡ nút)
    await editMarkupResolved(chatId, messageId, order, order.status);
    return { statusCode: 200, body: JSON.stringify({ ok: true, already: order.status }) };
  }

  const nextStatus = action === 'confirm' ? 'pending_delivery' : 'cancelled';

  const { error: updErr } = await supabase
    .from('orders')
    .update({ status: nextStatus })
    .eq('id', orderId)
    .eq('status', 'pending_payment'); // guard chống race với webhook

  if (updErr) {
    console.error('[telegram-callback] Lỗi cập nhật đơn:', updErr);
    await answerCallback(callbackId, 'Lỗi cập nhật đơn hàng, thử lại sau.');
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  // Tạo thông báo admin trong DB (để chuông web cũng thấy)
  await supabase.from('notifications').insert({
    type: action === 'confirm' ? 'order_confirmed' : 'order_cancelled',
    title: action === 'confirm' ? 'Đã duyệt thủ công (Telegram)' : 'Đã hủy đơn (Telegram)',
    message:
      action === 'confirm'
        ? `Đơn ${order.payment_code} — ${order.product_name} đã được xác nhận thanh toán thủ công.`
        : `Đơn ${order.payment_code} — ${order.product_name} đã bị hủy qua Telegram.`,
    order_id: order.id,
    is_admin: true,
    is_read: false,
  });

  await answerCallback(
    callbackId,
    action === 'confirm' ? '✅ Đã xác nhận. Đơn chuyển sang Chờ bàn giao.' : '❌ Đã hủy đơn.',
  );
  await editMarkupResolved(chatId, messageId, order, nextStatus, 'manual');

  return { statusCode: 200, body: JSON.stringify({ ok: true, status: nextStatus }) };
};

// Trả lời popup nhỏ trên Telegram cho admin
async function answerCallback(callbackQueryId: string, text: string): Promise<void> {
  try {
    await fetch(TG('answerCallbackQuery'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }),
    });
  } catch (err) {
    console.warn('[telegram-callback] answerCallbackQuery failed:', err);
  }
}

// Gỡ nút + thêm dòng trạng thái vào cuối tin nhắn
async function editMarkupResolved(
  chatId: number | undefined,
  messageId: number | undefined,
  order: any,
  status: string,
  source: 'manual' | 'auto' = 'manual',
): Promise<void> {
  if (!chatId || !messageId) return;

  let footer = '';
  if (status === 'pending_delivery') {
    footer =
      source === 'manual'
        ? '\n\n✅ <b>Đã xác nhận thủ công qua Telegram.</b>'
        : '\n\n✅ <b>Đã tự động xác nhận qua SePay.</b>';
  } else if (status === 'cancelled') {
    footer = '\n\n❌ <b>Đơn đã bị hủy.</b>';
  } else {
    footer = `\n\nℹ️ <b>Trạng thái: ${statusLabel(status)}.</b>`;
  }

  const baseText = `🔔 <b>ĐƠN HÀNG</b>

📦 <b>Mã đơn:</b> <code>#${order.payment_code || 'N/A'}</code>
🛍 <b>Sản phẩm:</b> ${escapeHtml(order.product_name || 'N/A')}
📋 <b>Gói:</b> ${escapeHtml(order.plan_label || 'N/A')}
💰 <b>Giá trị:</b> ${(Number(order.price) || 0).toLocaleString('vi-VN')}đ${footer}`;

  try {
    await fetch(TG('editMessageText'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: baseText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [] }, // gỡ nút
      }),
    });
  } catch (err) {
    console.warn('[telegram-callback] editMessageText failed:', err);
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending_payment: 'Chờ thanh toán',
    pending_delivery: 'Chờ bàn giao',
    processing: 'Đang thiết lập',
    completed: 'Đã hoàn thành',
    cancelled: 'Đã hủy',
    refunded: 'Đã hoàn tiền',
  };
  return map[status] || status;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
