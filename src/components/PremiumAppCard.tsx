import { Link } from 'react-router-dom';
import type { CatalogItem } from '../data/types';
import { formatVND } from '../data/catalog';
import { StarIcon, ArrowRight } from './icons';

interface Props {
  item: CatalogItem;
}

function discount(item: CatalogItem) {
  if (!item.originalPrice) return 0;
  return Math.round((1 - item.price / item.originalPrice) * 100);
}

/** Horizontal app card used in the Premium Apps section (matches reference). */
export default function PremiumAppCard({ item }: Props) {
  const off = discount(item);
  return (
    <Link
      to={`/premium-apps/${item.slug}`}
      className="card-base group flex items-center gap-3.5 p-3 hover:-translate-y-0.5 hover:shadow-card sm:p-4"
    >
      <div
        className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl shadow-soft sm:h-[70px] sm:w-[70px]"
        style={{ backgroundColor: `${item.accent}14` }}
      >
        <img src={item.image} alt={item.name} loading="lazy" className="h-10 w-10 rounded-xl object-contain sm:h-11 sm:w-11" />
        {off > 0 && (
          <span className="absolute -right-2 -top-2 chip bg-rose-500 px-1.5 py-0.5 text-[10px] text-white shadow-soft">
            -{off}%
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <h3 className="line-clamp-1 font-bold text-ink">{item.name}</h3>
          {item.badge && <span className="chip bg-brand-50 px-2 py-0.5 text-[10px] text-brand-700">{item.badge}</span>}
        </div>
        <p className="line-clamp-1 text-xs text-ink-muted">{item.tagline}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-extrabold text-brand-600">{formatVND(item.price)}</span>
          <span className="flex items-center gap-0.5 text-[11px] text-ink-muted">
            <StarIcon className="h-3 w-3 text-amber-400" />
            {item.rating}
          </span>
        </div>
      </div>

      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 transition group-hover:bg-brand-gradient group-hover:text-white">
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
