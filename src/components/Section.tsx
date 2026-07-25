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

export default function Section({ title, subtitle, to, icon, children, className = '' }: Props) {
  return (
    <section className={`container-bow py-6 sm:py-8 ${className}`}>
      <div className="mb-4 flex items-end justify-between gap-3 sm:mb-5">
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-gradient text-white shadow-card sm:h-10 sm:w-10">
              {icon}
            </span>
          )}
          <div>
            <h2 className="section-title">{title}</h2>
            {subtitle && <p className="text-xs text-ink-muted sm:text-sm">{subtitle}</p>}
          </div>
        </div>
        {to && (
          <Link
            to={to}
            className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-brand-600 transition hover:text-brand-700"
          >
            Xem tất cả
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
