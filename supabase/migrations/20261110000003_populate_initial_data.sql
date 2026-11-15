-- ==============================================================================
-- JAY'S FOOD COURT (JFC) - STAGE 1: SEED & DATA PRESERVATION MIGRATION
-- Populates the normalized database with existing verified dishes, groups & options
-- ==============================================================================

BEGIN;

-- 1. INSERT CATEGORIES
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

-- 2. INSERT CUSTOMIZATION GROUPS
INSERT INTO public.customization_groups (id, name, min_selectable, max_selectable, is_required, display_order)
VALUES
    ('g0000000-0000-0000-0000-000000000001', 'Choose Swallow', 1, 1, TRUE, 1),
    ('g0000000-0000-0000-0000-000000000002', 'Add Extra Protein', 0, 5, FALSE, 2)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    min_selectable = EXCLUDED.min_selectable,
    max_selectable = EXCLUDED.max_selectable,
    is_required = EXCLUDED.is_required;

-- 3. INSERT CUSTOMIZATION OPTIONS
INSERT INTO public.customization_options (id, group_id, name, additional_price, is_available, display_order)
VALUES
    ('o0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000001', 'Pounded Yam', 0.00, TRUE, 1),
    ('o0000000-0000-0000-0000-000000000002', 'g0000000-0000-0000-0000-000000000001', 'Yellow Garri (Eba)', 0.00, TRUE, 2),
    ('o0000000-0000-0000-0000-000000000003', 'g0000000-0000-0000-0000-000000000001', 'Semovita', 0.00, TRUE, 3),
    ('o0000000-0000-0000-0000-000000000004', 'g0000000-0000-0000-0000-000000000002', 'Extra Assorted Beef', 1200.00, TRUE, 1),
    ('o0000000-0000-0000-0000-000000000005', 'g0000000-0000-0000-0000-000000000002', 'Fresh Catfish / Titus Fish', 1800.00, TRUE, 2)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    additional_price = EXCLUDED.additional_price,
    is_available = EXCLUDED.is_available;

-- 4. INSERT MENU ITEMS (PRESERVING LEGACY IDS 1..8)
INSERT INTO public.menu_items (id, legacy_id, category_id, name, slug, description, base_price, image_url, rating_avg, rating_count, is_available, is_popular)
VALUES
    ('m0000000-0000-0000-0000-000000000001', 1, 'c0000000-0000-0000-0000-000000000001', 'Royal Egusi Soup', 'royal-egusi-soup', 'Stockfish, assorted meat and fresh spinach in rich palm oil. Served with your choice of swallow.', 3500.00, '/images/egusi.jpg', 5.00, '5.6k', TRUE, TRUE),
    ('m0000000-0000-0000-0000-000000000002', 2, 'c0000000-0000-0000-0000-000000000001', 'Special Ogbono Soup', 'special-ogbono-soup', 'Velvety draw soup with ponmo, dry fish, crayfish and rich local seasonings. Served with swallow.', 3800.00, '/images/ogbono.jpg', 4.90, '4.9k', TRUE, TRUE),
    ('m0000000-0000-0000-0000-000000000003', 3, 'c0000000-0000-0000-0000-000000000001', 'Okro Draw Soup', 'okro-draw-soup', 'Fresh diced okro with catfish and beef, silky and fragrant with scent leaves. Served with swallow.', 3600.00, '/images/ogbono.jpg', 4.80, '3.2k', TRUE, FALSE),
    ('m0000000-0000-0000-0000-000000000004', 4, 'c0000000-0000-0000-0000-000000000002', 'Jay''s Fried Rice Combo', 'jays-fried-rice-combo', 'Seasoned vegetable fried rice with sweet corn, fried dodo and crispy charred chicken drumstick.', 4500.00, '/images/fried-rice.jpg', 5.00, '5.1k', TRUE, TRUE),
    ('m0000000-0000-0000-0000-000000000005', 5, 'c0000000-0000-0000-0000-000000000002', 'Smoky Party Jollof Rice', 'smoky-party-jollof-rice', 'Firewood-infused party jollof with crispy seasoned chicken, salad and fried plantains.', 4200.00, '/images/jollof-rice.jpg', 4.90, '4.4k', TRUE, TRUE),
    ('m0000000-0000-0000-0000-000000000006', 6, 'c0000000-0000-0000-0000-000000000002', 'White Rice & Stew', 'white-rice-stew', 'Steamed white parboiled rice served with rich red tomato-pepper stew and seasoned fried beef.', 3200.00, '/images/white-rice-stew.jpg', 4.70, '2.8k', TRUE, FALSE),
    ('m0000000-0000-0000-0000-000000000007', 7, 'c0000000-0000-0000-0000-000000000003', 'Boiled Yam & Spicy Egg Sauce', 'boiled-yam-spicy-egg-sauce', 'Tender organic white yam slices paired with fresh sauteed pepper and onion scrambled egg sauce.', 2800.00, '/images/yam-egg.jpg', 4.90, '3.9k', TRUE, FALSE),
    ('m0000000-0000-0000-0000-000000000008', 8, 'c0000000-0000-0000-0000-000000000004', 'Chilled Drinks & Zobo', 'chilled-drinks-zobo', 'Condensation-frosted natural hibiscus Zobo, fresh juices and soft drinks served ice cold.', 1000.00, '/images/drinks.jpg', 4.80, '2.1k', TRUE, FALSE)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    base_price = EXCLUDED.base_price,
    description = EXCLUDED.description,
    is_available = EXCLUDED.is_available,
    is_popular = EXCLUDED.is_popular;

