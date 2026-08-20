import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { sendTicketTelegramNotify, sendTicketEmailNotify } from '../../lib/notify';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { CloseIcon } from '../icons';

interface TicketDetail {
  id: string;
  ticket_number: string;
  subject: string;
  status: 'pending' | 'processing' | 'resolved' | 'closed';
  priority: string;
  created_at: string;
  updated_at: string;
  order_id?: string | null;
  orders?: {
    id: string;
    product_name: string;
    plan_label: string;
    price: number;
    payment_code: string;
    status: string;
  } | null;
}

interface MessageRow {
  id: string;
  sender_id: string;
  sender_role: 'user' | 'admin';
  message: string;
  attachments?: any;
  created_at: string;
  profiles?: { full_name?: string; email?: string } | null;
}

interface Props {
  ticketId: string | null;
  onClose: () => void;
  onTicketUpdated?: () => void;
}

export default function UserTicketChatModal({ ticketId, onClose, onTicketUpdated }: Props) {
  const { session } = useAuth();
  const toast = useToast();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [inputMsg, setInputMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadTicketData = async () => {
    if (!ticketId || !session?.user?.id) return;
    setLoading(true);
    try {
      // 1. Fetch ticket with linked order
      const { data: tData, error: tErr } = await (supabase
        .from('support_tickets')
        .select('*, orders:orders(id, product_name, plan_label, price, payment_code, status)')
        .eq('id', ticketId)
        .single() as any);

      if (tErr) throw tErr;
      setTicket(tData);

      // 2. Fetch messages
      const { data: mData, error: mErr } = await (supabase
        .from('support_messages')
        .select('*, profiles:profiles(full_name, email)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true }) as any);

      if (mErr) throw mErr;
      setMessages(mData || []);

    } catch (e: any) {
      console.error('Error loading ticket chat:', e);
      toast.error('Không thể tải thông tin Ticket.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      loadTicketData();
    }
  }, [ticketId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Realtime Messages & Ticket Status Subscription
  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`user-ticket-chat-${ticketId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticketId}` },
        async (payload) => {
          const newMsg = payload.new as MessageRow;
          // Fetch sender info
          const { data: prof } = await (supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', newMsg.sender_id)
            .maybeSingle() as any);

          setMessages((prev) => [...prev, { ...newMsg, profiles: prof }]);
          if (onTicketUpdated) onTicketUpdated();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `id=eq.${ticketId}` },
        (payload) => {
          const updated = payload.new as TicketDetail;
          setTicket((prev) => (prev ? { ...prev, ...updated } : updated));
          if (onTicketUpdated) onTicketUpdated();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  if (!ticketId) return null;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !session?.user?.id || !ticket) return;

    const text = inputMsg.trim();
    setInputMsg('');
    setSending(true);

    try {
      // 1. Insert message
      const { error: insErr } = await (supabase.from('support_messages') as any).insert({
        ticket_id: ticket.id,
        sender_id: session.user.id,
        sender_role: 'user',
        message: text,
      });

      if (insErr) throw insErr;

      // 2. Send Telegram alert to Admin
      sendTicketTelegramNotify(ticket.id, 'ticket_user_message', text).catch(() => {});

      if (onTicketUpdated) onTicketUpdated();

    } catch (err: any) {
      console.error('Failed sending message:', err);
      toast.error('Không thể gửi tin nhắn.');
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status: TicketDetail['status']) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-xs font-extrabold text-rose-600 dark:text-rose-400 border border-rose-200/50">🔴 Chờ xử lý</span>;
      case 'processing':
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-xs font-extrabold text-amber-600 dark:text-amber-400 border border-amber-200/50">🟡 Đang xử lý</span>;
      case 'resolved':
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 border border-emerald-200/50">🟢 Đã giải quyết</span>;
      case 'closed':
        return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-extrabold text-slate-600 dark:text-slate-400 border border-slate-200">⚫ Đã đóng</span>;
    }
  };

  const handleUserConfirmClose = async () => {
    if (!ticket || !session?.user?.id) return;
    setClosingTicket(true);
    try {
      // 1. Update status to 'closed'
      const { error: upErr } = await (supabase.from('support_tickets') as any)
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticket.id);

      if (upErr) throw upErr;

      // 2. Insert Audit log
      const userEmail = session.user.email || 'Khách hàng';
      await (supabase.from('audit_logs') as any).insert({
        actor_id: session.user.id,
        actor_name: userEmail,
        actor_role: 'user',
        action: 'ticket_closed_by_user',
        entity_id: ticket.id,
        entity_type: 'support_ticket',
        description: `Khách hàng xác nhận hài lòng và đóng Ticket #${ticket.ticket_number}`,
      });

      // 3. Send Telegram and Email notifications
      sendTicketTelegramNotify(ticket.id, 'ticket_closed').catch(() => {});
      sendTicketEmailNotify(ticket.id, 'ticket_closed').catch(() => {});

      setTicket((prev) => (prev ? { ...prev, status: 'closed' } : null));
      toast.success('Đã xác nhận & đóng Ticket hỗ trợ thành công. Cảm ơn bạn!');
      if (onTicketUpdated) onTicketUpdated();
    } catch (e: any) {
      console.error('Error closing ticket by user:', e);
      toast.error('Không thể đóng Ticket.');
    } finally {
      setClosingTicket(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={onClose} />

      <div className="relative z-[100000] w-full max-w-2xl h-[85dvh] flex flex-col overflow-hidden rounded-[28px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C32] shadow-2xl animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 p-4 shrink-0 bg-slate-50/50 dark:bg-[#18243E]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#19A7FF]/20 to-[#2563EB]/20 border border-[#2563EB]/30 text-[#2563EB] dark:text-[#35A8FF] flex items-center justify-center text-lg shrink-0 font-bold">
              🎫
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-black text-[#2563EB] dark:text-[#35A8FF]">{ticket?.ticket_number}</span>
                {ticket && getStatusBadge(ticket.status)}
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate mt-0.5" title={ticket?.subject}>
                {ticket?.subject || 'Đang tải...'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition shrink-0"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Linked Order Banner if present */}
        {ticket?.orders && (
          <div className="px-4 py-2.5 bg-blue-50/60 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-slate-700 dark:text-slate-200">📦 Đơn hàng liên kết:</span>
              <span className="font-extrabold text-[#2563EB] dark:text-[#35A8FF]">{ticket.orders.product_name}</span>
              <span className="text-slate-400 hidden sm:inline">({ticket.orders.plan_label} • #{ticket.orders.payment_code})</span>
            </div>
            <span className="font-extrabold text-[#2563EB] dark:text-[#35A8FF] shrink-0">
              {Number(ticket.orders.price || 0).toLocaleString('vi-VN')}đ
            </span>
          </div>
        )}

        {/* Chat Messages Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/30 dark:bg-[#0F172A]/50">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 font-bold animate-pulse">
              Đang tải tin nhắn Ticket...
            </div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 font-medium">
              Chưa có tin nhắn nào.
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.sender_role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 px-1">
                    <span>{isUser ? 'Bạn' : '👨‍💻 BOW Support'}</span>
                    <span>•</span>
                    <span>{new Date(m.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs font-medium leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-gradient-to-r from-[#19A7FF] to-[#2563EB] text-white shadow-xs rounded-tr-xs'
                        : 'bg-white dark:bg-[#18243E] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shadow-xs rounded-tl-xs'
                    }`}
                  >
                    {m.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* User Confirmation Banner when Ticket is Resolved */}
        {ticket?.status === 'resolved' && (
          <div className="p-3.5 bg-emerald-50/90 dark:bg-emerald-950/50 border-t border-emerald-200 dark:border-emerald-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 animate-fade-in">
            <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-900 dark:text-emerald-200">
              <span className="text-base">🟢</span>
              <span>Admin đã hỗ trợ xử lý xong. Bạn đã hài lòng với kết quả chưa?</span>
            </div>
            <button
              type="button"
              onClick={handleUserConfirmClose}
              disabled={closingTicket}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 px-4 py-2 text-xs font-black text-white shadow-md transition hover:scale-102 shrink-0 cursor-pointer disabled:opacity-50"
            >
              <span>✓</span>
              <span>{closingTicket ? 'Đang đóng...' : 'Xác nhận & Đóng Ticket'}</span>
            </button>
          </div>
        )}

        {/* Input Bar */}
        {ticket?.status === 'closed' ? (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 text-center text-xs font-bold text-slate-500 shrink-0">
            🔒 Ticket này đã được đóng. Cảm ơn bạn đã sử dụng dịch vụ của BOW!
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131C32] flex items-center gap-2 shrink-0">
            <input
              type="text"
              placeholder="Nhập nội dung tin nhắn phản hồi..."
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              disabled={sending}
              className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:border-[#2563EB] focus:outline-none transition"
            />
            <button
              type="submit"
              disabled={sending || !inputMsg.trim()}
              className="rounded-full bg-gradient-to-r from-[#19A7FF] to-[#2563EB] hover:from-[#19A7FF] hover:to-[#1D4ED8] px-5 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-50 transition shrink-0"
            >
              {sending ? 'Đang gửi...' : 'Gửi 🚀'}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
