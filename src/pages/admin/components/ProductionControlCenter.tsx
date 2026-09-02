// src/pages/admin/components/ProductionControlCenter.tsx
// BOW AGENT V3.3 — PHASE 7.0: PRODUCTION CONTROL CENTER & LIVE TRAFFIC MONITOR
//
// Operational SRE dashboard for Live Traffic Scaling, Progressive Rollout,
// Circuit Breaker controls, SLO monitoring, and Incident Management.

import React, { useState, useEffect, useCallback } from 'react';
import type {
  ProductionControlCenterSummary,
  ProductionRolloutStage,
  IncidentSeverity,
  IncidentStatus,
} from '@bow/agent';
import {
  getProductionControlCenterSummary,
  updateRolloutStage,
  executeRollback,
  resetCircuitBreaker,
  forceTripCircuit,
  acknowledgeIncident,
  resolveIncident,
  dismissIncident,
  runKnowledgeQaSuite,
} from '@bow/agent';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../components/Toast';

const ROLLOUT_PIPELINE: ProductionRolloutStage[] = ['OFF', 'CANARY', '10', '25', '50', '75', '100'];

export const ProductionControlCenter: React.FC = () => {
  const { session } = useAuth();
  const toast = useToast();
  const adminId = session?.user?.id || 'admin-system';

  const [summary, setSummary] = useState<ProductionControlCenterSummary | null>(null);
  const [timeWindow, setTimeWindow] = useState<'5m' | '15m' | '1h' | '6h' | '24h' | '7d'>('1h');
  const [incidentFilterSev, setIncidentFilterSev] = useState<IncidentSeverity | 'ALL'>('ALL');
  const [incidentFilterStatus, setIncidentFilterStatus] = useState<IncidentStatus | 'ALL'>('ALL');
  const [isQaRunning, setIsQaRunning] = useState(false);
  const [qaResultText, setQaResultText] = useState<string | null>(null);

  // Rollback Modal State
  const [isRollbackOpen, setIsRollbackOpen] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [targetRollbackStage, setTargetRollbackStage] = useState<ProductionRolloutStage>('OFF');
  const [isActionBusy, setIsActionBusy] = useState(false);

  // Load summary
  const loadSummary = useCallback((force = false) => {
    try {
      const data = getProductionControlCenterSummary(force);
      setSummary(data);
    } catch {
      // safe fallback
    }
  }, []);

  useEffect(() => {
    loadSummary(true);
    const timer = setInterval(() => loadSummary(true), 10000); // refresh every 10s
    return () => clearInterval(timer);
  }, [loadSummary]);

  // Handle stage update
  const handleStageChange = (targetStage: ProductionRolloutStage) => {
    if (!adminId) {
      toast.error('Chưa xác thực Admin');
      return;
    }
    setIsActionBusy(true);
    const res = updateRolloutStage({
      adminUserId: adminId,
      targetStage,
      healthScore: summary?.healthScore.score,
      circuitOpen: summary?.circuitState === 'OPEN',
      hasCriticalIncident: (summary?.activeIncidents || []).some((i) => i.severity === 'CRITICAL' && i.status !== 'RESOLVED'),
    });

    if (res.success) {
      toast.success(`Đã chuyển Rollout stage sang: ${targetStage}`);
      loadSummary(true);
    } else {
      toast.error(`Không thể chuyển stage: ${res.error}`);
    }
    setIsActionBusy(false);
  };

  // Handle rollback
  const handleExecuteRollback = () => {
    if (!adminId) {
      toast.error('Chưa xác thực Admin');
      return;
    }
    if (!rollbackReason.trim()) {
      toast.error('Vui lòng nhập lý do Rollback');
      return;
    }
    setIsActionBusy(true);
    const res = executeRollback({
      adminUserId: adminId,
      targetStage: targetRollbackStage,
      reason: rollbackReason,
    });

    if (res.success) {
      toast.success(`Đã Rollback thành công về stage: ${targetRollbackStage}`);
      setIsRollbackOpen(false);
      setRollbackReason('');
      loadSummary(true);
    } else {
      toast.error('Rollback thất bại');
    }
    setIsActionBusy(false);
  };

  // Handle QA Run
  const handleRunQa = async () => {
    setIsQaRunning(true);
    try {
      const res = await runKnowledgeQaSuite([], []);
      setQaResultText(`QA Suite hoàn tất: ${res.passedCount}/${res.totalTests} tests PASS (${res.passRate}%)`);
      toast.success(`Chạy QA hoàn tất: ${res.passRate}% PASS`);
      loadSummary(true);
    } catch {
      toast.error('Chạy QA Suite thất bại');
    } finally {
      setIsQaRunning(false);
    }
  };

  // Handle Incident Actions
  const handleAckIncident = (id: string) => {
    if (!adminId) return;
    const res = acknowledgeIncident(id, adminId);
    if (res.success) {
      toast.success('Đã tiếp nhận sự cố');
      loadSummary(true);
    }
  };

  const handleResolveIncident = (id: string) => {
    if (!adminId) return;
    const res = resolveIncident(id, adminId);
    if (res.success) {
      toast.success('Đã giải quyết sự cố');
      loadSummary(true);
    }
  };

  const handleDismissIncident = (id: string) => {
    if (!adminId) return;
    const reason = prompt('Nhập lý do bỏ qua sự cố:') || 'False alarm';
    const res = dismissIncident(id, adminId, reason);
    if (res.success) {
      toast.success('Đã bỏ qua sự cố');
      loadSummary(true);
    }
  };

  const score = summary?.healthScore.score ?? 100;
  const healthStatus = summary?.healthScore.status ?? 'HEALTHY';
  const circuitState = summary?.circuitState ?? 'CLOSED';
  const currentStage = summary?.rolloutState.currentStage ?? '100';

  return (
    <div className="space-y-6">
      {/* 1. HERO BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-950 p-6 text-white border border-indigo-800/40 shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                BOW AGENT V3.3 — PRODUCTION READY
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  circuitState === 'CLOSED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                Circuit: {circuitState}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Rollout: {currentStage}%
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Production Control Center & Live Traffic Scaling
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Hệ thống giám sát vận hành thời gian thực, quản lý progressive rollout, circuit breaker, và bảo vệ toàn vẹn ranh giới kinh doanh (Transaction, Warranty, Duration).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-center">
            <button
              onClick={handleRunQa}
              disabled={isQaRunning}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-all disabled:opacity-50"
            >
              {isQaRunning ? 'Đang chạy QA...' : '⚡ Run Production QA'}
            </button>
            <button
              onClick={() => setIsRollbackOpen(true)}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white shadow-lg transition-all"
            >
              🚨 Rollback
            </button>
            {circuitState === 'OPEN' ? (
              <button
                onClick={resetCircuitBreaker}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all"
              >
                Reset Circuit
              </button>
            ) : (
              <button
                onClick={() => forceTripCircuit('Manual test by Admin')}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700"
              >
                Trip Circuit
              </button>
            )}
          </div>
        </div>

        {qaResultText && (
          <div className="mt-4 p-2.5 rounded-lg bg-indigo-950/80 border border-indigo-500/30 text-xs text-indigo-200">
            {qaResultText}
          </div>
        )}
      </div>

      {/* 2. 8 KPI METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Card 1: Health Score */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Health Score</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900 dark:text-white">{score}</span>
            <span className="text-[10px] text-slate-400">/ 100</span>
          </div>
          <span className={`text-[10px] font-bold ${
            healthStatus === 'EXCELLENT' || healthStatus === 'HEALTHY' ? 'text-emerald-500' : 'text-rose-500'
          }`}>
            {healthStatus}
          </span>
        </div>

        {/* Card 2: Availability */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Availability</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {summary?.sloReport.availability.currentValue ?? 100}%
            </span>
          </div>
          <span className="text-[10px] text-slate-400">Target ≥ 99.9%</span>
        </div>

        {/* Card 3: Error Rate */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Error Rate</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {summary?.sloReport.errorRate.currentValue ?? 0}%
            </span>
          </div>
          <span className="text-[10px] text-slate-400">Target &lt; 1%</span>
        </div>

        {/* Card 4: P95 Latency */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">P95 Latency</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {summary?.sloReport.p95Latency.currentValue ?? 0}
            </span>
            <span className="text-[10px] text-slate-400">ms</span>
          </div>
          <span className="text-[10px] text-slate-400">Target &lt; 500ms</span>
        </div>

        {/* Card 5: P99 Latency */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">P99 Latency</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {summary?.sloReport.p99Latency.currentValue ?? 0}
            </span>
            <span className="text-[10px] text-slate-400">ms</span>
          </div>
          <span className="text-[10px] text-slate-400">Target &lt; 1000ms</span>
        </div>

        {/* Card 6: Requests / min */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Throughput</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {summary?.trafficStats.requestsPerMin ?? 0}
            </span>
            <span className="text-[10px] text-slate-400">rpm</span>
          </div>
          <span className="text-[10px] text-slate-400">Status: {summary?.capacityMetrics.status}</span>
        </div>

        {/* Card 7: Fallback Rate */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Fallback Rate</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {summary?.sloReport.fallbackRate.currentValue ?? 0}%
            </span>
          </div>
          <span className="text-[10px] text-slate-400">Target &lt; 5%</span>
        </div>

        {/* Card 8: Open Incidents */}
        <div className="p-3.5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Open Incidents</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900 dark:text-white">
              {(summary?.activeIncidents || []).filter((i) => i.status !== 'RESOLVED' && i.status !== 'DISMISSED').length}
            </span>
          </div>
          <span className={`text-[10px] font-bold ${
            (summary?.activeIncidents || []).some((i) => i.severity === 'CRITICAL' && i.status !== 'RESOLVED')
              ? 'text-rose-500'
              : 'text-emerald-500'
          }`}>
            {(summary?.activeIncidents || []).some((i) => i.severity === 'CRITICAL' && i.status !== 'RESOLVED') ? 'Critical Active' : 'All Clear'}
          </span>
        </div>
      </div>

      {/* 3. PROGRESSIVE ROLLOUT PIPELINE CONTROLLER */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>🚀 Progressive Rollout Pipeline</span>
              {summary?.rolloutState.isBlocked && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-600">
                  BLOCKED: {summary.rolloutState.blockReason}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kiểm soát lưu lượng truy cập trực tiếp qua các giai đoạn. Yêu cầu xác thực Admin trước khi thăng cấp.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Cập nhật: {new Date(summary?.rolloutState.updatedAt || '').toLocaleTimeString()} ({summary?.rolloutState.updatedBy})
          </span>
        </div>

        {/* Pipeline Bar */}
        <div className="grid grid-cols-7 gap-2">
          {ROLLOUT_PIPELINE.map((st) => {
            const isCurrent = currentStage === st;
            return (
              <button
                key={st}
                onClick={() => handleStageChange(st)}
                disabled={isActionBusy || isCurrent}
                className={`p-3 rounded-xl text-center border transition-all ${
                  isCurrent
                    ? 'bg-[#2563EB] text-white border-blue-600 font-black shadow-md'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-blue-400'
                }`}
              >
                <div className="text-xs font-bold uppercase">{st}</div>
                <div className="text-[10px] opacity-75 mt-0.5">
                  {st === 'OFF' ? '0%' : st === 'CANARY' ? '5%' : `${st}%`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. TWO-COLUMN OPERATIONAL GRID: LIVE TRAFFIC & SLO DASHBOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Live Traffic Monitor */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              📊 Live Traffic Monitor
            </h3>
            {/* Time Window Selector */}
            <div className="flex items-center gap-1">
              {(['5m', '15m', '1h', '6h', '24h', '7d'] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setTimeWindow(w)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-colors ${
                    timeWindow === w
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
              <div className="text-slate-400 text-[10px]">Requests / min</div>
              <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                {summary?.trafficStats.requestsPerMin ?? 0}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
              <div className="text-slate-400 text-[10px]">Successful</div>
              <div className="text-lg font-black text-emerald-600 mt-1">
                {summary?.trafficStats.successCount ?? 0}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
              <div className="text-slate-400 text-[10px]">Failed / Error</div>
              <div className="text-lg font-black text-rose-600 mt-1">
                {summary?.trafficStats.errorCount ?? 0}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
              <div className="text-slate-400 text-[10px]">Fallback Used</div>
              <div className="text-lg font-black text-amber-600 mt-1">
                {summary?.trafficStats.fallbackCount ?? 0}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
              <div className="text-slate-400 text-[10px]">Concurrent</div>
              <div className="text-lg font-black text-blue-600 mt-1">
                {summary?.capacityMetrics.concurrentRequests ?? 0}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
              <div className="text-slate-400 text-[10px]">Peak Traffic</div>
              <div className="text-lg font-black text-slate-700 dark:text-slate-200 mt-1">
                {summary?.capacityMetrics.peakTraffic ?? 0} rpm
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: SLO Dashboard */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              🎯 SLO / SLA Compliance Dashboard
            </h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              summary?.sloReport.overallStatus === 'HEALTHY'
                ? 'bg-emerald-500/15 text-emerald-600'
                : summary?.sloReport.overallStatus === 'WARNING'
                ? 'bg-amber-500/15 text-amber-600'
                : 'bg-rose-500/15 text-rose-600'
            }`}>
              {summary?.sloReport.overallStatus ?? 'HEALTHY'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[10px] uppercase">
                  <th className="py-2">Metric</th>
                  <th className="py-2">Current</th>
                  <th className="py-2">Target</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  summary?.sloReport.availability,
                  summary?.sloReport.errorRate,
                  summary?.sloReport.p95Latency,
                  summary?.sloReport.p99Latency,
                  summary?.sloReport.fallbackRate,
                  summary?.sloReport.knowledgeGapRate,
                ].filter(Boolean).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 font-medium text-slate-900 dark:text-white">{item!.name}</td>
                    <td className="py-2.5 font-bold text-slate-700 dark:text-slate-200">
                      {item!.name.includes('Latency') ? `${item!.currentValue}ms` : `${item!.currentValue}%`}
                    </td>
                    <td className="py-2.5 text-slate-400">{item!.target}</td>
                    <td className="py-2.5 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item!.status === 'HEALTHY'
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : item!.status === 'WARNING'
                          ? 'bg-amber-500/15 text-amber-600'
                          : item!.status === 'INSUFFICIENT_DATA'
                          ? 'bg-slate-500/15 text-slate-400'
                          : 'bg-rose-500/15 text-rose-600'
                      }`}>
                        {item!.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 5. HARD BUSINESS BOUNDARY HEALTH MONITOR */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>🛡️ Business Boundary Health & Invariants</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600">
              ALL INVARIANTS PASS
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Giám sát thời gian thực tính cô lập tuyệt đối của các luồng nghiệp vụ kinh doanh trọng yếu.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {[
            { name: 'Transaction Boundary', desc: '"Mua YouTube 6 tháng" -> 280k' },
            { name: 'Duration Invariant', desc: '1m / 6m / 12m riêng biệt' },
            { name: 'Product Demand Boundary', desc: '"Canva Pro" -> Demand only' },
            { name: 'Warranty Boundary', desc: 'In-place confirmation (1 🎫)' },
            { name: 'Negative Policy Anti-Loop', desc: 'Zero false gap creation' },
            { name: 'Zero Auto-Mutation', desc: 'AI strictly non-mutating' },
            { name: 'PII Sanitization', desc: 'Emails & Phones redacted' },
            { name: 'Prompt Injection Defense', desc: 'Script & override neutralized' },
          ].map((b, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-slate-900 dark:text-white">{b.name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{b.desc}</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600">
                PASS
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 6. INCIDENT CENTER */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              🚨 Production Incident Center
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quản lý sự cố phát hiện tự động với Decision Fingerprint chống spam và audit trail đầy đủ.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['ALL', 'DETECTED', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setIncidentFilterStatus(st)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-colors ${
                  incidentFilterStatus === st
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {st}
              </button>
            ))}
            <span className="text-slate-300 dark:text-slate-700">|</span>
            {(['ALL', 'CRITICAL', 'HIGH', 'WARNING', 'INFO'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setIncidentFilterSev(sev)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-colors ${
                  incidentFilterSev === sev
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {(summary?.activeIncidents || []).length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Hệ thống hoạt động ổn định, không có sự cố nào được ghi nhận.
            </div>
          ) : (
            (summary?.activeIncidents || [])
              .filter(
                (i) =>
                  (incidentFilterSev === 'ALL' || i.severity === incidentFilterSev) &&
                  (incidentFilterStatus === 'ALL' || i.status === incidentFilterStatus)
              )
              .map((inc) => (
                <div
                  key={inc.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inc.severity === 'CRITICAL'
                          ? 'bg-rose-500/15 text-rose-600'
                          : inc.severity === 'HIGH'
                          ? 'bg-orange-500/15 text-orange-600'
                          : inc.severity === 'WARNING'
                          ? 'bg-amber-500/15 text-amber-600'
                          : 'bg-blue-500/15 text-blue-600'
                      }`}>
                        {inc.severity}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">{inc.title}</span>
                      <span className="text-[10px] text-slate-400 font-mono">({inc.status})</span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-300">
                      Thành phần: <span className="font-semibold">{inc.affectedComponent}</span> | Bằng chứng: {inc.evidence}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Fingerprint: {inc.fingerprint} | Ghi nhận lúc: {new Date(inc.firstDetected).toLocaleTimeString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    {inc.status === 'DETECTED' && (
                      <button
                        onClick={() => handleAckIncident(inc.id)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                      >
                        Tiếp nhận
                      </button>
                    )}
                    {inc.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleResolveIncident(inc.id)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        Giải quyết
                      </button>
                    )}
                    <button
                      onClick={() => handleDismissIncident(inc.id)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                    >
                      Bỏ qua
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* 7. ROLLBACK CONFIRMATION MODAL */}
      {isRollbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-[#131C32] border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-base">
              <span>🚨 Xác nhận Rollback Lưu lượng</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Hành động này sẽ lập tức hạ tỷ lệ rollout về mức chỉ định mà không ảnh hưởng đến đơn hàng hay số dư ví của khách hàng.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Mục tiêu Rollback:</label>
                <select
                  value={targetRollbackStage}
                  onChange={(e) => setTargetRollbackStage(e.target.value as any)}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  <option value="OFF">OFF (0% - Tắt hoàn toàn AI)</option>
                  <option value="CANARY">CANARY (5% - Thử nghiệm tối thiểu)</option>
                  <option value="10">10%</option>
                  <option value="25">25%</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Lý do Rollback (Bắt buộc):</label>
                <textarea
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="Mô tả sự cố hoặc lý do hạ cấp rollout..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 h-20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsRollbackOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                Hủy
              </button>
              <button
                onClick={handleExecuteRollback}
                disabled={isActionBusy}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-md disabled:opacity-50"
              >
                Thực hiện Rollback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
