import type { AgentAnalyticsEvent, NormalizedDemandMetadata, DemandState } from './analyticsTypes';
import { insertAnalyticsEvent } from '@bow/agent';
import { isAmbiguousDemandQuery } from '../intentResolver';

/**
 * Chuẩn hóa nhu cầu người dùng và phân loại thành 4 trạng thái:
 * SUPPORTED | NEAR_MATCH | UNSUPPORTED | AMBIGUOUS
 */
export function normalizeUserDemand(
  rawText: string,
  matchedProducts: Array<{ name: string; categoryName?: string | null; description?: string | null; features?: string[] | null }> = [],
  isAmbiguous = false
): NormalizedDemandMetadata {
  // 1. Privacy Sanitization: Redact phone, email, card numbers from raw query
  const cleanChars = (rawText || '')
    .replace(/[<>{}`\\;]/g, '')
    .slice(0, 150)
    .trim();

  const sanitizedQuery = cleanChars
    .replace(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/gi, '[EMAIL]')
    .replace(/(?:\+84|0)[1-9]\d{7,9}\b/g, '[PHONE]')
    .replace(/\b(?:\d[ -]*?){13,16}\b/g, '[CARD]');

  const lower = sanitizedQuery.toLowerCase();

  // 2. Canonical Capability Mapping & Domain Extraction
  let normalizedCapability = 'general-query';
  let domainCategory: NormalizedDemandMetadata['domainCategory'] = 'other';
  let isNearMatch = false;

  if (
    lower.includes('video từ chữ') ||
    lower.includes('text to video') ||
    lower.includes('tạo video từ text') ||
    lower.includes('làm video từ text') ||
    lower.includes('tạo video bằng text') ||
    lower.includes('làm video bằng text') ||
    lower.includes('kịch bản thành clip') ||
    lower.includes('kịch bản thành video')
  ) {
    normalizedCapability = 'ai-text-to-video';
    domainCategory = 'video';
    isNearMatch = true; // Catalog has video tools (CapCut, Kling) covering part of video creation
  } else if (lower.includes('video') || lower.includes('dựng phim') || lower.includes('edit clip') || lower.includes('làm video')) {
    normalizedCapability = 'ai-video-editing';
    domainCategory = 'video';
  } else if (lower.includes('nghe nhạc') || lower.includes('music') || lower.includes('bài hát') || lower.includes('âm nhạc')) {
    normalizedCapability = 'music-streaming';
    domainCategory = 'audio';
  } else if (lower.includes('xem phim') || lower.includes('phim bộ') || lower.includes('bóng đá') || lower.includes('movie')) {
    normalizedCapability = 'movie-streaming';
    domainCategory = 'entertainment';
  } else if (lower.includes('clone giọng') || lower.includes('nhân bản giọng') || lower.includes('giọng nói ai') || lower.includes('voice')) {
    normalizedCapability = 'voice-cloning';
    domainCategory = 'audio';
  } else if (lower.includes('chỉnh ảnh') || lower.includes('vẽ ảnh') || lower.includes('tạo ảnh') || lower.includes('thiết kế') || lower.includes('photoshop')) {
    normalizedCapability = 'ai-image-generation';
    domainCategory = 'design';
  } else if (lower.includes('viết code') || lower.includes('lập trình') || lower.includes('coding') || lower.includes('developer') || lower.includes('cursor')) {
    normalizedCapability = 'code-assistant';
    domainCategory = 'coding';
  } else if (lower.includes('học tiếng anh') || lower.includes('ngoại ngữ') || lower.includes('duolingo') || lower.includes('học tập')) {
    normalizedCapability = 'language-learning';
    domainCategory = 'education';
  } else if (lower.includes('bảo mật') || lower.includes('vpn') || lower.includes('lưu trữ') || lower.includes('drive') || lower.includes('cloud')) {
    normalizedCapability = 'cloud-security';
    domainCategory = 'productivity';
  } else if (lower.includes('tàu vũ trụ') || lower.includes('vũ trụ') || lower.includes('spacecraft') || lower.includes('quản lý vệ tinh')) {
    normalizedCapability = 'spacecraft-management';
    domainCategory = 'productivity';
  }

  // 3. 4-State Demand Classification
  let demandState: DemandState;
  const isAmbiguousQuery = isAmbiguous || isAmbiguousDemandQuery(rawText);

  if (isAmbiguousQuery) {
    demandState = 'AMBIGUOUS';
  } else if (matchedProducts.length === 0) {
    demandState = 'UNSUPPORTED';
  } else if (isNearMatch) {
    demandState = 'NEAR_MATCH';
  } else {
    demandState = 'SUPPORTED';
  }

  return {
    rawQuery: sanitizedQuery,
    normalizedCapability,
    domainCategory,
    demandState,
    matchedCount: matchedProducts.length,
    confidence: demandState === 'SUPPORTED' ? 0.95 : demandState === 'NEAR_MATCH' ? 0.8 : demandState === 'UNSUPPORTED' ? 0.9 : 0.4,
    candidateNames: matchedProducts.map((p) => p.name),
  };
}

/**
 * Lớp AgentAnalytics wrapper giúp Agent Core giao tiếp với Analytics API
 * mà không bao giờ block hoặc làm crash Agent (Fail-silent).
 */
export const agentAnalytics = {
  track: (event: AgentAnalyticsEvent) => {
    // Fire and forget
    Promise.resolve().then(() => insertAnalyticsEvent(event)).catch(() => {
      // Ignored intentionally to be non-blocking
    });
  }
};
