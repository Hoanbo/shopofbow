import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { formatVND } from '../../data/catalog';
import OrderRenewalModal from './OrderRenewalModal';

export interface UserDashboardOrder {
  id: string;
  user_id: string;
  product_name: string;
  plan_label: string;
  price: number;
  original_price?: number;
  discount_amount?: number;
  status:
    | 'pending_payment'
    | 'pending_delivery'
    | 'processing'
    | 'completed'
    | 'cancelled'
    | 'refunded'
    | 'paid'
    | 'pending'
    | 'delivering';
  payment_code: string;
  notes: string;
  account_details?: string;
  delivery_info?: string;
  expires_at?: string;
  renewal_policy?: string;
  target_account?: string;
  created_at: string;
}

interface UserOverviewTabProps {
  orders: UserDashboardOrder[];
  onNavigateTab: (tabId: string) => void;
  onOpenOrderDetail?: (order: UserDashboardOrder) => void;
  onRefreshOrders?: () => void;
}

interface ActiveProductItem {
  order: UserDashboardOrder;
  productName: string;
  planLabel: string;
  isLifetime: boolean;
  statusType: 'active' | 'expiring_soon' | 'expired';
  statusLabel: string;
  badgeClass: string;
  icon: string;
  daysText: string;
  remainingDays: number;
  totalDays: number;
  percentUsed: number;
  isExpiringSoon: boolean;
  isExpired: boolean;
}

