-- ==============================================================================
-- JAY'S FOOD COURT (JFC) - PHASE 4.1: HARDEN WEBHOOK EVENT STATUSES
-- Refines public.payment_webhook_events with explicit processing lifecycle:
-- - 'received': Webhook payload stored before processing
-- - 'processing': Work currently in flight
-- - 'verified_success': Financial operation succeeded durably
-- - 'failed_retryable': Upstream or temporary DB failure; Paystack will retry (HTTP 500/503)
-- - 'failed_terminal': Invalid data, signature or permanent mismatch requiring manual review (HTTP 400/401)
-- - 'failed': Retained for backwards compatibility with prior rows
-- ==============================================================================

BEGIN;

-- Migrate any legacy 'failed' rows to 'failed_terminal' if desired, or retain 'failed' in CHECK
ALTER TABLE public.payment_webhook_events
    DROP CONSTRAINT IF EXISTS payment_webhook_events_verification_status_check;

ALTER TABLE public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_verification_status_check
    CHECK (verification_status IN (
        'received',
        'processing',
        'verified_success',
        'failed_retryable',
        'failed_terminal',
        'failed',
        'amount_mismatch',
        'invalid_signature',
        'duplicate_ignored'
    ));

ALTER TABLE public.payment_webhook_events
    ADD COLUMN IF NOT EXISTS attempt_count INT DEFAULT 1 NOT NULL;

COMMIT;
