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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-emerald-500/30 bg-gradient-to-b from-[#0F172A] to-[#15233E] p-6 text-center shadow-[0_24px_60px_rgba(16,185,129,0.25)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
        
        {/* Glow Radial Background */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.2),transparent_60%)]" />

        {/* Celebration Badge Icon */}
        <div className="relative z-10 mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500 to-teal-300 text-4xl shadow-[0_12px_28px_rgba(16,185,129,0.4)] animate-bounce">
          🎉
        </div>

        {/* Title & Headline */}
        <div className="relative z-10 mt-5">
          <span className="inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-400 border border-emerald-500/20">
            Bàn giao hoàn tất
          </span>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
            Đơn hàng đã sẵn sàng!
          </h2>
          <p className="mt-2 text-xs font-medium text-slate-300 leading-relaxed">
            Đơn hàng <span className="font-mono font-bold text-amber-400">#{order.payment_code}</span> — <span className="font-extrabold text-white">{order.product_name}</span> đã được bàn giao thành công.
          </p>
        </div>

        {/* Order Brief Summary Card */}
        <div className="relative z-10 mt-5 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 text-left backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Sản phẩm:</span>
            <span className="font-bold text-white truncate max-w-[200px]">{order.product_name}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Giá tiền:</span>
            <span className="font-black text-emerald-400">{order.price.toLocaleString('vi-VN')}đ</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>Trạng thái:</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              Đã bàn giao
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 mt-6 flex flex-col gap-2.5 sm:flex-row">
          <button
            onClick={() => {
              onViewDetails(order);
              onClose();
            }}
            className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all duration-300 hover:scale-102 hover:shadow-emerald-500/25"
          >
            🔑 Xem thông tin tài khoản
          </button>
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-700 bg-slate-800/80 px-4 py-3.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
