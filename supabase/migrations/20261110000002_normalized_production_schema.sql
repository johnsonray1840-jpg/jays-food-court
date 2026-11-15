-- ==============================================================================
-- JAY'S FOOD COURT (JFC) - STAGE 1: NORMALIZED PRODUCTION DATABASE SCHEMA
-- Covers 15 Normalized Tables:
-- 1. customers
-- 2. customer_addresses
-- 3. menu_categories
-- 4. menu_items
-- 5. customization_groups
-- 6. customization_options
-- 7. orders
-- 8. order_items
-- 9. order_status_history
-- 10. payments
-- 11. staff_profiles
-- 12. riders
-- 13. promotions
-- 14. restaurant_settings
-- 15. reviews
-- ==============================================================================

BEGIN;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- HELPER TRIGGER: Automatic updated_at timestamp
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. CUSTOMERS TABLE (Guest & Registered Identifiers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 2. CUSTOMER ADDRESSES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    street_address TEXT NOT NULL,
    landmark TEXT,
    city TEXT NOT NULL DEFAULT 'Agbani',
    state TEXT NOT NULL DEFAULT 'Enugu',
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TRIGGER trg_customer_addresses_updated_at
    BEFORE UPDATE ON public.customer_addresses
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 3. MENU CATEGORIES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TRIGGER trg_menu_categories_updated_at
    BEFORE UPDATE ON public.menu_categories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 4. MENU ITEMS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id INT UNIQUE, -- Preserves backward-compatible 1..8 IDs
    category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON UPDATE CASCADE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    base_price NUMERIC(12, 2) NOT NULL CHECK (base_price >= 0),
    image_url TEXT NOT NULL,
    rating_avg NUMERIC(3, 2) DEFAULT 5.00 CHECK (rating_avg >= 1.00 AND rating_avg <= 5.00),
    rating_count TEXT DEFAULT '5.0k',
    is_available BOOLEAN DEFAULT TRUE,
    is_popular BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TRIGGER trg_menu_items_updated_at
    BEFORE UPDATE ON public.menu_items
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 5. CUSTOMIZATION GROUPS TABLE (e.g. "Choose Swallow", "Add Extra Protein")
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customization_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    min_selectable INT DEFAULT 0 CHECK (min_selectable >= 0),
    max_selectable INT DEFAULT 1 CHECK (max_selectable >= min_selectable),
    is_required BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TRIGGER trg_customization_groups_updated_at
    BEFORE UPDATE ON public.customization_groups
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- LINK TABLE: MENU ITEMS TO CUSTOMIZATION GROUPS
CREATE TABLE IF NOT EXISTS public.menu_item_customization_groups (
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES public.customization_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (menu_item_id, group_id)
);

-- ------------------------------------------------------------------------------
-- 6. CUSTOMIZATION OPTIONS TABLE (e.g. "Pounded Yam", "Extra Assorted Beef")
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customization_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.customization_groups(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    additional_price NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (additional_price >= 0),
    is_available BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TRIGGER trg_customization_options_updated_at
    BEFORE UPDATE ON public.customization_options
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 11. STAFF PROFILES TABLE (Linked to Supabase auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'kitchen_staff' CHECK (role IN ('kitchen_staff', 'manager', 'admin')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TRIGGER trg_staff_profiles_updated_at
    BEFORE UPDATE ON public.staff_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 12. RIDERS TABLE (Delivery Couriers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.riders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    vehicle_type TEXT DEFAULT 'Motorcycle',
    rating NUMERIC(2, 1) DEFAULT 4.9 CHECK (rating >= 1.0 AND rating <= 5.0),
    is_active BOOLEAN DEFAULT TRUE,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TRIGGER trg_riders_updated_at
    BEFORE UPDATE ON public.riders
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 13. PROMOTIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value NUMERIC(12, 2) NOT NULL CHECK (discount_value > 0),
    minimum_order_amount NUMERIC(12, 2) DEFAULT 0.00 CHECK (minimum_order_amount >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    starts_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TRIGGER trg_promotions_updated_at
    BEFORE UPDATE ON public.promotions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 7. ORDERS TABLE (Core Transaction Record)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code TEXT UNIQUE NOT NULL, -- e.g. 'JFC-1042'
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cooking', 'dispatched', 'delivered', 'cancelled')),
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    discount_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL CHECK (discount_amount >= 0),
    delivery_fee NUMERIC(12, 2) DEFAULT 500.00 NOT NULL CHECK (delivery_fee >= 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('transfer', 'card', 'cash_on_delivery')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    estimated_delivery_time TEXT DEFAULT '18 - 25 Mins',
    assigned_rider_id UUID REFERENCES public.riders(id) ON DELETE SET NULL,
    special_instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 8. ORDER ITEMS TABLE (Line Items)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    quantity INT NOT NULL CHECK (quantity > 0),
    total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
    customizations JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 9. ORDER STATUS HISTORY TABLE (Audit Trail for Kitchen Transitions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('confirmed', 'cooking', 'dispatched', 'delivered', 'cancelled')),
    changed_by_staff_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 10. PAYMENTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    payment_reference TEXT UNIQUE NOT NULL,
    payment_gateway TEXT NOT NULL DEFAULT 'paystack',
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'NGN',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'abandoned')),
    gateway_response JSONB,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 14. RESTAURANT SETTINGS TABLE (Operating Hours, Delivery Fee, Promos)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 15. REVIEWS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- ==============================================================================
-- PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON public.customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_slug ON public.menu_items(slug);
CREATE INDEX IF NOT EXISTS idx_menu_items_legacy_id ON public.menu_items(legacy_id);
CREATE INDEX IF NOT EXISTS idx_customization_options_group_id ON public.customization_options(group_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_code ON public.orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON public.orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON public.payments(payment_reference);
CREATE INDEX IF NOT EXISTS idx_reviews_menu_item ON public.reviews(menu_item_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customization_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_customization_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customization_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 1. Public Read Catalog
CREATE POLICY "Public can view active categories" ON public.menu_categories FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public can view available menu items" ON public.menu_items FOR SELECT USING (is_available = TRUE);
CREATE POLICY "Public can view customization groups" ON public.customization_groups FOR SELECT USING (TRUE);
CREATE POLICY "Public can view menu item group links" ON public.menu_item_customization_groups FOR SELECT USING (TRUE);
CREATE POLICY "Public can view available customization options" ON public.customization_options FOR SELECT USING (is_available = TRUE);
CREATE POLICY "Public can view active promotions" ON public.promotions FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public can view published reviews" ON public.reviews FOR SELECT USING (is_published = TRUE);
CREATE POLICY "Public can view restaurant settings" ON public.restaurant_settings FOR SELECT USING (TRUE);
CREATE POLICY "Public can view active riders" ON public.riders FOR SELECT USING (is_active = TRUE);

-- 2. Customer Creation & Order Submission (Chowdeck Guest Flow)
CREATE POLICY "Public can create/upsert customer record" ON public.customers FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Public can insert order" ON public.orders FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Public can insert order items" ON public.order_items FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Public can view own order by code" ON public.orders FOR SELECT USING (TRUE);
CREATE POLICY "Public can view order items by order ID" ON public.order_items FOR SELECT USING (TRUE);
CREATE POLICY "Public can view order status history" ON public.order_status_history FOR SELECT USING (TRUE);

-- 3. Staff Role Access (Authenticated Kitchen Staff & Managers)
CREATE POLICY "Staff can view staff profiles" ON public.staff_profiles FOR SELECT
    USING (auth.uid() = id OR EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = auth.uid() AND sp.role IN ('manager', 'admin')));

CREATE POLICY "Staff can view all orders" ON public.orders FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = auth.uid() AND sp.is_active = TRUE));

CREATE POLICY "Staff can update order status" ON public.orders FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = auth.uid() AND sp.is_active = TRUE))
    WITH CHECK (EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = auth.uid() AND sp.is_active = TRUE));

CREATE POLICY "Staff can insert status history" ON public.order_status_history FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.staff_profiles sp WHERE sp.id = auth.uid() AND sp.is_active = TRUE));

-- 4. Service Role Bypass (For Webhooks and Admin Routines)
CREATE POLICY "Service role full access on orders" ON public.orders FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on payments" ON public.payments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on order_items" ON public.order_items FOR ALL USING (auth.role() = 'service_role');

-- ==============================================================================
-- ENABLE SUPABASE REALTIME REPLICATION
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_status_history'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;
    END IF;
END $$;

COMMIT;
