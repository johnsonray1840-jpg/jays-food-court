'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { MenuItem } from '@/types';
import { formatNaira } from '@/lib/utils';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';

interface PopularDishesProps {
  dishes: MenuItem[];
  onSelectDish: (dish: MenuItem) => void;
}

export function PopularDishes({ dishes, onSelectDish }: PopularDishesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -320 : 320;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12" id="popular">
      
      {/* Header & Slider Navigation */}
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <span className="text-xs uppercase font-extrabold tracking-widest text-amber-700">
            Chef&apos;s Recommendations
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-extrabold text-brand-ink mt-1">
            Our Popular <span className="text-amber-600">Dishes</span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            aria-label="Previous dishes"
            className="w-11 h-11 rounded-full border border-brand-line bg-white flex items-center justify-center text-brand-ink hover:bg-brand-gold hover:border-brand-gold transition active:scale-90"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll('right')}
            aria-label="Next dishes"
            className="w-11 h-11 rounded-full border border-brand-line bg-brand-gold flex items-center justify-center text-brand-ink hover:bg-brand-goldDark transition active:scale-90"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Cards Row (Dribbble Layout) */}
      <div
        ref={scrollRef}
        className="flex gap-4 sm:gap-5 overflow-x-auto hide-scrollbar pb-6 scroll-smooth snap-x snap-proximity scroll-px-4 -mx-4 px-4 sm:scroll-px-0 sm:mx-0 sm:px-0"
      >
        {dishes.map((dish) => (
          <article
            key={dish.id}
            className="min-w-[260px] sm:min-w-[290px] md:min-w-[310px] flex-1 snap-start bg-white rounded-3xl p-5 sm:p-6 text-center border border-brand-line hover:border-amber-300 hover:shadow-md hover:-translate-y-1 transition-all duration-300 relative flex flex-col justify-between group"
          >
            <div className="absolute top-4 right-4 z-10">
              <span className="text-[10px] uppercase font-black text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-200">
                Signature
              </span>
            </div>

            <div>
              {/* Circular Plated Photo */}
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 mx-auto my-3 rounded-full overflow-hidden border-4 border-white shadow-md bg-brand-cream">
                <Image
                  src={`/images/${dish.img}.jpg`}
                  alt={dish.name}
                  fill
                  sizes="(max-width: 640px) 112px, 144px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              <h4 className="font-extrabold text-sm sm:text-base text-brand-ink mt-3 line-clamp-1 group-hover:text-amber-700 transition-colors">
                {dish.name}
              </h4>
              <span className="block font-black text-base sm:text-lg text-amber-700 my-1">
                {formatNaira(dish.price)}
              </span>
              <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed mb-4">
                {dish.desc}
              </p>
            </div>

            <button
              disabled={!dish.available}
              onClick={() => dish.available && onSelectDish(dish)}
              className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition shadow-xs flex items-center justify-center ${
                dish.available
                  ? 'border border-brand-line bg-brand-cream hover:bg-brand-gold hover:border-brand-gold text-brand-ink active:scale-95'
                  : 'border border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed'
              }`}
            >
              {dish.available ? 'Select Options' : 'Sold Out'}
            </button>
          </article>
        ))}
      </div>

    </section>
  );
}
