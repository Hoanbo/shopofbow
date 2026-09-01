export type AgentAnalyticsEventType =
  | 'SESSION_STARTED'
  | 'MESSAGE_RECEIVED'
  | 'INTENT_RESOLVED'
  | 'INTENT_UNRESOLVED'
  | 'PRODUCT_RESOLVED'
  | 'PRODUCT_UNRESOLVED'
  | 'PLAN_RESOLVED'
  | 'PLAN_UNRESOLVED'
  | 'CLARIFICATION_REQUESTED'
  | 'ACTION_SHOWN'
  | 'ACTION_CLICKED'
  | 'ACTION_EXPIRED'
  | 'ACTION_REJECTED'
  | 'CHECKOUT_OPENED'
  | 'CHECKOUT_SUCCESS'
  | 'CHECKOUT_CANCELLED'
  | 'ORDER_VIEWED'
  | 'RENEWAL_OPENED'
  | 'WARRANTY_OPENED'
  | 'COUPON_APPLIED'
  | 'DEPOSIT_OPENED'
  | 'SESSION_RESET'
  | 'DEMAND_DISCOVERED'   // V2.2: User expressed a need but no product matched in catalog
  | 'DEMAND_MATCHED'      // V2.2: User expressed a need and semantic candidates were found
  | 'GEMINI_REQUEST'      // V3: Sent prompt & context to Gemini
  | 'GEMINI_RESPONSE'     // V3: Received natural response from Gemini
  | 'TOOL_CALL'           // V3: Gemini invoked a deterministic tool
  | 'TOOL_RESULT'         // V3: Tool result sent back to Gemini
  | 'GEMINI_FALLBACK'     // V3: Seamless fallback to V2 deterministic engine
  | 'KNOWLEDGE_GAP_DETECTED' // V3.3 Phase 6.0: User inquiry not answered by existing knowledge/FAQ
  | 'OBSERVABILITY_RECORDED' // V3.3 Phase 6.0: Per-turn agent observability metrics
  | 'KNOWLEDGE_GAP_REVIEWED' // V3.3 Phase 6.1: Marked reviewing by admin
  | 'KNOWLEDGE_GAP_REJECTED' // V3.3 Phase 6.1: Rejected by admin
  | 'KNOWLEDGE_GAP_MERGED'   // V3.3 Phase 6.1: Merged by admin
  | 'KNOWLEDGE_GAP_APPROVED' // V3.3 Phase 6.1: Approved by admin
  | 'FAQ_CREATED_FROM_KNOWLEDGE_GAP' // V3.3 Phase 6.1: Converted to FAQ
  | 'FAQ_USED'               // V3.3 Phase 6.2: Agent served official FAQ answer
  | 'FAQ_EDITED'             // V3.3 Phase 6.2: Admin updated an existing FAQ
  | 'FAQ_VERSION_CREATED'   // V3.3 Phase 6.2: Version snapshot recorded
  | 'NEGATIVE_POLICY_CREATED'     // V3.3 Phase 6.6: Admin created a negative policy (Reject & Remember)
  | 'NEGATIVE_POLICY_UPDATED'     // V3.3 Phase 6.6: Admin edited an existing negative policy
  | 'NEGATIVE_POLICY_ACTIVATED'   // V3.3 Phase 6.6: Admin activated a negative policy
  | 'NEGATIVE_POLICY_DEACTIVATED' // V3.3 Phase 6.6: Admin deactivated a negative policy
  | 'NEGATIVE_POLICY_MATCHED'     // V3.3 Phase 6.6: User query matched a negative policy (Loop prevented)
  | 'KNOWLEDGE_ACTION_CREATED'         // V3.3 Phase 6.8: Knowledge action created from recommendation
  | 'KNOWLEDGE_ACTION_ACKNOWLEDGED'    // V3.3 Phase 6.8: Admin acknowledged a knowledge action
  | 'KNOWLEDGE_ACTION_STARTED'         // V3.3 Phase 6.8: Admin started working on an action
  | 'KNOWLEDGE_ACTION_COMPLETED'       // V3.3 Phase 6.8: Admin completed an action
  | 'KNOWLEDGE_ACTION_DISMISSED'       // V3.3 Phase 6.8: Admin dismissed a knowledge action
  | 'KNOWLEDGE_ACTION_SNOOZED'         // V3.3 Phase 6.8: Admin snoozed a knowledge action
  | 'KNOWLEDGE_ACTION_OUTCOME_RECORDED' // V3.3 Phase 6.8: Before/After outcome telemetry
  | 'KNOWLEDGE_REGRESSION_DETECTED'    // V3.3 Phase 6.8: Regression detected after Admin mutation
  | 'KNOWLEDGE_IMPROVEMENT_DETECTED'   // V3.3 Phase 6.8: Improvement detected after Admin mutation
  | 'KNOWLEDGE_DRIFT_DETECTED'         // V3.3 Phase 6.9: Knowledge/FAQ/Policy drift identified
  | 'KNOWLEDGE_DRIFT_RESOLVED'         // V3.3 Phase 6.9: Drift resolved by Admin review
  | 'KNOWLEDGE_ANOMALY_DETECTED'       // V3.3 Phase 6.9: Statistical traffic/gap/conflict anomaly
  | 'KNOWLEDGE_QA_STARTED'             // V3.3 Phase 6.9: Knowledge QA suite execution started
  | 'KNOWLEDGE_QA_COMPLETED'           // V3.3 Phase 6.9: Knowledge QA suite completed
  | 'KNOWLEDGE_QA_FAILED'              // V3.3 Phase 6.9: Knowledge QA test failure
  | 'KNOWLEDGE_REGRESSION_RESOLVED'    // V3.3 Phase 6.9: Regression resolved by Admin
  | 'KNOWLEDGE_GOVERNANCE_SNAPSHOT'    // V3.3 Phase 6.9: Telemetry snapshot of governance read-model
  | 'KNOWLEDGE_HEALTH_ALERT'           // V3.3 Phase 6.9: Health alert raised by governance monitor
  | 'PRODUCTION_REQUEST'               // V3.3 Phase 7.0: Live production request telemetry
  | 'PRODUCTION_ERROR'                 // V3.3 Phase 7.0: Production runtime or AI error
  | 'PRODUCTION_SLO_BREACH'            // V3.3 Phase 7.0: Service Level Objective violation
  | 'PRODUCTION_INCIDENT_DETECTED'     // V3.3 Phase 7.0: Production incident raised
  | 'PRODUCTION_INCIDENT_ACKNOWLEDGED' // V3.3 Phase 7.0: Incident acknowledged by SRE/Admin
  | 'PRODUCTION_INCIDENT_RESOLVED'     // V3.3 Phase 7.0: Incident resolved by SRE/Admin
  | 'PRODUCTION_ROLLOUT_CHANGED'       // V3.3 Phase 7.0: Progressive rollout stage updated
  | 'PRODUCTION_ROLLBACK'              // V3.3 Phase 7.0: Rollback triggered
  | 'PRODUCTION_CIRCUIT_OPEN'          // V3.3 Phase 7.0: Circuit breaker opened
  | 'PRODUCTION_CIRCUIT_HALF_OPEN'     // V3.3 Phase 7.0: Circuit breaker half-open probe
  | 'PRODUCTION_CIRCUIT_CLOSED'        // V3.3 Phase 7.0: Circuit breaker closed
  | 'PRODUCTION_CAPACITY_WARNING'      // V3.3 Phase 7.0: Load warning (High load)
  | 'PRODUCTION_CAPACITY_OVERLOAD'     // V3.3 Phase 7.0: Load critical (Overload shedding)
  | 'PRODUCTION_HEALTH_SNAPSHOT';      // V3.3 Phase 7.0: Production health snapshot

