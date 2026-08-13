import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export interface StatusHistoryItem {
  id: string;
  order_id: string;
  status: string;
  changed_by: string;
  actor_name?: string;
  note?: string;
  created_at: string;
}

interface OrderTimelineProps {
  orderId: string;
  currentStatus: 'pending_payment' | 'pending_delivery' | 'processing' | 'completed' | 'cancelled' | 'refunded';
  orderCreatedAt: string;
  compact?: boolean;
}

interface StepConfig {
  key: string;
  title: string;
  desc: string;
}

const STANDARD_STEPS: StepConfig[] = [
  { key: 'pending_payment', title: 'Đã đặt hàng', desc: 'Đơn hàng được khởi tạo thành công' },
  { key: 'pending_delivery', title: 'Đã thanh toán', desc: 'Hệ thống đã xác nhận thanh toán' },
  { key: 'processing', title: 'Đang xử lý', desc: 'Admin đang thiết lập dịch vụ/tài khoản' },
  { key: 'completed', title: 'Hoàn tất', desc: 'Dịch vụ đã được bàn giao thành công' },
];

function formatTimeOnly(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateOnly(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

export default function OrderTimeline({
  orderId,
  currentStatus,
  orderCreatedAt,
  compact = false,
}: OrderTimelineProps) {
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const { data, error } = await (supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true }) as any);

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching order timeline history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchHistory();
    }
  }, [orderId]);

  // Realtime subscription for timeline updates
  useEffect(() => {
    if (!orderId) return;

    const topic = `ot-${orderId.slice(0, 8)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const channel = supabase.channel(topic);

    try {
      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'order_status_history', filter: `order_id=eq.${orderId}` },
          () => {
            fetchHistory();
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
          () => {
            fetchHistory();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('[OrderTimeline] Realtime subscription warning:', err);
    }

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, [orderId]);

  // Map history array by status key -> latest history item for that status
  const historyMap = new Map<string, StatusHistoryItem>();
  history.forEach((item) => {
    historyMap.set(item.status, item);
  });

  // Ensure 'pending_payment' always has fallback timestamp from orderCreatedAt
  if (!historyMap.has('pending_payment') && orderCreatedAt) {
    historyMap.set('pending_payment', {
      id: 'fallback-created',
      order_id: orderId,
      status: 'pending_payment',
      changed_by: 'system',
      created_at: orderCreatedAt,
    });
  }

  // Handle special status paths (cancelled / refunded)
  const isCancelled = currentStatus === 'cancelled';
  const isRefunded = currentStatus === 'refunded';

  let activeSteps: StepConfig[] = [...STANDARD_STEPS];
  if (isCancelled) {
    // Show completed steps up to cancellation
    activeSteps = [
      STANDARD_STEPS[0], // Đã đặt hàng
      ...(historyMap.has('pending_delivery') ? [STANDARD_STEPS[1]] : []),
      { key: 'cancelled', title: 'Đã hủy', desc: 'Đơn hàng đã bị hủy hoặc hết hạn thanh toán' },
    ];
  } else if (isRefunded) {
    activeSteps = [
      STANDARD_STEPS[0],
      STANDARD_STEPS[1],
      STANDARD_STEPS[3], // Hoàn tất
      { key: 'refunded', title: 'Đã hoàn tiền', desc: 'Số dư đã được hoàn về ví người dùng' },
    ];
  }

  // Find index of current status
  const currentIndex = activeSteps.findIndex((s) => s.key === currentStatus);

  return (
    <div className={`rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#18243E] ${compact ? 'p-3.5' : 'p-4 sm:p-5'} space-y-3`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span>🚚</span>
          <span>Tiến trình đơn hàng</span>
        </h4>
        {loading && (
          <span className="text-[10px] font-bold text-slate-400 animate-pulse">Đang cập nhật...</span>
        )}
      </div>

      <div className="relative pt-1 pl-1">
        {activeSteps.map((step, idx) => {
          const historyItem = historyMap.get(step.key);
          const isDone = currentIndex !== -1 && idx <= currentIndex;
          const isCurrent = step.key === currentStatus;
          const isLast = idx === activeSteps.length - 1;
          const timestamp = historyItem?.created_at || (isDone ? (historyMap.get('pending_payment')?.created_at || orderCreatedAt) : null);

          // Color themes
          let iconContent = '○';
          let iconClass = 'bg-slate-100 text-slate-400 border-slate-300 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700';
          let titleClass = 'text-slate-400 dark:text-slate-500 font-semibold';
          let lineClass = 'bg-slate-200 dark:bg-slate-800';

          if (isDone && !isCurrent) {
            iconContent = '✓';
            iconClass = 'bg-emerald-500 text-white border-emerald-500 shadow-xs shadow-emerald-500/20';
            titleClass = 'text-slate-900 dark:text-slate-200 font-bold';
            lineClass = 'bg-emerald-500';
          } else if (isCurrent) {
            if (step.key === 'cancelled') {
              iconContent = '✕';
              iconClass = 'bg-rose-500 text-white border-rose-500 shadow-md animate-pulse';
              titleClass = 'text-rose-600 dark:text-rose-400 font-black';
            } else if (step.key === 'refunded') {
              iconContent = '↩';
              iconClass = 'bg-slate-600 text-white border-slate-600 shadow-md';
              titleClass = 'text-slate-700 dark:text-slate-300 font-black';
            } else if (step.key === 'completed') {
              iconContent = '✓';
              iconClass = 'bg-emerald-500 text-white border-emerald-500 shadow-md ring-4 ring-emerald-500/20';
              titleClass = 'text-emerald-600 dark:text-emerald-400 font-black';
            } else {
              iconContent = '●';
              iconClass = 'bg-[#2563EB] text-white border-[#2563EB] shadow-md shadow-blue-500/30 ring-4 ring-blue-500/20 animate-pulse';
              titleClass = 'text-[#2563EB] dark:text-[#35A8FF] font-black';
            }
          }

          return (
            <div key={step.key} className="relative flex items-start gap-3 pb-5 last:pb-0 group">
              {/* Vertical line connector */}
              {!isLast && (
                <div
                  className={`absolute left-[13px] top-[26px] bottom-0 w-[2px] ${lineClass} transition-colors duration-300`}
                />
              )}

              {/* Icon Node */}
              <div
                className={`relative z-10 h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-black shrink-0 transition-all duration-300 ${iconClass}`}
              >
                {iconContent}
              </div>

              {/* Step Info */}
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className={`text-xs sm:text-sm ${titleClass} transition-colors`}>
                    {step.title}
                  </span>

                  {/* Real Timestamp display */}
                  {timestamp && (
                    <span className="font-mono text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-800/60 px-2 py-0.5 rounded-md">
                      {formatTimeOnly(timestamp)}
                      <span className="text-slate-400 dark:text-slate-500 ml-1 font-normal">
                        · {formatDateOnly(timestamp)}
                      </span>
                    </span>
                  )}
                </div>

                {/* Subtitle / Description */}
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed break-words">
                  {isCurrent && isDone ? (
                    <span className="text-slate-700 dark:text-slate-300 font-extrabold">
                      {step.desc}
                    </span>
                  ) : (
                    step.desc
                  )}
                </p>

                {/* Optional History Note if present */}
                {historyItem?.note && (
                  <div className="mt-1 text-[11px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 p-1.5 rounded-lg border border-blue-100 dark:border-blue-900/30">
                    📝 {historyItem.note}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
