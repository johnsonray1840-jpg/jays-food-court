'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ShoppingBag, MapPin, ChevronDown, User, UtensilsCrossed, Clock } from 'lucide-react';
import { useCart } from '@/context/CartContext';

interface HeaderNavbarProps {
  onLocationClick?: () => void;
}

export function HeaderNavbar({ onLocationClick }: HeaderNavbarProps) {
  const pathname = usePathname();
  const { cartCount, setIsCartOpen, deliveryLocation } = useCart();

  const isMenu = pathname === '/menu';
  const isTrack = pathname.startsWith('/track') || pathname.startsWith('/orders');

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-brand-line transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Location Anchor */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative h-12 w-28 sm:w-32 transition-transform duration-200 group-hover:scale-105">
              <Image
                src="/images/logo.png"
                alt="Jay's Food Court LTD Logo"
                fill
                priority
                className="object-contain object-left"
              />
            </div>
            <div className="hidden sm:flex flex-col border-l border-brand-line pl-3">
              <span className="text-[10px] uppercase font-black tracking-widest text-brand-gold">
                Agbani, Enugu
              </span>
              <span className="text-[11px] font-medium text-zinc-500">
                Kitchen Hub
              </span>
            </div>
          </Link>

          {/* Delivery Location Selector Pill */}
          <button
            type="button"
            onClick={onLocationClick || (() => setIsCartOpen(true))}
            className="hidden md:flex items-center gap-2.5 px-4 py-2 rounded-full bg-brand-cream border border-brand-line hover:border-brand-gold transition text-left cursor-pointer"
          >
            <MapPin className="w-4 h-4 text-brand-gold shrink-0" />
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] uppercase font-bold tracking-wider text-brand-muted">Delivering to</span>
              <span className="text-xs font-bold text-brand-ink truncate max-w-[150px]">{deliveryLocation}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-brand-muted" />
          </button>
        </div>

        {/* Customer Navigation Links */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-zinc-700">
          <Link
            href="/"
            className={`transition ${pathname === '/' ? 'text-brand-ink font-bold border-b-2 border-brand-gold pb-1' : 'hover:text-brand-gold'}`}
          >
            Explore
          </Link>
          <Link
            href="/menu"
            className={`transition ${isMenu ? 'text-brand-ink font-bold border-b-2 border-brand-gold pb-1' : 'hover:text-brand-gold'}`}
          >
            Full Menu
          </Link>
          <Link
            href="/track"
            className={`transition flex items-center gap-1.5 ${isTrack ? 'text-brand-ink font-bold border-b-2 border-brand-gold pb-1' : 'hover:text-brand-gold'}`}
          >
            <Clock className="w-4 h-4 text-brand-gold" />
            <span>Track Order</span>
          </Link>
        </nav>

        {/* Actions (Account & Cart) */}
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            aria-label="Customer Profile & Login"
            className="flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-full border border-brand-line text-xs font-bold text-brand-ink hover:bg-brand-cream hover:border-brand-gold transition"
          >
            <User className="w-4 h-4 text-brand-gold" />
            <span className="hidden sm:inline">Account</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            aria-label={`View tray (${cartCount} items)`}
            className="relative flex items-center gap-2 px-4 py-2 rounded-full bg-brand-ink text-white hover:bg-zinc-800 transition shadow-xs active:scale-95 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-brand-gold" />
            <span className="text-xs font-bold hidden sm:inline">Tray</span>
            {cartCount > 0 && (
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand-gold text-brand-ink font-black text-[11px] leading-none">
                {cartCount}
              </span>
            )}
          </button>
        </div>

      </div>
    </header>
  );
}
