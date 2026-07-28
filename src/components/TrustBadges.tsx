import { BoltIcon, ShieldIcon, HeadsetIcon, StarIcon } from './icons';

export default function TrustBadges() {
  const badges = [
    { icon: BoltIcon, title: 'Kích hoạt', subtitle: 'nhanh chóng' },
    { icon: ShieldIcon, title: 'Bảo mật', subtitle: 'an toàn' },
    { icon: HeadsetIcon, title: 'Hỗ trợ', subtitle: '24/7' },
    { icon: StarIcon, title: 'Uy tín', subtitle: 'chất lượng' },
  ];

  return (
    <section className="rounded-[22px] border border-[#E7EEF8] bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] sm:p-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
        {badges.map((badge, index) => {
          const Icon = badge.icon;
          return (
            <div key={index} className="flex items-center justify-center gap-3 text-[#2563EB]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB] shadow-xs">
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-left leading-tight">
                <p className="text-xs font-bold text-[#0F172A] sm:text-sm">{badge.title}</p>
                <p className="text-xs font-medium text-[#64748B]">{badge.subtitle}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
