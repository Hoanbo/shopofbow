import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { SearchIcon } from '../../components/icons';
import { useToast } from '../../components/Toast';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Pagination } from '../../components/admin/Pagination';
import { useRealtimeEvent } from '../../services/realtime';
import { syncExpiredPendingOrders, getEffectiveOrderStatus } from '../../utils/orderExpiry';

type Order = {
  id: string;
  user_id: string;
  product_name: string;
  plan_label: string;
  price: number;
  original_price?: number;
  discount_amount?: number;
  coupon_code?: string;
  payment_code: string;
  status:
    | 'pending_payment'
    | 'pending_delivery'
    | 'processing'
    | 'completed'
    | 'cancelled'
    | 'refunded'
    | 'paid'
    | 'pending'
    | 'delivering';
  notes: string;
  account_details?: string;
  delivery_info?: string;
  expires_at?: string;
  renewal_policy?: string;
  target_account?: string;
  renewed_from_order_id?: string;
  superseded_by_order_id?: string;
  supersede_reason?: string;
  superseded_at?: string;
  created_at: string;
  profiles?: {
    email: string;
    full_name: string;
  };
};

export const getFormattedPlanLabel = (order: { product_name?: string; plan_label?: string; price?: number; notes?: string }) => {
  const pName = (order.product_name || '').trim();
  const pLabel = (order.plan_label || '').trim();

  if (pLabel && pLabel.toLowerCase() !== pName.toLowerCase()) {
    return pLabel;
  }

  // If plan_label is identical to product_name or generic, infer from price/product
  if (pName.toLowerCase().includes('capcut')) {
    if ((order.price || 0) <= 20000) return 'Gói 1 tuần (7 ngày)';
    if ((order.price || 0) <= 70000) return 'Gói 1 tháng (30 ngày)';
    if ((order.price || 0) <= 200000) return 'Gói 6 tháng (180 ngày)';
    return 'Gói 1 năm (365 ngày)';
  }

  return pLabel || pName;
};

const isTopupOrder = (order: { product_name?: string; payment_code?: string; notes?: string }) => {
  const pName = (order.product_name || '').toLowerCase();
  const pCode = (order.payment_code || '').toUpperCase();
  const pNotes = (order.notes || '').toLowerCase();
  return pName.includes('nạp tiền') || pName.includes('nạp số dư') || pCode.startsWith('BOWN') || pNotes.includes('nạp số dư');
};

const calcOrderExpiry = (order: Order) => {
  if (order.status !== 'completed' || isTopupOrder(order)) return null;

  const displayPlan = getFormattedPlanLabel(order);
  const planStr = `${order.product_name || ''} ${order.plan_label || ''} ${displayPlan} ${order.notes || ''}`.toLowerCase();

  if (planStr.includes('vĩnh viễn') || planStr.includes('lifetime') || planStr.includes('trọn đời')) {
    return {
      label: 'Vĩnh viễn (Trọn đời)',
      badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200/60',
      icon: '👑',
      daysText: 'Sử dụng không giới hạn thời gian',
    };
  }

  let durationDays = 30;
  let isHours = false;

  if (planStr.includes('1 ngày') || planStr.includes('24h') || planStr.includes('1 day') || planStr.includes('api 10m') || planStr.includes('api 50m') || planStr.includes('api 100m')) {
    durationDays = 1;
    isHours = true;
  } else if (planStr.includes('2 ngày') || planStr.includes('48h')) {
    durationDays = 2;
  } else if (planStr.includes('3 ngày')) {
    durationDays = 3;
  } else if (planStr.includes('7 ngày') || planStr.includes('1 tuần') || planStr.includes('1 week') || planStr.includes('7 days') || planStr.includes('7d') || (order.price <= 20000 && planStr.includes('capcut'))) {
    durationDays = 7;
  } else if (planStr.includes('14 ngày') || planStr.includes('2 tuần') || planStr.includes('2 weeks') || planStr.includes('14 days')) {
    durationDays = 14;
  } else if (planStr.includes('15 ngày')) {
    durationDays = 15;
  } else if (planStr.includes('1 tháng') || planStr.includes('30 ngày') || planStr.includes('1 month')) {
    durationDays = 30;
  } else if (planStr.includes('2 tháng') || planStr.includes('60 ngày')) {
    durationDays = 60;
  } else if (planStr.includes('3 tháng') || planStr.includes('90 ngày') || planStr.includes('3 months')) {
    durationDays = 90;
  } else if (planStr.includes('6 tháng') || planStr.includes('180 ngày') || planStr.includes('6 months')) {
    durationDays = 180;
  } else if (planStr.includes('1 năm') || planStr.includes('12 tháng') || planStr.includes('1 year') || planStr.includes('365 ngày')) {
    durationDays = 365;
  } else {
    const weekMatch = planStr.match(/(\d+)\s*(tuần|week|weeks|w)/);
    if (weekMatch) {
      durationDays = parseInt(weekMatch[1], 10) * 7;
    } else {
      const monthMatch = planStr.match(/(\d+)\s*(tháng|month|months|m)/);
      if (monthMatch) {
        durationDays = parseInt(monthMatch[1], 10) * 30;
      } else {
        const yearMatch = planStr.match(/(\d+)\s*(năm|year|years|y)/);
        if (yearMatch) {
          durationDays = parseInt(yearMatch[1], 10) * 365;
        } else {
          const dayMatch = planStr.match(/(\d+)\s*(ngày|day|days)/);
          if (dayMatch) {
            durationDays = parseInt(dayMatch[1], 10);
            if (durationDays === 1) isHours = true;
          }
        }
      }
    }
  }

  const createdAtMs = new Date(order.created_at).getTime();
  const expiresAtMs = order.expires_at ? new Date(order.expires_at).getTime() : createdAtMs + durationDays * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const diffMs = expiresAtMs - nowMs;
  const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  if (diffMs <= 0) {
    return {
      label: 'Đã hết hạn',
      badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200/60',
      icon: '🔴',
      daysText: 'Đã kết thúc chu kỳ sử dụng',
    };
  }

  if (isHours && diffHours <= 24) {
    return {
      label: `Còn ${diffHours} giờ`,
      badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/60',
      icon: '⚡',
      daysText: `Hạn dùng đến: ${new Date(expiresAtMs).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date(expiresAtMs).toLocaleDateString('vi-VN')}`,
    };
  }

  if (diffDays <= 3) {
    return {
      label: `Còn ${diffDays} ngày (Sắp hết)`,
      badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/60 animate-pulse',
      icon: '🟡',
      daysText: `Hạn dùng đến: ${new Date(expiresAtMs).toLocaleDateString('vi-VN')}`,
    };
  }

  return {
    label: `Còn ${diffDays} ngày`,
    badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/60',
    icon: '🟢',
    daysText: `Hạn dùng đến: ${new Date(expiresAtMs).toLocaleDateString('vi-VN')}`,
  };
};

