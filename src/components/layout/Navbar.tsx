'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingBag, MapPin, ChevronDown, User } from 'lucide-react';

interface NavbarProps {
  cartCount: number;
  onOpenCart: () => void;
  selectedLocation?: string | null;
  locationText?: string | null;
  onLocationClick?: () => void;
  showProfile?: boolean;
}

export function Navbar({
  cartCount,
  onOpenCart,
  selectedLocation,
  locationText,
  onLocationClick,
  showProfile = true
}: NavbarProps) {
  const displayLocation = locationText || selectedLocation || 'Agbani (Select Zone)';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-brand-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">

        {/* Brand Logo & Name */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-11 h-11 rounded-full bg-brand-gold flex items-center justify-center font-serif font-black text-xl text-brand-ink shadow-sm group-hover:scale-105 transition">
            J
          </div>
          <div className="flex flex-col">
            <span className="font-serif font-black text-xl text-brand-ink tracking-tight leading-none">
              Jay&apos;s Food Court
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-brand-gold mt-0.5">
              Agbani, Enugu
            </span>
          </div>
        </Link>

        {/* Delivery Location Selector Pill */}
        <button
          type="button"
          onClick={onLocationClick}
          className="hidden md:flex items-center gap-2.5 px-4 py-2 rounded-full bg-brand-cream border border-brand-line hover:border-brand-gold transition text-left cursor-pointer"
        >
          <MapPin className="w-4 h-4 text-brand-gold shrink-0" />
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] uppercase font-bold tracking-wider text-brand-muted">Delivering to</span>
            <span className="text-xs font-bold text-brand-ink truncate max-w-[150px]">{displayLocation}</span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-brand-muted" />
        </button>

        {/* Customer Navigation Links */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-zinc-700">
          <a href="#menu" className="hover:text-brand-gold transition">Menu</a>
          <a href="#popular" className="hover:text-brand-gold transition">Specials</a>
          <a href="#track" className="hover:text-brand-gold transition">Track Order</a>
        </nav>

        {/* Actions (Profile & Cart) */}
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            aria-label="Customer Profile & Login"
            className="flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-full border border-brand-line text-xs font-bold text-brand-ink hover:bg-brand-cream hover:border-brand-gold transition"
          >
            <User className="w-4 h-4 text-brand-gold" />
            <span className="hidden sm:inline">Account</span>
          </Link>

          {/* Cart Trigger */}
          <button
            onClick={onOpenCart}
            aria-label="View Shopping Bag"
            className="relative w-11 h-11 rounded-full border border-brand-line bg-white flex items-center justify-center text-brand-ink hover:bg-brand-cream hover:border-brand-gold transition"
          >
            <ShoppingBag className="w-5 h-5 text-brand-ink" />
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-brand-gold text-brand-ink text-[11px] font-black flex items-center justify-center px-1 shadow-sm">
              {cartCount}
            </span>
          </button>
        </div>

      </div>

      {/* Mobile Location Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-1.5 bg-brand-cream/80 border-t border-brand-line/70 text-xs">
        <button
          onClick={onLocationClick}
          aria-label="Change delivery location"
          className="flex items-center gap-1.5 font-bold text-brand-ink truncate w-full py-1"
        >
          <MapPin className="w-3.5 h-3.5 text-brand-gold shrink-0" />
          <span className="text-[10px] uppercase font-extrabold text-brand-muted">To:</span>
          <span className="truncate text-xs">{locationText}</span>
          <ChevronDown className="w-3 h-3 text-brand-muted shrink-0 ml-auto" />
        </button>
      </div>
    </header>
  );
}
