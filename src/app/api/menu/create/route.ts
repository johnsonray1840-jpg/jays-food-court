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

const createMenuSchema = z.object({
  name: z.string().trim().min(2, 'Meal name must be at least 2 characters').max(100),
  desc: z.string().trim().min(5, 'Meal description must be at least 5 characters').max(500),
  price: z.number().int().min(100, 'Minimum price is ₦100').max(100000, 'Maximum price is ₦100,000'),
  cat: z.enum([
    'Soups & Swallows',
    'Rice',
    'Yam & Sides',
    'Snacks & Shawarma',
    'Drinks'
  ], { message: 'Valid food category required' }),
  img: z.string().trim().default('jollof-rice'),
  available: z.boolean().default(true),
  swallow: z.boolean().default(false),
  rating: z.string().optional().default('')
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

export async function POST(req: NextRequest) {
  try {
    // 1. Authorize: Only Owner, Admin or General Manager can create meals
    const { staff, errorResponse } = await requireStaffAuthorization(req, [
      'owner',
      'admin',
      'manager'
    ]);

    if (errorResponse || !staff) {
      return errorResponse || NextResponse.json({ error: 'Unauthorized. Owner or Manager role required.' }, { status: 403 });
    }

    const rawBody = await req.json();
    const parsed = createMenuSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { name, desc, price, cat, img, available, swallow, rating } = parsed.data;

    const supabase = getSupabaseAdminClient();
    const local = readLocalMenu();

    // Prevent duplicate dish names
    const existing = local.find(i => i.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      return NextResponse.json(
        { error: `A meal with the name "${name}" already exists in the catalog.` },
        { status: 409 }
      );
    }

    // Determine next sequential legacy ID
    const maxLegacyId = local.reduce((max, item) => (item.id > max ? item.id : max), 0);
    const newId = maxLegacyId + 1;

    let createdDbItem: any = null;

    if (supabase) {
      try {
        // Resolve category UUID if exists
        const { data: catData } = await supabase
          .from('menu_categories')
          .select('id')
          .eq('name', cat)
          .maybeSingle();

        const { data: dbItem, error: dbErr } = await supabase
          .from('menu_items')
          .insert({
            legacy_id: newId,
            name,
            description: desc,
            base_price: price,
            category_id: catData?.id || null,
            image_url: `/images/${img}.jpg`,
            is_available: available,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .maybeSingle();

        if (!dbErr && dbItem) {
          createdDbItem = dbItem;
        }
      } catch (dbErr) {
        console.warn('Supabase meal insert warning, synchronizing local catalog:', dbErr);
      }
    }

    const nowIso = new Date().toISOString();
    const staffAudit = `${staff.fullName} (${staff.role})`;

    const newMenuItem: MenuItem = {
      id: newId,
      name,
      desc,
      price,
      cat,
      img: img || 'jollof-rice',
      rating: rating || '',
      swallow: cat === 'Soups & Swallows' ? true : swallow,
      available,
      priceLastChangedAt: nowIso,
      priceLastChangedBy: staffAudit
    };

    local.push(newMenuItem);
    writeLocalMenu(local);

    try {
      revalidatePath('/');
      revalidatePath('/api/menu');
    } catch {}

    return NextResponse.json(
      {
        success: true,
        message: `Meal "${name}" created successfully by ${staff.fullName}`,
        item: newMenuItem
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Create meal error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create meal' },
      { status: 500 }
    );
  }
}
