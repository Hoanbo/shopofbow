// api/telegram-notify.ts — Vercel Serverless Function
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
type OrderEvent = 'new_order' | 'order_paid' | 'order_processing' | 'order_completed' | 'order_cancelled' | 'order_refunded';
type TicketEvent = 'ticket_created' | 'ticket_user_message' | 'ticket_resolved' | 'ticket_closed';

async function checkIsAdmin(supabase: SupabaseClient, userId: string, email?: string): Promise<boolean> {
  if (email?.toLowerCase() === 'hoankb4@gmail.com') return true;
  const { data } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

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
  
  let isInternalKey = false;
  let authenticatedUser: any = null;
  let isAdmin = false;

  if (INTERNAL_API_KEY && authHeader === `Apikey ${INTERNAL_API_KEY}`) {
    isInternalKey = true;
    isAdmin = true;
  } else if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (user && !error) {
      authenticatedUser = user;
      isAdmin = await checkIsAdmin(supabase, user.id, user.email);
    }
  }

  if (!isInternalKey && !authenticatedUser) {
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

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // ─────────────────────────────────────────────────────────────
  // 1. TICKET NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────
  if (payload.ticket_id) {
    const ticketId = payload.ticket_id;
    if (typeof ticketId !== 'string' || !UUID_RE.test(ticketId)) {
      return { statusCode: 400, body: { error: 'Missing or invalid ticket_id' } };
    }

    const ticketEvent = (payload.event || 'ticket_created') as TicketEvent;
    const { data: ticket, error: tErr } = await supabase
      .from('support_tickets')
      .select('*, profiles:profiles!support_tickets_user_id_fkey(full_name, email), orders:orders(payment_code)')
      .eq('id', ticketId)
      .maybeSingle();

    if (tErr || !ticket) {
      console.error('[telegram-notify] Ticket lookup failed:', tErr);
      return { statusCode: 404, body: { error: 'Ticket not found' } };
    }

    // 🔒 BẢO MẬT: Kiểm tra quyền sở hữu Ticket và loại event
    if (!isAdmin) {
      // User thường CHỈ được thông báo trên ticket của chính mình
      if (ticket.user_id !== authenticatedUser.id) {
        console.error(`[telegram-notify] Forbidden: User ${authenticatedUser.id} tried to notify for ticket owned by ${ticket.user_id}`);
        return { statusCode: 403, body: { error: 'Forbidden: You do not own this ticket' } };
      }
      // User thường chỉ được gửi các event của user, không được gửi ticket_resolved
      if (ticketEvent === 'ticket_resolved') {
        return { statusCode: 403, body: { error: 'Forbidden: Only admin can resolve tickets' } };
      }
    }

    const profile: any = ticket.profiles;
    const customerName = profile?.full_name || 'Khách hàng';
    const customerEmail = profile?.email || 'N/A';
    const customMsg = payload.message ? String(payload.message).trim() : '';

    const dateStr = new Date().toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const priorityLabel = ticket.priority === 'urgent'
      ? '🔴 KHẨN CẤP'
      : ticket.priority === 'high'
      ? '🟠 Cao'
      : ticket.priority === 'low'
      ? '🟢 Thấp'
      : '🔵 Bình thường';

    let text = '';
    if (ticketEvent === 'ticket_created') {
      text = `🎫 <b>YÊU CẦU HỖ TRỢ MỚI (TICKET)</b>\n\n` +
        `📋 <b>Mã Ticket:</b> <code>#${escapeHtml(ticket.ticket_number)}</code>\n` +
        `👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}\n` +
        `📧 <b>Email:</b> ${escapeHtml(customerEmail)}\n` +
        `🔥 <b>Độ ưu tiên:</b> ${priorityLabel}\n` +
        `📌 <b>Chủ đề:</b> ${escapeHtml(ticket.subject)}\n` +
        (ticket.orders?.payment_code ? `📦 <b>Đơn hàng liên quan:</b> <code>#${ticket.orders.payment_code}</code>\n` : '') +
        (customMsg ? `💬 <b>Nội dung:</b>\n<i>${escapeHtml(customMsg)}</i>\n\n` : '\n') +
        `🕐 <b>Thời gian:</b> ${dateStr}\n\n` +
        `👉 Vào <b>Admin > Ticket hỗ trợ</b> trên website để chat và phản hồi cho khách.`;
    } else if (ticketEvent === 'ticket_user_message') {
      text = `💬 <b>KHÁCH HÀNG NHẮN TIN TICKET</b>\n\n` +
        `📋 <b>Mã Ticket:</b> <code>#${escapeHtml(ticket.ticket_number)}</code>\n` +
        `👤 <b>Khách hàng:</b> ${escapeHtml(customerName)} (<code>${escapeHtml(customerEmail)}</code>)\n` +
        `📌 <b>Chủ đề:</b> ${escapeHtml(ticket.subject)}\n` +
        `💬 <b>Tin nhắn mới:</b>\n<i>${escapeHtml(customMsg || 'Có tin nhắn mới từ khách hàng')}</i>\n\n` +
        `🕐 <b>Thời gian:</b> ${dateStr}\n\n` +
        `👉 Vào <b>Admin > Ticket hỗ trợ</b> để trả lời.`;
    } else if (ticketEvent === 'ticket_resolved') {
      text = `🟢 <b>TICKET ĐÃ GIẢI QUYẾT XONG</b>\n\n` +
        `📋 <b>Mã Ticket:</b> <code>#${escapeHtml(ticket.ticket_number)}</code>\n` +
        `👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}\n` +
        `📌 <b>Chủ đề:</b> ${escapeHtml(ticket.subject)}\n` +
        `✅ <b>Trạng thái:</b> Đã giải quyết (Đang chờ khách hàng kiểm tra & xác nhận)\n` +
        `🕐 <b>Thời gian:</b> ${dateStr}`;
    } else {
      text = `🔒 <b>KHÁCH HÀNG ĐÃ ĐÓNG TICKET</b>\n\n` +
        `📋 <b>Mã Ticket:</b> <code>#${escapeHtml(ticket.ticket_number)}</code>\n` +
        `👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}\n` +
        `📌 <b>Chủ đề:</b> ${escapeHtml(ticket.subject)}\n` +
        `✅ <b>Trạng thái:</b> Khách hàng đã xác nhận hài lòng và đóng vé hỗ trợ!\n` +
        `🕐 <b>Thời gian:</b> ${dateStr}`;
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

      const data = (await res.json()) as any;
      if (!data.ok) {
        console.error('[telegram-notify] Ticket Telegram API error:', data);
        return { statusCode: 502, body: { error: 'Telegram API error' } };
      }

      return { statusCode: 200, body: { success: true, ticket_number: ticket.ticket_number } };
    } catch (err: any) {
      console.error('[telegram-notify] Ticket Fetch error:', err);
      return { statusCode: 500, body: { error: 'Internal error' } };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ORDER NOTIFICATIONS (🔒 BẢO MẬT: Chỉ Admin hoặc Internal API Key)
  // ─────────────────────────────────────────────────────────────
  if (!isAdmin) {
    console.error('[telegram-notify] Non-admin tried to trigger order notification');
    return { statusCode: 403, body: { error: 'Forbidden: Admin access required for order notifications' } };
  }

  const orderId: unknown = payload.order_id;
  const evt: unknown = payload.event;

  if (typeof orderId !== 'string' || !UUID_RE.test(orderId)) {
    return { statusCode: 400, body: { error: 'Missing or invalid order_id or ticket_id' } };
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
    if (isQrPending) {
      text = `🔔 <b>ĐƠN HÀNG MỚI (CHỜ THANH TOÁN)</b>\n\n` +
        `📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>\n` +
        `👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}\n` +
        `📧 <b>Email:</b> ${escapeHtml(customerEmail)}\n` +
        `🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}\n` +
        `📋 <b>Gói:</b> ${escapeHtml((order as any).plan_label || 'N/A')}\n` +
        `💰 <b>Giá trị:</b> ${vnd((order as any).price)}\n` +
        `💳 <b>Thanh toán:</b> ⏳ Chờ chuyển khoản ngân hàng\n` +
        `📝 <b>Ghi chú:</b> ${(order as any).notes ? escapeHtml((order as any).notes) : '—'}\n` +
        `🕐 <b>Thời gian:</b> ${dateStr}\n\n` +
        `⏳ <i>Đơn hàng đang chờ khách quét mã VietQR. Hệ thống sẽ tự động thông báo & mở nút bàn giao ngay khi nhận được tiền từ SePay!</i>`;

      // KHÔNG CUNG CẤP NÚT BÀN GIAO / XỬ LÝ / HOÀN TIỀN CHO ĐƠN CHƯA THANH TOÁN
      replyMarkup = undefined;
    } else {
      // Đơn thanh toán bằng Ví (đã trừ tiền thành công)
      text = `🔔 <b>ĐƠN HÀNG MỚI (ĐÃ TRỪ TIỀN VÍ)</b>\n\n` +
        `📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>\n` +
        `👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}\n` +
        `📧 <b>Email:</b> ${escapeHtml(customerEmail)}\n` +
        `🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}\n` +
        `📋 <b>Gói:</b> ${escapeHtml((order as any).plan_label || 'N/A')}\n` +
        `💰 <b>Giá trị:</b> ${vnd((order as any).price)}\n` +
        `💳 <b>Thanh toán:</b> ✅ Đã trừ tiền từ Ví\n` +
        `📝 <b>Ghi chú:</b> ${(order as any).notes ? escapeHtml((order as any).notes) : '—'}\n` +
        `🕐 <b>Thời gian:</b> ${dateStr}\n\n` +
        `⚡ <b>BÀN GIAO 1-CHẠM:</b> <i>Reply tin nhắn này kèm nội dung tài khoản để giao ngay cho khách!</i>`;

      replyMarkup = {
        inline_keyboard: [
          [
            { text: '⚙️ Đang xử lý', callback_data: `processing:${(order as any).id}` },
            { text: '🎁 Bàn giao', callback_data: `deliver_guide:${(order as any).id}` },
          ],
          [
            { text: '💸 Hoàn tiền ví', callback_data: `refund:${(order as any).id}` },
          ],
        ],
      };
    }
  } else if (orderEvent === 'order_paid') {
    text = `🟢 <b>ĐƠN HÀNG ĐÃ THANH TOÁN THÀNH CÔNG</b>\n\n` +
      `📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>\n` +
      `👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}\n` +
      `📧 <b>Email:</b> ${escapeHtml(customerEmail)}\n` +
      `🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}\n` +
      `📋 <b>Gói:</b> ${escapeHtml((order as any).plan_label || 'N/A')}\n` +
      `💰 <b>Giá trị:</b> ${vnd((order as any).price)}\n` +
      `💳 <b>Trạng thái:</b> ✅ Đã nhận thanh toán từ Ngân hàng (SePay)\n\n` +
      `⚡ <b>BÀN GIAO 1-CHẠM:</b>\n👉 <i>Reply tin nhắn này kèm nội dung tài khoản/mật khẩu/link để tự động bàn giao ngay cho khách!</i>`;

    replyMarkup = {
      inline_keyboard: [
        [
          { text: '⚙️ Đang xử lý', callback_data: `processing:${(order as any).id}` },
          { text: '🎁 Bàn giao', callback_data: `deliver_guide:${(order as any).id}` },
        ],
        [
          { text: '💸 Hoàn tiền ví', callback_data: `refund:${(order as any).id}` },
        ],
      ],
    };
  } else if (orderEvent === 'order_processing') {
    text = `⚙️ <b>ĐƠN HÀNG ĐANG ĐƯỢC THIẾT LẬP / XỬ LÝ</b>\n\n` +
      `📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>\n` +
      `👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}\n` +
      `📧 <b>Email:</b> ${escapeHtml(customerEmail)}\n` +
      `🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}\n` +
      `💰 <b>Giá trị:</b> ${vnd((order as any).price)}\n` +
      `⚙️ <b>Trạng thái:</b> Đã chuyển sang <b>Đang xử lý / Thiết lập tài khoản</b>.\n\n` +
      `⚡ <i>Reply tin nhắn này kèm thông tin tài khoản khi hoàn tất để bàn giao ngay!</i>`;

    replyMarkup = {
      inline_keyboard: [
        [
          { text: '🎁 Bàn giao', callback_data: `deliver_guide:${(order as any).id}` },
          { text: '💸 Hoàn tiền ví', callback_data: `refund:${(order as any).id}` },
        ],
      ],
    };
  } else if (orderEvent === 'order_completed') {
    text = `🎉 <b>ĐƠN HÀNG ĐÃ BÀN GIAO HOÀN TẤT</b>\n\n` +
      `📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>\n` +
      `👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}\n` +
      `🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}\n` +
      `💰 <b>Giá trị:</b> ${vnd((order as any).price)}\n` +
      `✅ <b>Trạng thái:</b> Đã bàn giao tài khoản thành công cho khách hàng!`;
  } else if (orderEvent === 'order_refunded') {
    text = `💸 <b>ĐÃ HOÀN TIỀN ĐƠN HÀNG VỀ VÍ</b>\n\n` +
      `📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>\n` +
      `👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}\n` +
      `🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}\n` +
      `💰 <b>Số tiền hoàn:</b> ${vnd((order as any).price)}\n` +
      `🔄 <b>Trạng thái:</b> Đã cộng lại tiền vào Số dư ví khách hàng.`;
  } else {
    text = `❌ <b>ĐƠN HÀNG BỊ HỦY</b>\n\n` +
      `📦 <b>Mã đơn:</b> <code>#${escapeHtml((order as any).payment_code || 'N/A')}</code>\n` +
      `🛍 <b>Sản phẩm:</b> ${escapeHtml((order as any).product_name || 'N/A')}\n` +
      `👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}\n` +
      `💰 <b>Giá trị:</b> ${vnd((order as any).price)}`;
  }

  try {
    // 1. Gỡ tổ hợp nút trên tin nhắn thanh toán trước đó (nếu có) khi đơn chuyển sang Đã giao / Hoàn tiền / Đã hủy
    if (['order_completed', 'order_refunded', 'order_cancelled'].includes(orderEvent) && (order as any).tg_message_id) {
      try {
        const TG_EDIT_MARKUP = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`;
        await fetch(TG_EDIT_MARKUP, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            message_id: (order as any).tg_message_id,
            reply_markup: { inline_keyboard: [] },
          }),
        });
      } catch (editErr) {
        console.warn('[telegram-notify] Không thể gỡ nút trên tin nhắn cũ:', editErr);
      }
    }

    // 2. Gửi tin nhắn thông báo mới
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
    // Lưu ID tin nhắn có nút bấm (đơn mới bằng ví hoặc thanh toán SePay thành công) để gỡ nút sau này
    if (messageId && (orderEvent === 'new_order' || orderEvent === 'order_paid' || orderEvent === 'order_processing')) {
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


function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
