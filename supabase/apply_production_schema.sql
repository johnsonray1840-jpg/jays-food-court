-- ==============================================================================
-- JAY'S FOOD COURT (JFC) - UNIFIED PRODUCTION SCHEMA MIGRATION
-- Run this script in the Supabase Dashboard SQL Editor for project "ifwsuayltuokmrwuloli".
-- ==============================================================================

BEGIN;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
-- 1. CUSTOMERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
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

DROP TRIGGER IF EXISTS trg_customer_addresses_updated_at ON public.customer_addresses;
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

DROP TRIGGER IF EXISTS trg_menu_categories_updated_at ON public.menu_categories;
CREATE TRIGGER trg_menu_categories_updated_at
    BEFORE UPDATE ON public.menu_categories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 4. MENU ITEMS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_id INT UNIQUE,
    category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON UPDATE CASCADE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    base_price NUMERIC(12, 2) NOT NULL CHECK (base_price >= 0),
    image_url TEXT NOT NULL,
    rating_avg NUMERIC(3, 2) DEFAULT 5.00 CHECK (rating_avg >= 1.00 AND rating_avg <= 5.00),
    rating_count TEXT DEFAULT '',
    is_available BOOLEAN DEFAULT TRUE,
    is_popular BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

DROP TRIGGER IF EXISTS trg_menu_items_updated_at ON public.menu_items;
CREATE TRIGGER trg_menu_items_updated_at
    BEFORE UPDATE ON public.menu_items
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 5. CUSTOMIZATION GROUPS TABLE
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

DROP TRIGGER IF EXISTS trg_customization_groups_updated_at ON public.customization_groups;
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
-- 6. CUSTOMIZATION OPTIONS TABLE
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

