import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { useRealtimeEvent } from '../../services/realtime';
import { resolveNotificationDestination } from '../../utils/notificationRouter';
import newLogo from '../../assets/new-logover2.png';
import {
  HomeIcon,
  CheckIcon,
  BagIcon,
  AppIcon,
  SparkIcon,
  MenuIcon,
  CloseIcon,
  StarIcon,
} from '../../components/icons';

const UserIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const AuditIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const TicketIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
  </svg>
);

const TagIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

const FaqIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SettingsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const AffiliateIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

interface NavItem {
  to: string;
  label: string;
  Icon: (props: React.SVGProps<SVGSVGElement>) => JSX.Element;
  end?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// Grouped Admin Sidebar navigation categories
const navGroups: NavGroup[] = [
  {
    title: 'Tổng quan & Bán hàng',
    items: [
      { to: '/admin', label: 'Tổng quan', Icon: HomeIcon, end: true },
      { to: '/admin/orders', label: 'Đơn hàng', Icon: CheckIcon },
      { to: '/admin/tickets', label: 'Ticket hỗ trợ', Icon: TicketIcon },
      { to: '/admin/affiliates', label: 'Tiếp thị liên kết', Icon: AffiliateIcon },
    ],
  },
  {
    title: 'Sản phẩm & Khuyến mãi',
    items: [
      { to: '/admin/products', label: 'Sản phẩm', Icon: BagIcon },
      { to: '/admin/prompts', label: 'Thư viện Prompt', Icon: SparkIcon },
      { to: '/admin/reviews', label: 'Đánh giá sản phẩm', Icon: StarIcon },
      { to: '/admin/categories', label: 'Danh mục', Icon: AppIcon },
      { to: '/admin/coupons', label: 'Mã giảm giá', Icon: TagIcon },
    ],
  },
  {
    title: 'Hệ thống & Người dùng',
    items: [
      { to: '/admin/users', label: 'Người dùng & CTV', Icon: UserIcon },
      { to: '/admin/activity', label: 'Nhật ký hoạt động', Icon: AuditIcon },
      { to: '/admin/faqs', label: 'FAQ chung', Icon: FaqIcon },
      { to: '/admin/settings', label: 'Cài đặt hệ thống', Icon: SettingsIcon },
    ],
  },
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
  type Notif = {
    id: string;
    type?: string;
    title: string;
    message: string;
    order_id?: string | null;
    ticket_id?: string | null;
    target_type?: string | null;
    target_id?: string | null;
    is_read: boolean;
    is_admin?: boolean;
    created_at: string;
  };
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const unreadCount = notifs.filter((n) => !n.is_read).length;

  // Fetch admin notifications from DB
  const fetchNotifs = async () => {
    const { data } = await (supabase
      .from('notifications')
      .select('id, type, title, message, order_id, ticket_id, target_type, target_id, is_read, is_admin, created_at')
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
    const dest = resolveNotificationDestination(notification, true);
    nav(dest);
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
    // Realtime được xử lý bởi admin-hub-global trong RealtimeHub
  }, []);

  // Thêm notification mới vào danh sách khi Hub phát sự kiện INSERT (is_admin = true)
  const handleAdminNotifInsert = useCallback((e: { eventType: 'INSERT'; payload: { id: string; title: string; message: string; order_id?: string | null; is_read: boolean; is_admin: boolean; created_at: string } }) => {
    if (!e.payload.is_admin) return;
    setNotifs((prev) => {
      if (prev.some((n) => n.id === e.payload.id)) return prev;
      return [{
        id: e.payload.id,
        title: e.payload.title,
        message: e.payload.message,
        order_id: e.payload.order_id,
        is_read: e.payload.is_read,
        is_admin: e.payload.is_admin,
        created_at: e.payload.created_at,
      }, ...prev];
    });
    // Play chime sound
    if (!audioRef.current) {
      audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2ozMVia0fXJlFEvLUmLxfbRmlgtKj2Bu/DMnFgqKDR3r+7ImFQlJC1spujCk1AgICVgn+S9kE0cHCFXlN26jEoZGR5PlM6yjUcVFhlIjce0lVATEhZGi8y3m1INERROi8u5nFILERRNjcq7nlIMERRMjsq6n1INERROjcm7oFMNERROjcu6oFMNERROjcu6oFMNERROjcu6oFMNERROjcu6oFMNERROjcu6oFMNERROjcu6oFMNERROjcu6oFMNERROjcu6oFMNERROjcu6oFMNERROjcu6oFMN');
    }
    audioRef.current.currentTime = 0;
    audioRef.current.volume = 0.4;
    audioRef.current.play().catch(() => {});
  }, []);

  useRealtimeEvent('notifications:INSERT', handleAdminNotifInsert);

  // Navigation Links List component with grouped categories
  const navList = (
    <nav className="flex flex-col gap-4 mt-3">
      {navGroups.map((group) => (
        <div key={group.title} className="space-y-1">
          <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {group.title}
          </div>
          <div className="space-y-0.5">
            {group.items.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setOpenDrawer(false)}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#19A7FF]/10 to-[#2563EB]/10 dark:from-[#19A7FF]/20 dark:to-[#2563EB]/20 text-[#2563EB] dark:text-[#35A8FF] shadow-xs before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-gradient-to-b before:from-[#19A7FF] before:to-[#2563EB] before:rounded-r-md'
                      : 'text-slate-600 dark:text-slate-200 hover:bg-[#F4F8FF] dark:hover:bg-slate-800/80 hover:text-[#2563EB] dark:hover:text-white'
                  }`
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      ))}

      {/* Logout button at bottom of sidebar */}
      <button
        onClick={doSignOut}
        className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200 mt-2 border-t border-slate-100 dark:border-slate-800/60 pt-3"
      >
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        <span>Đăng xuất</span>
      </button>
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#F5F9FF] dark:bg-[#0B1224] transition-colors duration-300 text-slate-900 dark:text-slate-100 flex flex-col font-sans w-full max-w-full overflow-x-hidden">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 h-[70px] sm:h-[76px] bg-white/95 dark:bg-[#131C32]/95 backdrop-blur-md border-b border-[#E8F1FF] dark:border-[#1E2A4A]/50 transition-colors duration-300">
        <div className="h-full px-3.5 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Logo & Menu Trigger */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            <button
              onClick={() => setOpenDrawer((v) => !v)}
              className="grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] hover:bg-[#F5F9FF] dark:hover:bg-slate-800 transition lg:hidden shadow-xs text-slate-500 dark:text-slate-400"
              aria-label="Menu"
            >
              {openDrawer ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>

            <Link to="/admin" className="flex items-center gap-2 group">
              <img
                src={newLogo}
                alt="BOW Logo"
                className="h-[34px] sm:h-[42px] w-auto object-contain transition-transform duration-200 group-hover:scale-105 filter contrast-[1.25] saturate-[1.3] brightness-[0.95] drop-shadow-[0_0_1px_rgba(15,23,42,0.85)] drop-shadow-[0_2px_5px_rgba(2,132,199,0.35)] dark:filter-none dark:contrast-[1.1] dark:drop-shadow-[0_0_8px_rgba(0,163,255,0.45)]"
              />
              <div className="flex flex-col leading-none">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg sm:text-2xl font-black tracking-tight text-[#00A3FF]">BOW</span>
                  <span className="text-[9px] sm:text-[10px] font-extrabold uppercase px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-900/40 text-[#2563EB] dark:text-[#35A8FF] rounded-md">
                    Admin
                  </span>
                </div>
                <span className="text-[7px] sm:text-[7.5px] font-black uppercase tracking-widest text-[#FFB703] mt-0.5">
                  Management Portal
                </span>
              </div>
            </Link>
          </div>

          {/* Quick Actions / Notifications / Theme / Avatar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* View Storefront Button */}
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              title="Mở trang cửa hàng"
              className="flex items-center gap-1.5 h-10 sm:h-11 px-2.5 sm:px-4 rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] hover:bg-[#F0F7FF] dark:hover:bg-slate-800 transition shadow-xs text-slate-500 dark:text-slate-400 text-xs font-bold hover:text-[#2563EB] dark:hover:text-[#35A8FF]"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span className="hidden xs:inline">Xem Website</span>
            </a>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] hover:bg-[#F5F9FF] dark:hover:bg-slate-800 transition shadow-xs text-slate-500 dark:text-slate-400"
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
                className="relative grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-2xl border border-[#E8F1FF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] hover:bg-[#F5F9FF] dark:hover:bg-slate-800 transition shadow-xs text-slate-500 dark:text-slate-400"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-[22px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C32] shadow-2xl z-50 overflow-hidden animate-scale-up">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">Thông báo Admin</span>
                        {unreadCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 text-[10px] font-black">
                            {unreadCount} mới
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs font-bold text-[#2563EB] dark:text-[#38bdf8] hover:underline">
                          Đã đọc tất cả
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
      <div className="mx-auto flex w-full max-w-[1360px] gap-6 lg:gap-8 px-3.5 sm:px-6 py-5 sm:py-8 flex-1 min-w-0">
        {/* Sidebar desktop */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto scrollbar-none rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-4 shadow-xs transition-colors duration-300">
            {navList}
          </div>
        </aside>

        {/* Sidebar mobile drawer */}
        {openDrawer && (
          <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setOpenDrawer(false)}>
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" />
            <div
              className="absolute left-0 top-0 bottom-0 w-72 max-h-screen overflow-y-auto bg-white dark:bg-[#131C32] p-5 shadow-2xl transition-all animate-fade-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <img
                    src={newLogo}
                    alt="BOW Logo"
                    className="h-8 w-auto object-contain filter contrast-[1.25] saturate-[1.3] brightness-[0.95] drop-shadow-[0_0_1px_rgba(15,23,42,0.85)] drop-shadow-[0_2px_4px_rgba(2,132,199,0.35)] dark:filter-none dark:contrast-[1.1] dark:drop-shadow-[0_0_8px_rgba(0,163,255,0.45)]"
                  />
                  <div className="flex flex-col leading-none">
                    <span className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1">
                      <span className="text-[#00A3FF]">BOW</span>
                      <span className="text-[9px] font-extrabold uppercase px-1 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-[#35A8FF] rounded">
                        Admin
                      </span>
                    </span>
                  </div>
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
        <main className="min-w-0 flex-1 w-full max-w-full overflow-x-hidden animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
