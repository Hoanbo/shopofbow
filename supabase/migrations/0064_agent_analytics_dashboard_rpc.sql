-- supabase/migrations/0064_agent_analytics_dashboard_rpc.sql

-- RPC function to aggregate analytics for the dashboard
CREATE OR REPLACE FUNCTION public.get_agent_analytics_dashboard(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Basic check to ensure the user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'kpis', (
      SELECT jsonb_build_object(
        'total_sessions', COUNT(DISTINCT session_id),
        'total_messages', COUNT(*) FILTER (WHERE event_type = 'MESSAGE_RECEIVED'),
        'intent_resolved', COUNT(*) FILTER (WHERE event_type = 'INTENT_RESOLVED'),
        'product_resolved', COUNT(*) FILTER (WHERE event_type = 'PRODUCT_RESOLVED'),
        'plan_resolved', COUNT(*) FILTER (WHERE event_type = 'PLAN_RESOLVED'),
        'clarification_requested', COUNT(*) FILTER (WHERE event_type = 'CLARIFICATION_REQUESTED'),
        'unresolved', COUNT(*) FILTER (WHERE event_type IN ('INTENT_UNRESOLVED', 'PRODUCT_UNRESOLVED', 'PLAN_UNRESOLVED')),
        'action_shown', COUNT(*) FILTER (WHERE event_type = 'ACTION_SHOWN'),
        'action_clicked', COUNT(*) FILTER (WHERE event_type = 'ACTION_CLICKED'),
        'action_expired', COUNT(*) FILTER (WHERE event_type = 'ACTION_EXPIRED'),
        'checkout_opened', COUNT(*) FILTER (WHERE event_type = 'CHECKOUT_OPENED'),
        'checkout_success', COUNT(*) FILTER (WHERE event_type = 'CHECKOUT_SUCCESS')
      )
      FROM public.agent_analytics_events
      WHERE (p_start_date IS NULL OR created_at >= p_start_date)
        AND (p_end_date IS NULL OR created_at <= p_end_date)
    ),
    'top_intents', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('intent', intent, 'count', c)), '[]'::jsonb)
      FROM (
        SELECT intent, COUNT(*) as c
        FROM public.agent_analytics_events
        WHERE event_type = 'INTENT_RESOLVED' 
          AND intent IS NOT NULL
          AND (p_start_date IS NULL OR created_at >= p_start_date)
          AND (p_end_date IS NULL OR created_at <= p_end_date)
        GROUP BY intent
        ORDER BY c DESC
        LIMIT 10
      ) t
    ),
    'top_products', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'product_id', product_id,
        'resolved_count', resolved_count,
        'clicked_count', clicked_count,
        'checkout_success_count', checkout_success_count
      )), '[]'::jsonb)
      FROM (
        SELECT 
          product_id,
          COUNT(*) FILTER (WHERE event_type = 'PRODUCT_RESOLVED') as resolved_count,
          COUNT(*) FILTER (WHERE event_type = 'ACTION_CLICKED') as clicked_count,
          COUNT(*) FILTER (WHERE event_type = 'CHECKOUT_SUCCESS') as checkout_success_count
        FROM public.agent_analytics_events
        WHERE product_id IS NOT NULL
          AND (p_start_date IS NULL OR created_at >= p_start_date)
          AND (p_end_date IS NULL OR created_at <= p_end_date)
        GROUP BY product_id
        ORDER BY resolved_count DESC
        LIMIT 15
      ) p
    ),
    'top_plans', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'plan_id', plan_id,
        'product_id', max_product_id,
        'resolved_count', resolved_count,
        'clicked_count', clicked_count,
        'checkout_success_count', checkout_success_count
      )), '[]'::jsonb)
      FROM (
        SELECT 
          plan_id,
          MAX(product_id) as max_product_id,
          COUNT(*) FILTER (WHERE event_type = 'PLAN_RESOLVED') as resolved_count,
          COUNT(*) FILTER (WHERE event_type = 'ACTION_CLICKED') as clicked_count,
          COUNT(*) FILTER (WHERE event_type = 'CHECKOUT_SUCCESS') as checkout_success_count
        FROM public.agent_analytics_events
        WHERE plan_id IS NOT NULL
          AND (p_start_date IS NULL OR created_at >= p_start_date)
          AND (p_end_date IS NULL OR created_at <= p_end_date)
        GROUP BY plan_id
        ORDER BY resolved_count DESC
        LIMIT 15
      ) tp
    ),
    'unresolved_reasons', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('reason', reason, 'count', c)), '[]'::jsonb)
      FROM (
        SELECT reason, COUNT(*) as c
        FROM public.agent_analytics_events
        WHERE event_type IN ('INTENT_UNRESOLVED', 'PRODUCT_UNRESOLVED', 'PLAN_UNRESOLVED', 'CLARIFICATION_REQUESTED')
          AND reason IS NOT NULL
          AND (p_start_date IS NULL OR created_at >= p_start_date)
          AND (p_end_date IS NULL OR created_at <= p_end_date)
        GROUP BY reason
        ORDER BY c DESC
        LIMIT 10
      ) ur
    ),
    'user_phrases', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('query', query_text, 'count', c)), '[]'::jsonb)
      FROM (
        SELECT metadata->>'query' as query_text, COUNT(*) as c
        FROM public.agent_analytics_events
        WHERE event_type = 'MESSAGE_RECEIVED'
          AND metadata->>'query' IS NOT NULL
          AND (p_start_date IS NULL OR created_at >= p_start_date)
          AND (p_end_date IS NULL OR created_at <= p_end_date)
        GROUP BY metadata->>'query'
        ORDER BY c DESC
        LIMIT 20
      ) up
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;
