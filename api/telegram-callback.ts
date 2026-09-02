// api/telegram-callback.ts — Vercel Serverless Function
// Nhận callback khi admin bấm nút inline trong Telegram (Hướng A).
//   callback_data: "confirm:<order_id>"  -> pending_payment => pending_delivery
//   callback_data: "cancel:<order_id>"   -> pending_payment => cancelled
//
// Telegram gọi tới URL này (đăng ký qua setWebhook). Để chống giả mạo,
// Telegram gửi kèm header "X-Telegram-Bot-Api-Secret-Token" = TELEGRAM_WEBHOOK_SECRET
// (thiết lập lúc setWebhook).
//
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET,
//      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || 'tg_sec_9f4b827e6a1c43d8905b71ea632cb89f';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TG = (method: string) => `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;

async function sendTelegramMessage(chatId: number | string, text: string, replyToMessageId?: number) {
  try {
    const body: any = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    };
    if (replyToMessageId) {
      body.reply_to_message_id = replyToMessageId;
    }

    const res = await fetch(TG('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.error('[telegram-callback] sendTelegramMessage failed:', errJson);
    }
  } catch (err) {
    console.error('[telegram-callback] sendTelegramMessage error:', err);
  }
}

async function processTelegramCallback(
  headers: Record<string, string | string[] | undefined>,
  body: any,
) {
  // ── Xác thực nghiêm ngặt Secret Token từ Telegram ────────────────────
  const secretRaw =
    headers['x-telegram-bot-api-secret-token'] || headers['X-Telegram-Bot-Api-Secret-Token'] || '';
  const secret = Array.isArray(secretRaw) ? secretRaw[0] : secretRaw;
  if (!secret || secret !== TELEGRAM_WEBHOOK_SECRET) {
    console.error('[telegram-callback] Unauthorized — Sai hoặc thiếu Secret Token từ Telegram');
    return { statusCode: 401, body: { error: 'Unauthorized' } };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[telegram-callback] Thiếu SUPABASE env');
    return { statusCode: 500, body: { error: 'Supabase not configured' } };
  }

  let update: any = {};
  if (typeof body === 'string') {
    try {
      update = JSON.parse(body || '{}');
    } catch {
      return { statusCode: 400, body: { error: 'Invalid JSON body' } };
    }
  } else if (typeof body === 'object' && body !== null) {
    update = body;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ═══════════════════════════════════════════════════════════════
  // 1. XỬ LÝ KHI ADMIN REPLY TIN NHẮN ĐỂ BÀN GIAO TÀI KHOẢN
  // ═══════════════════════════════════════════════════════════════
  const msg = update.message;
  if (msg && msg.text) {
    const text = msg.text.trim();
    const chatId = msg.chat?.id;
    const replyTo = msg.reply_to_message;

    let targetOrderId: string | null = null;
    let targetPaymentCode: string | null = null;
    let deliveryContent = text;

    // Trường hợp A: Admin gõ lệnh "/giao <mã_đơn> <nội dung>" hoặc "/deliver <mã_đơn> <nội dung>"
    const cmdMatch = text.match(/^\/(?:giao|deliver|done)\s+([A-Za-z0-9_-]+)\s+([\s\S]+)$/i);
    if (cmdMatch) {
      targetPaymentCode = cmdMatch[1].replace(/^#/, '');
      deliveryContent = cmdMatch[2].trim();
    } 
    // Trường hợp B: Admin bấm Reply tin nhắn thông báo đơn của bot
    else if (replyTo && replyTo.text) {
      // Tìm mã đơn #XXXX trong tin nhắn gốc
      const codeMatch = replyTo.text.match(/#([A-Za-z0-9_-]+)/);
      if (codeMatch) {
        targetPaymentCode = codeMatch[1];
      }
      // Hoặc tìm theo tg_message_id
      if (!targetPaymentCode && replyTo.message_id) {
        const { data: orderMsg } = await supabase
          .from('orders')
          .select('id, payment_code')
          .eq('tg_message_id', replyTo.message_id)
          .maybeSingle();
        if (orderMsg) {
          targetOrderId = orderMsg.id;
          targetPaymentCode = orderMsg.payment_code;
        }
      }
    }

    if (targetPaymentCode || targetOrderId) {
      // Tìm đơn hàng trong DB
      let query = supabase
        .from('orders')
        .select('id, payment_code, product_name, plan_label, price, status, tg_message_id, profiles:profiles!orders_user_profile_fk(full_name, email)');

      if (targetOrderId) {
        query = query.eq('id', targetOrderId);
      } else {
        query = query.ilike('payment_code', `%${targetPaymentCode}%`);
      }

      const { data: order, error: findErr } = await query.maybeSingle();

      if (findErr || !order) {
        await sendTelegramMessage(chatId, `⚠️ Không tìm thấy đơn hàng với mã <code>#${targetPaymentCode || targetOrderId}</code>.`);
        return { statusCode: 200, body: { ok: true, error: 'Order not found' } };
      }

      if (order.status === 'completed') {
        await sendTelegramMessage(chatId, `ℹ️ Đơn hàng <code>#${order.payment_code}</code> đã được bàn giao trước đó rồi.`);
        return { statusCode: 200, body: { ok: true, already_completed: true } };
      }

      if (order.status === 'pending_payment') {
        await sendTelegramMessage(
          chatId,
          `⚠️ <b>ĐƠN HÀNG #${order.payment_code} CHƯA THANH TOÁN!</b>\nKhách hàng chưa chuyển khoản tiền. Vui lòng đợi khách thanh toán xong trước khi bàn giao!`,
          msg.message_id,
        );
        return { statusCode: 200, body: { ok: true, not_paid: true } };
      }

      // Cập nhật trạng thái Hoàn thành + lưu thông tin tài khoản
      const { error: updErr } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          delivery_info: deliveryContent,
          delivered_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (updErr) {
        console.error('[telegram-callback] Delivery update error:', updErr);
        await sendTelegramMessage(chatId, `❌ Lỗi khi cập nhật bàn giao đơn #${order.payment_code}: ${updErr.message}`);
        return { statusCode: 200, body: { ok: false, error: updErr.message } };
      }

      // Ghi audit log
      try {
        await supabase.from('audit_logs').insert({
          action_type: 'ORDER_DELIVERED',
          description: `Đơn hàng #${order.payment_code} (${order.product_name}) đã được bàn giao qua Telegram Bot.`,
          metadata: {
            order_id: order.id,
            payment_code: order.payment_code,
            product_name: order.product_name,
            source: 'telegram_bot',
          },
        });
      } catch (auditErr) {
        console.warn('[telegram-callback] Audit log error:', auditErr);
      }

      // Kích hoạt gửi email bàn giao cho khách (bảo mật, điều hướng về web)
      try {
        const siteUrl = process.env.VITE_APP_URL || process.env.VITE_SITE_URL || 'https://shopofbow.vercel.app';
        await fetch(`${siteUrl}/api/email-notify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.INTERNAL_API_KEY ? { Authorization: `Apikey ${process.env.INTERNAL_API_KEY}` } : {}),
          },
          body: JSON.stringify({
            order_id: order.id,
            type: 'completed',
          }),
        });
      } catch (emailErr) {
        console.warn('[telegram-callback] Email notify trigger error:', emailErr);
      }

      const profile: any = Array.isArray((order as any).profiles)
        ? (order as any).profiles[0]
        : (order as any).profiles;
      const customerName = profile?.full_name || 'Khách hàng';

      // Phản hồi xác nhận thành công cho Admin trên Telegram
      await sendTelegramMessage(
        chatId,
        `🎉 <b>BÀN GIAO THÀNH CÔNG ĐƠN #${order.payment_code}</b>\n\n` +
          `🛍 <b>Sản phẩm:</b> ${escapeHtml(order.product_name)} (${escapeHtml(order.plan_label)})\n` +
          `👤 <b>Khách hàng:</b> ${escapeHtml(customerName)}\n` +
          `💰 <b>Giá trị:</b> ${(Number(order.price) || 0).toLocaleString('vi-VN')}đ\n\n` +
          `📦 <b>Nội dung đã giao:</b>\n<code>${escapeHtml(deliveryContent)}</code>\n\n` +
          `✅ <i>Trạng thái đã chuyển sang <b>HOÀN THÀNH</b>, Web đồng bộ Realtime và tự động gửi Email cho khách!</i>`,
        msg.message_id,
      );

      // Gỡ tổ hợp nút trên tin nhắn thông báo thanh toán / tin nhắn gốc
      const targetMsgIds = new Set<number>();
      if (replyTo?.message_id) targetMsgIds.add(replyTo.message_id);
      if (order.tg_message_id) targetMsgIds.add(order.tg_message_id);

      for (const mid of targetMsgIds) {
        try {
          await fetch(TG('editMessageReplyMarkup'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: mid,
              reply_markup: { inline_keyboard: [] },
            }),
          });
        } catch (e) {
          console.warn('[telegram-callback] remove buttons error:', e);
        }
      }

      return { statusCode: 200, body: { ok: true, delivered: true, order_id: order.id } };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. XỬ LÝ KHI ADMIN BẤM CỤM NÚT (ĐANG XỬ LÝ / BÀN GIAO / HOÀN TIỀN)
  // ═══════════════════════════════════════════════════════════════
  const cb = update.callback_query;
  // Chỉ xử lý sự kiện bấm nút inline. Update khác -> bỏ qua (trả 200).
  if (!cb || !cb.data) {
    return { statusCode: 200, body: { ok: true, ignored: true } };
  }

  const callbackId = cb.id;
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  const [action, orderId] = String(cb.data).split(':');

  if (!orderId) {
    await answerCallback(callbackId, 'Yêu cầu không hợp lệ.');
    return { statusCode: 200, body: { ok: true } };
  }

  // ── Action: Hướng dẫn bàn giao ────────────────────────────
  if (action === 'deliver_guide') {
    await answerCallback(
      callbackId,
      '🎁 Hãy REPLY trực tiếp tin nhắn này kèm nội dung tài khoản (Email, Pass, Link...) để giao ngay cho khách!',
      true,
    );
    return { statusCode: 200, body: { ok: true } };
  }

  // Đọc đơn hiện tại
  const { data: order, error: findErr } = await supabase
    .from('orders')
    .select('id, product_name, plan_label, price, status, payment_code, user_id')
    .eq('id', orderId)
    .maybeSingle();

  if (findErr || !order) {
    await answerCallback(callbackId, 'Không tìm thấy đơn hàng.');
    return { statusCode: 200, body: { ok: true } };
  }

  // Chặn thao tác xử lý / bàn giao / hoàn tiền đối với đơn chưa thanh toán
  if (order.status === 'pending_payment' && action !== 'cancel') {
    await answerCallback(
      callbackId,
      '⚠️ Đơn hàng này CHƯA THANH TOÁN (đang chờ chuyển khoản). Không thể thao tác!',
      true,
    );
    return { statusCode: 200, body: { ok: true, not_paid: true } };
  }

  const siteUrl = process.env.VITE_APP_URL || process.env.VITE_SITE_URL || 'https://shopofbow.vercel.app';

  // ── Action: Chuyển sang Đang xử lý ────────────────────────
  if (action === 'processing') {
    if (order.status === 'completed') {
      await answerCallback(callbackId, 'Đơn hàng này đã được bàn giao hoàn tất trước đó rồi.');
      return { statusCode: 200, body: { ok: true } };
    }
    if (order.status === 'processing') {
      await answerCallback(callbackId, 'Đơn hàng đang ở trạng thái Đang xử lý.');
      return { statusCode: 200, body: { ok: true } };
    }

    const { error: updErr } = await supabase
      .from('orders')
      .update({ status: 'processing' })
      .eq('id', orderId);

    if (updErr) {
      console.error('[telegram-callback] Lỗi chuyển processing:', updErr);
      await answerCallback(callbackId, 'Lỗi cập nhật đơn hàng.');
      return { statusCode: 200, body: { ok: false } };
    }

    // Gửi email thông báo đang thiết lập cho khách
    try {
      await fetch(`${siteUrl}/api/email-notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.INTERNAL_API_KEY ? { Authorization: `Apikey ${process.env.INTERNAL_API_KEY}` } : {}),
        },
        body: JSON.stringify({
          order_id: order.id,
          type: 'processing',
        }),
      });
    } catch (err) {
      console.warn('[telegram-callback] Email processing error:', err);
    }

    await answerCallback(callbackId, '⚙️ Đã chuyển đơn sang Đang xử lý / Thiết lập!');
    await editMarkupProcessing(chatId, messageId, order);
    return { statusCode: 200, body: { ok: true, status: 'processing' } };
  }

  // ── Action: Hoàn tiền về ví cho khách ─────────────────────
  if (action === 'refund') {
    if (order.status === 'refunded') {
      await answerCallback(callbackId, 'Đơn hàng này đã được hoàn tiền trước đó rồi.');
      return { statusCode: 200, body: { ok: true } };
    }
    if (order.status === 'completed') {
      await answerCallback(
        callbackId,
        '⚠️ Đơn hàng đã bàn giao hoàn tất! Để tránh nhầm lẫn, vui lòng vào Web Admin nếu muốn hoàn tiền.',
        true,
      );
      return { statusCode: 200, body: { ok: true } };
    }

    const { error: rpcErr } = await supabase.rpc('refund_order', { p_order_id: orderId });

    if (rpcErr) {
      console.error('[telegram-callback] Lỗi hoàn tiền RPC:', rpcErr);
      // Fallback
      const { error: updErr } = await supabase
        .from('orders')
        .update({ status: 'refunded' })
        .eq('id', orderId);

      if (updErr) {
        await answerCallback(callbackId, 'Lỗi hoàn tiền đơn hàng.');
        return { statusCode: 200, body: { ok: false } };
      }
    }

    // Gửi email thông báo hoàn tiền cho khách
    try {
      await fetch(`${siteUrl}/api/email-notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.INTERNAL_API_KEY ? { Authorization: `Apikey ${process.env.INTERNAL_API_KEY}` } : {}),
        },
        body: JSON.stringify({
          order_id: order.id,
          type: 'refunded',
        }),
      });
    } catch (err) {
      console.warn('[telegram-callback] Email refund error:', err);
    }

    await answerCallback(callbackId, '💸 Đã hoàn tiền về ví cho khách thành công!');
    await editMarkupResolved(chatId, messageId, order, 'refunded', 'manual');

    // Gỡ tổ hợp nút trên cả tg_message_id nếu khác messageId
    if (order.tg_message_id && order.tg_message_id !== messageId) {
      try {
        await fetch(TG('editMessageReplyMarkup'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: order.tg_message_id,
            reply_markup: { inline_keyboard: [] },
          }),
        });
      } catch (e) {
        console.warn('[telegram-callback] remove buttons on tg_message_id error:', e);
      }
    }

    return { statusCode: 200, body: { ok: true, status: 'refunded' } };
  }

  // ── Legacy confirm / cancel fallback ──────────────────────
  const nextStatus = action === 'confirm' ? 'pending_delivery' : 'cancelled';
  await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId);
  await answerCallback(callbackId, action === 'confirm' ? '✅ Đã xác nhận.' : '❌ Đã hủy đơn.');
  await editMarkupResolved(chatId, messageId, order, nextStatus, 'manual');

  return { statusCode: 200, body: { ok: true, status: nextStatus } };
}

