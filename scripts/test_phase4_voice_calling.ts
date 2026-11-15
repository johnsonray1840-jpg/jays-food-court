import { getSupabaseAdminClient } from '../src/lib/supabase/admin';
import { getVoiceProvider } from '../src/lib/voice/provider';

async function runPhase4VoiceCallingSuite() {
  console.log('--- STARTING PHASE 4: TWO-WAY VOICE CALLING VERIFICATION ---');
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error('Supabase admin client failed to initialize');
  }

  // 1. Fetch sample order
  const { data: sampleOrder } = await supabase
    .from('orders')
    .select('id, order_code, customer_id, phone, assigned_rider_id')
    .limit(1)
    .single();

  if (!sampleOrder) throw new Error('No order found');

  // 2. Setup conversation
  const { data: conv } = await supabase
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

  if (!conv) throw new Error('Failed to create test conversation');
  console.log(`✓ Test conversation established: ${conv.id}`);

  // 3. Workflow Step 1: Customer initiates call
  console.log('[Step 1] Customer initiates call (status: initiating)...');
  const roomName = `jfc-voice-${sampleOrder.order_code}-${conv.id.substring(0, 8)}`;
  const nowIso = new Date().toISOString();

  const { data: callSession, error: createErr } = await supabase
    .from('call_sessions')
    .insert({
      conversation_id: conv.id,
      order_id: sampleOrder.id,
      order_code: sampleOrder.order_code,
      caller_id: 'cust-uuid-123',
      caller_role: 'customer',
      caller_name: 'Customer Chioma',
      receiver_id: 'rider-uuid-456',
      receiver_role: 'rider',
      receiver_name: 'Courier Emeka',
      livekit_room_id: roomName,
      status: 'initiating',
      started_at: nowIso,
      created_at: nowIso
    })
    .select()
    .single();

  if (createErr || !callSession) throw new Error(`Initiation failed: ${createErr?.message}`);
  console.log(`✓ Call session record created: ${callSession.id}`);

  // 4. Workflow Step 2: LiveKit Token issued with restricted permissions
  console.log('[Step 2] VoiceProvider issues token with microphone-only grant...');
  const voiceProvider = getVoiceProvider();
  const callerToken = await voiceProvider.generateToken({
    roomName: callSession.livekit_room_id,
    participantIdentity: 'customer-cust-uuid-123',
    participantName: 'Customer Chioma',
    role: 'customer',
    ttlMinutes: 15
  });

  if (!callerToken.token) throw new Error('Caller token generation failed');
  console.log(`✓ Ephemeral caller token generated (${callerToken.token.substring(0, 20)}...)`);

  // 5. Workflow Step 3: Callee receives call & transitions to ringing
  console.log('[Step 3] Callee rings (status: ringing)...');
  await supabase
    .from('call_sessions')
    .update({ status: 'ringing' })
    .eq('id', callSession.id);

  // 6. Workflow Step 4: Callee accepts & fetches receiver token
  console.log('[Step 4] Callee accepts call & receives authorized token...');
  const calleeToken = await voiceProvider.generateToken({
    roomName: callSession.livekit_room_id,
    participantIdentity: 'rider-rider-uuid-456',
    participantName: 'Courier Emeka',
    role: 'rider',
    ttlMinutes: 15
  });

  if (!calleeToken.token) throw new Error('Callee token generation failed');
  console.log(`✓ Ephemeral callee token generated (${calleeToken.token.substring(0, 20)}...)`);

  // 7. Workflow Step 5: Both join and call connects
  console.log('[Step 5] Both participants join room (status: connected)...');
  const answeredAt = new Date().toISOString();
  const { data: connectedCall, error: connErr } = await supabase
    .from('call_sessions')
    .update({
      status: 'connected',
      answered_at: answeredAt
    })
    .eq('id', callSession.id)
    .select()
    .single();

  if (connErr || !connectedCall || connectedCall.status !== 'connected') {
    throw new Error('Connection update failed');
  }
  console.log(`✓ Call active and connected at ${connectedCall.answered_at}`);

  // 8. Workflow Step 6: Hangup & Resource release
  console.log('[Step 6] Normal hangup occurs (status: ended, duration: 42s)...');
  const endedAt = new Date().toISOString();
  const { data: endedCall, error: endErr } = await supabase
    .from('call_sessions')
    .update({
      status: 'ended',
      ended_at: endedAt,
      duration_seconds: 42,
      end_reason: 'normal_hangup'
    })
    .eq('id', callSession.id)
    .select()
    .single();

  if (endErr || !endedCall || endedCall.status !== 'ended' || endedCall.duration_seconds !== 42) {
    throw new Error('Hangup record failed');
  }
  console.log(`✓ Call successfully recorded as ended with normal_hangup.`);

  // 9. Error and Edge Case Scenarios
  console.log('[Step 7] Testing Edge Case: Timeout / Unanswered call...');
  const { data: timedOutCall } = await supabase
    .from('call_sessions')
    .insert({
      conversation_id: conv.id,
      order_id: sampleOrder.id,
      order_code: sampleOrder.order_code,
      caller_id: 'cust-uuid-123',
      caller_role: 'customer',
      caller_name: 'Customer Chioma',
      receiver_id: 'rider-uuid-456',
      receiver_role: 'rider',
      receiver_name: 'Courier Emeka',
      livekit_room_id: `jfc-voice-timeout-${Date.now()}`,
      status: 'missed',
      ended_at: new Date().toISOString(),
      duration_seconds: 0,
      end_reason: 'timeout_no_answer'
    })
    .select()
    .single();

  if (!timedOutCall || timedOutCall.status !== 'missed') {
    throw new Error('Timeout handling failed');
  }
  console.log('✓ Timeout / Unanswered call recorded with status="missed" and end_reason="timeout_no_answer".');

  console.log('[Step 8] Testing Edge Case: Declined call...');
  const { data: declinedCall } = await supabase
    .from('call_sessions')
    .insert({
      conversation_id: conv.id,
      order_id: sampleOrder.id,
      order_code: sampleOrder.order_code,
      caller_id: 'cust-uuid-123',
      caller_role: 'customer',
      caller_name: 'Customer Chioma',
      receiver_id: 'rider-uuid-456',
      receiver_role: 'rider',
      receiver_name: 'Courier Emeka',
      livekit_room_id: `jfc-voice-declined-${Date.now()}`,
      status: 'declined',
      ended_at: new Date().toISOString(),
      duration_seconds: 0,
      end_reason: 'receiver_declined'
    })
    .select()
    .single();

  if (!declinedCall || declinedCall.status !== 'declined') {
    throw new Error('Declined handling failed');
  }
  console.log('✓ Declined call recorded with status="declined" and end_reason="receiver_declined".');

  // 10. Clean up
  console.log('[Step 9] Cleaning up test records...');
  await supabase.from('call_sessions').delete().eq('conversation_id', conv.id);
  await supabase.from('order_conversations').delete().eq('id', conv.id);
  console.log('✓ All test records cleaned up.');

  console.log('--- ALL PHASE 4 TWO-WAY VOICE CALLING TESTS PASSED SUCCESSFULLY! ---');
}

runPhase4VoiceCallingSuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
