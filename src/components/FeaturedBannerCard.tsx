import { Link } from 'react-router-dom';
import type { CatalogItem } from '../data/types';
import { ArrowRight } from './icons';
import AppLogo from './AppLogo';

interface Props {
  item: CatalogItem;
  base?: string;
}

export default function FeaturedBannerCard({ item, base = '/products' }: Props) {
  return (
    <Link
      to={`${base}/${item.slug}`}
      className="group relative flex h-[105px] sm:h-[120px] w-full items-center justify-between overflow-hidden rounded-[22px] bg-gradient-to-r from-[#00A3FF] via-[#0088FF] to-[#2563EB] px-4 py-3 text-white shadow-[0_6px_24px_rgba(0,140,255,0.2)] transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[0_12px_32px_rgba(0,140,255,0.32)] sm:px-5"
    >
      <div className="flex items-center gap-3.5 pr-2 sm:gap-4 min-w-0 flex-1">
        {/* Vector App Logo container */}
        <AppLogo
          slug={item.slug}
          name={item.name}
          image={item.image}
          className="h-[52px] w-[52px] shrink-0 sm:h-[60px] sm:w-[60px]"
        />

        {/* Text content */}
        <div className="min-w-0 flex-1 text-left">
          <h4 className="line-clamp-1 text-sm font-bold text-white sm:text-base">{item.name}</h4>
          <p className="mt-0.5 line-clamp-2 text-[11px] font-normal text-sky-100 leading-tight sm:text-xs">
            {item.tagline || item.description}
          </p>
        </div>
      </div>

      {/* Right Circle Arrow Button */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#2563EB] shadow-md transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-50 sm:h-10 sm:w-10">
        <ArrowRight className="h-4 w-4 stroke-[2.5] transition-transform duration-300 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
