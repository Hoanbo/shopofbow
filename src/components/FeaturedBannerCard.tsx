import { Link } from 'react-router-dom';
import type { CatalogItem } from '../data/types';
import { ArrowRight } from './icons';

interface Props {
  item: CatalogItem;
  base?: string;
}

export default function FeaturedBannerCard({ item, base = '/products' }: Props) {
  return (
    <Link
      to={`${base}/${item.slug}`}
      className="group relative flex items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500 via-sky-600 to-blue-600 p-4 text-white shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/25 sm:rounded-3xl sm:p-5"
    >
      {/* Background subtle shine effect */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />

      <div className="flex items-center gap-3.5 pr-2 sm:gap-4">
        {/* Logo container */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/20 p-2.5 backdrop-blur-md sm:h-14 sm:w-14">
          <img src={item.image} alt={item.name} className="h-full w-full object-contain filter drop-shadow-sm" />
        </div>

        {/* Text content */}
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-1 text-base font-bold text-white sm:text-lg">{item.name}</h4>
          <p className="mt-0.5 line-clamp-2 text-xs font-medium text-sky-100/90 leading-relaxed">
            {item.tagline || item.description}
          </p>
        </div>
      </div>

      {/* Right Circle Arrow Button */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sky-600 shadow-md transition-transform duration-200 group-hover:scale-110 group-hover:bg-sky-50 sm:h-10 sm:w-10">
        <ArrowRight className="h-4 w-4 stroke-[2.5]" />
      </div>
    </Link>
  );
}
