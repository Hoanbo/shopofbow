

export default function HeroBanner() {
  return (
    <section className="container-bow pt-3 sm:pt-5">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#00A3FF] via-[#0088FF] to-[#0066FF] px-6 py-7 text-white shadow-[0_10px_30px_rgba(0,140,255,0.25)] sm:rounded-[28px] sm:px-12 sm:py-10 lg:px-14 lg:py-12">
        {/* Geometric White Stripes - Top Right (Matches Mockup Graphic) */}
        <div className="pointer-events-none absolute -right-4 -top-8 h-[140%] w-72 sm:w-96">
          <svg viewBox="0 0 200 200" className="h-full w-full opacity-95" preserveAspectRatio="none">
            <polygon points="120,0 160,0 200,80 200,120" fill="#FFFFFF" opacity="0.9" />
            <polygon points="170,0 200,0 200,40" fill="#FFFFFF" opacity="0.9" />
            <polygon points="80,0 100,0 200,160 200,180" fill="#FFFFFF" opacity="0.6" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-2xl">
            {/* Logo + Tagline Header */}
            <div className="flex items-center gap-3">
              <img
                src="/assets/bowLogo.jpeg"
                alt="BOW Logo"
                className="h-11 w-11 rounded-2xl object-cover shadow-md ring-2 ring-white/80 sm:h-14 sm:w-14"
              />
              <div className="flex flex-col leading-tight">
                <span className="text-xl font-black tracking-tight text-white sm:text-2xl">BOW</span>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-300">
                  Let's Connect
                </span>
              </div>
            </div>

            {/* Banner Titles */}
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[40px]">
              AI Tools & Premium Apps
            </h1>
            <p className="mt-1.5 text-xs font-medium text-sky-100/90 sm:text-base lg:text-lg">
              Mọi công cụ AI và ứng dụng Premium trong một nơi
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
