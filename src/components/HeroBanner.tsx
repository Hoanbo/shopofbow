export default function HeroBanner() {
  return (
    <section className="container-bow pt-3 sm:pt-5">
      <div className="relative overflow-hidden rounded-[24px] border border-sky-100 bg-[#00A3FF] shadow-[0_10px_30px_rgba(0,140,255,0.2)]">
        <img
          src="/assets/bowLogo.jpeg"
          alt="BOW Banner"
          className="h-auto w-full max-h-[380px] object-cover"
        />
      </div>
    </section>
  );
}
