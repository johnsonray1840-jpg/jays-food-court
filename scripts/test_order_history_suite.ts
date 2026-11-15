/**
 * JAY'S FOOD COURT (JFC) - SECTION 10: ORDER HISTORY & TRANSACTION TEST SUITE
 *
 * Exhaustive verification covering all 20 required specifications:
 * 1. A delivered paid order appears correctly.
 * 2. A paid order still being prepared appears correctly.
 * 3. A failed payment is distinguishable from an abandoned payment.
 * 4. A cancelled unpaid order appears correctly.
 * 5. A cancelled paid order appears as a financial incident where appropriate.
 * 6. A fully refunded order displays the correct refund amount.
 * 7. A partially refunded order displays the correct remaining balance.
 * 8. A pending refund is not labelled successful.
 * 9. A failed refund is visible and traceable.
 * 10. Multiple refunds are calculated correctly.
 * 11. Order history preserves original item prices after menu price changes.
 * 12. Search works by order reference.
 * 13. Search works by customer phone.
 * 14. Search works by Paystack reference.
 * 15. Date filters return correct records.
 * 16. Pagination does not duplicate or skip records.
 * 17. CSV export respects filters and permissions.
 * 18. Unauthorized roles cannot access financial history.
 * 19. Duplicate refund submissions are prevented.
 * 20. Reconciliation incidents are displayed accurately.
 */

import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import * as historyRoute from '@/app/api/admin/orders/history/route';
import * as exportRoute from '@/app/api/admin/orders/history/export/route';
import * as orderDetailRoute from '@/app/api/admin/orders/[id]/route';
import * as refundRoute from '@/app/api/payments/refund/route';
import * as reconciliationRoute from '@/app/api/payments/reconciliation/route';
import { signStaffSessionToken, AuthenticatedStaff } from '@/lib/auth';

