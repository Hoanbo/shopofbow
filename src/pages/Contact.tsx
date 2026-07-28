import { ContactButtons, buildChannels } from '../components/ContactButtons';
import { ShieldIcon, BoltIcon, HeadsetIcon } from '../components/icons';
import { useContact } from '../context/ContactContext';
import { fetchFaqs } from '../data/api';
import { useAsync } from '../hooks/useAsync';
import { useSeo } from '../hooks/useSeo';

const perks = [
  { Icon: BoltIcon, title: 'Kích hoạt tức thì', desc: 'Nhận tài khoản tự động chỉ trong vài phút' },
  { Icon: ShieldIcon, title: 'Bảo hành trọn gói', desc: 'Đổi mới tài khoản 1-1 nếu phát sinh lỗi' },
  { Icon: HeadsetIcon, title: 'Hỗ trợ 24/7', desc: 'Đội ngũ tư vấn tận tâm luôn sẵn sàng 24/7' },
];

export default function Contact() {
  useSeo({
    title: 'Liên hệ',
    description: 'Liên hệ BOW qua Facebook Messenger, Zalo, hotline hoặc email — tư vấn nhanh, hỗ trợ 24/7.',
  });
  const contact = useContact();
  const channels = buildChannels(contact);
  const { data: faqs = [] } = useAsync(() => fetchFaqs(), []);

  return (
    <div className="container-bow py-4 sm:py-6 space-y-6">
      {/* Hero Banner Header */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#00A3FF] via-[#0088FF] to-[#2563EB] px-6 py-8 text-white shadow-lg sm:px-10 sm:py-10">
        <div className="relative max-w-2xl">
          <h1 className="text-2xl font-black sm:text-4xl tracking-tight">Liên hệ BOW</h1>
          <p className="mt-2 text-xs sm:text-base font-medium text-sky-100/90 leading-relaxed">
            Chọn kênh liên hệ thuận tiện nhất — đội ngũ hỗ trợ kỹ thuật BOW luôn sẵn sàng phục vụ quý khách.
          </p>
          <div className="mt-6">
            <ContactButtons />
          </div>
        </div>
      </div>

      {/* Perks Badges Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        {perks.map(({ Icon, title, desc }) => (
          <div
            key={title}
            className="flex items-start gap-4 rounded-[24px] border border-[#E7EEF8] bg-white p-5 shadow-xs transition-all duration-300 hover:shadow-md hover:border-blue-200"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB]">
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-[#0F172A] sm:text-base">{title}</h3>
              <p className="mt-1 text-xs text-slate-500 font-medium leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Channels List & FAQs Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Direct Channels List */}
        <div className="rounded-[28px] border border-[#E7EEF8] bg-white p-6 sm:p-8 shadow-xs">
          <h2 className="text-xl font-extrabold text-[#0F172A]">Kênh liên hệ trực tiếp</h2>
          <div className="mt-4 space-y-3">
            {channels.map(({ key, label, handle, href, Icon, color }) => (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3.5 rounded-[20px] border border-[#E7EEF8] p-3.5 transition-all duration-300 hover:border-blue-300 hover:bg-blue-50/50 hover:scale-[1.01]"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-md"
                  style={{ backgroundColor: color }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-extrabold text-[#0F172A]">{label}</span>
                  <span className="block truncate text-xs text-slate-500 font-medium">{handle}</span>
                </span>
              </a>
            ))}
          </div>
        </div>

        {/* Global FAQs Section */}
        <div className="rounded-[28px] border border-[#E7EEF8] bg-white p-6 sm:p-8 shadow-xs">
          <h2 className="text-xl font-extrabold text-[#0F172A]">Câu hỏi thường gặp</h2>
          <div className="mt-4 space-y-3">
            {faqs.map((f, i) => (
              <details
                key={i}
                className="group rounded-[20px] border border-[#E7EEF8] p-4 transition-all duration-300 hover:border-blue-300"
              >
                <summary className="flex cursor-pointer items-center justify-between text-sm font-bold text-[#0F172A]">
                  {f.question}
                  <span className="ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#2563EB] font-bold text-base transition-transform duration-300 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-xs leading-relaxed text-slate-500 font-medium">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
