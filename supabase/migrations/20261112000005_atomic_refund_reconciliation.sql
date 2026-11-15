-- ==============================================================================
-- JAY'S FOOD COURT (JFC) - PHASE 4.1: ATOMIC REFUND CONFIRMATION RPC
-- Updates public.payments and public.orders idempotently when a refund
-- is processed via Paystack.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.confirm_refund_atomic(
    p_payment_id UUID,
    p_refund_amount NUMERIC,
    p_refund_reason TEXT,
    p_gateway_refund_id TEXT,
    p_gateway_status TEXT,
    p_actor_id TEXT DEFAULT 'system'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_payment RECORD;
    v_order RECORD;
    v_new_refund_status TEXT;
    v_already_refunded BOOLEAN := FALSE;
BEGIN
    -- 1. Lock payment row FOR UPDATE
    SELECT id, order_id, amount, status, refund_status, refund_amount, provider_reference
    INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF v_payment.id IS NULL THEN
        RAISE EXCEPTION 'PAYMENT_NOT_FOUND: Payment with ID % does not exist.', p_payment_id;
    END IF;

    -- Check if already full refunded
    IF v_payment.refund_status = 'full' THEN
        RETURN jsonb_build_object(
            'payment_id', v_payment.id,
            'order_id', v_payment.order_id,
            'refund_status', 'full',
            'is_replay', TRUE,
            'message', 'Payment already fully refunded.'
        );
    END IF;

    -- Determine new refund status
    IF p_refund_amount >= v_payment.amount THEN
        v_new_refund_status := 'full';
    ELSE
        v_new_refund_status := 'partial';
    END IF;

    -- 2. Lock associated order row FOR UPDATE
    SELECT id, order_code, status, payment_status
    INTO v_order
    FROM public.orders
    WHERE id = v_payment.order_id
    FOR UPDATE;

    -- 3. Update payment record
    UPDATE public.payments
    SET
        refund_status = v_new_refund_status,
        refund_amount = p_refund_amount,
        refunded_at = TIMEZONE('utc', NOW()),
        refund_reason = COALESCE(p_refund_reason, refund_reason),
        gateway_metadata = gateway_metadata || jsonb_build_object(
            'refund_id', p_gateway_refund_id,
            'refund_gateway_status', p_gateway_status,
            'refund_processed_at', TIMEZONE('utc', NOW())
        ),
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = v_payment.id;

    -- 4. Update order payment status
    IF v_order.id IS NOT NULL THEN
        UPDATE public.orders
        SET
            payment_status = 'refunded',
            updated_at = TIMEZONE('utc', NOW())
        WHERE id = v_order.id;

        -- Immutable audit trail
        INSERT INTO public.order_status_history (
            id, order_id, status, from_status, to_status, actor_type, actor_id, notes, created_at
        ) VALUES (
            gen_random_uuid(), v_order.id, v_order.status, v_order.status, v_order.status,
            'system', p_actor_id,
            'Refund confirmed via Paystack. Amount: ₦' || p_refund_amount || '. Reason: ' || COALESCE(p_refund_reason, 'Not specified') || '. Refund ID: ' || COALESCE(p_gateway_refund_id, 'N/A'),
            TIMEZONE('utc', NOW())
        );
    END IF;

    RETURN jsonb_build_object(
        'payment_id', v_payment.id,
        'order_id', v_payment.order_id,
        'order_code', v_order.order_code,
        'refund_status', v_new_refund_status,
        'refund_amount', p_refund_amount,
        'is_replay', FALSE
    );
END;
$$;

-- Restrict execution strictly to service_role
REVOKE ALL ON FUNCTION public.confirm_refund_atomic(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_refund_atomic(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMIT;
