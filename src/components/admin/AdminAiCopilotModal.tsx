import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { executeAgentMessage } from '../../services/agent/agentHostBridge';
import type { AgentMessage } from '@bow/agent';
import type { AgentContext } from '../../services/agent/types';
import { useToast } from '../Toast';

interface AdminAiCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AdminAiCopilotModal({ isOpen, onClose }: AdminAiCopilotModalProps) {
  const { session, profile, balance, isAdmin } = useAuth();
  const toast = useToast();
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 'admin_welcome',
      sender: 'agent',
      content: '👋 Chào Admin! Tôi là **BOW Admin Copilot** — Trợ lý vận hành kinh doanh bán tự động của Shop of BOW.\n\nTôi có thể giúp bạn kiểm tra **Hàng đợi đơn chờ giao**, **Bàn giao tài khoản 1 chạm**, xem **Báo cáo doanh thu & Lợi nhuận ròng**, hoặc **Tạo voucher khuyến mãi**. Bạn cần hỗ trợ gì hôm nay?',
      timestamp: new Date().toISOString(),
      suggestions: [
        '⏳ Đơn nào đang chờ bàn giao?',
        '📈 Báo cáo doanh thu & lợi nhuận hôm nay',
        '🎟️ Tạo voucher giảm 20% cho khách',
        '🛠️ Kiểm tra khiếu nại đơn #BOW-ORD-9921',
      ],
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const adminContext: AgentContext = {
    userId: session?.user?.id,
    email: session?.user?.email,
    fullName: profile?.full_name,
    role: isAdmin ? 'admin' : 'customer',
    balance: balance,
    isAuthenticated: !!session,
    surface: 'admin',
    route: window.location.pathname || '/admin',
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        scrollToBottom();
      }, 150);
    }
  }, [isOpen, messages]);

  if (!isOpen) return null;

  const handleResetChat = () => {
    setMessages([
      {
        id: 'admin_welcome_' + Date.now(),
        sender: 'agent',
        content: '🔄 Đã làm mới phiên quản trị! Bạn cần tra cứu hàng đợi đơn hàng, doanh thu lợi nhuận hay tạo voucher khuyến mãi nào?',
        timestamp: new Date().toISOString(),
        suggestions: [
          '⏳ Đơn nào đang chờ bàn giao?',
          '📈 Báo cáo doanh thu & lợi nhuận hôm nay',
          '🎟️ Tạo voucher giảm 20% cho khách',
          '🛠️ Kiểm tra khiếu nại đơn #BOW-ORD-9921',
        ],
      },
    ]);
    setInputValue('');
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isTyping) return;

    setInputValue('');
    const userMsg: AgentMessage = {
      id: 'user_' + Date.now(),
      sender: 'user',
      content: query,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const response = await executeAgentMessage(query, adminContext);
      setMessages((prev) => [...prev, response]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'agent',
          content: '❌ Có lỗi xảy ra khi kết nối với Bộ Não AI: ' + (err?.message || 'Lỗi không xác định'),
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderActionData = (data: any) => {
    if (!data) return null;

    // 1. Pending Fulfillment Queue Card
    if (data.type === 'pending_fulfillment' && data.pendingQueue) {
      const queue = data.pendingQueue;
      return (
        <div className="mt-3 rounded-2xl bg-gradient-to-br from-amber-500/15 via-slate-900/90 to-slate-900 border border-amber-500/40 p-3.5 text-xs shadow-xl animate-fade-up">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-2 mb-2.5">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <span>⏳ Hàng Đợi Chờ Bàn Giao</span>
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-[10px] text-amber-300">
                {queue.totalPendingCount} đơn
              </span>
            </span>
            {queue.urgentCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-300 font-semibold text-[10px] animate-pulse">
                ⚠️ {queue.urgentCount} đơn chờ &gt; 15p
              </span>
            )}
          </div>
          {queue.orders && queue.orders.length > 0 ? (
            <div className="space-y-2">
              {queue.orders.map((ord: any) => (
                <div key={ord.orderId} className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-blue-300">#{ord.orderId}</span>
                    <span className="font-semibold text-emerald-400">+{ord.amountPaid?.toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div className="text-slate-300">
                    <span className="text-slate-400">Khách:</span> {ord.customerName} ({ord.customerPhone || 'N/A'})
                  </div>
                  <div className="text-slate-300">
                    <span className="text-slate-400">Sản phẩm:</span> <span className="text-amber-200 font-medium">{ord.productName}</span> ({ord.planName})
                  </div>
                  <div className="flex justify-between items-center pt-1.5 mt-1 border-t border-slate-700/40">
                    <span className={ord.isUrgent ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                      ⏱️ Chờ: {ord.waitingMinutes} phút
                    </span>
                    <button
                      onClick={() => {
                        setInputValue(`Giao tài khoản cho đơn ${ord.orderId}: user: email_vip@bow.vn | pass: 123456`);
                        inputRef.current?.focus();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] transition shadow cursor-pointer"
                    >
                      Bàn giao nhanh
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-center py-2">Hiện tại không có đơn hàng nào chờ bàn giao. Tuyệt vời! 🎉</p>
          )}
        </div>
      );
    }

    // 2. Net Profit & Margin Card
    if (data.type === 'profit_margin' && data.profitReport) {
      const rep = data.profitReport;
      return (
        <div className="mt-3 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-slate-900/90 to-slate-900 border border-emerald-500/40 p-3.5 text-xs shadow-xl animate-fade-up">
          <div className="font-bold text-emerald-400 border-b border-emerald-500/20 pb-2 mb-2.5 flex items-center justify-between">
            <span>📈 Báo Cáo Lợi Nhuận Ròng ({rep.timeframe})</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
              Biên LN: {rep.profitMarginPercent}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Doanh Thu</div>
              <div className="font-black text-blue-400 text-sm mt-0.5">{rep.totalRevenue?.toLocaleString('vi-VN')}đ</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Lợi Nhuận Ròng</div>
              <div className="font-black text-emerald-400 text-sm mt-0.5">{rep.netProfit?.toLocaleString('vi-VN')}đ</div>
            </div>
          </div>
          <div className="mt-2.5 text-slate-400 text-[11px] text-center">
            Giá vốn đối tác: <span className="text-rose-300 font-medium">{rep.totalSupplierCost?.toLocaleString('vi-VN')}đ</span> • Hoàn thành: <span className="text-slate-200">{rep.totalFulfilledOrders} đơn</span>
          </div>
        </div>
      );
    }

    // 3. Shop Voucher Result Card
    if (data.type === 'shop_voucher' && data.voucher) {
      const v = data.voucher;
      return (
        <div className="mt-3 rounded-2xl bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/40 p-3.5 text-xs shadow-xl animate-fade-up">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-purple-300 uppercase font-bold tracking-wider">Mã Khuyến Mãi Đã Tạo</div>
              <div className="text-base font-black font-mono text-white mt-0.5 tracking-wider">{v.code}</div>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 rounded-lg bg-purple-600 text-white font-bold text-xs shadow">
                Giảm {v.discountDisplay}
              </span>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-purple-500/20 flex justify-between items-center text-slate-300 text-[11px]">
            <span>Đơn tối thiểu: {v.minOrderValue?.toLocaleString('vi-VN')}đ</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(v.code);
                toast.success('Đã sao chép mã voucher ' + v.code);
              }}
              className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[10px] font-bold transition cursor-pointer"
            >
              Sao chép mã
            </button>
          </div>
        </div>
      );
    }

    // 4. Order Dispute Resolution Card
    if (data.type === 'order_dispute' && data.dispute) {
      const d = data.dispute;
      return (
        <div className="mt-3 rounded-2xl bg-gradient-to-br from-rose-500/15 via-slate-900/90 to-slate-900 border border-rose-500/40 p-3.5 text-xs shadow-xl animate-fade-up">
          <div className="font-bold text-rose-400 border-b border-rose-500/20 pb-1.5 mb-2 flex justify-between items-center">
            <span>🛠️ Xử Lý Khiếu Nại: #{d.orderId}</span>
            <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-[10px] text-rose-300 uppercase font-bold">{d.warrantyStatus}</span>
          </div>
          <div className="text-slate-300 space-y-1">
            <div><span className="text-slate-400">Khách:</span> {d.customerName} ({d.customerPhone || 'N/A'})</div>
            <div><span className="text-slate-400">Sản phẩm:</span> {d.productName}</div>
            <div><span className="text-slate-400">Báo lỗi:</span> <span className="text-rose-200">{d.issueReported}</span></div>
            <div className="p-2.5 mt-2 rounded-xl bg-blue-950/60 border border-blue-500/40 text-blue-200">
              <span className="font-bold text-blue-400">👉 Đề xuất xử lý:</span> {d.recommendedAction}
            </div>
          </div>
        </div>
      );
    }

    // 5. Order Lookup Card
    if (data.type === 'order_lookup' && data.order) {
      const ord = data.order;
      return (
        <div className="mt-3 rounded-2xl bg-gradient-to-br from-blue-500/15 via-slate-900/90 to-slate-900 border border-blue-500/40 p-3.5 text-xs shadow-xl animate-fade-up">
          <div className="flex items-center justify-between border-b border-blue-500/20 pb-2 mb-2">
            <span className="font-bold text-blue-400 flex items-center gap-1.5">
              <span>📦 Chi Tiết Đơn Hàng #{ord.orderId}</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold text-[10px]">
              {ord.status === 'completed' ? '✅ Hoàn thành' : ord.status === 'paid' ? '⏳ Chờ giao' : '⚠️ Chưa thanh toán'}
            </span>
          </div>
          <div className="space-y-1.5 text-slate-300">
            <div><span className="text-slate-400">Khách hàng:</span> <span className="font-medium text-white">{ord.customerName}</span> ({ord.customerEmail || 'N/A'})</div>
            <div><span className="text-slate-400">Sản phẩm:</span> {ord.productName} ({ord.planLabel})</div>
            <div><span className="text-slate-400">Số tiền:</span> <span className="font-bold text-emerald-400">{ord.amount?.toLocaleString('vi-VN')}đ</span></div>
            {ord.timeline && ord.timeline.length > 0 && (
              <div className="pt-2 mt-2 border-t border-slate-700/40 space-y-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Timeline</div>
                {ord.timeline.map((t: any, idx: number) => (
                  <div key={idx} className="text-[11px] text-slate-300">• {t.event}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    // 6. Daily Summary Card
    if (data.type === 'daily_summary' && data.summary) {
      const s = data.summary;
      return (
        <div className="mt-3 rounded-2xl bg-gradient-to-br from-indigo-500/15 via-slate-900/90 to-slate-900 border border-indigo-500/40 p-3.5 text-xs shadow-xl animate-fade-up">
          <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2 mb-2.5">
            <span className="font-bold text-indigo-300">📊 Tổng Quan Ngày ({s.date})</span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-semibold text-[10px]">Daily Brief</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center mb-2.5">
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50">
              <div className="text-slate-400 text-[9px] uppercase font-bold">Chờ Giao</div>
              <div className="font-bold text-amber-400 text-sm">{s.pendingHandoverCount} đơn</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50">
              <div className="text-slate-400 text-[9px] uppercase font-bold">Doanh Thu</div>
              <div className="font-bold text-blue-400 text-sm">{s.todayRevenue?.toLocaleString('vi-VN')}đ</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50">
              <div className="text-slate-400 text-[9px] uppercase font-bold">Lợi Nhuận</div>
              <div className="font-bold text-emerald-400 text-sm">{s.todayProfit?.toLocaleString('vi-VN')}đ</div>
            </div>
          </div>
          <div className="p-2 rounded-xl bg-indigo-950/50 border border-indigo-500/30 text-indigo-200 text-[11px]">
            <span className="font-bold text-indigo-400">👉 Trọng tâm:</span> {s.recommendedFocus}
          </div>
        </div>
      );
    }

    // 7. Task Prioritization Card
    if (data.type === 'task_prioritization' && data.tasks) {
      const taskRes = data.tasks;
      return (
        <div className="mt-3 rounded-2xl bg-gradient-to-br from-cyan-500/15 via-slate-900/90 to-slate-900 border border-cyan-500/40 p-3.5 text-xs shadow-xl animate-fade-up">
          <div className="font-bold text-cyan-400 border-b border-cyan-500/20 pb-2 mb-2 flex justify-between items-center">
            <span>📋 Thứ Tự Ưu Tiên Xử Lý</span>
            <span className="text-[10px] text-slate-400">{taskRes.tasks?.length || 0} tasks</span>
          </div>
          <div className="space-y-2">
            {(taskRes.tasks || []).map((t: any) => (
              <div key={t.priority} className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-white">#{t.priority}. {t.title}</span>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-[9px] text-cyan-300 font-bold">{t.category}</span>
                </div>
                <div className="text-slate-300 text-[11px] mb-1">{t.description}</div>
                <div className="text-[11px] text-amber-300 font-medium">⚡ {t.actionRequired}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 8. Customer Lookup Card
    if (data.type === 'customer_lookup' && data.customer) {
      const c = data.customer;
      return (
        <div className="mt-3 rounded-2xl bg-gradient-to-br from-violet-500/15 via-slate-900/90 to-slate-900 border border-violet-500/40 p-3.5 text-xs shadow-xl animate-fade-up">
          <div className="font-bold text-violet-400 border-b border-violet-500/20 pb-2 mb-2 flex justify-between items-center">
            <span>👤 Hồ Sơ Khách Hàng: {c.customerName}</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">VIP</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center mb-2">
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50">
              <div className="text-slate-400 text-[9px] uppercase font-bold">Đã Mua</div>
              <div className="font-bold text-blue-400 text-sm">{c.totalOrders} đơn</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50">
              <div className="text-slate-400 text-[9px] uppercase font-bold">Chi Tiêu</div>
              <div className="font-bold text-emerald-400 text-sm">{c.totalSpent?.toLocaleString('vi-VN')}đ</div>
            </div>
          </div>
          <div className="text-slate-300 text-[11px]">
            <span className="text-slate-400">Email:</span> {c.email || 'N/A'} • <span className="text-slate-400">Khiếu nại:</span> {c.disputeHistoryCount} lần
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 text-left">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Window */}
      <div className="relative z-10 flex flex-col w-full max-w-full sm:max-w-lg h-[90dvh] sm:h-[620px] rounded-t-[28px] sm:rounded-3xl border border-slate-700/80 bg-[#0F172A] text-white shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-[#11192C] shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/30 ring-2 ring-white/20">
              <span className="text-base sm:text-lg">✨</span>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-slate-900">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-extrabold text-white truncate">
                  BOW Admin Copilot
                </h3>
                <span className="shrink-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 px-1.5 py-0.5 text-[9px] font-black text-white shadow-xs uppercase">
                  On-Demand
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 truncate">
                Trợ lý vận hành bán tự động Shop of BOW
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleResetChat}
              title="Làm mới hội thoại"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition cursor-pointer active:scale-95 text-sm font-bold"
            >
              🔄
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 space-y-4 text-xs scrollbar-thin scrollbar-thumb-slate-700">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl p-3.5 shadow-md ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-none'
                    : 'bg-slate-800/90 text-slate-200 border border-slate-700/70 rounded-bl-none'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                {msg.data && renderActionData(msg.data)}
              </div>

              {/* Suggestions Chips */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 max-w-[92%]">
                  {msg.suggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(sug)}
                      className="px-2.5 py-1 rounded-full bg-slate-800/90 hover:bg-blue-600/30 border border-slate-700/80 hover:border-blue-500/50 text-slate-300 hover:text-white text-[11px] font-medium transition shadow-xs cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-2 text-slate-400 text-xs italic py-1">
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" />
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0.2s]" />
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce [animation-delay:0.4s]" />
              <span>Admin Copilot đang phân tích số liệu...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer Input Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/90 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Gõ lệnh hoặc câu hỏi quản trị (vd: đơn chờ giao, doanh thu)..."
              className="flex-1 rounded-2xl bg-slate-800/90 border border-slate-700 px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-md cursor-pointer"
            >
              Gửi
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
