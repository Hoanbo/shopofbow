// netlify/functions/sepay-webhook.ts
// Webhook nhận biến động số dư từ SePay (https://sepay.vn).
// SePay gọi POST tới URL này mỗi khi có giao dịch vào tài khoản ngân hàng.
// Chúng ta đối chiếu nội dung chuyển khoản với mã đơn (BOW...) và tự động
// chuyển đơn từ 'pending_payment' -> 'pending_delivery'.
//
// Cấu hình trong SePay Dashboard > Webhooks:
//   - URL:  https://<site>/.netlify/functions/sepay-webhook
//   - Kiểu xác thực: API Key  →  header "Authorization: Apikey <SEPAY_API_KEY>"
//
// Env (Netlify): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEPAY_API_KEY
//                (tùy chọn) TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SEPAY_API_KEY = process.env.SEPAY_API_KEY!;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Module-level client: tái sử dụng giữa các invocation trên warm Lambda.
// createClient() khởi tạo SDK headers, pools, JWT parser — chỉ cần làm 1 lần.
const _supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

// Luôn trả 200 cho SePay (tránh SePay retry vô hạn) — kèm thông điệp để log.
const ok = (message: string, extra: Record<string, unknown> = {}) => ({
  statusCode: 200,
  body: JSON.stringify({ success: true, message, ...extra }),
});

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // ── Xác thực API Key ──────────────────────────────────────
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  if (!SEPAY_API_KEY || authHeader !== `Apikey ${SEPAY_API_KEY}`) {
    console.error('[sepay-webhook] Unauthorized — sai hoặc thiếu API key');
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[sepay-webhook] Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY');
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  const supabase = _supabase!;

  // ── Parse payload SePay ───────────────────────────────────
  let payload: any;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  // Chỉ xử lý tiền vào. SePay dùng transferType: 'in' | 'out'.
  const transferType = String(payload.transferType || '').toLowerCase();
  if (transferType && transferType !== 'in') {
    return ok('Bỏ qua giao dịch không phải tiền vào', { transferType });
  }

  // Lấy số tiền vào (SePay: transferAmount)
  const amount = Number(payload.transferAmount ?? payload.amount ?? 0);

  // Tìm mã đơn BOW... trong nội dung chuyển khoản
  const rawContent = [payload.content, payload.description, payload.code]
    .filter(Boolean)
    .join(' ');
  const match = rawContent.match(/BOW\d+/i);
  if (!match) {
    console.warn('[sepay-webhook] Không tìm thấy mã đơn trong nội dung:', rawContent);
    return ok('Không tìm thấy mã đơn trong nội dung chuyển khoản');
  }
  const paymentCode = match[0].toUpperCase();

  // ── Cập nhật đơn hàng bằng service_role (bypass RLS) ──────
  const { data: order, error: findErr } = await supabase
    .from('orders')
    .select('id, user_id, product_name, plan_label, price, status, payment_code, notes')
    .eq('payment_code', paymentCode)
    .maybeSingle();

  if (findErr) {
    console.error('[sepay-webhook] Lỗi truy vấn đơn:', findErr);
    return ok('Lỗi truy vấn đơn hàng', { paymentCode });
  }
  if (!order) {
    console.warn('[sepay-webhook] Không có đơn khớp mã:', paymentCode);
    return ok('Không tìm thấy đơn hàng khớp', { paymentCode });
  }

  // Đơn đã xử lý trước đó (idempotent) — không làm gì thêm
  if (order.status !== 'pending_payment') {
    return ok('Đơn đã được xử lý trước đó', { paymentCode, status: order.status });
  }

  // Kiểm tra số tiền chuyển >= giá đơn
  if (amount > 0 && amount < Number(order.price)) {
    console.warn(
      `[sepay-webhook] Số tiền thiếu cho ${paymentCode}: nhận ${amount}, cần ${order.price}`,
    );
    return ok('Số tiền chuyển chưa đủ', { paymentCode, amount, price: order.price });
  }

  const { error: updErr } = await supabase
    .from('orders')
    .update({ status: 'pending_delivery' })
    .eq('id', order.id)
    .eq('status', 'pending_payment'); // guard chống race

  if (updErr) {
    console.error('[sepay-webhook] Lỗi cập nhật đơn:', updErr);
    return ok('Lỗi cập nhật đơn hàng', { paymentCode });
  }

  // Thông báo admin trong DB (bảng notifications)
  await supabase.from('notifications').insert({
    type: 'new_order',
    title: 'Đã nhận thanh toán (SePay)',
    message: `Đơn ${paymentCode} — ${order.product_name} · ${Number(order.price).toLocaleString('vi-VN')}đ đã được thanh toán, chờ bàn giao.`,
    order_id: order.id,
    is_admin: true,
    is_read: false,
  });

  // Telegram (tùy chọn, non-blocking)
  await notifyTelegram(paymentCode, order, amount);

  return ok('Đã xác nhận thanh toán', { paymentCode, status: 'pending_delivery' });
};

async function notifyTelegram(paymentCode: string, order: any, amount: number): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const vnd = (v: number) => v.toLocaleString('vi-VN') + 'đ';
  const text = `✅ <b>ĐÃ NHẬN THANH TOÁN (SePay)</b>

📦 <b>Mã đơn:</b> <code>#${paymentCode}</code>
🛍 <b>Sản phẩm:</b> ${escapeHtml(order.product_name || 'N/A')}
📋 <b>Gói:</b> ${escapeHtml(order.plan_label || 'N/A')}
💰 <b>Số tiền:</b> ${vnd(amount || Number(order.price) || 0)}
📌 <b>Trạng thái:</b> Chờ bàn giao

👉 Vào <b>Admin Dashboard</b> để bàn giao dịch vụ.`;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch (err) {
    console.warn('[sepay-webhook] Telegram notify failed:', err);
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
