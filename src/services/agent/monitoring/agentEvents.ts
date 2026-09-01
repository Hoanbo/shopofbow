import { supabase } from '../../../lib/supabase';
import type { AgentAnalyticsEvent } from './analyticsTypes';
import { sanitizeMetadata } from './analyticsSanitizer';

export async function insertAnalyticsEvent(event: AgentAnalyticsEvent) {
  try {
    const sanitizedMetadata = sanitizeMetadata(event.metadata);
    
    const isValidUuid = (id?: string | null) =>
      typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    const payload = {
      event_type: event.eventType,
      user_id: isValidUuid(event.userId) ? event.userId : null,
      session_id: event.sessionId || null,
      intent: event.intent || null,
      product_id: isValidUuid(event.productId) ? event.productId : null,
      plan_id: isValidUuid(event.planId) ? event.planId : null,
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
