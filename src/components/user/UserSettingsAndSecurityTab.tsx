import { useState, useEffect, useCallback, useRef, type FormEvent, type ChangeEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../Toast';
import TwoFactorModal from './TwoFactorModal';
import { uploadImage } from '../../data/admin';
import {
  getBackupCodesStats,
  generateNewBackupCodes,
  clearBackupCodes,
  type BackupCodeItem,
} from '../../utils/backupCodes';
import {
  getUserDevices,
  removeDeviceSession,
  signOutOtherDevices,
  trackCurrentDevice,
  type UserDeviceRecord,
} from '../../services/deviceSession';

// ============================================================================
// SVG LINE ICONS (Chuẩn Vector Outline Mỏng, Tinh Tế, Đồng Bộ 100%)
// ============================================================================
function GoogleSvg({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
    </svg>
  );
}

function LinkSvg({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
    </svg>
  );
}

function ArrowPathSvg({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function ShieldCheckSvg({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function UserCircleSvg({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function LockClosedSvg({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function KeySvg({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  );
}

function DeviceDesktopSvg({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
    </svg>
  );
}

function DeviceMobileSvg({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  );
}

function CameraSvg({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  );
}

function CheckOutlineSvg({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function CloseSvg({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ArrowRightExitSvg({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  );
}

// ============================================================================
// CLIENT-SIDE IMAGE COMPRESSOR (Nén ảnh avatar tự động siêu nhẹ ~30-50KB)
// ============================================================================
async function compressAvatarImage(file: File, maxSize = 300): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Crop vuông tâm ảnh
        const minDim = Math.min(width, height);
        const startX = (width - minDim) / 2;
        const startY = (height - minDim) / 2;

        canvas.width = Math.min(minDim, maxSize);
        canvas.height = Math.min(minDim, maxSize);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], `avatar_${Date.now()}.webp`, {
                type: 'image/webp',
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/webp',
          0.85
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = (error) => reject(error);
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function UserSettingsAndSecurityTab() {
  const { session, profile, refreshProfile, isAdmin, isCtv } = useAuth();
  const toast = useToast();

  // ----------------------------------------------------
  // 1. STATE: PROFILE (Họ và Tên & Avatar Upload)
  // ----------------------------------------------------
  const [fullName, setFullName] = useState(profile?.full_name || session?.user?.user_metadata?.full_name || '');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const currentAvatarUrl = profile?.avatar_url || session?.user?.user_metadata?.avatar_url || null;

  useEffect(() => {
    if (profile?.full_name || session?.user?.user_metadata?.full_name) {
      setFullName(profile?.full_name || session?.user?.user_metadata?.full_name || '');
    }
  }, [profile?.full_name, session?.user?.user_metadata?.full_name]);

  const handleUpdateFullName = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;
    const trimmed = fullName.trim();
    if (!trimmed) {
      toast.error('Họ và tên không được để trống.');
      return;
    }

    setUpdatingProfile(true);
    try {
      const { error: authErr } = await supabase.auth.updateUser({
        data: { full_name: trimmed },
      });
      if (authErr) throw authErr;

      const { error: profileErr } = await (supabase.from('profiles') as any)
        .update({ full_name: trimmed, updated_at: new Date().toISOString() })
        .eq('id', session.user.id);
      if (profileErr) throw profileErr;

      toast.success('Đã cập nhật họ và tên thành công!');
      if (refreshProfile) refreshProfile();
    } catch (err: any) {
      console.error('Error updating full name:', err);
      toast.error(err.message || 'Không thể cập nhật tên. Vui lòng thử lại.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  // Helper upload avatar độc quyền theo UserID (Tự động ghi đè, không sinh file rác)
  const lastUploadTimeRef = useRef<number>(0);

  const handleAvatarFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.user?.id) return;

    // Reset input để có thể chọn lại cùng 1 file nếu muốn
    e.target.value = '';

    // 1. Chống Spam (Rate Limit: Tối thiểu 5s giữa 2 lần đổi ảnh)
    const now = Date.now();
    if (now - lastUploadTimeRef.current < 5000) {
      toast.info('Bạn thao tác quá nhanh. Vui lòng đợi vài giây rồi thử lại.');
      return;
    }

    // 2. Kiểm tra định dạng & Dung lượng file gốc (Tối đa 5MB)
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn một tệp hình ảnh hợp lệ (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 5MB.');
      return;
    }

    setUploadingAvatar(true);
    try {
      // 3. Nén ảnh tự động ngay trên client về WebP ~30KB
      const compressed = await compressAvatarImage(file, 300);

      // 4. Upload ghi đè (upsert: true) theo đúng path: avatars/{userId}.webp
      const filePath = `avatars/${session.user.id}.webp`;
      const { error: storageErr } = await supabase.storage.from('assets').upload(filePath, compressed, {
        cacheControl: '60',
        upsert: true, // LUÔN GHI ĐÈ FILE CŨ CỦA USER, KHÔNG TẠO FILE MỚI LÃNG PHÍ STORAGE
      });

      let publicUrl = '';
      if (!storageErr) {
        const { data } = supabase.storage.from('assets').getPublicUrl(filePath);
        publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      } else {
        // Fallback qua API upload nếu storage trực tiếp bị giới hạn RLS
        publicUrl = await uploadImage(compressed, 'avatars');
      }

      // 5. Cập nhật bảng profiles và user_metadata
      const { error: profileErr } = await (supabase.from('profiles') as any)
        .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', session.user.id);
      if (profileErr) throw profileErr;

      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      lastUploadTimeRef.current = Date.now();
      toast.success('Cập nhật ảnh đại diện thành công!');
      if (refreshProfile) refreshProfile();
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      toast.error(err.message || 'Không thể tải lên ảnh đại diện. Vui lòng thử lại.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ----------------------------------------------------
  // 2. STATE: 2FA & BACKUP CODES
  // ----------------------------------------------------
  const [mfaFactors, setMfaFactors] = useState<any[]>([]);
  const [loadingMfa, setLoadingMfa] = useState(true);
  const [show2FaModal, setShow2FaModal] = useState(false);

  // Backup codes security challenge
  const [showBackupPasswordChallenge, setShowBackupPasswordChallenge] = useState(false);
  const [backupActionType, setBackupActionType] = useState<'view' | 'regenerate' | 'disable'>('view');
  const [challengePassword, setChallengePassword] = useState('');
  const [challengeTotpCode, setChallengeTotpCode] = useState('');
  const [googleChallengeMethod, setGoogleChallengeMethod] = useState<'totp' | 'email'>('totp');
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [emailOtpCooldown, setEmailOtpCooldown] = useState(0);
  const [showChallengePassword, setShowChallengePassword] = useState(false);
  const [verifyingChallengePw, setVerifyingChallengePw] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  // Countdown timer cho OTP Email
  useEffect(() => {
    if (emailOtpCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailOtpCooldown]);

  // Backup codes modal
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  const [revealedBackupCodes, setRevealedBackupCodes] = useState<BackupCodeItem[]>([]);
  const [copiedBackupCodes, setCopiedBackupCodes] = useState(false);
  const [copiedSingleCode, setCopiedSingleCode] = useState<string | null>(null);
  const [showRegenerateConfirmModal, setShowRegenerateConfirmModal] = useState(false);

  // Backup codes statistics
  const [backupStats, setBackupStats] = useState<{ remaining: number; total: number; codes: BackupCodeItem[] }>({
    remaining: 10,
    total: 10,
    codes: [],
  });

  // ----------------------------------------------------
  // KIỂM TRA TRẠNG THÁI TÀI KHOẢN GOOGLE & MẬT KHẨU
  // ----------------------------------------------------
  const identities = session?.user?.identities || [];
  const isGoogleLinked =
    identities.some((i) => i.provider === 'google') ||
    session?.user?.app_metadata?.provider === 'google' ||
    session?.user?.app_metadata?.providers?.includes('google') ||
    false;

  const googleIdentity = identities.find((i) => i.provider === 'google');
  const googleEmail =
    googleIdentity?.identity_data?.email ||
    (session?.user?.app_metadata?.provider === 'google' ? session?.user?.email : null);

  const [hasCustomPassword, setHasCustomPassword] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    if (session?.user?.id && localStorage.getItem(`bow_has_pwd_${session.user.id}`) === 'true') {
      return true;
    }
    if (session?.user?.app_metadata?.provider === 'email') return true;
    if (session?.user?.user_metadata?.has_custom_password) return true;
    return false;
  });

  const [linkingGoogle, setLinkingGoogle] = useState(false);

  const handleLinkGoogleAccount = async () => {
    setLinkingGoogle(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard?tab=settings`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Error linking Google account:', err);
      toast.error(err.message || 'Không thể liên kết tài khoản Google.');
      setLinkingGoogle(false);
    }
  };

  const handleSendEmailOtp = async () => {
    if (!session?.user?.email) return;
    setSendingEmailOtp(true);
    setChallengeError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: session.user.email,
        options: {
          shouldCreateUser: false,
        },
      });
      if (error) throw error;
      toast.success(`Đã gửi mã xác nhận 6 số đến ${session.user.email}`);
      setEmailOtpCooldown(60);
    } catch (err: any) {
      console.error('Error sending OTP:', err);
      setChallengeError(err.message || 'Không thể gửi mã OTP về email. Vui lòng thử lại.');
    } finally {
      setSendingEmailOtp(false);
    }
  };

  const refreshBackupCodesStats = useCallback(() => {
    if (!session?.user?.id) return;
    const stats = getBackupCodesStats(session.user.id);
    setBackupStats(stats);
  }, [session?.user?.id]);

  const fetchMfaFactors = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoadingMfa(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (!error && data) {
        setMfaFactors(data.totp || []);
      }
      refreshBackupCodesStats();
    } catch (err) {
      console.warn('Error fetching MFA factors:', err);
    } finally {
      setLoadingMfa(false);
    }
  }, [session?.user?.id, refreshBackupCodesStats]);

  useEffect(() => {
    fetchMfaFactors();
  }, [fetchMfaFactors]);

  const verifiedFactor = mfaFactors.find((f) => f.status === 'verified');
  const is2FaEnabled = !!verifiedFactor;

  const handleOpenBackupChallenge = (action: 'view' | 'regenerate' | 'disable') => {
    setBackupActionType(action);
    setChallengePassword('');
    setChallengeTotpCode('');
    setEmailOtpCode('');
    setChallengeError(null);
    setShowBackupPasswordChallenge(true);
  };

  const handleVerifyPasswordForBackupCodes = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email || !session?.user?.id) {
      setChallengeError('Không xác định được người dùng.');
      return;
    }

    setChallengeError(null);
    setVerifyingChallengePw(true);

    try {
      if (hasCustomPassword) {
        if (!challengePassword) {
          throw new Error('Vui lòng nhập mật khẩu tài khoản.');
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: session.user.email,
          password: challengePassword,
        });
        if (error) throw new Error('Mật khẩu tài khoản không đúng. Vui lòng thử lại.');
      } else if (googleChallengeMethod === 'totp') {
        if (!challengeTotpCode || challengeTotpCode.length < 6) {
          throw new Error('Vui lòng nhập đủ 6 số từ Google Authenticator.');
        }
        if (verifiedFactor) {
          const { data: cData, error: cErr } = await supabase.auth.mfa.challenge({
            factorId: verifiedFactor.id,
          });
          if (cErr) throw cErr;
          const { error: vErr } = await supabase.auth.mfa.verify({
            factorId: verifiedFactor.id,
            challengeId: cData.id,
            code: challengeTotpCode.trim(),
          });
          if (vErr) throw new Error('Mã xác thực không đúng hoặc đã hết hạn.');
        }
      } else {
        // googleChallengeMethod === 'email'
        if (!emailOtpCode || emailOtpCode.trim().length < 6) {
          throw new Error('Vui lòng nhập đủ 6 chữ số OTP nhận từ email.');
        }
        const { error: vErr } = await supabase.auth.verifyOtp({
          email: session.user.email,
          token: emailOtpCode.trim(),
          type: 'email',
        });
        if (vErr) throw new Error('Mã OTP email không đúng hoặc đã hết hạn.');
      }

      // XỬ LÝ THEO TỪNG HÀNH ĐỘNG SAU KHI XÁC THỰC THÀNH CÔNG:
      if (backupActionType === 'disable') {
        if (verifiedFactor) {
          const { error: unenrollErr } = await supabase.auth.mfa.unenroll({
            factorId: verifiedFactor.id,
          });
          if (unenrollErr) throw unenrollErr;
        }
        clearBackupCodes(session.user.id);
        await fetchMfaFactors();
        toast.success('Đã tắt Xác thực 2 lớp (2FA) thành công!');
        setShowBackupPasswordChallenge(false);
        setChallengePassword('');
        setChallengeTotpCode('');
        setEmailOtpCode('');
        return;
      }

      if (backupActionType === 'regenerate') {
        const newCodes = generateNewBackupCodes(session.user.id);
        setRevealedBackupCodes(newCodes);
        refreshBackupCodesStats();
        toast.success('Đã tạo mới thành công 10 mã dự phòng 2FA!');
      } else {
        const stats = getBackupCodesStats(session.user.id);
        setRevealedBackupCodes(stats.codes);
        refreshBackupCodesStats();
        toast.success('Xác thực danh tính thành công!');
      }

      setShowBackupPasswordChallenge(false);
      setChallengePassword('');
      setChallengeTotpCode('');
      setEmailOtpCode('');
      setShowBackupCodesModal(true);
    } catch (err: any) {
      setChallengeError(err.message || 'Xác thực không thành công.');
    } finally {
      setVerifyingChallengePw(false);
    }
  };

  const handleCopyAllBackupCodes = () => {
    if (revealedBackupCodes.length === 0) return;
    const content = revealedBackupCodes
      .filter((c) => !c.used)
      .map((c) => c.code)
      .join('\n');
    navigator.clipboard.writeText(content);
    setCopiedBackupCodes(true);
    toast.success('Đã sao chép các mã dự phòng khả dụng!');
    setTimeout(() => setCopiedBackupCodes(false), 2000);
  };

  const handleCopySingleCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSingleCode(code);
    toast.success(`Đã sao chép mã: ${code}`);
    setTimeout(() => setCopiedSingleCode(null), 2000);
  };

  const handleDownloadBackupTxt = () => {
    if (revealedBackupCodes.length === 0) return;
    const remainingCount = revealedBackupCodes.filter((c) => !c.used).length;
    const textContent = `MÃ SAO LƯU DỰ PHÒNG 2FA - SHOP OF BOW\nTài khoản: ${session?.user?.email}\nNgày xuất mã: ${new Date().toLocaleString('vi-VN')}\nTrạng thái: Còn ${remainingCount}/${revealedBackupCodes.length} mã khả dụng\n\nDANH SÁCH MÃ DỰ PHÒNG (MỖI MÃ DÙNG 1 LẦN DUY NHẤT):\n${revealedBackupCodes
      .map((c, i) => `${i + 1}. ${c.code} ${c.used ? `[ĐÃ SỬ DỤNG - ${new Date(c.used_at || '').toLocaleDateString('vi-VN')}]` : '[KHẢ DỤNG]'}`)
      .join('\n')}\n\n* Lưu ý quan trọng: Mỗi mã dự phòng là phương án cứu hộ duy nhất chỉ dùng được 1 lần khi bạn không thể sử dụng ứng dụng Google Authenticator.`;
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

  // ----------------------------------------------------
  // 3. STATE: ĐỔI MẬT KHẨU
  // ----------------------------------------------------
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwVerifiedOld, setPwVerifiedOld] = useState(false);
  const [verifyingOldPw, setVerifyingOldPw] = useState(false);
  const [updatingPw, setUpdatingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  const calcPasswordStrength = (pw: string) => {
    if (!pw) return { score: 0, label: 'Chưa nhập', color: 'bg-slate-700' };
    let score = 0;
    if (pw.length >= 6) score += 1;
    if (pw.length >= 8) score += 1;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
    if (/[0-9]/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score += 1;

    switch (score) {
      case 1:
        return { score: 25, label: 'Yếu', color: 'bg-rose-500' };
      case 2:
        return { score: 50, label: 'Trung bình', color: 'bg-amber-500' };
      case 3:
        return { score: 75, label: 'Khá mạnh', color: 'bg-blue-500' };
      case 4:
        return { score: 100, label: 'Rất mạnh', color: 'bg-emerald-500' };
      default:
        return { score: 15, label: 'Quá ngắn', color: 'bg-rose-400' };
    }
  };

  const pwStrength = calcPasswordStrength(newPassword);

  const handleVerifyCurrentPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      setPwError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (!session?.user?.email) {
      setPwError('Không xác định được email người dùng.');
      return;
    }

    setPwError(null);
    setPwSuccess(null);
    setVerifyingOldPw(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      });

      if (error) {
        throw new Error('Mật khẩu hiện tại không chính xác.');
      }

      setPwVerifiedOld(true);
      toast.success('Xác thực mật khẩu cũ thành công.');
    } catch (err: any) {
      setPwError(err.message || 'Mật khẩu hiện tại không đúng.');
    } finally {
      setVerifyingOldPw(false);
    }
  };

  const handleSetOrUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (!newPassword || newPassword.length < 6) {
      setPwError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (hasCustomPassword && newPassword === currentPassword) {
      setPwError('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Mật khẩu xác nhận nhập lại không khớp.');
      return;
    }

    setUpdatingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { has_custom_password: true },
      });

      if (error) throw error;

      if (session?.user?.id) {
        localStorage.setItem(`bow_has_pwd_${session.user.id}`, 'true');
      }
      setHasCustomPassword(true);
      toast.success(
        hasCustomPassword
          ? 'Đổi mật khẩu thành công!'
          : 'Thiết lập mật khẩu riêng thành công! Bây giờ bạn có thể đăng nhập bằng cả Google và Email/Mật khẩu.'
      );
      setPwSuccess('Mật khẩu mới đã được cập nhật an toàn.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwVerifiedOld(false);
    } catch (err: any) {
      setPwError(err.message || 'Lỗi khi cập nhật mật khẩu.');
    } finally {
      setUpdatingPw(false);
    }
  };

  const handleResetPwFlow = () => {
    setPwVerifiedOld(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwError(null);
    setPwSuccess(null);
  };

  // ----------------------------------------------------
  // 4. STATE: QUẢN LÝ THIẾT BỊ ĐĂNG NHẬP
  // ----------------------------------------------------
  const [devices, setDevices] = useState<UserDeviceRecord[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const [removingDeviceId, setRemovingDeviceId] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoadingDevices(true);
    try {
      await trackCurrentDevice(session.user.id);
      const list = await getUserDevices(session.user.id);
      setDevices(list);
    } catch (err) {
      console.warn('Error loading devices:', err);
    } finally {
      setLoadingDevices(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleSignOutOthers = async () => {
    if (!session?.user?.id) return;
    setSigningOutOthers(true);
    try {
      await signOutOtherDevices(session.user.id);
      toast.success('Đã đăng xuất tất cả thiết bị khác thành công!');
      await fetchDevices();
    } catch (err: any) {
      toast.error('Lỗi khi đăng xuất thiết bị khác.');
    } finally {
      setSigningOutOthers(false);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!session?.user?.id) return;
    setRemovingDeviceId(deviceId);
    try {
      await removeDeviceSession(session.user.id, deviceId);
      toast.success('Đã ngắt kết nối thiết bị.');
      await fetchDevices();
    } catch (err) {
      toast.error('Lỗi khi xóa phiên thiết bị.');
    } finally {
      setRemovingDeviceId(null);
    }
  };

  const otherDevicesCount = devices.filter((d) => !d.is_current).length;

  const renderDeviceIcon = (type?: string, os?: string) => {
    const t = (type || '').toLowerCase();
    const o = (os || '').toLowerCase();
    if (t === 'mobile' || o.includes('ios') || o.includes('android') || o.includes('iphone')) {
      return <DeviceMobileSvg className="h-5 w-5 text-slate-400 dark:text-slate-300" />;
    }
    return <DeviceDesktopSvg className="h-5 w-5 text-slate-400 dark:text-slate-300" />;
  };

  const securityHealthScore = is2FaEnabled ? 100 : 65;

  return (
    <div className="space-y-6">
      {/* Hidden File Input for Avatar Upload */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleAvatarFileChange}
        className="hidden"
      />

      {/* ================================================================== */}
      {/* 1. HEADER SECTION (Clean, Minimalist & Sleek) */}
      {/* ================================================================== */}
      <div className="rounded-[24px] border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#11192C] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/50 text-[#2563EB] dark:text-[#38BDF8] border border-blue-100 dark:border-blue-900/50">
            <ShieldCheckSvg className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-[#0F172A] dark:text-white tracking-tight">
              Cài đặt tài khoản & Bảo mật
            </h2>
            <p className="text-xs font-medium text-slate-400 mt-0.5">
              Quản lý thông tin hồ sơ, xác thực 2 lớp và giám sát thiết bị truy cập.
            </p>
          </div>
        </div>

        {/* Status Badge: Thiết kế thanh lịch, gọn gàng cả trên Desktop lẫn Mobile */}
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 px-3.5 py-1.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 self-start sm:self-auto shrink-0 shadow-2xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Bảo mật: {securityHealthScore}% • {is2FaEnabled ? 'Rất an toàn' : 'Cần bật 2FA'}</span>
        </div>
      </div>

      {/* ================================================================== */}
      {/* 2. GRID 2x2 LAYOUT (Tận dụng chiều ngang Desktop, Responsive 1 col Mobile) */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* ---------------------------------------------------------------- */}
        {/* HÀNG 1 - CỘT TRÁI: THÔNG TIN CÁ NHÂN */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col justify-between rounded-[24px] border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#11192C] p-6 shadow-xs space-y-5">
          <div className="space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserCircleSvg className="h-5 w-5 text-blue-500" />
                <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                  Thông tin cá nhân
                </h3>
              </div>
              <p className="text-xs font-medium text-slate-400 mt-0.5">
                Thông tin định danh hiển thị trên hóa đơn và tài khoản BOW.
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Avatar với nút tải ảnh 1-chạm */}
              <div className="relative group shrink-0">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#00A3FF] to-[#2563EB] text-xl font-extrabold text-white shadow-sm overflow-hidden border border-white/20 dark:border-slate-700">
                  {currentAvatarUrl ? (
                    <img src={currentAvatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    (session?.user?.email || 'U').charAt(0).toUpperCase()
                  )}

                  {/* Loading Overlay khi upload */}
                  {uploadingAvatar && (
                    <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center">
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Nút Camera để kích hoạt chọn ảnh */}
                <button
                  type="button"
                  title="Thay đổi ảnh đại diện"
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#2563EB] text-white border-2 border-white dark:border-[#11192C] shadow-xs hover:bg-[#1D4ED8] hover:scale-110 active:scale-95 transition cursor-pointer disabled:opacity-50"
                >
                  <CameraSvg className="h-3 w-3" />
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                    {profile?.full_name || session?.user?.user_metadata?.full_name || 'Thành viên BOW'}
                  </h4>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 text-blue-500 dark:text-[#38BDF8] border border-blue-500/20 px-2 py-0.5 text-[10px] font-bold">
                    {isAdmin ? 'Quản trị viên' : isCtv ? 'Đối tác CTV' : 'Thành viên'}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                  Ngày tham gia: {session?.user?.created_at ? new Date(session.user.created_at).toLocaleDateString('vi-VN') : 'Mới'}
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdateFullName} className="space-y-3.5 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Họ và tên đầy đủ
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên của bạn"
                  className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3.5 text-xs font-semibold text-[#0F172A] dark:text-white outline-none focus:border-[#2563EB] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Email đăng nhập
                </label>
                <div className="relative">
                  <input
                    type="email"
                    disabled
                    value={session?.user?.email || ''}
                    className="h-10 w-full rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-3.5 pr-28 text-xs font-semibold text-slate-400 cursor-not-allowed outline-none"
                  />
                  <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckOutlineSvg className="h-3 w-3" />
                    Đã xác thực
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={updatingProfile}
                className="w-full rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
              >
                {updatingProfile ? 'Đang lưu thay đổi...' : 'Lưu thay đổi'}
              </button>
            </form>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* HÀNG 1 - CỘT PHẢI: XÁC THỰC 2 LỚP (2FA) */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col justify-between rounded-[24px] border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#11192C] p-6 shadow-xs space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <KeySvg className="h-5 w-5 text-blue-500" />
                  <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                    Xác thực 2 lớp (2FA)
                  </h3>
                </div>
                <p className="text-xs font-medium text-slate-400 mt-0.5">
                  Bảo vệ tài khoản với mã OTP 6 số từ Google Authenticator.
                </p>
              </div>

              {is2FaEnabled ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Đang hoạt động</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 shrink-0">
                  Chưa kích hoạt
                </span>
              )}
            </div>

            {loadingMfa ? (
              <div className="py-8 text-center text-xs font-medium text-slate-400">
                Đang kiểm tra trạng thái bảo mật...
              </div>
            ) : is2FaEnabled ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <ShieldCheckSvg className="h-5 w-5 shrink-0" />
                      <h4 className="text-xs font-bold text-[#0F172A] dark:text-white">
                        Tài khoản đang được bảo vệ an toàn tối đa
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border shrink-0 ${
                          backupStats.remaining > 3
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-[#38BDF8] border-blue-200/80 dark:border-blue-800/80'
                            : backupStats.remaining > 0
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/80'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200/80 dark:border-rose-800/80'
                        }`}
                      >
                        <KeySvg className="h-3 w-3" />
                        Còn {backupStats.remaining}/{backupStats.total} mã dự phòng
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-medium text-slate-400 leading-relaxed pl-7">
                    Mỗi lần đăng nhập, bạn cần nhập mã 6 số từ Google Authenticator. Nếu mất điện thoại, bạn có thể dùng 1 trong {backupStats.remaining} mã dự phòng còn lại để cứu hộ.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleOpenBackupChallenge('view')}
                    className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-2.5 px-2 text-xs font-bold transition shadow-2xs flex items-center justify-center gap-1 cursor-pointer truncate"
                    title="Xem danh sách mã dự phòng"
                  >
                    <KeySvg className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span className="truncate">Mã dự phòng</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowRegenerateConfirmModal(true)}
                    className="rounded-xl bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 border border-blue-200/70 dark:border-blue-800/60 text-[#2563EB] dark:text-[#38BDF8] py-2.5 px-2 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer truncate"
                    title="Tạo lại 10 mã dự phòng mới"
                  >
                    <ArrowPathSvg className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Tạo mã mới</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenBackupChallenge('disable')}
                    className="rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 py-2.5 px-2 text-xs font-bold transition flex items-center justify-center cursor-pointer truncate"
                  >
                    Tắt 2FA
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                  <h4 className="text-xs font-bold text-[#0F172A] dark:text-white">
                    Bật xác thực 2 bước để tăng cường bảo vệ
                  </h4>
                  <p className="text-xs font-medium text-slate-400 leading-relaxed">
                    Ngăn chặn kẻ xấu xâm nhập ngay cả khi bị lộ mật khẩu. Thiết lập chỉ mất 30 giây qua mã QR.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShow2FaModal(true)}
                  className="w-full rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-2.5 text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  Bật 2FA ngay
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* HÀNG 2 - CỘT TRÁI: PHƯƠNG THỨC ĐĂNG NHẬP & MẬT KHẨU */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col justify-between rounded-[24px] border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#11192C] p-6 shadow-xs space-y-5">
          <div className="space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <LockClosedSvg className="h-5 w-5 text-blue-500" />
                <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                  Phương thức đăng nhập & Mật khẩu
                </h3>
              </div>
              <p className="text-xs font-medium text-slate-400 mt-0.5">
                Quản lý liên kết tài khoản Google và mật khẩu bảo vệ.
              </p>
            </div>

            {/* 1. KHỐI TÀI KHOẢN LIÊN KẾT GOOGLE */}
            <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
                    <GoogleSvg className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                      <span>Tài khoản Google</span>
                    </h4>
                    <p className="text-[11px] font-medium text-slate-400">
                      {isGoogleLinked ? googleEmail || session?.user?.email : 'Đăng nhập nhanh 1-chạm không cần mật khẩu'}
                    </p>
                  </div>
                </div>

                {isGoogleLinked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/80 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    <span>Đã liên kết</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleLinkGoogleAccount}
                    disabled={linkingGoogle}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs transition disabled:opacity-60 cursor-pointer shrink-0"
                  >
                    <LinkSvg className="h-3.5 w-3.5 text-blue-500" />
                    <span>{linkingGoogle ? 'Đang mở...' : 'Liên kết Google'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2. KHỐI MẬT KHẨU TÀI KHOẢN */}
            {pwError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/50 text-xs font-bold text-rose-600 dark:text-rose-300">
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/50 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {pwSuccess}
              </div>
            )}

            {!hasCustomPassword ? (
              /* KỊCH BẢN A: TÀI KHOẢN GOOGLE CHƯA TẠO MẬT KHẨU RIÊNG */
              <form onSubmit={handleSetOrUpdatePassword} className="space-y-3.5 pt-1">
                <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 space-y-1">
                  <h5 className="text-xs font-bold text-[#2563EB] dark:text-[#38BDF8]">
                    💡 Thiết lập mật khẩu riêng cho shop
                  </h5>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                    Bạn đang đăng nhập qua Google. Hãy đặt mật khẩu riêng để có thể đăng nhập bằng cả Email và Mật khẩu khi cần.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Mật khẩu mới
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự (Có chữ & số)"
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3.5 pr-14 text-xs font-semibold text-[#0F172A] dark:text-white outline-none focus:border-[#2563EB] transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((v) => !v)}
                      className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showNewPw ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>

                  {newPassword.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Độ mạnh:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{pwStrength.label}</span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full ${pwStrength.color} transition-all duration-300`}
                          style={{ width: `${pwStrength.score}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Xác nhận lại mật khẩu mới
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3.5 pr-14 text-xs font-semibold text-[#0F172A] dark:text-white outline-none focus:border-[#2563EB] transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw((v) => !v)}
                      className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showConfirmPw ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={updatingPw}
                  className="w-full rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
                >
                  {updatingPw ? 'Đang lưu...' : 'Thiết lập mật khẩu riêng'}
                </button>
              </form>
            ) : !pwVerifiedOld ? (
              /* KỊCH BẢN B (BƯỚC 1): TÀI KHOẢN ĐÃ CÓ MẬT KHẨU - XÁC THỰC CŨ */
              <form onSubmit={handleVerifyCurrentPassword} className="space-y-3.5 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Mật khẩu hiện tại
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPw ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Nhập mật khẩu đang sử dụng"
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3.5 pr-14 text-xs font-semibold text-[#0F172A] dark:text-white outline-none focus:border-[#2563EB] transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw((v) => !v)}
                      className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showCurrentPw ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={verifyingOldPw}
                  className="w-full rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
                >
                  {verifyingOldPw ? 'Đang xác thực...' : 'Xác thực mật khẩu cũ →'}
                </button>
              </form>
            ) : (
              /* KỊCH BẢN B (BƯỚC 2): NHẬP MẬT KHẨU MỚI */
              <form onSubmit={handleSetOrUpdatePassword} className="space-y-3.5 animate-fade-in pt-1">
                <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2563EB] dark:text-[#38BDF8]">
                    ✓ Đã xác thực mật khẩu cũ
                  </span>
                  <button
                    type="button"
                    onClick={handleResetPwFlow}
                    className="text-xs font-medium text-slate-400 hover:text-slate-600 underline cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Mật khẩu mới
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự (Có chữ & số)"
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3.5 pr-14 text-xs font-semibold text-[#0F172A] dark:text-white outline-none focus:border-[#2563EB] transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((v) => !v)}
                      className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showNewPw ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>

                  {newPassword.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Độ mạnh:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{pwStrength.label}</span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full ${pwStrength.color} transition-all duration-300`}
                          style={{ width: `${pwStrength.score}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Xác nhận lại mật khẩu mới
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-3.5 pr-14 text-xs font-semibold text-[#0F172A] dark:text-white outline-none focus:border-[#2563EB] transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw((v) => !v)}
                      className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showConfirmPw ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={updatingPw}
                    className="flex-1 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
                  >
                    {updatingPw ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPwFlow}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-3.5 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* HÀNG 2 - CỘT PHẢI: THIẾT BỊ ĐÃ ĐĂNG NHẬP */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-col justify-between rounded-[24px] border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#11192C] p-6 shadow-xs space-y-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <DeviceDesktopSvg className="h-5 w-5 text-blue-500" />
                  <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-white">
                    Thiết bị đã đăng nhập
                  </h3>
                </div>
                <p className="text-xs font-medium text-slate-400 mt-0.5">
                  Quản lý các phiên đăng nhập đang hoạt động.
                </p>
              </div>

              {otherDevicesCount > 0 && (
                <button
                  type="button"
                  onClick={handleSignOutOthers}
                  disabled={signingOutOthers}
                  className="rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 px-2.5 py-1 text-[11px] font-bold transition shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <ArrowRightExitSvg className="h-3 w-3" />
                  <span>Đăng xuất máy khác</span>
                </button>
              )}
            </div>

            {loadingDevices ? (
              <div className="py-8 text-center text-xs font-medium text-slate-400">
                Đang tải danh sách thiết bị...
              </div>
            ) : devices.length === 0 ? (
              <div className="py-8 text-center text-xs font-medium text-slate-400">
                Chưa có thông tin thiết bị.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {devices.map((d) => (
                  <div
                    key={d.id || d.device_id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition ${
                      d.is_current
                        ? 'bg-blue-50/30 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-900/40'
                        : 'bg-slate-50/50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/80">
                        {renderDeviceIcon(d.device_type, d.os)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                            {d.browser || 'Trình duyệt'} trên {d.os || d.device_name || 'Thiết bị'}
                          </h4>
                          {d.is_current && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-800/60 px-1.5 py-0.2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                              <span className="h-1 w-1 rounded-full bg-emerald-500"></span>
                              Thiết bị này
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-medium text-slate-400 mt-0.5 truncate">
                          {d.ip_address ? `IP: ${d.ip_address} • ` : ''}Hoạt động: {new Date(d.last_active_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} {new Date(d.last_active_at).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>

                    {!d.is_current && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDevice(d.device_id)}
                        disabled={removingDeviceId === d.device_id}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 px-2 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 transition shadow-2xs shrink-0 cursor-pointer"
                      >
                        {removingDeviceId === d.device_id ? '...' : 'Đăng xuất'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 1: BẬT 2FA (QR CODE SETUP) */}
      {/* ------------------------------------------------------------------ */}
      <TwoFactorModal
        isOpen={show2FaModal}
        onClose={() => setShow2FaModal(false)}
        onSuccess={() => {
          fetchMfaFactors();
        }}
      />

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 3: XÁC THỰC BẢO MẬT KHI XEM/TẠO MÃ DỰ PHÒNG HOẶC TẮT 2FA */}
      {/* ------------------------------------------------------------------ */}
      {showBackupPasswordChallenge && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setShowBackupPasswordChallenge(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#18243E] p-5 shadow-2xl space-y-4 animate-fade-up">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                {backupActionType === 'disable' ? (
                  <span className="text-base">🛑</span>
                ) : (
                  <KeySvg className="h-5 w-5 text-blue-500" />
                )}
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                  {backupActionType === 'disable'
                    ? 'Xác thực để tắt 2FA'
                    : backupActionType === 'regenerate'
                    ? 'Xác thực để tạo 10 mã mới'
                    : 'Xác thực danh tính bảo mật'}
                </h3>
              </div>
              <button onClick={() => setShowBackupPasswordChallenge(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <CloseSvg className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {backupActionType === 'disable'
                ? hasCustomPassword
                  ? 'Vui lòng nhập mật khẩu tài khoản để xác nhận tắt Xác thực 2 lớp (2FA).'
                  : 'Vui lòng xác thực bằng Google Authenticator hoặc mã OTP gửi về Email để tắt 2FA.'
                : backupActionType === 'regenerate'
                ? hasCustomPassword
                  ? 'Vui lòng nhập mật khẩu tài khoản để xác nhận tạo 10 mã dự phòng mới. Các mã cũ sẽ bị vô hiệu hóa.'
                  : 'Vui lòng xác thực danh tính để tạo lại 10 mã dự phòng mới.'
                : hasCustomPassword
                ? 'Vui lòng nhập mật khẩu tài khoản để mở khóa danh sách mã sao lưu dự phòng.'
                : 'Vui lòng xác thực danh tính để mở khóa danh sách mã sao lưu dự phòng.'}
            </p>

            {challengeError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs font-bold text-rose-600 dark:text-rose-300">
                {challengeError}
              </div>
            )}

            {!hasCustomPassword && (
              /* TAB SWITCHER DÀNH CHO TÀI KHOẢN GOOGLE */
              <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => {
                    setGoogleChallengeMethod('totp');
                    setChallengeError(null);
                  }}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                    googleChallengeMethod === 'totp'
                      ? 'bg-white dark:bg-slate-700 text-[#2563EB] dark:text-[#38BDF8] shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  📱 Google Authenticator
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGoogleChallengeMethod('email');
                    setChallengeError(null);
                  }}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${
                    googleChallengeMethod === 'email'
                      ? 'bg-white dark:bg-slate-700 text-[#2563EB] dark:text-[#38BDF8] shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  📧 Gửi OTP về Email
                </button>
              </div>
            )}

            <form onSubmit={handleVerifyPasswordForBackupCodes} className="space-y-4">
              {hasCustomPassword ? (
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Mật khẩu tài khoản
                  </label>
                  <div className="relative">
                    <input
                      type={showChallengePassword ? 'text' : 'password'}
                      required
                      autoFocus
                      value={challengePassword}
                      onChange={(e) => setChallengePassword(e.target.value)}
                      placeholder="Nhập mật khẩu hiện tại"
                      className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 pr-14 text-xs font-semibold text-[#0F172A] dark:text-white outline-none focus:border-[#2563EB]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowChallengePassword((v) => !v)}
                      className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showChallengePassword ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                </div>
              ) : googleChallengeMethod === 'totp' ? (
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                    Mã xác thực Google Authenticator (6 chữ số)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    autoFocus
                    value={challengeTotpCode}
                    onChange={(e) => setChallengeTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="h-12 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-center text-xl font-mono font-bold tracking-widest text-[#0F172A] dark:text-white outline-none focus:border-[#2563EB]"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Nhập mã 6 số đang hiển thị trên ứng dụng Google Authenticator của bạn.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Mã xác nhận gửi về Email ({session?.user?.email})
                    </label>
                    <button
                      type="button"
                      onClick={handleSendEmailOtp}
                      disabled={sendingEmailOtp || emailOtpCooldown > 0}
                      className="text-xs font-bold text-[#2563EB] dark:text-[#38BDF8] hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      {sendingEmailOtp
                        ? 'Đang gửi...'
                        : emailOtpCooldown > 0
                        ? `Gửi lại sau (${emailOtpCooldown}s)`
                        : 'Gửi mã xác nhận'}
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    autoFocus
                    value={emailOtpCode}
                    onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Nhập 6 số từ Email"
                    className="h-12 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-center text-xl font-mono font-bold tracking-widest text-[#0F172A] dark:text-white outline-none focus:border-[#2563EB]"
                  />
                  <p className="text-[11px] text-slate-400">
                    Bấm &quot;Gửi mã xác nhận&quot; để nhận mã OTP 6 số qua hộp thư của bạn.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowBackupPasswordChallenge(false)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={verifyingChallengePw}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold text-white shadow-xs transition disabled:opacity-60 cursor-pointer ${
                    backupActionType === 'disable'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-[#2563EB] hover:bg-[#1D4ED8]'
                  }`}
                >
                  {verifyingChallengePw
                    ? backupActionType === 'disable'
                      ? 'Đang tắt 2FA...'
                      : 'Đang kiểm tra...'
                    : backupActionType === 'disable'
                    ? '🛑 Xác nhận & Tắt 2FA'
                    : backupActionType === 'regenerate'
                    ? 'Tạo 10 mã mới'
                    : 'Xác thực & Mở khóa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 3.5: XÁC NHẬN TẠO LẠI 10 MÃ DỰ PHÒNG MỚI */}
      {/* ------------------------------------------------------------------ */}
      {showRegenerateConfirmModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setShowRegenerateConfirmModal(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#18243E] p-5 shadow-2xl space-y-4 animate-fade-up">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ArrowPathSvg className="h-5 w-5 text-amber-500" />
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                  Tạo lại 10 mã dự phòng mới?
                </h3>
              </div>
              <button onClick={() => setShowRegenerateConfirmModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <CloseSvg className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/50 space-y-1 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-bold">⚠️ Lưu ý quan trọng:</p>
              <p>
                Khi bạn tạo 10 mã mới, <strong>toàn bộ các mã dự phòng cũ trước đây sẽ bị vô hiệu hóa ngay lập tức</strong>. Hãy lưu lại bộ mã mới cẩn thận.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowRegenerateConfirmModal(false)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRegenerateConfirmModal(false);
                  handleOpenBackupChallenge('regenerate');
                }}
                className="flex-1 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
              >
                Tiếp tục & Xác thực
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 4: DANH SÁCH 10 MÃ SAO LƯU DỰ PHÒNG (CHI TIẾT TRẠNG THÁI) */}
      {/* ------------------------------------------------------------------ */}
      {showBackupCodesModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setShowBackupCodesModal(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#18243E] p-5 shadow-2xl space-y-4 animate-fade-up max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <KeySvg className="h-5 w-5 text-blue-500" />
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                    Mã sao lưu dự phòng 2FA
                  </h3>
                  <p className="text-[11px] font-medium text-slate-400">
                    Còn {revealedBackupCodes.filter((c) => !c.used).length}/{revealedBackupCodes.length} mã khả dụng
                  </p>
                </div>
              </div>
              <button onClick={() => setShowBackupCodesModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <CloseSvg className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed shrink-0">
              Mỗi mã dưới đây có thể dùng <strong>1 lần duy nhất</strong> khi bạn không thể mở Google Authenticator. Sau khi dùng, mã sẽ tự động bị vô hiệu hóa.
            </p>

            {/* Grid 10 Backup Codes */}
            <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 overflow-y-auto max-h-[280px]">
              {revealedBackupCodes.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                    item.used
                      ? 'bg-slate-100/70 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/40 opacity-60'
                      : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                    <span
                      className={`font-mono text-xs font-extrabold tracking-wider ${
                        item.used
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-[#2563EB] dark:text-[#38BDF8]'
                      }`}
                    >
                      {item.code}
                    </span>
                  </div>

                  {item.used ? (
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 bg-slate-200/80 dark:bg-slate-700/80 px-1.5 py-0.5 rounded">
                      Đã dùng
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCopySingleCode(item.code)}
                      className="text-[10px] font-bold text-slate-500 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer shrink-0"
                      title="Sao chép mã này"
                    >
                      {copiedSingleCode === item.code ? '✓' : 'Chép'}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1 shrink-0">
              <button
                type="button"
                onClick={handleCopyAllBackupCodes}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                {copiedBackupCodes ? '✓ Đã sao chép tất cả' : 'Sao chép mã chưa dùng'}
              </button>

              <button
                type="button"
                onClick={handleDownloadBackupTxt}
                className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] py-2.5 text-xs font-bold text-white shadow-xs transition cursor-pointer"
              >
                Tải file .TXT về máy
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowBackupCodesModal(false)}
              className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-2 text-xs font-medium hover:bg-slate-200 cursor-pointer shrink-0"
            >
              Đóng lại
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
