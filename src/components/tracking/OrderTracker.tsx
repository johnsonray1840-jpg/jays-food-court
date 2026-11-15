'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Order, OrderStatus } from '@/types';
import {
  Search,
  ArrowRight,
  Receipt,
  Flame,
  Bike,
  Home,
  Phone,
  MessageSquare,
  MapPin,
  Compass,
  Radio,
  ExternalLink,
  Clock,
  AlertCircle,
  PackageCheck,
  CheckCircle2
} from 'lucide-react';
import { calculateHaversineDistanceKm, JFC_KITCHEN_COORDINATES, ENUGU_LOCATION_ZONES } from '@/lib/enugu-geocoding';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { SimulatedDeliveryJourney } from './SimulatedDeliveryJourney';
import { useOrderCommunication } from '@/hooks/useOrderCommunication';
import { OrderChatModal } from '@/components/communication/OrderChatModal';
import { VoiceCallModal, IncomingCallModal } from '@/components/communication/VoiceCallModal';
import { notificationManager } from '@/lib/notifications';

interface OrderTrackerProps {
  initialOrderId?: string;
}

// 8 Explicit Customer Delivery Stages as specified:
// 1. Order confirmed -> 2. Preparing -> 3. Ready for pickup -> 4. Finding a rider -> 5. Rider assigned -> 6. Rider picked up order -> 7. On the way -> 8. Delivered
const MILESTONE_STAGES = [
  { status: 'confirmed', label: 'Confirmed', sublabel: 'Order Confirmed', icon: Receipt },
  { status: 'preparing', label: 'Preparing', sublabel: 'Cooking Fresh', icon: Flame },
  { status: 'ready_for_pickup', label: 'Ready', sublabel: 'Packed at Kitchen', icon: PackageCheck },
  { status: 'finding_rider', label: 'Finding Rider', sublabel: 'Shared Dispatch Pool', icon: Radio },
  { status: 'assigned_to_rider', label: 'Assigned', sublabel: 'Rider Assigned', icon: Bike },
  { status: 'picked_up', label: 'Picked Up', sublabel: 'Collected at Hub', icon: Bike },
  { status: 'out_for_delivery', label: 'On The Way', sublabel: 'Active Delivery', icon: Bike },
  { status: 'delivered', label: 'Delivered', sublabel: 'Order Complete', icon: CheckCircle2 },
];

const STATUS_BADGES: Record<string, string> = {
  pending_payment: 'Awaiting Payment ⏳',
  confirmed: 'Order Confirmed ✓',
  accepted: 'Kitchen Accepted 👩🏾‍🍳',
  preparing: 'Chef Cooking 👨🏾‍🍳',
  cooking: 'Chef Cooking 👨🏾‍🍳',
  ready_for_pickup: 'Packed & Finding Rider 🥡',
  assigned_to_rider: 'Courier Assigned 🛵',
  picked_up: 'Rider Picked Up Order 🛵',
  out_for_delivery: 'Rider On The Way 🚀',
  dispatched: 'Rider On The Way 🚀',
  delivered: 'Delivered 🎉',
  cancelled: 'Order Cancelled ✕',
  refunded: 'Refunded 💳'
};

