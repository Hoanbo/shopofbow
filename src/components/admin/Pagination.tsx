import type { ReactNode } from 'react';

interface Props {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  itemLabel?: string; // e.g. "sản phẩm", "người dùng"
  onPageChange: (page: number) => void;
}

/** Shared Pagination bar — matches BOW dark navy design. */
export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  itemLabel = 'mục',
  onPageChange,
}: Props): ReactNode {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  // Show at most 5 page buttons, centered around current page
  const getPageRange = () => {
    const range: number[] = [];
    const delta = 2;
    const left = Math.max(1, currentPage - delta);
    const right = Math.min(totalPages, currentPage + delta);
    for (let i = left; i <= right; i++) range.push(i);
    return range;
  };

  const pages = getPageRange();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800/80 pt-4 bg-white dark:bg-[#131C32] p-4 rounded-[22px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 shadow-xs">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
        Hiển thị {start}–{end} / {totalItems} {itemLabel}
      </span>

      <div className="flex items-center gap-1.5">
        {/* First */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="Trang đầu"
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
        >
          «
        </button>

        {/* Prev */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
        >
          ‹ Trở lại
        </button>

        {/* First page ellipsis */}
        {pages[0] > 1 && (
          <>
            <button
              type="button"
              onClick={() => onPageChange(1)}
              className="h-7 w-7 rounded-xl text-xs font-extrabold transition bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              1
            </button>
            {pages[0] > 2 && (
              <span className="text-slate-400 text-xs px-0.5">…</span>
            )}
          </>
        )}

        {pages.map((pageNum) => (
          <button
            key={pageNum}
            type="button"
            onClick={() => onPageChange(pageNum)}
            className={`h-7 w-7 rounded-xl text-xs font-extrabold transition ${
              currentPage === pageNum
                ? 'bg-gradient-to-r from-[#19A7FF] to-[#2563EB] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {pageNum}
          </button>
        ))}

        {/* Last page ellipsis */}
        {pages[pages.length - 1] < totalPages && (
          <>
            {pages[pages.length - 1] < totalPages - 1 && (
              <span className="text-slate-400 text-xs px-0.5">…</span>
            )}
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              className="h-7 w-7 rounded-xl text-xs font-extrabold transition bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              {totalPages}
            </button>
          </>
        )}

        {/* Next */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
        >
          Tiếp ›
        </button>

        {/* Last */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="Trang cuối"
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
        >
          »
        </button>
      </div>
    </div>
  );
}
