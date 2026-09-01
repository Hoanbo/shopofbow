import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { supabase } from '../lib/supabase';
import { CloseIcon } from '../components/icons';
import { useToast } from '../components/Toast';
import OrderDeliveredModal from '../components/OrderDeliveredModal';
import UserTicketsTab from '../components/user/UserTicketsTab';
import UserAffiliateTab from '../components/user/UserAffiliateTab';
import UserOverviewTab from '../components/user/UserOverviewTab';
import UserSettingsAndSecurityTab from '../components/user/UserSettingsAndSecurityTab';
import CreateTicketModal from '../components/user/CreateTicketModal';
import UserOrderDetailModal from '../components/user/UserOrderDetailModal';
import OrderTimeline from '../components/user/OrderTimeline';
import ReviewModal from '../components/user/ReviewModal';
import OrderRenewalModal from '../components/user/OrderRenewalModal';
import AppLogo from '../components/AppLogo';
import { formatVND } from '../data/catalog';
import { useRealtimeEvent } from '../services/realtime';
import { syncExpiredPendingOrders } from '../utils/orderExpiry';
import { BANK_CONFIG, getPaymentQrUrl } from '../config/sepay';

type Order = {
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
};

// Helper for Status Tags color
const getStatusBadge = (status: Order['status'] | string) => {
  switch (status) {
    case 'pending':
    case 'pending_payment':
      return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-100">Chờ thanh toán</span>;
    case 'paid':
    case 'pending_delivery':
      return <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#2563EB] border border-blue-100">Chờ bàn giao</span>;
    case 'processing':
    case 'delivering':
      return <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 border border-indigo-100">Đang thiết lập</span>;
    case 'completed':
      return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-100">Đã hoàn thành</span>;
    case 'cancelled':
      return <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-100">Đã hủy</span>;
    case 'refunded':
      return <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 border border-slate-200">Đã hoàn tiền</span>;
    default:
      return <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 border border-slate-200">{status}</span>;
  }
};

