import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Pagination } from '../../components/admin/Pagination';
import AdminTicketDetailModal from '../../components/admin/AdminTicketDetailModal';
import { useRealtimeEvent } from '../../services/realtime';

interface AdminTicketRow {
  id: string;
  ticket_number: string;
  user_id: string;
  order_id?: string | null;
  subject: string;
  status: 'pending' | 'processing' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  updated_at: string;
  profiles?: { full_name?: string; email?: string } | null;
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

export default function AdminTickets() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [tickets, setTickets] = useState<AdminTicketRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const fetchAdminTickets = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('support_tickets')
        .select('*, profiles:profiles!support_tickets_user_id_fkey(full_name, email), orders:orders(product_name, plan_label, payment_code)')
        .order('updated_at', { ascending: false }) as any);

      if (error) throw error;
      setTickets(data || []);
    } catch (e) {
      console.error('Error fetching admin tickets:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminTickets();
  }, [fetchAdminTickets]);

  const ticketParam = searchParams.get('ticket') || searchParams.get('id');
  const searchParamQ = searchParams.get('q') || searchParams.get('search');
  const statusParam = searchParams.get('status') || searchParams.get('filter');

  // Initialize search query and activeFilter from URL
  useEffect(() => {
    if (searchParamQ) {
      setSearchQuery(searchParamQ);
    }
    if (statusParam && ['pending', 'processing', 'resolved', 'closed', 'all'].includes(statusParam)) {
      setActiveFilter(statusParam);
    }
  }, [searchParamQ, statusParam]);

  // Sync URL search param ?ticket=BOW-1001 with selectedTicketId WITHOUT altering searchQuery
  useEffect(() => {
    if (!ticketParam || tickets.length === 0) return;
    const found = tickets.find(
      (t) =>
        t.ticket_number.toLowerCase() === ticketParam.toLowerCase() ||
        t.id === ticketParam
    );
    if (found) {
      setSelectedTicketId(found.id);
    }
  }, [ticketParam, tickets]);

  const handleOpenTicket = (t: AdminTicketRow) => {
    setSelectedTicketId(t.id);
  };

  const handleCloseTicket = () => {
    setSelectedTicketId(null);
    if (searchParams.has('ticket') || searchParams.has('id')) {
      const next = new URLSearchParams(searchParams);
      next.delete('ticket');
      next.delete('id');
      setSearchParams(next, { replace: true });
    }
  };

  // Realtime: INSERT → prepend; UPDATE → patch in-place (no full refetch)
  useRealtimeEvent('support_tickets:INSERT', useCallback(async (e: any) => {
    const newId = e.payload?.id;
    if (!newId) return;
    try {
      const { data } = await (supabase
        .from('support_tickets')
        .select('*, profiles:profiles!support_tickets_user_id_fkey(full_name, email), orders:orders(product_name, plan_label, payment_code)')
        .eq('id', newId)
        .maybeSingle() as any);
      if (!data) return;
      setTickets((prev) => {
        if (prev.some((t) => t.id === data.id)) return prev;
        return [data as AdminTicketRow, ...prev];
      });
    } catch (err) {
      console.error('Realtime ticket insert fetch error:', err);
    }
  }, []));

  useRealtimeEvent('support_tickets:UPDATE', useCallback((e: any) => {
    const updated = e.payload as AdminTicketRow;
    if (!updated?.id) return;
    setTickets((prev) =>
      prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    );
  }, []));

  // Filter & Search
  const filteredTickets = tickets.filter((t) => {
    if (activeFilter !== 'all' && t.status !== activeFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const numMatch = t.ticket_number.toLowerCase().includes(q);
      const nameMatch = (t.profiles?.full_name || '').toLowerCase().includes(q);
      const emailMatch = (t.profiles?.email || '').toLowerCase().includes(q);
      const orderMatch = (t.orders?.payment_code || '').toLowerCase().includes(q);
      const subjectMatch = t.subject.toLowerCase().includes(q);

      return numMatch || nameMatch || emailMatch || orderMatch || subjectMatch;
    }

    return true;
  });

  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getStatusBadge = (status: AdminTicketRow['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
            Chờ xử lý
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
            Đang xử lý
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            Đã giải quyết
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-500/10 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 px-2.5 py-0.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500 shrink-0" />
            Đã đóng
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: AdminTicketRow['priority']) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[9.5px] font-black uppercase text-red-600 dark:text-red-400 tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
            Khẩn cấp
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[9.5px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
            Cao
          </span>
        );
      case 'normal':
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[9.5px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
            Bình thường
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-500/10 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 px-2 py-0.5 text-[9.5px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
            Thấp
          </span>
        );
    }
  };

  // Counts for status tabs
  const pendingCount = tickets.filter((t) => t.status === 'pending').length;
  const processingCount = tickets.filter((t) => t.status === 'processing').length;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>🎫</span> Quản lý Ticket Hỗ Trợ
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Tiếp nhận, xử lý và phản hồi trực tiếp các yêu cầu hỗ trợ từ người dùng.
          </p>
        </div>

        {(pendingCount > 0 || processingCount > 0) && (
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-rose-50 dark:bg-rose-950/40 px-3 py-1 text-xs font-black text-rose-600 dark:text-rose-400 border border-rose-200/50">
                🔴 {pendingCount} Ticket chờ xử lý
              </span>
            )}
            {processingCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/40 px-3 py-1 text-xs font-black text-amber-600 dark:text-amber-400 border border-amber-200/50">
                🟡 {processingCount} Đang xử lý
              </span>
            )}
          </div>
        )}
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#131C32] p-4 rounded-[22px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 shadow-xs">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'pending', label: 'Chờ xử lý (🔴)' },
            { key: 'processing', label: 'Đang xử lý (🟡)' },
            { key: 'resolved', label: 'Đã giải quyết (🟢)' },
            { key: 'closed', label: 'Đã đóng (⚫)' },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => { setActiveFilter(f.key); setCurrentPage(1); }}
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

        {/* Search Bar */}
        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder="Tìm mã ticket, email, tên, đơn hàng..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-white focus:border-[#2563EB] focus:outline-none transition"
          />
        </div>
      </div>

      {/* Mobile Card List (< 768px) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-bold animate-pulse">
            Đang tải danh sách Ticket...
          </div>
        ) : paginatedTickets.length === 0 ? (
          <div className="py-12 text-center text-xs font-medium text-slate-400">
            Không tìm thấy Ticket hỗ trợ nào.
          </div>
        ) : (
          paginatedTickets.map((t) => (
            <div
              key={t.id}
              onClick={() => handleOpenTicket(t)}
              className="rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-4 space-y-3 shadow-xs hover:border-[#2563EB]/40 transition cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-xs font-black text-[#2563EB] dark:text-[#35A8FF]">{t.ticket_number}</span>
                  <span className="text-[11px] text-slate-400">•</span>
                  <span className="text-[11px] text-slate-400 font-mono truncate">{formatRelativeTime(t.updated_at)}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {getPriorityBadge(t.priority)}
                  {getStatusBadge(t.status)}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-0.5">Chủ đề</span>
                <p className="font-extrabold text-slate-900 dark:text-white text-sm leading-snug">{t.subject}</p>
              </div>

              {t.orders && (
                <div className="bg-blue-50/60 dark:bg-blue-950/30 rounded-xl p-2.5 text-xs text-blue-700 dark:text-blue-300 font-semibold flex items-center justify-between">
                  <span className="truncate">📦 {t.orders.product_name}</span>
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">#{t.orders.payment_code}</span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                <div className="min-w-0 flex-1 text-[11px]">
                  <span className="font-bold text-slate-900 dark:text-white block truncate">{t.profiles?.full_name || 'Khách hàng'}</span>
                  <span className="font-mono text-slate-400 block truncate">{t.profiles?.email || 'N/A'}</span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenTicket(t);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 px-3 py-1.5 text-xs font-bold text-[#2563EB] dark:text-[#35A8FF] hover:bg-[#2563EB] hover:text-white dark:hover:bg-[#2563EB] dark:hover:text-white transition shadow-2xs shrink-0"
                >
                  <span>Xem ticket</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Tickets Table (Hidden on mobile < 768px) */}
      <div className="hidden md:block rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-5 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 font-bold animate-pulse">
            Đang tải danh sách Ticket...
          </div>
        ) : paginatedTickets.length === 0 ? (
          <div className="py-16 text-center text-xs font-medium text-slate-400">
            Không tìm thấy Ticket hỗ trợ nào.
          </div>
        ) : (
          <div className="w-full">
            <table className="w-full text-left text-xs font-semibold table-fixed">
              <thead>
                <tr className="text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800/50">
                  <th className="py-3 px-3 w-[11%]">Mã & Cập nhật</th>
                  <th className="py-3 px-3 w-[15%]">Khách hàng</th>
                  <th className="py-3 px-3 w-[15%]">Chủ đề hỗ trợ</th>
                  <th className="py-3 px-3 w-[16%]">Đơn hàng</th>
                  <th className="py-3 px-3 w-[14%]">Ưu tiên</th>
                  <th className="py-3 px-3 w-[17%]">Trạng thái</th>
                  <th className="py-3 px-3 text-right w-[12%]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                {paginatedTickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => handleOpenTicket(t)}
                    className="hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer group"
                  >
                    {/* 1. Mã ticket & Thời gian cập nhật */}
                    <td className="py-3.5 px-3">
                      <span className="font-mono font-bold text-[#2563EB] dark:text-[#35A8FF] text-xs block truncate">
                        {t.ticket_number}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5 truncate">
                        {formatRelativeTime(t.updated_at)}
                      </span>
                    </td>

                    {/* 2. Khách hàng */}
                    <td className="py-3.5 px-3">
                      <span className="font-extrabold text-slate-900 dark:text-white block truncate">
                        {t.profiles?.full_name || 'Khách hàng'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block truncate">
                        {t.profiles?.email || 'N/A'}
                      </span>
                    </td>

                    {/* 3. Chủ đề hỗ trợ */}
                    <td className="py-3.5 px-3">
                      <span className="font-extrabold text-slate-900 dark:text-white block truncate" title={t.subject}>
                        {t.subject}
                      </span>
                    </td>

                    {/* 4. Đơn hàng liên kết */}
                    <td className="py-3.5 px-3">
                      {t.orders ? (
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">{t.orders.product_name}</span>
                          <span className="font-mono text-[10px] text-slate-400 block truncate">#{t.orders.payment_code}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Chung</span>
                      )}
                    </td>

                    {/* 5. Mức ưu tiên */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {getPriorityBadge(t.priority)}
                    </td>

                    {/* 6. Trạng thái */}
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {getStatusBadge(t.status)}
                    </td>

                    {/* 7. Thao tác */}
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenTicket(t);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 px-3 py-1.5 text-xs font-bold text-[#2563EB] dark:text-[#35A8FF] hover:bg-[#2563EB] hover:text-white dark:hover:bg-[#2563EB] dark:hover:text-white transition shadow-2xs"
                      >
                        <span>Xem ticket</span>
                        <span className="transition-transform group-hover:translate-x-0.5">→</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-4 bg-white dark:bg-[#131C32] rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A]/50 shadow-xs">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredTickets.length}
            itemsPerPage={ITEMS_PER_PAGE}
            itemLabel="Ticket"
            onPageChange={(p) => setCurrentPage(p)}
          />
        </div>
      )}

      {/* Admin Ticket Chat Detail Modal */}
      <AdminTicketDetailModal
        ticketId={selectedTicketId}
        onClose={handleCloseTicket}
        onTicketUpdated={fetchAdminTickets}
      />
    </div>
  );
}
