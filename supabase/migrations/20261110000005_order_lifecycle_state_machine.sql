-- ==============================================================================
-- JAY'S FOOD COURT (JFC) - STAGE 5: ORDER LIFECYCLE & IMMUTABLE AUDIT TRAIL
-- ==============================================================================

BEGIN;

-- 1. EXPAND ORDER STATUS ENUM / CHECK CONSTRAINT TO 11 OFFICIAL STATES
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (
    status IN (
        'pending_payment',
        'confirmed',
        'accepted',
        'preparing',
        'ready_for_pickup',
        'assigned_to_rider',
        'picked_up',
        'out_for_delivery',
        'delivered',
        'cancelled',
        'refunded'
    )
);

-- 2. EXPAND ORDER STATUS HISTORY TABLE
ALTER TABLE public.order_status_history
    ADD COLUMN IF NOT EXISTS from_status TEXT,
    ADD COLUMN IF NOT EXISTS to_status TEXT,
    ADD COLUMN IF NOT EXISTS actor_type TEXT DEFAULT 'system',
    ADD COLUMN IF NOT EXISTS actor_id TEXT,
    ADD COLUMN IF NOT EXISTS rider_id UUID REFERENCES public.riders(id);

-- Update existing records if any
UPDATE public.order_status_history 
SET to_status = status 
WHERE to_status IS NULL;

-- 3. ENFORCE STRICT IMMUTABILITY ON ORDER STATUS HISTORY
-- History entries can NEVER be updated or deleted by any actor or role
CREATE OR REPLACE FUNCTION public.prevent_order_history_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SECURITY VIOLATION: order_status_history records are strictly immutable. Deletions and updates are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_order_history_tampering ON public.order_status_history;
CREATE TRIGGER trg_prevent_order_history_tampering
    BEFORE UPDATE OR DELETE ON public.order_status_history
    FOR EACH ROW EXECUTE FUNCTION public.prevent_order_history_tampering();

-- 4. ATOMIC FUNCTION FOR VALIDATED STATUS TRANSITION
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
AS $$
DECLARE
    v_current_status TEXT;
    v_order_code TEXT;
    v_result JSONB;
BEGIN
    -- Check order existence and lock row for update
    SELECT status, order_code INTO v_current_status, v_order_code
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Order with ID % not found', p_order_id;
    END IF;

    -- Concurrency check: Ensure state has not changed under our feet
    IF p_from_status IS NOT NULL AND v_current_status <> p_from_status THEN
        RAISE EXCEPTION 'State conflict: Order is currently "%", but requested transition was from "%"', v_current_status, p_from_status;
    END IF;

    -- Update Order
    UPDATE public.orders
    SET 
        status = p_to_status,
        estimated_delivery_time = COALESCE(p_estimated_time, estimated_delivery_time),
        assigned_rider_id = COALESCE(p_rider_id, assigned_rider_id),
        updated_at = TIMEZONE('utc', NOW())
    WHERE id = p_order_id;

    -- Append Immutable Audit History
    INSERT INTO public.order_status_history (
        id,
        order_id,
        status,
        from_status,
        to_status,
        actor_type,
        actor_id,
        rider_id,
        notes,
        created_at
    ) VALUES (
        gen_random_uuid(),
        p_order_id,
        p_to_status,
        v_current_status,
        p_to_status,
        p_actor_type,
        p_actor_id,
        p_rider_id,
        p_notes,
        TIMEZONE('utc', NOW())
    );

    v_result := jsonb_build_object(
        'order_id', p_order_id,
        'order_code', v_order_code,
        'from_status', v_current_status,
        'to_status', p_to_status,
        'actor_type', p_actor_type,
        'updated_at', TIMEZONE('utc', NOW())
    );

    RETURN v_result;
END;
$$;

COMMIT;
