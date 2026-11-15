'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { notificationManager } from '@/lib/notifications';

export interface OrderMessage {
  id: string;
  conversation_id?: string;
  order_id: string;
  order_code: string;
  sender_role: 'customer' | 'rider';
  sender_id: string;
  sender_name: string;
  message_type?: 'text' | 'system_event';
  content: string;
  client_message_id?: string | null;
  delivery_status: 'sent' | 'delivered' | 'read';
  delivered_at?: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ActiveCall {
  id: string;
  conversation_id?: string;
  order_id: string;
  order_code: string;
  caller_id?: string;
  caller_role: 'customer' | 'rider';
  receiver_id?: string;
  receiver_role?: 'customer' | 'rider';
  callee_role?: 'customer' | 'rider';
  status: 'initiating' | 'ringing' | 'accepted' | 'connected' | 'declined' | 'missed' | 'ended' | 'failed' | 'completed';
  room_name?: string;
  livekit_room_id?: string;
  duration_seconds: number;
  end_reason?: string | null;
  token?: string;
  livekit_url?: string;
  created_at: string;
}

interface UseOrderCommunicationOptions {
  orderCode: string;
  orderStatus: string;
  userRole: 'customer' | 'rider';
  enabled?: boolean;
}

export function useOrderCommunication({
  orderCode,
  orderStatus,
  userRole,
  enabled = true
}: UseOrderCommunicationOptions) {
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [counterpartTyping, setCounterpartTyping] = useState<boolean>(false);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [channelConnected, setChannelConnected] = useState<boolean>(false);

  const channelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const myTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isClosed = ['delivered', 'cancelled', 'refunded'].includes(orderStatus);

  // 1. Fetch persistent messages from API
  const fetchMessages = useCallback(async () => {
    if (!orderCode) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        
        // Count unread from counterpart
        const unread = (data.messages || []).filter(
          (m: OrderMessage) => m.sender_role !== userRole && m.delivery_status !== 'read'
        ).length;
        setUnreadCount(unread);
      }
    } catch (e) {
      console.error('[Communication] Error fetching messages:', e);
    } finally {
      setLoading(false);
    }
  }, [orderCode, userRole]);

  // 2. Mark messages as read
  const markAsRead = useCallback(async () => {
    if (!orderCode || unreadCount === 0) return;
    try {
      await fetch(`/api/orders/${encodeURIComponent(orderCode)}/messages/read`, {
        method: 'POST'
      });
      setUnreadCount(0);
      setMessages((prev) =>
        prev.map((m) =>
          m.sender_role !== userRole ? { ...m, delivery_status: 'read', read_at: new Date().toISOString() } : m
        )
      );

      // Broadcast read receipt to peer
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'messages_read',
          payload: { readerRole: userRole, readAt: new Date().toISOString() }
        });
      }
    } catch (e) {
      console.error('[Communication] Error marking read:', e);
    }
  }, [orderCode, unreadCount, userRole]);

  // 3. Send a message
  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      const text = content.trim();
      if (!text || isClosed) return false;

      // Optimistic message with client_message_id
      const clientMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const optimisticMsg: OrderMessage = {
        id: clientMessageId,
        order_id: '',
        order_code: orderCode,
        sender_role: userRole,
        sender_id: 'me',
        sender_name: userRole === 'customer' ? 'Customer' : 'Courier',
        message_type: 'text',
        content: text,
        client_message_id: clientMessageId,
        delivery_status: 'sent',
        read_at: null,
        created_at: new Date().toISOString()
      };

      setMessages((prev) => [...prev, optimisticMsg]);

      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text, client_message_id: clientMessageId })
        });

        if (res.ok) {
          const data = await res.json();
          const savedMessage = data.message;
          setMessages((prev) =>
            prev.map((m) => (m.id === clientMessageId ? savedMessage : m))
          );

          // Broadcast real-time message event to peer
          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'new_message',
              payload: savedMessage
            });
          }
          return true;
        } else {
          // Revert optimistic on error
          setMessages((prev) => prev.filter((m) => m.id !== clientMessageId));
          return false;
        }
      } catch (e) {
        console.error('[Communication] Error sending message:', e);
        setMessages((prev) => prev.filter((m) => m.id !== clientMessageId));
        return false;
      }
    },
    [orderCode, userRole, isClosed]
  );

  // 4. Send typing indicator
  const sendTyping = useCallback(() => {
    if (!channelRef.current || isClosed) return;
    
    // Throttle typing broadcasts to once every 1.5s
    if (!myTypingTimeoutRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { role: userRole, typing: true }
      });

      myTypingTimeoutRef.current = setTimeout(() => {
        myTypingTimeoutRef.current = null;
      }, 1500);
    }
  }, [userRole, isClosed]);

  // 5. Initiate Voice Call
  const startCall = useCallback(async (): Promise<{ call?: ActiveCall; error?: string }> => {
    if (isClosed) return { error: 'Order is closed' };

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/calls`, {
        method: 'POST'
      });
      const data = await res.json();

      if (!res.ok) {
        return { error: data.error || 'Unable to connect call' };
      }

      const newCall: ActiveCall = {
        ...data.call,
        token: data.token,
        livekit_url: data.livekit_url
      };

      setActiveCall(newCall);

      // Signal incoming call to callee via Realtime Broadcast
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'call_invite',
          payload: {
            call: newCall,
            callerRole: userRole
          }
        });
      }

      return { call: newCall };
    } catch (e: any) {
      return { error: e.message || 'Call failed' };
    }
  }, [orderCode, userRole, isClosed]);

  // 6. Update Call Status (Accept, Decline, Complete)
  const updateCallStatus = useCallback(
    async (
      callId: string,
      status: ActiveCall['status'],
      durationSeconds: number = 0,
      endReason?: string
    ) => {
      try {
        await fetch(`/api/orders/${encodeURIComponent(orderCode)}/calls/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId, status, durationSeconds, endReason })
        });

        // Broadcast status update
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'call_status_changed',
            payload: { callId, status, durationSeconds, endReason }
          });
        }

        if (status === 'ended' || status === 'completed' || status === 'declined' || status === 'missed' || status === 'failed') {
          setActiveCall(null);
          setIncomingCall(null);
        } else if (activeCall && activeCall.id === callId) {
          setActiveCall((prev) => (prev ? { ...prev, status } : null));
        }
      } catch (e) {
        console.error('[Communication] Error updating call status:', e);
      }
    },
    [orderCode, activeCall]
  );

  // 7. Supabase Realtime Channel Subscription
  useEffect(() => {
    if (!enabled || !orderCode) return;

    fetchMessages();

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channelName = `order-comm-${orderCode.trim().toUpperCase()}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: true }
      }
    });

    // Handle incoming broadcast events
    channel
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        if (!payload) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.id)) return prev;
          return [...prev, payload];
        });

        if (payload.sender_role !== userRole) {
          setUnreadCount((c) => c + 1);
          notificationManager.notifyNewMessage(
            payload.sender_name || (userRole === 'customer' ? 'Your Courier' : 'Customer'),
            payload.content || 'Sent a new message',
            orderCode
          );
        }
      })
      .on('broadcast', { event: 'messages_read' }, ({ payload }) => {
        if (!payload) return;
        if (payload.readerRole !== userRole) {
          setMessages((prev) =>
            prev.map((m) =>
              m.sender_role === userRole ? { ...m, delivery_status: 'read', read_at: payload.readAt } : m
            )
          );
        }
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload && payload.role !== userRole) {
          setCounterpartTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setCounterpartTyping(false);
          }, 3000);
        }
      })
      .on('broadcast', { event: 'call_invite' }, ({ payload }) => {
        if (payload && payload.callerRole !== userRole) {
          setIncomingCall(payload.call);
          notificationManager.notifyIncomingCall(
            payload.call?.caller_name || (userRole === 'customer' ? 'Courier' : 'Customer'),
            orderCode
          );
        }
      })
      .on('broadcast', { event: 'call_status_changed' }, ({ payload }) => {
        if (!payload) return;
        const { callId, status } = payload;
        notificationManager.stopIncomingRingtone();

        if (status === 'missed') {
          notificationManager.notifyMissedCall(
            userRole === 'customer' ? 'Courier' : 'Customer',
            orderCode
          );
        }

        if (status === 'ended' || status === 'completed' || status === 'declined' || status === 'missed' || status === 'failed') {
          setActiveCall(null);
          setIncomingCall(null);
        } else if (activeCall && activeCall.id === callId) {
          setActiveCall((prev) => (prev ? { ...prev, status } : null));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setChannelConnected(true);
          // Refetch to prevent sync gaps upon reconnect
          fetchMessages();
        } else {
          setChannelConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      notificationManager.stopIncomingRingtone();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [enabled, orderCode, userRole, fetchMessages]);

  return {
    messages,
    unreadCount,
    counterpartTyping,
    activeCall,
    incomingCall,
    loading,
    channelConnected,
    isClosed,
    fetchMessages,
    markAsRead,
    sendMessage,
    sendTyping,
    startCall,
    updateCallStatus,
    setActiveCall,
    setIncomingCall
  };
}
