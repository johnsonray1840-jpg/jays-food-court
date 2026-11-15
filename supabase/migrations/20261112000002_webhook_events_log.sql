-- ==============================================================================
-- JAY'S FOOD COURT (JFC) - PHASE 4: WEBHOOK AUDIT & IDEMPOTENCY LOG
-- Dedicated table for tracking incoming Paystack webhook events, recording
-- verification outcomes, and guaranteeing concurrency-safe idempotency.
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE, -- e.g. Paystack event id or reference
    event_type TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'paystack',
    provider_reference TEXT NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    verification_status TEXT NOT NULL CHECK (verification_status IN ('processing', 'verified_success', 'amount_mismatch', 'invalid_signature', 'duplicate_ignored', 'failed')),
    error_message TEXT,
    processed_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_reference
    ON public.payment_webhook_events(provider_reference);

CREATE INDEX IF NOT EXISTS idx_webhook_events_order
    ON public.payment_webhook_events(order_id);

-- Restrict to service_role
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payment_webhook_events TO service_role;

COMMIT;
