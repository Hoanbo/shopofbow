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
  | 'SESSION_RESET';

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
  metadata?: Record<string, unknown>;
  createdAt?: string;
}
