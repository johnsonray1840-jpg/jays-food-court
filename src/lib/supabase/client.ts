import { createBrowserClient } from '@supabase/ssr';
import { Database } from './types';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.trim() !== '' &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim() !== ''
  );
}

/**
 * Creates or returns the singleton Supabase client for browser environments.
 * Uses only the public anonymous key. The service-role key is NEVER accessible here.
 */
export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  return browserClient;
}
