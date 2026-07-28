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
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-100 bg-white/95 shadow-lg backdrop-blur-lg lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 px-2">
        {items.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition ${
                isActive ? 'text-sky-600 font-bold' : 'text-slate-500 hover:text-slate-700'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-5 w-5 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
                <span className="tracking-tight">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
