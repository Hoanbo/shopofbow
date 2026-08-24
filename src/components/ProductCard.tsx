import { Link } from 'react-router-dom';
import type { CatalogItem } from '../data/types';
import { formatVND } from '../data/catalog';
import { StarIcon } from './icons';

interface Props {
  item: CatalogItem;
  /** route base, e.g. /ai-tools, /premium-apps, /products */
  base: string;
}

function discount(item: CatalogItem) {
  if (!item.originalPrice) return 0;
  return Math.round((1 - item.price / item.originalPrice) * 100);
}

export default function ProductCard({ item, base }: Props) {
  const off = discount(item);
  return (
    <Link
      to={`${base}/${item.slug}`}
      className="card-base card-hover group flex flex-col overflow-hidden"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-brand-50">
        <div
          className="absolute inset-0 opacity-90"
          style={{ background: `radial-gradient(120% 120% at 30% 0%, ${item.accent}22, transparent 60%)` }}
        />
        <img
          src={item.image}
          alt={item.name}
          loading="lazy"
          className="absolute inset-0 m-auto h-20 w-20 rounded-2xl object-contain shadow-soft transition duration-300 group-hover:scale-110 sm:h-24 sm:w-24"
        />
        {item.badge && (
          <span className="absolute left-3 top-3 chip bg-white/90 text-brand-700 shadow-soft backdrop-blur">
            {item.badge}
          </span>
        )}
        {off > 0 && (
          <span className="absolute right-3 top-3 chip bg-rose-500 text-white shadow-soft">-{off}%</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5 sm:p-4">
        <h3 className="line-clamp-1 font-bold text-ink">{item.name}</h3>
        <p className="line-clamp-2 text-xs text-ink-muted sm:text-sm">{item.tagline}</p>

        <div className="mt-auto flex items-center gap-1.5 pt-2 text-xs text-ink-muted">
          {item.rating != null && Number(item.rating) > 0 ? (
            <div className="flex items-center gap-1">
              <StarIcon className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-semibold text-ink-soft">{Number(item.rating).toFixed(1)}</span>
            </div>
          ) : (
            <span className="text-[11px] font-medium text-slate-400">Chưa có đánh giá</span>
          )}
          <span>· Đã bán {item.sold >= 1000 ? (item.sold / 1000).toFixed(1) + 'k' : item.sold}</span>
        </div>

        <div className="flex items-end justify-between gap-2 pt-1.5">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-base font-extrabold text-brand-600 sm:text-lg">{formatVND(item.price)}</span>
            {item.originalPrice && (
              <span className="text-xs text-ink-muted line-through">{formatVND(item.originalPrice)}</span>
            )}
          </div>
          <span className="btn-primary shrink-0 !px-3.5 !py-2 !text-xs">Xem chi tiết</span>
        </div>
      </div>
    </Link>
  );
}
