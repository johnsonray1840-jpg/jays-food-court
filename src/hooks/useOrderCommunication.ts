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
  caller_name?: string;
  receiver_id?: string;
  receiver_role?: 'customer' | 'rider';
  callee_role?: 'customer' | 'rider';
  receiver_name?: string;
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
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<any>(null);
  const channelSubscribedRef = useRef<boolean>(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const myTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const activeCallRef = useRef<ActiveCall | null>(null);
  const incomingCallRef = useRef<ActiveCall | null>(null);
  const dismissedCallIdsRef = useRef<Set<string>>(new Set());
  const notifiedIncomingCallIdRef = useRef<string | null>(null);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const initialMessagesLoadedRef = useRef<boolean>(false);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const isClosed = ['delivered', 'cancelled', 'refunded'].includes(orderStatus);

  // Reset state whenever orderCode changes or hook is disabled
  useEffect(() => {
    setMessages([]);
    setUnreadCount(0);
    setCounterpartTyping(false);
    setActiveCall(null);
    setIncomingCall(null);
    setError(null);
    activeCallRef.current = null;
    incomingCallRef.current = null;
    dismissedCallIdsRef.current.clear();
    notifiedIncomingCallIdRef.current = null;
    knownMessageIdsRef.current.clear();
    initialMessagesLoadedRef.current = false;
  }, [orderCode, enabled]);

  // 1. Fetch persistent messages from API
  const fetchMessages = useCallback(async () => {
    if (!orderCode || !enabled) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/messages`, {
        headers: {
          'X-Communication-Role': userRole
        }
      });
      if (res.ok) {
        const data = await res.json();
        const serverMessages: OrderMessage[] = data.messages || [];

        // Detect newly arriving counterpart messages on background poll when broadcast was missed
        if (initialMessagesLoadedRef.current) {
          for (const m of serverMessages) {
            if (!knownMessageIdsRef.current.has(m.id) && m.sender_role !== userRole) {
              notificationManager.notifyNewMessage(
                m.sender_name || (userRole === 'customer' ? 'Your Courier' : 'Customer'),
                m.content || 'Sent a new message',
                orderCode
              );
            }
          }
        }
        serverMessages.forEach((m) => knownMessageIdsRef.current.add(m.id));
        initialMessagesLoadedRef.current = true;

        setMessages((prev) => {
          const pendingOptimistic = prev.filter(
            (pm) =>
              pm.id.startsWith('msg-') &&
              !serverMessages.some((sm) => sm.client_message_id && sm.client_message_id === pm.client_message_id)
          );
          return [...serverMessages, ...pendingOptimistic];
        });

        const unread = serverMessages.filter(
          (m) => m.sender_role !== userRole && m.delivery_status !== 'read'
        ).length;
        setUnreadCount(unread);
      } else if (res.status === 403 || res.status === 401) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Access denied for this order conversation.');
      }
    } catch (e) {
      console.error('[Communication] Error fetching messages:', e);
    } finally {
      setLoading(false);
    }
  }, [orderCode, userRole, enabled]);

  // 1b. Fetch active & recent voice call sessions (polling fallback + call discovery)
  const fetchActiveCall = useCallback(async () => {
    if (!orderCode || !enabled || isClosed) return;
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/calls`, {
        headers: {
          'X-Communication-Role': userRole
        }
      });
      if (!res.ok) return;

      const data = await res.json();
      const serverActive: ActiveCall | null = data.activeCall || null;

      if (serverActive) {
        // Incoming ringing call for this participant
        if (
          serverActive.caller_role !== userRole &&
          ['initiating', 'ringing'].includes(serverActive.status) &&
          !dismissedCallIdsRef.current.has(serverActive.id) &&
          activeCallRef.current?.id !== serverActive.id
        ) {
          setIncomingCall((prev) => (prev?.id === serverActive.id ? prev : serverActive));
          if (notifiedIncomingCallIdRef.current !== serverActive.id) {
            notifiedIncomingCallIdRef.current = serverActive.id;
            notificationManager.notifyIncomingCall(
              serverActive.caller_name || (userRole === 'customer' ? 'Courier' : 'Customer'),
              orderCode
            );
          }
        }

        // Sync active outgoing/accepted call status
        if (
          activeCallRef.current?.id === serverActive.id &&
          activeCallRef.current.status !== serverActive.status
        ) {
          setActiveCall((prev) =>
            prev && prev.id === serverActive.id ? { ...prev, status: serverActive.status } : prev
          );
        }
      } else {
        // No active call on server: close any stale ringing/active UI state
        if (incomingCallRef.current) {
          const finishedCall = (data.calls || []).find((c: any) => c.id === incomingCallRef.current?.id);
          notificationManager.stopIncomingRingtone();
          if (finishedCall?.status === 'missed') {
            notificationManager.notifyMissedCall(
              userRole === 'customer' ? 'Courier' : 'Customer',
              orderCode
            );
          }
          setIncomingCall(null);
          incomingCallRef.current = null;
        }

        if (activeCallRef.current) {
          const finishedCall = (data.calls || []).find((c: any) => c.id === activeCallRef.current?.id);
          if (
            finishedCall &&
            ['ended', 'completed', 'declined', 'missed', 'failed'].includes(finishedCall.status)
          ) {
            notificationManager.stopIncomingRingtone();
            setActiveCall(null);
            activeCallRef.current = null;
          }
        }
      }
    } catch {
      // Quiet background call poll error
    }
  }, [orderCode, userRole, enabled, isClosed]);

  // 2. Mark messages as read
  const markAsRead = useCallback(async () => {
    if (!orderCode || unreadCount === 0) return;
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/messages/read`, {
        method: 'POST',
        headers: {
          'X-Communication-Role': userRole
        }
      });
      if (!res.ok) return;

      setUnreadCount(0);
      setMessages((prev) =>
        prev.map((m) =>
          m.sender_role !== userRole ? { ...m, delivery_status: 'read', read_at: new Date().toISOString() } : m
        )
      );

      // Broadcast read receipt to peer
      if (channelRef.current && channelSubscribedRef.current) {
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
      setError(null);

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
          headers: {
            'Content-Type': 'application/json',
            'X-Communication-Role': userRole
          },
          body: JSON.stringify({ content: text, client_message_id: clientMessageId })
        });

        if (res.ok) {
          const data = await res.json();
          const savedMessage: OrderMessage = data.message;
          knownMessageIdsRef.current.add(savedMessage.id);
          setMessages((prev) =>
            prev.map((m) => (m.id === clientMessageId ? savedMessage : m))
          );

          // Broadcast real-time message event to peer
          if (channelRef.current && channelSubscribedRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'new_message',
              payload: savedMessage
            });
          }
          return true;
        } else {
          const errData = await res.json().catch(() => ({}));
          setError(errData.error || 'Failed to send message. Please try again.');
          setMessages((prev) => prev.filter((m) => m.id !== clientMessageId));
          return false;
        }
      } catch (e: any) {
        console.error('[Communication] Error sending message:', e);
        setError(e?.message || 'Network error while sending message.');
        setMessages((prev) => prev.filter((m) => m.id !== clientMessageId));
        return false;
      }
    },
    [orderCode, userRole, isClosed]
  );

  // 4. Send typing indicator
  const sendTyping = useCallback(() => {
    if (!channelRef.current || !channelSubscribedRef.current || isClosed) return;

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
    if (isClosed) {
      const msg = 'Order is closed. Voice calls are no longer permitted.';
      setError(msg);
      return { error: msg };
    }
    setError(null);

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/calls`, {
        method: 'POST',
        headers: {
          'X-Communication-Role': userRole
        }
      });
      const data = await res.json();

      if (!res.ok) {
        const errMsg = data.error || 'Unable to connect call';
        setError(errMsg);
        return { error: errMsg };
      }

      const newCall: ActiveCall = {
        ...data.call,
        token: data.token,
        livekit_url: data.livekit_url
      };

      activeCallRef.current = newCall;
      setActiveCall(newCall);

      // Signal incoming call to callee via Realtime Broadcast if channel is subscribed
      if (channelRef.current && channelSubscribedRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'call_invite',
          payload: {
            call: { ...data.call },
            callerRole: userRole
          }
        });
      }

      return { call: newCall };
    } catch (e: any) {
      const errMsg = e?.message || 'Call failed';
      setError(errMsg);
      return { error: errMsg };
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
      if (['accepted', 'declined', 'ended', 'completed', 'missed', 'failed'].includes(status)) {
        dismissedCallIdsRef.current.add(callId);
      }

      try {
        await fetch(`/api/orders/${encodeURIComponent(orderCode)}/calls/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Communication-Role': userRole
          },
          body: JSON.stringify({ callId, status, durationSeconds, endReason })
        });

        // Broadcast status update
        if (channelRef.current && channelSubscribedRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'call_status_changed',
            payload: { callId, status, durationSeconds, endReason }
          });
        }

        if (status === 'ended' || status === 'completed' || status === 'declined' || status === 'missed' || status === 'failed') {
          activeCallRef.current = null;
          incomingCallRef.current = null;
          setActiveCall(null);
          setIncomingCall(null);
        } else {
          setActiveCall((prev) => {
            if (prev && prev.id === callId) {
              const updated = { ...prev, status };
              activeCallRef.current = updated;
              return updated;
            }
            return prev;
          });
        }
      } catch (e) {
        console.error('[Communication] Error updating call status:', e);
      }
    },
    [orderCode, userRole]
  );

  // 7. Supabase Realtime Channel Subscription + Reliable Polling Fallback
  useEffect(() => {
    if (!enabled || !orderCode) return;

    fetchMessages();
    fetchActiveCall();

    const syncInterval = !isClosed
      ? setInterval(() => {
          fetchMessages();
          fetchActiveCall();
        }, 2500)
      : null;

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return () => {
        if (syncInterval) clearInterval(syncInterval);
      };
    }

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
        knownMessageIdsRef.current.add(payload.id);
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
        if (payload && payload.callerRole !== userRole && payload.call) {
          const invitedCall: ActiveCall = payload.call;
          if (
            dismissedCallIdsRef.current.has(invitedCall.id) ||
            activeCallRef.current?.id === invitedCall.id
          ) {
            return;
          }
          setIncomingCall(invitedCall);
          if (notifiedIncomingCallIdRef.current !== invitedCall.id) {
            notifiedIncomingCallIdRef.current = invitedCall.id;
            notificationManager.notifyIncomingCall(
              invitedCall.caller_name || (userRole === 'customer' ? 'Courier' : 'Customer'),
              orderCode
            );
          }
        }
      })
      .on('broadcast', { event: 'call_status_changed' }, ({ payload }) => {
        if (!payload) return;
        const { callId, status } = payload;

        if (status !== 'initiating' && status !== 'ringing') {
          notificationManager.stopIncomingRingtone();
        }

        if (status === 'missed') {
          notificationManager.notifyMissedCall(
            userRole === 'customer' ? 'Courier' : 'Customer',
            orderCode
          );
        }

        if (status === 'ended' || status === 'completed' || status === 'declined' || status === 'missed' || status === 'failed') {
          dismissedCallIdsRef.current.add(callId);
          activeCallRef.current = null;
          incomingCallRef.current = null;
          setActiveCall(null);
          setIncomingCall(null);
        } else {
          setActiveCall((prev) => {
            if (prev && prev.id === callId) {
              const updated = { ...prev, status };
              activeCallRef.current = updated;
              return updated;
            }
            return prev;
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channelSubscribedRef.current = true;
          setChannelConnected(true);
          // Refetch to prevent sync gaps upon reconnect
          fetchMessages();
          fetchActiveCall();
        } else {
          channelSubscribedRef.current = false;
          setChannelConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      if (syncInterval) clearInterval(syncInterval);
      channelSubscribedRef.current = false;
      notificationManager.stopIncomingRingtone();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [enabled, orderCode, userRole, isClosed, fetchMessages, fetchActiveCall]);

  return {
    messages,
    unreadCount,
    counterpartTyping,
    activeCall,
    incomingCall,
    loading,
    channelConnected,
    isClosed,
    error,
    clearError,
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
