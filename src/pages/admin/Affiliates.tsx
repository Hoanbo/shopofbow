import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { Pagination } from '../../components/admin/Pagination';

const ITEMS_PER_PAGE = 6;

interface AffiliateConversionRow {
  id: string;
  referrer_id: string | null;
  referee_id: string | null;
  order_id: string | null;
  product_id: string | null;
  product_name: string | null;
  order_amount: number;
  commission_amount: number;
  discount_amount: number;
  is_ctv_order: boolean;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  completed_at: string | null;
  referrer?: { full_name: string | null; email: string | null; referral_code: string | null; role?: string | null } | null;
  referee?: { full_name: string | null; email: string | null; role?: string | null } | null;
}

interface TopReferrer {
  id: string;
  name: string;
  email: string;
  referral_code: string;
  earnings: number;
  count: number;
}

export default function AdminAffiliates() {
  const [conversions, setConversions] = useState<AffiliateConversionRow[]>([]);
  const [topReferrers, setTopReferrers] = useState<TopReferrer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const toast = useToast();

  const fetchAffiliateData = async () => {
    setLoading(true);
    try {
      // 1. Fetch conversions with referrer and referee profile information
      const { data, error } = await (supabase.from('affiliate_conversions') as any)
        .select(`
          *,
          referrer:referrer_id (full_name, email, referral_code, role),
          referee:referee_id (full_name, email, role)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        // If table empty or RLS error, gracefully fallback
        console.warn('[AdminAffiliates] Error or table empty:', error);
      }

      const rows: AffiliateConversionRow[] = data || [];
      setConversions(rows);

      // 2. Aggregate Top Referrers
      const refMap: Record<string, TopReferrer> = {};
      rows.forEach((r) => {
        if (r.referrer_id && r.referrer) {
          if (!refMap[r.referrer_id]) {
            refMap[r.referrer_id] = {
              id: r.referrer_id,
              name: r.referrer.full_name || 'Khách hàng',
              email: r.referrer.email || 'N/A',
              referral_code: r.referrer.referral_code || '---',
              earnings: 0,
              count: 0,
            };
          }
          if (r.status === 'completed') {
            refMap[r.referrer_id].earnings += Number(r.commission_amount || 0);
            refMap[r.referrer_id].count += 1;
          }
        }
      });

      const topList = Object.values(refMap).sort((a, b) => b.earnings - a.earnings).slice(0, 5);
      setTopReferrers(topList);
    } catch (err: any) {
      console.error('Error loading affiliate data:', err);
      toast.error('Lỗi khi tải dữ liệu tiếp thị liên kết');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAffiliateData();
  }, []);

  // Metrics
  const totalRevenue = conversions
    .filter((c) => c.status === 'completed')
    .reduce((sum, c) => sum + Number(c.order_amount || 0), 0);

  const totalCommissionPaid = conversions
    .filter((c) => c.status === 'completed')
    .reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);

  const totalCompletedOrders = conversions.filter((c) => c.status === 'completed').length;

  // Filter conversions
  const filtered = conversions.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (c.product_name || '').toLowerCase().includes(q) ||
      (c.referrer?.full_name || '').toLowerCase().includes(q) ||
      (c.referrer?.email || '').toLowerCase().includes(q) ||
      (c.referrer?.referral_code || '').toLowerCase().includes(q) ||
      (c.referee?.full_name || '').toLowerCase().includes(q) ||
      (c.referee?.email || '').toLowerCase().includes(q) ||
      (c.id || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            🤝 Tiếp thị liên kết (Affiliate System)
          </h1>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Theo dõi dòng tiền giới thiệu, doanh số bán lẻ qua tiếp thị và mạng lưới đối tác CTV.
          </p>
        </div>
        <button
          onClick={fetchAffiliateData}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition"
        >
          🔄 Tải lại
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[24px] border border-[#E8F1FF] dark:border-slate-800 bg-white dark:bg-[#131C32] p-5 shadow-xs">
          <span className="text-xs font-extrabold uppercase tracking-wider text-blue-500">Doanh thu Affiliate</span>
          <p className="mt-1 text-2xl font-black text-blue-600 dark:text-blue-400">
            {totalRevenue.toLocaleString('vi-VN')}đ
          </p>
          <span className="mt-1 block text-[11px] font-semibold text-slate-400">
            Từ {totalCompletedOrders} đơn hàng thành công
          </span>
        </div>

        <div className="rounded-[24px] border border-[#E8F1FF] dark:border-slate-800 bg-white dark:bg-[#131C32] p-5 shadow-xs">
          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-500">Hoa hồng đã chi trả</span>
          <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {totalCommissionPaid.toLocaleString('vi-VN')}đ
          </p>
          <span className="mt-1 block text-[11px] font-semibold text-slate-400">
            Cộng trực tiếp vào số dư ví CTV/Member
          </span>
        </div>

        <div className="rounded-[24px] border border-[#E8F1FF] dark:border-slate-800 bg-white dark:bg-[#131C32] p-5 shadow-xs">
          <span className="text-xs font-extrabold uppercase tracking-wider text-amber-500">Lợi nhuận ròng sau hoa hồng</span>
          <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">
            {Math.max(0, totalRevenue - totalCommissionPaid).toLocaleString('vi-VN')}đ
          </p>
          <span className="mt-1 block text-[11px] font-semibold text-slate-400">
            Doanh thu ròng về shop
          </span>
        </div>
      </div>

      {/* Top Referrers Leaderboard */}
      {topReferrers.length > 0 && (
        <div className="rounded-[28px] border border-amber-200/60 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/40 to-orange-50/20 dark:from-amber-950/20 dark:to-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              🏆 Bảng xếp hạng Top Người Giới Thiệu / CTV Xuất Sắc
            </h3>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
              {topReferrers.length} Đối tác tích cực
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {topReferrers.map((ref, idx) => (
              <div
                key={ref.id}
                className="flex items-center gap-3 rounded-2xl border border-white dark:border-slate-800 bg-white/90 dark:bg-[#18243E] p-3.5 shadow-xs"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-black text-xs ${
                    idx === 0
                      ? 'bg-amber-400 text-amber-950 shadow-xs'
                      : idx === 1
                      ? 'bg-slate-300 text-slate-900'
                      : idx === 2
                      ? 'bg-amber-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  #{idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black text-slate-900 dark:text-white" title={ref.name}>
                    {ref.name}
                  </span>
                  <span className="block text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
                    Ref: {ref.referral_code}
                  </span>
                  <span className="block text-[11px] font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    +{ref.earnings.toLocaleString('vi-VN')}đ ({ref.count} đơn)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-[22px] border border-[#E8F1FF] dark:border-slate-800 bg-white dark:bg-[#131C32] p-3.5 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { key: 'all' as const, label: 'Tất cả', count: conversions.length },
            { key: 'completed' as const, label: 'Đã cộng hoa hồng', count: conversions.filter((c) => c.status === 'completed').length },
            { key: 'pending' as const, label: 'Chờ duyệt', count: conversions.filter((c) => c.status === 'pending').length },
            { key: 'cancelled' as const, label: 'Đã hủy', count: conversions.filter((c) => c.status === 'cancelled').length },
          ].map((st) => {
            const isActive = statusFilter === st.key;
            return (
              <button
                key={st.key}
                type="button"
                onClick={() => setStatusFilter(st.key)}
                className={`group inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#2563EB] text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-semibold'
                }`}
              >
                <span>{st.label}</span>
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold font-mono transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
                  }`}
                >
                  {st.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 max-w-xs w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search theo Tên sản phẩm, Mã Ref, Tên hoặc Email người giới thiệu/người mua..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2 text-xs font-semibold outline-none focus:border-[#2563EB] dark:focus:border-[#35A8FF] text-slate-900 dark:text-white placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[28px] border border-[#E8F1FF] dark:border-slate-800 bg-white dark:bg-[#131C32] shadow-xs">
        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-100 dark:border-slate-800 border-t-[#2563EB]" />
            <p className="mt-3 text-sm font-semibold text-slate-400">Đang tải lịch sử giao dịch tiếp thị...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm font-semibold text-slate-400">
            Chưa có giao dịch tiếp thị liên kết nào.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs table-auto">
              <thead className="border-b border-[#E8F1FF] dark:border-slate-800 bg-[#F8FBFF] dark:bg-slate-800/50 text-[11px] uppercase tracking-wider text-slate-400 font-black">
                <tr>
                  <th className="px-4 py-3.5">Thời gian / Đơn</th>
                  <th className="px-4 py-3.5">Người giới thiệu</th>
                  <th className="px-4 py-3.5">Khách mua</th>
                  <th className="px-4 py-3.5">Sản phẩm</th>
                  <th className="px-4 py-3.5">Giá trị đơn</th>
                  <th className="px-4 py-3.5">Giảm đơn đầu</th>
                  <th className="px-4 py-3.5">Hoa hồng</th>
                  <th className="px-4 py-3.5 text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8F1FF] dark:divide-slate-800">
                {paginated.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                    {/* THỜI GIAN / ĐƠN */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="block font-bold text-slate-800 dark:text-slate-200">
                        {new Date(c.created_at).toLocaleDateString('vi-VN')}
                      </span>
                      <span className="block text-[10px] text-slate-400 font-mono">
                        {new Date(c.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    {/* NGƯỜI GIỚI THIỆU */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {c.is_ctv_order || c.referee?.role === 'ctv' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 px-3 py-1 text-[11px] font-black shadow-xs">
                          👑 Đơn Sỉ CTV
                        </span>
                      ) : c.referrer ? (
                        <div className="min-w-0">
                          <span className="block font-extrabold text-xs text-slate-900 dark:text-white truncate max-w-[130px]" title={c.referrer.full_name || ''}>
                            {c.referrer.full_name || 'Thành viên'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
                            Ref: {c.referrer.referral_code}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 px-2.5 py-0.5 text-[10px] font-bold">
                          Tự mua trực tiếp
                        </span>
                      )}
                    </td>

                    {/* KHÁCH MUA */}
                    <td className="px-4 py-3.5">
                      <div className="min-w-0">
                        <span className="block font-extrabold text-xs text-slate-900 dark:text-white truncate max-w-[150px]" title={c.referee?.full_name || c.referee?.email || ''}>
                          {c.referee?.full_name || (c.referee?.email ? c.referee.email.split('@')[0] : 'Khách hàng')}
                        </span>
                        <span className="block text-[10px] text-slate-400 truncate max-w-[150px]" title={c.referee?.email || ''}>
                          {c.referee?.email || '---'}
                        </span>
                      </div>
                    </td>

                    {/* SẢN PHẨM */}
                    <td className="px-4 py-3.5 font-extrabold text-slate-800 dark:text-slate-200">
                      {c.product_name || 'Sản phẩm'}
                    </td>

                    {/* GIÁ TRỊ ĐƠN */}
                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {Number(c.order_amount || 0).toLocaleString('vi-VN')}đ
                    </td>

                    {/* GIẢM ĐƠN ĐẦU */}
                    <td className="px-4 py-3.5 font-bold text-rose-500 whitespace-nowrap">
                      {Number(c.discount_amount) > 0 ? `-${Number(c.discount_amount).toLocaleString('vi-VN')}đ` : '0đ'}
                    </td>

                    {/* HOA HỒNG */}
                    <td className="px-4 py-3.5 font-black text-emerald-600 dark:text-emerald-400 text-xs whitespace-nowrap">
                      {Number(c.commission_amount) > 0 ? `+${Number(c.commission_amount).toLocaleString('vi-VN')}đ` : '0đ'}
                    </td>

                    {/* TRẠNG THÁI */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {c.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-[10px] font-black">
                          ✓ Đã cộng ví
                        </span>
                      ) : c.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 text-[10px] font-bold">
                          ⏳ Chờ hoàn tất
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 px-2.5 py-0.5 text-[10px] font-bold">
                          ✕ Đã hủy
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filtered.length}
        itemsPerPage={ITEMS_PER_PAGE}
        itemLabel="giao dịch tiếp thị"
        onPageChange={(p) => {
          setCurrentPage(p);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