-- 5. LINK DISHES TO CUSTOMIZATION GROUPS
-- Soups link to Swallow and Protein
INSERT INTO public.menu_item_customization_groups (menu_item_id, group_id)
VALUES
    ('m0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000001'),
    ('m0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000002'),
    ('m0000000-0000-0000-0000-000000000002', 'g0000000-0000-0000-0000-000000000001'),
    ('m0000000-0000-0000-0000-000000000002', 'g0000000-0000-0000-0000-000000000002'),
    ('m0000000-0000-0000-0000-000000000003', 'g0000000-0000-0000-0000-000000000001'),
    ('m0000000-0000-0000-0000-000000000003', 'g0000000-0000-0000-0000-000000000002'),
    -- Rice & Yam link to Protein
    ('m0000000-0000-0000-0000-000000000004', 'g0000000-0000-0000-0000-000000000002'),
    ('m0000000-0000-0000-0000-000000000005', 'g0000000-0000-0000-0000-000000000002'),
    ('m0000000-0000-0000-0000-000000000006', 'g0000000-0000-0000-0000-000000000002'),
    ('m0000000-0000-0000-0000-000000000007', 'g0000000-0000-0000-0000-000000000002')
ON CONFLICT (menu_item_id, group_id) DO NOTHING;

-- 6. INSERT COURIER / RIDER
INSERT INTO public.riders (id, full_name, phone, vehicle_type, rating, is_active, is_available)
VALUES
    ('r0000000-0000-0000-0000-000000000001', 'Chinedu Okafor', '07087426626', 'Motorcycle', 4.9, TRUE, TRUE)
ON CONFLICT (phone) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    rating = EXCLUDED.rating;

-- 7. INSERT PROMOTIONS
INSERT INTO public.promotions (id, code, description, discount_type, discount_value, minimum_order_amount, is_active)
VALUES
    ('p0000000-0000-0000-0000-000000000001', 'ONLINE30', '30% off all online orders', 'percentage', 30.00, 0.00, TRUE),
    ('p0000000-0000-0000-0000-000000000002', 'REFER10K', 'Refer 10 friends and receive ₦10,000 cash reward', 'fixed_amount', 10000.00, 50000.00, TRUE)
ON CONFLICT (code) DO UPDATE SET
    discount_value = EXCLUDED.discount_value,
    is_active = EXCLUDED.is_active;

-- 8. INSERT RESTAURANT SETTINGS
INSERT INTO public.restaurant_settings (key, value, description)
VALUES
    ('operating_hours', '{"open": "08:00", "close": "22:00", "days": "Daily"}'::jsonb, 'Standard kitchen operating hours'),
    ('delivery_config', '{"flat_fee": 500.00, "city": "Agbani", "state": "Enugu"}'::jsonb, 'Standard delivery fee in Agbani'),
    ('support_contact', '{"phone": "07087426626", "whatsapp": "2347087426626", "location": "Ndiagu Ugwu, Umuezeakwunanaw, Agbani, Enugu State"}'::jsonb, 'Official contact credentials')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value;

COMMIT;
