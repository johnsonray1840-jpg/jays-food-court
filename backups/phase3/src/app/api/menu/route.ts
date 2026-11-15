import { NextResponse } from 'next/server';
import { getMenuItems, getMenuCustomizations } from '@/lib/menu';

export async function GET() {
  try {
    const [items, customizations] = await Promise.all([
      getMenuItems(),
      getMenuCustomizations()
    ]);

    return NextResponse.json({
      success: true,
      items,
      customizations
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to retrieve menu catalog' },
      { status: 500 }
    );
  }
}
