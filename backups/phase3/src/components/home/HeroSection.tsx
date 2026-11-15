'use client';

import React from 'react';
import Image from 'next/image';
import { ArrowRight, Clock, Star, Flame } from 'lucide-react';
import { motion } from 'framer-motion';

interface HeroSectionProps {
  onOrderClick: () => void;
  onFeaturedDishClick: () => void;
}

export function HeroSection({ onOrderClick, onFeaturedDishClick }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(ellipse_at_85%_15%,#FFF4D1_0%,transparent_60%)] bg-brand-cream/40 pt-8 pb-16 sm:py-16 md:py-24 border-b border-brand-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* Left Column: Headlines & CTAs */}
        <div className="space-y-6 text-center lg:text-left">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-brand-line text-xs font-bold text-amber-800 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" />
            <span>Now Delivering Hot in Agbani, Enugu</span>
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-brand-ink leading-[1.12]">
            Artisanal Dining and Enjoy{' '}
            <span className="relative inline-block text-brand-gold whitespace-nowrap">
              The Food
              <svg className="absolute -inset-x-3 -inset-y-2 w-[calc(100%+24px)] h-[calc(100%+16px)] pointer-events-none" viewBox="0 0 200 60">
                <ellipse
                  cx="100"
                  cy="30"
                  rx="95"
                  ry="25"
                  fill="none"
                  stroke="#FFB800"
                  strokeWidth="3.5"
                  strokeDasharray="10 3"
                  transform="rotate(-3 100 30)"
                />
              </svg>
            </span>
          </h1>

          <p className="text-brand-muted text-base sm:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Authentic Ogbono, Egusi, Draw Soup, Fried Rice, Yam &amp; Egg cooked fresh with high-end ingredients and delivered swiftly to your doorstep.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 pt-2 max-w-md mx-auto lg:mx-0">
            <button
              onClick={onOrderClick}
              className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 min-h-[48px] rounded-full bg-brand-gold text-brand-ink font-bold text-sm shadow-goldGlow hover:bg-brand-goldDark transition transform active:scale-95"
            >
              <span>Order Online</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="#track"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 min-h-[48px] rounded-full bg-white border border-brand-ink text-brand-ink font-bold text-sm hover:bg-brand-ink hover:text-brand-gold transition active:scale-95"
            >
              <span>Track Order</span>
            </a>
          </div>

          <div className="flex items-center justify-center lg:justify-start gap-2 text-xs sm:text-sm text-brand-muted pt-3">
            <Clock className="w-4 h-4 text-brand-gold shrink-0" />
            <span>Kitchen Hours: <strong className="text-brand-ink">08:00 AM – 10:00 PM Daily</strong></span>
          </div>

        </div>

        {/* Right Column: Dribbble Circular Orbit Platter */}
        <div className="flex justify-center items-center relative w-full overflow-visible py-4">
          <div className="relative w-[min(84vw,320px)] h-[min(84vw,320px)] sm:w-[400px] sm:h-[400px] md:w-[460px] md:h-[460px]">
            
            {/* Rotating Orbit SVG */}
            <svg className="absolute inset-0 w-full h-full animate-spin-slow pointer-events-none" viewBox="0 0 460 460">
              <circle
                cx="230"
                cy="230"
                r="215"
                fill="none"
                stroke="#FFB800"
                strokeWidth="4"
                strokeDasharray="18 12"
              />
            </svg>

            {/* Circular Banquet Platter */}
            <div className="absolute inset-[7%] rounded-full overflow-hidden border-4 sm:border-8 border-white shadow-2xl">
              <Image
                src="/images/hero.jpg"
                alt="Jay's Food Court Signature Banquet"
                fill
                priority
                sizes="(max-width: 640px) 280px, (max-width: 1024px) 400px, 460px"
                className="object-cover"
              />
            </div>

            {/* Floating Badge: Best Food */}
            <div className="absolute top-1 sm:top-4 right-0 sm:right-2 bg-white/95 backdrop-blur px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl shadow-luxury flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-brand-ink border border-brand-line">
              <span>Best Food</span>
              <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-gold fill-brand-gold" />
            </div>

            {/* Floating Dish Card (Royal Egusi) */}
            <motion.div
              whileHover={{ y: -4 }}
              onClick={onFeaturedDishClick}
              className="absolute -bottom-2 sm:bottom-4 -left-1 sm:left-2 bg-white/95 backdrop-blur p-2 sm:p-3 rounded-2xl shadow-luxury flex items-center gap-2.5 sm:gap-3 border border-brand-line cursor-pointer active:scale-95 transition"
            >
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl overflow-hidden shrink-0 bg-brand-cream">
                <Image
                  src="/images/egusi.jpg"
                  alt="Royal Egusi Soup"
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <div className="text-left pr-1 sm:pr-2">
                <h4 className="font-bold text-[11px] sm:text-sm text-brand-ink">Royal Egusi Soup</h4>
                <span className="text-[10px] text-amber-700 font-bold block">Chef Specialty</span>
                <span className="font-extrabold text-[11px] sm:text-xs text-brand-ink">₦3,500</span>
              </div>
            </motion.div>

          </div>
        </div>

      </div>
    </section>
  );
}
