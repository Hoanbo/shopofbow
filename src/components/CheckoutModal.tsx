import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { CloseIcon, CheckIcon } from './icons';
import type { CatalogItem } from '../data/types';

interface Plan {
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
  const { session, balance, refreshBalance } = useAuth();
  const [method, setMethod] = useState<'wallet' | 'vietqr'>('vietqr');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState<'checkout' | 'payment' | 'success'>('checkout');
  const [paymentCode, setPaymentCode] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false); // chống double-submit

  const totalPrice = plan.price * quantity;



  // Generate a unique payment code when modal opens.
  // KHÔNG đặt balance vào dependency array — balance thay đổi sau refreshBalance
  // sẽ không reset lại step về 'checkout'.
  useEffect(() => {
    if (isOpen) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      setPaymentCode(`BOW${Date.now().toString().slice(-5)}${rand}`);
      setStep('checkout');
      setError(null);
      setNotes('');
      setQuantity(1);
      setOrderId(null);
      // Chọn method tốt nhất tại thời điểm mở — chỉ chạy 1 lần khi isOpen thay đổi
      setMethod(balance >= plan.price ? 'wallet' : 'vietqr');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // ← CHỈ isOpen, KHÔNG balance/plan.price để tránh reset step sau refreshBalance

  // Auto-switch method sang vietqr khi số dư ví không đủ
  useEffect(() => {
    if (method === 'wallet' && balance < totalPrice) {
      setMethod('vietqr');
    }
  }, [totalPrice, balance, method]);

  // Ở bước thanh toán QR: theo dõi realtime đơn hàng.
  // Khi SePay xác nhận (status -> 'pending_delivery'), tự chuyển sang màn thành công.
  // Kèm fallback poll mỗi 5s phòng khi Realtime chưa bật cho bảng orders.
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

  const handleWalletPayment = async () => {
    console.log('1. Click Thanh toán bằng ví');
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setLoading(true);
    try {
      console.log('2. Calling buy_with_wallet RPC');
      const { data, error: rpcErr } = await (supabase as any).rpc('buy_with_wallet', {
        p_user_id: session.user.id,
        p_product_name: quantity > 1 ? `${item.name} (x${quantity})` : item.name,
        p_plan_label: plan.label,
        p_price: totalPrice,
        p_payment_code: paymentCode,
        p_notes: notes.trim(),
        p_product_id: item.id.length === 36 ? item.id : undefined,
        p_quantity: quantity,
      });

      console.log('3. RPC result:', { data, rpcErr });

      if (rpcErr) throw rpcErr;
      if (data === 'success') {
        console.log('4. Preparing success — calling onWalletSuccess');
        // Lưu trước khi refreshBalance làm balance thay đổi
        const paidAmount = totalPrice;
        const paidQty = quantity;
        const paidCode = paymentCode;

        // Refresh balance trước khi đóng modal
        await refreshBalance();

        console.log('5. refreshBalance done, calling onWalletSuccess + onClose');
        // Gọi callback — parent render WalletSuccessModal độc lập hoàn toàn
        onWalletSuccess({ code: paidCode, amount: paidAmount, qty: paidQty });
        // Đóng modal thanh toán
        onClose();
      } else if (data === 'insufficient_balance') {
        throw new Error('Số dư ví không đủ. Vui lòng nạp thêm hoặc giảm số lượng.');
      } else if (data === 'unauthorized') {
        throw new Error('Thao tác không được phép (Unauthorized).');
      } else {
        throw new Error('Giao dịch thất bại. Vui lòng thử lại.');
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

  const handleExternalPayment = async () => {
    setError(null);
    setLoading(true);
    try {
      // Insert order with status 'pending_payment' và lấy về id để theo dõi realtime
      const { data: inserted, error: insErr } = await (supabase.from('orders') as any)
        .insert({
          user_id: session.user.id,
          product_name: quantity > 1 ? `${item.name} (x${quantity})` : item.name,
          plan_label: plan.label,
          price: totalPrice,
          status: 'pending_payment',
          payment_code: paymentCode,
          notes: notes.trim(),
        })
        .select('id')
        .single();

      if (insErr) throw insErr;
      setOrderId(inserted?.id ?? null);
      setStep('payment');
    } catch (err: any) {
      setError(err?.message || err?.details || 'Lỗi tạo đơn hàng thanh toán.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || submittingRef.current) return; // chống double-submit
    if (method === 'wallet') {
      handleWalletPayment();
    } else {
      handleExternalPayment();
    }
  };

  // Generate VietQR URL (dùng totalPrice tính cả số lượng)
  const vietQrUrl = `https://img.vietqr.io/image/${BANK_CONFIG.bankId}-${BANK_CONFIG.accountNo}-compact2.jpg?amount=${totalPrice}&addInfo=${paymentCode}&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}`;

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
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white transition"
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
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Đơn hàng của bạn</span>
              <div className="mt-2 flex items-center gap-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3.5 border border-slate-100 dark:border-slate-800">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1">
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
                      {plan.price.toLocaleString('vi-VN')}đ / cái
                    </p>
                  )}
                  <span className="text-sm font-black text-[#2563EB] dark:text-[#35A8FF]">
                    {totalPrice.toLocaleString('vi-VN')}đ
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
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition font-bold text-sm"
                  >−</button>
                  <span className="w-8 text-center text-sm font-black text-[#0F172A] dark:text-white">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(q => Math.min(10, q + 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition font-bold text-sm"
                  >+</button>
                </div>
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
                  onClick={() => balance >= totalPrice && setMethod('wallet')}
                  disabled={balance < totalPrice}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all ${
                    balance < totalPrice
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
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all ${
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
              {balance < totalPrice && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  <span>⚠️</span>
                  <span>Số dư ví ({balance.toLocaleString('vi-VN')}đ) không đủ để thanh toán {totalPrice.toLocaleString('vi-VN')}đ. Vui lòng nạp thêm hoặc đổi phương thức thanh toán khác.</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || submittingRef.current || (method === 'wallet' && balance < totalPrice)}
              className="w-full rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-3 text-sm font-bold text-white shadow-md transition-all duration-300 hover:from-[#0080E0] hover:to-[#1D4ED8] disabled:opacity-60"
            >
              {loading
                ? (method === 'wallet' ? 'Đang thanh toán...' : 'Đang tạo đơn hàng...')
                : method === 'wallet'
                  ? `Thanh toán ${totalPrice.toLocaleString('vi-VN')}đ bằng ví`
                  : 'Lấy mã QR thanh toán'
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
                Vui lòng quét mã QR bên dưới để thanh toán số tiền {plan.price.toLocaleString('vi-VN')}đ.
              </p>
            </div>

            {/* QR Code */}
            <div className="mx-auto flex max-w-[200px] flex-col items-center rounded-2xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 shadow-xs">
              <img src={vietQrUrl} alt="VietQR SePay" className="h-full w-full object-contain rounded-xl" />
            </div>

            {/* Payment Details */}
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-4 text-left text-xs space-y-2 text-[#0F172A] dark:text-white">
              <div className="flex justify-between font-medium">
                <span className="text-slate-500 dark:text-slate-400">Ngân hàng thụ hưởng:</span>
                <span className="font-extrabold">MB Bank</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-500 dark:text-slate-400">Số tài khoản:</span>
                <span className="font-extrabold">{BANK_CONFIG.accountNo}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-500 dark:text-slate-400">Chủ tài khoản:</span>
                <span className="font-extrabold">{BANK_CONFIG.accountName}</span>
              </div>
              <div className="flex justify-between font-medium text-blue-600 dark:text-blue-400">
                <span className="font-bold text-slate-500 dark:text-slate-400">Nội dung (BẮT BUỘC CHÍNH XÁC):</span>
                <span className="font-black text-sm bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-md dark:text-[#35A8FF]">{paymentCode}</span>
              </div>
            </div>

            <div className="rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900/50 p-3 text-xs text-sky-700 dark:text-sky-300 font-semibold leading-relaxed">
              👉 Sau khi bạn chuyển khoản đúng nội dung và số tiền, hệ thống SePay sẽ tự động xác nhận và duyệt đơn trong 10s - 30s. Màn hình sẽ tự chuyển khi thanh toán thành công — vui lòng không đóng cửa sổ này.
            </div>

            {/* Trạng thái chờ xác nhận tự động */}
            <div className="flex items-center justify-center gap-2.5 rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 py-2.5 text-xs font-bold text-amber-600 dark:text-amber-400">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-300 dark:border-amber-700 border-t-amber-600 dark:border-t-amber-400" />
              Đang chờ xác nhận thanh toán tự động…
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 text-xs font-bold text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full bg-slate-100 dark:bg-slate-800/80 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Đóng (đơn vẫn được lưu)
              </button>
            </div>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 leading-relaxed">
              Bạn có thể đóng cửa sổ và theo dõi trạng thái trong mục <strong>Đơn hàng của tôi</strong>. Đơn sẽ tự cập nhật khi nhận được thanh toán.
            </p>
          </div>
        )}

        {/* STEP 3: SUCCESS BLOCK — Đồng bộ chuẩn với Ảnh 2 */}
        {step === 'success' && (
          <div className="text-center space-y-5 py-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
              <CheckIcon className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#0F172A] dark:text-white">Đặt hàng thành công!</h3>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-400 mt-1">Mã đơn hàng: {paymentCode}</p>
              <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
                Cảm ơn bạn đã tin tưởng BOW. Đơn hàng đã được chuyển sang trạng thái <strong>Chờ bàn giao</strong>. Admin sẽ thiết lập tài khoản và gửi thông tin qua email/mục đơn hàng của bạn trong vòng 5 - 15 phút.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full bg-[#0F172A] dark:bg-blue-600 py-3 text-sm font-bold text-white hover:bg-black dark:hover:bg-blue-700 transition"
            >
              Đóng và tiếp tục mua sắm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
