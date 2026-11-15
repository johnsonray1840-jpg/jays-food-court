import { NextRequest, NextResponse } from 'next/server';
import { authenticateCommunicationParticipant } from '@/lib/communication/auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderLookup } = await params;
  const auth = await authenticateCommunicationParticipant(req, orderLookup);
  if (auth.errorResponse) return auth.errorResponse;

  const { order } = auth.session!;
  const body = await req.json().catch(() => ({}));
  const callId = body.callId;
  const newStatus = body.status;
  const durationSeconds = Number(body.durationSeconds) || 0;
  const endReason = body.endReason || null;

  if (!callId || !newStatus) {
    return NextResponse.json({ error: 'callId and status are required.' }, { status: 400 });
  }

  // Supported Call States
  const validStatuses = [
    'initiating',
    'ringing',
    'accepted',
    'connected',
    'declined',
    'missed',
    'ended',
    'failed'
  ];

  if (!validStatuses.includes(newStatus)) {
    return NextResponse.json({ error: `Invalid call status "${newStatus}"` }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient()!;
  const nowIso = new Date().toISOString();

  const updatePayload: any = {
    status: newStatus
  };

  if (newStatus === 'accepted' || newStatus === 'connected') {
    updatePayload.answered_at = nowIso;
  }

  if (newStatus === 'ended' || newStatus === 'declined' || newStatus === 'missed' || newStatus === 'failed') {
    updatePayload.ended_at = nowIso;
    updatePayload.duration_seconds = durationSeconds;
    
    if (endReason) {
      updatePayload.end_reason = endReason;
    } else if (newStatus === 'ended') {
      updatePayload.end_reason = 'normal_hangup';
    } else if (newStatus === 'declined') {
      updatePayload.end_reason = 'receiver_declined';
    } else if (newStatus === 'missed') {
      updatePayload.end_reason = 'timeout_no_answer';
    } else if (newStatus === 'failed') {
      updatePayload.end_reason = 'connection_error';
    }
  }

  const { data: updatedCall, error } = await supabase
    .from('call_sessions')
    .update(updatePayload)
    .eq('id', callId)
    .eq('order_id', order.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    call: updatedCall
  });
}
