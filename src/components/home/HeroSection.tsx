import React from 'react';
import Image from 'next/image';
import { ArrowRight, Clock, Flame } from 'lucide-react';

interface HeroSectionProps {
  onOrderClick: () => void;
  onFeaturedDishClick: () => void;
}

export function HeroSection({ onOrderClick, onFeaturedDishClick }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-brand-cream/30 pt-10 pb-16 sm:py-20 md:py-24 border-b border-brand-line/80">
      {/* Subtle ambient lighting */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-brand-gold/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-80 h-80 bg-amber-100/40 rounded-full blur-2xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center relative z-10">
        
        {/* Left Column: Headlines & CTAs */}
        <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
          
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white border border-brand-line text-xs font-bold text-brand-ink shadow-xs">
            <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" />
            <span>Kitchen Open &amp; Delivering Across Enugu State</span>
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-brand-ink leading-[1.12]">
            Artisanal Nigerian Dining,{' '}
            <span className="text-amber-600">Delivered Hot.</span>
          </h1>

          <p className="text-zinc-600 text-base sm:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
            Signature Ogbono, Royal Egusi, firewood-cooked Party Jollof, and tender Yam &amp; Egg cooked freshly from scratch with premium local ingredients.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3.5 pt-2 max-w-md mx-auto lg:mx-0">
            <button
              onClick={onOrderClick}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 min-h-[48px] rounded-full bg-brand-gold hover:bg-brand-goldDark text-brand-ink font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              <span>Explore Menu &amp; Order</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="#track"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 min-h-[48px] rounded-full bg-white border border-brand-line hover:border-brand-ink text-brand-ink font-bold text-sm shadow-xs hover:bg-brand-cream transition-all active:scale-95"
            >
              <span>Track Live Delivery</span>
            </a>
          </div>

          <div className="flex items-center justify-center lg:justify-start gap-2 text-xs sm:text-sm text-zinc-500 pt-2">
            <Clock className="w-4 h-4 text-brand-gold shrink-0" />
            <span>Kitchen Operating Hours: <strong className="text-brand-ink font-semibold">08:00 AM – 10:00 PM Daily</strong></span>
          </div>

        </div>

        {/* Right Column: Hero Culinary Composition */}
        <div className="lg:col-span-5 flex justify-center items-center relative py-4">
          <div className="relative w-[min(88vw,360px)] h-[min(88vw,360px)] sm:w-[420px] sm:h-[420px]">
            
            {/* Elegant Outer Ring Accent */}
            <div className="absolute -inset-3 sm:-inset-4 rounded-full border border-amber-200/60 pointer-events-none" />

            {/* Circular Banquet Platter */}
            <div className="absolute inset-0 rounded-full overflow-hidden border-4 sm:border-8 border-white shadow-2xl bg-white">
              <Image
                src="/images/hero.jpg"
                alt="Jay's Food Court Signature Banquet"
                fill
                priority
                fetchPriority="high"
                decoding="sync"
                sizes="(max-width: 640px) 320px, 420px"
                className="object-cover"
              />
            </div>

            {/* Floating Badge: Freshly Prepared */}
            <div className="absolute top-3 right-0 sm:-right-2 bg-white/95 backdrop-blur px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-2xl shadow-luxury flex items-center gap-2 text-xs font-bold text-brand-ink border border-brand-line">
              <Flame className="w-4 h-4 text-brand-gold fill-brand-gold" />
              <span>Cooked Fresh to Order</span>
            </div>

            {/* Floating Dish Card (Royal Egusi) */}
            <button
              type="button"
              onClick={onFeaturedDishClick}
              className="absolute -bottom-2 sm:bottom-4 left-0 sm:-left-4 bg-white/95 backdrop-blur p-2.5 sm:p-3 rounded-2xl shadow-luxury flex items-center gap-3 border border-brand-line cursor-pointer hover:border-brand-gold hover:-translate-y-1 active:scale-95 transition-all text-left"
            >
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-brand-cream border border-brand-line">
                <Image
                  src="/images/egusi.jpg"
                  alt="Royal Egusi Soup"
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <div className="pr-2">
                <h4 className="font-bold text-xs sm:text-sm text-brand-ink">Royal Egusi Soup</h4>
                <span className="text-[11px] text-amber-700 font-bold block">Chef Specialty</span>
                <span className="font-extrabold text-xs sm:text-sm text-brand-ink">₦3,500</span>
              </div>
            </button>

          </div>
        </div>

      </div>
    </section>
  );
}
