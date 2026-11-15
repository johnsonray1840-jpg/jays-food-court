'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Bike, ShieldCheck, Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

function RiderOnboardForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get('token') || '';
  const emailParam = searchParams.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [isActivated, setIsActivated] = useState(false);

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !emailParam) {
      setStatusMessage({ text: 'Invalid invitation link.', isError: true });
      return;
    }
    if (password.length < 8) {
      setStatusMessage({ text: 'Password must be at least 8 characters long.', isError: true });
      return;
    }
    if (password !== confirmPassword) {
      setStatusMessage({ text: 'Passwords do not match.', isError: true });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/riders/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailParam,
          token,
          password
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsActivated(true);
        setTimeout(() => {
          router.replace('/rider');
        }, 2000);
      } else {
        setStatusMessage({ text: data.error || 'Activation failed. The link may have expired.', isError: true });
      }
    } catch {
      setStatusMessage({ text: 'Network connection failed. Please retry.', isError: true });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-lg border border-zinc-100 text-center">
      <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-4 border-2 border-amber-200 shadow-sm">
        <Bike className="w-8 h-8" />
      </div>

      <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">
        Activate Courier Account
      </h1>
      <p className="text-xs sm:text-sm text-zinc-500 mt-1">
        Jay&apos;s Food Court Delivery Fleet &bull; Agbani, Enugu
      </p>

      {isActivated ? (
        <div className="my-8 p-6 bg-emerald-50 rounded-2xl border border-emerald-200">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
          <h3 className="font-bold text-emerald-900 text-base">Account Activated!</h3>
          <p className="text-xs text-emerald-700 mt-1">Redirecting you to the Courier Portal...</p>
        </div>
      ) : (
        <form onSubmit={handleActivate} className="mt-6 text-left space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Registered Email
            </label>
            <input
              type="email"
              disabled
              value={emailParam}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-xs font-bold text-zinc-500 bg-zinc-50 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Create Confidential Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                statusMessage.isError
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-full bg-zinc-900 hover:bg-amber-500 hover:text-zinc-950 text-white font-bold text-xs uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-2 mt-4"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Set Password & Activate</span>}
          </button>
        </form>
      )}

      <div className="mt-8 pt-4 border-t border-zinc-100 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 font-medium">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>Enterprise Fleet Onboarding Protocol</span>
      </div>
    </div>
  );
}

export default function RiderOnboardPage() {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <Suspense fallback={
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center flex flex-col items-center">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        </div>
      }>
        <RiderOnboardForm />
      </Suspense>
    </div>
  );
}
