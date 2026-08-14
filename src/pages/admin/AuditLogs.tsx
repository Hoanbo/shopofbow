import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { SearchIcon } from '../../components/icons';
import { createPortal } from 'react-dom';
import { Pagination } from '../../components/admin/Pagination';


/**
 * AuditLogItem — list view only (NO metadata, to minimize data sent to browser).
 * metadata is fetched on-demand when Admin opens the detail modal.
 */
export interface AuditLogItem {
  id: string;
  actor_name: string;
  actor_role: 'admin' | 'user' | 'system';
  action: string;
  entity_type: 'order' | 'product' | 'user' | 'wallet' | 'system';
  entity_id?: string | null;
  description: string;
  created_at: string;
}

/**
 * AuditLogDetail — full record including metadata, only fetched when modal is opened.
 * Only the specific log the Admin clicks on is fetched — not bulk-sent.
 */
export interface AuditLogDetail extends AuditLogItem {
  actor_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

// Custom Dark Navy Dropdown Component
interface CustomSelectOption {
  value: string;
  label: string;
  icon?: string;
}

function CustomSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (val: string) => void;
  options: CustomSelectOption[];
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
    <div ref={ref} className="relative inline-block text-left min-w-[170px]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-11 w-full flex items-center justify-between gap-2.5 rounded-2xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-3.5 text-xs font-bold text-slate-800 dark:text-slate-200 hover:border-[#2563EB] dark:hover:border-[#35A8FF] transition shadow-xs"
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOpt.icon && <span>{selectedOpt.icon}</span>}
          <span>{selectedOpt.label}</span>
        </span>
        <svg className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-1.5 w-full min-w-[190px] rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] p-1.5 shadow-2xl animate-fade-in backdrop-blur-md">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl transition text-left ${
                value === opt.value
                  ? 'bg-blue-50 dark:bg-[#2563EB]/20 text-[#2563EB] dark:text-[#35A8FF]'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              {opt.icon && <span>{opt.icon}</span>}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatActionName(action: string): { label: string; icon: string } {
  // Refund / Wallet / Financial
  if (action.includes('refund')) return { label: 'Hoàn tiền', icon: '💸' };
  if (action.includes('wallet')) return { label: 'Đổi số dư ví', icon: '💳' };
  if (action.includes('sepay')) return { label: 'SePay Nạp ví', icon: '💳' };

  // Orders
  if (action.includes('completed')) return { label: 'Bàn giao xong', icon: '✅' };
  if (action.includes('processing')) return { label: 'Đang thiết lập', icon: '⚙️' };
  if (action.includes('pending_delivery')) return { label: 'Chờ bàn giao', icon: '📦' };
  if (action.includes('pending_payment')) return { label: 'Chờ thanh toán', icon: '⏳' };
  if (action.includes('cancelled') || action.includes('cancel_order')) return { label: 'Hủy đơn hàng', icon: '❌' };
  if (action.includes('create_order')) return { label: 'Tạo đơn mới', icon: '🛒' };
  if (action.includes('order_status_change') || action.includes('update_order')) return { label: 'Đổi trạng thái đơn', icon: '🔄' };

  // Tickets
  if (action === 'ticket_reply' || action.includes('ticket_reply')) return { label: 'Phản hồi Ticket', icon: '💬' };
  if (action === 'ticket_closed_by_user') return { label: 'Khách đóng Ticket', icon: '🔒' };
  if (action === 'ticket_closed_by_admin') return { label: 'Admin đóng Ticket', icon: '🔒' };
  if (action === 'ticket_update') return { label: 'Cập nhật Ticket', icon: '🎫' };
  if (action === 'ticket_create') return { label: 'Tạo Ticket hỗ trợ', icon: '🎫' };
  if (action.includes('ticket')) return { label: 'Thao tác Ticket', icon: '🎫' };

  // Reviews
  if (action === 'review_approved') return { label: 'Duyệt Đánh giá', icon: '⭐' };
  if (action === 'review_rejected') return { label: 'Từ chối Đánh giá', icon: '🔴' };
  if (action === 'review_submitted') return { label: 'Gửi Đánh giá', icon: '⭐' };
  if (action.includes('review')) return { label: 'Đánh giá SP', icon: '⭐' };

  // Products
  if (action.includes('create_product')) return { label: 'Tạo sản phẩm', icon: '➕' };
  if (action.includes('update_product')) return { label: 'Sửa sản phẩm', icon: '✏️' };
  if (action.includes('delete_product')) return { label: 'Xóa sản phẩm', icon: '🗑️' };

  // Coupons
  if (action === 'coupon_used' || action === 'coupon_applied') return { label: 'Áp dụng mã giảm', icon: '🎟️' };
  if (action === 'create_coupon') return { label: 'Tạo mã giảm giá', icon: '🎟️' };
  if (action === 'update_coupon') return { label: 'Sửa mã giảm giá', icon: '🎟️' };
  if (action === 'delete_coupon') return { label: 'Xóa mã giảm giá', icon: '🗑️' };
  if (action === 'enable_coupon') return { label: 'Bật mã giảm giá', icon: '▶️' };
  if (action === 'disable_coupon') return { label: 'Tắt mã giảm giá', icon: '⏸️' };
  if (action.includes('coupon')) return { label: 'Mã giảm giá', icon: '🎟️' };

  // Users / System Settings
  if (action.includes('user_update') || action.includes('update_user')) return { label: 'Cập nhật User', icon: '👤' };
  if (action.includes('system_update') || action.includes('update_setting')) return { label: 'Cài đặt hệ thống', icon: '⚙️' };

  // Clean Fallback formatting
  const cleanLabel = action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return { label: cleanLabel, icon: '📋' };
}

