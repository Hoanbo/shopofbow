import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import { BANK_CONFIG, getPaymentQrUrl } from '../../config/sepay';

interface AgentDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAmount?: number;
  onSuccess?: () => void;
}

export function AgentDepositModal({
  isOpen,
  onClose,
  initialAmount = 50000,
  onSuccess,
}: AgentDepositModalProps) {
  const { session, refreshBalance } = useAuth();
  const toast = useToast();

  const [amount, setAmount] = useState<number>(initialAmount >= 10000 ? initialAmount : 50000);
  const [depositCode, setDepositCode] = useState<string>('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [showQr, setShowQr] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      const validAmount = initialAmount >= 10000 ? initialAmount : 50000;
      setAmount(validAmount);
      setShowQr(false);
      setDepositCode('');
      setOrderId(null);
      setIsSuccess(false);
    } else {
      setShowQr(false);
      setDepositCode('');
      setOrderId(null);
      setIsSuccess(false);
    }
  }, [isOpen, initialAmount]);

  // Handle creating deposit order ONLY when user explicitly clicks "Tạo mã QR"
  const handleCreateOrder = async () => {
    if (!session?.user?.id) {
      toast.error('Vui lòng đăng nhập để nạp tiền vào ví.');
      return;
    }

    if (amount < 10000) {
      toast.error('Số tiền nạp tối thiểu là 10.000đ.');
      return;
    }

    setIsCreating(true);
    setIsSuccess(false);

    try {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const code = `BOWN${Date.now().toString().slice(-5)}${rand}`;

      const { data: inserted, error: insErr } = await (supabase.from('orders') as any)
        .insert({
          user_id: session.user.id,
          product_name: 'Nạp tiền vào ví',
          plan_label: 'Nạp số dư ví',
          price: amount,
          status: 'pending_payment',
          payment_code: code,
          notes: 'Nạp số dư ví tự động qua Agent VietQR',
        })
        .select('id')
        .single();

      if (insErr) throw insErr;

      setDepositCode(code);
      setOrderId(inserted?.id ?? null);
      setShowQr(true);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tạo mã nạp tiền lúc này.');
    } finally {
      setIsCreating(false);
    }
  };

  // Realtime & Polling listener for deposit completion
  useEffect(() => {
    if (!showQr || !orderId || isSuccess) return;

    let isSubscribed = true;

    // Poller fallback
    const interval = setInterval(async () => {
      if (!isSubscribed) return;
      try {
        const { data: orderData } = await supabase
          .from('orders')
          .select('status')
          .eq('id', orderId)
          .maybeSingle();

        if (orderData?.status === 'completed' && isSubscribed) {
          setIsSuccess(true);
          toast.success('🎉 Nạp tiền vào ví thành công!');
          if (refreshBalance) refreshBalance();
          if (onSuccess) onSuccess();
        }
      } catch {
        // silent polling
      }
    }, 2500);

    // Realtime channel
    const channel = supabase
      .channel(`deposit-modal-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload: any) => {
          if (payload.new?.status === 'completed' && isSubscribed) {
            setIsSuccess(true);
            toast.success('🎉 Nạp tiền vào ví thành công!');
            if (refreshBalance) refreshBalance();
            if (onSuccess) onSuccess();
          }
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [showQr, orderId, isSuccess, refreshBalance, onSuccess]);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${fieldName}!`);
  };

  if (!isOpen) return null;

  const vietQrUrl = getPaymentQrUrl(amount, depositCode);

  return (
    <div className="fixed inset-0 z-[100002] flex items-center justify-center p-3 sm:p-4 animate-fade-in text-left">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container — Compact & Balanced for both Desktop and Mobile */}
      <div className="relative w-full max-w-sm transform rounded-[24px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131B2E] p-4 sm:p-5 shadow-2xl transition-all animate-scale-up text-slate-900 dark:text-white max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-[#2563EB] dark:text-[#38BDF8] text-base font-black shadow-xs">
              💳
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                Nạp Tiền Vào Ví
              </h3>
              <p className="text-[10.5px] font-medium text-slate-400">
                Quét VietQR — Tự động cộng ví trong 30s
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        {isSuccess ? (
          <div className="py-6 text-center space-y-3.5 animate-fade-up">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 border border-emerald-200 dark:border-emerald-800 text-2xl font-bold shadow-lg shadow-emerald-500/20 animate-bounce">
              ✓
            </div>
            <div>
              <h4 className="text-base font-black text-emerald-600 dark:text-emerald-400">
                Nạp tiền thành công!
              </h4>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-300 mt-1">
                Số tiền <strong>+{amount.toLocaleString('vi-VN')}đ</strong> đã được cộng vào ví.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-2.5 text-xs font-black text-white shadow-md shadow-emerald-500/25 hover:opacity-95 active:scale-[0.98] transition cursor-pointer"
            >
              Tiếp tục mua hàng cùng BOW Agent
            </button>
          </div>
        ) : (
          <div className="space-y-3.5 pt-3">
            {/* STEP 1: Select/Input Amount (When QR is not created yet) */}
            {!showQr ? (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                    Nhập số tiền nạp (VNĐ):
                  </label>
                  <div className="relative">
                    <input
                      ref={amountInputRef}
                      type="number"
                      min={10000}
                      step={10000}
                      value={amount || ''}
                      onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                      placeholder="Ví dụ: 50000 (Tối thiểu 10.000đ)"
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1A263F] px-3 pr-8 text-xs font-extrabold outline-none transition focus:border-[#2563EB] text-[#0F172A] dark:text-white"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">đ</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                    Chọn nhanh mệnh giá:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[10000, 20000, 50000, 100000, 200000, 500000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAmount(amt)}
                        className={`rounded-xl border py-1.5 text-[11px] font-bold transition cursor-pointer ${
                          amount === amt
                            ? 'border-[#2563EB] bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-[#38BDF8] shadow-xs'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {amt >= 1000 ? `${amt / 1000}k` : `${amt}đ`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit button to generate QR */}
                <button
                  type="button"
                  onClick={handleCreateOrder}
                  disabled={isCreating || amount < 10000}
                  className="w-full mt-1 rounded-xl bg-gradient-to-r from-[#00A3FF] to-[#2563EB] hover:from-[#008AE0] hover:to-[#1D4ED8] disabled:opacity-50 py-2.5 text-xs font-black text-white shadow-md shadow-blue-500/25 active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>{isCreating ? '⏳ Đang tạo mã...' : '✨ Tạo mã QR thanh toán'}</span>
                  {!isCreating && <span>({amount.toLocaleString('vi-VN')}đ)</span>}
                </button>
              </div>
            ) : (
              /* STEP 2: VietQR Display & Payment Details */
              <div className="space-y-3 animate-fade-up">
                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#162035] p-3 space-y-3">
                  {/* Centered QR Image Box — Proportional size */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="relative w-44 h-44 sm:w-48 sm:h-48 rounded-xl bg-white p-2 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center">
                      <img
                        src={vietQrUrl}
                        alt="VietQR Deposit"
                        className="w-full h-full object-contain rounded-lg"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium mt-1.5 text-center">
                      Mở app ngân hàng quét mã VietQR tự động
                    </p>
                  </div>

                  {/* Payment Details */}
                  <div className="rounded-xl bg-white dark:bg-[#111726] border border-slate-200/70 dark:border-slate-700/60 p-2.5 space-y-2 text-[11px]">
                    {/* Bank Info */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Ngân hàng:</span>
                      <span className="font-bold text-[#0F172A] dark:text-white truncate">{BANK_CONFIG.bankName}</span>
                    </div>

                    {/* Account Number */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Số tài khoản:</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(BANK_CONFIG.accountNo, 'Số tài khoản')}
                        className="font-mono font-black text-[#2563EB] dark:text-[#38BDF8] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {BANK_CONFIG.accountNo}
                        <span className="text-[10px]">📋</span>
                      </button>
                    </div>

                    {/* Account Name */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Chủ TK:</span>
                      <span className="font-bold text-[#0F172A] dark:text-white truncate">
                        {BANK_CONFIG.accountName}
                      </span>
                    </div>

                    {/* Số tiền */}
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-1.5">
                      <span className="text-slate-400">Số tiền nạp:</span>
                      <span className="font-mono font-black text-[#2563EB] dark:text-[#38BDF8] text-xs">
                        {amount.toLocaleString('vi-VN')}đ
                      </span>
                    </div>

                    {/* Payment Code (Crucial) */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-amber-500 font-bold">Nội dung CK:</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(depositCode, 'Nội dung chuyển khoản')}
                        className="font-mono font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800 hover:bg-amber-100 flex items-center gap-1 cursor-pointer"
                      >
                        <span>{depositCode}</span>
                        <span className="text-[10px]">📋</span>
                      </button>
                    </div>
                  </div>

                  {/* Status indicator */}
                  <div className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 py-1.5 px-2.5 text-[10.5px] font-semibold text-[#2563EB] dark:text-[#38BDF8]">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping" />
                    <span>Đang đợi chuyển khoản... Cộng tiền tự động</span>
                  </div>
                </div>

                {/* Back / Change amount button */}
                <button
                  type="button"
                  onClick={() => setShowQr(false)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  ✏️ Đổi số tiền khác
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
