interface AppLogoProps {
  slug?: string;
  name?: string;
  image?: string;
  className?: string;
}

export default function AppLogo({ slug = '', name = '', image = '', className = 'h-16 w-16' }: AppLogoProps) {
  const key = (slug || name).toLowerCase();

  // ChatGPT
  if (key.includes('chatgpt')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-[#10a37f]/10 p-2 ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full text-[#10a37f]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z" className="opacity-0" />
          <path d="M19.07 4.93A10 10 0 0 0 4.93 19.07 10 10 0 0 0 19.07 4.93z" className="opacity-0" />
          {/* OpenAI Helix */}
          <path d="M12 4.5a3.5 3.5 0 0 1 3.25 4.8l-1.16 2a3.5 3.5 0 0 1-5.18.96L7.5 11a3.5 3.5 0 0 1 .59-6.38L12 4.5z" />
          <path d="M19.5 9.5a3.5 3.5 0 0 1-1.37 5.67l-2.26.4a3.5 3.5 0 0 1-3.43-3.95l.41-2.26a3.5 3.5 0 0 1 6.65.14z" fill="#10a37f" />
          <path d="M17.5 17.5a3.5 3.5 0 0 1-5.18.96l-2-1.16a3.5 3.5 0 0 1-.96-5.18l1.16-2a3.5 3.5 0 0 1 6.98 7.38z" fill="#10a37f" />
          <path d="M8.5 19.5a3.5 3.5 0 0 1-3.25-4.8l1.16-2a3.5 3.5 0 0 1 5.18-.96L13.5 13a3.5 3.5 0 0 1-.59 6.38L8.5 19.5z" fill="#10a37f" />
          <path d="M4.5 14.5a3.5 3.5 0 0 1 1.37-5.67l2.26-.4a3.5 3.5 0 0 1 3.43 3.95l-.41 2.26a3.5 3.5 0 0 1-6.65-.14z" fill="#10a37f" />
        </svg>
      </div>
    );
  }

  // Claude
  if (key.includes('claude')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-[#D97757]/10 p-2 ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full text-[#D97757]" fill="currentColor">
          <path d="M12 2L13.8 8.2L20.2 10L13.8 11.8L12 18L10.2 11.8L3.8 10L10.2 8.2L12 2Z" />
          <path d="M18 16L19 19L22 20L19 21L18 24L17 21L14 20L17 19L18 16Z" />
          <path d="M6 3L6.8 5.2L9 6L6.8 6.8L6 9L5.2 6.8L3 6L5.2 5.2L6 3Z" />
        </svg>
      </div>
    );
  }

  // Gemini
  if (key.includes('gemini')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-500/10 via-purple-500/10 to-indigo-500/10 p-2 ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full">
          <defs>
            <linearGradient id="geminiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1A73E8" />
              <stop offset="50%" stopColor="#8AB4F8" />
              <stop offset="100%" stopColor="#C58AF9" />
            </linearGradient>
          </defs>
          <path
            d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
            fill="url(#geminiGrad)"
          />
        </svg>
      </div>
    );
  }

  // Cursor
  if (key.includes('cursor')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-slate-900 p-2.5 text-white ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 3l14 9-7 2-2 7-5-18z" fill="currentColor" />
        </svg>
      </div>
    );
  }

  // Grok
  if (key.includes('grok')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-black p-2.5 text-white ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="8" />
          <line x1="6" y1="18" x2="18" y2="6" strokeWidth="3" />
        </svg>
      </div>
    );
  }

  // Perplexity
  if (key.includes('perplexity')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-[#20B2AA]/10 p-2 ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full text-[#20B2AA]" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" />
          <circle cx="12" cy="12" r="4" fill="#20B2AA" />
        </svg>
      </div>
    );
  }

  // YouTube
  if (key.includes('youtube')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-red-50 p-2 ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full">
          <rect width="24" height="17" y="3.5" rx="4" fill="#FF0000" />
          <polygon points="10,7.5 16,12 10,16.5" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }

  // Netflix
  if (key.includes('netflix')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-red-50 p-2 ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="#E50914">
          <path d="M5 2h4l6 15V2h4v20h-4l-6-15v15H5V2z" />
        </svg>
      </div>
    );
  }

  // CapCut
  if (key.includes('capcut')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-black p-2.5 text-white ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.4-1.4 3.6 3.6 7.6-7.6L20 8l-8 9z" />
        </svg>
      </div>
    );
  }

  // Locket
  if (key.includes('locket')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-[#FFB703] p-2.5 text-white ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </div>
    );
  }

  // Canva
  if (key.includes('canva')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-gradient-to-r from-teal-400 to-cyan-500 p-2 text-white ${className}`}>
        <span className="text-2xl font-black italic tracking-tighter">C</span>
      </div>
    );
  }

  // Spotify
  if (key.includes('spotify')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-[#1ED760]/10 p-2 ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full">
          <circle cx="12" cy="12" r="11" fill="#1ED760" />
          <path d="M17.5 16.2a.7.7 0 0 1-1 .2c-2.7-1.7-6.2-2.1-10.2-1.1a.7.7 0 1 1-.3-1.3c4.4-1 8.3-.5 11.3 1.3a.7.7 0 0 1 .2.9zm1.4-3.1a.9.9 0 0 1-1.2.3c-3.1-1.9-7.9-2.5-11.6-1.3a.9.9 0 1 1-.5-1.7c4.3-1.3 9.6-.6 13 1.5a.9.9 0 0 1 .3 1.2zm.1-3.2c-3.7-2.2-9.8-2.4-13.4-1.3a1 1 0 1 1-.6-2c4.2-1.3 10.9-1 15.2 1.5a1 1 0 0 1-1.2 1.8z" fill="#000000" />
        </svg>
      </div>
    );
  }

  // Default image fallback
  return (
    <div className={`flex items-center justify-center overflow-hidden rounded-2xl bg-slate-50 p-2 shadow-xs ${className}`}>
      <img src={image || '/assets/bowLogo.jpeg'} alt={name} className="h-full w-full object-contain" />
    </div>
  );
}
