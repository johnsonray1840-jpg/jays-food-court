-- ==============================================================================
-- JAY'S FOOD COURT - PHASE 10: RIDER GPS TELEMETRY HARDENING & AUDIT RETENTION
-- ==============================================================================

BEGIN;

-- 1. Dedicated Latest-Location Table for High-Frequency GPS telemetry with Realtime
CREATE TABLE IF NOT EXISTS public.rider_latest_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID NOT NULL UNIQUE REFERENCES public.riders(id) ON DELETE CASCADE,
    active_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    heading NUMERIC(5, 2),
    speed_kmh NUMERIC(5, 2),
    accuracy NUMERIC(8, 2),
    tracking_active BOOLEAN NOT NULL DEFAULT TRUE,
    recorded_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rider_latest_locations_order ON public.rider_latest_locations(active_order_id);
CREATE INDEX IF NOT EXISTS idx_rider_latest_locations_rider ON public.rider_latest_locations(rider_id);

-- 2. Retention-Controlled Cleanup on Location Logs (Purge logs older than 7 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_rider_location_logs()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM public.rider_location_logs
    WHERE recorded_at < TIMEZONE('utc', NOW()) - INTERVAL '7 days';
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Upgrade update_rider_live_location function to maintain rider_latest_locations
CREATE OR REPLACE FUNCTION public.update_rider_live_location(
    p_rider_id UUID,
    p_latitude NUMERIC,
    p_longitude NUMERIC,
    p_heading NUMERIC DEFAULT NULL,
    p_speed_kmh NUMERIC DEFAULT NULL,
    p_active_order_id UUID DEFAULT NULL,
    p_accuracy NUMERIC DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_updated_at TIMESTAMPTZ := TIMEZONE('utc', NOW());
BEGIN
    -- Update riders master record
    UPDATE public.riders
    SET 
        current_latitude = p_latitude,
        current_longitude = p_longitude,
        heading = p_heading,
        speed_kmh = p_speed_kmh,
        last_location_update = v_updated_at,
        updated_at = v_updated_at
    WHERE id = p_rider_id;

    -- Upsert into rider_latest_locations table
    INSERT INTO public.rider_latest_locations (
        rider_id,
        active_order_id,
        latitude,
        longitude,
        heading,
        speed_kmh,
        accuracy,
        tracking_active,
        recorded_at,
        updated_at
    ) VALUES (
        p_rider_id,
        p_active_order_id,
        p_latitude,
        p_longitude,
        p_heading,
        p_speed_kmh,
        p_accuracy,
        TRUE,
        v_updated_at,
        v_updated_at
    )
    ON CONFLICT (rider_id) DO UPDATE SET
        active_order_id = EXCLUDED.active_order_id,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        heading = EXCLUDED.heading,
        speed_kmh = EXCLUDED.speed_kmh,
        accuracy = EXCLUDED.accuracy,
        tracking_active = EXCLUDED.tracking_active,
        recorded_at = EXCLUDED.recorded_at,
        updated_at = EXCLUDED.updated_at;

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

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.rider_latest_locations ENABLE ROW LEVEL SECURITY;

-- 5. Strict RLS Policies
-- A. Staff access: Managers/Owners/Admins can read all; Riders can update ONLY their own row
DROP POLICY IF EXISTS p_latest_locations_staff ON public.rider_latest_locations;
CREATE POLICY p_latest_locations_staff ON public.rider_latest_locations
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff_profiles
            WHERE staff_profiles.id = auth.uid()
            AND (
                staff_profiles.role IN ('admin', 'manager', 'owner')
                OR (staff_profiles.role = 'rider' AND rider_latest_locations.rider_id = staff_profiles.id)
            )
        )
    );

COMMIT;
