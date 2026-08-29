import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../Toast';
import { CloseIcon } from '../icons';
import OrderTimeline from './OrderTimeline';
import ReviewModal from './ReviewModal';
import OrderRenewalModal from './OrderRenewalModal';

interface OrderDetailModalProps {
  order: {
    id: string;
    product_name: string;
    plan_label: string;
    price: number;
    original_price?: number;
    discount_amount?: number;
    coupon_code?: string;
    payment_code: string;
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
    notes?: string;
    account_details?: string;
    delivery_info?: string;
    expires_at?: string;
    renewal_policy?: string;
    target_account?: string;
    created_at: string;
  } | null;
  hasReviewed?: boolean;
  onReviewSuccess?: (orderId: string) => void;
  onClose: () => void;
  onRequestSupport?: (orderId: string) => void;
}

export default function UserOrderDetailModal({
  order,
  hasReviewed: hasReviewedProp,
  onReviewSuccess,
  onClose,
  onRequestSupport,
}: OrderDetailModalProps) {
  const toast = useToast();
  const [currentOrder, setCurrentOrder] = useState(order);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [localReviewed, setLocalReviewed] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);

  useEffect(() => {
    setCurrentOrder(order);
  }, [order]);

  // Realtime listener khi Admin bàn giao từ Telegram hoặc Web
  useEffect(() => {
    if (!currentOrder?.id) return;

    const channel = supabase
      .channel(`order-live-${currentOrder.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${currentOrder.id}`,
        },
        (payload) => {
          if (payload.new) {
            const updated = payload.new as any;
            setCurrentOrder((prev) => (prev ? { ...prev, ...updated } : prev));
            if (updated.status === 'completed' && currentOrder.status !== 'completed') {
              toast.success('🎉 Đơn hàng đã được bàn giao thành công! Thông tin tài khoản đã sẵn sàng.');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrder?.id, currentOrder?.status, toast]);

  useEffect(() => {
    setLocalReviewed(false);
  }, [currentOrder?.id]);

  useEffect(() => {
    if (!currentOrder?.id || currentOrder.status !== 'completed' || hasReviewedProp !== undefined) return;

    const checkReview = async () => {
      const { data } = await (supabase
        .from('product_reviews')
        .select('id')
        .eq('order_id', currentOrder.id)
        .maybeSingle() as any);

      if (data?.id) {
        setLocalReviewed(true);
      }
    };

    checkReview();
  }, [currentOrder?.id, currentOrder?.status, hasReviewedProp]);

  useEffect(() => {
    if (!currentOrder) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [currentOrder]);

  if (!currentOrder) return null;
  const activeOrder = currentOrder;

  const isReviewed = hasReviewedProp !== undefined ? (hasReviewedProp || localReviewed) : localReviewed;

  const copyToClipboard = (text: string, isAccount = false) => {
    navigator.clipboard.writeText(text);
    if (isAccount) {
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
      toast.success('Đã sao chép thông tin tài khoản bàn giao!');
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      toast.success('Đã sao chép mã đơn hàng!');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
      case 'pending_payment':
        return <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/40 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400 border border-amber-200/50">Chờ thanh toán</span>;
      case 'paid':
      case 'pending_delivery':
        return <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/40 px-3 py-1 text-xs font-bold text-[#2563EB] dark:text-[#35A8FF] border border-blue-200/50">Chờ bàn giao</span>;
      case 'processing':
      case 'delivering':
        return <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-400 border border-indigo-200/50">Đang thiết lập</span>;
      case 'completed':
        return <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200/50">Đã hoàn thành</span>;
      case 'cancelled':
        return <span className="inline-flex items-center rounded-full bg-rose-50 dark:bg-rose-950/40 px-3 py-1 text-xs font-bold text-rose-700 dark:text-rose-400 border border-rose-200/50">Đã hủy</span>;
      case 'refunded':
        return <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200">Đã hoàn tiền</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200">{status}</span>;
    }
  };

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
    const pName = (activeOrder.product_name || '').toLowerCase();
    const pCode = (activeOrder.payment_code || '').toUpperCase();
    const pNotes = (activeOrder.notes || '').toLowerCase();
    return pName.includes('nạp tiền') || pName.includes('nạp số dư') || pCode.startsWith('BOWN') || pNotes.includes('nạp số dư');
  };

  const calcExpiryInfo = () => {
    if (activeOrder.status !== 'completed' || isTopupOrder()) return null;

    const displayPlan = getFormattedPlanLabel(activeOrder);
    const planStr = `${activeOrder.product_name || ''} ${activeOrder.plan_label || ''} ${displayPlan} ${activeOrder.notes || ''}`.toLowerCase();

    // 1. Gói vĩnh viễn
    if (planStr.includes('vĩnh viễn') || planStr.includes('lifetime') || planStr.includes('trọn đời')) {
      return {
        label: 'Vĩnh viễn (Trọn đời)',
        badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200/60',
        icon: '👑',
        isExpiringSoon: false,
        isExpired: false,
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
    } else if (planStr.includes('7 ngày') || planStr.includes('1 tuần') || planStr.includes('1 week') || planStr.includes('7 days') || planStr.includes('7d') || (activeOrder.price <= 20000 && planStr.includes('capcut'))) {
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

    const createdAtMs = new Date(activeOrder.created_at).getTime();
    const expiresAtMs = activeOrder.expires_at ? new Date(activeOrder.expires_at).getTime() : createdAtMs + durationDays * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const diffMs = expiresAtMs - nowMs;
    const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

    if (diffMs <= 0) {
      return {
        label: 'Đã hết hạn',
        badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200/60',
        icon: '🔴',
        isExpiringSoon: false,
        isExpired: true,
        daysText: 'Đã kết thúc chu kỳ sử dụng',
      };
    }

    if (isHours && diffHours <= 24) {
      return {
        label: `Còn ${diffHours} giờ`,
        badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/60',
        icon: '⚡',
        isExpiringSoon: diffHours <= 6,
        isExpired: false,
        daysText: `Hạn dùng đến: ${new Date(expiresAtMs).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date(expiresAtMs).toLocaleDateString('vi-VN')}`,
      };
    }

    if (diffDays <= 5) {
      return {
        label: `Còn ${diffDays} ngày (Sắp hết)`,
        badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/60 animate-pulse',
        icon: '🟡',
        isExpiringSoon: true,
        isExpired: false,
        daysText: `Hạn dùng đến: ${new Date(expiresAtMs).toLocaleDateString('vi-VN')}`,
      };
    }

    return {
      label: `Còn ${diffDays} ngày`,
      badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/60',
      icon: '🟢',
      isExpiringSoon: false,
      isExpired: false,
      daysText: `Hạn dùng đến: ${new Date(expiresAtMs).toLocaleDateString('vi-VN')}`,
    };
  };

  const calcWarranty = () => {
    if (activeOrder.status !== 'completed' || isTopupOrder()) return null;

    const displayPlan = getFormattedPlanLabel(activeOrder);
    const planStr = `${activeOrder.product_name || ''} ${activeOrder.plan_label || ''} ${displayPlan} ${activeOrder.notes || ''}`.toLowerCase();

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
    } else if (planStr.includes('7 ngày') || planStr.includes('1 tuần') || planStr.includes('1 week') || planStr.includes('7 days') || planStr.includes('7d') || (activeOrder.price <= 20000 && planStr.includes('capcut'))) {
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

    const createdAtMs = new Date(activeOrder.created_at).getTime();
    const expiresAtMs = activeOrder.expires_at ? new Date(activeOrder.expires_at).getTime() : createdAtMs + durationDays * 24 * 60 * 60 * 1000;
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
  const deliveryContent = activeOrder.delivery_info || activeOrder.account_details;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overscroll-contain overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={onClose} />

      <div className="relative z-[100000] w-full max-w-md max-h-[85dvh] sm:max-h-[90dvh] my-auto flex flex-col overflow-hidden rounded-[24px] sm:rounded-[28px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C32] shadow-2xl animate-scale-up text-slate-900 dark:text-white">
        {/* Fixed Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 p-4 sm:p-5 shrink-0 bg-white dark:bg-[#131C32]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#19A7FF]/20 to-[#2563EB]/20 border border-[#2563EB]/30 text-[#2563EB] dark:text-[#35A8FF] flex items-center justify-center text-lg shrink-0 font-bold">
              📦
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white truncate">
                  {activeOrder.product_name}
                </h3>
                {getStatusBadge(activeOrder.status)}
              </div>
              <p className="text-xs text-slate-400 font-medium">Gói: <span className="font-extrabold text-[#2563EB] dark:text-[#35A8FF]">{getFormattedPlanLabel(activeOrder)}</span></p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Key info table (Đưa lên đầu) */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#18243E]/50 p-4 text-xs space-y-2">
            <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-400 font-medium">Mã đơn hàng:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-slate-900 dark:text-white">#{activeOrder.payment_code}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(activeOrder.payment_code)}
                  className="text-[11px] font-bold text-[#2563EB] hover:underline cursor-pointer"
                >
                  {copiedCode ? 'Đã chép!' : 'Sao chép'}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-400 font-medium">Thời gian khởi tạo:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {new Date(activeOrder.created_at).toLocaleString('vi-VN')}
              </span>
            </div>

            {Number(activeOrder.discount_amount) > 0 ? (
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 font-bold">
                <span>Mã giảm giá ({activeOrder.coupon_code || 'COUPON'}):</span>
                <span>-{Number(activeOrder.discount_amount).toLocaleString('vi-VN')}đ</span>
              </div>
            ) : null}

            <div className="flex justify-between items-center py-1 pt-1.5 font-bold">
              <span className="text-slate-400 font-medium">Tổng thanh toán:</span>
              <span className="text-sm font-black text-[#2563EB]">
                {activeOrder.price.toLocaleString('vi-VN')}đ
              </span>
            </div>
          </div>

          {/* Order timeline */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#18243E]/50 p-4">
            <OrderTimeline
              orderId={activeOrder.id}
              currentStatus={activeOrder.status}
              orderCreatedAt={activeOrder.created_at}
            />
          </div>

          {/* Notes if present */}
          {activeOrder.notes && (
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#18243E]/50 p-4 text-xs space-y-1">
              <span className="font-bold text-slate-500 dark:text-slate-400">Ghi chú của bạn:</span>
              <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">{activeOrder.notes}</p>
            </div>
          )}

          {/* Delivery credentials info for user */}
          {activeOrder.status === 'completed' && deliveryContent && (
            <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <span>🎁</span> Thông tin bàn giao dịch vụ:
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(deliveryContent, true)}
                  className="rounded-lg bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 text-emerald-800 dark:text-emerald-200 px-2.5 py-1 text-[11px] font-black transition cursor-pointer flex items-center gap-1"
                >
                  <span>📋</span>
                  <span>{copiedAccount ? 'Đã chép!' : 'Sao chép thông tin'}</span>
                </button>
              </div>

              <pre className="rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-white/80 dark:bg-[#131C32] p-3 text-xs font-mono text-emerald-950 dark:text-emerald-200 whitespace-pre-wrap break-all leading-relaxed">
                {deliveryContent}
              </pre>
            </div>
          )}

          {/* Subscription Expiry & Warranty & Conditional Renewal */}
          {activeOrder.status === 'completed' && expiryInfo && (
            <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-blue-950/40 dark:to-indigo-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                    <span>⏰</span> Thời hạn dịch vụ:
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${expiryInfo.badgeClass}`}>
                    <span>{expiryInfo.icon}</span>
                    <span>{expiryInfo.label}</span>
                  </span>
                </div>

                {warranty && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                      <span>🛡️</span> Bảo hành:
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${warranty.badgeClass}`}>
                      <span>{warranty.label}</span>
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 text-xs flex-wrap">
                <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                  {expiryInfo.daysText}
                </span>

                {/* Chỉ hiển thị nút Gia hạn khi gói sắp hết hạn (<= 5 ngày) hoặc đã hết hạn */}
                {(expiryInfo.isExpiringSoon || expiryInfo.isExpired) && (
                  <button
                    type="button"
                    onClick={() => setShowRenewalModal(true)}
                    className="rounded-xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] hover:from-[#19A7FF] hover:to-[#1D4ED8] text-white px-3.5 py-1.5 text-xs font-black transition shadow-xs cursor-pointer shrink-0 flex items-center gap-1.5 animate-pulse ml-auto"
                  >
                    <span>🔄 Gia hạn / Mua tiếp</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Review Action if Order is Completed */}
          {activeOrder.status === 'completed' && (
            <div>
              {isReviewed ? (
                <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/30 p-3.5 flex items-center gap-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[11px] font-black shrink-0">
                    ✓
                  </span>
                  <span>Đã đánh giá sản phẩm</span>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#18243E] p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg shrink-0">⭐</span>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-900 dark:text-white">Chưa đánh giá sản phẩm</p>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">Chia sẻ trải nghiệm của bạn</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(true)}
                    className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-3.5 py-1.5 text-xs font-black transition shadow-xs cursor-pointer shrink-0"
                  >
                    Đánh giá ngay
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed Footer Buttons */}
        <div className="flex gap-3 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-[#18243E]/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            Đóng
          </button>
          {onRequestSupport && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequestSupport(activeOrder.id);
              }}
              className="flex-1 rounded-full bg-gradient-to-r from-[#19A7FF] to-[#2563EB] hover:opacity-95 hover:scale-[1.02] active:scale-[0.98] py-2.5 text-xs font-extrabold text-white shadow-md shadow-blue-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🎧</span>
              <span>Cần hỗ trợ đơn này</span>
            </button>
          )}
        </div>

        {/* Review Modal */}
        {showReviewModal && (
          <ReviewModal
            order={activeOrder}
            onClose={() => setShowReviewModal(false)}
            onSuccess={() => {
              setLocalReviewed(true);
              if (onReviewSuccess && activeOrder?.id) onReviewSuccess(activeOrder.id);
            }}
          />
        )}

        {/* Renewal Modal */}
        {showRenewalModal && (
          <OrderRenewalModal
            order={activeOrder}
            onClose={() => setShowRenewalModal(false)}
            onRenewalSuccess={(newOrderId) => {
              setShowRenewalModal(false);
              onClose();
              if (onReviewSuccess) onReviewSuccess(newOrderId);
            }}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
