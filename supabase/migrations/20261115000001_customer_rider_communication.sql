-- ==============================================================================
-- JAY'S FOOD COURT: CUSTOMER–RIDER COMMUNICATION SCHEMA
-- Persistent Messages, Read Receipts, Typing, Call History, and Audio Rooms
-- ==============================================================================

BEGIN;

-- 1. Persistent Messages Table
CREATE TABLE IF NOT EXISTS public.order_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_code TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'rider', 'system')),
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    content TEXT NOT NULL CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 1000),
    delivery_status TEXT NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read')),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_messages_order_code_created ON public.order_messages(order_code, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON public.order_messages(order_id);

-- 2. Call Logs Table (Missed, Completed, Declined, Duration)
CREATE TABLE IF NOT EXISTS public.order_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_code TEXT NOT NULL,
    caller_role TEXT NOT NULL CHECK (caller_role IN ('customer', 'rider')),
    caller_name TEXT NOT NULL,
    callee_role TEXT NOT NULL CHECK (callee_role IN ('customer', 'rider')),
    status TEXT NOT NULL CHECK (status IN ('initiated', 'ringing', 'accepted', 'completed', 'missed', 'declined', 'failed')),
    duration_seconds INTEGER DEFAULT 0,
    room_name TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_order_calls_order_code_created ON public.order_calls(order_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_calls_order_id ON public.order_calls(order_id);

-- 3. Enable Supabase Realtime for order_messages & order_calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_calls;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_calls ENABLE ROW LEVEL SECURITY;

-- Service role has full access; client queries route through secure API endpoints with HMAC validation
DROP POLICY IF EXISTS p_messages_service_role ON public.order_messages;
CREATE POLICY p_messages_service_role ON public.order_messages
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS p_calls_service_role ON public.order_calls;
CREATE POLICY p_calls_service_role ON public.order_calls
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;
