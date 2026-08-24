import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import CreateTicketModal from './CreateTicketModal';
import UserTicketChatModal from './UserTicketChatModal';
import { useRealtimeEvent } from '../../services/realtime';

interface TicketRow {
  id: string;
  user_id: string;
  ticket_number: string;
  subject: string;
  status: 'pending' | 'processing' | 'resolved' | 'closed';
  priority: string;
  created_at: string;
  updated_at: string;
  order_id?: string | null;
  orders?: {
    product_name: string;
    plan_label: string;
    payment_code: string;
  } | null;
}

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

export default function UserTicketsTab() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeChatTicketId, setActiveChatTicketId] = useState<string | null>(null);

  const targetTicketParam = searchParams.get('ticket_id') || searchParams.get('ticket');

  const fetchTickets = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('support_tickets')
        .select('*, orders:orders(product_name, plan_label, payment_code)')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false }) as any);

      if (error) throw error;
      setTickets(data || []);
    } catch (e) {
      console.error('Error loading tickets:', e);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Deep linking: Tự động mở Ticket Chat Modal nếu có ?ticket_id=xxx hoặc ?ticket=xxx
  useEffect(() => {
    if (!targetTicketParam || !session?.user?.id) return;

    // Kiểm tra trong danh sách tickets đã load
    const match = tickets.find(
      (t) =>
        t.id === targetTicketParam ||
        t.ticket_number.toLowerCase() === targetTicketParam.toLowerCase(),
    );
    if (match) {
      setActiveChatTicketId(match.id);
      return;
    }

    // Nếu chưa load trong state (ví dụ deep link từ bên ngoài), query trực tiếp
    const fetchTargetTicket = async () => {
      try {
        const { data, error } = await supabase
          .from('support_tickets')
          .select('id, ticket_number')
          .or(`id.eq.${targetTicketParam},ticket_number.eq.${targetTicketParam}`)
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!error && data) {
          setActiveChatTicketId(data.id);
        }
      } catch (err) {
        console.error('Error resolving deep link ticket:', err);
      }
    };

    fetchTargetTicket();
  }, [targetTicketParam, tickets, session?.user?.id]);

  // Realtime Hub: INSERT → prepend; UPDATE → patch in-place
  useRealtimeEvent('support_tickets:INSERT', useCallback((e: any) => {
    const t = e.payload as TicketRow;
    if (!session?.user?.id || t.user_id !== session.user.id) return;
    setTickets((prev) => {
      if (prev.some((r) => r.id === t.id)) return prev;
      return [t, ...prev];
    });
  }, [session?.user?.id]));

  useRealtimeEvent('support_tickets:UPDATE', useCallback((e: any) => {
    const t = e.payload as TicketRow;
    if (!session?.user?.id || t.user_id !== session.user.id) return;
    setTickets((prev) =>
      prev.map((r) => (r.id === t.id ? { ...r, ...t } : r))
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    );
  }, [session?.user?.id]));

  const filteredTickets = tickets.filter((t) => {
    if (activeFilter === 'all') return true;
    return t.status === activeFilter;
  });

  const getStatusBadge = (status: TicketRow['status']) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center rounded-full bg-rose-50 dark:bg-rose-950/40 px-2.5 py-0.5 text-xs font-extrabold text-rose-600 dark:text-rose-400 border border-rose-200/50">🔴 Chờ xử lý</span>;
      case 'processing':
        return <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 text-xs font-extrabold text-amber-600 dark:text-amber-400 border border-amber-200/50">🟡 Đang xử lý</span>;
      case 'resolved':
        return <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 border border-emerald-200/50">🟢 Đã giải quyết</span>;
      case 'closed':
        return <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-extrabold text-slate-600 dark:text-slate-400 border border-slate-200">⚫ Đã đóng</span>;
    }
  };

  return (
    <div className="rounded-[28px] border border-[#E7EEF8] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-6 shadow-xs space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>🎫</span> Yêu cầu hỗ trợ
          </h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Gửi thắc mắc, sự cố đơn hàng hoặc yêu cầu hướng dẫn cho đội ngũ BOW.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#19A7FF] to-[#2563EB] hover:from-[#19A7FF] hover:to-[#1D4ED8] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:scale-102 transition shrink-0"
        >
          <span>+ Tạo yêu cầu mới</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'Tất cả' },
          { key: 'pending', label: 'Chờ xử lý' },
          { key: 'processing', label: 'Đang xử lý' },
          { key: 'resolved', label: 'Đã giải quyết' },
          { key: 'closed', label: 'Đã đóng' },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setActiveFilter(f.key)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
              activeFilter === f.key
                ? 'bg-blue-50 dark:bg-blue-950/50 text-[#2563EB] dark:text-[#35A8FF] shadow-2xs font-extrabold'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Ticket List */}
      {loading ? (
        <div className="space-y-3 py-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 h-20" />
          ))}
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <span className="text-4xl block">🎫</span>
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-200">Bạn chưa có yêu cầu hỗ trợ nào</h3>
          <p className="text-xs font-medium text-slate-400 max-w-sm mx-auto">
            Mọi vấn đề của bạn có thể được theo dõi và xử lý trực tiếp tại đây.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((t) => (
            <div
              key={t.id}
              onClick={() => setActiveChatTicketId(t.id)}
              className="group rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#18243E] p-4 hover:border-[#2563EB]/40 dark:hover:border-[#35A8FF]/40 shadow-2xs transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-black text-[#2563EB] dark:text-[#35A8FF]">{t.ticket_number}</span>
                  {getStatusBadge(t.status)}
                  {t.orders && (
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                      Đơn: #{t.orders.payment_code} - {t.orders.product_name}
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate group-hover:text-[#2563EB] dark:group-hover:text-[#35A8FF] transition">
                  {t.subject}
                </h4>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <span className="text-[11px] font-semibold text-slate-400 font-mono">
                  {formatRelativeTime(t.updated_at)}
                </span>
                <span className="text-xs font-bold text-[#2563EB] dark:text-[#35A8FF] group-hover:translate-x-1 transition-transform">
                  Mở Chat →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateTicketModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onTicketCreated={(tId) => setActiveChatTicketId(tId)}
      />

      <UserTicketChatModal
        ticketId={activeChatTicketId}
        onClose={() => {
          setActiveChatTicketId(null);
          if (searchParams.has('ticket_id') || searchParams.has('ticket')) {
            const next = new URLSearchParams(searchParams);
            next.delete('ticket_id');
            next.delete('ticket');
            setSearchParams(next, { replace: true });
          }
        }}
        onTicketUpdated={fetchTickets}
      />
    </div>
  );
}