const calcAdminWarranty = (order: Order) => {
  if (order.status !== 'completed' || isTopupOrder(order)) return null;

  const displayPlan = getFormattedPlanLabel(order);
  const planStr = `${order.product_name || ''} ${order.plan_label || ''} ${displayPlan} ${order.notes || ''}`.toLowerCase();

  // 1. Gói không bảo hành
  if (planStr.includes('kbh') || planStr.includes('không bảo hành') || planStr.includes('no warranty')) {
    return {
      label: 'Không bảo hành',
      badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200/60',
      icon: '⚪',
      daysText: 'Gói không áp dụng bảo hành',
    };
  }

  // 2. Gói vĩnh viễn
  if (planStr.includes('vĩnh viễn') || planStr.includes('lifetime') || planStr.includes('trọn đời')) {
    return {
      label: 'Trọn đời',
      badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200/60',
      icon: '👑',
      daysText: 'Bảo hành trọn đời dịch vụ',
    };
  }

  let durationDays = 30;
  let isHours = false;

  if (planStr.includes('1 ngày') || planStr.includes('24h') || planStr.includes('1 day') || planStr.includes('api 10m') || planStr.includes('api 50m') || planStr.includes('api 100m')) {
    durationDays = 1;
    isHours = true;
  } else if (planStr.includes('2 ngày') || planStr.includes('48h')) {
    durationDays = 2;
  } else if (planStr.includes('3 ngày')) {
    durationDays = 3;
  } else if (planStr.includes('7 ngày') || planStr.includes('1 tuần') || planStr.includes('1 week') || planStr.includes('7 days') || planStr.includes('7d') || (order.price <= 20000 && planStr.includes('capcut'))) {
    durationDays = 7;
  } else if (planStr.includes('14 ngày') || planStr.includes('2 tuần') || planStr.includes('2 weeks') || planStr.includes('14 days')) {
    durationDays = 14;
  } else if (planStr.includes('15 ngày')) {
    durationDays = 15;
  } else if (planStr.includes('1 tháng') || planStr.includes('30 ngày') || planStr.includes('1 month')) {
    durationDays = 30;
  } else if (planStr.includes('2 tháng') || planStr.includes('60 ngày')) {
    durationDays = 60;
  } else if (planStr.includes('3 tháng') || planStr.includes('90 ngày')) {
    durationDays = 90;
  } else if (planStr.includes('6 tháng') || planStr.includes('180 ngày')) {
    durationDays = 180;
  } else if (planStr.includes('1 năm') || planStr.includes('12 tháng') || planStr.includes('1 year') || planStr.includes('365 ngày')) {
    durationDays = 365;
  } else {
    const dayMatch = planStr.match(/(\d+)\s*(ngày|day|days)/);
    if (dayMatch) {
      durationDays = parseInt(dayMatch[1], 10);
      if (durationDays === 1) isHours = true;
    }
  }

  const createdAtMs = new Date(order.created_at).getTime();
  const expiresAtMs = order.expires_at ? new Date(order.expires_at).getTime() : createdAtMs + durationDays * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const diffMs = expiresAtMs - nowMs;
  const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  if (diffMs <= 0) {
    return {
      label: 'Hết hạn',
      badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200/60',
      icon: '🔴',
      daysText: `Hết hạn bảo hành: ${new Date(expiresAtMs).toLocaleDateString('vi-VN')}`,
    };
  }

  if (isHours && diffHours <= 24) {
    return {
      label: `Còn ${diffHours}h`,
      badgeClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200/70 dark:border-sky-800/60',
      icon: '⚡',
      daysText: `Đến ${new Date(expiresAtMs).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${new Date(expiresAtMs).toLocaleDateString('vi-VN')}`,
    };
  }

  if (diffDays <= 3) {
    return {
      label: `Còn ${diffDays} ngày`,
      badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/60 animate-pulse',
      icon: '🟡',
      daysText: `Hết hạn bảo hành: ${new Date(expiresAtMs).toLocaleDateString('vi-VN')}`,
    };
  }

  return {
    label: `Còn ${diffDays} ngày`,
    badgeClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-200/70 dark:border-sky-800/60',
    icon: '🛡️',
    daysText: `Bảo hành đến: ${new Date(expiresAtMs).toLocaleDateString('vi-VN')}`,
  };
};

