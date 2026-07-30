import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { SearchIcon } from '../../components/icons';
import { useToast } from '../../components/Toast';

type Order = {
  id: string;
  user_id: string;
  product_name: string;
  plan_label: string;
  price: number;
  status: 'pending_payment' | 'pending_delivery' | 'processing' | 'completed' | 'cancelled' | 'refunded';
  payment_code: string;
  notes: string;
  account_details?: string;
  created_at: string;
  profiles?: {
    email: string;
    full_name: string;
  };
};

const getStatusBadge = (status: Order['status']) => {
  switch (status) {
    case 'pending_payment':
      return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-none">Chờ thanh toán</span>;
    case 'pending_delivery':
      return <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[9px] font-bold text-[#2563EB] border border-blue-100 dark:bg-blue-950/20 dark:text-[#35A8FF] dark:border-none">Chờ bàn giao</span>;
    case 'processing':
      return <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[9px] font-bold text-indigo-700 border border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-none">Đang thiết lập</span>;
    case 'completed':
      return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-none">Đã hoàn thành</span>;
    case 'cancelled':
      return <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-[9px] font-bold text-rose-700 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-none">Đã hủy</span>;
    case 'refunded':
      return <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[9px] font-bold text-slate-700 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-none">Đã hoàn tiền</span>;
  }
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const toast = useToast();
  
  // Delivery details modal state
  const [deliveryOrder, setDeliveryOrder] = useState<Order | null>(null);
  const [deliveryDetails, setDeliveryDetails] = useState('');
  const [submittingDelivery, setSubmittingDelivery] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('orders')
        .select('*, profiles!orders_user_profile_fk(email, full_name)') as any)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        // Find expired pending_payment orders (older than 15 minutes)
        const now = Date.now();
        const expiredIds: string[] = [];
        const processedData = data.map((o: any) => {
          if (o.status === 'pending_payment') {
            const expiresAt = new Date(o.created_at).getTime() + 15 * 60 * 1000;
            if (expiresAt < now) {
              expiredIds.push(o.id);
              return { ...o, status: 'cancelled' };
            }
          }
          return o;
        });

        setOrders(processedData as Order[]);

        // Silently update database in background
        if (expiredIds.length > 0) {
          (supabase.from('orders') as any)
            .update({ status: 'cancelled' })
            .in('id', expiredIds)
            .then(() => {
              // updated silently
            });
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi tải đơn hàng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateStatus = async (orderId: string, status: Order['status']) => {
    if (!window.confirm(`Xác nhận cập nhật trạng thái đơn hàng sang "${status}"?`)) return;
    try {
      const { error } = await (supabase.from('orders') as any)
        .update({ status })
        .eq('id', orderId);
      if (error) throw error;
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi cập nhật trạng thái.');
    }
  };

  const handleDeliver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryOrder) return;
    setSubmittingDelivery(true);
    try {
      const { error } = await (supabase.from('orders') as any)
        .update({
          status: 'completed',
          account_details: deliveryDetails.trim()
        })
        .eq('id', deliveryOrder.id);

      if (error) throw error;
      setDeliveryOrder(null);
      setDeliveryDetails('');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi bàn giao đơn hàng.');
    } finally {
      setSubmittingDelivery(false);
    }
  };

  const handleRefund = async (orderId: string) => {
    if (!window.confirm('Xác nhận HOÀN TIỀN đơn hàng này về ví số dư của khách hàng?')) return;
    try {
      const { data, error } = await (supabase as any).rpc('refund_order', {
        p_order_id: orderId
      });
      if (error) throw error;
      if (data === 'success') {
        toast.success('Hoàn tiền về ví thành công!');
        fetchOrders();
      } else {
        throw new Error('Giao dịch hoàn tiền thất bại.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi hoàn tiền.');
    }
  };

  // Filter and search logic
  const filteredOrders = orders.filter((o) => {
    const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      o.payment_code.toLowerCase().includes(searchLower) ||
      o.product_name.toLowerCase().includes(searchLower) ||
      (o.profiles?.email || '').toLowerCase().includes(searchLower) ||
      (o.profiles?.full_name || '').toLowerCase().includes(searchLower);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Đơn hàng</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Xem và bàn giao dịch vụ tài khoản premium cho khách hàng.</p>
        </div>
        <button
          onClick={fetchOrders}
          className="rounded-xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:scale-102 self-start sm:self-auto"
        >
          🔄 Tải lại đơn hàng
        </button>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between bg-white dark:bg-[#131C32] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 rounded-[22px] p-4 shadow-xs">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'pending_payment', label: 'Chờ thanh toán' },
            { key: 'pending_delivery', label: 'Chờ bàn giao' },
            { key: 'processing', label: 'Đang xử lý' },
            { key: 'completed', label: 'Đã xong' },
            { key: 'cancelled', label: 'Đã hủy' },
            { key: 'refunded', label: 'Hoàn tiền' }
          ].map((st) => (
            <button
              key={st.key}
              onClick={() => setFilterStatus(st.key)}
              className={`rounded-full px-3.5 py-2 text-xs font-bold transition-all ${
                filterStatus === st.key
                  ? 'bg-gradient-to-r from-[#19A7FF] to-[#2563EB] text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-[#F4F8FF] dark:hover:bg-slate-850'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex h-11 items-center gap-2 rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] px-4 sm:max-w-xs sm:flex-1">
          <SearchIcon className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo Mã đơn, Email, Tên..."
            className="w-full bg-transparent text-xs font-bold outline-none placeholder:text-slate-400 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* ORDERS LIST */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-100 dark:border-slate-800 border-t-[#2563EB]" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-20 text-center rounded-[28px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] text-slate-400 font-semibold text-xs">
          Không tìm thấy đơn hàng nào khớp với tìm kiếm.
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          {filteredOrders.map((o) => (
            <div key={o.id} className="rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-6 shadow-xs flex flex-col gap-4">
              {/* Header info */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-50 dark:border-slate-800/60 pb-4">
                <div>
                  <h3 className="font-extrabold text-slate-950 dark:text-white text-sm sm:text-base leading-tight">{o.product_name}</h3>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    Gói: {o.plan_label} — Mã đơn: <span className="font-bold text-slate-900 dark:text-white">{o.payment_code}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-[#2563EB]">
                    {o.price.toLocaleString('vi-VN')}đ
                  </span>
                  {getStatusBadge(o.status)}
                </div>
              </div>

              {/* Customer details */}
              <div className="grid gap-3 sm:grid-cols-2 text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                <p>👤 <strong>Khách hàng:</strong> {o.profiles?.full_name || 'Thành viên'} ({o.profiles?.email || 'N/A'})</p>
                <p>📅 <strong>Ngày đặt:</strong> {new Date(o.created_at).toLocaleString('vi-VN')}</p>
                {o.notes && (
                  <p className="sm:col-span-2 bg-[#F4F8FF] dark:bg-slate-850/40 p-3.5 rounded-2xl border border-[#E8F1FF] dark:border-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                    📝 <strong>Ghi chú:</strong> {o.notes}
                  </p>
                )}
                {o.account_details && (
                  <p className="sm:col-span-2 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-950/30 text-emerald-800 dark:text-emerald-400">
                    🎁 <strong>Thông tin đã bàn giao:</strong>
                    <pre className="font-mono whitespace-pre-wrap mt-1 leading-snug">{o.account_details}</pre>
                  </p>
                )}
              </div>

              {/* Admin Actions */}
              <div className="flex flex-wrap gap-2.5 justify-end border-t border-slate-50 dark:border-slate-800/60 pt-4">
                {o.status === 'pending_delivery' && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(o.id, 'processing')}
                      className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C32] hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500 transition shadow-xs"
                    >
                      ⚙️ Báo đang xử lý
                    </button>
                    <button
                      onClick={() => setDeliveryOrder(o)}
                      className="rounded-full bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-4.5 py-2 text-xs font-bold text-white shadow-md transition hover:scale-102"
                    >
                      🚀 Bàn giao tài khoản
                    </button>
                  </>
                )}
                {o.status === 'processing' && (
                  <button
                    onClick={() => setDeliveryOrder(o)}
                    className="rounded-full bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-4.5 py-2 text-xs font-bold text-white shadow-md transition hover:scale-102"
                  >
                    🚀 Bàn giao tài khoản
                  </button>
                )}
                
                {/* Allow refund for completed or pending_delivery */}
                {(o.status === 'completed' || o.status === 'pending_delivery' || o.status === 'processing') && (
                  <button
                    onClick={() => handleRefund(o.id)}
                    className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C32] hover:bg-[#F5F9FF] px-4.5 py-2 text-xs font-bold text-slate-500 hover:text-[#2563EB] transition shadow-xs"
                  >
                    💸 Hoàn tiền về ví
                  </button>
                )}
                
                {/* Allow cancel if pending payment */}
                {o.status === 'pending_payment' && (
                  <button
                    onClick={() => handleUpdateStatus(o.id, 'cancelled')}
                    className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C32] hover:bg-red-50 px-4.5 py-2 text-xs font-bold text-slate-500 hover:text-red-500 transition shadow-xs"
                  >
                    ❌ Hủy đơn hàng
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RENDER MODAL BÀN GIAO ĐƠN HÀNG */}
      {deliveryOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setDeliveryOrder(null)} />
          
          <form onSubmit={handleDeliver} className="relative w-full max-w-md transform overflow-hidden rounded-[24px] border border-slate-100 bg-white dark:bg-[#131C32] p-6 sm:p-8 shadow-2xl transition-all text-left space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">🚀 Bàn giao dịch vụ</h3>
              <p className="text-xs text-slate-400 font-bold mt-1">Đơn hàng: {deliveryOrder.product_name} ({deliveryOrder.plan_label})</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Thông tin tài khoản / Mã kích hoạt bàn giao
              </label>
              <textarea
                required
                value={deliveryDetails}
                onChange={(e) => setDeliveryDetails(e.target.value)}
                placeholder="Nhập thông tin tài khoản, mật khẩu hoặc link kích hoạt để gửi khách hàng..."
                rows={4}
                className="w-full rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-white dark:bg-[#131C32] p-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB]"
              />
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-50 dark:border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setDeliveryOrder(null)}
                className="flex-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 py-3 text-xs font-bold text-slate-500 transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submittingDelivery}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] py-3 text-xs font-bold text-white shadow-md disabled:opacity-60 transition"
              >
                {submittingDelivery ? 'Đang gửi...' : '🚀 Bàn giao ngay'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
