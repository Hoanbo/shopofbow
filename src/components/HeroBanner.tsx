import { Link } from 'react-router-dom';
import { ArrowRight, ShieldIcon, BoltIcon, HeadsetIcon, StarIcon } from './icons';

const perks = [
  { Icon: BoltIcon, label: 'Kích hoạt tức thì' },
  { Icon: ShieldIcon, label: 'Bảo hành trọn gói' },
  { Icon: HeadsetIcon, label: 'Hỗ trợ 24/7' },
];

const floatIcons = [
  { src: '/assets/chatgpt.png', className: 'left-2 top-6 h-12 w-12 sm:h-14 sm:w-14' },
  { src: '/assets/netflix.png', className: 'right-6 top-4 h-12 w-12 sm:h-16 sm:w-16' },
  { src: '/assets/spotify.jpg', className: 'right-2 bottom-10 h-11 w-11 sm:h-14 sm:w-14' },
  { src: '/assets/claude.jpg', className: 'left-8 bottom-6 h-10 w-10 sm:h-12 sm:w-12' },
];

export default function HeroBanner() {
  return (
    <section className="container-bow pt-4 sm:pt-6">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-hero-gradient px-5 py-8 shadow-hero sm:px-10 sm:py-12 lg:px-14 lg:py-16">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-brand-300/30 blur-2xl" />

        {/* floating app icons — desktop */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          {floatIcons.map((f, i) => (
            <img
              key={f.src}
              src={f.src}
              alt=""
              className={`absolute animate-float rounded-2xl bg-white/90 p-1.5 shadow-hero ${f.className}`}
              style={{ animationDelay: `${i * 0.8}s` }}
            />
          ))}
        </div>

        <div className="relative max-w-2xl">
          <span className="chip bg-white/20 text-white ring-1 ring-white/30 backdrop-blur">
            <StarIcon className="h-3.5 w-3.5" /> Uy tín · 20.000+ khách hàng
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
            AI Tools & Premium Apps
            <span className="block text-white/90">giá tốt nhất Việt Nam</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/85 sm:text-base">
            ChatGPT, Claude, Netflix, Spotify, Canva... chính chủ, bảo hành đầy đủ. Kích hoạt nhanh, hỗ trợ tận tình 24/7.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/ai-tools" className="btn-primary !bg-white !text-brand-700 shadow-lg hover:!brightness-100">
              Khám phá AI Tools <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/premium-apps"
              className="btn-ghost !border-white/40 !bg-white/10 !text-white backdrop-blur hover:!bg-white/20"
            >
              Xem Premium Apps
            </Link>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3">
            {perks.map(({ Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm font-semibold text-white">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
