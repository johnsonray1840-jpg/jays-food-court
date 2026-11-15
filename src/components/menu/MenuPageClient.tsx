'use client';

import React, { useState, useMemo } from 'react';
import { MenuItem, Category } from '@/types';
import { DishCard } from '@/components/menu/DishCard';
import { Search, X, Sparkles } from 'lucide-react';

interface MenuPageClientProps {
  initialMenu: MenuItem[];
}

const CATEGORIES: Category[] = [
  'All',
  'Rice',
  'Soups & Swallows',
  'Snacks & Shawarma',
  'Yam & Sides',
  'Drinks',
];

export function MenuPageClient({ initialMenu }: MenuPageClientProps) {
  const [selectedCat, setSelectedCat] = useState<Category>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    return initialMenu.filter((item) => {
      const matchesCat = selectedCat === 'All' || item.cat === selectedCat;
      const matchesQuery =
        searchQuery === '' ||
        (item.name + ' ' + item.desc).toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [initialMenu, selectedCat, searchQuery]);

  return (
    <div className="min-h-screen bg-white">
      {/* Editorial Category Header */}
      <section className="bg-brand-cream/40 border-b border-brand-line py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-[11px] font-black tracking-widest uppercase text-brand-gold">
              Agbani Kitchen Hub
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-brand-ink tracking-tight mt-1">
              Freshly Cooked <span className="text-amber-600">Menu</span>
            </h1>
            <p className="text-zinc-600 text-sm sm:text-base mt-2 leading-relaxed">
              Authentic firewood party jollof, hand-pounded swallows, rich traditional soups, and ice-cold drinks prepared to order.
            </p>
          </div>

          {/* Search Bar */}
          <div className="mt-6 max-w-xl relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search egusi, ogbono, firewood jollof, drinks..."
              className="w-full pl-11 pr-10 py-3.5 rounded-full bg-white border border-brand-line text-sm text-brand-ink placeholder:text-zinc-400 focus:outline-none focus:border-brand-gold shadow-xs transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="w-8 h-8 flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-brand-ink"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Sticky Category Pill Bar */}
      <div className="sticky top-20 z-30 bg-white/95 backdrop-blur-md border-b border-brand-line py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
            {CATEGORIES.map((cat) => {
              const count = initialMenu.filter(m => cat === 'All' || m.cat === cat).length;
              const isActive = selectedCat === cat;

              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCat(cat)}
                  className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                    isActive
                      ? 'bg-brand-ink text-brand-gold shadow-sm'
                      : 'bg-brand-cream/80 border border-brand-line/80 text-zinc-700 hover:border-brand-gold'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-white text-zinc-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dishes Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-6">
            {filteredItems.map((dish) => (
              <DishCard key={dish.id} dish={dish} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-brand-cream/30 rounded-3xl border border-brand-line/60 p-8 max-w-md mx-auto">
            <Sparkles className="w-8 h-8 text-brand-gold mx-auto mb-3" />
            <h3 className="font-bold text-base text-brand-ink">No dishes found</h3>
            <p className="text-xs text-brand-muted mt-1 leading-relaxed">
              We couldn&apos;t find anything matching &quot;{searchQuery}&quot;. Try searching for &quot;Egusi&quot;, &quot;Jollof&quot;, or &quot;Yam&quot;.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCat('All');
              }}
              className="mt-4 px-5 py-2 rounded-full bg-brand-ink text-white font-bold text-xs"
            >
              Reset Filters
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