export type DemandState = 'SUPPORTED' | 'NEAR_MATCH' | 'UNSUPPORTED' | 'AMBIGUOUS';

export type KnowledgePriority = 'HIGH' | 'MEDIUM' | 'LOW';

export type FaqStaleStatus = 'CURRENT' | 'NEEDS_REVIEW' | 'STALE';

export type PolicyScopeType = 'GLOBAL' | 'PRODUCT' | 'APP' | 'SERVICE' | 'TOPIC';

export type PolicyStatus = 'ACTIVE' | 'INACTIVE' | 'STALE' | 'EXPIRED';

export interface NegativePolicy {
  id: string;
  policyKey: string;
  scopeType: PolicyScopeType;
  scopeValue: string; // e.g. 'canva', 'remote_installation', 'ultraview'
  questionPattern: string;
  normalizedQuestion: string;
  answer: string;
  reason?: string;
  status: PolicyStatus;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
  lastUsedAt?: string | null;
}

export interface FaqQualityMetrics {
  faqId: string;
  question: string;
  answer?: string;
  category: string;
  usageCount: number;
  lastUsedAt?: string | null;
  qualityScore: number; // 0 to 100
  staleStatus: FaqStaleStatus;
  staleReason?: string;
  similarGapCount: number;
}

export interface FaqEditHistoryItem {
  id: string;
  faqId: string;
  adminUserId?: string | null;
  before: { question: string; answer: string };
  after: { question: string; answer: string };
  reason?: string;
  timestamp: string;
}

