import React from 'react';

export function DishSkeleton() {
  return (
    <div className="bg-white border border-brand-line/60 rounded-2xl overflow-hidden animate-pulse">
      <div className="w-full aspect-[4/3] bg-brand-cream" />
      <div className="p-3.5 sm:p-4 space-y-2.5">
        <div className="h-4 bg-zinc-200 rounded w-3/4" />
        <div className="space-y-1">
          <div className="h-3 bg-zinc-100 rounded w-full" />
          <div className="h-3 bg-zinc-100 rounded w-4/5" />
        </div>
        <div className="pt-2 flex items-center justify-between border-t border-brand-line/40">
          <div className="h-4 bg-zinc-200 rounded w-16" />
          <div className="h-7 w-16 bg-brand-cream rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function HorizontalDishSkeleton() {
  return (
    <div className="bg-white border border-brand-line/60 rounded-2xl p-3 flex items-center gap-3.5 animate-pulse">
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-brand-cream shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-zinc-200 rounded w-1/2" />
        <div className="h-3 bg-zinc-100 rounded w-4/5" />
        <div className="pt-1 flex items-center justify-between">
          <div className="h-4 bg-zinc-200 rounded w-14" />
          <div className="h-6 w-14 bg-brand-cream rounded-full" />
        </div>
      </div>
    </div>
  );
}
