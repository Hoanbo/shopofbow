// src/pages/admin/analytics/AgentDemandTab.tsx
import React, { useState, useMemo } from 'react';
import { SearchIcon } from '../../../components/icons';
import type { AgentAnalyticsEvent } from '../../../services/agent/monitoring/analyticsTypes';
import {
  aggregateDemandEvents,
  filterAndPaginateDemands,
  type DomainCategory,
  type DemandState,
  type DemandAggregate,
} from '../../../services/agent/monitoring/demandAggregator';
import { useNavigate } from 'react-router-dom';
import { CustomAnalyticsSelect } from './CustomAnalyticsSelect';

interface AgentDemandTabProps {
  recentEvents: AgentAnalyticsEvent[];
  dateBounds: { start: string | null; end: string | null };
}

export const AgentDemandTab: React.FC<AgentDemandTabProps> = ({
  recentEvents,
  dateBounds,
}) => {
  const navigate = useNavigate();

  const [demandSearchQuery, setDemandSearchQuery] = useState('');
  const [demandStateFilter, setDemandStateFilter] = useState<'all' | DemandState>('all');
  const [demandDomainFilter, setDemandDomainFilter] = useState<'all' | DomainCategory>('all');
  const [demandSortBy, setDemandSortBy] = useState<'priority' | 'requests' | 'users' | 'growth' | 'latest'>('priority');
  const [demandPage, setDemandPage] = useState(1);
  const [demandQueryPage, setDemandQueryPage] = useState(1);
  const DEMAND_QUERIES_PER_PAGE = 6;

  // Aggregate demands
  const demandSummary = useMemo(() => {
    const start = dateBounds.start ? new Date(dateBounds.start) : null;
    const end = dateBounds.end ? new Date(dateBounds.end) : null;
    return aggregateDemandEvents(recentEvents, { start, end });
  }, [recentEvents, dateBounds]);

  const paginatedDemandsResult = useMemo(() => {
    return filterAndPaginateDemands(demandSummary.allDemands, {
      searchQuery: demandSearchQuery,
      stateFilter: demandStateFilter,
      domainFilter: demandDomainFilter,
      sortBy: demandSortBy,
      page: demandPage,
      perPage: 8,
    });
  }, [demandSummary.allDemands, demandSearchQuery, demandStateFilter, demandDomainFilter, demandSortBy, demandPage]);

  const totalDemandQueryPages = Math.max(1, Math.ceil(demandSummary.recentQueries.length / DEMAND_QUERIES_PER_PAGE));
  const paginatedDemandQueries = useMemo(() => {
    const start = (demandQueryPage - 1) * DEMAND_QUERIES_PER_PAGE;
    return demandSummary.recentQueries.slice(start, start + DEMAND_QUERIES_PER_PAGE);
  }, [demandSummary.recentQueries, demandQueryPage]);

  const getDemandStateBadge = (state: DemandState) => {
    switch (state) {
      case 'SUPPORTED':
        return { label: 'Có sẵn hàng', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'NEAR_MATCH':
        return { label: 'Tương đương', cls: 'bg-sky-500/10 text-sky-400 border-sky-500/20' };
      case 'UNSUPPORTED':
        return { label: 'Chưa bán (Cơ hội)', cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20 font-bold' };
      case 'AMBIGUOUS':
        return { label: 'Chưa rõ ý', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    }
  };

  const handleAddProduct = (capability: string) => {
    navigate(`/admin/products?new=${encodeURIComponent(capability)}`);
  };

  const unsupportedCount = demandSummary.stateDistribution.find((s) => s.state === 'UNSUPPORTED')?.count || 0;
  const nearMatchCount = demandSummary.stateDistribution.find((s) => s.state === 'NEAR_MATCH')?.count || 0;
  const supportedCount = demandSummary.stateDistribution.find((s) => s.state === 'SUPPORTED')?.count || 0;

  return (
    <div className="space-y-6">
      {/* HERO BANNER: BUSINESS OPPORTUNITY */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-slate-900/60 backdrop-blur-md border border-purple-500/20 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">🚀</span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Cơ Hội Kinh Doanh Mới (Catalog Demand Gaps)
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
              {demandSummary.topUnmetDemands.length} Sản phẩm tiềm năng
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl">
            Các sản phẩm & công cụ khách hàng hỏi mua trực tiếp với AI nhưng shop chưa nhập kho.
            Bổ sung ngay để tối ưu doanh số và mở rộng tệp khách hàng!
          </p>
        </div>

        {demandSummary.topUnmetDemands.length > 0 && (
          <button
            onClick={() => handleAddProduct(demandSummary.topUnmetDemands[0].capability)}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition shrink-0 flex items-center gap-1.5"
          >
            <span>+ Nhập ngay "{demandSummary.topUnmetDemands[0].capability}"</span>
          </button>
        )}
      </div>

      {/* 4 SUMMARY STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl">
          <p className="text-[10px] uppercase font-bold text-slate-400">Tổng nhu cầu phát hiện</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{demandSummary.totalDemandRequests}</p>
          <p className="text-[11px] text-slate-500 mt-1">{demandSummary.allDemands.length} cụm tính năng</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl">
          <p className="text-[10px] uppercase font-bold text-purple-400">Chưa kinh doanh (Gaps)</p>
          <p className="text-2xl font-black text-purple-400 mt-1">{demandSummary.unmetDemandRequests}</p>
          <p className="text-[11px] text-slate-500 mt-1">{unsupportedCount} lượt hỏi thiếu hàng</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl">
          <p className="text-[10px] uppercase font-bold text-sky-400">Gợi ý tương đương</p>
          <p className="text-2xl font-black text-sky-400 mt-1">{nearMatchCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Đã điều hướng sang SP có sẵn</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl">
          <p className="text-[10px] uppercase font-bold text-emerald-400">Đã đáp ứng (In Catalog)</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{supportedCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Khớp chính xác sản phẩm</p>
        </div>
      </div>

      {/* DEMAND TABLE */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>💡</span> Danh sách Khám phá Nhu cầu & Cơ hội Kinh doanh
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Phân tích các yêu cầu tìm kiếm chưa được phục vụ để lên kế hoạch nhập hàng
            </p>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px]">
              <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={demandSearchQuery}
                onChange={(e) => {
                  setDemandSearchQuery(e.target.value);
                  setDemandPage(1);
                }}
                placeholder="Tìm nhu cầu, tool..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
              />
            </div>

            <CustomAnalyticsSelect
              value={demandStateFilter}
              onChange={(val) => {
                setDemandStateFilter(val as any);
                setDemandPage(1);
              }}
              minWidth="min-w-[160px]"
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'UNSUPPORTED', label: 'Chưa bán (Cơ hội mới)' },
                { value: 'NEAR_MATCH', label: 'Có gợi ý tương đương' },
                { value: 'SUPPORTED', label: 'Đã có hàng' },
                { value: 'AMBIGUOUS', label: 'Chưa rõ ý' },
              ]}
            />

            <CustomAnalyticsSelect
              value={demandDomainFilter}
              onChange={(val) => {
                setDemandDomainFilter(val as any);
                setDemandPage(1);
              }}
              minWidth="min-w-[150px]"
              options={[
                { value: 'all', label: 'Tất cả phân loại' },
                { value: 'video', label: 'Video & Clip' },
                { value: 'audio', label: 'Âm thanh & Voice' },
                { value: 'image', label: 'Hình ảnh & Vẽ' },
                { value: 'design', label: 'Thiết kế & UI' },
                { value: 'coding', label: 'Lập trình & Dev' },
                { value: 'productivity', label: 'Văn phòng & Làm việc' },
                { value: 'entertainment', label: 'Giải trí & Phim ảnh' },
                { value: 'education', label: 'Học tập & Giáo dục' },
              ]}
            />

            <CustomAnalyticsSelect
              value={demandSortBy}
              onChange={(val) => {
                setDemandSortBy(val as any);
                setDemandPage(1);
              }}
              minWidth="min-w-[160px]"
              options={[
                { value: 'priority', label: 'Ưu tiên cao nhất' },
                { value: 'requests', label: 'Lượt hỏi nhiều nhất' },
                { value: 'users', label: 'Nhiều khách hỏi nhất' },
                { value: 'growth', label: 'Tăng trưởng nhanh nhất' },
                { value: 'latest', label: 'Mới nhất' },
              ]}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                <th className="px-5 py-3.5">Nhu cầu / Sản phẩm yêu cầu</th>
                <th className="px-5 py-3.5">Trạng thái Catalog</th>
                <th className="px-5 py-3.5">Lĩnh vực</th>
                <th className="px-5 py-3.5 text-center">Lượt hỏi</th>
                <th className="px-5 py-3.5 text-center">Số khách</th>
                <th className="px-5 py-3.5 text-right">Hành động đề xuất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {paginatedDemandsResult.items.map((item: DemandAggregate, idx: number) => {
                const badge = getDemandStateBadge(item.dominantState);
                return (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-900 dark:text-white block capitalize">
                          {item.capability.replace(/-/g, ' ')}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          code: {item.capability}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 text-[11px] text-slate-700 dark:text-slate-300 capitalize">
                        {item.domainCategory}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-center font-bold text-slate-900 dark:text-white">
                      {item.totalRequests}
                    </td>

                    <td className="px-5 py-3.5 text-center text-slate-400">
                      {item.uniqueUsers}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      {item.dominantState === 'UNSUPPORTED' || item.stateBreakdown.UNSUPPORTED > 0 ? (
                        <button
                          onClick={() => handleAddProduct(item.capability)}
                          className="px-3 py-1 text-[11px] font-bold rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition"
                        >
                          + Thêm vào Catalog
                        </button>
                      ) : item.dominantState === 'NEAR_MATCH' ? (
                        <span className="text-[11px] text-sky-400 font-medium">Đã có tương đương</span>
                      ) : (
                        <span className="text-[11px] text-emerald-400 font-medium">Đang kinh doanh</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {paginatedDemandsResult.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    Không tìm thấy nhu cầu nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {paginatedDemandsResult.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-slate-950/30 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>
              Trang <strong>{demandPage}</strong> / {paginatedDemandsResult.totalPages} (Tổng {paginatedDemandsResult.total} mục)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setDemandPage((p) => Math.max(1, p - 1))}
                disabled={demandPage === 1}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs transition font-semibold"
              >
                Trước
              </button>
              <button
                onClick={() => setDemandPage((p) => Math.min(paginatedDemandsResult.totalPages, p + 1))}
                disabled={demandPage === paginatedDemandsResult.totalPages}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs transition font-semibold"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RECENT USER QUERIES LOG */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl p-5">
        <div className="mb-4">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Câu Hỏi Thực Tế Khách Vừa Tìm Kiếm</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Nhật ký truy vấn thô từ khách hàng giúp thấu hiểu ý định gốc</p>
        </div>

        <div className="space-y-2">
          {paginatedDemandQueries.map((q, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/5 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="text-slate-500 font-mono text-[10px]">#{idx + 1}</span>
                <span className="font-medium text-slate-200">"{q.query}"</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(q.timestamp).toLocaleTimeString('vi-VN')}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] border ${getDemandStateBadge(q.state).cls}`}>
                  {getDemandStateBadge(q.state).label}
                </span>
              </div>
            </div>
          ))}

          {paginatedDemandQueries.length === 0 && (
            <p className="text-xs text-slate-500 py-6 text-center">Chưa có câu hỏi nào được ghi nhận.</p>
          )}
        </div>

        {totalDemandQueryPages > 1 && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex justify-end gap-2 text-xs">
            <button
              onClick={() => setDemandQueryPage((p) => Math.max(1, p - 1))}
              disabled={demandQueryPage === 1}
              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 disabled:opacity-30"
            >
              Trước
            </button>
            <button
              onClick={() => setDemandQueryPage((p) => Math.min(totalDemandQueryPages, p + 1))}
              disabled={demandQueryPage === totalDemandQueryPages}
              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 disabled:opacity-30"
            >
              Sau
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
