import { Link } from 'react-router-dom';
import type { CatalogItem } from '../data/types';
import { formatVND } from '../data/catalog';
import { StarIcon } from './icons';

interface Props {
  item: CatalogItem;
}

/** Compact icon-tile card used in the AI Tools grid (matches reference). */
export default function AIToolCard({ item }: Props) {
  return (
    <Link
      to={`/ai-tools/${item.slug}`}
      className="card-base group flex flex-col items-center gap-2 p-4 text-center hover:-translate-y-1 hover:shadow-card"
    >
      <div
        className="grid h-16 w-16 place-items-center rounded-2xl shadow-soft transition group-hover:scale-105"
        style={{ backgroundColor: `${item.accent}14` }}
      >
        <img src={item.image} alt={item.name} loading="lazy" className="h-10 w-10 rounded-xl object-contain" />
      </div>
      <h3 className="line-clamp-1 text-sm font-bold text-ink">{item.name}</h3>
      <div className="flex items-center gap-1 text-[11px] text-ink-muted">
        <StarIcon className="h-3 w-3 text-amber-400" />
        <span className="font-semibold text-ink-soft">{item.rating}</span>
      </div>
      <span className="text-sm font-extrabold text-brand-600">{formatVND(item.price)}</span>
    </Link>
  );
}
