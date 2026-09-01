// src/components/agent/AgentWarrantyModal.tsx — Modal gửi yêu cầu bảo hành trực tiếp từ Agent (V3.3 Phase 4.3)
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { sendTicketTelegramNotify } from '../../lib/notify';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';

interface OrderInfo {
  id: string;
  paymentCode?: string;
  productName: string;
  status?: string;
}

interface AgentWarrantyModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderInfo | null;
  initialIssue?: string;
  onTicketCreated?: (ticketId: string, ticketNumber: string) => void;
}

export function AgentWarrantyModal({
  isOpen,
  onClose,
  order,
  initialIssue = '',
  onTicketCreated,
}: AgentWarrantyModalProps) {
  const { session } = useAuth();
  const toast = useToast();

  const [issueText, setIssueText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<{ id: string; ticketNumber: string } | null>(null);

  // Đồng bộ issue khi mở modal
  useEffect(() => {
    if (isOpen) {
      setIssueText(initialIssue || 'Cần hỗ trợ bảo hành tài khoản');
      setErrorMsg(null);
      setCreatedTicket(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialIssue, order?.id]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!session?.user?.id) {
      toast.error('Vui lòng đăng nhập để gửi yêu cầu bảo hành.');
      return;
    }

    const trimmed = issueText.trim();
    if (!trimmed) {
      setErrorMsg('Vui lòng mô tả vấn đề bạn đang gặp phải.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Kiểm tra xác thực quyền sở hữu và trạng thái thực tế từ DB
      const { data: realOrder, error: orderErr } = await (supabase
        .from('orders') as any)
        .select('id, user_id, status, payment_code, product_name')
        .eq('id', order.id)
        .maybeSingle();

      if (orderErr || !realOrder) {
        throw new Error('Không tìm thấy thông tin đơn hàng trong hệ thống.');
      }

      if (realOrder.user_id !== session.user.id) {
        throw new Error('Bạn không có quyền gửi yêu cầu bảo hành cho đơn hàng này.');
      }

      if (realOrder.status === 'cancelled') {
        throw new Error('Đơn hàng này đã bị hủy (cancelled) nên không thể áp dụng bảo hành.');
      }

      if (realOrder.status === 'refunded') {
        throw new Error('Đơn hàng này đã được hoàn tiền (refunded) nên không còn trong phạm vi bảo hành.');
      }

      if (realOrder.status === 'pending_payment') {
        throw new Error('Đơn hàng này chưa hoàn tất thanh toán (pending_payment) nên không thể áp dụng bảo hành.');
      }

      // 2. Kiểm tra xem đơn đã có Ticket mở (pending / processing) chưa
      const { data: existingTicket } = await (supabase
        .from('support_tickets') as any)
        .select('id, ticket_number')
        .eq('user_id', session.user.id)
        .eq('order_id', order.id)
        .in('status', ['pending', 'processing'])
        .maybeSingle();

      if (existingTicket) {
        setCreatedTicket({
          id: existingTicket.id,
          ticketNumber: existingTicket.ticket_number,
        });
        toast.info(`Đơn hàng đã có Ticket mở (${existingTicket.ticket_number}).`);
        if (onTicketCreated) {
          onTicketCreated(existingTicket.id, existingTicket.ticket_number);
        }
        return;
      }

      // 3. Tạo Ticket mới
      const subject = `Bảo hành ${order.productName}${order.paymentCode ? ` (${order.paymentCode})` : ''}`;
      const { data: newTicket, error: ticketErr } = await (supabase
        .from('support_tickets') as any)
        .insert({
          user_id: session.user.id,
          order_id: order.id,
          subject,
          status: 'pending',
          priority: 'normal',
        })
        .select('id, ticket_number')
        .single();

      if (ticketErr || !newTicket) {
        throw new Error(ticketErr?.message || 'Không thể tạo phiếu hỗ trợ lúc này.');
      }

      // 4. Tạo tin nhắn đầu tiên
      const { error: msgErr } = await (supabase
        .from('support_messages') as any)
        .insert({
          ticket_id: newTicket.id,
          sender_id: session.user.id,
          sender_role: 'user',
          message: trimmed,
        });

      if (msgErr) {
        console.warn('Lỗi chèn message ban đầu:', msgErr);
      }

      // 5. Bắn thông báo Telegram cho Admin Bot (silent catch)
      sendTicketTelegramNotify(newTicket.id, 'ticket_created', trimmed).catch(() => {});

      setCreatedTicket({
        id: newTicket.id,
        ticketNumber: newTicket.ticket_number,
      });

      toast.success(`Đã gửi yêu cầu bảo hành (${newTicket.ticket_number})!`);

      if (onTicketCreated) {
        onTicketCreated(newTicket.id, newTicket.ticket_number);
      }
    } catch (err: any) {
      console.error('[AgentWarrantyModal Error]:', err);
      setErrorMsg(err.message || 'Lỗi khi gửi yêu cầu bảo hành. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#11192C] shadow-2xl overflow-hidden animate-slide-up text-left">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-amber-500/10 to-orange-500/5 dark:from-amber-950/30 dark:to-transparent">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white text-sm shadow-xs">
              🎫
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Gửi Yêu Cầu Bảo Hành
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Kỹ thuật viên sẽ xử lý trong 5 - 30 phút
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Order Summary Banner */}
          <div className="rounded-2xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {order.productName}
              </span>
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                Đủ điều kiện
              </span>
            </div>
            {order.paymentCode && (
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Mã đơn: <span className="font-semibold text-amber-700 dark:text-amber-300">{order.paymentCode}</span>
              </p>
            )}
          </div>

          {/* Success State */}
          {createdTicket ? (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 text-center space-y-3">
              <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-emerald-500 text-white text-lg">
                ✓
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">
                  Tạo yêu cầu thành công!
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                  Mã phiếu: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{createdTicket.ticketNumber}</strong>
                </p>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Kỹ thuật viên đã nhận được thông báo và đang kiểm tra.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 px-3 text-xs font-bold text-white transition cursor-pointer"
                >
                  Hoàn tất & Tiếp tục trò chuyện
                </button>
              </div>
            </div>
          ) : (
            /* Input Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mô tả vấn đề cần hỗ trợ:
                </label>
                <textarea
                  rows={4}
                  value={issueText}
                  onChange={(e) => setIssueText(e.target.value)}
                  placeholder="Ví dụ: Tài khoản bị lỗi đăng nhập, cần đổi mật khẩu hoặc bảo hành lại slot..."
                  disabled={isSubmitting}
                  className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-hidden resize-none transition"
                />
                <div className="flex justify-between items-center text-[10.5px] text-slate-400 mt-1">
                  <span>Mô tả càng chi tiết sẽ giúp kỹ thuật xử lý nhanh hơn</span>
                  <span>{issueText.length}/500</span>
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                  {errorMsg}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 px-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !issueText.trim()}
                  className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-2.5 px-4 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:scale-[1.01] active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Đang gửi...</span>
                    </>
                  ) : (
                    <>
                      <span>Gửi yêu cầu</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
