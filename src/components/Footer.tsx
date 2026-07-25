import { Link } from 'react-router-dom';
import { buildChannels } from './ContactButtons';
import { useContact } from '../context/ContactContext';

const cols = [
  {
    title: 'Danh mục',
    links: [
      { to: '/ai-tools', label: 'AI Tools' },
      { to: '/premium-apps', label: 'Premium Apps' },
      { to: '/products', label: 'Sản phẩm nổi bật' },
    ],
  },
  {
    title: 'Hỗ trợ',
    links: [
      { to: '/contact', label: 'Liên hệ' },
      { to: '/contact', label: 'Chính sách bảo hành' },
      { to: '/contact', label: 'Hướng dẫn mua hàng' },
    ],
  },
];

export default function Footer() {
  const channels = buildChannels(useContact());
  return (
    <footer className="mt-14 border-t border-brand-100 bg-white">
      <div className="container-bow grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/bowLogo.jpeg"
              alt="BOW"
              className="h-11 w-11 rounded-xl object-cover shadow-soft ring-2 ring-white"
            />
            <span className="leading-none">
              <span className="block text-lg font-extrabold text-ink">BOW</span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-500">
                Let's Connect
              </span>
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-ink-muted">
            Cửa hàng AI Tools & Premium Apps chính chủ, giá tốt, bảo hành đầy đủ và hỗ trợ 24/7.
          </p>
        </div>

        {cols.map((col) => (
          <div key={col.title}>
            <h4 className="text-sm font-bold uppercase tracking-wide text-ink">{col.title}</h4>
            <ul className="mt-3 space-y-2">
              {col.links.map((l, i) => (
                <li key={i}>
                  <Link to={l.to} className="text-sm text-ink-muted transition hover:text-brand-600">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h4 className="text-sm font-bold uppercase tracking-wide text-ink">Kết nối</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {channels.map(({ key, label, href, Icon, color }) => (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="grid h-10 w-10 place-items-center rounded-xl text-white shadow-soft transition hover:scale-110"
                style={{ backgroundColor: color }}
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-brand-100 py-4">
        <p className="container-bow text-center text-xs text-ink-muted">
          © {new Date().getFullYear()} BOW — Let's Connect. Thiết kế bởi Nguyễn Văn Hoàn.
        </p>
      </div>
    </footer>
  );
}
