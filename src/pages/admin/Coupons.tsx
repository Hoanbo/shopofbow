import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { SearchIcon, CloseIcon } from '../../components/icons';
import { Pagination } from '../../components/admin/Pagination';
import type { Coupon, CouponUsage } from '../../data/coupons';

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'expiring_soon' | 'inactive' | 'expired' | 'first_order'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6; // 6 cards per page for optimal grid layout

  // Modal States
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Usages Modal
  const [selectedUsageCoupon, setSelectedUsageCoupon] = useState<Coupon | null>(null);
  const [usages, setUsages] = useState<CouponUsage[]>([]);
  const [loadingUsages, setLoadingUsages] = useState(false);

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle Pause/Active Modal
  const [toggleTarget, setToggleTarget] = useState<Coupon | null>(null);
  const [toggling, setToggling] = useState(false);

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const toast = useToast();

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    discount_type: 'fixed_amount' as 'percentage' | 'fixed_amount',
    discount_value: 20000,
    minimum_order_amount: 0,
    maximum_discount_amount: '' as string | number,
    usage_limit: '' as string | number,
    per_user_limit: 1,
    first_order_only: false,
    start_at: new Date().toISOString().slice(0, 16),
    expires_at: '',
    is_active: true,
  });

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false }) as any);

      if (error) throw error;
      setCoupons((data || []) as Coupon[]);
    } catch (err: any) {
      console.error('Error fetching coupons:', err);
      toast.error('Lỗi khi tải danh sách mã giảm giá.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  // Helper: Copy code to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast.success(`Đã sao chép mã "${code}"!`);
  };

  // Helper: Determine dynamic status badge
  const getStatusMeta = (c: Coupon) => {
    const now = new Date();

    if (!c.is_active) {
      return {
        key: 'inactive',
        label: 'Tạm dừng',
        badge: '⚪ Tạm dừng',
        badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-600/30 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700',
      };
    }

    if (c.expires_at && new Date(c.expires_at) < now) {
      return {
        key: 'expired',
        label: 'Đã hết hạn',
        badge: '🔴 Hết hạn',
        badgeClass: 'bg-rose-500/10 text-rose-500 border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50',
      };
    }

    if (c.expires_at) {
      const exp = new Date(c.expires_at);
      const diffMs = exp.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 3 && diffDays > 0) {
        return {
          key: 'expiring_soon',
          label: `Còn ${diffDays} ngày`,
          badge: `🟡 Còn ${diffDays} ngày`,
          badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50 animate-pulse',
        };
      }
    }

    return {
      key: 'active',
      label: 'Đang chạy',
      badge: '🟢 Đang chạy',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50',
    };
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingCoupon(null);
    setFormData({
      code: '',
      name: '',
      description: '',
      discount_type: 'fixed_amount',
      discount_value: 20000,
      minimum_order_amount: 0,
      maximum_discount_amount: '',
      usage_limit: '',
      per_user_limit: 1,
      first_order_only: false,
      start_at: new Date().toISOString().slice(0, 16),
      expires_at: '',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (c: Coupon) => {
    setEditingCoupon(c);
    setFormData({
      code: c.code,
      name: c.name,
      description: c.description || '',
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      minimum_order_amount: c.minimum_order_amount || 0,
      maximum_discount_amount: c.maximum_discount_amount ?? '',
      usage_limit: c.usage_limit ?? '',
      per_user_limit: c.per_user_limit || 1,
      first_order_only: c.first_order_only,
      start_at: c.start_at ? new Date(c.start_at).toISOString().slice(0, 16) : '',
      expires_at: c.expires_at ? new Date(c.expires_at).toISOString().slice(0, 16) : '',
      is_active: c.is_active,
    });
    setIsModalOpen(true);
  };

  // Save Coupon (Create or Update)
  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formData.code.trim().toUpperCase();
    if (!cleanCode) {
      toast.error('Mã giảm giá không được để trống.');
      return;
    }
    if (!formData.name.trim()) {
      toast.error('Tên chiến dịch không được để trống.');
      return;
    }
    if (formData.discount_value <= 0) {
      toast.error('Mức giảm phải lớn hơn 0.');
      return;
    }
    if (formData.discount_type === 'percentage' && formData.discount_value > 100) {
      toast.error('Mức giảm theo phần trăm không được vượt quá 100%.');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        code: cleanCode,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        discount_type: formData.discount_type,
        discount_value: Number(formData.discount_value),
        minimum_order_amount: Number(formData.minimum_order_amount) || 0,
        maximum_discount_amount: formData.maximum_discount_amount !== '' ? Number(formData.maximum_discount_amount) : null,
        usage_limit: formData.usage_limit !== '' ? Number(formData.usage_limit) : null,
        per_user_limit: Number(formData.per_user_limit) || 1,
        first_order_only: Boolean(formData.first_order_only),
        start_at: formData.start_at ? new Date(formData.start_at).toISOString() : new Date().toISOString(),
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null,
        is_active: Boolean(formData.is_active),
        updated_at: new Date().toISOString(),
      };

      if (editingCoupon) {
        const { error } = await (supabase
          .from('coupons') as any)
          .update(payload)
          .eq('id', editingCoupon.id);

        if (error) throw error;
        toast.success(`Đã cập nhật mã giảm giá "${cleanCode}" thành công!`);

        // Log audit
        await (supabase as any).rpc('log_audit_event', {
          p_action: 'update_coupon',
          p_entity_type: 'coupon',
          p_description: `Admin cập nhật thông tin mã giảm giá "${cleanCode}"`,
          p_entity_id: editingCoupon.id,
          p_metadata: payload,
        });

        setCoupons(prev => prev.map(item => item.id === editingCoupon.id ? { ...item, ...payload } : item));
      } else {
        const { data: inserted, error } = await (supabase
          .from('coupons') as any)
          .insert(payload)
          .select('*')
          .single();

        if (error) throw error;
        toast.success(`Đã tạo mã giảm giá "${cleanCode}" thành công!`);

        // Log audit
        await (supabase as any).rpc('log_audit_event', {
          p_action: 'create_coupon',
          p_entity_type: 'coupon',
          p_description: `Admin tạo mới mã giảm giá "${cleanCode}" (${payload.name})`,
          p_entity_id: inserted?.id,
          p_metadata: payload,
        });

        if (inserted) {
          setCoupons(prev => [inserted as Coupon, ...prev]);
        }
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving coupon:', err);
      if (err?.code === '23505') {
        toast.error(`Mã giảm giá "${cleanCode}" đã tồn tại! Vui lòng chọn mã khác.`);
      } else {
        toast.error(err?.message || 'Lỗi khi lưu mã giảm giá.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Toggle Active Status
  const handleConfirmToggleStatus = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    const nextStatus = !toggleTarget.is_active;
    try {
      const { error } = await (supabase
        .from('coupons') as any)
        .update({ is_active: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', toggleTarget.id);

      if (error) throw error;
      toast.success(`Đã ${nextStatus ? 'kích hoạt' : 'tạm dừng'} mã "${toggleTarget.code}"!`);

      // Log audit
      await (supabase as any).rpc('log_audit_event', {
        p_action: nextStatus ? 'enable_coupon' : 'disable_coupon',
        p_entity_type: 'coupon',
        p_description: `Admin ${nextStatus ? 'bật kích hoạt' : 'tạm dừng'} mã giảm giá "${toggleTarget.code}"`,
        p_entity_id: toggleTarget.id,
      });

      setCoupons(prev => prev.map(item => item.id === toggleTarget.id ? { ...item, is_active: nextStatus } : item));
      setToggleTarget(null);
    } catch (err: any) {
      toast.error('Lỗi khi thay đổi trạng thái mã giảm giá.');
    } finally {
      setToggling(false);
    }
  };

  // Delete Coupon
  const handleDeleteCoupon = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await (supabase
        .from('coupons') as any)
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;
      toast.success(`Đã xóa mã giảm giá "${deleteTarget.code}"!`);

      // Log audit
      await (supabase as any).rpc('log_audit_event', {
        p_action: 'delete_coupon',
        p_entity_type: 'coupon',
        p_description: `Admin xóa mã giảm giá "${deleteTarget.code}"`,
        p_entity_id: deleteTarget.id,
      });

      setCoupons(prev => prev.filter(item => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error('Lỗi khi xóa mã giảm giá.');
    } finally {
      setDeleting(false);
    }
  };

  // Fetch Usages History (Batch Hydration)
  const handleViewUsages = async (c: Coupon) => {
    setSelectedUsageCoupon(c);
    setLoadingUsages(true);
    try {
      const { data: rawUsages, error } = await (supabase
        .from('coupon_usages') as any)
        .select('*')
        .eq('coupon_id', c.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const usageList = rawUsages || [];
      if (usageList.length === 0) {
        setUsages([]);
        return;
      }

      // Collect user and order IDs
      const userIds = Array.from(new Set(usageList.map((u: any) => u.user_id).filter(Boolean)));
      const orderIds = Array.from(new Set(usageList.map((u: any) => u.order_id).filter(Boolean)));

      const [profilesRes, ordersRes] = await Promise.all([
        userIds.length
          ? (supabase.from('profiles') as any).select('id, full_name, email').in('id', userIds)
          : { data: [] },
        orderIds.length
          ? (supabase.from('orders') as any).select('id, payment_code, product_name').in('id', orderIds)
          : { data: [] },
      ]);

      const profilesMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));
      const ordersMap = new Map((ordersRes.data || []).map((o: any) => [o.id, o]));

      const hydrated = usageList.map((u: any) => ({
        ...u,
        profiles: profilesMap.get(u.user_id),
        orders: ordersMap.get(u.order_id),
      }));

      setUsages(hydrated);
    } catch (err: any) {
      console.error('Error fetching coupon usages:', err);
      toast.error('Không thể tải lịch sử sử dụng mã.');
    } finally {
      setLoadingUsages(false);
    }
  };

  // Statistics
  const stats = useMemo(() => {
    const total = coupons.length;
    const now = new Date();
    let active = 0;
    let expiringSoon = 0;
    let inactive = 0;
    let expired = 0;
    let firstOrder = 0;
    let totalUsages = 0;

    coupons.forEach((c) => {
      totalUsages += c.used_count || 0;
      if (c.first_order_only) firstOrder++;

      if (!c.is_active) {
        inactive++;
        return;
      }

      if (c.expires_at && new Date(c.expires_at) < now) {
        expired++;
        return;
      }

      if (c.expires_at) {
        const exp = new Date(c.expires_at);
        const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 3 && diffDays > 0) {
          expiringSoon++;
        }
      }

      active++;
    });

    return { total, active, expiringSoon, inactive, expired, firstOrder, totalUsages };
  }, [coupons]);

  // Filter & Search
  const filteredCoupons = useMemo(() => {
    let list = coupons;

    // Filter tab
    if (filterTab === 'active') {
      list = list.filter(c => c.is_active && (!c.expires_at || new Date(c.expires_at) >= new Date()));
    } else if (filterTab === 'expiring_soon') {
      const now = new Date();
      list = list.filter(c => {
        if (!c.is_active || !c.expires_at) return false;
        const exp = new Date(c.expires_at);
        const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 3 && diffDays > 0;
      });
    } else if (filterTab === 'inactive') {
      list = list.filter(c => !c.is_active);
    } else if (filterTab === 'expired') {
      const now = new Date();
      list = list.filter(c => c.expires_at && new Date(c.expires_at) < now);
    } else if (filterTab === 'first_order') {
      list = list.filter(c => c.first_order_only);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q))
      );
    }

    return list;
  }, [coupons, filterTab, searchQuery]);

  const totalPages = Math.ceil(filteredCoupons.length / ITEMS_PER_PAGE);
  const paginatedCoupons = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCoupons.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCoupons, currentPage]);

  return (
    <div className="space-y-6">
      {/* ────────────────────────────────────────────────────────
          1. HEADER TRANG COUPON
      ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-[#35A8FF] border border-blue-500/20 text-xl shrink-0">
              🎟️
            </span>
            <span>Mã giảm giá</span>
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Quản lý coupon, chiến dịch khuyến mãi và lịch sử sử dụng.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#00A3FF] to-[#2563EB] hover:from-[#008AE6] hover:to-[#1D4ED8] px-5 py-3 text-xs font-black text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-102 active:scale-98 cursor-pointer shrink-0"
        >
          <span className="text-base leading-none">＋</span>
          <span>Tạo mã giảm giá</span>
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────
          2. METRICS OVERVIEW CARDS
      ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131C32] p-4 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Tổng mã coupon</span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Đang hoạt động</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 p-4 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Sắp hết hạn</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{stats.expiringSoon}</p>
        </div>
        <div className="rounded-2xl border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 p-4 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-[#2563EB] dark:text-[#35A8FF]">Tổng lượt đã dùng</span>
          <p className="text-2xl font-black text-[#2563EB] dark:text-[#35A8FF] mt-1">{stats.totalUsages}</p>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────
          3. SEARCH & FILTER CONTROLS
      ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131C32] p-3 shadow-xs">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="🔍 Tìm mã giảm giá hoặc tên chiến dịch..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 pl-10 pr-9 text-xs font-medium text-slate-900 dark:text-white outline-none transition focus:border-[#2563EB] dark:focus:border-[#35A8FF] placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => { setFilterTab('all'); setCurrentPage(1); }}
            className={`rounded-xl px-3 py-2 text-xs font-black transition cursor-pointer shrink-0 ${
              filterTab === 'all'
                ? 'bg-[#2563EB] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Tất cả ({coupons.length})
          </button>
          <button
            type="button"
            onClick={() => { setFilterTab('active'); setCurrentPage(1); }}
            className={`rounded-xl px-3 py-2 text-xs font-black transition cursor-pointer shrink-0 ${
              filterTab === 'active'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            🟢 Đang chạy ({stats.active})
          </button>
          {stats.expiringSoon > 0 && (
            <button
              type="button"
              onClick={() => { setFilterTab('expiring_soon'); setCurrentPage(1); }}
              className={`rounded-xl px-3 py-2 text-xs font-black transition cursor-pointer shrink-0 ${
                filterTab === 'expiring_soon'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              🟡 Sắp hết hạn ({stats.expiringSoon})
            </button>
          )}
          <button
            type="button"
            onClick={() => { setFilterTab('inactive'); setCurrentPage(1); }}
            className={`rounded-xl px-3 py-2 text-xs font-black transition cursor-pointer shrink-0 ${
              filterTab === 'inactive'
                ? 'bg-slate-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            ⚪ Tạm dừng ({stats.inactive})
          </button>
          <button
            type="button"
            onClick={() => { setFilterTab('expired'); setCurrentPage(1); }}
            className={`rounded-xl px-3 py-2 text-xs font-black transition cursor-pointer shrink-0 ${
              filterTab === 'expired'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            🔴 Hết hạn ({stats.expired})
          </button>
          <button
            type="button"
            onClick={() => { setFilterTab('first_order'); setCurrentPage(1); }}
            className={`rounded-xl px-3 py-2 text-xs font-black transition cursor-pointer shrink-0 ${
              filterTab === 'first_order'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            ⭐ Đơn đầu tiên ({stats.firstOrder})
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────
          4. COUPON CARD GRID LIST
      ──────────────────────────────────────────────────────── */}
      {loading ? (
        /* 15. LOADING SKELETON STATE */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse rounded-[28px] border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-[#131C32] p-6 space-y-4 shadow-xs">
              <div className="flex justify-between items-center">
                <div className="h-7 w-32 rounded-xl bg-slate-200 dark:bg-slate-800" />
                <div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-800" />
              </div>
              <div className="h-5 w-3/4 rounded-lg bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-full rounded-lg bg-slate-100 dark:bg-slate-850" />
              <div className="h-20 rounded-2xl bg-slate-100 dark:bg-slate-800/60" />
              <div className="flex justify-between pt-2">
                <div className="h-8 w-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
                <div className="h-8 w-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredCoupons.length === 0 ? (
        /* 14. EMPTY STATE */
        <div className="rounded-[28px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131C32] p-12 text-center shadow-xs">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-500/10 text-3xl text-[#2563EB] dark:text-[#35A8FF] mb-4 border border-blue-500/20">
            🎟️
          </div>
          {searchQuery || filterTab !== 'all' ? (
            <div className="space-y-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white">Không tìm thấy coupon phù hợp</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Không có mã giảm giá nào khớp với từ khóa tìm kiếm hoặc bộ lọc hiện tại.
              </p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setFilterTab('all'); setCurrentPage(1); }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                <span>✕</span>
                <span>Xóa bộ lọc</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white">Chưa có mã giảm giá nào</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Tạo coupon đầu tiên để bắt đầu chạy chương trình khuyến mãi và thu hút khách hàng.
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#35A8FF] dark:hover:bg-[#2563EB] px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:scale-102 cursor-pointer"
              >
                <span>＋</span>
                <span>Tạo mã giảm giá</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* COUPON CARDS GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {paginatedCoupons.map((c) => {
            const statusMeta = getStatusMeta(c);
            const usagePercent = c.usage_limit ? Math.min(100, Math.round((c.used_count / c.usage_limit) * 100)) : null;

            return (
              <div
                key={c.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-[28px] border border-slate-200/80 dark:border-slate-800/90 bg-white dark:bg-[#131C32] p-5 sm:p-6 shadow-xs hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-900/80 transition-all duration-300"
              >
                {/* Top decorative gradient glow */}
                <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-blue-500/5 dark:bg-blue-500/10 blur-2xl group-hover:bg-blue-500/20 transition-all" />

                <div className="space-y-4 relative z-10">
                  {/* CARD HEADER: Code & Status */}
                  <div className="flex items-start justify-between gap-3">
                    {/* Coupon Code Pill */}
                    <button
                      type="button"
                      onClick={() => handleCopyCode(c.code)}
                      title="Click để sao chép mã"
                      className="group/code inline-flex items-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800/80 bg-blue-50/70 dark:bg-blue-950/60 px-3 py-1.5 transition-all hover:scale-102 active:scale-98 cursor-pointer shadow-2xs"
                    >
                      <span className="text-sm">🎟️</span>
                      <span className="font-mono text-sm font-black tracking-wider text-[#2563EB] dark:text-[#35A8FF]">
                        {c.code}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 group-hover/code:text-[#2563EB] dark:group-hover/code:text-[#35A8FF] transition">
                        {copiedCode === c.code ? '✓' : '📋'}
                      </span>
                    </button>

                    {/* Status Badge */}
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black shrink-0 ${statusMeta.badgeClass}`}>
                      {statusMeta.badge}
                    </span>
                  </div>

                  {/* CAMPAIGN NAME & DESCRIPTION */}
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug group-hover:text-[#2563EB] dark:group-hover:text-[#35A8FF] transition">
                      {c.name}
                    </h3>
                    {c.description && (
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {c.description}
                      </p>
                    )}
                  </div>

                  {/* 🌟 DISCOUNT CORE TICKET BOX */}
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-[#18243E]/90 p-4 space-y-3">
                    {/* Discount value banner */}
                    <div className="flex items-baseline justify-between gap-2 border-b border-slate-200/60 dark:border-slate-700/60 pb-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Mức giảm giá
                      </span>
                      <div className="text-right">
                        <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                          {c.discount_type === 'percentage' ? `${c.discount_value}%` : `-${c.discount_value.toLocaleString('vi-VN')}đ`}
                        </span>
                        {Boolean(c.discount_type === 'percentage' && c.maximum_discount_amount) && (
                          <span className="block text-[10px] font-bold text-slate-400">
                            Tối đa {Number(c.maximum_discount_amount).toLocaleString('vi-VN')}đ
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 3 Metric Badges */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 p-2">
                        <span className="text-[10px] font-bold text-slate-400 block">Đơn tối thiểu</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                          {c.minimum_order_amount > 0 ? `≥ ${c.minimum_order_amount.toLocaleString('vi-VN')}đ` : 'Không yêu cầu'}
                        </span>
                      </div>

                      <div className="rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 p-2">
                        <span className="text-[10px] font-bold text-slate-400 block">Lượt sử dụng</span>
                        <div className="flex items-center gap-1 font-extrabold text-slate-800 dark:text-slate-200">
                          <span>{c.used_count}</span>
                          <span className="text-slate-400 font-normal">/</span>
                          <span>{c.usage_limit ? c.usage_limit : '∞'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Usage Progress bar if limit exists */}
                    {usagePercent !== null && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-400">
                          <span>Đã dùng {usagePercent}%</span>
                          <span>Còn {Math.max(0, (c.usage_limit || 0) - c.used_count)} lượt</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              usagePercent >= 90 ? 'bg-rose-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-[#2563EB] dark:bg-[#35A8FF]'
                            }`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* CONDITIONS & VALIDITY PILLS */}
                  <div className="space-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300 pt-1">
                    {/* Audience */}
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">👤 Đối tượng:</span>
                      {c.first_order_only ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 px-2.5 py-0.5 text-[10px] font-black text-purple-700 dark:text-purple-300">
                          ⭐ Người dùng mới (Đơn đầu)
                        </span>
                      ) : (
                        <span className="font-bold text-slate-800 dark:text-slate-200">Tất cả khách hàng</span>
                      )}
                    </div>

                    {/* Per user limit */}
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">🔒 Giới hạn:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {c.per_user_limit} lần / mỗi user
                      </span>
                    </div>

                    {/* Validity */}
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="text-slate-400 font-sans">📅 Thời hạn:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {new Date(c.start_at).toLocaleDateString('vi-VN')} → {c.expires_at ? new Date(c.expires_at).toLocaleDateString('vi-VN') : 'Vô thời hạn'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ────────────────────────────────────────────────────────
                    ACTIONS FOOTER BUTTONS
                ──────────────────────────────────────────────────────── */}
                <div className="mt-5 border-t border-slate-100 dark:border-slate-800/80 pt-4 flex items-center justify-between gap-2">
                  {/* Primary Left Actions */}
                  <div className="flex items-center gap-2 flex-1">
                    <button
                      type="button"
                      onClick={() => handleViewUsages(c)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 py-2 px-3 text-xs font-black text-slate-700 dark:text-slate-200 transition shadow-2xs cursor-pointer"
                    >
                      <span>📊</span>
                      <span>Lịch sử</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(c)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 py-2 px-3 text-xs font-black text-[#2563EB] dark:text-[#35A8FF] transition shadow-2xs cursor-pointer"
                    >
                      <span>✏️</span>
                      <span>Sửa</span>
                    </button>
                  </div>

                  {/* Compact Right Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setToggleTarget(c)}
                      title={c.is_active ? 'Tạm dừng coupon này' : 'Kích hoạt lại coupon này'}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl transition cursor-pointer shadow-2xs ${
                        c.is_active
                          ? 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      <span className="text-sm">{c.is_active ? '⏸' : '▶'}</span>
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(c)}
                      title="Xóa coupon"
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 text-rose-600 dark:text-rose-400 transition cursor-pointer shadow-2xs"
                    >
                      <span className="text-sm">🗑</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="pt-2">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredCoupons.length}
            itemsPerPage={ITEMS_PER_PAGE}
            itemLabel="mã giảm giá"
            onPageChange={(p) => setCurrentPage(p)}
          />
        </div>
      )}

      {/* ────────────────────────────────────────────────────────
          MODAL: TẠO / SỬA MÃ GIẢM GIÁ
      ──────────────────────────────────────────────────────── */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={() => !saving && setIsModalOpen(false)} />

          <div className="relative z-[100000] w-full max-w-xl max-h-[90dvh] flex flex-col overflow-hidden rounded-[24px] sm:rounded-[28px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C32] shadow-2xl animate-scale-up text-slate-900 dark:text-white">
            {/* Header (Fixed) */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4 sm:p-6 shrink-0">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-[#2563EB] dark:text-[#35A8FF] flex items-center justify-center text-xl shrink-0">
                  🎟️
                </span>
                <div>
                  <h3 className="text-base font-black">
                    {editingCoupon ? `Chỉnh sửa mã: ${editingCoupon.code}` : 'Tạo mã giảm giá mới'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cấu hình chi tiết mức giảm, thời hạn và điều kiện áp dụng
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveCoupon} className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-500 dark:text-slate-300 mb-1">
                      Mã Coupon * (Tự động viết hoa)
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="VD: WELCOME20, BOW10..."
                      className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-mono font-bold uppercase text-slate-900 dark:text-white focus:border-[#2563EB] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-500 dark:text-slate-300 mb-1">
                      Tên chiến dịch *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="VD: Khuyến mãi khai trương..."
                      className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-semibold text-slate-900 dark:text-white focus:border-[#2563EB] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-black uppercase text-[10px] text-slate-500 dark:text-slate-300 mb-1">
                    Mô tả chi tiết (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="VD: Giảm 20K cho khách hàng mới mua đơn đầu tiên..."
                    className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-medium text-slate-900 dark:text-white focus:border-[#2563EB] outline-none"
                  />
                </div>

                {/* 🌟 CẤU HÌNH MỨC GIẢM — SÁNG RÕ & TRỰC QUAN */}
                <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-[#18243E] p-4 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💰</span>
                    <span className="font-black uppercase text-xs tracking-wider text-slate-800 dark:text-slate-100">
                      Cấu hình mức giảm
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className={`flex items-center gap-2.5 rounded-xl border-2 p-3 cursor-pointer transition ${
                      formData.discount_type === 'fixed_amount'
                        ? 'border-[#2563EB] dark:border-[#35A8FF] bg-white dark:bg-blue-950/70 text-[#2563EB] dark:text-[#35A8FF] font-black shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold hover:border-blue-300 dark:hover:border-blue-700'
                    }`}>
                      <input
                        type="radio"
                        name="discount_type"
                        checked={formData.discount_type === 'fixed_amount'}
                        onChange={() => setFormData({ ...formData, discount_type: 'fixed_amount' })}
                        className="hidden"
                      />
                      <span className="text-base">💵</span>
                      <span className="text-xs">Số tiền cố định (VNĐ)</span>
                    </label>

                    <label className={`flex items-center gap-2.5 rounded-xl border-2 p-3 cursor-pointer transition ${
                      formData.discount_type === 'percentage'
                        ? 'border-[#2563EB] dark:border-[#35A8FF] bg-white dark:bg-blue-950/70 text-[#2563EB] dark:text-[#35A8FF] font-black shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold hover:border-blue-300 dark:hover:border-blue-700'
                    }`}>
                      <input
                        type="radio"
                        name="discount_type"
                        checked={formData.discount_type === 'percentage'}
                        onChange={() => setFormData({ ...formData, discount_type: 'percentage' })}
                        className="hidden"
                      />
                      <span className="text-base">📊</span>
                      <span className="text-xs">Phần trăm (%)</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block font-black uppercase text-[10px] text-slate-500 dark:text-slate-300 mb-1">
                        {formData.discount_type === 'fixed_amount' ? 'Số tiền giảm (VNĐ) *' : 'Phần trăm giảm (%) *'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={formData.discount_type === 'percentage' ? 100 : undefined}
                        required
                        value={formData.discount_value || ''}
                        onChange={(e) => setFormData({ ...formData, discount_value: Number(e.target.value) })}
                        placeholder={formData.discount_type === 'fixed_amount' ? 'VD: 20000, 50000...' : 'VD: 10, 20, 50...'}
                        className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-bold text-slate-900 dark:text-white focus:border-[#2563EB] outline-none"
                      />
                    </div>

                    {formData.discount_type === 'percentage' && (
                      <div>
                        <label className="block font-black uppercase text-[10px] text-slate-500 dark:text-slate-300 mb-1">
                          Số tiền giảm tối đa (VNĐ) (tùy chọn)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={formData.maximum_discount_amount || ''}
                          onChange={(e) => setFormData({ ...formData, maximum_discount_amount: e.target.value ? Number(e.target.value) : '' })}
                          placeholder="VD: 50000 (để trống = không giới hạn)"
                          className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-bold text-slate-900 dark:text-white focus:border-[#2563EB] outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 🌟 ĐIỀU KIỆN ÁP DỤNG & GIỚI HẠN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-500 dark:text-slate-300 mb-1">
                      Giá trị đơn hàng tối thiểu (VNĐ)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.minimum_order_amount || ''}
                      onChange={(e) => setFormData({ ...formData, minimum_order_amount: Number(e.target.value) })}
                      placeholder="0 = Không yêu cầu"
                      className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-bold text-slate-900 dark:text-white focus:border-[#2563EB] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-500 dark:text-slate-300 mb-1">
                      Tổng số lượt dùng tối đa (Toàn hệ thống)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={formData.usage_limit || ''}
                      onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value ? Number(e.target.value) : '' })}
                      placeholder="Để trống = Không giới hạn"
                      className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-bold text-slate-900 dark:text-white focus:border-[#2563EB] outline-none"
                    />
                  </div>
                </div>

                {/* 🌟 THỜI GIAN ÁP DỤNG */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-500 dark:text-slate-300 mb-1">
                      Thời gian bắt đầu (tùy chọn)
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.start_at}
                      onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
                      className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-medium text-slate-900 dark:text-white focus:border-[#2563EB] outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-black uppercase text-[10px] text-slate-500 dark:text-slate-300 mb-1">
                      Thời gian hết hạn (tùy chọn)
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.expires_at}
                      onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                      className="h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-medium text-slate-900 dark:text-white focus:border-[#2563EB] outline-none text-xs"
                    />
                  </div>
                </div>

                {/* 🌟 TÙY CHỌN NÂNG CAO */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 bg-slate-50/50 dark:bg-slate-800/40">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.first_order_only}
                      onChange={(e) => setFormData({ ...formData, first_order_only: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded text-[#2563EB] focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-extrabold text-slate-900 dark:text-white block">
                        ⭐ Chỉ áp dụng cho đơn hàng đầu tiên của khách hàng
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        Khách hàng đã từng mua bất kỳ đơn hàng thành công nào trước đây sẽ không thể áp dụng mã này.
                      </span>
                    </div>
                  </label>
                </div>

                <label className="flex items-center gap-3 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 rounded text-[#2563EB] focus:ring-blue-500"
                  />
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">
                    Kích hoạt mã giảm giá này ngay
                  </span>
                </label>
              </div>

              {/* Submit Buttons (Fixed Footer) */}
              <div className="flex items-center justify-end gap-3 p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-[#18243E]/50 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="rounded-xl px-4 py-2.5 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#35A8FF] dark:hover:bg-[#2563EB] px-5 py-2.5 font-black text-white shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Đang lưu...' : editingCoupon ? 'Cập nhật mã' : 'Tạo mã giảm giá'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ────────────────────────────────────────────────────────
          MODAL: XEM LỊCH SỬ SỬ DỤNG COUPON
      ──────────────────────────────────────────────────────── */}
      {selectedUsageCoupon && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overscroll-contain overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={() => setSelectedUsageCoupon(null)} />

          <div className="relative z-[100000] w-full max-w-2xl max-h-[85dvh] sm:max-h-[90dvh] my-auto flex flex-col overflow-hidden rounded-[24px] sm:rounded-[28px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C32] shadow-2xl animate-scale-up text-slate-900 dark:text-white">
            {/* Header (Fixed) */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4 sm:p-5 shrink-0">
              <div className="min-w-0 flex-1 pr-2">
                <h3 className="text-base font-black flex items-center gap-2 truncate">
                  <span>📊</span>
                  <span className="truncate">Lịch sử dùng mã: <span className="font-mono text-[#2563EB] dark:text-[#35A8FF]">{selectedUsageCoupon.code}</span></span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  Chiến dịch: <strong>{selectedUsageCoupon.name}</strong> • Tổng lượt đã dùng: <strong>{selectedUsageCoupon.used_count}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUsageCoupon(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {loadingUsages ? (
                <div className="py-12 text-center text-slate-400 font-bold">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent mb-2" />
                  <p>Đang tải lịch sử...</p>
                </div>
              ) : usages.length === 0 ? (
                <div className="py-10 text-center text-slate-400 font-bold space-y-2">
                  <span className="text-3xl block">🎟️</span>
                  <p className="text-xs sm:text-sm">Mã này chưa được sử dụng trong đơn hàng nào.</p>
                </div>
              ) : (
                <>
                  {/* Mobile Cards (< 640px) */}
                  <div className="sm:hidden space-y-2.5">
                    {usages.map((u) => (
                      <div key={u.id} className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-slate-900 dark:text-white truncate">{u.profiles?.full_name || 'Khách hàng'}</span>
                          <span className="font-mono font-bold text-[#2563EB] dark:text-[#35A8FF]">#{u.orders?.payment_code || u.order_id?.slice(0, 8) || 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Giảm: <strong className="text-emerald-600 dark:text-emerald-400">-{u.discount_amount.toLocaleString('vi-VN')}đ</strong></span>
                          <span>Thanh toán: <strong className="text-slate-900 dark:text-white">{u.final_amount.toLocaleString('vi-VN')}đ</strong></span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono text-right">
                          {new Date(u.created_at).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table (Hidden on mobile < 640px) */}
                  <div className="hidden sm:block overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-black uppercase text-slate-400">
                        <tr>
                          <th className="px-3.5 py-3 whitespace-nowrap min-w-[130px]">Khách hàng</th>
                          <th className="px-3.5 py-3 whitespace-nowrap min-w-[120px]">Mã đơn hàng</th>
                          <th className="px-3.5 py-3 whitespace-nowrap min-w-[100px]">Giá trị đơn</th>
                          <th className="px-3.5 py-3 whitespace-nowrap min-w-[90px]">Giảm giá</th>
                          <th className="px-3.5 py-3 whitespace-nowrap min-w-[100px]">Thanh toán</th>
                          <th className="px-3.5 py-3 text-right whitespace-nowrap min-w-[120px]">Thời gian</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                        {usages.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="px-3.5 py-2.5">
                              <span className="font-extrabold text-slate-900 dark:text-white block truncate max-w-[150px]">
                                {u.profiles?.full_name || 'Khách hàng'}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 block truncate max-w-[150px]">{u.profiles?.email || u.user_id.slice(0, 8)}</span>
                            </td>
                            <td className="px-3.5 py-2.5 font-mono font-bold text-[#2563EB] dark:text-[#35A8FF] whitespace-nowrap">
                              #{u.orders?.payment_code || u.order_id?.slice(0, 8) || 'N/A'}
                            </td>
                            <td className="px-3.5 py-2.5 font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {u.original_amount.toLocaleString('vi-VN')}đ
                            </td>
                            <td className="px-3.5 py-2.5 font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              -{u.discount_amount.toLocaleString('vi-VN')}đ
                            </td>
                            <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {u.final_amount.toLocaleString('vi-VN')}đ
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-[11px] text-slate-400 whitespace-nowrap">
                              {new Date(u.created_at).toLocaleString('vi-VN')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ────────────────────────────────────────────────────────
          MODAL: XÁC NHẬN TẠM DỪNG / KÍCH HOẠT
      ──────────────────────────────────────────────────────── */}
      {toggleTarget && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={() => !toggling && setToggleTarget(null)} />

          <div className="relative z-[100000] w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden rounded-[24px] sm:rounded-[28px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C32] p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-up text-slate-900 dark:text-white">
            <div className="flex items-center gap-3">
              <span className={`h-10 w-10 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                toggleTarget.is_active ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
              }`}>
                {toggleTarget.is_active ? '⏸' : '▶'}
              </span>
              <div>
                <h3 className="text-base font-black">
                  {toggleTarget.is_active ? `Tạm dừng coupon ${toggleTarget.code}?` : `Kích hoạt coupon ${toggleTarget.code}?`}
                </h3>
                <p className="text-xs text-slate-400">
                  {toggleTarget.is_active ? 'Coupon sẽ tạm thời không thể áp dụng tại checkout.' : 'Coupon sẽ có hiệu lực ngay tại checkout.'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {toggleTarget.is_active
                ? `Coupon "${toggleTarget.code}" (${toggleTarget.name}) sẽ không thể được sử dụng trong checkout cho đến khi được kích hoạt lại.`
                : `Coupon "${toggleTarget.code}" (${toggleTarget.name}) sẽ được kích hoạt lại cho người dùng sử dụng.`}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setToggleTarget(null)}
                disabled={toggling}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleStatus}
                disabled={toggling}
                className={`rounded-xl px-5 py-2 text-xs font-black text-white shadow-md transition disabled:opacity-50 cursor-pointer ${
                  toggleTarget.is_active ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {toggling ? 'Đang cập nhật...' : toggleTarget.is_active ? 'Tạm dừng coupon' : 'Kích hoạt ngay'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ────────────────────────────────────────────────────────
          MODAL: XÁC NHẬN XÓA COUPON
      ──────────────────────────────────────────────────────── */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overflow-hidden">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={() => !deleting && setDeleteTarget(null)} />

          <div className="relative z-[100000] w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden rounded-[24px] sm:rounded-[28px] border border-rose-200 dark:border-rose-900/50 bg-white dark:bg-[#131C32] p-5 sm:p-6 shadow-2xl space-y-4 animate-scale-up text-slate-900 dark:text-white">
            <div className="flex items-center gap-3">
              <span className="h-10 w-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-xl shrink-0">
                🗑️
              </span>
              <div>
                <h3 className="text-base font-black">Xác nhận xóa mã giảm giá</h3>
                <p className="text-xs text-slate-400">Hành động này không thể hoàn tác.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Bạn có chắc chắn muốn xóa coupon <strong className="font-mono text-rose-600 dark:text-rose-400 font-black">{deleteTarget.code}</strong> ({deleteTarget.name}) không?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteCoupon}
                disabled={deleting}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-black text-white shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {deleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
