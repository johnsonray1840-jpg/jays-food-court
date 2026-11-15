-- ==============================================================================
-- JAY'S FOOD COURT (JFC) - OPTIONAL POSTGRES ATOMIC TRANSACTION RPCs
-- Run in Supabase Dashboard SQL Editor to enable single-statement DB transactions.
-- Restricted strictly to service_role (never executable by anon or authenticated).
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
SET search_path = public
AS $$
DECLARE
    v_order_id UUID;
    v_existing_order JSONB;
    v_item RECORD;
BEGIN
    IF p_idempotency_key IS NOT NULL THEN
        SELECT jsonb_build_object(
            'id', id,
            'order_code', order_code,
            'status', status,
            'subtotal', subtotal,
            'discount_amount', discount_amount,
            'delivery_fee', delivery_fee,
            'total_amount', total_amount,
            'is_replay', TRUE
        ) INTO v_existing_order
        FROM public.orders
        WHERE idempotency_key = p_idempotency_key;

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
            v_order_id, p_idempotency_key, p_order_code, p_customer_id, p_customer_name, p_phone,
            p_delivery_address, 'confirmed', p_subtotal, p_discount_amount, p_delivery_fee, p_total_amount,
            p_payment_method, 'pending', '18 - 25 Mins', p_assigned_rider_id,
            p_special_instructions, TIMEZONE('utc', NOW()), TIMEZONE('utc', NOW())
        );
    EXCEPTION WHEN unique_violation THEN
        IF p_idempotency_key IS NOT NULL THEN
            SELECT jsonb_build_object(
                'id', id,
                'order_code', order_code,
                'status', status,
                'subtotal', subtotal,
                'discount_amount', discount_amount,
                'delivery_fee', delivery_fee,
                'total_amount', total_amount,
                'is_replay', TRUE
            ) INTO v_existing_order
            FROM public.orders
            WHERE idempotency_key = p_idempotency_key;

            IF v_existing_order IS NOT NULL THEN
                RETURN v_existing_order;
            END IF;
        END IF;
        RAISE;
    END;

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS (
        menu_item_id UUID,
        item_name TEXT,
        unit_price NUMERIC,
        quantity INT,
        total_price NUMERIC,
        customizations JSONB,
        notes TEXT
    ) LOOP
        INSERT INTO public.order_items (
            id, order_id, menu_item_id, item_name, unit_price, quantity,
            total_price, customizations, notes, created_at
        ) VALUES (
            gen_random_uuid(), v_order_id, v_item.menu_item_id, v_item.item_name,
            v_item.unit_price, v_item.quantity, v_item.total_price,
            COALESCE(v_item.customizations, '{}'::jsonb), v_item.notes, TIMEZONE('utc', NOW())
        );
    END LOOP;

    INSERT INTO public.order_status_history (
        id, order_id, status, from_status, to_status, actor_type, actor_id, notes, created_at
    ) VALUES (
        gen_random_uuid(), v_order_id, 'confirmed', NULL, 'confirmed',
        'customer', COALESCE(p_customer_id::text, p_phone),
        'Order placed via Web Storefront (Atomic Transaction)', TIMEZONE('utc', NOW())
    );

    RETURN jsonb_build_object(
        'id', v_order_id,
        'order_code', p_order_code,
        'status', 'confirmed',
        'subtotal', p_subtotal,
        'discount_amount', p_discount_amount,
        'delivery_fee', p_delivery_fee,
        'total_amount', p_total_amount,
        'is_replay', FALSE
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_order_status_atomic(
    p_order_id UUID,
    p_from_status TEXT,
    p_to_status TEXT,
    p_actor_type TEXT,
    p_actor_id TEXT,
    p_rider_id UUID,
    p_estimated_time TEXT,
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_status TEXT;
    v_order_code TEXT;
BEGIN
    SELECT status, order_code INTO v_current_status, v_order_code
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Order with ID % not found', p_order_id;
    END IF;

    IF p_from_status IS NOT NULL AND v_current_status <> p_from_status THEN
        RAISE EXCEPTION 'State conflict: Order is currently "%", requested from "%"', v_current_status, p_from_status;
    END IF;

    UPDATE public.orders
    SET
        status = p_to_status,
        estimated_delivery_time = COALESCE(p_estimated_time, estimated_delivery_time),
        assigned_rider_id = COALESCE(p_rider_id, assigned_rider_id),
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_order_id;

    INSERT INTO public.order_status_history (
        id, order_id, status, from_status, to_status, actor_type, actor_id, rider_id, notes, created_at
    ) VALUES (
        gen_random_uuid(), p_order_id, p_to_status, v_current_status, p_to_status,
        p_actor_type, p_actor_id, p_rider_id, p_notes, TIMEZONE('utc', NOW())
    );

    RETURN jsonb_build_object(
        'order_id', p_order_id,
        'order_code', v_order_code,
        'from_status', v_current_status,
        'to_status', p_to_status
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_atomic(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.transition_order_status_atomic(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_order_status_atomic(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT) TO service_role;

COMMIT;