export function OrderTracker({ initialOrderId = '' }: OrderTrackerProps) {
  const [orderId, setOrderId] = useState(initialOrderId);
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // In-app private communication hook
  const {
    messages,
    unreadCount,
    counterpartTyping,
    activeCall,
    incomingCall,
    channelConnected,
    isClosed: isCommClosed,
    sendMessage,
    sendTyping,
    startCall,
    updateCallStatus,
    markAsRead,
    setActiveCall,
    setIncomingCall
  } = useOrderCommunication({
    orderCode: trackedOrder?.id || '',
    orderStatus: trackedOrder?.status || '',
    userRole: 'customer',
    enabled: Boolean(trackedOrder?.id && trackedOrder?.rider)
  });

  // Sync with initialOrderId prop when new order is placed
  useEffect(() => {
    if (initialOrderId) {
      setOrderId(initialOrderId);
      fetchStatus(initialOrderId);
    }
  }, [initialOrderId]);

  // Real-time synchronization & controlled recovery polling until delivered
  const trackedOrderId = trackedOrder?.id;
  const trackedOrderStatus = trackedOrder?.status;

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    if (trackedOrderId && trackedOrderStatus && trackedOrderStatus !== 'delivered' && trackedOrderStatus !== 'cancelled') {
      // 1. Initial Authoritative Fetch
      pollStatus(trackedOrderId);

      // 2. Supabase Realtime Subscription for this specific order
      const supabase = getSupabaseBrowserClient();
      let orderChannel: any = null;

      // Duplicate Event Protection (Throttle duplicate triggers)
      let lastTrigger = 0;
      const onOrderChanged = () => {
        const now = Date.now();
        if (now - lastTrigger < 500) return;
        lastTrigger = now;
        // Authoritative Database Refetch
        pollStatus(trackedOrderId);
      };

      if (supabase) {
        orderChannel = supabase
          .channel(`customer-order-${trackedOrderId}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'orders', filter: `order_code=eq.${trackedOrderId}` },
            onOrderChanged
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              // Authoritative refetch on reconnect
              pollStatus(trackedOrderId);
            }
          });
      }

      // 3. Controlled Fallback Polling (3.5s) to guarantee updates if socket disconnects
      pollRef.current = setInterval(() => {
        pollStatus(trackedOrderId);
      }, 3500);

      // 4. Strict Subscription Cleanup
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (orderChannel && supabase) {
          supabase.removeChannel(orderChannel);
        }
      };
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [trackedOrderId, trackedOrderStatus]);

  const pollStatus = async (id: string) => {
    try {
      const res = await fetch(`/api/orders/${id}`);
      if (res.ok) {
        const data = await res.json();
        setTrackedOrder(data);
      }
    } catch {
      // Quiet background polling failure
    }
  };

  const fetchStatus = async (id: string) => {
    const cleanId = id.trim().toUpperCase();
    if (!cleanId) return;

    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`/api/orders/${cleanId}`);
      if (res.ok) {
        const data = await res.json();
        setTrackedOrder(data);
      } else {
        setErrorMsg('Order not found. Please verify your order ID.');
        setTrackedOrder(null);
      }
    } catch {
      setErrorMsg('Failed to connect to order server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Map backend status to the 8 explicit stages:
  // 0: Confirmed, 1: Preparing, 2: Ready for pickup, 3: Finding a rider, 4: Rider assigned, 5: Picked up, 6: On the way, 7: Delivered
  const getStageIndex = (order: Order): number => {
    switch (order.status) {
      case 'pending_payment':
      case 'confirmed':
        return 0;
      case 'accepted':
      case 'preparing':
      case 'cooking':
        return 1;
      case 'ready_for_pickup':
        return order.rider ? 4 : 3;
      case 'assigned_to_rider':
        return 4;
      case 'picked_up':
        return 5;
      case 'out_for_delivery':
      case 'dispatched':
        return 6;
      case 'delivered':
        return 7;
      default:
        return 0;
    }
  };

  const currentIdx = trackedOrder ? getStageIndex(trackedOrder) : 0;
  // Delivery map is available as soon as a rider is assigned (stage 4: assigned_to_rider, picked_up, out_for_delivery, dispatched)
  const isMapAvailable = Boolean(
    trackedOrder &&
    ['assigned_to_rider', 'picked_up', 'out_for_delivery', 'dispatched'].includes(trackedOrder.status)
  );
  const isEnRoute = trackedOrder?.status === 'out_for_delivery' || trackedOrder?.status === 'dispatched';

  // Format last updated timestamp
  const formatUpdateTime = (iso?: string) => {
    if (!iso) return 'Just now';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'Just now';
    }
  };

  return (
    <section className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-12 sm:py-16" id="track">
      <div className="bg-brand-cream/80 border border-brand-line rounded-3xl p-4 sm:p-10 shadow-luxury space-y-6 sm:space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <span className="text-xs uppercase font-extrabold tracking-widest text-amber-700">
            Real-Time Order Tracking
          </span>
          <h2 className="font-serif text-2xl sm:text-4xl font-bold text-brand-ink tracking-tight">
            Live Delivery <span className="text-brand-gold">Tracker</span>
          </h2>
          <p className="text-xs sm:text-sm text-brand-muted">
            Enter your order reference code (e.g. <b>JFC-1042</b>) to follow your meal live across Enugu.
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-brand-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchStatus(orderId)}
              placeholder="Enter Order ID e.g. JFC-8921"
              className="w-full pl-11 pr-4 py-3 sm:py-3.5 min-h-[46px] rounded-full bg-white border border-brand-line text-xs sm:text-sm text-brand-ink focus:border-brand-gold outline-none"
            />
          </div>
          <button
            onClick={() => fetchStatus(orderId)}
            disabled={isLoading}
            className="px-6 py-3 sm:py-3.5 min-h-[46px] rounded-full bg-brand-gold hover:bg-brand-goldDark text-brand-ink font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
          >
            <span>{isLoading ? 'Checking...' : 'Track'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <p className="text-center text-xs font-bold text-red-600">{errorMsg}</p>
        )}

        {/* Live Visual Tracker Box */}
        {trackedOrder && (
          <div className="bg-white rounded-3xl p-4 sm:p-8 border border-brand-line space-y-6 sm:space-y-8 animate-in fade-in duration-300">
            
            {/* Top ETA & ID Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-brand-line">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-gold block">
                  ORDER REFERENCE
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-black text-brand-ink">#{trackedOrder.id}</h3>
              </div>

              <div className="flex items-center gap-3">
                <span className="px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-brand-cream border border-brand-line text-[11px] sm:text-xs font-bold text-amber-800">
                  {STATUS_BADGES[trackedOrder.status] || trackedOrder.status}
                </span>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase tracking-widest text-brand-muted block">
                    TOTAL ESTIMATED ARRIVAL
                  </span>
                  <span className="text-base sm:text-lg font-black text-amber-700">{trackedOrder.eta}</span>
                </div>
              </div>
            </div>

            {/* Mobile Scrollable Stepper: 7 Milestones */}
            <div className="relative overflow-x-auto pb-2 scrollbar-none">
              <div className="min-w-[620px] px-2 sm:px-4">
                {/* Progress Track Line with overflow hidden */}
                <div className="relative">
                  <div className="absolute top-4 sm:top-5 left-6 right-6 h-1 bg-zinc-100 rounded-full overflow-hidden z-0">
                    <div
                      className="h-full bg-brand-gold transition-all duration-700 ease-out rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, (currentIdx / (MILESTONE_STAGES.length - 1)) * 100))}%` }}
                    />
                  </div>

                  <div className="relative flex items-center justify-between z-10">
                    {MILESTONE_STAGES.map((stage, idx) => {
                      const Icon = stage.icon;
                      const isPassed = idx <= currentIdx;
                      const isCurrent = idx === currentIdx;

                      return (
                        <div key={stage.status} className="flex flex-col items-center gap-1.5">
                          <div
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-xs ${
                              isPassed
                                ? 'bg-brand-gold text-brand-ink ring-4 ring-white'
                                : 'bg-white text-zinc-300 border-2 border-zinc-200'
                            } ${isCurrent ? 'ring-4 ring-amber-100 ring-offset-2 scale-110' : ''}`}
                          >
                            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </div>
                          <span className={`text-[10px] sm:text-xs font-bold tracking-tight text-center ${isPassed ? 'text-brand-ink font-extrabold' : 'text-zinc-400'}`}>
                            {stage.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Explicit Kitchen Preparation Status & Countdown Banner */}
            {currentIdx < 2 && (
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-600 animate-pulse" />
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-800">
                      KITCHEN PREPARATION PROGRESS
                    </span>
                  </div>
                  <h4 className="font-bold text-sm sm:text-base text-brand-ink">
                    {trackedOrder.status === 'confirmed'
                      ? 'Order confirmed. Awaiting kitchen prep start...'
                      : 'Your food is actively being prepared in the kitchen.'}
                  </h4>
                  {trackedOrder.prepDelayReason && (
                    <p className="text-xs text-amber-800 font-medium italic">
                      Kitchen Note: {trackedOrder.prepDelayReason}
                    </p>
                  )}
                  {trackedOrder.prepAdjustedBy && (
                    <p className="text-[10px] text-zinc-500">
                      Estimate updated by {trackedOrder.prepAdjustedBy}
                    </p>
                  )}
                </div>

                <div className="bg-white/90 border border-amber-500/20 px-4 py-2.5 rounded-xl shadow-xs text-center shrink-0">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block">
                    Estimated Ready Time
                  </span>
                  <span className="font-mono text-base sm:text-lg font-black text-amber-700">
                    {trackedOrder.estimatedPrepMinutes
                      ? `~${trackedOrder.estimatedPrepMinutes} Mins`
                      : '12 - 15 Mins'}
                  </span>
                </div>
              </div>
            )}

            {/* Ready For Pickup Notification */}
            {currentIdx === 2 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-bold text-sm sm:text-base text-emerald-950">Food Ready for Pickup!</h4>
                    <p className="text-xs text-emerald-700">
                      Our chefs have freshly prepared and boxed your meal. Packaging complete at kitchen hub.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs uppercase">
                  Cooked Fresh
                </span>
              </div>
            )}

            {/* Finding a Rider (In Dispatch Pool) */}
            {currentIdx === 3 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center font-bold">
                    <Radio className="w-5 h-5 animate-spin" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm sm:text-base text-amber-950">Finding Available Courier...</h4>
                    <p className="text-xs text-amber-800">
                      Broadcasting order offer across our active Enugu delivery fleet in your area.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-200 text-amber-900 font-black text-xs uppercase">
                  Dispatching
                </span>
              </div>
            )}

            {/* Synchronized Vector Delivery Simulation Journey */}
            <SimulatedDeliveryJourney
              status={trackedOrder.status}
              destinationAddress={trackedOrder.address}
              destinationLandmark={(trackedOrder as any).landmark || (trackedOrder as any).delivery_landmark}
              zoneName={(trackedOrder as any).delivery_zone_id || 'Enugu Area'}
              courierName={trackedOrder.rider?.name || 'Jay’s Dispatch Courier'}
              estimatedDeliveryTime={trackedOrder.eta || '20 - 30 Mins'}
              statusUpdatedAt={(trackedOrder as any).updated_at || (trackedOrder as any).updatedAt}
              dispatchedAt={(trackedOrder as any).dispatched_at || (trackedOrder as any).dispatchedAt}
              prepTimeMinutes={(trackedOrder as any).prepTimeMinutes}
            />

            {/* Delivery Verification OTP Badge & Mandatory Safety Advisory */}
            {trackedOrder.deliveryOtp && trackedOrder.status !== 'delivered' && trackedOrder.status !== 'cancelled' && (
              <div className="bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-white border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-1 rounded-md inline-block">
                      YOUR DELIVERY VERIFICATION CODE
                    </span>
                    <h4 className="text-sm sm:text-base font-extrabold text-brand-ink">
                      Keep this code private until your order arrives.
                    </h4>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="px-5 py-2.5 rounded-2xl bg-brand-ink text-brand-gold font-mono text-2xl sm:text-3xl font-black tracking-widest shadow-inner border border-zinc-800">
                      {trackedOrder.deliveryOtp}
                    </div>
                  </div>
                </div>

                {/* Prominent Mandatory Safety Reminder */}
                <div className="p-3.5 rounded-2xl bg-white border border-amber-200/90 text-xs text-brand-ink space-y-1.5 shadow-xs">
                  <p className="font-extrabold text-amber-900 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Safety reminder:</span>
                  </p>
                  <p className="text-[11px] sm:text-xs text-zinc-700 leading-relaxed pl-5.5">
                    Never share your delivery code over a phone call, WhatsApp message or SMS. Give it to the rider only when you are physically present and have confirmed the rider&apos;s identity and delivery.
                  </p>
                  <p className="text-[11px] font-bold text-amber-800 pl-5.5">
                    &quot;Jay&apos;s Food Court will never ask you to send this code before delivery.&quot;
                  </p>
                </div>
              </div>
            )}

            {/* Rider Concierge Contact Card (When Assigned) */}
            {currentIdx >= 4 && trackedOrder.rider && (
              <div className="bg-brand-cream/60 rounded-2xl p-4 sm:p-5 border border-brand-line flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-brand-gold flex items-center justify-center text-brand-ink font-black shrink-0">
                    <Bike className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="font-bold text-xs sm:text-sm text-brand-ink truncate">{trackedOrder.rider.name}</h5>
                    <p className="text-[11px] sm:text-xs text-brand-muted truncate">
                      Jay&apos;s Dedicated Courier {trackedOrder.rider.rating ? `• ${trackedOrder.rider.rating}` : ''}
                    </p>
                  </div>
                </div>

                {/* Secure In-App Communication Actions (Masked phone numbers) */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsChatOpen(true);
                      markAsRead();
                    }}
                    className="relative flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-[#17140D] hover:bg-zinc-800 text-brand-gold text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow-sm"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Chat</span>
                    {unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-brand-gold text-zinc-950 text-[10px] font-black flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => startCall()}
                    disabled={isCommClosed}
                    className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow-sm"
                  >
                    <Phone className="w-4 h-4" />
                    <span>In-App Call</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Private In-App Messaging Modal */}
        {trackedOrder && (
          <OrderChatModal
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            orderCode={trackedOrder.id}
            orderStatus={trackedOrder.status}
            userRole="customer"
            counterpartName={trackedOrder.rider?.name || 'Your Courier'}
            messages={messages}
            counterpartTyping={counterpartTyping}
            isClosed={isCommClosed}
            channelConnected={channelConnected}
            onSendMessage={sendMessage}
            onSendTyping={sendTyping}
            onStartCall={() => {
              setIsChatOpen(false);
              startCall();
            }}
            onMarkRead={markAsRead}
          />
        )}

        {/* In-App Voice Call Modal */}
        {activeCall && (
          <VoiceCallModal
            call={activeCall}
            userRole="customer"
            counterpartName={trackedOrder?.rider?.name || 'Your Courier'}
            onEndCall={(callId, duration, endReason) => updateCallStatus(callId, 'ended', duration, endReason)}
            onStatusChange={(status) => {
              if (activeCall) updateCallStatus(activeCall.id, status);
            }}
          />
        )}

        {/* Incoming Call Ring Modal */}
        {incomingCall && (
          <IncomingCallModal
            call={incomingCall}
            counterpartName={trackedOrder?.rider?.name || 'Your Courier'}
            onAccept={(call) => {
              notificationManager.stopIncomingRingtone();
              setActiveCall(call);
              setIncomingCall(null);
              updateCallStatus(call.id, 'accepted');
            }}
            onDecline={(callId) => {
              notificationManager.stopIncomingRingtone();
              updateCallStatus(callId, 'declined');
              setIncomingCall(null);
            }}
          />
        )}

      </div>
    </section>
  );
}
