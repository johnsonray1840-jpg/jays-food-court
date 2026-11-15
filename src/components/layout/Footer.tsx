import React from 'react';
import Link from 'next/link';
import { Utensils, MapPin, Phone, ShieldCheck, Flame, ArrowUpRight } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-20 bg-brand-ink text-white border-t border-zinc-800 pb-24 lg:pb-0" id="contact">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 md:grid-cols-3 gap-10">
        
        {/* Brand Information */}
        <div className="space-y-4">
          <a href="#top" className="flex items-center gap-2.5 font-serif font-bold text-2xl text-white">
            <span className="w-9 h-9 rounded-xl bg-brand-gold flex items-center justify-center text-brand-ink">
              <Utensils className="w-5 h-5" />
            </span>
            <span>
              Jay&apos;s <span className="text-brand-gold">FoodCourt</span>
            </span>
          </a>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
            Ultra-premium dining and fast concierge food delivery across Agbani and Enugu State. Cooked with authentic local culinary pride.
          </p>
          <div className="space-y-2 pt-2 text-xs text-zinc-300 font-medium">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-gold" /> Verified Food Safety &amp; Clean Kitchen
            </div>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-brand-gold" /> Heat-Sealed Thermal Packaging
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="space-y-3">
          <h4 className="text-brand-gold font-bold text-sm tracking-wider uppercase">Quick Links</h4>
          <ul className="space-y-2 text-sm text-zinc-300">
            <li><a href="#menu" className="hover:text-brand-gold transition flex items-center gap-1">Full Menu <ArrowUpRight className="w-3.5 h-3.5 opacity-60" /></a></li>
            <li><a href="#popular" className="hover:text-brand-gold transition flex items-center gap-1">Chef&apos;s Specials <ArrowUpRight className="w-3.5 h-3.5 opacity-60" /></a></li>
            <li><a href="#track" className="hover:text-brand-gold transition flex items-center gap-1">Track Your Order <ArrowUpRight className="w-3.5 h-3.5 opacity-60" /></a></li>
            <li><a href="#about" className="hover:text-brand-gold transition flex items-center gap-1">About Jay&apos;s <ArrowUpRight className="w-3.5 h-3.5 opacity-60" /></a></li>
          </ul>
        </div>

        {/* Kitchen Location & Direct Contact */}
        <div className="space-y-3">
          <h4 className="text-brand-gold font-bold text-sm tracking-wider uppercase">Kitchen Location</h4>
          <p className="text-sm text-zinc-300 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
            <span>Ndiagu Ugwu, Umuezeakwunanaw, Agbani, Enugu State</span>
          </p>
          <p className="text-sm text-zinc-300 flex items-center gap-2">
            <Phone className="w-4 h-4 text-brand-gold shrink-0" />
            <span>07087426626</span>
          </p>
          <div className="pt-2">
            <a
              href="https://wa.me/2347087426626"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#25D366] text-white text-xs font-bold shadow hover:opacity-95 transition"
            >
              Order via WhatsApp
            </a>
          </div>
        </div>

      </div>

      <div className="border-t border-zinc-800/80 py-6 text-center text-xs text-zinc-500">
        &copy; {new Date().getFullYear()} Jay&apos;s Food Court LTD. All rights reserved.
      </div>
    </footer>
  );
}