// Sub-component for individual Order Card with built-in Countdown & Cancel logic
function OrderCard({
  order,
  hasReviewed,
  onReviewSuccess,
  onPay,
  onCancelSuccess,
  onOpenDetail,
}: {
  order: Order;
  hasReviewed: boolean;
  onReviewSuccess: (orderId: string) => void;
  onPay: (o: Order) => void;
  onCancelSuccess: () => void;
  onOpenDetail?: (order: Order) => void;
}) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (order.status !== 'pending_payment') return;

    const updateTimer = () => {
      const expiresAt = new Date(order.created_at).getTime() + 15 * 60 * 1000; // 15 mins expiry
      const diff = expiresAt - Date.now();

      if (diff <= 0) {
        setTimeLeft('Hết hạn thanh toán');
        setIsExpired(true);
        // Tự động cập nhật DB để bên Admin và hệ thống nhận diện ngay là đơn đã hủy
        supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', order.id)
          .eq('status', 'pending_payment')
          .then();
        return false;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`⏱️ Hạn thanh toán còn lại: ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      return true;
    };

    updateTimer();
    const interval = setInterval(() => {
      const active = updateTimer();
      if (!active) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [order.id, order.status, order.created_at, onCancelSuccess]);

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      const { data, error: rpcErr } = await (supabase as any).rpc('cancel_and_refund_own_order', {
        p_order_id: order.id,
      });

      if (rpcErr) throw rpcErr;

      if (data === 'refunded_success') {
        toast.success(`Hủy đơn thành công! ${order.price.toLocaleString('vi-VN')}đ đã được hoàn về ví số dư.`);
      } else if (data === 'success') {
        toast.success('Hủy đơn hàng thành công!');
      } else if (data === 'cannot_cancel') {
        throw new Error('Đơn hàng không thể hủy ở trạng thái hiện tại.');
      } else {
        throw new Error('Hủy đơn hàng thất bại. Vui lòng thử lại.');
      }

      setConfirmingCancel(false);
      onCancelSuccess();
    } catch (err: any) {
      setCancelError(err.message || 'Lỗi khi hủy đơn hàng. Vui lòng thử lại.');
    } finally {
      setCancelling(false);
    }
  };

  const displayStatus = isExpired ? 'cancelled' : order.status;
  const isPaidOrder = ['pending_delivery', 'processing'].includes(order.status);
  const canCancel = ['pending_payment', 'pending_delivery', 'processing'].includes(order.status) && !isExpired;

  const getFormattedPlanLabel = (ord: { product_name?: string; plan_label?: string; price?: number; notes?: string }) => {
    const pName = (ord.product_name || '').trim();
    const pLabel = (ord.plan_label || '').trim();

    if (pLabel && pLabel.toLowerCase() !== pName.toLowerCase()) {
      return pLabel;
    }

    if (pName.toLowerCase().includes('capcut')) {
      if ((ord.price || 0) <= 20000) return 'Gói 1 tuần (7 ngày)';
      if ((ord.price || 0) <= 70000) return 'Gói 1 tháng (30 ngày)';
      if ((ord.price || 0) <= 200000) return 'Gói 6 tháng (180 ngày)';
      return 'Gói 1 năm (365 ngày)';
    }

    return pLabel || pName;
  };

  const isTopupOrder = () => {
    const pName = (order.product_name || '').toLowerCase();
    const pCode = (order.payment_code || '').toUpperCase();
    const pNotes = (order.notes || '').toLowerCase();
    return pName.includes('nạp tiền') || pName.includes('nạp số dư') || pCode.startsWith('BOWN') || pNotes.includes('nạp số dư');
  };

  const calcExpiryInfo = () => {
    if (order.status !== 'completed' || isTopupOrder()) return null;

    const displayPlan = getFormattedPlanLabel(order);
    const planStr = `${order.product_name || ''} ${order.plan_label || ''} ${displayPlan} ${order.notes || ''}`.toLowerCase();

    // 1. Gói vĩnh viễn
    if (planStr.includes('vĩnh viễn') || planStr.includes('lifetime') || planStr.includes('trọn đời')) {
      return {
        label: 'Vĩnh viễn (Trọn đời)',
        badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200/60',
        icon: '👑',
        daysText: 'Sử dụng không giới hạn thời gian',
      };
    }

    // 2. Nhận diện số ngày theo chu kỳ gói
    let durationDays = 30;
    let isHours = false;

    if (planStr.includes('1 ngày') || planStr.includes('24h') || planStr.includes('1 day') || planStr.includes('api 10m') || planStr.includes('api 50m') || planStr.includes('api 100m')) {
      durationDays = 1;
      isHours = true;
    } else if (planStr.includes('2 ngày') || planStr.includes('48h')) {
      durationDays = 2;
    } else if (planStr.includes('3 ngày')) {
      durationDays = 3;
    } else if (planStr.includes('7 ngày') || planStr.includes('1 tuần') || planStr.includes('1 week') || planStr.includes('7 days') || planStr.includes('7d') || (order.price <= 20000 && planStr.includes('capcut'))) {
      durationDays = 7;
    } else if (planStr.includes('14 ngày') || planStr.includes('2 tuần') || planStr.includes('2 weeks') || planStr.includes('14 days')) {
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
    } else {
      const weekMatch = planStr.match(/(\d+)\s*(tuần|week|weeks|w)/);
      if (weekMatch) {
        durationDays = parseInt(weekMatch[1], 10) * 7;
      } else {
        const monthMatch = planStr.match(/(\d+)\s*(tháng|month|months|m)/);
        if (monthMatch) {
          durationDays = parseInt(monthMatch[1], 10) * 30;
        } else {
          const yearMatch = planStr.match(/(\d+)\s*(năm|year|years|y)/);
          if (yearMatch) {
            durationDays = parseInt(yearMatch[1], 10) * 365;
          } else {
            const dayMatch = planStr.match(/(\d+)\s*(ngày|day|days)/);
            if (dayMatch) {
              durationDays = parseInt(dayMatch[1], 10);
              if (durationDays === 1) isHours = true;
            }
          }
        }
      }
    }

    const createdAtMs = new Date(order.created_at).getTime();
    const expiresAtMs = order.expires_at ? new Date(order.expires_at).getTime() : createdAtMs + durationDays * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const diffMs = expiresAtMs - nowMs;
    const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

    if (diffMs <= 0) {
      return {
        label: 'Đã hết hạn',
        badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200/60',
        icon: '🔴',
        daysText: 'Đã kết thúc chu kỳ sử dụng',
        isExpiringSoon: false,
        isExpired: true,
      };
    }

    if (isHours && diffHours <= 24) {
      return {
        label: `Còn ${diffHours} giờ`,
        badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/60',
        icon: '⚡',
        daysText: `Hạn dùng đến ${new Date(expiresAtMs).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date(expiresAtMs).toLocaleDateString('vi-VN')}`,
        isExpiringSoon: diffHours <= 6,
        isExpired: false,
      };
    }

    if (diffDays <= 5) {
      return {
        label: `Còn ${diffDays} ngày (Sắp hết)`,
        badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/60 animate-pulse',
        icon: '🟡',
        daysText: `Hết hạn: ${new Date(expiresAtMs).toLocaleDateString('vi-VN')}`,
        isExpiringSoon: true,
        isExpired: false,
      };
    }

    return {
      label: `Còn ${diffDays} ngày`,
      badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/60',
      icon: '🟢',
      daysText: `Hạn dùng đến: ${new Date(expiresAtMs).toLocaleDateString('vi-VN')}`,
      isExpiringSoon: false,
      isExpired: false,
    };
  };

  const calcWarranty = () => {
    if (order.status !== 'completed' || isTopupOrder()) return null;

    const displayPlan = getFormattedPlanLabel(order);
    const planStr = `${order.product_name || ''} ${order.plan_label || ''} ${displayPlan} ${order.notes || ''}`.toLowerCase();

    // 1. Gói không bảo hành
    if (planStr.includes('kbh') || planStr.includes('không bảo hành') || planStr.includes('no warranty')) {
      return {
        label: 'Không bảo hành',
        badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200/60',
        icon: '⚪',
      };
    }

    // 2. Gói vĩnh viễn
    if (planStr.includes('vĩnh viễn') || planStr.includes('lifetime') || planStr.includes('trọn đời')) {
      return {
        label: 'Trọn đời',
        badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200/60',
        icon: '👑',
      };
    }

    let durationDays = 30;
    let isHours = false;

    if (planStr.includes('1 ngày') || planStr.includes('24h') || planStr.includes('1 day') || planStr.includes('api 10m') || planStr.includes('api 50m') || planStr.includes('api 100m')) {
      durationDays = 1;
      isHours = true;
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
    } else {
      const dayMatch = planStr.match(/(\d+)\s*(ngày|day|days)/);
      if (dayMatch) {
        durationDays = parseInt(dayMatch[1], 10);
        if (durationDays === 1) isHours = true;
      }
    }

    const createdAtMs = new Date(order.created_at).getTime();
    const expiresAtMs = order.expires_at ? new Date(order.expires_at).getTime() : createdAtMs + durationDays * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const diffMs = expiresAtMs - nowMs;
    const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

    if (diffMs <= 0) {
      return {
        label: 'Hết hạn',
        badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200/60',
        icon: '🔴',
      };
    }

    if (isHours && diffHours <= 24) {
      return {
        label: `Còn ${diffHours}h`,
        badgeClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200/70 dark:border-sky-800/60',
        icon: '⚡',
      };
    }

    if (diffDays <= 3) {
      return {
        label: `Còn ${diffDays} ngày`,
        badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/60 animate-pulse',
        icon: '🟡',
      };
    }

    return {
      label: `Còn ${diffDays} ngày`,
      badgeClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200/70 dark:border-sky-800/60',
      icon: '🛡️',
    };
  };

  const expiryInfo = calcExpiryInfo();
  const warranty = calcWarranty();

  return (
    <div className="rounded-2xl border border-slate-100 p-4 hover:shadow-xs transition">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-extrabold text-[#0F172A]">{order.product_name}</h4>
          <p className="text-xs font-medium text-slate-400 mt-0.5">
            Gói: <span className="font-extrabold text-[#2563EB]">{getFormattedPlanLabel(order)}</span> — Mã: <span className="font-bold text-[#0F172A]">{order.payment_code}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(displayStatus)}
          <span className="text-sm font-black text-[#2563EB]">
            {order.price.toLocaleString('vi-VN')}đ
          </span>
        </div>
      </div>

      {/* 🚚 Order Status Timeline */}
      <div className="mt-3">
        <OrderTimeline
          orderId={order.id}
          currentStatus={displayStatus}
          orderCreatedAt={order.created_at}
          compact
        />
      </div>

      {order.notes && (
        <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs text-slate-600 font-medium">
          <strong>Ghi chú đơn hàng:</strong> {order.notes}
        </div>
      )}

      {/* ⏰ Subscription Countdown & Warranty & Conditional Renewal */}
      {order.status === 'completed' && expiryInfo && (
        <div className="mt-3 rounded-2xl border border-blue-200/80 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-blue-950/40 dark:to-indigo-950/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Cụm Thời hạn bên trái */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>⏰</span> Thời hạn:
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${expiryInfo.badgeClass}`}>
              <span>{expiryInfo.icon}</span>
              <span>{expiryInfo.label}</span>
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">
              • {expiryInfo.daysText}
            </span>
          </div>

          {/* Cụm Bảo hành & Nút gia hạn bên phải */}
          <div className="flex items-center gap-3 flex-wrap self-start sm:self-auto">
            {warranty && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <span>🛡️</span> Bảo hành:
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${warranty.badgeClass}`}>
                  <span>{warranty.icon}</span>
                  <span>{warranty.label}</span>
                </span>
              </div>
            )}

            {/* Chỉ hiển thị nút gia hạn khi đơn sắp hết hạn (<= 5 ngày) hoặc đã hết hạn */}
            {(expiryInfo.isExpiringSoon || expiryInfo.isExpired) && (
              <button
                type="button"
                onClick={() => setShowRenewalModal(true)}
                className="rounded-xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] hover:from-[#19A7FF] hover:to-[#1D4ED8] text-white px-3.5 py-1.5 text-xs font-black transition shadow-xs cursor-pointer shrink-0 flex items-center justify-center gap-1.5 animate-pulse"
              >
                <span>🔄 Gia hạn ngay</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pay now + Cancel triggers */}
      {canCancel && (
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-t border-slate-50 pt-3">
          {order.status === 'pending_payment' ? (
            <span className="text-xs font-bold text-amber-600 animate-pulse">
              {timeLeft}
            </span>
          ) : (
            <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
              ℹ️ Đơn đã thanh toán — Bạn có thể hủy để nhận lại 100% tiền vào ví.
            </span>
          )}
          <div className="flex items-center gap-2.5 justify-end">
            <button
              type="button"
              onClick={() => { setCancelError(null); setConfirmingCancel(true); }}
              className="rounded-full border border-slate-200 bg-white hover:bg-slate-50 px-4 py-1.5 text-xs font-bold text-slate-600 hover:text-rose-600 transition"
            >
              ❌ Hủy đơn hàng
            </button>
            {order.status === 'pending_payment' && (
              <button
                type="button"
                onClick={() => onPay(order)}
                className="rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] px-4.5 py-1.5 text-xs font-bold text-white shadow-xs hover:scale-102 transition"
              >
                💳 Thanh toán ngay (Quét QR)
              </button>
            )}
          </div>
        </div>
      )}

      {/* View Detail Trigger & Review Button */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-2.5 text-xs">
        {order.status === 'completed' ? (
          hasReviewed ? (
            <span className="inline-flex items-center gap-1 font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-900/30 px-2.5 py-1 rounded-xl">
              ✓ Đã đánh giá
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setShowReviewModal(true)}
              className="inline-flex items-center gap-1.5 font-black text-[#2563EB] dark:text-[#35A8FF] bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-3 py-1.5 rounded-xl transition cursor-pointer"
            >
              <span>⭐</span>
              <span>Đánh giá sản phẩm</span>
            </button>
          )
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={() => onOpenDetail && onOpenDetail(order)}
          className="inline-flex items-center gap-1.5 font-extrabold text-[#2563EB] dark:text-[#35A8FF] hover:underline transition"
        >
          <span>🔎 Xem chi tiết đơn hàng →</span>
        </button>
      </div>

      {showReviewModal && (
        <ReviewModal
          order={order}
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => onReviewSuccess(order.id)}
        />
      )}

      {showRenewalModal && (
        <OrderRenewalModal
          order={order}
          onClose={() => setShowRenewalModal(false)}
          onRenewalSuccess={() => {
            setShowRenewalModal(false);
            onCancelSuccess();
          }}
        />
      )}

      {/* Modal xác nhận hủy đơn (PORTAL) */}
      {confirmingCancel && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-md transition-opacity"
            onClick={() => !cancelling && setConfirmingCancel(false)}
          />
          <div className="relative z-[100000] w-full max-w-sm overflow-hidden rounded-[28px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#18243E] p-6 shadow-2xl text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 border border-rose-100 dark:border-rose-900/50 text-2xl">
              ⚠️
            </div>
            <div>
              <h3 className="text-base font-black text-[#0F172A] dark:text-white">Xác nhận Hủy đơn hàng?</h3>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-300 leading-relaxed">
                Bạn có chắc chắn muốn hủy đơn <strong className="text-[#0F172A] dark:text-white">{order.product_name}</strong> (Mã: {order.payment_code})?
              </p>
              {isPaidOrder && (
                <p className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                  💰 Số tiền {order.price.toLocaleString('vi-VN')}đ sẽ được HOÀN TỰ ĐỘNG VỀ VÍ SỐ DƯ của bạn ngay lập tức!
                </p>
              )}
            </div>

            {cancelError && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-2.5 text-xs font-semibold text-red-600">
                {cancelError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setConfirmingCancel(false)}
                disabled={cancelling}
                className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-60 transition"
              >
                Giữ lại đơn
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-60 transition"
              >
                {cancelling ? 'Đang hủy...' : isPaidOrder ? 'Hủy & Hoàn tiền' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function Dashboard() {
  const { session, balance, refreshBalance, loading: authLoading, isAdmin, profile } = useAuth();
  const { favoriteProducts, loadingFavorites, toggleFavorite } = useFavorites();
  const [searchParams, setSearchParams] = useSearchParams();
  const nav = useNavigate();

  const userAvatarUrl = profile?.avatar_url || session?.user?.user_metadata?.avatar_url || null;
  const userDisplayName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Thành viên';

  // Tab State
  const activeTab = searchParams.get('tab') || 'overview';

  // Orders State & Pagination
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [errorOrders, setErrorOrders] = useState<string | null>(null);
  const [selectedPayOrder, setSelectedPayOrder] = useState<Order | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ORDERS_PER_PAGE = 5;

  // Support Ticket Modal from Order
  const [supportOrderIdForModal, setSupportOrderIdForModal] = useState<string | null>(null);
  const [showSupportModalFromOrder, setShowSupportModalFromOrder] = useState(false);

  // Order Detail Modal State
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<Order | null>(null);
  const [selectedRenewalOrder, setSelectedRenewalOrder] = useState<Order | null>(null);
  const [reviewedOrderIds, setReviewedOrderIds] = useState<Set<string>>(new Set());

  const handleReviewSuccess = useCallback((orderId: string) => {
    setReviewedOrderIds((prev) => new Set(prev).add(orderId));
  }, []);

  // Deposit State
  const [depositAmount, setDepositAmount] = useState<number>(50000);
  const [depositCode, setDepositCode] = useState('');
  const [depositOrderId, setDepositOrderId] = useState<string | null>(null);
  const [creatingDeposit, setCreatingDeposit] = useState(false);
  const [showDepositQr, setShowDepositQr] = useState(false);
  const [depositSuccess, setDepositSuccess] = useState(false);
  const [cancellingDeposit, setCancellingDeposit] = useState(false);
  const depositInputRef = useRef<HTMLInputElement>(null);

  // Profile Edit State
  const [fullName, setFullName] = useState(session?.user?.user_metadata?.full_name || '');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const toast = useToast();

  // Fetch Orders (Chỉ lấy đơn hàng của chính tài khoản đang đăng nhập)
  const fetchOrders = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoadingOrders(true);
    setErrorOrders(null);
    try {
      const [ordersRes, reviewsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('product_reviews')
          .select('order_id')
          .eq('user_id', session.user.id),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      const rawOrders = (ordersRes.data || []) as Order[];
      const { updatedOrders } = await syncExpiredPendingOrders(rawOrders);
      setOrders(updatedOrders);

      const revSet = new Set<string>((reviewsRes.data || []).map((r: any) => String(r.order_id)));
      setReviewedOrderIds(revSet);
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setErrorOrders('Không thể tải lịch sử đơn hàng. Vui lòng thử lại.');
    } finally {
      setLoadingOrders(false);
    }
  }, [session?.user?.id]);

  // Realtime Hub: Cập nhật trạng thái đơn hàng realtime cho user (khi admin hủy/giao hoặc hệ thống auto-cancel)
  useRealtimeEvent('orders:UPDATE', useCallback((e: any) => {
    const updated = e.payload;
    if (!updated || !session?.user?.id) return;
    if (updated.user_id === session.user.id) {
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
    }
  }, [session?.user?.id]));

  useRealtimeEvent('orders:INSERT', useCallback((e: any) => {
    const newOrder = e.payload;
    if (!newOrder || !session?.user?.id) return;
    if (newOrder.user_id === session.user.id) {
      setOrders((prev) => {
        if (prev.some((o) => o.id === newOrder.id)) return prev;
        return [newOrder, ...prev];
      });
    }
  }, [session?.user?.id]));

  // Realtime & polling listener for wallet deposit order
  useEffect(() => {
    if (!showDepositQr || !depositOrderId || depositSuccess) return;

    let cancelled = false;
    const settleIfPaid = (status?: string | null) => {
      if (!cancelled && status === 'completed') {
        cancelled = true;
        setDepositSuccess(true);
        toast.success('Nạp tiền vào ví thành công!');
        refreshBalance();
        fetchOrders();
      }
    };

    const checkOnce = async () => {
      if (cancelled) return;
      const { data } = await (supabase
        .from('orders')
        .select('status')
        .eq('id', depositOrderId)
        .maybeSingle() as any);
      settleIfPaid(data?.status);
    };
    checkOnce();

    const channel = supabase
      .channel(`deposit-${depositOrderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${depositOrderId}` },
        (payload) => settleIfPaid((payload.new as { status?: string })?.status),
      )
      .subscribe();

    const poll = setInterval(checkOnce, 4000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [showDepositQr, depositOrderId, depositSuccess, refreshBalance, fetchOrders, toast]);

  // Chỉ redirect khi auth đã load xong VÀ thực sự chưa đăng nhập.
  // Không redirect trong lúc auth đang loading -> tránh F5 bị đá ra /login.
  useEffect(() => {
    if (!authLoading && !session) {
      nav('/', { replace: true });
    }
  }, [authLoading, session, nav]);

  const [deliveredOrderModal, setDeliveredOrderModal] = useState<Order | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetchOrders();
      refreshBalance();
    }
  }, [session?.user?.id]);

  // ── Realtime Hub: user orders (INSERT/UPDATE) ───────────────────────────────────
  // user-hub-{userId} đã subscribe orders của user này, ta chỉ cần consume event.
  // Không cần tạo channel riêng; chỉ cần update state tại chỗ.
  useRealtimeEvent('orders:INSERT', useCallback((e) => {
    const o = e.payload as Order;
    if (!session?.user?.id) return;
    if (o.user_id && o.user_id !== session.user.id) return;
    setOrders((prev) => {
      if (prev.some((r) => r.id === o.id)) {
        return prev.map((r) => (r.id === o.id ? { ...r, ...o } : r));
      }
      return [o, ...prev];
    });
  }, [session?.user?.id]));

  useRealtimeEvent('orders:UPDATE', useCallback((e) => {
    const o = e.payload as Order;
    const oldStatus = e.old?.status;
    if (!session?.user?.id) return;
    if (o.user_id && o.user_id !== session.user.id) return;
    setOrders((prev) => {
      const exists = prev.some((r) => r.id === o.id);
      if (exists) {
        return prev.map((r) => (r.id === o.id ? { ...r, ...o } : r));
      }
      return [o, ...prev];
    });
    refreshBalance();
    // Cập nhật detail modal nếu đang mở
    setSelectedDetailOrder((prev) => prev?.id === o.id ? { ...prev, ...o } : prev);
    // Popup cố định khi đơn có sản phẩm được bàn giao
    if (o.status === 'completed' && oldStatus !== 'completed') {
      setDeliveredOrderModal(o);
    }
  }, [session?.user?.id, refreshBalance]));

  // Deep linking: Tự động mở Order Detail Modal hoặc Order Renewal Modal
  const targetOrderId = searchParams.get('order_id');
  const targetAction = searchParams.get('action');
  useEffect(() => {
    if (!targetOrderId || !session?.user?.id) return;

    const processDeepLinkOrder = (orderData: Order) => {
      if (targetAction === 'renew') {
        if (orderData.status !== 'cancelled' && orderData.status !== 'refunded') {
          setSelectedRenewalOrder(orderData);
        } else {
          toast.error('⚠️ Đơn hàng này không thể gia hạn.');
        }
      } else {
        setSelectedDetailOrder(orderData);
      }
    };

    // Tìm trong danh sách orders đã nạp
    const match = orders.find(
      (o) => o.id === targetOrderId || o.payment_code === targetOrderId,
    );
    if (match) {
      processDeepLinkOrder(match);
      return;
    }

    // Nếu chưa có trong danh sách, fetch trực tiếp từ DB
    const fetchTargetOrder = async () => {
      try {
        const { data, error } = await (supabase
          .from('orders')
          .select('*')
          .or(`id.eq.${targetOrderId},payment_code.eq.${targetOrderId}`)
          .eq('user_id', session.user.id)
          .maybeSingle() as any);

        if (!error && data) {
          processDeepLinkOrder(data as Order);
        } else if (error || !data) {
          toast.error('⚠️ Đơn hàng không tồn tại hoặc bạn không có quyền xem.');
        }
      } catch (err) {
        console.error('Error loading deep linked order:', err);
      }
    };

    fetchTargetOrder();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetOrderId, targetAction, session?.user?.id, toast]);

  // Deep linking: Mở form tạo Ticket hỗ trợ bảo hành
  const newTicketFlag = searchParams.get('newTicket');
  const supportOrderId = searchParams.get('orderId');

  useEffect(() => {
    if (newTicketFlag === '1' && supportOrderId && session?.user?.id) {
      const validateAndOpenSupport = async () => {
        try {
          const { data, error } = await (supabase
            .from('orders')
            .select('id')
            .eq('id', supportOrderId)
            .eq('user_id', session.user.id)
            .maybeSingle() as any);

          if (!error && data) {
            setSupportOrderIdForModal(data.id);
            setShowSupportModalFromOrder(true);
          } else {
            toast.error('⚠️ Đơn hàng không hợp lệ hoặc bạn không có quyền thao tác.');
          }
        } catch (err) {
          console.error('Error validating order for support:', err);
        } finally {
          // Clean URL params to prevent duplicate triggers on refresh
          const next = new URLSearchParams(searchParams);
          next.delete('newTicket');
          next.delete('orderId');
          setSearchParams(next, { replace: true });
        }
      };
      
      validateAndOpenSupport();
    }
  }, [newTicketFlag, supportOrderId, session?.user?.id, searchParams, setSearchParams, toast]);

  // Deep linking: Lấy số tiền nạp từ URL (nếu có)
  const depositAmountFlag = searchParams.get('depositAmount');
  useEffect(() => {
    if (depositAmountFlag) {
      const parsed = parseInt(depositAmountFlag, 10);
      if (!isNaN(parsed) && isFinite(parsed) && parsed > 0 && parsed <= 1000000000) {
        setDepositAmount(parsed);
      }
    }
  }, [depositAmountFlag]);

  if (!session) return null;

  // Handle Profile Update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    try {
      // 1. Update Auth Metadata
      const { error: authErr } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() }
      });
      if (authErr) throw authErr;

      // 2. Update Profiles Table
      const { error: dbErr } = await (supabase
        .from('profiles') as any)
        .update({ full_name: fullName.trim() })
        .eq('id', session.user.id);
      if (dbErr) throw dbErr;

      toast.success('Cập nhật hồ sơ thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật hồ sơ.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleCreateDeposit = async () => {
    if (!session?.user?.id) return;
    if (depositAmount < 10000) {
      toast.error('Số tiền nạp tối thiểu là 10.000đ.');
      return;
    }

    setCreatingDeposit(true);
    setDepositSuccess(false);
    try {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const code = `BOWN${Date.now().toString().slice(-5)}${rand}`;

      const { data: inserted, error: insErr } = await (supabase.from('orders') as any)
        .insert({
          user_id: session.user.id,
          product_name: 'Nạp tiền vào ví',
          plan_label: 'Nạp số dư ví',
          price: depositAmount,
          status: 'pending_payment',
          payment_code: code,
          notes: 'Giao dịch nạp số dư ví tự động qua VietQR/SePay',
        })
        .select('id')
        .single();

      if (insErr) throw insErr;

      setDepositCode(code);
      setDepositOrderId(inserted?.id ?? null);
      setShowDepositQr(true);
      fetchOrders();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi tạo đơn nạp tiền.');
    } finally {
      setCreatingDeposit(false);
    }
  };

  const handleCancelDeposit = async () => {
    if (!depositOrderId) {
      setShowDepositQr(false);
      setDepositCode('');
      return;
    }

    setCancellingDeposit(true);
    try {
      const { error } = await (supabase.from('orders') as any)
        .update({ status: 'cancelled' })
        .eq('id', depositOrderId);

      if (error) throw error;

      setShowDepositQr(false);
      setDepositCode('');
      setDepositOrderId(null);
      toast.success('Đã hủy giao dịch nạp tiền.');
      fetchOrders();
    } catch (err: any) {
      toast.error(err?.message || 'Lỗi khi hủy giao dịch nạp.');
    } finally {
      setCancellingDeposit(false);
    }
  };

  return (
    <div className="container-bow py-4 sm:py-8 lg:py-12">
      <div className="flex flex-col gap-5 lg:gap-8 lg:flex-row">
        {/* SIDEBAR NAVIGATION (Desktop Only - Mobile is integrated into Avatar Header Dropdown) */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="rounded-[28px] border border-[#E7EEF8] dark:border-slate-800 bg-white dark:bg-[#18243E] p-5 shadow-xs">
            {/* Header info */}
            <div className="flex items-center gap-3 border-b border-slate-50 dark:border-slate-800 pb-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] text-sm font-black text-white shadow-xs overflow-hidden border border-slate-200 dark:border-slate-700">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  (session.user.email || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-white truncate">
                  {userDisplayName}
                </h4>
                <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">{session.user.email}</p>
              </div>
            </div>

            {/* Sidebar Tabs */}
            <nav className="mt-4 space-y-1">
              {[
                { id: 'overview', label: '🏠 Tổng quan' },
                { id: 'orders', label: '📦 Đơn hàng' },
                { id: 'wallet', label: '💳 Ví & Thanh toán' },
                { id: 'affiliate', label: '🤝 Giới thiệu bạn bè' },
                { id: 'favorites', label: '❤️ Yêu thích' },
                { id: 'tickets', label: '💬 Hỗ trợ' },
                { id: 'settings', label: '⚙️ Cài đặt' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSearchParams({ tab: t.id })}
                  className={`flex w-full items-center rounded-2xl px-4 py-3 text-xs font-bold transition-all duration-200 ${
                    activeTab === t.id
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-[#35A8FF] shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* CONTENT AREA */}
        <main className="flex-1 min-w-0 space-y-4">
          {/* Mobile Sticky Sub-Header Tabs (Ghim cố định khi cuộn trang, 1 chạm chuyển tab tức thì) */}
          <div className="lg:hidden sticky top-16 sm:top-20 z-30 -mx-4 px-4 sm:-mx-6 sm:px-6 py-2.5 bg-slate-100/90 dark:bg-[#0B132B]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-all duration-300 shadow-2xs">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none touch-pan-x py-0.5">
              {[
                { id: 'overview', label: '🏠 Tổng quan' },
                { id: 'orders', label: '📦 Đơn hàng' },
                { id: 'wallet', label: '💳 Ví & Nạp' },
                { id: 'affiliate', label: '🤝 Giới thiệu' },
                { id: 'favorites', label: '❤️ Yêu thích' },
                { id: 'tickets', label: '💬 Hỗ trợ' },
                { id: 'settings', label: '⚙️ Cài đặt' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSearchParams({ tab: t.id })}
                  className={`shrink-0 inline-flex items-center justify-center min-h-[38px] rounded-full px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap active:scale-95 shadow-xs ${
                    activeTab === t.id
                      ? 'bg-gradient-to-r from-[#00A3FF] to-[#2563EB] text-white shadow-md font-extrabold'
                      : 'bg-white dark:bg-[#18243E] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <UserOverviewTab
              orders={orders}
              onNavigateTab={(tabId) => setSearchParams({ tab: tabId })}
              onOpenOrderDetail={(detailOrder) => setSelectedDetailOrder(detailOrder)}
              onRefreshOrders={fetchOrders}
            />
          )}

          {/* TAB: ORDERS */}
          {activeTab === 'orders' && (
            <div className="rounded-[28px] border border-[#E7EEF8] bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                <h2 className="text-lg font-black text-[#0F172A]">Lịch sử đơn hàng</h2>
                <button onClick={fetchOrders} className="text-xs font-bold text-[#2563EB] hover:underline">
                  Tải lại
                </button>
              </div>

              {loadingOrders ? (
                <div className="mt-5 space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="animate-pulse rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <div className="flex justify-between items-center">
                        <div className="space-y-2 flex-1">
                          <div className="h-4 w-1/3 rounded-md bg-slate-100 dark:bg-slate-800" />
                          <div className="h-3 w-1/4 rounded-md bg-slate-50 dark:bg-slate-800/50" />
                        </div>
                        <div className="h-6 w-16 rounded-full bg-slate-100 dark:bg-slate-800" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : errorOrders ? (
                <div className="py-16 text-center space-y-4">
                  <span className="text-4xl block">⚠️</span>
                  <p className="text-sm font-semibold text-rose-500">{errorOrders}</p>
                  <button
                    onClick={fetchOrders}
                    className="inline-flex rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] px-6 py-2.5 text-xs font-bold text-white shadow-md hover:scale-102 transition"
                  >
                    Tải lại đơn hàng
                  </button>
                </div>
              ) : orders.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <span className="text-4xl block">📦</span>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Bạn chưa có đơn hàng nào.</p>
                  <Link to="/" className="inline-flex rounded-full bg-[#2563EB] px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-[#1D4ED8] transition">
                    Khám phá sản phẩm
                  </Link>
                </div>
              ) : (() => {
                const totalPages = Math.ceil(orders.length / ORDERS_PER_PAGE);
                const paginatedOrders = orders.slice((currentPage - 1) * ORDERS_PER_PAGE, currentPage * ORDERS_PER_PAGE);

                return (
                  <div className="mt-5 space-y-4 animate-fade-in">
                    {paginatedOrders.map((o) => (
                      <OrderCard
                        key={o.id}
                        order={o}
                        hasReviewed={reviewedOrderIds.has(o.id)}
                        onReviewSuccess={handleReviewSuccess}
                        onPay={(payOrder) => setSelectedPayOrder(payOrder)}
                        onCancelSuccess={fetchOrders}
                        onOpenDetail={(detailOrder) => setSelectedDetailOrder(detailOrder)}
                      />
                    ))}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Hiển thị {((currentPage - 1) * ORDERS_PER_PAGE) + 1} - {Math.min(currentPage * ORDERS_PER_PAGE, orders.length)} / {orders.length} đơn hàng
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
                              className={`h-7 w-7 rounded-xl text-xs font-extrabold transition ${currentPage === pageNum
                                ? 'bg-[#2563EB] text-white shadow-xs'
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
                );
              })()}
            </div>
          )}

          {/* TAB: AFFILIATE */}
          {activeTab === 'affiliate' && (
            <UserAffiliateTab />
          )}

          {/* TAB: WALLET */}
          {activeTab === 'wallet' && (
            <div className="space-y-6">
              {/* Card info */}
              <div className="rounded-[28px] border border-[#E7EEF8] bg-gradient-to-r from-[#00A3FF] to-[#2563EB] p-6 text-white shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-100">Số dư khả dụng</span>
                  <h3 className="text-3xl font-black text-white mt-1">
                    {balance.toLocaleString('vi-VN')}đ
                  </h3>
                </div>
                <button
                  onClick={refreshBalance}
                  className="rounded-full bg-white/20 hover:bg-white/30 px-5 py-2 text-xs font-bold text-white transition self-start sm:self-auto"
                >
                  🔄 Đồng bộ số dư
                </button>
              </div>

              {/* Deposit section */}
              <div className="rounded-[28px] border border-[#E7EEF8] bg-white p-6 shadow-xs">
                <h3 className="text-base font-extrabold text-[#0F172A] border-b border-slate-50 pb-3">Nạp tiền vào ví (Chuyển khoản tự động)</h3>

                <div className="mt-4 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                        Nhập số tiền cần nạp (VNĐ)
                      </label>
                      {depositAmount > 0 && (
                        <span className="text-xs font-black text-[#2563EB] bg-blue-50 dark:bg-blue-950/40 px-2.5 py-0.5 rounded-full border border-blue-100 dark:border-blue-900/50">
                          {depositAmount.toLocaleString('vi-VN')} VNĐ
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 max-w-md">
                      <div className="relative flex-1">
                        <input
                          ref={depositInputRef}
                          type="number"
                          min={10000}
                          step={10000}
                          value={depositAmount || ''}
                          onChange={(e) => setDepositAmount(Math.max(0, Number(e.target.value)))}
                          placeholder="Nhập số tiền nạp bất kỳ (Tối thiểu 10.000đ)"
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 pr-10 text-sm font-extrabold outline-none transition focus:border-[#2563EB] text-[#0F172A]"
                        />
                        <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400">
                          đ
                        </span>
                      </div>
                      <button
                        onClick={handleCreateDeposit}
                        disabled={creatingDeposit}
                        className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 px-5 text-xs font-bold text-white shadow-xs transition shrink-0"
                      >
                        {creatingDeposit ? 'Đang tạo...' : 'Tạo QR'}
                      </button>
                    </div>
                  </div>

                  {/* Suggest buttons + Số khác button */}
                  <div>
                    <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Gợi ý chọn nhanh mệnh giá:</span>
                    <div className="flex flex-wrap gap-2">
                      {[20000, 50000, 100000, 200000, 500000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDepositAmount(amt)}
                          className={`rounded-full border px-4 py-1 text-xs font-bold transition ${depositAmount === amt
                            ? 'border-[#2563EB] bg-blue-50 text-[#2563EB] shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                            }`}
                        >
                          {amt.toLocaleString('vi-VN')}đ
                        </button>
                      ))}

                      {/* Nút Số Khác */}
                      <button
                        type="button"
                        onClick={() => {
                          if ([20000, 50000, 100000, 200000, 500000].includes(depositAmount)) {
                            setDepositAmount(0);
                          }
                          depositInputRef.current?.focus();
                        }}
                        className={`rounded-full border px-4 py-1 text-xs font-bold transition ${![20000, 50000, 100000, 200000, 500000].includes(depositAmount)
                          ? 'border-[#2563EB] bg-blue-50 text-[#2563EB] shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                          }`}
                      >
                        ✏️ Số khác
                      </button>
                    </div>
                  </div>

                  {/* Deposit instructions and QR */}
                  {showDepositQr && (
                    <div className="border-t border-slate-100 pt-5 mt-5 flex flex-col md:flex-row gap-6 items-center">
                      <div className="w-full max-w-[180px] shrink-0 border border-slate-100 rounded-2xl bg-slate-50 p-2 shadow-xs">
                        <img
                          src={getPaymentQrUrl(depositAmount, depositCode)}
                          alt="VietQR Deposit"
                          className="h-full w-full object-contain rounded-xl"
                        />
                      </div>
                      <div className="flex-1 space-y-2 text-xs text-slate-700 leading-relaxed w-full">
                        {depositSuccess ? (
                          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 font-bold mb-3 flex items-center gap-2.5 animate-bounce">
                            <span className="text-xl">🎉</span>
                            <div>
                              <p className="text-sm font-black text-emerald-900">Nạp tiền thành công!</p>
                              <p className="text-xs font-medium text-emerald-700 mt-0.5">
                                Số tiền {depositAmount.toLocaleString('vi-VN')}đ đã được tự động cộng vào ví của bạn.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3.5 text-amber-800 font-semibold mb-3 flex items-center gap-2">
                            <span className="animate-spin text-sm">⏱️</span>
                            <span>Nhập chính xác Nội dung chuyển khoản để hệ thống đối soát và cộng tiền ví tự động trong 30 giây!</span>
                          </div>
                        )}
                        <p><strong>Ngân hàng:</strong> {BANK_CONFIG.bankName}</p>
                        <p><strong>Số tài khoản:</strong> {BANK_CONFIG.accountNo}</p>
                        <p><strong>Chủ tài khoản:</strong> {BANK_CONFIG.accountName}</p>
                        <p><strong>Số tiền nạp:</strong> <span className="font-extrabold text-blue-600">{depositAmount.toLocaleString('vi-VN')}đ</span></p>
                        <p className="flex items-center gap-2">
                          <strong>Nội dung nạp:</strong>
                          <span className="font-black text-sm bg-blue-100 text-[#2563EB] px-2 py-0.5 rounded-md">{depositCode}</span>
                        </p>

                        {!depositSuccess && (
                          <div className="pt-3">
                            <button
                              type="button"
                              onClick={handleCancelDeposit}
                              disabled={cancellingDeposit}
                              className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:border-rose-900/50 px-4 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 transition shadow-xs disabled:opacity-50"
                            >
                              {cancellingDeposit ? 'Đang hủy...' : '❌ Hủy giao dịch nạp này'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: PROFILE */}
          {activeTab === 'profile' && (
            <div className="rounded-[28px] border border-[#E7EEF8] bg-white p-6 shadow-xs">
              <h2 className="text-lg font-black text-[#0F172A] border-b border-slate-50 pb-3">Hồ sơ của tôi</h2>

              <div className="mt-5 space-y-6 max-w-lg">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] text-xl font-black text-white shadow-xs">
                    {(session.user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-[#0F172A]">
                      {session.user.user_metadata.full_name || 'Thành viên của BOW'}
                    </h4>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Ngày gia nhập: {new Date(session.user.created_at).toLocaleDateString('vi-VN')}</p>
                  </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-4 border-t border-slate-50 pt-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Họ và Tên
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nhập họ và tên đầy đủ của bạn"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium outline-none transition focus:border-[#2563EB] text-[#0F172A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Địa chỉ Email (Không được đổi)
                    </label>
                    <input
                      type="email"
                      disabled
                      value={session.user.email}
                      className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50/50 px-3.5 text-sm font-medium text-slate-400 cursor-not-allowed outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={updatingProfile}
                    className="rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] px-6 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-60 transition"
                  >
                    {updatingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB: FAVORITES */}
          {activeTab === 'favorites' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[28px] border border-[#E7EEF8] bg-white p-6 shadow-xs">
                <div>
                  <h2 className="text-xl font-black text-[#0F172A] tracking-tight">Sản phẩm yêu thích</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Danh sách các sản phẩm AI Tools & Apps bạn quan tâm và lưu lại.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3.5 py-1.5 text-xs font-extrabold text-rose-600 border border-rose-100 shrink-0">
                  ❤️ {favoriteProducts.length} sản phẩm
                </span>
              </div>

              {loadingFavorites ? (
                <div className="rounded-[28px] border border-[#E7EEF8] bg-white p-12 text-center shadow-xs">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-100 border-t-[#2563EB]" />
                  <p className="mt-3 text-xs font-semibold text-slate-400">Đang tải sản phẩm yêu thích...</p>
                </div>
              ) : favoriteProducts.length === 0 ? (
                <div className="rounded-[28px] border border-[#E7EEF8] bg-white p-10 sm:p-16 text-center shadow-xs space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-2xl shadow-xs">
                    ❤️
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#0F172A]">Chưa có sản phẩm yêu thích</h3>
                    <p className="mt-1 text-xs font-medium text-slate-500 max-w-sm mx-auto leading-relaxed">
                      Lưu những sản phẩm bạn quan tâm để dễ dàng tìm lại khi cần.
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {favoriteProducts.map((item) => (
                    <div
                      key={item.id}
                      className="group relative flex flex-col justify-between rounded-[24px] border border-[#E7EEF8] dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                    >
                      {/* Remove from Favorite button */}
                      <button
                        type="button"
                        onClick={() => toggleFavorite(item)}
                        title="Bỏ yêu thích"
                        className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-500 hover:bg-rose-100 transition shadow-2xs"
                      >
                        <svg className="h-4 w-4 fill-rose-500 stroke-rose-500" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 21.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
                        </svg>
                      </button>

                      <div>
                        <div className="flex items-center gap-3.5 pr-8">
                          <AppLogo
                            slug={item.slug}
                            name={item.name}
                            image={item.image}
                            className="h-14 w-14 shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-sm text-[#0F172A] dark:text-white truncate">{item.name}</h4>
                            <span className="mt-0.5 inline-block text-[10px] font-bold text-[#2563EB] bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full">
                              {item.group}
                            </span>
                          </div>
                        </div>

                        <p className="mt-3 line-clamp-2 text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                          {item.tagline || item.description}
                        </p>
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Giá từ</span>
                          <span className="text-base font-black text-[#2563EB] dark:text-[#35A8FF]">{formatVND(item.price)}</span>
                        </div>
                        <Link
                          to={`/products/${item.slug}`}
                          className="rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] px-4 py-2 text-xs font-bold text-white shadow-xs hover:from-[#0080E0] hover:to-[#1D4ED8] transition"
                        >
                          Xem chi tiết
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: AFFILIATE */}
          {activeTab === 'affiliate' && !isAdmin && <UserAffiliateTab />}

          {/* TAB: SUPPORT TICKETS */}
          {activeTab === 'tickets' && <UserTicketsTab />}

          {/* TAB: SETTINGS & SECURITY */}
          {activeTab === 'settings' && <UserSettingsAndSecurityTab />}
        </main>
      </div>

      {/* RENDER POPUP TÁI THANH TOÁN QR ĐƠN HÀNG */}
      {selectedPayOrder && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setSelectedPayOrder(null)} />

          <div className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto transform rounded-[28px] border border-slate-100 bg-white p-6 shadow-2xl transition-all sm:p-8 animate-fade-up text-center space-y-5">
            <button
              onClick={() => setSelectedPayOrder(null)}
              className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100 transition"
            >
              <CloseIcon className="h-4.5 w-4.5" />
            </button>

            <div>
              <h3 className="text-lg font-black text-[#0F172A]">Thanh toán đơn hàng</h3>
              <p className="text-xs font-semibold text-slate-400 mt-1">Đơn hàng: {selectedPayOrder.product_name} ({selectedPayOrder.plan_label})</p>
              <p className="text-[11px] font-medium text-slate-500 mt-1">
                Vui lòng quét mã QR bên dưới để chuyển khoản {selectedPayOrder.price.toLocaleString('vi-VN')}đ.
              </p>
            </div>

            {/* QR VietQR */}
            <div className="mx-auto flex max-w-[190px] flex-col items-center rounded-2xl border border-slate-100 bg-slate-50 p-2 shadow-xs">
              <img
                src={getPaymentQrUrl(selectedPayOrder.price, selectedPayOrder.payment_code)}
                alt="VietQR RePay"
                className="h-full w-full object-contain rounded-xl"
              />
            </div>

            {/* details */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-left text-xs space-y-1.5 text-[#0F172A]">
              <p><strong>Ngân hàng:</strong> MB Bank</p>
              <p><strong>Số tài khoản:</strong> {BANK_CONFIG.accountNo}</p>
              <p><strong>Chủ tài khoản:</strong> {BANK_CONFIG.accountName}</p>
              <p className="text-blue-600 flex justify-between font-bold">
                <span>Nội dung chuyển khoản:</span>
                <span className="bg-blue-100 px-2 py-0.5 rounded-md font-black">{selectedPayOrder.payment_code}</span>
              </p>
            </div>

            <button
              onClick={() => setSelectedPayOrder(null)}
              className="w-full rounded-full bg-[#2563EB] py-3 text-sm font-bold text-white hover:bg-[#1D4ED8] transition shadow-md"
            >
              Tôi đã chuyển khoản thành công
            </button>
          </div>
        </div>
      )}

      {/* Order Delivered Celebration Modal (Realtime 🎉) */}
      <OrderDeliveredModal
        order={deliveredOrderModal}
        onClose={() => setDeliveredOrderModal(null)}
        onViewDetails={() => {
          setSearchParams({ tab: 'orders' });
        }}
      />

      {/* Create Support Ticket Modal from Order */}
      <CreateTicketModal
        isOpen={showSupportModalFromOrder}
        onClose={() => {
          setShowSupportModalFromOrder(false);
          setSupportOrderIdForModal(null);
        }}
        initialOrderId={supportOrderIdForModal}
        onTicketCreated={() => {
          setSearchParams({ tab: 'tickets' });
        }}
      />

      {/* User Order Detail Modal */}
      <UserOrderDetailModal
        order={selectedDetailOrder}
        hasReviewed={selectedDetailOrder ? reviewedOrderIds.has(selectedDetailOrder.id) : false}
        onReviewSuccess={handleReviewSuccess}
        onClose={() => {
          setSelectedDetailOrder(null);
          if (searchParams.has('order_id')) {
            const next = new URLSearchParams(searchParams);
            next.delete('order_id');
            next.delete('action');
            setSearchParams(next, { replace: true });
          }
        }}
        onRequestSupport={(orderId) => {
          setSupportOrderIdForModal(orderId);
          setShowSupportModalFromOrder(true);
        }}
      />

      {/* Global Order Renewal Modal from Deep Link */}
      {selectedRenewalOrder && (
        <OrderRenewalModal
          order={selectedRenewalOrder}
          onClose={() => {
            setSelectedRenewalOrder(null);
            if (searchParams.has('order_id')) {
              const next = new URLSearchParams(searchParams);
              next.delete('order_id');
              next.delete('action');
              setSearchParams(next, { replace: true });
            }
          }}
          onRenewalSuccess={() => {
            setSelectedRenewalOrder(null);
            if (searchParams.has('order_id')) {
              const next = new URLSearchParams(searchParams);
              next.delete('order_id');
              next.delete('action');
              setSearchParams(next, { replace: true });
            }
            fetchOrders();
          }}
        />
      )}
    </div>
  );
}