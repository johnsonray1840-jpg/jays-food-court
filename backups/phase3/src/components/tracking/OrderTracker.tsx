'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Order, OrderStatus } from '@/types';
import { Search, ArrowRight, Receipt, Flame, Bike, Home, Phone, MessageSquare } from 'lucide-react';

interface OrderTrackerProps {
  initialOrderId?: string;
}

const STAGES = [
  { status: 'confirmed', label: 'Confirmed', icon: Receipt },
  { status: 'preparing', label: 'Cooking', icon: Flame },
  { status: 'ready_for_pickup', label: 'Ready', icon: Receipt },
  { status: 'out_for_delivery', label: 'En Route', icon: Bike },
  { status: 'delivered', label: 'Delivered', icon: Home },
];

const STATUS_BADGES: Record<string, string> = {
  pending_payment: 'Awaiting Payment ⏳',
  confirmed: 'Order Confirmed ✓',
  accepted: 'Kitchen Accepted 👩🏾‍🍳',
  preparing: 'Chef Cooking 👨🏾‍🍳',
  cooking: 'Chef Cooking 👨🏾‍🍳',
  ready_for_pickup: 'Packed & Ready 🥡',
  assigned_to_rider: 'Courier Assigned 🛵',
  picked_up: 'Rider Picked Up 🛵',
  out_for_delivery: 'Rider En Route 🚀',
  dispatched: 'Rider En Route 🚀',
  delivered: 'Delivered 🎉',
  cancelled: 'Order Cancelled ✕',
  refunded: 'Refunded 💳'
};

export function OrderTracker({ initialOrderId = '' }: OrderTrackerProps) {
  const [orderId, setOrderId] = useState(initialOrderId);
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with initialOrderId prop when new order is placed
  useEffect(() => {
    if (initialOrderId) {
      setOrderId(initialOrderId);
      fetchStatus(initialOrderId);
    }
  }, [initialOrderId]);

  // Polling effect every 3 seconds until delivered
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    if (trackedOrder && trackedOrder.status !== 'delivered') {
      pollRef.current = setInterval(() => {
        pollStatus(trackedOrder.id);
      }, 3000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [trackedOrder?.status, trackedOrder?.id]);

  const pollStatus = async (id: string) => {
    try {
      const res = await fetch(`/api/orders/${id}`);
      if (res.ok) {
        const data = await res.json();
        setTrackedOrder(data);
      }
    } catch (e) {
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
        setErrorMsg('Order not found. Please check your order ID.');
        setTrackedOrder(null);
      }
    } catch (err) {
      setErrorMsg('Failed to connect to order server.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStageIndex = (status: OrderStatus) => {
    switch (status) {
      case 'pending_payment':
      case 'confirmed':
      case 'accepted':
        return 0;
      case 'preparing':
      case 'cooking':
        return 1;
      case 'ready_for_pickup':
      case 'assigned_to_rider':
        return 2;
      case 'picked_up':
      case 'out_for_delivery':
      case 'dispatched':
        return 3;
      case 'delivered':
        return 4;
      default:
        return 0;
    }
  };

  const currentIdx = trackedOrder ? getStageIndex(trackedOrder.status) : 0;

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16" id="track">
      <div className="bg-brand-cream/80 border border-brand-line rounded-3xl p-6 sm:p-10 shadow-luxury space-y-8">
        
        {/* Header with hand-drawn loop */}
        <div className="text-center space-y-2">
          <span className="text-xs uppercase font-extrabold tracking-widest text-amber-700">
            Real-Time Order Tracking
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-brand-ink">
            Live Order{' '}
            <span className="relative inline-block text-brand-gold">
              Tracker
              <svg className="absolute -inset-x-2 -inset-y-1 w-[calc(100%+16px)] h-[calc(100%+8px)] pointer-events-none" viewBox="0 0 170 50">
                <ellipse cx="85" cy="25" rx="80" ry="20" fill="none" stroke="#FFB800" strokeWidth="3" strokeDasharray="8 3" />
              </svg>
            </span>
          </h2>
          <p className="text-sm text-brand-muted">
            Enter your order reference code (e.g. <b>JFC-1042</b>) to follow your meal live.
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
              className="w-full pl-11 pr-4 py-3.5 min-h-[46px] rounded-full bg-white border border-brand-line text-sm text-brand-ink focus:border-brand-gold outline-none"
            />
          </div>
          <button
            onClick={() => fetchStatus(orderId)}
            disabled={isLoading}
            className="px-6 py-3.5 min-h-[46px] rounded-full bg-brand-gold hover:bg-brand-goldDark text-brand-ink font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
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
          <div className="bg-white rounded-3xl p-5 sm:p-8 border border-brand-line space-y-6 sm:space-y-8 animate-in fade-in duration-300">
            
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
                    ESTIMATED ARRIVAL
                  </span>
                  <span className="text-base sm:text-lg font-black text-amber-700">{trackedOrder.eta}</span>
                </div>
              </div>
            </div>

            {/* Stepper Progress */}
            <div className="relative flex items-center justify-between px-2 sm:px-4">
              {/* Progress Line */}
              <div className="absolute top-4 sm:top-5 inset-x-6 sm:inset-x-8 h-1 bg-zinc-200 -z-0">
                <div
                  className="h-full bg-brand-gold transition-all duration-500"
                  style={{ width: `${(currentIdx / 3) * 100}%` }}
                />
              </div>

              {STAGES.map((stage, idx) => {
                const Icon = stage.icon;
                const isPassed = idx <= currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                  <div key={stage.status} className="flex flex-col items-center gap-1.5 sm:gap-2 z-10">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all ${
                        isPassed
                          ? 'bg-brand-gold text-brand-ink border-2 border-brand-gold'
                          : 'bg-white text-zinc-400 border-2 border-zinc-200'
                      } ${isCurrent ? 'ring-4 ring-brand-goldLight' : ''}`}
                    >
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <span className={`text-[10px] sm:text-[11px] font-bold ${isPassed ? 'text-brand-ink' : 'text-zinc-400'}`}>
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Rider Concierge Card */}
            {currentIdx >= 2 && (
              trackedOrder.rider ? (
                <div className="bg-brand-cream/60 rounded-2xl p-4 sm:p-5 border border-brand-line flex items-center justify-between gap-3">
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

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`tel:${trackedOrder.rider.phone}`}
                      aria-label="Call dispatch courier"
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white border border-brand-line flex items-center justify-center text-brand-ink hover:bg-brand-gold transition shadow-xs active:scale-90"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                    {trackedOrder.rider.phone && (
                      <a
                        href={`https://wa.me/234${trackedOrder.rider.phone.replace(/\D/g, '').replace(/^0/, '')}?text=Hello%20regarding%20my%20order%20${trackedOrder.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="WhatsApp dispatch courier"
                        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#25D366] text-white flex items-center justify-center hover:opacity-90 transition shadow-xs active:scale-90"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-brand-cream/40 rounded-2xl p-3.5 border border-dashed border-brand-line flex items-center gap-3">
                  <Bike className="w-5 h-5 text-brand-muted shrink-0" />
                  <p className="text-xs text-brand-muted">
                    Dedicated courier will be assigned once kitchen finishes cooking and packing.
                  </p>
                </div>
              )
            )}

          </div>
        )}

      </div>
    </section>
  );
}
