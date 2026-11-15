import { getSupabaseAdminClient } from '../src/lib/supabase/admin';
import { getVoiceProvider } from '../src/lib/voice/provider';

async function runCommunicationTests() {
  console.log('--- STARTING CUSTOMER-RIDER COMMUNICATION TESTS ---');
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error('Supabase admin client failed to initialize');
  }

  // 1. Check database schema tables
  console.log('[Test 1] Checking order_messages and order_calls table structures...');
  const { data: messages, error: msgErr } = await supabase
    .from('order_messages')
    .select('*')
    .limit(1);

  if (msgErr) {
    throw new Error(`order_messages query failed: ${msgErr.message}`);
  }
  console.log('✓ order_messages table accessible.');

  const { data: calls, error: callErr } = await supabase
    .from('order_calls')
    .select('*')
    .limit(1);

  if (callErr) {
    throw new Error(`order_calls query failed: ${callErr.message}`);
  }
  console.log('✓ order_calls table accessible.');

  // 2. Test LiveKit voice token generation
  console.log('[Test 2] Testing VoiceProvider and token generation...');
  const voiceProvider = getVoiceProvider();
  console.log(`Voice Provider: ${voiceProvider.name}`);

  const tokenResult = await voiceProvider.generateToken({
    roomName: 'room-order-test-123',
    participantIdentity: 'cust-12345',
    participantName: 'Amaka Eze',
    role: 'customer',
    ttlMinutes: 20
  });

  if (!tokenResult || !tokenResult.token) {
    throw new Error('Voice provider failed to produce a valid token');
  }
  console.log('✓ Voice Token generated successfully:', {
    serverUrl: tokenResult.serverUrl,
    roomName: tokenResult.roomName,
    tokenPrefix: tokenResult.token.substring(0, 25) + '...'
  });

  // 3. Test insert and read receipt lifecycle
  console.log('[Test 3] Testing message insertion & read status update...');
  // Find an active order to link test record to
  const { data: sampleOrder } = await supabase
    .from('orders')
    .select('id, order_code')
    .limit(1)
    .single();

  if (!sampleOrder) {
    console.log('⚠️ No sample order found in DB, skipping row-insert test.');
  } else {
    // Insert a test message
    const { data: insertedMsg, error: insertErr } = await supabase
      .from('order_messages')
      .insert({
        order_id: sampleOrder.id,
        order_code: sampleOrder.order_code,
        sender_role: 'customer',
        sender_id: 'test-user-id',
        sender_name: 'Test Customer',
        content: 'Verification test message: courier communication active.',
        delivery_status: 'delivered'
      })
      .select()
      .single();

    if (insertErr || !insertedMsg) {
      throw new Error(`Message insertion failed: ${insertErr?.message}`);
    }
    console.log(`✓ Message inserted with ID: ${insertedMsg.id}, delivery_status: ${insertedMsg.delivery_status}`);

    // Update to read
    const { data: updatedMsg, error: updateErr } = await supabase
      .from('order_messages')
      .update({
        delivery_status: 'read',
        read_at: new Date().toISOString()
      })
      .eq('id', insertedMsg.id)
      .select()
      .single();

    if (updateErr || !updatedMsg || updatedMsg.delivery_status !== 'read') {
      throw new Error(`Message read status update failed: ${updateErr?.message}`);
    }
    console.log(`✓ Message successfully transitioned to read at: ${updatedMsg.read_at}`);

    // Clean up test message
    await supabase.from('order_messages').delete().eq('id', insertedMsg.id);
    console.log('✓ Test message cleaned up.');
  }

  // 4. Test call lifecycle record creation
  if (sampleOrder) {
    console.log('[Test 4] Testing voice call session record & termination...');
    const { data: insertedCall, error: callInsertErr } = await supabase
      .from('order_calls')
      .insert({
        order_id: sampleOrder.id,
        order_code: sampleOrder.order_code,
        caller_role: 'rider',
        caller_name: 'Test Rider',
        callee_role: 'customer',
        status: 'ringing',
        room_name: `order-call-${sampleOrder.order_code}-test`
      })
      .select()
      .single();

    if (callInsertErr || !insertedCall) {
      throw new Error(`Call session record creation failed: ${callInsertErr?.message}`);
    }
    console.log(`✓ Call session initiated with status: ${insertedCall.status}`);

    // Transition call to completed with duration
    const { data: endedCall, error: callEndErr } = await supabase
      .from('order_calls')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        duration_seconds: 45
      })
      .eq('id', insertedCall.id)
      .select()
      .single();

    if (callEndErr || !endedCall || endedCall.status !== 'completed' || endedCall.duration_seconds !== 45) {
      throw new Error(`Call completion update failed: ${callEndErr?.message}`);
    }
    console.log(`✓ Call session completed with duration: ${endedCall.duration_seconds}s`);

    // Clean up test call
    await supabase.from('order_calls').delete().eq('id', insertedCall.id);
    console.log('✓ Test call session cleaned up.');
  }

  console.log('--- ALL CUSTOMER-RIDER COMMUNICATION TESTS PASSED SUCCESSFULLY! ---');
}

runCommunicationTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