export type ResponseSource =
  | 'FAQ'
  | 'NEGATIVE_POLICY'
  | 'DETERMINISTIC'
  | 'GEMINI'
  | 'GEMINI_FALLBACK_V2'
  | 'KNOWLEDGE'
  | 'UNKNOWN';

export type KnowledgeGapClassification =
  | 'KNOWLEDGE_GAP'
  | 'PRODUCT_DEMAND'
  | 'TRANSACTIONAL'
  | 'GREETING'
  | 'SUPPORTED_FAQ'
  | 'SUPPORTED_NEGATIVE_POLICY'
  | 'UNSUPPORTED'
  | 'SECURITY_SENSITIVE';

export interface NormalizedDemandMetadata {
  rawQuery: string;
  normalizedCapability: string;
  domainCategory: 'video' | 'audio' | 'image' | 'design' | 'coding' | 'productivity' | 'education' | 'entertainment' | 'other';
  demandState: DemandState;
  matchedCount: number;
  confidence?: number;
  constraints?: string[];
  candidateNames?: string[];
}

export interface KnowledgeGapMetadata {
  originalQuestion: string;
  normalizedQuestion: string;
  category: 'policy' | 'technical' | 'support' | 'troubleshooting' | 'general' | 'other';
  classification: KnowledgeGapClassification;
  confidence: number;
  source: ResponseSource;
  suggestedAction?: string;
  contextIntent?: string;
}

export interface AgentObservabilityMetadata {
  intent: string;
  responseSource: ResponseSource;
  latencyMs: number;
  geminiUsed: boolean;
  geminiFallback: boolean;
  faqHit: boolean;
  isKnowledgeGap: boolean;
  isProductDemand: boolean;
  isTransactional: boolean;
  isSafe: boolean;
  candidateCount?: number;
  actionCount?: number;
}

export interface AgentAnalyticsEvent {
  eventType: AgentAnalyticsEventType;
  userId?: string | null;
  sessionId?: string | null;
  intent?: string | null;
  productId?: string | null;
  planId?: string | null;
  actionId?: string | null;
  actionType?: string | null;
  reason?: string | null;
  metadata?: (Record<string, unknown> & Partial<NormalizedDemandMetadata> & Partial<KnowledgeGapMetadata> & Partial<AgentObservabilityMetadata>) | Record<string, unknown>;
  createdAt?: string;
}

// ----------------------------------------------------------------------------
// Phase 6.7: Knowledge Intelligence Platform Types
// ----------------------------------------------------------------------------

export type FaqHealthGrade = 'EXCELLENT' | 'HEALTHY' | 'NEEDS_REVIEW' | 'DEGRADED' | 'CRITICAL';

export interface FaqHealthDetail {
  faqId: string;
  question: string;
  healthScore: number; // 0 - 100
  grade: FaqHealthGrade;
  usageCount: number;
  matchSuccessRate: number; // percentage 0 - 100
  unresolvedVariantsCount: number;
  ageInDays: number;
  lastUsedAt?: string;
  versionCount: number;
  conflictCount: number;
  healthReasons: string[];
}

export type KnowledgeDomain =
  | 'PRODUCT'
  | 'PAYMENT'
  | 'WALLET'
  | 'WARRANTY'
  | 'ACCOUNT'
  | 'ACTIVATION'
  | 'INSTALLATION'
  | 'SUPPORT'
  | 'GENERAL'
  | 'NEGATIVE_POLICY';

