'use client';

import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface ToastProps {
  message: string | null;
  type?: 'success' | 'error';
}

export function Toast({ message, type = 'success' }: ToastProps) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] max-w-[90vw] sm:max-w-md px-5 py-3 rounded-full bg-brand-ink text-white font-semibold text-xs sm:text-sm shadow-2xl flex items-center gap-2.5 border border-brand-gold/30 pointer-events-none transition-opacity duration-200"
    >
      {type === 'success' ? (
        <CheckCircle2 className="w-4 h-4 text-brand-gold shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
      )}
      <span className="truncate">{message}</span>
    </div>
  );
}
