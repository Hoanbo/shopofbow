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
  const [activeTab, setActiveTab] = useState<'qr' | 'secret'>('qr');
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
      setActiveTab('qr');
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
        const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'BOW Authenticator',
        });

        if (enrollErr) throw enrollErr;

        if (data && data.totp) {
          setFactorId(data.id);
          const rawQr = data.totp.qr_code;
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

      if (session?.user?.id) {
        const generatedBackup = generateNewBackupCodes(session.user.id);
        setBackupCodes(generatedBackup);
      }

      toast.success('Kích hoạt 2FA thành công!');
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
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Container */}
      <div className="relative z-10 flex flex-col w-full sm:max-w-md max-h-[92dvh] sm:max-h-[88dvh] rounded-t-[28px] sm:rounded-[28px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131D33] shadow-2xl overflow-hidden transition-all animate-slide-up sm:animate-fade-up">
        
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800/80 shrink-0 bg-white/95 dark:bg-[#131D33]/95 backdrop-blur-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-[#35A8FF]">
              <ShieldIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-[#0F172A] dark:text-white leading-tight">
                Xác thực 2 lớp (2FA)
              </h3>
              <p className="text-[11px] font-medium text-slate-400">
                Google Authenticator / Authy
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
            aria-label="Đóng"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* State: Loading */}
          {step === 'loading' && (
            <div className="py-12 text-center space-y-3">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-blue-100 border-t-[#2563EB]" />
              <p className="text-xs font-semibold text-slate-400">Đang khởi tạo mã bảo mật...</p>
            </div>
          )}

          {/* State: Error */}
          {step === 'error' && (
            <div className="py-8 text-center space-y-3">
              <span className="text-3xl block">⚠️</span>
              <p className="text-xs font-semibold text-rose-500">{error}</p>
              <button
                onClick={onClose}
                className="rounded-full bg-slate-100 dark:bg-slate-800 px-5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
              >
                Đóng lại
              </button>
            </div>
          )}

          {/* State: Setup & Verify */}
          {step === 'qr' && (
            <div className="space-y-4">
              {/* Method Tabs: QR Code vs Manual Key */}
              <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('qr')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                    activeTab === 'qr'
                      ? 'bg-white dark:bg-[#18243E] text-[#2563EB] dark:text-[#38BDF8] shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                  }`}
                >
                  📷 Quét mã QR
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('secret')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                    activeTab === 'secret'
                      ? 'bg-white dark:bg-[#18243E] text-[#2563EB] dark:text-[#38BDF8] shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                  }`}
                >
                  🔑 Khóa bí mật (Thủ công)
                </button>
              </div>

              {/* Tab 1: QR Code View */}
              {activeTab === 'qr' ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-3 shadow-xs">
                  {qrCode ? (
                    <img
                      src={qrCode}
                      alt="2FA QR Code"
                      className="h-36 w-36 sm:h-40 sm:w-40 rounded-xl object-contain bg-white p-1"
                    />
                  ) : (
                    <div className="h-36 w-36 sm:h-40 sm:w-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
                  )}
                  <p className="text-[11px] font-medium text-slate-400 mt-2 text-center">
                    Mở <strong>Google Authenticator</strong> hoặc <strong>Authy</strong> để quét mã.
                  </p>
                </div>
              ) : (
                /* Tab 2: Secret Key Copy View */
                <div className="space-y-2 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3.5">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Nếu bạn đang dùng điện thoại, sao chép khóa này và dán vào Authenticator (chọn <em>"Nhập khóa thiết lập"</em>):
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={secret}
                      className="w-full font-mono text-[11px] font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-[#0F172A] dark:text-white outline-none select-all truncate"
                    />
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="shrink-0 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs font-bold text-[#2563EB] dark:text-[#38BDF8] hover:bg-blue-100 transition cursor-pointer"
                    >
                      {copiedSecret ? '✓ Đã chép' : 'Sao chép'}
                    </button>
                  </div>
                </div>
              )}

              {/* Verify OTP Form */}
              <form onSubmit={handleVerify} className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <label className="block text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Nhập mã 6 chữ số từ ứng dụng
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
                    className="w-full text-center tracking-[0.35em] font-mono text-xl font-black rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/80 py-2.5 text-[#0F172A] dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-[#2563EB] focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition outline-none"
                  />
                </div>

                {error && (
                  <p className="text-xs font-semibold text-rose-500 text-center animate-shake">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy || code.length < 6}
                  className="w-full rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:from-[#0080E0] hover:to-[#1D4ED8] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {busy ? 'Đang xác thực...' : 'Xác nhận & Hoàn tất kích hoạt'}
                </button>
              </form>
            </div>
          )}

          {/* State: Backup Codes after success */}
          {step === 'backup' && (
            <div className="space-y-4 animate-fade-up">
              <div className="flex flex-col items-center text-center space-y-1.5">
                <div className="h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                  <CheckIcon className="h-6 w-6" />
                </div>
                <h4 className="text-sm sm:text-base font-black text-[#0F172A] dark:text-white">
                  2FA đã kích hoạt thành công!
                </h4>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Hãy lưu lại <strong>10 mã dự phòng</strong> này để đăng nhập khi không có điện thoại (mỗi mã dùng 1 lần):
                </p>
              </div>

              <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-1.5 text-center font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                  {backupCodes.map((item, i) => (
                    <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 py-1.5 px-2 rounded-lg text-[#2563EB] dark:text-[#38BDF8] tracking-wider">
                      {item.code}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyBackupCodes}
                    className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition cursor-pointer"
                  >
                    {copiedBackup ? '✓ Đã sao chép' : '📋 Sao chép 10 mã'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadTxt}
                    className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
                  >
                    📥 Tải file .TXT
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleFinish}
                className="w-full rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:from-[#0080E0] hover:to-[#1D4ED8] transition cursor-pointer"
              >
                Tôi đã lưu mã an toàn & Đóng lại
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
