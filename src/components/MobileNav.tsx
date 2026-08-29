import { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { HomeIcon, AppIcon, HeadsetIcon, SparkIcon } from './icons';
import { useAuth } from '../context/AuthContext';
import UserBottomSheet from './user/UserBottomSheet';

const items = [
  { to: '/', label: 'Trang chủ', Icon: HomeIcon, end: true },
  { to: '/products', label: 'Sản phẩm', Icon: AppIcon },
  { to: '/prompts', label: 'Prompt AI', Icon: SparkIcon },
  { to: '/contact', label: 'Hỗ trợ', Icon: HeadsetIcon },
];

export default function MobileNav() {
  const { session, profile, isAdmin } = useAuth();
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const location = useLocation();

  const userAvatarUrl = profile?.avatar_url || session?.user?.user_metadata?.avatar_url || null;
  const isDashboardActive = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/admin');

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-50 rounded-t-[22px] border-t border-[#E7EEF8] dark:border-slate-800 bg-white/95 dark:bg-[#11192C]/95 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-lg lg:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 px-1.5">
          {items.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 py-1.5 text-[10px] transition-all duration-200 ${
                  isActive
                    ? 'font-extrabold text-[#2563EB] dark:text-[#35A8FF] scale-105'
                    : 'font-medium text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-5 w-5 ${isActive ? 'text-[#2563EB] dark:text-[#35A8FF]' : 'text-[#64748B] dark:text-slate-400'}`} />
                  <span className="tracking-tight">{label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* Tab 5: Tài khoản (Mở Bottom Sheet nếu đã đăng nhập / Chuyển login nếu chưa) */}
          {session ? (
            <button
              type="button"
              onClick={() => setShowBottomSheet(true)}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 text-[10px] transition-all duration-200 cursor-pointer ${
                showBottomSheet || isDashboardActive
                  ? 'font-extrabold text-[#2563EB] dark:text-[#35A8FF] scale-105'
                  : 'font-medium text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              <div className="relative">
                {userAvatarUrl ? (
                  <img
                    src={userAvatarUrl}
                    alt="Avatar"
                    className={`h-5 w-5 rounded-full object-cover ring-1.5 transition ${
                      showBottomSheet || isDashboardActive
                        ? 'ring-[#2563EB] dark:ring-[#35A8FF] scale-110 shadow-xs'
                        : 'ring-slate-300 dark:ring-slate-600'
                    }`}
                  />
                ) : (
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black text-white ${
                      isAdmin ? 'bg-amber-500' : 'bg-[#2563EB]'
                    }`}
                  >
                    {(session.user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                {isAdmin && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-amber-400 ring-1 ring-white dark:ring-slate-900" />
                )}
              </div>
              <span className="tracking-tight">Tài khoản</span>
            </button>
          ) : (
            <Link
              to="/login"
              state={{ from: location.pathname }}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 text-[10px] transition-all duration-200 ${
                location.pathname === '/login'
                  ? 'font-extrabold text-[#2563EB] dark:text-[#35A8FF]'
                  : 'font-medium text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="tracking-tight">Đăng nhập</span>
            </Link>
          )}
        </div>
      </nav>

      {/* Bottom Sheet Menu cho Mobile */}
      <UserBottomSheet isOpen={showBottomSheet} onClose={() => setShowBottomSheet(false)} />
    </>
  );
}