export interface DomainCoverageDetail {
  domain: KnowledgeDomain;
  coveragePercentage: number;
  totalQueries: number;
  resolvedQueries: number;
  gapCount: number;
  status: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION' | 'POOR';
  topMissingTopic?: string;
}

export interface DomainCoverageReport {
  overallCoveragePercentage: number;
  domainCoverages: DomainCoverageDetail[];
  totalQueriesAnalyzed: number;
  generatedAt: string;
}

export interface QueryCluster {
  id: string;
  canonicalTopic: string;
  targetDomain: KnowledgeDomain;
  intent: string;
  occurrenceCount: number;
  uniqueVariants: string[];
  uniqueUserCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  suggestedAction?: 'CREATE_FAQ' | 'CREATE_NEGATIVE_POLICY' | 'EXPAND_EXISTING_FAQ' | 'MONITOR';
  matchingFaqId?: string;
  matchingPolicyId?: string;
}

export type EmergingTopicClassification =
  | 'PRODUCT_DEMAND'
  | 'TRANSACTIONAL'
  | 'KNOWLEDGE_GAP'
  | 'SUPPORTED_FAQ'
  | 'SUPPORTED_NEGATIVE_POLICY'
  | 'SECURITY_SENSITIVE';

export interface EmergingTopic {
  id: string;
  topicName: string;
  classification: EmergingTopicClassification;
  queryCount: number;
  uniqueUsers: number;
  growthRatePercentage: number; // e.g. +240%
  firstSeenAt: string;
  lastSeenAt: string;
  sampleQueries: string[];
  recommendation: string;
}

export interface NegativePolicyIntelligenceItem {
  policyId: string;
  policyKey: string;
  scopeType: PolicyScopeType;
  scopeValue: string;
  status: PolicyStatus;
  matchesCount: number;
  preventedGapsCount: number;
  uniqueUsers: number;
  lastUsedAt?: string;
  effectivenessGrade: 'HIGH' | 'MODERATE' | 'LOW' | 'UNUSED';
  conflictCount: number;
  recommendation?: string;
}

export type ConflictSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface KnowledgeConflictItem {
  id: string;
  conflictType: 'FAQ_VS_FAQ' | 'FAQ_VS_NEGATIVE_POLICY' | 'NEGATIVE_POLICY_VS_NEGATIVE_POLICY';
  entityA: { id: string; title: string; type: 'FAQ' | 'NEGATIVE_POLICY' };
  entityB: { id: string; title: string; type: 'FAQ' | 'NEGATIVE_POLICY' };
  similarityPercentage: number;
  severity: ConflictSeverity;
  conflictDescription: string;
  recommendedResolution: string;
  detectedAt: string;
}

export type RecommendationType =
  | 'REVIEW_FAQ'
  | 'UPDATE_FAQ'
  | 'REVIEW_NEGATIVE_POLICY'
  | 'INVESTIGATE_EMERGING_TOPIC'
  | 'RESOLVE_CONFLICT'
  | 'IMPROVE_COVERAGE'
  | 'CHECK_REGRESSION'
  | 'RETIRE_STALE_KNOWLEDGE';

export type RecommendationPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface AdminRecommendation {
  id: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  title: string;
  reason: string;
  evidence: string;
  affectedEntityId?: string;
  affectedEntityType?: 'FAQ' | 'NEGATIVE_POLICY' | 'DOMAIN' | 'CLUSTER';
  actionPrompt: string;
  createdAt: string;
  status: 'OPEN' | 'DISMISSED' | 'RESOLVED';
}

export interface KnowledgeRegressionDetail {
  faqId: string;
  question: string;
  beforeSupportedVariants: number;
  afterSupportedVariants: number;
  coverageDropPercentage: number;
  isRegression: boolean;
  regressedQueries: string[];
}

export interface KnowledgeRegressionReport {
  regressionsDetected: number;
  details: KnowledgeRegressionDetail[];
  analyzedAt: string;
}

