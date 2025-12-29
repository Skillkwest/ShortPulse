/**
 * Supabase client factory.
 * Centralizes environment variable handling for client-side Supabase usage.
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

/**
 * Ensure a Supabase client exists and surface a descriptive error when env vars are missing.
 */
export const ensureSupabaseClient = () => {
  if (!supabaseClient) {
    throw new Error("Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return supabaseClient;
};
