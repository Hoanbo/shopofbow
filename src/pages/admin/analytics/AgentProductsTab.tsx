// src/pages/admin/analytics/AgentProductsTab.tsx
import React, { useState, useMemo } from 'react';
import { SearchIcon, AppIcon, CloseIcon } from '../../../components/icons';
import type { DashboardStats, ProductRecord, CategoryRecord } from './types';
import { CustomAnalyticsSelect } from './CustomAnalyticsSelect';

interface AgentProductsTabProps {
  stats: DashboardStats | null;
  products: ProductRecord[];
  categories: CategoryRecord[];
  formatCurrency: (amount?: number | null) => string;
}

export const AgentProductsTab: React.FC<AgentProductsTabProps> = ({
  stats,
  products,
  categories,
  formatCurrency,
}) => {
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productSortBy, setProductSortBy] = useState<'resolved' | 'clicked' | 'checkout' | 'conversion' | 'name'>('resolved');
  const [productPage, setProductPage] = useState(1);
  const PRODUCTS_PER_PAGE = 8;

  const [planPage, setPlanPage] = useState(1);
  const PLANS_PER_PAGE = 6;

  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null);

  // Performance mapping
  const productPerformanceList = useMemo(() => {
    const topProdMap = new Map<string, { resolved: number; clicked: number; checkout_success: number }>();
    (stats?.top_products || []).forEach((p) => {
      topProdMap.set(p.product_id, {
        resolved: p.resolved_count || 0,
        clicked: p.clicked_count || 0,
        checkout_success: p.checkout_success_count || 0,
      });
    });

    let list = products.map((prod) => {
      const perf = topProdMap.get(prod.id) || { resolved: 0, clicked: 0, checkout_success: 0 };
      const catName = prod.categories?.name || 'Chưa phân loại';
      const conversion = perf.resolved > 0 ? (perf.checkout_success / perf.resolved) * 100 : 0;

      return {
        product: prod,
        categoryName: catName,
        resolved: perf.resolved,
        clicked: perf.clicked,
        checkout_success: perf.checkout_success,
        conversion,
      };
    });

    if (productCategoryFilter !== 'all') {
      list = list.filter((item) => item.product.category_id === productCategoryFilter);
    }

    if (productSearchQuery.trim()) {
      const q = productSearchQuery.toLowerCase();
      list = list.filter(
        (item) => item.product.name.toLowerCase().includes(q) || item.categoryName.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (productSortBy === 'resolved') return b.resolved - a.resolved;
      if (productSortBy === 'clicked') return b.clicked - a.clicked;
      if (productSortBy === 'checkout') return b.checkout_success - a.checkout_success;
      if (productSortBy === 'conversion') return b.conversion - a.conversion;
      if (productSortBy === 'name') return a.product.name.localeCompare(b.product.name);
      return 0;
    });

    return list;
  }, [products, stats?.top_products, productCategoryFilter, productSearchQuery, productSortBy]);

  const totalProductPages = Math.max(1, Math.ceil(productPerformanceList.length / PRODUCTS_PER_PAGE));
  const paginatedProducts = useMemo(() => {
    const start = (productPage - 1) * PRODUCTS_PER_PAGE;
    return productPerformanceList.slice(start, start + PRODUCTS_PER_PAGE);
  }, [productPerformanceList, productPage]);

  // Top plans list
  const topPlansList = stats?.top_plans || [];
  const totalPlanPages = Math.max(1, Math.ceil(topPlansList.length / PLANS_PER_PAGE));
  const paginatedPlans = useMemo(() => {
    const start = (planPage - 1) * PLANS_PER_PAGE;
    return topPlansList.slice(start, start + PLANS_PER_PAGE);
  }, [topPlansList, planPage]);

  const resolveProductName = (productId?: string) => {
    if (!productId) return '-';
    const found = products.find((p) => p.id === productId);
    return found ? found.name : `SP (${productId.slice(0, 8)}...)`;
  };

  return (
    <div className="space-y-6">
      {/* PRODUCT PERFORMANCE TABLE */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl overflow-hidden">
        {/* Table Header & Controls */}
        <div className="p-5 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AppIcon className="w-5 h-5 text-blue-400" />
              Hiệu suất Sản phẩm trong Catalog
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Thống kê {productPerformanceList.length} sản phẩm theo lượt hỏi và tỷ lệ mua hàng
            </p>
          </div>

          {/* Search, Filter, Sort */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px]">
              <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={productSearchQuery}
                onChange={(e) => {
                  setProductSearchQuery(e.target.value);
                  setProductPage(1);
                }}
                placeholder="Tìm tên sản phẩm..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <CustomAnalyticsSelect
              value={productCategoryFilter}
              onChange={(val) => {
                setProductCategoryFilter(val);
                setProductPage(1);
              }}
              minWidth="min-w-[160px]"
              options={[
                { value: 'all', label: 'Tất cả danh mục' },
                ...categories.map((c) => ({ value: c.id, label: c.name, icon: c.icon })),
              ]}
            />

            <CustomAnalyticsSelect
              value={productSortBy}
              onChange={(val) => setProductSortBy(val as any)}
              minWidth="min-w-[170px]"
              options={[
                { value: 'resolved', label: 'Lượt hỏi nhiều nhất' },
                { value: 'clicked', label: 'Click mua nhiều nhất' },
                { value: 'checkout', label: 'Mua thành công cao nhất' },
                { value: 'conversion', label: 'Tỷ lệ chuyển đổi (%)' },
                { value: 'name', label: 'Tên A → Z' },
              ]}
            />
          </div>
        </div>

        {/* Spacious Table (py-3.5) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-slate-950/40 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                <th className="px-5 py-3.5">Sản phẩm</th>
                <th className="px-5 py-3.5">Danh mục</th>
                <th className="px-5 py-3.5 text-center">Lượt hỏi (Resolved)</th>
                <th className="px-5 py-3.5 text-center">Click Action</th>
                <th className="px-5 py-3.5 text-right">Mua thành công</th>
                <th className="px-5 py-3.5 text-right">Chuyển đổi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {paginatedProducts.map((item) => (
                <tr
                  key={item.product.id}
                  onClick={() => setSelectedProduct(item.product)}
                  className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] cursor-pointer transition-colors group"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center font-bold text-blue-400 group-hover:scale-105 transition-transform">
                        {item.product.name.charAt(0)}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {item.product.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {item.product.slug} &bull; từ {formatCurrency(item.product.base_price)}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-3.5 text-slate-300">
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-300 text-[11px]">
                      {item.categoryName}
                    </span>
                  </td>

                  <td className="px-5 py-3.5 text-center">
                    <span className="font-bold text-slate-200">{item.resolved}</span>
                  </td>

                  <td className="px-5 py-3.5 text-center">
                    <span className="font-bold text-fuchsia-400">{item.clicked}</span>
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    <span className="font-bold text-emerald-400">{item.checkout_success}</span>
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {item.conversion.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}

              {paginatedProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    Không tìm thấy sản phẩm nào phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalProductPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-slate-950/30 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>
              Trang <strong>{productPage}</strong> / {totalProductPages} (Tổng {productPerformanceList.length} SP)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                disabled={productPage === 1}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs transition font-semibold"
              >
                Trước
              </button>
              <button
                onClick={() => setProductPage((p) => Math.min(totalProductPages, p + 1))}
                disabled={productPage === totalProductPages}
                className="px-3 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs transition font-semibold"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TOP PLANS SUB-CARD */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Top Gói Cước (Plans) Được Mua Nhiều Nhất</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Chi tiết phân giải và thanh toán theo từng thời hạn</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {paginatedPlans.map((pl, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-white/5 space-y-2">
              <div className="flex justify-between items-start">
                <span className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[180px]">
                  {resolveProductName(pl.product_id)}
                </span>
                <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                  Gói #{idx + 1}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-white/5 text-center text-xs">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Được hỏi</p>
                  <p className="font-bold text-slate-300 mt-0.5">{pl.resolved_count}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Click mua</p>
                  <p className="font-bold text-fuchsia-400 mt-0.5">{pl.clicked_count}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Mua xong</p>
                  <p className="font-bold text-emerald-400 mt-0.5">{pl.checkout_success_count}</p>
                </div>
              </div>
            </div>
          ))}

          {paginatedPlans.length === 0 && (
            <p className="text-xs text-slate-500 col-span-3 py-6 text-center">Chưa có dữ liệu gói cước nào.</p>
          )}
        </div>

        {totalPlanPages > 1 && (
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex justify-end gap-2 text-xs">
            <button
              onClick={() => setPlanPage((p) => Math.max(1, p - 1))}
              disabled={planPage === 1}
              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 disabled:opacity-30"
            >
              Trước
            </button>
            <button
              onClick={() => setPlanPage((p) => Math.min(totalPlanPages, p + 1))}
              disabled={planPage === totalPlanPages}
              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 disabled:opacity-30"
            >
              Sau
            </button>
          </div>
        )}
      </div>

      {/* PRODUCT DETAIL MODAL */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-950 w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-900/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedProduct.name}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">slug: {selectedProduct.slug}</p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <h4 className="font-bold text-white uppercase text-[11px] tracking-wider text-slate-400">
                Các gói cước đang cấu hình trong Database ({selectedProduct.product_plans?.length || 0})
              </h4>

              <div className="space-y-2">
                {(selectedProduct.product_plans || []).map((pl) => (
                  <div
                    key={pl.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-white">{pl.name}</span>
                      <span className="text-slate-400 ml-2">({pl.duration})</span>
                      {pl.is_highlight && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
                          Nổi bật
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {formatCurrency(pl.price)}
                    </span>
                  </div>
                ))}

                {(!selectedProduct.product_plans || selectedProduct.product_plans.length === 0) && (
                  <p className="text-slate-500 py-6 text-center">Sản phẩm này chưa có gói cước nào.</p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-900/50 flex justify-end">
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
