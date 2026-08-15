// api/email-notify.ts — Vercel Serverless Function & Netlify Function Compatibility
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.VITE_APP_URL || 'https://shopofbow.vercel.app';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_USER = process.env.SMTP_USER || 'hoankb4@gmail.com';
const SMTP_PASS = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

function escapeHtml(str: string): string {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function checkIsAdmin(supabase: SupabaseClient, userId: string, email?: string): Promise<boolean> {
  if (email?.toLowerCase() === 'hoankb4@gmail.com') return true;
  const { data } = await supabase
    .from('admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

async function processEmailNotify(headers: Record<string, string | string[] | undefined>, body: any) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[email-notify] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return { statusCode: 500, body: { error: 'Supabase not configured' } };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    console.error('[email-notify] Unauthorized request header:', authHeader);
    return { statusCode: 401, body: { error: 'Unauthorized' } };
  }

  let payload: any = {};
  if (typeof body === 'string') {
    try {
      payload = JSON.parse(body || '{}');
    } catch {
      return { statusCode: 400, body: { error: 'Invalid JSON payload' } };
    }
  } else if (typeof body === 'object' && body !== null) {
    payload = body;
  }

  const { order_id, ticket_id, user_id, type, message } = payload;

  if (!order_id && !ticket_id && !user_id) {
    return { statusCode: 400, body: { error: 'order_id, ticket_id, or user_id is required' } };
  }

  // ─────────────────────────────────────────────────────────────
  // 1. USER ROLE CHANGE EMAIL NOTIFICATIONS (🔒 BẢO MẬT: Chỉ Admin)
  // ─────────────────────────────────────────────────────────────
  if (user_id) {
    if (!isAdmin) {
      return { statusCode: 403, body: { error: 'Forbidden: Admin access required for role change emails' } };
    }

    try {
      const { data: userProfile, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', user_id)
        .maybeSingle();

      let targetEmail = userProfile?.email;
      if (!targetEmail) {
        const { data: uData } = await supabase.auth.admin.getUserById(user_id);
        targetEmail = uData.user?.email;
      }

      if (!targetEmail) {
        return { statusCode: 404, body: { error: 'User email not found' } };
      }

      const isCtv = type === 'role_ctv' || userProfile?.role === 'ctv';
      const emailSubject = isCtv
        ? `👑 [BOW] Chúc mừng bạn đã trở thành Cộng Tác Viên (Giá Sỉ)!`
        : `ℹ️ [BOW] Thông báo thay đổi cấp bậc tài khoản`;

      const badgeText = isCtv ? 'CỘNG TÁC VIÊN SỈ' : 'THÀNH VIÊN';
      const badgeColor = isCtv
        ? 'background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);'
        : 'background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3);';

      const titleText = isCtv
        ? '🎉 Chúc mừng bạn đã được nâng cấp lên CTV Sỉ!'
        : 'Tài khoản của bạn đã được chuyển về Thành viên thường';

      const descHtml = isCtv
        ? `Tài khoản <strong style="color: #ffffff;">${escapeHtml(userProfile?.full_name || targetEmail)}</strong> vừa được Ban Quản Trị BOW nâng cấp lên cấp bậc <strong>Cộng Tác Viên (CTV Giá Sỉ)</strong>. Bạn có thể mua tất cả các sản phẩm/dịch vụ trên hệ thống với Giá Sỉ ưu đãi đặc quyền!`
        : `Tài khoản của bạn đã được cập nhật về cấp bậc <strong>Thành viên thường</strong> trên hệ thống BOW.`;

      const btnText = isCtv ? '🛍️ XEM SẢN PHẨM GIÁ SỈ TRÊN WEB' : '🌐 TRUY CẬP WEBSITE BOW';
      const btnUrl = isCtv ? `${SITE_URL}/products` : `${SITE_URL}`;

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

            ${isCtv ? `
            <div class="info-box">
              <div class="row">
                <span class="label">Cấp bậc:</span>
                <span class="value" style="color: #fbbf24;">👑 Cộng Tác Viên (Giá Sỉ)</span>
              </div>
              <div class="row">
                <span class="label">Đặc quyền:</span>
                <span class="value" style="color: #10b981;">Mua giá sỉ rẻ hơn giá bán lẻ</span>
              </div>
              <div class="row">
                <span class="label">Tài khoản:</span>
                <span class="value">${escapeHtml(targetEmail)}</span>
              </div>
            </div>
            ` : ''}

            <a href="${btnUrl}" class="btn" target="_blank">
              ${btnText}
            </a>

            <div class="footer">
              BOW • Nền tảng tài khoản số & AI cao cấp • Hotline 24/7: 0966 821 315
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
          to: targetEmail,
          subject: emailSubject,
          html: emailHtml,
        });

        console.log(`[email-notify] Role Email (${type}) sent to ${targetEmail}, messageId: ${info.messageId}`);
        return { statusCode: 200, body: { status: 'sent', type, messageId: info.messageId } };
      }

      console.log(`[email-notify] SMTP_PASS not set, logged role email for ${targetEmail} (${type})`);
      return { statusCode: 200, body: { status: 'logged_no_smtp_pass', email: targetEmail } };
    } catch (err: any) {
      console.error('[email-notify] Role change email error:', err);
      return { statusCode: 500, body: { error: err.message || 'Internal server error' } };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. TICKET EMAIL NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────
  if (ticket_id) {
    try {
      const { data: ticket, error: tErr } = await supabase
        .from('support_tickets')
        .select('*, profiles:profiles!support_tickets_user_id_fkey(full_name, email), orders:orders(product_name, payment_code)')
        .eq('id', ticket_id)
        .maybeSingle();

      if (tErr || !ticket) {
        console.error('[email-notify] Ticket not found:', tErr);
        return { statusCode: 404, body: { error: 'Ticket not found' } };
      }

      // 🔒 BẢO MẬT: Kiểm tra quyền gửi email
      if (!isAdmin) {
        // Chỉ admin mới được gửi thông báo phản hồi (ticket_reply) hoặc giải quyết (ticket_resolved) tới khách
        if (type === 'ticket_reply' || type === 'ticket_resolved') {
          console.error(`[email-notify] Forbidden: Non-admin ${authenticatedUser.id} tried to send ${type}`);
          return { statusCode: 403, body: { error: 'Forbidden: Only admin can trigger staff reply/resolved emails' } };
        }
        // Khách hàng chỉ được gửi email đóng ticket trên chính ticket của mình
        if (ticket.user_id !== authenticatedUser.id) {
          console.error(`[email-notify] Forbidden: User ${authenticatedUser.id} tried to send email for ticket owned by ${ticket.user_id}`);
          return { statusCode: 403, body: { error: 'Forbidden: You do not own this ticket' } };
        }
      }

      const profile: any = ticket.profiles;
      let userEmail = profile?.email;

      if (!userEmail && ticket.user_id) {
        const { data: userData } = await supabase.auth.admin.getUserById(ticket.user_id);
        userEmail = userData.user?.email;
      }

      if (!userEmail) {
        console.error('[email-notify] User email not found for ticket:', ticket_id);
        return { statusCode: 404, body: { error: 'User email not found' } };
      }

      const customerName = profile?.full_name || 'Khách hàng';
      const ticketNumber = ticket.ticket_number;
      const subject = ticket.subject;
      const messageSnippet = message ? String(message).trim() : '';

      let emailSubject = '';
      let badgeText = '';
      let badgeColor = '';
      let titleText = '';
      let descHtml = '';
      let btnText = '';
      let btnUrl = `${SITE_URL}/dashboard?tab=tickets`;

      if (type === 'ticket_resolved') {
        emailSubject = `🟢 [BOW] Yêu cầu hỗ trợ #${ticketNumber} đã được giải quyết!`;
        badgeText = 'ĐÃ GIẢI QUYẾT XONG';
        badgeColor = 'background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);';
        titleText = 'Yêu cầu hỗ trợ của bạn đã được giải quyết!';
        descHtml = `Chào <strong>${escapeHtml(customerName)}</strong>,<br/><br/>Đội ngũ kỹ thuật BOW đã xử lý hoàn tất yêu cầu hỗ trợ <strong>#${escapeHtml(ticketNumber)}</strong> (<em>${escapeHtml(subject)}</em>).<br/><br/>👉 <strong>Vui lòng kiểm tra lại dịch vụ/tài khoản của bạn.</strong> Nếu mọi thứ đã hoạt động tốt, bạn hãy bấm nút <strong>Xác nhận hài lòng & Đóng Ticket</strong> trên website để kết thúc hỗ trợ. Nếu vẫn cần hỗ trợ thêm, bạn có thể tiếp tục gửi tin nhắn phản hồi ngay tại phòng chat.`;
        btnText = '✅ XEM & XÁC NHẬN HÀI LÒNG TRÊN WEB';
      } else if (type === 'ticket_closed') {
        emailSubject = `🔒 [BOW] Vé hỗ trợ #${ticketNumber} đã được đóng`;
        badgeText = 'ĐÃ ĐÓNG VÉ HỖ TRỢ';
        badgeColor = 'background: rgba(100, 116, 139, 0.15); color: #94a3b8; border: 1px solid rgba(100, 116, 139, 0.3);';
        titleText = 'Vé hỗ trợ đã được đóng hoàn tất!';
        descHtml = `Yêu cầu hỗ trợ <strong>#${escapeHtml(ticketNumber)}</strong> (<em>${escapeHtml(subject)}</em>) đã được đóng. Cảm ơn bạn đã tin tưởng và đồng hành cùng BOW. Chúc bạn có trải nghiệm tuyệt vời cùng dịch vụ!`;
        btnText = '📋 XEM LỊCH SỬ HỖ TRỢ TRÊN WEB';
      } else {
        // ticket_reply
        emailSubject = `💬 [BOW] Đội ngũ kỹ thuật đã phản hồi Ticket #${ticketNumber}!`;
        badgeText = 'PHẢN HỒI MỚI TỪ BOW';
        badgeColor = 'background: rgba(53, 168, 255, 0.15); color: #35a8ff; border: 1px solid rgba(53, 168, 255, 0.3);';
        titleText = 'Bạn có phản hồi mới từ kỹ thuật viên BOW!';
        descHtml = `Chào <strong>${escapeHtml(customerName)}</strong>,<br/><br/>Kỹ thuật viên BOW vừa phản hồi yêu cầu hỗ trợ <strong>#${escapeHtml(ticketNumber)}</strong> (<em>${escapeHtml(subject)}</em>):` +
          (messageSnippet ? `<br/><br/><div style="background: rgba(15,23,42,0.6); border-left: 3px solid #35a8ff; padding: 12px 16px; border-radius: 8px; color: #f8fafc; font-style: italic;">"${escapeHtml(messageSnippet)}"</div>` : '') +
          `<br/>Vui lòng truy cập website để xem chi tiết và trả lời lại nếu cần.`;
        btnText = '💬 MỞ CHAT XEM PHẢN HỒI & TRẢ LỜI';
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
            .title { font-size: 21px; font-weight: 900; color: #ffffff; margin-top: 16px; margin-bottom: 8px; }
            .text { font-size: 14px; color: #94a3b8; line-height: 1.6; text-align: left; }
            .info-box { background: rgba(15, 23, 42, 0.8); border: 1px solid #334155; border-radius: 16px; padding: 16px; margin: 20px 0; text-align: left; }
            .row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; }
            .row:last-child { margin-bottom: 0; }
            .label { color: #64748b; font-weight: 600; }
            .value { color: #f8fafc; font-weight: 800; }
            .btn { display: inline-block; background: linear-gradient(90deg, #00A3FF 0%, #2563EB 100%); color: #ffffff; font-weight: 900; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 14px; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 8px 20px rgba(37, 99, 235, 0.4); text-align: center; }
            .footer { font-size: 11px; color: #475569; margin-top: 24px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">${badgeText}</div>
            <div class="title">${titleText}</div>
            <div class="text">${descHtml}</div>

            <div class="info-box">
              <div class="row">
                <span class="label">Mã Ticket:</span>
                <span class="value" style="color: #38bdf8; font-family: monospace;">#${ticketNumber}</span>
              </div>
              <div class="row">
                <span class="label">Chủ đề:</span>
                <span class="value">${escapeHtml(subject)}</span>
              </div>
              ${ticket.orders?.payment_code ? `
              <div class="row">
                <span class="label">Đơn hàng:</span>
                <span class="value" style="color: #fbbf24; font-family: monospace;">#${ticket.orders.payment_code}</span>
              </div>` : ''}
              <div class="row">
                <span class="label">Trạng thái hiện tại:</span>
                <span class="value" style="color: #10b981;">${type === 'ticket_resolved' ? '🟢 Đã giải quyết' : type === 'ticket_closed' ? '⚫ Đã đóng' : '🟡 Đang xử lý'}</span>
              </div>
            </div>

            <a href="${btnUrl}" class="btn" target="_blank">
              ${btnText}
            </a>

            <div class="footer">
              Đội ngũ hỗ trợ BOW luôn sẵn sàng đồng hành cùng bạn 24/7.
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
          from: `"BOW Support" <${SMTP_USER}>`,
          to: userEmail,
          subject: emailSubject,
          html: emailHtml,
        });

        console.log(`[email-notify] Ticket Email (${type}) sent to ${userEmail}, messageId: ${info.messageId}`);
        return { statusCode: 200, body: { status: 'sent', type, messageId: info.messageId } };
      }

      console.log(`[email-notify] SMTP_PASS not set, logged ticket email for ${userEmail} (${type})`);
      return { statusCode: 200, body: { status: 'logged_no_smtp_pass', email: userEmail } };

    } catch (err: any) {
      console.error('[email-notify] Ticket email error:', err);
      return { statusCode: 500, body: { error: err.message || 'Internal server error' } };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ORDER EMAIL NOTIFICATIONS (🔒 BẢO MẬT: Chỉ Admin hoặc Internal API Key)
  // ─────────────────────────────────────────────────────────────
  if (!isAdmin) {
    console.error('[email-notify] Non-admin tried to trigger order email');
    return { statusCode: 403, body: { error: 'Forbidden: Admin access required for order emails' } };
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
    const emailType = type || (order.status === 'refunded' ? 'refunded' : order.status === 'processing' ? 'processing' : 'completed');

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
    } else if (emailType === 'processing') {
      emailSubject = `⚙️ [BOW] Đơn hàng #${order.payment_code} đang được thiết lập / xử lý!`;
      badgeText = 'ĐANG THIẾT LẬP';
      badgeColor = 'background: rgba(99, 102, 241, 0.15); color: #6366f1; border: 1px solid rgba(99, 102, 241, 0.3);';
      titleText = '⚙️ Đơn hàng của bạn đang được xử lý!';
      descHtml = `Đơn hàng dịch vụ <strong style="color: #ffffff;">${order.product_name}</strong> của bạn đã được tiếp nhận. Nhân viên kỹ thuật BOW đang bắt đầu khởi tạo và thiết lập tài khoản. Vui lòng chờ trong giây lát.`;
      btnText = '📦 XEM TRẠNG THÁI ĐƠN HÀNG TRÊN WEB';
      btnUrl = `${SITE_URL}/dashboard?tab=orders`;
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
              <span class="value" style="color: #38bdf8;">${emailType === 'refunded' ? 'Đã hoàn tiền về ví' : emailType === 'processing' ? 'Đang thiết lập' : 'Đã bàn giao'}</span>
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
