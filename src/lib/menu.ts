import { MenuItem } from '@/types';
import fs from 'fs';
import path from 'path';
import { getSupabaseAdminClient } from './supabase/admin';
import { OrderItemInput } from './validations/order';

export const STATIC_MENU: MenuItem[] = [
  {
    id: 1,
    name: "Egusi Soup",
    desc: "Stockfish, assorted meat and fresh spinach in rich palm oil. Served with your choice of swallow.",
    price: 4500,
    cat: "Soups & Swallows",
    img: "egusi",
    rating: "",
    swallow: true,
    available: true
  },
  {
    id: 2,
    name: "Ogbono Soup",
    desc: "Velvety draw soup with ponmo, dry fish, crayfish and rich local seasonings. Served with swallow.",
    price: 4500,
    cat: "Soups & Swallows",
    img: "ogbono",
    rating: "",
    swallow: true,
    available: true
  },
  {
    id: 3,
    name: "Oha Soup",
    desc: "Authentic Igbo Oha soup prepared with fresh shredded oha leaves, cocoyam thickener, crayfish, stockfish and assorted meat. Served with swallow.",
    price: 4500,
    cat: "Soups & Swallows",
    img: "oha",
    rating: "",
    swallow: true,
    available: true
  },
  {
    id: 4,
    name: "Bitter Leaf Soup",
    desc: "Traditional washed onugbu (bitterleaf) soup simmered in rich palm oil broth with assorted beef, ponmo, dry fish and spices. Served with swallow.",
    price: 4500,
    cat: "Soups & Swallows",
    img: "bitterleaf",
    rating: "",
    swallow: true,
    available: true
  },
  {
    id: 5,
    name: "Okro Draw Soup",
    desc: "Fresh diced okro with catfish and beef, silky and fragrant with scent leaves. Served with swallow.",
    price: 3600,
    cat: "Soups & Swallows",
    img: "ogbono",
    rating: "",
    swallow: true,
    available: true
  },
  {
    id: 6,
    name: "Jollof Rice",
    desc: "Firewood-infused party jollof with crispy seasoned chicken and golden fried plantains.",
    price: 3000,
    cat: "Rice",
    img: "jollof-plantain",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 7,
    name: "Fried Rice",
    desc: "Seasoned vegetable fried rice with sweet corn, carrots, liver bits and crispy charred chicken.",
    price: 3500,
    cat: "Rice",
    img: "fried-rice",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 8,
    name: "Assorted Native Rice",
    desc: "Jay's signature palm-oil infused native rice loaded with smoked fish, ponmo cubes, scent leaves, local spices and seasoned charred chicken.",
    price: 4000,
    cat: "Rice",
    img: "native-rice",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 9,
    name: "Coconut Rice",
    desc: "Aromatic rice cooked in fresh coconut milk, dried fish, vegetables, peppers, served with seasoned roasted chicken.",
    price: 4000,
    cat: "Rice",
    img: "coconut-rice",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 10,
    name: "Basmati Rice",
    desc: "Premium long-grain basmati rice prepared with aromatic herbs, stir-fry vegetables, and crispy seasoned chicken.",
    price: 5000,
    cat: "Rice",
    img: "basmati",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 11,
    name: "Spaghetti",
    desc: "Rich, spicy stir-fried jollof spaghetti with peppers, carrots, sausage bits and crispy seasoned chicken.",
    price: 3200,
    cat: "Rice",
    img: "spaghetti",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 12,
    name: "White Rice & Stew",
    desc: "Steamed white parboiled rice served with rich red tomato-pepper stew and seasoned fried beef.",
    price: 3200,
    cat: "Rice",
    img: "white-rice-stew",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 13,
    name: "Yam and Egg Sauce",
    desc: "Tender organic white yam slices paired with fresh sauteed pepper, onion, and egg sauce.",
    price: 4700,
    cat: "Yam & Sides",
    img: "yam-egg",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 14,
    name: "Moi Moi",
    desc: "Steamed blended honey-bean pudding made with eggs, fish flakes, crayfish, and peppers.",
    price: 1000,
    cat: "Yam & Sides",
    img: "moimoi",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 15,
    name: "Plantain (7 pieces)",
    desc: "Seven generous slices of golden ripe sweet fried dodo plantains.",
    price: 1500,
    cat: "Yam & Sides",
    img: "plantain",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 16,
    name: "Classic Shawarma",
    desc: "Tender grilled spiced chicken shavings, creamy cabbage slaw, special cream and sausage in soft flatbread wrap.",
    price: 3500,
    cat: "Snacks & Shawarma",
    img: "shawarma",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 17,
    name: "Special Large Shawarma",
    desc: "Double grilled chicken portion, double beef frank sausages, premium cheese melt, and Jay's special garlic cream.",
    price: 5000,
    cat: "Snacks & Shawarma",
    img: "shawarma",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 18,
    name: "Golden Meat Pie",
    desc: "Flaky, buttery golden pastry stuffed with seasoned minced beef, potatoes, and carrots.",
    price: 1500,
    cat: "Snacks & Shawarma",
    img: "meatpie",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 19,
    name: "Fresh Cupcake",
    desc: "Moist, freshly baked vanilla and chocolate sponge cupcake topped with velvety buttercream.",
    price: 500,
    cat: "Snacks & Shawarma",
    img: "cake",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 20,
    name: "Medium Cake",
    desc: "Freshly baked moist celebration sponge cake, beautifully layered and iced.",
    price: 1500,
    cat: "Snacks & Shawarma",
    img: "cake",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 21,
    name: "Big Cake",
    desc: "Large handcrafted celebration cake with rich, fluffy sponge and signature piping.",
    price: 2500,
    cat: "Snacks & Shawarma",
    img: "cake",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 22,
    name: "Small Chin Chin",
    desc: "Crunchy, milky Nigerian chin chin fried to golden perfection in a handy snack pack.",
    price: 1000,
    cat: "Snacks & Shawarma",
    img: "chinchin",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 23,
    name: "Big Chin Chin",
    desc: "Family-sized tub of extra-crunchy, rich milky golden chin chin.",
    price: 1500,
    cat: "Snacks & Shawarma",
    img: "chinchin",
    rating: "",
    swallow: false,
    available: true
  },
  {
    id: 24,
    name: "Chilled Drinks & Zobo",
    desc: "Condensation-frosted natural hibiscus Zobo, fresh juices and soft drinks served ice cold.",
    price: 1000,
    cat: "Drinks",
    img: "drinks",
    rating: "",
    swallow: false,
    available: true
  }
];

