/**
 * Optional Supabase client — only constructed when env vars are present.
 * Per prompt section 21: app MUST work without Supabase.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;
let disabled = false;

export function getSupabaseClient(): SupabaseClient | null {
  if (disabled) return null;
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    disabled = true;
    return null;
  }

  cached = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Use sessionStorage per security decision — token not in localStorage
      storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
    },
  });
  return cached;
}

export function isSupabaseEnabled(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