DROP TRIGGER IF EXISTS trg_customization_options_updated_at ON public.customization_options;
CREATE TRIGGER trg_customization_options_updated_at
    BEFORE UPDATE ON public.customization_options
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 7. STAFF PROFILES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'kitchen_staff' CHECK (role IN ('owner', 'admin', 'manager', 'kitchen_staff', 'rider')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

DROP TRIGGER IF EXISTS trg_staff_profiles_updated_at ON public.staff_profiles;
CREATE TRIGGER trg_staff_profiles_updated_at
    BEFORE UPDATE ON public.staff_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 8. RIDERS TABLE
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

DROP TRIGGER IF EXISTS trg_riders_updated_at ON public.riders;
CREATE TRIGGER trg_riders_updated_at
    BEFORE UPDATE ON public.riders
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 9. PROMOTIONS TABLE
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

DROP TRIGGER IF EXISTS trg_promotions_updated_at ON public.promotions;
CREATE TRIGGER trg_promotions_updated_at
    BEFORE UPDATE ON public.promotions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 10. RESTAURANT SETTINGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

DROP TRIGGER IF EXISTS trg_restaurant_settings_updated_at ON public.restaurant_settings;
CREATE TRIGGER trg_restaurant_settings_updated_at
    BEFORE UPDATE ON public.restaurant_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 11. REVIEWS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON public.reviews;
CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 12. ORDERS TABLE (11 Official Lifecycle States)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT,
    order_code TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (
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
    ),
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key ON public.orders (COALESCE(customer_id::text, phone), idempotency_key) WHERE idempotency_key IS NOT NULL;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON public.orders;
CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 13. ORDER ITEMS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    quantity INT NOT NULL CHECK (quantity > 0 AND quantity <= 100),
    total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
    customizations JSONB DEFAULT '{}'::jsonb NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 14. ORDER STATUS HISTORY TABLE (Strictly Immutable Audit Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    actor_type TEXT DEFAULT 'system',
    actor_id TEXT,
    rider_id UUID REFERENCES public.riders(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

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

-- ------------------------------------------------------------------------------
-- 15. PAYMENTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL,
    provider TEXT DEFAULT 'manual' NOT NULL,
    provider_reference TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'refunded')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customization_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customization_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_customization_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Catalog Public Read (No Private Customer Data Exposed)
DROP POLICY IF EXISTS "Public can view active categories" ON public.menu_categories;
CREATE POLICY "Public can view active categories" ON public.menu_categories FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Public can view available menu items" ON public.menu_items;
CREATE POLICY "Public can view available menu items" ON public.menu_items FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public can view customization groups" ON public.customization_groups;
CREATE POLICY "Public can view customization groups" ON public.customization_groups FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public can view menu item group links" ON public.menu_item_customization_groups;
CREATE POLICY "Public can view menu item group links" ON public.menu_item_customization_groups FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public can view available customization options" ON public.customization_options;
CREATE POLICY "Public can view available customization options" ON public.customization_options FOR SELECT USING (is_available = TRUE);

DROP POLICY IF EXISTS "Public can view active promotions" ON public.promotions;
CREATE POLICY "Public can view active promotions" ON public.promotions FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Public can view published reviews" ON public.reviews;
CREATE POLICY "Public can view published reviews" ON public.reviews FOR SELECT USING (is_published = TRUE);

DROP POLICY IF EXISTS "Public can view restaurant settings" ON public.restaurant_settings;
CREATE POLICY "Public can view restaurant settings" ON public.restaurant_settings FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public can view active riders" ON public.riders;
CREATE POLICY "Public can view active riders" ON public.riders FOR SELECT USING (is_active = TRUE);

-- Customer Orders: Restrict direct SELECT by anonymous clients (no complete dump)
DROP POLICY IF EXISTS "Public can view own order by code" ON public.orders;
DROP POLICY IF EXISTS "Public can view order items by order ID" ON public.order_items;
DROP POLICY IF EXISTS "Public can view order status history" ON public.order_status_history;
DROP POLICY IF EXISTS "Staff can view all orders" ON public.orders;

-- Service Role Full Access (Used by server Route Handlers with object-level checks)
DROP POLICY IF EXISTS "Service role full access on orders" ON public.orders;
CREATE POLICY "Service role full access on orders" ON public.orders FOR ALL TO service_role USING (TRUE);

DROP POLICY IF EXISTS "Service role full access on order_items" ON public.order_items;
CREATE POLICY "Service role full access on order_items" ON public.order_items FOR ALL TO service_role USING (TRUE);

DROP POLICY IF EXISTS "Service role full access on customers" ON public.customers;
CREATE POLICY "Service role full access on customers" ON public.customers FOR ALL TO service_role USING (TRUE);

DROP POLICY IF EXISTS "Service role full access on customer_addresses" ON public.customer_addresses;
CREATE POLICY "Service role full access on customer_addresses" ON public.customer_addresses FOR ALL TO service_role USING (TRUE);

DROP POLICY IF EXISTS "Service role full access on order_status_history" ON public.order_status_history;
CREATE POLICY "Service role full access on order_status_history" ON public.order_status_history FOR ALL TO service_role USING (TRUE);

DROP POLICY IF EXISTS "Service role full access on payments" ON public.payments;
CREATE POLICY "Service role full access on payments" ON public.payments FOR ALL TO service_role USING (TRUE);

DROP POLICY IF EXISTS "Service role full access on staff_profiles" ON public.staff_profiles;
CREATE POLICY "Service role full access on staff_profiles" ON public.staff_profiles FOR ALL TO service_role USING (TRUE);

-- ------------------------------------------------------------------------------
-- SEED INITIAL DISHES & CATEGORIES (Valid Hex UUIDs Only)
-- ------------------------------------------------------------------------------
INSERT INTO public.menu_categories (id, name, slug, description, display_order, is_active)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Soups & Swallows', 'soups-and-swallows', 'Authentic Nigerian soups served hot with silky swallow', 1, TRUE),
    ('c0000000-0000-0000-0000-000000000002', 'Rice', 'rice', 'Firewood party jollof, seasoned fried rice and savory stews', 2, TRUE),
    ('c0000000-0000-0000-0000-000000000003', 'Yam & Egg', 'yam-and-egg', 'Boiled organic white yam with spicy peppered scrambled eggs', 3, TRUE),
    ('c0000000-0000-0000-0000-000000000004', 'Drinks', 'drinks', 'Cold natural hibiscus Zobo, fresh juices and soft drinks', 4, TRUE)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order;

INSERT INTO public.customization_groups (id, name, min_selectable, max_selectable, is_required, display_order)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Choose Swallow', 1, 1, TRUE, 1),
    ('a0000000-0000-0000-0000-000000000002', 'Add Extra Protein', 0, 5, FALSE, 2)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    min_selectable = EXCLUDED.min_selectable,
    max_selectable = EXCLUDED.max_selectable,
    is_required = EXCLUDED.is_required;

INSERT INTO public.customization_options (id, group_id, name, additional_price, is_available, display_order)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Pounded Yam', 0.00, TRUE, 1),
    ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Yellow Garri (Eba)', 0.00, TRUE, 2),
    ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Semovita', 0.00, TRUE, 3),
    ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'Extra Assorted Beef', 1200.00, TRUE, 1),
    ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'Fresh Catfish / Titus Fish', 1800.00, TRUE, 2)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    additional_price = EXCLUDED.additional_price,
    is_available = EXCLUDED.is_available;