export interface IntelligenceDashboardSummary {
  overallHealthScore: number; // 0 - 100
  overallCoveragePercentage: number; // 0 - 100
  activePoliciesCount: number;
  emergingTopicsCount: number;
  activeConflictsCount: number;
  openRecommendationsCount: number;
  faqHealthList: FaqHealthDetail[];
  coverageReport: DomainCoverageReport;
  topQueryClusters: QueryCluster[];
  emergingTopics: EmergingTopic[];
  negativePolicyIntelligence: NegativePolicyIntelligenceItem[];
  conflicts: KnowledgeConflictItem[];
  recommendations: AdminRecommendation[];
  regressionReport: KnowledgeRegressionReport;
  lastUpdated: string;
}

// ----------------------------------------------------------------------------
// Phase 6.8: Knowledge Action Center & Continuous Feedback Loop Types
// ----------------------------------------------------------------------------

export type KnowledgeActionType =
  // FAQ Actions
  | 'REVIEW_FAQ'
  | 'EDIT_FAQ'
  | 'MERGE_FAQ'
  | 'DEPRECATE_FAQ'
  | 'RESTORE_FAQ'
  // Knowledge Gap Actions
  | 'REVIEW_GAP'
  | 'APPROVE_GAP'
  | 'REJECT_GAP'
  | 'REJECT_AND_REMEMBER'
  | 'MERGE_GAP'
  // Negative Policy Actions
  | 'REVIEW_POLICY'
  | 'EDIT_POLICY'
  | 'DEACTIVATE_POLICY'
  | 'REACTIVATE_POLICY'
  // Conflict Actions
  | 'REVIEW_CONFLICT'
  | 'RESOLVE_CONFLICT'
  | 'DISMISS_CONFLICT'
  // Coverage Actions
  | 'REVIEW_DOMAIN'
  | 'CREATE_KNOWLEDGE_PLAN'; // Creates plan only — NEVER auto-creates FAQ

export type KnowledgeActionStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DISMISSED'
  | 'SNOOZED'
  | 'BLOCKED';

export type EstimatedImpact = 'LOW' | 'MEDIUM' | 'HIGH';

export type ActionEffectiveness =
  | 'EXCELLENT'
  | 'EFFECTIVE'
  | 'NEUTRAL'
  | 'INEFFECTIVE'
  | 'REGRESSED'
  | 'INSUFFICIENT_DATA';

export type OutcomeFeedbackType =
  | 'ACTION_SUCCESS'
  | 'ACTION_FAILED'
  | 'ACTION_NO_IMPACT'
  | 'ACTION_IMPROVED'
  | 'ACTION_REGRESSED';

export type ObservationWindow = '24H' | '3D' | '7D' | '14D' | '30D';

export interface BeforeAfterSnapshot {
  matchRateBefore?: number;
  matchRateAfter?: number;
  usageCountBefore?: number;
  usageCountAfter?: number;
  gapCountBefore?: number;
  gapCountAfter?: number;
  healthScoreBefore?: number;
  healthScoreAfter?: number;
  conflictCountBefore?: number;
  conflictCountAfter?: number;
  coverageBefore?: number;
  coverageAfter?: number;
  variantCountBefore?: number;
  variantCountAfter?: number;
  capturedAt: string;
}

export interface ActionOutcome {
  effectiveness: ActionEffectiveness;
  feedbackType: OutcomeFeedbackType;
  matchRateDelta?: number;
  usageDelta?: number;
  gapReduction?: number;
  gapCountDelta?: number;
  conflictReduction?: number;
  healthScoreDelta?: number;
  coverageDelta?: number;
  variantDelta?: number;
  feedbackReason?: string; // Admin-supplied, sanitized — no PII/tokens
  observationWindow: ObservationWindow;
  measuredAt: string;
  isInsufficientData: boolean;
}

export interface KnowledgeAction {
  id: string;
  type: KnowledgeActionType;
  recommendationId?: string;
  priority: RecommendationPriority;
  title: string;
  reason: string;
  evidence: string;
  suggestedAction: string;
  affectedEntityId?: string;
  affectedEntityType?: 'FAQ' | 'NEGATIVE_POLICY' | 'DOMAIN' | 'CLUSTER' | 'GAP' | 'CONFLICT';
  estimatedImpact: EstimatedImpact;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  status: KnowledgeActionStatus;
  decisionFingerprint: string; // Anti-loop: hash(entityId+issueType+evidence[0..100])
  createdAt: string;
  updatedAt: string;
  acknowledgedAt?: string;
  startedAt?: string;
  completedAt?: string;
  dismissedAt?: string;
  dismissedBy?: string;
  dismissReason?: string;
  snoozedUntil?: string;
  snoozeReason?: string;
  adminUserId?: string;
  beforeSnapshot?: BeforeAfterSnapshot;
  afterSnapshot?: BeforeAfterSnapshot;
  outcome?: ActionOutcome;
  improvementScore?: number; // 0-100, deterministic
}

