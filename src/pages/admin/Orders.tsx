import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { SearchIcon } from '../../components/icons';
import { useToast } from '../../components/Toast';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Pagination } from '../../components/admin/Pagination';


type Order = {
  id: string;
  user_id: string;
  product_name: string;
  plan_label: string;
  price: number;
  original_price?: number;
  discount_amount?: number;
  coupon_code?: string;
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
  const [searchParams] = useSearchParams();
  const targetOrderId = searchParams.get('order_id');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const toast = useToast();
  
  // Delivery details modal state
  const [deliveryOrder, setDeliveryOrder] = useState<Order | null>(null);
  const [deliveryDetails, setDeliveryDetails] = useState('');
  const [submittingDelivery, setSubmittingDelivery] = useState(false);

  // Order Details Modal State (Xem toàn bộ chi tiết đơn hàng & User)
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);
  const [userProfileDetail, setUserProfileDetail] = useState<{
    id?: string | null;
    email?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
    phone?: string | null;
    balance?: number | null;
    is_banned?: boolean | null;
    created_at?: string | null;
  } | null>(null);
  const [orderTimeline, setOrderTimeline] = useState<Array<{
    id: string;
    status: string;
    changed_by: string;
    actor_name: string;
    created_at: string;
  }>>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const openOrderDetail = async (order: Order) => {
    setSelectedOrderDetail(order);
    setLoadingDetail(true);
    setUserProfileDetail(null);
    setOrderTimeline([]);

    try {
      const [profileRes, timelineRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', order.user_id).maybeSingle(),
        supabase.from('order_status_history').select('*').eq('order_id', order.id).order('created_at', { ascending: true }),
      ]);

      if (profileRes.data) {
        setUserProfileDetail(profileRes.data);
      }
      if (timelineRes.data) {
        setOrderTimeline(timelineRes.data);
      }
    } catch (err) {
      console.error('Error fetching order detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}!`);
  };

  // Confirm Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    variant?: 'danger' | 'warning' | 'primary' | 'success';
    loading?: boolean;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: async () => {},
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('orders')
        .select('*, profiles!orders_user_profile_fk(email, full_name)') as any)
        .order('created_at', { ascending: false });

      let orderData = data;
      if (error) {
        const fallback = await (supabase.from('orders') as any)
          .select('*')
          .order('created_at', { ascending: false });
        if (fallback.error) throw error;
        orderData = fallback.data;
      }
      if (orderData) {
        const now = Date.now();
        const expiredIds: string[] = [];
        const processedData = orderData.map((o: any) => {
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

    const adminOrdersChannel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(adminOrdersChannel);
    };
  }, []);

  const handleUpdateStatus = (orderId: string, newStatus: Order['status']) => {
    const isCancel = newStatus === 'cancelled';
    const isProcessing = newStatus === 'processing';
    setConfirmConfig({
      isOpen: true,
      title: isCancel ? 'Hủy đơn hàng' : isProcessing ? 'Báo đang xử lý đơn hàng' : 'Cập nhật trạng thái đơn',
      message: isCancel
        ? 'Bạn có chắc chắn muốn HỦY đơn hàng này?'
        : isProcessing
        ? 'Xác nhận chuyển đơn hàng sang trạng thái ĐANG THIẾT LẬP / XỬ LÝ?'
        : `Chuyển trạng thái đơn sang "${newStatus}"?`,
      confirmText: isCancel ? 'Hủy đơn' : isProcessing ? 'Xác nhận xử lý' : 'Cập nhật',
      variant: isCancel ? 'danger' : 'primary',
      onConfirm: async () => {
        setConfirmConfig((prev) => ({ ...prev, loading: true }));
        try {
          const { error } = await (supabase.from('orders') as any)
            .update({ status: newStatus })
            .eq('id', orderId);

          if (error) throw error;
          
          if (newStatus === 'processing') {
            await sendOrderEmail(orderId, 'processing');
          } else if (newStatus === 'cancelled') {
            await sendOrderEmail(orderId, 'cancelled');
          }
          
          toast.success('Cập nhật trạng thái đơn hàng thành công!');
          fetchOrders();
          if (selectedOrderDetail && selectedOrderDetail.id === orderId) {
            setSelectedOrderDetail((prev) => prev ? { ...prev, status: newStatus } : null);
          }
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          toast.error(err.message || 'Lỗi cập nhật trạng thái.');
        } finally {
          setConfirmConfig((prev) => ({ ...prev, loading: false }));
        }
      },
    });
  };

  const sendOrderEmail = async (orderId: string, type: 'completed' | 'refunded' | 'processing' | 'cancelled') => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/email-notify', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          order_id: orderId,
          type,
        }),
      });

      if (!response.ok) {
        console.warn('[sendOrderEmail] Non-200 response:', response.status);
        return { email_sent: false, message: `HTTP ${response.status}` };
      }

      const resData = await response.json();
      return {
        email_sent: resData.status === 'sent',
        message: resData.status,
      };
    } catch (err: any) {
      console.warn('[sendOrderEmail] Error sending email:', err?.message || err);
      return { email_sent: false, message: err?.message || 'Network error' };
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

      const emailRes = await sendOrderEmail(deliveryOrder.id, 'completed');

      if (emailRes.email_sent) {
        toast.success(`🎉 Bàn giao đơn #${deliveryOrder.payment_code} và đã gửi email thông báo!`);
      } else if (emailRes.message === 'logged_no_smtp_pass') {
        toast.success(`🎉 Bàn giao đơn #${deliveryOrder.payment_code} thành công! (Cần thêm SMTP_PASS vào .env để gửi email thực tế)`);
      } else {
        toast.success(`🎉 Bàn giao đơn #${deliveryOrder.payment_code} thành công!`);
      }

      if (selectedOrderDetail && selectedOrderDetail.id === deliveryOrder.id) {
        setSelectedOrderDetail((prev) => prev ? { ...prev, status: 'completed', account_details: deliveryDetails.trim() } : null);
      }

      setDeliveryOrder(null);
      setDeliveryDetails('');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi bàn giao đơn hàng.');
    } finally {
      setSubmittingDelivery(false);
    }
  };

  const handleRefund = (orderId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hoàn tiền đơn hàng',
      message: 'Xác nhận HOÀN TIỀN đơn hàng này về ví số dư của khách hàng?',
      confirmText: 'Hoàn tiền',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmConfig((prev) => ({ ...prev, loading: true }));
        try {
          const { data, error } = await (supabase as any).rpc('refund_order', {
            p_order_id: orderId
          });
          if (error) throw error;
          if (data === 'success') {
            const emailRes = await sendOrderEmail(orderId, 'refunded');
            if (emailRes.email_sent) {
              toast.success('Hoàn tiền về ví thành công và đã gửi email thông báo!');
            } else if (emailRes.message === 'logged_no_smtp_pass') {
              toast.success('Hoàn tiền về ví thành công! (Cần thêm SMTP_PASS vào .env để gửi email thực tế)');
            } else {
              toast.success('Hoàn tiền về ví thành công!');
            }
            fetchOrders();
            if (selectedOrderDetail && selectedOrderDetail.id === orderId) {
              setSelectedOrderDetail((prev) => prev ? { ...prev, status: 'refunded' } : null);
            }
            setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
          } else if (data === 'unauthorized') {
            throw new Error('Thao tác không được phép (Chỉ Admin mới có quyền hoàn tiền).');
          } else {
            throw new Error('Giao dịch hoàn tiền thất bại.');
          }
        } catch (err: any) {
          toast.error(err.message || 'Lỗi hoàn tiền.');
        } finally {
          setConfirmConfig((prev) => ({ ...prev, loading: false }));
        }
      },
    });
  };

  const [currentPage, setCurrentPage] = useState(1);
  const ORDERS_PER_PAGE = 6;

  // Reset page to 1 when search or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchQuery]);

  // Handle URL targetOrderId for smooth scrolling
  useEffect(() => {
    if (!targetOrderId || orders.length === 0) return;
    const targetOrder = orders.find((o) => o.id === targetOrderId);
    if (!targetOrder) return;

    if (filterStatus !== 'all' && targetOrder.status !== filterStatus) {
      setFilterStatus('all');
    }
    if (searchQuery.trim() !== '') {
      setSearchQuery('');
    }

    const timer = setTimeout(() => {
      const el = document.getElementById(`admin-order-${targetOrderId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [targetOrderId, orders]);

  const filteredOrders = orders.filter((o) => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      o.payment_code.toLowerCase().includes(q) ||
      o.product_name.toLowerCase().includes(q) ||
      o.plan_label.toLowerCase().includes(q) ||
      (o.profiles?.email && o.profiles.email.toLowerCase().includes(q)) ||
      (o.profiles?.full_name && o.profiles.full_name.toLowerCase().includes(q));

    return matchStatus && matchSearch;
  });

  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ORDERS_PER_PAGE,
    currentPage * ORDERS_PER_PAGE
  );

  const fromTicket = searchParams.get('from_ticket');

  return (
    <div className="space-y-6">
      {/* LINKED TICKET BANNER */}
      {fromTicket && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs animate-fade-in">
          <div className="flex items-center gap-2.5 font-extrabold text-blue-900 dark:text-blue-200">
            <span className="text-base">🎫</span>
            <span>Bạn đang xem đơn hàng được liên kết từ Ticket <strong className="font-mono text-[#2563EB] dark:text-[#35A8FF]">#{fromTicket}</strong></span>
          </div>
          <Link
            to={`/admin/tickets?ticket=${fromTicket}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-4 py-2 text-xs font-bold text-white shadow-md hover:scale-102 transition shrink-0"
          >
            ← Quay lại Ticket #{fromTicket}
          </Link>
        </div>
      )}

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
          {paginatedOrders.map((o) => (
            <div id={`admin-order-${o.id}`} key={o.id} className={`rounded-[24px] border ${o.id === targetOrderId ? 'border-blue-400 ring-2 ring-blue-200 dark:ring-blue-900/60' : 'border-[#E8F1FF] dark:border-[#1E2A4A]/50'} bg-white dark:bg-[#131C32] p-6 shadow-xs flex flex-col gap-4`}>
              {/* Header info */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-50 dark:border-slate-800/60 pb-4">
                <div>
                  <h3 className="font-extrabold text-slate-950 dark:text-white text-sm sm:text-base leading-tight">{o.product_name}</h3>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    Gói: {o.plan_label} — Mã đơn: <span className="font-bold text-slate-900 dark:text-white">{o.payment_code}</span>
                  </p>
                </div>
                <div className="flex flex-col sm:items-end gap-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-[#2563EB]">
                      {o.price.toLocaleString('vi-VN')}đ
                    </span>
                    {getStatusBadge(o.status)}
                  </div>
                  {Number(o.discount_amount) > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                      🎟️ {o.coupon_code || 'Mã giảm giá'}: -{Number(o.discount_amount).toLocaleString('vi-VN')}đ
                    </span>
                  ) : null}
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
                  <div className="sm:col-span-2 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-950/30 text-emerald-800 dark:text-emerald-400">
                    🎁 <strong>Thông tin đã bàn giao:</strong>
                    <pre className="font-mono whitespace-pre-wrap mt-1 leading-snug">{o.account_details}</pre>
                  </div>
                )}
              </div>

              {/* Admin Actions */}
              <div className="flex flex-wrap gap-2.5 justify-end border-t border-slate-50 dark:border-slate-800/60 pt-4">
                {/* Nút Xem chi tiết đơn hàng (Luôn hiển thị) */}
                <button
                  onClick={() => openOrderDetail(o)}
                  className="rounded-full border border-[#DCEAFF] dark:border-[#1E2A4A] bg-[#F8FAFC] dark:bg-slate-800/80 hover:bg-[#EDF5FF] dark:hover:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition shadow-xs flex items-center gap-1.5"
                >
                  <span>👁️</span> Xem chi tiết
                </button>
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
                
                {/* Allow refund ONLY for pending_delivery or processing (before completed) */}
                {(o.status === 'pending_delivery' || o.status === 'processing') && (
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

          {/* Pagination Controls */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredOrders.length}
            itemsPerPage={ORDERS_PER_PAGE}
            itemLabel="đơn hàng"
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* MODAL XEM TOÀN BỘ CHI TIẾT ĐƠN HÀNG & THÔNG TIN USER (PORTAL) */}
      {selectedOrderDetail && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={() => setSelectedOrderDetail(null)} />
          
          <div className="relative z-[100000] w-full max-w-2xl max-h-[90vh] overflow-y-auto transform rounded-[30px] border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#131C32] p-5 sm:p-7 shadow-2xl transition-all text-left space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-xl text-[#2563EB]">
                  📦
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                      Đơn hàng #{selectedOrderDetail.payment_code}
                    </h2>
                    {getStatusBadge(selectedOrderDetail.status)}
                  </div>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">
                    Ngày tạo: {new Date(selectedOrderDetail.created_at).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderDetail(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {loadingDetail ? (
              <div className="py-16 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-100 dark:border-slate-800 border-t-[#2563EB]" />
                <p className="text-xs text-slate-400 font-bold mt-3">Đang tải đầy đủ thông tin...</p>
              </div>
            ) : (
              <>
                {/* Section 1: Thông tin khách hàng chi tiết */}
                <div className="rounded-[22px] border border-[#E8F1FF] dark:border-[#1E2A4A]/60 bg-[#F9FBFF] dark:bg-[#18243E]/50 p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <span>👤</span> Thông tin khách hàng
                    </h3>
                    <Link
                      to="/admin/users"
                      className="text-[11px] font-bold text-[#2563EB] hover:underline"
                    >
                      Quản lý người dùng →
                    </Link>
                  </div>

                  <div className="flex items-center gap-3.5 border-b border-slate-200/60 dark:border-slate-800/80 pb-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#19A7FF] to-[#2563EB] text-white font-extrabold text-base shadow-sm overflow-hidden">
                      {userProfileDetail?.avatar_url ? (
                        <img src={userProfileDetail.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        (userProfileDetail?.full_name || selectedOrderDetail.profiles?.full_name || 'U').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                          {userProfileDetail?.full_name || selectedOrderDetail.profiles?.full_name || 'Thành viên'}
                        </span>
                        {userProfileDetail?.is_banned ? (
                          <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                            🔴 Đã bị khóa
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                            🟢 Bình thường
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                        {userProfileDetail?.email || selectedOrderDetail.profiles?.email || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <div className="bg-white dark:bg-[#131C32] p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold">SỐ ĐIỆN THOẠI</span>
                      <span className="font-bold text-slate-800 dark:text-white">
                        {userProfileDetail?.phone || 'Chưa cập nhật'}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-[#131C32] p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold">SỐ DƯ VÍ</span>
                      <span className="font-black text-[#2563EB]">
                        {Number(userProfileDetail?.balance || 0).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 bg-white dark:bg-[#131C32] p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-bold">NGÀY THAM GIA</span>
                      <span className="font-bold text-slate-800 dark:text-white truncate block">
                        {userProfileDetail?.created_at ? new Date(userProfileDetail.created_at).toLocaleDateString('vi-VN') : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-white dark:bg-[#131C32] px-3 py-1.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                    <span className="truncate">User ID: {selectedOrderDetail.user_id}</span>
                    <button
                      onClick={() => handleCopyText(selectedOrderDetail.user_id, 'User ID')}
                      className="text-blue-500 hover:text-blue-600 font-sans font-bold text-[10px] ml-2 shrink-0"
                    >
                      Sao chép
                    </button>
                  </div>
                </div>

                {/* Section 2: Chi tiết Sản phẩm & Tài chính */}
                <div className="rounded-[22px] border border-[#E8F1FF] dark:border-[#1E2A4A]/60 bg-white dark:bg-[#18243E]/40 p-4 sm:p-5 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span>🛍️</span> Thông tin đơn hàng & Thanh toán
                  </h3>

                  <div className="space-y-2 text-xs font-semibold">
                    <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400">Sản phẩm / Dịch vụ:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{selectedOrderDetail.product_name}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400">Gói thời hạn:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{selectedOrderDetail.plan_label}</span>
                    </div>
                    {selectedOrderDetail.original_price && selectedOrderDetail.original_price > selectedOrderDetail.price ? (
                      <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400">Giá gốc:</span>
                        <span className="line-through text-slate-400">{selectedOrderDetail.original_price.toLocaleString('vi-VN')}đ</span>
                      </div>
                    ) : null}
                    {Number(selectedOrderDetail.discount_amount) > 0 ? (
                      <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 font-bold">
                        <span>Mã giảm giá ({selectedOrderDetail.coupon_code || 'COUPON'}):</span>
                        <span>-{Number(selectedOrderDetail.discount_amount).toLocaleString('vi-VN')}đ</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between py-2 items-center bg-[#F4F8FF] dark:bg-slate-800/60 px-3 rounded-xl">
                      <span className="font-extrabold text-slate-700 dark:text-slate-200">TỔNG THANH TOÁN:</span>
                      <span className="text-base font-black text-[#2563EB]">
                        {selectedOrderDetail.price.toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>

                  {selectedOrderDetail.notes && (
                    <div className="bg-[#F8FAFC] dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs">
                      <span className="font-bold text-slate-500 block mb-1">Ghi chú của khách:</span>
                      <p className="text-slate-800 dark:text-slate-200 font-medium">{selectedOrderDetail.notes}</p>
                    </div>
                  )}
                </div>

                {/* Section 3: Thông tin bàn giao (Account Details) */}
                {selectedOrderDetail.account_details && (
                  <div className="rounded-[22px] border border-emerald-200/60 dark:border-emerald-950/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 sm:p-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                        <span>🎁</span> Thông tin đã bàn giao cho khách
                      </h3>
                      <button
                        onClick={() => handleCopyText(selectedOrderDetail.account_details || '', 'thông tin bàn giao')}
                        className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1"
                      >
                        <span>📋</span> Sao chép
                      </button>
                    </div>
                    <pre className="font-mono text-xs text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap bg-white dark:bg-[#131C32] p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 leading-relaxed">
                      {selectedOrderDetail.account_details}
                    </pre>
                  </div>
                )}

                {/* Section 4: Lịch sử trạng thái đơn hàng (Timeline) */}
                {orderTimeline.length > 0 && (
                  <div className="rounded-[22px] border border-[#E8F1FF] dark:border-[#1E2A4A]/60 bg-white dark:bg-[#18243E]/40 p-4 sm:p-5 space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <span>⏱️</span> Lịch sử tiến trình đơn hàng
                    </h3>
                    <div className="space-y-2.5">
                      {orderTimeline.map((item, idx) => (
                        <div key={item.id || idx} className="flex items-start gap-3 text-xs">
                          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-[10px] text-blue-600 font-bold">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {getStatusBadge(item.status as any)}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                bởi <strong className="text-slate-600 dark:text-slate-300">{item.actor_name || item.changed_by}</strong>
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {new Date(item.created_at).toLocaleString('vi-VN')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Modal Footer / Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {selectedOrderDetail.status === 'pending_delivery' && (
                  <button
                    onClick={() => {
                      const ord = selectedOrderDetail;
                      setSelectedOrderDetail(null);
                      setDeliveryOrder(ord);
                    }}
                    className="rounded-full bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-4.5 py-2 text-xs font-bold text-white shadow-md transition hover:scale-102"
                  >
                    🚀 Bàn giao tài khoản
                  </button>
                )}
                {selectedOrderDetail.status === 'processing' && (
                  <button
                    onClick={() => {
                      const ord = selectedOrderDetail;
                      setSelectedOrderDetail(null);
                      setDeliveryOrder(ord);
                    }}
                    className="rounded-full bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-4.5 py-2 text-xs font-bold text-white shadow-md transition hover:scale-102"
                  >
                    🚀 Bàn giao tài khoản
                  </button>
                )}
                {(selectedOrderDetail.status === 'pending_delivery' || selectedOrderDetail.status === 'processing') && (
                  <button
                    onClick={() => handleRefund(selectedOrderDetail.id)}
                    className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C32] hover:bg-[#F5F9FF] px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#2563EB] transition shadow-xs"
                  >
                    💸 Hoàn tiền về ví
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition ml-auto"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* RENDER MODAL BÀN GIAO ĐƠN HÀNG (PORTAL) */}
      {deliveryOrder && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={() => setDeliveryOrder(null)} />
          
          <form onSubmit={handleDeliver} className="relative z-[100000] w-full max-w-md transform overflow-hidden rounded-[28px] border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#18243E] p-6 sm:p-8 shadow-2xl transition-all text-left space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span>🚀</span> Bàn giao dịch vụ
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-300 font-semibold mt-1">
                Đơn hàng: <strong className="text-slate-900 dark:text-white">{deliveryOrder.product_name}</strong> ({deliveryOrder.plan_label})
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                Thông tin tài khoản / Mã kích hoạt bàn giao
              </label>
              <textarea
                required
                value={deliveryDetails}
                onChange={(e) => setDeliveryDetails(e.target.value)}
                placeholder="Nhập thông tin tài khoản, mật khẩu hoặc link kích hoạt để gửi khách hàng..."
                rows={4}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/60 p-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB] dark:focus:border-[#35A8FF] text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setDeliveryOrder(null)}
                className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submittingDelivery}
                className="flex-1 rounded-full bg-gradient-to-r from-[#00A3FF] to-[#2563EB] hover:from-sky-500 hover:to-blue-700 py-3 text-xs font-bold text-white shadow-md disabled:opacity-60 transition"
              >
                {submittingDelivery ? 'Đang gửi...' : '🚀 Bàn giao ngay'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        variant={confirmConfig.variant}
        loading={confirmConfig.loading}
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
