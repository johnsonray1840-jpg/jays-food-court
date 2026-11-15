'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Utensils, Clock, MessageSquare, User } from 'lucide-react';

interface BottomNavProps {
  cartCount?: number;
  onOpenCart?: () => void;
  showProfile?: boolean;
}

export function BottomNav({ cartCount = 0, onOpenCart, showProfile = false }: BottomNavProps) {
  const pathname = usePathname();

  const isHome = pathname === '/';
  const isProfile = pathname.startsWith('/profile');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-200/80 px-4 py-2 sm:hidden shadow-lg">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Home */}
        <Link
          href="/"
          className={`flex flex-col items-center gap-1 transition ${
            isHome ? 'text-amber-600 font-bold' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">Home</span>
        </Link>

        {/* Menu Search */}
        <Link
          href="/#menu"
          className="flex flex-col items-center gap-1 text-zinc-500 hover:text-zinc-900 transition"
        >
          <Utensils className="w-5 h-5" />
          <span className="text-[10px]">Menu</span>
        </Link>

        {/* Orders Track */}
        <Link
          href="/#track"
          className="flex flex-col items-center gap-1 text-zinc-500 hover:text-zinc-900 transition"
        >
          <div className="relative">
            <Clock className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Orders</span>
        </Link>

        {/* Support */}
        <a
          href="https://wa.me/2347087426626"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 text-zinc-500 hover:text-emerald-600 transition"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px]">Support</span>
        </a>

        {/* Profile (Only shown once user has completed checkout & paid order saved to database) */}
        {showProfile && (
          <Link
            href="/profile"
            className={`flex flex-col items-center gap-1 transition ${
              isProfile ? 'text-amber-600 font-bold' : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <div className="relative">
              <User className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500" />
            </div>
            <span className="text-[10px]">Profile</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
