// src/pages/admin/analytics/SessionForensicDrawer.tsx
import React, { useState } from 'react';
import { CloseIcon, TimelineIcon } from '../../../components/icons';
import type { AgentAnalyticsEvent } from '../../../services/agent/monitoring/analyticsTypes';
import type { PlanLookupItem } from './types';

interface SessionForensicDrawerProps {
  sessionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  sessionEvents: AgentAnalyticsEvent[];
  loading: boolean;
  resolveProductName: (productId?: string | null) => string;
  resolvePlanDetails: (planId?: string | null) => PlanLookupItem | null;
}

export const SessionForensicDrawer: React.FC<SessionForensicDrawerProps> = ({
  sessionId,
  isOpen,
  onClose,
  sessionEvents,
  loading,
  resolveProductName,
  resolvePlanDetails,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedJsonIndex, setExpandedJsonIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'MESSAGE_RECEIVED':
        return { label: 'Tin nhắn', cls: 'bg-sky-500/10 text-sky-400 border-sky-500/20' };
      case 'INTENT_RESOLVED':
        return { label: 'Intent', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      case 'PRODUCT_RESOLVED':
        return { label: '️ Sản phẩm', cls: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
      case 'PLAN_RESOLVED':
        return { label: 'Gói', cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
      case 'ACTION_SHOWN':
        return { label: 'Action Card', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'ACTION_CLICKED':
        return { label: 'Click Action', cls: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' };
      case 'CHECKOUT_OPENED':
        return { label: 'Mở Checkout', cls: 'bg-pink-500/10 text-pink-400 border-pink-500/20' };
      case 'CHECKOUT_SUCCESS':
        return { label: 'Thanh toán thành công', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-bold' };
      case 'CHECKOUT_CANCELLED':
        return { label: 'Hủy đơn', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
      case 'CLARIFICATION_REQUESTED':
        return { label: 'Hỏi lại làm rõ', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'DEMAND_DISCOVERED':
        return { label: 'Nhu cầu mới', cls: 'bg-violet-500/10 text-violet-400 border-violet-500/20' };
      case 'GEMINI_FALLBACK':
        return { label: '️ Fallback V2', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' };
      default:
        return { label: type, cls: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const userMessagesCount = sessionEvents.filter((e) => e.eventType === 'MESSAGE_RECEIVED').length;
  const isConverted = sessionEvents.some((e) => e.eventType === 'CHECKOUT_SUCCESS');

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col transform transition ease-in-out duration-300">
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-white/5 bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <TimelineIcon className="w-5 h-5 text-blue-400 shrink-0" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
                  Session Forensic Timeline
                </h2>
                {isConverted && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Converted ✓
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {sessionId ? `${sessionId.slice(0, 16)}...` : 'N/A'}
                </span>
                {sessionId && (
                  <button
                    onClick={() => copyToClipboard(sessionId, 'session_id')}
                    className="text-[11px] text-blue-400 hover:text-blue-300 underline font-mono"
                  >
                    {copiedKey === 'session_id' ? 'Đã chép!' : 'Copy ID'}
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/5 transition"
              title="Đóng"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-3 gap-2 p-4 bg-slate-900/30 border-b border-white/5 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Tổng sự kiện</p>
              <p className="text-base font-bold text-white mt-0.5">{sessionEvents.length}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Tin nhắn User</p>
              <p className="text-base font-bold text-sky-400 mt-0.5">{userMessagesCount}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/50 border border-white/5">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Kết quả</p>
              <p className={`text-base font-bold mt-0.5 ${isConverted ? 'text-emerald-400' : 'text-slate-400'}`}>
                {isConverted ? 'Thành công' : 'Đang duyệt'}
              </p>
            </div>
          </div>

          {/* Timeline Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500/20 border-t-blue-500" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Đang tái hiện dòng thời gian session...</p>
              </div>
            ) : sessionEvents.length === 0 ? (
              <div className="py-20 text-center text-slate-500 text-xs">
                Không tìm thấy dữ liệu sự kiện nào cho phiên hội thoại này.
              </div>
            ) : (
              <div className="relative border-l-2 border-slate-800 ml-3 space-y-6">
                {sessionEvents.map((ev, idx) => {
                  const badge = getEventBadge(ev.eventType);
                  const prodName = resolveProductName(ev.productId);
                  const planInfo = resolvePlanDetails(ev.planId);
                  const isExpanded = expandedJsonIndex === idx;

                  return (
                    <div key={idx} className="relative pl-6 group">
                      {/* Timeline Dot */}
                      <div className="absolute -left-2 top-1.5 w-3.5 h-3.5 rounded-full bg-slate-950 border-2 border-blue-500 group-hover:scale-125 transition-transform" />

                      {/* Card */}
                      <div className="p-4 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/5 hover:border-white/10 transition-all text-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${badge.cls}`}>
                            {badge.label}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString('vi-VN') : ''}
                          </span>
                        </div>

                        {/* User Raw Query */}
                        {(ev.metadata as any)?.query && (
                          <div className="p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/10 text-slate-200">
                            <span className="text-[10px] uppercase font-bold text-blue-400 block mb-0.5">Khách hỏi</span>
                            <span className="font-medium text-white">"{(ev.metadata as any).query}"</span>
                          </div>
                        )}

                        {/* Intent */}
                        {ev.intent && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">Intent:</span>
                            <span className="font-mono font-bold text-blue-400">{ev.intent}</span>
                          </div>
                        )}

                        {/* Product / Plan */}
                        {ev.productId && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">Sản phẩm:</span>
                            <span className="font-bold text-white">{prodName}</span>
                            {planInfo && (
                              <span className="text-purple-400 font-medium">({planInfo.duration || planInfo.name})</span>
                            )}
                          </div>
                        )}

                        {/* Action Details */}
                        {ev.actionType && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">Hành động:</span>
                            <span className="font-mono text-indigo-300">{ev.actionType}</span>
                          </div>
                        )}

                        {/* Reason / Clarification */}
                        {ev.reason && (
                          <div className="p-2 rounded-xl bg-amber-500/5 border border-amber-500/15 text-amber-300 text-[11px]">
                            Lý do: {ev.reason}
                          </div>
                        )}

                        {/* Collapsible Payload */}
                        <div className="pt-1">
                          <button
                            onClick={() => setExpandedJsonIndex(isExpanded ? null : idx)}
                            className="text-[10px] text-slate-400 hover:text-slate-300 font-mono flex items-center gap-1"
                          >
                            <span>{isExpanded ? '▼ Ẩn raw JSON' : '▶ Xem raw payload'}</span>
                          </button>

                          {isExpanded && (
                            <div className="mt-2 p-2.5 rounded-xl bg-slate-950 border border-white/5 font-mono text-[10px] text-slate-300 overflow-x-auto relative">
                              <button
                                onClick={() => copyToClipboard(JSON.stringify(ev, null, 2), `json_${idx}`)}
                                className="absolute top-2 right-2 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[9px] text-slate-300"
                              >
                                {copiedKey === `json_${idx}` ? 'Đã copy!' : 'Copy'}
                              </button>
                              <pre>{JSON.stringify(ev, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/5 bg-slate-900/60 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
            >
              Đóng Drawer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
