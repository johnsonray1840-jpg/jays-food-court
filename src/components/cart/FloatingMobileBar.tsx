import React from 'react';
import { formatNaira } from '@/lib/utils';
import { ArrowRight, ShoppingBag } from 'lucide-react';

interface FloatingBarProps {
  itemCount: number;
  total: number;
  onOpenCart: () => void;
}

export function FloatingMobileBar({ itemCount, total, onOpenCart }: FloatingBarProps) {
  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] inset-x-3 sm:inset-x-6 z-40 lg:hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
      <button
        onClick={onOpenCart}
        aria-label={`View order bag, ${itemCount} items, total ${formatNaira(total)}`}
        className="w-full bg-brand-ink text-white p-3.5 sm:p-4 rounded-full shadow-2xl flex items-center justify-between border border-zinc-800 active:scale-95 transition min-h-[52px]"
      >
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full bg-brand-gold text-brand-ink text-xs font-black flex items-center justify-center shadow-xs">
            {itemCount}
          </span>
          <span className="text-xs sm:text-sm font-bold">View Bag</span>
        </div>

        <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-brand-gold">
          <span>{formatNaira(total)}</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      </button>
    </div>
  );
}
