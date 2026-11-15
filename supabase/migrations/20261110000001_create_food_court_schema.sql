-- ==============================================================================
-- JAY'S FOOD COURT (JFC) - DATABASE SCHEMA MIGRATION
-- Multi-tier restaurant ordering, guest checkout, kitchen desk & realtime tracking
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 2. MENU ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.menu_items (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price INT NOT NULL CHECK (price >= 0),
    category_slug TEXT NOT NULL REFERENCES public.categories(slug) ON UPDATE CASCADE,
    image_key TEXT NOT NULL,
    rating_count TEXT DEFAULT '4.8k',
    has_swallow BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 3. SWALLOW OPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.swallow_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    price INT DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 4. EXTRA PROTEINS TABLE
CREATE TABLE IF NOT EXISTS public.extra_proteins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    price INT NOT NULL CHECK (price >= 0),
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 5. ORDERS TABLE (GUEST CHECKOUT & REALTIME TRACKING)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY, -- e.g. 'JFC-1042'
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cooking', 'dispatched', 'delivered')),
    subtotal INT NOT NULL CHECK (subtotal >= 0),
    discount INT DEFAULT 0 CHECK (discount >= 0),
    delivery_fee INT DEFAULT 500 CHECK (delivery_fee >= 0),
    total INT NOT NULL CHECK (total >= 0),
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('transfer', 'cod')),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'successful', 'failed')),
    eta TEXT DEFAULT '18 - 25 Mins',
    rider_name TEXT DEFAULT 'Chinedu Okafor',
    rider_phone TEXT DEFAULT '07087426626',
    rider_rating TEXT DEFAULT '4.9 ★'
);

-- 6. ORDER ITEMS (LINE ITEMS BREAKDOWN)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id INT REFERENCES public.menu_items(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    unit_price INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    swallow TEXT,
    extras JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON public.orders(phone);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category_slug);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swallow_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_proteins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Categories & Menu: Public can read available items
CREATE POLICY "Public can view categories"
    ON public.categories FOR SELECT
    USING (true);

CREATE POLICY "Public can view available menu items"
    ON public.menu_items FOR SELECT
    USING (is_available = true);

CREATE POLICY "Public can view swallow options"
    ON public.swallow_options FOR SELECT
    USING (is_available = true);

CREATE POLICY "Public can view extra proteins"
    ON public.extra_proteins FOR SELECT
    USING (is_available = true);

-- Orders: Public can create guest orders
CREATE POLICY "Public can insert orders"
    ON public.orders FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Public can insert order items"
    ON public.order_items FOR INSERT
    WITH CHECK (true);

-- Orders: Public can view their order by reference ID
CREATE POLICY "Public can view order by ID"
    ON public.orders FOR SELECT
    USING (true);

CREATE POLICY "Public can view order items by order ID"
    ON public.order_items FOR SELECT
    USING (true);

-- Orders: Only kitchen staff / service role can update order status
CREATE POLICY "Service role can update orders"
    ON public.orders FOR UPDATE
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- ==============================================================================
-- ENABLE SUPABASE REALTIME REPLICATION
-- ==============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;
