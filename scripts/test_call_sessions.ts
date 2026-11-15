import { getSupabaseAdminClient } from '../src/lib/supabase/admin';

async function runCallSessionsTests() {
  console.log('--- STARTING CALL SESSIONS SCHEMA & LIFECYCLE TESTS ---');
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error('Supabase admin client failed to initialize');
  }

  // 1. Fetch sample order
  const { data: sampleOrder, error: orderErr } = await supabase
    .from('orders')
    .select('id, order_code, customer_id, phone, assigned_rider_id')
    .limit(1)
    .single();

  if (orderErr || !sampleOrder) {
    throw new Error(`Unable to fetch sample order: ${orderErr?.message}`);
  }
  console.log(`[Test 1] Using sample order: ${sampleOrder.order_code}`);

  // 2. Create active test conversation
  const { data: conv, error: convErr } = await supabase
    .from('order_conversations')
    .insert({
      order_id: sampleOrder.id,
      order_code: sampleOrder.order_code,
      customer_id: sampleOrder.customer_id,
      customer_phone: sampleOrder.phone,
      rider_id: sampleOrder.assigned_rider_id,
      status: 'active'
    })
    .select()
    .single();

  if (convErr || !conv) {
    throw new Error(`Failed to create conversation: ${convErr?.message}`);
  }
  console.log(`✓ Active conversation created: ${conv.id}`);

  // 3. Test Call Session initiation
  console.log('[Test 2] Initiating call session with state "initiating"...');
  const livekitRoomId = `jfc-voice-test-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const { data: call, error: callErr } = await supabase
    .from('call_sessions')
    .insert({
      conversation_id: conv.id,
      order_id: sampleOrder.id,
      order_code: sampleOrder.order_code,
      caller_id: 'cust-test-123',
      caller_role: 'customer',
      caller_name: 'Test Customer',
      receiver_id: 'rider-test-456',
      receiver_role: 'rider',
      receiver_name: 'Test Rider',
      livekit_room_id: livekitRoomId,
      status: 'initiating',
      started_at: nowIso,
      created_at: nowIso
    })
    .select()
    .single();

  if (callErr || !call) {
    throw new Error(`Call session initiation failed: ${callErr?.message}`);
  }
  console.log(`✓ Call session initiated: ${call.id}, status: ${call.status}, livekit_room_id: ${call.livekit_room_id}`);

  // 4. Test Single Active Call constraint per conversation
  console.log('[Test 3] Testing uniqueness constraint (one active call per conversation)...');
  const { error: duplicateCallErr } = await supabase
    .from('call_sessions')
    .insert({
      conversation_id: conv.id,
      order_id: sampleOrder.id,
      order_code: sampleOrder.order_code,
      caller_id: 'cust-test-123',
      caller_role: 'customer',
      caller_name: 'Test Customer',
      receiver_id: 'rider-test-456',
      receiver_role: 'rider',
      receiver_name: 'Test Rider',
      livekit_room_id: `jfc-voice-dup-${Date.now()}`,
      status: 'ringing',
      started_at: nowIso,
      created_at: nowIso
    });

  if (!duplicateCallErr) {
    throw new Error('Failed: Duplicate active call session was allowed for the same conversation!');
  }
  console.log('✓ Unique active call constraint successfully prevented duplicate active session.');

  // 5. Transition call: initiating -> ringing -> accepted -> connected
  console.log('[Test 4] Transitioning call states: ringing -> accepted -> connected...');
  await supabase
    .from('call_sessions')
    .update({ status: 'ringing' })
    .eq('id', call.id);

  const answeredTime = new Date().toISOString();
  await supabase
    .from('call_sessions')
    .update({ status: 'accepted', answered_at: answeredTime })
    .eq('id', call.id);

  const { data: connectedCall, error: connErr } = await supabase
    .from('call_sessions')
    .update({ status: 'connected' })
    .eq('id', call.id)
    .select()
    .single();

  if (connErr || !connectedCall || connectedCall.status !== 'connected') {
    throw new Error(`Call state transition failed: ${connErr?.message}`);
  }
  console.log(`✓ Call transitioned to "connected", answered_at: ${connectedCall.answered_at}`);

  // 6. Transition call to terminal state: ended (normal_hangup) with duration
  console.log('[Test 5] Ending call with status "ended", duration_seconds, and end_reason "normal_hangup"...');
  const endTime = new Date().toISOString();
  const { data: endedCall, error: endErr } = await supabase
    .from('call_sessions')
    .update({
      status: 'ended',
      ended_at: endTime,
      duration_seconds: 72,
      end_reason: 'normal_hangup'
    })
    .eq('id', call.id)
    .select()
    .single();

  if (endErr || !endedCall || endedCall.status !== 'ended' || endedCall.duration_seconds !== 72) {
    throw new Error(`Ending call failed: ${endErr?.message}`);
  }
  console.log(`✓ Call successfully ended: duration=${endedCall.duration_seconds}s, end_reason=${endedCall.end_reason}`);

  // 7. Verify declined/missed/failed terminal states
  console.log('[Test 6] Testing other terminal states (declined, missed, failed)...');
  const testStates: Array<{ status: any; end_reason: any }> = [
    { status: 'declined', end_reason: 'receiver_declined' },
    { status: 'missed', end_reason: 'timeout_no_answer' },
    { status: 'failed', end_reason: 'connection_error' }
  ];

  for (const item of testStates) {
    const { data: testSession, error: sErr } = await supabase
      .from('call_sessions')
      .insert({
        conversation_id: conv.id,
        order_id: sampleOrder.id,
        order_code: sampleOrder.order_code,
        caller_id: 'cust-test-123',
        caller_role: 'customer',
        caller_name: 'Test Customer',
        receiver_id: 'rider-test-456',
        receiver_role: 'rider',
        receiver_name: 'Test Rider',
        livekit_room_id: `room-${item.status}-${Date.now()}`,
        status: item.status,
        ended_at: new Date().toISOString(),
        duration_seconds: 0,
        end_reason: item.end_reason
      })
      .select()
      .single();

    if (sErr || !testSession) {
      throw new Error(`Failed to record call with status ${item.status}: ${sErr?.message}`);
    }
    console.log(`✓ State "${item.status}" verified with end_reason "${testSession.end_reason}"`);
    await supabase.from('call_sessions').delete().eq('id', testSession.id);
  }

  // 8. Clean up
  console.log('[Test 7] Cleaning up test records...');
  await supabase.from('call_sessions').delete().eq('conversation_id', conv.id);
  await supabase.from('order_conversations').delete().eq('id', conv.id);
  console.log('✓ Cleanup complete.');

  console.log('--- ALL CALL SESSIONS DATABASE TESTS PASSED SUCCESSFULLY! ---');
}

runCallSessionsTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
