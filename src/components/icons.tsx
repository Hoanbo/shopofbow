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
    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
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
    <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.91 1.455 5.514 3.734 7.218V22l3.39-1.86c.91.253 1.88.39 2.876.39 5.523 0 10-4.145 10-9.272C22 6.145 17.523 2 12 2Zm1.05 12.435-2.55-2.72-4.98 2.72 5.48-5.82 2.62 2.72 4.9-2.72-5.47 5.82Z" />
  </svg>
);

export const ZaloIcon = (p: P) => (
  <svg {...base({ fill: 'currentColor', stroke: 'none', ...p })} viewBox="0 0 48 48">
    <path d="M24 4C12.95 4 4 12.95 4 24c0 4.14 1.25 7.99 3.39 11.21L4 44l9.11-2.98C16.19 42.79 19.96 44 24 44c11.05 0 20-8.95 20-20S35.05 4 24 4zm-7 27h-4V17h4v14zm12.5 0h-9l6.5-10h-6.5v-4h9l-6.5 10H29.5v4zm6.5 0h-4V17h4v14z" />
  </svg>
);

export const TelegramIcon = (p: P) => (
  <svg {...base({ fill: 'currentColor', stroke: 'none', ...p })} viewBox="0 0 24 24">
    <path d="M21.9 4.3 18.7 19c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-4.9 9-8.1c.4-.3-.1-.5-.6-.2L6.1 12.6l-4.8-1.5c-1-.3-1-1 .2-1.5l18.7-7.2c.9-.3 1.6.2 1.3 1.9Z" />
  </svg>
);

export const MailIcon = (p: P) => (
  <svg {...base({ fill: 'none', stroke: 'currentColor', strokeWidth: 2, ...p })} viewBox="0 0 24 24">
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m3 7 9 6 9-6" />
  </svg>
);
