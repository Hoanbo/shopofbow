import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon } from './icons';
import { searchProducts } from '../data/api';
import { formatVND } from '../data/catalog';
import type { CatalogItem } from '../data/types';

interface Props {
  variant?: 'bar' | 'compact';
  placeholder?: string;
  className?: string;
}

const routeFor = (item: CatalogItem) => {
  const seg =
    item.category === 'ai-tool' ? 'ai-tools' : item.category === 'premium-app' ? 'premium-apps' : 'products';
  return `/${seg}/${item.slug}`;
};

export default function SearchBar({ variant = 'bar', placeholder = 'Tìm ChatGPT, Netflix, Canva...', className = '' }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const wrap = useRef<HTMLDivElement>(null);

  // debounced async search against Supabase
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let alive = true;
    const t = setTimeout(() => {
      searchProducts(term)
        .then((r) => {
          if (alive) setResults(r.slice(0, 6));
        })
        .catch(() => {
          if (alive) setResults([]);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (item: CatalogItem) => {
    setOpen(false);
    setQ('');
    nav(routeFor(item));
  };

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <div
        className={`flex items-center gap-2 rounded-pill bg-white transition ${
          variant === 'bar'
            ? 'h-12 border border-brand-100 px-4 shadow-soft focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100'
            : 'h-10 border border-brand-100 px-3'
        }`}
      >
        <SearchIcon className="h-5 w-5 shrink-0 text-brand-500" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
        />
      </div>

      {open && q && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-hero">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">Đang tìm...</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">Không tìm thấy "{q}"</p>
          ) : (
            <ul className="max-h-80 overflow-auto py-1">
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => go(item)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-brand-50"
                  >
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl"
                      style={{ background: item.accent + '18' }}
                    >
                      <img src={item.image} alt="" className="h-7 w-7 object-contain" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{item.name}</span>
                      <span className="block truncate text-xs text-ink-muted">{item.group}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-brand-600">{formatVND(item.price)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
