import { useState } from 'react';
import BowAgentChatModal from './BowAgentChatModal';

export default function BowAgentWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-[9990]">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#00A3FF] via-[#2563EB] to-[#7C3AED] p-1.5 md:pl-2.5 md:pr-4 md:py-2 text-white shadow-xl shadow-blue-500/30 ring-2 ring-white/60 dark:ring-slate-900 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/40 cursor-pointer"
          title="Trò chuyện cùng BOW Agent"
          aria-label="Open BOW Agent"
        >
          {/* Glowing AI Sparkle Icon */}
          <div className="flex h-9 w-9 md:h-8 md:w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-md shadow-inner">
            <span className="text-base md:text-sm animate-pulse">✨</span>
          </div>

          {/* Desktop Label */}
          <div className="hidden md:flex flex-col text-left leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-wide">BOW Agent</span>
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <span className="text-[9.5px] font-semibold text-blue-100/90">Trợ lý 24/7</span>
          </div>
        </button>
      </div>

      {/* Chat Dialog Modal */}
      <BowAgentChatModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
