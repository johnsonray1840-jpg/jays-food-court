import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffAuthorization } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import fs from 'fs';
import path from 'path';
import { MenuItem } from '@/types';

export const dynamic = 'force-dynamic';

const MENU_FILE = path.join(process.cwd(), 'data', 'menu.json');

const updateMenuSchema = z.object({
  price: z.number().int().min(100).max(100000).optional(),
  name: z.string().trim().min(2).max(100).optional(),
  desc: z.string().trim().min(5).max(500).optional(),
  cat: z.enum([
    'Soups & Swallows',
    'Rice',
    'Yam & Sides',
    'Snacks & Shawarma',
    'Drinks'
  ]).optional(),
  img: z.string().trim().optional(),
  available: z.boolean().optional(),
  swallow: z.boolean().optional(),
  rating: z.string().optional()
});

function readLocalMenu(): MenuItem[] {
  try {
    if (!fs.existsSync(MENU_FILE)) return [];
    return JSON.parse(fs.readFileSync(MENU_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeLocalMenu(items: MenuItem[]) {
  try {
    fs.writeFileSync(MENU_FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed writing menu file:', err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only Owner, Admin or General Manager can update dish prices & details
    const { staff, errorResponse } = await requireStaffAuthorization(req, [
      'owner',
      'admin',
      'manager'
    ]);

    if (errorResponse || !staff) {
      return errorResponse || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: menuId } = await params;
    const rawBody = await req.json();
    const parsed = updateMenuSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { price, name, desc, cat, img, available, swallow, rating } = parsed.data;
    const supabase = getSupabaseAdminClient();

    let updatedDbItem: any = null;

    if (supabase) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(menuId);
        
        let catId = undefined;
        if (cat) {
          const { data: catData } = await supabase
            .from('menu_categories')
            .select('id')
            .eq('name', cat)
            .maybeSingle();
          if (catData?.id) catId = catData.id;
        }

        let query = supabase.from('menu_items').update({
          ...(price !== undefined ? { base_price: price } : {}),
          ...(name !== undefined ? { name } : {}),
          ...(desc !== undefined ? { description: desc } : {}),
          ...(catId !== undefined ? { category_id: catId } : {}),
          ...(img !== undefined ? { image_url: `/images/${img}.jpg` } : {}),
          ...(available !== undefined ? { is_available: available } : {}),
          updated_at: new Date().toISOString()
        });

        query = isUuid ? query.eq('id', menuId) : query.eq('legacy_id', Number(menuId));
        const { data, error } = await query.select().maybeSingle();
        if (!error && data) {
          updatedDbItem = data;
        }
      } catch (dbErr) {
        console.warn('Supabase menu update error, synchronizing local store:', dbErr);
      }
    }

    // Mirror to local menu store
    const local = readLocalMenu();
    const targetIdx = local.findIndex((i) => String(i.id) === menuId);

    const nowIso = new Date().toISOString();
    const staffAudit = `${staff.fullName} (${staff.role})`;

    if (targetIdx !== -1) {
      if (price !== undefined) {
        local[targetIdx].price = price;
        local[targetIdx].priceLastChangedAt = nowIso;
        local[targetIdx].priceLastChangedBy = staffAudit;
      }
      if (name !== undefined) local[targetIdx].name = name;
      if (desc !== undefined) local[targetIdx].desc = desc;
      if (cat !== undefined) {
        local[targetIdx].cat = cat;
        if (cat === 'Soups & Swallows') local[targetIdx].swallow = true;
      }
      if (img !== undefined) local[targetIdx].img = img;
      if (available !== undefined) local[targetIdx].available = available;
      if (swallow !== undefined) local[targetIdx].swallow = swallow;
      if (rating !== undefined) local[targetIdx].rating = rating;
      
      writeLocalMenu(local);
    }

    try {
      revalidatePath('/');
      revalidatePath('/api/menu');
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Meal #${menuId} updated successfully by ${staff.fullName}`,
      item: targetIdx !== -1 ? local[targetIdx] : updatedDbItem
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update menu item' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only Owner and Admin can delete or archive meals
    const { staff, errorResponse } = await requireStaffAuthorization(req, [
      'owner',
      'admin',
      'manager'
    ]);

    if (errorResponse || !staff) {
      return errorResponse || NextResponse.json({ error: 'Unauthorized. Owner or Manager role required.' }, { status: 403 });
    }

    const { id: menuId } = await params;
    const supabase = getSupabaseAdminClient();
    const local = readLocalMenu();
    const targetIdx = local.findIndex((i) => String(i.id) === menuId);

    if (targetIdx === -1) {
      return NextResponse.json({ error: 'Meal not found in catalog' }, { status: 404 });
    }

    const itemToDelete = local[targetIdx];

    // Check if meal is referenced in any order items (database or local orders)
    let isReferencedInOrders = false;

    if (supabase) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(menuId);
        let checkQuery = supabase.from('order_items').select('id', { count: 'exact', head: true });
        checkQuery = isUuid ? checkQuery.eq('menu_item_id', menuId) : checkQuery.eq('item_name', itemToDelete.name);
        const { count } = await checkQuery;
        if (count && count > 0) {
          isReferencedInOrders = true;
        }
      } catch (err) {
        console.warn('Error checking order references in Supabase:', err);
      }
    }

    // Check local orders.json as well
    try {
      const ordersFile = path.join(process.cwd(), 'data', 'orders.json');
      if (fs.existsSync(ordersFile)) {
        const orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8') || '[]');
        for (const o of orders) {
          if (o.items?.some((it: any) => it.name === itemToDelete.name || String(it.id) === menuId)) {
            isReferencedInOrders = true;
            break;
          }
        }
      }
    } catch {}

    // ARCHIVAL / SOFT DELETION REQUIREMENT:
    // If the meal is referenced in historical orders, preserve referential integrity:
    // Mark as archived / permanently out of stock rather than hard-deleting row.
    if (isReferencedInOrders) {
      if (supabase) {
        try {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(menuId);
          let query = supabase.from('menu_items').update({
            is_available: false,
            updated_at: new Date().toISOString()
          });
          query = isUuid ? query.eq('id', menuId) : query.eq('legacy_id', Number(menuId));
          await query;
        } catch {}
      }

      // Mark locally as archived and unavailable
      local[targetIdx].available = false;
      (local[targetIdx] as any).isArchived = true;
      (local[targetIdx] as any).archivedAt = new Date().toISOString();
      (local[targetIdx] as any).archivedBy = `${staff.fullName} (${staff.role})`;
      writeLocalMenu(local);

      revalidatePath('/');
      revalidatePath('/api/menu');

      return NextResponse.json({
        success: true,
        archived: true,
        message: `Meal "${itemToDelete.name}" is referenced in historical customer orders. To preserve audit history, it has been safely archived and permanently marked out of stock.`
      });
    }

    // If not referenced anywhere, it is safe to completely remove
    if (supabase) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(menuId);
        let delQuery = supabase.from('menu_items').delete();
        delQuery = isUuid ? delQuery.eq('id', menuId) : delQuery.eq('legacy_id', Number(menuId));
        await delQuery;
      } catch {}
    }

    local.splice(targetIdx, 1);
    writeLocalMenu(local);

    try {
      revalidatePath('/');
      revalidatePath('/api/menu');
    } catch {}

    return NextResponse.json({
      success: true,
      deleted: true,
      message: `Meal "${itemToDelete.name}" was safely removed from the catalog by ${staff.fullName}.`
    });
  } catch (err: any) {
    console.error('Delete menu item error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to remove menu item' },
      { status: 500 }
    );
  }
}
