// scratch/test_v3_3_phase3_demand_analytics.ts
// Comprehensive Test Suite for BOW Agent V3.3 Phase 3 — Demand Discovery Analytics

import {
  aggregateDemandEvents,
  filterAndPaginateDemands,
  sanitizeQueryText,
} from '../src/services/agent/monitoring/demandAggregator';
import type { AgentAnalyticsEvent } from '../src/services/agent/monitoring/analyticsTypes';

function runPhase3Tests() {
  console.log('================================================================');
  console.log('=== BOW AGENT V3.3 — PHASE 3 DEMAND ANALYTICS TEST SUITE ===');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`[PASS] Test ${total}: ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${total}: ${testName} ${detail ? `(${detail})` : ''}`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Empty Dataset
  // --------------------------------------------------------------------------
  const emptyRes = aggregateDemandEvents([]);
  assert(
    emptyRes.totalDemandRequests === 0 &&
    emptyRes.uniqueUsersCount === 0 &&
    emptyRes.topUnmetDemands.length === 0 &&
    emptyRes.allDemands.length === 0,
    'Empty Dataset returns zero counts and clean empty arrays'
  );

  // --------------------------------------------------------------------------
  // TEST 2: Single Capability
  // --------------------------------------------------------------------------
  const singleEvent: AgentAnalyticsEvent[] = [
    {
      eventType: 'DEMAND_DISCOVERED',
      userId: 'u1',
      sessionId: 's1',
      createdAt: '2026-08-30T10:00:00Z',
      metadata: {
        rawQuery: 'cần phần mềm quản lý tàu vũ trụ',
        normalizedCapability: 'spacecraft-management',
        domainCategory: 'productivity',
        demandState: 'UNSUPPORTED',
        matchedCount: 0,
      } as any,
    },
  ];
  const singleRes = aggregateDemandEvents(singleEvent);
  assert(
    singleRes.totalDemandRequests === 1 &&
    singleRes.uniqueUsersCount === 1 &&
    singleRes.allDemands.length === 1 &&
    singleRes.allDemands[0].capability === 'spacecraft-management',
    'Single Capability aggregated correctly'
  );

  // --------------------------------------------------------------------------
  // TEST 3: Multiple Capabilities
  // --------------------------------------------------------------------------
  const multiEvents: AgentAnalyticsEvent[] = [
    {
      eventType: 'DEMAND_MATCHED',
      userId: 'u1',
      sessionId: 's1',
      createdAt: '2026-08-30T10:00:00Z',
      metadata: { normalizedCapability: 'music-streaming', domainCategory: 'audio', demandState: 'SUPPORTED' } as any,
    },
    {
      eventType: 'DEMAND_DISCOVERED',
      userId: 'u2',
      sessionId: 's2',
      createdAt: '2026-08-30T11:00:00Z',
      metadata: { normalizedCapability: 'ai-text-to-video', domainCategory: 'video', demandState: 'NEAR_MATCH' } as any,
    },
    {
      eventType: 'DEMAND_DISCOVERED',
      userId: 'u3',
      sessionId: 's3',
      createdAt: '2026-08-30T12:00:00Z',
      metadata: { normalizedCapability: 'spacecraft-management', domainCategory: 'productivity', demandState: 'UNSUPPORTED' } as any,
    },
  ];
  const multiRes = aggregateDemandEvents(multiEvents);
  assert(
    multiRes.allDemands.length === 3 && multiRes.totalDemandRequests === 3,
    'Multiple Capabilities aggregated into distinct records'
  );

  // --------------------------------------------------------------------------
  // TEST 4: Duplicate Events of Same Capability
  // --------------------------------------------------------------------------
  const dupEvents: AgentAnalyticsEvent[] = [
    {
      eventType: 'DEMAND_DISCOVERED',
      userId: 'u1',
      sessionId: 's1',
      createdAt: '2026-08-30T10:00:00Z',
      metadata: { normalizedCapability: 'ai-text-to-video', domainCategory: 'video', demandState: 'NEAR_MATCH' } as any,
    },
    {
      eventType: 'DEMAND_DISCOVERED',
      userId: 'u1',
      sessionId: 's1',
      createdAt: '2026-08-30T10:05:00Z',
      metadata: { normalizedCapability: 'ai-text-to-video', domainCategory: 'video', demandState: 'NEAR_MATCH' } as any,
    },
  ];
  const dupRes = aggregateDemandEvents(dupEvents);
  assert(
    dupRes.allDemands[0].totalRequests === 2 && dupRes.allDemands[0].uniqueUsers === 1,
    'Duplicate Events increase request count but maintain unique users count'
  );

  // --------------------------------------------------------------------------
  // TEST 5: Unique Authenticated Users
  // --------------------------------------------------------------------------
  const authEvents: AgentAnalyticsEvent[] = [
    { eventType: 'DEMAND_DISCOVERED', userId: 'u1', sessionId: 's1', createdAt: '2026-08-30T10:00:00Z', metadata: { normalizedCapability: 'voice-cloning', domainCategory: 'audio', demandState: 'UNSUPPORTED' } as any },
    { eventType: 'DEMAND_DISCOVERED', userId: 'u2', sessionId: 's2', createdAt: '2026-08-30T10:01:00Z', metadata: { normalizedCapability: 'voice-cloning', domainCategory: 'audio', demandState: 'UNSUPPORTED' } as any },
    { eventType: 'DEMAND_DISCOVERED', userId: 'u1', sessionId: 's3', createdAt: '2026-08-30T10:02:00Z', metadata: { normalizedCapability: 'voice-cloning', domainCategory: 'audio', demandState: 'UNSUPPORTED' } as any },
  ];
  const authRes = aggregateDemandEvents(authEvents);
  assert(
    authRes.allDemands[0].uniqueUsers === 2 && authRes.allDemands[0].totalRequests === 3,
    'Unique Authenticated Users counted distinctly'
  );

  // --------------------------------------------------------------------------
  // TEST 6: Guest Sessions Count
  // --------------------------------------------------------------------------
  const guestEvents: AgentAnalyticsEvent[] = [
    { eventType: 'DEMAND_DISCOVERED', userId: null, sessionId: 'guest_1', createdAt: '2026-08-30T10:00:00Z', metadata: { normalizedCapability: '3d-modeling', domainCategory: 'design', demandState: 'UNSUPPORTED' } as any },
    { eventType: 'DEMAND_DISCOVERED', userId: null, sessionId: 'guest_2', createdAt: '2026-08-30T10:01:00Z', metadata: { normalizedCapability: '3d-modeling', domainCategory: 'design', demandState: 'UNSUPPORTED' } as any },
    { eventType: 'DEMAND_DISCOVERED', userId: null, sessionId: 'guest_1', createdAt: '2026-08-30T10:02:00Z', metadata: { normalizedCapability: '3d-modeling', domainCategory: 'design', demandState: 'UNSUPPORTED' } as any },
  ];
  const guestRes = aggregateDemandEvents(guestEvents);
  assert(
    guestRes.allDemands[0].uniqueUsers === 2 && guestRes.allDemands[0].uniqueSessions === 2,
    'Guest Sessions counted distinctly without treating null userId as 1 single user'
  );

  // --------------------------------------------------------------------------
  // TEST 7: Priority Calculation — UNSUPPORTED Weight 1.5
  // Formula: (uniqueUsers * 2 + requests * 1.5)
  // For 2 users, 2 requests: (2*2 + 2*1.5) = 4 + 3 = 7.0
  // --------------------------------------------------------------------------
  const unsupEvents: AgentAnalyticsEvent[] = [
    { eventType: 'DEMAND_DISCOVERED', userId: 'u1', sessionId: 's1', createdAt: '2026-08-30T10:00:00Z', metadata: { normalizedCapability: 'spacecraft', domainCategory: 'productivity', demandState: 'UNSUPPORTED' } as any },
    { eventType: 'DEMAND_DISCOVERED', userId: 'u2', sessionId: 's2', createdAt: '2026-08-30T10:01:00Z', metadata: { normalizedCapability: 'spacecraft', domainCategory: 'productivity', demandState: 'UNSUPPORTED' } as any },
  ];
  const unsupRes = aggregateDemandEvents(unsupEvents);
  assert(
    unsupRes.allDemands[0].priorityScore === 7.0,
    'Priority Score: UNSUPPORTED capability calculated with 1.5 weight'
  );

  // --------------------------------------------------------------------------
  // TEST 8: Priority Calculation — NEAR_MATCH Weight 1.0
  // Formula: (uniqueUsers * 2 + requests * 1.0)
  // For 2 users, 2 requests: (2*2 + 2*1.0) = 4 + 2 = 6.0
  // --------------------------------------------------------------------------
  const nearEvents: AgentAnalyticsEvent[] = [
    { eventType: 'DEMAND_MATCHED', userId: 'u1', sessionId: 's1', createdAt: '2026-08-30T10:00:00Z', metadata: { normalizedCapability: 'ai-text-to-video', domainCategory: 'video', demandState: 'NEAR_MATCH' } as any },
    { eventType: 'DEMAND_MATCHED', userId: 'u2', sessionId: 's2', createdAt: '2026-08-30T10:01:00Z', metadata: { normalizedCapability: 'ai-text-to-video', domainCategory: 'video', demandState: 'NEAR_MATCH' } as any },
  ];
  const nearRes = aggregateDemandEvents(nearEvents);
  assert(
    nearRes.allDemands[0].priorityScore === 6.0,
    'Priority Score: NEAR_MATCH capability calculated with 1.0 weight'
  );

  // --------------------------------------------------------------------------
  // TEST 9: Priority Calculation — SUPPORTED Weight 0.2
  // Formula: (uniqueUsers * 2 + requests * 0.2)
  // For 2 users, 2 requests: (2*2 + 2*0.2) = 4 + 0.4 = 4.4
  // --------------------------------------------------------------------------
  const supEvents: AgentAnalyticsEvent[] = [
    { eventType: 'DEMAND_MATCHED', userId: 'u1', sessionId: 's1', createdAt: '2026-08-30T10:00:00Z', metadata: { normalizedCapability: 'music-streaming', domainCategory: 'audio', demandState: 'SUPPORTED' } as any },
    { eventType: 'DEMAND_MATCHED', userId: 'u2', sessionId: 's2', createdAt: '2026-08-30T10:01:00Z', metadata: { normalizedCapability: 'music-streaming', domainCategory: 'audio', demandState: 'SUPPORTED' } as any },
  ];
  const supRes = aggregateDemandEvents(supEvents);
  assert(
    supRes.allDemands[0].priorityScore === 4.4,
    'Priority Score: SUPPORTED capability calculated with 0.2 weight'
  );

  // --------------------------------------------------------------------------
  // TEST 10: Top Unmet Demands Excludes Pure SUPPORTED & Pure AMBIGUOUS
  // --------------------------------------------------------------------------
  const mixedEvents: AgentAnalyticsEvent[] = [
    { eventType: 'DEMAND_MATCHED', userId: 'u1', sessionId: 's1', createdAt: '2026-08-30T10:00:00Z', metadata: { normalizedCapability: 'music-streaming', domainCategory: 'audio', demandState: 'SUPPORTED' } as any },
    { eventType: 'CLARIFICATION_REQUESTED', userId: 'u2', sessionId: 's2', createdAt: '2026-08-30T10:01:00Z', metadata: { normalizedCapability: 'general-query', domainCategory: 'other', demandState: 'AMBIGUOUS' } as any },
    { eventType: 'DEMAND_DISCOVERED', userId: 'u3', sessionId: 's3', createdAt: '2026-08-30T10:02:00Z', metadata: { normalizedCapability: 'spacecraft', domainCategory: 'productivity', demandState: 'UNSUPPORTED' } as any },
  ];
  const mixedRes = aggregateDemandEvents(mixedEvents);
  assert(
    mixedRes.topUnmetDemands.length === 1 && mixedRes.topUnmetDemands[0].capability === 'spacecraft',
    'Top Unmet Demands accurately excludes pure SUPPORTED and AMBIGUOUS'
  );

  // --------------------------------------------------------------------------
  // TEST 11: Growth Calculation — Positive Growth
  // 1 previous request, 3 recent requests -> ((3-1)/1)*100 = +200%
  // --------------------------------------------------------------------------
  const growEvents: AgentAnalyticsEvent[] = [
    { eventType: 'DEMAND_DISCOVERED', userId: 'u1', sessionId: 's1', createdAt: '2026-08-01T10:00:00Z', metadata: { normalizedCapability: 'voice-cloning', domainCategory: 'audio', demandState: 'UNSUPPORTED' } as any },
    { eventType: 'DEMAND_DISCOVERED', userId: 'u2', sessionId: 's2', createdAt: '2026-08-25T10:00:00Z', metadata: { normalizedCapability: 'voice-cloning', domainCategory: 'audio', demandState: 'UNSUPPORTED' } as any },
    { eventType: 'DEMAND_DISCOVERED', userId: 'u3', sessionId: 's3', createdAt: '2026-08-26T10:00:00Z', metadata: { normalizedCapability: 'voice-cloning', domainCategory: 'audio', demandState: 'UNSUPPORTED' } as any },
    { eventType: 'DEMAND_DISCOVERED', userId: 'u4', sessionId: 's4', createdAt: '2026-08-27T10:00:00Z', metadata: { normalizedCapability: 'voice-cloning', domainCategory: 'audio', demandState: 'UNSUPPORTED' } as any },
  ];
  const growRes = aggregateDemandEvents(growEvents, { start: new Date('2026-08-01T00:00:00Z'), end: new Date('2026-08-30T00:00:00Z') });
  assert(
    growRes.allDemands[0].growthRate === 200 && growRes.allDemands[0].growthLabel === 'Growing',
    'Growth Calculation: Accurately computed +200% growth'
  );

  // --------------------------------------------------------------------------
  // TEST 12: Growth Calculation — Negative Growth
  // 3 previous requests, 1 recent request -> ((1-3)/3)*100 = -67%
  // --------------------------------------------------------------------------
  const decEvents: AgentAnalyticsEvent[] = [
    { eventType: 'DEMAND_DISCOVERED', userId: 'u1', sessionId: 's1', createdAt: '2026-08-02T10:00:00Z', metadata: { normalizedCapability: '3d-gen', domainCategory: 'design', demandState: 'UNSUPPORTED' } as any },
    { eventType: 'DEMAND_DISCOVERED', userId: 'u2', sessionId: 's2', createdAt: '2026-08-03T10:00:00Z', metadata: { normalizedCapability: '3d-gen', domainCategory: 'design', demandState: 'UNSUPPORTED' } as any },
    { eventType: 'DEMAND_DISCOVERED', userId: 'u3', sessionId: 's3', createdAt: '2026-08-04T10:00:00Z', metadata: { normalizedCapability: '3d-gen', domainCategory: 'design', demandState: 'UNSUPPORTED' } as any },
    { eventType: 'DEMAND_DISCOVERED', userId: 'u4', sessionId: 's4', createdAt: '2026-08-28T10:00:00Z', metadata: { normalizedCapability: '3d-gen', domainCategory: 'design', demandState: 'UNSUPPORTED' } as any },
  ];
  const decRes = aggregateDemandEvents(decEvents, { start: new Date('2026-08-01T00:00:00Z'), end: new Date('2026-08-30T00:00:00Z') });
  assert(
    decRes.allDemands[0].growthRate < 0 && decRes.allDemands[0].growthLabel === 'Declining',
    'Growth Calculation: Accurately computed negative growth'
  );

  // --------------------------------------------------------------------------
  // TEST 13: New Demand Detection
  // 0 previous, 2 recent -> label = "New", growthRate = 100
  // --------------------------------------------------------------------------
  const newEvents: AgentAnalyticsEvent[] = [
    { eventType: 'DEMAND_DISCOVERED', userId: 'u1', sessionId: 's1', createdAt: '2026-08-25T10:00:00Z', metadata: { normalizedCapability: 'code-review-ai', domainCategory: 'coding', demandState: 'UNSUPPORTED' } as any },
    { eventType: 'DEMAND_DISCOVERED', userId: 'u2', sessionId: 's2', createdAt: '2026-08-26T10:00:00Z', metadata: { normalizedCapability: 'code-review-ai', domainCategory: 'coding', demandState: 'UNSUPPORTED' } as any },
  ];
  const newRes = aggregateDemandEvents(newEvents, { start: new Date('2026-08-01T00:00:00Z'), end: new Date('2026-08-30T00:00:00Z') });
  assert(
    newRes.allDemands[0].growthLabel === 'New' && newRes.newDemandsCount === 1,
    'New Demand correctly identified when previous period has 0 requests'
  );

  // --------------------------------------------------------------------------
  // TEST 14: Stable Demand Detection
  // 2 previous, 2 recent -> growthRate = 0, label = 'Stable'
  // --------------------------------------------------------------------------
  const stableEvents: AgentAnalyticsEvent[] = [
    { eventType: 'DEMAND_MATCHED', userId: 'u1', sessionId: 's1', createdAt: '2026-08-05T10:00:00Z', metadata: { normalizedCapability: 'music-streaming', domainCategory: 'audio', demandState: 'SUPPORTED' } as any },
    { eventType: 'DEMAND_MATCHED', userId: 'u2', sessionId: 's2', createdAt: '2026-08-06T10:00:00Z', metadata: { normalizedCapability: 'music-streaming', domainCategory: 'audio', demandState: 'SUPPORTED' } as any },
    { eventType: 'DEMAND_MATCHED', userId: 'u3', sessionId: 's3', createdAt: '2026-08-20T10:00:00Z', metadata: { normalizedCapability: 'music-streaming', domainCategory: 'audio', demandState: 'SUPPORTED' } as any },
    { eventType: 'DEMAND_MATCHED', userId: 'u4', sessionId: 's4', createdAt: '2026-08-21T10:00:00Z', metadata: { normalizedCapability: 'music-streaming', domainCategory: 'audio', demandState: 'SUPPORTED' } as any },
  ];
  const stableRes = aggregateDemandEvents(stableEvents, { start: new Date('2026-08-01T00:00:00Z'), end: new Date('2026-08-30T00:00:00Z') });
  assert(
    stableRes.allDemands[0].growthRate === 0 && stableRes.allDemands[0].growthLabel === 'Stable',
    'Stable Demand correctly identified with 0% growth'
  );

  // --------------------------------------------------------------------------
  // TEST 15: Domain Aggregation
  // --------------------------------------------------------------------------
  assert(
    multiRes.domainDistribution.length === 9 &&
    multiRes.domainDistribution.some(d => d.domain === 'video' && d.count === 1) &&
    multiRes.domainDistribution.some(d => d.domain === 'audio' && d.count === 1),
    'Domain Aggregation correctly summarizes valid domains'
  );

  // --------------------------------------------------------------------------
  // TEST 16: State Aggregation
  // --------------------------------------------------------------------------
  assert(
    multiRes.stateDistribution.length === 4 &&
    multiRes.stateDistribution.find(s => s.state === 'SUPPORTED')?.count === 1 &&
    multiRes.stateDistribution.find(s => s.state === 'NEAR_MATCH')?.count === 1 &&
    multiRes.stateDistribution.find(s => s.state === 'UNSUPPORTED')?.count === 1,
    'State Aggregation provides exact breakdown for 4 states'
  );

  // --------------------------------------------------------------------------
  // TEST 17: Date Filtering
  // --------------------------------------------------------------------------
  const dateEvents: AgentAnalyticsEvent[] = [
    { eventType: 'DEMAND_DISCOVERED', userId: 'u1', sessionId: 's1', createdAt: '2026-07-01T10:00:00Z', metadata: { normalizedCapability: 'old-cap', domainCategory: 'other', demandState: 'UNSUPPORTED' } as any },
    { eventType: 'DEMAND_DISCOVERED', userId: 'u2', sessionId: 's2', createdAt: '2026-08-15T10:00:00Z', metadata: { normalizedCapability: 'new-cap', domainCategory: 'other', demandState: 'UNSUPPORTED' } as any },
  ];
  // Filter events before aggregation
  const filteredEvents = dateEvents.filter(e => new Date(e.createdAt!) >= new Date('2026-08-01T00:00:00Z'));
  const dateRes = aggregateDemandEvents(filteredEvents);
  assert(
    dateRes.allDemands.length === 1 && dateRes.allDemands[0].capability === 'new-cap',
    'Date Filtering correctly limits events to requested time window'
  );

  // --------------------------------------------------------------------------
  // TEST 18: Capability Search
  // --------------------------------------------------------------------------
  const searchRes = filterAndPaginateDemands(multiRes.allDemands, { searchQuery: 'video' });
  assert(
    searchRes.items.length === 1 && searchRes.items[0].capability === 'ai-text-to-video',
    'Capability Search finds matching keywords'
  );

  // --------------------------------------------------------------------------
  // TEST 19: Sorting by Priority & Requests
  // --------------------------------------------------------------------------
  const sortRes = filterAndPaginateDemands(multiRes.allDemands, { sortBy: 'priority' });
  assert(
    sortRes.items[0].priorityScore >= sortRes.items[1].priorityScore,
    'Sorting orders items strictly by Priority Score descending'
  );

  // --------------------------------------------------------------------------
  // TEST 20: Pagination (8 rows per page)
  // --------------------------------------------------------------------------
  const manyDemands = Array.from({ length: 15 }, (_, i) => ({
    capability: `cap-${i + 1}`,
    domainCategory: 'video' as const,
    dominantState: 'UNSUPPORTED' as const,
    totalRequests: 10 + i,
    uniqueUsers: 5,
    uniqueSessions: 5,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    recentRequests: 5,
    previousRequests: 5,
    growthRate: 0,
    growthLabel: 'Stable' as const,
    priorityScore: 20 + i,
    stateBreakdown: { SUPPORTED: 0, NEAR_MATCH: 0, UNSUPPORTED: 10 + i, AMBIGUOUS: 0 },
    sampleQueries: [],
  }));
  const page1 = filterAndPaginateDemands(manyDemands, { page: 1, perPage: 8 });
  const page2 = filterAndPaginateDemands(manyDemands, { page: 2, perPage: 8 });
  assert(
    page1.items.length === 8 && page2.items.length === 7 && page1.totalPages === 2,
    'Pagination correctly splits items across pages (8 items/page)'
  );

  // --------------------------------------------------------------------------
  // TEST 21: Privacy Redaction
  // --------------------------------------------------------------------------
  const rawSensitive = 'cần mua tool liên hệ 0966821315 email admin@shopofbow.com password: secretPassword123';
  const cleanQ = sanitizeQueryText(rawSensitive);
  assert(
    cleanQ.includes('[PHONE]') &&
    cleanQ.includes('[EMAIL]') &&
    cleanQ.includes('[REDACTED]') &&
    !cleanQ.includes('0966821315') &&
    !cleanQ.includes('admin@shopofbow.com') &&
    !cleanQ.includes('secretPassword123'),
    'Privacy Redaction strips phone, email, password'
  );

  // --------------------------------------------------------------------------
  // TEST 22: Sensitive Metadata Exclusion
  // --------------------------------------------------------------------------
  const sensitiveMeta = sanitizeQueryText('token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz card 4111222233334444');
  assert(
    sensitiveMeta.includes('[REDACTED]') &&
    sensitiveMeta.includes('[CARD]') &&
    !sensitiveMeta.includes('eyJhbGci') &&
    !sensitiveMeta.includes('4111222233334444'),
    'Sensitive Metadata Exclusion redacts tokens and card numbers'
  );

  console.log('\n================================================================');
  console.log(`=== TEST SUMMARY: ${passed}/${total} SCENARIOS PASSED (${Math.round((passed / total) * 100)}%) ===`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runPhase3Tests();