export interface KnowledgeImprovementScore {
  score: number; // 0-100
  components: {
    healthImprovement: number;    // max 30
    matchImprovement: number;     // max 25
    gapReduction: number;         // max 20
    conflictReduction: number;    // max 15
    coverageImprovement: number;  // max 10
  };
  trend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  computedAt: string;
}

export interface ActionCenterSummary {
  openCount: number;
  acknowledgedCount: number;
  inProgressCount: number;
  completedCount: number;
  dismissedCount: number;
  snoozedCount: number;
  blockedCount: number;
  regressionsDetected: number;
  successfulImprovements: number;
  actions: KnowledgeAction[];
  improvementScore: KnowledgeImprovementScore;
  lastUpdated: string;
}

// ----------------------------------------------------------------------------
// Phase 6.9: Production Knowledge Governance, Drift Detection & Autonomous QA
// ----------------------------------------------------------------------------

export type DriftSeverity = 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type DriftStatus = 'STABLE' | 'WATCH' | 'DEGRADED' | 'CRITICAL';

export interface FaqDriftDetail {
  faqId: string;
  question: string;
  matchRateDrop: number;
  usageDrop: number;
  unmatchedVariantsCount: number;
  ageInDays: number;
  driftSeverity: DriftSeverity;
  reasons: string[];
}

export interface NegativePolicyDriftDetail {
  policyId: string;
  policyKey: string;
  matchRateDrop: number;
  falseInterceptCount: number;
  scopeDrift: 'TOO_BROAD' | 'TOO_NARROW' | 'STABLE';
  driftSeverity: DriftSeverity;
  reasons: string[];
}

export interface QueryDriftDetail {
  clusterId: string;
  canonicalTopic: string;
  volumeChangePercentage: number;
  intentShiftDetected: boolean;
  driftSeverity: DriftSeverity;
}

export interface CoverageDriftDetail {
  domain: KnowledgeDomain;
  coverageDropPercentage: number;
  gapIncreaseCount: number;
  driftSeverity: DriftSeverity;
}

export interface KnowledgeDriftReport {
  overallDriftScore: number; // 0-100
  driftStatus: DriftStatus;
  faqDrifts: FaqDriftDetail[];
  policyDrifts: NegativePolicyDriftDetail[];
  queryDrifts: QueryDriftDetail[];
  coverageDrifts: CoverageDriftDetail[];
  analyzedAt: string;
}

export type QaTestStatus = 'PASS' | 'WARN' | 'FAIL' | 'BLOCKED';

export interface KnowledgeQaTestResult {
  testId: string;
  category: string;
  status: QaTestStatus;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence: string;
  expected: string;
  actual: string;
  timestamp: string;
}

export interface KnowledgeQaSuiteResult {
  totalTests: number;
  passedCount: number;
  warningCount: number;
  failedCount: number;
  blockedCount: number;
  passRate: number; // 0-100%
  testResults: KnowledgeQaTestResult[];
  executionDurationMs: number;
  evaluatedAt: string;
}

export interface GoldenQueryTestCase {
  id: string;
  query: string;
  expectedRoute:
    | 'TRANSACTIONAL'
    | 'PRODUCT_DEMAND'
    | 'WARRANTY'
    | 'SUPPORTED_NEGATIVE_POLICY'
    | 'SUPPORTED_FAQ'
    | 'KNOWLEDGE_GAP';
  expectedIntent?: string;
  expectedPlanDuration?: string;
  expectedPrice?: number;
  category: string;
  description: string;
}

export interface GoldenQueryResult {
  caseId: string;
  query: string;
  pass: boolean;
  expected: string;
  actual: string;
  latencyMs: number;
}