export const CANONICAL_EXTRAS: Record<string, number> = {
  // Proteins
  'Beef': 500,
  'Stockfish': 700,
  'Goat Meat': 900,
  'Chicken': 800,
  'Extra Assorted Beef': 1200,
  'Fresh Catfish / Titus Fish': 1800,
  'Fried Fish': 1000,
  'Boiled Egg': 300,
  'Fried Plantain (Dodo)': 500,
  // Swallows
  'Eba': 300,
  'Yellow Garri (Eba)': 300,
  'Pounded Yam': 500,
  'Fufu': 300,
  'Semovita': 400,
  // Drinks & Water
  'Bottled Water': 250,
  'Premium Bottled Water': 250,
  'Chilled Bottled Water': 250
};

export const STANDARD_DELIVERY_FEE = 500;
export const ONLINE_PROMO_DISCOUNT_PERCENT = 0;

const MENU_FILE = path.join(process.cwd(), 'data', 'menu.json');

function readLocalMenu(): MenuItem[] {
  try {
    if (fs.existsSync(MENU_FILE)) {
      const data = fs.readFileSync(MENU_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read local menu.json', err);
  }
  return STATIC_MENU;
}

function writeLocalMenu(items: MenuItem[]) {
  try {
    fs.writeFileSync(MENU_FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write local menu.json', err);
  }
}

/**
 * STAGE 7: DYNAMIC MENU RETRIEVAL FROM SUPABASE
 * Retrieves live categories, prices, images, availability, and sold-out states.
 */
export async function getMenuItems(): Promise<MenuItem[]> {
  const supabase = getSupabaseAdminClient();

  // If local file exists, merge newly created items with Supabase catalog
  const localItems = readLocalMenu();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select(`
          id,
          legacy_id,
          name,
          description,
          base_price,
          image_url,
          rating_count,
          is_available,
          category:menu_categories ( name )
        `)
        .order('legacy_id', { ascending: true });

      if (!error && data && data.length > 0) {
        const dbItems = data.map((item: any) => {
          let imgKey = 'egusi';
          if (item.image_url) {
            const match = item.image_url.match(/\/images\/([^.]+)\./);
            if (match) imgKey = match[1];
          }
          return {
            id: item.legacy_id || 1,
            name: item.name,
            desc: item.description || '',
            price: Number(item.base_price),
            cat: (item.category?.name as any) || 'Rice',
            img: imgKey,
            rating: item.rating_count || '',
            swallow: item.category?.name === 'Soups & Swallows',
            available: Boolean(item.is_available)
          };
        });

        // Merge any newly added local items not yet in db
        const dbNames = new Set(dbItems.map(d => d.name.toLowerCase()));
        for (const loc of localItems) {
          if (!dbNames.has(loc.name.toLowerCase())) {
            dbItems.push(loc);
          }
        }
        return dbItems;
      }
    } catch (err) {
      console.warn('Supabase dynamic menu query error, using local database cache', err);
    }
  }

  return localItems;
}

/**
 * Retrieves customization groups & options from Supabase with live pricing and availability.
 */
import { getCustomizationGroups } from './customizations-service';

export async function getMenuCustomizations() {
  const groups = getCustomizationGroups();
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    selection_type: g.selectionType,
    min_selectable: g.minSelectable,
    max_selectable: g.maxSelectable,
    included_quantity: g.includedQuantity,
    is_required: g.isRequired,
    allow_multiple: g.allowMultipleCombinations,
    display_order: g.displayOrder,
    options: g.options.map((o) => ({
      id: o.id,
      name: o.name,
      additional_price: o.additionalPrice,
      is_available: o.isAvailable,
      min_quantity: o.minQuantity,
      max_quantity: o.maxQuantity,
      display_order: o.displayOrder,
      desc: o.desc
    }))
  }));
}

