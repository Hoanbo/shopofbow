import { Link } from 'react-router-dom';
import HeroBanner from '../components/HeroBanner';
import Section from '../components/Section';
import AIToolCard from '../components/AIToolCard';
import PremiumAppCard from '../components/PremiumAppCard';
import ProductCard from '../components/ProductCard';
import Skeleton from '../components/Skeleton';
import { ContactButtons } from '../components/ContactButtons';
import { fetchByCategory, fetchFeatured } from '../data/api';
import { useAsync } from '../hooks/useAsync';
import { useSeo } from '../hooks/useSeo';
import { SparkIcon, AppIcon, BagIcon, ArrowRight, HeadsetIcon } from '../components/icons';

export default function Home() {
  useSeo({});
  const { data: aiTools = [], loading: loadingAi } = useAsync(() => fetchByCategory('ai-tool'), []);
  const { data: apps = [], loading: loadingApps } = useAsync(() => fetchByCategory('premium-app'), []);
  const { data: products = [], loading: loadingProducts } = useAsync(() => fetchFeatured(), []);

  return (
    <div className="space-y-10 pb-10 sm:space-y-14">
      <HeroBanner />

      {/* AI Tools */}
      <Section
        icon={<SparkIcon className="h-5 w-5" />}
        title="AI Tools"
        subtitle="Tài khoản AI chính chủ, kích hoạt tức thì"
        to="/ai-tools"
      >
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
          {loadingAi ? (
            <Skeleton count={6} variant="tool" />
          ) : (
            aiTools.map((item) => <AIToolCard key={item.id} item={item} />)
          )}
        </div>
      </Section>

      {/* Premium Apps */}
      <Section
        icon={<AppIcon className="h-5 w-5" />}
        title="Premium Apps"
        subtitle="Netflix, Spotify, YouTube... giá siêu tốt"
        to="/premium-apps"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {loadingApps ? (
            <Skeleton count={4} variant="app" />
          ) : (
            apps.map((item) => <PremiumAppCard key={item.id} item={item} />)
          )}
        </div>
      </Section>

      {/* Featured Products */}
      <Section
        icon={<BagIcon className="h-5 w-5" />}
        title="Featured Products"
        subtitle="Công cụ sáng tạo được yêu thích nhất"
        to="/products"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {loadingProducts ? (
            <Skeleton count={4} variant="product" />
          ) : (
            products.map((item) => <ProductCard key={item.id} item={item} base="/products" />)
          )}
        </div>
      </Section>

      {/* Contact CTA */}
      <section className="container-bow">
        <div className="relative overflow-hidden rounded-[1.75rem] bg-brand-gradient px-5 py-8 shadow-hero sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 left-10 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
          <div className="relative grid gap-7 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="chip bg-white/20 text-white ring-1 ring-white/30">
                <HeadsetIcon className="h-4 w-4" /> Hỗ trợ 24/7
              </span>
              <h2 className="mt-3 text-2xl font-extrabold text-white sm:text-3xl">
                Cần tư vấn? Liên hệ BOW ngay!
              </h2>
              <p className="mt-2 max-w-md text-sm text-white/85 sm:text-base">
                Đội ngũ BOW luôn sẵn sàng hỗ trợ bạn chọn gói phù hợp và kích hoạt nhanh chóng qua các kênh dưới đây.
              </p>
              <Link
                to="/contact"
                className="btn-primary mt-5 !bg-white !text-brand-700 hover:!brightness-100"
              >
                Xem tất cả kênh liên hệ <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <ContactButtons />
          </div>
        </div>
      </section>
    </div>
  );
}
