-- ==============================================================================
-- JAY'S FOOD COURT - PHASE 5: REAL-TIME ENUGU GEOLOCATION & RIDER GPS TRACKING
-- ==============================================================================

BEGIN;

-- 1. Extend orders table with customer geolocation coordinates & landmark metadata
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_latitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS delivery_longitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS delivery_landmark TEXT,
ADD COLUMN IF NOT EXISTS delivery_zone_id TEXT,
ADD COLUMN IF NOT EXISTS delivery_details JSONB;

-- 2. Extend riders table with real-time GPS coordinates & status
ALTER TABLE public.riders
ADD COLUMN IF NOT EXISTS current_latitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS current_longitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS heading NUMERIC(5, 2), -- Degrees (0-360)
ADD COLUMN IF NOT EXISTS speed_kmh NUMERIC(5, 2),
ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());

-- 3. Dedicated Delivery Zones Table (Reusable & Managed by Authorized Staff)
CREATE TABLE IF NOT EXISTS public.delivery_zones (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'Enugu',
    delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 500.00 CHECK (delivery_fee >= 0),
    min_order_amount NUMERIC(12, 2) NOT NULL DEFAULT 1500.00 CHECK (min_order_amount >= 0),
    estimated_time TEXT NOT NULL DEFAULT '20 - 30 Mins',
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    center_latitude NUMERIC(10, 7),
    center_longitude NUMERIC(10, 7),
    popular_landmarks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 4. Rider Location History Log (for telemetry & security)
CREATE TABLE IF NOT EXISTS public.rider_location_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    heading NUMERIC(5, 2),
    speed_kmh NUMERIC(5, 2),
    recorded_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rider_location_logs_order ON public.rider_location_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_rider_location_logs_rider ON public.rider_location_logs(rider_id);

-- 5. Row-Level Security (RLS) Policies
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_location_logs ENABLE ROW LEVEL SECURITY;

-- Delivery zones: Publicly readable for quote calculations, manageable ONLY by admin/manager
DROP POLICY IF EXISTS p_delivery_zones_read ON public.delivery_zones;
CREATE POLICY p_delivery_zones_read ON public.delivery_zones
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS p_delivery_zones_manage ON public.delivery_zones;
CREATE POLICY p_delivery_zones_manage ON public.delivery_zones
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff_profiles
            WHERE staff_profiles.id = auth.uid()
            AND staff_profiles.role IN ('admin', 'manager', 'owner')
        )
    );

-- Rider location logs: RESTRICTED ACCESS (Never publicly readable)
-- Accessible only by assigned customer (for their active order) or authorized staff
DROP POLICY IF EXISTS p_rider_logs_staff ON public.rider_location_logs;
CREATE POLICY p_rider_logs_staff ON public.rider_location_logs
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff_profiles
            WHERE staff_profiles.id = auth.uid()
            AND staff_profiles.role IN ('admin', 'manager', 'owner', 'rider')
        )
    );

-- 6. RPC for Rider updating live GPS position atomically
CREATE OR REPLACE FUNCTION public.update_rider_live_location(
    p_rider_id UUID,
    p_latitude NUMERIC,
    p_longitude NUMERIC,
    p_heading NUMERIC DEFAULT NULL,
    p_speed_kmh NUMERIC DEFAULT NULL,
    p_active_order_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_updated_at TIMESTAMPTZ := TIMEZONE('utc', NOW());
BEGIN
    -- Update the current rider snapshot
    UPDATE public.riders
    SET 
        current_latitude = p_latitude,
        current_longitude = p_longitude,
        heading = p_heading,
        speed_kmh = p_speed_kmh,
        last_location_update = v_updated_at,
        updated_at = v_updated_at
    WHERE id = p_rider_id;

    -- Append to location telemetry log
    INSERT INTO public.rider_location_logs (
        rider_id,
        order_id,
        latitude,
        longitude,
        heading,
        speed_kmh,
        recorded_at
    ) VALUES (
        p_rider_id,
        p_active_order_id,
        p_latitude,
        p_longitude,
        p_heading,
        p_speed_kmh,
        v_updated_at
    );

    RETURN jsonb_build_object(
        'success', true,
        'rider_id', p_rider_id,
        'latitude', p_latitude,
        'longitude', p_longitude,
        'updated_at', v_updated_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
