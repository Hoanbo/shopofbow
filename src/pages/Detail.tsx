import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CatalogItem } from '../data/types';
import { fetchBySlug, fetchByCategory, fetchFaqs } from '../data/api';
import { formatVND } from '../data/catalog';
import { useAsync } from '../hooks/useAsync';
import { useSeo } from '../hooks/useSeo';
import { useContact } from '../context/ContactContext';
import AppLogo from '../components/AppLogo';
import AIToolCard from '../components/AIToolCard';
import PremiumAppCard from '../components/PremiumAppCard';
import FeaturedBannerCard from '../components/FeaturedBannerCard';
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
      <div className="container-bow py-16">
        <div className="mx-auto h-8 w-48 animate-pulse rounded-full bg-blue-100/60" />
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-[28px] bg-blue-100/60" />
          <div className="space-y-4">
            <div className="h-10 w-2/3 animate-pulse rounded-full bg-blue-100/60" />
            <div className="h-20 animate-pulse rounded-2xl bg-blue-100/60" />
            <div className="h-28 animate-pulse rounded-2xl bg-blue-100/60" />
          </div>
        </div>
      </div>
    );
  }

  if (!item || item.category !== category) {
    return (
      <div className="container-bow py-20 text-center">
        <div className="mx-auto max-w-md rounded-[28px] border border-[#E7EEF8] bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-extrabold text-[#0F172A]">Không tìm thấy sản phẩm</h1>
          <p className="mt-2 text-sm text-slate-500">Sản phẩm bạn đang tìm kiếm không tồn tại hoặc đã thay đổi đường dẫn.</p>
          <Link
            to={base}
            className="mt-6 inline-flex rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] px-6 py-2.5 text-sm font-bold text-white shadow-md hover:from-[#0080E0] hover:to-[#1D4ED8]"
          >
            Quay lại danh sách
          </Link>
        </div>
      </div>
    );
  }

  const relatedItems = related.filter((i) => i.id !== item.id).slice(0, 4);
  const active = item.plans[plan] ?? item.plans[0];
  const fbHref = contact.facebookUrl && contact.facebookUrl !== '#' ? contact.facebookUrl : undefined;
  const zaloHref = contact.zaloUrl && contact.zaloUrl !== '#' ? contact.zaloUrl : undefined;

  return (
    <div className="container-bow py-4 sm:py-6 space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 sm:text-sm">
        <Link to="/" className="hover:text-[#2563EB] transition font-medium">
          Trang chủ
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        <Link to={base} className="hover:text-[#2563EB] transition font-medium">
          {crumb}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        <span className="truncate font-bold text-[#0F172A]">{item.name}</span>
      </nav>

      {/* Main Detail Grid */}
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        {/* Left Column: Product Image & Perks */}
        <div>
          <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[28px] border border-[#E7EEF8] bg-gradient-to-tr from-sky-400/10 via-sky-100/30 to-blue-50/50 p-8 shadow-[0_8px_30px_rgba(0,140,255,0.06)]">
            <AppLogo
              slug={item.slug}
              name={item.name}
              image={item.image}
              className="h-44 w-44 sm:h-56 sm:w-56 filter drop-shadow-md"
            />
            {item.badge && (
              <span className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1 text-xs font-extrabold text-[#2563EB] shadow-sm backdrop-blur-md">
                {item.badge}
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {perks.map(({ Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 rounded-[22px] border border-[#E7EEF8] bg-white p-3.5 text-center shadow-xs transition hover:scale-[1.02]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-bold text-[#0F172A]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Product Specs & Options */}
        <div className="flex flex-col justify-between">
          <div>
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#2563EB]">
              {item.group}
            </span>
            <h1 className="mt-2.5 text-2xl font-black text-[#0F172A] sm:text-3xl lg:text-4xl tracking-tight">
              {item.name}
            </h1>
            <p className="mt-1.5 text-sm font-medium text-slate-500 leading-relaxed">{item.tagline}</p>

            <div className="mt-4 flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 font-extrabold text-[#0F172A]">
                <StarIcon className="h-4.5 w-4.5 text-amber-400" /> {item.rating}
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-semibold text-slate-500">
                Đã bán {item.sold >= 1000 ? (item.sold / 1000).toFixed(1) + 'k' : item.sold} gói
              </span>
            </div>

            {/* Price Tag */}
            <div className="mt-5 flex items-baseline gap-3 rounded-[22px] bg-[#EEF6FF] border border-[#D8E9FF] p-4.5">
              <span className="text-3xl font-black text-[#2563EB]">{formatVND(active.price)}</span>
              {active.originalPrice && (
                <span className="text-sm font-medium text-slate-400 line-through">
                  {formatVND(active.originalPrice)}
                </span>
              )}
            </div>

            {/* Plan Selector */}
            {item.plans.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-extrabold text-[#0F172A]">Chọn gói nâng cấp:</h3>
                <div className="mt-2.5 grid grid-cols-3 gap-3">
                  {item.plans.map((p, i) => (
                    <button
                      key={`${p.label}-${i}`}
                      onClick={() => setPlan(i)}
                      className={`relative rounded-[20px] border p-3.5 text-center transition-all duration-300 ${
                        plan === i
                          ? 'border-[#2563EB] bg-[#EEF6FF] text-[#2563EB] shadow-md ring-2 ring-blue-500/20'
                          : 'border-[#E7EEF8] bg-white text-slate-700 hover:border-blue-300'
                      }`}
                    >
                      {p.highlight && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          Tốt nhất
                        </span>
                      )}
                      <span className="block text-sm font-extrabold text-[#0F172A]">{p.label}</span>
                      <span className="block text-xs font-medium text-slate-400">{p.duration}</span>
                      <span className="mt-1 block text-sm font-extrabold text-[#2563EB]">
                        {formatVND(p.price)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={fbHref ?? '/contact'}
                target={fbHref ? '_blank' : undefined}
                rel={fbHref ? 'noreferrer' : undefined}
                className="flex items-center justify-center gap-2 rounded-full bg-[#0088FF] py-3.5 px-6 text-sm font-bold text-white shadow-md transition-all duration-300 hover:bg-[#0070E0] hover:scale-[1.02] flex-1"
              >
                <MessengerIcon className="h-5 w-5" /> Liên hệ Messenger
              </a>
              <a
                href={zaloHref ?? '/contact'}
                target={zaloHref ? '_blank' : undefined}
                rel={zaloHref ? 'noreferrer' : undefined}
                className="flex items-center justify-center gap-2 rounded-full bg-[#0068FF] py-3.5 px-6 text-sm font-bold text-white shadow-md transition-all duration-300 hover:bg-[#0055DD] hover:scale-[1.02] flex-1"
              >
                <ZaloIcon className="h-5 w-5" /> Liên hệ qua Zalo
              </a>
            </div>

            {/* Key Features List */}
            {item.features.length > 0 && (
              <div className="mt-6 rounded-[24px] border border-[#E7EEF8] bg-white p-5 shadow-xs">
                <h3 className="text-sm font-extrabold text-[#0F172A]">Tính năng nổi bật:</h3>
                <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {item.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-xs sm:text-sm font-medium text-slate-700">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full Description Section */}
      <div className="mt-8 rounded-[28px] border border-[#E7EEF8] bg-white p-6 sm:p-8 shadow-xs">
        <h2 className="text-xl font-extrabold text-[#0F172A] sm:text-2xl">Giới thiệu sản phẩm</h2>
        <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 font-medium">
          {item.longDescription}
        </p>
      </div>

      {/* Product FAQs */}
      {faqs.length > 0 && (
        <div className="mt-6 rounded-[28px] border border-[#E7EEF8] bg-white p-6 sm:p-8 shadow-xs">
          <h2 className="text-xl font-extrabold text-[#0F172A] sm:text-2xl">Câu hỏi thường gặp</h2>
          <div className="mt-4 space-y-3">
            {faqs.map((f, i) => (
              <details
                key={i}
                className="group rounded-[20px] border border-[#E7EEF8] p-4 transition-all duration-300 hover:border-blue-300"
              >
                <summary className="flex cursor-pointer items-center justify-between font-bold text-[#0F172A] text-sm sm:text-base">
                  {f.question}
                  <span className="ml-3 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-50 text-[#2563EB] font-bold text-lg transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-600 font-medium">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* Support Banner Strip */}
      <div className="mt-6 overflow-hidden rounded-[28px] bg-gradient-to-r from-[#00A3FF] via-[#0088FF] to-[#2563EB] p-6 sm:p-8 text-white shadow-lg">
        <h2 className="text-xl font-black text-white sm:text-2xl">Cần hỗ trợ mua {item.name}?</h2>
        <p className="mt-1.5 text-xs sm:text-sm font-medium text-sky-100">
          Đội ngũ tư vấn BOW luôn sẵn sàng giải đáp thắc mắc và kích hoạt tài khoản ngay tức thì.
        </p>
        <div className="mt-5">
          <ContactButtons />
        </div>
      </div>

      {/* Related Products Grid */}
      {relatedItems.length > 0 && (
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-[#0F172A] sm:text-2xl">Sản phẩm liên quan</h2>
            <Link to={base} className="text-xs sm:text-sm font-bold text-[#2563EB] hover:underline">
              Xem tất cả &gt;
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 sm:gap-5">
            {relatedItems.map((r) => (
              category === 'ai-tool' ? (
                <AIToolCard key={r.id} item={r} />
              ) : category === 'premium-app' ? (
                <PremiumAppCard key={r.id} item={r} />
              ) : (
                <FeaturedBannerCard key={r.id} item={r} base={base} />
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
