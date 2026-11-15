import { getSupabaseAdminClient } from '../src/lib/supabase/admin';

async function runPhase2DatabaseTests() {
  console.log('--- STARTING PHASE 2 CONVERSATIONS & MESSAGES DATABASE TESTS ---');
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
  console.log(`[Test 1] Using sample order: ${sampleOrder.order_code} (ID: ${sampleOrder.id})`);

  // 2. Test Conversation entity creation
  console.log('[Test 2] Creating order_conversation record...');
  const { data: conversation, error: convErr } = await supabase
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

  if (convErr || !conversation) {
    throw new Error(`Conversation creation failed: ${convErr?.message}`);
  }
  console.log(`✓ Conversation created successfully: ${conversation.id}, status: ${conversation.status}`);

  // 3. Test uniqueness constraint (one active conversation per order)
  console.log('[Test 3] Testing active conversation uniqueness constraint...');
  const { error: duplicateConvErr } = await supabase
    .from('order_conversations')
    .insert({
      order_id: sampleOrder.id,
      order_code: sampleOrder.order_code,
      customer_id: sampleOrder.customer_id,
      customer_phone: sampleOrder.phone,
      rider_id: sampleOrder.assigned_rider_id,
      status: 'active'
    });

  if (!duplicateConvErr) {
    throw new Error('Failed: Duplicate active conversation was allowed!');
  }
  console.log('✓ Uniqueness constraint successfully prevented duplicate active conversation.');

  // 4. Test Message creation with client_message_id (Idempotency)
  console.log('[Test 4] Testing message creation with client_message_id...');
  const testClientId = `test-client-msg-${Date.now()}`;
  const { data: msg1, error: msgErr1 } = await supabase
    .from('order_messages')
    .insert({
      conversation_id: conversation.id,
      order_id: sampleOrder.id,
      order_code: sampleOrder.order_code,
      sender_id: 'test-cust',
      sender_role: 'customer',
      sender_name: 'Test Customer',
      message_type: 'text',
      content: 'Hello, this is an idempotent message test.',
      client_message_id: testClientId,
      delivery_status: 'delivered'
    })
    .select()
    .single();

  if (msgErr1 || !msg1) {
    throw new Error(`Message insertion failed: ${msgErr1?.message}`);
  }
  console.log(`✓ First message inserted: ${msg1.id}, client_message_id: ${msg1.client_message_id}`);

  // 5. Test Idempotency constraint on duplicate client_message_id
  console.log('[Test 5] Testing idempotency constraint on duplicate client_message_id...');
  const { error: duplicateMsgErr } = await supabase
    .from('order_messages')
    .insert({
      conversation_id: conversation.id,
      order_id: sampleOrder.id,
      order_code: sampleOrder.order_code,
      sender_id: 'test-cust',
      sender_role: 'customer',
      sender_name: 'Test Customer',
      message_type: 'text',
      content: 'Duplicate submission attempt.',
      client_message_id: testClientId,
      delivery_status: 'delivered'
    });

  if (!duplicateMsgErr) {
    throw new Error('Failed: Duplicate client_message_id was allowed for the same conversation!');
  }
  console.log('✓ Idempotency constraint successfully blocked duplicate client_message_id.');

  // 6. Test message content length limit constraint (> 1000 characters)
  console.log('[Test 6] Testing message length constraint (> 1000 chars)...');
  const oversizedText = 'A'.repeat(1001);
  const { error: lengthErr } = await supabase
    .from('order_messages')
    .insert({
      conversation_id: conversation.id,
      order_id: sampleOrder.id,
      order_code: sampleOrder.order_code,
      sender_id: 'test-cust',
      sender_role: 'customer',
      sender_name: 'Test Customer',
      message_type: 'text',
      content: oversizedText,
      client_message_id: `len-test-${Date.now()}`,
      delivery_status: 'delivered'
    });

  if (!lengthErr) {
    throw new Error('Failed: Oversized message (>1000 chars) was allowed!');
  }
  console.log('✓ Message length constraint successfully rejected message > 1000 characters.');

  // 7. Test Pagination & Delivery Status Updates
  console.log('[Test 7] Testing message read receipts...');
  const { data: updatedMsg, error: updateErr } = await supabase
    .from('order_messages')
    .update({
      delivery_status: 'read',
      read_at: new Date().toISOString()
    })
    .eq('id', msg1.id)
    .select()
    .single();

  if (updateErr || !updatedMsg || updatedMsg.delivery_status !== 'read') {
    throw new Error(`Message read receipt update failed: ${updateErr?.message}`);
  }
  console.log(`✓ Read receipt applied successfully at: ${updatedMsg.read_at}`);

  // 8. Test Conversation closure (Reassignment / Completion)
  console.log('[Test 8] Closing conversation and verifying archive status...');
  const { data: closedConv, error: closeErr } = await supabase
    .from('order_conversations')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString()
    })
    .eq('id', conversation.id)
    .select()
    .single();

  if (closeErr || !closedConv || closedConv.status !== 'closed') {
    throw new Error(`Conversation closure failed: ${closeErr?.message}`);
  }
  console.log(`✓ Conversation closed successfully at: ${closedConv.closed_at}`);

  // 9. Clean up test records
  console.log('[Test 9] Cleaning up test records...');
  await supabase.from('order_messages').delete().eq('conversation_id', conversation.id);
  await supabase.from('order_conversations').delete().eq('id', conversation.id);
  console.log('✓ Cleanup complete.');

  console.log('--- ALL PHASE 2 DATABASE DESIGN TESTS PASSED! ---');
}

runPhase2DatabaseTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
