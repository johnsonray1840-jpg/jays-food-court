-- ==============================================================================
-- JAY'S FOOD COURT (JFC) - PHASE 4: PAYSTACK ATOMIC ORDER LIFECYCLE
-- Updates create_order_atomic to initialize online orders in 'pending_payment'
-- with payment_status = 'pending', ensuring kitchen staff only see confirmed,
-- paid orders once Paystack verification/webhook completes.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_idempotency_key TEXT,
    p_order_code TEXT,
    p_customer_id UUID,
    p_customer_name TEXT,
    p_phone TEXT,
    p_delivery_address TEXT,
    p_subtotal NUMERIC,
    p_discount_amount NUMERIC,
    p_delivery_fee NUMERIC,
    p_total_amount NUMERIC,
    p_payment_method TEXT,
    p_special_instructions TEXT,
    p_assigned_rider_id UUID,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_existing_order JSONB;
    v_item RECORD;
    v_idempotency_key TEXT;
    v_principal_key TEXT;
    v_item_count INT := 0;
    v_initial_status TEXT;
    v_initial_payment_status TEXT;
BEGIN
    IF p_customer_id IS NULL THEN
        RAISE EXCEPTION 'CUSTOMER_REQUIRED: Valid p_customer_id is required for atomic order creation';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'ORDER_ITEMS_REQUIRED: Order must contain at least one line item';
    END IF;

    v_idempotency_key := NULLIF(TRIM(p_idempotency_key), '');
    v_principal_key := p_customer_id::text;

    -- Phase 4: All orders initialize in pending_payment awaiting Paystack verification
    v_initial_status := 'pending_payment';
    v_initial_payment_status := 'pending';

    -- Serialize concurrent requests sharing the same customer + idempotency key
    IF v_idempotency_key IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext(v_principal_key || ':' || v_idempotency_key));

        SELECT jsonb_build_object(
            'id', id,
            'order_code', order_code,
            'status', status,
            'payment_status', payment_status,
            'subtotal', subtotal,
            'discount_amount', discount_amount,
            'delivery_fee', delivery_fee,
            'total_amount', total_amount,
            'is_replay', TRUE
        ) INTO v_existing_order
        FROM public.orders
        WHERE COALESCE(customer_id::text, phone) = v_principal_key
          AND idempotency_key = v_idempotency_key;

        IF v_existing_order IS NOT NULL THEN
            RETURN v_existing_order;
        END IF;
    END IF;

    v_order_id := gen_random_uuid();

    BEGIN
        INSERT INTO public.orders (
            id, idempotency_key, order_code, customer_id, customer_name, phone,
            delivery_address, status, subtotal, discount_amount, delivery_fee, total_amount,
            payment_method, payment_status, estimated_delivery_time, assigned_rider_id,
            special_instructions, created_at, updated_at
        ) VALUES (
            v_order_id, v_idempotency_key, p_order_code, p_customer_id, p_customer_name, p_phone,
            p_delivery_address, v_initial_status, p_subtotal, p_discount_amount, p_delivery_fee, p_total_amount,
            p_payment_method, v_initial_payment_status, '18 - 25 Mins', p_assigned_rider_id,
            p_special_instructions, TIMEZONE('utc', NOW()), TIMEZONE('utc', NOW())
        );
    EXCEPTION WHEN unique_violation THEN
        IF v_idempotency_key IS NOT NULL THEN
            SELECT jsonb_build_object(
                'id', id,
                'order_code', order_code,
                'status', status,
                'payment_status', payment_status,
                'subtotal', subtotal,
                'discount_amount', discount_amount,
                'delivery_fee', delivery_fee,
                'total_amount', total_amount,
                'is_replay', TRUE
            ) INTO v_existing_order
            FROM public.orders
            WHERE COALESCE(customer_id::text, phone) = v_principal_key
              AND idempotency_key = v_idempotency_key;

            IF v_existing_order IS NOT NULL THEN
                RETURN v_existing_order;
            END IF;
        END IF;
        RAISE;
    END;

    -- Insert line items atomically; any FK or CHECK error aborts the entire transaction
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (
        menu_item_id UUID,
        item_name TEXT,
        unit_price NUMERIC,
        quantity INT,
        total_price NUMERIC,
        customizations JSONB,
        notes TEXT
    ) LOOP
        v_item_count := v_item_count + 1;

        INSERT INTO public.order_items (
            id, order_id, menu_item_id, item_name, unit_price, quantity,
            total_price, customizations, notes, created_at
        ) VALUES (
            gen_random_uuid(), v_order_id, v_item.menu_item_id, v_item.item_name,
            v_item.unit_price, v_item.quantity, v_item.total_price,
            COALESCE(v_item.customizations, '{}'::jsonb), v_item.notes, TIMEZONE('utc', NOW())
        );
    END LOOP;

    IF v_item_count = 0 THEN
        RAISE EXCEPTION 'ORDER_ITEMS_REQUIRED: No valid line items processed';
    END IF;

    -- Append initial immutable audit trail in the same ACID transaction
    INSERT INTO public.order_status_history (
        id, order_id, status, from_status, to_status, actor_type, actor_id, notes, created_at
    ) VALUES (
        gen_random_uuid(), v_order_id, v_initial_status, NULL, v_initial_status,
        'customer', p_customer_id::text,
        'Order placed via Web Storefront (Awaiting Paystack Payment)', TIMEZONE('utc', NOW())
    );

    RETURN jsonb_build_object(
        'id', v_order_id,
        'order_code', p_order_code,
        'status', v_initial_status,
        'payment_status', v_initial_payment_status,
        'subtotal', p_subtotal,
        'discount_amount', p_discount_amount,
        'delivery_fee', p_delivery_fee,
        'total_amount', p_total_amount,
        'is_replay', FALSE
    );
END;
$$;

-- Lock down EXECUTE permissions strictly to service_role
REVOKE ALL ON FUNCTION public.create_order_atomic(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID, JSONB) TO service_role;

COMMIT;
