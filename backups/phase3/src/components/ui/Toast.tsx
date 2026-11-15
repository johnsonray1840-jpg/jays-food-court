'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface ToastProps {
  message: string | null;
  type?: 'success' | 'error';
}

export function Toast({ message, type = 'success' }: ToastProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -20, x: '-50%' }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed top-20 left-1/2 z-[100] max-w-[90vw] sm:max-w-md px-5 py-3 rounded-full bg-brand-ink text-white font-semibold text-xs sm:text-sm shadow-2xl flex items-center gap-2.5 border border-brand-gold/30 pointer-events-none"
        >
          {type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-brand-gold shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span className="truncate">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
