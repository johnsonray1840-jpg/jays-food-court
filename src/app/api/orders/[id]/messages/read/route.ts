import { NextRequest, NextResponse } from 'next/server';
import { authenticateCommunicationParticipant } from '@/lib/communication/auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderLookup } = await params;
  const auth = await authenticateCommunicationParticipant(req, orderLookup);
  if (auth.errorResponse) return auth.errorResponse;

  const { order, conversation, userRole } = auth.session!;
  const supabase = getSupabaseAdminClient()!;

  if (!conversation) {
    return NextResponse.json({ success: true, markedCount: 0 });
  }

  // Mark all unread messages from counterpart in this conversation as 'read'
  const { data, error } = await supabase
    .from('order_messages')
    .update({
      delivery_status: 'read',
      read_at: new Date().toISOString()
    })
    .eq('conversation_id', conversation.id)
    .neq('sender_role', userRole)
    .neq('delivery_status', 'read')
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    markedCount: (data || []).length
  });
}
