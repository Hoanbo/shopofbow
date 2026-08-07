import { CheckIcon } from './icons';

export interface Order {
  id: string;
  product_name: string;
  plan_label: string;
  price: number;
  status: string;
  payment_code: string;
  notes?: string;
  account_details?: string;
  created_at: string;
}

interface OrderDeliveredModalProps {
  order: Order | null;
  onClose: () => void;
  onViewDetails: (order: Order) => void;
}

export default function OrderDeliveredModal({
  order,
  onClose,
  onViewDetails,
}: OrderDeliveredModalProps) {
  if (!order) return null;

  const isTopup =
    order.product_name === 'Nạp tiền vào ví' ||
    order.payment_code.startsWith('BOWNAP') ||
    order.payment_code.startsWith('BOWN');

  const formattedPrice = (order.price || 0).toLocaleString('vi-VN') + 'đ';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg transform rounded-[28px] border border-slate-100 dark:border-slate-800 bg-white dark:bg-[#18243E] p-6 text-center shadow-2xl transition-all sm:p-8 animate-fade-up text-slate-900 dark:text-white">
        <div className="space-y-5 py-3">
          
          {/* Green Checkmark Badge */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
            <CheckIcon className="h-8 w-8" />
          </div>

          {/* Title & Subtitle */}
          <div>
            <h3 className="text-xl font-black text-[#0F172A] dark:text-white">
              {isTopup ? 'Nạp tiền thành công!' : 'Đơn hàng đã sẵn sàng!'}
            </h3>
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-400 mt-1">
              Mã {isTopup ? 'giao dịch' : 'đơn hàng'}: <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{order.payment_code}</span>
            </p>
            <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
              {isTopup ? (
                <>
                  Cảm ơn bạn đã tin tưởng BOW. Số tiền <strong className="text-emerald-600 dark:text-emerald-400">{formattedPrice}</strong> đã được cộng tự động vào ví số dư của bạn.
                </>
              ) : (
                <>
                  Cảm ơn bạn đã tin tưởng BOW. Đơn hàng dịch vụ <strong className="text-slate-900 dark:text-white">{order.product_name}</strong> đã được bàn giao thành công.
                </>
              )}
            </p>
          </div>

          {/* Brief Order Details Box */}
          <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 text-left text-xs space-y-2">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Sản phẩm:</span>
              <span className="font-bold text-slate-900 dark:text-white">{order.product_name}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Số tiền:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{formattedPrice}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Trạng thái:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {isTopup ? 'Đã cộng ví' : 'Đã bàn giao'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2.5 sm:flex-row pt-2">
            {!isTopup && (
              <button
                type="button"
                onClick={() => {
                  onViewDetails(order);
                  onClose();
                }}
                className="flex-1 rounded-full bg-[#0F172A] dark:bg-blue-600 py-3 text-sm font-bold text-white hover:bg-black dark:hover:bg-blue-700 transition shadow-md"
              >
                🔑 Xem thông tin tài khoản
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`rounded-full py-3 text-sm font-bold transition ${
                isTopup
                  ? 'w-full bg-[#0F172A] dark:bg-blue-600 text-white hover:bg-black dark:hover:bg-blue-700 shadow-md'
                  : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 px-6'
              }`}
            >
              Đóng và tiếp tục mua sắm
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
