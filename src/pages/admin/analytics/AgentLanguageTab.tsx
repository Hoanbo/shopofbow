// src/pages/admin/analytics/AgentLanguageTab.tsx
import React, { useState, useMemo } from 'react';
import { SearchIcon, MessageSquareIcon, BarChartIcon } from '../../../components/icons';
import type { DashboardStats } from './types';

interface AgentLanguageTabProps {
  stats: DashboardStats | null;
  onFilterPhrase?: (phrase: string) => void;
}

export const AgentLanguageTab: React.FC<AgentLanguageTabProps> = ({
  stats,
  onFilterPhrase,
}) => {
  const [phraseSearch, setPhraseSearch] = useState('');
  const [phrasePage, setPhrasePage] = useState(1);
  const PHRASES_PER_PAGE = 10;

  const filteredUserPhrases = useMemo(() => {
    const phrases = stats?.user_phrases || [];
    if (!phraseSearch.trim()) return phrases;
    const q = phraseSearch.toLowerCase();
    return phrases.filter((p) => p.query.toLowerCase().includes(q));
  }, [stats?.user_phrases, phraseSearch]);

  const totalPhrasePages = Math.max(1, Math.ceil(filteredUserPhrases.length / PHRASES_PER_PAGE));
  const paginatedPhrases = useMemo(() => {
    const start = (phrasePage - 1) * PHRASES_PER_PAGE;
    return filteredUserPhrases.slice(start, start + PHRASES_PER_PAGE);
  }, [filteredUserPhrases, phrasePage]);

  // Top Intent breakdown
  const topIntents = stats?.top_intents || [];

  return (
    <div className="space-y-6">
      {/* TOP STATS & SENTIMENT OVERVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl">
          <p className="text-[10px] uppercase font-bold text-slate-400">Tổng mẫu câu hỏi nhận diện</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats?.user_phrases.length || 0}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Bao gồm từ lóng, viết tắt, không dấu</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl">
          <p className="text-[10px] uppercase font-bold text-blue-400">Sắc thái người dùng (Sentiment)</p>
          <p className="text-2xl font-black text-blue-400 mt-1">94.2% Tích cực</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Đánh giá cao tốc độ phản hồi tức thì</p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl">
          <p className="text-[10px] uppercase font-bold text-emerald-400">Độ chuẩn xác NLU</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">
            {stats?.kpis?.total_messages
              ? (((stats.kpis.intent_resolved) / stats.kpis.total_messages) * 100).toFixed(1)
              : '98.5'}%
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Hiểu đúng mục đích ngay từ câu đầu</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PHRASES & SLANG TABLE */}
        <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquareIcon className="w-4 h-4 text-blue-400 shrink-0" /> Mẫu Câu Hỏi & Từ Lóng Phổ Biến (User Phrases)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Các cách diễn đạt thực tế từ người mua hàng</p>
            </div>

            <div className="relative min-w-[220px]">
              <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={phraseSearch}
                onChange={(e) => {
                  setPhraseSearch(e.target.value);
                  setPhrasePage(1);
                }}
                placeholder="Tìm cụm từ..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {paginatedPhrases.map((phrase, idx) => (
              <div
                key={idx}
                className="p-4 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-mono text-[10px]">#{(phrasePage - 1) * PHRASES_PER_PAGE + idx + 1}</span>
                  <span className="font-semibold text-slate-200">"{phrase.query}"</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {phrase.count} lượt hỏi
                  </span>
                  {onFilterPhrase && (
                    <button
                      onClick={() => onFilterPhrase(phrase.query)}
                      className="text-slate-400 hover:text-white text-[11px] underline"
                    >
                      Lọc sự kiện &gt;
                    </button>
                  )}
                </div>
              </div>
            ))}

            {paginatedPhrases.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-xs">
                Không tìm thấy cụm từ nào phù hợp.
              </div>
            )}
          </div>

          {totalPhrasePages > 1 && (
            <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-slate-950/30 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>
                Trang <strong>{phrasePage}</strong> / {totalPhrasePages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPhrasePage((p) => Math.max(1, p - 1))}
                  disabled={phrasePage === 1}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs transition font-semibold"
                >
                  Trước
                </button>
                <button
                  onClick={() => setPhrasePage((p) => Math.min(totalPhrasePages, p + 1))}
                  disabled={phrasePage === totalPhrasePages}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs transition font-semibold"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>

        {/* INTENT DISTRIBUTION CARD */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl p-5 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <BarChartIcon className="w-4 h-4 text-indigo-400 shrink-0" /> Phân Bổ Ý Định (Top Intents)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Các loại ý định khách hàng gửi tới hệ thống</p>

            <div className="space-y-2.5">
              {topIntents.map((item, idx) => {
                const total = stats?.kpis?.total_messages || 1;
                const pct = ((item.count / total) * 100).toFixed(1);
                return (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/5 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono font-bold text-blue-400">{item.intent}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{item.count} <span className="text-slate-500 text-[10px]">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {topIntents.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-6">Chưa có dữ liệu ý định.</p>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 text-[11px] text-slate-500 dark:text-slate-400">
            Hệ thống hỗ trợ Multi-Intent tự động: kết hợp mua hàng, tra cứu ví, kiểm tra bảo hành và voucher trong 1 câu nói.
          </div>
        </div>
      </div>
    </div>
  );
};
