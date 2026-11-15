'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Sparkles, Clock, Flame, ShieldCheck } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { MenuItem } from '@/types';

interface HeroEditorialProps {
  featuredDish?: MenuItem;
}

export function HeroEditorial({ featuredDish }: HeroEditorialProps) {
  const { setActiveModalDish } = useCart();

  return (
    <section className="relative overflow-hidden bg-white border-b border-brand-line">
      {/* Editorial Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Brand Copy & Direct Ordering CTAs */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-cream border border-brand-line text-xs font-bold text-brand-ink">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Kitchen Open &bull; Delivering Across Agbani &amp; Enugu</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-black text-brand-ink tracking-tight leading-[1.12]">
              Artisanal Nigerian Cuisine,{' '}
              <span className="text-amber-600">Delivered Fresh.</span>
            </h1>

            <p className="text-zinc-600 text-sm sm:text-base lg:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
              Freshly cooked firewood party jollof, authentic pounded yam with rich Egusi, Ogbono, and slow-braised meats prepared from scratch at our Agbani culinary hub.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3.5 pt-2 max-w-md mx-auto lg:mx-0">
              <Link
                href="/menu"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 min-h-[48px] rounded-full bg-brand-gold hover:bg-brand-goldDark text-brand-ink font-bold text-sm shadow-sm hover:shadow transition active:scale-95"
              >
                <span>Browse Full Menu</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/track"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 min-h-[48px] rounded-full bg-brand-cream border border-brand-line hover:border-brand-gold text-brand-ink font-bold text-sm transition active:scale-95"
              >
                <span>Track Active Order</span>
              </Link>
            </div>

            {/* Value Indicators */}
            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-zinc-500 border-t border-brand-line/60">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-brand-gold" />
                <span>Operating 08:00 AM &ndash; 10:00 PM Daily</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-brand-gold" />
                <span>Cooked Fresh on Order</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Banquet Display */}
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="relative w-full max-w-[420px] aspect-square rounded-3xl overflow-hidden border-4 border-white shadow-xl bg-brand-cream">
              <Image
                src="/images/hero.jpg"
                alt="Jay's Food Court Signature Banquet"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 420px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              
              {/* Floating Featured Badge */}
              {featuredDish && (
                <button
                  type="button"
                  onClick={() => setActiveModalDish(featuredDish)}
                  className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-brand-line flex items-center justify-between text-left hover:border-brand-gold transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-brand-cream shrink-0">
                      <Image
                        src={`/images/${featuredDish.img}.jpg`}
                        alt={featuredDish.name}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Chef&apos;s Recommendation</p>
                      <p className="text-xs sm:text-sm font-bold text-brand-ink truncate">{featuredDish.name}</p>
                    </div>
                  </div>
                  <span className="shrink-0 px-3 py-1.5 rounded-full bg-brand-gold text-brand-ink font-bold text-xs">
                    Order
                  </span>
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
