import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSession } from '@/lib/session';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const session = await getCustomerSession();

    if (!session || !session.customerId) {
      return NextResponse.json({ authenticated: false, customer: null });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({
        authenticated: true,
        customer: {
          id: session.customerId,
          phone: session.phone,
          fullName: 'Valued Customer',
          email: null
        },
        addresses: []
      });
    }

    // Fetch customer details
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('id, full_name, email, phone, created_at')
      .eq('id', session.customerId)
      .maybeSingle();

    if (custErr || !customer) {
      return NextResponse.json({ authenticated: false, customer: null });
    }

    // Fetch saved addresses
    const { data: addresses } = await supabase
      .from('customer_addresses')
      .select('id, street_address, landmark, city, state, is_default, created_at')
      .eq('customer_id', session.customerId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    // Fetch recent orders count and verified paid orders count
    const normDigits = (customer.phone || session.phone || '').replace(/\D/g, '').slice(-10);
    const { count: orderCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .or(`customer_id.eq.${session.customerId}${normDigits ? `,phone.ilike.%${normDigits}%` : ''}`);

    const { count: paidOrderCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'paid')
      .or(`customer_id.eq.${session.customerId}${normDigits ? `,phone.ilike.%${normDigits}%` : ''}`);

    const hasPaidOrder = (paidOrderCount || 0) > 0;

    return NextResponse.json({
      authenticated: true,
      hasPaidOrder,
      customer: {
        id: customer.id,
        fullName: customer.full_name || 'Valued Customer',
        email: customer.email,
        phone: customer.phone,
        createdAt: customer.created_at,
        orderCount: orderCount || 0,
        paidOrderCount: paidOrderCount || 0
      },
      addresses: addresses || []
    });
  } catch (err: any) {
    console.error('Error fetching customer profile:', err);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}
