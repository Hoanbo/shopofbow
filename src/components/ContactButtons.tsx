import { useLocation } from 'react-router-dom';
import { MessengerIcon, ZaloIcon, PhoneIcon, MailIcon } from './icons';
import { useContact } from '../context/ContactContext';
import type { ContactSettings } from '../data/api';

export interface ContactChannel {
  key: string;
  label: string;
  handle: string;
  href: string;
  Icon: (p: React.SVGProps<SVGSVGElement>) => JSX.Element;
  color: string;
}

/** Build the visible channel list from dynamic contact settings. */
export function buildChannels(c: ContactSettings): ContactChannel[] {
  const list: ContactChannel[] = [];
  if (c.facebookUrl && c.facebookUrl !== '#') {
    list.push({
      key: 'facebook',
      label: 'Facebook',
      handle: 'Nhắn tin Facebook',
      href: c.facebookUrl,
      Icon: MessengerIcon,
      color: '#0084ff',
    });
  }
  if (c.zaloUrl && c.zaloUrl !== '#') {
    list.push({
      key: 'zalo',
      label: 'Zalo',
      handle: c.supportPhone || 'Chat Zalo',
      href: c.zaloUrl,
      Icon: ZaloIcon,
      color: '#0068ff',
    });
  }
  if (c.supportPhone) {
    list.push({
      key: 'hotline',
      label: 'Hotline',
      handle: c.supportPhone,
      href: `tel:${c.supportPhone.replace(/\s+/g, '')}`,
      Icon: PhoneIcon,
      color: '#06b6d4',
    });
  }
  if (c.supportEmail) {
    list.push({
      key: 'email',
      label: 'Email',
      handle: c.supportEmail,
      href: `mailto:${c.supportEmail}`,
      Icon: MailIcon,
      color: '#0e7490',
    });
  }
  return list;
}

/** Row of contact channels — used in Contact CTA and Contact page. */
export function ContactButtons({ variant = 'grid' }: { variant?: 'grid' | 'row' }) {
  const contact = useContact();
  const channels = buildChannels(contact);
  return (
    <div
      className={
        variant === 'grid'
          ? 'grid grid-cols-2 gap-3 sm:grid-cols-4'
          : 'flex flex-wrap gap-3'
      }
    >
      {channels.map(({ key, label, handle, href, Icon, color }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="group flex items-center gap-3 rounded-2xl border border-white/25 bg-white/10 px-4 py-3 backdrop-blur-sm transition hover:bg-white/20"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: color }}
          >
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-semibold text-white">{label}</span>
            <span className="block truncate text-xs text-white/70">{handle}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

/** Floating quick-contact FAB stack, bottom-right on desktop & mobile. */
export function ContactFab() {
  const contact = useContact();
  const location = useLocation();

  // Hide floating contact column on /contact page
  if (location.pathname === '/contact') return null;

  const fbUrl = contact.facebookUrl && contact.facebookUrl !== '#' ? contact.facebookUrl : 'https://www.facebook.com/Bobowcon';
  const zaloUrl = contact.zaloUrl && contact.zaloUrl !== '#' ? contact.zaloUrl : 'https://zalo.me/0966821315';
  const phoneRaw = contact.supportPhone || '0966821315';
  const phoneUrl = `tel:${phoneRaw.replace(/\s+/g, '')}`;

  return (
    <div className="contact-fab-stack fixed bottom-24 right-4 z-40 flex flex-col gap-3 md:bottom-6">
      {/* Facebook Button matching my-card style */}
      <a
        href={fbUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="Facebook"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1877F2] text-white shadow-lg ring-2 ring-white/60 transition-all duration-300 hover:scale-110 hover:shadow-xl"
      >
        <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
          <path d="M13.5 21v-7h2.3l.4-2.7h-2.7V9.6c0-.8.2-1.3 1.4-1.3H16V5.9c-.2 0-.9-.1-1.8-.1-1.8 0-3.1 1.1-3.1 3.2v2.3H9v2.7h2.1v7h2.4Z" />
        </svg>
      </a>

      {/* Zalo Button matching my-card style */}
      <a
        href={zaloUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="Zalo"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-white p-2 border border-sky-100 shadow-lg ring-2 ring-white/60 transition-all duration-300 hover:scale-110 hover:shadow-xl"
      >
        <img src="/my-card/asset/Icon_of_Zalo.svg" alt="Zalo" className="h-6 w-6 object-contain" />
      </a>

      {/* Phone / Hotline Call Button */}
      <a
        href={phoneUrl}
        aria-label={`Hotline: ${phoneRaw}`}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-tr from-[#06b6d4] to-[#00A3FF] text-white shadow-lg ring-2 ring-white/60 transition-all duration-300 hover:scale-110 hover:shadow-xl"
      >
        <PhoneIcon className="h-5 w-5" />
      </a>
    </div>
  );
}


