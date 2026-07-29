import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import SearchBar from './SearchBar';
import { SparkIcon } from './icons';
import newLogo from '../assets/new-logover2.png';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { session, loading, balance, signOut } = useAuth();
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const loc = useLocation();

  useEffect(() => setShowMobileSearch(false), [loc.pathname]);

  // Close dropdown on route changes
  useEffect(() => setShowUserMenu(false), [loc.pathname]);

  // Outside click listener to close dropdown
  useEffect(() => {
    if (!showUserMenu) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [showUserMenu]);

  return (
    <header className="sticky top-0 z-50 border-b border-[#EBF2FA] bg-white/95 backdrop-blur-md">
      <div className="container-bow flex h-16 items-center justify-between gap-4 sm:h-[72px]">
        {/* Logo - Premium new-logover2.png */}
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <img
            src={newLogo}
            alt="BOW Logo"
            className="h-11 w-auto object-contain filter contrast-[1.12] saturate-[1.1] drop-shadow-sm transition-transform duration-200 hover:scale-105 sm:h-13"
            style={{ imageRendering: '-webkit-optimize-contrast' }}
          />
          <div className="flex flex-col leading-none">
            <span className="text-xl font-black tracking-tight text-[#00A3FF] sm:text-2xl">BOW</span>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#FFB703]">
              Let's Connect
            </span>
          </div>
        </Link>

        {/* Center Search Bar - Desktop */}
        <div className="hidden max-w-xl flex-1 px-8 md:block">
          <SearchBar className="w-full" />
        </div>

        {/* Right side - Mobile Search Button + User Auth */}
        <div className="flex items-center gap-2.5">
          <div className="md:hidden">
            <button
              onClick={() => setShowMobileSearch((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-sky-200 bg-sky-50/50 text-sky-600 shadow-xs transition hover:bg-sky-100"
              aria-label="Search"
            >
              <SparkIcon className="h-4 w-4" />
            </button>
          </div>

          {/* User Profile / Login */}
          {loading ? (
            <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
          ) : session ? (
            <div className="relative user-menu-container">
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="flex items-center gap-1.5 focus:outline-none"
                aria-label="Account Menu"
              >
                {session.user.user_metadata.avatar_url ? (
                  <img
                    src={session.user.user_metadata.avatar_url}
                    alt={session.user.user_metadata.full_name || 'Avatar'}
                    className="h-9 w-9 rounded-full object-cover border border-slate-200 shadow-xs transition hover:scale-105"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] text-xs font-black text-white shadow-xs transition hover:scale-105">
                    {(session.user.email || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </button>

              {/* Dropdown Menu */}
              <div className={`absolute right-0 top-[calc(100%+8px)] z-50 w-52 rounded-2xl border border-slate-100 bg-white p-2 shadow-hero text-left animate-fade-up ${showUserMenu ? 'block' : 'hidden'}`}>
                <div className="px-3.5 py-2 border-b border-slate-50">
                  <span className="block truncate text-xs font-black text-[#0F172A]">
                    {session.user.user_metadata.full_name || 'Thành viên'}
                  </span>
                  <span className="block truncate text-[10px] text-slate-400 font-semibold mt-0.5">
                    {session.user.email}
                  </span>
                  <span className="mt-2.5 inline-flex w-full items-center justify-center rounded-lg bg-blue-50 py-1 text-[11px] font-black text-[#2563EB]">
                    Số dư: {balance.toLocaleString('vi-VN')}đ
                  </span>
                </div>

                <div className="py-1">
                  <Link
                    to="/dashboard?tab=profile"
                    onClick={() => setShowUserMenu(false)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#0F172A] hover:bg-slate-50 transition"
                  >
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Hồ sơ của tôi
                  </Link>
                  <Link
                    to="/dashboard?tab=orders"
                    onClick={() => setShowUserMenu(false)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#0F172A] hover:bg-slate-50 transition"
                  >
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Đơn hàng
                  </Link>
                  <Link
                    to="/dashboard?tab=wallet"
                    onClick={() => setShowUserMenu(false)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#0F172A] hover:bg-slate-50 transition"
                  >
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Ví tiền
                  </Link>
                  <Link
                    to="/dashboard?tab=favorites"
                    onClick={() => setShowUserMenu(false)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#0F172A] hover:bg-slate-50 transition"
                  >
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    Sản phẩm yêu thích
                  </Link>
                  <Link
                    to="/dashboard?tab=settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#0F172A] hover:bg-slate-50 transition"
                  >
                    <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Cài đặt tài khoản
                  </Link>
                  {session.user.email?.endsWith('@shopofbow.com') && (
                    <Link
                      to="/admin"
                      onClick={() => setShowUserMenu(false)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#2563EB] hover:bg-blue-50 transition"
                    >
                      <svg className="h-4 w-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Trang Admin
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      signOut();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 transition border-t border-slate-100 mt-1.5 pt-2"
                  >
                    <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Đăng xuất
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex h-9 items-center justify-center rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] px-4.5 text-xs font-bold text-white shadow-md hover:from-[#0080E0] hover:to-[#1D4ED8] hover:scale-105 transition-all duration-300"
            >
              Đăng nhập
            </Link>
          )}
        </div>
      </div>

      {/* Mobile search row dropdown */}
      {showMobileSearch && (
        <div className="container-bow pb-3 md:hidden">
          <SearchBar variant="compact" />
        </div>
      )}
    </header>
  );
}
