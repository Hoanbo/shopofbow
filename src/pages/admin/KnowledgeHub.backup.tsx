// src/pages/admin/KnowledgeHub.tsx
// BOW Agent V3.3 Phase 6.2 — Knowledge Operations & FAQ Quality Control Dashboard

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
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
import type {
  KnowledgePriority,
  FaqQualityMetrics,
  FaqEditHistoryItem,
  NegativePolicy,
  PolicyScopeType,
  IntelligenceDashboardSummary,
} from '../../services/agent/monitoring/analyticsTypes';
import {
  SearchIcon,
  SparkIcon,
  CheckIcon,
  CloseIcon,
} from '../../components/icons';

const STATUS_CONFIG: Record<
  KnowledgeGapStatus,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  new: { label: 'Mới', bg: 'bg-red-500/10 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/30', icon: '🔴' },
  reviewing: { label: 'Đang xem xét', bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30', icon: '🟡' },
  approved: { label: 'Đã duyệt FAQ', bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30', icon: '🟢' },
  rejected: { label: 'Đã từ chối', bg: 'bg-slate-500/10 dark:bg-slate-500/20', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-500/30', icon: '⚪' },
  merged: { label: 'Đã gộp', bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30', icon: '🔵' },
};

const PRIORITY_CONFIG: Record<
  KnowledgePriority,
  { label: string; bg: string; text: string; icon: string }
> = {
  HIGH: { label: 'Ưu tiên cao', bg: 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 border-rose-500/30', text: 'text-rose-600', icon: '🔥' },
  MEDIUM: { label: 'Ưu tiên vừa', bg: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30', text: 'text-amber-600', icon: '⚡' },
  LOW: { label: 'Ưu tiên thấp', bg: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300 border-slate-300 dark:border-slate-700', text: 'text-slate-500', icon: '💤' },
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
    'all' | KnowledgeGapStatus | 'faq-health' | 'negative-policies' | 'intelligence'
  >('all');
  const [selectedPriority, setSelectedPriority] = useState<KnowledgePriority | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'frequency' | 'priority' | 'newest' | 'oldest' | 'updated'>('priority');

  // FAQ Health state
  const [faqMetrics, setFaqMetrics] = useState<FaqQualityMetrics[]>([]);
  const [editHistory, setEditHistory] = useState<FaqEditHistoryItem[]>([]);

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
  const [conflictWarningMsg, setConflictWarningMsg] = useState<string | null>(null);
  const [isEditPolicyOpen, setIsEditPolicyOpen] = useState(false);
  const [editPolicyDraft, setEditPolicyDraft] = useState<{ id: string; answer: string; reason: string; scopeValue: string }>({
    id: '',
    answer: '',
    reason: '',
    scopeValue: '',
  });

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
        status: activeTab !== 'all' && activeTab !== 'faq-health' && activeTab !== 'negative-policies' && activeTab !== 'intelligence' ? activeTab : undefined,
        priority: selectedPriority !== 'all' ? selectedPriority : undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        search: searchQuery,
        sortBy,
      });
      setGaps(data);

      // Load FAQ Health
      const metrics = await calculateFaqQualityAndStaleMetrics(undefined, undefined, data);
      setFaqMetrics(metrics);

      const history = await getFaqEditHistory();
      setEditHistory(history);

      // Load Negative Policies
      const policies = await getNegativePolicies({ search: searchQuery });
      setNegativePolicies(policies);

      // Load Knowledge Intelligence Platform Summary
      const intel = await getIntelligenceDashboardSummary();
      setIntelligenceSummary(intel);
    } catch (err) {
      console.error('Failed to load knowledge gaps:', err);
      toast.error('Lỗi tải danh sách Knowledge Gaps');
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
    const highPriority = gaps.filter((g) => g.priority === 'HIGH' && g.status !== 'approved' && g.status !== 'rejected').length;
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
      (g) => (g.priority === 'HIGH' || g.occurrenceCount >= 5) && g.status !== 'approved' && g.status !== 'rejected' && g.status !== 'merged'
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
        toast.info('AI đang offline / quá tải. Đã tạo mẫu câu trả lời chuẩn.');
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
        toast.success(`Đã gộp thành công ${res.mergedCount} câu hỏi vào Gap chính!`);
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
    const scopeVal = gap.canonicalQuestion
      .replace(/shop|co|ho|tro|cai|dat|app|khong|ko|ạ|\?|\!|\./gi, '')
      .trim()
      .split(/\s+/)[0] || 'general';

    setRejectRememberDraft({
      scopeType: 'APP',
      scopeValue: scopeVal,
      answer: `Hiện tại Shop of BOW chưa hỗ trợ ${scopeVal}. Bạn vui lòng tham khảo các dịch vụ đang có trên danh mục của Shop nhé! ✨`,
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

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>🧠 Knowledge Hub & Operations</span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400 border border-brand-500/20">
              V3.3 Phase 6.2
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quản lý tri thức toàn diện, phân hạng ưu tiên (Priority Scoring), kiểm soát chất lượng (Quality Control) & phát hiện FAQ lỗi thời.
          </p>
        </div>
      </div>

      {/* 2. Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {[
          { label: 'Tổng số câu hỏi', value: stats.total, color: 'text-slate-900 dark:text-white', icon: '📊' },
          { label: '🔥 Cần chú ý (Cao)', value: stats.highPriority, color: 'text-rose-600 dark:text-rose-400', icon: '🔥' },
          { label: 'Mới phát hiện', value: stats.newCount, color: 'text-red-500', icon: '🔴' },
          { label: 'Đang xem xét', value: stats.reviewingCount, color: 'text-amber-500', icon: '🟡' },
          { label: 'Đã duyệt FAQ', value: stats.approvedCount, color: 'text-emerald-500', icon: '🟢' },
          { label: 'Đã gộp (Merged)', value: stats.mergedCount, color: 'text-blue-500', icon: '🔵' },
        ].map((item, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm"
          >
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>{item.label}</span>
              <span>{item.icon}</span>
            </div>
            <div className={`text-2xl font-bold mt-2 ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* 3. High Priority / Needs Attention Spotlight Section */}
      {needsAttentionGaps.length > 0 && activeTab !== 'faq-health' && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-transparent border border-rose-500/20 dark:border-rose-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <span>🔥 CẦN CHÚ Ý: CÂU HỎI TẦN SUẤT CAO CHƯA CÓ FAQ ({needsAttentionGaps.length})</span>
            </h2>
            <span className="text-xs text-rose-600/80 dark:text-rose-400/80">Ưu tiên xử lý trước để giảm tải hỗ trợ</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {needsAttentionGaps.slice(0, 3).map((gap) => (
              <div
                key={gap.id}
                className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-800/90 border border-rose-200 dark:border-rose-900/40 shadow-sm space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-rose-600 dark:text-rose-400">🔥 {gap.occurrenceCount} lượt hỏi</span>
                    <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {CATEGORY_LABELS[gap.category] || gap.category}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white mt-1.5 line-clamp-2">
                    {gap.canonicalQuestion}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/60">
                  <span className="text-[11px] text-slate-400">Gần nhất: {new Date(gap.lastSeenAt).toLocaleDateString('vi-VN')}</span>
                  <button
                    onClick={() => handleOpenDetail(gap)}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-rose-600 text-white hover:bg-rose-700 transition-colors"
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
      <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700/60 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-sm scrollbar-none">
            {[
              { id: 'all', label: 'Tất cả Gaps' },
              { id: 'new', label: '🔴 Mới' },
              { id: 'reviewing', label: '🟡 Đang xem' },
              { id: 'approved', label: '🟢 Đã duyệt' },
              { id: 'rejected', label: '⚪ Đã từ chối' },
              { id: 'merged', label: '🔵 Đã gộp' },
              { id: 'faq-health', label: '🩺 Sức khỏe FAQ' },
              { id: 'negative-policies', label: '🧠 Negative Policies' },
              { id: 'intelligence', label: '📊 Knowledge Intelligence' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab !== 'faq-health' && (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5 relative">
              <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm câu hỏi hoặc biến thể..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
              >
                <option value="all">Tất cả mức ưu tiên</option>
                <option value="HIGH">🔥 Ưu tiên cao</option>
                <option value="MEDIUM">⚡ Ưu tiên vừa</option>
                <option value="LOW">💤 Ưu tiên thấp</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
              >
                <option value="all">Tất cả chuyên mục</option>
                <option value="policy">Chính sách</option>
                <option value="technical">Kỹ thuật & Cài đặt</option>
                <option value="support">Hỗ trợ & Liên hệ</option>
                <option value="troubleshooting">Xử lý lỗi</option>
                <option value="general">Thông tin chung</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
              >
                <option value="priority">Sắp xếp theo độ ưu tiên</option>
                <option value="frequency">Tần suất hỏi nhiều nhất</option>
                <option value="newest">Mới phát hiện nhất</option>
                <option value="oldest">Cũ nhất</option>
                <option value="updated">Mới cập nhật</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 5. Content Area: Knowledge Intelligence Platform OR Negative Policies OR FAQ Health OR Gap List */}
      {activeTab === 'intelligence' ? (
        <div className="space-y-6">
          {/* A. Top 6 Intelligence KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <span>🩺 Sức khỏe FAQ</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-emerald-600">
                {intelligenceSummary?.overallHealthScore ?? 90}
                <span className="text-xs font-normal text-slate-400">/100</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <span>🌐 Độ phủ kiến thức</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-brand-600">
                {intelligenceSummary?.overallCoveragePercentage ?? 85}%
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <span>🛡️ Negative Policies</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-amber-600">
                {intelligenceSummary?.activePoliciesCount ?? 0}
                <span className="text-xs font-normal text-slate-400"> Active</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <span>🚀 Chủ đề mới</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-indigo-600">
                {intelligenceSummary?.emergingTopicsCount ?? 0}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <span>⚠️ Xung đột chính sách</span>
              </div>
              <div className={`text-2xl font-bold mt-1 ${(intelligenceSummary?.activeConflictsCount ?? 0) > 0 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200'}`}>
                {intelligenceSummary?.activeConflictsCount ?? 0}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <span>💡 Đề xuất Admin</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-purple-600">
                {intelligenceSummary?.openRecommendationsCount ?? 0}
              </div>
            </div>
          </div>

          {/* B. Actionable Admin Recommendations Feed */}
          {intelligenceSummary && intelligenceSummary.recommendations.length > 0 && (
            <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-sm overflow-hidden p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🤖 Đề Xuất Cải Thiện Kiến Thức Của AI ({intelligenceSummary.recommendations.length})</span>
                </h2>
                <span className="text-xs text-slate-400">Tự động phân tích từ Telemetry & User Gaps</span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {intelligenceSummary.recommendations.map((rec) => (
                  <div key={rec.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          rec.priority === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-700 border border-rose-500/20'
                            : rec.priority === 'HIGH'
                            ? 'bg-amber-100 text-amber-800 border border-amber-500/20'
                            : rec.priority === 'MEDIUM'
                            ? 'bg-blue-100 text-blue-800 border border-blue-500/20'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}>
                          {rec.priority === 'CRITICAL' ? '🚨 KHẨN CẤP' : rec.priority === 'HIGH' ? '🔥 ƯU TIÊN CAO' : rec.priority === 'MEDIUM' ? '⚡ CẦN XEM' : '💤 GỢI Ý'}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white text-sm">{rec.title}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{rec.reason}</p>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3">
                        <span>📊 {rec.evidence}</span>
                        <span>💡 <strong>Gợi ý:</strong> {rec.actionPrompt}</span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <button
                        onClick={() => {
                          if (rec.type === 'RESOLVE_CONFLICT') setActiveTab('faq-health');
                          else if (rec.type === 'REVIEW_NEGATIVE_POLICY') setActiveTab('negative-policies');
                          else setActiveTab('all');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-600 border border-brand-500/20 transition-colors"
                      >
                        Thực hiện →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* C. Domain Coverage Matrix & Emerging Topics (Grid 2 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Domain Coverage */}
            <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-sm p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>📊 Độ Phủ Kiến Thức Theo Chuyên Mục (Coverage)</span>
              </h2>

              <div className="space-y-3">
                {intelligenceSummary?.coverageReport.domainCoverages.map((d) => (
                  <div key={d.domain} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">{d.domain}</span>
                      <span className={`${d.coveragePercentage >= 80 ? 'text-emerald-600 font-bold' : d.coveragePercentage >= 60 ? 'text-amber-600 font-bold' : 'text-rose-600 font-bold'}`}>
                        {d.coveragePercentage}% ({d.resolvedQueries}/{d.totalQueries} câu)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          d.coveragePercentage >= 80 ? 'bg-emerald-500' : d.coveragePercentage >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${d.coveragePercentage}%` }}
                      />
                    </div>
                    {d.topMissingTopic && (
                      <div className="text-[11px] text-slate-400 truncate">
                        Thiếu FAQ: "{d.topMissingTopic}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Emerging Topics & Surge Radar */}
            <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-sm p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>🚀 Radar Chủ Đề Mới Phát Sinh (Emerging Topics)</span>
              </h2>

              {(intelligenceSummary?.emergingTopics.length ?? 0) === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Chưa ghi nhận xu hướng tăng đột biến nào trong 7 ngày qua.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                  {intelligenceSummary?.emergingTopics.map((em) => (
                    <div key={em.id} className="py-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm">{em.topicName}</span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                          +{em.growthRatePercentage}% Tăng trưởng
                        </span>
                      </div>
                      <div className="text-slate-500 flex items-center gap-3 text-[11px]">
                        <span>🔥 {em.queryCount} lượt hỏi</span>
                        <span>👤 {em.uniqueUsers} khách</span>
                        <span>Phân loại: <strong>{em.classification}</strong></span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px]">{em.recommendation}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* D. Knowledge Conflicts & Overlaps Inspector */}
          {intelligenceSummary && intelligenceSummary.conflicts.length > 0 && (
            <div className="bg-white dark:bg-slate-800/80 border border-rose-200 dark:border-rose-900/40 rounded-xl shadow-sm p-5 space-y-3">
              <h2 className="text-base font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <span>⚠️ Phát Hiện Xung Đột Chính Sách / FAQ ({intelligenceSummary.conflicts.length})</span>
              </h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                {intelligenceSummary.conflicts.map((c) => (
                  <div key={c.id} className="py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-700">
                        {c.severity} SEVERITY ({c.similarityPercentage}% Tương đồng)
                      </span>
                      <span className="text-slate-400 text-[11px]">{new Date(c.detectedAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/20">
                        <div className="font-semibold text-emerald-700 dark:text-emerald-300">{c.entityA.type}:</div>
                        <div>"{c.entityA.title}"</div>
                      </div>
                      <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-500/20">
                        <div className="font-semibold text-amber-700 dark:text-amber-300">{c.entityB.type}:</div>
                        <div>"{c.entityB.title}"</div>
                      </div>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px]">{c.conflictDescription}</p>
                    <div className="text-[11px] font-semibold text-brand-600">💡 Đề xuất: {c.recommendedResolution}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* E. Query Semantic Clusters */}
          {intelligenceSummary && intelligenceSummary.topQueryClusters.length > 0 && (
            <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-sm p-5 space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>🧩 Các Nhóm Câu Hỏi Ngữ Nghĩa Phổ Biến (Semantic Query Clusters)</span>
              </h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60 text-xs">
                {intelligenceSummary.topQueryClusters.map((cl) => (
                  <div key={cl.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white text-sm">"{cl.canonicalTopic}"</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {cl.targetDomain}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        🔥 {cl.occurrenceCount} lượt hỏi • {cl.uniqueVariants.length} biến thể • Phân loại: <strong>{cl.intent}</strong>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xl">
                        Mẫu biến thể: {cl.uniqueVariants.slice(0, 3).map((v) => `"${v}"`).join(', ')}
                      </div>
                    </div>
                    <div>
                      <span className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                        {cl.suggestedAction || 'THEO DÕI'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'negative-policies' ? (
        <div className="space-y-6">
          {/* Negative Policies Analytics & Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="text-xs font-medium text-slate-500">Tổng Negative Policies</div>
              <div className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{negativePolicies.length}</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="text-xs font-medium text-slate-500">Đang hoạt động (Active)</div>
              <div className="text-2xl font-bold mt-1 text-emerald-600">
                {negativePolicies.filter((p) => p.status === 'ACTIVE').length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="text-xs font-medium text-slate-500">🔥 Câu hỏi đã ngăn chặn thành công</div>
              <div className="text-2xl font-bold mt-1 text-brand-600">
                {negativePolicies.reduce((sum, p) => sum + (p.usageCount || 0), 0)}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-sm overflow-hidden p-5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              🧠 Danh Sách Negative Policies & Quyết Định Không Hỗ Trợ ({negativePolicies.length})
            </h2>

            {negativePolicies.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                Chưa có Negative Policy nào được tạo. Khi bạn bấm "Từ chối & Ghi nhớ" trên Knowledge Gap, policy sẽ xuất hiện tại đây.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-700/60">
                {negativePolicies.map((pol) => (
                  <div key={pol.id} className="py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                          pol.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-500/20'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}>
                          {pol.status === 'ACTIVE' ? '🟢 Hoạt động' : '⚪ Đã tạm ngưng'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          {pol.scopeType}: {pol.scopeValue}
                        </span>
                        <span className="text-xs text-slate-500">
                          🛡️ Đã ngăn chặn: <strong>{pol.usageCount || 0}</strong> câu hỏi lặp lại
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Mẫu: "{pol.questionPattern}"</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg">
                        <strong>Phản hồi:</strong> {pol.answer}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleOpenEditPolicy(pol)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200"
                      >
                        ✏️ Sửa
                      </button>
                      {pol.status === 'ACTIVE' ? (
                        <button
                          onClick={() => handleDeactivatePolicy(pol.id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-500/30"
                        >
                          ⏸️ Tạm ngưng
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivatePolicy(pol.id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-500/30"
                        >
                          ▶️ Kích hoạt lại
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'faq-health' ? (
        <div className="space-y-6">
          {/* FAQ Quality & Stale Overview */}
          <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-sm overflow-hidden p-5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span>🩺 Bảng Sức Khỏe & Tần Suất Sử Dụng FAQ ({faqMetrics.length} câu hỏi)</span>
            </h2>

            <div className="divide-y divide-slate-200 dark:divide-slate-700/60">
              {faqMetrics.map((fm) => (
                <div key={fm.faqId} className="py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                        fm.staleStatus === 'CURRENT'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-500/20'
                          : fm.staleStatus === 'NEEDS_REVIEW'
                          ? 'bg-amber-50 text-amber-700 border border-amber-500/20'
                          : 'bg-slate-100 text-slate-700 border border-slate-300'
                      }`}>
                        {fm.staleStatus === 'CURRENT' ? '🟢 Tốt / Chuẩn' : fm.staleStatus === 'NEEDS_REVIEW' ? '🟡 Cần xem lại' : '⚪ Lỗi thời'}
                      </span>

                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                        ⭐ Điểm chất lượng: {fm.qualityScore}/100
                      </span>

                      <span className="text-xs text-slate-500">
                        🔥 Đã dùng: <strong>{fm.usageCount}</strong> lần
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">{fm.question}</h3>
                    {fm.staleReason && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">⚠️ {fm.staleReason}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        const target = faqMetrics.find((f) => f.faqId === fm.faqId);
                        setEditFaqDraft({
                          id: fm.faqId,
                          question: target?.question || '',
                          answer: '',
                          reason: '',
                        });
                        setIsEditFaqOpen(true);
                      }}
                      className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-600 border border-brand-500/20 transition-colors"
                    >
                      ✏️ Cập nhật & Lưu Version
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ Version Edit History */}
          {editHistory.length > 0 && (
            <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-sm overflow-hidden p-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">📜 Lịch Sử Thay Đổi FAQ ({editHistory.length})</h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-700/40 text-xs">
                {editHistory.slice(0, 5).map((h) => (
                  <div key={h.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>Thời gian: {new Date(h.timestamp).toLocaleString('vi-VN')}</span>
                      <span>Lý do: <strong>{h.reason || 'Cập nhật nội dung'}</strong></span>
                    </div>
                    <div className="text-slate-800 dark:text-slate-200">
                      <strong>Câu hỏi:</strong> {h.after.question}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <div className="w-8 h-8 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mx-auto mb-3" />
              Đang tải dữ liệu Knowledge Gaps...
            </div>
          ) : gaps.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <div className="text-4xl mb-2">🎉</div>
              <div className="font-semibold text-slate-700 dark:text-slate-200">Không có Knowledge Gap nào</div>
              <p className="text-xs text-slate-400 mt-1">Toàn bộ câu hỏi người dùng đều đã được FAQ hoặc hệ thống xử lý tốt.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700/60">
              {gaps.map((gap) => {
                const statusCfg = STATUS_CONFIG[gap.status] || STATUS_CONFIG.new;
                const priorityCfg = PRIORITY_CONFIG[gap.priority] || PRIORITY_CONFIG.LOW;

                return (
                  <div
                    key={gap.id}
                    className="p-4 sm:p-5 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${priorityCfg.bg}`}>
                          <span>{priorityCfg.icon}</span>
                          <span>{priorityCfg.label} ({gap.priorityScore}đ)</span>
                        </span>

                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                          <span>{statusCfg.icon}</span>
                          <span>{statusCfg.label}</span>
                        </span>

                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {CATEGORY_LABELS[gap.category] || gap.category}
                        </span>

                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                          🔥 {gap.occurrenceCount} lượt hỏi
                        </span>
                      </div>

                      <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                        {gap.canonicalQuestion}
                      </h3>

                      <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>Lần đầu: {new Date(gap.firstSeenAt).toLocaleDateString('vi-VN')}</span>
                        <span>Gần nhất: {new Date(gap.lastSeenAt).toLocaleDateString('vi-VN')}</span>
                        <span>{gap.sampleQueries.length} mẫu biến thể</span>
                        {gap.priorityReasons.length > 0 && (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            • {gap.priorityReasons[0]}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleOpenDetail(gap)}
                        className="px-3.5 py-2 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        👁️ Xem chi tiết
                      </button>

                      <button
                        onClick={() => {
                          setSelectedGap(gap);
                          setIsMergeOpen(true);
                        }}
                        className="px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-500/20 transition-colors"
                      >
                        🔗 Gộp (Merge)
                      </button>

                      <button
                        onClick={() => {
                          setSelectedGap(gap);
                          handleGenerateSuggestion(gap);
                        }}
                        disabled={generatingAi}
                        className="px-3.5 py-2 text-xs font-medium rounded-lg bg-brand-50 hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-900/50 text-brand-600 dark:text-brand-400 border border-brand-500/20 transition-colors flex items-center gap-1.5"
                      >
                        <SparkIcon className="w-3.5 h-3.5" />
                        <span>{generatingAi && selectedGap?.id === gap.id ? 'Đang tạo...' : 'Gợi ý AI & Duyệt'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. Modal Chi Tiết Knowledge Gap */}
      {isDetailOpen && selectedGap && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Chi tiết Knowledge Gap</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Xem xét và quản lý câu hỏi chưa có trong FAQ</p>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Câu hỏi chính (Canonical)</label>
                <div className="text-base font-semibold text-slate-900 dark:text-white p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  {selectedGap.canonicalQuestion}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-slate-500">Mức độ ưu tiên:</span>
                  <div className="font-semibold text-rose-600 dark:text-rose-400">
                    {PRIORITY_CONFIG[selectedGap.priority]?.label} ({selectedGap.priorityScore} điểm)
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-slate-500">Tần suất xuất hiện:</span>
                  <div className="font-semibold text-brand-600 dark:text-brand-400">
                    {selectedGap.occurrenceCount} lần hỏi
                  </div>
                </div>
              </div>

              {/* Sample Queries */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Mẫu các câu hỏi thực tế của người dùng ({selectedGap.sampleQueries.length})
                </label>
                <div className="space-y-1.5">
                  {selectedGap.sampleQueries.map((sq, i) => (
                    <div
                      key={i}
                      className="text-xs px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300"
                    >
                      • "{sq}"
                    </div>
                  ))}
                </div>
              </div>

              {/* Similar FAQs Warning */}
              {similarFaqs.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <span>⚠️ Phát hiện {similarFaqs.length} FAQ tương tự trong hệ thống</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {similarFaqs.slice(0, 2).map((m, idx) => (
                      <div key={idx} className="p-2 rounded bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300">
                        <div className="font-semibold text-slate-900 dark:text-white">Q: {m.faq.question}</div>
                        <div className="text-slate-500 line-clamp-1">A: {m.faq.answer}</div>
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Độ tương đồng: {m.similarity}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsRejectOpen(true)}
                  title="Từ chối câu hỏi này (Không tạo FAQ và không ghi nhớ quyết định phủ định)"
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                >
                  ✕ Từ chối
                </button>

                <button
                  onClick={() => handleOpenRejectRemember(selectedGap)}
                  title="Ghi nhớ quyết định không hỗ trợ để Agent trả lời nhất quán và không tạo gap lặp lại"
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-500/30 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 dark:text-amber-300 transition-colors flex items-center gap-1.5"
                >
                  <span>🧠 Từ chối & Ghi nhớ</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
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
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5"
                >
                  <CheckIcon className="w-3.5 h-3.5" />
                  <span>Duyệt tạo FAQ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal Phê Duyệt & Chỉnh Sửa FAQ */}
      {isApproveOpen && selectedGap && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>✅ Phê duyệt & Thêm vào FAQ chính thức</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Admin xác nhận và chỉnh sửa nội dung trước khi xuất bản thành Global FAQ.
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Câu hỏi FAQ (Hiển thị cho khách)</label>
                <input
                  type="text"
                  value={approveDraft.question}
                  onChange={(e) => setApproveDraft({ ...approveDraft, question: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Câu trả lời chính thức</label>
                <textarea
                  rows={4}
                  value={approveDraft.answer}
                  onChange={(e) => setApproveDraft({ ...approveDraft, answer: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-500 font-medium">Chuyên mục:</label>
                  <select
                    value={approveDraft.category}
                    onChange={(e) => setApproveDraft({ ...approveDraft, category: e.target.value })}
                    className="w-full mt-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="policy">Chính sách</option>
                    <option value="technical">Kỹ thuật & Cài đặt</option>
                    <option value="support">Hỗ trợ & Liên hệ</option>
                    <option value="troubleshooting">Xử lý lỗi</option>
                    <option value="general">Thông tin chung</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-500 font-medium">Phạm vi áp dụng:</label>
                  <div className="mt-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg font-semibold text-slate-700 dark:text-slate-200">
                    Toàn hệ thống (Global FAQ)
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsApproveOpen(false)}
                disabled={actionBusy}
                className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmApproval}
                disabled={actionBusy}
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5"
              >
                <CheckIcon className="w-3.5 h-3.5" />
                <span>{actionBusy ? 'Đang lưu...' : 'Xác nhận tạo FAQ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal Smart Merge Knowledge Gaps */}
      {isMergeOpen && selectedGap && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Gộp các câu hỏi tương tự (Smart Merge)</h3>
            <p className="text-xs text-slate-500">
              Chọn các Knowledge Gap phụ để gộp vào câu hỏi chính <strong>"{selectedGap.canonicalQuestion}"</strong>.
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              {gaps
                .filter((g) => g.id !== selectedGap.id && g.status !== 'merged')
                .map((g) => {
                  const isChecked = mergeSourceIds.includes(g.id);
                  return (
                    <label
                      key={g.id}
                      className="flex items-center gap-2 text-xs p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMergeSourceIds([...mergeSourceIds, g.id]);
                          } else {
                            setMergeSourceIds(mergeSourceIds.filter((id) => id !== g.id));
                          }
                        }}
                        className="rounded text-brand-600"
                      />
                      <span className="flex-1 font-medium text-slate-800 dark:text-slate-200">{g.canonicalQuestion}</span>
                      <span className="text-slate-400">({g.occurrenceCount} lượt)</span>
                    </label>
                  );
                })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsMergeOpen(false)}
                disabled={actionBusy}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmMerge}
                disabled={actionBusy || mergeSourceIds.length === 0}
                className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm disabled:opacity-50"
              >
                {actionBusy ? 'Đang gộp...' : `Xác nhận gộp (${mergeSourceIds.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Modal Chỉnh Sửa FAQ & Version History */}
      {isEditFaqOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Cập nhật FAQ & Lưu vết lịch sử</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500">Câu hỏi:</label>
                <input
                  type="text"
                  value={editFaqDraft.question}
                  onChange={(e) => setEditFaqDraft({ ...editFaqDraft, question: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Câu trả lời:</label>
                <textarea
                  rows={3}
                  value={editFaqDraft.answer}
                  onChange={(e) => setEditFaqDraft({ ...editFaqDraft, answer: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500">Lý do cập nhật:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Cập nhật chính sách mới tháng 9/2026..."
                  value={editFaqDraft.reason}
                  onChange={(e) => setEditFaqDraft({ ...editFaqDraft, reason: e.target.value })}
                  className="w-full mt-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsEditFaqOpen(false)}
                disabled={actionBusy}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmEditFaq}
                disabled={actionBusy}
                className="px-4 py-1.5 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm"
              >
                {actionBusy ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Modal Từ Chối Knowledge Gap */}
      {isRejectOpen && selectedGap && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Xác nhận từ chối Knowledge Gap</h3>
            <p className="text-xs text-slate-500">
              Câu hỏi này sẽ được đánh dấu là Rejected và không tạo FAQ.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Lý do từ chối (Tùy chọn):</label>
              <input
                type="text"
                placeholder="Ví dụ: Câu hỏi không phù hợp, đã có trong quy chế..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsRejectOpen(false)}
                disabled={actionBusy}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmRejection}
                disabled={actionBusy}
                className="px-4 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm"
              >
                {actionBusy ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. Modal Từ Chối & Ghi Nhớ (Reject & Remember Decision) */}
      {isRejectRememberOpen && selectedGap && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🧠</span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Từ chối & Ghi nhớ quyết định (Negative Policy)
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Thiết lập chính sách chính thức rằng đối tượng này <strong>không được hỗ trợ</strong>. Các câu hỏi tương lai sẽ được Agent trả lời nhất quán và không tạo lại Knowledge Gap.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300">Câu hỏi gốc:</label>
                <div className="p-2 rounded bg-slate-100 dark:bg-slate-900 font-medium text-slate-800 dark:text-slate-200 mt-1">
                  "{selectedGap.canonicalQuestion}"
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300">Loại phạm vi (Scope Type):</label>
                  <select
                    value={rejectRememberDraft.scopeType}
                    onChange={(e) => setRejectRememberDraft({ ...rejectRememberDraft, scopeType: e.target.value as any })}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="APP">Ứng dụng (APP)</option>
                    <option value="SERVICE">Dịch vụ (SERVICE)</option>
                    <option value="TOPIC">Chủ đề (TOPIC)</option>
                    <option value="PRODUCT">Sản phẩm (PRODUCT)</option>
                    <option value="GLOBAL">Toàn hệ thống (GLOBAL)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300">Đối tượng cụ thể (Target/Scope):</label>
                  <input
                    type="text"
                    value={rejectRememberDraft.scopeValue}
                    onChange={(e) => setRejectRememberDraft({ ...rejectRememberDraft, scopeValue: e.target.value })}
                    placeholder="ví dụ: canva, ultraview..."
                    className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300">Câu trả lời chính thức của Agent:</label>
                <textarea
                  rows={3}
                  value={rejectRememberDraft.answer}
                  onChange={(e) => setRejectRememberDraft({ ...rejectRememberDraft, answer: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300">Lý do nội bộ (Admin Reason):</label>
                <input
                  type="text"
                  value={rejectRememberDraft.reason}
                  onChange={(e) => setRejectRememberDraft({ ...rejectRememberDraft, reason: e.target.value })}
                  placeholder="ví dụ: Không nằm trong danh mục hỗ trợ kỹ thuật"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              {conflictWarningMsg && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 font-medium">
                  {conflictWarningMsg}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsRejectRememberOpen(false)}
                disabled={actionBusy}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmRejectRemember}
                disabled={actionBusy}
                className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm"
              >
                {actionBusy ? 'Đang lưu...' : '🧠 Xác nhận & Ghi nhớ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 12. Modal Chỉnh Sửa Negative Policy */}
      {isEditPolicyOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Cập nhật Negative Policy</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300">Đối tượng áp dụng (Scope Value):</label>
                <input
                  type="text"
                  value={editPolicyDraft.scopeValue}
                  onChange={(e) => setEditPolicyDraft({ ...editPolicyDraft, scopeValue: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300">Câu trả lời chính thức:</label>
                <textarea
                  rows={3}
                  value={editPolicyDraft.answer}
                  onChange={(e) => setEditPolicyDraft({ ...editPolicyDraft, answer: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300">Lý do cập nhật:</label>
                <input
                  type="text"
                  value={editPolicyDraft.reason}
                  onChange={(e) => setEditPolicyDraft({ ...editPolicyDraft, reason: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsEditPolicyOpen(false)}
                disabled={actionBusy}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmEditPolicy}
                disabled={actionBusy}
                className="px-4 py-1.5 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg shadow-sm"
              >
                {actionBusy ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
