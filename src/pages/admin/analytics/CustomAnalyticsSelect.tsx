// src/pages/admin/analytics/CustomAnalyticsSelect.tsx
import React, { useState, useRef, useEffect } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  badge?: string;
  icon?: string;
}

interface CustomAnalyticsSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  minWidth?: string;
}

export const CustomAnalyticsSelect: React.FC<CustomAnalyticsSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Chọn...',
  className = '',
  minWidth = 'min-w-[150px]',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${minWidth} ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-8 w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/80 hover:bg-slate-50 dark:hover:bg-slate-900/90 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-500/40 hover:text-slate-900 dark:hover:text-white transition-all shadow-xs focus:outline-none focus:ring-1 focus:ring-blue-500/30"
      >
        <span className="flex items-center gap-1.5 truncate">
          {selectedOption?.icon && <span className="text-xs">{selectedOption.icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <svg
          className={`h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-400' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div className="absolute right-0 z-50 mt-1.5 w-full min-w-[180px] rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 p-1 shadow-xl dark:shadow-2xl backdrop-blur-2xl animate-fade-in max-h-64 overflow-y-auto">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left my-0.5 ${
                  isSelected
                    ? 'bg-blue-600/20 text-blue-400 font-bold border border-blue-500/20'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  {opt.icon && <span>{opt.icon}</span>}
                  <span className="truncate">{opt.label}</span>
                </span>
                {isSelected && (
                  <span className="text-blue-400 text-xs font-bold shrink-0 ml-1.5">✓</span>
                )}
                {opt.badge && !isSelected && (
                  <span className="text-[10px] text-slate-500 font-normal shrink-0 ml-1.5">
                    {opt.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
