import { ShieldIcon, BoltIcon, HeadsetIcon } from '../components/icons';
import MyCard from '../components/MyCard';
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
  const { data: faqs = [] } = useAsync(() => fetchFaqs(), []);

  return (
    <div className="container-bow py-4 sm:py-8">
      {/* 
        Responsive Layout:
        - Mobile & Tablet: Xếp dọc 1 cột (Thẻ Card -> Perks -> FAQs).
        - Desktop (lg:): Chia đôi 2 cột cân bằng (Cột Trái 5/12: Thẻ Danh thiếp MyCard, Cột Phải 7/12: Perks & FAQs).
      */}
      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* CỘT TRÁI: Thẻ Danh Thiếp Điện Tử (Sticky trên Desktop) */}
        <div className="lg:col-span-5 flex justify-center lg:sticky lg:top-24 animate-fade-up">
          <MyCard />
        </div>

        {/* CỘT PHẢI: Perks Grid & Câu hỏi thường gặp */}
        <div className="lg:col-span-7 space-y-6 animate-fade-up">
          {/* Perks Badges Grid — Cân bằng kích thước, chống vỡ chữ */}
          <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-3 lg:grid-cols-1">
            {perks.map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-center gap-4 rounded-[24px] border border-[#E7EEF8] dark:border-slate-800 bg-white dark:bg-[#131C32] p-4 sm:p-5 shadow-xs transition-all duration-300 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-[#38bdf8]">
                  <Icon className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-extrabold text-[#0F172A] dark:text-white sm:text-base">
                    {title}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Global FAQs Section */}
          <div className="rounded-[28px] border border-[#E7EEF8] dark:border-slate-800 bg-white dark:bg-[#131C32] p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-extrabold text-[#0F172A] dark:text-white">Câu hỏi thường gặp</h2>
            <div className="mt-4 space-y-3">
              {faqs.map((f, i) => (
                <details
                  key={i}
                  className="group rounded-[20px] border border-[#E7EEF8] dark:border-slate-800 p-4 transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-700"
                >
                  <summary className="flex cursor-pointer items-center justify-between text-sm font-bold text-[#0F172A] dark:text-slate-200">
                    {f.question}
                    <span className="ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-[#38bdf8] font-bold text-base transition-transform duration-300 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
                    {f.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
