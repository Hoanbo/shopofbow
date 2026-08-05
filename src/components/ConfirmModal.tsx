import React from 'react';
import { createPortal } from 'react-dom';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary' | 'success';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  variant = 'warning',
  loading = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: '💸',
          badgeBg: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
          btnBg: 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-lg shadow-rose-500/30',
        };
      case 'success':
        return {
          icon: '💰',
          badgeBg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
          btnBg: 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/30',
        };
      case 'primary':
        return {
          icon: '🔄',
          badgeBg: 'bg-blue-500/10 text-[#35A8FF] border-blue-500/20',
          btnBg: 'bg-gradient-to-r from-[#00A3FF] to-[#2563EB] hover:from-sky-500 hover:to-blue-700 text-white shadow-lg shadow-blue-500/30',
        };
      case 'warning':
      default:
        return {
          icon: '⚠️',
          badgeBg: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
          btnBg: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/30',
        };
    }
  };

  const styles = getVariantStyles();

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        onClick={() => !loading && onClose()}
      />

      {/* Modal Card Box */}
      <div className="relative z-[100000] w-full max-w-sm transform overflow-hidden rounded-[28px] border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#18243E] p-6 shadow-2xl transition-all text-center space-y-4">
        {/* Icon Badge */}
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border text-2xl shadow-xs ${styles.badgeBg}`}
        >
          {styles.icon}
        </div>

        {/* Text Content */}
        <div className="space-y-2">
          <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug">
            {title}
          </h3>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-300 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50 transition"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`flex-1 rounded-full py-2.5 text-xs font-bold shadow-md disabled:opacity-50 transition ${styles.btnBg}`}
          >
            {loading ? 'Đang xử lý...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
