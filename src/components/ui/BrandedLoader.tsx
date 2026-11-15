'use client';

import React from 'react';
import Image from 'next/image';

interface BrandedLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg' | 'fullscreen';
}

export function BrandedLoader({
  message = 'Preparing something delicious...',
  size = 'md'
}: BrandedLoaderProps) {
  if (size === 'fullscreen') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
      >
        <div className="relative w-64 h-48 rounded-3xl bg-brand-cream border border-brand-line/80 shadow-luxury flex flex-col items-center justify-center p-6 space-y-4">
          <div className="relative w-36 h-20">
            <Image
              src="/images/jays-loading.gif"
              alt="Jay's Food Court Loading"
              fill
              unoptimized
              priority
              className="object-contain"
            />
          </div>
          <div className="flex flex-col items-center space-y-2 w-full">
            <div className="w-32 h-1 bg-brand-line rounded-full overflow-hidden">
              <div className="w-full h-full bg-brand-gold animate-[shimmer_1.5s_infinite] origin-left" />
            </div>
            <p className="text-xs font-semibold text-brand-muted tracking-tight text-center">
              {message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const dimensions = {
    sm: 'w-32 h-24',
    md: 'w-48 h-36',
    lg: 'w-64 h-48',
  }[size];

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center p-6 space-y-3"
    >
      <div className={`relative ${dimensions} rounded-2xl bg-brand-cream/80 border border-brand-line/60 flex items-center justify-center p-3`}>
        <Image
          src="/images/jays-loading.gif"
          alt="Jay's Food Court Loading"
          fill
          unoptimized
          className="object-contain"
        />
      </div>
      {message && (
        <p className="text-xs font-semibold text-brand-muted tracking-tight text-center">
          {message}
        </p>
      )}
    </div>
  );
}
