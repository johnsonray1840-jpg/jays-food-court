import React from 'react';
import Image from 'next/image';
import { MapPin, ArrowRight } from 'lucide-react';

interface PromoBannerProps {
  onClaimClick: () => void;
}

export function PromoBanner({ onClaimClick }: PromoBannerProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" id="rewards">
      <div className="relative rounded-3xl bg-brand-ink overflow-hidden shadow-luxury grid grid-cols-1 md:grid-cols-12 items-center border border-zinc-800">
        
        {/* Subtle warm glow background accent */}
        <div className="absolute top-0 right-1/3 w-80 h-80 bg-brand-gold/10 rounded-full blur-3xl pointer-events-none" />

        {/* Left Copy */}
        <div className="p-6 sm:p-10 md:p-12 md:col-span-7 space-y-5 text-white z-10">
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-brand-gold/15 border border-brand-gold/30 text-[11px] font-black tracking-widest uppercase text-brand-gold">
            Executive Kitchen &amp; Direct Delivery
          </span>

          <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight text-white tracking-tight">
            Direct Kitchen Delivery Across{' '}
            <span className="text-brand-gold underline decoration-brand-gold/40 decoration-2 underline-offset-4">
              Enugu State
            </span>
          </h2>

          <p className="text-xs sm:text-sm md:text-base text-zinc-300 leading-relaxed max-w-lg font-normal">
            Freshly prepared traditional soups, firewood party jollof, tender yam &amp; egg, and chilled refreshments delivered swiftly and safely across Agbani, Independence Layout, GRA, New Haven, and greater Enugu.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-4">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-zinc-300">
              <MapPin className="w-4 h-4 text-brand-gold shrink-0" />
              <span>Main Kitchen: Ndiagu Ugwu, Agbani, Enugu</span>
            </span>

            <button
              onClick={onClaimClick}
              className="inline-flex items-center justify-center gap-2 px-7 py-3 min-h-[46px] rounded-full bg-brand-gold hover:bg-brand-goldDark text-brand-ink font-bold text-xs sm:text-sm transition-all shadow-md active:scale-95 w-full sm:w-auto cursor-pointer"
            >
              <span>Order Fresh Meals</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Chef Photo Wrapper with authentic high-quality photograph */}
        <div className="md:col-span-5 relative h-72 sm:h-80 md:h-full min-h-[280px] sm:min-h-[340px] w-full bg-zinc-900 overflow-hidden">
          <Image
            src="/images/chef_banner.jpg"
            alt="Executive Chef preparing artisanal meals at Jay's Food Court in a luxury commercial kitchen"
            fill
            sizes="(max-width: 768px) 100vw, 42vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-brand-ink via-transparent to-transparent opacity-60 md:opacity-40" />
        </div>

      </div>
    </section>
  );
}
