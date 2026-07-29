import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import SearchBar from './SearchBar';
import { SearchIcon, SparkIcon, StarIcon, HeadsetIcon, HomeIcon } from './icons';
import newLogo from '../assets/new-logover2.png';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { session, loading, balance, signOut, isAdmin } = useAuth();
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const loc = useLocation();

  // Theme State
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('admin-theme') || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('admin-theme', theme);
  }, [theme]);

  // Scroll listener for sticky header resize
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on route changes
  useEffect(() => setShowMobileSearch(false), [loc.pathname]);
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

  // Vietnamese first word of name extraction (e.g. Nguyễn Văn Hoàn -> Nguyễn)
  const displayName = session?.user?.user_metadata?.full_name
    ? session.user.user_metadata.full_name.trim().split(' ')[0]
    : 'Admin';

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-300 backdrop-blur-md ${
        scrolled
          ? 'h-16 bg-white/85 dark:bg-slate-900/85 border-slate-200/80 dark:border-slate-800/80 shadow-xs'
          : 'h-20 bg-white/95 dark:bg-slate-900/95 border-slate-100 dark:border-slate-800/40'
      }`}
    >
      <div className="container-bow h-full flex items-center justify-between gap-4 px-6">
        
        {/* APPLE-STYLE MOBILE SEARCH INPUT: Replaces logo & buttons when active */}
        {showMobileSearch ? (
          <div className="flex-1 flex items-center gap-3 animate-fade-in w-full">
            <SearchBar className="flex-1" variant="compact" placeholder="Tìm kiếm AI Tools, Premium Apps..." />
            <button
              onClick={() => setShowMobileSearch(false)}
              className="text-xs font-black text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 shrink-0 px-2 py-1"
            >
              Hủy
            </button>
          </div>
        ) : (
          /* STANDARD HEADER LAYOUT */
          <>
            {/* LOGO */}
            <Link to="/" className="flex shrink-0 items-center gap-2.5">
              <img
                src={newLogo}
                alt="BOW Logo"
                className="h-[44px] w-auto object-contain filter contrast-[1.12] saturate-[1.1] drop-shadow-xs transition-transform duration-200 hover:scale-105"
                style={{ imageRendering: '-webkit-optimize-contrast' }}
              />
              <div className="flex flex-col leading-none">
                <span className="text-2xl sm:text-3xl font-black tracking-tight text-[#00A3FF]">BOW</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-[#FFB703] mt-0.5">
                  Let's Connect
                </span>
              </div>
            </Link>

            {/* NAVIGATION LINKS - DESKTOP ONLY */}
            <nav className="hidden lg:flex items-center gap-6.5 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-6 shrink-0">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `flex items-center gap-1.5 relative py-1 transition-colors duration-200 after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:bg-[#00A3FF] after:transition-all after:duration-300 ${
                    isActive
                      ? 'text-[#00A3FF] after:w-full'
                      : 'hover:text-[#00A3FF] after:w-0 hover:after:w-full'
                  }`
                }
              >
                <HomeIcon className="h-4.5 w-4.5" />
                Trang chủ
              </NavLink>

              <NavLink
                to="/ai-tools"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 relative py-1 transition-colors duration-200 after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:bg-[#00A3FF] after:transition-all after:duration-300 ${
                    isActive
                      ? 'text-[#00A3FF] after:w-full'
                      : 'hover:text-[#00A3FF] after:w-0 hover:after:w-full'
                  }`
                }
              >
                <SparkIcon className="h-4.5 w-4.5" />
                Danh mục
              </NavLink>
              
              <NavLink
                to="/premium-apps"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 relative py-1 transition-colors duration-200 after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:bg-[#00A3FF] after:transition-all after:duration-300 ${
                    isActive
                      ? 'text-[#00A3FF] after:w-full'
                      : 'hover:text-[#00A3FF] after:w-0 hover:after:w-full'
                  }`
                }
              >
                <StarIcon className="h-4.5 w-4.5" />
                Yêu thích
              </NavLink>

              <NavLink
                to="/contact"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 relative py-1 transition-colors duration-200 after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:bg-[#00A3FF] after:transition-all after:duration-300 ${
                    isActive
                      ? 'text-[#00A3FF] after:w-full'
                      : 'hover:text-[#00A3FF] after:w-0 hover:after:w-full'
                  }`
                }
              >
                <HeadsetIcon className="h-4.5 w-4.5" />
                Hỗ trợ
              </NavLink>
            </nav>

            {/* CENTER SEARCH BAR - DESKTOP ONLY */}
            <div className="hidden max-w-xl flex-1 px-8 md:block">
              <SearchBar className="w-full" />
            </div>

            {/* RIGHT SIDE ACTIONS */}
            <div className="flex items-center gap-3">
              {/* Mobile Search Trigger */}
              <div className="md:hidden">
                <button
                  onClick={() => setShowMobileSearch(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-sky-200 bg-sky-50/50 text-sky-600 shadow-xs transition hover:bg-sky-100"
                  aria-label="Search"
                >
                  <SearchIcon className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Theme Toggle Button */}
              <button
                onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-sky-100 dark:border-slate-800 bg-sky-50/20 dark:bg-slate-800/30 text-[#00A3FF] dark:text-[#35A8FF] shadow-xs transition hover:bg-sky-50 dark:hover:bg-slate-800/60 hover:scale-105"
                title={theme === 'light' ? 'Bật Dark Mode' : 'Bật Light Mode'}
              >
                {theme === 'light' ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                  </svg>
                )}
              </button>

              {/* Notification Bell */}
              <button
                onClick={() => alert('Hiện tại chưa có thông báo mới.')}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-sky-100 dark:border-slate-800 bg-sky-50/20 dark:bg-slate-800/30 text-slate-400 hover:text-[#00A3FF] dark:hover:text-[#35A8FF] shadow-xs transition hover:bg-sky-50 dark:hover:bg-slate-800/60 hover:scale-105"
                title="Thông báo"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>

              {/* User Profile / Login */}
              {loading ? (
                <div className="h-8.5 w-8.5 animate-pulse rounded-full bg-slate-100" />
              ) : session ? (
                <div className="relative user-menu-container">
                  {isAdmin ? (
                    /* Premium Admin Custom Trigger */
                    <button
                      onClick={() => setShowUserMenu((v) => !v)}
                      className="flex items-center gap-2 rounded-full border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 pl-2 pr-3 py-1 hover:border-amber-300 transition shadow-xs cursor-pointer focus:outline-none"
                    >
                      {session.user.user_metadata.avatar_url ? (
                        <img
                          src={session.user.user_metadata.avatar_url}
                          alt="Admin"
                          className="h-[28px] w-[28px] rounded-full object-cover border border-amber-200"
                        />
                      ) : (
                        <span className="flex h-[28px] w-[28px] items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-white shadow-xs">
                          H
                        </span>
                      )}
                      <div className="flex items-center gap-1 leading-none text-left shrink-0">
                        <span className="block text-[9px] font-black uppercase text-amber-600 dark:text-amber-400">👑 Admin</span>
                        <span className="block text-[11px] font-black text-slate-800 dark:text-slate-200 ml-0.5">{displayName}</span>
                        <svg className="h-3 w-3 text-amber-500 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>
                  ) : (
                    /* Standard User Avatar Trigger */
                    <button
                      onClick={() => setShowUserMenu((v) => !v)}
                      className="flex items-center justify-center rounded-full border-2 border-transparent hover:border-[#00A3FF] hover:shadow-xs transition duration-200 focus:outline-none cursor-pointer"
                      aria-label="Account Menu"
                    >
                      {session.user.user_metadata.avatar_url ? (
                        <img
                          src={session.user.user_metadata.avatar_url}
                          alt="Avatar"
                          className="h-[38px] w-[38px] rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] text-[11px] font-black text-white shadow-xs">
                          {(session.user.email || 'U').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </button>
                  )}

                  {/* Dropdown Menu */}
                  <div className={`absolute right-0 top-[calc(100%+8px)] z-50 w-52 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#1e293b] p-2 shadow-hero text-left animate-fade-up ${showUserMenu ? 'block' : 'hidden'}`}>
                    <div className="px-3.5 py-2 border-b border-slate-50 dark:border-slate-800">
                      <span className="block truncate text-xs font-black text-[#0F172A] dark:text-white">
                        {session.user.user_metadata.full_name || 'Thành viên'}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400 font-semibold mt-0.5">
                        {session.user.email}
                      </span>
                      <span className="mt-2.5 inline-flex w-full items-center justify-center rounded-lg bg-blue-50 dark:bg-slate-900/60 py-1.5 text-[11px] font-black text-[#2563EB] dark:text-[#35A8FF]">
                        Số dư: {balance.toLocaleString('vi-VN')}đ
                      </span>
                    </div>

                    <div className="py-1">
                      <Link
                        to="/dashboard?tab=profile"
                        onClick={() => setShowUserMenu(false)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#0F172A] dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                      >
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Hồ sơ của tôi
                      </Link>
                      
                      {isAdmin && (
                        <Link
                          to="/admin"
                          onClick={() => setShowUserMenu(false)}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#2563EB] dark:text-[#35A8FF] hover:bg-blue-50 dark:hover:bg-slate-900/40 transition"
                        >
                          <svg className="h-4 w-4 text-[#2563EB] dark:text-[#35A8FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          🛡️ Trang quản trị Admin
                        </Link>
                      )}

                      <Link
                        to="/dashboard?tab=orders"
                        onClick={() => setShowUserMenu(false)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#0F172A] dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                      >
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                        Đơn hàng
                      </Link>

                      <Link
                        to="/dashboard?tab=wallet"
                        onClick={() => setShowUserMenu(false)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#0F172A] dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                      >
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        Ví tiền
                      </Link>

                      <Link
                        to="/dashboard?tab=favorites"
                        onClick={() => setShowUserMenu(false)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#0F172A] dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                      >
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                        Sản phẩm yêu thích
                      </Link>

                      <Link
                        to="/dashboard?tab=settings"
                        onClick={() => setShowUserMenu(false)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#0F172A] dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                      >
                        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Cài đặt tài khoản
                      </Link>

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          signOut();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition border-t border-slate-100 dark:border-slate-800 mt-1.5 pt-2"
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
          </>
        )}
      </div>
    </header>
  );
}
