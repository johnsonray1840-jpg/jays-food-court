-- ==============================================================================
-- JAY'S FOOD COURT - PHASE 5 EXTENSION:
-- AUDIT TRAILS, PREP TIME HISTORY, IMMUTABLE PRICE AUDITING & OTP HASHING
-- ==============================================================================

BEGIN;

-- 1. Extend orders table with prep estimation and delivery OTP hashing fields
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS estimated_prep_minutes INTEGER,
ADD COLUMN IF NOT EXISTS estimated_ready_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS prep_delay_reason TEXT,
ADD COLUMN IF NOT EXISTS prep_adjusted_by TEXT,
ADD COLUMN IF NOT EXISTS delivery_otp_hash TEXT,
ADD COLUMN IF NOT EXISTS otp_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS otp_verification_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS otp_locked_until TIMESTAMPTZ;

-- 2. Menu Item Price Change Audit History Table
CREATE TABLE IF NOT EXISTS public.menu_price_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
    previous_price NUMERIC(12, 2) NOT NULL,
    new_price NUMERIC(12, 2) NOT NULL,
    changed_by_staff_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
    changed_by_name TEXT NOT NULL,
    changed_by_role TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_menu_price_audit_item ON public.menu_price_audit_logs(menu_item_id);

-- 3. Preparation Time Adjustment History Table
CREATE TABLE IF NOT EXISTS public.order_prep_time_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_prep_minutes INTEGER,
    new_prep_minutes INTEGER NOT NULL,
    action TEXT NOT NULL, -- e.g. 'initial_calc', 'adjust_minutes', 'start_prep', 'mark_ready', 'add_delay'
    delay_reason TEXT,
    adjusted_by_name TEXT NOT NULL,
    adjusted_by_role TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_prep_history_order ON public.order_prep_time_history(order_id);

-- 4. Delivery Verification Attempts Log Table (Rate-Limiting & Audit)
CREATE TABLE IF NOT EXISTS public.delivery_verification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    rider_id UUID REFERENCES public.riders(id) ON DELETE SET NULL,
    attempt_success BOOLEAN NOT NULL,
    attempt_number INTEGER NOT NULL,
    error_message TEXT,
    ip_address TEXT,
    attempted_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_delivery_verification_order ON public.delivery_verification_logs(order_id);

-- 5. Delivery Tracking Events Table (Progression Events)
CREATE TABLE IF NOT EXISTS public.delivery_tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'confirmed', 'prep_started', 'ready_for_pickup', 'assigned_to_rider', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled'
    actor_id TEXT,
    actor_role TEXT NOT NULL,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_order ON public.delivery_tracking_events(order_id);

-- 6. Row-Level Security (RLS) Configuration
ALTER TABLE public.menu_price_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_prep_time_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tracking_events ENABLE ROW LEVEL SECURITY;

-- Price audit logs: Readable by admin/owner/manager
DROP POLICY IF EXISTS p_price_audit_staff ON public.menu_price_audit_logs;
CREATE POLICY p_price_audit_staff ON public.menu_price_audit_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff_profiles
            WHERE staff_profiles.id = auth.uid()
            AND staff_profiles.role IN ('admin', 'manager', 'owner')
        )
    );

-- Prep history logs: Readable by kitchen, manager, admin, owner
DROP POLICY IF EXISTS p_prep_history_staff ON public.order_prep_time_history;
CREATE POLICY p_prep_history_staff ON public.order_prep_time_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff_profiles
            WHERE staff_profiles.id = auth.uid()
            AND staff_profiles.role IN ('admin', 'manager', 'owner', 'kitchen_staff')
        )
    );

-- Delivery verification logs: Privileged staff only (never exposed publicly)
DROP POLICY IF EXISTS p_verification_logs_staff ON public.delivery_verification_logs;
CREATE POLICY p_verification_logs_staff ON public.delivery_verification_logs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff_profiles
            WHERE staff_profiles.id = auth.uid()
            AND staff_profiles.role IN ('admin', 'manager', 'owner')
        )
    );

-- Delivery tracking events: Customer can view their own order events; Staff can view all
DROP POLICY IF EXISTS p_tracking_events_read ON public.delivery_tracking_events;
CREATE POLICY p_tracking_events_read ON public.delivery_tracking_events
    FOR SELECT TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = delivery_tracking_events.order_id
            AND (orders.customer_id = auth.uid() OR auth.uid() IS NULL)
        )
    );

COMMIT;
