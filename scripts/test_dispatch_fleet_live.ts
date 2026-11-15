import { getSupabaseAdminClient } from '../src/lib/supabase/admin';

async function verifyFleetAndDispatch() {
  console.log('================================================================');
  console.log('JAY\'S FOOD COURT — DISPATCH POOL & FLEET INTEGRATION TEST');
  console.log('================================================================\n');

  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Database service unavailable');

  // 1. Audit Riders Table and Staff Profiles
  console.log('TEST 1: Registered Staff Fleet Verification');
  const { data: staff, error: staffErr } = await supabase
    .from('staff_profiles')
    .select('id, full_name, role, is_active, email');
  
  if (staffErr) throw staffErr;
  console.log(`Found ${staff.length} active staff profiles:`);
  staff.forEach(s => console.log(`  - [${s.role.toUpperCase()}] ${s.full_name} (${s.email})`));

  // 2. Audit Riders Table
  console.log('\nTEST 2: Courier Profiles Verification');
  const { data: couriers, error: courierErr } = await supabase
    .from('riders')
    .select('id, full_name, phone, vehicle_type, is_active, is_available');
  
  if (courierErr) throw courierErr;
  console.log(`Found ${couriers?.length || 0} registered couriers:`);
  couriers?.forEach(c => console.log(`  - ${c.full_name} (${c.phone}) | Vehicle: ${c.vehicle_type || 'Motorcycle'} | Active: ${c.is_active} | Available: ${c.is_available}`));

  // 3. Unpaid Order Isolation from Dispatch Pool
  console.log('\nTEST 3: Unpaid Order Dispatch Isolation Guard');
  const { data: unpaidInPool } = await supabase
    .from('orders')
    .select('id, order_code, payment_status, status')
    .neq('payment_status', 'paid')
    .eq('status', 'ready_for_pickup');
  
  console.log(`Unpaid orders ready for pickup in dispatch pool: ${unpaidInPool?.length || 0}`);
  if (unpaidInPool && unpaidInPool.length > 0) {
    throw new Error('CRITICAL: Found unpaid orders marked ready_for_pickup in pool!');
  }
  console.log('✔ Passed: Unpaid orders strictly excluded from dispatch pool.');

  // 4. Test Atomic Claim CAS Simulation
  console.log('\nTEST 4: Atomic Claim Concurrency Simulation');
  // Create a temporary test order
  const { data: testOrder, error: createErr } = await supabase
    .from('orders')
    .insert({
      order_code: 'JFC-TEST-' + Math.floor(Math.random() * 90000 + 10000),
      customer_name: 'Test Customer',
      phone: '+2348030000000',
      delivery_address: '10 Agbani Road, Enugu',
      status: 'ready_for_pickup',
      payment_status: 'paid',
      subtotal: 5000,
      delivery_fee: 500,
      total_amount: 5500,
      payment_method: 'transfer',
      assigned_rider_id: null
    })
    .select('id, order_code')
    .single();

  if (createErr || !testOrder) {
    console.error('Create test order error:', createErr);
    throw createErr;
  }
  console.log(`Created test order ${testOrder.order_code} (ID: ${testOrder.id})`);

  try {
    const rider1Id = 'd3ac4dbb-ea18-4e3d-8ee7-65e4457e39de';
    const rider2Id = '367b5554-dc4a-4e91-a4ff-1463003bcc16';

    // Simulate concurrent claim
    const [claim1, claim2] = await Promise.all([
      supabase
        .from('orders')
        .update({
          assigned_rider_id: rider1Id,
          status: 'assigned_to_rider'
        })
        .eq('id', testOrder.id)
        .eq('status', 'ready_for_pickup')
        .is('assigned_rider_id', null)
        .select('id, assigned_rider_id'),
      supabase
        .from('orders')
        .update({
          assigned_rider_id: rider2Id,
          status: 'assigned_to_rider'
        })
        .eq('id', testOrder.id)
        .eq('status', 'ready_for_pickup')
        .is('assigned_rider_id', null)
        .select('id, assigned_rider_id')
    ]);

    const winner = claim1.data?.length ? rider1Id : (claim2.data?.length ? rider2Id : null);
    const loser = winner === rider1Id ? claim2.data : claim1.data;

    console.log(`Winner of atomic lock: Rider ${winner}`);
    console.log(`Rejected concurrent claim affected rows: ${loser?.length || 0}`);

    if ((claim1.data?.length || 0) + (claim2.data?.length || 0) !== 1) {
      throw new Error('Concurrency collision failed: expected exactly 1 winner!');
    }
    console.log('✔ Passed: Atomic Compare-And-Swap (CAS) prevents double assignments.');
  } finally {
    // Cleanup test order
    await supabase.from('orders').delete().eq('id', testOrder.id);
    console.log('[Cleanup] Test order deleted.');
  }

  console.log('\n================================================================');
  console.log('ALL FLEET & DISPATCH AUDIT CHECKS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

verifyFleetAndDispatch().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
