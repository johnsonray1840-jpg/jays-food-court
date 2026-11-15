import { NextRequest, NextResponse } from 'next/server';
import { getCustomizationsForMeal } from '@/lib/customizations-service';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const groups = getCustomizationsForMeal(id);

    return NextResponse.json(
      {
        success: true,
        mealId: id,
        groups
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve meal customizations' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
