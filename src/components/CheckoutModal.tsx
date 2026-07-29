import { useState, useEffect } from 'react';
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
}

const BANK_CONFIG = {
  bankId: 'BIDV', // BIDV
  accountNo: '4330700679',
  accountName: 'NGUYEN VAN HOANG',
};

export default function CheckoutModal({ isOpen, onClose, item, plan }: Props) {
  const { session, balance, refreshBalance } = useAuth();
  const [method, setMethod] = useState<'wallet' | 'vietqr'>('vietqr');
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState<'checkout' | 'payment' | 'success'>('checkout');
  const [paymentCode, setPaymentCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Generate a unique payment code when modal opens
  useEffect(() => {
    if (isOpen) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      setPaymentCode(`BOW${Date.now().toString().slice(-5)}${rand}`);
      setStep('checkout');
      setError(null);
      setNotes('');
      setMethod(balance >= plan.price ? 'wallet' : 'vietqr');
    }
  }, [isOpen, plan.price, balance]);

  if (!isOpen || !session) return null;

  const handleWalletPayment = async () => {
    setError(null);
    setLoading(true);
    try {
      // Call Postgres rpc function securely
      const { data, error: rpcErr } = await (supabase as any).rpc('buy_with_wallet', {
        p_user_id: session.user.id,
        p_product_name: item.name,
        p_plan_label: plan.label,
        p_price: plan.price,
        p_payment_code: paymentCode,
        p_notes: notes.trim()
      });

      if (rpcErr) throw rpcErr;
      if (data === 'success') {
        await refreshBalance();
        setStep('success');
      } else {
        throw new Error('Giao dịch thất bại. Vui lòng thử lại.');
      }
    } catch (err: any) {
      setError(err?.message || err?.details || 'Lỗi kết nối trừ tiền ví.');
    } finally {
      setLoading(false);
    }
  };

  const handleExternalPayment = async () => {
    setError(null);
    setLoading(true);
    try {
      // Insert order with status 'pending_payment'
      const { error: insErr } = await (supabase.from('orders') as any).insert({
        user_id: session.user.id,
        product_name: item.name,
        plan_label: plan.label,
        price: plan.price,
        status: 'pending_payment',
        payment_code: paymentCode,
        notes: notes.trim()
      });

      if (insErr) throw insErr;
      setStep('payment');
    } catch (err: any) {
      setError(err?.message || err?.details || 'Lỗi tạo đơn hàng thanh toán.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (method === 'wallet') {
      handleWalletPayment();
    } else {
      handleExternalPayment();
    }
  };

  // Generate VietQR URL
  const vietQrUrl = `https://img.vietqr.io/image/${BANK_CONFIG.bankId}-${BANK_CONFIG.accountNo}-compact2.jpg?amount=${plan.price}&addInfo=${paymentCode}&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}`;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg transform overflow-hidden rounded-[28px] border border-slate-100 bg-white p-6 shadow-2xl transition-all sm:p-8 animate-fade-up">
        {/* Close Button */}
        {step !== 'success' && (
          <button
            onClick={onClose}
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
          >
            <CloseIcon className="h-4.5 w-4.5" />
          </button>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-center text-xs font-semibold text-red-600">
            {error}
          </div>
        )}

        {/* STEP 1: CHECKOUT INFO FORM */}
        {step === 'checkout' && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Đơn hàng của bạn</span>
              <div className="mt-2 flex items-center gap-3.5 rounded-2xl bg-slate-50 p-3.5 border border-slate-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-slate-200 p-1">
                  <img src={item.image} alt={item.name} className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-extrabold text-[#0F172A] truncate">{item.name}</h4>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">
                    Gói {plan.label} ({plan.duration})
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-[#2563EB]">
                    {plan.price.toLocaleString('vi-VN')}đ
                  </span>
                </div>
              </div>
            </div>

            {/* Notes field optional */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Ghi chú cho người bán (Ví dụ: Email nhận tài khoản, SĐT...)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nhập email kích hoạt hoặc yêu cầu đặc biệt (không bắt buộc)"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 text-[#0F172A]"
              />
            </div>

            {/* Payment Method Selector */}
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Chọn phương thức thanh toán
              </span>
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Wallet Balance */}
                <button
                  type="button"
                  onClick={() => setMethod('wallet')}
                  disabled={balance < plan.price}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all ${method === 'wallet'
                    ? 'border-[#2563EB] bg-[#EEF6FF] text-[#2563EB] ring-2 ring-blue-500/10'
                    : 'border-slate-200 bg-white hover:border-blue-300 disabled:opacity-40 disabled:hover:border-slate-200'
                    }`}
                >
                  <span className="text-xl">💳</span>
                  <span className="text-xs font-extrabold text-[#0F172A]">Số dư ví</span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    ({balance.toLocaleString('vi-VN')}đ)
                  </span>
                </button>

                {/* VietQR */}
                <button
                  type="button"
                  onClick={() => setMethod('vietqr')}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition-all ${method === 'vietqr'
                    ? 'border-[#2563EB] bg-[#EEF6FF] text-[#2563EB] ring-2 ring-blue-500/10'
                    : 'border-slate-200 bg-white hover:border-blue-300'
                    }`}
                >
                  <span className="text-xl">🏦</span>
                  <span className="text-xs font-extrabold text-[#0F172A]">Ngân hàng</span>
                  <span className="text-[10px] font-semibold text-slate-400">VietQR SePay</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-3 text-sm font-bold text-white shadow-md transition-all duration-300 hover:from-[#0080E0] hover:to-[#1D4ED8] disabled:opacity-60"
            >
              {loading ? 'Đang tạo đơn hàng...' : method === 'wallet' ? 'Thanh toán bằng ví' : 'Lấy mã QR thanh toán'}
            </button>
          </form>
        )}

        {/* STEP 2: EXTERNAL QR PAYMENT SHOWCASE */}
        {step === 'payment' && (
          <div className="text-center space-y-5">
            <div>
              <h3 className="text-lg font-black text-[#0F172A]">Thanh toán đơn hàng</h3>
              <p className="text-xs font-medium text-slate-500 mt-1">
                Vui lòng quét mã QR bên dưới để thanh toán số tiền {plan.price.toLocaleString('vi-VN')}đ.
              </p>
            </div>

            {/* QR Code */}
            <div className="mx-auto flex max-w-[200px] flex-col items-center rounded-2xl border border-slate-100 bg-slate-50 p-2 shadow-xs">
              <img src={vietQrUrl} alt="VietQR SePay" className="h-full w-full object-contain rounded-xl" />
            </div>

            {/* Payment Details */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-xs space-y-2 text-[#0F172A]">
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Ngân hàng thụ hưởng:</span>
                <span className="font-extrabold">{BANK_CONFIG.bankId} (MB Bank)</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Số tài khoản:</span>
                <span className="font-extrabold">{BANK_CONFIG.accountNo}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-slate-500">Chủ tài khoản:</span>
                <span className="font-extrabold">{BANK_CONFIG.accountName}</span>
              </div>
              <div className="flex justify-between font-medium text-blue-600">
                <span className="font-bold text-slate-500">Nội dung (BẮT BUỘC CHÍNH XÁC):</span>
                <span className="font-black text-sm bg-blue-100 px-2 py-0.5 rounded-md">{paymentCode}</span>
              </div>
            </div>

            <div className="rounded-xl bg-sky-50 border border-sky-100 p-3 text-xs text-sky-700 font-semibold leading-relaxed">
              👉 Hệ thống SePay sẽ quét biến động số dư và tự động duyệt đơn ngay lập tức (10s - 30s) sau khi bạn chuyển khoản đúng nội dung và số tiền.
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('checkout')}
                className="flex-1 rounded-full border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('success');
                }}
                className="flex-1 rounded-full bg-[#2563EB] py-2.5 text-xs font-bold text-white hover:bg-[#1D4ED8]"
              >
                Tôi đã chuyển khoản
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SUCCESS BLOCK */}
        {step === 'success' && (
          <div className="text-center space-y-5 py-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckIcon className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#0F172A]">Đặt hàng thành công!</h3>
              <p className="text-xs font-semibold text-slate-400 mt-1">Mã đơn hàng: {paymentCode}</p>
              <p className="mt-3 text-xs font-medium text-slate-500 leading-relaxed max-w-sm mx-auto">
                Cảm ơn bạn đã tin tưởng BOW. Đơn hàng đã được chuyển sang trạng thái **Chờ bàn giao**.
                Admin sẽ thiết lập tài khoản và gửi thông tin qua email/mục đơn hàng của bạn trong vòng 5 - 15 phút.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full bg-[#0F172A] py-3 text-sm font-bold text-white hover:bg-black"
            >
              Đóng và tiếp tục mua sắm
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
