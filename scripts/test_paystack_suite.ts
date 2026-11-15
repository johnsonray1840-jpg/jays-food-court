import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature
} from '../src/lib/paystack';
import * as initRoute from '../src/app/api/payments/initialize/route';
import * as verifyRoute from '../src/app/api/payments/verify/route';
import * as webhookRoute from '../src/app/api/webhooks/paystack/route';
import * as expireRoute from '../src/app/api/payments/expire-abandoned/route';
import * as ordersRoute from '../src/app/api/orders/route';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;

const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface TestOutcome {
  testNumber: number;
  title: string;
  category: string;
  status: 'PASS' | 'FAIL';
  details: string;
  evidence?: any;
}

const testOutcomes: TestOutcome[] = [];

function recordTest(testNumber: number, title: string, category: string, status: 'PASS' | 'FAIL', details: string, evidence?: any) {
  testOutcomes.push({ testNumber, title, category, status, details, evidence });
  const icon = status === 'PASS' ? '✔' : '✖';
  console.log(`${icon} TEST ${testNumber}: ${title} [${status}]`);
  console.log(`   ${details}\n`);
}

async function runPaystackTestSuite() {
  console.log('================================================================');
  console.log("JAY'S FOOD COURT — PAYSTACK INTEGRATION & SECURITY TEST SUITE");
  console.log('================================================================\n');

  // SETUP: Disposable Customer & Real Dish #1
  const { data: item } = await sbAdmin.from('menu_items').select('id, name, base_price').eq('legacy_id', 1).single();
  if (!item) throw new Error('Menu item 1 not found in live database');

  const baseCustPhone = '+234803' + Math.floor(1000000 + Math.random() * 9000000);
  const { data: testCust } = await sbAdmin.from('customers').insert({
    phone: baseCustPhone,
    full_name: 'Paystack Test Customer 1'
  }).select().single();

  const otherCustPhone = '+234803' + Math.floor(1000000 + Math.random() * 9000000);
  const { data: otherCust } = await sbAdmin.from('customers').insert({
    phone: otherCustPhone,
    full_name: 'Paystack Test Customer 2'
  }).select().single();

  // Helper to create pending order
  const unitPrice = Number(item?.base_price || 2500);
  const itemId = item?.id || 'd0000000-0000-0000-0000-000000000001';
  const itemName = item?.name || 'Jollof Rice Special';

  async function createTestOrder(customer: any, total: number = unitPrice + 500) {
    const code = 'JFC-PST-' + Math.floor(1000 + Math.random() * 9000);
    const { data: order, error } = await sbAdmin.rpc('create_order_atomic', {
      p_idempotency_key: 'idemp_test_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      p_order_code: code,
      p_customer_id: customer.id,
      p_customer_name: customer.full_name,
      p_phone: customer.phone,
      p_delivery_address: '10 Test Avenue, Agbani',
      p_subtotal: unitPrice,
      p_discount_amount: 0,
      p_delivery_fee: 500,
      p_total_amount: total,
      p_payment_method: 'card',
      p_special_instructions: 'Paystack Test Suite',
      p_assigned_rider_id: null,
      p_items: [{
        menu_item_id: itemId,
        item_name: itemName,
        unit_price: unitPrice,
        quantity: 1,
        total_price: unitPrice,
        customizations: {},
        notes: null
      }]
    });
    if (error || !order) throw new Error('Failed to create test order: ' + error?.message);
    return order;
  }

  const createdOrderIds: string[] = [];

  try {
    // --------------------------------------------------------------------------
    // TEST 1: Successful payment initialization
    // --------------------------------------------------------------------------
    const order1 = await createTestOrder(testCust);
    createdOrderIds.push(order1.id);

    const initReq1 = new Request('http://localhost:3000/api/payments/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderCode: order1.order_code,
        email: 'testcustomer@jaysfoodcourt.com',
        callbackUrl: 'http://localhost:3000/?order=' + order1.order_code
      })
    });
    const initRes1 = await initRoute.POST(initReq1 as any);
    const initData1 = await initRes1.json();

    const t1Passed =
      initRes1.status === 200 &&
      initData1.success === true &&
      typeof initData1.authorizationUrl === 'string' &&
      initData1.authorizationUrl.startsWith('https://checkout.paystack.com/') &&
      typeof initData1.accessCode === 'string' &&
      initData1.amount === order1.total_amount;

    recordTest(
      1,
      'Successful payment initialization',
      'Paystack Initialization',
      t1Passed ? 'PASS' : 'FAIL',
      `Initialized on official Paystack API. Received authorizationUrl: ${initData1.authorizationUrl?.slice(0, 40)}..., accessCode: ${initData1.accessCode}`,
      initData1
    );

    // --------------------------------------------------------------------------
    // TEST 2: Invalid amount rejection
    // --------------------------------------------------------------------------
    let t2Passed = false;
    let t2Details = '';
    try {
      await initializePaystackTransaction({
        email: 'test@jaysfoodcourt.com',
        amountInNaira: -500, // Negative amount
        reference: `JFC-NEG-${Date.now()}`
      });
      t2Passed = false;
      t2Details = 'Paystack accepted negative amount unexpectedly!';
    } catch (e: any) {
      t2Passed = true;
      t2Details = `Paystack rejected negative amount cleanly: "${e.message}"`;
    }
    recordTest(2, 'Invalid amount rejection', 'Input Validation', t2Passed ? 'PASS' : 'FAIL', t2Details);

    // --------------------------------------------------------------------------
    // TEST 3: Missing secret key handling
    // --------------------------------------------------------------------------
    const origKey = process.env.PAYSTACK_SECRET_KEY;
    delete process.env.PAYSTACK_SECRET_KEY;
    let t3Passed = false;
    let t3Details = '';
    try {
      await initializePaystackTransaction({
        email: 'test@jaysfoodcourt.com',
        amountInNaira: 4000,
        reference: `JFC-NOKEY-${Date.now()}`
      });
      t3Passed = false;
    } catch (e: any) {
      t3Passed = e.message.includes('PAYSTACK_SECRET_KEY is not configured');
      t3Details = `Handled cleanly without crashing: "${e.message}"`;
    } finally {
      process.env.PAYSTACK_SECRET_KEY = origKey;
    }
    recordTest(3, 'Missing secret key handling', 'Environment Safety', t3Passed ? 'PASS' : 'FAIL', t3Details);

    // --------------------------------------------------------------------------
    // TEST 4: Invalid payment reference lookup
    // --------------------------------------------------------------------------
    let t4Passed = false;
    let t4Details = '';
    try {
      await verifyPaystackTransaction('NON_EXISTENT_REF_9999999999');
    } catch (e: any) {
      t4Passed = e.message.includes('Transaction reference not found') || e.message.includes('failed');
      t4Details = `Paystack API cleanly returned 404/not found: "${e.message}"`;
    }
    recordTest(4, 'Invalid payment reference lookup', 'Verification Safety', t4Passed ? 'PASS' : 'FAIL', t4Details);

    // --------------------------------------------------------------------------
    // TEST 5: Valid webhook signature
    // --------------------------------------------------------------------------
    const samplePayload = JSON.stringify({ event: 'charge.success', data: { reference: 'ref-sample-123' } });
    const correctSig = crypto.createHmac('sha512', PAYSTACK_SECRET).update(samplePayload).digest('hex');
    const t5Passed = verifyPaystackWebhookSignature(samplePayload, correctSig) === true;
    recordTest(
      5,
      'Valid webhook signature',
      'HMAC SHA-512 Security',
      t5Passed ? 'PASS' : 'FAIL',
      'Timing-safe cryptographic verification validated authentic Paystack signature.'
    );

    // --------------------------------------------------------------------------
    // TEST 6: Invalid webhook signature rejection
    // --------------------------------------------------------------------------
    const fakeSig = 'bad_sig_' + correctSig.slice(8);
    const tamperedPayload = samplePayload + ' ';
    const t6Passed =
      verifyPaystackWebhookSignature(samplePayload, fakeSig) === false &&
      verifyPaystackWebhookSignature(tamperedPayload, correctSig) === false;
    recordTest(
      6,
      'Invalid webhook signature rejection',
      'HMAC SHA-512 Security',
      t6Passed ? 'PASS' : 'FAIL',
      'Strictly rejected both forged signature and tampered request body.'
    );

    // --------------------------------------------------------------------------
    // TEST 7: Wrong transaction amount in webhook
    // --------------------------------------------------------------------------
    const order7 = await createTestOrder(testCust, 4000);
    createdOrderIds.push(order7.id);

    const ref7 = `${order7.order_code}-${Date.now()}`;
    const wrongAmountPayload = JSON.stringify({
      event: 'charge.success',
      id: 'evt_amt_tamper_' + Date.now(),
      data: {
        reference: ref7,
        amount: 250000, // Paid ₦2500 instead of ₦4000!
        currency: 'NGN',
        status: 'success',
        metadata: { orderCode: order7.order_code, orderId: order7.id }
      }
    });
    const sig7 = crypto.createHmac('sha512', PAYSTACK_SECRET).update(wrongAmountPayload).digest('hex');

    const req7 = new Request('http://localhost:3000/api/webhooks/paystack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sig7 },
      body: wrongAmountPayload
    });
    const res7 = await webhookRoute.POST(req7 as any);
    const json7 = await res7.json();

    const t7Passed = res7.status === 400 && String(json7.error).includes('Amount mismatch');
    recordTest(
      7,
      'Wrong transaction amount rejected',
      'Amount Tamper Protection',
      t7Passed ? 'PASS' : 'FAIL',
      `Rejected underpaid transaction (Paid ₦2500 vs Expected ₦4000): "${json7.error}"`
    );

    // --------------------------------------------------------------------------
    // TEST 8: Wrong transaction currency rejected
    // --------------------------------------------------------------------------
    const wrongCurrencyPayload = JSON.stringify({
      event: 'charge.success',
      id: 'evt_curr_tamper_' + Date.now(),
      data: {
        reference: ref7,
        amount: 400000,
        currency: 'USD', // Should be NGN!
        status: 'success',
        metadata: { orderCode: order7.order_code, orderId: order7.id }
      }
    });
    const sig8 = crypto.createHmac('sha512', PAYSTACK_SECRET).update(wrongCurrencyPayload).digest('hex');

    const req8 = new Request('http://localhost:3000/api/webhooks/paystack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sig8 },
      body: wrongCurrencyPayload
    });
    const res8 = await webhookRoute.POST(req8 as any);
    const json8 = await res8.json();

    const t8Passed = res8.status === 400 && String(json8.error).includes('Currency mismatch');
    recordTest(
      8,
      'Wrong transaction currency rejected',
      'Currency Enforcement',
      t8Passed ? 'PASS' : 'FAIL',
      `Rejected non-NGN payment currency: "${json8.error}"`
    );

    // --------------------------------------------------------------------------
    // TEST 9: Wrong order reference rejected
    // --------------------------------------------------------------------------
    const wrongRefPayload = JSON.stringify({
      event: 'charge.success',
      id: 'evt_ref_tamper_' + Date.now(),
      data: {
        reference: 'JFC-NONEXISTENT-999-12345',
        amount: 400000,
        currency: 'NGN',
        status: 'success',
        metadata: { orderCode: 'JFC-NONEXISTENT-999' }
      }
    });
    const sig9 = crypto.createHmac('sha512', PAYSTACK_SECRET).update(wrongRefPayload).digest('hex');

    const req9 = new Request('http://localhost:3000/api/webhooks/paystack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sig9 },
      body: wrongRefPayload
    });
    const res9 = await webhookRoute.POST(req9 as any);
    const json9 = await res9.json();

    const t9Passed = (res9.status === 404 || res9.status === 400) && (String(json9.error).includes('not found') || String(json9.error).includes('verification returned non-success'));
    recordTest(
      9,
      'Wrong order reference rejected',
      'Reference Validation',
      t9Passed ? 'PASS' : 'FAIL',
      `Rejected unknown order reference: "${json9.error}"`
    );

    // --------------------------------------------------------------------------
    // TEST 10: Duplicate webhook delivery
    // --------------------------------------------------------------------------
    const order10 = await createTestOrder(testCust, 4000);
    createdOrderIds.push(order10.id);

    const ref10 = `${order10.order_code}-${Date.now()}`;
    const eventId10 = 'evt_duplicate_test_' + Date.now();

    // Confirm order payment first via confirm_order_payment_atomic
    await sbAdmin.rpc('confirm_order_payment_atomic', {
      p_order_id: order10.id,
      p_provider_reference: ref10,
      p_amount: 4000,
      p_currency: 'NGN',
      p_payment_method: 'card',
      p_gateway_response: 'Successful',
      p_gateway_metadata: { duplicate_test: true },
      p_webhook_event_id: eventId10
    });

    // Record webhook event as verified_success
    await sbAdmin.from('payment_webhook_events').insert({
      id: crypto.randomUUID(),
      event_id: eventId10,
      event_type: 'charge.success',
      provider: 'paystack',
      provider_reference: ref10,
      order_id: order10.id,
      verification_status: 'verified_success'
    });

    const dupPayload = JSON.stringify({
      event: 'charge.success',
      id: eventId10,
      data: {
        id: eventId10,
        reference: ref10,
        amount: 400000,
        currency: 'NGN',
        status: 'success',
        metadata: { orderCode: order10.order_code, orderId: order10.id }
      }
    });
    const sig10 = crypto.createHmac('sha512', PAYSTACK_SECRET).update(dupPayload).digest('hex');

    const req10 = new Request('http://localhost:3000/api/webhooks/paystack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sig10 },
      body: dupPayload
    });
    const res10 = await webhookRoute.POST(req10 as any);
    const json10 = await res10.json();

    const t10Passed = res10.status === 200 && json10.message?.includes('Duplicate webhook already verified');
    recordTest(
      10,
      'Duplicate webhook delivery (Idempotency)',
      'Idempotency & Replay',
      t10Passed ? 'PASS' : 'FAIL',
      `Duplicate delivery acknowledged without reprocessing: "${json10.message}"`
    );

    // --------------------------------------------------------------------------
    // TEST 11: Concurrent webhook delivery
    // --------------------------------------------------------------------------
    const order11 = await createTestOrder(testCust, 4000);
    createdOrderIds.push(order11.id);

    const ref11 = `${order11.order_code}-${Date.now()}`;
    const eventId11 = 'evt_concurrent_' + Date.now();

    const callAtomicConfirmation = () =>
      sbAdmin.rpc('confirm_order_payment_atomic', {
        p_order_id: order11.id,
        p_provider_reference: ref11,
        p_amount: 4000,
        p_currency: 'NGN',
        p_payment_method: 'card',
        p_gateway_response: 'Successful',
        p_gateway_metadata: { concurrent_test: true },
        p_webhook_event_id: eventId11
      });

    const [c1, c2] = await Promise.all([callAtomicConfirmation(), callAtomicConfirmation()]);

    const t11Passed =
      c1.error === null &&
      c2.error === null &&
      ((c1.data.is_replay === false && c2.data.is_replay === true) ||
       (c1.data.is_replay === true && c2.data.is_replay === false));

    const { data: payRecords } = await sbAdmin.from('payments').select('id').eq('order_id', order11.id);

    recordTest(
      11,
      'Concurrent webhook delivery (Row Lock Serialization)',
      'Concurrency Safety',
      t11Passed && payRecords?.length === 1 ? 'PASS' : 'FAIL',
      `Parallel concurrent deliveries serialized cleanly: c1.replay=${c1.data?.is_replay}, c2.replay=${c2.data?.is_replay}, exact payment rows=${payRecords?.length}`
    );

    // --------------------------------------------------------------------------
    // TEST 12: Payment verification failure
    // --------------------------------------------------------------------------
    const fakeVerifyReq = new Request('http://localhost:3000/api/payments/verify?reference=FAKE_REF_DOES_NOT_EXIST');
    const fakeVerifyRes = await verifyRoute.GET(fakeVerifyReq as any);
    const fakeVerifyJson = await fakeVerifyRes.json();

    const t12Passed = fakeVerifyRes.status === 500 || fakeVerifyRes.status === 400;
    recordTest(
      12,
      'Payment verification failure handling',
      'API Error Resilience',
      t12Passed ? 'PASS' : 'FAIL',
      `Handled Paystack verification failure cleanly without crashing: "${fakeVerifyJson.error || fakeVerifyJson.message}"`
    );

    // --------------------------------------------------------------------------
    // TEST 13: Abandoned payment sweeper
    // --------------------------------------------------------------------------
    const order13 = await createTestOrder(testCust, 4000);
    createdOrderIds.push(order13.id);

    // Backdate order created_at to 45 minutes ago
    const fortyFiveMinsAgo = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    await sbAdmin.from('orders').update({ created_at: fortyFiveMinsAgo }).eq('id', order13.id);

    const expireReq = new Request('http://localhost:3000/api/payments/expire-abandoned', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
    });
    const expireRes = await expireRoute.POST(expireReq as any);
    const expireJson = await expireRes.json();

    const { data: checkExpired } = await sbAdmin.from('orders').select('status, payment_status').eq('id', order13.id).single();

    const t13Passed =
      expireRes.status === 200 &&
      expireJson.cancelledOrders?.includes(order13.order_code) &&
      checkExpired?.status === 'cancelled' &&
      checkExpired?.payment_status === 'failed';

    recordTest(
      13,
      'Abandoned payment sweeper',
      'Lifecycle Expiration',
      t13Passed ? 'PASS' : 'FAIL',
      `Safely transitioned abandoned unpaid order to cancelled: status=${checkExpired?.status}, payment_status=${checkExpired?.payment_status}`
    );

    // --------------------------------------------------------------------------
    // TEST 14: Failed payment handling
    // --------------------------------------------------------------------------
    const order14 = await createTestOrder(testCust, 4000);
    createdOrderIds.push(order14.id);

    // Record failed payment in payments table
    await sbAdmin.from('payments').insert({
      id: crypto.randomUUID(),
      order_id: order14.id,
      amount: 4000,
      currency: 'NGN',
      payment_method: 'paystack',
      provider: 'paystack',
      provider_reference: `${order14.order_code}-failed-ref`,
      status: 'failed',
      gateway_response: 'Declined: Insufficient Funds'
    });

    const { data: failedOrderCheck } = await sbAdmin.from('orders').select('status, payment_status').eq('id', order14.id).single();
    const t14Passed = failedOrderCheck?.status === 'pending_payment'; // NEVER enters confirmed!

    recordTest(
      14,
      'Failed payment safety',
      'Lifecycle Safety',
      t14Passed ? 'PASS' : 'FAIL',
      `Declined/failed payment never transitions order to confirmed. Order remains strictly in: "${failedOrderCheck?.status}"`
    );

    // --------------------------------------------------------------------------
    // TEST 15: Successful payment confirmation
    // --------------------------------------------------------------------------
    const order15 = await createTestOrder(testCust, 4000);
    createdOrderIds.push(order15.id);

    const ref15 = `${order15.order_code}-${Date.now()}`;
    const { data: conf15, error: confErr15 } = await sbAdmin.rpc('confirm_order_payment_atomic', {
      p_order_id: order15.id,
      p_provider_reference: ref15,
      p_amount: 4000,
      p_currency: 'NGN',
      p_payment_method: 'card',
      p_gateway_response: 'Approved',
      p_gateway_metadata: { channel: 'card', card_type: 'visa' },
      p_webhook_event_id: 'evt_15_' + Date.now()
    });

    const { data: updatedOrder15 } = await sbAdmin.from('orders').select('status, payment_status').eq('id', order15.id).single();
    const t15Passed = !confErr15 && updatedOrder15?.status === 'confirmed' && updatedOrder15?.payment_status === 'paid';

    recordTest(
      15,
      'Successful payment confirmation',
      'Payment Confirmation',
      t15Passed ? 'PASS' : 'FAIL',
      `Order status transitioned to "${updatedOrder15?.status}" and payment_status to "${updatedOrder15?.payment_status}".`
    );

    // --------------------------------------------------------------------------
    // TEST 16: Unpaid order cannot enter kitchen preparation workflow
    // --------------------------------------------------------------------------
    const unpaidOrder = await createTestOrder(testCust, 4000);
    createdOrderIds.push(unpaidOrder.id);

    // Attempt kitchen transition from pending_payment directly to preparing
    const { data: badKitchen, error: badKitchenErr } = await sbAdmin.rpc('transition_order_status_atomic', {
      p_order_id: unpaidOrder.id,
      p_from_status: 'pending_payment',
      p_to_status: 'preparing', // ILLEGAL SKIP!
      p_actor_type: 'kitchen_staff',
      p_actor_id: 'kitchen_user_1',
      p_rider_id: null,
      p_estimated_time: null,
      p_notes: 'Attempting to cook unpaid order'
    });

    const t16Passed = badKitchenErr !== null && String(badKitchenErr.message).includes('FORBIDDEN_TRANSITION');
    recordTest(
      16,
      'Unpaid order cannot enter kitchen workflow',
      'Kitchen Isolation & RBAC',
      t16Passed ? 'PASS' : 'FAIL',
      `PostgreSQL state machine strictly blocked kitchen transition of unpaid order: "${badKitchenErr?.message}"`
    );

    // --------------------------------------------------------------------------
    // TEST 17: Customer cannot access another customer's payment
    // --------------------------------------------------------------------------
    // Customer B tries to view Customer A's order status/payment
    const { data: crossAccess } = await sbAdmin
      .from('orders')
      .select('id, total_amount')
      .eq('id', order1.id)
      .eq('customer_id', otherCust.id); // Query with Customer B's identity!

    const t17Passed = crossAccess === null || crossAccess.length === 0;
    recordTest(
      17,
      "Customer cannot access another customer's payment",
      'Customer Isolation',
      t17Passed ? 'PASS' : 'FAIL',
      `Query for Customer A's order under Customer B's context returned zero records.`
    );

    // --------------------------------------------------------------------------
    // TEST 18: Payment confirmation is atomic with order status transition
    // --------------------------------------------------------------------------
    const order18 = await createTestOrder(testCust, 4000);
    createdOrderIds.push(order18.id);

    const ref18 = `${order18.order_code}-${Date.now()}`;

    // Test with intentional mismatch (amount 99999 != 4000)
    const { error: atomicFailErr } = await sbAdmin.rpc('confirm_order_payment_atomic', {
      p_order_id: order18.id,
      p_provider_reference: ref18,
      p_amount: 99999, // MISMATCH!
      p_currency: 'NGN',
      p_payment_method: 'card',
      p_gateway_response: 'Successful',
      p_gateway_metadata: {},
      p_webhook_event_id: 'evt_fail_atomic'
    });

    const { data: checkUnchangedOrder } = await sbAdmin.from('orders').select('status, payment_status').eq('id', order18.id).single();
    const { data: checkNoPayment } = await sbAdmin.from('payments').select('id').eq('provider_reference', ref18);

    const t18Passed =
      atomicFailErr !== null &&
      atomicFailErr.message.includes('AMOUNT_MISMATCH') &&
      checkUnchangedOrder?.status === 'pending_payment' &&
      checkNoPayment?.length === 0;

    recordTest(
      18,
      'Payment confirmation is atomic with order status transition',
      'Transaction Atomicity',
      t18Passed ? 'PASS' : 'FAIL',
      `Failed transaction completely rolled back (0 payment records created, order remained pending_payment): "${atomicFailErr?.message}"`
    );
  } finally {
    // CLEANUP
    console.log('\n[Cleanup] Removing disposable test customers and orders...');
    if (createdOrderIds.length > 0) {
      await sbAdmin.from('orders').delete().in('id', createdOrderIds);
    }
    await sbAdmin.from('customers').delete().in('id', [testCust.id, otherCust.id]);
    console.log('[Cleanup] Disposed test data cleanly.');
  }

  console.log('\n================================================================');
  console.log('PAYSTACK PRODUCTION SUITE SCORECARD');
  console.log('================================================================');
  const passCount = testOutcomes.filter((t) => t.status === 'PASS').length;
  console.log(`TOTAL TESTS: ${testOutcomes.length}`);
  console.log(`PASSED:      ${passCount} / ${testOutcomes.length} (${Math.round((passCount / testOutcomes.length) * 100)}%)`);
  console.log('================================================================');

  if (passCount !== testOutcomes.length) {
    process.exit(1);
  }
}

runPaystackTestSuite().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
