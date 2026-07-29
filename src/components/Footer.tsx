import { Link } from 'react-router-dom';
import { buildChannels } from './ContactButtons';
import { useContact } from '../context/ContactContext';
import newLogo from '../assets/new-logover2.png';

const aiToolLinks = [
  { to: '/ai-tools/chatgpt-plus', label: 'ChatGPT Plus chính chủ' },
  { to: '/ai-tools/claude-pro', label: 'Claude 3.5 Sonnet Pro' },
  { to: '/ai-tools/gemini-advanced', label: 'Google Gemini Advanced' },
  { to: '/ai-tools/grok-ai', label: 'Grok Premium AI' },
  { to: '/ai-tools/perplexity-pro', label: 'Perplexity Pro AI' },
  { to: '/ai-tools/cursor-pro', label: 'Cursor Pro Code AI' },
];

const premiumAppLinks = [
  { to: '/premium-apps/youtube-premium', label: 'YouTube Premium 4K' },
  { to: '/premium-apps/netflix-premium', label: 'Netflix 4K Ultra HD' },
  { to: '/premium-apps/capcut-pro', label: 'CapCut Pro chính chủ' },
  { to: '/premium-apps/spotify-premium', label: 'Spotify Premium Hifi' },
  { to: '/premium-apps/canva-pro', label: 'Canva Pro bản quyền' },
  { to: '/premium-apps/locket-gold', label: 'Locket Gold VIP' },
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
  const channels = buildChannels(contactInfo);

  return (
    <footer className="hidden md:block mt-10 border-t border-[#E7EEF8] bg-white text-[#0F172A]">
      {/* Top Banner / Features Bar inside Footer */}


      {/* Main Grid Content */}
      <div className="container-bow grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-5 lg:py-12">
        {/* Brand Info (2 Columns wide on desktop) */}
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <img
              src={newLogo}
              alt="BOW Logo"
              className="h-10 w-auto object-contain filter drop-shadow-xs"
            />
            <div className="flex flex-col leading-none">
              <span className="text-xl font-black tracking-tight text-[#00A3FF]">BOW</span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#FFB703]">
                Let's Connect
              </span>
            </div>
          </div>
          <p className="mt-3.5 max-w-sm text-xs sm:text-sm text-slate-500 leading-relaxed">
            Hệ thống cung cấp tài khoản AI Tools & Ứng dụng Premium chính chủ uy tín hàng đầu Việt Nam. Kích hoạt nhanh chóng, cam kết bảo hành full thời hạn và chăm sóc khách hàng chuyên nghiệp.
          </p>

          {/* Contact Details */}
          <div className="mt-4 space-y-1.5 text-xs text-slate-600">
            <p><strong className="text-slate-800">Hotline / Zalo:</strong> {contactInfo.supportPhone || '0987.654.321'}</p>
            <p><strong className="text-slate-800">Email Hỗ Trợ:</strong> {contactInfo.supportEmail || 'support@shopofbow.com'}</p>
            <p><strong className="text-slate-800">Thời gian làm việc:</strong> 08:00 - 23:30 (Cả T7, CN & Lễ)</p>
          </div>

          {/* Social Channels */}
          <div className="mt-5">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A] block mb-2.5">KẾT NỐI VỚI CHÚNG TÔI</span>
            <div className="flex flex-wrap gap-2.5">
              {channels.map(({ key, label, href, Icon }) => (
                <a
                  key={key}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-md transition-transform duration-300 hover:scale-110 hover:bg-[#1D4ED8]"
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* AI Tools */}
        <div>
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A]">AI TOOLS NỔI BẬT</h4>
          <ul className="mt-3.5 space-y-2">
            {aiToolLinks.map((l, i) => (
              <li key={i}>
                <Link to={l.to} className="text-xs sm:text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-[#2563EB]">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Premium Apps */}
        <div>
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A]">ỨNG DỤNG PREMIUM</h4>
          <ul className="mt-3.5 space-y-2">
            {premiumAppLinks.map((l, i) => (
              <li key={i}>
                <Link to={l.to} className="text-xs sm:text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-[#2563EB]">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Support & Policies */}
        <div>
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A]">DỊCH VỤ & BẢO HÀNH</h4>
          <ul className="mt-3.5 space-y-2">
            {supportLinks.map((l, i) => (
              <li key={i}>
                <Link to={l.to} className="text-xs sm:text-sm font-medium text-slate-500 transition-colors duration-200 hover:text-[#2563EB]">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Payment Badges */}
          <div className="mt-6">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">THANH TOÁN AN TOÀN</span>
            <div className="flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-600">
              <span className="rounded-md bg-slate-100 px-2 py-1 border border-slate-200">VietQR</span>
              <span className="rounded-md bg-pink-50 text-pink-700 px-2 py-1 border border-pink-200">MoMo</span>
              <span className="rounded-md bg-blue-50 text-blue-700 px-2 py-1 border border-blue-200">ZaloPay</span>
              <span className="rounded-md bg-emerald-50 text-emerald-700 px-2 py-1 border border-emerald-200">Banking 24/7</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-[#E7EEF8] bg-slate-50/70 py-4">
        <div className="container-bow flex flex-col items-center justify-between gap-2 text-xs font-medium text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} BOW — Let's Connect. Tất cả quyền được bảo lưu.</p>
          <div className="flex items-center gap-4">
            <Link to="/contact" className="hover:text-[#2563EB] transition">Chính sách bảo mật</Link>
            <span>•</span>
            <Link to="/contact" className="hover:text-[#2563EB] transition">Điều khoản sử dụng</Link>
            <span>•</span>
            <Link to="/contact" className="hover:text-[#2563EB] transition">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
