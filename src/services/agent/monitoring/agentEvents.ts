import { supabase } from '../../../lib/supabase';
import type { AgentAnalyticsEvent } from './analyticsTypes';
import { sanitizeMetadata } from './analyticsSanitizer';

export async function insertAnalyticsEvent(event: AgentAnalyticsEvent) {
  try {
    const sanitizedMetadata = sanitizeMetadata(event.metadata);
    
    const payload = {
      event_type: event.eventType,
      user_id: event.userId || null,
      session_id: event.sessionId || null,
      intent: event.intent || null,
      product_id: event.productId || null,
      plan_id: event.planId || null,
      action_id: event.actionId || null,
      action_type: event.actionType || null,
      reason: event.reason || null,
      metadata: sanitizedMetadata || {},
    };

    const { error } = await (supabase as any).from('agent_analytics_events').insert([payload]);
    
    if (error) {
      console.warn('[Monitoring] Failed to insert analytics event:', error.message);
    }
  } catch (err) {
    console.warn('[Monitoring] Exception during analytics insert:', err);
  }
}
