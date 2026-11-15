import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireStaffAuthorization } from '@/lib/auth';
import { updateMenuItemAvailability } from '@/lib/menu';

const availabilitySchema = z.object({
  isAvailable: z.boolean()
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. REQUIRE STAFF AUTHORIZATION (Owner, Admin, Manager, Kitchen Staff)
    const { staff, errorResponse } = await requireStaffAuthorization(req, [
      'owner',
      'admin',
      'manager',
      'kitchen_staff'
    ]);

    if (errorResponse) return errorResponse;

    const rawBody = await req.json();
    const parsed = availabilitySchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { isAvailable } = parsed.data;
    const { id: menuId } = await params;

    const result = await updateMenuItemAvailability(menuId, isAvailable, staff?.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update dish availability.' },
        { status: 404 }
      );
    }

    revalidatePath('/');
    revalidatePath('/api/menu');

    return NextResponse.json({
      success: true,
      message: `Dish #${menuId} is now ${isAvailable ? 'AVAILABLE' : 'SOLD OUT'}`,
      item: result.item,
      updatedBy: staff?.fullName
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'An error occurred while updating availability.' },
      { status: 500 }
    );
  }
}
