'use client';

import React from 'react';
import Image from 'next/image';
import { MenuItem } from '@/types';
import { formatNaira } from '@/lib/utils';
import { Plus, Clock } from 'lucide-react';
import { useCart } from '@/context/CartContext';

interface DishCardProps {
  dish: MenuItem;
  layout?: 'grid' | 'horizontal';
}

export function DishCard({ dish, layout = 'grid' }: DishCardProps) {
  const { setActiveModalDish } = useCart();
  const isSoldOut = !dish.available;

  if (layout === 'horizontal') {
    return (
      <article
        onClick={() => !isSoldOut && setActiveModalDish(dish)}
        className={`bg-white border rounded-2xl p-3 flex items-center gap-3.5 transition-all duration-200 group ${
          isSoldOut
            ? 'border-zinc-200 opacity-60 cursor-not-allowed'
            : 'border-brand-line hover:border-brand-gold hover:shadow-xs cursor-pointer active:scale-[0.99]'
        }`}
      >
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-brand-cream">
          <Image
            src={`/images/${dish.img}.jpg`}
            alt={dish.name}
            fill
            sizes="96px"
            className={`object-cover transition-transform duration-300 ${isSoldOut ? 'grayscale-[40%]' : 'group-hover:scale-105'}`}
          />
          {isSoldOut && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
              <span className="text-[9px] font-black uppercase text-white tracking-widest">Sold Out</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-brand-ink truncate group-hover:text-amber-800 transition-colors">
                {dish.name}
              </h4>
              {dish.swallow && (
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[9px] font-bold">
                  Swallow Choice
                </span>
              )}
            </div>
            <p className="text-[11px] text-brand-muted line-clamp-1 mt-0.5 leading-normal">
              {dish.desc}
            </p>
          </div>

          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-brand-line/60">
            <span className="font-black text-sm text-brand-ink">
              {formatNaira(dish.price)}
            </span>
            {!isSoldOut && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveModalDish(dish);
                }}
                className="h-7 px-3 rounded-full bg-brand-cream hover:bg-brand-gold text-brand-ink font-bold text-xs flex items-center gap-1 transition active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      onClick={() => !isSoldOut && setActiveModalDish(dish)}
      className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between group ${
        isSoldOut
          ? 'border-zinc-200 opacity-60 cursor-not-allowed'
          : 'border-brand-line hover:border-amber-300 hover:shadow-md cursor-pointer hover:-translate-y-0.5'
      }`}
    >
      <div className="relative w-full aspect-[4/3] bg-brand-cream overflow-hidden">
        <Image
          src={`/images/${dish.img}.jpg`}
          alt={dish.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className={`object-cover transition-transform duration-500 ease-out ${
            isSoldOut ? 'grayscale-[40%]' : 'group-hover:scale-105'
          }`}
        />
        {isSoldOut ? (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
            <span className="px-3 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
              Sold Out
            </span>
          </div>
        ) : (
          dish.swallow && (
            <div className="absolute top-2.5 left-2.5">
              <span className="px-2.5 py-0.5 rounded-full bg-brand-ink/85 backdrop-blur-xs text-white text-[10px] font-bold tracking-tight shadow-sm">
                Custom Swallow
              </span>
            </div>
          )
        )}
      </div>

      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between bg-white">
        <div>
          <h4 className="font-bold text-xs sm:text-sm text-brand-ink line-clamp-1 group-hover:text-amber-800 transition-colors">
            {dish.name}
          </h4>
          <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2 leading-relaxed font-normal">
            {dish.desc}
          </p>
        </div>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-brand-line/60">
          <span className="font-black text-xs sm:text-sm text-brand-ink">
            {formatNaira(dish.price)}
          </span>
          {isSoldOut ? (
            <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
              Unavailable
            </span>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveModalDish(dish);
              }}
              aria-label={`Select ${dish.name}`}
              className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-full bg-brand-cream hover:bg-brand-gold text-brand-ink border border-brand-line hover:border-brand-gold flex items-center justify-center gap-1 font-bold text-[11px] sm:text-xs transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
