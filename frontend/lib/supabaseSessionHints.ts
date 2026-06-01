/**
 * Browser-side Supabase persisted auth hints.
 * Keeps localStorage scanning separate from the in-memory session snapshot store.
 */
import { getSupabaseSessionSnapshot } from "./supabaseSessionSnapshotStore";
import { hasPersistedSupabaseSessionCandidate } from "./supabasePersistedSessionCandidate";

/**
 * Reads whether browser storage contains a persisted Supabase auth payload.
 * This is a bootstrap hint only and must never replace authoritative session reads.
 */
export const readPersistedSupabaseSessionHint = (): boolean =>
  hasPersistedSupabaseSessionCandidate();

/**
 * Reads whether the browser has enough local auth state to justify client session bootstrap.
 */
export const readSupabaseSessionBootstrapHint = (): boolean => {
  if (getSupabaseSessionSnapshot().session?.access_token) {
    return true;
  }
  return readPersistedSupabaseSessionHint();
};
