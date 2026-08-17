import { Link } from 'react-router-dom';
import { useContact } from '../context/ContactContext';
import newLogo from '../assets/new-logover2.png';

const aiToolLinks = [
  { to: '/products/chatgpt-plus', label: 'ChatGPT Plus chính chủ' },
  { to: '/products/claude-pro', label: 'Claude 3.5 Sonnet Pro' },
  { to: '/products/gemini-advanced', label: 'Google Gemini Advanced' },
  { to: '/products/grok-ai', label: 'Grok Premium AI' },
  { to: '/products/perplexity-pro', label: 'Perplexity Pro AI' },
  { to: '/products/cursor-pro', label: 'Cursor Pro Code AI' },
];

const premiumAppLinks = [
  { to: '/products/youtube-premium', label: 'YouTube Premium 4K' },
  { to: '/products/netflix-premium', label: 'Netflix 4K Ultra HD' },
  { to: '/products/capcut-pro', label: 'CapCut Pro chính chủ' },
  { to: '/products/spotify-premium', label: 'Spotify Premium Hifi' },
  { to: '/products/canva-pro', label: 'Canva Pro bản quyền' },
  { to: '/products/locket-gold', label: 'Locket Gold VIP' },
];

const supportLinks = [
  { to: '/contact', label: 'Hướng dẫn kích hoạt tài khoản' },
  { to: '/contact', label: 'Chính sách bảo hành 1 đổi 1' },
  { to: '/contact', label: 'Điều khoản sử dụng dịch vụ' },
  { to: '/contact', label: 'Chính sách bảo mật thông tin' },
  { to: '/contact', label: 'Trung tâm hỗ trợ khách hàng 24/7' },
];

export default function Footer() {
  const contactInfo = useContact();

  return (
    <footer className="hidden md:block border-t border-[#E7EEF8] dark:border-slate-800/80 bg-white dark:bg-[#0B1224] text-[#0F172A] dark:text-slate-300 transition-colors duration-300">
      
      {/* Main Grid Content */}
      <div className="container-bow grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-5 lg:py-14">
        
        {/* Brand Info & Contact (2 Columns wide on desktop) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <img
              src={newLogo}
              alt="BOW Logo"
              className="h-10 w-auto object-contain filter contrast-[1.25] saturate-[1.3] brightness-[0.95] drop-shadow-[0_0_1px_rgba(15,23,42,0.85)] drop-shadow-[0_2px_5px_rgba(2,132,199,0.35)] dark:filter-none dark:contrast-[1.1] dark:drop-shadow-[0_0_8px_rgba(0,163,255,0.45)]"
            />
            <div className="flex flex-col leading-none">
              <span className="text-xl font-black tracking-tight text-[#00A3FF]">BOW</span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#FFB703]">
                Let's Connect
              </span>
            </div>
          </div>

          <p className="max-w-sm text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            Hệ thống cung cấp tài khoản AI Tools & Ứng dụng Premium chính chủ uy tín hàng đầu Việt Nam. Kích hoạt nhanh chóng, cam kết bảo hành full thời hạn và chăm sóc khách hàng chuyên nghiệp.
          </p>

          {/* Contact Details with Clean Icons */}
          <div className="space-y-2 text-xs pt-1">
            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
              <span className="h-6 w-6 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800 text-[#2563EB] dark:text-[#35A8FF] flex items-center justify-center text-xs shrink-0">
                📞
              </span>
              <span>
                <strong className="text-slate-900 dark:text-white font-extrabold">Hotline / Zalo:</strong>{' '}
                <a href={`tel:${(contactInfo.supportPhone || '0966821315').replace(/\s+/g, '')}`} className="hover:text-[#2563EB] dark:hover:text-[#35A8FF] font-semibold transition">
                  {contactInfo.supportPhone || '0966 821 315'}
                </a>
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
              <span className="h-6 w-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs shrink-0">
                ✉️
              </span>
              <span>
                <strong className="text-slate-900 dark:text-white font-extrabold">Email Hỗ Trợ:</strong>{' '}
                <a href={`mailto:${contactInfo.supportEmail || 'hoankb4@gmail.com'}`} className="hover:text-[#2563EB] dark:hover:text-[#35A8FF] font-semibold transition">
                  {contactInfo.supportEmail || 'hoankb4@gmail.com'}
                </a>
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
              <span className="h-6 w-6 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs shrink-0">
                ⏰
              </span>
              <span>
                <strong className="text-slate-900 dark:text-white font-extrabold">Thời gian làm việc:</strong> 08:00 - 23:30 (Cả T7, CN & Lễ)
              </span>
            </div>
          </div>

          {/* Link chuyển đến trang hỗ trợ & liên hệ */}
          <div className="pt-2">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80 px-4 py-2.5 text-xs font-black text-[#2563EB] dark:text-[#35A8FF] hover:bg-blue-100 dark:hover:bg-blue-900/60 shadow-xs transition-all duration-200 group"
            >
              <span>💬</span>
              <span>Trung tâm Hỗ trợ & Kênh liên hệ</span>
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>

        {/* AI Tools */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
            AI TOOLS NỔI BẬT
          </h4>
          <ul className="mt-3.5 space-y-2.5">
            {aiToolLinks.map((l, i) => (
              <li key={i}>
                <Link
                  to={l.to}
                  className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 transition-colors duration-200 hover:text-[#2563EB] dark:hover:text-[#35A8FF]"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Premium Apps */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
            ỨNG DỤNG PREMIUM
          </h4>
          <ul className="mt-3.5 space-y-2.5">
            {premiumAppLinks.map((l, i) => (
              <li key={i}>
                <Link
                  to={l.to}
                  className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 transition-colors duration-200 hover:text-[#2563EB] dark:hover:text-[#35A8FF]"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Support & Policies */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
            DỊCH VỤ & BẢO HÀNH
          </h4>
          <ul className="mt-3.5 space-y-2.5">
            {supportLinks.map((l, i) => (
              <li key={i}>
                <Link
                  to={l.to}
                  className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 transition-colors duration-200 hover:text-[#2563EB] dark:hover:text-[#35A8FF]"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Payment Badges */}
          <div className="mt-6">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-2">
              THANH TOÁN AN TOÀN
            </span>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-black">
              <span className="rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
                VietQR
              </span>
              <span className="rounded-lg bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 px-2.5 py-1 border border-pink-200 dark:border-pink-800/60 shadow-2xs">
                MoMo
              </span>
              <span className="rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2.5 py-1 border border-blue-200 dark:border-blue-800/60 shadow-2xs">
                ZaloPay
              </span>
              <span className="rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 px-2.5 py-1 border border-sky-200 dark:border-sky-800/60 shadow-2xs">
                Banking 24/7
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Bar */}
      <div className="border-t border-[#E7EEF8] dark:border-slate-800/80 bg-slate-50/80 dark:bg-[#070D1A] py-4">
        <div className="container-bow flex flex-col items-center justify-between gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 sm:flex-row">
          <p>© {new Date().getFullYear()} BOW — Let's Connect. Tất cả quyền được bảo lưu.</p>
          <div className="flex items-center gap-4">
            <Link to="/contact" className="hover:text-[#2563EB] dark:hover:text-[#35A8FF] transition">
              Chính sách bảo mật
            </Link>
            <span>•</span>
            <Link to="/contact" className="hover:text-[#2563EB] dark:hover:text-[#35A8FF] transition">
              Điều khoản sử dụng
            </Link>
            <span>•</span>
            <Link to="/contact" className="hover:text-[#2563EB] dark:hover:text-[#35A8FF] transition">
              Sitemap
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
