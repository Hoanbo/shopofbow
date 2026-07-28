import { BoltIcon, ShieldIcon, HeadsetIcon, StarIcon } from './icons';

export default function TrustBadges() {
  const badges = [
    { icon: BoltIcon, title: 'Kích hoạt', subtitle: 'nhanh chóng' },
    { icon: ShieldIcon, title: 'Bảo mật', subtitle: 'an toàn' },
    { icon: HeadsetIcon, title: 'Hỗ trợ', subtitle: '24/7' },
    { icon: StarIcon, title: 'Uy tín', subtitle: 'chất lượng' },
  ];

  return (
    <section className="rounded-[24px] border border-[#D8E9FF] bg-[#EEF6FF] p-4 shadow-xs sm:p-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {badges.map((badge, index) => {
          const Icon = badge.icon;
          return (
            <div key={index} className="flex items-center justify-center gap-3 text-sky-900">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D8E9FF] bg-white text-[#0088FF] shadow-xs">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="text-left leading-snug">
                <p className="text-xs font-bold text-slate-800">{badge.title}</p>
                <p className="text-xs font-medium text-slate-600">{badge.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
