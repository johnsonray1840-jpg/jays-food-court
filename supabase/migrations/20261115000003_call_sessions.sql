-- ==============================================================================
-- PHASE 2.3: DATABASE DESIGN — CALL SESSIONS
-- Jay's Food Court — Customer-Rider Communication Architecture
-- ==============================================================================

BEGIN;

-- 1. Create call_sessions table (and view/alias for order_calls backwards compatibility)
-- Fields required:
-- id, conversation_id, caller_id, receiver_id, livekit_room_id, status, started_at, answered_at, ended_at, duration_seconds, end_reason, created_at
-- Call states:
-- initiating, ringing, accepted, connected, declined, missed, ended, failed

DROP TABLE IF EXISTS public.call_sessions CASCADE;

CREATE TABLE public.call_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.order_conversations(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_code TEXT NOT NULL,
    caller_id TEXT NOT NULL,
    caller_role TEXT NOT NULL CHECK (caller_role IN ('customer', 'rider')),
    caller_name TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    receiver_role TEXT NOT NULL CHECK (receiver_role IN ('customer', 'rider')),
    receiver_name TEXT NOT NULL,
    livekit_room_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'initiating' CHECK (status IN (
        'initiating',
        'ringing',
        'accepted',
        'connected',
        'declined',
        'missed',
        'ended',
        'failed'
    )),
    started_at TIMESTAMPTZ,
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0 CHECK (duration_seconds >= 0),
    end_reason TEXT CHECK (end_reason IS NULL OR end_reason IN (
        'normal_hangup',
        'caller_cancelled',
        'receiver_declined',
        'timeout_no_answer',
        'connection_error',
        'permission_denied'
    )),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- At most one active call session per conversation in a transient state
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_sessions_active_conversation 
    ON public.call_sessions(conversation_id) 
    WHERE (status IN ('initiating', 'ringing', 'accepted', 'connected'));

-- Indexes for performance and query lookups
CREATE INDEX IF NOT EXISTS idx_call_sessions_conversation_id ON public.call_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_order_id ON public.call_sessions(order_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_order_code_created ON public.call_sessions(order_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_sessions_livekit_room ON public.call_sessions(livekit_room_id);

-- Backwards-compatibility view or table for order_calls
DROP TABLE IF EXISTS public.order_calls CASCADE;
CREATE VIEW public.order_calls AS 
    SELECT 
        id,
        order_id,
        order_code,
        caller_role,
        caller_name,
        receiver_role AS callee_role,
        status,
        duration_seconds,
        livekit_room_id AS room_name,
        created_at,
        ended_at
    FROM public.call_sessions;

-- 2. Add to Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_call_sessions_service_role ON public.call_sessions;
CREATE POLICY p_call_sessions_service_role ON public.call_sessions
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;
