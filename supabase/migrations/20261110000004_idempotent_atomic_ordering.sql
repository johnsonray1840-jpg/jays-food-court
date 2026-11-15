-- ==============================================================================
-- JAY'S FOOD COURT (JFC) - STAGE 4: IDEMPOTENT ATOMIC ORDERING TRANSACTION
-- ==============================================================================

BEGIN;

-- 1. ADD IDEMPOTENCY KEY TO ORDERS TABLE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'orders' 
        AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN idempotency_key TEXT;
        CREATE UNIQUE INDEX idx_orders_idempotency_key ON public.orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
    END IF;
END $$;

-- 2. CREATE STORED PROCEDURE FOR ATOMIC ORDER CREATION
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
AS $$
DECLARE
    v_order_id UUID;
    v_existing_order JSONB;
    v_item RECORD;
    v_result JSONB;
BEGIN
    -- 1. IDEMPOTENCY CHECK: If already submitted with this key, return the existing order
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

    -- 2. GENERATE NEW ORDER UUID
    v_order_id := gen_random_uuid();

    -- 3. INSERT INTO ORDERS (CORE TRANSACTION)
    INSERT INTO public.orders (
        id,
        idempotency_key,
        order_code,
        customer_id,
        customer_name,
        phone,
        delivery_address,
        status,
        subtotal,
        discount_amount,
        delivery_fee,
        total_amount,
        payment_method,
        payment_status,
        estimated_delivery_time,
        assigned_rider_id,
        special_instructions,
        created_at,
        updated_at
    ) VALUES (
        v_order_id,
        p_idempotency_key,
        p_order_code,
        p_customer_id,
        p_customer_name,
        p_phone,
        p_delivery_address,
        'confirmed',
        p_subtotal,
        p_discount_amount,
        p_delivery_fee,
        p_total_amount,
        p_payment_method,
        'pending',
        '18 - 25 Mins',
        p_assigned_rider_id,
        p_special_instructions,
        TIMEZONE('utc', NOW()),
        TIMEZONE('utc', NOW())
    );

    -- 4. INSERT ORDER ITEMS ATOMICALLY
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
            id,
            order_id,
            menu_item_id,
            item_name,
            unit_price,
            quantity,
            total_price,
            customizations,
            notes,
            created_at
        ) VALUES (
            gen_random_uuid(),
            v_order_id,
            v_item.menu_item_id,
            v_item.item_name,
            v_item.unit_price,
            v_item.quantity,
            v_item.total_price,
            COALESCE(v_item.customizations, '{}'::jsonb),
            v_item.notes,
            TIMEZONE('utc', NOW())
        );
    END LOOP;

    -- 5. INSERT INITIAL AUDIT HISTORY
    INSERT INTO public.order_status_history (
        id,
        order_id,
        status,
        notes,
        created_at
    ) VALUES (
        gen_random_uuid(),
        v_order_id,
        'confirmed',
        'Order confirmed via server-authoritative checkout transaction',
        TIMEZONE('utc', NOW())
    );

    -- 6. BUILD AND RETURN SUCCESS RESULT
    v_result := jsonb_build_object(
        'id', v_order_id,
        'order_code', p_order_code,
        'status', 'confirmed',
        'subtotal', p_subtotal,
        'discount_amount', p_discount_amount,
        'delivery_fee', p_delivery_fee,
        'total_amount', p_total_amount,
        'is_replay', FALSE
    );

    RETURN v_result;
END;
$$;

COMMIT;
