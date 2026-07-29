import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  HomeIcon,
  CheckIcon,
  BagIcon,
  AppIcon,
  SparkIcon,
  PhoneIcon,
  MenuIcon,
  CloseIcon,
  BoltIcon
} from '../../components/icons';

// Sidebar navigation links
const links = [
  { to: '/admin', label: 'Tổng quan', Icon: HomeIcon, end: true },
  { to: '/admin/orders', label: 'Đơn hàng', Icon: CheckIcon },
  { to: '/admin/products', label: 'Sản phẩm', Icon: BagIcon },
  { to: '/admin/categories', label: 'Danh mục', Icon: AppIcon },
  { to: '/admin/faqs', label: 'FAQ chung', Icon: SparkIcon },
  { to: '/admin/contact', label: 'Hộp thư liên hệ', Icon: PhoneIcon },
  { to: '/admin/settings', label: 'Cài đặt hệ thống', Icon: BoltIcon },
];

export default function AdminLayout() {
  const { signOut, session } = useAuth();
  const nav = useNavigate();
  
  // Layout States
  const [openDrawer, setOpenDrawer] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
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

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const doSignOut = async () => {
    await signOut();
    nav('/admin/login', { replace: true });
  };

  // Mock Notifications
  const mockAlerts = [
    { id: 1, text: '📦 Đơn hàng mới #BOW92746 cần bàn giao', time: '5 phút trước' },
    { id: 2, text: '✉️ Tin nhắn liên hệ mới từ khách hàng', time: '20 phút trước' },
    { id: 3, text: '🔔 Hệ thống đã đối soát tự động thành công', time: '1 giờ trước' },
  ];

  // Navigation Links List component
  const navList = (
    <nav className="flex flex-col gap-1.5 mt-6">
      {links.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpenDrawer(false)}
          className={({ isActive }) =>
            `relative flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-xs font-bold transition-all duration-200 ${
              isActive
                ? 'bg-gradient-to-r from-[#19A7FF]/10 to-[#2563EB]/10 dark:from-[#19A7FF]/20 dark:to-[#2563EB]/20 text-[#2563EB] dark:text-[#35A8FF] shadow-xs before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:bg-gradient-to-b before:from-[#19A7FF] before:to-[#2563EB] before:rounded-r-md'
                : 'text-slate-500 dark:text-slate-400 hover:bg-[#F4F8FF] dark:hover:bg-slate-800/50 hover:text-[#2563EB]'
            }`
          }
        >
          <Icon className="h-5 w-5 shrink-0" />
          {label}
        </NavLink>
      ))}

      {/* Logout button at bottom of sidebar */}
      <button
        onClick={doSignOut}
        className="flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200 mt-6 border-t border-slate-100 dark:border-slate-800/60 pt-4"
      >
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Đăng xuất
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F5F9FF] dark:bg-[#0B1224] transition-colors duration-300 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 h-[76px] bg-white/95 dark:bg-[#131C32]/95 backdrop-blur-md border-b border-[#E8F1FF] dark:border-[#1E2A4A]/50 transition-colors duration-300">
        <div className="h-full px-6 flex items-center justify-between gap-4">
          
          {/* Logo & Menu Trigger */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setOpenDrawer((v) => !v)}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] hover:bg-[#F5F9FF] dark:hover:bg-slate-800 transition lg:hidden shadow-xs text-slate-500 dark:text-slate-400"
              aria-label="Menu"
            >
              {openDrawer ? <CloseIcon className="h-5.5 w-5.5" /> : <MenuIcon className="h-5.5 w-5.5" />}
            </button>

            <Link to="/admin" className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#19A7FF] to-[#2563EB] text-sm font-black text-white shadow-md">
                B
              </span>
              <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white sm:block">
                BOW <span className="text-[#2563EB] dark:text-[#35A8FF] font-black">Admin</span>
              </span>
            </Link>
          </div>

          {/* Quick Actions / Notifications / Theme / Avatar */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] hover:bg-[#F5F9FF] dark:hover:bg-slate-800 transition shadow-xs text-slate-500 dark:text-slate-400"
              title={theme === 'light' ? 'Bật Dark Mode' : 'Bật Light Mode'}
            >
              {theme === 'light' ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              )}
            </button>

            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications((v) => !v)}
                className="relative grid h-11 w-11 place-items-center rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] hover:bg-[#F5F9FF] dark:hover:bg-slate-800 transition shadow-xs text-slate-500 dark:text-slate-400"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute right-3.5 top-3.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#131C32]" />
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 mt-2 z-50 w-80 rounded-[22px] border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] p-4 shadow-xl text-left animate-fade-up">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">Thông báo mới</h4>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/60 max-h-60 overflow-y-auto">
                      {mockAlerts.map((alert) => (
                        <div key={alert.id} className="py-2.5 space-y-0.5">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-snug">{alert.text}</p>
                          <span className="text-[10px] text-slate-400 font-medium">{alert.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Profile Info */}
            <div className="hidden items-center gap-2.5 sm:flex border-l border-slate-100 dark:border-slate-800 pl-3.5">
              <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#19A7FF] to-[#2563EB] text-xs font-black text-white flex items-center justify-center shadow-xs">
                {(session?.user.email || 'A').charAt(0).toUpperCase()}
              </div>
              <div className="text-left leading-none">
                <span className="block text-xs font-black text-slate-900 dark:text-white truncate max-w-[120px]">
                  {session?.user.user_metadata.full_name || 'Admin'}
                </span>
                <span className="text-[9px] font-bold text-slate-400 mt-0.5 block truncate max-w-[120px]">
                  {session?.user.email}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Layout container */}
      <div className="mx-auto flex w-full max-w-[1360px] gap-8 px-6 py-8 flex-1">
        {/* Sidebar desktop */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-28 rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-4 shadow-xs transition-colors duration-300">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 block">Điều hướng</span>
            {navList}
          </div>
        </aside>

        {/* Sidebar mobile drawer */}
        {openDrawer && (
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpenDrawer(false)}>
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" />
            <div
              className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-[#131C32] p-5 shadow-2xl transition-all animate-fade-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#19A7FF] to-[#2563EB] text-xs font-black text-white shadow-xs">B</span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white">BOW Admin</span>
                </div>
                <button
                  onClick={() => setOpenDrawer(false)}
                  className="h-8 w-8 rounded-full border border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-50"
                >
                  <CloseIcon className="h-4.5 w-4.5" />
                </button>
              </div>
              {navList}
            </div>
          </div>
        )}

        {/* Main Routing Content viewport */}
        <main className="min-w-0 flex-1 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
