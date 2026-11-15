'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isCancelled = false;

    async function handleAuth() {
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          router.replace('/profile');
          return;
        }

        // Determine target destination (e.g. ?redirect=/profile or /owner)
        const redirectParam = searchParams.get('redirect') || '/profile';

        // Helper to complete Jay's Food Court customer session establishment
        const establishSessionAndRedirect = async (email: string, userId: string) => {
          try {
            const res = await fetch('/api/auth/customer/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, userId })
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              if (!isCancelled) {
                setStatus('error');
                setErrorMessage(errData.error || 'No registered account found for this email address.');
              }
              return;
            }
          } catch (sessionErr) {
            console.warn('Failed to establish customer session cookie:', sessionErr);
          }

          if (!isCancelled) {
            setStatus('success');
            setTimeout(() => {
              router.replace(redirectParam);
            }, 800);
          }
        };

        // 1. Check URL hash for implicit grant tokens: #access_token=...&refresh_token=...
        if (typeof window !== 'undefined' && window.location.hash) {
          const rawHash = window.location.hash.startsWith('#')
            ? window.location.hash.substring(1)
            : window.location.hash;
          const hashParams = new URLSearchParams(rawHash);
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            });

            if (!error && data.session?.user?.email) {
              await establishSessionAndRedirect(data.session.user.email, data.session.user.id);
              return;
            }
          }
        }

        // 2. Check query parameters: PKCE code or verifyOtp token_hash
        const code = searchParams.get('code');
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');

        if (tokenHash && type) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any
          });
          if (!error && data.session?.user?.email) {
            await establishSessionAndRedirect(data.session.user.email, data.session.user.id);
            return;
          }
        } else if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data.session?.user?.email) {
            await establishSessionAndRedirect(data.session.user.email, data.session.user.id);
            return;
          }
        }

        // 3. Check existing Supabase session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (session?.user?.email) {
          await establishSessionAndRedirect(session.user.email, session.user.id);
          return;
        }

        // 4. Set up auth state listener as safety net
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          if (currentSession?.user?.email) {
            await establishSessionAndRedirect(currentSession.user.email, currentSession.user.id);
          }
        });

        // 5. If no session is resolved within 3 seconds, display clear error with retry
        const timeout = setTimeout(() => {
          if (!isCancelled && status === 'loading') {
            setStatus('error');
            setErrorMessage('Your login link has expired or has already been used. Please request a new link.');
          }
        }, 3000);

        return () => {
          clearTimeout(timeout);
          authListener?.subscription?.unsubscribe();
        };
      } catch (err: any) {
        if (!isCancelled) {
          setStatus('error');
          setErrorMessage(err.message || 'Authentication error occurred.');
        }
      }
    }

    handleAuth();

    return () => {
      isCancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-lg border border-zinc-100 text-center">
      {status === 'loading' && (
        <div className="flex flex-col items-center">
          <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
          <h2 className="text-xl font-bold text-zinc-900">Logging you in...</h2>
          <p className="text-sm text-zinc-500 mt-1">Securing your session and loading your profile.</p>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
          <h2 className="text-xl font-bold text-zinc-900">Welcome Back!</h2>
          <p className="text-sm text-zinc-500 mt-1">Redirecting to your Jay&apos;s Food Court account...</p>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-zinc-900">Sign-in Link Expired</h2>
          <p className="text-sm text-zinc-500 mt-1">{errorMessage || 'Please request a new link.'}</p>
          <button
            onClick={() => router.replace('/profile')}
            className="mt-6 px-6 py-2.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs transition-colors"
          >
            Go to Login
          </button>
        </div>
      )}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
      <Suspense fallback={
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-lg border border-zinc-100 text-center flex flex-col items-center">
          <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
          <h2 className="text-xl font-bold text-zinc-900">Authenticating...</h2>
        </div>
      }>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