// Trả lời popup nhỏ trên Telegram cho admin
async function answerCallback(callbackQueryId: string, text: string, showAlert = false): Promise<void> {
  try {
    await fetch(TG('answerCallbackQuery'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: showAlert }),
    });
  } catch (err) {
    console.warn('[telegram-callback] answerCallbackQuery failed:', err);
  }
}

// Chuyển sang giao diện Đang xử lý
async function editMarkupProcessing(
  chatId: number | undefined,
  messageId: number | undefined,
  order: any,
): Promise<void> {
  if (!chatId || !messageId) return;

  const baseText = `⚙️ <b>ĐƠN HÀNG ĐANG ĐƯỢC THIẾT LẬP / XỬ LÝ</b>\n\n` +
    `📦 <b>Mã đơn:</b> <code>#${order.payment_code || 'N/A'}</code>\n` +
    `🛍 <b>Sản phẩm:</b> ${escapeHtml(order.product_name || 'N/A')}\n` +
    `📋 <b>Gói:</b> ${escapeHtml(order.plan_label || 'N/A')}\n` +
    `💰 <b>Giá trị:</b> ${(Number(order.price) || 0).toLocaleString('vi-VN')}đ\n\n` +
    `⚡ <i>Reply tin nhắn này kèm thông tin tài khoản khi hoàn tất để bàn giao ngay!</i>`;

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
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🎁 Bàn giao', callback_data: `deliver_guide:${order.id}` },
              { text: '💸 Hoàn tiền ví', callback_data: `refund:${order.id}` },
            ],
          ],
        },
      }),
    });
  } catch (err) {
    console.warn('[telegram-callback] editMarkupProcessing failed:', err);
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const result = await processTelegramCallback(req.headers, req.body);
  return res.status(result.statusCode).json(result.body);
}

