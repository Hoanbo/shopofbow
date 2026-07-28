interface AppLogoProps {
  slug?: string;
  name?: string;
  image?: string;
  className?: string;
}

export default function AppLogo({ slug = '', name = '', image = '', className = 'h-[64px] w-[64px]' }: AppLogoProps) {
  const key = (slug || name).toLowerCase();

  // 1. ChatGPT: Green OpenAI spiral logo (Matches Image 2)
  if (key.includes('chatgpt')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-[#10A37F] p-3 shadow-xs ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full text-white" fill="currentColor">
          <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.259 23.5a6.0462 6.0462 0 0 0 5.7618-4.218 5.9847 5.9847 0 0 0 3.9977-2.9 6.056 6.056 0 0 0-.7366-7.5609zM13.259 21.84a4.3435 4.3435 0 0 1-2.9358-1.1506l.1645-.0945 4.3013-2.4834a.853.853 0 0 0 .4265-.7366v-6.0754l1.8197 1.0503a.8384.8384 0 0 0 .4265.1157c.39 0 .7555-.2132.9444-.5422a4.3727 4.3727 0 0 1-5.1471 9.9167zm-8.8778-4.2971a4.3435 4.3435 0 0 1-.536-3.1195l.1645.0975 4.3013 2.4834a.853.853 0 0 0 .853 0l5.2581-3.0384v2.1006a.8384.8384 0 0 0 .4265.7366.853.853 0 0 0 1.0845-.1949 4.3727 4.3727 0 0 1-11.5514.9347zM3.4682 9.0778A4.3435 4.3435 0 0 1 5.868 6.8122v5.1545a.853.853 0 0 0 .4265.7366l5.2581 3.0384-1.8197 1.0503a.8384.8384 0 0 1-.853 0L4.5786 14.308a4.3727 4.3727 0 0 1-1.1104-5.2302zm15.1192 3.1926l-5.2581-3.0384 1.8197-1.0503a.853.853 0 0 1 .853 0l4.3013 2.4834a4.363 4.363 0 0 1 1.643 5.485 4.3727 4.3727 0 0 1-3.3589-3.8797zm1.944-4.8317l-.1645-.0975-4.3013-2.4834a.853.853 0 0 0-.853 0L10.0163 8.0163V5.9157a.8384.8384 0 0 0-.4265-.7366.853.853 0 0 0-1.0845.1949 4.3727 4.3727 0 0 1 12.088 1.9614zM12 14.2837l-2.6247-1.516 2.6247-1.516 2.6247 1.516-2.6247 1.516z" />
        </svg>
      </div>
    );
  }

  // 2. Claude: Orange rounded square with bold white 'AI' text (Matches Image 2 exactly!)
  if (key.includes('claude')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-[#D97757] p-2 text-white shadow-xs ${className}`}>
        <span className="text-2xl sm:text-3xl font-black tracking-tight">AI</span>
      </div>
    );
  }

  // 3. Gemini: Light blue box with 4-point blue Gemini star (Matches Image 2)
  if (key.includes('gemini')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-[#EEF4FF] p-3 shadow-xs ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full">
          <path
            d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
            fill="#1A73E8"
          />
        </svg>
      </div>
    );
  }

  // 4. Cursor: 3D geometric faceted cube (Matches Image 2)
  if (key.includes('cursor')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-slate-950 p-3 text-white shadow-xs ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </div>
    );
  }

  // 5. Grok: Black rounded square with white slashed circle Ø (Matches Image 2)
  if (key.includes('grok')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-black p-3 text-white shadow-xs ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="8" />
          <line x1="6" y1="18" x2="18" y2="6" strokeWidth="3" />
        </svg>
      </div>
    );
  }

  // 6. Perplexity: Light teal background with teal 6-petal grid (Matches Image 2)
  if (key.includes('perplexity')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-[#E6F7F6] p-3 shadow-xs ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full text-[#20B2AA]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19" />
          <circle cx="12" cy="12" r="3.5" fill="#20B2AA" />
        </svg>
      </div>
    );
  }

  // 7. YouTube Premium: Red rounded rectangle with white triangle (Matches Image 2)
  if (key.includes('youtube')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-[#FF0000] p-3 shadow-xs ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="#FFFFFF">
          <polygon points="9.5,7.5 16.5,12 9.5,16.5" />
        </svg>
      </div>
    );
  }

  // 8. Netflix: Pure red bold letter 'N' on white (Matches Image 2)
  if (key.includes('netflix')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-white p-2.5 border border-slate-100 shadow-xs ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full text-[#E50914]" fill="currentColor">
          <path d="M5.5 2h4.5l5 14V2h4v20h-4.5l-5-14v14h-4V2z" />
        </svg>
      </div>
    );
  }

  // 9. CapCut Pro: Black rounded square with white interlocking frame icon (Matches Image 2)
  if (key.includes('capcut')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-black p-3 text-white shadow-xs ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.4-1.4 3.6 3.6 7.6-7.6L20 8l-8 9z" />
        </svg>
      </div>
    );
  }

  // 10. Locket Gold: Golden yellow rounded square with white heart (Matches Image 2)
  if (key.includes('locket')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-[#FFB703] p-3 text-white shadow-xs ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </div>
    );
  }

  // 11. Canva Pro: Cyan gradient rounded square with white 'C' (Matches Image 2)
  if (key.includes('canva')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-400 to-teal-400 p-2 text-white shadow-xs ${className}`}>
        <span className="text-2xl sm:text-3xl font-black italic tracking-tighter">C</span>
      </div>
    );
  }

  // 12. Spotify: Green circle with 3 black sound wave arcs (Matches Image 2)
  if (key.includes('spotify')) {
    return (
      <div className={`flex items-center justify-center rounded-2xl bg-[#1ED760] p-2.5 shadow-xs ${className}`}>
        <svg viewBox="0 0 24 24" className="h-full w-full">
          <circle cx="12" cy="12" r="11" fill="#1ED760" />
          <path d="M17.5 16.2a.7.7 0 0 1-1 .2c-2.7-1.7-6.2-2.1-10.2-1.1a.7.7 0 1 1-.3-1.3c4.4-1 8.3-.5 11.3 1.3a.7.7 0 0 1 .2.9zm1.4-3.1a.9.9 0 0 1-1.2.3c-3.1-1.9-7.9-2.5-11.6-1.3a.9.9 0 1 1-.5-1.7c4.3-1.3 9.6-.6 13 1.5a.9.9 0 0 1 .3 1.2zm.1-3.2c-3.7-2.2-9.8-2.4-13.4-1.3a1 1 0 1 1-.6-2c4.2-1.3 10.9-1 15.2 1.5a1 1 0 0 1-1.2 1.8z" fill="#000000" />
        </svg>
      </div>
    );
  }

  // Fallback to image from assets folder
  const imgSrc = image || '/assets/bowLogo.jpeg';
  return (
    <div className={`flex items-center justify-center overflow-hidden rounded-2xl bg-white p-2 border border-slate-100/80 shadow-xs ${className}`}>
      <img src={imgSrc} alt={name} className="h-full w-full object-contain rounded-xl" loading="lazy" />
    </div>
  );
}
