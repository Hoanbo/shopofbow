import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { SearchIcon, StarIcon, CloseIcon } from '../../components/icons';
import { Pagination } from '../../components/admin/Pagination';

type AdminReview = {
  id: string;
  product_id: string;
  user_id: string;
  order_id: string;
  rating: number;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note?: string;
  created_at: string;
  products?: {
    name: string;
    logo_url?: string;
  };
  profiles?: {
    full_name?: string;
    email?: string;
  };
  orders?: {
    payment_code: string;
    status: string;
  };
};

export default function AdminReviews() {
  const [searchParams] = useSearchParams();
  const targetSearch = searchParams.get('q') || searchParams.get('search') || searchParams.get('id');

  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReview, setSelectedReview] = useState<AdminReview | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (targetSearch) {
      setSearchQuery(targetSearch);
    }
  }, [targetSearch]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      // 1. Fetch raw reviews
      const { data: rawReviews, error } = await (supabase
        .from('product_reviews')
        .select('*')
        .order('created_at', { ascending: false }) as any);

      if (error) throw error;
      if (!rawReviews || rawReviews.length === 0) {
        setReviews([]);
        return;
      }

      // 2. Extract unique IDs for batch hydration
      const userIds: string[] = Array.from(new Set(rawReviews.map((r: any) => String(r.user_id)).filter(Boolean)));
      const productIds: string[] = Array.from(new Set(rawReviews.map((r: any) => String(r.product_id)).filter(Boolean)));
      const orderIds: string[] = Array.from(new Set(rawReviews.map((r: any) => String(r.order_id)).filter(Boolean)));

      // 3. Batch fetch profiles, products, and orders in parallel
      const [profilesRes, productsRes, ordersRes] = await Promise.all([
        userIds.length > 0
          ? (supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', userIds) as any)
          : Promise.resolve({ data: [] }),
        productIds.length > 0
          ? (supabase.from('products').select('id, name, logo_url').in('id', productIds) as any)
          : Promise.resolve({ data: [] }),
        orderIds.length > 0
          ? (supabase.from('orders').select('id, payment_code, status').in('id', orderIds) as any)
          : Promise.resolve({ data: [] }),
      ]);

      const profilesMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
      const productsMap = new Map((productsRes.data || []).map((p: any) => [p.id, p]));
      const ordersMap = new Map((ordersRes.data || []).map((o: any) => [o.id, o]));

      // 4. Combine into complete AdminReview items
      const enriched: AdminReview[] = rawReviews.map((r: any) => ({
        ...r,
        profiles: profilesMap.get(r.user_id),
        products: productsMap.get(r.product_id),
        orders: ordersMap.get(r.order_id),
      }));

      setReviews(enriched);
    } catch (err: any) {
      console.error('Fetch admin reviews error:', err);
      toast.error('Lỗi khi tải danh sách đánh giá.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleModerate = async (targetStatus: 'approved' | 'rejected') => {
    if (!selectedReview) return;
    setUpdating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('Không có phiên làm việc Admin.');

      // 1. Update review status
      const { error: upErr } = await (supabase.from('product_reviews') as any)
        .update({
          status: targetStatus,
          admin_note: adminNote.trim() || null,
          reviewed_by: session.user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedReview.id);

      if (upErr) throw upErr;

      const prodName = selectedReview.products?.name || 'Sản phẩm';

      // 2. Audit Log
      await (supabase.from('audit_logs') as any).insert({
        actor_id: session.user.id,
        actor_name: session.user.email || 'Admin',
        actor_role: 'admin',
        action: targetStatus === 'approved' ? 'review_approved' : 'review_rejected',
        entity_type: 'product_review',
        entity_id: selectedReview.id,
        description: `Admin ${targetStatus === 'approved' ? 'duyệt' : 'từ chối'} Đánh giá #${selectedReview.id.slice(0, 8)} cho ${prodName}`,
      });

      // 3. User Notification
      await (supabase.from('notifications') as any).insert({
        user_id: selectedReview.user_id,
        is_admin: false,
        type: 'review_status',
        title: targetStatus === 'approved' ? 'Đánh giá đã được phê duyệt' : 'Cập nhật Đánh giá sản phẩm',
        message: targetStatus === 'approved'
          ? `Đánh giá của bạn cho sản phẩm "${prodName}" đã được phê duyệt và xuất hiện công khai!`
          : `Đánh giá của bạn cho sản phẩm "${prodName}" chưa được phê duyệt. ${adminNote.trim() ? `Lý do: ${adminNote.trim()}` : ''}`,
      });

      toast.success(`Đã ${targetStatus === 'approved' ? 'duyệt' : 'từ chối'} đánh giá!`);
      setSelectedReview(null);
      setAdminNote('');
      fetchReviews();
    } catch (err: any) {
      console.error('Moderate review error:', err);
      toast.error(err.message || 'Lỗi khi cập nhật đánh giá.');
    } finally {
      setUpdating(false);
    }
  };

  // Metrics
  const totalCount = reviews.length;
  const pendingCount = reviews.filter((r) => r.status === 'pending').length;
  const approvedCount = reviews.filter((r) => r.status === 'approved').length;
  const rejectedCount = reviews.filter((r) => r.status === 'rejected').length;

  // Filter & Search
  const filtered = reviews.filter((r) => {
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      (r.products?.name || '').toLowerCase().includes(q) ||
      (r.profiles?.email || '').toLowerCase().includes(q) ||
      (r.profiles?.full_name || '').toLowerCase().includes(q) ||
      (r.orders?.payment_code || '').toLowerCase().includes(q) ||
      r.content.toLowerCase().includes(q);

    return matchesStatus && matchesSearch;
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const REVIEWS_PER_PAGE = 8;
  const totalPages = Math.ceil(filtered.length / REVIEWS_PER_PAGE);
  const paginatedReviews = filtered.slice((currentPage - 1) * REVIEWS_PER_PAGE, currentPage * REVIEWS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchQuery]);

  const getStatusBadge = (status: AdminReview['status']) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/40 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400 border border-amber-200/50">🟡 Chờ duyệt</span>;
      case 'approved':
        return <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200/50">🟢 Đã duyệt</span>;
      case 'rejected':
        return <span className="inline-flex items-center rounded-full bg-rose-50 dark:bg-rose-950/40 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-400 border border-rose-200/50">🔴 Từ chối</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span>⭐</span>
          <span>Quản lý Đánh giá Sản phẩm</span>
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Kiểm duyệt các đánh giá từ khách hàng đã mua sản phẩm trước khi công khai.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#18243E] p-4 space-y-1 shadow-xs">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Tổng Đánh giá</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{totalCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-1 shadow-xs">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">Chờ Kiểm Duyệt</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-1 shadow-xs">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Đã Phê Duyệt</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{approvedCount}</p>
        </div>
        <div className="rounded-2xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 p-4 space-y-1 shadow-xs">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">Đã Từ Chối</span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{rejectedCount}</p>
        </div>
      </div>

      {/* Filters & Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#18243E] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { key: 'all', label: `Tất cả (${totalCount})` },
            { key: 'pending', label: `🟡 Chờ duyệt (${pendingCount})` },
            { key: 'approved', label: `🟢 Đã duyệt (${approvedCount})` },
            { key: 'rejected', label: `🔴 Từ chối (${rejectedCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition shrink-0 cursor-pointer ${
                filterStatus === tab.key
                  ? 'bg-[#2563EB] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[220px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo sản phẩm, user, mã đơn..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-9 pr-3 py-1.5 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none"
          />
        </div>
      </div>

      {/* Table List */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#18243E] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase font-black tracking-wider text-[10px] border-b border-slate-200/60 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3">ID / Khách hàng</th>
                <th className="px-4 py-3">Sản phẩm / Đơn hàng</th>
                <th className="px-4 py-3">Đánh giá</th>
                <th className="px-4 py-3">Nội dung</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-bold animate-pulse">
                    Đang tải danh sách đánh giá...
                  </td>
                </tr>
              ) : paginatedReviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                    Không tìm thấy đánh giá nào.
                  </td>
                </tr>
              ) : (
                paginatedReviews.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3">
                      <span className="font-mono text-[11px] font-bold text-slate-400 block">#{r.id.slice(0, 8)}</span>
                      <span className="font-extrabold text-slate-900 dark:text-white block">
                        {r.profiles?.full_name || 'Khách hàng'}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 block">{r.profiles?.email || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-extrabold text-slate-900 dark:text-white block">{r.products?.name || 'Sản phẩm'}</span>
                      {r.orders?.payment_code && (
                        <span className="font-mono text-[11px] text-[#2563EB] dark:text-[#35A8FF] font-bold">
                          #{r.orders.payment_code}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <StarIcon
                            key={star}
                            className={`h-3.5 w-3.5 ${
                              star <= r.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 dark:fill-slate-700 text-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">
                        {r.rating} / 5 Sao
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate" title={r.content}>
                      {r.content}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(r.status)}</td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {new Date(r.created_at).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => { setSelectedReview(r); setAdminNote(r.admin_note || ''); }}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-extrabold transition cursor-pointer ${
                          r.status === 'pending'
                            ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-xs hover:bg-[#1D4ED8]'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {r.status === 'pending' ? '🔎 Xem & Duyệt' : '👁️ Xem chi tiết'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemsPerPage={REVIEWS_PER_PAGE}
              itemLabel="đánh giá"
              onPageChange={(p) => setCurrentPage(p)}
            />
          </div>
        )}
      </div>

      {/* Moderation Modal */}
      {selectedReview && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={() => !updating && setSelectedReview(null)} />

          <div className="relative z-[100000] w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C32] p-6 shadow-2xl space-y-5 animate-scale-up">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-500 flex items-center justify-center text-xl shrink-0">
                  ⭐
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Chi tiết Đánh giá #{selectedReview.id.slice(0, 8)}</h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">{new Date(selectedReview.created_at).toLocaleString('vi-VN')}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReview(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Current Status Banner */}
            <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-bold ${
              selectedReview.status === 'approved'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : selectedReview.status === 'rejected'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
            }`}>
              <span className="flex items-center gap-1.5 font-black">
                <span>{selectedReview.status === 'approved' ? '🟢' : selectedReview.status === 'rejected' ? '🔴' : '🟡'}</span>
                <span>Trạng thái: {selectedReview.status === 'approved' ? 'Đã Phê Duyệt' : selectedReview.status === 'rejected' ? 'Đã Từ Chối' : 'Chờ Kiểm Duyệt'}</span>
              </span>
              <span className="text-[10px] font-mono opacity-80">
                Order #{selectedReview.orders?.payment_code || 'N/A'}
              </span>
            </div>

            {/* Verification Badges */}
            <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Xác minh hệ thống</span>
              <div className="flex items-center gap-2">
                <span>✓ User đã mua sản phẩm</span>
                <span>•</span>
                <span>✓ Order #{selectedReview.orders?.payment_code || 'N/A'} đã hoàn thành</span>
              </div>
            </div>

            {/* User & Product Details */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#18243E]">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Khách hàng</span>
                <p className="font-extrabold text-slate-900 dark:text-white mt-0.5">{selectedReview.profiles?.full_name || 'Khách hàng'}</p>
                <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">{selectedReview.profiles?.email || 'N/A'}</p>
              </div>

              <div className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#18243E]">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Sản phẩm</span>
                <p className="font-extrabold text-slate-900 dark:text-white mt-0.5">{selectedReview.products?.name || 'Sản phẩm'}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <StarIcon
                      key={star}
                      className={`h-3 w-3 ${star <= selectedReview.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-300'}`}
                    />
                  ))}
                  <span className="font-bold text-amber-500 ml-1">{selectedReview.rating} Sao</span>
                </div>
              </div>
            </div>

            {/* Review Content Box */}
            <div className="space-y-1 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 block">Nội dung đánh giá:</span>
              <div className="p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium whitespace-pre-wrap leading-relaxed">
                {selectedReview.content}
              </div>
            </div>

            {/* Admin Note / Rejection Reason */}
            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                Ghi chú Admin / Lý do từ chối (tùy chọn):
              </label>
              <input
                type="text"
                placeholder="Nhập ghi chú phản hồi cho khách hàng..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              {selectedReview.status === 'pending' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleModerate('rejected')}
                    disabled={updating}
                    className="flex-1 min-h-[44px] rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-4 py-2.5 text-xs font-extrabold text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition cursor-pointer disabled:opacity-50"
                  >
                    ✕ Từ chối Đánh giá
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModerate('approved')}
                    disabled={updating}
                    className="flex-1 min-h-[44px] rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 px-4 py-2.5 text-xs font-black text-white shadow-md transition hover:scale-102 cursor-pointer disabled:opacity-50"
                  >
                    ✓ Phê duyệt Đánh giá
                  </button>
                </>
              )}

              {selectedReview.status === 'approved' && (
                <>
                  <button
                    type="button"
                    disabled
                    className="flex-1 min-h-[44px] rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 px-4 py-2.5 text-xs font-black text-emerald-700 dark:text-emerald-300 cursor-not-allowed opacity-80"
                  >
                    ✓ Đã Phê Duyệt
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModerate('rejected')}
                    disabled={updating}
                    className="flex-1 min-h-[44px] rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-4 py-2.5 text-xs font-extrabold text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition cursor-pointer disabled:opacity-50"
                  >
                    🔴 Chuyển thành Từ Chối
                  </button>
                </>
              )}

              {selectedReview.status === 'rejected' && (
                <>
                  <button
                    type="button"
                    onClick={() => handleModerate('approved')}
                    disabled={updating}
                    className="flex-1 min-h-[44px] rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 px-4 py-2.5 text-xs font-black text-white shadow-md transition hover:scale-102 cursor-pointer disabled:opacity-50"
                  >
                    🟢 Chuyển thành Phê Duyệt
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex-1 min-h-[44px] rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 px-4 py-2.5 text-xs font-black text-rose-700 dark:text-rose-300 cursor-not-allowed opacity-80"
                  >
                    ✕ Đã Từ Chối
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
