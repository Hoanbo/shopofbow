import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../Toast';
import { CloseIcon, StarIcon } from '../icons';

interface ReviewModalProps {
  order: {
    id: string;
    product_name: string;
    plan_label: string;
    payment_code: string;
  };
  productId?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const RATING_LABELS: Record<number, string> = {
  1: '1 ⭐ Rất không hài lòng',
  2: '2 ⭐ Không hài lòng',
  3: '3 ⭐ Bình thường',
  4: '4 ⭐ Hài lòng',
  5: '5 ⭐ Rất hài lòng',
};

export default function ReviewModal({
  order,
  productId,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const toast = useToast();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [agreed, setAgreed] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rating) {
      toast.error('Vui lòng chọn số sao đánh giá!');
      return;
    }

    if (content.trim().length < 5) {
      toast.error('Nội dung đánh giá phải có ít nhất 5 ký tự.');
      return;
    }

    if (!agreed) {
      toast.error('Vui lòng xác nhận bạn đã trải nghiệm sản phẩm.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Resolve product_id if not provided directly
      let resolvedProductId = productId;
      if (!resolvedProductId) {
        const { data: prodData } = await (supabase
          .from('products')
          .select('id')
          .ilike('name', order.product_name)
          .maybeSingle() as any);

        if (prodData?.id) {
          resolvedProductId = prodData.id;
        } else {
          // Fallback query
          const { data: fallbackData } = await (supabase
            .from('products')
            .select('id')
            .limit(1) as any);
          if (fallbackData?.[0]?.id) {
            resolvedProductId = fallbackData[0].id;
          }
        }
      }

      if (!resolvedProductId) {
        throw new Error('Không tìm thấy thông tin sản phẩm tương ứng.');
      }

      // 2. Call Security Definer RPC
      const { data, error } = await (supabase as any).rpc('submit_product_review', {
        p_order_id: order.id,
        p_product_id: resolvedProductId,
        p_rating: rating,
        p_content: content.trim(),
      });

      if (error) throw error;

      if (data === 'success') {
        toast.success('✓ Đánh giá sản phẩm thành công!');
        if (onSuccess) onSuccess();
        onClose();
      } else if (data === 'already_reviewed') {
        toast.error('Bạn đã đánh giá sản phẩm này cho đơn hàng này rồi.');
      } else if (data === 'not_purchased' || data === 'order_not_completed') {
        toast.error('Đơn hàng chưa hoàn thành hoặc không có quyền đánh giá.');
      } else {
        toast.error(`Gửi đánh giá thất bại: ${data}`);
      }
    } catch (err: any) {
      console.error('Submit review error:', err);
      toast.error(err.message || 'Không thể gửi đánh giá. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const activeRating = hoverRating !== null ? hoverRating : rating;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overscroll-contain overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={onClose} />

      <div className="relative z-[100000] w-full max-w-md max-h-[85dvh] sm:max-h-[90dvh] my-auto flex flex-col overflow-hidden rounded-[24px] sm:rounded-[28px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C32] shadow-2xl animate-scale-up text-slate-900 dark:text-white">
        {/* Fixed Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 p-4 sm:p-5 shrink-0 bg-white dark:bg-[#131C32]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-10 w-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center text-xl shrink-0">
              ⭐
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-black text-slate-900 dark:text-white truncate">Đánh giá sản phẩm</h3>
              <p className="text-xs font-mono text-slate-400 mt-0.5 truncate">Mã đơn: #{order.payment_code}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Product Info Banner */}
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-[#18243E] p-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{order.product_name}</h4>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Gói: {order.plan_label}</span>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
              ✓ Đã bàn giao
            </span>
          </div>

          {/* Star Selection */}
          <div className="text-center space-y-2 py-2 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-slate-100 dark:border-slate-800/60 p-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Bạn thấy sản phẩm thế nào?
            </label>

            <div
              className="flex items-center justify-center gap-2"
              role="radiogroup"
              aria-label="Chọn số sao đánh giá"
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={star === rating}
                  aria-label={`${star} sao - ${RATING_LABELS[star]}`}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  onClick={() => setRating(star)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      setRating(Math.min(5, star + 1));
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      setRating(Math.max(1, star - 1));
                    }
                  }}
                  className="p-1 transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-amber-400 rounded-lg cursor-pointer"
                >
                  <StarIcon
                    className={`h-8 w-8 transition-colors ${
                      star <= activeRating
                        ? 'fill-amber-400 text-amber-400 drop-shadow-xs'
                        : 'fill-slate-200 text-slate-300 dark:fill-slate-700 dark:text-slate-600'
                    }`}
                  />
                </button>
              ))}
            </div>

            <div className="h-5 text-xs font-extrabold text-amber-600 dark:text-amber-400">
              {RATING_LABELS[activeRating] || ''}
            </div>
          </div>

          {/* Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Chia sẻ trải nghiệm sử dụng:
              </label>
              <span className={`font-mono text-[11px] ${content.length > 450 ? 'text-amber-500 font-bold' : 'text-slate-400'}`}>
                {content.length}/500
              </span>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 500))}
              placeholder="Sản phẩm sử dụng mượt mà, kích hoạt nhanh chóng..."
              rows={4}
              required
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-3 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none transition resize-none"
            />
          </div>

          {/* Agreement Checkbox */}
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="h-4 w-4 rounded-md border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
            />
            <span>Tôi đã trải nghiệm dịch vụ và cam kết đánh giá trung thực.</span>
          </label>

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || !content.trim() || !agreed}
              className="flex-1 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 px-4 py-2.5 text-xs font-black text-white shadow-md disabled:opacity-50 transition hover:scale-102 active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  <span>Đang gửi...</span>
                </>
              ) : (
                <>
                  <span>Gửi đánh giá</span>
                  <span>🚀</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
