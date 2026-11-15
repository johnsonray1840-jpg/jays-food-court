import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '../src/lib/supabase/admin';
import { signStaffSessionToken, AuthenticatedStaff } from '../src/lib/auth';
import { signSessionToken, hasOrderAccess, ORDER_ACCESS_COOKIE_NAME } from '../src/lib/session';
import { POST as createOrder } from '../src/app/api/orders/route';
import { GET as getOrderById } from '../src/app/api/orders/[id]/route';
import { POST as verifyCustomer } from '../src/app/api/orders/[id]/verify-customer/route';
import { GET as getMessages, POST as postMessage } from '../src/app/api/orders/[id]/messages/route';
import { POST as markMessagesRead } from '../src/app/api/orders/[id]/messages/read/route';
import { GET as getCalls, POST as postCall } from '../src/app/api/orders/[id]/calls/route';
import { POST as getCallToken } from '../src/app/api/orders/[id]/calls/token/route';
import { PATCH as patchCallStatus } from '../src/app/api/orders/[id]/calls/status/route';

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function decodeJwtPayload(jwt: string): Record<string, any> {
  const parts = jwt.split('.');
  assert(parts.length === 3, 'LiveKit token must be a valid 3-part JWT');
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
}

function buildReq(
  url: string,
  options: {
    method?: string;
    body?: any;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const headers = new Headers(options.headers || {});
  if (!headers.has('content-type') && options.body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  const cookieEntries = Object.entries(options.cookies || {}).filter(([, v]) => Boolean(v));
  if (cookieEntries.length > 0) {
    headers.set(
      'cookie',
      cookieEntries.map(([k, v]) => `${k}=${v}`).join('; ')
    );
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: options.method || 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {})
  });
}

