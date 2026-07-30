import { BoltIcon, ShieldIcon, HeadsetIcon, StarIcon } from './icons';

export default function TrustBadges() {
  const badges = [
    { icon: BoltIcon, title: 'Kích hoạt', subtitle: 'nhanh chóng' },
    { icon: ShieldIcon, title: 'Bảo mật', subtitle: 'an toàn' },
    { icon: HeadsetIcon, title: 'Hỗ trợ', subtitle: '24/7' },
    { icon: StarIcon, title: 'Uy tín', subtitle: 'chất lượng' },
  ];

  return (
    <section className="rounded-[28px] border border-[#E7EEF8] bg-white p-5 shadow-[0_8px_30px_rgba(0,140,255,0.05)] sm:p-7">
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-4 md:gap-8">
        {badges.map((badge, index) => {
          const Icon = badge.icon;
          return (
            <div key={index} className="flex items-center gap-3 sm:gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF6FF] text-[#0088FF]">
                <Icon className="h-[22px] w-[22px]" />
              </div>
              <div className="min-w-0 text-left leading-snug">
                <p className="text-sm font-extrabold text-[#0F172A] sm:text-base">{badge.title}</p>
                <p className="text-xs font-semibold text-slate-500 sm:text-sm">{badge.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

