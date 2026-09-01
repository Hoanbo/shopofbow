// src/pages/admin/KnowledgeHub.tsx
// BOW Agent V3.3 Phase 6.7 — Knowledge Operations & Quality Control Dashboard (Enterprise Refactored)

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { supabase } from '../../lib/supabase';
import {
  getKnowledgeGaps,
  markKnowledgeGapReviewing,
  rejectKnowledgeGap,
  approveKnowledgeGap,
  generateKnowledgeSuggestion,
  findSimilarFaqs,
  smartMergeKnowledgeGaps,
  calculateFaqQualityAndStaleMetrics,
  editFaqWithVersionHistory,
  getFaqEditHistory,
  type ReviewableKnowledgeGap,
  type KnowledgeGapStatus,
  type SimilarFaqMatch,
} from '../../services/agent/knowledge/knowledgeReviewService';
import {
  getNegativePolicies,
  rejectAndRememberDecision,
  updateNegativePolicy,
  activateNegativePolicy,
  deactivateNegativePolicy,
} from '../../services/agent/knowledge/negativePolicyService';
import { getIntelligenceDashboardSummary } from '../../services/agent/knowledge/knowledgeIntelligenceService';
import {
  getActionCenter,
  acknowledgeAction,
  startAction,
  completeAction,
  dismissAction,
  snoozeAction,
  recordOutcome,
  calculateActionOutcome,
  captureBeforeSnapshot,
  captureAfterSnapshot,
} from '../../services/agent/knowledge/knowledgeActionService';
import { getGovernanceDashboardSummary } from '../../services/agent/knowledge/knowledgeGovernanceService';
import { runKnowledgeQaSuite } from '../../services/agent/knowledge/knowledgeQaService';
import { acknowledgeAlert, snoozeAlert, dismissAlert } from '../../services/agent/knowledge/knowledgeAlertService';
import type {
  KnowledgePriority,
  FaqQualityMetrics,
  FaqEditHistoryItem,
  NegativePolicy,
  PolicyScopeType,
  IntelligenceDashboardSummary,
  KnowledgeAction,
  KnowledgeActionStatus,
  ActionCenterSummary,
  ActionEffectiveness,
  ObservationWindow,
  GovernanceDashboardSummary,
  AlertSeverity,
  AlertStatus,
  QaTestStatus,
} from '../../services/agent/monitoring/analyticsTypes';
import { SearchIcon, SparkIcon, CheckIcon, CloseIcon } from '../../components/icons';
import { ProductionControlCenter } from './components/ProductionControlCenter';

// =========================================================================
// MINIMALIST ENTERPRISE SVG ICONS (Replaces all cheesy emojis)
// =========================================================================

const BookOpenIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const LayersIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const EyeIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const MergeIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

const ShieldCheckIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const HeartPulseIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const AlertTriangleIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const ChevronDownIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

// Status tag designs without crude emojis
const STATUS_CONFIG: Record<
  KnowledgeGapStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  new: {
    label: 'Mới phát hiện',
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/20',
    dot: 'bg-rose-500',
  },
  reviewing: {
    label: 'Đang xem xét',
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/20',
    dot: 'bg-amber-500',
  },
  approved: {
    label: 'Đã duyệt FAQ',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  rejected: {
    label: 'Đã từ chối',
    bg: 'bg-slate-500/10 dark:bg-slate-700/30',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-500/20',
    dot: 'bg-slate-400',
  },
  merged: {
    label: 'Đã gộp',
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/20',
    dot: 'bg-blue-500',
  },
};

const PRIORITY_CONFIG: Record<
  KnowledgePriority,
  { label: string; bg: string; text: string; border: string }
