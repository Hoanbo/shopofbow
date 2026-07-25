import { ContactButtons, buildChannels } from '../components/ContactButtons';
import { ShieldIcon, BoltIcon, HeadsetIcon } from '../components/icons';
import { useContact } from '../context/ContactContext';
import { fetchFaqs } from '../data/api';
import { useAsync } from '../hooks/useAsync';
import { useSeo } from '../hooks/useSeo';

const perks = [
  { Icon: BoltIcon, title: 'Kích hoạt tức thì', desc: 'Nhận tài khoản chỉ sau vài phút' },
  { Icon: ShieldIcon, title: 'Bảo hành trọn gói', desc: 'Đổi mới miễn phí nếu có lỗi' },
  { Icon: HeadsetIcon, title: 'Hỗ trợ 24/7', desc: 'Luôn sẵn sàng giải đáp mọi lúc' },
];

export default function Contact() {
  useSeo({
    title: 'Liên hệ',
    description: 'Liên hệ BOW qua Facebook, Zalo, hotline hoặc email — tư vấn nhanh, hỗ trợ 24/7.',
  });
  const contact = useContact();
  const channels = buildChannels(contact);
  const { data: faqs = [] } = useAsync(() => fetchFaqs(), []);
  return (
    <div className="container-bow py-6 sm:py-8">
      {/* hero */}
      <div className="relative overflow-hidden rounded-[1.75rem] bg-hero-gradient px-5 py-9 text-white shadow-hero sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
        <div className="relative max-w-xl">
          <h1 className="text-2xl font-extrabold sm:text-4xl">Liên hệ BOW</h1>
          <p className="mt-2 text-sm text-white/85 sm:text-base">
            Chọn kênh bạn thấy tiện nhất — đội ngũ BOW luôn phản hồi nhanh chóng và tư vấn tận tình.
          </p>
          <div className="mt-6">
            <ContactButtons />
          </div>
        </div>
      </div>

      {/* perks */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {perks.map(({ Icon, title, desc }) => (
          <div key={title} className="card-base flex items-start gap-3 p-5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-gradient text-white shadow-card">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-bold text-ink">{title}</h3>
              <p className="text-sm text-ink-muted">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* channels list */}
        <div className="card-base p-5 sm:p-6">
          <h2 className="section-title">Kênh liên hệ</h2>
          <div className="mt-4 space-y-3">
            {channels.map(({ key, label, handle, href, Icon, color }) => (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-brand-100 p-3 transition hover:border-brand-300 hover:bg-brand-50"
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-soft"
                  style={{ backgroundColor: color }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{label}</span>
                  <span className="block truncate text-sm text-ink-muted">{handle}</span>
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* faq */}
        <div className="card-base p-5 sm:p-6">
          <h2 className="section-title">Câu hỏi thường gặp</h2>
          <div className="mt-4 space-y-3">
            {faqs.map((f, i) => (
              <details
                key={i}
                className="group rounded-2xl border border-brand-100 p-4 transition hover:border-brand-200"
              >
                <summary className="flex cursor-pointer items-center justify-between font-semibold text-ink">
                  {f.question}
                  <span className="ml-3 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
