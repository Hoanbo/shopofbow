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

/** Floating quick-contact FAB stack, bottom-right on desktop. */
export function ContactFab() {
  const contact = useContact();
  const channels = buildChannels(contact).slice(0, 3);
  if (channels.length === 0) return null;
  return (
    <div className="fixed bottom-24 right-4 z-40 hidden flex-col gap-2.5 md:bottom-6 md:flex">
      {channels.map(({ key, label, href, Icon, color }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg ring-2 ring-white/60 transition hover:scale-110"
          style={{ backgroundColor: color }}
        >
          <Icon className="h-6 w-6" />
        </a>
      ))}
    </div>
  );
}
