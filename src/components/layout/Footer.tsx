import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Phone, ShieldCheck, Flame, ArrowUpRight, Clock } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-20 bg-brand-ink text-white border-t border-zinc-800 pb-24 lg:pb-0" id="contact">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        
        {/* 1. Brand Information */}
        <div className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="relative h-14 w-32 bg-white/5 backdrop-blur-sm p-1.5 rounded-xl border border-white/10 hover:border-brand-gold/50 transition">
              <Image
                src="/images/logo.png"
                alt="Jay's Food Court LTD Logo"
                fill
                className="object-contain p-1"
              />
            </div>
          </Link>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
            Ultra-premium dining and fast concierge food delivery across Agbani and Enugu State. Cooked with authentic local culinary pride.
          </p>
          <div className="space-y-2 pt-2 text-xs text-zinc-300 font-medium">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-gold shrink-0" /> Verified Food Safety &amp; Clean Kitchen
            </div>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-brand-gold shrink-0" /> Heat-Sealed Thermal Packaging
            </div>
          </div>
        </div>

        {/* 2. Quick Links */}
        <div className="space-y-3">
          <h4 className="text-brand-gold font-bold text-sm tracking-wider uppercase">Quick Links</h4>
          <ul className="space-y-2.5 text-sm text-zinc-300">
            <li>
              <Link href="/menu" className="hover:text-brand-gold transition inline-flex items-center gap-1">
                Full Menu <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
              </Link>
            </li>
            <li>
              <Link href="/#specials" className="hover:text-brand-gold transition inline-flex items-center gap-1">
                Chef&apos;s Specials <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
              </Link>
            </li>
            <li>
              <Link href="/track" className="hover:text-brand-gold transition inline-flex items-center gap-1">
                Track Your Order <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
              </Link>
            </li>
            <li>
              <Link href="/orders" className="hover:text-brand-gold transition inline-flex items-center gap-1">
                Order History <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
              </Link>
            </li>
            <li>
              <Link href="/profile" className="hover:text-brand-gold transition inline-flex items-center gap-1">
                Customer Account <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
              </Link>
            </li>
            <li>
              <Link href="/#about" className="hover:text-brand-gold transition inline-flex items-center gap-1">
                About Jay&apos;s <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
              </Link>
            </li>
          </ul>
        </div>

        {/* 3. Legal & Policies */}
        <div className="space-y-3">
          <h4 className="text-brand-gold font-bold text-sm tracking-wider uppercase">Legal &amp; Policies</h4>
          <ul className="space-y-2.5 text-sm text-zinc-300">
            <li>
              <Link href="/privacy" className="hover:text-brand-gold transition inline-flex items-center gap-1">
                Privacy Policy <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-brand-gold transition inline-flex items-center gap-1">
                Terms of Use <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
              </Link>
            </li>
            <li>
              <Link href="/terms#refunds" className="hover:text-brand-gold transition inline-flex items-center gap-1">
                Refund &amp; Cancellation Policy <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
              </Link>
            </li>
            <li>
              <Link href="/privacy#cookies" className="hover:text-brand-gold transition inline-flex items-center gap-1">
                Cookie &amp; Session Policy <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
              </Link>
            </li>
            <li>
              <Link href="/#delivery-zones" className="hover:text-brand-gold transition inline-flex items-center gap-1">
                Delivery Zones &amp; Fees <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
              </Link>
            </li>
          </ul>
        </div>

        {/* 4. Kitchen Location & Direct Contact */}
        <div className="space-y-3">
          <h4 className="text-brand-gold font-bold text-sm tracking-wider uppercase">Kitchen Location</h4>
          <p className="text-sm text-zinc-300 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
            <span>Ndiagu Ugwu, Umuezeakwunanaw, Agbani, Enugu State</span>
          </p>
          <p className="text-sm text-zinc-300 flex items-center gap-2">
            <Phone className="w-4 h-4 text-brand-gold shrink-0" />
            <a href="tel:+2347087426626" className="hover:text-brand-gold transition">
              07087426626
            </a>
          </p>
          <p className="text-sm text-zinc-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-gold shrink-0" />
            <span>08:00 AM &ndash; 10:00 PM Daily</span>
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

      <div className="border-t border-zinc-800/80 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
          <p>&copy; {new Date().getFullYear()} Jay&apos;s Food Court LTD. All rights reserved.</p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/privacy" className="hover:text-brand-gold transition">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-brand-gold transition">
              Terms of Use
            </Link>
            <Link href="/menu" className="hover:text-brand-gold transition">
              Full Menu
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
