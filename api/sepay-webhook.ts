// api/sepay-webhook.ts — Vercel Serverless Function for SePay Payment Webhook
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SEPAY_API_KEY = process.env.SEPAY_API_KEY;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const _supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

async function processSepayWebhook(headers: Record<string, string | string[] | undefined>, body: any) {
  const authHeaderRaw = headers['authorization'] || headers['Authorization'] || '';
  const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;

  if (!SEPAY_API_KEY || authHeader !== `Apikey ${SEPAY_API_KEY}`) {
    console.error('[sepay-webhook] Unauthorized — sai hoặc thiếu API key');
    return { statusCode: 401, body: { error: 'Unauthorized' } };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !_supabase) {
    console.error('[sepay-webhook] Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY');
    return { statusCode: 500, body: { error: 'Supabase not configured' } };
  }

  const supabase = _supabase;

  let payload: any = {};
  if (typeof body === 'string') {
    try {
      payload = JSON.parse(body || '{}');
    } catch {
      return { statusCode: 400, body: { error: 'Invalid JSON body' } };
    }
  } else if (typeof body === 'object' && body !== null) {
    payload = body;
  }

  const transferType = String(payload.transferType || '').toLowerCase();
  if (transferType && transferType !== 'in') {
    return { statusCode: 200, body: { success: true, message: 'Bỏ qua giao dịch không phải tiền vào' } };
  }

  const amount = Number(payload.transferAmount ?? payload.amount ?? 0);
  const rawContent = [payload.content, payload.description, payload.code]
    .filter(Boolean)
    .join(' ');
  const match = rawContent.match(/(BOWNAP[A-Z0-9]+|BOWN[A-Z0-9]+|BOW[A-Z0-9]+)/i);
  if (!match) {
    console.warn('[sepay-webhook] Không tìm thấy mã đơn trong nội dung:', rawContent);
    return { statusCode: 200, body: { success: true, message: 'Không tìm thấy mã đơn trong nội dung chuyển khoản' } };
  }
  const paymentCode = match[0].toUpperCase();

  const { data: order, error: findErr } = await supabase
    .from('orders')
    .select('id, user_id, product_name, plan_label, price, status, payment_code, notes')
    .eq('payment_code', paymentCode)
    .maybeSingle();

  if (findErr) {
    console.error('[sepay-webhook] Lỗi truy vấn đơn:', findErr);
    return { statusCode: 200, body: { success: true, message: 'Lỗi truy vấn đơn hàng', paymentCode } };
  }
  if (!order) {
    console.warn('[sepay-webhook] Không có đơn khớp mã:', paymentCode);
    return { statusCode: 200, body: { success: true, message: 'Không tìm thấy đơn hàng khớp', paymentCode } };
  }

  if (order.status !== 'pending_payment') {
    return { statusCode: 200, body: { success: true, message: 'Đơn đã được xử lý trước đó', paymentCode, status: order.status } };
  }

  const isTopup =
    paymentCode.startsWith('BOWNAP') ||
    paymentCode.startsWith('BOWN') ||
    order.product_name === 'Nạp tiền vào ví';

  const requiredAmount = Number(order.price || 0);
  if (amount > 0 && amount < requiredAmount) {
    console.warn(`[sepay-webhook] Số tiền thiếu cho ${paymentCode}: nhận ${amount}, cần ${requiredAmount}`);
    return { statusCode: 200, body: { success: true, message: 'Số tiền chuyển chưa đủ', paymentCode, amount, price: requiredAmount } };
  }

  const creditAmount = amount > 0 ? amount : requiredAmount;

  if (isTopup) {
    const { error: updErr } = await supabase
      .from('orders')
      .update({ status: 'completed' })
      .eq('id', order.id)
      .eq('status', 'pending_payment');

    if (updErr) {
      console.error('[sepay-webhook] Lỗi hoàn tất đơn nạp ví:', updErr);
      return { statusCode: 200, body: { success: true, message: 'Lỗi cập nhật đơn nạp ví', paymentCode } };
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', order.user_id)
      .maybeSingle();

    const currentBalance = Number(prof?.balance || 0);
    const { error: balErr } = await supabase
      .from('profiles')
      .update({ balance: currentBalance + creditAmount })
      .eq('id', order.user_id);

    if (balErr) {
      console.error('[sepay-webhook] Lỗi cộng số dư ví:', balErr);
    }

    await supabase.from('notifications').insert([
      {
        type: 'new_order',
        title: 'Đã nhận nạp tiền ví (SePay)',
        message: `Tài khoản vừa nạp ${creditAmount.toLocaleString('vi-VN')}đ vào ví thành công (Mã ${paymentCode}).`,
        order_id: order.id,
        is_admin: true,
        is_read: false,
      },
      {
        type: 'system',
        title: 'Nạp tiền ví thành công',
        message: `Số dư ví của bạn đã được cộng ${creditAmount.toLocaleString('vi-VN')}đ tự động.`,
        order_id: order.id,
        user_id: order.user_id,
        is_admin: false,
        is_read: false,
      },
    ]);

    await supabase.from('audit_logs').insert([
      {
        actor_name: 'SePay Webhook',
        actor_role: 'system',
        action: 'sepay_webhook_topup',
        entity_type: 'wallet',
        entity_id: paymentCode,
        description: `Ngân hàng SePay báo chuyển khoản nạp ví tự động ${creditAmount.toLocaleString('vi-VN')}đ cho mã #${paymentCode}`,
        metadata: { paymentCode, creditAmount, order_id: order.id },
      },
    ]);

    await notifyTelegram(paymentCode, order, creditAmount, true);
    return { statusCode: 200, body: { success: true, message: 'Đã nạp tiền vào ví thành công', paymentCode, status: 'completed', creditAmount } };
  } else {
    const { error: updErr } = await supabase
      .from('orders')
      .update({ status: 'pending_delivery' })
      .eq('id', order.id)
      .eq('status', 'pending_payment');

    if (updErr) {
      console.error('[sepay-webhook] Lỗi cập nhật đơn:', updErr);
      return { statusCode: 200, body: { success: true, message: 'Lỗi cập nhật đơn hàng', paymentCode } };
    }

    await supabase.from('notifications').insert({
      type: 'new_order',
      title: 'Đã nhận thanh toán (SePay)',
      message: `Đơn ${paymentCode} — ${order.product_name} · ${requiredAmount.toLocaleString('vi-VN')}đ đã được thanh toán, chờ bàn giao.`,
      order_id: order.id,
      is_admin: true,
      is_read: false,
    });

    // Telegram cho đơn mua hàng thường được gửi duy nhất bởi trigger
    // tg_notify_order() khi status chuyển sang pending_delivery.
    // Chỉ đơn nạp ví ở nhánh trên mới gửi trực tiếp vì trigger cố ý bỏ qua topup.
    return { statusCode: 200, body: { success: true, message: 'Đã xác nhận thanh toán đơn hàng', paymentCode, status: 'pending_delivery' } };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Support GET / HEAD / OPTIONS for SePay health check & ping requests
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return res.status(200).json({ status: 'ok', message: 'SePay Webhook Endpoint Ready' });
  }

  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'ignored', message: 'Method ignored' });
  }

  const result = await processSepayWebhook(req.headers, req.body);
  return res.status(result.statusCode).json(result.body);
}