function formatEntityTypeLabel(type: string): string {
  if (!type) return '';
  const t = type.toLowerCase();
  if (t === 'support_ticket' || t === 'ticket') return 'TICKET';
  if (t === 'product_review' || t === 'review') return 'ĐÁNH GIÁ';
  if (t === 'coupon') return 'MÃ GIẢM GIÁ';
  if (t === 'product') return 'SẢN PHẨM';
  if (t === 'order') return 'ĐƠN HÀNG';
  if (t === 'user') return 'NGƯỜI DÙNG';
  if (t === 'wallet') return 'VÍ SỐ DƯ';
  if (t === 'system') return 'HỆ THỐNG';
  return type.toUpperCase();
}

function formatStatusLabel(s: string | null | undefined): string {
  if (!s) return '';
  const map: Record<string, string> = {
    pending_payment: 'Chờ thanh toán',
    pending_delivery: 'Chờ bàn giao',
    processing: 'Đang thiết lập',
    completed: 'Hoàn tất',
    cancelled: 'Đã hủy',
    refunded: 'Đã hoàn tiền',
  };
  return map[s] || s;
}

function formatAuditDescription(desc: string | null | undefined): string {
  if (!desc) return '';
  return desc
    // Order & Delivery statuses
    .replace(/"pending_payment"/g, '"Chờ thanh toán"')
    .replace(/"pending_delivery"/g, '"Chờ bàn giao"')
    .replace(/"processing"/g, '"Đang thiết lập"')
    .replace(/"completed"/g, '"Hoàn tất"')
    .replace(/"cancelled"/g, '"Đã hủy"')
    .replace(/"refunded"/g, '"Đã hoàn tiền"')
    .replace(/\bpending_payment\b/g, 'Chờ thanh toán')
    .replace(/\bpending_delivery\b/g, 'Chờ bàn giao')
    .replace(/\bcompleted\b/g, 'Hoàn tất')
    .replace(/\bcancelled\b/g, 'Đã hủy')
    .replace(/\brefunded\b/g, 'Đã hoàn tiền')

    // Ticket Statuses
    .replace(/"pending"/g, '"Chờ phản hồi"')
    .replace(/"resolved"/g, '"Đã giải quyết"')
    .replace(/"closed"/g, '"Đã đóng"')
    .replace(/\bstatus:?\s*pending\b/gi, 'Trạng thái: Chờ phản hồi')
    .replace(/\bstatus:?\s*resolved\b/gi, 'Trạng thái: Đã giải quyết')
    .replace(/\bstatus:?\s*closed\b/gi, 'Trạng thái: Đã đóng')

    // Ticket Priorities
    .replace(/"low"/g, '"Thấp"')
    .replace(/"normal"/g, '"Bình thường"')
    .replace(/"high"/g, '"Cao"')
    .replace(/"urgent"/g, '"Khẩn cấp"')
    .replace(/\bpriority:?\s*urgent\b/gi, 'Mức ưu tiên: Khẩn cấp')
    .replace(/\bpriority:?\s*high\b/gi, 'Mức ưu tiên: Cao')
    .replace(/\bpriority:?\s*normal\b/gi, 'Mức ưu tiên: Bình thường')
    .replace(/\bpriority:?\s*low\b/gi, 'Mức ưu tiên: Thấp')

    // Review Statuses
    .replace(/"approved"/g, '"Đã duyệt"')
    .replace(/"rejected"/g, '"Đã từ chối"')
    .replace(/\bapproved\b/g, 'Đã duyệt')
    .replace(/\brejected\b/g, 'Đã từ chối');
}

