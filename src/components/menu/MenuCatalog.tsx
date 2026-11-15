'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { MenuItem, Category } from '@/types';
import { formatNaira } from '@/lib/utils';
import { Search, X, Plus } from 'lucide-react';

interface MenuCatalogProps {
  items: MenuItem[];
  onSelectDish: (dish: MenuItem) => void;
}

const CATEGORIES: Category[] = [
  'All',
  'Rice',
  'Soups & Swallows',
  'Snacks & Shawarma',
  'Yam & Sides',
  'Drinks',
];

export function MenuCatalog({ items, onSelectDish }: MenuCatalogProps) {
  const [selectedCat, setSelectedCat] = useState<Category>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCat = selectedCat === 'All' || item.cat === selectedCat;
      const matchesQuery =
        searchQuery === '' ||
        (item.name + ' ' + item.desc).toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [items, selectedCat, searchQuery]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14" id="menu">
      
      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
        <span className="text-xs uppercase font-extrabold tracking-widest text-amber-700">Explore Our Kitchen</span>
        <h2 className="font-serif text-3xl sm:text-4xl font-extrabold text-brand-ink">
          Fresh &amp; Direct <span className="text-amber-600">Menu</span>
        </h2>
        <p className="text-sm text-brand-muted">
          Direct pricing on all signature dishes and chilled drinks. Cooked freshly upon order.
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="max-w-xl mx-auto mb-6 relative">
        <Search className="w-5 h-5 text-brand-muted absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search egusi, ogbono, jollof, fried rice, drinks..."
          className="w-full pl-13 pr-12 py-3.5 sm:py-4 rounded-full bg-brand-cream border border-brand-line text-sm text-brand-ink placeholder:text-brand-muted focus:bg-white focus:border-brand-gold outline-none transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            aria-label="Clear search query"
            className="w-10 h-10 flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-ink"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Filter Pills (Edge-to-Edge on Mobile, Centered on Tablet/Desktop) */}
      <div className="flex gap-2.5 overflow-x-auto hide-scrollbar pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 justify-start sm:justify-center">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCat(cat)}
            className={`whitespace-nowrap px-5 sm:px-6 py-2.5 sm:py-3 min-h-[44px] rounded-full text-xs sm:text-sm font-bold transition-all flex items-center justify-center ${
              selectedCat === cat
                ? 'bg-brand-ink text-brand-gold shadow-sm'
                : 'bg-white border border-brand-line text-zinc-700 hover:border-brand-gold active:bg-zinc-100'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Grid (2 columns on mobile, 3 on tablet, 4 on desktop) */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 pt-2">
          {filteredItems.map((item) => {
            const isSoldOut = !item.available;

            return (
              <article
                key={item.id}
                onClick={() => !isSoldOut && onSelectDish(item)}
                className={`bg-white border rounded-2xl sm:rounded-3xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between group ${
                  isSoldOut
                    ? 'border-zinc-200 opacity-70 cursor-not-allowed'
                    : 'border-brand-line hover:border-amber-300 cursor-pointer hover:-translate-y-1'
                }`}
              >
                <div className="relative w-full h-40 sm:h-48 bg-brand-cream overflow-hidden">
                  <Image
                    src={`/images/${item.img}.jpg`}
                    alt={item.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className={`object-cover transition-transform duration-500 ease-out ${
                      isSoldOut ? 'grayscale-[40%]' : 'group-hover:scale-105'
                    }`}
                  />
                  {isSoldOut ? (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center">
                      <span className="px-3 py-1 rounded-full bg-red-600 text-white text-[11px] font-black uppercase tracking-wider shadow-sm">
                        Sold Out
                      </span>
                    </div>
                  ) : (
                    item.swallow && (
                      <div className="absolute top-2.5 left-2.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-brand-ink/80 backdrop-blur-xs text-white text-[10px] font-bold tracking-tight shadow-sm">
                          Custom Swallow
                        </span>
                      </div>
                    )
                  )}
                </div>

                <div className="p-3 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-extrabold text-xs sm:text-base text-brand-ink line-clamp-1 group-hover:text-amber-700 transition-colors">
                      {item.name}
                    </h4>
                    <p className="text-[11px] sm:text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-brand-line/70">
                    <span className="font-black text-xs sm:text-base text-amber-700">
                      {formatNaira(item.price)}
                    </span>
                    {isSoldOut ? (
                      <span className="text-[11px] font-bold text-zinc-400 bg-zinc-100 px-2 py-1 rounded-full">
                        Unavailable
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDish(item);
                        }}
                        aria-label={`Select ${item.name}`}
                        className="h-8 px-3 rounded-full bg-brand-cream hover:bg-brand-gold text-brand-ink border border-brand-line hover:border-brand-gold flex items-center justify-center gap-1 font-bold text-xs shadow-xs transition active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 text-brand-muted text-sm">
          No dishes match your search criteria.
        </div>
      )}

    </section>
  );
}