INSERT INTO public.menu_items (id, legacy_id, category_id, name, slug, description, base_price, image_url, rating_avg, rating_count, is_available, is_popular)
VALUES
    ('e0000000-0000-0000-0000-000000000001', 1, 'c0000000-0000-0000-0000-000000000001', 'Royal Egusi Soup', 'royal-egusi-soup', 'Stockfish, assorted meat and fresh spinach in rich palm oil. Served with your choice of swallow.', 3500.00, '/images/egusi.jpg', 5.00, '', TRUE, TRUE),
    ('e0000000-0000-0000-0000-000000000002', 2, 'c0000000-0000-0000-0000-000000000001', 'Special Ogbono Soup', 'special-ogbono-soup', 'Velvety draw soup with ponmo, dry fish, crayfish and rich local seasonings. Served with swallow.', 3800.00, '/images/ogbono.jpg', 4.90, '', TRUE, TRUE),
    ('e0000000-0000-0000-0000-000000000003', 3, 'c0000000-0000-0000-0000-000000000001', 'Okro Draw Soup', 'okro-draw-soup', 'Fresh diced okro with catfish and beef, silky and fragrant with scent leaves. Served with swallow.', 3600.00, '/images/ogbono.jpg', 4.80, '', TRUE, FALSE),
    ('e0000000-0000-0000-0000-000000000004', 4, 'c0000000-0000-0000-0000-000000000002', 'Jay''s Fried Rice Combo', 'jays-fried-rice-combo', 'Seasoned vegetable fried rice with sweet corn, fried dodo and crispy charred chicken drumstick.', 4500.00, '/images/fried-rice.jpg', 5.00, '', TRUE, TRUE),
    ('e0000000-0000-0000-0000-000000000005', 5, 'c0000000-0000-0000-0000-000000000002', 'Smoky Party Jollof Rice', 'smoky-party-jollof-rice', 'Firewood-infused party jollof with crispy seasoned chicken, salad and fried plantains.', 4200.00, '/images/jollof-rice.jpg', 4.90, '', TRUE, TRUE),
    ('e0000000-0000-0000-0000-000000000006', 6, 'c0000000-0000-0000-0000-000000000002', 'White Rice & Stew', 'white-rice-stew', 'Steamed white parboiled rice served with rich red tomato-pepper stew and seasoned fried beef.', 3200.00, '/images/white-rice-stew.jpg', 4.70, '', TRUE, FALSE),
    ('e0000000-0000-0000-0000-000000000007', 7, 'c0000000-0000-0000-0000-000000000003', 'Boiled Yam & Spicy Egg Sauce', 'boiled-yam-spicy-egg-sauce', 'Tender organic white yam slices paired with fresh sauteed pepper and onion scrambled egg sauce.', 2800.00, '/images/yam-egg.jpg', 4.90, '', TRUE, FALSE),
    ('e0000000-0000-0000-0000-000000000008', 8, 'c0000000-0000-0000-0000-000000000004', 'Chilled Drinks & Zobo', 'chilled-drinks-zobo', 'Condensation-frosted natural hibiscus Zobo, fresh juices and soft drinks served ice cold.', 1000.00, '/images/drinks.jpg', 4.80, '', TRUE, FALSE)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    base_price = EXCLUDED.base_price,
    description = EXCLUDED.description,
    is_available = EXCLUDED.is_available,
    is_popular = EXCLUDED.is_popular;

INSERT INTO public.menu_item_customization_groups (menu_item_id, group_id)
VALUES
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
    ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
    ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001'),
    ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002'),
    ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001'),
    ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002'),
    ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002'),
    ('e0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002'),
    ('e0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000002'),
    ('e0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002')
ON CONFLICT (menu_item_id, group_id) DO NOTHING;

INSERT INTO public.restaurant_settings (key, value, description)
VALUES
    ('operating_hours', '{"open": "08:00", "close": "22:00", "days": "Daily"}'::jsonb, 'Standard kitchen operating hours'),
    ('delivery_config', '{"flat_fee": 500.00, "city": "Agbani", "state": "Enugu"}'::jsonb, 'Standard delivery fee in Agbani'),
    ('support_contact', '{"phone": "07087426626", "whatsapp": "2347087426626", "location": "Ndiagu Ugwu, Umuezeakwunanaw, Agbani, Enugu State"}'::jsonb, 'Official contact credentials')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value;

COMMIT;
