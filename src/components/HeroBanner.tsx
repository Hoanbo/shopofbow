import bowBanner from '../assets/bow.png';

export default function HeroBanner() {
  return (
    <section className="container-bow pt-3 sm:pt-5 animate-fade-in">
      <div className="relative overflow-hidden rounded-[24px] border border-sky-100 dark:border-slate-800 bg-[#00A3FF] shadow-sm">
        {/* Banner Image - Natural aspect ratio (full image) on mobile, top crop on desktop */}
        <img
          src={bowBanner}
          alt="BOW Banner"
          className="w-full h-auto md:h-[220px] lg:h-[250px] object-cover object-top"
        />

        {/* Text Overlay - Shorter and responsive to fit cleanly without clutter */}
        <div className="absolute inset-0 flex flex-col justify-center px-5 sm:px-12 bg-gradient-to-r from-black/35 via-[#00A3FF]/10 to-transparent">
          <h1 className="text-sm sm:text-2xl md:text-3.5xl lg:text-4xl font-black text-white drop-shadow-md uppercase tracking-tight">
            BOW - Let's Connect
          </h1>
          <p className="mt-0.5 sm:mt-2 text-[8px] sm:text-xs md:text-sm font-bold text-white/95 max-w-[200px] sm:max-w-md md:max-w-lg drop-shadow-xs leading-normal sm:leading-relaxed">
            Khám phá thế giới AI & Apps Premium hàng đầu.
          </p>
        </div>
      </div>
    </section>
  );
}