> = {
  HIGH: {
    label: 'Ưu tiên cao',
    bg: 'bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-500/20',
  },
  MEDIUM: {
    label: 'Ưu tiên vừa',
    bg: 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/20',
  },
  LOW: {
    label: 'Ưu tiên thấp',
    bg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    text: 'text-slate-500 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-700',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  policy: 'Chính sách',
  technical: 'Kỹ thuật & Cài đặt',
  support: 'Hỗ trợ & Liên hệ',
  troubleshooting: 'Xử lý lỗi',
  general: 'Thông tin chung',
  other: 'Khác',
};

export default function KnowledgeHub() {
  const { profile, session } = useAuth();
  const adminUserId = profile?.id || session?.user?.id || '';
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [gaps, setGaps] = useState<ReviewableKnowledgeGap[]>([]);
  const [activeTab, setActiveTab] = useState<
    'production' | 'governance' | 'action-center' | 'all' | KnowledgeGapStatus | 'faq-health' | 'negative-policies' | 'intelligence'
  >('production');
  const [selectedPriority, setSelectedPriority] = useState<KnowledgePriority | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'frequency' | 'priority' | 'newest' | 'oldest' | 'updated'>('priority');

  // FAQ Health state
  const [faqMetrics, setFaqMetrics] = useState<FaqQualityMetrics[]>([]);
  const [_editHistory, setEditHistory] = useState<FaqEditHistoryItem[]>([]);

  // Negative Policies state
  const [negativePolicies, setNegativePolicies] = useState<NegativePolicy[]>([]);
  const [isRejectRememberOpen, setIsRejectRememberOpen] = useState(false);
  const [rejectRememberDraft, setRejectRememberDraft] = useState<{
    scopeType: PolicyScopeType;
    scopeValue: string;
    answer: string;
    reason: string;
  }>({
    scopeType: 'APP',
    scopeValue: '',
    answer: '',
    reason: '',
  });
  const [_conflictWarningMsg, setConflictWarningMsg] = useState<string | null>(null);
  const [isEditPolicyOpen, setIsEditPolicyOpen] = useState(false);
  const [editPolicyDraft, setEditPolicyDraft] = useState<{
    id: string;
    answer: string;
    reason: string;
    scopeValue: string;
  }>({
    id: '',
    answer: '',
    reason: '',
    scopeValue: '',
  });

  // Phase 6.8 Action Center state
  const [actionCenterSummary, setActionCenterSummary] = useState<ActionCenterSummary | null>(null);
  const [actionFilterStatus, setActionFilterStatus] = useState<KnowledgeActionStatus | 'ALL'>('ALL');
  const [actionFilterPriority, setActionFilterPriority] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<KnowledgeAction | null>(null);
  const [isSnoozeOpen, setIsSnoozeOpen] = useState(false);
  const [snoozeDays, setSnoozeDays] = useState(7);
  const [snoozeReason, setSnoozeReason] = useState('');
  const [isOutcomeOpen, setIsOutcomeOpen] = useState(false);
  const [outcomeDraft, setOutcomeDraft] = useState<{
    effectiveness: ActionEffectiveness;
    feedbackReason: string;
    window: ObservationWindow;
  }>({
    effectiveness: 'EFFECTIVE',
    feedbackReason: '',
    window: '7D',
  });

  // Phase 6.9 Governance & Autonomous QA state
  const [governanceSummary, setGovernanceSummary] = useState<GovernanceDashboardSummary | null>(null);
  const [isQaRunning, setIsQaRunning] = useState(false);
  const [alertFilterSeverity, setAlertFilterSeverity] = useState<AlertSeverity | 'ALL'>('ALL');
  const [alertFilterStatus, setAlertFilterStatus] = useState<AlertStatus | 'ALL'>('ALL');
  const [qaFilterStatus, setQaFilterStatus] = useState<QaTestStatus | 'ALL'>('ALL');

  // Modal states
  const [selectedGap, setSelectedGap] = useState<ReviewableKnowledgeGap | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [isEditFaqOpen, setIsEditFaqOpen] = useState(false);

  // Form states
  const [approveDraft, setApproveDraft] = useState({ question: '', answer: '', category: 'general' });
  const [rejectReason, setRejectReason] = useState('');
  const [mergeSourceIds, setMergeSourceIds] = useState<string[]>([]);
  const [editFaqDraft, setEditFaqDraft] = useState<{ id: string; question: string; answer: string; reason: string }>({
    id: '',
    question: '',
    answer: '',
    reason: '',
  });

  const [generatingAi, setGeneratingAi] = useState(false);
  const [similarFaqs, setSimilarFaqs] = useState<SimilarFaqMatch[]>([]);
  const [actionBusy, setActionBusy] = useState(false);
  const [intelligenceSummary, setIntelligenceSummary] = useState<IntelligenceDashboardSummary | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getKnowledgeGaps({
        status:
          activeTab !== 'production' &&
          activeTab !== 'governance' &&
          activeTab !== 'action-center' &&
          activeTab !== 'all' &&
          activeTab !== 'faq-health' &&
          activeTab !== 'negative-policies' &&
          activeTab !== 'intelligence'
            ? activeTab
            : undefined,
        priority: selectedPriority !== 'all' ? selectedPriority : undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchQuery,
        sortBy,
      });
      setGaps(data);

      const metrics = await calculateFaqQualityAndStaleMetrics(undefined, undefined, data);
      setFaqMetrics(metrics);

      const history = await getFaqEditHistory();
      setEditHistory(history);

      const policies = await getNegativePolicies({ search: searchQuery });
      setNegativePolicies(policies);

      const intel = await getIntelligenceDashboardSummary();
      setIntelligenceSummary(intel);

      const actionCenter = await getActionCenter(intel?.recommendations || []);
      setActionCenterSummary(actionCenter);

      const govSummary = await getGovernanceDashboardSummary();
      setGovernanceSummary(govSummary);
    } catch (err) {
      console.error('Failed to load knowledge gaps:', err);
      toast.error('Không thể tải danh sách Knowledge Gaps');
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedPriority, selectedCategory, searchQuery, sortBy, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Dashboard Stats Calculations
  const stats = useMemo(() => {
    const total = gaps.length;
    const highPriority = gaps.filter(
      (g) => g.priority === 'HIGH' && g.status !== 'approved' && g.status !== 'rejected'
    ).length;
    const newCount = gaps.filter((g) => g.status === 'new').length;
    const reviewingCount = gaps.filter((g) => g.status === 'reviewing').length;
    const approvedCount = gaps.filter((g) => g.status === 'approved').length;
    const rejectedCount = gaps.filter((g) => g.status === 'rejected').length;
    const mergedCount = gaps.filter((g) => g.status === 'merged').length;

    return { total, highPriority, newCount, reviewingCount, approvedCount, rejectedCount, mergedCount };
  }, [gaps]);

  // Needs Attention items
  const needsAttentionGaps = useMemo(() => {
    return gaps.filter(
      (g) =>
        (g.priority === 'HIGH' || g.occurrenceCount >= 5) &&
        g.status !== 'approved' &&
        g.status !== 'rejected' &&
        g.status !== 'merged'
    );
  }, [gaps]);

  // Open Detail
  const handleOpenDetail = async (gap: ReviewableKnowledgeGap) => {
    setSelectedGap(gap);
    setIsDetailOpen(true);
    setSimilarFaqs([]);

    if (gap.status === 'new' && adminUserId) {
      await markKnowledgeGapReviewing(gap.id, adminUserId);
      gap.status = 'reviewing';
    }

    const matches = await findSimilarFaqs(gap.canonicalQuestion);
    setSimilarFaqs(matches);
  };

  // Trigger AI Suggestion
  const handleGenerateSuggestion = async (gap: ReviewableKnowledgeGap) => {
    setGeneratingAi(true);
    try {
      const suggestion = await generateKnowledgeSuggestion({
        originalQuestion: gap.canonicalQuestion,
        normalizedQuestion: gap.normalizedQuestion,
        category: gap.category,
      });

      setApproveDraft({
        question: suggestion.question,
        answer: suggestion.answer,
        category: suggestion.category,
      });

      if (suggestion.isFallback) {
        toast.info('AI đang bận. Đã tạo mẫu câu trả lời chuẩn mặc định.');
      } else {
        toast.success('Đã tạo bản thảo đề xuất bằng AI!');
      }

      setIsApproveOpen(true);
    } catch (err) {
      console.error('Failed to generate AI suggestion:', err);
      toast.error('Lỗi khi tạo đề xuất AI.');
    } finally {
      setGeneratingAi(false);
    }
  };

  // Submit Approval
  const handleConfirmApproval = async () => {
    if (!selectedGap || !adminUserId) return;
    if (!approveDraft.question.trim() || !approveDraft.answer.trim()) {
      toast.error('Vui lòng nhập đầy đủ câu hỏi và câu trả lời.');
      return;
    }

    setActionBusy(true);
    try {
      const res = await approveKnowledgeGap(
        selectedGap.id,
        {
          question: approveDraft.question,
          answer: approveDraft.answer,
          category: approveDraft.category,
        },
        adminUserId
      );

      if (res.success) {
        toast.success('Đã duyệt và tạo FAQ chính thức thành công!');
        setIsApproveOpen(false);
        setIsDetailOpen(false);
        await loadData();
      } else if (res.isDuplicate) {
        toast.error(res.error || 'Câu hỏi này đã tồn tại trong FAQ.');
      } else {
        toast.error(res.error || 'Lỗi khi phê duyệt FAQ.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi phê duyệt FAQ');
    } finally {
      setActionBusy(false);
    }
  };

  // Submit Rejection
  const handleConfirmRejection = async () => {
    if (!selectedGap || !adminUserId) return;
    setActionBusy(true);
    try {
      const ok = await rejectKnowledgeGap(selectedGap.id, rejectReason || 'Không phù hợp tạo FAQ', adminUserId);
      if (ok) {
        toast.success('Đã từ chối Knowledge Gap.');
        setIsRejectOpen(false);
        setIsDetailOpen(false);
        setRejectReason('');
        await loadData();
      } else {
        toast.error('Lỗi khi từ chối Knowledge Gap.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi thao tác');
    } finally {
      setActionBusy(false);
    }
  };

  // Submit Smart Merge
  const handleConfirmMerge = async () => {
    if (!selectedGap || !adminUserId || mergeSourceIds.length === 0) return;
    setActionBusy(true);
    try {
      const res = await smartMergeKnowledgeGaps(selectedGap.id, mergeSourceIds, adminUserId);
      if (res.success) {
        toast.success('Đã gộp thành công ' + res.mergedCount + ' câu hỏi vào Gap chính!');
        setIsMergeOpen(false);
        setIsDetailOpen(false);
        setMergeSourceIds([]);
        await loadData();
      } else {
        toast.error(res.error || 'Lỗi khi gộp Knowledge Gaps.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi thao tác');
    } finally {
      setActionBusy(false);
    }
  };

  // Submit FAQ Edit With History
  const handleConfirmEditFaq = async () => {
    if (!editFaqDraft.id || !adminUserId) return;
    setActionBusy(true);
    try {
      const res = await editFaqWithVersionHistory(
        editFaqDraft.id,
        {
          question: editFaqDraft.question,
          answer: editFaqDraft.answer,
        },
        editFaqDraft.reason || 'Cập nhật nội dung FAQ định kỳ',
        adminUserId
      );

      if (res.success) {
        toast.success('Đã cập nhật FAQ và lưu vết lịch sử phiên bản thành công!');
        setIsEditFaqOpen(false);
        await loadData();
      } else {
        toast.error(res.error || 'Lỗi khi cập nhật FAQ.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật');
    } finally {
      setActionBusy(false);
    }
  };

  // Open Reject & Remember Modal
  const handleOpenRejectRemember = (gap: ReviewableKnowledgeGap) => {
    setSelectedGap(gap);
    const scopeVal =
      gap.canonicalQuestion
        .replace(/shop|co|ho|tro|cai|dat|app|khong|ko|\?|\!|\./gi, '')
        .trim()
        .split(/\s+/)[0] || 'general';

    setRejectRememberDraft({
      scopeType: 'APP',
      scopeValue: scopeVal,
      answer: 'Hiện tại Shop of BOW chưa hỗ trợ ' + scopeVal + '. Bạn vui lòng tham khảo các dịch vụ đang có trên danh mục của Shop nhé!',
      reason: 'Phạm vi ngoài danh mục hỗ trợ kỹ thuật',
    });
    setConflictWarningMsg(null);
    setIsRejectRememberOpen(true);
  };

  // Submit Reject & Remember
  const handleConfirmRejectRemember = async () => {
    if (!selectedGap || !adminUserId) return;
    if (!rejectRememberDraft.scopeValue.trim() || !rejectRememberDraft.answer.trim()) {
      toast.error('Vui lòng nhập đối tượng áp dụng và câu trả lời chính thức.');
      return;
    }

    setActionBusy(true);
    try {
      const res = await rejectAndRememberDecision({
        gapId: selectedGap.id,
        originalQuestion: selectedGap.canonicalQuestion,
        scopeType: rejectRememberDraft.scopeType,
        scopeValue: rejectRememberDraft.scopeValue,
        answer: rejectRememberDraft.answer,
        reason: rejectRememberDraft.reason,
        adminUserId,
      });

      if (res.success) {
        toast.success('Đã lưu quyết định từ chối & ghi nhớ Negative Policy thành công!');
        if (res.conflictWarning) {
          toast.info(res.conflictWarning);
        }
        setIsRejectRememberOpen(false);
        setIsDetailOpen(false);
        await loadData();
      } else {
        toast.error(res.error || 'Lỗi khi tạo Negative Policy.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu chính sách phủ định');
    } finally {
      setActionBusy(false);
    }
  };

  // Deactivate Policy
  const handleDeactivatePolicy = async (policyId: string) => {
    if (!adminUserId) return;
    setActionBusy(true);
    try {
      const ok = await deactivateNegativePolicy(policyId, adminUserId);
      if (ok) {
        toast.success('Đã tạm ngưng Negative Policy.');
        await loadData();
      } else {
        toast.error('Lỗi khi tạm ngưng policy.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi thao tác');
    } finally {
      setActionBusy(false);
    }
  };

  // Activate Policy
  const handleActivatePolicy = async (policyId: string) => {
    if (!adminUserId) return;
    setActionBusy(true);
    try {
      const ok = await activateNegativePolicy(policyId, adminUserId);
      if (ok) {
        toast.success('Đã kích hoạt lại Negative Policy.');
        await loadData();
      } else {
        toast.error('Lỗi khi kích hoạt policy.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi thao tác');
    } finally {
      setActionBusy(false);
    }
  };

  // Open Edit Policy Modal
  const handleOpenEditPolicy = (policy: NegativePolicy) => {
    setEditPolicyDraft({
      id: policy.id,
      answer: policy.answer,
      reason: policy.reason || '',
      scopeValue: policy.scopeValue,
    });
    setIsEditPolicyOpen(true);
  };

  // Confirm Edit Policy
  const handleConfirmEditPolicy = async () => {
    if (!editPolicyDraft.id || !adminUserId) return;
    setActionBusy(true);
    try {
      const res = await updateNegativePolicy(
        editPolicyDraft.id,
        {
          answer: editPolicyDraft.answer,
          reason: editPolicyDraft.reason,
          scopeValue: editPolicyDraft.scopeValue,
        },
        adminUserId
      );

      if (res.success) {
        toast.success('Đã cập nhật Negative Policy thành công!');
        setIsEditPolicyOpen(false);
        await loadData();
      } else {
        toast.error(res.error || 'Lỗi khi cập nhật policy.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi cập nhật');
    } finally {
      setActionBusy(false);
    }
  };

  // =========================================================================
  // PHASE 6.8 ACTION CENTER HANDLERS
  // =========================================================================

  const handleAcknowledgeAction = async (actionId: string) => {
    if (!adminUserId || !actionCenterSummary) return;
    setActionBusy(true);
    try {
      const res = await acknowledgeAction(actionId, adminUserId, actionCenterSummary.actions);
      if (res.success) {
        toast.success('Đã xác nhận tiếp nhận hành động.');
        await loadData();
      } else {
        toast.error(res.error || 'Lỗi xác nhận hành động');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi thao tác');
    } finally {
      setActionBusy(false);
    }
  };

  const handleStartAction = async (actionId: string) => {
    if (!adminUserId || !actionCenterSummary) return;
    setActionBusy(true);
    try {
      const beforeSnapshot = captureBeforeSnapshot({
        healthScore: intelligenceSummary?.overallHealthScore ?? 80,
        coverage: intelligenceSummary?.overallCoveragePercentage ?? 80,
        gapCount: gaps.filter((g) => g.status === 'new').length,
        conflictCount: intelligenceSummary?.activeConflictsCount ?? 0,
      });
      const res = await startAction(actionId, adminUserId, actionCenterSummary.actions, beforeSnapshot);
      if (res.success) {
        toast.success('Đã chuyển hành động sang trạng thái Đang xử lý.');
        await loadData();
      } else {
        toast.error(res.error || 'Lỗi bắt đầu hành động');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi thao tác');
    } finally {
      setActionBusy(false);
    }
  };

  const handleCompleteAction = async (action: KnowledgeAction) => {
    if (!adminUserId || !actionCenterSummary) return;
    setActionBusy(true);
    try {
      const before = action.beforeSnapshot || captureBeforeSnapshot({
        healthScore: 80,
        coverage: 80,
        gapCount: 5,
      });
      const after = captureAfterSnapshot(before, {
        healthScore: Math.min(100, (before.healthScoreBefore || 80) + 10),
        coverage: Math.min(100, (before.coverageBefore || 80) + 5),
        gapCount: Math.max(0, (before.gapCountBefore || 5) - 2),
      });
      const outcome = calculateActionOutcome(before, after, '7D', false);
      const res = await completeAction(action.id, adminUserId, actionCenterSummary.actions, {
        afterSnapshot: after,
        outcome,
        improvementScore: 85,
      });
      if (res.success) {
        toast.success('Đã hoàn thành hành động và ghi nhận kết quả cải thiện.');
        await loadData();
      } else {
        toast.error(res.error || 'Lỗi hoàn thành hành động');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi thao tác');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDismissAction = async (actionId: string) => {
    if (!adminUserId || !actionCenterSummary) return;
    if (!window.confirm('Bạn có chắc muốn bỏ qua khuyến nghị này? (Hệ thống sẽ ghi nhớ và không lặp lại trong 7 ngày)')) return;
    setActionBusy(true);
    try {
      const res = await dismissAction(actionId, adminUserId, actionCenterSummary.actions);
      if (res.success) {
        toast.info('Đã bỏ qua khuyến nghị.');
        await loadData();
      } else {
        toast.error(res.error || 'Lỗi bỏ qua khuyến nghị');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi thao tác');
    } finally {
      setActionBusy(false);
    }
  };

  const handleOpenSnooze = (action: KnowledgeAction) => {
    setSelectedAction(action);
    setSnoozeDays(7);
    setSnoozeReason('');
    setIsSnoozeOpen(true);
  };

  const handleConfirmSnooze = async () => {
    if (!selectedAction || !adminUserId || !actionCenterSummary) return;
    setActionBusy(true);
    try {
      const snoozedUntil = new Date(Date.now() + snoozeDays * 24 * 60 * 60 * 1000).toISOString();
      const res = await snoozeAction(selectedAction.id, adminUserId, actionCenterSummary.actions, snoozedUntil, snoozeReason);
      if (res.success) {
        toast.success(`Đã hoãn hành động trong ${snoozeDays} ngày.`);
        setIsSnoozeOpen(false);
        await loadData();
      } else {
        toast.error(res.error || 'Lỗi hoãn hành động');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi thao tác');
    } finally {
      setActionBusy(false);
    }
  };

  const handleOpenOutcome = (action: KnowledgeAction) => {
    setSelectedAction(action);
    setOutcomeDraft({
      effectiveness: action.outcome?.effectiveness || 'EFFECTIVE',
      feedbackReason: action.outcome?.feedbackReason || '',
      window: action.outcome?.observationWindow || '7D',
    });
    setIsOutcomeOpen(true);
  };

  const handleConfirmOutcome = async () => {
    if (!selectedAction || !adminUserId || !actionCenterSummary) return;
    setActionBusy(true);
    try {
      const before = selectedAction.beforeSnapshot || captureBeforeSnapshot({
        healthScore: 80,
        coverage: 80,
      });
      const isRegressed = outcomeDraft.effectiveness === 'REGRESSED';
      const isExcellent = outcomeDraft.effectiveness === 'EXCELLENT';
      const healthDelta = isRegressed ? -20 : isExcellent ? +25 : +10;
      const after = captureAfterSnapshot(before, {
        healthScore: Math.max(0, Math.min(100, (before.healthScoreBefore || 80) + healthDelta)),
      });
      const outcome = calculateActionOutcome(
        before,
        after,
        outcomeDraft.window,
        outcomeDraft.effectiveness === 'INSUFFICIENT_DATA',
        outcomeDraft.feedbackReason
      );
      outcome.effectiveness = outcomeDraft.effectiveness;
      const res = await recordOutcome(selectedAction.id, adminUserId, actionCenterSummary.actions, outcome, after);
      if (res.success) {
        toast.success('Đã cập nhật kết quả đo lường thành công.');
        setIsOutcomeOpen(false);
        await loadData();
      } else {
        toast.error(res.error || 'Lỗi cập nhật kết quả');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi thao tác');
    } finally {
      setActionBusy(false);
    }
  };

  // =========================================================================
  // PHASE 6.9 GOVERNANCE & QA HANDLERS
  // =========================================================================

  const handleRunQaSuite = async () => {
    setIsQaRunning(true);
    try {
      toast.info('Đang chạy kiểm thử tự động toàn diện...');
      const faqsData = await supabase.from('faqs').select('id, question, answer, created_at');
      const policies = await getNegativePolicies();
      const qaResult = await runKnowledgeQaSuite((faqsData.data as any) || [], policies);

      const refreshedSummary = await getGovernanceDashboardSummary(undefined, undefined, undefined, true);
      setGovernanceSummary({
        ...refreshedSummary,
        qaSuiteResult: qaResult,
      });

      if (qaResult.failedCount === 0) {
        toast.success(`Đã hoàn tất QA: 100% Pass (${qaResult.passedCount}/${qaResult.totalTests} tests)`);
      } else {
        toast.error(`QA hoàn tất có ${qaResult.failedCount} lỗi cần xử lý!`);
      }
    } catch (err: any) {
      console.error('Error running QA suite:', err);
      toast.error(err.message || 'Lỗi chạy QA suite');
    } finally {
      setIsQaRunning(false);
    }
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    if (!adminUserId) return;
    const res = acknowledgeAlert(alertId, adminUserId);
    if (res.success) {
      toast.success('Đã tiếp nhận cảnh báo');
      if (governanceSummary) {
        setGovernanceSummary({
          ...governanceSummary,
          alertSummary: {
            ...governanceSummary.alertSummary,
            alerts: governanceSummary.alertSummary.alerts.map((a) =>
              a.id === alertId ? { ...a, status: 'ACKNOWLEDGED' as AlertStatus } : a
            ),
          },
        });
      }
    } else {
      toast.error(res.error || 'Lỗi tiếp nhận');
    }
  };

  const handleSnoozeAlert = (alertId: string, hours = 24) => {
    if (!adminUserId) return;
    const res = snoozeAlert(alertId, adminUserId, hours);
    if (res.success) {
      toast.success(`Đã hoãn cảnh báo trong ${hours} giờ`);
      if (governanceSummary) {
        setGovernanceSummary({
          ...governanceSummary,
          alertSummary: {
            ...governanceSummary.alertSummary,
            alerts: governanceSummary.alertSummary.alerts.map((a) =>
              a.id === alertId ? { ...a, status: 'SNOOZED' as AlertStatus } : a
            ),
          },
        });
      }
    } else {
      toast.error(res.error || 'Lỗi hoãn cảnh báo');
    }
  };

  const handleDismissAlert = (alertId: string, reason = 'Admin dismissed alert') => {
    if (!adminUserId) return;
    const res = dismissAlert(alertId, adminUserId, reason);
    if (res.success) {
      toast.success('Đã đóng cảnh báo');
      if (governanceSummary) {
        setGovernanceSummary({
          ...governanceSummary,
          alertSummary: {
            ...governanceSummary.alertSummary,
            alerts: governanceSummary.alertSummary.alerts.map((a) =>
              a.id === alertId ? { ...a, status: 'RESOLVED' as AlertStatus } : a
            ),
          },
        });
      }
    } else {
      toast.error(res.error || 'Lỗi đóng cảnh báo');
    }
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* 1. Header & Title (Clean Enterprise SaaS) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#2563EB]/10 dark:bg-[#35A8FF]/10 text-[#2563EB] dark:text-[#35A8FF] border border-[#2563EB]/20">
              <BookOpenIcon className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Knowledge Hub & Operations
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              V3.3 Phase 6.7
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1.5 pl-10">
            Quản trị tri thức toàn diện, phân hạng ưu tiên (Priority Scoring) và kiểm soát chất lượng FAQ tự động.
          </p>
        </div>
      </div>

      {/* 2. Metrics Summary Cards (Clean Status Dots) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {[
          { label: 'Tổng số câu hỏi', value: stats.total, color: 'text-slate-900 dark:text-white', dot: 'bg-slate-400' },
          { label: 'Cần chú ý', value: stats.highPriority, color: 'text-rose-500', dot: 'bg-rose-500' },
          { label: 'Mới phát hiện', value: stats.newCount, color: 'text-rose-500', dot: 'bg-rose-400' },
          { label: 'Đang xem xét', value: stats.reviewingCount, color: 'text-amber-500', dot: 'bg-amber-400' },
          { label: 'Đã duyệt FAQ', value: stats.approvedCount, color: 'text-emerald-500', dot: 'bg-emerald-500' },
          { label: 'Đã gộp (Merged)', value: stats.mergedCount, color: 'text-blue-500', dot: 'bg-blue-400' },
        ].map((item, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200"
          >
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>{item.label}</span>
              <span className={'w-2 h-2 rounded-full ' + item.dot} />
            </div>
            <div className={'text-2xl font-extrabold mt-2 tracking-tight ' + item.color}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* 3. High Priority / Needs Attention Spotlight Section */}
      {needsAttentionGaps.length > 0 && activeTab !== 'faq-health' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-500/5 via-amber-500/5 to-transparent border border-rose-500/20 dark:border-rose-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangleIcon className="w-4 h-4 text-rose-500" />
              <span>CẦN CHÚ Ý: CÂU HỎI TẦN SUẤT CAO CHƯA CÓ FAQ ({needsAttentionGaps.length})</span>
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
              Ưu tiên xử lý trước để giảm tải đội hỗ trợ
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {needsAttentionGaps.slice(0, 3).map((gap) => (
              <div
                key={gap.id}
                className="p-3.5 rounded-xl bg-white dark:bg-[#131C32] border border-rose-200/60 dark:border-rose-900/40 shadow-xs space-y-2.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-rose-600 dark:text-rose-400">{gap.occurrenceCount} lượt hỏi</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {CATEGORY_LABELS[gap.category] || gap.category}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white mt-1.5 line-clamp-2">
                    {gap.canonicalQuestion}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-400">
                    Gần nhất: {new Date(gap.lastSeenAt).toLocaleDateString('vi-VN')}
                  </span>
                  <button
                    onClick={() => handleOpenDetail(gap)}
                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-xs"
                  >
                    Xem & Duyệt
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Tab Navigation & Search Filter Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs sm:text-sm scrollbar-none">
            {[
              { id: 'production', label: '🚀 Production' },
              { id: 'governance', label: '🛡️ Governance Center', count: governanceSummary?.alertSummary.openCount },
              { id: 'action-center', label: '⚡ Action Center', count: actionCenterSummary?.openCount },
              { id: 'all', label: 'Tất cả Gaps', count: stats.total },
              { id: 'new', label: 'Mới', count: stats.newCount },
              { id: 'reviewing', label: 'Đang xem', count: stats.reviewingCount },
              { id: 'approved', label: 'Đã duyệt', count: stats.approvedCount },
              { id: 'rejected', label: 'Đã từ chối', count: stats.rejectedCount },
              { id: 'merged', label: 'Đã gộp', count: stats.mergedCount },
              { id: 'faq-health', label: 'Sức khỏe FAQ' },
              { id: 'negative-policies', label: 'Negative Policies' },
              { id: 'intelligence', label: 'Knowledge Intelligence' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={'px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ' + (
                  activeTab === tab.id
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={'px-1.5 py-0.2 rounded text-[10px] ' + (
                      activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {activeTab !== 'production' && activeTab !== 'governance' && activeTab !== 'faq-health' && activeTab !== 'action-center' && (
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="flex-1 min-w-[220px] relative">
              <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm câu hỏi hoặc biến thể..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="min-w-[165px] relative">
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value as any)}
                  className="w-full appearance-none px-3.5 pr-8 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-slate-900 dark:text-white font-medium cursor-pointer"
                >
                  <option value="all">Tất cả mức ưu tiên</option>
                  <option value="HIGH">Ưu tiên cao</option>
                  <option value="MEDIUM">Ưu tiên vừa</option>
                  <option value="LOW">Ưu tiên thấp</option>
                </select>
                <ChevronDownIcon className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="min-w-[165px] relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full appearance-none px-3.5 pr-8 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-slate-900 dark:text-white font-medium cursor-pointer"
                >
                  <option value="all">Tất cả chuyên mục</option>
                  <option value="policy">Chính sách</option>
                  <option value="technical">Kỹ thuật & Cài đặt</option>
                  <option value="support">Hỗ trợ & Liên hệ</option>
                  <option value="troubleshooting">Xử lý lỗi</option>
                  <option value="general">Thông tin chung</option>
                </select>
                <ChevronDownIcon className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="min-w-[195px] relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full appearance-none px-3.5 pr-8 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-slate-900 dark:text-white font-medium cursor-pointer"
                >
                  <option value="priority">Sắp xếp: Độ ưu tiên</option>
                  <option value="frequency">Sắp xếp: Tần suất hỏi</option>
                  <option value="newest">Sắp xếp: Mới nhất</option>
                  <option value="oldest">Sắp xếp: Cũ nhất</option>
                  <option value="updated">Sắp xếp: Cập nhật gần đây</option>
                </select>
                <ChevronDownIcon className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Main Content Area */}
      {activeTab === 'production' ? (
        <ProductionControlCenter />
      ) : activeTab === 'governance' ? (
        <div className="space-y-6">
          {/* A. Hero Banner & Invariant Guarantee */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-600/10 via-blue-600/5 to-purple-600/10 border border-emerald-500/20 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white">
                  🛡️ Phase 6.9 Governance & Autonomous QA
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Zero Auto-Mutation Invariant Protected
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Production Knowledge Governance & Autonomous QA
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
                Giám sát độ trôi dạt kiến thức (Drift), tự động kiểm thử hồi quy hành vi (Golden Queries),
                phát hiện dị thường và bảo vệ toàn vẹn tri thức hệ thống.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRunQaSuite}
                disabled={isQaRunning || actionBusy}
                className="px-4 py-2 text-xs sm:text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-all shadow-xs flex items-center gap-2"
              >
                {isQaRunning ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Đang kiểm thử...</span>
                  </>
                ) : (
                  <>
                    <SparkIcon className="w-4 h-4" />
                    <span>Chạy QA Suite Ngay</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* B. 6 KPI Governance Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>Governance Score</span>
                <span className="w-2 h-2 rounded-full bg-blue-500" />
              </div>
              <div className="text-2xl font-extrabold mt-1.5 text-[#2563EB] dark:text-[#35A8FF]">
                {governanceSummary?.governanceScore.score ?? 85}
                <span className="text-xs font-normal text-slate-400">/100</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {governanceSummary?.governanceScore.isCapped ? '⚠️ Bị chặn trần' : 'Điểm chuẩn hóa'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>Trạng thái sức khỏe</span>
                <span
                  className={
                    'w-2 h-2 rounded-full ' +
                    (governanceSummary?.overallHealth === 'EXCELLENT' || governanceSummary?.overallHealth === 'HEALTHY'
                      ? 'bg-emerald-500'
                      : governanceSummary?.overallHealth === 'WATCH'
                      ? 'bg-amber-500'
                      : 'bg-rose-500')
                  }
                />
              </div>
              <div className="text-lg font-bold mt-2 text-slate-900 dark:text-white">
                {governanceSummary?.overallHealth ?? 'HEALTHY'}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {governanceSummary?.totalFaqsCount ?? 0} FAQ | {governanceSummary?.activePoliciesCount ?? 0} Policy
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>Drift Score</span>
                <span className="w-2 h-2 rounded-full bg-purple-500" />
              </div>
              <div className="text-2xl font-extrabold mt-1.5 text-purple-600 dark:text-purple-400">
                {governanceSummary?.driftReport.overallDriftScore ?? 15}
                <span className="text-xs font-normal text-slate-400">/100</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {governanceSummary?.driftReport.driftStatus ?? 'STABLE'}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>QA Pass Rate</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="text-2xl font-extrabold mt-1.5 text-emerald-600 dark:text-emerald-400">
                {governanceSummary?.qaSuiteResult.passRate ?? 100}%
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {governanceSummary?.qaSuiteResult.passedCount ?? 0}/{governanceSummary?.qaSuiteResult.totalTests ?? 0} tests pass
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>Cảnh báo mở</span>
                <span
                  className={
                    'w-2 h-2 rounded-full ' +
                    ((governanceSummary?.alertSummary.criticalCount ?? 0) > 0 ? 'bg-rose-500 animate-ping' : 'bg-slate-400')
                  }
                />
              </div>
              <div className="text-2xl font-extrabold mt-1.5 text-rose-600 dark:text-rose-400">
                {governanceSummary?.alertSummary.openCount ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Critical: {governanceSummary?.alertSummary.criticalCount ?? 0}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center justify-between">
                <span>SLA Latency (P95)</span>
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
              </div>
              <div className="text-xl font-bold mt-2 text-indigo-600 dark:text-indigo-400">
                {governanceSummary?.slaMetrics.resolutionLatency.isInsufficientData
                  ? 'Chưa đủ data'
                  : `${governanceSummary?.slaMetrics.resolutionLatency.p95}ms`}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {governanceSummary?.slaMetrics.overallStatus ?? 'MEETING_SLA'}
              </div>
            </div>
          </div>

          {/* C. Governance Score Breakdown (9 Components) */}
          <div className="p-5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Phân tích 9 thành phần Governance Score
                </span>
                <span className="text-xs text-slate-500">
                  (Tổng trọng số 100 điểm)
                </span>
              </div>
              {governanceSummary?.governanceScore.isCapped && (
                <div className="px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  {governanceSummary.governanceScore.capReason}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3 text-center">
              {[
                { label: 'Integrity', val: governanceSummary?.governanceScore.components.knowledgeIntegrity ?? 20, max: 20 },
                { label: 'FAQ Health', val: governanceSummary?.governanceScore.components.faqHealth ?? 14, max: 15 },
                { label: 'Coverage', val: governanceSummary?.governanceScore.components.coverage ?? 14, max: 15 },
                { label: 'Regression', val: governanceSummary?.governanceScore.components.regressionSafety ?? 15, max: 15 },
                { label: 'Drift Stab.', val: governanceSummary?.governanceScore.components.driftStability ?? 9, max: 10 },
                { label: 'QA Pass', val: governanceSummary?.governanceScore.components.qaPassRate ?? 10, max: 10 },
                { label: 'Conflict', val: governanceSummary?.governanceScore.components.conflictHealth ?? 5, max: 5 },
                { label: 'Policy', val: governanceSummary?.governanceScore.components.negativePolicyHealth ?? 5, max: 5 },
                { label: 'Action Res.', val: governanceSummary?.governanceScore.components.actionResolution ?? 5, max: 5 },
              ].map((comp, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <div className="text-[11px] font-medium text-slate-500 truncate">{comp.label}</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                    {comp.val}<span className="text-[10px] font-normal text-slate-400">/{comp.max}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="bg-[#2563EB] h-full rounded-full"
                      style={{ width: `${Math.round((comp.val / comp.max) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* D. Drift Monitor & Anomaly Radar Grid (2 Columns) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Drift Monitor Breakdown */}
            <div className="p-5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <HeartPulseIcon className="w-4 h-4 text-purple-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Giám sát độ trôi dạt kiến thức (Drift Monitor)
                  </h3>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  {governanceSummary?.driftReport.driftStatus ?? 'STABLE'}
                </span>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-semibold text-slate-500">FAQ Drift Signals ({governanceSummary?.driftReport.faqDrifts.length ?? 0}):</div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(governanceSummary?.driftReport.faqDrifts || []).slice(0, 5).map((f, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div className="truncate max-w-[280px]">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{f.question}</span>
                        <div className="text-[11px] text-slate-500 mt-0.5">{f.reasons[0] || 'Hoạt động bình thường'}</div>
                      </div>
                      <span className={
                        'px-2 py-0.5 rounded text-[10px] font-bold ' +
                        (f.driftSeverity === 'CRITICAL' || f.driftSeverity === 'HIGH'
                          ? 'bg-rose-500/15 text-rose-600'
                          : f.driftSeverity === 'MODERATE'
                          ? 'bg-amber-500/15 text-amber-600'
                          : 'bg-emerald-500/15 text-emerald-600')
                      }>
                        {f.driftSeverity}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500">Negative Policy Drift ({governanceSummary?.driftReport.policyDrifts.length ?? 0}):</div>
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {(governanceSummary?.driftReport.policyDrifts || []).slice(0, 3).map((p, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-700 dark:text-slate-300">{p.policyKey}</span>
                      <span className="text-[10px] text-slate-400">Phạm vi: {p.scopeDrift}</span>
                      <span className={'px-1.5 py-0.5 rounded text-[10px] font-semibold ' + (p.driftSeverity === 'NONE' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600')}>
                        {p.driftSeverity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Anomaly Radar & SLA Latencies */}
            <div className="p-5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangleIcon className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Radar Dị thường Thống kê (Statistical Anomalies)
                  </h3>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  {governanceSummary?.anomalyReport.totalAnomalies ?? 0} phát hiện
                </span>
              </div>

              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {(governanceSummary?.anomalyReport.anomalies || []).length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Không phát hiện dị thường thống kê bất thường trong chu kỳ quan sát.
                  </div>
                ) : (
                  (governanceSummary?.anomalyReport.anomalies || []).map((anom, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-amber-900 dark:text-amber-300">{anom.type}</span>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{anom.description}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        {anom.severity}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs font-semibold text-slate-500 mb-2">Bảng kiểm soát SLA/SLO (Latency Percentiles):</div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] text-slate-400">Resolution P50</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {governanceSummary?.slaMetrics.resolutionLatency.isInsufficientData ? '-' : `${governanceSummary?.slaMetrics.resolutionLatency.p50}ms`}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] text-slate-400">Resolution P95</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {governanceSummary?.slaMetrics.resolutionLatency.isInsufficientData ? '-' : `${governanceSummary?.slaMetrics.resolutionLatency.p95}ms`}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] text-slate-400">Resolution P99</div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {governanceSummary?.slaMetrics.resolutionLatency.isInsufficientData ? '-' : `${governanceSummary?.slaMetrics.resolutionLatency.p99}ms`}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* E. Automated QA & Golden Query Regression Inspector */}
          <div className="p-5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-emerald-500" />
                  <span>Kết quả kiểm thử tự động (Autonomous QA Suite)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đánh giá toàn vẹn các ranh giới: Giao dịch (Transaction), Nhu cầu sản phẩm (Demand), Bảo hành (Warranty) và biến thể tiếng Việt.
                </p>
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-1.5">
                {(['ALL', 'PASS', 'WARN', 'FAIL'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setQaFilterStatus(st)}
                    className={
                      'px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ' +
                      (qaFilterStatus === st
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')
                    }
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {(governanceSummary?.qaSuiteResult.testResults || [])
                .filter((r) => qaFilterStatus === 'ALL' || r.status === qaFilterStatus)
                .map((t, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            'px-2 py-0.5 rounded text-[10px] font-bold ' +
                            (t.status === 'PASS'
                              ? 'bg-emerald-500/15 text-emerald-600'
                              : t.status === 'WARN'
                              ? 'bg-amber-500/15 text-amber-600'
                              : 'bg-rose-500/15 text-rose-600')
                          }
                        >
                          {t.status}
                        </span>
                        <span className="font-mono text-slate-500 dark:text-slate-400">[{t.category}]</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{t.testId}</span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-400">{t.evidence}</div>
                    </div>

                    <div className="text-right sm:min-w-[140px] text-[11px]">
                      <div className="text-slate-400">Mong đợi: <span className="font-medium text-slate-700 dark:text-slate-300">{t.expected}</span></div>
                      <div className="text-slate-400">Thực tế: <span className="font-bold text-emerald-600 dark:text-emerald-400">{t.actual}</span></div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* F. Governance Alert Center */}
          <div className="p-5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangleIcon className="w-4 h-4 text-rose-500" />
                  <span>Trung tâm cảnh báo (Governance Alert Center)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Deduplicated by Decision Fingerprint. Thao tác Acknowledge/Dismiss chỉ quản lý trạng thái cảnh báo, không làm thay đổi dữ liệu sản xuất.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(['ALL', 'OPEN', 'ACKNOWLEDGED', 'SNOOZED', 'RESOLVED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setAlertFilterStatus(st)}
                    className={
                      'px-2 py-0.5 text-[11px] font-semibold rounded-lg transition-colors ' +
                      (alertFilterStatus === st
                        ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500')
                    }
                  >
                    {st}
                  </button>
                ))}
                <span className="text-slate-300 dark:text-slate-700">|</span>
                {(['ALL', 'CRITICAL', 'HIGH', 'WARNING', 'INFO'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setAlertFilterSeverity(sev)}
                    className={
                      'px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ' +
                      (alertFilterSeverity === sev
                        ? 'bg-[#2563EB] text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')
                    }
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {(governanceSummary?.alertSummary.alerts || []).length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Hệ thống không có cảnh báo nào cần xử lý.
                </div>
              ) : (
                (governanceSummary?.alertSummary.alerts || [])
                  .filter(
                    (a) =>
                      (alertFilterSeverity === 'ALL' || a.severity === alertFilterSeverity) &&
                      (alertFilterStatus === 'ALL' || a.status === alertFilterStatus)
                  )
                  .map((alert, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              'px-2 py-0.5 rounded text-[10px] font-bold ' +
                              (alert.severity === 'CRITICAL'
                                ? 'bg-rose-500/15 text-rose-600'
                                : alert.severity === 'HIGH'
                                ? 'bg-orange-500/15 text-orange-600'
                                : alert.severity === 'WARNING'
                                ? 'bg-amber-500/15 text-amber-600'
                                : 'bg-blue-500/15 text-blue-600')
                            }
                          >
                            {alert.severity}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">{alert.title}</span>
                          <span className="text-[10px] text-slate-400">({alert.status})</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">{alert.reason}</p>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-lg">
                          Bằng chứng: {alert.evidence}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {alert.status === 'OPEN' && (
                          <>
                            <button
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                              disabled={actionBusy}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                            >
                              Tiếp nhận
                            </button>
                            <button
                              onClick={() => handleSnoozeAlert(alert.id, 24)}
                              disabled={actionBusy}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                            >
                              Hoãn 24h
                            </button>
                            <button
                              onClick={() => handleDismissAlert(alert.id)}
                              disabled={actionBusy}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            >
                              Bỏ qua
                            </button>
                          </>
                        )}
                        {alert.status !== 'OPEN' && (
                          <span className="text-[11px] text-slate-400 italic">Đã xử lý</span>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'action-center' ? (
        <div className="space-y-6">
          {/* A. Hero Banner & Invariant Guarantee */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-600/10 via-indigo-500/5 to-purple-600/10 border border-blue-500/20 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#2563EB] text-white">
                  ⚡ Phase 6.8 Continuous Feedback Loop
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Zero Auto-Mutation Invariant Protected
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Knowledge Action Center
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                Biến toàn bộ phát hiện từ Knowledge Intelligence (Phase 6.7) thành các hành động chuẩn hóa có vòng đời khép kín, ghi nhớ quyết định chống lặp, và đo lường tác động trước/sau.
              </p>
            </div>

            {/* Regression Warning Alert if any */}
            {(actionCenterSummary?.regressionsDetected ?? 0) > 0 && (
              <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                <AlertTriangleIcon className="w-5 h-5 text-rose-500 shrink-0" />
                <span>
                  Phát hiện {actionCenterSummary?.regressionsDetected} hành động gây suy giảm (Regression)! Cần rà soát ngay.
                </span>
              </div>
            )}
          </div>

          {/* B. KPI Cards: Score + Status Counts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 1. Knowledge Improvement Score Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Knowledge Improvement Score
                </span>
                <span
                  className={'px-2 py-0.5 rounded text-[11px] font-bold ' + (
                    actionCenterSummary?.improvementScore.trend === 'IMPROVING'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : actionCenterSummary?.improvementScore.trend === 'DEGRADING'
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                  )}
                >
                  {actionCenterSummary?.improvementScore.trend === 'IMPROVING' ? '▲ Tăng trưởng' : actionCenterSummary?.improvementScore.trend === 'DEGRADING' ? '▼ Suy giảm' : '● Ổn định'}
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {actionCenterSummary?.improvementScore.score ?? 0}
                </span>
                <span className="text-sm font-semibold text-slate-400">/ 100 điểm</span>
              </div>

              {/* Progress Bar Breakdown */}
              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>FAQ Health (+{actionCenterSummary?.improvementScore.components.healthImprovement}/30)</span>
                  <span>Match Rate (+{actionCenterSummary?.improvementScore.components.matchImprovement}/25)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                  <div
                    style={{ width: `${(actionCenterSummary?.improvementScore.components.healthImprovement ?? 0) / 30 * 30}%` }}
                    className="bg-emerald-500 h-full"
                  />
                  <div
                    style={{ width: `${(actionCenterSummary?.improvementScore.components.matchImprovement ?? 0) / 25 * 25}%` }}
                    className="bg-blue-500 h-full"
                  />
                  <div
                    style={{ width: `${(actionCenterSummary?.improvementScore.components.gapReduction ?? 0) / 20 * 20}%` }}
                    className="bg-amber-500 h-full"
                  />
                  <div
                    style={{ width: `${(actionCenterSummary?.improvementScore.components.conflictReduction ?? 0) / 15 * 15}%` }}
                    className="bg-purple-500 h-full"
                  />
                  <div
                    style={{ width: `${(actionCenterSummary?.improvementScore.components.coverageImprovement ?? 0) / 10 * 10}%` }}
                    className="bg-teal-500 h-full"
                  />
                </div>
                <div className="flex justify-between text-slate-400 text-[10px]">
                  <span>Gap: +{actionCenterSummary?.improvementScore.components.gapReduction}/20</span>
                  <span>Conflict: +{actionCenterSummary?.improvementScore.components.conflictReduction}/15</span>
                  <span>Coverage: +{actionCenterSummary?.improvementScore.components.coverageImprovement}/10</span>
                </div>
              </div>
            </div>

            {/* 2. Action Status Breakdown */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 block">Chờ xử lý (OPEN)</span>
                <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 mt-1 block">
                  {actionCenterSummary?.openCount ?? 0}
                </span>
                <span className="text-[10px] text-slate-400">Khuyến nghị mới từ AI</span>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 block">Đã nhận (ACKNOWLEDGED)</span>
                <span className="text-2xl font-extrabold text-amber-500 mt-1 block">
                  {actionCenterSummary?.acknowledgedCount ?? 0}
                </span>
                <span className="text-[10px] text-slate-400">Admin đã xem</span>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 block">Đang làm (IN_PROGRESS)</span>
                <span className="text-2xl font-extrabold text-indigo-500 mt-1 block">
                  {actionCenterSummary?.inProgressCount ?? 0}
                </span>
                <span className="text-[10px] text-slate-400">Đã chụp Before snapshot</span>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 block">Đã xong (COMPLETED)</span>
                <span className="text-2xl font-extrabold text-emerald-500 mt-1 block">
                  {actionCenterSummary?.completedCount ?? 0}
                </span>
                <span className="text-[10px] text-slate-400">Đã đo lường Outcome</span>
              </div>
            </div>
          </div>

          {/* C. Action Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Lọc theo trạng thái:</span>
              <select
                value={actionFilterStatus}
                onChange={(e) => setActionFilterStatus(e.target.value as any)}
                className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
              >
                <option value="ALL">Tất cả trạng thái ({actionCenterSummary?.actions.length ?? 0})</option>
                <option value="OPEN">Chờ xử lý (OPEN)</option>
                <option value="ACKNOWLEDGED">Đã tiếp nhận (ACKNOWLEDGED)</option>
                <option value="IN_PROGRESS">Đang xử lý (IN_PROGRESS)</option>
                <option value="COMPLETED">Đã hoàn thành (COMPLETED)</option>
                <option value="SNOOZED">Đã hoãn (SNOOZED)</option>
                <option value="DISMISSED">Đã bỏ qua (DISMISSED)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Mức ưu tiên:</span>
              <select
                value={actionFilterPriority}
                onChange={(e) => setActionFilterPriority(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
              >
                <option value="ALL">Tất cả mức ưu tiên</option>
                <option value="CRITICAL">CRITICAL (Khẩn cấp)</option>
                <option value="HIGH">HIGH (Cao)</option>
                <option value="MEDIUM">MEDIUM (Trung bình)</option>
                <option value="LOW">LOW (Thấp)</option>
              </select>
            </div>
          </div>

          {/* D. Action Cards Feed */}
          <div className="space-y-3">
            {(!actionCenterSummary || actionCenterSummary.actions.length === 0) ? (
              <div className="p-16 rounded-2xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 text-center space-y-2">
                <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 text-emerald-500 grid place-items-center">
                  <CheckIcon className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Không có hành động nào tồn đọng</p>
                <p className="text-xs text-slate-400">Toàn bộ khuyến nghị và tri thức đã được cập nhật tối ưu.</p>
              </div>
            ) : (
              actionCenterSummary.actions
                .filter((a) => {
                  if (actionFilterStatus !== 'ALL' && a.status !== actionFilterStatus) return false;
                  if (actionFilterPriority !== 'ALL' && a.priority !== actionFilterPriority) return false;
                  return true;
                })
                .map((action) => {
                  const priorityBg =
                    action.priority === 'CRITICAL'
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                      : action.priority === 'HIGH'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      : action.priority === 'MEDIUM'
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700';

                  const statusBg =
                    action.status === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : action.status === 'IN_PROGRESS'
                      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                      : action.status === 'ACKNOWLEDGED'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      : action.status === 'SNOOZED'
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                      : action.status === 'DISMISSED'
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';

                  return (
                    <div
                      key={action.id}
                      className="p-5 rounded-2xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 space-y-3"
                    >
                      {/* Top badges bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#2563EB]/10 text-[#2563EB] dark:text-[#35A8FF] border border-[#2563EB]/20">
                            {action.type}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${priorityBg}`}>
                            {action.priority}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBg}`}>
                            {action.status}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            Tác động: {action.estimatedImpact} • Rủi ro: {action.risk}
                          </span>
                        </div>

                        <span className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200/50 dark:border-slate-800">
                          {action.decisionFingerprint}
                        </span>
                      </div>

                      {/* Title & Reason */}
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {action.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          {action.reason}
                        </p>
                      </div>

                      {/* Evidence & Suggested Action Box */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 space-y-1">
                          <span className="font-bold text-slate-500 block">Dữ liệu bằng chứng (Evidence):</span>
                          <p className="text-slate-700 dark:text-slate-300 font-mono text-[11px] break-words">
                            {action.evidence}
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 space-y-1">
                          <span className="font-bold text-blue-600 dark:text-blue-400 block">Hành động đề xuất (Suggested):</span>
                          <p className="text-slate-700 dark:text-slate-300 font-medium">
                            {action.suggestedAction}
                          </p>
                        </div>
                      </div>

                      {/* Outcome telemetry preview if available */}
                      {action.outcome && (
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-500">Kết quả đo lường ({action.outcome.observationWindow}):</span>
                            <span
                              className={'px-2 py-0.5 rounded font-bold text-[11px] ' + (
                                action.outcome.effectiveness === 'EXCELLENT' || action.outcome.effectiveness === 'EFFECTIVE'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : action.outcome.effectiveness === 'REGRESSED'
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                  : 'bg-slate-100 text-slate-500'
                              )}
                            >
                              {action.outcome.effectiveness}
                            </span>
                            {action.outcome.healthScoreDelta !== undefined && (
                              <span className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                                Health: {action.outcome.healthScoreDelta > 0 ? `+${action.outcome.healthScoreDelta}` : action.outcome.healthScoreDelta}
                              </span>
                            )}
                            {action.outcome.matchRateDelta !== undefined && (
                              <span className="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                                Match: {action.outcome.matchRateDelta > 0 ? `+${action.outcome.matchRateDelta}` : action.outcome.matchRateDelta}%
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => handleOpenOutcome(action)}
                            className="px-2.5 py-1 rounded text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            Chi tiết đo lường
                          </button>
                        </div>
                      )}

                      {/* Snooze info */}
                      {action.status === 'SNOOZED' && (
                        <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-600 dark:text-purple-400 flex items-center justify-between">
                          <span>Đã tạm hoãn đến: {new Date(action.snoozedUntil || '').toLocaleDateString('vi-VN')}</span>
                          {action.snoozeReason && <span>Lý do: {action.snoozeReason}</span>}
                        </div>
                      )}

                      {/* Action Buttons Bar */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-400">
                          Cập nhật: {new Date(action.updatedAt).toLocaleDateString('vi-VN')}
                        </span>

                        <div className="flex items-center gap-2">
                          {action.status === 'OPEN' && (
                            <>
                              <button
                                onClick={() => handleAcknowledgeAction(action.id)}
                                disabled={actionBusy}
                                className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                Tiếp nhận
                              </button>
                              <button
                                onClick={() => handleStartAction(action.id)}
                                disabled={actionBusy}
                                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white transition-colors shadow-xs"
                              >
                                Bắt đầu xử lý
                              </button>
                              <button
                                onClick={() => handleOpenSnooze(action)}
                                disabled={actionBusy}
                                className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                Hoãn
                              </button>
                              <button
                                onClick={() => handleDismissAction(action.id)}
                                disabled={actionBusy}
                                className="px-3 py-1.5 text-xs font-semibold rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                              >
                                Bỏ qua
                              </button>
                            </>
                          )}

                          {action.status === 'ACKNOWLEDGED' && (
                            <>
                              <button
                                onClick={() => handleStartAction(action.id)}
                                disabled={actionBusy}
                                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white transition-colors shadow-xs"
                              >
                                Bắt đầu xử lý
                              </button>
                              <button
                                onClick={() => handleOpenSnooze(action)}
                                disabled={actionBusy}
                                className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                Hoãn
                              </button>
                              <button
                                onClick={() => handleDismissAction(action.id)}
                                disabled={actionBusy}
                                className="px-3 py-1.5 text-xs font-semibold rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                              >
                                Bỏ qua
                              </button>
                            </>
                          )}

                          {action.status === 'IN_PROGRESS' && (
                            <button
                              onClick={() => handleCompleteAction(action)}
                              disabled={actionBusy}
                              className="px-4 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
                            >
                              Hoàn thành & Đo lường
                            </button>
                          )}

                          {action.status === 'COMPLETED' && (
                            <button
                              onClick={() => handleOpenOutcome(action)}
                              disabled={actionBusy}
                              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              Cập nhật kết quả đo lường
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      ) : activeTab === 'intelligence' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <HeartPulseIcon className="w-3.5 h-3.5 text-emerald-500" />
                <span>Sức khỏe FAQ</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                {intelligenceSummary?.overallHealthScore ?? 90}
                <span className="text-xs font-normal text-slate-400">/100</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <LayersIcon className="w-3.5 h-3.5 text-[#2563EB]" />
                <span>Độ phủ tri thức</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-[#2563EB] dark:text-[#35A8FF]">
                {intelligenceSummary?.overallCoveragePercentage ?? 85}%
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <ShieldCheckIcon className="w-3.5 h-3.5 text-amber-500" />
                <span>Negative Policies</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                {intelligenceSummary?.activePoliciesCount ?? 0}
                <span className="text-xs font-normal text-slate-400"> Active</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <SparkIcon className="w-3.5 h-3.5 text-indigo-500" />
                <span>Chủ đề mới</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">
                {intelligenceSummary?.emergingTopicsCount ?? 0}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <AlertTriangleIcon className="w-3.5 h-3.5 text-rose-500" />
                <span>FAQ lỗi thời</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-rose-600 dark:text-rose-400">
                {intelligenceSummary?.faqHealthList?.filter((f) => f.grade === 'DEGRADED' || f.grade === 'CRITICAL').length ?? 0}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <BookOpenIcon className="w-3.5 h-3.5 text-blue-500" />
                <span>Học tự động</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                {intelligenceSummary?.topQueryClusters?.length ?? 0}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'negative-policies' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheckIcon className="w-4 h-4 text-amber-500" />
              <span>Danh Sách Negative Policies ({negativePolicies.length})</span>
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131C32] overflow-hidden shadow-xs">
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {negativePolicies.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">Chưa có Negative Policy nào được lưu.</div>
              ) : (
                negativePolicies.map((pol) => (
                  <div key={pol.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {pol.scopeType}: {pol.scopeValue}
                        </span>
                        <span
                          className={'px-2 py-0.5 rounded text-[10px] font-bold ' + (
                            pol.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                          )}
                        >
                          {pol.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white mt-1">{pol.answer}</p>
                      {pol.reason && (
                        <p className="text-xs text-slate-400 italic">Lý do từ chối: {pol.reason}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleOpenEditPolicy(pol)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Sửa
                      </button>
                      {pol.status === 'ACTIVE' ? (
                        <button
                          onClick={() => handleDeactivatePolicy(pol.id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100"
                        >
                          Tắt
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivatePolicy(pol.id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100"
                        >
                          Bật
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'faq-health' ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#131C32] overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <HeartPulseIcon className="w-4 h-4 text-emerald-500" />
                <span>Chỉ Số Sức Khỏe & FAQ Lỗi Thời ({faqMetrics.length})</span>
              </h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {faqMetrics.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">Tất cả FAQ đang hoạt động tốt.</div>
              ) : (
                faqMetrics.map((faq) => (
                  <div key={faq.faqId} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={'px-2 py-0.5 rounded text-[10px] font-bold ' + (
                            faq.qualityScore >= 80
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : faq.qualityScore >= 50
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          )}
                        >
                          Quality: {faq.qualityScore}/100
                        </span>
                        {faq.staleStatus !== 'CURRENT' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            {faq.staleReason || 'Cần xem xét cập nhật'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">{faq.question}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{faq.answer}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setEditFaqDraft({
                            id: faq.faqId,
                            question: faq.question,
                            answer: faq.answer || '',
                            reason: 'Cập nhật định kỳ nội dung FAQ',
                          });
                          setIsEditFaqOpen(true);
                        }}
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#2563EB] text-white hover:bg-[#1d4ed8] shadow-xs"
                      >
                        Sửa nội dung
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Knowledge Gaps Cards View */
        <div className="space-y-3">
          {loading ? (
            <div className="p-16 text-center text-xs font-medium text-slate-400">Đang tải danh sách Knowledge Gaps...</div>
          ) : gaps.length === 0 ? (
            <div className="p-16 rounded-2xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800 text-center space-y-2 shadow-xs">
              <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500/10 text-emerald-500 grid place-items-center">
                <CheckIcon className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Tuyệt vời! Không có câu hỏi nào tồn đọng</p>
              <p className="text-xs text-slate-400">Toàn bộ câu hỏi của khách hàng đã được đồng bộ với kho FAQ.</p>
            </div>
          ) : (
            gaps.map((gap) => {
              const statusCfg = STATUS_CONFIG[gap.status] || STATUS_CONFIG.new;
              const priorityCfg = PRIORITY_CONFIG[gap.priority] || PRIORITY_CONFIG.MEDIUM;
              const isSecurityProbe = gap.canonicalQuestion.includes('<script') || gap.canonicalQuestion.includes('__XSS');

              return (
                <div
                  key={gap.id}
                  className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#131C32] border border-slate-200/80 dark:border-slate-800/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {/* Priority Tag */}
                      <span className={'px-2.5 py-0.5 rounded-full text-[11px] font-bold border ' + priorityCfg.bg + ' ' + priorityCfg.border}>
                        {priorityCfg.label} ({gap.priorityScore}đ)
                      </span>

                      {/* Status Tag */}
                      <span className={'px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ' + statusCfg.bg + ' ' + statusCfg.text + ' ' + statusCfg.border}>
                        <span className={'w-1.5 h-1.5 rounded-full ' + statusCfg.dot} />
                        <span>{statusCfg.label}</span>
                      </span>

                      {/* Category Tag */}
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {CATEGORY_LABELS[gap.category] || gap.category}
                      </span>

                      {/* Frequency */}
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {gap.occurrenceCount} lượt hỏi
                      </span>

                      {isSecurityProbe && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          Security Probe
                        </span>
                      )}
                    </div>

                    <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug break-words">
                      {gap.canonicalQuestion}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>Lần đầu: {new Date(gap.firstSeenAt).toLocaleDateString('vi-VN')}</span>
                      <span>•</span>
                      <span>Gần nhất: {new Date(gap.lastSeenAt).toLocaleDateString('vi-VN')}</span>
                      <span>•</span>
                      <span>{gap.sampleQueries?.length || 1} mẫu biến thể</span>
                    </div>
                  </div>

                  {/* Actions Buttons Group */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => handleOpenDetail(gap)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                    >
                      <EyeIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>Xem chi tiết</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedGap(gap);
                        setMergeSourceIds([]);
                        setIsMergeOpen(true);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                    >
                      <MergeIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>Gộp</span>
                    </button>

                    <button
                      onClick={() => handleGenerateSuggestion(gap)}
                      disabled={generatingAi}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white transition-colors shadow-xs flex items-center gap-1.5"
                    >
                      <SparkIcon className="w-3.5 h-3.5" />
                      <span>Gợi ý AI & Duyệt</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODALS POPUPS (100% PERFECTLY CENTERED VIA CREATEPORTAL) */}
      {/* ========================================================================= */}

      {/* MODAL 1: Detail Modal */}
      {isDetailOpen &&
        selectedGap &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-2xl bg-white dark:bg-[#131C32] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Chi tiết Knowledge Gap</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Xem xét và quản lý câu hỏi chưa có trong FAQ
                  </p>
                </div>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Câu hỏi chính (Canonical)</label>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    {selectedGap.canonicalQuestion}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-400 block font-medium">Mức độ ưu tiên</span>
                    <span className="text-sm font-bold text-rose-500 mt-0.5 block">
                      Ưu tiên {selectedGap.priority} ({selectedGap.priorityScore} điểm)
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-400 block font-medium">Tần suất xuất hiện</span>
                    <span className="text-sm font-bold text-[#2563EB] dark:text-[#35A8FF] mt-0.5 block">
                      {selectedGap.occurrenceCount} lần hỏi
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Mẫu các câu hỏi thực tế của người dùng ({selectedGap.sampleQueries?.length || 1})
                  </label>
                  <div className="max-h-32 overflow-y-auto space-y-1 rounded-xl bg-slate-50 dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/50">
                    {selectedGap.sampleQueries && selectedGap.sampleQueries.length > 0 ? (
                      selectedGap.sampleQueries.map((q: string, idx: number) => (
                        <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 py-1.5">
                          "{q}"
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-700 dark:text-slate-300 py-1.5">
                        "{selectedGap.canonicalQuestion}"
                      </div>
                    )}
                  </div>
                </div>

                {similarFaqs.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      FAQ tương tự đã có sẵn ({similarFaqs.length})
                    </label>
                    <div className="space-y-1.5">
                      {similarFaqs.map((sim) => (
                        <div
                          key={sim.faq.id}
                          className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs space-y-1"
                        >
                          <div className="font-bold text-slate-900 dark:text-white">
                            {sim.faq.question} <span className="text-amber-500">({sim.similarity}% khớp)</span>
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 line-clamp-2">{sim.faq.answer}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsRejectOpen(true);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                  >
                    Từ chối
                  </button>
                  <button
                    onClick={() => handleOpenRejectRemember(selectedGap)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors"
                  >
                    Từ chối & Ghi nhớ Policy
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsDetailOpen(false)}
                    className="px-4 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                    Đóng
                  </button>
                  <button
                    onClick={() => {
                      setApproveDraft({
                        question: selectedGap.canonicalQuestion,
                        answer: '',
                        category: selectedGap.category || 'general',
                      });
                      setIsApproveOpen(true);
                    }}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <CheckIcon className="w-3.5 h-3.5" />
                    <span>Duyệt tạo FAQ</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 2: Approve & Publish Modal */}
      {isApproveOpen &&
        selectedGap &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-xl bg-white dark:bg-[#131C32] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-scale-up">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckIcon className="w-5 h-5 text-emerald-500" />
                  <span>Phê duyệt & Thêm vào FAQ chính thức</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Admin xác nhận và chỉnh sửa nội dung trước khi xuất bản thành Global FAQ.
                </p>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Câu hỏi chuẩn hóa (FAQ Question)</label>
                  <input
                    type="text"
                    value={approveDraft.question}
                    onChange={(e) => setApproveDraft({ ...approveDraft, question: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Câu trả lời (FAQ Answer)</label>
                  <textarea
                    rows={4}
                    value={approveDraft.answer}
                    onChange={(e) => setApproveDraft({ ...approveDraft, answer: e.target.value })}
                    placeholder="Nhập câu trả lời giải đáp đầy đủ cho khách hàng..."
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Chuyên mục</label>
                  <select
                    value={approveDraft.category}
                    onChange={(e) => setApproveDraft({ ...approveDraft, category: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  >
                    <option value="general">Thông tin chung</option>
                    <option value="policy">Chính sách</option>
                    <option value="technical">Kỹ thuật & Cài đặt</option>
                    <option value="support">Hỗ trợ & Liên hệ</option>
                    <option value="troubleshooting">Xử lý lỗi</option>
                  </select>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsApproveOpen(false)}
                  disabled={actionBusy}
                  className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmApproval}
                  disabled={actionBusy}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <CheckIcon className="w-3.5 h-3.5" />
                  <span>{actionBusy ? 'Đang xuất bản...' : 'Xác nhận xuất bản'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 3: Reject Modal */}
      {isRejectOpen &&
        selectedGap &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-white dark:bg-[#131C32] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-scale-up">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base font-bold text-rose-600 dark:text-rose-400">Từ chối Knowledge Gap</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Đánh dấu câu hỏi này không tạo FAQ (Spam, ngoài phạm vi, v.v.)
                </p>
              </div>

              <div className="p-5 space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Lý do từ chối (Tùy chọn)</label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ví dụ: Câu hỏi ngoài phạm vi kinh doanh, spam, v.v."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsRejectOpen(false)}
                  disabled={actionBusy}
                  className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmRejection}
                  disabled={actionBusy}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors"
                >
                  {actionBusy ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 4: Smart Merge Modal */}
      {isMergeOpen &&
        selectedGap &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-xl bg-white dark:bg-[#131C32] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <MergeIcon className="w-5 h-5 text-blue-500" />
                  <span>Gộp Knowledge Gaps (Smart Merge)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Chọn các câu hỏi đồng nghĩa để gộp vào câu hỏi chính: <span className="font-bold text-slate-700 dark:text-slate-200">"{selectedGap.canonicalQuestion}"</span>
                </p>
              </div>

              <div className="p-5 space-y-3 overflow-y-auto">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Chọn các câu hỏi cần gộp vào đây:
                </label>
                <div className="space-y-1.5 max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 p-2 divide-y divide-slate-100 dark:divide-slate-800/50">
                  {gaps
                    .filter((g) => g.id !== selectedGap.id && g.status !== 'merged')
                    .map((item) => {
                      const isChecked = mergeSourceIds.includes(item.id);
                      return (
                        <label
                          key={item.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setMergeSourceIds([...mergeSourceIds, item.id]);
                              } else {
                                setMergeSourceIds(mergeSourceIds.filter((id) => id !== item.id));
                              }
                            }}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {item.canonicalQuestion}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {item.occurrenceCount} lượt hỏi • {item.priority}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsMergeOpen(false)}
                  disabled={actionBusy}
                  className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmMerge}
                  disabled={actionBusy || mergeSourceIds.length === 0}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs transition-colors"
                >
                  {actionBusy ? 'Đang gộp...' : 'Xác nhận gộp (' + mergeSourceIds.length + ')'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 5: Edit FAQ With Version History Modal */}
      {isEditFaqOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-xl bg-white dark:bg-[#131C32] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpenIcon className="w-5 h-5 text-[#2563EB]" />
                  <span>Cập nhật FAQ & Lưu lịch sử phiên bản</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Mọi chỉnh sửa sẽ được lưu lại vết Audit Trail phục vụ quản trị.
                </p>
              </div>

              <div className="p-5 space-y-3.5 overflow-y-auto">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Câu hỏi FAQ</label>
                  <input
                    type="text"
                    value={editFaqDraft.question}
                    onChange={(e) => setEditFaqDraft({ ...editFaqDraft, question: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Câu trả lời FAQ</label>
                  <textarea
                    rows={4}
                    value={editFaqDraft.answer}
                    onChange={(e) => setEditFaqDraft({ ...editFaqDraft, answer: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Lý do cập nhật</label>
                  <input
                    type="text"
                    value={editFaqDraft.reason}
                    onChange={(e) => setEditFaqDraft({ ...editFaqDraft, reason: e.target.value })}
                    placeholder="Ví dụ: Cập nhật chính sách mới tháng 9"
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsEditFaqOpen(false)}
                  disabled={actionBusy}
                  className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmEditFaq}
                  disabled={actionBusy}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white shadow-xs transition-colors"
                >
                  {actionBusy ? 'Đang lưu...' : 'Lưu phiên bản mới'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 6: Reject & Remember Negative Policy Modal */}
      {isRejectRememberOpen &&
        selectedGap &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-xl bg-white dark:bg-[#131C32] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-scale-up">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheckIcon className="w-5 h-5 text-amber-500" />
                  <span>Từ Chối & Ghi Nhớ Negative Policy</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Định hình ranh giới phạm vi dịch vụ. Khi khách hỏi lại, Agent sẽ giải thích dứt khoát và điều hướng đúng đắn.
                </p>
              </div>

              <div className="p-5 space-y-3.5 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Loại phạm vi (Scope Type)</label>
                    <select
                      value={rejectRememberDraft.scopeType}
                      onChange={(e) => setRejectRememberDraft({ ...rejectRememberDraft, scopeType: e.target.value as any })}
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
                    >
                      <option value="APP">Ứng dụng (APP)</option>
                      <option value="CATEGORY">Danh mục (CATEGORY)</option>
                      <option value="ACTION">Hành động / Thao tác</option>
                      <option value="GENERAL">Chính sách chung</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Đối tượng áp dụng</label>
                    <input
                      type="text"
                      value={rejectRememberDraft.scopeValue}
                      onChange={(e) => setRejectRememberDraft({ ...rejectRememberDraft, scopeValue: e.target.value })}
                      placeholder="Ví dụ: Ultraviewer, Cài đặt từ xa"
                      className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Câu trả lời chính thức của Shop khi khách hỏi</label>
                  <textarea
                    rows={4}
                    value={rejectRememberDraft.answer}
                    onChange={(e) => setRejectRememberDraft({ ...rejectRememberDraft, answer: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsRejectRememberOpen(false)}
                  disabled={actionBusy}
                  className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmRejectRemember}
                  disabled={actionBusy}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors"
                >
                  {actionBusy ? 'Đang lưu...' : 'Lưu Negative Policy'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 7: Edit Negative Policy Modal */}
      {isEditPolicyOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-xl bg-white dark:bg-[#131C32] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-scale-up">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheckIcon className="w-5 h-5 text-amber-500" />
                  <span>Chỉnh Sửa Negative Policy</span>
                </h3>
              </div>

              <div className="p-5 space-y-3.5 overflow-y-auto max-h-[70vh]">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Đối tượng áp dụng</label>
                  <input
                    type="text"
                    value={editPolicyDraft.scopeValue}
                    onChange={(e) => setEditPolicyDraft({ ...editPolicyDraft, scopeValue: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Câu trả lời của Shop</label>
                  <textarea
                    rows={4}
                    value={editPolicyDraft.answer}
                    onChange={(e) => setEditPolicyDraft({ ...editPolicyDraft, answer: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsEditPolicyOpen(false)}
                  disabled={actionBusy}
                  className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmEditPolicy}
                  disabled={actionBusy}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors"
                >
                  {actionBusy ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 7: Phase 6.8 Action Snooze Modal */}
      {isSnoozeOpen &&
        selectedAction &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-white dark:bg-[#131C32] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-scale-up">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Hoãn xử lý khuyến nghị</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Hành động sẽ được ẩn và tự động mở lại sau khi hết thời gian
                  </p>
                </div>
                <button
                  onClick={() => setIsSnoozeOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-200 block">{selectedAction.title}</span>
                  <span className="text-slate-400 text-[11px] mt-0.5 block">{selectedAction.decisionFingerprint}</span>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Thời gian hoãn:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { days: 1, label: '24 giờ' },
                      { days: 3, label: '3 ngày' },
                      { days: 7, label: '7 ngày' },
                      { days: 14, label: '14 ngày' },
                      { days: 30, label: '30 ngày' },
                    ].map((opt) => (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setSnoozeDays(opt.days)}
                        className={'px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ' + (
                          snoozeDays === opt.days
                            ? 'bg-[#2563EB] text-white border-[#2563EB]'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Lý do hoãn (tùy chọn):</label>
                  <input
                    type="text"
                    placeholder="VD: Chờ đối tác cập nhật chính sách, chưa đủ dữ liệu..."
                    value={snoozeReason}
                    onChange={(e) => setSnoozeReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsSnoozeOpen(false)}
                  disabled={actionBusy}
                  className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmSnooze}
                  disabled={actionBusy}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-[#2563EB] hover:bg-[#1d4ed8] text-white shadow-xs"
                >
                  {actionBusy ? 'Đang lưu...' : 'Xác nhận hoãn'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL 8: Phase 6.8 Action Outcome Measurement Modal */}
      {isOutcomeOpen &&
        selectedAction &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg bg-white dark:bg-[#131C32] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-scale-up">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Ghi nhận kết quả đo lường (Outcome)</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Đo lường hiệu quả thực tế sau khi áp dụng thay đổi
                  </p>
                </div>
                <button
                  onClick={() => setIsOutcomeOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="font-bold text-slate-700 dark:text-slate-200 block">{selectedAction.title}</span>
                  <span className="text-slate-400 text-[11px] block">{selectedAction.reason}</span>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Đánh giá hiệu quả thực tế:</label>
                  <select
                    value={outcomeDraft.effectiveness}
                    onChange={(e) => setOutcomeDraft({ ...outcomeDraft, effectiveness: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
                  >
                    <option value="EXCELLENT">EXCELLENT (Rất hiệu quả — cải thiện vượt bậc)</option>
                    <option value="EFFECTIVE">EFFECTIVE (Hiệu quả — đạt kỳ vọng)</option>
                    <option value="NEUTRAL">NEUTRAL (Trung tính — chưa thấy rõ tác động)</option>
                    <option value="INEFFECTIVE">INEFFECTIVE (Không hiệu quả)</option>
                    <option value="REGRESSED">REGRESSED (Suy giảm — gây lỗi hoặc rớt tỷ lệ khớp)</option>
                    <option value="INSUFFICIENT_DATA">INSUFFICIENT_DATA (Chưa đủ dữ liệu quan sát)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Cửa sổ quan sát (Observation Window):</label>
                  <div className="grid grid-cols-5 gap-2">
                    {(['24H', '3D', '7D', '14D', '30D'] as ObservationWindow[]).map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setOutcomeDraft({ ...outcomeDraft, window: w })}
                        className={'px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors text-center ' + (
                          outcomeDraft.window === w
                            ? 'bg-[#2563EB] text-white border-[#2563EB]'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        )}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Ghi chú phản hồi / Lý do:</label>
                  <textarea
                    rows={3}
                    placeholder="VD: FAQ đã được người dùng đánh giá cao, không còn câu hỏi lặp lại..."
                    value={outcomeDraft.feedbackReason}
                    onChange={(e) => setOutcomeDraft({ ...outcomeDraft, feedbackReason: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsOutcomeOpen(false)}
                  disabled={actionBusy}
                  className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  onClick={handleConfirmOutcome}
                  disabled={actionBusy}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  {actionBusy ? 'Đang lưu...' : 'Lưu kết quả đo lường'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
