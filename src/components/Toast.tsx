import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────
export type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastCtx {
  show: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

// ─── Context ────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastCtx | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = ++counterRef.current;
      setToasts((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  const ctx: ToastCtx = {
    show,
    success: (msg) => show(msg, 'success'),
    error: (msg) => show(msg, 'error'),
    info: (msg) => show(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── UI ─────────────────────────────────────────────────────────────────────
const KIND_STYLES: Record<ToastKind, string> = {
  success:
    'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300',
  error:
    'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300',
  info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300',
};

const KIND_ICON: Record<ToastKind, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

const KIND_ICON_CLS: Record<ToastKind, string> = {
  success: 'bg-emerald-500 text-white',
  error: 'bg-rose-500 text-white',
  info: 'bg-blue-500 text-white',
};

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 sm:bottom-6 sm:right-6"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm
            animate-fade-up max-w-sm text-sm font-medium ${KIND_STYLES[t.kind]}`}
        >
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full
              text-[10px] font-black ${KIND_ICON_CLS[t.kind]}`}
          >
            {KIND_ICON[t.kind]}
          </span>
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="ml-1 mt-0.5 shrink-0 opacity-50 hover:opacity-100 transition-opacity text-xs font-bold"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
