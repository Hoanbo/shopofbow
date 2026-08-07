// api/email-notify.ts — Vercel Serverless Function & Netlify Function Compatibility
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.VITE_APP_URL || 'https://shopofbow.vercel.app';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_USER = process.env.SMTP_USER || 'hoankb4@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

async function processEmailNotify(headers: Record<string, string | string[] | undefined>, body: any) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[email-notify] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return { statusCode: 500, body: { error: 'Supabase not configured' } };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    console.error('[email-notify] Unauthorized request header:', authHeader);
    return { statusCode: 401, body: { error: 'Unauthorized' } };
  }

  let payload: { order_id?: string; type?: 'completed' | 'refunded' } = {};
  if (typeof body === 'string') {
    try {
      payload = JSON.parse(body || '{}');
    } catch {
      return { statusCode: 400, body: { error: 'Invalid JSON payload' } };
    }
  } else if (typeof body === 'object' && body !== null) {
    payload = body;
  }

  const { order_id } = payload;
  if (!order_id) {
    return { statusCode: 400, body: { error: 'order_id is required' } };
  }

  try {
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, user_id, product_name, plan_label, price, payment_code, status')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) {
      console.error('[email-notify] Order not found:', orderErr);
      return { statusCode: 404, body: { error: 'Order not found' } };
    }

    if (!order.user_id) {
      console.log('[email-notify] Guest order without user_id, skipping email.');
      return { statusCode: 200, body: { status: 'skipped_no_user' } };
    }

    const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(order.user_id);
    if (userErr || !userData.user?.email) {
      console.error('[email-notify] Cannot fetch user email:', userErr);
      return { statusCode: 404, body: { error: 'User email not found' } };
    }

    const userEmail = userData.user.email;
    const formattedPrice = Number(order.price || 0).toLocaleString('vi-VN') + 'đ';
    const emailType = payload.type || (order.status === 'refunded' ? 'refunded' : 'completed');

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      try {
        let tgText = '';
        if (emailType === 'refunded') {
          tgText = `💸 <b>ĐÃ HOÀN TIỀN ĐƠN HÀNG VỀ VÍ</b>\n\n📦 <b>Mã đơn:</b> <code>#${order.payment_code}</code>\n👤 <b>Khách hàng:</b> ${userEmail}\n🛍 <b>Sản phẩm:</b> ${order.product_name} (${order.plan_label})\n💰 <b>Số tiền hoàn:</b> ${formattedPrice}\n🔄 <b>Trạng thái:</b> Đã hoàn tiền về ví cho khách hàng!`;
        } else {
          tgText = `🎉 <b>ĐƠN HÀNG ĐÃ BÀN GIAO HOÀN TẤT</b>\n\n📦 <b>Mã đơn:</b> <code>#${order.payment_code}</code>\n👤 <b>Khách hàng:</b> ${userEmail}\n🛍 <b>Sản phẩm:</b> ${order.product_name} (${order.plan_label})\n💰 <b>Giá trị:</b> ${formattedPrice}\n✅ <b>Trạng thái:</b> Đã bàn giao tài khoản thành công cho khách!`;
        }
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: tgText,
            parse_mode: 'HTML',
          }),
        });
        console.log(`[email-notify] Telegram notification sent to Chat ID ${TELEGRAM_CHAT_ID}`);
      } catch (tgErr) {
        console.warn('[email-notify] Telegram send error:', tgErr);
      }
    }

    let emailSubject = '';
    let badgeText = '';
    let badgeColor = '';
    let titleText = '';
    let descHtml = '';
    let btnText = '';
    let btnUrl = '';

    if (emailType === 'refunded') {
      emailSubject = `💸 [BOW] Đã hoàn tiền đơn hàng #${order.payment_code} vào số dư ví của bạn!`;
      badgeText = 'HOÀN TIỀN VỀ VÍ';
      badgeColor = 'background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);';
      titleText = '💸 Đã hoàn tiền vào ví thành công!';
      descHtml = `Số tiền <strong style="color: #f59e0b;">${formattedPrice}</strong> của đơn hàng <strong style="color: #ffffff;">${order.product_name}</strong> đã được cộng lại 100% vào số dư ví cá nhân của bạn.`;
      btnText = '💳 KIỂM TRA SỐ DƯ VÍ TRÊN WEB';
      btnUrl = `${SITE_URL}/dashboard?tab=wallet`;
    } else {
      emailSubject = `🎉 [BOW] Đơn hàng #${order.payment_code} đã được bàn giao thành công!`;
      badgeText = 'BÀN GIAO THÀNH CÔNG';
      badgeColor = 'background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);';
      titleText = 'Đơn hàng của bạn đã sẵn sàng!';
      descHtml = `Đơn hàng dịch vụ <strong style="color: #ffffff;">${order.product_name}</strong> đã được đội ngũ BOW bàn giao xử lý hoàn tất.`;
      btnText = '🔑 XEM THÔNG TIN TÀI KHOẢN TRÊN WEB';
      btnUrl = `${SITE_URL}/dashboard?tab=orders`;
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b1120; color: #e2e8f0; margin: 0; padding: 24px; }
          .card { max-width: 540px; margin: 0 auto; background: linear-gradient(180deg, #15233e 0%, #0f172a 100%); border: 1px solid #1e293b; border-radius: 24px; padding: 32px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
          .badge { display: inline-block; ${badgeColor} font-size: 11px; font-weight: 900; text-transform: uppercase; padding: 6px 14px; border-radius: 99px; letter-spacing: 1px; }
          .title { font-size: 22px; font-weight: 900; color: #ffffff; margin-top: 16px; margin-bottom: 8px; }
          .text { font-size: 14px; color: #94a3b8; line-height: 1.6; }
          .info-box { background: rgba(15, 23, 42, 0.8); border: 1px solid #334155; border-radius: 16px; padding: 16px; margin: 24px 0; text-align: left; }
          .row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
          .row:last-child { margin-bottom: 0; }
          .label { color: #64748b; font-weight: 600; }
          .value { color: #f8fafc; font-weight: 800; }
          .btn { display: inline-block; background: linear-gradient(90deg, #00A3FF 0%, #2563EB 100%); color: #ffffff; font-weight: 900; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 14px; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 8px 20px rgba(37, 99, 235, 0.4); }
          .footer { font-size: 11px; color: #475569; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">${badgeText}</div>
          <div class="title">${titleText}</div>
          <div class="text">${descHtml}</div>

          <div class="info-box">
            <div class="row">
              <span class="label">Mã đơn hàng:</span>
              <span class="value" style="color: #fbbf24; font-family: monospace;">#${order.payment_code}</span>
            </div>
            <div class="row">
              <span class="label">Sản phẩm:</span>
              <span class="value">${order.product_name} (${order.plan_label})</span>
            </div>
            <div class="row">
              <span class="label">Giá tiền:</span>
              <span class="value" style="color: #10b981;">${formattedPrice}</span>
            </div>
            <div class="row">
              <span class="label">Trạng thái:</span>
              <span class="value" style="color: #38bdf8;">${emailType === 'refunded' ? 'Đã hoàn tiền về ví' : 'Đã bàn giao'}</span>
            </div>
          </div>

          <div class="text" style="font-size: 12px; color: #cbd5e1; margin-bottom: 20px;">
            🔒 <em>Vì lý do bảo mật, thông tin chi tiết được bảo vệ an toàn trên website BOW. Vui lòng đăng nhập để xem.</em>
          </div>

          <a href="${btnUrl}" class="btn" target="_blank">
            ${btnText}
          </a>

          <div class="footer">
            Cảm ơn bạn đã lựa chọn dịch vụ của BOW • Hotline 24/7: 0966 821 315
          </div>
        </div>
      </body>
      </html>
    `;

    if (SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: `"BOW Shop" <${SMTP_USER}>`,
        to: userEmail,
        subject: emailSubject,
        html: emailHtml,
      });

      console.log(`[email-notify] Email (${emailType}) sent via SMTP to ${userEmail}, messageId: ${info.messageId}`);
      return { statusCode: 200, body: { status: 'sent', type: emailType, messageId: info.messageId } };
    }

    console.log(`[email-notify] SMTP_PASS not set, logged email intent for ${userEmail} (${emailType})`);
    return { statusCode: 200, body: { status: 'logged_no_smtp_pass', email: userEmail } };
  } catch (err: any) {
    console.error('[email-notify] Unexpected error:', err);
    return { statusCode: 500, body: { error: err.message || 'Internal server error' } };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return res.status(200).json({ status: 'ok', message: 'Email Notify Endpoint Ready' });
  }
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'ignored' });
  }
  const result = await processEmailNotify(req.headers, req.body);
  return res.status(result.statusCode).json(result.body);
}

export const netlifyHandler = async (event: any) => {
  if (event.httpMethod === 'GET' || event.httpMethod === 'HEAD' || event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, body: JSON.stringify({ status: 'ok', message: 'Email Notify Endpoint Ready' }) };
  }
  const result = await processEmailNotify(event.headers, event.body);
  return { statusCode: result.statusCode, body: JSON.stringify(result.body) };
};
