import { NavLink } from 'react-router-dom';
import { HomeIcon, SparkIcon, StarIcon, HeadsetIcon } from './icons';

const items = [
  { to: '/', label: 'Trang chủ', Icon: HomeIcon, end: true },
  { to: '/ai-tools', label: 'Danh mục', Icon: SparkIcon },
  { to: '/premium-apps', label: 'Yêu thích', Icon: StarIcon },
  { to: '/contact', label: 'Hỗ trợ', Icon: HeadsetIcon },
];

/** Fixed bottom tab bar — mobile only (Matches Mockup). */
export default function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#EBF2FA] bg-white/95 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] backdrop-blur-md lg:hidden">
      <div className="mx-auto grid h-15 max-w-md grid-cols-4 px-2">
        {items.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] transition ${
                isActive ? 'font-bold text-[#0088FF]' : 'font-medium text-slate-400 hover:text-slate-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-5 w-5 ${isActive ? 'text-[#0088FF]' : 'text-slate-400'}`} />
                <span className="tracking-tight">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
