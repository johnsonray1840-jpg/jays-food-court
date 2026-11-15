import { NextRequest, NextResponse } from 'next/server';
import { authenticateCommunicationParticipant } from '@/lib/communication/auth';
import { getVoiceProvider } from '@/lib/voice/provider';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderLookup } = await params;
  const auth = await authenticateCommunicationParticipant(req, orderLookup);
  if (auth.errorResponse) return auth.errorResponse;

  const { order, conversation } = auth.session!;
  const supabase = getSupabaseAdminClient()!;

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

  return NextResponse.json({
    orderCode: order.order_code,
    calls: calls || []
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

  const receiverRole = userRole === 'customer' ? 'rider' : 'customer';
  const assignedRider = Array.isArray(order.assigned_rider) ? order.assigned_rider[0] : order.assigned_rider;
  const receiverId = userRole === 'customer' 
    ? String(order.assigned_rider_id) 
    : String(order.customer_id || conversation.customer_id || 'customer');
  const receiverName = userRole === 'customer'
    ? (assignedRider?.full_name || 'Courier')
    : (order.customer_name || 'Customer');

  const livekitRoomId = `jfc-voice-${order.order_code}-${conversation.id.substring(0, 8)}`;

  // Generate ephemeral access token via VoiceProvider (Tokens are NEVER stored in DB)
  const voiceProvider = getVoiceProvider();
  const tokenResult = await voiceProvider.generateToken({
    roomName: livekitRoomId,
    participantIdentity: `${userRole}-${userId}`,
    participantName: userName,
    role: userRole,
    ttlMinutes: 20
  });

  const supabase = getSupabaseAdminClient()!;

  // Check if there is already an ongoing active call in this conversation
  const { data: ongoingCall } = await supabase
    .from('call_sessions')
    .select('id, status, livekit_room_id')
    .eq('conversation_id', conversation.id)
    .in('status', ['initiating', 'ringing', 'accepted', 'connected'])
    .maybeSingle();

  if (ongoingCall) {
    // If already active, return the existing session and token
    return NextResponse.json({
      success: true,
      call: ongoingCall,
      token: tokenResult.token,
      livekit_url: tokenResult.serverUrl
    });
  }

  const nowIso = new Date().toISOString();

  // Insert a new call session record with 'initiating' status
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
      status: 'initiating',
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
    call: {
      id: callRecord.id,
      order_id: order.id,
      order_code: order.order_code,
      caller_role: userRole,
      callee_role: receiverRole,
      status: callRecord.status,
      room_name: livekitRoomId,
      duration_seconds: 0,
      created_at: callRecord.created_at
    },
    token: tokenResult.token,
    livekit_url: tokenResult.serverUrl,
    provider: tokenResult.provider
  });
}
