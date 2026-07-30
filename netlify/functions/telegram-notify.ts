// netlify/functions/telegram-notify.ts
// Serverless function — KHÔNG expose token ra Frontend
// Được gọi từ Frontend qua: POST /.netlify/functions/telegram-notify

import type { Handler } from '@netlify/functions';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

export const handler: Handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Validate env vars
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[telegram-notify] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env vars');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Telegram not configured' }),
    };
  }

  let payload: any;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { type, order } = payload;

  let text = '';

  if (type === 'new_order' && order) {
    const vnd = (v: number) => v.toLocaleString('vi-VN') + 'đ';
    const date = new Date(order.created_at || Date.now()).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    text = `🔔 <b>ĐƠN HÀNG MỚI</b>

📦 <b>Mã đơn:</b> <code>#${order.payment_code || 'N/A'}</code>
👤 <b>Khách hàng:</b> ${escapeHtml(order.customer_name || 'Thành viên')}
📧 <b>Email:</b> ${escapeHtml(order.customer_email || 'N/A')}
🛍 <b>Sản phẩm:</b> ${escapeHtml(order.product_name || 'N/A')}
📋 <b>Gói:</b> ${escapeHtml(order.plan_label || 'N/A')}
💰 <b>Giá trị:</b> ${vnd(Number(order.price) || 0)}
💳 <b>Thanh toán:</b> ${order.payment_method === 'wallet' ? '✅ Ví số dư (đã thanh toán)' : '⏳ Chuyển khoản ngân hàng (chờ xác nhận)'}
📝 <b>Ghi chú:</b> ${order.notes ? escapeHtml(order.notes) : '—'}
🕐 <b>Thời gian:</b> ${date}

👉 Vào <b>Admin Dashboard</b> để xử lý đơn hàng.`;
  } else if (type === 'order_cancelled' && order) {
    text = `❌ <b>ĐƠN HÀNG BỊ HỦY</b>

📦 <b>Mã đơn:</b> <code>#${order.payment_code || 'N/A'}</code>
🛍 <b>Sản phẩm:</b> ${escapeHtml(order.product_name || 'N/A')}
👤 <b>Khách hàng:</b> ${escapeHtml(order.customer_name || 'Thành viên')}`;
  } else {
    text = `🔔 <b>Thông báo từ BOW</b>\n\n${escapeHtml(payload.message || 'Không có nội dung')}`;
  }

  try {
    const res = await fetch(TELEGRAM_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await res.json() as any;

    if (!data.ok) {
      console.error('[telegram-notify] Telegram API error:', data);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Telegram API error', details: data }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err: any) {
    console.error('[telegram-notify] Fetch error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error', message: err.message }),
    };
  }
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
