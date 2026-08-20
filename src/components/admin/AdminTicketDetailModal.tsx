import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { sendTicketTelegramNotify, sendTicketEmailNotify } from '../../lib/notify';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { CloseIcon } from '../icons';

interface TicketDetail {
  id: string;
  ticket_number: string;
  user_id: string;
  order_id?: string | null;
  subject: string;
  status: 'pending' | 'processing' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  profiles?: { full_name?: string; email?: string } | null;
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

interface DropdownOption<T> {
  value: T;
  label: string;
  badge?: React.ReactNode;
}

function CustomHeaderSelect<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T;
  onChange: (val: T) => void;
  options: DropdownOption<T>[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOpt = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="h-8 sm:h-9 flex items-center justify-between gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#18243E] px-2.5 sm:px-3 text-xs font-extrabold text-slate-800 dark:text-slate-200 hover:border-[#2563EB] dark:hover:border-[#35A8FF] transition shadow-2xs disabled:opacity-50"
      >
        <span className="flex items-center gap-1.5 truncate">
          {selectedOpt.badge || selectedOpt.label}
        </span>
        <svg className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-[100010] mt-1.5 min-w-[160px] sm:min-w-[170px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#18243E] p-1.5 shadow-2xl animate-fade-in backdrop-blur-md">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl transition text-left ${
                value === opt.value
                  ? 'bg-blue-50 dark:bg-[#2563EB]/20 text-[#2563EB] dark:text-[#35A8FF]'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80'
              }`}
            >
              {opt.badge || opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const QUICK_REPLIES = [
  {
    label: '👋 Chào khách hàng',
    text: 'Chào bạn, đội ngũ hỗ trợ BOW đã nhận được thông tin và đang xử lý giúp bạn nhé!',
  },
  {
    label: '🔐 Hướng dẫn đăng nhập',
    text: 'Chào bạn, bạn thử đăng nhập lại theo đúng thông tin tài khoản đã bàn giao trong chi tiết đơn hàng giúp mình nhé.',
  },
  {
    label: '🔄 Yêu cầu thử lại',
    text: 'Chào bạn, hệ thống đã kiểm tra xong. Bạn vui lòng thử thao tác lại giúp mình nhé!',
  },
  {
    label: '✅ Đã xử lý xong',
    text: 'Yêu cầu của bạn đã được hỗ trợ xử lý hoàn tất! Nếu cần thêm hỗ trợ bạn cứ phản hồi lại tại đây nhé.',
  },
  {
    label: '❌ Không thể xử lý',
    text: 'Rất tiếc yêu cầu này hiện không đáp ứng đủ điều kiện xử lý. Bạn vui lòng liên hệ lại nếu có thắc mắc nhé.',
  },
];

function formatRelativeTime(dateStr: string): string {
  const past = new Date(dateStr).getTime();
  if (isNaN(past)) return 'Vừa xong';
  const diffSec = Math.floor((Date.now() - past) / 1000);
  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ngày trước`;
}

export default function AdminTicketDetailModal({ ticketId, onClose, onTicketUpdated }: Props) {
  const { session } = useAuth();
  const toast = useToast();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState<TicketDetail['status']>('pending');
  const [priority, setPriority] = useState<TicketDetail['priority']>('normal');
  const [updatingMeta, setUpdatingMeta] = useState(false);

  const [inputMsg, setInputMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showMobileMeta, setShowMobileMeta] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const quickRepliesRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (quickRepliesRef.current && !quickRepliesRef.current.contains(e.target as Node)) {
        setShowQuickReplies(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadTicketData = async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      // 1. Fetch Ticket with Profiles & Orders
      const { data: tData, error: tErr } = await (supabase
        .from('support_tickets')
        .select('*, profiles:profiles!support_tickets_user_id_fkey(full_name, email), orders:orders(id, product_name, plan_label, price, payment_code, status)')
        .eq('id', ticketId)
        .single() as any);

      if (tErr) throw tErr;
      setTicket(tData);
      setStatus(tData.status);
      setPriority(tData.priority);

      // 2. Fetch Messages
      const { data: mData, error: mErr } = await (supabase
        .from('support_messages')
        .select('*, profiles:profiles(full_name, email)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true }) as any);

      if (mErr) throw mErr;
      setMessages(mData || []);

    } catch (e: any) {
      console.error('Error loading admin ticket:', e);
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

  // Realtime Subscription
  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`admin-ticket-chat-${ticketId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticketId}` },
        async (payload) => {
          const newMsg = payload.new as MessageRow;
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
          setStatus(updated.status);
          setPriority(updated.priority);
          if (onTicketUpdated) onTicketUpdated();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  if (!ticketId) return null;

  // Change Status / Priority
  const handleUpdateStatusOrPriority = async (newStatus?: TicketDetail['status'], newPriority?: TicketDetail['priority']) => {
    if (!ticket || !session?.user?.id) return;
    const targetStatus = newStatus || status;
    const targetPriority = newPriority || priority;

    setUpdatingMeta(true);
    try {
      const closedAt = targetStatus === 'closed' || targetStatus === 'resolved' ? new Date().toISOString() : null;

      const { error: upErr } = await (supabase
        .from('support_tickets') as any)
        .update({
          status: targetStatus,
          priority: targetPriority,
          closed_at: closedAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ticket.id);

      if (upErr) throw upErr;

      // 1. Audit log
      const adminEmail = session.user.email || 'Admin';
      await (supabase.from('audit_logs') as any).insert({
        actor_id: session.user.id,
        actor_name: adminEmail,
        actor_role: 'admin',
        action: 'ticket_update',
        entity_id: ticket.id,
        entity_type: 'support_ticket',
        description: `Admin cập nhật Ticket ${ticket.ticket_number}: Trạng thái "${targetStatus}", Độ ưu tiên "${targetPriority}"`,
      });



      // 3. Email & Telegram Notifications for target status
      if (targetStatus === 'resolved') {
        sendTicketEmailNotify(ticket.id, 'ticket_resolved').catch(() => {});
        sendTicketTelegramNotify(ticket.id, 'ticket_resolved').catch(() => {});
      } else if (targetStatus === 'closed') {
        sendTicketEmailNotify(ticket.id, 'ticket_closed').catch(() => {});
        sendTicketTelegramNotify(ticket.id, 'ticket_closed').catch(() => {});
      }

      toast.success(`Đã cập nhật Ticket ${ticket.ticket_number}`);
      if (onTicketUpdated) onTicketUpdated();

    } catch (err: any) {
      console.error('Failed updating ticket meta:', err);
      toast.error('Lỗi khi cập nhật Ticket.');
    } finally {
      setUpdatingMeta(false);
    }
  };

  // Reply message
  const handleSendAdminReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputMsg.trim();
    if (!text || !session?.user?.id || !ticket) return;

    setInputMsg('');
    setSending(true);

    try {
      // 1. Insert admin message
      const { error: insErr } = await (supabase.from('support_messages') as any).insert({
        ticket_id: ticket.id,
        sender_id: session.user.id,
        sender_role: 'admin',
        message: text,
      });

      if (insErr) throw insErr;

      // 2. Update status to 'processing' if currently 'pending'
      if (ticket.status === 'pending') {
        await (supabase.from('support_tickets') as any)
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', ticket.id);
        setStatus('processing');
        setTicket((prev) => (prev ? { ...prev, status: 'processing' } : null));
      }

      // 3. Audit Log
      const adminEmail = session.user.email || 'Admin';
      await (supabase.from('audit_logs') as any).insert({
        actor_id: session.user.id,
        actor_name: adminEmail,
        actor_role: 'admin',
        action: 'ticket_reply',
        entity_id: ticket.id,
        entity_type: 'support_ticket',
        description: `Admin phản hồi Ticket ${ticket.ticket_number}: "${text.length > 40 ? text.substring(0, 40) + '...' : text}"`,
      });


      // 5. Send Email notification to User
      sendTicketEmailNotify(ticket.id, 'ticket_reply', text).catch(() => {});

      toast.success('Đã gửi phản hồi cho khách hàng!');
      if (onTicketUpdated) onTicketUpdated();

    } catch (err: any) {
      console.error('Failed sending admin reply:', err);
      toast.error('Lỗi khi gửi phản hồi.');
    } finally {
      setSending(false);
    }
  };

  const getPriorityBadge = (p: TicketDetail['priority']) => {
    switch (p) {
      case 'urgent':
        return <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-950/60 px-2 sm:px-2.5 py-0.5 text-[10px] font-black text-red-600 border border-red-200 dark:border-red-900/50 uppercase">🔴 KHẨN CẤP</span>;
      case 'high':
        return <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 sm:px-2.5 py-0.5 text-[10px] font-black text-amber-600 border border-amber-200 dark:border-amber-900/50 uppercase">🟠 Cao</span>;
      case 'normal':
        return <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-950/60 px-2 sm:px-2.5 py-0.5 text-[10px] font-bold text-blue-600 border border-blue-200 dark:border-blue-900/50 uppercase">🟡 Bình thường</span>;
      case 'low':
      default:
        return <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 sm:px-2.5 py-0.5 text-[10px] font-semibold text-slate-500 border border-slate-200 dark:border-slate-700 uppercase">🔵 Thấp</span>;
    }
  };

  const getStatusBadge = (s: TicketDetail['status']) => {
    switch (s) {
      case 'pending':
        return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/40 px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-xs font-extrabold text-rose-600 dark:text-rose-400 border border-rose-200/50">🔴 Chờ xử lý</span>;
      case 'processing':
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-xs font-extrabold text-amber-600 dark:text-amber-400 border border-amber-200/50">🟡 Đang xử lý</span>;
      case 'resolved':
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-xs font-extrabold text-emerald-600 dark:text-emerald-400 border border-emerald-200/50">🟢 Đã giải quyết</span>;
      case 'closed':
        return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-xs font-extrabold text-slate-600 dark:text-slate-400 border border-slate-200">⚫ Đã đóng</span>;
    }
  };

  const priorityOptions: DropdownOption<TicketDetail['priority']>[] = [
    { value: 'low', label: '🔵 Thấp', badge: getPriorityBadge('low') },
    { value: 'normal', label: '🟡 Bình thường', badge: getPriorityBadge('normal') },
    { value: 'high', label: '🟠 Cao', badge: getPriorityBadge('high') },
    { value: 'urgent', label: '🔴 KHẨN CẤP', badge: getPriorityBadge('urgent') },
  ];

  const renderSidebarBottomAction = () => {
    if (status === 'processing') {
      return (
        <button
          type="button"
          onClick={() => handleUpdateStatusOrPriority('resolved', undefined)}
          disabled={updatingMeta}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 px-4 py-2.5 text-xs sm:text-sm font-black text-white shadow-md shadow-emerald-500/20 hover:scale-102 active:scale-98 transition cursor-pointer"
          title="Bấm để báo đã giải quyết xong Yêu cầu hỗ trợ này"
        >
          <span>⚡</span>
          <span>Giải quyết xong</span>
        </button>
      );
    }

    if (status === 'resolved') {
      return (
        <div className="w-full text-center rounded-2xl border border-emerald-300 dark:border-emerald-700/80 bg-emerald-50 dark:bg-emerald-950/70 p-3 text-xs font-black text-emerald-800 dark:text-emerald-300 shadow-xs">
          🟢 Đã báo giải quyết xong (Chờ khách xác nhận)
        </div>
      );
    }

    if (status === 'closed') {
      return (
        <div className="w-full text-center rounded-2xl border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-[#1C2A48] p-3 text-xs font-black text-slate-900 dark:text-white shadow-xs">
          ⚫ Ticket này đã được đóng
        </div>
      );
    }

    return null;
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-1.5 sm:p-4">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={onClose} />

      <div className="relative z-[100000] w-full max-w-5xl h-[96dvh] sm:h-[92dvh] flex flex-col overflow-hidden rounded-[20px] sm:rounded-[28px] border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#131C32] shadow-2xl animate-scale-up">
        {/* Header Ticket - Multi-row Mobile Friendly */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 dark:border-slate-800/80 p-3 sm:p-4 shrink-0 bg-slate-50/70 dark:bg-[#18243E] gap-2.5 sm:gap-3">
          {/* Row 1 & 2 on Mobile: Icon, Ticket ID, Title & Mobile Close Button */}
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
            <span className="h-9 w-9 sm:h-10 sm:w-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-base sm:text-lg shrink-0 font-bold mt-0.5 md:mt-0">
              🎫
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs sm:text-sm font-black text-[#2563EB] dark:text-[#35A8FF] whitespace-nowrap">
                  #{ticket?.ticket_number}
                </span>
                {/* Mobile Close Button */}
                <button
                  type="button"
                  onClick={onClose}
                  className="md:hidden rounded-full p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white line-clamp-2 leading-snug mt-0.5" title={ticket?.subject}>
                {ticket?.subject || 'Đang tải...'}
              </h3>
            </div>
          </div>

          {/* Row 3 on Mobile / Right side on Desktop: Status & Priority */}
          <div className="flex items-center justify-between md:justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/60 dark:border-slate-800/60">
            <div className="flex items-center gap-2">
              {/* Static Status Badge */}
              <div className="flex items-center shrink-0">
                {getStatusBadge(status)}
              </div>

              {/* Custom Dark Priority Dropdown */}
              <CustomHeaderSelect
                value={priority}
                disabled={updatingMeta}
                onChange={(val) => {
                  setPriority(val);
                  handleUpdateStatusOrPriority(undefined, val);
                }}
                options={priorityOptions}
              />
            </div>

            {/* Desktop Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="hidden md:block rounded-full p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Mobile Action / Status Bar (Always visible on mobile without opening metadata drawer) */}
        <div className="md:hidden p-2.5 bg-slate-100/90 dark:bg-[#16223B] border-b border-slate-200/60 dark:border-slate-800/80 shrink-0">
          {renderSidebarBottomAction()}
        </div>

        {/* Mobile Collapsible Bar for Customer & Linked Order Details */}
        <div className="md:hidden border-b border-slate-100 dark:border-slate-800 bg-slate-50/90 dark:bg-[#152037] shrink-0">
          <button
            type="button"
            onClick={() => setShowMobileMeta(!showMobileMeta)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition cursor-pointer"
          >
            <div className="flex items-center gap-2 truncate">
              <span>👤</span>
              <span className="font-extrabold truncate">
                {ticket?.profiles?.full_name || 'Khách hàng'} {ticket?.orders ? `• 📦 Đơn: ${ticket.orders.product_name}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0 text-[11px] text-[#2563EB] dark:text-[#35A8FF] font-extrabold">
              <span>{showMobileMeta ? 'Thu gọn ▲' : 'Thông tin ▾'}</span>
            </div>
          </button>
        </div>

        {/* Main Content: 2 Columns on Desktop, Single Column Chat Priority on Mobile */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* LEFT SIDEBAR (Hidden on mobile unless expanded via showMobileMeta, Always visible on Desktop `md:block`) */}
          <div className={`${showMobileMeta ? 'block max-h-[45dvh] overflow-y-auto' : 'hidden'} md:block md:w-72 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800/80 p-3 sm:p-4 space-y-3.5 overflow-y-auto shrink-0 bg-slate-50/40 dark:bg-[#131C32]`}>
            {/* A. KHÁCH HÀNG */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#18243E] p-3 space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-300 block tracking-wider">A. Khách hàng</span>
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-blue-500/10 dark:bg-blue-500/20 text-[#2563EB] dark:text-[#35A8FF] flex items-center justify-center font-bold text-sm shrink-0">
                  👤
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                    {ticket?.profiles?.full_name || 'Khách hàng'}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                    {ticket?.profiles?.email || 'N/A'}
                  </p>
                </div>
              </div>
              {ticket?.profiles?.email && (
                <Link
                  to={`/admin/users?search=${encodeURIComponent(ticket.profiles.email)}`}
                  onClick={onClose}
                  className="mt-1 block w-full text-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-extrabold text-slate-700 dark:text-slate-300 hover:text-[#2563EB] dark:hover:text-[#35A8FF] transition cursor-pointer"
                >
                  🔍 Xem hồ sơ
                </Link>
              )}
            </div>

            {/* B. ĐƠN HÀNG LIÊN KẾT */}
            {ticket?.order_id ? (
              ticket.orders ? (
                <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/40 dark:bg-[#18243E] p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-black uppercase text-[#2563EB] dark:text-[#35A8FF] tracking-wider">B. Đơn hàng liên kết</span>
                    <Link
                      to={`/admin/orders?order_id=${ticket.order_id}&from_ticket=${ticket.ticket_number}`}
                      onClick={onClose}
                      className="text-[11px] font-extrabold text-[#2563EB] dark:text-[#35A8FF] hover:underline flex items-center gap-0.5"
                    >
                      <span>Xem đơn hàng</span>
                      <span>→</span>
                    </Link>
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-white">{ticket.orders.product_name}</p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Gói: {ticket.orders.plan_label}</p>
                    <p className="text-[11px] font-mono font-bold text-[#2563EB] dark:text-[#35A8FF] mt-1">#{ticket.orders.payment_code} • {Number(ticket.orders.price || 0).toLocaleString('vi-VN')}đ</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-[#18243E] p-3 text-center text-xs font-bold text-rose-600 dark:text-rose-400">
                  ⚠️ Đơn hàng không còn tồn tại
                </div>
              )
            ) : (
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#18243E] p-3 text-center text-xs font-semibold text-slate-400">
                Không có đơn hàng liên kết
              </div>
            )}

            {/* C. THÔNG TIN TICKET */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#18243E] p-3 space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-300 block tracking-wider">C. Thông tin Ticket</span>
              
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-600 dark:text-slate-300 font-bold">Trạng thái:</span>
                {getStatusBadge(status)}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-600 dark:text-slate-300 font-bold">Độ ưu tiên:</span>
                {getPriorityBadge(priority)}
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600 dark:text-slate-300 font-bold">Thời gian tạo:</span>
                <span className="font-mono text-slate-900 dark:text-white font-black">
                  {ticket ? new Date(ticket.created_at).toLocaleString('vi-VN') : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-600 dark:text-slate-300 font-bold">Cập nhật cuối:</span>
                <span className="font-mono text-slate-900 dark:text-white font-black">
                  {ticket ? formatRelativeTime(ticket.updated_at) : '—'}
                </span>
              </div>
            </div>

            {/* RESOLVE BUTTON / STATUS INDICATOR AT BOTTOM OF SIDEBAR (Desktop / Expanded Mobile) */}
            {renderSidebarBottomAction()}
          </div>

          {/* MAIN CHAT & COMPOSER (Gets 100% Focus on Mobile) */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/20 dark:bg-[#0F172A]/40 relative">
            {/* Chat Thread */}
            <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3.5">
              {loading ? (
                <div className="py-16 text-center text-xs text-slate-400 font-bold animate-pulse">
                  Đang tải hội thoại CSKH...
                </div>
              ) : messages.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400 font-medium">
                  Chưa có tin nhắn nào trong Ticket này.
                </div>
              ) : (
                messages.map((m) => {
                  const isAdmin = m.sender_role === 'admin';
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'} space-y-1`}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 px-1">
                        <span className={isAdmin ? 'text-purple-500 font-black' : 'text-[#2563EB]'}>
                          {isAdmin ? '👨‍💻 Admin CSKH' : m.profiles?.full_name || m.profiles?.email || 'Khách hàng'}
                        </span>
                        <span>•</span>
                        <span>{new Date(m.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div
                        className={`max-w-[88%] sm:max-w-[82%] rounded-2xl p-3 sm:p-3.5 text-xs font-medium leading-relaxed whitespace-pre-wrap break-words ${
                          isAdmin
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md rounded-tr-xs'
                            : 'bg-white dark:bg-[#18243E] border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white shadow-xs rounded-tl-xs'
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

            {/* COMPOSER & QUICK REPLIES BAR (Sticky at Bottom) */}
            {status === 'closed' ? (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-[#152037] text-center text-xs font-black text-slate-600 dark:text-slate-300 shrink-0">
                🔒 Ticket hỗ trợ này đã được đóng hoàn tất. Không thể gửi thêm phản hồi.
              </div>
            ) : (
              <div className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131C32] p-2.5 sm:p-3 space-y-2 shrink-0">
                {/* Quick replies menu dropdown */}
                <div className="relative" ref={quickRepliesRef}>
                  <button
                    type="button"
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-extrabold text-slate-700 dark:text-slate-200 hover:border-[#2563EB] dark:hover:border-[#35A8FF] transition shadow-2xs cursor-pointer"
                  >
                    <span>⚡ Phản hồi nhanh</span>
                    <span>▾</span>
                  </button>

                  {showQuickReplies && (
                    <div className="absolute bottom-full left-0 mb-2 w-[calc(100vw-32px)] max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#18243E] p-2 shadow-2xl z-50 space-y-1 animate-fade-up">
                      <span className="text-[10px] font-black uppercase text-slate-400 block px-2 py-1">
                        Chọn mẫu phản hồi (Tự động điền khung chát)
                      </span>
                      {QUICK_REPLIES.map((qr, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setInputMsg(qr.text);
                            setShowQuickReplies(false);
                          }}
                          className="w-full text-left p-2 sm:p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-semibold text-slate-800 dark:text-slate-200 transition leading-tight flex flex-col gap-0.5 cursor-pointer"
                        >
                          <span className="font-extrabold text-[#2563EB] dark:text-[#35A8FF]">{qr.label}</span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{qr.text}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chat Input Form */}
                <form onSubmit={handleSendAdminReply} className="flex items-center gap-2">
                  <textarea
                    placeholder="Nhập nội dung phản hồi..."
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                    disabled={sending}
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendAdminReply();
                      }
                    }}
                    className="flex-1 min-h-[44px] max-h-32 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-medium text-slate-900 dark:text-white focus:border-[#2563EB] focus:outline-none transition resize-none"
                  />
                  <button
                    type="submit"
                    disabled={sending || !inputMsg.trim()}
                    className="min-h-[44px] rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 px-4 sm:px-5 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-50 transition shrink-0 self-end cursor-pointer"
                  >
                    {sending ? 'Đang gửi...' : 'Gửi phản hồi 🚀'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
