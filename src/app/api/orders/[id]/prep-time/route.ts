import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { requireStaffAuthorization } from '@/lib/auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { Order } from '@/types';

const ORDERS_FILE = path.join(process.cwd(), 'data', 'orders.json');

function readOrders(): Order[] {
  try {
    if (!fs.existsSync(ORDERS_FILE)) return [];
    return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeOrders(orders: Order[]) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing orders file:', err);
  }
}

const prepAdjustmentSchema = z.object({
  action: z.enum(['adjust_minutes', 'start_prep', 'mark_ready', 'add_delay']),
  estimatedPrepMinutes: z.number().int().min(1).max(180).optional(),
  delayReason: z.string().max(250).optional()
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { staff, errorResponse } = await requireStaffAuthorization(req, [
      'owner',
      'admin',
      'manager',
      'kitchen_staff'
    ]);

    if (errorResponse) return errorResponse;

    const { id: rawOrderId } = await params;
    const orderLookup = rawOrderId.trim().toUpperCase();

    const rawBody = await req.json();
    const parsed = prepAdjustmentSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { action, estimatedPrepMinutes, delayReason } = parsed.data;
    const nowIso = new Date().toISOString();
    const supabase = getSupabaseAdminClient();

    let targetOrder: Order | null = null;
    const localOrders = readOrders();
    const orderIdx = localOrders.findIndex((o) => o.id.toUpperCase() === orderLookup);

    if (orderIdx !== -1) {
      targetOrder = localOrders[orderIdx];
    }

    if (!targetOrder) {
      return NextResponse.json({ error: `Order #${orderLookup} not found.` }, { status: 404 });
    }

    let updatedFields: Partial<Order> = {};

    if (action === 'start_prep') {
      targetOrder.status = 'preparing';
      targetOrder.prepStartedAt = nowIso;
      // Default to 15 mins if not already set
      const mins = targetOrder.estimatedPrepMinutes || 15;
      targetOrder.estimatedReadyTime = new Date(Date.now() + mins * 60000).toISOString();
      targetOrder.prepAdjustedBy = `${staff?.fullName} (${staff?.role})`;
      updatedFields = {
        status: 'preparing',
        prepStartedAt: nowIso,
        estimatedReadyTime: targetOrder.estimatedReadyTime,
        prepAdjustedBy: targetOrder.prepAdjustedBy
      };
    } else if (action === 'adjust_minutes') {
      if (!estimatedPrepMinutes) {
        return NextResponse.json({ error: 'estimatedPrepMinutes is required for adjust_minutes' }, { status: 400 });
      }
      targetOrder.estimatedPrepMinutes = estimatedPrepMinutes;
      targetOrder.estimatedReadyTime = new Date(Date.now() + estimatedPrepMinutes * 60000).toISOString();
      targetOrder.prepAdjustedBy = `${staff?.fullName} (${staff?.role})`;
      if (delayReason) targetOrder.prepDelayReason = delayReason;

      updatedFields = {
        estimatedPrepMinutes,
        estimatedReadyTime: targetOrder.estimatedReadyTime,
        prepAdjustedBy: targetOrder.prepAdjustedBy,
        ...(delayReason ? { prepDelayReason: delayReason } : {})
      };
    } else if (action === 'add_delay') {
      if (!delayReason) {
        return NextResponse.json({ error: 'delayReason is required for add_delay' }, { status: 400 });
      }
      const addedMins = estimatedPrepMinutes || 10;
      const currentMins = targetOrder.estimatedPrepMinutes || 15;
      const newMins = currentMins + addedMins;
      targetOrder.estimatedPrepMinutes = newMins;
      targetOrder.estimatedReadyTime = new Date(Date.now() + newMins * 60000).toISOString();
      targetOrder.prepDelayReason = delayReason;
      targetOrder.prepAdjustedBy = `${staff?.fullName} (${staff?.role})`;

      updatedFields = {
        estimatedPrepMinutes: newMins,
        estimatedReadyTime: targetOrder.estimatedReadyTime,
        prepDelayReason: delayReason,
        prepAdjustedBy: targetOrder.prepAdjustedBy
      };
    } else if (action === 'mark_ready') {
      targetOrder.status = 'ready_for_pickup';
      targetOrder.prepReadyAt = nowIso;
      targetOrder.estimatedPrepMinutes = 0;
      targetOrder.prepAdjustedBy = `${staff?.fullName} (${staff?.role})`;

      updatedFields = {
        status: 'ready_for_pickup',
        prepReadyAt: nowIso,
        estimatedPrepMinutes: 0,
        prepAdjustedBy: targetOrder.prepAdjustedBy
      };
    }

    // Persist to local mirror
    localOrders[orderIdx] = targetOrder;
    writeOrders(localOrders);

    // Sync to Supabase if available
    if (supabase) {
      try {
        await supabase
          .from('orders')
          .update({
            ...(updatedFields.status ? { status: updatedFields.status } : {}),
            special_instructions: updatedFields.prepDelayReason
              ? `[Kitchen Note]: ${updatedFields.prepDelayReason}`
              : undefined,
            updated_at: nowIso
          })
          .eq('order_code', orderLookup);
      } catch (dbErr) {
        console.warn('Supabase order prep update failed:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Kitchen prep time updated for order #${orderLookup}`,
      action,
      order: targetOrder
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to update kitchen preparation time' },
      { status: 500 }
    );
  }
}
