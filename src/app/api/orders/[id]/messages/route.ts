import { NextRequest, NextResponse } from 'next/server';
import { authenticateCommunicationParticipant } from '@/lib/communication/auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Strips potentially unsafe script/HTML tags while preserving natural punctuation
 * (apostrophes, quotes, ampersands) for React-escaped plain text rendering.
 */
function sanitizeContent(text: string): string {
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/javascript:/gi, '')
    .trim();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderLookup } = await params;
  const auth = await authenticateCommunicationParticipant(req, orderLookup);
  if (auth.errorResponse) return auth.errorResponse;

  const { order, conversation, userRole } = auth.session!;
  const supabase = getSupabaseAdminClient()!;

  // Pagination parameters (Cursor-based pagination)
  const url = new URL(req.url);
  const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);
  const limit = Math.min(Math.max(1, limitParam), 100);
  const cursor = url.searchParams.get('cursor'); // ISO timestamp

  if (!conversation) {
    return NextResponse.json({
      orderCode: order.order_code,
      orderStatus: order.status,
      userRole,
      conversationId: null,
      messages: [],
      nextCursor: null
    });
  }

  // Fetch persistent messages for this conversation (excluding soft-deleted)
  let query = supabase
    .from('order_messages')
    .select('*')
    .eq('conversation_id', conversation.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (cursor) {
    query = query.gt('created_at', cursor);
  }

  const { data: messages, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Transition pending 'sent' messages from counterpart to 'delivered' on fetch.
  // Explicit 'read' receipts are strictly reserved for POST /messages/read when the chat view is opened.
  const nowIso = new Date().toISOString();
  const pendingDeliveryFromCounterpart = (messages || []).filter(
    (m) => m.sender_role !== userRole && m.delivery_status === 'sent'
  );

  if (pendingDeliveryFromCounterpart.length > 0) {
    const deliveredIds = pendingDeliveryFromCounterpart.map((m) => m.id);
    await supabase
      .from('order_messages')
      .update({
        delivery_status: 'delivered',
        delivered_at: nowIso
      })
      .in('id', deliveredIds);
  }

  const normalizedMessages = (messages || []).map((m) =>
    m.sender_role !== userRole && m.delivery_status === 'sent'
      ? { ...m, delivery_status: 'delivered', delivered_at: nowIso }
      : m
  );

  const nextCursor = normalizedMessages.length === limit
    ? normalizedMessages[normalizedMessages.length - 1].created_at
    : null;

  return NextResponse.json({
    orderCode: order.order_code,
    orderStatus: order.status,
    userRole,
    conversationId: conversation.id,
    messages: normalizedMessages,
    nextCursor
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderLookup } = await params;
  const auth = await authenticateCommunicationParticipant(req, orderLookup);
  if (auth.errorResponse) return auth.errorResponse;

  const { order, conversation, userRole, userId, userName } = auth.session!;

  // Check if order communication is archived
  const isArchived = ['delivered', 'cancelled', 'refunded'].includes(order.status);
  if (isArchived) {
    return NextResponse.json(
      { error: 'Order is closed. Sending new messages is no longer permitted.' },
      { status: 400 }
    );
  }

  // If order has no assigned courier yet, text messages are blocked
  if (!order.assigned_rider_id || !conversation) {
    return NextResponse.json(
      { error: 'A courier has not been assigned to this delivery yet.' },
      { status: 400 }
    );
  }

  // Verify conversation is active
  if (conversation.status !== 'active') {
    return NextResponse.json(
      { error: 'This conversation session is closed.' },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const rawContent = String(body.content || '').trim();
  const clientMessageId = body.client_message_id ? String(body.client_message_id).trim() : null;

  if (!rawContent) {
    return NextResponse.json({ error: 'Message content cannot be empty.' }, { status: 400 });
  }

  if (rawContent.length > 1000) {
    return NextResponse.json({ error: 'Message exceeds maximum length of 1,000 characters.' }, { status: 400 });
  }

  const safeContent = sanitizeContent(rawContent);
  const supabase = getSupabaseAdminClient()!;

  // 1. Check idempotency if client_message_id is provided
  if (clientMessageId) {
    const { data: existingMsg } = await supabase
      .from('order_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .eq('client_message_id', clientMessageId)
      .maybeSingle();

    if (existingMsg) {
      // Idempotent duplicate: Return existing message with 200 OK
      return NextResponse.json({ success: true, message: existingMsg, duplicate: true }, { status: 200 });
    }
  }

  // 2. Insert new message
  const nowIso = new Date().toISOString();
  const { data: newMessage, error } = await supabase
    .from('order_messages')
    .insert({
      conversation_id: conversation.id,
      order_id: order.id,
      order_code: order.order_code,
      sender_role: userRole,
      sender_id: userId,
      sender_name: userName,
      message_type: 'text',
      content: safeContent,
      client_message_id: clientMessageId,
      delivery_status: 'delivered', // Delivered to message queue
      created_at: nowIso,
      delivered_at: nowIso
    })
    .select()
    .single();

  if (error) {
    // Check if duplicate key violation occurred concurrently
    if (error.code === '23505' && clientMessageId) {
      const { data: duplicateMsg } = await supabase
        .from('order_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .eq('client_message_id', clientMessageId)
        .maybeSingle();

      if (duplicateMsg) {
        return NextResponse.json({ success: true, message: duplicateMsg, duplicate: true }, { status: 200 });
      }
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update conversation updated_at timestamp
  await supabase
    .from('order_conversations')
    .update({ updated_at: nowIso })
    .eq('id', conversation.id);

  return NextResponse.json({ success: true, message: newMessage }, { status: 201 });
}
