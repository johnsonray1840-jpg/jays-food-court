import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSession } from '@/lib/session';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Name is required'),
  phone: z.string().trim().min(10, 'Valid phone number is required')
});

export async function PUT(req: NextRequest) {
  try {
    const session = await getCustomerSession();
    if (!session || !session.customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { fullName, phone } = parsed.data;
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      await supabase
        .from('customers')
        .update({
          full_name: fullName,
          phone: phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.customerId);
    }

    return NextResponse.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
