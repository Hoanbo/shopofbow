import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { SearchIcon } from '../../components/icons';
import { createPortal } from 'react-dom';

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
  if (action.includes('refund')) return { label: 'Hoàn tiền', icon: '💸' };
  if (action.includes('completed')) return { label: 'Bàn giao xong', icon: '✅' };
  if (action.includes('processing')) return { label: 'Đang thiết lập', icon: '⚙️' };
  if (action.includes('pending_delivery')) return { label: 'Chờ bàn giao', icon: '📦' };
  if (action.includes('wallet')) return { label: 'Đổi số dư ví', icon: '💳' };
  if (action.includes('create_order')) return { label: 'Tạo đơn mới', icon: '🛒' };
  if (action.includes('create_product')) return { label: 'Tạo sản phẩm', icon: '➕' };
  if (action.includes('update_product')) return { label: 'Sửa sản phẩm', icon: '✏️' };
  if (action.includes('delete_product')) return { label: 'Xóa sản phẩm', icon: '🗑️' };
  if (action.includes('sepay')) return { label: 'SePay Nạp ví', icon: '💳' };
  return { label: action, icon: '📋' };
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
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40 text-slate-400 font-black uppercase text-[10px] tracking-wider">
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
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          {new Date(log.created_at).toLocaleDateString('vi-VN')} <span className="text-[10px] opacity-75">{new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
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
                          <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                            <span className="uppercase text-[10px] font-black text-slate-400 tracking-wider mr-1">{log.entity_type}</span>
                            {formatEntityId(log.entity_id)}
                          </span>
                        </td>

                        {/* Description */}
                        <td className="py-3.5 px-4">
                          <p className="line-clamp-1 leading-normal text-slate-800 dark:text-slate-200 font-medium">
                            {log.description}
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
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-[#2563EB] dark:hover:text-[#35A8FF] transition shadow-2xs disabled:opacity-50"
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
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800/80 pt-4 bg-white dark:bg-[#131C32] p-4 rounded-[22px] border border-[#E8F1FF] shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Hiển thị {((currentPage - 1) * LOGS_PER_PAGE) + 1} - {Math.min(currentPage * LOGS_PER_PAGE, filteredLogs.length)} / {filteredLogs.length} nhật ký
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  ‹ Trở lại
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-7 w-7 rounded-xl text-xs font-extrabold transition ${
                      currentPage === pageNum
                        ? 'bg-gradient-to-r from-[#19A7FF] to-[#2563EB] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  Tiếp ›
                </button>
              </div>
            </div>
          )}
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
  const getHumanEntityName = (type: string, id?: string | null, name?: string) => {
    if (type === 'wallet') return `Ví số dư (${name || 'Thành viên'})`;
    if (type === 'order') return `Đơn hàng ${id ? `#${id}` : ''}`;
    if (type === 'product') return `Sản phẩm ${id ? `#${id}` : ''}`;
    if (type === 'user') return `Tài khoản (${name || 'Khách hàng'})`;
    return `${type.toUpperCase()} ${id ? `#${id}` : ''}`;
  };

  // Cast metadata values to safe primitives for rendering (metadata typed as Record<string, unknown>)
  const rawMeta = selectedLog.metadata || {};
  const meta = {
    old_balance: rawMeta.old_balance != null ? Number(rawMeta.old_balance) : null,
    new_balance: rawMeta.new_balance != null ? Number(rawMeta.new_balance) : null,
    change: rawMeta.change != null ? Number(rawMeta.change) : null,
    price: rawMeta.price != null ? Number(rawMeta.price) : null,
    old_status: typeof rawMeta.old_status === 'string' ? rawMeta.old_status : null,
    new_status: typeof rawMeta.new_status === 'string' ? rawMeta.new_status : null,
    product_name: typeof rawMeta.product_name === 'string' ? rawMeta.product_name : null,
  };
  const hasMetadata = Object.values(meta).some((v) => v != null);

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
              <span className="text-[10px] text-slate-400 font-bold uppercase block">ID Nhật ký</span>
              <span className="font-mono text-[11px] text-slate-500">{selectedLog.id.substring(0, 18)}...</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Thời gian</span>
              <span>{new Date(selectedLog.created_at).toLocaleString('vi-VN')}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Người thực hiện</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {getActorBadge(selectedLog.actor_role)}
                <span>{selectedLog.actor_name}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Đối tượng tác động</span>
              <span className="font-bold text-[#2563EB] dark:text-[#35A8FF]">
                {getHumanEntityName(selectedLog.entity_type, selectedLog.entity_id, selectedLog.actor_name)}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Nội dung hoạt động</span>
            <p className="bg-blue-50/50 dark:bg-blue-950/20 p-3.5 rounded-2xl border border-blue-100 dark:border-blue-900/30 text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
              {selectedLog.description}
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
                    <span className="font-bold text-slate-600 dark:text-slate-400">{meta.old_status}</span>
                  </div>
                )}
                {meta.new_status && (
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Trạng thái mới</span>
                    <span className="font-bold text-emerald-500">{meta.new_status}</span>
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