function formatEntityId(id?: string | null): string {
  if (!id) return '';
  if (id.length > 16) {
    return `#${id.substring(0, 8)}...`;
  }
  return `#${id}`;
}

/** Fields fetched for the list view — metadata intentionally excluded. */
const AUDIT_LOG_LIST_FIELDS =
  'id, actor_name, actor_role, action, entity_type, entity_id, description, created_at';

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [actorRoleFilter, setActorRoleFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const LOGS_PER_PAGE = 6;

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        // Security: only fetch fields needed for the list view — metadata stays in DB
        .select(AUDIT_LOG_LIST_FIELDS)
        .order('created_at', { ascending: false });

      if (categoryFilter !== 'all') {
        query = query.eq('entity_type', categoryFilter);
      }

      if (actorRoleFilter !== 'all') {
        query = query.eq('actor_role', actorRoleFilter);
      }

      const { data, error } = await query.limit(300);

      if (error) {
        console.warn('[AuditLogs] Error fetching logs:', error.message);
        setLogs([]);
      } else {
        setLogs((data as AuditLogItem[]) || []);
      }
    } catch (err) {
      console.error('[AuditLogs] Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  /** On-demand fetch of full detail (including metadata) for a single log entry. */
  const openLogDetail = async (logId: string) => {
    setDetailLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, actor_id, actor_name, actor_role, action, entity_type, entity_id, description, metadata, created_at')
        .eq('id', logId)
        .single() as any;

      if (error || !data) {
        console.warn('[AuditLogs] Detail fetch error:', error?.message);
      } else {
        setSelectedLog(data as AuditLogDetail);
      }
    } catch (err) {
      console.error('[AuditLogs] Unexpected detail fetch error:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();

    const channel = supabase
      .channel('realtime-audit-logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        (payload) => {
          const newLog = payload.new as AuditLogItem;
          setLogs((prev) => [newLog, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [categoryFilter, actorRoleFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, actorRoleFilter]);

  const filteredLogs = logs.filter((log) => {
    const queryLower = searchQuery.toLowerCase().trim();
    if (!queryLower) return true;
    return (
      (log.description || '').toLowerCase().includes(queryLower) ||
      (log.actor_name || '').toLowerCase().includes(queryLower) ||
      (log.action || '').toLowerCase().includes(queryLower) ||
      (log.entity_id || '').toLowerCase().includes(queryLower)
    );
  });

  const totalPages = Math.ceil(filteredLogs.length / LOGS_PER_PAGE) || 1;
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * LOGS_PER_PAGE,
    currentPage * LOGS_PER_PAGE
  );

  const getActorBadge = (role: AuditLogItem['actor_role']) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center rounded-full bg-purple-50 dark:bg-purple-950/30 px-2 py-0.5 text-[9px] font-black text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/40 shrink-0">
            👑 Admin
          </span>
        );
      case 'user':
        return (
          <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 text-[9px] font-black text-[#2563EB] dark:text-[#35A8FF] border border-blue-200 dark:border-blue-800/40 shrink-0">
            👤 User
          </span>
        );
      case 'system':
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 text-[9px] font-black text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 shrink-0">
            🤖 System
          </span>
        );
    }
  };

  const getActionBadgeStyle = (action: string, entityType: string) => {
    if (action.includes('completed') || action.includes('handover')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40';
    }
    if (action.includes('refund') || action.includes('wallet')) {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40';
    }
    if (action.includes('cancel') || action.includes('delete')) {
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/40';
    }
    if (entityType === 'product') {
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/40';
    }
    return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/40';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            📋 Nhật ký hoạt động <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">Audit Log</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Ghi nhận thời gian thực mọi thao tác quan trọng từ Admin, Người dùng và Hệ thống Webhook (Immutable / Append-only).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 bg-white dark:bg-[#131C32] px-3.5 py-2 rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A]/50 shadow-xs">
            🔒 Append-only (Chỉ đọc)
          </span>
        </div>
      </div>

      {/* SEARCH AND CUSTOM DROPDOWN FILTERS TOOLBAR */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="flex h-11 items-center gap-2 rounded-2xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-4 md:max-w-xs md:flex-1 shadow-xs">
          <SearchIcon className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo Mã đơn, Email, Hành động..."
            className="w-full bg-transparent text-xs font-bold outline-none placeholder:text-slate-400 text-slate-900 dark:text-white"
          />
        </div>

        {/* Custom Dark Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Entity Type Filter */}
          <CustomSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: 'all', label: 'Tất cả đối tượng', icon: '📂' },
              { value: 'order', label: 'Đơn hàng', icon: '📦' },
              { value: 'wallet', label: 'Số dư ví', icon: '💳' },
              { value: 'product', label: 'Sản phẩm', icon: '🛍' },
              { value: 'user', label: 'Người dùng', icon: '👤' },
              { value: 'system', label: 'Hệ thống', icon: '⚙️' },
            ]}
          />

          {/* Actor Role Filter */}
          <CustomSelect
            value={actorRoleFilter}
            onChange={setActorRoleFilter}
            options={[
              { value: 'all', label: 'Tất cả người thực hiện', icon: '👑' },
              { value: 'admin', label: 'Admin', icon: '👑' },
              { value: 'user', label: 'User / Khách hàng', icon: '👤' },
              { value: 'system', label: 'System / Webhook', icon: '🤖' },
            ]}
          />
        </div>
      </div>

      {/* AUDIT LOG TABLE (FIT TO SCREEN WITOUT HORIZONTAL SCROLL) */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-100 dark:border-slate-800 border-t-[#2563EB]" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="py-20 text-center rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] text-slate-400 font-semibold text-xs space-y-2">
          <p>Chưa có nhật ký hoạt động nào được ghi nhận.</p>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          <div className="rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] shadow-xs overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-100/90 dark:bg-[#18243E] text-slate-700 dark:text-slate-200 font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="py-3.5 px-4 w-[120px]">Thời gian</th>
                    <th className="py-3.5 px-3 w-[160px]">Người thực hiện</th>
                    <th className="py-3.5 px-3 w-[130px]">Hành động</th>
                    <th className="py-3.5 px-3 w-[130px]">Đối tượng</th>
                    <th className="py-3.5 px-4">Chi tiết hoạt động</th>
                    <th className="py-3.5 px-4 text-right w-[90px]">Xem thêm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                  {paginatedLogs.map((log) => {
                    const formattedAct = formatActionName(log.action);
                    return (
                      <tr
                        key={log.id}
                        onClick={() => openLogDetail(log.id)}
                        className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 cursor-pointer transition-colors"
                      >
                        {/* Created At */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono text-[11px] font-bold">
                          {new Date(log.created_at).toLocaleDateString('vi-VN')} <span className="text-[10px] opacity-80">{new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>

                        {/* Actor */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {getActorBadge(log.actor_role)}
                            <span className="font-bold text-slate-900 dark:text-white truncate max-w-[100px]" title={log.actor_name}>
                              {log.actor_name}
                            </span>
                          </div>
                        </td>

                        {/* Action Badge */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-extrabold ${getActionBadgeStyle(log.action, log.entity_type)}`}>
                            <span>{formattedAct.icon}</span>
                            <span>{formattedAct.label}</span>
                          </span>
                        </td>

                        {/* Entity Type & Short ID */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                            <span className="uppercase text-[10px] font-black text-sky-600 dark:text-[#35A8FF] tracking-wider mr-1.5">{formatEntityTypeLabel(log.entity_type)}</span>
                            {(() => {
                              if (log.entity_type === 'product') {
                                const match = log.description?.match(/"([^"]+)"/);
                                if (match && match[1]) return `"${match[1]}"`;
                              }
                              return formatEntityId(log.entity_id);
                            })()}
                          </span>
                        </td>

                        {/* Description */}
                        <td className="py-3.5 px-4">
                          <p className="line-clamp-1 leading-normal text-slate-900 dark:text-slate-100 font-semibold">
                            {formatAuditDescription(log.description)}
                          </p>
                        </td>

                        {/* View Details Button */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openLogDetail(log.id);
                            }}
                            disabled={detailLoading}
                            className="rounded-xl border border-blue-200 dark:border-blue-700/60 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 text-[11px] font-extrabold text-[#2563EB] dark:text-[#35A8FF] hover:bg-[#2563EB] hover:text-white dark:hover:bg-[#2563EB] dark:hover:text-white transition shadow-2xs disabled:opacity-50"
                          >
                            {detailLoading ? '⏳' : '🔍'} Chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* PAGINATION */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredLogs.length}
            itemsPerPage={LOGS_PER_PAGE}
            itemLabel="nhật ký"
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* DETAIL MODAL PORTAL */}
      {selectedLog && (
        <ModalDetail
          selectedLog={selectedLog}
          onClose={() => setSelectedLog(null)}
          getActorBadge={getActorBadge}
        />
      )}
    </div>
  );
}

function ModalDetail({
  selectedLog,
  onClose,
  getActorBadge,
}: {
  selectedLog: AuditLogDetail;
  onClose: () => void;
  getActorBadge: (role: AuditLogDetail['actor_role']) => React.ReactNode;
}) {
  // Cast metadata values to safe primitives for rendering (metadata typed as Record<string, unknown>)
  const rawMeta = selectedLog.metadata || {};
  const meta = {
    old_balance: rawMeta.old_balance != null ? Number(rawMeta.old_balance) : null,
    new_balance: rawMeta.new_balance != null ? Number(rawMeta.new_balance) : null,
    change: rawMeta.change != null ? Number(rawMeta.change) : null,
    price: rawMeta.price != null ? Number(rawMeta.price) : null,
    old_status: typeof rawMeta.old_status === 'string' ? rawMeta.old_status : null,
    new_status: typeof rawMeta.new_status === 'string' ? rawMeta.new_status : null,
    product_name: typeof rawMeta.product_name === 'string' ? rawMeta.product_name : (typeof rawMeta.name === 'string' ? rawMeta.name : null),
  };
  const hasMetadata = Object.values(meta).some((v) => v != null);

  const navigate = useNavigate();

  const getHumanEntityName = (type: string, id?: string | null, name?: string) => {
    const t = (type || '').toLowerCase();
    const desc = selectedLog.description || '';

    // Check if description has ticket code like BOW-1004
    const ticketMatch = desc.match(/BOW-\d+/i);
    if ((t === 'support_ticket' || t === 'ticket') && ticketMatch) {
      return `Ticket hỗ trợ #${ticketMatch[0]}`;
    }

    // Check if description has order payment code like BOW... or #BOW...
    const orderMatch = desc.match(/#?(BOW[A-Z0-9]+)/i);
    if (t === 'order' && orderMatch) {
      return `Đơn hàng #${orderMatch[1]}`;
    }

    // Check if description has review code like #ee5b6b84
    const reviewMatch = desc.match(/Đánh giá #([a-f0-9]+)/i);
    if ((t === 'product_review' || t === 'review') && reviewMatch) {
      return `Đánh giá sản phẩm #${reviewMatch[1]}`;
    }

    const cleanId = id ? (id.startsWith('#') ? id.slice(1) : id) : '';
    const shortId = cleanId ? (cleanId.length > 12 ? `#${cleanId.substring(0, 8)}` : `#${cleanId}`) : '';

    if (t === 'wallet') return `Ví số dư (${name || 'Thành viên'})`;
    if (t === 'order') return `Đơn hàng ${shortId}`;
    if (t === 'product') {
      const match = desc.match(/"([^"]+)"/);
      const prodName = meta.product_name || (match ? match[1] : null);
      if (prodName) {
        return `Sản phẩm "${prodName}"`;
      }
      return `Sản phẩm ${shortId}`;
    }
    if (t === 'user') return `Tài khoản (${name || 'Khách hàng'})`;
    if (t === 'support_ticket' || t === 'ticket') return `Ticket hỗ trợ ${shortId}`;
    if (t === 'product_review' || t === 'review') return `Đánh giá sản phẩm ${shortId}`;
    if (t === 'coupon') {
      const match = desc.match(/"([^"]+)"/);
      const code = match ? match[1] : (id || '');
      return `Mã giảm giá ${code ? `"${code}"` : shortId}`;
    }

    const typeVN: Record<string, string> = {
      category: 'Danh mục',
      setting: 'Cài đặt hệ thống',
      system: 'Hệ thống',
      faq: 'FAQ',
    };

    return `${typeVN[t] || t.toUpperCase()} ${shortId}`;
  };

  const getEntityTargetRoute = (): { label: string; route: string; icon: string } | null => {
    const t = (selectedLog.entity_type || '').toLowerCase();
    const desc = selectedLog.description || '';

    // Coupon
    if (t === 'coupon' || selectedLog.action.includes('coupon')) {
      return {
        label: 'Mở Quản lý Mã giảm giá',
        route: '/admin/coupons',
        icon: '🎟️',
      };
    }

    // Ticket
    if (t === 'support_ticket' || t === 'ticket' || selectedLog.action.includes('ticket')) {
      const match = desc.match(/BOW-\d+/i);
      const code = match ? match[0] : (selectedLog.entity_id || '');
      return {
        label: code ? `Mở Ticket ${code}` : 'Đi tới quản lý Ticket',
        route: code ? `/admin/tickets?ticket=${encodeURIComponent(code)}` : '/admin/tickets',
        icon: '🎫',
      };
    }

    // Order
    if (t === 'order' || selectedLog.action.includes('order')) {
      const match = desc.match(/#?(BOW\w+)/i);
      const code = match ? match[1] : (selectedLog.entity_id || '');
      return {
        label: code ? `Mở Đơn hàng #${code}` : 'Đi tới danh sách Đơn hàng',
        route: code ? `/admin/orders?search=${encodeURIComponent(code)}` : '/admin/orders',
        icon: '🛒',
      };
    }

    // Review
    if (t === 'product_review' || t === 'review' || selectedLog.action.includes('review')) {
      const match = desc.match(/#([a-f0-9-]+)/i);
      const id = match ? match[1] : (selectedLog.entity_id || '');
      return {
        label: id ? `Mở Đánh giá #${id.slice(0, 8)}` : 'Đi tới Quản lý Đánh giá',
        route: id ? `/admin/reviews?search=${encodeURIComponent(id)}` : '/admin/reviews',
        icon: '⭐',
      };
    }

    // Product
    if (t === 'product') {
      const match = desc.match(/"([^"]+)"/);
      const name = meta.product_name || (match ? match[1] : null) || selectedLog.entity_id || '';
      return {
        label: name ? `Mở Sản phẩm "${name}"` : 'Đi tới danh sách Sản phẩm',
        route: name ? `/admin/products?search=${encodeURIComponent(name)}` : '/admin/products',
        icon: '📦',
      };
    }

    // User / Wallet
    if (t === 'user' || t === 'wallet') {
      return {
        label: selectedLog.actor_name ? `Mở Người dùng (${selectedLog.actor_name})` : 'Đi tới Quản lý Người dùng',
        route: selectedLog.actor_name ? `/admin/users?search=${encodeURIComponent(selectedLog.actor_name)}` : '/admin/users',
        icon: '👤',
      };
    }

    return null;
  };

  const navTarget = getEntityTargetRoute();

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] p-6 shadow-2xl space-y-4 animate-fade-up">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Chi tiết nhật ký hoạt động</h3>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-850/50 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-300 font-extrabold uppercase block">ID Nhật ký</span>
              <span className="font-mono text-[11px] text-slate-600 dark:text-slate-200 font-bold">{selectedLog.id.substring(0, 18)}...</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-300 font-extrabold uppercase block">Thời gian</span>
              <span className="text-slate-900 dark:text-white font-bold">{new Date(selectedLog.created_at).toLocaleString('vi-VN')}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-300 font-extrabold uppercase block">Người thực hiện</span>
              <div className="flex items-center gap-1.5 mt-0.5 font-bold text-slate-900 dark:text-white">
                {getActorBadge(selectedLog.actor_role)}
                <span>{selectedLog.actor_name}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-300 font-extrabold uppercase block mb-1">Đối tượng tác động</span>
              {navTarget ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(navTarget.route);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 px-2.5 py-1 text-xs font-black text-[#2563EB] dark:text-[#35A8FF] hover:bg-[#2563EB] hover:text-white dark:hover:bg-[#2563EB] dark:hover:text-white transition cursor-pointer shadow-2xs"
                  title="Bấm để mở chi tiết đối tượng"
                >
                  <span>{navTarget.icon}</span>
                  <span>{getHumanEntityName(selectedLog.entity_type, selectedLog.entity_id, selectedLog.actor_name)}</span>
                  <span className="text-[11px] opacity-70">→</span>
                </button>
              ) : (
                <span className="font-extrabold text-[#2563EB] dark:text-[#35A8FF]">
                  {getHumanEntityName(selectedLog.entity_type, selectedLog.entity_id, selectedLog.actor_name)}
                </span>
              )}
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 dark:text-slate-300 font-extrabold uppercase block mb-1">Nội dung hoạt động</span>
            <p className="bg-blue-50/50 dark:bg-blue-950/20 p-3.5 rounded-2xl border border-blue-100 dark:border-blue-900/30 text-slate-900 dark:text-slate-100 font-semibold leading-relaxed">
              {formatAuditDescription(selectedLog.description)}
            </p>
          </div>

          {/* Structured Human-readable Metadata Card */}
          {hasMetadata && (
            <div className="space-y-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Thông tin bổ sung</span>
              <div className="grid grid-cols-2 gap-2.5 bg-slate-50 dark:bg-slate-850/30 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                {meta.old_balance != null && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Số dư ban đầu</span>
                    <span className="font-extrabold text-slate-700 dark:text-slate-300">{meta.old_balance.toLocaleString('vi-VN')}đ</span>
                  </div>
                )}
                {meta.change != null && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Biến động số dư</span>
                    <span className={`font-black ${meta.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {meta.change >= 0 ? '+' : ''}{meta.change.toLocaleString('vi-VN')}đ
                    </span>
                  </div>
                )}
                {meta.new_balance != null && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Số dư mới sau nạp</span>
                    <span className="font-extrabold text-[#2563EB] dark:text-[#35A8FF]">{meta.new_balance.toLocaleString('vi-VN')}đ</span>
                  </div>
                )}
                {meta.price != null && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Giá trị giao dịch</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200">{meta.price.toLocaleString('vi-VN')}đ</span>
                  </div>
                )}
                {meta.old_status && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Trạng thái trước</span>
                    <span className="font-bold text-slate-600 dark:text-slate-400">{formatStatusLabel(meta.old_status)}</span>
                  </div>
                )}
                {meta.new_status && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Trạng thái mới</span>
                    <span className="font-bold text-emerald-500">{formatStatusLabel(meta.new_status)}</span>
                  </div>
                )}
                {meta.product_name && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Sản phẩm mua</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{meta.product_name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Raw JSON deliberately removed — metadata is presented as structured UI cards above.
               If internal debugging is needed, access audit_logs directly via Supabase Studio. */}
        </div>

        <div className="pt-2 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:scale-102 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
