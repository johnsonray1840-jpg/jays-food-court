'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Clock, Flame, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { MenuItem } from '@/types';

interface HeroEditorialProps {
  featuredDish?: MenuItem;
}

export function HeroEditorial({ featuredDish }: HeroEditorialProps) {
  const { setActiveModalDish } = useCart();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const video = videoRef.current;

    if (video && !reducedMotionQuery.matches) {
      // Ensure muted property is synchronized for reliable browser autoplay after SSR
      video.muted = true;
      if (video.paused) {
        video.play().catch(() => setIsPlaying(false));
      }
    }

    const syncReducedMotion = (prefersReducedMotion: boolean) => {
      const currentVideo = videoRef.current;
      if (!currentVideo) return;
      if (prefersReducedMotion) {
        currentVideo.removeAttribute('autoplay');
        currentVideo.pause();
        setIsPlaying(false);
      }
    };

    syncReducedMotion(reducedMotionQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      syncReducedMotion(event.matches);
    };

    reducedMotionQuery.addEventListener('change', handleChange);
    return () => {
      reducedMotionQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (video) {
      video.muted = nextMuted;
    }
  };

  return (
    <section className="relative overflow-hidden bg-brand-ink border-b border-brand-line">
      {/* Full-Bleed Background Cinema Video Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <video
          ref={videoRef}
          src="/videos/hero-bg.mp4"
          poster="/images/hero.jpg"
          width={576}
          height={1024}
          autoPlay
          loop
          muted={isMuted}
          playsInline
          preload="auto"
          aria-hidden="true"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="w-full h-full object-cover object-center scale-105 brightness-[0.55] contrast-[1.08] saturate-[1.12] transition-transform duration-1000"
        />
        {/* Luxury Directional Obsidian Scrims */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#17140D]/85 via-[#17140D]/70 to-[#17140D]/90 lg:bg-gradient-to-r lg:from-[#17140D]/[0.92] lg:via-[#17140D]/75 lg:to-[#17140D]/45" />
        {/* Warm Gold Ambient Aura */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_40%,rgba(255,184,0,0.16),transparent_60%)]" />
      </div>

      {/* Editorial Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Brand Copy & Direct Ordering CTAs */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-brand-cream">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Kitchen Open &bull; Delivering Across Agbani &amp; Enugu</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-black text-white drop-shadow-sm tracking-tight leading-[1.12]">
              Artisanal Nigerian Cuisine,{' '}
              <span className="text-brand-gold">Delivered Fresh.</span>
            </h1>

            <p className="text-zinc-200 text-sm sm:text-base lg:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
              Freshly cooked firewood party jollof, authentic pounded yam with rich Egusi, Ogbono, and slow-braised meats prepared from scratch at our Agbani culinary hub.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3.5 pt-2 max-w-md mx-auto lg:mx-0">
              <Link
                href="/menu"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 min-h-[48px] rounded-full bg-brand-gold hover:bg-brand-goldDark text-brand-ink font-bold text-sm shadow-goldGlow hover:shadow transition active:scale-95"
              >
                <span>Browse Full Menu</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/track"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 min-h-[48px] rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/25 hover:border-brand-gold text-white font-bold text-sm transition active:scale-95"
              >
                <span>Track Active Order</span>
              </Link>
            </div>

            {/* Value Indicators & Ambient Video Controls */}
            <div className="pt-5 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-zinc-300 border-t border-white/15">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-brand-gold" />
                <span>Operating 08:00 AM &ndash; 10:00 PM Daily</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-brand-gold" />
                <span>Cooked Fresh on Order</span>
              </div>

              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 lg:ml-auto">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause background video' : 'Play background video'}
                  className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-full text-brand-cream hover:text-brand-gold hover:bg-white/10 transition focus-visible:outline-2 focus-visible:outline-brand-gold"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <span className="w-px h-3.5 bg-white/20" aria-hidden="true" />
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Unmute background video audio' : 'Mute background video audio'}
                  className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-full text-brand-cream hover:text-brand-gold hover:bg-white/10 transition focus-visible:outline-2 focus-visible:outline-brand-gold"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Banquet Display */}
          <div className="lg:col-span-5 relative flex justify-center">
            <div className="relative w-full max-w-[420px] aspect-square rounded-3xl overflow-hidden border-2 border-white/25 ring-1 ring-brand-gold/40 shadow-2xl bg-brand-ink/60 backdrop-blur-sm">
              <Image
                src="/images/hero.jpg"
                alt="Jay's Food Court Signature Banquet"
                fill
                priority
                sizes="(max-width: 768px) 100vw, 420px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              
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
