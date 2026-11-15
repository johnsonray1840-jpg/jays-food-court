'use client';

import React from 'react';
import Link from 'next/link';
import { MenuItem } from '@/types';
import { DishCard } from '@/components/menu/DishCard';
import {
  ArrowRight,
  MapPin,
  Clock,
  ShieldCheck,
  Flame,
  Search,
  CheckCircle2,
  PhoneCall,
  ShoppingBag,
  Bike
} from 'lucide-react';
import { ENUGU_DELIVERY_ZONES } from '@/lib/delivery-zones';

interface HomeCuratedSectionsProps {
  menuItems: MenuItem[];
}

export function HomeCuratedSections({ menuItems }: HomeCuratedSectionsProps) {
  // Curated selections strictly from authoritative database records
  const popularDishes = menuItems.filter((m) => [1, 2, 4, 11].includes(m.id)).slice(0, 4);
  const chefsRecommendations = menuItems.filter((m) => [3, 5, 6, 12].includes(m.id)).slice(0, 4);
  const compactPreview = menuItems.slice(0, 8);

  const activeZones = ENUGU_DELIVERY_ZONES.filter((z) => z.isAvailable);

  const howItWorksSteps = [
    {
      num: '01',
      icon: Search,
      title: 'Choose Your Meal',
      desc: 'Browse fresh traditional soups, firewood jollof, or sides. Customize your protein and swallow choices.'
    },
    {
      num: '02',
      icon: ShoppingBag,
      title: 'Quick Checkout',
      desc: 'Confirm your delivery zone in Agbani or Enugu and complete your payment securely via Paystack.'
    },
    {
      num: '03',
      icon: Bike,
      title: 'Track & Verify',
      desc: 'Follow honest kitchen preparation and rider movement, then verify physical delivery with your private 4-digit code.'
    }
  ];

  return (
    <div className="space-y-16 sm:space-y-24 py-12">
      {/* 1. Carefully Selected Popular Dishes */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-brand-line">
          <div>
            <span className="text-[10px] font-black tracking-widest uppercase text-brand-gold">
              Customer Favorites
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-black text-brand-ink">
              Popular <span className="text-amber-600">Dishes</span>
            </h2>
            <p className="text-xs text-zinc-500 mt-1">Our most requested meals freshly prepared every day.</p>
          </div>
          <Link
            href="/menu"
            className="text-xs font-bold text-zinc-700 hover:text-brand-gold flex items-center gap-1 group self-start sm:self-auto"
          >
            <span>View Complete Menu</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-6 mt-6">
          {popularDishes.map((dish) => (
            <DishCard key={dish.id} dish={dish} />
          ))}
        </div>
      </section>

      {/* 2. Chef's Recommendations Banner & Spotlight */}
      <section className="bg-brand-cream/40 py-12 sm:py-16 border-y border-brand-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-brand-line/60">
            <div>
              <span className="text-[10px] font-black tracking-widest uppercase text-amber-700">
                Signature Kitchen Pots
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl font-black text-brand-ink">
                Chef&apos;s <span className="text-amber-600">Recommendations</span>
              </h2>
              <p className="text-xs text-zinc-500 mt-1">Authentic Nigerian recipes cooked with slow-simmered local herbs and meats.</p>
            </div>
            <Link
              href="/menu"
              className="text-xs font-bold text-zinc-700 hover:text-brand-gold flex items-center gap-1 group self-start sm:self-auto"
            >
              <span>Explore All Specialties</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-6 mt-6">
            {chefsRecommendations.map((dish) => (
              <DishCard key={dish.id} dish={dish} />
            ))}
          </div>
        </div>
      </section>

      {/* 3. Compact Menu Preview with Direct 'View Full Menu' Action */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto mb-8 space-y-1">
          <span className="text-[10px] font-black tracking-widest uppercase text-brand-gold">
            Kitchen Catalog
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-black text-brand-ink">
            Explore <span className="text-amber-600">Our Offerings</span>
          </h2>
          <p className="text-xs text-zinc-500">
            From hot soups to cold drinks, every item is prepared on demand.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {compactPreview.map((dish) => (
            <DishCard key={dish.id} dish={dish} layout="horizontal" />
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-brand-ink hover:bg-zinc-800 text-white font-bold text-xs sm:text-sm shadow-sm transition active:scale-95"
          >
            <span>View Full Menu ({menuItems.length} Dishes &amp; Drinks)</span>
            <ArrowRight className="w-4 h-4 text-brand-gold" />
          </Link>
        </div>
      </section>

      {/* 4. Delivery Coverage & Service Information */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-white border border-brand-line p-6 sm:p-10 shadow-xs">
          <div className="max-w-2xl mb-8 space-y-2">
            <span className="text-[10px] font-black tracking-widest uppercase text-brand-gold">
              Service Area &amp; Transit Times
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-black text-brand-ink">
              Delivery Coverage Across <span className="text-amber-600">Agbani &amp; Enugu</span>
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
              We operate an active courier dispatch pool from our kitchen hub at Ndiagu Ugwu, delivering to local university campuses and greater Enugu zones.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeZones.slice(0, 6).map((zone) => (
              <div
                key={zone.id}
                className="p-4 rounded-2xl bg-brand-cream/60 border border-brand-line/80 flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-xl bg-white border border-brand-line flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-brand-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs sm:text-sm text-brand-ink truncate">{zone.name}</h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Est. {zone.estimatedTime}</p>
                  <p className="text-[10px] font-bold text-amber-800 mt-1">Delivery: ₦{zone.deliveryFee.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-brand-line/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-gold shrink-0" />
              <span>Orders dispatched continuously between <strong>08:00 AM &ndash; 10:00 PM</strong> daily.</span>
            </div>
            <span className="text-[11px] font-semibold text-brand-ink">
              Main Hub: Ndiagu Ugwu, Umuezeakwunanaw, Agbani
            </span>
          </div>
        </div>
      </section>

      {/* 5. How Ordering Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-xl mx-auto mb-10 space-y-1">
          <span className="text-[10px] font-black tracking-widest uppercase text-brand-gold">
            Transparent Workflow
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl font-black text-brand-ink">
            How Ordering <span className="text-amber-600">Works</span>
          </h2>
          <p className="text-xs text-zinc-500">
            Three simple steps from kitchen pot to your doorstep.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {howItWorksSteps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="relative bg-white rounded-3xl p-6 sm:p-8 border border-brand-line space-y-4 hover:border-brand-gold transition shadow-xs"
              >
                <span className="absolute top-5 right-6 font-serif text-4xl font-black text-brand-gold/25">
                  {step.num}
                </span>
                <div className="w-12 h-12 rounded-2xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-ink shadow-xs">
                  <Icon className="w-5 h-5 text-amber-800" />
                </div>
                <h3 className="font-bold text-base text-brand-ink">{step.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Clear 'Track Your Order' Call to Action */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-brand-ink p-8 sm:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8 border border-zinc-800">
          <div className="space-y-3 max-w-xl text-center md:text-left">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-gold px-3 py-1 rounded-full bg-white/10">
              Already Placed An Order?
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl font-black text-white">
              Track Real-Time Cooking &amp; Courier Dispatch
            </h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Enter your order reference code or access your session to monitor kitchen progress, chat privately with your assigned rider, or verify delivery.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <Link
              href="/track"
              className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-brand-gold hover:bg-brand-goldDark text-brand-ink font-bold text-xs sm:text-sm text-center shadow-md transition active:scale-95"
            >
              Track Active Order
            </Link>
            <Link
              href="/menu"
              className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-xs sm:text-sm text-center transition"
            >
              Browse Menu
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
