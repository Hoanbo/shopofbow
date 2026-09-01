// src/pages/admin/analytics/AgentEventsTab.tsx
import React, { useState, useMemo } from 'react';
import { SearchIcon, CloseIcon } from '../../../components/icons';
import type { AgentAnalyticsEvent } from '../../../services/agent/monitoring/analyticsTypes';
import type { PlanLookupItem } from './types';
import { CustomAnalyticsSelect } from './CustomAnalyticsSelect';

interface AgentEventsTabProps {
  recentEvents: AgentAnalyticsEvent[];
  selectedPhraseFilter: string | null;
  onClearPhraseFilter: () => void;
  resolveProductName: (productId?: string | null) => string;
  resolvePlanDetails: (planId?: string | null) => PlanLookupItem | null;
  onOpenSession: (sessionId: string) => void;
}

export const AgentEventsTab: React.FC<AgentEventsTabProps> = ({
  recentEvents,
  selectedPhraseFilter,
  onClearPhraseFilter,
  resolveProductName,
  resolvePlanDetails,
  onOpenSession,
}) => {
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [eventPage, setEventPage] = useState(1);
  const EVENTS_PER_PAGE = 12;

  const filteredEvents = useMemo(() => {
    let list = recentEvents;

    if (selectedPhraseFilter) {
      const phrase = selectedPhraseFilter.toLowerCase();
      list = list.filter((ev) => {
        const q = ((ev.metadata as any)?.query || '').toLowerCase();
        return q.includes(phrase);
      });
    }

    if (eventTypeFilter !== 'all') {
      list = list.filter((ev) => ev.eventType === eventTypeFilter);
    }

    if (eventSearchQuery.trim()) {
      const q = eventSearchQuery.toLowerCase();
      list = list.filter((ev) => {
        const prodName = resolveProductName(ev.productId).toLowerCase();
        const intent = (ev.intent || '').toLowerCase();
        const userQ = ((ev.metadata as any)?.query || '').toLowerCase();
        const reason = (ev.reason || '').toLowerCase();
        return prodName.includes(q) || intent.includes(q) || userQ.includes(q) || reason.includes(q);
      });
    }

    return list;
  }, [recentEvents, selectedPhraseFilter, eventTypeFilter, eventSearchQuery, resolveProductName]);

  const totalEventPages = Math.max(1, Math.ceil(filteredEvents.length / EVENTS_PER_PAGE));
  const paginatedEvents = useMemo(() => {
    const start = (eventPage - 1) * EVENTS_PER_PAGE;
    return filteredEvents.slice(start, start + EVENTS_PER_PAGE);
  }, [filteredEvents, eventPage]);

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
        return { label: 'Mua thành công', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-bold' };
      case 'CHECKOUT_CANCELLED':
        return { label: 'Hủy đơn', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
      case 'CLARIFICATION_REQUESTED':
        return { label: 'Hỏi lại', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'PRODUCT_UNRESOLVED':
      case 'INTENT_UNRESOLVED':
      case 'PLAN_UNRESOLVED':
        return { label: '️ Lỗi phân giải', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
      case 'GEMINI_FALLBACK':
        return { label: '️ Fallback V2', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' };
      case 'DEMAND_DISCOVERED':
        return { label: 'Nhu cầu mới', cls: 'bg-violet-500/10 text-violet-400 border-violet-500/20' };
      default:
        return { label: type, cls: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  return (
    <div className="space-y-6">
      {/* EVENTS TABLE CONTAINER */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Luồng Sự Kiện Realtime (Live Event Stream)
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cập nhật trực tiếp mỗi hành vi tương tác, truy vấn và giao dịch
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {selectedPhraseFilter && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs">
                <span>Khách hỏi: "{selectedPhraseFilter}"</span>
                <button onClick={onClearPhraseFilter} className="hover:text-white">
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="relative min-w-[200px]">
              <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={eventSearchQuery}
                onChange={(e) => {
                  setEventSearchQuery(e.target.value);
                  setEventPage(1);
                }}
                placeholder="Tìm sự kiện, intent, SP..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <CustomAnalyticsSelect
              value={eventTypeFilter}
              onChange={(val) => {
                setEventTypeFilter(val);
                setEventPage(1);
              }}
              minWidth="min-w-[180px]"
              options={[
                { value: 'all', label: 'Tất cả loại sự kiện' },
                { value: 'MESSAGE_RECEIVED', label: 'Tin nhắn' },
                { value: 'INTENT_RESOLVED', label: 'Khớp Intent' },
                { value: 'PRODUCT_RESOLVED', label: '️ Khớp Sản phẩm' },
                { value: 'PLAN_RESOLVED', label: 'Khớp Gói cước' },
                { value: 'ACTION_SHOWN', label: 'Tạo Action Card' },
                { value: 'ACTION_CLICKED', label: 'Click Action Card' },
                { value: 'CHECKOUT_OPENED', label: 'Mở Checkout' },
                { value: 'CHECKOUT_SUCCESS', label: 'Mua Thành công' },
                { value: 'CLARIFICATION_REQUESTED', label: 'Yêu cầu Làm rõ' },
                { value: 'GEMINI_FALLBACK', label: '️ Fallback về V2' },
                { value: 'DEMAND_DISCOVERED', label: 'Nhu cầu mới' },
              ]}
            />
          </div>
        </div>

        {/* Spacious Table (py-3.5) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                <th className="px-5 py-3.5">Thời gian</th>
                <th className="px-5 py-3.5">Sự kiện</th>
                <th className="px-5 py-3.5">Intent / Chi tiết</th>
                <th className="px-5 py-3.5">Sản phẩm & Gói</th>
                <th className="px-5 py-3.5 text-right">Chi tiết Session</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {paginatedEvents.map((ev, idx) => {
                const badge = getEventBadge(ev.eventType);
                const prodName = resolveProductName(ev.productId);
                const planInfo = resolvePlanDetails(ev.planId);
                const userQuery = (ev.metadata as any)?.query;

                return (
                  <tr
                    key={idx}
                    onClick={() => ev.sessionId && onOpenSession(ev.sessionId)}
                    className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                      {ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString('vi-VN') : '-'}
                    </td>

                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      {userQuery ? (
                        <span className="font-medium text-slate-800 dark:text-white block max-w-sm truncate">
                          "{userQuery}"
                        </span>
                      ) : ev.intent ? (
                        <span className="font-mono text-blue-400 font-bold">{ev.intent}</span>
                      ) : ev.reason ? (
                        <span className="text-amber-400 font-mono text-[11px]">{ev.reason}</span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      {ev.productId ? (
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {prodName}
                          </span>
                          {planInfo && (
                            <span className="text-[10px] text-purple-400 font-mono">
                              {planInfo.duration || planInfo.name}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      {ev.sessionId ? (
                        <span className="text-blue-400 group-hover:text-blue-300 font-mono text-[11px] underline">
                          Tua lại timeline &rarr;
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {paginatedEvents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                    Không có sự kiện nào trong bộ lọc này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalEventPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-slate-950/30 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>
              Trang <strong>{eventPage}</strong> / {totalEventPages} (Tổng {filteredEvents.length} sự kiện)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setEventPage((p) => Math.max(1, p - 1))}
                disabled={eventPage === 1}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs transition font-semibold"
              >
                Trước
              </button>
              <button
                onClick={() => setEventPage((p) => Math.min(totalEventPages, p + 1))}
                disabled={eventPage === totalEventPages}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs transition font-semibold"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
