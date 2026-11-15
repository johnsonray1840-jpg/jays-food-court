import { NextResponse } from 'next/server';
import { getMenuItems, getMenuCustomizations } from '@/lib/menu';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

export async function GET() {
  try {
    const [items, customizations] = await Promise.all([
      getMenuItems(),
      getMenuCustomizations()
    ]);

    return NextResponse.json(
      {
        success: true,
        items,
        customizations
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to retrieve menu catalog' },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
