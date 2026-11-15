'use client';

import React from 'react';
import Link from 'next/link';
import { MenuItem } from '@/types';
import { DishCard } from '@/components/menu/DishCard';
import { ArrowRight, UtensilsCrossed } from 'lucide-react';

interface HomeCuratedSectionsProps {
  menuItems: MenuItem[];
}

export function HomeCuratedSections({ menuItems }: HomeCuratedSectionsProps) {
  // Extract key categories for clean, non-repetitive storefront browsing
  const popularDishes = menuItems.filter((m) => [1, 2, 4, 11].includes(m.id)).slice(0, 4);
  const soupsAndSwallows = menuItems.filter((m) => m.cat === 'Soups & Swallows').slice(0, 4);
  const riceSpecialties = menuItems.filter((m) => m.cat === 'Rice').slice(0, 4);

  return (
    <div className="space-y-16 py-12">
      {/* Category Quick Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between pb-4 border-b border-brand-line">
          <div>
            <span className="text-[10px] font-black tracking-widest uppercase text-brand-gold">
              Quick Selection
            </span>
            <h2 className="font-serif text-2xl font-black text-brand-ink">
              Popular <span className="text-amber-600">Dishes</span>
            </h2>
          </div>
          <Link
            href="/menu"
            className="text-xs font-bold text-zinc-700 hover:text-brand-gold flex items-center gap-1 group"
          >
            <span>See Full Menu</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-6 mt-6">
          {popularDishes.map((dish) => (
            <DishCard key={dish.id} dish={dish} />
          ))}
        </div>
      </section>

      {/* Soups & Swallows Highlight */}
      <section className="bg-brand-cream/40 py-12 border-y border-brand-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between pb-4 border-b border-brand-line/60">
            <div>
              <span className="text-[10px] font-black tracking-widest uppercase text-amber-700">
                Traditional Kitchen
              </span>
              <h2 className="font-serif text-2xl font-black text-brand-ink">
                Soups &amp; <span className="text-amber-600">Swallow Combos</span>
              </h2>
            </div>
            <Link
              href="/menu"
              className="text-xs font-bold text-zinc-700 hover:text-brand-gold flex items-center gap-1 group"
            >
              <span>Explore Soups</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-6 mt-6">
            {soupsAndSwallows.map((dish) => (
              <DishCard key={dish.id} dish={dish} />
            ))}
          </div>
        </div>
      </section>

      {/* Firewood Rice Specialties */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between pb-4 border-b border-brand-line">
          <div>
            <span className="text-[10px] font-black tracking-widest uppercase text-brand-gold">
              Signature Pots
            </span>
            <h2 className="font-serif text-2xl font-black text-brand-ink">
              Firewood <span className="text-amber-600">Rice Specialties</span>
            </h2>
          </div>
          <Link
            href="/menu"
            className="text-xs font-bold text-zinc-700 hover:text-brand-gold flex items-center gap-1 group"
          >
            <span>View All Rice Dishes</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-6 mt-6">
          {riceSpecialties.map((dish) => (
            <DishCard key={dish.id} dish={dish} />
          ))}
        </div>
      </section>

      {/* Chowdeck-Style Editorial Reassurance Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="rounded-3xl bg-brand-ink p-8 sm:p-12 text-white flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl text-center md:text-left">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-gold px-3 py-1 rounded-full bg-white/10">
              Kitchen Quality Guarantee
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl font-black text-white">
              Authentic Ingredients, Clean Thermal Packaging
            </h3>
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
              Every dish is packaged in heat-sealed thermal bowls with tamper-evident seals and delivered directly by verified Jay&apos;s Food Court couriers.
            </p>
          </div>

          <Link
            href="/menu"
            className="shrink-0 px-8 py-3.5 rounded-full bg-brand-gold hover:bg-brand-goldDark text-brand-ink font-bold text-sm shadow-md transition active:scale-95"
          >
            Order Now
          </Link>
        </div>
      </section>
    </div>
  );
}
