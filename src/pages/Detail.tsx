import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CatalogItem } from '../data/types';
import { fetchBySlug, fetchByCategory, fetchFaqs } from '../data/api';
import { formatVND } from '../data/catalog';
import { useAsync } from '../hooks/useAsync';
import { useSeo } from '../hooks/useSeo';
import { useContact } from '../context/ContactContext';
import ProductCard from '../components/ProductCard';
import { ContactButtons } from '../components/ContactButtons';
import {
  StarIcon,
  CheckIcon,
  ShieldIcon,
  BoltIcon,
  HeadsetIcon,
  ChevronRight,
  MessengerIcon,
  ZaloIcon,
} from '../components/icons';

interface Props {
  category: CatalogItem['category'];
  base: string;
  crumb: string;
}

const perks = [
  { Icon: BoltIcon, label: 'Kích hoạt tức thì' },
  { Icon: ShieldIcon, label: 'Bảo hành trọn gói' },
  { Icon: HeadsetIcon, label: 'Hỗ trợ 24/7' },
];

export default function Detail({ category, base, crumb }: Props) {
  const { slug } = useParams();
  const contact = useContact();
  const { data: item, loading } = useAsync(
    () => (slug ? fetchBySlug(slug) : Promise.resolve(null)),
    [slug],
  );
  const { data: related = [] } = useAsync(() => fetchByCategory(category), [category]);
  const { data: faqs = [] } = useAsync(() => (item ? fetchFaqs(item.id) : Promise.resolve([])), [item?.id]);
  const [plan, setPlan] = useState(0);

  useSeo({
    title: item?.name,
    description: item?.description || item?.tagline,
    image: item?.image,
    type: 'product',
  });

  if (loading) {
    return (
      <div className="container-bow py-20">
        <div className="mx-auto h-8 w-40 animate-pulse rounded-pill bg-brand-100" />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-[1.5rem] bg-brand-100" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded-pill bg-brand-100" />
            <div className="h-20 animate-pulse rounded-2xl bg-brand-100" />
            <div className="h-24 animate-pulse rounded-2xl bg-brand-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!item || item.category !== category) {
    return (
      <div className="container-bow py-20 text-center">
        <h1 className="text-2xl font-bold text-ink">Không tìm thấy sản phẩm</h1>
        <Link to={base} className="btn-primary mt-6">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const relatedItems = related.filter((i) => i.id !== item.id).slice(0, 4);
  const active = item.plans[plan] ?? item.plans[0];
  const fbHref = contact.facebookUrl && contact.facebookUrl !== '#' ? contact.facebookUrl : undefined;
  const zaloHref = contact.zaloUrl && contact.zaloUrl !== '#' ? contact.zaloUrl : undefined;

  return (
    <div className="container-bow py-5 sm:py-7">
      {/* breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1 text-xs text-ink-muted sm:text-sm">
        <Link to="/" className="hover:text-brand-600">
          Trang chủ
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to={base} className="hover:text-brand-600">
          {crumb}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate font-semibold text-ink-soft">{item.name}</span>
      </nav>

      <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:gap-10">
        {/* media */}
        <div>
          <div
            className="relative grid aspect-square place-items-center overflow-hidden rounded-[1.5rem] shadow-hero"
            style={{ background: `linear-gradient(135deg, ${item.accent}22, ${item.accent}08)` }}
          >
            <img
              src={item.image}
              alt={item.name}
              className="h-40 w-40 rounded-3xl object-contain shadow-soft sm:h-52 sm:w-52"
            />
            {item.badge && (
              <span className="absolute left-4 top-4 chip bg-white/90 text-brand-700 shadow-soft">
                {item.badge}
              </span>
            )}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {perks.map(({ Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-brand-100 bg-white p-3 text-center"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-semibold text-ink-soft sm:text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* info */}
        <div>
          <span className="chip bg-brand-50 text-brand-700">{item.group}</span>
          <h1 className="mt-2 text-2xl font-extrabold text-ink sm:text-3xl">{item.name}</h1>
          <p className="mt-1 text-ink-soft">{item.tagline}</p>

          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 font-semibold text-ink-soft">
              <StarIcon className="h-4 w-4 text-amber-400" /> {item.rating}
            </span>
            <span className="text-ink-muted">·</span>
            <span className="text-ink-muted">
              Đã bán {item.sold >= 1000 ? (item.sold / 1000).toFixed(1) + 'k' : item.sold}
            </span>
          </div>

          {/* price */}
          <div className="mt-4 flex items-end gap-3 rounded-2xl bg-brand-50/60 p-4">
            <span className="text-3xl font-extrabold text-brand-600">{formatVND(active.price)}</span>
            {active.originalPrice && (
              <span className="mb-1 text-ink-muted line-through">{formatVND(active.originalPrice)}</span>
            )}
          </div>

          {/* plans */}
          {item.plans.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-bold text-ink">Chọn gói</h3>
              <div className="mt-2 grid grid-cols-3 gap-2.5">
                {item.plans.map((p, i) => (
                  <button
                    key={`${p.label}-${i}`}
                    onClick={() => setPlan(i)}
                    className={`relative rounded-2xl border p-3 text-center transition ${
                      plan === i
                        ? 'border-brand-500 bg-brand-50 shadow-card'
                        : 'border-brand-100 bg-white hover:border-brand-300'
                    }`}
                  >
                    {p.highlight && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 chip bg-brand-gradient px-2 py-0.5 text-[10px] text-white">
                        Tốt nhất
                      </span>
                    )}
                    <span className="block text-sm font-bold text-ink">{p.label}</span>
                    <span className="block text-xs text-ink-muted">{p.duration}</span>
                    <span className="mt-1 block text-sm font-extrabold text-brand-600">
                      {formatVND(p.price)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CTA — contact only (Facebook / Zalo) */}
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <a
              href={fbHref ?? '/contact'}
              target={fbHref ? '_blank' : undefined}
              rel={fbHref ? 'noreferrer' : undefined}
              className="btn-primary flex-1"
            >
              <MessengerIcon className="h-4 w-4" /> Liên hệ Facebook
            </a>
            <a
              href={zaloHref ?? '/contact'}
              target={zaloHref ? '_blank' : undefined}
              rel={zaloHref ? 'noreferrer' : undefined}
              className="btn-ghost flex-1"
            >
              <ZaloIcon className="h-4 w-4" /> Liên hệ Zalo
            </a>
          </div>

          {/* features */}
          {item.features.length > 0 && (
            <div className="mt-6 rounded-2xl border border-brand-100 bg-white p-4">
              <h3 className="text-sm font-bold text-ink">Tính năng nổi bật</h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {item.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink-soft">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* description */}
      <div className="mt-8 rounded-card border border-brand-100 bg-white p-5 sm:p-7">
        <h2 className="section-title">Giới thiệu</h2>
        <p className="mt-3 leading-relaxed text-ink-soft">{item.longDescription}</p>
      </div>

      {/* product FAQs */}
      {faqs.length > 0 && (
        <div className="mt-6 rounded-card border border-brand-100 bg-white p-5 sm:p-7">
          <h2 className="section-title">Câu hỏi thường gặp</h2>
          <div className="mt-4 space-y-3">
            {faqs.map((f, i) => (
              <details
                key={i}
                className="group rounded-2xl border border-brand-100 p-4 transition hover:border-brand-200"
              >
                <summary className="flex cursor-pointer items-center justify-between font-semibold text-ink">
                  {f.question}
                  <span className="ml-3 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* contact strip */}
      <div className="mt-6 overflow-hidden rounded-card bg-brand-gradient p-5 shadow-hero sm:p-7">
        <h2 className="text-xl font-extrabold text-white">Cần hỗ trợ mua {item.name}?</h2>
        <p className="mt-1 text-sm text-white/85">Liên hệ BOW để được tư vấn và kích hoạt nhanh nhất.</p>
        <div className="mt-4">
          <ContactButtons />
        </div>
      </div>

      {/* related */}
      {relatedItems.length > 0 && (
        <div className="mt-10">
          <h2 className="section-title mb-4">Sản phẩm liên quan</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {relatedItems.map((r) => (
              <ProductCard key={r.id} item={r} base={base} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
