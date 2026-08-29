-- supabase/migrations/0062_agent_analytics_events.sql

CREATE TABLE IF NOT EXISTS public.agent_analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    session_id TEXT,
    intent TEXT,
    product_id TEXT,
    plan_id TEXT,
    action_id TEXT,
    action_type TEXT,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.agent_analytics_events ENABLE ROW LEVEL SECURITY;

-- Analytics Events RLS Policies
-- Allow anyone (anon, authenticated) to INSERT events.
-- We want to track guest users as well, and we do not want to block INSERTs.
CREATE POLICY "Allow anyone to insert agent analytics events"
    ON public.agent_analytics_events
    FOR INSERT
    WITH CHECK (true);

-- Allow only admins to SELECT events.
CREATE POLICY "Allow admins to view agent analytics events"
    ON public.agent_analytics_events
    FOR SELECT
    USING (
        (auth.jwt() ->> 'role') = 'authenticated' 
        AND 
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Create indexes for fast dashboard queries
CREATE INDEX IF NOT EXISTS idx_agent_analytics_event_type ON public.agent_analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_agent_analytics_created_at ON public.agent_analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_agent_analytics_product_id ON public.agent_analytics_events(product_id);
CREATE INDEX IF NOT EXISTS idx_agent_analytics_intent ON public.agent_analytics_events(intent);