export default function UserOverviewTab({
  orders,
  onNavigateTab,
  onOpenOrderDetail,
  onRefreshOrders,
}: UserOverviewTabProps) {
  const { session, balance, profile, isAdmin, isCtv } = useAuth();
  const [selectedRenewalOrder, setSelectedRenewalOrder] = useState<UserDashboardOrder | null>(null);

  // Helper check đơn nạp tiền
  const isTopupOrder = (order: UserDashboardOrder) => {
    const pName = (order.product_name || '').toLowerCase();
    const pCode = (order.payment_code || '').toUpperCase();
    const pNotes = (order.notes || '').toLowerCase();
    return pName.includes('nạp tiền') || pName.includes('nạp số dư') || pCode.startsWith('BOWN') || pNotes.includes('nạp số dư');
  };

  // Helper chuẩn hóa Plan Label
  const getFormattedPlan = (order: UserDashboardOrder) => {
    const pName = (order.product_name || '').trim();
    const pLabel = (order.plan_label || '').trim();
    if (pLabel && pLabel.toLowerCase() !== pName.toLowerCase()) {
      return pLabel;
    }
    if (pName.toLowerCase().includes('capcut')) {
      if ((order.price || 0) <= 20000) return 'Gói 1 tuần';
      if ((order.price || 0) <= 70000) return 'Gói 1 tháng';
      if ((order.price || 0) <= 200000) return 'Gói 6 tháng';
      return 'Gói 1 năm';
    }
    return pLabel || pName;
  };

  // Tính toán danh sách "Sản phẩm đang sử dụng" từ các đơn hàng completed thật
  const activeProducts = useMemo<ActiveProductItem[]>(() => {
    const completedOrders = orders.filter((o) => o.status === 'completed' && !isTopupOrder(o));

    return completedOrders.map((order) => {
      const displayPlan = getFormattedPlan(order);
      const planStr = `${order.product_name || ''} ${order.plan_label || ''} ${displayPlan} ${order.notes || ''}`.toLowerCase();

      // 1. Kiểm tra gói vĩnh viễn / trọn đời
      const isLifetime = planStr.includes('vĩnh viễn') || planStr.includes('lifetime') || planStr.includes('trọn đời');

      if (isLifetime) {
        return {
          order,
          productName: order.product_name,
          planLabel: displayPlan,
          isLifetime: true,
          statusType: 'active',
          statusLabel: 'Vĩnh viễn',
          badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          icon: '👑',
          daysText: 'Sử dụng trọn đời',
          remainingDays: 9999,
          totalDays: 9999,
          percentUsed: 0,
          isExpiringSoon: false,
          isExpired: false,
        };
      }

      // 2. Nhận diện số ngày theo chu kỳ gói
      let durationDays = 30;
      if (planStr.includes('1 ngày') || planStr.includes('24h') || planStr.includes('1 day')) {
        durationDays = 1;
      } else if (planStr.includes('2 ngày') || planStr.includes('48h')) {
        durationDays = 2;
      } else if (planStr.includes('3 ngày')) {
        durationDays = 3;
      } else if (planStr.includes('7 ngày') || planStr.includes('1 tuần') || planStr.includes('1 week') || planStr.includes('7 days') || planStr.includes('7d') || (order.price <= 20000 && planStr.includes('capcut'))) {
        durationDays = 7;
      } else if (planStr.includes('14 ngày') || planStr.includes('2 tuần')) {
        durationDays = 14;
      } else if (planStr.includes('15 ngày')) {
        durationDays = 15;
      } else if (planStr.includes('1 tháng') || planStr.includes('30 ngày') || planStr.includes('1 month')) {
        durationDays = 30;
      } else if (planStr.includes('2 tháng') || planStr.includes('60 ngày')) {
        durationDays = 60;
      } else if (planStr.includes('3 tháng') || planStr.includes('90 ngày')) {
        durationDays = 90;
      } else if (planStr.includes('6 tháng') || planStr.includes('180 ngày')) {
        durationDays = 180;
      } else if (planStr.includes('1 năm') || planStr.includes('12 tháng') || planStr.includes('1 year') || planStr.includes('365 ngày')) {
        durationDays = 365;
      }

      const createdAtMs = new Date(order.created_at).getTime();
      const expiresAtMs = order.expires_at ? new Date(order.expires_at).getTime() : createdAtMs + durationDays * 24 * 60 * 60 * 1000;
      const nowMs = Date.now();
      const diffMs = expiresAtMs - nowMs;
      const totalDurationMs = Math.max(1000, expiresAtMs - createdAtMs);
      const elapsedMs = Math.max(0, nowMs - createdAtMs);
      const percentUsed = Math.min(100, Math.max(0, Math.round((elapsedMs / totalDurationMs) * 100)));

      const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
      const isExpired = diffMs <= 0;
      const isExpiringSoon = !isExpired && diffDays <= 5;

      if (isExpired) {
        return null; // Không hiển thị trong khu vực "Đang sử dụng" nếu đã hết hạn
      }

      if (isExpiringSoon) {
        return {
          order,
          productName: order.product_name,
          planLabel: displayPlan,
          isLifetime: false,
          statusType: 'expiring_soon',
          statusLabel: `Còn ${diffDays} ngày`,
          badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800 animate-pulse',
          icon: '🟡',
          daysText: `Hết hạn: ${new Date(expiresAtMs).toLocaleDateString('vi-VN')}`,
          remainingDays: diffDays,
          totalDays: durationDays,
          percentUsed,
          isExpiringSoon: true,
          isExpired: false,
        };
      }

      return {
        order,
        productName: order.product_name,
        planLabel: displayPlan,
        isLifetime: false,
        statusType: 'active',
        statusLabel: `Còn ${diffDays} ngày`,
        badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        icon: '🟢',
        daysText: `Hạn dùng: ${new Date(expiresAtMs).toLocaleDateString('vi-VN')}`,
        remainingDays: diffDays,
        totalDays: durationDays,
        percentUsed,
        isExpiringSoon: false,
        isExpired: false,
      };
    }).filter(Boolean) as ActiveProductItem[];
  }, [orders]);

  const activeCount = activeProducts.length;
  const recentOrders = orders.slice(0, 3);

  // Status Badge Helper cho Đơn hàng gần đây
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
      case 'pending_payment':
        return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50">Chờ thanh toán</span>;
      case 'paid':
      case 'pending_delivery':
        return <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-[#2563EB] border border-blue-100 dark:bg-blue-950/40 dark:text-[#35A8FF] dark:border-blue-900/50">Chờ bàn giao</span>;
      case 'processing':
      case 'delivering':
        return <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50">Đang thiết lập</span>;
      case 'completed':
        return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50">Đã hoàn thành</span>;
      case 'cancelled':
        return <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50">Đã hủy</span>;
      case 'refunded':
        return <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">Đã hoàn tiền</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">{status}</span>;
    }
  };

  const userName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'bạn';

  return (
    <div className="space-y-6">
      {/* 1. WELCOME HEADER (Gọn gàng, tinh tế, không chiếm nhiều diện tích) */}
      <div className="rounded-[28px] border border-[#E7EEF8] dark:border-slate-800 bg-white dark:bg-[#131D33] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] dark:text-white tracking-tight">
            Xin chào, {userName} 👋
          </h2>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Quản lý tài khoản và theo dõi các gói phần mềm AI đang hoạt động của bạn.
          </p>
        </div>

        {/* Member Status & Security Badge trực quan */}
        <div className="self-start sm:self-auto flex items-center gap-3 bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-4 py-2.5 shadow-2xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-[#35A8FF] text-lg">
            {isAdmin ? '🛡️' : isCtv ? '👑' : '💎'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-[#0F172A] dark:text-white">
                {isAdmin ? 'Quản trị viên' : isCtv ? 'Đối tác CTV' : 'Thành viên VIP'}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.2 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active</span>
              </span>
            </div>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              {profile?.referral_code ? `Mã: ${profile.referral_code} • Bảo mật 2 lớp` : 'Tài khoản đã xác thực an toàn'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. TOP STATS GRID (3 Thẻ thống kê súc tích: Số dư, Đơn hàng, Đang dùng) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Số dư */}
        <div className="rounded-[24px] border border-[#E7EEF8] dark:border-slate-800 bg-white dark:bg-[#131D33] p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              Số dư ví
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 text-lg">
              💳
            </span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#2563EB] dark:text-[#35A8FF]">
              {balance.toLocaleString('vi-VN')}đ
            </h3>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
              Sẵn sàng thanh toán tức thì
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('wallet')}
            className="w-full rounded-xl border border-blue-200/80 dark:border-blue-800/80 bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-[#38BDF8] hover:bg-blue-100 dark:hover:bg-blue-900/60 py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <span>+ Nạp tiền vào ví</span>
          </button>
        </div>

        {/* Card 2: Đơn hàng */}
        <div className="rounded-[24px] border border-[#E7EEF8] dark:border-slate-800 bg-white dark:bg-[#131D33] p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              Đơn hàng
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 text-lg">
              📦
            </span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-[#0F172A] dark:text-white">
              {orders.length}
            </h3>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
              Tổng số giao dịch đã đặt
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('orders')}
            className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <span>Xem lịch sử đơn →</span>
          </button>
        </div>

        {/* Card 3: Đang sử dụng */}
        <div className="rounded-[24px] border border-[#E7EEF8] dark:border-slate-800 bg-white dark:bg-[#131D33] p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              Đang sử dụng
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 text-lg">
              🟢
            </span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {activeCount} <span className="text-xs font-bold text-slate-400">sản phẩm</span>
            </h3>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
              Công cụ AI & Apps đang active
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('orders')}
            className="w-full rounded-xl border border-slate-200/90 dark:border-slate-700/80 bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <span>Xem tất cả →</span>
          </button>
        </div>
      </div>

      {/* 3. ⭐ KHU VỰC ƯU TIÊN CAO: SẢN PHẨM ĐANG SỬ DỤNG (Active Products & Subscriptions) */}
      <div className="rounded-[28px] border border-[#E7EEF8] dark:border-slate-800 bg-white dark:bg-[#131D33] p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 text-lg">
              ⚡
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white">
                Sản phẩm đang sử dụng
              </h3>
              <p className="text-xs font-medium text-slate-400 mt-0.5">
                Theo dõi thời hạn và quản lý các gói phần mềm AI bạn đang sở hữu.
              </p>
            </div>
          </div>

          {activeProducts.length > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 px-3 py-1 text-xs font-black text-[#2563EB] dark:text-[#35A8FF]">
              {activeProducts.length} gói dịch vụ
            </span>
          )}
        </div>

        {activeProducts.length === 0 ? (
          <div className="py-12 text-center space-y-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/50 text-2xl shadow-xs">
              🛍️
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                Bạn chưa có sản phẩm nào đang kích hoạt
              </h4>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                Khám phá ngay các tài khoản AI bản quyền chất lượng cao như ChatGPT Plus, CapCut Pro, Midjourney...
              </p>
            </div>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] px-6 py-2.5 text-xs font-bold text-white shadow-md hover:from-[#0080E0] hover:to-[#1D4ED8] transition"
            >
              <span>🔍 Khám phá sản phẩm</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeProducts.map((item) => (
              <div
                key={item.order.id}
                className="flex flex-col justify-between p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/80 transition space-y-4"
              >
                {/* Header Product Card */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                      {item.productName}
                    </h4>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      Gói: <span className="text-[#2563EB] dark:text-[#35A8FF] font-bold">{item.planLabel}</span>
                    </p>
                  </div>

                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black border shrink-0 ${item.badgeClass}`}>
                    <span>{item.icon}</span>
                    <span>{item.statusLabel}</span>
                  </span>
                </div>

                {/* Progress Bar thời hạn */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <span>{item.daysText}</span>
                    {!item.isLifetime && !item.isExpired && (
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {100 - item.percentUsed}% còn lại
                      </span>
                    )}
                  </div>

                  <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.isLifetime
                          ? 'bg-purple-500'
                          : item.isExpired
                          ? 'bg-rose-500'
                          : item.isExpiringSoon
                          ? 'bg-amber-500'
                          : 'bg-gradient-to-r from-[#00A3FF] to-[#2563EB]'
                      }`}
                      style={{
                        width: item.isLifetime ? '100%' : item.isExpired ? '100%' : `${100 - item.percentUsed}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                  <span className="text-xs font-black text-[#0F172A] dark:text-white">
                    {formatVND(item.order.price)}
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Nút Gia hạn nếu sắp hoặc đã hết hạn */}
                    {(item.isExpiringSoon || item.isExpired) && (
                      <button
                        type="button"
                        onClick={() => setSelectedRenewalOrder(item.order)}
                        className="rounded-full bg-gradient-to-r from-[#19A7FF] to-[#2563EB] hover:from-[#19A7FF] hover:to-[#1D4ED8] text-white px-3.5 py-1.5 text-xs font-black transition shadow-xs flex items-center gap-1.5 animate-pulse"
                      >
                        <span>🔄 Gia hạn</span>
                        <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded font-bold">-10%</span>
                      </button>
                    )}

                    {/* Nút Chi tiết */}
                    <button
                      type="button"
                      onClick={() => onOpenOrderDetail && onOpenOrderDetail(item.order)}
                      className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-1.5 text-xs font-bold transition shadow-2xs"
                    >
                      Chi tiết →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. ĐƠN HÀNG GẦN ĐÂY (RECENT ORDERS WIDGET) */}
      <div className="rounded-[28px] border border-[#E7EEF8] dark:border-slate-800 bg-white dark:bg-[#131D33] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div>
            <h3 className="text-base font-extrabold text-[#0F172A] dark:text-white">
              Đơn hàng gần đây
            </h3>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              Giao dịch và đơn hàng bạn đã thực hiện gần nhất.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('orders')}
            className="text-xs font-bold text-[#2563EB] dark:text-[#35A8FF] hover:underline"
          >
            Xem tất cả ({orders.length}) →
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <span className="text-3xl block">📦</span>
            <p className="text-xs font-semibold text-slate-400">Bạn chưa có đơn hàng nào.</p>
            <Link
              to="/products"
              className="inline-flex rounded-full bg-[#2563EB] px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-[#1D4ED8] transition"
            >
              Khám phá sản phẩm ngay
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((o) => (
              <div
                key={o.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                      {o.product_name}
                    </h4>
                    {getStatusBadge(o.status)}
                  </div>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">
                    Gói: <span className="font-bold text-slate-600 dark:text-slate-300">{o.plan_label}</span> — Mã: <span className="font-mono text-slate-500">{o.payment_code}</span> • {new Date(o.created_at).toLocaleDateString('vi-VN')}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800 pt-2 sm:pt-0">
                  <span className="text-sm font-black text-[#2563EB] dark:text-[#35A8FF]">
                    {formatVND(o.price)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenOrderDetail) onOpenOrderDetail(o);
                      else onNavigateTab('orders');
                    }}
                    className="rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition shadow-2xs"
                  >
                    Chi tiết
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RENEWAL MODAL FROM OVERVIEW */}
      {selectedRenewalOrder && (
        <OrderRenewalModal
          order={selectedRenewalOrder as any}
          onClose={() => setSelectedRenewalOrder(null)}
          onRenewalSuccess={() => {
            setSelectedRenewalOrder(null);
            if (onRefreshOrders) onRefreshOrders();
          }}
        />
      )}
    </div>
  );
}
