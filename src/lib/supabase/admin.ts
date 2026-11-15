import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates an administrative Supabase client using the privileged service-role key.
 * 
 * CRITICAL SECURITY RULES:
 * 1. This client MUST NEVER be executed on the client-side/browser.
 * 2. It bypasses all Row-Level Security (RLS) policies.
 * 3. Use solely in secure Route Handlers, webhooks, and backend processes.
 */
export function getSupabaseAdminClient(): SupabaseClient<any, 'public', any> | null {
  if (typeof window !== 'undefined') {
    throw new Error('SECURITY VIOLATION: getSupabaseAdminClient called in a browser environment.');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || supabaseUrl.trim() === '' || serviceRoleKey.trim() === '') {
    return null;
  }

  return createClient<any>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
