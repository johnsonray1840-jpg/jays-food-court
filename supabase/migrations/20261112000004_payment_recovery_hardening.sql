-- ==============================================================================
-- JAY'S FOOD COURT (JFC) - PHASE 4.1: PAYMENT RECOVERY & FINANCIAL INTEGRITY
-- Hardens confirm_order_payment_atomic against:
-- 1. Late payments received on expired/cancelled orders (flags refund_status='pending',
--    records reason, leaves order cancelled, prevents kitchen dispatch).
-- 2. Duplicate separate payments for the same order (flags second payment as refund_status='pending').
-- 3. Detailed audit trail in order_status_history with incident flagging.
-- ==============================================================================

BEGIN;

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
    v_existing_payment_status TEXT;
    v_already_confirmed BOOLEAN := FALSE;
    v_is_late_payment BOOLEAN := FALSE;
    v_is_duplicate_payment BOOLEAN := FALSE;
    v_refund_status TEXT := 'none';
    v_refund_reason TEXT := NULL;
    v_outcome_status TEXT;
BEGIN
    -- 1. Acquire exclusive row lock on the target order
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

    -- 2. Inspect order state for financial edge cases
    -- Check if order is already cancelled / expired
    IF v_order.status = 'cancelled' THEN
        v_is_late_payment := TRUE;
        v_refund_status := 'pending';
        v_refund_reason := 'Payment received after order was cancelled/expired. Kitchen preparation blocked.';
    -- Check if order was already confirmed and paid
    ELSIF v_order.status <> 'pending_payment' AND v_order.payment_status = 'paid' THEN
        v_already_confirmed := TRUE;
    END IF;

    -- 3. Lock payment record if already registered by initialization or previous webhook
    SELECT id, status INTO v_payment_id, v_existing_payment_status
    FROM public.payments
    WHERE provider_reference = p_provider_reference
    FOR UPDATE;

    -- If another successful payment with a DIFFERENT reference already paid this order,
    -- this is a duplicate charge that requires immediate refund.
    IF v_already_confirmed AND (v_payment_id IS NULL OR v_existing_payment_status <> 'successful') THEN
        v_is_duplicate_payment := TRUE;
        v_refund_status := 'pending';
        v_refund_reason := 'Duplicate payment received for already paid order. Customer debited twice.';
    END IF;

    -- 4. Upsert payment record atomically
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
            refund_status = CASE WHEN v_refund_status <> 'none' THEN v_refund_status ELSE refund_status END,
            refund_reason = CASE WHEN v_refund_reason IS NOT NULL THEN v_refund_reason ELSE refund_reason END,
            updated_at = TIMEZONE('utc', NOW())
        WHERE id = v_payment_id;
    ELSE
        v_payment_id := gen_random_uuid();
        INSERT INTO public.payments (
            id, order_id, amount, currency, payment_method, provider,
            provider_reference, status, gateway_response, gateway_metadata,
            webhook_event_id, webhook_received_at, verified_at, initialized_at,
            refund_status, refund_reason,
            created_at, updated_at
        ) VALUES (
            v_payment_id, v_order.id, p_amount, p_currency, COALESCE(p_payment_method, 'paystack'), 'paystack',
            p_provider_reference, 'successful', p_gateway_response, COALESCE(p_gateway_metadata, '{}'::jsonb),
            p_webhook_event_id, TIMEZONE('utc', NOW()), TIMEZONE('utc', NOW()), TIMEZONE('utc', NOW()),
            v_refund_status, v_refund_reason,
            TIMEZONE('utc', NOW()), TIMEZONE('utc', NOW())
        );
    END IF;

    -- 5. Transition order status ONLY if still pending_payment
    IF v_order.status = 'pending_payment' THEN
        UPDATE public.orders
        SET
            status = 'confirmed',
            payment_status = 'paid',
            payment_method = COALESCE(p_payment_method, 'card'),
            updated_at = TIMEZONE('utc', NOW())
        WHERE id = v_order.id;

        INSERT INTO public.order_status_history (
            id, order_id, status, from_status, to_status, actor_type, actor_id, notes, created_at
        ) VALUES (
            gen_random_uuid(), v_order.id, 'confirmed', 'pending_payment', 'confirmed',
            'system', 'paystack_atomic_confirmation',
            'Payment verified and confirmed via Paystack. Ref: ' || p_provider_reference,
            TIMEZONE('utc', NOW())
        );
        v_outcome_status := 'confirmed';
    ELSIF v_is_late_payment THEN
        -- Strictly DO NOT transition order to confirmed; keep cancelled to protect kitchen
        -- But record explicit incident audit history for financial refund reconciliation
        INSERT INTO public.order_status_history (
            id, order_id, status, from_status, to_status, actor_type, actor_id, notes, created_at
        ) VALUES (
            gen_random_uuid(), v_order.id, 'cancelled', 'cancelled', 'cancelled',
            'system', 'late_payment_financial_incident',
            'INCIDENT: Late payment received on expired/cancelled order. Order stays cancelled. Refund pending. Ref: ' || p_provider_reference,
            TIMEZONE('utc', NOW())
        );
        v_outcome_status := 'cancelled';
    ELSIF v_is_duplicate_payment THEN
        -- Order is already confirmed; log duplicate payment incident
        INSERT INTO public.order_status_history (
            id, order_id, status, from_status, to_status, actor_type, actor_id, notes, created_at
        ) VALUES (
            gen_random_uuid(), v_order.id, v_order.status, v_order.status, v_order.status,
            'system', 'duplicate_payment_financial_incident',
            'INCIDENT: Duplicate payment received for already paid order. Refund pending. Ref: ' || p_provider_reference,
            TIMEZONE('utc', NOW())
        );
        v_outcome_status := v_order.status;
    ELSE
        -- Replay of the exact same payment confirmation
        v_outcome_status := v_order.status;
    END IF;

    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'order_id', v_order.id,
        'order_code', v_order.order_code,
        'status', v_outcome_status,
        'payment_status', CASE WHEN v_is_late_payment THEN 'refund_pending' ELSE 'paid' END,
        'amount', p_amount,
        'is_replay', v_already_confirmed,
        'is_late_payment', v_is_late_payment,
        'is_duplicate_payment', v_is_duplicate_payment,
        'refund_status', v_refund_status
    );
END;
$$;

-- Ensure execution permissions
REVOKE ALL ON FUNCTION public.confirm_order_payment_atomic(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment_atomic(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB, TEXT) TO service_role;

COMMIT;
