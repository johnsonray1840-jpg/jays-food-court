import { NextRequest, NextResponse } from 'next/server';
import { authenticateCommunicationParticipant } from '@/lib/communication/auth';
import { getVoiceProvider } from '@/lib/voice/provider';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

async function expireStaleCalls(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  conversationId: string
) {
  const cutoffIso = new Date(Date.now() - 60_000).toISOString();
  const nowIso = new Date().toISOString();
  await supabase
    .from('call_sessions')
    .update({
      status: 'missed',
      end_reason: 'timeout_no_answer',
      ended_at: nowIso
    })
    .eq('conversation_id', conversationId)
    .in('status', ['initiating', 'ringing'])
    .lt('created_at', cutoffIso);
}

function formatCallRecord(callRecord: any) {
  return {
    ...callRecord,
    callee_role: callRecord.receiver_role,
    room_name: callRecord.livekit_room_id
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderLookup } = await params;
  const auth = await authenticateCommunicationParticipant(req, orderLookup);
  if (auth.errorResponse) return auth.errorResponse;

  const { order, conversation } = auth.session!;
  const supabase = getSupabaseAdminClient()!;

  if (conversation?.id) {
    await expireStaleCalls(supabase, conversation.id);
  }

  // Fetch call logs for this conversation / order
  let query = supabase
    .from('call_sessions')
    .select('*')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (conversation) {
    query = query.eq('conversation_id', conversation.id);
  }

  const { data: calls, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const formattedCalls = (calls || []).map(formatCallRecord);
  const activeCall =
    formattedCalls.find((c: any) =>
      ['initiating', 'ringing', 'accepted', 'connected'].includes(c.status)
    ) || null;

  return NextResponse.json({
    orderCode: order.order_code,
    activeCall,
    calls: formattedCalls
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

  // Calls are strictly barred on closed orders
  const isArchived = ['delivered', 'cancelled', 'refunded'].includes(order.status);
  if (isArchived) {
    return NextResponse.json(
      { error: 'Order is closed. Voice calls are no longer permitted.' },
      { status: 400 }
    );
  }

  // Calls require an active courier & active conversation
  if (!order.assigned_rider_id || !conversation) {
    return NextResponse.json(
      { error: 'Cannot initiate call: courier has not been assigned to this order yet.' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdminClient()!;
  await expireStaleCalls(supabase, conversation.id);

  // Check if there is already an ongoing active call in this conversation
  const { data: ongoingCall } = await supabase
    .from('call_sessions')
    .select('*')
    .eq('conversation_id', conversation.id)
    .in('status', ['initiating', 'ringing', 'accepted', 'connected'])
    .maybeSingle();

  const voiceProvider = getVoiceProvider();

  if (ongoingCall) {
    const tokenResult = await voiceProvider.generateToken({
      roomName: ongoingCall.livekit_room_id,
      participantIdentity: `${userRole}-${userId}`,
      participantName: userName,
      role: userRole,
      ttlMinutes: 20
    });

    return NextResponse.json({
      success: true,
      call: formatCallRecord(ongoingCall),
      token: tokenResult.token,
      livekit_url: tokenResult.serverUrl,
      provider: tokenResult.provider
    });
  }

  const receiverRole = userRole === 'customer' ? 'rider' : 'customer';
  const assignedRider = Array.isArray(order.assigned_rider) ? order.assigned_rider[0] : order.assigned_rider;
  const receiverId = userRole === 'customer'
    ? String(order.assigned_rider_id)
    : String(order.customer_id || conversation.customer_id || order.order_code);
  const receiverName = userRole === 'customer'
    ? (assignedRider?.full_name || 'Courier')
    : (order.customer_name || 'Customer');

  const livekitRoomId = `jfc-voice-${order.order_code}-${Date.now().toString(36)}`;

  // Generate ephemeral access token via VoiceProvider (Tokens are NEVER stored in DB)
  const tokenResult = await voiceProvider.generateToken({
    roomName: livekitRoomId,
    participantIdentity: `${userRole}-${userId}`,
    participantName: userName,
    role: userRole,
    ttlMinutes: 20
  });

  const nowIso = new Date().toISOString();

  // Insert a new call session record in 'ringing' status
  const { data: callRecord, error } = await supabase
    .from('call_sessions')
    .insert({
      conversation_id: conversation.id,
      order_id: order.id,
      order_code: order.order_code,
      caller_id: userId,
      caller_role: userRole,
      caller_name: userName,
      receiver_id: receiverId,
      receiver_role: receiverRole,
      receiver_name: receiverName,
      livekit_room_id: livekitRoomId,
      status: 'ringing',
      started_at: nowIso,
      created_at: nowIso
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    call: formatCallRecord(callRecord),
    token: tokenResult.token,
    livekit_url: tokenResult.serverUrl,
    provider: tokenResult.provider
  });
}
