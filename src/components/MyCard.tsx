import { useContact } from '../context/ContactContext';

export default function MyCard() {
  const contact = useContact();

  const fbUrl = contact.facebookUrl || 'https://www.facebook.com/Bobowcon';
  const instaUrl = contact.instagramUrl || 'https://www.instagram.com/bobowcon';
  const zaloUrl = contact.zaloUrl || 'https://zalo.me/0966821315';
  const tiktokUrl = contact.tiktokUrl || 'https://www.tiktok.com/@bobowcon';
  const discordUrl = contact.discordUrl || 'https://discord.gg/tT2aSRXv';
  const locketUrl = contact.locketUrl || 'https://locket.cam/bowcon';
  const emailVal = contact.supportEmail || 'hoankb4@gmail.com';
  const phoneVal = contact.supportPhone || '+84 966 821 315';
  const phoneHref = `tel:${phoneVal.replace(/\s+/g, '')}`;

  return (
    <div className="w-full flex justify-center py-2">
      {/* Main Digital Card Wrapper */}
      <div className="relative w-full max-w-[390px] rounded-[34px] border-[1.5px] border-[#84D9F6]/90 bg-gradient-to-b from-white/90 to-white/95 dark:from-[#15233E]/95 dark:to-[#0F172A]/98 p-8 shadow-[0_24px_56px_rgba(110,160,194,0.15)] dark:shadow-[0_24px_56px_rgba(0,0,0,0.4)] backdrop-blur-md overflow-hidden text-center transition-all duration-300">
        
        {/* Glow Background Effect */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,178,226,0.12),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(56,178,226,0.06),transparent_40%)]" />

        {/* Header Avatar & Taglines */}
        <div className="relative z-10 flex flex-col items-center">
          <img
            src="/my-card/asset/baobow.jpg"
            alt="BOW Avatar"
            className="h-[106px] w-[106px] rounded-full border-4 border-[#1daee3] object-cover shadow-[0_12px_30px_rgba(84,196,238,0.35)] transition-transform duration-300 hover:scale-105"
          />
          <h2 className="mt-4 text-base font-extrabold tracking-[0.22em] text-[#0f95cc] dark:text-[#38bdf8] uppercase">
            BOW
          </h2>
          <p className="mt-1 text-xs font-semibold tracking-[0.2em] uppercase text-slate-400 dark:text-slate-400">
            I'M BOW
          </p>
        </div>

        {/* Headline Section */}
        <div className="relative z-10 mt-6 text-center">
          <h1 className="text-3xl font-black tracking-tight text-[#00A3FF] dark:text-[#38bdf8] drop-shadow-xs">
            LET'S CONNECT
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-300">
            My life will be brilliant in my own way
          </p>
        </div>

        {/* Social Icons Row & Locket Pill */}
        <div className="relative z-10 mt-6 flex flex-col items-center gap-3.5">
          <div className="flex items-center justify-center gap-3">
            {/* Facebook */}
            <a
              href={fbUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[#1877F2] text-white shadow-md transition-all duration-300 hover:scale-110 hover:shadow-lg"
            >
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                <path d="M13.5 21v-7h2.3l.4-2.7h-2.7V9.6c0-.8.2-1.3 1.4-1.3H16V5.9c-.2 0-.9-.1-1.8-.1-1.8 0-3.1 1.1-3.1 3.2v2.3H9v2.7h2.1v7h2.4Z" />
              </svg>
            </a>

            {/* Instagram */}
            <a
              href={instaUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white shadow-md transition-all duration-300 hover:scale-110 hover:shadow-lg"
            >
              <svg className="h-5 w-5 stroke-current fill-none stroke-[2]" viewBox="0 0 24 24">
                <rect x="4" y="4" width="16" height="16" rx="4.6" />
                <circle cx="12" cy="12" r="3.7" />
                <circle cx="17" cy="7" r="1.15" className="fill-current" />
              </svg>
            </a>

            {/* Zalo */}
            <a
              href={zaloUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Zalo"
              className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-white p-2 shadow-md transition-all duration-300 hover:scale-110 hover:shadow-lg border border-sky-100"
            >
              <img src="/my-card/asset/Icon_of_Zalo.svg" alt="Zalo" className="h-6 w-6 object-contain" />
            </a>

            {/* TikTok */}
            <a
              href={tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[#111] text-white shadow-md transition-all duration-300 hover:scale-110 hover:shadow-lg"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#25F4EE" d="M14 4c.5 1.3 1.4 2.4 2.6 3.1 1 .6 2.1 1 3.3 1v2.6c-1.5 0-3-.4-4.4-1.1v5a5.3 5.3 0 1 1-5.3-5.3c.3 0 .5 0 .8.1v2.7a2.4 2.4 0 1 0 1.6 2.3V4H14Z" />
                <path fill="#FE2C55" d="M13.3 4c.5 1.3 1.4 2.4 2.6 3.1 1 .6 2.1 1 3.3 1v1.8c-1.3 0-2.5-.3-3.7-.9v5.6a5.3 5.3 0 1 1-5.3-5.3v1.9a3.2 3.2 0 1 0 2.2 3.1V4h.9Z" />
                <path fill="#ffffff" d="M14 4c.5 1.3 1.4 2.4 2.6 3.1 1 .6 2.1 1 3.3 1v1.1c-1.5 0-3-.4-4.4-1.1v6.2a4 4 0 1 1-4-4v1.2a2.6 2.6 0 1 0 1.3 2.3V4H14Z" />
              </svg>
            </a>

            {/* Discord */}
            <a
              href={discordUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Discord"
              className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-[#5865F2] text-white shadow-md transition-all duration-300 hover:scale-110 hover:shadow-lg"
            >
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                <path d="M20.3 5.4A16.7 16.7 0 0 0 16.2 4l-.2.4a15.2 15.2 0 0 1 3.7 1.5 11.8 11.8 0 0 0-3.6-1.1 12.5 12.5 0 0 0-8.2 1.1A15 15 0 0 1 11.6 4l-.2-.4a16.7 16.7 0 0 0-4.1 1.4C4.7 8.7 4 12.2 4.2 15.7a16.9 16.9 0 0 0 5 2.5l1.1-1.8c-.6-.2-1.1-.4-1.6-.7l.4-.3c3 1.4 6.3 1.4 9.2 0l.4.3c-.5.3-1 .5-1.6.7l1.1 1.8a16.9 16.9 0 0 0 5-2.5c.3-4-.5-7.5-2.9-10.3ZM9.6 13.6c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Zm4.8 0c-.9 0-1.6-.8-1.6-1.8s.7-1.8 1.6-1.8 1.6.8 1.6 1.8-.7 1.8-1.6 1.8Z" />
              </svg>
            </a>
          </div>

          {/* Locket Pill */}
          <a
            href={locketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#60A5FA] to-[#3B82F6] px-6 py-2 text-sm font-bold text-white shadow-md transition-all duration-300 hover:scale-105 hover:shadow-lg"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 20.5s-7-4.4-7-10.2C5 7.3 7 5.5 9.4 5.5c1.3 0 2.5.6 3.3 1.7.8-1.1 2-1.7 3.3-1.7C18 5.5 20 7.3 20 10.3c0 5.8-7 10.2-7 10.2Z" />
            </svg>
            Locket
          </a>
        </div>

        {/* Divider */}
        <div className="my-6 border-t border-slate-100 dark:border-slate-800" />

        {/* Contact Information Cards */}
        <div className="relative z-10 space-y-3">
          {/* Email */}
          <a
            href={`mailto:${emailVal}`}
            className="flex items-center gap-3.5 rounded-2xl border border-amber-100/80 dark:border-slate-700/60 bg-gradient-to-r from-slate-50/80 to-white dark:from-slate-800/80 dark:to-slate-800 p-3.5 shadow-xs transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-500 hover:scale-[1.01]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#00A3FF] dark:bg-blue-950/60 dark:text-[#38bdf8]">
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                <path d="M3 6.8A1.8 1.8 0 0 1 4.8 5h14.4A1.8 1.8 0 0 1 21 6.8v10.4A1.8 1.8 0 0 1 19.2 19H4.8A1.8 1.8 0 0 1 3 17.2V6.8Zm1.8-.3 7.2 5 7.2-5H4.8Zm14.4 11V8.4l-6.7 4.7a1 1 0 0 1-1.1 0L4.8 8.4v9.1h14.4Z" />
              </svg>
            </span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
              {emailVal}
            </span>
          </a>

          {/* Phone */}
          <a
            href={phoneHref}
            className="flex items-center gap-3.5 rounded-2xl border border-amber-100/80 dark:border-slate-700/60 bg-gradient-to-r from-slate-50/80 to-white dark:from-slate-800/80 dark:to-slate-800 p-3.5 shadow-xs transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-500 hover:scale-[1.01]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#00A3FF] dark:bg-blue-950/60 dark:text-[#38bdf8]">
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                <path d="M6.6 10.8a15.8 15.8 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1.1-.3 1.2.4 2.5.7 3.8.7.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.6.7 3.8.1.4 0 .8-.3 1.1l-2.2 2.2Z" />
              </svg>
            </span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {phoneVal}
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}

