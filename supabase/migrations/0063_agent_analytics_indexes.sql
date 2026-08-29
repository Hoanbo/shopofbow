-- supabase/migrations/0063_agent_analytics_indexes.sql

-- Add missing indexes requested by the audit
CREATE INDEX IF NOT EXISTS idx_agent_analytics_session_id ON public.agent_analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_analytics_user_id ON public.agent_analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_analytics_plan_id ON public.agent_analytics_events(plan_id);
