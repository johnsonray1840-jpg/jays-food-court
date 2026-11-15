'use client';

import React from 'react';
import Image from 'next/image';

interface BrandedLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg' | 'fullscreen';
}

export function BrandedLoader({
  message = 'Preparing something delicious...',
  size = 'fullscreen'
}: BrandedLoaderProps) {
  if (size === 'fullscreen') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-[9999] bg-[#FFFDF9]/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-in fade-in duration-300"
      >
        <div className="relative w-full max-w-md aspect-square max-h-[85vh] flex flex-col items-center justify-center">
          <div className="relative w-full h-full">
            <Image
              src="/images/jays-loading.gif"
              alt="Jay's Food Court Loading"
              fill
              unoptimized
              priority
              className="object-contain drop-shadow-2xl"
            />
          </div>
          {message && message !== 'Preparing something delicious...' && (
            <div className="absolute bottom-6 px-6 py-2 rounded-full bg-white/90 border border-brand-line/80 shadow-md">
              <p className="text-xs font-semibold text-brand-dark tracking-wide text-center">
                {message}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const dimensions = {
    sm: 'w-36 h-36',
    md: 'w-56 h-56',
    lg: 'w-80 h-80',
  }[size];

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center p-6 space-y-3"
    >
      <div className={`relative ${dimensions} rounded-3xl bg-[#FFFDF9] border border-brand-line/60 shadow-sm flex items-center justify-center p-4`}>
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
