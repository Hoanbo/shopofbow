import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../Toast';
import { CloseIcon } from '../icons';
import OrderTimeline from './OrderTimeline';
import ReviewModal from './ReviewModal';

interface OrderDetailModalProps {
  order: {
    id: string;
    product_name: string;
    plan_label: string;
    price: number;
    original_price?: number;
    discount_amount?: number;
    coupon_code?: string;
    status: 'pending_payment' | 'pending_delivery' | 'processing' | 'completed' | 'cancelled' | 'refunded';
    payment_code: string;
    notes?: string;
    account_details?: string;
    created_at: string;
  } | null;
  onClose: () => void;
  onRequestSupport?: (orderId: string) => void;
}

export default function UserOrderDetailModal({
  order,
  onClose,
  onRequestSupport,
}: OrderDetailModalProps) {
  const toast = useToast();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    if (!order?.id || order.status !== 'completed') return;

    const checkReview = async () => {
      const { data } = await (supabase
        .from('product_reviews')
        .select('id')
        .eq('order_id', order.id)
        .maybeSingle() as any);

      if (data?.id) {
        setHasReviewed(true);
      }
    };

    checkReview();
  }, [order?.id, order?.status]);

  if (!order) return null;

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
      case 'pending_payment':
        return <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950/40 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400 border border-amber-200/50">Chờ thanh toán</span>;
      case 'pending_delivery':
        return <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/40 px-3 py-1 text-xs font-bold text-[#2563EB] dark:text-[#35A8FF] border border-blue-200/50">Chờ bàn giao</span>;
      case 'processing':
        return <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-400 border border-indigo-200/50">Đang thiết lập</span>;
      case 'completed':
        return <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200/50">Đã hoàn thành</span>;
      case 'cancelled':
        return <span className="inline-flex items-center rounded-full bg-rose-50 dark:bg-rose-950/40 px-3 py-1 text-xs font-bold text-rose-700 dark:text-rose-400 border border-rose-200/50">Đã hủy</span>;
      case 'refunded':
        return <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200">Đã hoàn tiền</span>;
      default:
        return null;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={onClose} />

      <div className="relative z-[100000] w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C32] p-6 shadow-2xl space-y-5 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#19A7FF]/20 to-[#2563EB]/20 border border-[#2563EB]/30 text-[#2563EB] dark:text-[#35A8FF] flex items-center justify-center text-lg shrink-0 font-bold">
              📦
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Chi tiết đơn hàng</h3>
              <p className="text-xs font-mono text-slate-400 mt-0.5">#{order.payment_code}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Product & Status Box */}
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-[#18243E] p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight">{order.product_name}</h4>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 block">Gói: {order.plan_label}</span>
            </div>
            {getStatusBadge(order.status)}
          </div>

          <div className="border-t border-slate-200/60 dark:border-slate-700/60 pt-2.5 space-y-1.5 text-xs">
            {order.discount_amount && order.discount_amount > 0 ? (
              <>
                <div className="flex justify-between text-slate-400 font-semibold">
                  <span>Giá gốc:</span>
                  <span className="line-through">{Number(order.original_price || order.price + order.discount_amount).toLocaleString('vi-VN')}đ</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>Mã giảm giá ({order.coupon_code || 'COUPON'}):</span>
                  <span>-{Number(order.discount_amount).toLocaleString('vi-VN')}đ</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200/40 dark:border-slate-700/40 items-baseline">
                  <span className="text-slate-400 font-semibold">Tổng thanh toán:</span>
                  <span className="text-base font-black text-[#2563EB] dark:text-[#35A8FF]">
                    {Number(order.price || 0).toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-semibold">Tổng giá trị đơn:</span>
                <span className="text-base font-black text-[#2563EB] dark:text-[#35A8FF]">
                  {Number(order.price || 0).toLocaleString('vi-VN')}đ
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 🚚 Tiến trình đơn hàng Timeline */}
        <OrderTimeline
          orderId={order.id}
          currentStatus={order.status}
          orderCreatedAt={order.created_at}
          compact
        />

        {/* Order Details Grid */}
        <div className="space-y-2.5 text-xs">
          <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/50">
            <span className="text-slate-400 font-semibold">Mã đơn hàng:</span>
            <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
              <span>#{order.payment_code}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(order.payment_code)}
                className="text-[10px] text-[#2563EB] dark:text-[#35A8FF] font-bold hover:underline bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md"
              >
                {copiedCode ? 'Đã chép!' : 'Sao chép'}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/50">
            <span className="text-slate-400 font-semibold">Thời gian khởi tạo:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">
              {new Date(order.created_at).toLocaleString('vi-VN')}
            </span>
          </div>

          {order.notes && (
            <div className="py-1">
              <span className="text-slate-400 font-semibold block mb-1">Ghi chú đơn hàng:</span>
              <p className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 font-medium">
                {order.notes}
              </p>
            </div>
          )}
        </div>

        {/* Handover Details Box */}
        {order.status === 'completed' && order.account_details && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/30 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <strong className="text-xs font-black text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                <span>🎁</span> Thông tin bàn giao dịch vụ:
              </strong>
              <button
                type="button"
                onClick={() => copyToClipboard(order.account_details || '', true)}
                className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1 rounded-lg hover:opacity-90 transition"
              >
                {copiedAccount ? '✓ Đã sao chép!' : '📋 Sao chép thông tin'}
              </button>
            </div>
            <pre className="font-mono text-xs text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap leading-relaxed bg-white/70 dark:bg-[#131C32]/80 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
              {order.account_details}
            </pre>
          </div>
        )}

        {/* Review Action if Order is Completed */}
        {order.status === 'completed' && (
          <div className="pt-1">
            {hasReviewed ? (
              <button
                type="button"
                disabled
                className="w-full rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/40 py-2.5 text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5 opacity-90 cursor-default"
              >
                <span>✓</span>
                <span>Đã đánh giá sản phẩm</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowReviewModal(true)}
                className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 py-2.5 text-xs font-black text-white shadow-md flex items-center justify-center gap-1.5 transition hover:scale-[1.01] active:scale-98 cursor-pointer"
              >
                <span>⭐</span>
                <span>Đánh giá sản phẩm</span>
              </button>
            )}
          </div>
        )}

        {/* Action Footer */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
          >
            Đóng
          </button>
          {onRequestSupport && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequestSupport(order.id);
              }}
              className="flex-1 rounded-full bg-gradient-to-r from-[#19A7FF] to-[#2563EB] hover:from-[#19A7FF] hover:to-[#1D4ED8] py-2.5 text-xs font-bold text-white shadow-md transition"
            >
              🎫 Cần hỗ trợ đơn này
            </button>
          )}
        </div>

        {/* Review Modal Portal */}
        {showReviewModal && (
          <ReviewModal
            order={order}
            onClose={() => setShowReviewModal(false)}
            onSuccess={() => setHasReviewed(true)}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
