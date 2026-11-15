'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, UtensilsCrossed, Clock, User, ShoppingBag } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export function BottomNav({ cartCount = 0, onOpenCart }: { cartCount?: number; onOpenCart?: () => void }) {
  const pathname = usePathname();
  const { cartCount: ctxCount, setIsCartOpen } = useCart();
  const count = cartCount || ctxCount;

  const isHome = pathname === '/';
  const isMenu = pathname.startsWith('/menu');
  const isTrack = pathname.startsWith('/track') || pathname.startsWith('/orders');
  const isProfile = pathname.startsWith('/profile');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-brand-line/80 px-4 py-2 sm:hidden shadow-lg pb-safe">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Explore */}
        <Link
          href="/"
          className={`flex flex-col items-center gap-1 transition ${
            isHome ? 'text-brand-ink font-bold' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <Compass className={`w-5 h-5 ${isHome ? 'text-brand-gold stroke-[2.5]' : ''}`} />
          <span className="text-[10px] tracking-tight">Explore</span>
        </Link>

        {/* Menu */}
        <Link
          href="/menu"
          className={`flex flex-col items-center gap-1 transition ${
            isMenu ? 'text-brand-ink font-bold' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <UtensilsCrossed className={`w-5 h-5 ${isMenu ? 'text-brand-gold stroke-[2.5]' : ''}`} />
          <span className="text-[10px] tracking-tight">Menu</span>
        </Link>

        {/* Cart Trigger */}
        <button
          type="button"
          onClick={onOpenCart || (() => setIsCartOpen(true))}
          className="relative flex flex-col items-center gap-1 text-zinc-500 hover:text-zinc-900 transition"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            {count > 0 && (
              <span className="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-brand-gold text-brand-ink font-black text-[9px] leading-none">
                {count}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight">Tray</span>
        </button>

        {/* Orders */}
        <Link
          href="/track"
          className={`flex flex-col items-center gap-1 transition ${
            isTrack ? 'text-brand-ink font-bold' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <Clock className={`w-5 h-5 ${isTrack ? 'text-brand-gold stroke-[2.5]' : ''}`} />
          <span className="text-[10px] tracking-tight">Orders</span>
        </Link>

        {/* Profile */}
        <Link
          href="/profile"
          className={`flex flex-col items-center gap-1 transition ${
            isProfile ? 'text-brand-ink font-bold' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <User className={`w-5 h-5 ${isProfile ? 'text-brand-gold stroke-[2.5]' : ''}`} />
          <span className="text-[10px] tracking-tight">Account</span>
        </Link>
      </div>
    </nav>
  );
}
