import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { CloseIcon } from '../components/icons';

const BANK_CONFIG = {
  bankId: 'BIDV',
  accountNo: '4330700679',
  accountName: 'NGUYEN VAN HOAN',
};

type Order = {
  id: string;
  product_name: string;
  plan_label: string;
  price: number;
  status: 'pending_payment' | 'pending_delivery' | 'processing' | 'completed' | 'cancelled' | 'refunded';
  payment_code: string;
  notes: string;
  account_details?: string;
  created_at: string;
};

// Helper for Status Tags color
const getStatusBadge = (status: Order['status']) => {
  switch (status) {
    case 'pending_payment':
      return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-100">Chờ thanh toán</span>;
    case 'pending_delivery':
      return <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#2563EB] border border-blue-100">Chờ bàn giao</span>;
    case 'processing':
      return <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 border border-indigo-100">Đang thiết lập</span>;
    case 'completed':
      return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-100">Đã hoàn thành</span>;
    case 'cancelled':
      return <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-100">Đã hủy</span>;
    case 'refunded':
      return <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 border border-slate-200">Đã hoàn tiền</span>;
  }
};

// Sub-component for individual Order Card with built-in Countdown & Cancel logic
function OrderCard({
  order,
  onPay,
  onCancelSuccess,
}: {
  order: Order;
  onPay: (o: Order) => void;
  onCancelSuccess: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (order.status !== 'pending_payment') return;

    const updateTimer = () => {
      const expiresAt = new Date(order.created_at).getTime() + 15 * 60 * 1000; // 15 mins expiry
      const diff = expiresAt - Date.now();

      if (diff <= 0) {
        setTimeLeft('Hết hạn thanh toán');
        setIsExpired(true);
        return false;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`⏱️ Hạn thanh toán còn lại: ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      return true;
    };

    updateTimer();
    const interval = setInterval(() => {
      const active = updateTimer();
      if (!active) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [order.id, order.status, order.created_at, onCancelSuccess]);

  const handleCancel = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy đơn hàng này?')) return;
    try {
      const { error } = await (supabase.from('orders') as any)
        .update({ status: 'cancelled' })
        .eq('id', order.id);
      if (error) throw error;
      onCancelSuccess();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi hủy đơn hàng.');
    }
  };

  const displayStatus = isExpired ? 'cancelled' : order.status;

  return (
    <div className="rounded-2xl border border-slate-100 p-4 hover:shadow-xs transition">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-extrabold text-[#0F172A]">{order.product_name}</h4>
          <p className="text-xs font-medium text-slate-400 mt-0.5">
            Gói: {order.plan_label} — Mã: <span className="font-bold text-[#0F172A]">{order.payment_code}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(displayStatus)}
          <span className="text-sm font-black text-[#2563EB]">
            {order.price.toLocaleString('vi-VN')}đ
          </span>
        </div>
      </div>

      {order.notes && (
        <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-xs text-slate-600 font-medium">
          <strong>Ghi chú đơn hàng:</strong> {order.notes}
        </div>
      )}

      {order.status === 'completed' && order.account_details && (
        <div className="mt-3 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 leading-relaxed">
          <strong className="block text-emerald-900 font-extrabold text-sm mb-1">🎁 Thông tin bàn giao dịch vụ:</strong>
          <pre className="font-mono whitespace-pre-wrap">{order.account_details}</pre>
        </div>
      )}

      {/* Pay now + Cancel triggers if pending_payment */}
      {order.status === 'pending_payment' && !isExpired && (
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-t border-slate-50 pt-3">
          <span className="text-xs font-bold text-amber-600 animate-pulse">
            {timeLeft}
          </span>
          <div className="flex items-center gap-2.5 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border border-slate-200 bg-white hover:bg-slate-50 px-4 py-1.5 text-xs font-bold text-slate-500 transition"
            >
              ❌ Hủy đơn hàng
            </button>
            <button
              type="button"
              onClick={() => onPay(order)}
              className="rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] px-4.5 py-1.5 text-xs font-bold text-white shadow-xs hover:scale-102 transition"
            >
              💳 Thanh toán ngay (Quét QR)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { session, balance, refreshBalance } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const nav = useNavigate();

  // Tab State
  const activeTab = searchParams.get('tab') || 'orders';

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [errorOrders, setErrorOrders] = useState<string | null>(null);
  const [selectedPayOrder, setSelectedPayOrder] = useState<Order | null>(null);

  // Deposit State
  const [depositAmount, setDepositAmount] = useState<number>(50000);
  const [depositCode, setDepositCode] = useState('');
  const [showDepositQr, setShowDepositQr] = useState(false);

  // Profile Edit State
  const [fullName, setFullName] = useState(session?.user?.user_metadata?.full_name || '');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!session) {
      nav('/login', { replace: true });
    }
  }, [session, nav]);

  // Fetch Orders
  const fetchOrders = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoadingOrders(true);
    setErrorOrders(null);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data || []) as Order[]);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setErrorOrders('Không thể tải lịch sử đơn hàng. Vui lòng thử lại.');
    } finally {
      setLoadingOrders(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchOrders();
      refreshBalance();
    }
  }, [session?.user?.id, activeTab]);

  if (!session) return null;

  // Handle Profile Update
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    try {
      // 1. Update Auth Metadata
      const { error: authErr } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() }
      });
      if (authErr) throw authErr;

      // 2. Update Profiles Table
      const { error: dbErr } = await (supabase
        .from('profiles') as any)
        .update({ full_name: fullName.trim() })
        .eq('id', session.user.id);
      if (dbErr) throw dbErr;

      alert('Cập nhật hồ sơ thành công!');
    } catch (err: any) {
      alert(err.message || 'Lỗi cập nhật hồ sơ.');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleCreateDeposit = () => {
    const shortId = session.user.id.slice(-5).toUpperCase();
    setDepositCode(`NAP${shortId}`);
    setShowDepositQr(true);
  };

  return (
    <div className="container-bow py-8 sm:py-12">
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* SIDEBAR NAVIGATION */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="rounded-[28px] border border-[#E7EEF8] bg-white p-5 shadow-xs">
            {/* Header info */}
            <div className="flex items-center gap-3 border-b border-slate-50 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] text-sm font-black text-white shadow-xs">
                {(session.user.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-extrabold text-[#0F172A] truncate">
                  {session.user.user_metadata.full_name || 'Thành viên'}
                </h4>
                <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">{session.user.email}</p>
              </div>
            </div>

            {/* Sidebar Tabs */}
            <nav className="mt-4 space-y-1">
              {[
                { id: 'orders', label: '📋 Lịch sử đơn hàng' },
                { id: 'wallet', label: '💳 Ví tiền & Nạp số dư' },
                { id: 'profile', label: '👤 Hồ sơ của tôi' },
                { id: 'favorites', label: '💙 Sản phẩm yêu thích' },
                { id: 'settings', label: '⚙️ Cài đặt tài khoản' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSearchParams({ tab: t.id })}
                  className={`flex w-full items-center rounded-2xl px-4 py-3 text-xs font-bold transition-all duration-200 ${
                    activeTab === t.id
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-[#2563EB] dark:text-[#35A8FF] shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* CONTENT AREA */}
        <main className="flex-1 min-w-0">
          {/* TAB: ORDERS */}
          {activeTab === 'orders' && (
            <div className="rounded-[28px] border border-[#E7EEF8] bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                <h2 className="text-lg font-black text-[#0F172A]">Lịch sử đơn hàng</h2>
                <button onClick={fetchOrders} className="text-xs font-bold text-[#2563EB] hover:underline">
                  Tải lại
                </button>
              </div>

              {loadingOrders ? (
                <div className="mt-5 space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="animate-pulse rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                      <div className="flex justify-between items-center">
                        <div className="space-y-2 flex-1">
                          <div className="h-4 w-1/3 rounded-md bg-slate-100 dark:bg-slate-800" />
                          <div className="h-3 w-1/4 rounded-md bg-slate-50 dark:bg-slate-800/50" />
                        </div>
                        <div className="h-6 w-16 rounded-full bg-slate-100 dark:bg-slate-800" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : errorOrders ? (
                <div className="py-16 text-center space-y-4">
                  <span className="text-4xl block">⚠️</span>
                  <p className="text-sm font-semibold text-rose-500">{errorOrders}</p>
                  <button
                    onClick={fetchOrders}
                    className="inline-flex rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] px-6 py-2.5 text-xs font-bold text-white shadow-md hover:scale-102 transition"
                  >
                    Tải lại đơn hàng
                  </button>
                </div>
              ) : orders.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <span className="text-4xl block">📦</span>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Bạn chưa có đơn hàng nào.</p>
                  <Link to="/" className="inline-flex rounded-full bg-[#2563EB] px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-[#1D4ED8] transition">
                    Khám phá sản phẩm
                  </Link>
                </div>
              ) : (
                <div className="mt-5 space-y-4 animate-fade-in">
                  {orders.map((o) => (
                    <OrderCard
                      key={o.id}
                      order={o}
                      onPay={(payOrder) => setSelectedPayOrder(payOrder)}
                      onCancelSuccess={fetchOrders}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: WALLET */}
          {activeTab === 'wallet' && (
            <div className="space-y-6">
              {/* Card info */}
              <div className="rounded-[28px] border border-[#E7EEF8] bg-gradient-to-r from-[#00A3FF] to-[#2563EB] p-6 text-white shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-100">Số dư khả dụng</span>
                  <h3 className="text-3xl font-black text-white mt-1">
                    {balance.toLocaleString('vi-VN')}đ
                  </h3>
                </div>
                <button
                  onClick={refreshBalance}
                  className="rounded-full bg-white/20 hover:bg-white/30 px-5 py-2 text-xs font-bold text-white transition self-start sm:self-auto"
                >
                  🔄 Đồng bộ số dư
                </button>
              </div>

              {/* Deposit section */}
              <div className="rounded-[28px] border border-[#E7EEF8] bg-white p-6 shadow-xs">
                <h3 className="text-base font-extrabold text-[#0F172A] border-b border-slate-50 pb-3">Nạp tiền vào ví (Chuyển khoản tự động)</h3>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Nhập số tiền cần nạp
                    </label>
                    <div className="flex gap-3 max-w-sm">
                      <input
                        type="number"
                        min={10000}
                        step={10000}
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(Number(e.target.value))}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold outline-none transition focus:border-[#2563EB] text-[#0F172A]"
                      />
                      <button
                        onClick={handleCreateDeposit}
                        className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-5 text-xs font-bold text-white shadow-xs"
                      >
                        Tạo QR
                      </button>
                    </div>
                  </div>

                  {/* Suggest buttons */}
                  <div className="flex flex-wrap gap-2.5">
                    {[20000, 50000, 100000, 200000, 500000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setDepositAmount(amt)}
                        className={`rounded-full border px-4 py-1 text-xs font-bold transition ${depositAmount === amt
                          ? 'border-[#2563EB] bg-blue-50 text-[#2563EB]'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                          }`}
                      >
                        {amt.toLocaleString('vi-VN')}đ
                      </button>
                    ))}
                  </div>

                  {/* Deposit instructions and QR */}
                  {showDepositQr && (
                    <div className="border-t border-slate-100 pt-5 mt-5 flex flex-col md:flex-row gap-6 items-center">
                      <div className="w-full max-w-[180px] shrink-0 border border-slate-100 rounded-2xl bg-slate-50 p-2 shadow-xs">
                        <img
                          src={`https://img.vietqr.io/image/${BANK_CONFIG.bankId}-${BANK_CONFIG.accountNo}-compact2.jpg?amount=${depositAmount}&addInfo=${depositCode}&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}`}
                          alt="VietQR Deposit"
                          className="h-full w-full object-contain rounded-xl"
                        />
                      </div>
                      <div className="flex-1 space-y-2 text-xs text-slate-700 leading-relaxed w-full">
                        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3.5 text-amber-800 font-semibold mb-3">
                          ⚠️ Nhập chính xác Nội dung chuyển khoản để hệ thống đối soát và cộng tiền ví tự động trong 30 giây!
                        </div>
                        <p><strong>Ngân hàng:</strong> {BANK_CONFIG.bankId} (Ngân hàng BIDV)</p>
                        <p><strong>Số tài khoản:</strong> {BANK_CONFIG.accountNo}</p>
                        <p><strong>Chủ tài khoản:</strong> {BANK_CONFIG.accountName}</p>
                        <p><strong>Số tiền nạp:</strong> <span className="font-extrabold text-blue-600">{depositAmount.toLocaleString('vi-VN')}đ</span></p>
                        <p className="flex items-center gap-2">
                          <strong>Nội dung nạp:</strong>
                          <span className="font-black text-sm bg-blue-100 text-[#2563EB] px-2 py-0.5 rounded-md">{depositCode}</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: PROFILE */}
          {activeTab === 'profile' && (
            <div className="rounded-[28px] border border-[#E7EEF8] bg-white p-6 shadow-xs">
              <h2 className="text-lg font-black text-[#0F172A] border-b border-slate-50 pb-3">Hồ sơ của tôi</h2>

              <div className="mt-5 space-y-6 max-w-lg">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] text-xl font-black text-white shadow-xs">
                    {(session.user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-[#0F172A]">
                      {session.user.user_metadata.full_name || 'Thành viên của BOW'}
                    </h4>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Ngày gia nhập: {new Date(session.user.created_at).toLocaleDateString('vi-VN')}</p>
                  </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-4 border-t border-slate-50 pt-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                      Họ và Tên
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nhập họ và tên đầy đủ của bạn"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium outline-none transition focus:border-[#2563EB] text-[#0F172A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Địa chỉ Email (Không được đổi)
                    </label>
                    <input
                      type="email"
                      disabled
                      value={session.user.email}
                      className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50/50 px-3.5 text-sm font-medium text-slate-400 cursor-not-allowed outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={updatingProfile}
                    className="rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] px-6 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-60 transition"
                  >
                    {updatingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB: FAVORITES */}
          {activeTab === 'favorites' && (
            <div className="rounded-[28px] border border-[#E7EEF8] bg-white p-6 shadow-xs">
              <h2 className="text-lg font-black text-[#0F172A] border-b border-slate-50 pb-3">Sản phẩm yêu thích</h2>
              <div className="py-16 text-center space-y-2">
                <span className="text-4xl block">💙</span>
                <p className="text-sm font-medium text-slate-500">Chức năng yêu thích sản phẩm đang được xây dựng.</p>
              </div>
            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="rounded-[28px] border border-[#E7EEF8] bg-white p-6 shadow-xs">
              <h2 className="text-lg font-black text-[#0F172A] border-b border-slate-50 pb-3">Cài đặt tài khoản</h2>
              <div className="mt-5 space-y-4 max-w-md">
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-xs text-slate-600 leading-relaxed font-medium">
                  🔒 Để thay đổi thông tin bảo mật, đổi mật khẩu hoặc xóa tài khoản, vui lòng liên hệ Admin qua kênh hỗ trợ Zalo/Messenger của BOW để được xác minh danh tính và hỗ trợ trực tiếp.
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* RENDER POPUP TÁI THANH TOÁN QR ĐƠN HÀNG */}
      {selectedPayOrder && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setSelectedPayOrder(null)} />

          <div className="relative w-full max-w-md transform overflow-hidden rounded-[28px] border border-slate-100 bg-white p-6 shadow-2xl transition-all sm:p-8 animate-fade-up text-center space-y-5">
            <button
              onClick={() => setSelectedPayOrder(null)}
              className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full border border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100 transition"
            >
              <CloseIcon className="h-4.5 w-4.5" />
            </button>

            <div>
              <h3 className="text-lg font-black text-[#0F172A]">Thanh toán đơn hàng</h3>
              <p className="text-xs font-semibold text-slate-400 mt-1">Đơn hàng: {selectedPayOrder.product_name} ({selectedPayOrder.plan_label})</p>
              <p className="text-[11px] font-medium text-slate-500 mt-1">
                Vui lòng quét mã QR bên dưới để chuyển khoản {selectedPayOrder.price.toLocaleString('vi-VN')}đ.
              </p>
            </div>

            {/* QR VietQR */}
            <div className="mx-auto flex max-w-[190px] flex-col items-center rounded-2xl border border-slate-100 bg-slate-50 p-2 shadow-xs">
              <img
                src={`https://img.vietqr.io/image/${BANK_CONFIG.bankId}-${BANK_CONFIG.accountNo}-compact2.jpg?amount=${selectedPayOrder.price}&addInfo=${selectedPayOrder.payment_code}&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}`}
                alt="VietQR RePay"
                className="h-full w-full object-contain rounded-xl"
              />
            </div>

            {/* details */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-left text-xs space-y-1.5 text-[#0F172A]">
              <p><strong>Ngân hàng:</strong> {BANK_CONFIG.bankId} (BIDV)</p>
              <p><strong>Số tài khoản:</strong> {BANK_CONFIG.accountNo}</p>
              <p><strong>Chủ tài khoản:</strong> {BANK_CONFIG.accountName}</p>
              <p className="text-blue-600 flex justify-between font-bold">
                <span>Nội dung chuyển khoản:</span>
                <span className="bg-blue-100 px-2 py-0.5 rounded-md font-black">{selectedPayOrder.payment_code}</span>
              </p>
            </div>

            <button
              onClick={() => setSelectedPayOrder(null)}
              className="w-full rounded-full bg-[#2563EB] py-3 text-sm font-bold text-white hover:bg-[#1D4ED8] transition shadow-md"
            >
              Tôi đã chuyển khoản thành công
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
