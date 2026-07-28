import { Link } from 'react-router-dom';
import { ArrowRight } from './icons';

export default function HeroBanner() {
  return (
    <section className="container-bow pt-4 sm:pt-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-400 via-sky-500 to-blue-600 px-6 py-8 text-white shadow-xl sm:rounded-3xl sm:px-12 sm:py-12 lg:px-16 lg:py-14">
        {/* Geometric White Accent Stripes - Top Right (Matches Mockup) */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rotate-45 transform bg-white/20 blur-sm" />
        <div className="pointer-events-none absolute -right-4 -top-20 h-48 w-96 rotate-45 transform bg-white/30" />
        <div className="pointer-events-none absolute right-16 -top-24 h-40 w-80 rotate-45 transform bg-white/40" />

        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-xl">
            {/* Logo + Tagline */}
            <div className="flex items-center gap-3">
              <img
                src="/assets/bowLogo.jpeg"
                alt="BOW Logo"
                className="h-12 w-12 rounded-2xl object-cover shadow-md ring-2 ring-white/60 sm:h-14 sm:w-14"
              />
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">BOW</h2>
                <p className="text-xs font-bold uppercase tracking-widest text-sky-100">Let's Connect</p>
              </div>
            </div>

            {/* Banner Main Titles */}
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              AI Tools & Premium Apps
            </h1>
            <p className="mt-2 text-sm font-medium text-sky-100 sm:text-base lg:text-lg">
              Mọi công cụ AI và ứng dụng Premium trong một nơi
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/ai-tools"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-sky-600 shadow-md transition hover:bg-sky-50 hover:shadow-lg"
              >
                Khám phá AI Tools <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/premium-apps"
                className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Xem Premium Apps
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
