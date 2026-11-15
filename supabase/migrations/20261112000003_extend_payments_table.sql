-- ==============================================================================
-- JAY'S FOOD COURT (JFC) - PHASE 4: EXTEND & HARDEN PAYMENTS TABLE
-- Extends the existing public.payments table instead of duplicating structures.
-- Supports:
-- 1. Currency column (CHECK currency = 'NGN')
-- 2. Gateway response metadata (JSONB)
-- 3. Initialization timestamp (initialized_at)
-- 4. Verification timestamp (verified_at)
-- 5. Webhook event tracking (webhook_event_id, webhook_received_at)
-- 6. Refund tracking (refund_status, refund_amount, refunded_at, refund_reason)
-- 7. Atomic confirmation RPC (confirm_order_payment_atomic)
-- 8. Immutable payment audit history (prevents silent overwrites)
-- ==============================================================================

BEGIN;

-- 1. Extend existing public.payments table with missing operational columns
ALTER TABLE public.payments 
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
    ADD COLUMN IF NOT EXISTS gateway_response TEXT,
    ADD COLUMN IF NOT EXISTS gateway_metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    ADD COLUMN IF NOT EXISTS initialized_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS webhook_event_id TEXT,
    ADD COLUMN IF NOT EXISTS webhook_received_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'none' CHECK (refund_status IN ('none', 'pending', 'partial', 'full', 'failed')),
    ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12, 2) DEFAULT 0.00 CHECK (refund_amount >= 0),
    ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS refund_reason TEXT;

-- 2. Indexes for reference lookups, order relationships, and webhook events
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_reference ON public.payments(provider_reference);
CREATE INDEX IF NOT EXISTS idx_payments_webhook_event_id ON public.payments(webhook_event_id);

-- 3. Prevent silent deletion or arbitrary updates of verified payments
CREATE OR REPLACE FUNCTION public.protect_verified_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Forbid deletion of successful or refunded payments
    IF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('successful', 'refunded') THEN
            RAISE EXCEPTION 'SECURITY VIOLATION: Verified payment records are immutable and cannot be deleted.';
        END IF;
        RETURN OLD;
    END IF;

    -- Forbid modification of successful payments back to pending or altering paid amount
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'successful' AND NEW.status = 'pending' THEN
            RAISE EXCEPTION 'SECURITY VIOLATION: A successful payment cannot be reverted to pending.';
        END IF;

        IF OLD.status = 'successful' AND NEW.amount <> OLD.amount THEN
            RAISE EXCEPTION 'SECURITY VIOLATION: The amount on a verified payment cannot be altered.';
        END IF;

        NEW.updated_at = TIMEZONE('utc', NOW());
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_verified_payments ON public.payments;
CREATE TRIGGER trg_protect_verified_payments
    BEFORE UPDATE OR DELETE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.protect_verified_payments();

-- 4. Atomic PostgreSQL Transaction: Confirm Payment & Update Order Status
CREATE OR REPLACE FUNCTION public.confirm_order_payment_atomic(
    p_order_id UUID,
    p_provider_reference TEXT,
    p_amount NUMERIC,
    p_currency TEXT,
    p_payment_method TEXT,
    p_gateway_response TEXT,
    p_gateway_metadata JSONB,
    p_webhook_event_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order RECORD;
    v_payment_id UUID;
    v_already_confirmed BOOLEAN := FALSE;
BEGIN
    -- Acquire exclusive row lock on the target order
    SELECT id, order_code, total_amount, status, payment_status
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_order.id IS NULL THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND: Order with ID % does not exist.', p_order_id;
    END IF;

    IF p_currency <> 'NGN' THEN
        RAISE EXCEPTION 'INVALID_CURRENCY: Expected currency NGN, received %', p_currency;
    END IF;

    IF ABS(v_order.total_amount - p_amount) > 0.01 THEN
        RAISE EXCEPTION 'AMOUNT_MISMATCH: Order total is ₦%, payment amount is ₦%', v_order.total_amount, p_amount;
    END IF;

    -- Check if order was already confirmed by previous concurrent delivery
    IF v_order.status <> 'pending_payment' AND v_order.payment_status = 'paid' THEN
        v_already_confirmed := TRUE;
    END IF;

    -- 1. Upsert or update the payment record atomically
    SELECT id INTO v_payment_id
    FROM public.payments
    WHERE provider_reference = p_provider_reference
    FOR UPDATE;

    IF v_payment_id IS NOT NULL THEN
        UPDATE public.payments
        SET
            status = 'successful',
            payment_method = COALESCE(p_payment_method, payment_method),
            gateway_response = COALESCE(p_gateway_response, gateway_response),
            gateway_metadata = COALESCE(p_gateway_metadata, gateway_metadata),
            webhook_event_id = COALESCE(p_webhook_event_id, webhook_event_id),
            webhook_received_at = TIMEZONE('utc', NOW()),
            verified_at = TIMEZONE('utc', NOW()),
            updated_at = TIMEZONE('utc', NOW())
        WHERE id = v_payment_id;
    ELSE
        v_payment_id := gen_random_uuid();
        INSERT INTO public.payments (
            id, order_id, amount, currency, payment_method, provider,
            provider_reference, status, gateway_response, gateway_metadata,
            webhook_event_id, webhook_received_at, verified_at, initialized_at,
            created_at, updated_at
        ) VALUES (
            v_payment_id, v_order.id, p_amount, p_currency, COALESCE(p_payment_method, 'paystack'), 'paystack',
            p_provider_reference, 'successful', p_gateway_response, COALESCE(p_gateway_metadata, '{}'::jsonb),
            p_webhook_event_id, TIMEZONE('utc', NOW()), TIMEZONE('utc', NOW()), TIMEZONE('utc', NOW()),
            TIMEZONE('utc', NOW()), TIMEZONE('utc', NOW())
        );
    END IF;

    -- 2. If order status is pending_payment, transition to confirmed atomically
    IF v_order.status = 'pending_payment' THEN
        UPDATE public.orders
        SET
            status = 'confirmed',
            payment_status = 'paid',
            payment_method = COALESCE(p_payment_method, 'card'),
            updated_at = TIMEZONE('utc', NOW())
        WHERE id = v_order.id;

        -- Immutable audit trail in the same ACID transaction
        INSERT INTO public.order_status_history (
            id, order_id, status, from_status, to_status, actor_type, actor_id, notes, created_at
        ) VALUES (
            gen_random_uuid(), v_order.id, 'confirmed', 'pending_payment', 'confirmed',
            'system', 'paystack_atomic_confirmation',
            'Payment verified and confirmed via Paystack. Ref: ' || p_provider_reference,
            TIMEZONE('utc', NOW())
        );
    END IF;

    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'order_id', v_order.id,
        'order_code', v_order.order_code,
        'status', 'confirmed',
        'payment_status', 'paid',
        'amount', p_amount,
        'is_replay', v_already_confirmed
    );
END;
$$;

-- Restrict execution to service_role
REVOKE ALL ON FUNCTION public.confirm_order_payment_atomic(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment_atomic(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB, TEXT) TO service_role;

COMMIT;
