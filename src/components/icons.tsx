import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...p,
});

export const SearchIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export const MenuIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const CloseIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const HomeIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </svg>
);

export const SparkIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    <circle cx="12" cy="12" r="3.2" />
  </svg>
);

export const AppIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" rx="1.6" />
    <rect x="14" y="3" width="7" height="7" rx="1.6" />
    <rect x="3" y="14" width="7" height="7" rx="1.6" />
    <rect x="14" y="14" width="7" height="7" rx="1.6" />
  </svg>
);

export const BagIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 8h12l-1 12H7L6 8Z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
);

export const PhoneIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 5c0 8.8 6.2 15 15 15a2 2 0 0 0 2-1.7l.3-2a1.5 1.5 0 0 0-1-1.6l-3-1a1.5 1.5 0 0 0-1.7.5l-.8 1a11.4 11.4 0 0 1-4.7-4.7l1-.8a1.5 1.5 0 0 0 .5-1.7l-1-3a1.5 1.5 0 0 0-1.6-1l-2 .3A2 2 0 0 0 4 5Z" />
  </svg>
);

export const StarIcon = (p: P) => (
  <svg {...base({ fill: 'currentColor', stroke: 'none', ...p })}>
    <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.9l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95L12 2.5Z" />
  </svg>
);

export const CheckIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const ArrowRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const ChevronRight = (p: P) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const ShieldIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const BoltIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </svg>
);

export const HeadsetIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
    <rect x="3" y="13" width="4" height="6" rx="1.4" />
    <rect x="17" y="13" width="4" height="6" rx="1.4" />
    <path d="M20 19a4 4 0 0 1-4 3h-2" />
  </svg>
);

// Brand glyphs for contact channels
export const MessengerIcon = (p: P) => (
  <svg {...base({ fill: 'currentColor', stroke: 'none', ...p })} viewBox="0 0 24 24">
    <path d="M12 2C6.3 2 2 6.2 2 11.6c0 2.9 1.3 5.4 3.4 7.1v3.3l3.1-1.7c.8.2 1.7.3 2.5.3 5.7 0 10-4.2 10-9.6C21 6.2 17.7 2 12 2Zm1 12.6-2.5-2.7-4.9 2.7 5.4-5.7 2.6 2.7 4.8-2.7-5.4 5.7Z" />
  </svg>
);

export const ZaloIcon = (p: P) => (
  <svg {...base({ fill: 'currentColor', stroke: 'none', ...p })} viewBox="0 0 24 24">
    <path d="M12 2C6.48 2 2 6.48 2 12c0 5.52 4.48 10 10 10s10-4.48 10-10c0-5.52-4.48-10-10-10zm4.93 6.18h-1.2c-.29 0-.57.13-.78.35l-3.7 4.13V8.18H9.9v7.64h1.35v-2.52l.91-1.02 2.79 3.54h1.68l-3.5-4.44 3.3-3.67c.01-.01.02-.01.03-.02V8.18h-.53zm-7.48 0H8.1v7.64h1.35V8.18z" />
  </svg>
);


export const TelegramIcon = (p: P) => (
  <svg {...base({ fill: 'currentColor', stroke: 'none', ...p })} viewBox="0 0 24 24">
    <path d="M21.9 4.3 18.7 19c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-4.9 9-8.1c.4-.3-.1-.5-.6-.2L6.1 12.6l-4.8-1.5c-1-.3-1-1 .2-1.5l18.7-7.2c.9-.3 1.6.2 1.3 1.9Z" />
  </svg>
);

export const MailIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);
