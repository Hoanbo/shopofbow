import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { CloseIcon } from './icons';
import type { CatalogItem } from '../data/types';
import {
  validateCouponCode,
  checkFirstOrderEligibility,
  fetchPublicSuggestedCoupons,
  type CouponValidationResult,
  type Coupon,
} from '../data/coupons';
import {
  getStoredReferralCode,
} from '../utils/affiliate';

interface Plan {
  id?: string;
  label: string;
  duration: string;
  price: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: CatalogItem;
  plan: Plan;
  /** Gọi khi thanh toán ví thành công — trước khi đóng modal */
  onWalletSuccess: (order: { code: string; amount: number; qty: number }) => void;
}

const BANK_CONFIG = {
  bankId: 'MB', // MB Bank (mã VietQR)
  accountNo: '0966821315',
  accountName: 'NGUYEN VAN HOAN',
};

export default function CheckoutModal({ isOpen, onClose, item, plan, onWalletSuccess }: Props) {
  const { session, balance, refreshBalance, isCtv } = useAuth();
  const [method, setMethod] = useState<'wallet' | 'vietqr'>('vietqr');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState<'checkout' | 'payment' | 'success'>('checkout');
  const [paymentCode, setPaymentCode] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false); // chống double-submit

  // Coupon States
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [suggestedCoupons, setSuggestedCoupons] = useState<Coupon[]>([]);
  const [isFirstOrderUser, setIsFirstOrderUser] = useState(false);

  // Determine CTV vs Retail unit price
  const matchedPlan = item.plans?.find((p) => p.label === plan.label) || plan;
  const planCtvPrice = (isCtv && matchedPlan && (matchedPlan as any).priceCtv != null && (matchedPlan as any).priceCtv > 0)
    ? (matchedPlan as any).priceCtv
    : (isCtv && item.priceCtv != null && item.priceCtv > 0)
    ? item.priceCtv
    : null;

  const isCtvDiscountApplied = Boolean(isCtv && planCtvPrice != null && planCtvPrice < plan.price);
  const unitPrice = isCtvDiscountApplied ? Number(planCtvPrice) : plan.price;
  const rawTotalPrice = unitPrice * quantity;

  const couponDiscountAmount = appliedCoupon?.valid ? (appliedCoupon.discount_amount ?? 0) : 0;
  const discountAmount = couponDiscountAmount;
  const finalPrice = Math.max(0, rawTotalPrice - discountAmount);

  // Generate unique payment code & reset on open
  useEffect(() => {
    if (isOpen) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      setPaymentCode(`BOW${Date.now().toString().slice(-5)}${rand}`);
      setStep('checkout');
      setError(null);
      setNotes('');
      setQuantity(1);
      setOrderId(null);
      setCouponInput('');
      setAppliedCoupon(null);
      setCouponError(null);

      // Check first order eligibility & suggestions
      if (session?.user?.id) {
        checkFirstOrderEligibility(session.user.id).then((isFirst) => {
          setIsFirstOrderUser(isFirst);
        });
      }
      fetchPublicSuggestedCoupons().then((list) => {
        setSuggestedCoupons(list);
      });

      // Default payment method based on wallet balance
      setMethod(balance >= plan.price ? 'wallet' : 'vietqr');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Auto-switch method sang vietqr khi số dư ví không đủ cho finalPrice
  useEffect(() => {
    if (method === 'wallet' && balance < finalPrice) {
      setMethod('vietqr');
    }
  }, [finalPrice, balance, method]);

  // Revalidate applied coupon when total amount changes (e.g. user changes quantity)
  useEffect(() => {
    if (appliedCoupon?.code && session?.user?.id) {
      validateCouponCode(appliedCoupon.code, rawTotalPrice, session.user.id).then((res) => {
        if (res.valid) {
          setAppliedCoupon(res);
          setCouponError(null);
        } else {
          setAppliedCoupon(null);
          setCouponError(res.message || 'Mã giảm giá không còn phù hợp với số lượng mới.');
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawTotalPrice]);

  // Realtime order tracking for QR payment
  useEffect(() => {
    if (step !== 'payment' || !orderId) return;

    let cancelled = false;
    const settleIfPaid = (status?: string | null) => {
      if (!cancelled && status && status !== 'pending_payment' && status !== 'cancelled') {
        setStep('success');
      }
    };

    const checkOnce = async () => {
      const { data } = await (supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .maybeSingle() as any);
      settleIfPaid(data?.status);
    };
    checkOnce();

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => settleIfPaid((payload.new as { status?: string })?.status),
      )
      .subscribe();

    const poll = setInterval(checkOnce, 5000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [step, orderId]);

  if (!isOpen || !session) return null;

  // Handle Apply Coupon
  const handleApplyCoupon = async (codeToUse?: string) => {
    const targetCode = (codeToUse || couponInput).trim();
    if (!targetCode) {
      setCouponError('Vui lòng nhập mã giảm giá.');
      return;
    }
    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await validateCouponCode(targetCode, rawTotalPrice, session.user.id, item.id);
      if (res.valid) {
        setAppliedCoupon(res);
        setCouponInput(res.code || targetCode.toUpperCase());
        setCouponError(null);
      } else {
        setAppliedCoupon(null);
        setCouponError(res.message);
      }
    } catch (err: any) {
      setCouponError(err?.message || 'Không thể áp dụng mã giảm giá.');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  };

  const trackAffiliateConversion = async (createdOrderId: string) => {
    try {
      const storedRefCode = getStoredReferralCode();
      await (supabase as any).rpc('record_affiliate_conversion', {
        p_order_id: createdOrderId,
        p_referral_code: storedRefCode || null,
      });
    } catch (e) {
      console.warn('[trackAffiliateConversion] note:', e);
    }
  };

  // Handle Wallet Payment
  const handleWalletPayment = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const fullPlanLabel = plan.duration && !plan.label.toLowerCase().includes(plan.duration.toLowerCase())
        ? `${plan.label} (${plan.duration})`
        : plan.label;

      const { data, error: rpcErr } = await (supabase as any).rpc('buy_with_wallet', {
        p_user_id: session.user.id,
        p_product_name: quantity > 1 ? `${item.name} (x${quantity})` : item.name,
        p_plan_label: fullPlanLabel,
        p_price: rawTotalPrice,
        p_payment_code: paymentCode,
        p_notes: notes.trim(),
        p_product_id: item.id.length === 36 ? item.id : undefined,
        p_plan_id: plan.id && plan.id.length === 36 ? plan.id : undefined,
        p_quantity: quantity,
        p_coupon_code: appliedCoupon?.code || null,
      });

      if (rpcErr) throw rpcErr;
      if (data === 'success') {
        const paidAmount = finalPrice;
        const paidQty = quantity;
        const paidCode = paymentCode;

        // Track affiliate conversion
        const { data: createdOrd } = await (supabase.from('orders') as any)
          .select('id')
          .eq('payment_code', paidCode)
          .maybeSingle();
        if (createdOrd?.id) {
          await trackAffiliateConversion(createdOrd.id);
        }

        await refreshBalance();
        onWalletSuccess({ code: paidCode, amount: paidAmount, qty: paidQty });
        onClose();
      } else if (data === 'insufficient_balance') {
        throw new Error('Số dư ví không đủ. Vui lòng nạp thêm hoặc đổi phương thức thanh toán.');
      } else if (data === 'invalid_coupon') {
        throw new Error('Mã giảm giá không hợp lệ hoặc đã hết hạn.');
      } else if (data === 'coupon_first_order_only') {
        throw new Error('Mã giảm giá này chỉ áp dụng cho đơn hàng đầu tiên.');
      } else if (data === 'coupon_user_limit_reached') {
        throw new Error('Bạn đã sử dụng hết lượt cho mã giảm giá này.');
      } else if (data === 'unauthorized') {
        throw new Error('Thao tác không được phép (Unauthorized).');
      } else {
        throw new Error(`Giao dịch thất bại (${data}). Vui lòng thử lại.`);
      }
    } catch (err: any) {
      const msg = err?.message || err?.details || err?.hint || 'Lỗi kết nối trừ tiền ví.';
      console.error('[buy_with_wallet] error:', err);
      setError(msg);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  // Handle VietQR / External Payment
  const handleExternalPayment = async () => {
    setError(null);
    setLoading(true);
    try {
      const fullPlanLabel = plan.duration && !plan.label.toLowerCase().includes(plan.duration.toLowerCase())
        ? `${plan.label} (${plan.duration})`
        : plan.label;

      const { data, error: rpcErr } = await (supabase as any).rpc('create_order_with_coupon', {
        p_user_id: session.user.id,
        p_product_name: quantity > 1 ? `${item.name} (x${quantity})` : item.name,
        p_plan_label: fullPlanLabel,
        p_price: rawTotalPrice,
        p_payment_code: paymentCode,
        p_notes: notes.trim(),
        p_product_id: item.id.length === 36 ? item.id : undefined,
        p_plan_id: plan.id && plan.id.length === 36 ? plan.id : undefined,
        p_quantity: quantity,
        p_coupon_code: appliedCoupon?.code || null,
      });

      if (rpcErr) throw rpcErr;
      if (!data?.success) {
        throw new Error(data?.message || 'Không thể tạo đơn hàng thanh toán.');
      }

      const createdOrderId = data.order_id ?? null;
      setOrderId(createdOrderId);
      if (createdOrderId) {
        await trackAffiliateConversion(createdOrderId);
      }
      setStep('payment');
    } catch (err: any) {
      setError(err?.message || err?.details || 'Lỗi tạo đơn hàng thanh toán.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || submittingRef.current) return;
    if (method === 'wallet') {
      handleWalletPayment();
    } else {
      handleExternalPayment();
    }
  };

  // Generate VietQR URL with final discounted price
  const vietQrUrl = `https://img.vietqr.io/image/${BANK_CONFIG.bankId}-${BANK_CONFIG.accountNo}-compact2.jpg?amount=${finalPrice}&addInfo=${paymentCode}&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}`;

  // Find if WELCOME20 coupon is available to suggest
  const welcomeCoupon = suggestedCoupons.find(c => c.code.toUpperCase() === 'WELCOME20');
  const showWelcomeSuggestion = isFirstOrderUser && welcomeCoupon && !appliedCoupon;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto overscroll-contain transform rounded-[28px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#18243E] p-6 shadow-2xl transition-all sm:p-8 animate-fade-up text-slate-900 dark:text-white">
        {/* Close Button */}
        {step !== 'success' && (
          <button
            onClick={onClose}
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
          >
            <CloseIcon className="h-4.5 w-4.5" />
          </button>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-3 text-center text-xs font-semibold text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* STEP 1: CHECKOUT INFO FORM */}
        {step === 'checkout' && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Đơn hàng của bạn</span>
                {isCtvDiscountApplied && (
                  <span className="rounded-md bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-300">
                    👑 Giá Sỉ CTV
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3.5 border border-slate-100 dark:border-slate-800">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 shrink-0">
                  <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-white truncate">{item.name}</h4>
                  <p className="text-xs font-medium text-slate-400 dark:text-slate-400 mt-0.5">
                    Gói {plan.label} ({plan.duration})
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {quantity > 1 && (
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 line-through mb-0.5">
                      {unitPrice.toLocaleString('vi-VN')}đ / cái
                    </p>
                  )}
                  <span className="text-sm font-black text-[#2563EB] dark:text-[#35A8FF]">
                    {rawTotalPrice.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>

              {/* Quantity selector */}
              <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/60 px-4 py-2.5">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Số lượng:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition font-bold text-sm cursor-pointer"
                  >−</button>
                  <span className="w-8 text-center text-sm font-black text-[#0F172A] dark:text-white">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(q => Math.min(10, q + 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition font-bold text-sm cursor-pointer"
                  >+</button>
                </div>
              </div>
            </div>

            {/* 🎟️ COUPON / DISCOUNT CODE SECTION */}
            <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/30 dark:bg-blue-950/20 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                  <span>🎟️</span>
                  <span>Mã giảm giá</span>
                </span>
                {appliedCoupon?.valid && (
                  <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                    Đã áp dụng
                  </span>
                )}
              </div>

              {/* Coupon Suggestion for First-Order user */}
              {showWelcomeSuggestion && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-800 dark:text-amber-300 animate-pulse">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-base">🎁</span>
                    <span className="truncate">
                      Giảm <strong>20.000đ</strong> đơn đầu tiên với mã <strong>WELCOME20</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon('WELCOME20')}
                    className="shrink-0 rounded-lg bg-amber-500 text-white px-2.5 py-1 text-[11px] font-black hover:bg-amber-600 transition cursor-pointer shadow-xs"
                  >
                    Áp dụng
                  </button>
                </div>
              )}

              {/* Applied Coupon Display vs Input Form */}
              {appliedCoupon?.valid ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-black text-emerald-700 dark:text-emerald-300">
                          {appliedCoupon.code}
                        </span>
                        <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                          (-{couponDiscountAmount.toLocaleString('vi-VN')}đ)
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        {appliedCoupon.name || 'Mã giảm giá hợp lệ'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="text-xs font-bold text-rose-500 hover:text-rose-700 dark:text-rose-400 hover:underline px-2 py-1 cursor-pointer"
                  >
                    Bỏ mã
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      setCouponError(null);
                    }}
                    placeholder="Nhập mã giảm giá (VD: WELCOME20)..."
                    className="h-10 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 px-3.5 text-xs font-mono font-bold uppercase tracking-wider outline-none transition focus:border-[#2563EB] dark:focus:border-[#35A8FF] text-[#0F172A] dark:text-white placeholder:text-slate-400 placeholder:normal-case placeholder:font-sans placeholder:font-normal"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyCoupon()}
                    disabled={couponLoading || !couponInput.trim()}
                    className="h-10 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] dark:bg-[#35A8FF] dark:hover:bg-[#2563EB] px-4 text-xs font-black text-white transition disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {couponLoading ? '...' : 'Áp dụng'}
                  </button>
                </div>
              )}

              {couponError && (
                <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1">
                  <span>⚠️</span>
                  <span>{couponError}</span>
                </p>
              )}
            </div>

            {/* 💰 PRICE BREAKDOWN TABLE */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between font-semibold text-slate-600 dark:text-slate-400">
                <span>Tạm tính ({quantity} sản phẩm):</span>
                <span className="font-bold text-slate-900 dark:text-white">{rawTotalPrice.toLocaleString('vi-VN')}đ</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="flex items-center gap-1">
                    <span>
                      {appliedCoupon?.valid
                        ? `Mã giảm giá (${appliedCoupon.code})`
                        : 'Ưu đãi chào mừng đơn đầu'}
                      :
                    </span>
                  </span>
                  <span className="font-black">-{discountAmount.toLocaleString('vi-VN')}đ</span>
                </div>
              )}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between items-baseline">
                <span className="text-xs font-extrabold text-[#0F172A] dark:text-white uppercase tracking-wider">
                  Tổng thanh toán:
                </span>
                <span className="text-base font-black text-[#2563EB] dark:text-[#35A8FF]">
                  {finalPrice.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            {/* Notes field optional */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Ghi chú cho người bán (Ví dụ: Email nhận tài khoản, SĐT...)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nhập email kích hoạt hoặc yêu cầu đặc biệt (không bắt buộc)"
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3.5 text-sm font-medium outline-none transition focus:border-[#2563EB] dark:focus:border-[#35A8FF] focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 text-[#0F172A] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Payment Method Selector */}
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                Chọn phương thức thanh toán
              </span>
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Wallet Balance */}
                <button
                  type="button"
                  onClick={() => balance >= finalPrice && setMethod('wallet')}
                  disabled={balance < finalPrice}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all cursor-pointer ${
                    balance < finalPrice
                      ? 'border-slate-100 dark:border-slate-800/40 bg-slate-50 dark:bg-slate-900/40 opacity-50 cursor-not-allowed'
                      : method === 'wallet'
                        ? 'border-[#2563EB] dark:border-[#35A8FF] bg-[#EEF6FF] dark:bg-blue-950/50 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/50 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  <span className="text-xl">💳</span>
                  <span className={`text-xs font-extrabold ${method === 'wallet' ? 'text-[#2563EB] dark:text-[#35A8FF]' : 'text-[#0F172A] dark:text-slate-200'}`}>
                    Số dư ví
                  </span>
                  <span className={`text-[10px] font-semibold ${method === 'wallet' ? 'text-blue-600/80 dark:text-blue-300/80' : 'text-slate-400 dark:text-slate-400'}`}>
                    ({balance.toLocaleString('vi-VN')}đ)
                  </span>
                </button>

                {/* VietQR */}
                <button
                  type="button"
                  onClick={() => setMethod('vietqr')}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all cursor-pointer ${
                    method === 'vietqr'
                      ? 'border-[#2563EB] dark:border-[#35A8FF] bg-[#EEF6FF] dark:bg-blue-950/50 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/50 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  <span className="text-xl">🏦</span>
                  <span className={`text-xs font-extrabold ${method === 'vietqr' ? 'text-[#2563EB] dark:text-[#35A8FF]' : 'text-[#0F172A] dark:text-slate-200'}`}>
                    Ngân hàng
                  </span>
                  <span className={`text-[10px] font-semibold ${method === 'vietqr' ? 'text-blue-600/80 dark:text-blue-300/80' : 'text-slate-400 dark:text-slate-400'}`}>
                    VietQR SePay
                  </span>
                </button>
              </div>

              {/* Cảnh báo khi số dư ví không đủ */}
              {balance < finalPrice && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  <span>⚠️</span>
                  <span>Số dư ví ({balance.toLocaleString('vi-VN')}đ) không đủ để thanh toán {finalPrice.toLocaleString('vi-VN')}đ. Vui lòng nạp thêm hoặc chọn thanh toán Ngân hàng VietQR.</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || submittingRef.current || (method === 'wallet' && balance < finalPrice)}
              className="w-full rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-3 text-sm font-bold text-white shadow-md transition-all duration-300 hover:from-[#0080E0] hover:to-[#1D4ED8] disabled:opacity-60 cursor-pointer"
            >
              {loading
                ? (method === 'wallet' ? 'Đang thanh toán...' : 'Đang tạo đơn hàng...')
                : method === 'wallet'
                  ? `Thanh toán ${finalPrice.toLocaleString('vi-VN')}đ bằng ví`
                  : `Lấy mã QR thanh toán (${finalPrice.toLocaleString('vi-VN')}đ)`
              }
            </button>
          </form>
        )}

        {/* STEP 2: EXTERNAL QR PAYMENT SHOWCASE */}
        {step === 'payment' && (
          <div className="text-center space-y-5">
            <div>
              <h3 className="text-lg font-black text-[#0F172A] dark:text-white">Thanh toán đơn hàng</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                Vui lòng quét mã QR bên dưới để thanh toán số tiền <strong className="text-[#2563EB] dark:text-[#35A8FF]">{finalPrice.toLocaleString('vi-VN')}đ</strong>.
              </p>
              {discountAmount > 0 && (
                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  ✓ Đã áp dụng mã {appliedCoupon?.code} (Giảm {discountAmount.toLocaleString('vi-VN')}đ)
                </p>
              )}
            </div>

            {/* QR Code */}
            <div className="mx-auto flex max-w-[200px] flex-col items-center rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 shadow-xs">
              <img src={vietQrUrl} alt="VietQR SePay" className="h-full w-full object-contain rounded-xl" />
            </div>

            {/* Payment Details */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-4 text-left text-xs space-y-2 text-[#0F172A] dark:text-white">
              <div className="flex justify-between font-medium">
                <span className="text-slate-500 dark:text-slate-400">Ngân hàng thụ hưởng:</span>
                <span className="font-bold">MB Bank (Quân Đội)</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-500 dark:text-slate-400">Số tài khoản:</span>
                <span className="font-mono font-bold text-[#2563EB] dark:text-[#35A8FF]">{BANK_CONFIG.accountNo}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-500 dark:text-slate-400">Chủ tài khoản:</span>
                <span className="font-bold">{BANK_CONFIG.accountName}</span>
              </div>
              <div className="flex justify-between font-medium border-t border-slate-200 dark:border-slate-700/60 pt-2">
                <span className="text-slate-500 dark:text-slate-400">Số tiền:</span>
                <span className="font-black text-[#2563EB] dark:text-[#35A8FF] text-sm">{finalPrice.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="flex justify-between font-medium items-center">
                <span className="text-slate-500 dark:text-slate-400">Nội dung CK:</span>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 font-mono font-black text-[#2563EB] dark:text-[#35A8FF]">
                    {paymentCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(paymentCode)}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
              <div className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
              <span>Đang chờ hệ thống SePay tự động xác nhận giao dịch...</span>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS */}
        {step === 'success' && (
          <div className="text-center space-y-4 py-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 text-2xl animate-bounce">
              ✓
            </div>
            <div>
              <h3 className="text-lg font-black text-[#0F172A] dark:text-white">Thanh toán thành công!</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                Đơn hàng #{paymentCode} đã được khởi tạo và gửi tới ban quản trị.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 w-full rounded-full bg-[#2563EB] py-3 text-xs font-black text-white hover:bg-[#1D4ED8] transition cursor-pointer"
            >
              Đóng và tiếp tục mua sắm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
