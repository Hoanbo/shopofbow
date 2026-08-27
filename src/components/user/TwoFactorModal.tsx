import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { CloseIcon, ShieldIcon, CheckIcon } from '../icons';
import { useToast } from '../Toast';
import { generateNewBackupCodes, type BackupCodeItem } from '../../utils/backupCodes';

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TwoFactorModal({ isOpen, onClose, onSuccess }: TwoFactorModalProps) {
  const { session } = useAuth();
  const [step, setStep] = useState<'loading' | 'qr' | 'backup' | 'error'>('loading');
  const [factorId, setFactorId] = useState<string>('');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [backupCodes, setBackupCodes] = useState<BackupCodeItem[]>([]);
  const toast = useToast();

  useEffect(() => {
    if (!isOpen) {
      setStep('loading');
      setFactorId('');
      setQrCode('');
      setSecret('');
      setCode('');
      setError(null);
      setBusy(false);
      return;
    }

    const initEnroll = async () => {
      setStep('loading');
      setError(null);
      try {
        // 1. Enroll TOTP factor
        const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'BOW Authenticator',
        });

        if (enrollErr) throw enrollErr;

        if (data && data.totp) {
          setFactorId(data.id);
          const rawQr = data.totp.qr_code;
          // Format QR code image URL / SVG data URI
          const qrSrc = rawQr.startsWith('data:')
            ? rawQr
            : `data:image/svg+xml;utf-8,${encodeURIComponent(rawQr)}`;
          setQrCode(qrSrc);
          setSecret(data.totp.secret || '');
          setStep('qr');
        } else {
          throw new Error('Không thể khởi tạo mã QR xác thực.');
        }
      } catch (err: any) {
        console.error('MFA Enroll error:', err);
        setError(err.message || 'Có lỗi xảy ra khi tạo khóa bảo mật 2FA.');
        setStep('error');
      }
    };

    initEnroll();
  }, [isOpen]);

  const handleCopySecret = () => {
    if (!secret) return;
    navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    toast.success('Đã sao chép khóa bí mật!');
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.trim().length < 6) {
      setError('Vui lòng nhập đủ 6 chữ số từ ứng dụng Authenticator.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      // Challenge & Verify
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeErr) throw challengeErr;

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: code.trim(),
      });
      if (verifyErr) throw verifyErr;

      // Generate 10 standard single-use backup codes
      if (session?.user?.id) {
        const generatedBackup = generateNewBackupCodes(session.user.id);
        setBackupCodes(generatedBackup);
      }

      toast.success('Kích hoạt Xác thực 2 lớp (2FA) thành công!');
      setStep('backup');
    } catch (err: any) {
      console.error('MFA Verify error:', err);
      setError('Mã xác thực không chính xác hoặc đã hết hạn. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyBackupCodes = () => {
    if (backupCodes.length === 0) return;
    const text = backupCodes.map((c) => c.code).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedBackup(true);
    toast.success('Đã sao chép 10 mã dự phòng!');
    setTimeout(() => setCopiedBackup(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (backupCodes.length === 0) return;
    const textContent = `MÃ SAO LƯU DỰ PHÒNG 2FA - SHOP OF BOW\nTài khoản: ${session?.user?.email}\nNgày tạo: ${new Date().toLocaleString('vi-VN')}\n\nDANH SÁCH 10 MÃ DỰ PHÒNG (MỖI MÃ DÙNG 1 LẦN DUY NHẤT):\n${backupCodes
      .map((c, i) => `${i + 1}. ${c.code}`)
      .join('\n')}\n\n* Lưu ý quan trọng: Mỗi mã chỉ có thể sử dụng 1 lần duy nhất khi bạn mất điện thoại hoặc không thể mở Google Authenticator.`;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BOW_2FA_Backup_Codes_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Đã tải file mã dự phòng về máy!');
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto transform rounded-[28px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131D33] p-6 shadow-2xl transition-all sm:p-8 animate-fade-up">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
        >
          <CloseIcon className="h-4.5 w-4.5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-[#2563EB] dark:text-[#35A8FF]">
            <ShieldIcon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-[#0F172A] dark:text-white">
              Kích hoạt Xác thực 2 lớp (2FA)
            </h3>
            <p className="text-xs font-semibold text-slate-400">
              Bảo vệ tài khoản bằng Google Authenticator hoặc Authy
            </p>
          </div>
        </div>

        {/* State: Loading */}
        {step === 'loading' && (
          <div className="py-12 text-center space-y-3">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-blue-100 border-t-[#2563EB]" />
            <p className="text-xs font-semibold text-slate-400">Đang khởi tạo mã bảo mật...</p>
          </div>
        )}

        {/* State: Error */}
        {step === 'error' && (
          <div className="py-8 text-center space-y-4">
            <span className="text-4xl block">⚠️</span>
            <p className="text-sm font-semibold text-rose-500">{error}</p>
            <button
              onClick={onClose}
              className="rounded-full bg-slate-100 dark:bg-slate-800 px-6 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
            >
              Đóng lại
            </button>
          </div>
        )}

        {/* State: QR Code */}
        {step === 'qr' && (
          <div className="mt-6 space-y-5 animate-fade-up">
            {/* Step 1: Scan QR */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Bước 1: Quét mã QR bằng Google Authenticator
              </label>

              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 dark:border-slate-800 bg-white p-4 shadow-xs">
                {qrCode ? (
                  <img
                    src={qrCode}
                    alt="2FA QR Code"
                    className="h-44 w-44 rounded-xl object-contain"
                  />
                ) : (
                  <div className="h-44 w-44 animate-pulse rounded-xl bg-slate-100" />
                )}
              </div>
            </div>

            {/* Step 2: Secret Code Manual Entry */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Bước 2: Hoặc nhập mã khóa bí mật thủ công
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={secret}
                  className="w-full font-mono text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2.5 text-[#0F172A] dark:text-white outline-none select-all"
                />
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="shrink-0 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80 px-3.5 py-2.5 text-xs font-bold text-[#2563EB] dark:text-[#38BDF8] hover:bg-blue-100 transition cursor-pointer"
                >
                  {copiedSecret ? '✓ Đã chép' : 'Sao chép'}
                </button>
              </div>
            </div>

            {/* Step 3: Verify OTP */}
            <form onSubmit={handleVerify} className="space-y-3 pt-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Bước 3: Nhập mã 6 chữ số từ ứng dụng Authenticator
              </label>
              <input
                type="text"
                maxLength={6}
                autoFocus
                placeholder="000 000"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ''));
                  if (error) setError(null);
                }}
                className="w-full text-center tracking-[0.4em] font-mono text-xl font-black rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-3 text-[#0F172A] dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-500/10 transition outline-none"
              />

              {error && (
                <p className="text-xs font-semibold text-rose-500 text-center animate-shake">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || code.length < 6}
                className="w-full rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-3 text-sm font-bold text-white shadow-md hover:from-[#0080E0] hover:to-[#1D4ED8] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {busy ? 'Đang xác thực...' : 'Xác nhận & Hoàn tất kích hoạt'}
              </button>
            </form>
          </div>
        )}

        {/* State: Backup Codes after success */}
        {step === 'backup' && (
          <div className="mt-6 space-y-5 animate-fade-up">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                <CheckIcon className="h-7 w-7" />
              </div>
              <h4 className="text-base font-black text-[#0F172A] dark:text-white">
                2FA đã được kích hoạt thành công!
              </h4>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Dưới đây là <strong>10 mã dự phòng cứu hộ</strong>. Hãy sao chép hoặc tải file .TXT về máy ngay bây giờ. Mỗi mã chỉ dùng được 1 lần duy nhất khi bạn mất điện thoại.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-center font-mono text-xs font-black text-slate-800 dark:text-slate-200">
                {backupCodes.map((item, i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 py-2 px-2.5 rounded-xl text-[#2563EB] dark:text-[#38BDF8] tracking-wider">
                    {item.code}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyBackupCodes}
                  className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
                >
                  {copiedBackup ? '✓ Đã sao chép' : '📋 Sao chép 10 mã'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
                >
                  📥 Tải file .TXT
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFinish}
              className="w-full rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-3 text-sm font-bold text-white shadow-md hover:from-[#0080E0] hover:to-[#1D4ED8] transition cursor-pointer"
            >
              Tôi đã lưu mã an toàn & Đóng lại
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
