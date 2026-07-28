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
      className="group relative flex items-center justify-between overflow-hidden rounded-[22px] bg-gradient-to-r from-[#00A3FF] via-[#0088FF] to-[#0066FF] p-3.5 text-white shadow-[0_6px_20px_rgba(0,140,255,0.2)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(0,140,255,0.3)] sm:rounded-[24px] sm:p-4"
    >
      <div className="flex items-center gap-3 pr-2 sm:gap-3.5">
        {/* Logo container */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-white/20 p-2 backdrop-blur-md sm:h-13 sm:w-13">
          <img src={item.image} alt={item.name} className="h-full w-full object-contain filter drop-shadow-xs" />
        </div>

        {/* Text content */}
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-1 text-sm font-bold text-white sm:text-base">{item.name}</h4>
          <p className="mt-0.5 line-clamp-2 text-[11px] font-normal text-sky-100/90 leading-tight sm:text-xs">
            {item.tagline || item.description}
          </p>
        </div>
      </div>

      {/* Right Circle Arrow Button */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#0088FF] shadow-sm transition-transform duration-200 group-hover:scale-110 sm:h-9 sm:w-9">
        <ArrowRight className="h-4 w-4 stroke-[2.5]" />
      </div>
    </Link>
  );
}
