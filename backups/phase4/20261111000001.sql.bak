-- ==============================================================================
-- JAY'S FOOD COURT (JFC) - HARDENED POSTGRES ATOMIC TRANSACTION RPCs
-- Scopes idempotency strictly per customer identity, validates payloads/states
-- inside ACID PostgreSQL transactions, locks rows FOR UPDATE, and restricts
-- EXECUTE privileges strictly to service_role.
-- ==============================================================================

BEGIN;

-- 1. Scope idempotency index per customer identity to eliminate cross-customer
--    key collisions, existence probing, and order leakage.
DROP INDEX IF EXISTS public.idx_orders_idempotency_key;
CREATE UNIQUE INDEX idx_orders_idempotency_key
    ON public.orders (COALESCE(customer_id::text, phone), idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 2. Lock search_path on trigger helper functions (defense-in-depth)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_order_history_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'SECURITY VIOLATION: order_status_history records are strictly immutable. Deletions and updates are prohibited.';
END;
$$;

-- 3. Drop any stale/unsafe overloads before recreating canonical functions
DROP FUNCTION IF EXISTS public.create_order_atomic(
    TEXT, TEXT, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID, JSONB
);
DROP FUNCTION IF EXISTS public.transition_order_status_atomic(
    UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT
);

-- 4. Atomic, Customer-Scoped Idempotent Order Creation RPC
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
BEGIN
    IF p_customer_id IS NULL THEN
        RAISE EXCEPTION 'CUSTOMER_REQUIRED: Valid p_customer_id is required for atomic order creation';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'ORDER_ITEMS_REQUIRED: Order must contain at least one line item';
    END IF;

    v_idempotency_key := NULLIF(TRIM(p_idempotency_key), '');
    v_principal_key := p_customer_id::text;

    -- Serialize concurrent requests sharing the same customer + idempotency key
    IF v_idempotency_key IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext(v_principal_key || ':' || v_idempotency_key));

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
            p_delivery_address, 'confirmed', p_subtotal, p_discount_amount, p_delivery_fee, p_total_amount,
            p_payment_method, 'pending', '18 - 25 Mins', p_assigned_rider_id,
            p_special_instructions, TIMEZONE('utc', NOW()), TIMEZONE('utc', NOW())
        );
    EXCEPTION WHEN unique_violation THEN
        IF v_idempotency_key IS NOT NULL THEN
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
        gen_random_uuid(), v_order_id, 'confirmed', NULL, 'confirmed',
        'customer', p_customer_id::text,
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

-- 5. Atomic Order Lifecycle State Transition & Audit History RPC
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
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_status TEXT;
    v_order_code TEXT;
    v_current_rider UUID;
    v_allowed_transition BOOLEAN := FALSE;