export type AnomalyType =
  | 'GAP_SPIKE'
  | 'CONFLICT_SPIKE'
  | 'MATCH_RATE_DROP'
  | 'TRAFFIC_SURGE'
  | 'ROUTING_ANOMALY'
  | 'POLICY_SPIKE';

export interface KnowledgeAnomalyItem {
  id: string;
  type: AnomalyType;
  magnitude: number;
  baselineValue: number;
  currentValue: number;
  confidence: number;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  description: string;
  detectedAt: string;
}

export interface KnowledgeAnomalyReport {
  anomalies: KnowledgeAnomalyItem[];
  totalAnomalies: number;
  highSeverityCount: number;
  evaluatedAt: string;
  isInsufficientData: boolean;
}

export type AlertSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'SNOOZED' | 'RESOLVED';

export interface KnowledgeAlert {
  id: string;
  fingerprint: string;
  title: string;
  severity: AlertSeverity;
  status: AlertStatus;
  reason: string;
  evidence: string;
  entityId?: string;
  entityType?: string;
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  snoozedUntil?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface AlertCenterSummary {
  totalAlerts: number;
  openCount: number;
  criticalCount: number;
  highCount: number;
  warningCount: number;
  infoCount: number;
  alerts: KnowledgeAlert[];
}

export type KnowledgeGovernanceHealthStatus = 'EXCELLENT' | 'HEALTHY' | 'WATCH' | 'DEGRADED' | 'CRITICAL';

export interface KnowledgeGovernanceScore {
  score: number; // 0-100
  components: {
    knowledgeIntegrity: number;   // max 20
    faqHealth: number;            // max 15
    coverage: number;             // max 15
    regressionSafety: number;     // max 15
    driftStability: number;       // max 10
    qaPassRate: number;           // max 10
    conflictHealth: number;       // max 5
    negativePolicyHealth: number; // max 5
    actionResolution: number;     // max 5
  };
  isCapped: boolean;
  capReason?: string;
  computedAt: string;
}

export interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
  isInsufficientData: boolean;
}

export interface SlaSloMetrics {
  resolutionLatency: LatencyPercentiles;
  faqLookupLatency: LatencyPercentiles;
  negativePolicyLookupLatency: LatencyPercentiles;
  overallStatus: 'MEETING_SLA' | 'AT_RISK' | 'BREACHED' | 'INSUFFICIENT_DATA';
  evaluatedAt: string;
}

export interface GovernanceDashboardSummary {
  governanceScore: KnowledgeGovernanceScore;
  overallHealth: KnowledgeGovernanceHealthStatus;
  driftReport: KnowledgeDriftReport;
  qaSuiteResult: KnowledgeQaSuiteResult;
  anomalyReport: KnowledgeAnomalyReport;
  alertSummary: AlertCenterSummary;
  slaMetrics: SlaSloMetrics;
  regressionsCount: number;
  activePoliciesCount: number;
  totalFaqsCount: number;
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// PHASE 7.0: PRODUCTION GENERAL AVAILABILITY & RESILIENCE MODELS
// ---------------------------------------------------------------------------

export type ProductionRolloutStage = 'OFF' | 'CANARY' | '10' | '25' | '50' | '75' | '100';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type CapacityStatus = 'NORMAL' | 'BUSY' | 'HIGH_LOAD' | 'OVERLOAD';

export type IncidentSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';

export type IncidentType =
  | 'TRAFFIC_SPIKE'
  | 'ERROR_SPIKE'
  | 'LATENCY_SPIKE'
  | 'FALLBACK_SPIKE'
  | 'KNOWLEDGE_REGRESSION'
  | 'TRANSACTION_BOUNDARY_BREACH'
  | 'DURATION_REGRESSION'
  | 'WARRANTY_REGRESSION'
  | 'PRODUCT_DEMAND_REGRESSION'
  | 'NEGATIVE_POLICY_LOOP'
  | 'PII_LEAK'
  | 'UNAUTHORIZED_MUTATION'
  | 'CIRCUIT_BREAKER_OPEN'
  | 'CAPACITY_OVERLOAD';

export type IncidentStatus =
  | 'DETECTED'
  | 'ACKNOWLEDGED'
  | 'INVESTIGATING'
  | 'MITIGATED'
  | 'RESOLVED'
  | 'DISMISSED';

export interface ProductionIncident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  type: IncidentType;
  status: IncidentStatus;
  affectedComponent: string;
  firstDetected: string;
  lastDetected: string;
  evidence: string;
  fingerprint: string;
  acknowledgedBy?: string;
  resolvedBy?: string;
  dismissReason?: string;
}

