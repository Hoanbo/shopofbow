import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../Toast';
import { CloseIcon } from '../icons';
import { validateCouponCode, type CouponValidationResult } from '../../data/coupons';
import { BANK_CONFIG, getPaymentQrUrl } from '../../config/sepay';

interface OrderRenewalModalProps {
  order: {
    id: string;
    product_name: string;
    plan_label: string;
    price: number;
    payment_code: string;
    renewal_policy?: string;
    target_account?: string;
    created_at: string;
  };
  onClose: () => void;
  onRenewalSuccess?: (newOrderId: string) => void;
}

export default function OrderRenewalModal({
  order,
  onClose,
  onRenewalSuccess,
}: OrderRenewalModalProps) {
  const toast = useToast();
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'banking'>('wallet');
  const [userBalance, setUserBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newPaymentCode] = useState(() => `BOW${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`);

  // Coupon states
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const originalPrice = Number(order.price || 0);
  const renewalDiscount = appliedCoupon?.discount_amount ?? 0;
  const finalPrice = Math.max(0, originalPrice - renewalDiscount);

  const handleApplyCoupon = async () => {
    const codeToUse = couponInput.trim();
    if (!codeToUse) return;
    
    setCouponLoading(true);
    setCouponError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Vui lòng đăng nhập để dùng mã giảm giá.");

      const res = await validateCouponCode(codeToUse, originalPrice, user.id);
      if (res.valid) {
        setAppliedCoupon(res);
        setCouponError(null);
        toast.success(`Áp dụng mã ${res.code} thành công!`);
      } else {
        setAppliedCoupon(null);
        setCouponError(res.message);
      }
    } catch (err: any) {
      setAppliedCoupon(null);
      setCouponError(err.message || 'Lỗi kiểm tra mã giảm giá');
    } finally {
      setCouponLoading(false);
    }
  };

  // Policy description
  const policy = order.renewal_policy || 'new_account';

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const fetchBalance = async () => {
      setLoadingBalance(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data } = await (supabase
            .from('profiles')
            .select('balance')
            .eq('id', user.id)
            .single() as any);
          if (data) {
            setUserBalance(Number(data.balance || 0));
          }
        }
      } catch (err) {
        console.error('Error fetching balance:', err);
      } finally {
        setLoadingBalance(false);
      }
    };
    fetchBalance();
  }, []);

  // Tự động áp dụng mã giảm giá từ phiên Agent (nếu có)
  useEffect(() => {
    const storedCoupon = sessionStorage.getItem('bow_applied_coupon');
    if (storedCoupon) {
      sessionStorage.removeItem('bow_applied_coupon');
      setCouponInput(storedCoupon);
      
      const validateFromSession = async () => {
        setCouponLoading(true);
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const res = await validateCouponCode(storedCoupon, originalPrice, user.id);
            if (res.valid) {
              setAppliedCoupon(res);
              setCouponError(null);
            } else {
              setCouponError(res.message);
            }
          }
        } catch (err: any) {
          setCouponError(err.message || 'Lỗi kiểm tra mã giảm giá.');
        } finally {
          setCouponLoading(false);
        }
      };
      validateFromSession();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWalletRenewal = async () => {
    if (userBalance < finalPrice) {
      toast.error('Số dư ví không đủ. Vui lòng chọn Quét mã QR Ngân hàng hoặc nạp thêm ví.');
      setPaymentMethod('banking');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Vui lòng đăng nhập để thực hiện gia hạn.');

      // 1. Deduct balance from profile
      const newBal = userBalance - finalPrice;
      const { error: profileErr } = await (supabase
        .from('profiles')
        .update({ balance: newBal } as any)
        .eq('id', user.id) as any);

      if (profileErr) throw profileErr;

      // 2. Create renewal order
      const initialStatus = policy === 'fixed_farm' ? 'pending_delivery' : 'processing';
      const { data: newOrder, error: orderErr } = await (supabase
        .from('orders')
        .insert({
          user_id: user.id,
          product_name: order.product_name,
          plan_label: order.plan_label,
          price: finalPrice,
          original_price: originalPrice,
          discount_amount: renewalDiscount,
          coupon_code: appliedCoupon ? appliedCoupon.code : null,
          payment_code: newPaymentCode,
          status: initialStatus,
          renewal_policy: policy,
          target_account: order.target_account || null,
          renewed_from_order_id: order.id,
          notes: `Gia hạn từ đơn #${order.payment_code}`,
        } as any)
        .select()
        .single() as any);

      if (orderErr) throw orderErr;

      // 3. Log audit event
      await (supabase.from('audit_logs').insert({
        actor_id: user.id,
        actor_name: user.user_metadata?.full_name || user.email || 'Khách hàng',
        actor_role: 'user',
        action: 'renew_order',
        entity_type: 'order',
        entity_id: newOrder.id,
        description: `Khách hàng gia hạn ${order.product_name} (${order.plan_label}) bằng Ví số dư. Mã đơn mới: #${newPaymentCode}`,
      } as any) as any);

      toast.success('🎉 Gia hạn dịch vụ thành công! Đơn hàng đang được xử lý.');
      if (onRenewalSuccess) onRenewalSuccess(newOrder.id);
      onClose();
    } catch (err: any) {
      console.error('Renewal wallet error:', err);
      toast.error(err.message || 'Gia hạn thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const getPolicyBanner = () => {
    switch (policy) {
      case 'fixed_farm':
        return (
          <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/30 p-3.5 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-200">
            <span className="text-base shrink-0">👑</span>
            <div className="min-w-0">
              <p className="font-extrabold text-[#2563EB] dark:text-[#35A8FF]">Gói VIP Cố định Farm (Không đổi nhóm)</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                Tài khoản của bạn sẽ được giữ nguyên và gia hạn tiếp nối thời hạn. Bạn không cần phải rời nhóm hay bấm link mời mới.
              </p>
            </div>
          </div>
        );
      case 'farm_rotation':
        return (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 p-3.5 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <span className="text-base shrink-0">⚡</span>
            <div className="min-w-0">
              <p className="font-extrabold text-amber-700 dark:text-amber-400">Gói Tiết Kiệm (Đổi nhóm mỗi tháng)</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                Sau khi thanh toán, hệ thống sẽ cấp Link mời vào nhóm Family mới để bạn tham gia tiếp tục sử dụng.
              </p>
            </div>
          </div>
        );
      default:
        return (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/30 p-3.5 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
            <span className="text-base shrink-0">🎁</span>
            <div className="min-w-0">
              <p className="font-extrabold text-emerald-700 dark:text-emerald-400">Cấp Tài Khoản Mới</p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                Sau khi thanh toán thành công, hệ thống sẽ bàn giao ngay 1 tài khoản mới tinh để bạn tiếp tục làm việc.
              </p>
            </div>
          </div>
        );
    }
  };

  // Dynamic VietQR string
  const qrUrl = getPaymentQrUrl(finalPrice, newPaymentCode);

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 overscroll-contain overflow-y-auto">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={onClose} />

      <div className="relative z-[100000] w-full max-w-md max-h-[88dvh] sm:max-h-[90dvh] my-auto flex flex-col overflow-hidden rounded-[24px] sm:rounded-[28px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C32] shadow-2xl animate-scale-up text-slate-900 dark:text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 p-4 sm:p-5 shrink-0 bg-white dark:bg-[#131C32]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#19A7FF]/20 to-[#2563EB]/20 border border-[#2563EB]/30 text-[#2563EB] dark:text-[#35A8FF] flex items-center justify-center text-lg shrink-0 font-bold">
              🔄
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-black text-slate-900 dark:text-white truncate">Gia hạn / Mua tiếp dịch vụ</h3>
              <p className="text-xs font-mono text-slate-400 mt-0.5 truncate">Đơn gốc: #{order.payment_code}</p>
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

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Product & Price Card */}
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-[#18243E] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white">{order.product_name}</h4>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 block">Gói: {order.plan_label}</span>
              </div>
            </div>

            <div className="border-t border-slate-200/60 dark:border-slate-700/60 pt-2.5 space-y-1.5 text-xs">
              <div className="flex justify-between pt-1 items-baseline">
                <span className="text-slate-400 font-semibold">Tổng thanh toán gia hạn:</span>
                <span className="text-lg font-black text-[#2563EB] dark:text-[#35A8FF]">
                  {finalPrice.toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>
          </div>

          {/* Coupon Input */}
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-[#18243E] p-4 space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Mã giảm giá
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Nhập mã giảm giá..."
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                className="w-full flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] uppercase font-bold placeholder:font-normal placeholder:normal-case"
                disabled={couponLoading || !!appliedCoupon}
              />
              {!appliedCoupon ? (
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={couponLoading || !couponInput.trim()}
                  className="rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 px-4 py-2.5 text-xs font-bold text-white transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                >
                  {couponLoading ? 'Đang kiểm tra...' : 'Áp dụng'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponInput('');
                  }}
                  className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/50 px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 transition shrink-0 cursor-pointer"
                >
                  Gỡ bỏ
                </button>
              )}
            </div>
            
            {couponError && (
              <p className="text-[11px] font-medium text-red-500 flex items-center gap-1">
                <span>⚠️</span> {couponError}
              </p>
            )}
            
            {appliedCoupon && (
              <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span>✓</span> Đã giảm {(appliedCoupon.discount_amount || 0).toLocaleString('vi-VN')}đ
              </p>
            )}
          </div>

          {/* Policy Banner */}
          {getPolicyBanner()}

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Chọn phương thức thanh toán:
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Option 1: Wallet */}
              <button
                type="button"
                onClick={() => setPaymentMethod('wallet')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  paymentMethod === 'wallet'
                    ? 'border-[#2563EB] bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-[#2563EB]/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#18243E] hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">💰</span>
                  <span className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    paymentMethod === 'wallet' ? 'border-[#2563EB] bg-[#2563EB]' : 'border-slate-300'
                  }`}>
                    {paymentMethod === 'wallet' && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Số dư ví BOW</span>
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold block mt-0.5">
                    {loadingBalance ? 'Đang tải...' : `${userBalance.toLocaleString('vi-VN')}đ`}
                  </span>
                </div>
              </button>

              {/* Option 2: VietQR Banking */}
              <button
                type="button"
                onClick={() => setPaymentMethod('banking')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  paymentMethod === 'banking'
                    ? 'border-[#2563EB] bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-[#2563EB]/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#18243E] hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base">📲</span>
                  <span className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    paymentMethod === 'banking' ? 'border-[#2563EB] bg-[#2563EB]' : 'border-slate-300'
                  }`}>
                    {paymentMethod === 'banking' && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">Quét mã QR Ngân hàng</span>
                  <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">{BANK_CONFIG.bankName} / SePay</span>
                </div>
              </button>
            </div>
          </div>

          {/* Banking VietQR details if selected */}
          {paymentMethod === 'banking' && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 text-center space-y-3 animate-fade-in">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Mở ứng dụng ngân hàng và quét mã QR bên dưới để thanh toán tự động:
              </p>

              <div className="relative inline-block mx-auto p-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <img
                  src={qrUrl}
                  alt="VietQR Gia hạn"
                  className="w-48 h-48 sm:w-52 sm:h-52 object-contain rounded-xl mx-auto"
                />
              </div>

              <div className="text-xs space-y-1 bg-white/70 dark:bg-[#18243E]/70 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Số tiền:</span>
                  <span className="font-bold text-[#2563EB] dark:text-[#35A8FF]">{finalPrice.toLocaleString('vi-VN')}đ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Nội dung CK:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{newPaymentCode}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-[#18243E]/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer disabled:opacity-50"
          >
            Hủy
          </button>

          {paymentMethod === 'wallet' ? (
            <button
              type="button"
              onClick={handleWalletRenewal}
              disabled={submitting || userBalance < finalPrice}
              className="flex-1 rounded-full bg-gradient-to-r from-[#19A7FF] to-[#2563EB] hover:from-[#19A7FF] hover:to-[#1D4ED8] py-2.5 text-xs font-black text-white shadow-md disabled:opacity-50 transition hover:scale-102 active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <span>Xác nhận trừ ví</span>
                  <span>⚡</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                toast.info('Hệ thống đang tự động lắng nghe thanh toán từ ngân hàng qua SePay...');
                onClose();
              }}
              className="flex-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 py-2.5 text-xs font-black text-white shadow-md transition cursor-pointer"
            >
              Đã chuyển khoản ✓
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
