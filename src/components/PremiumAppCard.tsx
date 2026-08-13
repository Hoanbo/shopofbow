import { Link } from 'react-router-dom';
import type { CatalogItem } from '../data/types';
import AppLogo from './AppLogo';
import { useFavorites } from '../context/FavoritesContext';

interface Props {
  item: CatalogItem;
}

export default function PremiumAppCard({ item }: Props) {
  const { isFavorite } = useFavorites();
  const fav = isFavorite(item.id) || isFavorite(item.slug);

  return (
    <Link
      to={`/products/${item.slug}`}
      className="group relative flex flex-col items-center justify-between h-full rounded-2xl sm:rounded-[28px] border border-[#E7EEF8] dark:border-slate-800/80 bg-white dark:bg-slate-900 p-2.5 xs:p-3 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.02] hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-[0_12px_30px_rgba(0,140,255,0.12)] text-center"
    >
      {/* Favorite Indicator Badge (Only shown when product is favorited) */}
      {fav && (
        <span
          title="Sản phẩm đã yêu thích"
          className="absolute top-2 right-2 z-10 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-rose-50/90 dark:bg-rose-950/90 border border-rose-200 dark:border-rose-900/60 text-rose-500 shadow-xs backdrop-blur-xs animate-fade-in"
        >
          <svg className="h-3.5 w-3.5 fill-rose-500 stroke-rose-500" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 016.364 0L12 7.636l1.318-1.318a4.5 4.5 0 116.364 6.364L12 21.364l-7.682-7.682a4.5 4.5 0 010-6.364z" />
          </svg>
        </span>
      )}

      <div className="flex flex-col items-center w-full min-w-0">
        <AppLogo
          slug={item.slug}
          name={item.name}
          image={item.image}
          className="h-16 w-16 xs:h-20 xs:w-20 sm:h-[84px] sm:w-[84px] transition-transform duration-300 group-hover:scale-105"
        />
        <h3 className="mt-2 w-full truncate text-xs xs:text-sm font-extrabold text-[#0F172A] dark:text-white sm:mt-4 sm:text-base leading-tight">
          {item.name}
        </h3>
      </div>

      <span className="mt-2.5 sm:mt-4 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] py-1.5 px-1.5 xs:px-2.5 sm:px-4 text-[10px] xs:text-[11.5px] sm:text-sm font-bold text-white whitespace-nowrap shadow-xs transition-all duration-300 group-hover:from-[#0080E0] group-hover:to-[#1D4ED8]">
        Xem chi tiết ›
      </span>
    </Link>
  );
}