BEGIN
    IF p_actor_type IS NULL OR p_actor_type NOT IN (
        'owner', 'admin', 'manager', 'kitchen_staff', 'rider', 'customer', 'system'
    ) THEN
        RAISE EXCEPTION 'UNAUTHORIZED_ACTOR: Invalid actor type "%"', p_actor_type;
    END IF;

    IF p_to_status IS NULL OR p_to_status NOT IN (
        'pending_payment', 'confirmed', 'accepted', 'preparing', 'ready_for_pickup',
        'assigned_to_rider', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'
    ) THEN
        RAISE EXCEPTION 'INVALID_STATUS: Unknown target status "%"', p_to_status;
    END IF;

    -- Acquire exclusive row lock before checking state
    SELECT status, order_code, assigned_rider_id
    INTO v_current_status, v_order_code, v_current_rider
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND: Order with ID % not found', p_order_id;
    END IF;

    IF p_from_status IS NULL OR v_current_status <> p_from_status THEN
        RAISE EXCEPTION 'STATE_CONFLICT: Order is currently "%", requested transition from "%"', v_current_status, COALESCE(p_from_status, 'NULL');
    END IF;

    IF v_current_status = p_to_status THEN
        RAISE EXCEPTION 'STATE_CONFLICT: Order is already in status "%"', p_to_status;
    END IF;

    -- Enforce state machine + actor matrix at the PostgreSQL layer
    v_allowed_transition := CASE
        WHEN v_current_status = 'pending_payment' AND p_to_status = 'confirmed'
            THEN p_actor_type IN ('system', 'admin', 'owner', 'manager')
        WHEN v_current_status = 'pending_payment' AND p_to_status = 'cancelled'
            THEN p_actor_type IN ('customer', 'system', 'admin', 'owner', 'manager')
        WHEN v_current_status = 'confirmed' AND p_to_status = 'accepted'
            THEN p_actor_type IN ('kitchen_staff', 'manager', 'owner', 'admin')
        WHEN v_current_status = 'confirmed' AND p_to_status = 'cancelled'
            THEN p_actor_type IN ('customer', 'manager', 'owner', 'admin')
        WHEN v_current_status = 'accepted' AND p_to_status = 'preparing'
            THEN p_actor_type IN ('kitchen_staff', 'manager', 'owner', 'admin')
        WHEN v_current_status = 'accepted' AND p_to_status = 'cancelled'
            THEN p_actor_type IN ('manager', 'owner', 'admin')
        WHEN v_current_status = 'preparing' AND p_to_status = 'ready_for_pickup'
            THEN p_actor_type IN ('kitchen_staff', 'manager', 'owner', 'admin')
        WHEN v_current_status = 'preparing' AND p_to_status = 'cancelled'
            THEN p_actor_type IN ('manager', 'owner', 'admin')
        WHEN v_current_status = 'ready_for_pickup' AND p_to_status = 'assigned_to_rider'
            THEN p_actor_type IN ('kitchen_staff', 'manager', 'owner', 'admin', 'system')
        WHEN v_current_status = 'ready_for_pickup' AND p_to_status IN ('picked_up', 'cancelled')
            THEN p_actor_type IN ('manager', 'owner', 'admin')
        WHEN v_current_status = 'assigned_to_rider' AND p_to_status = 'picked_up'
            THEN p_actor_type IN ('rider', 'manager', 'owner', 'admin')
        WHEN v_current_status = 'assigned_to_rider' AND p_to_status IN ('ready_for_pickup', 'cancelled')
            THEN p_actor_type IN ('manager', 'owner', 'admin')
        WHEN v_current_status = 'picked_up' AND p_to_status = 'out_for_delivery'
            THEN p_actor_type IN ('rider', 'manager', 'owner', 'admin')
        WHEN v_current_status = 'picked_up' AND p_to_status = 'cancelled'
            THEN p_actor_type IN ('manager', 'owner', 'admin')
        WHEN v_current_status = 'out_for_delivery' AND p_to_status = 'delivered'
            THEN p_actor_type IN ('rider', 'manager', 'owner', 'admin')
        WHEN v_current_status = 'out_for_delivery' AND p_to_status = 'cancelled'
            THEN p_actor_type IN ('manager', 'owner', 'admin')
        WHEN v_current_status = 'delivered' AND p_to_status = 'refunded'
            THEN p_actor_type IN ('manager', 'owner', 'admin')
        WHEN v_current_status = 'cancelled' AND p_to_status = 'refunded'
            THEN p_actor_type IN ('manager', 'owner', 'admin', 'system')
        ELSE FALSE
    END;

    IF NOT v_allowed_transition THEN
        RAISE EXCEPTION 'FORBIDDEN_TRANSITION: Actor "%" cannot transition order from "%" to "%"', p_actor_type, v_current_status, p_to_status;
    END IF;

    IF p_to_status = 'assigned_to_rider' AND COALESCE(p_rider_id, v_current_rider) IS NULL THEN
        RAISE EXCEPTION 'RIDER_REQUIRED: Transition to assigned_to_rider requires an active rider ID';
    END IF;

    UPDATE public.orders
    SET
        status = p_to_status,
        estimated_delivery_time = COALESCE(p_estimated_time, estimated_delivery_time),
        assigned_rider_id = COALESCE(p_rider_id, assigned_rider_id),
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_order_id;

    -- Append immutable audit history inside same ACID transaction; any error rolls back UPDATE
    INSERT INTO public.order_status_history (
        id, order_id, status, from_status, to_status, actor_type, actor_id, rider_id, notes, created_at
    ) VALUES (
        gen_random_uuid(), p_order_id, p_to_status, v_current_status, p_to_status,
        p_actor_type, p_actor_id, COALESCE(p_rider_id, v_current_rider), p_notes, TIMEZONE('utc', NOW())
    );

    RETURN jsonb_build_object(
        'order_id', p_order_id,
        'order_code', v_order_code,
        'from_status', v_current_status,
        'to_status', p_to_status
    );
END;
$$;

-- 6. Lock down EXECUTE permissions strictly to service_role
REVOKE ALL ON FUNCTION public.create_order_atomic(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, UUID, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.transition_order_status_atomic(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_order_status_atomic(UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT) TO service_role;

COMMIT;
