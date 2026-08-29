import { useEffect, useState, useRef, type TouchEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface UserBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserBottomSheet({ isOpen, onClose }: UserBottomSheetProps) {
  const { session, profile, balance, isAdmin, isCtv, signOut } = useAuth();
  const navigate = useNavigate();

  // Gesture Swipe-down to dismiss state
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const userAvatarUrl = profile?.avatar_url || session?.user?.user_metadata?.avatar_url || null;
  const userDisplayName = profile?.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Thành viên';

  // Khóa cuộn trang khi bottom sheet đang mở
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setDragY(0);
    } else {
      document.body.style.overflow = '';
      setDragY(0);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !session) return null;

  const handleNavigate = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleSignOut = async () => {
    onClose();
    await signOut();
    navigate('/', { replace: true });
  };

  // Touch handlers for swipe-down to close
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    // Chỉ kích hoạt swipe nếu đang ở đỉnh scroll của sheet
    if (sheetRef.current && sheetRef.current.scrollTop > 5) return;
    startYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (startYRef.current === null) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;
    if (diff > 0) {
      setDragY(diff);
    }
  };

  const handleTouchEnd = () => {
    if (dragY > 70) {
      onClose();
    }
    setDragY(0);
    startYRef.current = null;
  };

  return (
    <div className="fixed inset-0 z-[99999] lg:hidden">
      {/* Backdrop (Click để đóng) */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet Container */}
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragY === 0 ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        }}
        className="fixed inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-[28px] border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#11192C] shadow-2xl p-5 pb-8 space-y-4 animate-slide-up text-left select-none"
      >
        {/* Drag Indicator Bar (Vùng vuốt xuống tự nhiên) */}
        <div className="flex justify-center -mt-2 pb-1 cursor-grab active:cursor-grabbing">
          <div className="h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700/80" />
        </div>

        {/* Header Profile Section */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar */}
            <div className="relative shrink-0">
              {userAvatarUrl ? (
                <img
                  src={userAvatarUrl}
                  alt="Avatar"
                  className="h-12 w-12 rounded-full object-cover ring-2 ring-[#2563EB]/40 shadow-sm"
                />
              ) : (
                <div className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-black text-white shadow-sm ${isAdmin ? 'bg-gradient-to-tr from-amber-500 to-orange-500' : 'bg-gradient-to-tr from-[#00A3FF] to-[#2563EB]'}`}>
                  {(session.user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* User Details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-extrabold text-[#0F172A] dark:text-white truncate">
                  {userDisplayName}
                </h4>
                {isAdmin ? (
                  <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 shrink-0">
                    👑 Quản trị viên
                  </span>
                ) : isCtv ? (
                  <span className="rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 shrink-0">
                    ⭐ CTV Sỉ
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                    Thành viên
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 truncate mt-0.5">
                {session.user.email}
              </p>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition shrink-0 cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Wallet Balance Card */}
        <div className="rounded-2xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] p-4 text-white shadow-lg shadow-blue-500/20 flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-100/90 block">
              Số dư tài khoản
            </span>
            <div className="text-xl font-extrabold font-mono tracking-tight">
              {balance.toLocaleString('vi-VN')}đ
            </div>
          </div>
          <button
            onClick={() => handleNavigate('/dashboard?tab=wallet')}
            className="rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 px-3.5 py-2 text-xs font-bold text-white transition hover:scale-102 shrink-0 cursor-pointer shadow-xs"
          >
            + Nạp tiền
          </button>
        </div>

        {/* Navigation Items List */}
        <div className="space-y-1 pt-1">
          {/* 1. Tài khoản của tôi */}
          <button
            onClick={() => handleNavigate('/dashboard?tab=overview')}
            className="flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-base">
                🏠
              </span>
              <span>Tài khoản của tôi</span>
            </div>
            <span className="text-slate-400 text-sm">›</span>
          </button>

          {/* 2. Lịch sử đơn hàng */}
          <button
            onClick={() => handleNavigate('/dashboard?tab=orders')}
            className="flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-base">
                📦
              </span>
              <span>Lịch sử đơn hàng</span>
            </div>
            <span className="text-slate-400 text-sm">›</span>
          </button>

          {/* 3. Cài đặt & Bảo mật */}
          <button
            onClick={() => handleNavigate('/dashboard?tab=settings')}
            className="flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/60 text-base">
                ⚙️
              </span>
              <span>Cài đặt & Bảo mật</span>
            </div>
            <span className="text-slate-400 text-sm">›</span>
          </button>

          {/* 4. Quản trị Admin (Dịu nhẹ, tinh tế) */}
          {isAdmin && (
            <button
              onClick={() => handleNavigate('/admin')}
              className="flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900 transition cursor-pointer mt-1"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-base">
                  🛡️
                </span>
                <span className="font-extrabold text-[#2563EB] dark:text-[#38BDF8]">Quản trị Admin</span>
              </div>
              <span className="text-blue-500 text-sm font-bold">›</span>
            </button>
          )}
        </div>

        {/* Sign Out Button */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/50 py-3 text-xs font-bold transition cursor-pointer"
          >
            <span className="text-base">🚪</span>
            <span>Đăng xuất tài khoản</span>
          </button>
        </div>
      </div>
    </div>
  );
}
