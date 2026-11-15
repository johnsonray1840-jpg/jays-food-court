'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { OrderTracker } from '@/components/tracking/OrderTracker';
import { useCart } from '@/context/CartContext';
import {
  Package,
  ArrowLeft,
  ShieldCheck,
  PhoneCall,
  Clock,
  Receipt,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { formatNaira } from '@/lib/utils';

export function TrackPageClient() {
  const searchParams = useSearchParams();
  const urlOrder = searchParams.get('order') || searchParams.get('reference') || '';
  const { lastOrderId } = useCart();
  const [selectedOrderCode, setSelectedOrderCode] = useState(urlOrder || lastOrderId || '');
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Fetch recent customer authenticated orders
  useEffect(() => {
    async function loadCustomerOrders() {
      setIsLoadingHistory(true);
      try {
        const res = await fetch('/api/customer/orders');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && Array.isArray(data.orders)) {
            setCustomerOrders(data.orders);
            if (!selectedOrderCode && data.orders.length > 0) {
              setSelectedOrderCode(data.orders[0].order_code);
            }
          }
        }
      } catch {
        // Guest or unauthenticated fallback
      } finally {
        setIsLoadingHistory(false);
      }
    }
    loadCustomerOrders();
  }, [selectedOrderCode]);

  return (
    <div className="min-h-screen bg-brand-cream/20">
      {/* Sub-header Context Bar */}
      <div className="bg-white border-b border-brand-line py-3.5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-brand-ink transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Storefront</span>
          </Link>
          <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Direct Delivery &amp; OTP Verification</span>
          </div>
        </div>
      </div>

      {/* Main Order Tracker Centerpiece */}
      <main className="max-w-4xl mx-auto px-3 sm:px-6 py-6 sm:py-10 space-y-8">
        
        {/* Recent Orders Pill Bar if Customer Has Prior Orders */}
        {customerOrders.length > 0 && (
          <div className="bg-white border border-brand-line rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-brand-gold">
                Your Recent Orders
              </span>
              <span className="text-xs text-zinc-400 font-medium">{customerOrders.length} records</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-1">
              {customerOrders.map((ord) => (
                <button
                  key={ord.id}
                  type="button"
                  onClick={() => setSelectedOrderCode(ord.order_code)}
                  className={`px-3.5 py-2 rounded-xl text-left border text-xs shrink-0 transition ${
                    selectedOrderCode === ord.order_code
                      ? 'bg-brand-ink text-white border-brand-ink shadow-xs'
                      : 'bg-brand-cream/60 border-brand-line text-brand-ink hover:border-brand-gold'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono font-bold">#{ord.order_code}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      selectedOrderCode === ord.order_code ? 'bg-white/20 text-brand-gold' : 'bg-white text-zinc-600'
                    }`}>
                      {ord.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1">{formatNaira(ord.total_amount)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <OrderTracker initialOrderId={selectedOrderCode} />

        {/* Security & Customer Reassurance Footer Banner */}
        <div className="p-5 rounded-2xl bg-white border border-brand-line text-xs text-zinc-600 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="font-bold text-brand-ink">Delivery Handover Security</p>
              <p className="text-[11px] text-zinc-500">Only share your private 4-digit code once your order is physically delivered.</p>
            </div>
          </div>
          <a
            href="https://wa.me/2347087426626"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-full bg-brand-cream hover:bg-brand-gold text-brand-ink font-bold text-xs border border-brand-line flex items-center gap-1.5 transition whitespace-nowrap self-stretch sm:self-auto justify-center"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Kitchen Desk Support</span>
          </a>
        </div>
      </main>
    </div>
  );
}
