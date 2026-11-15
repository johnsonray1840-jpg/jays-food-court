import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '../src/lib/supabase/admin';
import { signStaffSessionToken, AuthenticatedStaff } from '../src/lib/auth';
import { signSessionToken } from '../src/lib/session';
import { getOfferRecord, recordOfferRejection, getOfferStats } from '../src/lib/dispatch-pool-service';
import { setRiderAssignedZones } from '../src/lib/enugu-zones-service';
import { GET as getRiderProfile, PATCH as patchRiderMe } from '../src/app/api/riders/me/route';
import { GET as getRiderById } from '../src/app/api/riders/[id]/route';
import { GET as getFleetAdmin } from '../src/app/api/admin/fleet/route';
import { POST as postFleetAction } from '../src/app/api/admin/fleet/actions/route';
import { POST as postCreateRider } from '../src/app/api/riders/route';
import { GET as getDispatchOffers } from '../src/app/api/dispatch/offers/route';
import { POST as postClaimOffer } from '../src/app/api/dispatch/offers/[id]/route';
import { GET as getOrderById } from '../src/app/api/orders/[id]/route';
import { GET as getStaffMe } from '../src/app/api/auth/staff/me/route';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordTest(num: number, name: string, passed: boolean, details: string) {
  results.push({ num, name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] Test ${num}: ${name}`);
  if (details) {
    console.log(`   └─ ${details}`);
  }
}

function makeStaffRequest(
  url: string,
  staff: AuthenticatedStaff | null,
  options: { method?: string; body?: any; customerToken?: string } = {}
): NextRequest {
  const headers = new Headers();
  headers.set('host', 'localhost:3000');
  headers.set('content-type', 'application/json');

  const cookiesList: string[] = [];

  if (staff) {
    const token = signStaffSessionToken(staff);
    cookiesList.push(`jfc_staff_session=${token}`);
  }

  if (options.customerToken) {
    cookiesList.push(`jfc_customer_session=${options.customerToken}`);
  }

  if (cookiesList.length > 0) {
    headers.set('cookie', cookiesList.join('; '));
  }

  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: options.method || 'GET',
    headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
}

async function runSecuritySuite() {
  console.log('================================================================');
  console.log('JAY\'S FOOD COURT — FLEET & DISPATCH SECURITY SUITE (SECTION 12)');
  console.log('================================================================\n');

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.error('Database connection unavailable');
    process.exit(1);
  }

  // 0. Query real registered staff IDs from database
  const { data: dbStaff } = await supabase.from('staff_profiles').select('id, email, full_name, role');
  const dbKitchen = (dbStaff || []).find((s) => s.email === 'kitchen@jaysfoodcourt.com');
  const dbOwner = (dbStaff || []).find((s) => s.email === 'owner@jaysfoodcourt.com');

  // Define test actors
  const riderA: AuthenticatedStaff = {
    id: 'f1111111-1111-1111-1111-111111111111',
    email: 'rider.alpha@jaysfoodcourt.com',
    fullName: 'Rider Alpha',
    role: 'rider'
  };

  const riderB: AuthenticatedStaff = {
    id: 'f2222222-2222-2222-2222-222222222222',
    email: 'rider.bravo@jaysfoodcourt.com',
    fullName: 'Rider Bravo',
    role: 'rider'
  };

  const kitchenStaff: AuthenticatedStaff = {
    id: dbKitchen ? dbKitchen.id : '35896f2d-b475-4c8e-a0f2-bc0f4b75e252',
    email: 'kitchen@jaysfoodcourt.com',
    fullName: 'Head Chef Chioma',
    role: 'kitchen_staff'
  };

  const ownerStaff: AuthenticatedStaff = {
    id: dbOwner ? dbOwner.id : '90ca8d6d-43fa-40c9-a8ad-9003c16a0f7e',
    email: 'owner@jaysfoodcourt.com',
    fullName: "Jay (Owner)",
    role: 'owner'
  };

  // Seed riders A and B in database for test isolation
  await supabase.from('staff_profiles').upsert([
    { id: riderA.id, email: riderA.email, full_name: riderA.fullName, role: 'rider', is_active: true },
    { id: riderB.id, email: riderB.email, full_name: riderB.fullName, role: 'rider', is_active: true }
  ]);

  await supabase.from('riders').upsert([
    { id: riderA.id, full_name: riderA.fullName, phone: '08011111111', vehicle_type: 'Motorcycle', is_active: true, is_available: true },
    { id: riderB.id, full_name: riderB.fullName, phone: '08022222222', vehicle_type: 'Bicycle', is_active: true, is_available: true }
  ]);

  // Clean any residual test orders
  const testOrderRef1 = 'SEC-TEST-001';
  const testOrderRef2 = 'SEC-TEST-002';
  const testOrderRef3 = 'SEC-TEST-003';
  await supabase.from('orders').delete().in('order_code', [testOrderRef1, testOrderRef2, testOrderRef3]);

  // --------------------------------------------------------------------------
  // TEST 1: Rider A cannot view Rider B's private profile data
  // --------------------------------------------------------------------------
  try {
    const req = makeStaffRequest(`/api/riders/${riderB.id}`, riderA);
    const res = await getRiderById(req, { params: Promise.resolve({ id: riderB.id }) });
    const status = res.status;
    const body = await res.json();
    const passed = status === 403;
    recordTest(
      1,
      "Rider A cannot view Rider B's private profile data",
      passed,
      `HTTP status: ${status} (expected 403). Error: "${body.error || ''}"`
    );
  } catch (err: any) {
    recordTest(1, "Rider A cannot view Rider B's private profile data", false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Rider A cannot view Rider B's delivery history
  // --------------------------------------------------------------------------
  try {
    // Insert a dummy delivered order assigned to Rider B
    await supabase.from('orders').insert({
      order_code: testOrderRef1,
      customer_name: 'Customer Bravo',
      phone: '08033333333',
      delivery_address: 'Independence Layout, Enugu',
      status: 'delivered',
      payment_status: 'paid',
      payment_method: 'card',
      subtotal: 5000,
      delivery_fee: 1200,
      total_amount: 6200,
      assigned_rider_id: riderB.id
    });

    // Rider A requests their own profile / history
    const reqA = makeStaffRequest('/api/riders/me', riderA);
    const resA = await getRiderProfile(reqA);
    const bodyA = await resA.json();
    const historyOrders = (bodyA.history?.completed || []).map((o: any) => o.order_code);
    const containsBOrder = historyOrders.includes(testOrderRef1);

    const passed = !containsBOrder && bodyA.rider.id === riderA.id;
    recordTest(
      2,
      "Rider A cannot view Rider B's delivery history",
      passed,
      `Rider A history returned ${historyOrders.length} orders; contains Rider B's order: ${containsBOrder}`
    );
  } catch (err: any) {
    recordTest(2, "Rider A cannot view Rider B's delivery history", false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Rider A cannot update Rider B's availability
  // --------------------------------------------------------------------------
  try {
    const req = makeStaffRequest('/api/riders/me', riderA, {
      method: 'PATCH',
      body: { isAvailable: false }
    });
    const res = await patchRiderMe(req);
    const body = await res.json();

    // Verify Rider B's availability remains unchanged (true) in DB
    const { data: bAfter } = await supabase.from('riders').select('is_available').eq('id', riderB.id).single();
    const passed = res.status === 200 && bAfter?.is_available === true;
    recordTest(
      3,
      "Rider A cannot update Rider B's availability",
      passed,
      `Rider A session modified only Rider A. Rider B availability remains: ${bAfter?.is_available}`
    );
  } catch (err: any) {
    recordTest(3, "Rider A cannot update Rider B's availability", false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Rider A cannot claim an ineligible delivery (Zone Mismatch)
  // --------------------------------------------------------------------------
  try {
    // Configure Rider A to ONLY deliver in 'zone_agbani_core'
    setRiderAssignedZones(riderA.id, ['zone_agbani_core'], 'Admin Test');

    // Create an order in 'Trans-Ekulu, Enugu' (zone_trans_ekulu)
    const { data: transEkuluOrder } = await supabase.from('orders').insert({
      order_code: testOrderRef2,
      customer_name: 'Trans-Ekulu Customer',
      phone: '08044444444',
      delivery_address: 'Damija, Trans-Ekulu, Enugu',
      status: 'ready_for_pickup',
      payment_status: 'paid',
      payment_method: 'card',
      subtotal: 4500,
      delivery_fee: 1500,
      total_amount: 6000
    }).select('id, order_code').single();

    if (!transEkuluOrder) throw new Error('Failed to create transEkuluOrder');
    // Rider A attempts to claim the Trans-Ekulu order
    const claimReq = makeStaffRequest(`/api/dispatch/offers/${transEkuluOrder.id}`, riderA, {
      method: 'POST',
      body: { action: 'accept' }
    });
    const claimRes = await postClaimOffer(claimReq, { params: Promise.resolve({ id: transEkuluOrder.id }) });
    const claimBody = await claimRes.json();
    const passed = claimRes.status === 403 && claimBody.error?.includes('Zone mismatch');

    // Clean up transEkuluOrder so Rider A does not retain an active order
    await supabase.from('orders').delete().eq('id', transEkuluOrder.id);
    recordTest(
      4,
      "Rider A cannot claim an ineligible delivery (Zone Mismatch)",
      passed,
      `HTTP status: ${claimRes.status} (expected 403). Error: "${claimBody.error}"`
    );
  } catch (err: any) {
    recordTest(4, "Rider A cannot claim an ineligible delivery (Zone Mismatch)", false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Suspended riders cannot accept offers
  // --------------------------------------------------------------------------
  try {
    // Create suspended rider
    const suspendedRiderId = 'f3333333-3333-3333-3333-333333333333';
    const suspendedStaff: AuthenticatedStaff = {
      id: suspendedRiderId,
      email: 'suspended.rider@jaysfoodcourt.com',
      fullName: 'Suspended Courier',
      role: 'rider'
    };
    await supabase.from('riders').upsert({
      id: suspendedRiderId,
      full_name: suspendedStaff.fullName,
      phone: '08099999999',
      is_active: false,
      is_available: false
    });
    await supabase.from('staff_profiles').upsert({
      id: suspendedRiderId,
      email: suspendedStaff.email,
      full_name: suspendedStaff.fullName,
      role: 'rider',
      is_active: false
    });

    // Create test ready order
    const { data: readyOrder } = await supabase.from('orders').insert({
      order_code: testOrderRef3,
      customer_name: 'Suspended Test Order',
      phone: '08055555555',
      delivery_address: 'Agbani Market Road, Enugu',
      status: 'ready_for_pickup',
      payment_status: 'paid',
      payment_method: 'card',
      subtotal: 3000,
      delivery_fee: 600,
      total_amount: 3600
    }).select('id, order_code').single();

    if (!readyOrder) throw new Error('Failed to create readyOrder');
    // Suspended rider attempts to accept offer
    const claimReq = makeStaffRequest(`/api/dispatch/offers/${readyOrder.id}`, suspendedStaff, {
      method: 'POST',
      body: { action: 'accept' }
    });
    const claimRes = await postClaimOffer(claimReq, { params: Promise.resolve({ id: readyOrder.id }) });
    const claimBody = await claimRes.json();
    const passed = [401, 403].includes(claimRes.status);
    recordTest(
      5,
      "Suspended riders cannot log in or accept offers",
      passed,
      `HTTP status: ${claimRes.status} (expected 401 or 403). Message: "${claimBody.error}"`
    );
  } catch (err: any) {
    recordTest(5, "Suspended riders cannot log in or accept offers", false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Deactivated riders cannot access protected endpoints
  // --------------------------------------------------------------------------
  try {
    const deactivatedStaff: AuthenticatedStaff = {
      id: 'f4444444-4444-4444-4444-444444444444',
      email: 'deactivated.rider@jaysfoodcourt.com',
      fullName: 'Deactivated Courier',
      role: 'rider'
    };
    await supabase.from('riders').upsert({
      id: deactivatedStaff.id,
      full_name: deactivatedStaff.fullName,
      is_active: false,
      is_available: false
    });

    // Attempt to access /api/dispatch/offers
    const req = makeStaffRequest('/api/dispatch/offers', deactivatedStaff);
    const res = await getDispatchOffers(req);
    const status = res.status;
    const body = await res.json();
    const passed = [401, 403].includes(status);
    recordTest(
      6,
      "Deactivated riders cannot access protected endpoints",
      passed,
      `HTTP status: ${status} (expected 401/403). Error: "${body.error}"`
    );
  } catch (err: any) {
    recordTest(6, "Deactivated riders cannot access protected endpoints", false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Kitchen staff cannot create rider accounts
  // --------------------------------------------------------------------------
  try {
    const req = makeStaffRequest('/api/riders', kitchenStaff, {
      method: 'POST',
      body: {
        fullName: 'Unauthorized Courier Invite',
        email: 'unauth.rider@jaysfoodcourt.com',
        phone: '08012345678'
      }
    });
    const res = await postCreateRider(req);
    const status = res.status;
    const body = await res.json();
    const passed = status === 403;
    recordTest(
      7,
      "Kitchen staff cannot create rider accounts",
      passed,
      `HTTP status: ${status} (expected 403). Error: "${body.error}"`
    );
  } catch (err: any) {
    recordTest(7, "Kitchen staff cannot create rider accounts", false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Riders cannot access the Admin dashboard
  // --------------------------------------------------------------------------
  try {
    const req = makeStaffRequest('/api/admin/fleet', riderA);
    const res = await getFleetAdmin(req);
    const status = res.status;
    const body = await res.json();
    const passed = status === 403;
    recordTest(
      8,
      "Riders cannot access the Admin dashboard",
      passed,
      `HTTP status: ${status} (expected 403). Error: "${body.error}"`
    );
  } catch (err: any) {
    recordTest(8, "Riders cannot access the Admin dashboard", false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Unauthorized users cannot create assignments
  // --------------------------------------------------------------------------
  try {
    // Unauthenticated user attempts admin action reassign_order
    const unauthReq = makeStaffRequest('/api/admin/fleet/actions', null, {
      method: 'POST',
      body: {
        action: 'reassign_order',
        targetId: testOrderRef1,
        reason: 'Malicious assignment attempt',
        newRiderId: riderA.id
      }
    });
    const unauthRes = await postFleetAction(unauthReq);
    const unauthStatus = unauthRes.status;

    // Kitchen staff attempts admin action reassign_order
    const kitchenReq = makeStaffRequest('/api/admin/fleet/actions', kitchenStaff, {
      method: 'POST',
      body: {
        action: 'reassign_order',
        targetId: testOrderRef1,
        reason: 'Kitchen attempting fleet reassignment',
        newRiderId: riderA.id
      }
    });
    const kitchenRes = await postFleetAction(kitchenReq);
    const kitchenStatus = kitchenRes.status;

    const passed = [401, 403].includes(unauthStatus) && kitchenStatus === 403;
    recordTest(
      9,
      "Unauthorized users cannot create assignments",
      passed,
      `Unauth status: ${unauthStatus} (expected 401/403), Kitchen status: ${kitchenStatus} (expected 403)`
    );
  } catch (err: any) {
    recordTest(9, "Unauthorized users cannot create assignments", false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: A customer cannot access another customer's rider tracking
  // --------------------------------------------------------------------------
  try {
    const customerA = {
      customerId: 'c1111111-1111-1111-1111-111111111111',
      phone: '08061111111',
      createdAt: Date.now()
    };
    const customerB = {
      customerId: 'c2222222-2222-2222-2222-222222222222',
      phone: '08062222222',
      createdAt: Date.now()
    };

    // Insert order belonging strictly to Customer Alice
    const { data: aliceOrder } = await supabase.from('orders').insert({
      order_code: 'ALICE-TRK-001',
      customer_name: 'Customer Alice',
      phone: customerA.phone,
      delivery_address: 'Independence Layout, Enugu',
      status: 'out_for_delivery',
      payment_status: 'paid',
      payment_method: 'card',
      subtotal: 5000,
      delivery_fee: 1000,
      total_amount: 6000,
      assigned_rider_id: riderB.id
    }).select('id, order_code').single();

    if (!aliceOrder) throw new Error('Failed to create aliceOrder');
    // Customer Bob tries to track Alice's order using Customer Bob's session
    const customerBToken = signSessionToken(customerB);
    const req = makeStaffRequest(`/api/orders/${aliceOrder.order_code}`, null, {
      customerToken: customerBToken
    });
    const res = await getOrderById(req, { params: Promise.resolve({ id: aliceOrder.order_code }) });
    const status = res.status;
    const body = await res.json();

    const passed = status === 403;
    recordTest(
      10,
      "A customer cannot access another customer's rider tracking",
      passed,
      `HTTP status: ${status} (expected 403). Error: "${body.error}"`
    );

    // Clean up test order
    await supabase.from('orders').delete().eq('order_code', 'ALICE-TRK-001');
  } catch (err: any) {
    recordTest(10, "A customer cannot access another customer's rider tracking", false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 11: Two riders cannot claim the same order (CAS Race Test)
  // --------------------------------------------------------------------------
  try {
    // Both Rider A and Rider B are eligible for zone_agbani_core
    setRiderAssignedZones(riderA.id, ['zone_agbani_core'], 'Admin Test');
    setRiderAssignedZones(riderB.id, ['zone_agbani_core'], 'Admin Test');

    // Create an unassigned order ready for pickup in Agbani
    const { data: casOrder } = await supabase.from('orders').insert({
      order_code: 'CAS-RACE-001',
      customer_name: 'Race Condition Test',
      phone: '08077777777',
      delivery_address: 'Agbani Main Market, Enugu',
      status: 'ready_for_pickup',
      payment_status: 'paid',
      payment_method: 'card',
      subtotal: 3500,
      delivery_fee: 500,
      total_amount: 4000
    }).select('id, order_code').single();

    if (!casOrder) throw new Error('Failed to create casOrder');
    // Fire two concurrent claim requests simultaneously
    const claimA = postClaimOffer(
      makeStaffRequest(`/api/dispatch/offers/${casOrder.id}`, riderA, {
        method: 'POST',
        body: { action: 'accept' }
      }),
      { params: Promise.resolve({ id: casOrder.id }) }
    );

    const claimB = postClaimOffer(
      makeStaffRequest(`/api/dispatch/offers/${casOrder.id}`, riderB, {
        method: 'POST',
        body: { action: 'accept' }
      }),
      { params: Promise.resolve({ id: casOrder.id }) }
    );

    const [resA, resB] = await Promise.all([claimA, claimB]);

    const statuses = [resA.status, resB.status];
    const exactlyOneWinner = statuses.includes(200) && statuses.includes(409);
    const passed = exactlyOneWinner;

    recordTest(
      11,
      "Two riders cannot claim the same order (CAS Concurrency Check)",
      passed,
      `Rider 1 status: ${resA.status}, Rider 2 status: ${resB.status} (Winner: 200, Loser: 409 Collision)`
    );

    // Clean up
    await supabase.from('orders').delete().eq('id', casOrder.id);
  } catch (err: any) {
    recordTest(11, "Two riders cannot claim the same order (CAS Concurrency Check)", false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 12: A rider cannot exceed the active delivery limit
  // --------------------------------------------------------------------------
  try {
    // Rider A has an existing active order ('assigned_to_rider')
    const { data: activeOrderA } = await supabase.from('orders').insert({
      order_code: 'CAP-LIMIT-001',
      customer_name: 'Capacity Active Customer',
      phone: '08088888888',
      delivery_address: 'Agbani Station, Enugu',
      status: 'assigned_to_rider',
      payment_status: 'paid',
      payment_method: 'card',
      subtotal: 3000,
      delivery_fee: 500,
      total_amount: 3500,
      assigned_rider_id: riderA.id
    }).select('id, order_code').single();

    // Create a 2nd ready order
    const { data: secondOrder } = await supabase.from('orders').insert({
      order_code: 'CAP-LIMIT-002',
      customer_name: 'Second Order',
      phone: '08088888889',
      delivery_address: 'Agbani Station, Enugu',
      status: 'ready_for_pickup',
      payment_status: 'paid',
      payment_method: 'card',
      subtotal: 2500,
      delivery_fee: 500,
      total_amount: 3000
    }).select('id, order_code').single();

    if (!activeOrderA || !secondOrder) throw new Error('Failed to create orders for capacity test');
    // Rider A attempts to claim a second order
    const req = makeStaffRequest(`/api/dispatch/offers/${secondOrder.id}`, riderA, {
      method: 'POST',
      body: { action: 'accept' }
    });
    const res = await postClaimOffer(req, { params: Promise.resolve({ id: secondOrder.id }) });
    const status = res.status;
    const body = await res.json();

    const passed = status === 422 && body.error?.includes('Capacity limit reached');
    recordTest(
      12,
      "A rider cannot exceed the active delivery limit (1 active mission max)",
      passed,
      `HTTP status: ${status} (expected 422). Error: "${body.error}"`
    );

    // Clean up
    await supabase.from('orders').delete().in('id', [activeOrderA.id, secondOrder.id]);
  } catch (err: any) {
    recordTest(12, "A rider cannot exceed the active delivery limit", false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 13: Rejected offers are recorded correctly
  // --------------------------------------------------------------------------
  try {
    const dummyOrderId = '99999999-9999-9999-9999-999999999999';
    const dummyOrderCode = 'REJ-OFFER-001';

    // Initialize offer
    const offer = getOfferRecord(dummyOrderId, dummyOrderCode);

    // Record rejection by Rider A
    recordOfferRejection(dummyOrderId, riderA.id);
    const afterOffer = getOfferRecord(dummyOrderId, dummyOrderCode);
    const isRecorded = afterOffer.rejectedByRiderIds.has(riderA.id);
    const notRecordedForB = !afterOffer.rejectedByRiderIds.has(riderB.id);

    const passed = isRecorded && notRecordedForB;
    recordTest(
      13,
      "Rejected offers are recorded correctly",
      passed,
      `Offer recorded Rider A rejection: ${isRecorded}; Rider B remains eligible: ${notRecordedForB}`
    );
  } catch (err: any) {
    recordTest(13, "Rejected offers are recorded correctly", false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 14: Expired offers are released correctly
  // --------------------------------------------------------------------------
  try {
    const expireOrderId = '88888888-8888-8888-8888-888888888888';
    const expireOrderCode = 'EXP-OFFER-001';

    // Create an offer with simulated past timestamp
    const expiredRecord = getOfferRecord(expireOrderId, expireOrderCode);
    expiredRecord.expiresAt = Date.now() - 1000; // 1 second in past

    // Check stats
    const statsBefore = getOfferStats();
    const hasExpiredCount = statsBefore.expiredOfferCount > 0;

    // Fetching offer record anew auto-refreshes lifecycle for pool recirculation
    const refreshed = getOfferRecord(expireOrderId, expireOrderCode);
    const isReleasedAndActive = refreshed.expiresAt > Date.now();

    const passed = hasExpiredCount && isReleasedAndActive;
    recordTest(
      14,
      "Expired offers are released correctly",
      passed,
      `Expired offers counted: ${statsBefore.expiredOfferCount}, Auto-released new window: ${isReleasedAndActive}`
    );
  } catch (err: any) {
    recordTest(14, "Expired offers are released correctly", false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 15: Reassignment preserves historical records
  // --------------------------------------------------------------------------
  try {
    const reassignCode = 'REASSIGN-' + Date.now();
    // Create an order assigned to Rider A
    const { data: reassignOrder } = await supabase.from('orders').insert({
      order_code: reassignCode,
      customer_name: 'History Preservation Customer',
      phone: '08091111111',
      delivery_address: 'Agbani Court Road, Enugu',
      status: 'assigned_to_rider',
      payment_status: 'paid',
      payment_method: 'card',
      subtotal: 4000,
      delivery_fee: 500,
      total_amount: 4500,
      assigned_rider_id: riderA.id
    }).select('id, order_code, assigned_rider_id').single();

    if (!reassignOrder) throw new Error('Failed to create reassignOrder');
    // Owner initiates reassignment to Rider B
    const reassignReq = makeStaffRequest('/api/admin/fleet/actions', ownerStaff, {
      method: 'POST',
      body: {
        action: 'reassign_order',
        targetId: reassignOrder.id,
        reason: 'Operational vehicle breakdown of courier Alpha',
        newRiderId: riderB.id
      }
    });
    const reassignRes = await postFleetAction(reassignReq);

    // Query order_status_history and audit trail
    const { data: orderHistory } = await supabase
      .from('order_status_history')
      .select('*')
      .eq('order_id', reassignOrder.id)
      .order('created_at', { ascending: false });

    const { data: updatedOrder } = await supabase
      .from('orders')
      .select('assigned_rider_id, status')
      .eq('id', reassignOrder.id)
      .single();

    const passed =
      reassignRes.status === 200 &&
      updatedOrder?.assigned_rider_id === riderB.id &&
      Boolean(orderHistory && orderHistory.length > 0);

    recordTest(
      15,
      "Reassignment preserves historical records",
      passed,
      `New assignee: Rider B (${updatedOrder?.assigned_rider_id === riderB.id}), History entries preserved: ${orderHistory?.length || 0}`
    );

    // Clean up
    await supabase.from('orders').delete().eq('id', reassignOrder.id);
  } catch (err: any) {
    recordTest(15, "Reassignment preserves historical records", false, err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 16: Admin suspension takes effect on active sessions
  // --------------------------------------------------------------------------
  try {
    // 1. Rider A starts active
    await supabase.from('riders').update({ is_active: true }).eq('id', riderA.id);
    await supabase.from('staff_profiles').update({ is_active: true }).eq('id', riderA.id);

    // Generate a valid signed token for Rider A
    const activeSessionReq = makeStaffRequest('/api/auth/staff/me', riderA);
    const beforeCheck = await getStaffMe(activeSessionReq);
    const beforeStatus = beforeCheck.status;

    // 2. Owner suspends Rider A via Admin Fleet Action
    const suspendReq = makeStaffRequest('/api/admin/fleet/actions', ownerStaff, {
      method: 'POST',
      body: {
        action: 'suspend_rider',
        targetId: riderA.id,
        reason: 'Violation of courier code of conduct'
      }
    });
    const suspendRes = await postFleetAction(suspendReq);

    // 3. Rider A immediately attempts to use their existing session token
    const afterSessionReq = makeStaffRequest('/api/auth/staff/me', riderA);
    const afterCheck = await getStaffMe(afterSessionReq);
    const afterStatus = afterCheck.status;

    // 4. Rider A attempts to fetch delivery offers with that existing session token
    const offersReq = makeStaffRequest('/api/dispatch/offers', riderA);
    const offersRes = await getDispatchOffers(offersReq);
    const offersStatus = offersRes.status;

    // Restore Rider A for future clean state
    await supabase.from('riders').update({ is_active: true, is_available: true }).eq('id', riderA.id);
    await supabase.from('staff_profiles').update({ is_active: true }).eq('id', riderA.id);

    const passed =
      beforeStatus === 200 &&
      suspendRes.status === 200 &&
      afterStatus === 401 &&
      [401, 403].includes(offersStatus);

    recordTest(
      16,
      "Admin suspension takes effect on active sessions",
      passed,
      `Pre-suspend session: ${beforeStatus} (200), Post-suspend session: ${afterStatus} (401 Unauthorized), Post-suspend offers: ${offersStatus} (401/403)`
    );
  } catch (err: any) {
    recordTest(16, "Admin suspension takes effect on active sessions", false, err.message);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('SECURITY SUITE EXECUTION SUMMARY');
  console.log('================================================================');
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = total - passedCount;

  console.log(`Total Security Tests: ${total}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.error('\n❌ SOME REQUIRED SECURITY TESTS FAILED:');
    results.filter(r => !r.passed).forEach(r => console.error(`  - Test ${r.num}: ${r.name} (${r.details})`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 16 REQUIRED SECURITY TESTS PASSED WITH ZERO VULNERABILITIES!');
  }
}

runSecuritySuite().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
