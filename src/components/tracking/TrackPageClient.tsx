'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { OrderTracker } from '@/components/tracking/OrderTracker';
import { useCart } from '@/context/CartContext';
import { Package, ArrowLeft, ShieldCheck, PhoneCall } from 'lucide-react';
import Link from 'next/link';

export function TrackPageClient() {
  const searchParams = useSearchParams();
  const urlOrder = searchParams.get('order') || searchParams.get('reference') || '';
  const { lastOrderId } = useCart();
  const effectiveOrderId = urlOrder || lastOrderId || '';

  return (
    <div className="min-h-screen bg-brand-cream/20">
      {/* Sub-header Context Bar */}
      <div className="bg-white border-b border-brand-line py-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-brand-ink transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Storefront</span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Direct Kitchen Handover Verification</span>
          </div>
        </div>
      </div>

      {/* Main Order Tracker Centerpiece */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-8 space-y-1">
          <span className="text-[10px] font-black tracking-widest uppercase text-brand-gold">
            Live Order Intelligence
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl font-black text-brand-ink">
            Delivery <span className="text-amber-600">Mission Tracker</span>
          </h1>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Track preparation stages, courier movement, and direct delivery verification without external paid maps.
          </p>
        </div>

        <OrderTracker initialOrderId={effectiveOrderId} />

        {/* Security & Customer Reassurance Footer Banner */}
        <div className="mt-12 p-5 rounded-2xl bg-white border border-brand-line text-xs text-zinc-600 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="font-bold text-brand-ink">Face-to-Face Delivery Security</p>
              <p className="text-[11px] text-zinc-500">Only share your 4-digit code once your order is physically handed to you.</p>
            </div>
          </div>
          <a
            href="https://wa.me/2347087426626"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-full bg-brand-cream hover:bg-brand-gold text-brand-ink font-bold text-xs border border-brand-line flex items-center gap-1.5 transition whitespace-nowrap"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Kitchen Desk Support</span>
          </a>
        </div>
      </main>
    </div>
  );
}
