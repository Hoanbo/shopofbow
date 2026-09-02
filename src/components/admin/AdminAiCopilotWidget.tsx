import { useState } from 'react';
import AdminAiCopilotModal from './AdminAiCopilotModal';

export default function AdminAiCopilotWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Trigger Button for Admin */}
      <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-[9990]">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-2 md:px-4 md:py-2.5 text-white shadow-2xl shadow-indigo-500/40 ring-2 ring-white/30 hover:scale-105 hover:shadow-indigo-500/60 transition-all duration-300 cursor-pointer"
          title="Mở BOW Admin AI Copilot"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-md shadow-inner">
            <span className="text-sm">✨</span>
          </div>
          <div className="hidden md:flex flex-col text-left leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-wide">Admin AI Copilot</span>
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <span className="text-[9.5px] font-semibold text-blue-200/90">Trợ lý vận hành bán tự động</span>
          </div>
        </button>
      </div>

      {/* Admin Copilot Centered Dialog Modal */}
      <AdminAiCopilotModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
