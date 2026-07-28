import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import SearchBar from './SearchBar';
import { SparkIcon } from './icons';
import newLogo from '../assets/new-logover2.png';

export default function Header() {
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const loc = useLocation();

  useEffect(() => setShowMobileSearch(false), [loc.pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-[#EBF2FA] bg-white/95 backdrop-blur-md">
      <div className="container-bow flex h-16 items-center justify-between gap-4 sm:h-[72px]">
        {/* Logo - Premium new-logover2.png */}
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <img
            src={newLogo}
            alt="BOW Logo"
            className="h-11 w-auto object-contain filter contrast-[1.12] saturate-[1.1] drop-shadow-sm transition-transform duration-200 hover:scale-105 sm:h-13"
            style={{ imageRendering: '-webkit-optimize-contrast' }}
          />
          <div className="flex flex-col leading-none">
            <span className="text-xl font-black tracking-tight text-[#00A3FF] sm:text-2xl">BOW</span>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#FFB703]">
              Let's Connect
            </span>
          </div>
        </Link>

        {/* Center Search Bar - Desktop */}
        <div className="hidden max-w-xl flex-1 px-8 md:block">
          <SearchBar className="w-full" />
        </div>

        {/* Right side - Mobile Search Button */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={() => setShowMobileSearch((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-sky-200 bg-sky-50/50 text-sky-600 shadow-xs transition hover:bg-sky-100"
            aria-label="Search"
          >
            <SparkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mobile search row dropdown */}
      {showMobileSearch && (
        <div className="container-bow pb-3 md:hidden">
          <SearchBar variant="compact" />
        </div>
      )}
    </header>
  );
}
