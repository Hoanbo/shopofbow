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
      className="group relative flex h-[120px] sm:h-[135px] w-full items-center justify-between overflow-hidden rounded-[26px] bg-gradient-to-r from-[#00A3FF] via-[#0088FF] to-[#2563EB] p-5 sm:p-6 text-white shadow-[0_8px_28px_rgba(0,140,255,0.25)] transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.03] hover:shadow-[0_14px_36px_rgba(0,140,255,0.36)]"
    >
      <div className="flex items-center gap-4 pr-3 min-w-0 flex-1">
        {/* Vector App Logo container */}
        <AppLogo
          slug={item.slug}
          name={item.name}
          image={item.image}
          className="h-[56px] w-[56px] shrink-0 sm:h-[64px] sm:w-[64px]"
        />

        {/* Text content */}
        <div className="min-w-0 flex-1 text-left">
          <h4 className="line-clamp-1 text-base font-extrabold text-white sm:text-lg">{item.name}</h4>
          <p className="mt-1 line-clamp-2 text-xs font-normal text-sky-100/90 leading-tight sm:text-sm">
            {item.tagline || item.description}
          </p>
        </div>
      </div>

      {/* Right Circle Arrow Button */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#0088FF] shadow-md transition-all duration-300 group-hover:scale-110 group-hover:bg-blue-50 sm:h-11 sm:w-11">
        <ArrowRight className="h-5 w-5 stroke-[2.5] transition-transform duration-300 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
