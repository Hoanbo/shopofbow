import { Link } from 'react-router-dom';
import { ChevronRight } from './icons';

interface Props {
  title: string;
  subtitle?: string;
  to?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function Section({ title, to, icon, children, className = '' }: Props) {
  return (
    <section className={`container-bow py-4 sm:py-6 ${className}`}>
      <div className="mb-3.5 flex items-center justify-between gap-3 sm:mb-5">
        <div className="flex items-center gap-2">
          {icon && <span className="text-sky-500">{icon}</span>}
          <h2 className="text-base font-extrabold tracking-tight text-slate-900 sm:text-xl">{title}</h2>
        </div>
        {to && (
          <Link
            to={to}
            className="group flex shrink-0 items-center gap-1 text-xs font-semibold text-[#0088FF] transition hover:text-sky-600 sm:text-sm"
          >
            Xem tất cả <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
