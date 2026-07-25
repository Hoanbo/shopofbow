import { useMemo, useState } from 'react';
import type { CatalogItem } from '../data/types';
import { fetchByCategory } from '../data/api';
import { useAsync } from '../hooks/useAsync';
import ProductCard from '../components/ProductCard';
import PremiumAppCard from '../components/PremiumAppCard';
import Skeleton from '../components/Skeleton';
import { SearchIcon } from '../components/icons';
import { useSeo } from '../hooks/useSeo';

type Sort = 'popular' | 'price-asc' | 'price-desc' | 'rating';

interface Props {
  category: CatalogItem['category'];
  base: string;
  title: string;
  subtitle: string;
  /** layout: grid of ProductCards, or stacked PremiumAppCards */
  layout?: 'grid' | 'list';
}

const sortLabels: Record<Sort, string> = {
  popular: 'Phổ biến',
  'price-asc': 'Giá thấp → cao',
  'price-desc': 'Giá cao → thấp',
  rating: 'Đánh giá cao',
};

export default function Listing({ category, base, title, subtitle, layout = 'grid' }: Props) {
  useSeo({ title, description: subtitle });
  const { data: all = [], loading } = useAsync(() => fetchByCategory(category), [category]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('popular');

  const items = useMemo(() => {
    let list = all;
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter(
        (i) => i.name.toLowerCase().includes(t) || i.tagline.toLowerCase().includes(t),
      );
    }
    const sorted = [...list];
    switch (sort) {
      case 'price-asc':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      default:
        sorted.sort((a, b) => b.sold - a.sold);
    }
    return sorted;
  }, [all, q, sort]);

  return (
    <div className="container-bow py-6 sm:py-8">
      {/* page header */}
      <div className="rounded-[1.5rem] bg-hero-gradient px-5 py-7 text-white shadow-hero sm:px-8 sm:py-9">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
        <p className="mt-1.5 max-w-xl text-sm text-white/85 sm:text-base">{subtitle}</p>
      </div>

      {/* controls */}
      <div className="sticky top-16 z-30 -mx-4 mt-5 flex flex-col gap-3 bg-sky-soft/80 px-4 py-3 backdrop-blur sm:top-20 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex h-11 items-center gap-2 rounded-pill border border-brand-100 bg-white px-4 shadow-soft sm:max-w-xs">
          <SearchIcon className="h-5 w-5 shrink-0 text-brand-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Tìm trong ${title}...`}
            className="w-full bg-transparent text-sm placeholder:text-ink-muted focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {(Object.keys(sortLabels) as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`shrink-0 rounded-pill px-3.5 py-2 text-sm font-semibold transition ${
                sort === s
                  ? 'bg-brand-gradient text-white shadow-card'
                  : 'border border-brand-100 bg-white text-ink-soft hover:bg-brand-50'
              }`}
            >
              {sortLabels[s]}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-ink-muted">
        {loading ? 'Đang tải...' : `${items.length} sản phẩm`}
        {!loading && q && ` cho "${q}"`}
      </p>

      {loading ? (
        <div
          className={
            layout === 'list'
              ? 'mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4'
              : 'mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4'
          }
        >
          <Skeleton count={layout === 'list' ? 4 : 8} variant={layout === 'list' ? 'app' : 'product'} />
        </div>
      ) : items.length === 0 ? (
        <div className="grid place-items-center rounded-card border border-brand-100 bg-white py-16 text-center">
          <p className="text-ink-muted">Không tìm thấy sản phẩm phù hợp.</p>
        </div>
      ) : layout === 'list' ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {items.map((item) => (
            <PremiumAppCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {items.map((item) => (
            <ProductCard key={item.id} item={item} base={base} />
          ))}
        </div>
      )}
    </div>
  );
}
