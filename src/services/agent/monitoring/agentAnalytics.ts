import type { AgentAnalyticsEvent } from './analyticsTypes';
import { insertAnalyticsEvent } from './agentEvents';

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
