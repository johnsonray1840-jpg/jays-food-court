'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lock,
  ShieldCheck,
  UtensilsCrossed,
  ChefHat,
  Bike,
  Building2,
  ArrowRight,
  AlertCircle
} from 'lucide-react';

interface StaffUser {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'admin' | 'manager' | 'kitchen_staff' | 'rider';
}

export default function PrivateStaffPortal() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeStaff, setActiveStaff] = useState<StaffUser | null>(null);

  useEffect(() => {
    async function checkExistingAuth() {
      try {
        const res = await fetch('/api/auth/staff/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.staff) {
            setActiveStaff(data.staff);
            redirectToRolePortal(data.staff.role);
            return;
          }
        }
      } catch (err) {
        // Continue to login form
      } finally {
        setCheckingSession(false);
      }
    }
    checkExistingAuth();
  }, []);

  const redirectToRolePortal = (role: string) => {
    if (role === 'owner' || role === 'admin' || role === 'manager') {
      router.push('/owner');
    } else if (role === 'kitchen_staff') {
      router.push('/kitchen');
    } else if (role === 'rider') {
      router.push('/rider');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Authentication failed. Please verify credentials.');
        return;
      }

      setActiveStaff(data.staff);
      redirectToRolePortal(data.staff.role);
    } catch (err) {
      setErrorMessage('Network error occurred. Please verify your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#17140D] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-brand-gold/30 border-t-brand-gold rounded-full animate-spin" />
          <p className="text-brand-cream/60 text-xs font-mono uppercase tracking-widest">
            Verifying Staff Credentials...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#17140D] text-white flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,184,0,0.08),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(255,251,239,0.03),transparent_50%)] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Terminal Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center mb-4 shadow-lg shadow-brand-gold/5">
            <Lock className="w-7 h-7 text-brand-gold" />
          </div>
          <span className="text-[11px] font-mono tracking-widest uppercase text-brand-gold/80 bg-brand-gold/10 px-3 py-1 rounded-full border border-brand-gold/20">
            Internal Operations Portal
          </span>
          <h1 className="text-2xl font-black text-white mt-3 tracking-tight">
            Jay&apos;s Food Court
          </h1>
          <p className="text-xs text-brand-cream/60 mt-1">
            Authorized Personnel &amp; Staff Access Terminal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#1f1b13]/90 backdrop-blur-md border border-brand-gold/15 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-2.5 text-xs text-red-200">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-brand-cream/80 uppercase tracking-wider mb-1.5">
                Staff Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@jaysfoodcourt.com"
                className="w-full px-4 py-3 bg-[#17140D] border border-white/10 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-cream/80 uppercase tracking-wider mb-1.5">
                Security Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 bg-[#17140D] border border-white/10 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold transition"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3.5 px-4 bg-brand-gold hover:bg-amber-400 text-[#17140D] font-bold text-sm rounded-xl transition shadow-lg shadow-brand-gold/10 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#17140D]/30 border-t-[#17140D] rounded-full animate-spin" />
                  <span>Authenticating Terminal...</span>
                </>
              ) : (
                <>
                  <span>Authenticate &amp; Enter</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

            {/* Operational Authentication Footer */}
            <div className="mt-6 pt-5 border-t border-white/5 text-center">
              <p className="text-[11px] text-zinc-400">
                Staff sessions are verified and routed according to authorized access tiers.
              </p>
            </div>
        </div>

        {/* Security Notice */}
        <div className="text-center mt-6">
          <p className="text-[11px] text-zinc-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
            <span>Strict server-side cryptographic audit logged. Restricted terminal.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
