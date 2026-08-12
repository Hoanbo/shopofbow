// api/telegram-notify.ts — Vercel Serverless Function & Netlify Function Compatibility
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
type OrderEvent = 'new_order' | 'order_paid' | 'order_processing' | 'order_completed' | 'order_cancelled' | 'order_refunded';

async function processTelegramNotify(headers: Record<string, string | string[] | undefined>, body: any) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[telegram-notify] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return { statusCode: 500, body: { error: 'Telegram not configured' } };
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[telegram-notify] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return { statusCode: 500, body: { error: 'Supabase not configured' } };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authHeaderRaw = headers['authorization'] || headers['Authorization'] || '';
  const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;
  let isAuthorized = false;

  if (INTERNAL_API_KEY && authHeader === `Apikey ${INTERNAL_API_KEY}`) {
    isAuthorized = true;
  } else if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (user && !error) {
      if (user.email?.toLowerCase() === 'hoankb4@gmail.com') {
        isAuthorized = true;
      } else {
        const { data: isAdmin } = await supabase
          .from('admins')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (isAdmin) isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    console.error('[telegram-notify] Unauthorized request header:', authHeader);
    return { statusCode: 401, body: { error: 'Unauthorized' } };
  }

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

  const orderId: unknown = payload.order_id;
  const evt: unknown = payload.event;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
    return { statusCode: 400, body: { error: 'Missing or invalid order_id' } };
  }
  const validEvents = ['new_order', 'order_paid', 'order_processing', 'order_completed', 'order_cancelled', 'order_refunded'];
  if (typeof evt !== 'string' || !validEvents.includes(evt)) {
    return { statusCode: 400, body: { error: 'Missing or invalid event' } };
  }
  const orderEvent = evt as OrderEvent;

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
    return { statusCode: 500, body: { error: 'Order lookup failed' } };
  }
  if (!order) {
    return { statusCode: 404, body: { error: 'Order not found' } };
  }

  const profile: any = Array.isArray((order as any).profiles)
    ? (order as any).profiles[0]
    : (order as any).profiles;
  const customerName = profile?.full_name || 'Thành viên';
  const customerEmail = profile?.email || 'N/A';

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
    text = `🔔 <b>ĐƠN HÀNG MỚI</b>\n\n📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>\n👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}\n📧 <b>Email:</b> ${escapeHtml(customerEmail)}\n🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}\n📋 <b>Gói:</b> ${escapeHtml((order as any).plan_label || 'N/A')}\n💰 <b>Giá trị:</b> ${vnd((order as any).price)}\n💳 <b>Thanh toán:</b> ${isQrPending ? '⏳ Chuyển khoản ngân hàng (chờ xác nhận)' : '✅ Đã trừ tiền từ Ví'}\n📝 <b>Ghi chú:</b> ${(order as any).notes ? escapeHtml((order as any).notes) : '—'}\n🕐 <b>Thời gian:</b> ${dateStr}\n\n${isQrPending ? '👉 SePay sẽ tự xác nhận khi tiền vào. Nếu cần, bấm nút bên dưới để duyệt thủ công.' : '👉 Vào <b>Admin Dashboard</b> để bàn giao tài khoản.'}`;

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
    text = `🟢 <b>XÁC NHẬN ĐÃ NHẬN TIỀN</b>\n\n📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>\n👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}\n🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}\n💰 <b>Giá trị:</b> ${vnd((order as any).price)}\n💳 <b>Trạng thái:</b> ✅ Đã nhận thanh toán từ Ngân hàng (SePay)\n\n👉 Đơn hàng đang ở trạng thái <b>Chờ bàn giao</b>. Vui lòng vào Admin Dashboard để bàn giao tài khoản.`;
  } else if (orderEvent === 'order_processing') {
    text = `⚙️ <b>ĐƠN HÀNG ĐANG ĐƯỢC THIẾT LẬP / XỬ LÝ</b>\n\n📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>\n👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}\n📧 <b>Email:</b> ${escapeHtml(customerEmail)}\n🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}\n💰 <b>Giá trị:</b> ${vnd((order as any).price)}\n⚙️ <b>Trạng thái:</b> Đã chuyển sang <b>Đang xử lý / Thiết lập tài khoản</b>.`;
  } else if (orderEvent === 'order_completed') {
    text = `🎉 <b>ĐƠN HÀNG ĐÃ BÀN GIAO HOÀN TẤT</b>\n\n📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>\n👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}\n🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}\n💰 <b>Giá trị:</b> ${vnd((order as any).price)}\n✅ <b>Trạng thái:</b> Đã bàn giao tài khoản thành công cho khách hàng!`;
  } else if (orderEvent === 'order_refunded') {
    text = `💸 <b>ĐÃ HOÀN TIỀN ĐƠN HÀNG VỀ VÍ</b>\n\n📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>\n👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}\n🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}\n💰 <b>Số tiền hoàn:</b> ${vnd((order as any).price)}\n🔄 <b>Trạng thái:</b> Đã cộng lại tiền vào Số dư ví khách hàng.`;
  } else {
    text = `❌ <b>ĐƠN HÀNG BỊ HỦY</b>\n\n📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>\n🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}\n👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}\n💰 <b>Giá trị:</b> ${vnd((order as any).price)}`;
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
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });

    const data = (await res.json()) as any;
    if (!data.ok) {
      console.error('[telegram-notify] Telegram API error:', data);
      return { statusCode: 502, body: { error: 'Telegram API error' } };
    }

    const messageId = data.result?.message_id;
    if (messageId && orderEvent === 'new_order') {
      try {
        await supabase.from('orders').update({ tg_message_id: messageId }).eq('id', (order as any).id);
      } catch (err) {
        console.warn('[telegram-notify] Không lưu được tg_message_id:', err);
      }
    }

    return { statusCode: 200, body: { success: true, message_id: messageId ?? null } };
  } catch (err: any) {
    console.error('[telegram-notify] Fetch error:', err);
    return { statusCode: 500, body: { error: 'Internal error' } };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const result = await processTelegramNotify(req.headers, req.body);
  return res.status(result.statusCode).json(result.body);
}

export const netlifyHandler = async (event: any) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const result = await processTelegramNotify(event.headers, event.body);
  return { statusCode: result.statusCode, body: JSON.stringify(result.body) };
};

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