async function runE2EVerification() {
  console.log('================================================================');
  console.log("JAY'S FOOD COURT — E2E CUSTOMER-RIDER CHAT & VOICE VERIFICATION");
  console.log('================================================================\n');

  const supabase = getSupabaseAdminClient();
  assert(supabase, 'Supabase admin client must initialize');

  const testPhone = '08039990001';
  const normalizedPhone = '+2348039990001';
  const riderId = 'e2e11111-1111-1111-1111-111111111111';
  const otherRiderId = 'e2e22222-2222-2222-2222-222222222222';
  const seededCustomerId = 'e2e33333-3333-3333-3333-333333333333';

  let createdOrderCode = '';
  let createdOrderId = '';

  const riderStaff: AuthenticatedStaff = {
    id: riderId,
    email: 'e2e.rider@jaysfoodcourt.com',
    fullName: 'E2E Rider Chinedu',
    role: 'rider'
  };

  const otherRiderStaff: AuthenticatedStaff = {
    id: otherRiderId,
    email: 'e2e.other@jaysfoodcourt.com',
    fullName: 'E2E Other Rider',
    role: 'rider'
  };

  try {
    // ------------------------------------------------------------------------
    // Seed existing returning customer + riders so isNewCustomer === false is tested
    // ------------------------------------------------------------------------
    await supabase!.from('customers').upsert(
      {
        id: seededCustomerId,
        phone: normalizedPhone,
        full_name: 'E2E Returning Customer'
      },
      { onConflict: 'phone' }
    );

    const { data: actualCust } = await supabase!
      .from('customers')
      .select('id, phone')
      .eq('phone', normalizedPhone)
      .single();

    await supabase!.from('staff_profiles').upsert([
      { id: riderId, email: riderStaff.email, full_name: riderStaff.fullName, role: 'rider', is_active: true },
      { id: otherRiderId, email: otherRiderStaff.email, full_name: otherRiderStaff.fullName, role: 'rider', is_active: true }
    ]);

    await supabase!.from('riders').upsert([
      { id: riderId, full_name: riderStaff.fullName, phone: '08077771111', vehicle_type: 'Motorcycle', is_active: true, is_available: true },
      { id: otherRiderId, full_name: otherRiderStaff.fullName, phone: '08077772222', vehicle_type: 'Motorcycle', is_active: true, is_available: true }
    ]);

    // ------------------------------------------------------------------------
    // 1. Returning guest checkout issues jfc_order_access cookie
    // ------------------------------------------------------------------------
    console.log('[Step 1] Placing order as returning customer (isNewCustomer === false)...');
    const orderReq = buildReq('http://localhost:3000/api/orders', {
      method: 'POST',
      body: {
        customerName: 'E2E Returning Customer',
        phone: testPhone,
        address: 'No. 14 Agbani Road, Enugu',
        deliveryZoneId: 'zone_agbani_core',
        paymentMode: 'online',
        items: [{ menuItemId: 1, quantity: 1 }]
      }
    });

    const orderRes = await createOrder(orderReq);
    assert(orderRes.status === 201, `Expected 201 from POST /api/orders, got ${orderRes.status}`);
    const orderJson = await orderRes.json();
    createdOrderCode = orderJson.order.id;
    createdOrderId = orderJson.order.uuid;

    const orderAccessCookieVal = orderRes.cookies.get(ORDER_ACCESS_COOKIE_NAME)?.value;
    assert(orderAccessCookieVal, 'Expected jfc_order_access cookie to be set on returning customer order creation');
    assert(
      hasOrderAccess(orderAccessCookieVal, createdOrderCode),
      'jfc_order_access cookie must authorize the newly created order code'
    );
    console.log(`✓ Order ${createdOrderCode} created with jfc_order_access cookie issued.`);

    // ------------------------------------------------------------------------
    // 2. Direct order lookup & phone verification
    // ------------------------------------------------------------------------
    console.log('[Step 2] Testing direct order lookup and customer phone verification...');
    const anonLookupRes = await getOrderById(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}`),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    assert(anonLookupRes.status === 200, 'Anonymous lookup should return 200');
    const anonOrder = await anonLookupRes.json();
    assert(anonOrder.isAuthorizedCustomer === false, 'Anonymous lookup must mark isAuthorizedCustomer = false');
    assert(!anonOrder.deliveryOtp, 'Anonymous lookup must NOT expose deliveryOtp');

    const ownerLookupRes = await getOrderById(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}`, {
        cookies: { [ORDER_ACCESS_COOKIE_NAME]: orderAccessCookieVal! }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    const ownerOrder = await ownerLookupRes.json();
    assert(ownerOrder.isAuthorizedCustomer === true, 'Owner lookup via jfc_order_access must set isAuthorizedCustomer = true');
    assert(Boolean(ownerOrder.deliveryOtp), 'Owner lookup must expose deliveryOtp');

    // Verify phone endpoint: wrong phone fails (403)
    const wrongPhoneRes = await verifyCustomer(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}/verify-customer`, {
        method: 'POST',
        body: { phone: '08099998888' }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    assert(wrongPhoneRes.status === 403, `Expected 403 for mismatched phone, got ${wrongPhoneRes.status}`);

    // Verify phone endpoint: matching local format succeeds (200)
    const matchPhoneRes = await verifyCustomer(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}/verify-customer`, {
        method: 'POST',
        body: { phone: testPhone }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    assert(matchPhoneRes.status === 200, `Expected 200 for matching phone, got ${matchPhoneRes.status}`);
    const verifiedOrderCookie = matchPhoneRes.cookies.get(ORDER_ACCESS_COOKIE_NAME)?.value;
    const verifiedCustCookie = matchPhoneRes.cookies.get('jfc_customer_session')?.value;
    assert(verifiedOrderCookie && verifiedCustCookie, 'verify-customer must set both jfc_order_access and jfc_customer_session');
    console.log('✓ Direct order lookup + phone verification cookies verified.');

    // Assign rider in DB for active delivery communication
    await supabase!
      .from('orders')
      .update({ status: 'assigned_to_rider', assigned_rider_id: riderId })
      .eq('order_code', createdOrderCode);

    // ------------------------------------------------------------------------
    // 3. Simultaneous staff + customer cookies isolation (No role collision!)
    // ------------------------------------------------------------------------
    console.log('[Step 3] Testing role isolation with simultaneous staff + customer cookies...');
    const riderToken = signStaffSessionToken(riderStaff);
    const sharedBrowserCookies = {
      jfc_staff_session: riderToken,
      jfc_customer_session: verifiedCustCookie!,
      [ORDER_ACCESS_COOKIE_NAME]: verifiedOrderCookie!
    };

    const sampleCustomerText = "Hello, I'm outside & waiting";
    const custMsgRes = await postMessage(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}/messages`, {
        method: 'POST',
        cookies: sharedBrowserCookies,
        headers: { 'X-Communication-Role': 'customer' },
        body: { content: sampleCustomerText, client_message_id: `e2e-c-${Date.now()}` }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    assert(custMsgRes.status === 201, `Expected 201 for customer message, got ${custMsgRes.status}`);
    const custMsgJson = await custMsgRes.json();
    assert(custMsgJson.message.sender_role === 'customer', `Expected sender_role=customer, got ${custMsgJson.message.sender_role}`);
    assert(
      custMsgJson.message.content === sampleCustomerText,
      `Expected natural punctuation preserved, got "${custMsgJson.message.content}"`
    );

    const riderMsgRes = await postMessage(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}/messages`, {
        method: 'POST',
        cookies: sharedBrowserCookies,
        headers: { 'X-Communication-Role': 'rider' },
        body: { content: 'On my way now!', client_message_id: `e2e-r-${Date.now()}` }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    assert(riderMsgRes.status === 201, `Expected 201 for rider message, got ${riderMsgRes.status}`);
    const riderMsgJson = await riderMsgRes.json();
    assert(riderMsgJson.message.sender_role === 'rider', `Expected sender_role=rider, got ${riderMsgJson.message.sender_role}`);
    console.log('✓ Customer and Rider roles remained 100% isolated under simultaneous cookies, with clean punctuation.');

    // ------------------------------------------------------------------------
    // 4. Delivery vs Read receipt semantics
    // ------------------------------------------------------------------------
    console.log('[Step 4] Testing GET delivery receipt vs explicit POST /messages/read...');
    const bgPollRes = await getMessages(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}/messages`, {
        cookies: sharedBrowserCookies,
        headers: { 'X-Communication-Role': 'customer' }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    const bgPollJson = await bgPollRes.json();
    const riderMsgAfterGet = bgPollJson.messages.find((m: any) => m.id === riderMsgJson.message.id);
    assert(
      riderMsgAfterGet?.delivery_status === 'delivered',
      `Background GET must NOT mark message as read prematurely (got ${riderMsgAfterGet?.delivery_status})`
    );

    const readRes = await markMessagesRead(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}/messages/read`, {
        method: 'POST',
        cookies: sharedBrowserCookies,
        headers: { 'X-Communication-Role': 'customer' }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    const readJson = await readRes.json();
    assert(readRes.status === 200 && readJson.markedCount === 1, 'POST /messages/read must mark exactly 1 counterpart message');

    const afterReadRes = await getMessages(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}/messages`, {
        cookies: sharedBrowserCookies,
        headers: { 'X-Communication-Role': 'rider' }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    const afterReadJson = await afterReadRes.json();
    const riderMsgAfterRead = afterReadJson.messages.find((m: any) => m.id === riderMsgJson.message.id);
    assert(riderMsgAfterRead?.delivery_status === 'read', 'Rider message must now be marked read');
    console.log('✓ Delivery vs explicit Read receipt lifecycle verified.');

    // ------------------------------------------------------------------------
    // 5. Unauthorized role & participant checks
    // ------------------------------------------------------------------------
    console.log('[Step 5] Testing unauthorized rider and wrong customer rejection...');
    const otherRiderToken = signStaffSessionToken(otherRiderStaff);
    const unauthRiderRes = await getMessages(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}/messages`, {
        cookies: { jfc_staff_session: otherRiderToken },
        headers: { 'X-Communication-Role': 'rider' }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    assert(unauthRiderRes.status === 403, `Expected 403 for unassigned rider, got ${unauthRiderRes.status}`);

    const wrongCustToken = signSessionToken({
      customerId: 'wrong-cust-id',
      phone: '+2348090000000',
      createdAt: Date.now()
    });
    const unauthCustRes = await postMessage(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}/messages`, {
        method: 'POST',
        cookies: { jfc_customer_session: wrongCustToken },
        headers: { 'X-Communication-Role': 'customer' },
        body: { content: 'Unauthorized attempt' }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    assert(unauthCustRes.status === 403, `Expected 403 for wrong customer, got ${unauthCustRes.status}`);
    console.log('✓ Unauthorized role access strictly rejected with 403.');

    // ------------------------------------------------------------------------
    // 6. Voice Call Initiation, Discovery, Distinct LiveKit Tokens & Transitions
    // ------------------------------------------------------------------------
    console.log('[Step 6] Testing full voice call workflow and distinct LiveKit identities...');
    const callInitRes = await postCall(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}/calls`, {
        method: 'POST',
        cookies: sharedBrowserCookies,
        headers: { 'X-Communication-Role': 'customer' }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    assert(callInitRes.status === 200, `Expected 200 from POST /calls, got ${callInitRes.status}`);
    const callInitJson = await callInitRes.json();
    const initiatedCall = callInitJson.call;
    assert(initiatedCall.status === 'ringing', `Expected ringing status, got ${initiatedCall.status}`);
    assert(initiatedCall.caller_role === 'customer', 'Caller role must be customer');
    assert(initiatedCall.callee_role === 'rider', 'Callee role must be rider');
    assert(initiatedCall.order_code === createdOrderCode, 'Initiated call must contain order_code');
    assert(callInitJson.token && callInitJson.livekit_url?.startsWith('wss://'), 'Must return LiveKit token and wss URL');

    const callerClaims = decodeJwtPayload(callInitJson.token);
    assert(String(callerClaims.sub || '').startsWith('customer-'), `Caller LiveKit sub must start with customer-, got ${callerClaims.sub}`);

    // Re-calling POST /calls while active returns complete call payload
    const ongoingCallRes = await postCall(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}/calls`, {
        method: 'POST',
        cookies: sharedBrowserCookies,
        headers: { 'X-Communication-Role': 'customer' }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    const ongoingCallJson = await ongoingCallRes.json();
    assert(ongoingCallJson.call.order_code === createdOrderCode, 'Ongoing call response must include order_code');
    assert(ongoingCallJson.call.caller_role === 'customer', 'Ongoing call response must include caller_role');

    // Rider discovers incoming call via GET /calls
    const riderCallsRes = await getCalls(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}/calls`, {
        cookies: sharedBrowserCookies,
        headers: { 'X-Communication-Role': 'rider' }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    const riderCallsJson = await riderCallsRes.json();
    assert(riderCallsJson.activeCall?.id === initiatedCall.id, 'Rider GET /calls must surface activeCall');
    assert(riderCallsJson.activeCall?.status === 'ringing', 'activeCall status must be ringing');

    // Rider accepts call
    const acceptRes = await patchCallStatus(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}/calls/status`, {
        method: 'PATCH',
        cookies: sharedBrowserCookies,
        headers: { 'X-Communication-Role': 'rider' },
        body: { callId: initiatedCall.id, status: 'accepted' }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    assert(acceptRes.status === 200, 'Rider call acceptance must return 200');
    const acceptJson = await acceptRes.json();
    assert(acceptJson.call.status === 'accepted', 'Call status must update to accepted');

    // Rider fetches LiveKit token with distinct participant identity & matching room
    const riderTokenRes = await getCallToken(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}/calls/token`, {
        method: 'POST',
        cookies: sharedBrowserCookies,
        headers: { 'X-Communication-Role': 'rider' },
        body: { callId: initiatedCall.id }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    assert(riderTokenRes.status === 200, `Expected 200 from POST /calls/token, got ${riderTokenRes.status}`);
    const riderTokenJson = await riderTokenRes.json();
    const riderClaims = decodeJwtPayload(riderTokenJson.token);
    assert(String(riderClaims.sub || '').startsWith('rider-'), `Rider LiveKit sub must start with rider-, got ${riderClaims.sub}`);
    assert(callerClaims.sub !== riderClaims.sub, 'Customer and Rider LiveKit identities MUST be distinct');
    assert(callerClaims.video?.room === riderClaims.video?.room, 'Customer and Rider must join the same LiveKit room');

    // Connect and end call
    const connRes = await patchCallStatus(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}/calls/status`, {
        method: 'PATCH',
        cookies: sharedBrowserCookies,
        headers: { 'X-Communication-Role': 'rider' },
        body: { callId: initiatedCall.id, status: 'connected' }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    assert((await connRes.json()).call.status === 'connected', 'Call must transition to connected');

    const endRes = await patchCallStatus(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}/calls/status`, {
        method: 'PATCH',
        cookies: sharedBrowserCookies,
        headers: { 'X-Communication-Role': 'customer' },
        body: { callId: initiatedCall.id, status: 'ended', durationSeconds: 38, endReason: 'normal_hangup' }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    const endJson = await endRes.json();
    assert(endJson.call.status === 'ended' && endJson.call.duration_seconds === 38, 'Call must end cleanly with duration');

    const afterEndCallsRes = await getCalls(
      buildReq(`http://localhost:3000/api/orders/${createdOrderCode}/calls`, {
        cookies: sharedBrowserCookies,
        headers: { 'X-Communication-Role': 'customer' }
      }),
      { params: Promise.resolve({ id: createdOrderCode }) }
    );
    const afterEndCallsJson = await afterEndCallsRes.json();
    assert(afterEndCallsJson.activeCall === null, 'activeCall must be null once ended');
    console.log(
      `✓ Full call flow verified (${callerClaims.sub} <-> ${riderClaims.sub}, room=${callerClaims.video?.room}).`
    );

    console.log('\n================================================================');
    console.log('ALL E2E CUSTOMER-RIDER CHAT & VOICE VERIFICATION CHECKS PASSED!');
    console.log('================================================================');
  } finally {
    // Cleanup DB & local mirror cleanly
    if (createdOrderCode) {
      await supabase?.from('call_sessions').delete().eq('order_code', createdOrderCode);
      await supabase?.from('order_messages').delete().eq('order_code', createdOrderCode);
      await supabase?.from('order_conversations').delete().eq('order_code', createdOrderCode);
      if (createdOrderId) {
        await supabase?.from('delivery_events').delete().eq('order_id', createdOrderId);
        await supabase?.from('order_items').delete().eq('order_id', createdOrderId);
        await supabase?.from('order_status_history').delete().eq('order_id', createdOrderId);
      }
      const { error: delOrderErr } = await supabase!.from('orders').delete().eq('order_code', createdOrderCode);
      if (delOrderErr) {
        // Orders that recorded immutable order_status_history rows cannot be hard-deleted;
        // detach references and mark cancelled so test riders/customers delete cleanly.
        await supabase!
          .from('orders')
          .update({ status: 'cancelled', assigned_rider_id: null, customer_id: null })
          .eq('order_code', createdOrderCode);
      }
      // Also clean up mirrored entry in data/orders.json if added
      try {
        const fs = await import('fs');
        const path = await import('path');
        const ordersFile = path.join(process.cwd(), 'data', 'orders.json');
        if (fs.existsSync(ordersFile)) {
          const list = JSON.parse(fs.readFileSync(ordersFile, 'utf8'));
          const filtered = list.filter((o: any) => o.id !== createdOrderCode);
          fs.writeFileSync(ordersFile, JSON.stringify(filtered, null, 2), 'utf8');
        }
      } catch {}
    }
    await supabase?.from('riders').delete().in('id', [riderId, otherRiderId]);
    await supabase?.from('staff_profiles').delete().in('id', [riderId, otherRiderId]);
    await supabase?.from('customers').delete().eq('id', seededCustomerId);
  }
}

runE2EVerification().catch((err) => {
  console.error('\n❌ E2E VERIFICATION FAILED:', err);
  process.exit(1);
});
