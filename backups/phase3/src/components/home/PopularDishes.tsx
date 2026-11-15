'use client';

import React, { useRef } from 'react';
import Image from 'next/image';
import { MenuItem } from '@/types';
import { formatNaira } from '@/lib/utils';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

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
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-brand-ink mt-1">
            Our Popular{' '}
            <span className="relative inline-block text-brand-gold">
              Dishes
              <svg className="absolute -inset-x-2 -inset-y-1 w-[calc(100%+16px)] h-[calc(100%+8px)] pointer-events-none" viewBox="0 0 160 50">
                <ellipse cx="80" cy="25" rx="75" ry="20" fill="none" stroke="#FFB800" strokeWidth="3" strokeDasharray="8 3" transform="rotate(-2 80 25)" />
              </svg>
            </span>
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
        className="flex gap-4 sm:gap-5 overflow-x-auto hide-scrollbar pb-6 scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {dishes.map((dish) => (
          <motion.article
            key={dish.id}
            whileHover={{ y: -6 }}
            className="min-w-[240px] sm:min-w-[280px] md:min-w-[300px] flex-1 snap-start bg-[#FBFAF7] hover:bg-white rounded-3xl p-5 sm:p-6 text-center border border-transparent hover:border-brand-line hover:shadow-luxury transition-all relative flex flex-col justify-between"
          >
            <div className="absolute top-4 right-4">
              <span className="text-[10px] uppercase font-extrabold text-amber-800 bg-brand-goldLight px-2.5 py-0.5 rounded-full">
                Signature
              </span>
            </div>

            <div>
              {/* Circular Plated Photo */}
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 mx-auto my-3 rounded-full overflow-hidden border-4 border-white shadow-md bg-white">
                <Image
                  src={`/images/${dish.img}.jpg`}
                  alt={dish.name}
                  fill
                  sizes="(max-width: 640px) 112px, 144px"
                  className="object-cover transition-transform duration-500 hover:scale-110 hover:rotate-3"
                />
              </div>

              <h4 className="font-bold text-sm sm:text-base text-brand-ink mt-3 line-clamp-1">{dish.name}</h4>
              <span className="block font-extrabold text-base sm:text-lg text-amber-700 my-1">{formatNaira(dish.price)}</span>
              <p className="text-xs text-brand-muted line-clamp-2 leading-relaxed mb-4">{dish.desc}</p>
            </div>

            <button
              disabled={!dish.available}
              onClick={() => dish.available && onSelectDish(dish)}
              className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition shadow-xs flex items-center justify-center ${
                dish.available
                  ? 'border-2 border-brand-gold bg-white hover:bg-brand-gold text-brand-ink active:scale-95'
                  : 'border border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed'
              }`}
            >
              {dish.available ? 'Add to Bag' : 'Sold Out'}
            </button>
          </motion.article>
        ))}
      </div>

    </section>
  );
}