const getStatusBadge = (status: Order['status'] | string) => {
  switch (status) {
    case 'pending':
    case 'pending_payment':
      return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-none">Chờ thanh toán</span>;
    case 'paid':
    case 'pending_delivery':
      return <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[9px] font-bold text-[#2563EB] border border-blue-100 dark:bg-blue-950/20 dark:text-[#35A8FF] dark:border-none">Chờ bàn giao</span>;
    case 'processing':
    case 'delivering':
      return <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-[9px] font-bold text-indigo-700 border border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-none">Đang thiết lập</span>;
    case 'completed':
      return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-none">Đã hoàn thành</span>;
    case 'cancelled':
      return <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-[9px] font-bold text-rose-700 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-none">Đã hủy</span>;
    case 'refunded':
      return <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[9px] font-bold text-slate-700 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-none">Đã hoàn tiền</span>;
    default:
      return <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[9px] font-bold text-slate-700 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-none">{status}</span>;
  }
};

export default function AdminOrders() {
  const [searchParams] = useSearchParams();
  const targetOrderId = searchParams.get('order_id');
  const statusParam = searchParams.get('status') || searchParams.get('filter') || searchParams.get('tab');
  const searchParamQ = searchParams.get('q') || searchParams.get('search');

  const validFilterStatuses = ['all', 'pending_payment', 'pending_delivery', 'processing', 'completed', 'cancelled', 'refunded', 'expiring_soon'];

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>(
    statusParam && validFilterStatuses.includes(statusParam)
      ? statusParam
      : 'all'
  );
  const [searchQuery, setSearchQuery] = useState(searchParamQ || '');
  const toast = useToast();

  useEffect(() => {
    if (statusParam && validFilterStatuses.includes(statusParam)) {
      setFilterStatus(statusParam);
    }
  }, [statusParam]);

  useEffect(() => {
    if (searchParamQ) {
      setSearchQuery(searchParamQ);
    }
  }, [searchParamQ]);

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
  const [expiryReminders, setExpiryReminders] = useState<Array<{
    id: string;
    notification_type: string;
    days_left: number;
    scheduled_for: string;
    sent_at: string;
    status: string;
    email_status?: string;
    web_status?: string;
    provider_message_id?: string;
    email_error?: string;
    attempt_count?: number;
    last_attempt_at?: string;
    metadata?: any;
  }>>([]);
  const [renewedFromOrder, setRenewedFromOrder] = useState<any | null>(null);
  const [supersededByOrder, setSupersededByOrder] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isManualReminderOpen, setIsManualReminderOpen] = useState(false);
  const [manualCustomNote, setManualCustomNote] = useState('');
  const [sendingManualReminder, setSendingManualReminder] = useState(false);
  const [triggeringCron, setTriggeringCron] = useState(false);

  const openOrderDetail = async (order: Order) => {
    setSelectedOrderDetail(order);
    setLoadingDetail(true);
    setUserProfileDetail(null);
    setOrderTimeline([]);
    setExpiryReminders([]);
    setRenewedFromOrder(null);
    setSupersededByOrder(null);

    try {
      const [profileRes, timelineRes, reminderRes, renewalFromRes, supersedeByRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', order.user_id).maybeSingle(),
        supabase.from('order_status_history').select('*').eq('order_id', order.id).order('created_at', { ascending: true }),
        (supabase.from('order_expiry_notifications') as any).select('*').eq('order_id', order.id).order('created_at', { ascending: true }),
        order.renewed_from_order_id
          ? (supabase.from('orders') as any).select('id, payment_code, status, product_name, plan_label, created_at').eq('id', order.renewed_from_order_id).maybeSingle()
          : Promise.resolve({ data: null }),
        order.superseded_by_order_id
          ? (supabase.from('orders') as any).select('id, payment_code, status, product_name, plan_label, created_at').eq('id', order.superseded_by_order_id).maybeSingle()
          : (supabase.from('orders') as any).select('id, payment_code, status, product_name, plan_label, created_at').eq('renewed_from_order_id', order.id).not('status', 'in', '("cancelled","refunded")').maybeSingle(),
      ]);

      if (profileRes.data) {
        setUserProfileDetail(profileRes.data);
      }
      if (timelineRes.data) {
        setOrderTimeline(timelineRes.data);
      }
      if (reminderRes.data) {
        setExpiryReminders(reminderRes.data as any);
      }
      if (renewalFromRes.data) {
        setRenewedFromOrder(renewalFromRes.data);
      }
      if (supersedeByRes.data) {
        setSupersededByOrder(supersedeByRes.data);
      }
    } catch (err) {
      console.error('Error fetching order/user detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const sendOrderEmail = async (
    orderId: string,
    type: 'completed' | 'refunded' | 'processing' | 'cancelled' | 'manual_reminder' | 'expiry_7_days' | 'expiry_3_days' | 'expiry_1_day' | 'expiry_expired',
    customMessage?: string
  ) => {
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
          custom_message: customMessage,
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

  const handleTriggerCronScan = async () => {
    setTriggeringCron(true);
    try {
      const { data, error } = await (supabase as any).rpc('check_and_notify_expiring_orders');
      if (error) throw error;
      const sent = data?.reminders_sent?.total || 0;
      toast.success(`Đã quét xong: Đã gửi ${sent} thông báo & email nhắc hạn!`);
      if (selectedOrderDetail) {
        openOrderDetail(selectedOrderDetail);
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi quét đơn hàng sắp hết hạn.');
    } finally {
      setTriggeringCron(false);
    }
  };

  const handleSendManualReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderDetail) return;
    setSendingManualReminder(true);
    try {
      const customNote = manualCustomNote.trim();
      // 1. Ghi nhận DB (Chuông web notification + Tracking history)
      const { data, error } = await (supabase as any).rpc('admin_send_manual_expiry_reminder', {
        p_order_id: selectedOrderDetail.id,
        p_custom_message: customNote || null,
      });
      if (error) throw error;
      if (data?.success) {
        // 2. Trực tiếp gửi Email qua /api/email-notify với Admin token
        const emailRes = await sendOrderEmail(selectedOrderDetail.id, 'manual_reminder', customNote || undefined);
        if (emailRes.email_sent) {
          toast.success('Đã gửi thông báo chuông & Email nhắc hạn thành công tới khách hàng!');
        } else {
          toast.success(data.message || 'Đã gửi thông báo nhắc hạn thành công!');
        }
        setIsManualReminderOpen(false);
        setManualCustomNote('');
        openOrderDetail(selectedOrderDetail);
      } else {
        toast.error(data?.message || 'Không thể gửi thông báo.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi gửi thông báo.');
    } finally {
      setSendingManualReminder(false);
    }
  };

  const handleCopyText = (text: string, label = 'nội dung') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}!`);
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ORDERS_PER_PAGE = 6;

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchQuery]);

  // Confirmation Modal state
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    variant: 'danger' | 'primary';
    loading: boolean;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Xác nhận',
    variant: 'primary',
    loading: false,
    onConfirm: async () => { },
  });

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Đồng bộ các đơn pending_payment đã quá 15 phút thành cancelled trong DB
      const { updatedOrders } = await syncExpiredPendingOrders(ordersData || []);

      const userIds = Array.from(new Set(updatedOrders.map((o: any) => o.user_id).filter(Boolean)));
      const profilesMap = new Map<string, { email: string; full_name: string }>();

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);

        if (profilesData) {
          profilesData.forEach((p: any) => {
            profilesMap.set(p.id, { email: p.email, full_name: p.full_name });
          });
        }
      }

      const mergedOrders = updatedOrders.map((o: any) => ({
        ...o,
        status: getEffectiveOrderStatus(o),
        profiles: profilesMap.get(o.user_id),
      }));

      setOrders(mergedOrders);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi tải danh sách đơn hàng.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ── Realtime Hub: targeted order updates (no full refetch) ────────────────
  // Khi có INSERT: fetch đơn mới (kèm profile) → prepend vào list
  // Khi có UPDATE: patch đơn tại chỗ → không cần fetch lại toàn bộ list
  const fetchSingleOrder = useCallback(async (orderId: string): Promise<Order | null> => {
    try {
      const { data } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (!data) return null;
      const { data: prof } = await supabase.from('profiles').select('id, email, full_name').eq('id', data.user_id).maybeSingle();
      return { ...data, profiles: prof ? { email: prof.email, full_name: prof.full_name } : undefined } as Order;
    } catch {
      return null;
    }
  }, []);

  useRealtimeEvent('orders:INSERT', useCallback(async (e: any) => {
    const full = await fetchSingleOrder(e.payload.id);
    if (!full) return;
    setOrders((prev) => {
      if (prev.some((o) => o.id === full.id)) return prev;
      return [full, ...prev];
    });
  }, [fetchSingleOrder]));

  useRealtimeEvent('orders:UPDATE', useCallback(async (e: any) => {
    const full = await fetchSingleOrder(e.payload.id);
    if (!full) return;
    setOrders((prev) => prev.map((o) => (o.id === full.id ? { ...o, ...full } : o)));
    // Also refresh detail modal if it's showing this order
    setSelectedOrderDetail((prev) => prev?.id === full.id ? { ...prev, ...full } : prev);
  }, [fetchSingleOrder]));

  // Tự động mở detail modal và scroll đến đơn hàng mục tiêu nếu có param ?order_id=xxx
  useEffect(() => {
    if (targetOrderId && orders.length > 0) {
      const match = orders.find((o) => o.id === targetOrderId || o.payment_code === targetOrderId);
      if (match) {
        setSelectedOrderDetail(match);
      }
      setTimeout(() => {
        const el = document.getElementById(`admin-order-${targetOrderId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [targetOrderId, orders]);

  const handleRefund = (orderId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Hoàn tiền về ví khách hàng',
      message: 'Bạn có chắc chắn muốn HOÀN TIỀN 100% về ví số dư cho khách hàng? Trạng thái đơn sẽ chuyển sang ĐÃ HOÀN TIỀN.',
      confirmText: 'Hoàn tiền ngay',
      variant: 'danger',
      loading: false,
      onConfirm: async () => {
        setConfirmConfig((prev) => ({ ...prev, loading: true }));
        try {
          const { data, error } = await (supabase as any).rpc('refund_order', {
            p_order_id: orderId,
          });

          if (error) throw error;

          if (data === 'refunded_success' || data === 'success') {
            await sendOrderEmail(orderId, 'refunded');
            toast.success('Đã hoàn tiền vào ví khách hàng thành công!');
            fetchOrders();
            if (selectedOrderDetail && selectedOrderDetail.id === orderId) {
              setSelectedOrderDetail((prev) => prev ? { ...prev, status: 'refunded' } : null);
            }
          } else {
            throw new Error(`Không thể hoàn tiền cho đơn hàng này (${data || 'Lỗi không xác định'}).`);
          }
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        } catch (err: any) {
          toast.error(err.message || 'Lỗi khi hoàn tiền đơn hàng.');
        } finally {
          setConfirmConfig((prev) => ({ ...prev, loading: false }));
        }
      },
    });
  };

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
      loading: false,
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



  const handleDeliver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryOrder) return;
    setSubmittingDelivery(true);
    try {
      const { error } = await (supabase.from('orders') as any)
        .update({
          status: 'completed',
          account_details: deliveryDetails.trim(),
          delivery_info: deliveryDetails.trim()
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

      setDeliveryOrder(null);
      setDeliveryDetails('');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi bàn giao dịch vụ.');
    } finally {
      setSubmittingDelivery(false);
    }
  };

  const isExpiringSoonOrder = (order: Order) => {
    if (order.status !== 'completed') return false;
    const planStr = `${order.plan_label || ''} ${order.notes || ''} ${order.product_name || ''}`.toLowerCase();
    if (planStr.includes('vĩnh viễn') || planStr.includes('lifetime') || planStr.includes('nạp') || planStr.includes('topup') || planStr.includes('deposit')) {
      return false;
    }
    const createdAtMs = new Date(order.created_at).getTime();
    let durationDays = 30;
    if (planStr.includes('1 ngày') || planStr.includes('24h') || planStr.includes('1 day')) {
      durationDays = 1;
    } else if (planStr.includes('2 ngày') || planStr.includes('48h')) {
      durationDays = 2;
    } else if (planStr.includes('3 ngày')) {
      durationDays = 3;
    } else if (planStr.includes('7 ngày') || planStr.includes('1 tuần') || planStr.includes('1 week') || planStr.includes('7 days') || planStr.includes('7d') || (order.price <= 20000 && planStr.includes('capcut'))) {
      durationDays = 7;
    } else if (planStr.includes('14 ngày') || planStr.includes('2 tuần') || planStr.includes('2 weeks') || planStr.includes('14 days')) {
      durationDays = 14;
    } else if (planStr.includes('15 ngày')) {
      durationDays = 15;
    } else if (planStr.includes('1 tháng') || planStr.includes('30 ngày') || planStr.includes('1 month')) {
      durationDays = 30;
    } else if (planStr.includes('2 tháng') || planStr.includes('60 ngày')) {
      durationDays = 60;
    } else if (planStr.includes('3 tháng') || planStr.includes('90 ngày')) {
      durationDays = 90;
    } else if (planStr.includes('6 tháng') || planStr.includes('180 ngày')) {
      durationDays = 180;
    } else if (planStr.includes('1 năm') || planStr.includes('12 tháng') || planStr.includes('1 year') || planStr.includes('365 ngày')) {
      durationDays = 365;
    } else {
      const dayMatch = planStr.match(/(\d+)\s*(ngày|day|days)/);
      if (dayMatch) durationDays = parseInt(dayMatch[1], 10);
    }
    const expiresAtMs = order.expires_at ? new Date(order.expires_at).getTime() : createdAtMs + durationDays * 24 * 60 * 60 * 1000;
    const diffDays = (expiresAtMs - Date.now()) / (24 * 60 * 60 * 1000);
    return diffDays > 0 && diffDays <= 3;
  };

  const filteredOrders = orders.filter((o) => {
    const effStatus = getEffectiveOrderStatus(o);
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'expiring_soon'
        ? isExpiringSoonOrder(o)
        : (
          effStatus === filterStatus ||
          (filterStatus === 'pending_delivery' && effStatus === 'paid') ||
          (filterStatus === 'pending_payment' && effStatus === 'pending') ||
          (filterStatus === 'processing' && effStatus === 'delivering')
        ));
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
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleTriggerCronScan}
            disabled={triggeringCron}
            className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/80 px-4 py-2.5 text-xs font-bold text-amber-800 dark:text-amber-300 shadow-xs transition hover:scale-102 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>{triggeringCron ? '⏳' : '⚡'}</span>
            <span>{triggeringCron ? 'Đang quét...' : 'Quét nhắc hạn (7/3/1 ngày)'}</span>
          </button>

          <button
            onClick={fetchOrders}
            className="rounded-xl bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:scale-102 cursor-pointer"
          >
            🔄 Tải lại đơn hàng
          </button>
        </div>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="rounded-[24px] border border-[#E8F1FF] dark:border-[#1E2A4A]/50 bg-white dark:bg-[#131C32] p-4 space-y-3.5 shadow-xs">
        {/* Row 1: Filter Tabs (Single Horizontal Scrollable Row) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-blue-400/40 dark:scrollbar-thumb-blue-500/40 scrollbar-track-slate-100 dark:scrollbar-track-slate-800/60 sm:scrollbar-none">
          {[
            { key: 'all', label: 'Tất cả', count: orders.length },
            { key: 'pending_payment', label: 'Chờ thanh toán', count: orders.filter((o) => getEffectiveOrderStatus(o) === 'pending_payment' || getEffectiveOrderStatus(o) === 'pending').length },
            { key: 'pending_delivery', label: 'Chờ bàn giao', count: orders.filter((o) => getEffectiveOrderStatus(o) === 'pending_delivery' || getEffectiveOrderStatus(o) === 'paid').length },
            { key: 'processing', label: 'Đang xử lý', count: orders.filter((o) => getEffectiveOrderStatus(o) === 'processing' || getEffectiveOrderStatus(o) === 'delivering').length },
            { key: 'completed', label: 'Đã xong', count: orders.filter((o) => getEffectiveOrderStatus(o) === 'completed').length },
            { key: 'expiring_soon', label: 'Sắp hết hạn', count: orders.filter(isExpiringSoonOrder).length },
            { key: 'cancelled', label: 'Đã hủy', count: orders.filter((o) => getEffectiveOrderStatus(o) === 'cancelled').length },
            { key: 'refunded', label: 'Hoàn tiền', count: orders.filter((o) => getEffectiveOrderStatus(o) === 'refunded').length }
          ].map((st) => {
            const isActive = filterStatus === st.key;
            return (
              <button
                key={st.key}
                type="button"
                onClick={() => { setFilterStatus(st.key); setCurrentPage(1); }}
                className={`group inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#2563EB] text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-semibold'
                }`}
              >
                <span>{st.label}</span>
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold font-mono transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'
                  }`}
                >
                  {st.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 2: Search Bar + Summary Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
            Hiển thị <span className="font-bold text-slate-900 dark:text-white font-mono">{filteredOrders.length}</span> / <span className="font-mono">{orders.length}</span> đơn hàng
          </div>

          <div className="flex h-10 items-center gap-2 rounded-xl border border-[#DCEAFF] dark:border-[#1E2A4A] bg-slate-50/50 dark:bg-slate-800/60 px-3.5 sm:w-80 shadow-2xs">
            <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo Mã đơn, Email, Tên..."
              className="w-full bg-transparent text-xs font-semibold outline-none placeholder:text-slate-400 text-slate-900 dark:text-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
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
          {paginatedOrders.map((o) => {
            const expiryInfo = calcOrderExpiry(o);
            const warranty = calcAdminWarranty(o);
            const deliveryText = o.delivery_info || o.account_details;

            return (
              <div id={`admin-order-${o.id}`} key={o.id} className={`rounded-[24px] border ${o.id === targetOrderId ? 'border-blue-400 ring-2 ring-blue-200 dark:ring-blue-900/60' : 'border-[#E8F1FF] dark:border-[#1E2A4A]/50'} bg-white dark:bg-[#131C32] p-6 shadow-xs flex flex-col gap-4`}>
                {/* Header info */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-50 dark:border-slate-800/60 pb-4">
                  <div>
                    <h3 className="font-extrabold text-slate-950 dark:text-white text-sm sm:text-base leading-tight">{o.product_name}</h3>
                    <p className="text-xs text-slate-400 font-bold mt-1">
                      Gói: <span className="text-[#2563EB] dark:text-[#38bdf8] font-extrabold">{getFormattedPlanLabel(o)}</span> — Mã đơn: <span className="font-bold text-slate-900 dark:text-white">{o.payment_code}</span>
                    </p>
                  </div>
                  <div className="flex flex-col sm:items-end gap-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
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
                  {deliveryText && (
                    <div className="sm:col-span-2 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-950/30 text-emerald-800 dark:text-emerald-400">
                      <strong className="block text-emerald-900 dark:text-emerald-300 font-bold text-xs mb-1">
                        🎁 Thông tin đã bàn giao:
                      </strong>
                      <pre className="font-mono whitespace-pre-wrap mt-1 leading-snug">{deliveryText}</pre>
                    </div>
                  )}
                </div>

                {/* ⏰ Subscription Expiry Bar (Hiển thị thời hạn còn lại giống bên User) */}
                {o.status === 'completed' && expiryInfo && (
                  <div className="rounded-2xl border border-blue-200/80 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-blue-950/40 dark:to-indigo-950/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>⏰</span> Thời hạn:
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${expiryInfo.badgeClass}`}>
                        <span>{expiryInfo.icon}</span>
                        <span>{expiryInfo.label}</span>
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">
                        • {expiryInfo.daysText}
                      </span>
                    </div>

                    {warranty && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                          <span>🛡️</span> Bảo hành:
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${warranty.badgeClass}`}>
                          <span>{warranty.label}</span>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Admin Actions */}
                <div className="flex flex-wrap gap-2.5 justify-end border-t border-slate-50 dark:border-slate-800/60 pt-4">
                  {/* Nút Xem chi tiết đơn hàng (Luôn hiển thị) */}
                  <button
                    onClick={() => openOrderDetail(o)}
                    className="rounded-full border border-[#DCEAFF] dark:border-[#1E2A4A] bg-[#F8FAFC] dark:bg-slate-800/80 hover:bg-[#EDF5FF] dark:hover:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition shadow-xs flex items-center gap-1.5"
                  >
                    <span>👁️</span> Xem chi tiết
                  </button>
                  {(o.status === 'pending_delivery' || o.status === 'paid') && (
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
                  {(o.status === 'processing' || o.status === 'delivering') && (
                    <button
                      onClick={() => setDeliveryOrder(o)}
                      className="rounded-full bg-gradient-to-r from-[#19A7FF] to-[#2563EB] px-4.5 py-2 text-xs font-bold text-white shadow-md transition hover:scale-102"
                    >
                      🚀 Bàn giao tài khoản
                    </button>
                  )}

                  {/* Allow refund for pending_delivery, paid, processing, or delivering */}
                  {(o.status === 'pending_delivery' || o.status === 'paid' || o.status === 'processing' || o.status === 'delivering') && (
                    <button
                      onClick={() => handleRefund(o.id)}
                      className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C32] hover:bg-[#F5F9FF] px-4.5 py-2 text-xs font-bold text-slate-500 hover:text-[#2563EB] transition shadow-xs"
                    >
                      💸 Hoàn tiền về ví
                    </button>
                  )}

                  {/* Allow cancel if pending payment */}
                  {(o.status === 'pending_payment' || o.status === 'pending') && (
                    <button
                      onClick={() => handleUpdateStatus(o.id, 'cancelled')}
                      className="rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C32] hover:bg-red-50 px-4.5 py-2 text-xs font-bold text-slate-500 hover:text-red-500 transition shadow-xs"
                    >
                      ❌ Hủy đơn hàng
                    </button>
                  )}
                </div>
              </div>
            );
          })}

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
                {(() => {
                  const modalExpiry = calcOrderExpiry(selectedOrderDetail);
                  const modalWarranty = calcAdminWarranty(selectedOrderDetail);

                  return (
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
                          <span className="font-bold text-slate-900 dark:text-white">{getFormattedPlanLabel(selectedOrderDetail)}</span>
                        </div>
                        {selectedOrderDetail.status === 'completed' && modalExpiry && (
                          <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 items-center flex-wrap gap-2">
                            <span className="text-slate-400">Thời hạn sử dụng:</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${modalExpiry.badgeClass}`}>
                                <span>{modalExpiry.icon}</span>
                                <span>{modalExpiry.label}</span>
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">({modalExpiry.daysText})</span>
                            </div>
                          </div>
                        )}
                        {selectedOrderDetail.status === 'completed' && modalWarranty && (
                          <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 items-center flex-wrap gap-2">
                            <span className="text-slate-400">Chính sách bảo hành:</span>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${modalWarranty.badgeClass}`}>
                              <span>{modalWarranty.icon}</span>
                              <span>{modalWarranty.label}</span>
                            </span>
                          </div>
                        )}
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

                      {/* Renewal Relationship Card (if this order is a renewal from an older order) */}
                      {(selectedOrderDetail.renewed_from_order_id || renewedFromOrder) && (
                        <div className="rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/60 dark:bg-blue-950/40 p-3 flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🔄</span>
                            <div>
                              <span className="font-bold text-blue-900 dark:text-blue-200 block">Đơn gia hạn tiếp nối</span>
                              <span className="text-[11px] text-blue-600 dark:text-blue-300">
                                Gia hạn từ đơn cũ: <strong>#{renewedFromOrder?.payment_code || selectedOrderDetail.renewed_from_order_id}</strong>
                              </span>
                            </div>
                          </div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 shrink-0">
                            GIA HẠN TIẾP NỐI
                          </span>
                        </div>
                      )}

                      {/* Superseded Relationship Card (if this older order has been superseded by a newer order) */}
                      {(selectedOrderDetail.superseded_by_order_id || supersededByOrder) && (
                        <div className="rounded-xl border border-purple-200 dark:border-purple-800/60 bg-purple-50/60 dark:bg-purple-950/40 p-3 flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base">⏸️</span>
                            <div>
                              <span className="font-bold text-purple-900 dark:text-purple-200 block">Đơn hàng đã được thay thế / gia hạn</span>
                              <span className="text-[11px] text-purple-600 dark:text-purple-300">
                                Thay thế bởi đơn mới: <strong>#{supersededByOrder?.payment_code || selectedOrderDetail.superseded_by_order_id}</strong>
                                {selectedOrderDetail.supersede_reason === 'AUTO_DETECTED_RENEWAL' ? ' (Tự động nhận diện)' : ' (Gia hạn tường minh)'}
                              </span>
                            </div>
                          </div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 shrink-0">
                            ĐÃ THAY THẾ
                          </span>
                        </div>
                      )}

                      {selectedOrderDetail.notes && (
                        <div className="bg-[#F8FAFC] dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs">
                          <span className="font-bold text-slate-500 block mb-1">Ghi chú của khách:</span>
                          <p className="text-slate-800 dark:text-slate-200 font-medium">{selectedOrderDetail.notes}</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Section 3: Thông tin bàn giao (Account Details) */}
                {(() => {
                  const modalDelivery = selectedOrderDetail.delivery_info || selectedOrderDetail.account_details;
                  if (!modalDelivery) return null;

                  return (
                    <div className="rounded-[22px] border border-emerald-200/60 dark:border-emerald-950/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 sm:p-5 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h3 className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                          <span>🎁</span> Thông tin đã bàn giao cho khách
                        </h3>
                        <button
                          onClick={() => handleCopyText(modalDelivery, 'thông tin bàn giao')}
                          className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1"
                        >
                          <span>📋</span> Sao chép
                        </button>
                      </div>
                      <pre className="font-mono text-xs text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap bg-white dark:bg-[#131C32] p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 leading-relaxed">
                        {modalDelivery}
                      </pre>
                    </div>
                  );
                })()}

                {/* Section 4: Quản lý & Lịch sử Nhắc hạn Độc lập (7 / 3 / 1 ngày & Hết hạn) */}
                {selectedOrderDetail.status === 'completed' && (
                  <div className="rounded-[22px] border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-4 sm:p-5 space-y-3.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                        <span>⏰</span> Tiến trình & Lịch sử nhắc hạn (4 Mốc độc lập)
                      </h3>
                      <button
                        type="button"
                        onClick={() => setIsManualReminderOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 text-[11px] font-bold shadow-xs transition hover:scale-102 cursor-pointer"
                      >
                        <span>📧</span> Gửi nhắc thủ công
                      </button>
                    </div>

                    <div className="space-y-2 text-xs">
                      {/* Helper to render status with stop state */}
                      {(() => {
                        const renderStatus = (milestoneKey: string) => {
                          const sentRecord = expiryReminders.find(r => r.notification_type === milestoneKey);
                          if (sentRecord) {
                            const isEmailSent = sentRecord.email_status === 'sent' || (!sentRecord.email_status && sentRecord.status === 'sent');
                            const isEmailSending = sentRecord.email_status === 'sending';
                            const isEmailFailed = sentRecord.email_status === 'failed' || sentRecord.email_status === 'failed_final';

                            return (
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
                                  🔔 Chuông Web ✅ • 📧 Email {isEmailSent ? '✅ Đã gửi' : isEmailSending ? '⏳ Đang gửi...' : isEmailFailed ? '❌ Lỗi' : '✅'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-semibold">
                                  {new Date(sentRecord.sent_at).toLocaleDateString('vi-VN')} {new Date(sentRecord.sent_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                  {(sentRecord.attempt_count ?? 1) > 1 ? ` • Lần thử: ${sentRecord.attempt_count}` : ''}
                                </span>
                              </div>
                            );
                          }

                          if (supersededByOrder || selectedOrderDetail.superseded_by_order_id) {
                            const code = supersededByOrder?.payment_code || 'đơn mới';
                            const isAuto = selectedOrderDetail.supersede_reason === 'AUTO_DETECTED_RENEWAL';
                            return (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2.5 py-1 text-[11px] font-extrabold text-[#2563EB] dark:text-[#35A8FF] shrink-0" title={`Đã được thay thế bởi đơn #${code}`}>
                                ⏸ Đã dừng ({isAuto ? 'Tự động nhận diện gia hạn' : 'Khách đã gia hạn'} #{code})
                              </span>
                            );
                          }

                          if (selectedOrderDetail.status === 'cancelled') {
                            return (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2.5 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 shrink-0">
                                ⏸ Đã dừng (Đơn đã hủy)
                              </span>
                            );
                          }

                          if (selectedOrderDetail.status === 'refunded') {
                            return (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                                ⏸ Đã dừng (Đã hoàn tiền)
                              </span>
                            );
                          }

                          return (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                              ⏳ Chưa đến hạn
                            </span>
                          );
                        };

                        return (
                          <>
                            {/* 7 Days Reminder */}
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/60 dark:border-slate-800 gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm">⏰</span>
                                <div>
                                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">Mốc trước 7 ngày</span>
                                  <span className="text-[10px] text-slate-400">Email & Chuông báo khách hàng</span>
                                </div>
                              </div>
                              {renderStatus('expiry_7_days')}
                            </div>

                            {/* 3 Days Reminder */}
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/60 dark:border-slate-800 gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm">⚠️</span>
                                <div>
                                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">Mốc trước 3 ngày</span>
                                  <span className="text-[10px] text-slate-400">Cảnh báo sắp hết hạn</span>
                                </div>
                              </div>
                              {renderStatus('expiry_3_days')}
                            </div>

                            {/* 1 Day Reminder */}
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/60 dark:border-slate-800 gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm">🚨</span>
                                <div>
                                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">Mốc trước 1 ngày (Ngày mai)</span>
                                  <span className="text-[10px] text-slate-400">Nhắc nhở khẩn cấp trước 24h</span>
                                </div>
                              </div>
                              {renderStatus('expiry_1_day')}
                            </div>

                            {/* Expired Milestone */}
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/60 dark:border-slate-800 gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm">🔴</span>
                                <div>
                                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">Mốc Đã hết hạn</span>
                                  <span className="text-[10px] text-slate-400">Thông báo kết thúc chu kỳ</span>
                                </div>
                              </div>
                              {renderStatus('expiry_expired')}
                            </div>
                          </>
                        );
                      })()}

                      {/* Manual Reminder (if any) */}
                      {(() => {
                        const notifManual = expiryReminders.find(r => r.notification_type === 'manual_reminder');
                        if (!notifManual) return null;
                        return (
                          <div className="flex items-center justify-between p-2.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/80 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm">📩</span>
                              <div>
                                <span className="font-extrabold text-purple-900 dark:text-purple-200 block">Lượt gửi nhắc thủ công bởi Admin</span>
                                <span className="text-[10px] text-purple-600 dark:text-purple-300">
                                  {notifManual.metadata?.custom_message ? `"${notifManual.metadata.custom_message}"` : 'Theo mẫu mặc định'}
                                </span>
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/60 border border-purple-300 dark:border-purple-700 px-2.5 py-1 text-[11px] font-extrabold text-purple-800 dark:text-purple-200 shrink-0">
                              Đã gửi ({new Date(notifManual.sent_at).toLocaleDateString('vi-VN')} {new Date(notifManual.sent_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Section 5: Lịch sử trạng thái đơn hàng (Timeline) */}
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
                {(selectedOrderDetail.status === 'pending_delivery' || selectedOrderDetail.status === 'paid' || selectedOrderDetail.status === 'processing' || selectedOrderDetail.status === 'delivering') && (
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
                {(selectedOrderDetail.status === 'pending_delivery' || selectedOrderDetail.status === 'paid' || selectedOrderDetail.status === 'processing' || selectedOrderDetail.status === 'delivering') && (
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

      {/* RENDER MODAL GỬI NHẮC HẠN THỦ CÔNG (PORTAL) */}
      {isManualReminderOpen && selectedOrderDetail && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={() => !sendingManualReminder && setIsManualReminderOpen(false)} />

          <form onSubmit={handleSendManualReminder} className="relative z-[100000] w-full max-w-md transform overflow-hidden rounded-[28px] border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#18243E] p-6 sm:p-8 shadow-2xl transition-all text-left space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span>📧</span> Gửi email nhắc gia hạn
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-300 font-semibold mt-1">
                Gửi đến: <strong className="text-slate-900 dark:text-white">{userProfileDetail?.email || selectedOrderDetail.profiles?.email || 'Khách hàng'}</strong>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                Lời nhắn tùy chỉnh (Tùy chọn)
              </label>
              <textarea
                value={manualCustomNote}
                onChange={(e) => setManualCustomNote(e.target.value)}
                placeholder="Để trống sẽ gửi lời nhắc mẫu chuẩn của hệ thống..."
                rows={3}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/60 p-3.5 text-xs font-bold outline-none transition focus:border-[#2563EB] dark:focus:border-[#35A8FF] text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 mt-4">
              <button
                type="button"
                disabled={sendingManualReminder}
                onClick={() => setIsManualReminderOpen(false)}
                className="flex-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={sendingManualReminder}
                className="flex-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 py-3 text-xs font-bold text-white shadow-md disabled:opacity-60 transition cursor-pointer"
              >
                {sendingManualReminder ? 'Đang gửi...' : '📧 Gửi ngay'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* CONFIRM ACTION MODAL */}
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
