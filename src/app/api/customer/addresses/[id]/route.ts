import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSession } from '@/lib/session';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCustomerSession();
    if (!session || !session.customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: addressId } = await params;
    const supabase = getSupabaseAdminClient();

    if (supabase) {
      await supabase
        .from('customer_addresses')
        .delete()
        .eq('id', addressId)
        .eq('customer_id', session.customerId);
    }

    return NextResponse.json({ success: true, message: 'Address removed' });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 });
  }
}
