import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
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

const UserIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

// Sidebar navigation links
const links = [
  { to: '/admin', label: 'Tổng quan', Icon: HomeIcon, end: true },
  { to: '/admin/orders', label: 'Đơn hàng', Icon: CheckIcon },
  { to: '/admin/users', label: 'Người dùng', Icon: UserIcon },
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
    nav('/', { replace: true });
  };

  // ── Real Notifications from DB ──────────────────────────────
  type Notif = { id: string; title: string; message: string; order_id?: string | null; is_read: boolean; created_at: string };
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const unreadCount = notifs.filter((n) => !n.is_read).length;

  // Fetch admin notifications from DB
  const fetchNotifs = async () => {
    const { data } = await (supabase
      .from('notifications')
      .select('id, title, message, order_id, is_read, created_at')
      .eq('is_admin', true)
      .order('created_at', { ascending: false })
      .limit(30) as any);
    if (data) setNotifs(data);
  };

  // Mark all as read
  const markAllRead = async () => {
    await (supabase.from('notifications') as any)
      .update({ is_read: true })
      .eq('is_admin', true)
      .eq('is_read', false);
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const openOrderFromNotification = async (notification: Notif) => {
    if (!notification.is_read) {
      await (supabase.from('notifications') as any)
        .update({ is_read: true })
        .eq('id', notification.id);
      setNotifs((prev) => prev.map((n) => n.id === notification.id ? { ...n, is_read: true } : n));
    }
    setShowNotifications(false);
    nav(notification.order_id
      ? `/admin/orders?order_id=${encodeURIComponent(notification.order_id)}`
      : '/admin/orders');
  };

  // Format relative time
  const relTime = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return `${Math.floor(diff / 86400)} ngày trước`;
  };

  useEffect(() => {
    fetchNotifs();

    // Subscribe to new admin notifications via Realtime
    const channel = supabase
      .channel('admin-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: 'is_admin=eq.true',
      }, (payload) => {
        const newNotif = payload.new as Notif;
        setNotifs((prev) => [newNotif, ...prev]);
        // Play chime sound
        if (!audioRef.current) {
          audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2ozMVia0fXJlFEvLUmLxfbRmlgtKj2Bu/DMnFgqKDR3r+7ImFQlJC1spujCk1AgICVgn+S9kE0cHCFXlN26jEoZGR5PlM6yjUcVFhlIjce0lVATEhZGi8y3m1INERROi8u5nFILERRNjcq7nlIMERRMjsq6n1INERROjcm7oFMNERROjcu6oFMNERROjcu6oFMNERROjcu6oFMNERROjcu6oFMNERROjcu6oFMNERROjcu6oFMNERROjcu6oFMNERROjcu6oFMNERROjcu6oFMNERROjcu6oFMN');
        }
        audioRef.current.currentTime = 0;
        audioRef.current.volume = 0.4;
        audioRef.current.play().catch(() => {});
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
            {/* View Storefront Button */}
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              title="Mở trang cửa hàng"
              className="hidden sm:flex items-center gap-1.5 h-11 px-4 rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] hover:bg-[#F0F7FF] dark:hover:bg-slate-800 transition shadow-xs text-slate-500 dark:text-slate-400 text-xs font-bold hover:text-[#2563EB] dark:hover:text-[#35A8FF]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Xem Website
            </a>

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
                onClick={() => { setShowNotifications((v) => !v); if (!showNotifications) fetchNotifs(); }}
                className="relative grid h-11 w-11 place-items-center rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] hover:bg-[#F5F9FF] dark:hover:bg-slate-800 transition shadow-xs text-slate-500 dark:text-slate-400"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white ring-2 ring-white dark:ring-[#131C32]">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 mt-2 z-50 w-80 rounded-[22px] border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] shadow-xl text-left animate-fade-up overflow-hidden">
                    <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Thông báo {unreadCount > 0 && <span className="ml-1 rounded-full bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 text-[9px]">{unreadCount} mới</span>}
                      </h4>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-[10px] font-bold text-[#2563EB] hover:underline">
                          Đánh dấu đã đọc
                        </button>
                      )}
                    </div>
                    <div className="divide-y divide-slate-50 dark:divide-slate-800/50 max-h-72 overflow-y-auto">
                      {notifs.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400 font-medium">Chưa có thông báo nào</div>
                      ) : notifs.map((n) => (
                        <button type="button" key={n.id} onClick={() => openOrderFromNotification(n)} className={`block w-full px-4 py-3 text-left space-y-0.5 transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/20 ${ !n.is_read ? 'bg-blue-50/60 dark:bg-blue-950/20' : '' }`}>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-snug">{n.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{n.message}</p>
                          <span className="text-[10px] text-slate-400 font-medium">{relTime(n.created_at)}</span>
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-slate-100 dark:border-slate-800 p-2.5 text-center bg-slate-50/50 dark:bg-slate-900/50">
                      <Link
                        to="/admin/orders"
                        onClick={() => setShowNotifications(false)}
                        className="text-[11px] font-extrabold text-[#2563EB] dark:text-[#38bdf8] hover:underline"
                      >
                        Quản lý tất cả đơn hàng →
                      </Link>
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
