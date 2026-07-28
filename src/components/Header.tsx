import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import SearchBar from './SearchBar';
import { SparkIcon } from './icons';

export default function Header() {
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const loc = useLocation();

  useEffect(() => setShowMobileSearch(false), [loc.pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-[#EBF2FA] bg-white/95 backdrop-blur-md">
      <div className="container-bow flex h-16 items-center justify-between gap-4 sm:h-[72px]">
        {/* Logo */}
        <Link to="/" className="flex shrink-0 items-center">
          <img
            src="/assets/new-logo.png"
            alt="BOW Let's Connect Logo"
            className="h-10 w-auto object-contain sm:h-12"
          />
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
