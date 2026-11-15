import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSession } from '@/lib/session';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import fs from 'fs';
import path from 'path';

const ORDERS_FILE = path.join(process.cwd(), 'data', 'orders.json');

export async function GET(req: NextRequest) {
  try {
    const session = await getCustomerSession();

    if (!session || !session.customerId) {
      return NextResponse.json({ authenticated: false, orders: [] }, { status: 401 });
    }

    const customerId = session.customerId;
    const sessionPhone = session.phone || '';
    const normDigits = sessionPhone.replace(/\D/g, '').slice(-10);

    const supabase = getSupabaseAdminClient();
    let ordersList: any[] = [];

    if (supabase) {
      try {
        // Query orders matching customer ID or matching normalized phone number
        let query = supabase
          .from('orders')
          .select(`
            id,
            order_code,
            customer_name,
            phone,
            delivery_address,
            status,
            payment_status,
            subtotal,
            discount_amount,
            delivery_fee,
            total_amount,
            payment_method,
            estimated_delivery_time,
            created_at,
            order_items (
              id,
              item_name,
              unit_price,
              quantity,
              total_price,
              customizations
            )
          `)
          .order('created_at', { ascending: false });

        if (normDigits) {
          query = query.or(`customer_id.eq.${customerId},phone.ilike.%${normDigits}%`);
        } else {
          query = query.eq('customer_id', customerId);
        }

        const { data: dbOrders, error } = await query;

        if (!error && dbOrders) {
          ordersList = dbOrders.map((o: any) => ({
            id: o.order_code || o.id,
            rawId: o.id,
            orderCode: o.order_code || o.id,
            customerName: o.customer_name,
            phone: o.phone,
            deliveryAddress: o.delivery_address,
            status: o.status,
            paymentStatus: o.payment_status || (['delivered', 'confirmed', 'preparing', 'cooking', 'ready_for_pickup', 'assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched'].includes(o.status) ? 'paid' : 'pending'),
            subtotal: Number(o.subtotal || 0),
            discountAmount: Number(o.discount_amount || 0),
            deliveryFee: Number(o.delivery_fee || 0),
            totalAmount: Number(o.total_amount || 0),
            paymentMethod: o.payment_method || 'paystack',
            estimatedDeliveryTime: o.estimated_delivery_time,
            createdAt: o.created_at,
            items: (o.order_items || []).map((item: any) => ({
              id: item.id,
              name: item.item_name,
              price: Number(item.unit_price || 0),
              quantity: item.quantity,
              totalPrice: Number(item.total_price || 0),
              customizations: item.customizations || []
            }))
          }));
        }
      } catch (dbErr) {
        console.warn('Database query for customer orders failed, checking local backup:', dbErr);
      }
    }

    // Local JSON orders backup fallback
    if (ordersList.length === 0 && fs.existsSync(ORDERS_FILE)) {
      try {
        const localOrders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
        const matched = localOrders.filter((o: any) => {
          const matchCustId = o.customerId && o.customerId === customerId;
          const matchPhone = normDigits && o.phone && o.phone.replace(/\D/g, '').includes(normDigits);
          return matchCustId || matchPhone;
        });

        ordersList = matched.map((o: any) => ({
          id: o.id,
          rawId: o.id,
          orderCode: o.id,
          customerName: o.customerName,
          phone: o.phone,
          deliveryAddress: o.deliveryAddress,
          status: o.status,
          paymentStatus: o.paymentStatus || 'paid',
          subtotal: Number(o.subtotal || 0),
          discountAmount: Number(o.discountAmount || 0),
          deliveryFee: Number(o.deliveryFee || 0),
          totalAmount: Number(o.totalAmount || 0),
          paymentMethod: o.paymentMethod || 'paystack',
          estimatedDeliveryTime: o.estimatedDeliveryTime,
          createdAt: o.createdAt,
          items: (o.items || []).map((item: any) => ({
            id: item.menuItemId || item.id,
            name: item.name,
            price: Number(item.price || 0),
            quantity: item.quantity,
            totalPrice: Number(item.price * item.quantity),
            customizations: item.customizations || []
          }))
        }));
      } catch (localErr) {
        console.warn('Local orders read error:', localErr);
      }
    }

    return NextResponse.json({
      authenticated: true,
      orders: ordersList
    });
  } catch (err: any) {
    console.error('Error fetching customer order history:', err);
    return NextResponse.json({ error: 'Failed to retrieve order history' }, { status: 500 });
  }
}