export interface ProductionRequestMetric {
  requestId: string;
  timestamp: string;
  route: string;
  intent: string;
  latencyMs: number;
  success: boolean;
  errorType?: string;
  fallbackUsed: boolean;
  knowledgeHit: boolean;
  negativePolicyHit: boolean;
  transactionBoundaryHit: boolean;
  warrantyBoundaryHit: boolean;
  productDemandHit: boolean;
  piiDetected: boolean;
  sanitized: boolean;
  rolloutStage: ProductionRolloutStage;
}

export interface SloThresholds {
  availabilityTarget: number; // e.g. 99.9
  errorRateHealthyMax: number; // e.g. 1.0
  errorRateWarningMax: number; // e.g. 3.0
  p95LatencyHealthyMax: number; // e.g. 500
  p95LatencyWarningMax: number; // e.g. 1000
  p99LatencyHealthyMax: number; // e.g. 1000
  p99LatencyWarningMax: number; // e.g. 2000
  fallbackRateHealthyMax: number; // e.g. 5.0
  fallbackRateWarningMax: number; // e.g. 10.0
  knowledgeGapRateHealthyMax: number; // e.g. 10.0
  knowledgeGapRateWarningMax: number; // e.g. 20.0
}

export interface SloEvaluationItem {
  name: string;
  currentValue: number;
  target: string;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'INSUFFICIENT_DATA';
}

export interface ProductionSloReport {
  overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'INSUFFICIENT_DATA';
  availability: SloEvaluationItem;
  errorRate: SloEvaluationItem;
  p95Latency: SloEvaluationItem;
  p99Latency: SloEvaluationItem;
  fallbackRate: SloEvaluationItem;
  knowledgeGapRate: SloEvaluationItem;
  evaluatedAt: string;
}

export interface RolloutState {
  currentStage: ProductionRolloutStage;
  trafficPercentage: number;
  updatedAt: string;
  updatedBy: string;
  isBlocked: boolean;
  blockReason?: string;
}

export interface RollbackRecord {
  rollbackId: string;
  reason: string;
  triggeredBy: string;
  stageBefore: ProductionRolloutStage;
  stageAfter: ProductionRolloutStage;
  metricsSnapshot: Record<string, any>;
  timestamp: string;
}

export interface CapacityMetrics {
  status: CapacityStatus;
  requestsPerMinute: number;
  concurrentRequests: number;
  queueDepth: number;
  avgProcessingTimeMs: number;
  peakTraffic: number;
  rejectedRequests: number;
  timeoutCount: number;
}

export interface ProductionHealthScore {
  score: number; // 0-100
  status: 'EXCELLENT' | 'HEALTHY' | 'WATCH' | 'DEGRADED' | 'CRITICAL';
  components: {
    reliability: number;   // max 20
    latency: number;       // max 15
    errorHealth: number;   // max 15
    routingHealth: number; // max 15
    knowledgeHealth: number; // max 10
    securityHealth: number;  // max 10
    capacityHealth: number;  // max 5
    sloCompliance: number;   // max 5
    incidentHealth: number;  // max 5
  };
  isCapped: boolean;
  capReason?: string;
  evaluatedAt: string;
}

export interface ProductionControlCenterSummary {
  healthScore: ProductionHealthScore;
  rolloutState: RolloutState;
  circuitState: CircuitBreakerState;
  capacityMetrics: CapacityMetrics;
  sloReport: ProductionSloReport;
  activeIncidents: ProductionIncident[];
  recentRollbacks: RollbackRecord[];
  trafficStats: {
    requestsPerMin: number;
    successCount: number;
    errorCount: number;
    fallbackCount: number;
    activeUsers: number;
    concurrentRequests: number;
  };
  boundaryHealth: {
    transaction: boolean;
    duration: boolean;
    productDemand: boolean;
    warranty: boolean;
    negativePolicy: boolean;
    zeroAutoMutation: boolean;
    piiSanitization: boolean;
    promptInjection: boolean;
  };
  lastUpdated: string;
}



