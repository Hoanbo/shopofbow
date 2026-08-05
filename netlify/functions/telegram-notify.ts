// netlify/functions/telegram-notify.ts
// ============================================================
// Gửi thông báo Telegram cho admin về đơn hàng.
//
// BẢO MẬT (đã vá lỗ hổng public/no-auth):
//   • BẮT BUỘC header  Authorization: Apikey <INTERNAL_API_KEY>
//     (giống cơ chế của sepay-webhook). Không có / sai secret => 401.
//   • Chỉ được gọi SERVER→SERVER từ DB trigger (pg_net), KHÔNG phải client.
//     Vì vậy secret không bao giờ vào bundle JS.
//   • Client KHÔNG còn được cung cấp nội dung. Function chỉ nhận:
//         { order_id: uuid, event: 'new_order' | 'order_cancelled' }
//     rồi TỰ ĐỌC đơn từ DB bằng service_role => customer_name / product_name
//     / price... luôn là dữ liệu tin cậy, client không thể giả mạo.
//   • Không còn nhánh gửi "message" tự do.
//
// Env (Netlify): INTERNAL_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
//                SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

type OrderEvent = 'new_order' | 'order_paid' | 'order_completed' | 'order_cancelled' | 'order_refunded';

export const handler: Handler = async (event) => {
  // 1. Chỉ chấp nhận POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // 2. Xác thực secret (thống nhất với sepay-webhook: "Apikey <key>")
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  if (!INTERNAL_API_KEY || authHeader !== `Apikey ${INTERNAL_API_KEY}`) {
    console.error('[telegram-notify] Unauthorized — thiếu hoặc sai INTERNAL_API_KEY');
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // 3. Kiểm tra cấu hình bắt buộc
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[telegram-notify] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return { statusCode: 500, body: JSON.stringify({ error: 'Telegram not configured' }) };
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[telegram-notify] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  // 4. Parse & validate payload — chỉ nhận order_id + event
  let payload: any;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const orderId: unknown = payload.order_id;
  const evt: unknown = payload.event;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid order_id' }) };
  }
  const validEvents = ['new_order', 'order_paid', 'order_completed', 'order_cancelled', 'order_refunded'];
  if (typeof evt !== 'string' || !validEvents.includes(evt)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid event' }) };
  }
  const orderEvent = evt as OrderEvent;

  // 5. Đọc đơn hàng TỪ DB (nguồn dữ liệu tin cậy) — client không cấp nội dung
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: order, error: findErr } = await supabase
    .from('orders')
    .select(
      'id, user_id, product_name, plan_label, price, status, payment_code, notes, created_at, tg_message_id, ' +
        'profiles:profiles!orders_user_profile_fk(full_name, email)',
    )
    .eq('id', orderId)
    .maybeSingle();

  if (findErr) {
    console.error('[telegram-notify] Lỗi truy vấn đơn:', findErr);
    return { statusCode: 500, body: JSON.stringify({ error: 'Order lookup failed' }) };
  }
  if (!order) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Order not found' }) };
  }

  const profile: any = Array.isArray((order as any).profiles)
    ? (order as any).profiles[0]
    : (order as any).profiles;
  const customerName = profile?.full_name || 'Thành viên';
  const customerEmail = profile?.email || 'N/A';

  // 6. Dựng nội dung từ dữ liệu DB
  const vnd = (v: number) => (Number(v) || 0).toLocaleString('vi-VN') + 'đ';
  const dateStr = new Date((order as any).created_at || Date.now()).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let text = '';
  let replyMarkup: any = undefined;

  if (orderEvent === 'new_order') {
    const isQrPending = (order as any).status === 'pending_payment';
    text = `🔔 <b>ĐƠN HÀNG MỚI</b>

📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>
👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}
📧 <b>Email:</b> ${escapeHtml(customerEmail)}
🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}
📋 <b>Gói:</b> ${escapeHtml((order as any).plan_label || 'N/A')}
💰 <b>Giá trị:</b> ${vnd((order as any).price)}
💳 <b>Thanh toán:</b> ${isQrPending ? '⏳ Chuyển khoản ngân hàng (chờ xác nhận)' : '✅ Đã trừ tiền từ Ví'}
📝 <b>Ghi chú:</b> ${(order as any).notes ? escapeHtml((order as any).notes) : '—'}
🕐 <b>Thời gian:</b> ${dateStr}

${isQrPending ? '👉 SePay sẽ tự xác nhận khi tiền vào. Nếu cần, bấm nút bên dưới để duyệt thủ công.' : '👉 Vào <b>Admin Dashboard</b> để bàn giao tài khoản.'}`;

    if (isQrPending) {
      replyMarkup = {
        inline_keyboard: [
          [
            { text: '✅ Xác nhận đã nhận tiền', callback_data: `confirm:${(order as any).id}` },
            { text: '❌ Hủy đơn', callback_data: `cancel:${(order as any).id}` },
          ],
        ],
      };
    }
  } else if (orderEvent === 'order_paid') {
    text = `🟢 <b>XÁC NHẬN ĐÃ NHẬN TIỀN</b>

📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>
👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}
🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}
💰 <b>Giá trị:</b> ${vnd((order as any).price)}
💳 <b>Trạng thái:</b> ✅ Đã nhận thanh toán từ Ngân hàng (SePay)

👉 Đơn hàng đang ở trạng thái <b>Chờ bàn giao</b>. Vui lòng vào Admin Dashboard để bàn giao tài khoản.`;
  } else if (orderEvent === 'order_completed') {
    text = `🎉 <b>ĐƠN HÀNG ĐÃ BÀN GIAO HOÀN TẤT</b>

📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>
👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}
🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}
💰 <b>Giá trị:</b> ${vnd((order as any).price)}
✅ <b>Trạng thái:</b> Đã bàn giao tài khoản thành công cho khách hàng!`;
  } else if (orderEvent === 'order_refunded') {
    text = `💸 <b>ĐÃ HOÀN TIỀN ĐƠN HÀNG VỀ VÍ</b>

📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>
👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}
🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}
💰 <b>Số tiền hoàn:</b> ${vnd((order as any).price)}
🔄 <b>Trạng thái:</b> Đã cộng lại tiền vào Số dư ví khách hàng.`;
  } else {
    // order_cancelled
    text = `❌ <b>ĐƠN HÀNG BỊ HỦY</b>

📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>
🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}
👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}
💰 <b>Giá trị:</b> ${vnd((order as any).price)}`;
  }

  // 7. Gửi Telegram
  try {
    const res = await fetch(TELEGRAM_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });

    const data = (await res.json()) as any;
    if (!data.ok) {
      console.error('[telegram-notify] Telegram API error:', data);
      return { statusCode: 502, body: JSON.stringify({ error: 'Telegram API error' }) };
    }

    // Lưu message_id để webhook/callback gỡ nút sau này (chỉ đơn QR chờ thanh toán)
    const messageId = data.result?.message_id;
    if (messageId && orderEvent === 'new_order') {
      try {
        await supabase.from('orders').update({ tg_message_id: messageId }).eq('id', (order as any).id);
      } catch (err) {
        console.warn('[telegram-notify] Không lưu được tg_message_id:', err);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, message_id: messageId ?? null }) };
  } catch (err: any) {
    console.error('[telegram-notify] Fetch error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