/**
 * Updates menu item availability (sold-out state) by authorized staff.
 */
export async function updateMenuItemAvailability(
  menuId: string | number,
  isAvailable: boolean,
  staffId?: string
): Promise<{ success: boolean; item?: any; error?: string }> {
  const supabase = getSupabaseAdminClient();
  const idStr = String(menuId).trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);
  const isNumeric = /^\d+$/.test(idStr);

  if (!isUuid && !isNumeric) {
    return { success: false, error: 'Invalid menu item identifier.' };
  }

  if (supabase) {
    try {
      let query = supabase
        .from('menu_items')
        .update({ is_available: isAvailable, updated_at: new Date().toISOString() });

      query = isUuid ? query.eq('id', idStr) : query.eq('legacy_id', Number(idStr));

      const { data: updated, error: updErr } = await query.select().maybeSingle();

      if (updErr) {
        return { success: false, error: `Database error updating dish availability: ${updErr.message}` };
      }

      if (!updated) {
        return { success: false, error: 'Dish not found in menu catalog' };
      }

      // Mirror update to local cache using matching numeric legacy_id
      const local = readLocalMenu();
      const found = local.find(
        (i) => String(i.id) === String(updated.legacy_id ?? idStr)
      );
      if (found) {
        found.available = isAvailable;
        writeLocalMenu(local);
      }

      return { success: true, item: updated };
    } catch (e: any) {
      return { success: false, error: e.message || 'Database menu update error' };
    }
  }

  // Fallback ONLY when Supabase is not configured
  const local = readLocalMenu();
  const found = local.find((i) => String(i.id) === idStr);
  if (!found) {
    return { success: false, error: 'Dish not found in menu catalog' };
  }

  found.available = isAvailable;
  writeLocalMenu(local);

  return { success: true, item: found };
}

export interface AuthoritativeLineItem {
  menuId: number;
  name: string;
  img: string;
  unitPrice: number;
  qty: number;
  swallow?: string | null;
  extras: string[];
  extrasCost: number;
  lineTotal: number;
  note?: string;
}

export interface AuthoritativeOrderTotals {
  items: AuthoritativeLineItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
}

/**
 * Calculates authoritative order totals rejecting client prices.
 */
export async function calculateAuthoritativeTotals(
  rawItems: OrderItemInput[]
): Promise<AuthoritativeOrderTotals> {
  const menu = await getMenuItems();
  const menuMap = new Map(menu.map((m) => [m.id, m]));

  const authoritativeItems: AuthoritativeLineItem[] = [];
  let calculatedSubtotal = 0;

  for (const raw of rawItems) {
    const rawId = Number(raw.menuId ?? raw.menuItemId ?? 0);
    const dish = menuMap.get(rawId);
    if (!dish) {
      throw new Error(`Menu item with ID #${rawId} does not exist.`);
    }

    if (!dish.available) {
      throw new Error(`Dish "${dish.name}" is currently sold out and unavailable.`);
    }

    let extrasCost = 0;
    const validatedExtras: string[] = [];

    const extrasList = raw.extras || raw.customizationOptionIds || [];
    if (Array.isArray(extrasList)) {
      for (const extraName of extrasList) {
        const cost = CANONICAL_EXTRAS[extraName];
        if (cost !== undefined) {
          extrasCost += cost;
          validatedExtras.push(extraName);
        }
      }
    }

    const itemQty = Math.max(1, Math.min(50, Number(raw.qty ?? raw.quantity ?? 1)));
    const unitPrice = dish.price + extrasCost;
    const lineTotal = unitPrice * itemQty;
    calculatedSubtotal += lineTotal;

    authoritativeItems.push({
      menuId: dish.id,
      name: dish.name,
      img: dish.img,
      unitPrice,
      qty: itemQty,
      swallow: raw.swallow || null,
      extras: validatedExtras,
      extrasCost,
      lineTotal,
      note: raw.note || raw.notes
    });
  }

  // Zero fabricated discounts by default.
  const discount = 0;
  const deliveryFee = STANDARD_DELIVERY_FEE;
  const total = calculatedSubtotal - discount + deliveryFee;

  return {
    items: authoritativeItems,
    subtotal: calculatedSubtotal,
    discount,
    deliveryFee,
    total
  };
}
