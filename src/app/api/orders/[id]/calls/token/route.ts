import { NextRequest, NextResponse } from 'next/server';
import { authenticateCommunicationParticipant } from '@/lib/communication/auth';
import { getVoiceProvider } from '@/lib/voice/provider';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderLookup } = await params;
  const auth = await authenticateCommunicationParticipant(req, orderLookup);
  if (auth.errorResponse) return auth.errorResponse;

  const { order, conversation, userRole, userId, userName } = auth.session!;

  // 1. Validate order not archived
  const isArchived = ['delivered', 'cancelled', 'refunded'].includes(order.status);
  if (isArchived) {
    return NextResponse.json(
      { error: 'Order is closed. Voice calls are no longer permitted.' },
      { status: 400 }
    );
  }

  // 2. Validate active conversation
  if (!conversation) {
    return NextResponse.json(
      { error: 'No active conversation found for this order.' },
      { status: 404 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const callId = body.callId || body.call_id;

  if (!callId) {
    return NextResponse.json({ error: 'callId is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient()!;

  // 3. Verify call session exists and is part of this order & conversation
  const { data: callSession, error: callErr } = await supabase
    .from('call_sessions')
    .select('*')
    .eq('id', callId)
    .eq('conversation_id', conversation.id)
    .maybeSingle();

  if (callErr || !callSession) {
    return NextResponse.json({ error: 'Call session not found' }, { status: 404 });
  }

  // Ensure call is not already ended or failed
  if (['ended', 'declined', 'missed', 'failed'].includes(callSession.status)) {
    return NextResponse.json(
      { error: `Call session is already terminated (${callSession.status}).` },
      { status: 410 }
    );
  }

  // Ensure the requesting user is an authorized participant (either caller or receiver)
  const isAuthorized =
    (userRole === callSession.caller_role && userId === callSession.caller_id) ||
    (userRole === callSession.receiver_role && userId === callSession.receiver_id) ||
    // For customers, role matching order customer
    (userRole === 'customer' && (callSession.caller_role === 'customer' || callSession.receiver_role === 'customer'));

  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Forbidden: You are not a participant in this call session.' },
      { status: 403 }
    );
  }

  // 4. Generate short-lived (15 min TTL) voice token
  const voiceProvider = getVoiceProvider();
  const tokenResult = await voiceProvider.generateToken({
    roomName: callSession.livekit_room_id,
    participantIdentity: `${userRole}-${userId}`,
    participantName: userName,
    role: userRole,
    ttlMinutes: 15
  });

  return NextResponse.json({
    success: true,
    token: tokenResult.token,
    livekit_url: tokenResult.serverUrl,
    room_name: callSession.livekit_room_id,
    status: callSession.status
  });
}
