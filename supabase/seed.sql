-- ==============================================================================
-- JAY'S FOOD COURT (JFC) - CANONICAL DATABASE SEED SCRIPT
-- ==============================================================================

-- 1. CATEGORIES SEED
INSERT INTO public.categories (slug, name, sort_order) VALUES
('soups-and-swallows', 'Soups & Swallows', 1),
('rice', 'Rice', 2),
('yam-and-egg', 'Yam & Egg', 3),
('drinks', 'Drinks', 4)
ON CONFLICT (slug) DO UPDATE SET 
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

-- 2. SWALLOW OPTIONS SEED
INSERT INTO public.swallow_options (name, price, is_available) VALUES
('Pounded Yam', 0, true),
('Yellow Garri (Eba)', 0, true),
('Semovita', 0, true)
ON CONFLICT (name) DO UPDATE SET 
    price = EXCLUDED.price,
    is_available = EXCLUDED.is_available;

-- 3. EXTRA PROTEIN ADD-ONS SEED
INSERT INTO public.extra_proteins (name, price, is_available) VALUES
('Extra Assorted Beef', 1200, true),
('Fresh Catfish / Titus Fish', 1800, true)
ON CONFLICT (name) DO UPDATE SET 
    price = EXCLUDED.price,
    is_available = EXCLUDED.is_available;

-- 4. MENU ITEMS SEED (AUTHENTIC JAY'S FOOD COURT DISHES)
INSERT INTO public.menu_items (id, name, description, price, category_slug, image_key, rating_count, has_swallow, is_available) VALUES
(1, 'Royal Egusi Soup', 'Stockfish, assorted meat and fresh spinach in rich palm oil. Served with your choice of swallow.', 3500, 'soups-and-swallows', 'egusi', '5.6k', true, true),
(2, 'Special Ogbono Soup', 'Velvety draw soup with ponmo, dry fish, crayfish and rich local seasonings. Served with swallow.', 3800, 'soups-and-swallows', 'ogbono', '4.9k', true, true),
(3, 'Okro Draw Soup', 'Fresh diced okro with catfish and beef, silky and fragrant with scent leaves. Served with swallow.', 3600, 'soups-and-swallows', 'ogbono', '3.2k', true, true),
(4, 'Jay''s Fried Rice Combo', 'Seasoned vegetable fried rice with sweet corn, fried dodo and crispy charred chicken drumstick.', 4500, 'rice', 'fried-rice', '5.1k', false, true),
(5, 'Smoky Party Jollof Rice', 'Firewood-infused party jollof with crispy seasoned chicken, salad and fried plantains.', 4200, 'rice', 'jollof-rice', '4.4k', false, true),
(6, 'White Rice & Stew', 'Steamed white parboiled rice served with rich red tomato-pepper stew and seasoned fried beef.', 3200, 'rice', 'white-rice-stew', '2.8k', false, true),
(7, 'Boiled Yam & Spicy Egg Sauce', 'Tender organic white yam slices paired with fresh sauteed pepper and onion scrambled egg sauce.', 2800, 'yam-and-egg', 'yam-egg', '3.9k', false, true),
(8, 'Chilled Drinks & Zobo', 'Condensation-frosted natural hibiscus Zobo, fresh juices and soft drinks served ice cold.', 1000, 'drinks', 'drinks', '2.1k', false, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    category_slug = EXCLUDED.category_slug,
    image_key = EXCLUDED.image_key,
    rating_count = EXCLUDED.rating_count,
    has_swallow = EXCLUDED.has_swallow,
    is_available = EXCLUDED.is_available;