export const netlifyHandler = async (event: any) => {
  if (event.httpMethod === 'GET' || event.httpMethod === 'HEAD' || event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, body: JSON.stringify({ status: 'ok', message: 'SePay Webhook Endpoint Ready' }) };
  }
  const result = await processSepayWebhook(event.headers, event.body);
  return { statusCode: result.statusCode, body: JSON.stringify(result.body) };
};

async function notifyTelegram(
  paymentCode: string,
  order: any,
  amount: number,
  isTopup: boolean,
): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const vnd = (v: number) => v.toLocaleString('vi-VN') + 'đ';

  const text = isTopup
    ? `💳 <b>ĐÃ NẠP TIỀN VÍ TỰ ĐỘNG (SePay)</b>\n\n📦 <b>Mã nạp:</b> <code>#${paymentCode}</code>\n💰 <b>Số tiền nạp:</b> ${vnd(amount || Number(order.price) || 0)}\n📌 <b>Trạng thái:</b> Đã cộng số dư ví thành công!`
    : `✅ <b>ĐÃ NHẬN THANH TOÁN (SePay)</b>\n\n📦 <b>Mã đơn:</b> <code>#${paymentCode}</code>\n🛍 <b>Sản phẩm:</b> ${escapeHtml(order.product_name || 'N/A')}\n📋 <b>Gói:</b> ${escapeHtml(order.plan_label || 'N/A')}\n💰 <b>Số tiền:</b> ${vnd(amount || Number(order.price) || 0)}\n📌 <b>Trạng thái:</b> Chờ bàn giao\n\n👉 Vào <b>Admin Dashboard</b> để bàn giao dịch vụ.`;

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
