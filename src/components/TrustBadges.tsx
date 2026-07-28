import { BoltIcon, ShieldIcon, HeadsetIcon, StarIcon } from './icons';

export default function TrustBadges() {
  const badges = [
    {
      icon: BoltIcon,
      title: 'Kích hoạt',
      subtitle: 'nhanh chóng',
    },
    {
      icon: ShieldIcon,
      title: 'Bảo mật',
      subtitle: 'an toàn',
    },
    {
      icon: HeadsetIcon,
      title: 'Hỗ trợ',
      subtitle: '24/7',
    },
    {
      icon: StarIcon,
      title: 'Uy tín',
      subtitle: 'chất lượng',
    },
  ];

  return (
    <section className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 backdrop-blur-xs sm:rounded-3xl sm:p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {badges.map((badge, index) => {
          const Icon = badge.icon;
          return (
            <div key={index} className="flex items-center justify-center gap-3 text-sky-800">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-100 bg-white text-sky-600 shadow-xs">
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-left leading-tight">
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
