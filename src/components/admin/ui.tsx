import { useState, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { ConfirmModal } from '../ConfirmModal';

/** Labeled text input for admin forms. */
export function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col justify-start w-full">
      <span className="mb-1.5 h-5 flex items-center text-xs font-bold text-slate-700 dark:text-slate-200 leading-none whitespace-nowrap truncate" title={label}>{label}</span>
      <input
        {...props}
        className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C32] px-3.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition focus:border-[#2563EB] dark:focus:border-[#35A8FF] focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 dark:disabled:bg-slate-800/50"
      />
      {hint && <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">{hint}</span>}
    </label>
  );
}

export function TextArea({
  label,
  ...props
}: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 leading-tight">{label}</span>
      <textarea
        {...props}
        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C32] px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition focus:border-[#2563EB] dark:focus:border-[#35A8FF] focus:ring-2 focus:ring-blue-500/20"
      />
    </label>
  );
}

export function Select({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 leading-tight">{label}</span>
      <div className="relative">
        <select
          {...props}
          className="h-11 w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C32] px-3.5 pr-10 text-sm font-medium text-slate-900 dark:text-white outline-none transition focus:border-[#2563EB] dark:focus:border-[#35A8FF] focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
          <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    </label>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5"
    >
      <span
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-brand-500' : 'bg-brand-100'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </span>
      <span className="text-sm font-semibold text-ink">{label}</span>
    </button>
  );
}

/** Custom styled confirm-and-run delete button. */
export function DeleteButton({ onDelete, label = 'Xóa' }: { onDelete: () => void; label?: string }) {
  const [showConfirm, setShowConfirm] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 transition hover:bg-rose-100 dark:hover:bg-rose-900/60 cursor-pointer"
      >
        {label}
      </button>

      <ConfirmModal
        isOpen={showConfirm}
        title="Xác nhận xóa"
        message="Bạn có chắc chắn muốn xóa không? Hành động này không thể hoàn tác."
        variant="danger"
        confirmText="Xóa ngay"
        cancelText="Hủy bỏ"
        onConfirm={() => {
          setShowConfirm(false);
          onDelete();
        }}
        onClose={() => setShowConfirm(false)}
      />
    </>
  );
}

export function Banner({ kind, children }: { kind: 'error' | 'success'; children: ReactNode }) {
  const cls =
    kind === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function AdminCard({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-white p-5 shadow-soft sm:p-6">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-bold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
