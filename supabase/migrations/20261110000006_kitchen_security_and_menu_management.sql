-- ==============================================================================
-- JAY'S FOOD COURT (JFC) - STAGE 6 & 7: KITCHEN SECURITY & DYNAMIC MENU MANAGEMENT
-- ==============================================================================

BEGIN;

-- 1. UPDATE STAFF PROFILES ROLE CHECK
ALTER TABLE public.staff_profiles DROP CONSTRAINT IF EXISTS staff_profiles_role_check;
ALTER TABLE public.staff_profiles ADD CONSTRAINT staff_profiles_role_check CHECK (
    role IN ('owner', 'admin', 'manager', 'kitchen_staff', 'rider')
);

-- 2. SECURE RESTRICTED ACCESS ON ORDERS TABLE
-- Customers must NEVER be able to query the complete restaurant orders database
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public cannot list orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can only track individual order" ON public.orders;

-- Only authenticated staff can view all orders
CREATE POLICY "Staff can view all orders"
    ON public.orders FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff_profiles
            WHERE staff_profiles.id = auth.uid()
            AND staff_profiles.is_active = TRUE
            AND staff_profiles.role IN ('owner', 'admin', 'manager', 'kitchen_staff', 'rider')
        )
    );

-- 3. ENSURE MENU MANAGEMENT RLS (Staff can update availability, public can read)
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view available menu" ON public.menu_items;
CREATE POLICY "Anyone can view menu items"
    ON public.menu_items FOR SELECT
    TO anon, authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Staff can update menu items" ON public.menu_items;
CREATE POLICY "Staff can update menu items"
    ON public.menu_items FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.staff_profiles
            WHERE staff_profiles.id = auth.uid()
            AND staff_profiles.is_active = TRUE
            AND staff_profiles.role IN ('owner', 'admin', 'manager', 'kitchen_staff')
        )
    );

-- 4. FUNCTION TO ATOMICALLY TOGGLE DISH AVAILABILITY (SOLD OUT STATE)
CREATE OR REPLACE FUNCTION public.toggle_menu_item_availability(
    p_menu_item_id TEXT,
    p_is_available BOOLEAN,
    p_staff_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item_id UUID;
    v_updated JSONB;
BEGIN
    -- Verify staff permissions
    IF p_staff_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.staff_profiles
            WHERE id = p_staff_id
            AND is_active = TRUE
            AND role IN ('owner', 'admin', 'manager', 'kitchen_staff')
        ) THEN
            RAISE EXCEPTION 'Unauthorized: User is not an active staff member permitted to update menu availability.';
        END IF;
    END IF;

    -- Update by UUID or legacy ID
    UPDATE public.menu_items
    SET 
        is_available = p_is_available,
        updated_at = TIMEZONE('utc', NOW())
    WHERE id::text = p_menu_item_id OR legacy_id::text = p_menu_item_id
    RETURNING jsonb_build_object(
        'id', id,
        'legacy_id', legacy_id,
        'name', name,
        'is_available', is_available,
        'updated_at', updated_at
    ) INTO v_updated;

    IF v_updated IS NULL THEN
        RAISE EXCEPTION 'Menu item "%" not found.', p_menu_item_id;
    END IF;

    RETURN v_updated;
END;
$$;

COMMIT;
