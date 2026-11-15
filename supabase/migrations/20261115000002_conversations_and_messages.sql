-- ==============================================================================
-- PHASE 2: DATABASE DESIGN — CONVERSATIONS & MESSAGES SCHEMA
-- Jay's Food Court — Customer-Rider Communication Architecture
-- ==============================================================================

BEGIN;

-- 1. Create order_conversations table
-- Represents an isolated, secure messaging session for a specific order.
-- Lifecycle:
-- - Belongs to one order (order_id)
-- - Associated with the customer (customer_id / customer_phone fallback)
-- - Associated with the currently assigned rider (rider_id)
-- - Status transitions: 'active' -> 'closed'
CREATE TABLE IF NOT EXISTS public.order_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_code TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_phone TEXT NOT NULL,
    rider_id UUID REFERENCES public.riders(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    closed_at TIMESTAMPTZ
);

-- One active conversation per order
-- If reassigned or completed, a conversation can be marked 'closed', allowing a new conversation or keeping history safely scoped.
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_conversations_active_order 
    ON public.order_conversations(order_id) 
    WHERE (status = 'active');

CREATE INDEX IF NOT EXISTS idx_order_conversations_order_id ON public.order_conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_order_conversations_order_code ON public.order_conversations(order_code);
CREATE INDEX IF NOT EXISTS idx_order_conversations_customer_id ON public.order_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_conversations_rider_id ON public.order_conversations(rider_id);

-- 2. Adapt / Create order_messages table
-- Supports:
-- - Foreign key to order_conversations(id)
-- - client_message_id with unique constraint per conversation (idempotent submissions)
-- - message_type ('text')
-- - sender_role ('customer', 'rider', 'system')
-- - timestamps: created_at, delivered_at, read_at, deleted_at (soft delete support)
-- - content length check (max 1000 chars)

-- Drop existing order_messages table or adapt it
DROP TABLE IF EXISTS public.order_messages CASCADE;

CREATE TABLE public.order_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.order_conversations(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_code TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'rider', 'system')),
    sender_name TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system_event')),
    content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 1000),
    client_message_id TEXT,
    delivery_status TEXT NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    delivered_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    read_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- Idempotency constraint: A client_message_id cannot be submitted twice for the same conversation
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_messages_idempotency 
    ON public.order_messages(conversation_id, client_message_id) 
    WHERE (client_message_id IS NOT NULL);

-- Cursor pagination index: (conversation_id, created_at DESC, id DESC)
CREATE INDEX IF NOT EXISTS idx_order_messages_cursor 
    ON public.order_messages(conversation_id, created_at DESC, id DESC)
    WHERE (deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_order_messages_order_id ON public.order_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_order_code ON public.order_messages(order_code);

-- 3. Publication for Supabase Realtime
-- Enable live broadcast and postgres_changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.order_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_order_conversations_service_role ON public.order_conversations;
CREATE POLICY p_order_conversations_service_role ON public.order_conversations
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS p_order_messages_service_role ON public.order_messages;
CREATE POLICY p_order_messages_service_role ON public.order_messages
    FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

COMMIT;