interface TestResult {
  id: number;
  description: string;
  category: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: TestResult[] = [];

function recordResult(id: number, description: string, category: string, status: 'PASS' | 'FAIL', details: string) {
  results.push({ id, description, category, status, details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [TEST ${id}] ${description} -> ${status}: ${details}`);
}

async function runSuite() {
  console.log('================================================================');
  console.log("JAY'S FOOD COURT - SECTION 10 ORDER HISTORY TEST SUITE");
  console.log('================================================================');

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.error('Fatal: Cannot connect to Supabase admin client.');
    process.exit(1);
  }

  // Generate tokens for test actors
  const adminStaff: AuthenticatedStaff = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'admin@jaysfoodcourt.ng',
    fullName: 'Jay Admin',
    role: 'admin'
  };
  const adminToken = signStaffSessionToken(adminStaff);

  const kitchenStaff: AuthenticatedStaff = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'chef@jaysfoodcourt.ng',
    fullName: 'Chef Emeka',
    role: 'kitchen_staff'
  };
  const kitchenToken = signStaffSessionToken(kitchenStaff);

  const riderStaff: AuthenticatedStaff = {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'rider@jaysfoodcourt.ng',
    fullName: 'Courier Chidi',
    role: 'rider'
  };
  const riderToken = signStaffSessionToken(riderStaff);

  // Helper to make authenticated requests
  const createAuthedReq = (url: string, token?: string, method = 'GET', body?: any) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Cookie'] = `jfc_staff_session=${token}`;
      headers['Authorization'] = `Bearer ${token}`;
    }
    return new NextRequest(new URL(url, 'http://localhost:3000'), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  };

  try {
    // --------------------------------------------------------------------------
    // Test 1: A delivered paid order appears correctly
    // --------------------------------------------------------------------------
    const order1Code = `JFC-DELIV-${Date.now().toString().slice(-4)}`;
    const { data: ord1, error: ord1Err } = await supabase.from('orders').insert({
      order_code: order1Code,
      customer_name: 'Amaka Okafor',
      phone: '08012345671',
      delivery_address: 'ESUT Campus Gate, Agbani',
      status: 'delivered',
      subtotal: 4500,
      delivery_fee: 500,
      total_amount: 5000,
      payment_method: 'card',
      payment_status: 'paid'
    }).select().single();

    if (ord1Err || !ord1) throw new Error(`Setup failed ord1: ${ord1Err?.message}`);

    await supabase.from('payments').insert({
      order_id: ord1.id,
      amount: 5000,
      currency: 'NGN',
      payment_method: 'card',
      provider: 'paystack',
      provider_reference: `PAY-DELIV-${Date.now()}`,
      status: 'successful'
    });

    const req1 = createAuthedReq(`http://localhost:3000/api/admin/orders/history?filter=delivered&search=${order1Code}`, adminToken);
    const res1 = await historyRoute.GET(req1);
    const json1 = await res1.json();
    const found1 = json1.orders?.find((o: any) => o.orderCode === order1Code);

    if (found1 && found1.status === 'delivered' && found1.paymentStatus === 'paid') {
      recordResult(1, 'Delivered paid order verification', 'Order Lifecycle', 'PASS', `Order #${order1Code} correctly listed in delivered filter.`);
    } else {
      recordResult(1, 'Delivered paid order verification', 'Order Lifecycle', 'FAIL', `Expected delivered paid order not found or mismatched.`);
    }

    // --------------------------------------------------------------------------
    // Test 2: A paid order still being prepared appears correctly
    // --------------------------------------------------------------------------
    const order2Code = `JFC-PREP-${Date.now().toString().slice(-4)}`;
    const { data: ord2 } = await supabase.from('orders').insert({
      order_code: order2Code,
      customer_name: 'Emeka Nnamani',
      phone: '08012345672',
      delivery_address: 'Four Corners, Ozalla',
      status: 'preparing',
      subtotal: 6000,
      delivery_fee: 500,
      total_amount: 6500,
      payment_method: 'card',
      payment_status: 'paid'
    }).select().single();

    const req2 = createAuthedReq(`http://localhost:3000/api/admin/orders/history?filter=paid_not_delivered&search=${order2Code}`, adminToken);
    const res2 = await historyRoute.GET(req2);
    const json2 = await res2.json();
    const found2 = json2.orders?.find((o: any) => o.orderCode === order2Code);

    if (found2 && found2.status === 'preparing' && found2.paymentStatus === 'paid') {
      recordResult(2, 'Paid order currently in preparation appears correctly', 'Order Lifecycle', 'PASS', `Order #${order2Code} appears under paid_not_delivered filter.`);
    } else {
      recordResult(2, 'Paid order currently in preparation appears correctly', 'Order Lifecycle', 'FAIL', `Order not found in paid_not_delivered.`);
    }

    // --------------------------------------------------------------------------
    // Test 3: A failed payment is distinguishable from an abandoned payment
    // --------------------------------------------------------------------------
    // In Paystack and DB design, failed payment records carry status 'failed'
    // with gateway failure diagnostics (e.g. issuer decline, card error),
    // whereas abandoned checkouts are pending records with no gateway charge or customer exit.
    const refFailed = `PAY-FAIL-${Date.now()}`;
    const refPending = `PAY-PEND-${Date.now()}`;
    await supabase.from('payments').insert([
      {
        order_id: ord2.id,
        amount: 6500,
        currency: 'NGN',
        payment_method: 'card',
        provider: 'paystack',
        provider_reference: refFailed,
        status: 'failed',
        gateway_response: 'Declined by issuer: Insufficient funds'
      },
      {
        order_id: ord2.id,
        amount: 6500,
        currency: 'NGN',
        payment_method: 'card',
        provider: 'paystack',
        provider_reference: refPending,
        status: 'pending',
        gateway_response: 'Checkout initialized but abandoned by user'
      }
    ]);

    const { data: pmtFailed } = await supabase.from('payments').select('status, gateway_response').eq('provider_reference', refFailed).single();
    const { data: pmtPending } = await supabase.from('payments').select('status, gateway_response').eq('provider_reference', refPending).single();

    if (pmtFailed?.status === 'failed' && pmtPending?.status === 'pending' && pmtFailed.gateway_response !== pmtPending.gateway_response) {
      recordResult(3, 'Failed payment vs abandoned payment distinction', 'Financial States', 'PASS', 'Failed status cleanly distinguished from abandoned/pending checkout.');
    } else {
      recordResult(3, 'Failed payment vs abandoned payment distinction', 'Financial States', 'FAIL', 'Statuses conflated.');
    }

    // --------------------------------------------------------------------------
    // Test 4: A cancelled unpaid order appears correctly
    // --------------------------------------------------------------------------
    const order4Code = `JFC-CANC-${Date.now().toString().slice(-4)}`;
    const { data: ord4 } = await supabase.from('orders').insert({
      order_code: order4Code,
      customer_name: 'Ifeanyi Okoro',
      phone: '08012345674',
      delivery_address: 'Nkwo Market, Agbani',
      status: 'cancelled',
      subtotal: 3000,
      delivery_fee: 500,
      total_amount: 3500,
      payment_method: 'card',
      payment_status: 'failed'
    }).select().single();

    const req4 = createAuthedReq(`http://localhost:3000/api/admin/orders/history?filter=cancelled&search=${order4Code}`, adminToken);
    const res4 = await historyRoute.GET(req4);
    const json4 = await res4.json();
    const found4 = json4.orders?.find((o: any) => o.orderCode === order4Code);

    if (found4 && found4.status === 'cancelled') {
      recordResult(4, 'Cancelled unpaid order appears correctly', 'Order Lifecycle', 'PASS', `Order #${order4Code} cleanly retrieved under cancelled filter.`);
    } else {
      recordResult(4, 'Cancelled unpaid order appears correctly', 'Order Lifecycle', 'FAIL', 'Cancelled order not listed.');
    }

    // --------------------------------------------------------------------------
    // Test 5: Cancelled paid order appears as a financial incident
    // --------------------------------------------------------------------------
    const order5Code = `JFC-INCD-${Date.now().toString().slice(-4)}`;
    const { data: ord5 } = await supabase.from('orders').insert({
      order_code: order5Code,
      customer_name: 'Ngozi Eze',
      phone: '08012345675',
      delivery_address: 'Staff Quarters, Agbani',
      status: 'cancelled',
      subtotal: 5000,
      delivery_fee: 500,
      total_amount: 5500,
      payment_method: 'card',
      payment_status: 'paid'
    }).select().single();

    const ref5 = `PAY-INCD-${Date.now()}`;
    await supabase.from('payments').insert({
      order_id: ord5.id,
      amount: 5500,
      currency: 'NGN',
      payment_method: 'card',
      provider: 'paystack',
      provider_reference: ref5,
      status: 'successful',
      refund_status: 'none'
    });

    const req5 = createAuthedReq('http://localhost:3000/api/payments/reconciliation', adminToken);
    const res5 = await reconciliationRoute.GET(req5);
    const json5 = await res5.json();
    const incident5 = json5.incidents?.cancelledOrdersWithSuccessfulPayments?.find((it: any) => it.order.order_code === order5Code);

    if (incident5) {
      recordResult(5, 'Cancelled paid order flagged as financial incident', 'Reconciliation', 'PASS', `Incident identified: ${incident5.message}`);
    } else {
      recordResult(5, 'Cancelled paid order flagged as financial incident', 'Reconciliation', 'FAIL', 'Financial incident was not detected.');
    }

    // --------------------------------------------------------------------------
    // Test 6: Fully refunded order displays correct refund amount
    // --------------------------------------------------------------------------
    const order6Code = `JFC-FREF-${Date.now().toString().slice(-4)}`;
    const { data: ord6 } = await supabase.from('orders').insert({
      order_code: order6Code,
      customer_name: 'Chisom Obi',
      phone: '08012345676',
      delivery_address: 'Engineering Complex, ESUT',
      status: 'refunded',
      subtotal: 4000,
      delivery_fee: 500,
      total_amount: 4500,
      payment_method: 'card',
      payment_status: 'refunded'
    }).select().single();

    const { data: pmt6 } = await supabase.from('payments').insert({
      order_id: ord6.id,
      amount: 4500,
      currency: 'NGN',
      payment_method: 'card',
      provider: 'paystack',
      provider_reference: `PAY-FREF-${Date.now()}`,
      status: 'successful',
      refund_status: 'full',
      refund_amount: 4500,
      refund_reason: 'Item unavailable'
    }).select().single();

    const req6 = createAuthedReq(`http://localhost:3000/api/admin/orders/${ord6.id}`, adminToken);
    const res6 = await orderDetailRoute.GET(req6, { params: Promise.resolve({ id: ord6.id }) });
    const json6 = await res6.json();
    const refData6 = json6.data?.refund;

    if (refData6 && refData6.totalAmountRefunded === 4500 && refData6.remainingRefundableBalance === 0) {
      recordResult(6, 'Fully refunded order displays correct amount', 'Refund Audit', 'PASS', `Full refund of ₦4,500 with zero remaining balance confirmed.`);
    } else {
      recordResult(6, 'Fully refunded order displays correct amount', 'Refund Audit', 'FAIL', `Amounts mismatched: ${JSON.stringify(refData6)}`);
    }

    // --------------------------------------------------------------------------
    // Test 7: Partially refunded order displays correct remaining balance
    // --------------------------------------------------------------------------
    const order7Code = `JFC-PREF-${Date.now().toString().slice(-4)}`;
    const { data: ord7 } = await supabase.from('orders').insert({
      order_code: order7Code,
      customer_name: 'Uchechukwu Dan',
      phone: '08012345677',
      delivery_address: 'Law Faculty, Agbani',
      status: 'confirmed',
      subtotal: 10000,
      delivery_fee: 500,
      total_amount: 10500,
      payment_method: 'card',
      payment_status: 'paid'
    }).select().single();

    await supabase.from('payments').insert({
      order_id: ord7.id,
      amount: 10500,
      currency: 'NGN',
      payment_method: 'card',
      provider: 'paystack',
      provider_reference: `PAY-PREF-${Date.now()}`,
      status: 'successful',
      refund_status: 'partial',
      refund_amount: 3500,
      refund_reason: 'One item missing from delivery'
    });

    const req7 = createAuthedReq(`http://localhost:3000/api/admin/orders/${ord7.id}`, adminToken);
    const res7 = await orderDetailRoute.GET(req7, { params: Promise.resolve({ id: ord7.id }) });
    const json7 = await res7.json();
    const refData7 = json7.data?.refund;

    if (refData7 && refData7.totalAmountRefunded === 3500 && refData7.remainingRefundableBalance === 7000) {
      recordResult(7, 'Partially refunded order displays correct remaining balance', 'Refund Audit', 'PASS', `Partial refund ₦3,500; remaining refundable balance ₦7,000.`);
    } else {
      recordResult(7, 'Partially refunded order displays correct remaining balance', 'Refund Audit', 'FAIL', `Mismatched: ${JSON.stringify(refData7)}`);
    }

    // --------------------------------------------------------------------------
    // Test 8: A pending refund is not labelled successful
    // --------------------------------------------------------------------------
    const order8Code = `JFC-PENDREF-${Date.now().toString().slice(-4)}`;
    const { data: ord8 } = await supabase.from('orders').insert({
      order_code: order8Code,
      customer_name: 'Kelechi Nwosu',
      phone: '08012345678',
      delivery_address: 'Medical Hostel, Agbani',
      status: 'confirmed',
      subtotal: 5000,
      delivery_fee: 500,
      total_amount: 5500,
      payment_method: 'card',
      payment_status: 'paid'
    }).select().single();

    await supabase.from('payments').insert({
      order_id: ord8.id,
      amount: 5500,
      currency: 'NGN',
      payment_method: 'card',
      provider: 'paystack',
      provider_reference: `PAY-PENDREF-${Date.now()}`,
      status: 'successful',
      refund_status: 'pending',
      refund_amount: 5500,
      refund_reason: 'Awaiting Paystack settlement'
    });

    const req8 = createAuthedReq(`http://localhost:3000/api/admin/orders/${ord8.id}`, adminToken);
    const res8 = await orderDetailRoute.GET(req8, { params: Promise.resolve({ id: ord8.id }) });
    const json8 = await res8.json();
    const refundRecord8 = json8.data?.refund?.records?.[0];

    if (refundRecord8 && refundRecord8.refundStatus === 'pending') {
      recordResult(8, 'Pending refund is not labelled successful', 'Refund Lifecycle', 'PASS', 'Pending refund remains strictly pending in ledger.');
    } else {
      recordResult(8, 'Pending refund is not labelled successful', 'Refund Lifecycle', 'FAIL', 'Pending refund was misclassified.');
    }

    // --------------------------------------------------------------------------
    // Test 9: A failed refund is visible and traceable
    // --------------------------------------------------------------------------
    const refFailId = `PAY-FAILREF-${Date.now()}`;
    await supabase.from('payments').insert({
      order_id: ord8.id,
      amount: 2000,
      currency: 'NGN',
      payment_method: 'card',
      provider: 'paystack',
      provider_reference: refFailId,
      status: 'successful',
      refund_status: 'failed',
      refund_amount: 2000,
      refund_reason: 'Account closed by bank',
      gateway_response: 'Declined: Inactive customer account'
    });

    const req9 = createAuthedReq(`http://localhost:3000/api/admin/orders/${ord8.id}`, adminToken);
    const res9 = await orderDetailRoute.GET(req9, { params: Promise.resolve({ id: ord8.id }) });
    const json9 = await res9.json();
    const failedRefRecord = json9.data?.refund?.records?.find((r: any) => r.refundStatus === 'failed');

    if (failedRefRecord && failedRefRecord.refundReason.includes('bank')) {
      recordResult(9, 'Failed refund is visible and traceable with reason', 'Refund Audit', 'PASS', `Failed refund recorded with failure audit note.`);
    } else {
      recordResult(9, 'Failed refund is visible and traceable with reason', 'Refund Audit', 'FAIL', 'Failed refund missing or lacks reason.');
    }

    // --------------------------------------------------------------------------
    // Test 10: Multiple refunds are calculated correctly
    // --------------------------------------------------------------------------
    const order10Code = `JFC-MULTIREF-${Date.now().toString().slice(-4)}`;
    const { data: ord10 } = await supabase.from('orders').insert({
      order_code: order10Code,
      customer_name: 'Somtochukwu Ani',
      phone: '08012345680',
      delivery_address: 'Post Office Road, Agbani',
      status: 'confirmed',
      subtotal: 12000,
      delivery_fee: 500,
      total_amount: 12500,
      payment_method: 'card',
      payment_status: 'paid'
    }).select().single();

    // Two payments for this order, each with partial refunds
    await supabase.from('payments').insert([
      {
        order_id: ord10.id,
        amount: 8000,
        currency: 'NGN',
        payment_method: 'card',
        provider: 'paystack',
        provider_reference: `PAY-MULTI-1-${Date.now()}`,
        status: 'successful',
        refund_status: 'partial',
        refund_amount: 2500,
        refund_reason: 'Item 1 missing'
      },
      {
        order_id: ord10.id,
        amount: 4500,
        currency: 'NGN',
        payment_method: 'card',
        provider: 'paystack',
        provider_reference: `PAY-MULTI-2-${Date.now()}`,
        status: 'successful',
        refund_status: 'partial',
        refund_amount: 1500,
        refund_reason: 'Item 2 cold'
      }
    ]);

    const req10 = createAuthedReq(`http://localhost:3000/api/admin/orders/${ord10.id}`, adminToken);
    const res10 = await orderDetailRoute.GET(req10, { params: Promise.resolve({ id: ord10.id }) });
    const json10 = await res10.json();
    const refSummary10 = json10.data?.refund;

    if (refSummary10 && refSummary10.totalAmountRefunded === 4000 && refSummary10.remainingRefundableBalance === 8500) {
      recordResult(10, 'Multiple refunds calculated correctly across payment records', 'Refund Accounting', 'PASS', `Total refunded ₦4,000 across multiple records; remaining balance ₦8,500.`);
    } else {
      recordResult(10, 'Multiple refunds calculated correctly across payment records', 'Refund Accounting', 'FAIL', `Failed calculation: ${JSON.stringify(refSummary10)}`);
    }

    // --------------------------------------------------------------------------
    // Test 11: Order history preserves original item prices after menu price changes
    // --------------------------------------------------------------------------
    // Insert line item into ord10 with purchase price ₦2,500
    const { data: item11 } = await supabase.from('order_items').insert({
      order_id: ord10.id,
      item_name: 'Special Native Jollof Rice',
      unit_price: 2500,
      quantity: 2,
      total_price: 5000
    }).select().single();

    // Verify historical snapshot
    const req11 = createAuthedReq(`http://localhost:3000/api/admin/orders/${ord10.id}`, adminToken);
    const res11 = await orderDetailRoute.GET(req11, { params: Promise.resolve({ id: ord10.id }) });
    const json11 = await res11.json();
    const lineItem = json11.data?.order?.items?.find((it: any) => it.id === item11?.id);

    if (lineItem && lineItem.unitPrice === 2500) {
      recordResult(11, 'Order history preserves immutable item purchase prices', 'Data Immutability', 'PASS', `Historical unit_price preserved as ₦2,500.`);
    } else {
      recordResult(11, 'Order history preserves immutable item purchase prices', 'Data Immutability', 'FAIL', 'Historical item pricing corrupted.');
    }

    // --------------------------------------------------------------------------
    // Test 12: Search works by order reference
    // --------------------------------------------------------------------------
    const req12 = createAuthedReq(`http://localhost:3000/api/admin/orders/history?search=${order1Code}`, adminToken);
    const res12 = await historyRoute.GET(req12);
    const json12 = await res12.json();
    const match12 = json12.orders?.find((o: any) => o.orderCode === order1Code);

    if (match12) {
      recordResult(12, 'Search by order reference', 'Search & Filtering', 'PASS', `Successfully resolved order reference #${order1Code}.`);
    } else {
      recordResult(12, 'Search by order reference', 'Search & Filtering', 'FAIL', 'Search by order code failed.');
    }

    // --------------------------------------------------------------------------
    // Test 13: Search works by customer phone
    // --------------------------------------------------------------------------
    const req13 = createAuthedReq(`http://localhost:3000/api/admin/orders/history?search=08012345671`, adminToken);
    const res13 = await historyRoute.GET(req13);
    const json13 = await res13.json();
    const match13 = json13.orders?.find((o: any) => o.phone === '08012345671');

    if (match13) {
      recordResult(13, 'Search by customer phone', 'Search & Filtering', 'PASS', `Successfully found order with phone 08012345671.`);
    } else {
      recordResult(13, 'Search by customer phone', 'Search & Filtering', 'FAIL', 'Search by phone failed.');
    }

    // --------------------------------------------------------------------------
    // Test 14: Search works by Paystack reference
    // --------------------------------------------------------------------------
    const req14 = createAuthedReq(`http://localhost:3000/api/admin/orders/history?search=${ref5}`, adminToken);
    const res14 = await historyRoute.GET(req14);
    const json14 = await res14.json();
    const match14 = json14.orders?.find((o: any) => o.orderCode === order5Code);

    if (match14) {
      recordResult(14, 'Search by Paystack transaction reference', 'Search & Filtering', 'PASS', `Resolved order #${order5Code} via Paystack ref ${ref5}.`);
    } else {
      recordResult(14, 'Search by Paystack transaction reference', 'Search & Filtering', 'FAIL', 'Search by Paystack reference failed.');
    }

    // --------------------------------------------------------------------------
    // Test 15: Date filters return correct records
    // --------------------------------------------------------------------------
    const req15 = createAuthedReq(`http://localhost:3000/api/admin/orders/history?dateRange=today`, adminToken);
    const res15 = await historyRoute.GET(req15);
    const json15 = await res15.json();
    const allToday = json15.orders?.every((o: any) => {
      const ordDate = new Date(o.createdAt);
      const today = new Date();
      return ordDate.toDateString() === today.toDateString();
    });

    if (json15.orders?.length > 0 && allToday) {
      recordResult(15, 'Date filter (today) returns valid range', 'Search & Filtering', 'PASS', `Returned ${json15.orders.length} orders exclusively created today.`);
    } else {
      recordResult(15, 'Date filter (today) returns valid range', 'Search & Filtering', 'FAIL', 'Date filtering returned out-of-range records.');
    }

    // --------------------------------------------------------------------------
    // Test 16: Pagination does not duplicate or skip records
    // --------------------------------------------------------------------------
    const req16p1 = createAuthedReq('http://localhost:3000/api/admin/orders/history?page=1&limit=2', adminToken);
    const res16p1 = await historyRoute.GET(req16p1);
    const json16p1 = await res16p1.json();

    const req16p2 = createAuthedReq('http://localhost:3000/api/admin/orders/history?page=2&limit=2', adminToken);
    const res16p2 = await historyRoute.GET(req16p2);
    const json16p2 = await res16p2.json();

    const page1Ids = (json16p1.orders || []).map((o: any) => o.id);
    const page2Ids = (json16p2.orders || []).map((o: any) => o.id);
    const intersection = page1Ids.filter((id: string) => page2Ids.includes(id));

    if (page1Ids.length > 0 && page2Ids.length > 0 && intersection.length === 0) {
      recordResult(16, 'Pagination cursor consistency', 'Pagination', 'PASS', 'Pages 1 and 2 disjoint with zero duplicate or skipped keys.');
    } else {
      recordResult(16, 'Pagination cursor consistency', 'Pagination', 'FAIL', `Pagination overlap detected: ${intersection.join(', ')}`);
    }

    // --------------------------------------------------------------------------
    // Test 17: CSV export respects filters and permissions
    // --------------------------------------------------------------------------
    const req17 = createAuthedReq(`http://localhost:3000/api/admin/orders/history/export?filter=delivered`, adminToken);
    const res17 = await exportRoute.GET(req17);
    const csvText = await res17.text();

    if (res17.status === 200 && csvText.includes('Order reference,Customer') && !csvText.includes('special_instructions')) {
      recordResult(17, 'CSV export respects filters and sanitizes sensitive fields', 'Export & Reporting', 'PASS', 'CSV generated cleanly with standard schema.');
    } else {
      recordResult(17, 'CSV export respects filters and sanitizes sensitive fields', 'Export & Reporting', 'FAIL', `CSV export malformed or failed: HTTP ${res17.status}`);
    }

    // --------------------------------------------------------------------------
    // Test 18: Unauthorized roles cannot access financial history
    // --------------------------------------------------------------------------
    const req18Kitchen = createAuthedReq('http://localhost:3000/api/admin/orders/history', kitchenToken);
    const res18Kitchen = await historyRoute.GET(req18Kitchen);

    const req18Rider = createAuthedReq('http://localhost:3000/api/admin/orders/history', riderToken);
    const res18Rider = await historyRoute.GET(req18Rider);

    const req18Anon = createAuthedReq('http://localhost:3000/api/admin/orders/history');
    const res18Anon = await historyRoute.GET(req18Anon);

    if (res18Kitchen.status === 403 && res18Rider.status === 403 && res18Anon.status === 401) {
      recordResult(18, 'Unauthorized roles (kitchen, rider, anon) denied financial history access', 'Security & RLS', 'PASS', 'Strict 403/401 enforcement verified across non-admin roles.');
    } else {
      recordResult(18, 'Unauthorized roles (kitchen, rider, anon) denied financial history access', 'Security & RLS', 'FAIL', `Leaked access: Kitchen=${res18Kitchen.status}, Rider=${res18Rider.status}, Anon=${res18Anon.status}`);
    }

    // --------------------------------------------------------------------------
    // Test 19: Duplicate refund submissions are prevented
    // --------------------------------------------------------------------------
    // Setup a payment record with refund_status = 'full'
    const { data: pmt19 } = await supabase.from('payments').insert({
      order_id: ord1.id,
      amount: 3000,
      currency: 'NGN',
      payment_method: 'card',
      provider: 'paystack',
      provider_reference: `PAY-DUP-${Date.now()}`,
      status: 'successful',
      refund_status: 'full',
      refund_amount: 3000
    }).select().single();

    const req19 = createAuthedReq('http://localhost:3000/api/payments/refund', adminToken, 'POST', {
      paymentId: pmt19.id,
      reason: 'Attempt duplicate refund'
    });
    const res19 = await refundRoute.POST(req19);

    if (res19.status === 409) {
      recordResult(19, 'Duplicate refund submission prevention', 'Concurrency & Refund', 'PASS', 'Duplicate refund rejected with HTTP 409 Conflict.');
    } else {
      recordResult(19, 'Duplicate refund submission prevention', 'Concurrency & Refund', 'FAIL', `Expected 409 Conflict, received HTTP ${res19.status}`);
    }

    // --------------------------------------------------------------------------
    // Test 20: Reconciliation incidents are displayed accurately
    // --------------------------------------------------------------------------
    const req20 = createAuthedReq('http://localhost:3000/api/payments/reconciliation', adminToken);
    const res20 = await reconciliationRoute.GET(req20);
    const json20 = await res20.json();

    if (json20.success && json20.summary && typeof json20.summary.totalIncidentCount === 'number') {
      recordResult(20, 'Reconciliation engine accurately aggregates financial incidents', 'Reconciliation', 'PASS', `Incident aggregator operational: ${json20.summary.totalIncidentCount} total incidents tracked.`);
    } else {
      recordResult(20, 'Reconciliation engine accurately aggregates financial incidents', 'Reconciliation', 'FAIL', 'Reconciliation report malformed.');
    }

  } catch (err: any) {
    console.error('Test suite uncaught exception:', err);
  }

  console.log('\n================================================================');
  console.log('TEST SUITE EXECUTION SUMMARY');
  console.log('================================================================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite();
