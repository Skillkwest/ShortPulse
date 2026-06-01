/**
 * Browser-side best-effort Supabase access-token hints.
 * Used by non-critical telemetry/reporting paths that should not bootstrap the full auth client.
 */
import { getSupabaseSessionSnapshot } from "./supabaseSessionSnapshotStore";
import { readPersistedSupabaseTokenCandidate } from "./supabasePersistedSessionCandidate";

/**
 * Reads the persisted browser access token when one is already cached locally.
 */
export const readPersistedSupabaseAccessToken = (): string | null => {
  const candidate = readPersistedSupabaseTokenCandidate();
  return typeof candidate?.access_token === "string" ? candidate.access_token : null;
};

/**
 * Reads the best-effort current browser access token from the in-memory snapshot or persisted cache.
 */
export const readCachedSupabaseAccessToken = (): string | null =>
  getSupabaseSessionSnapshot().session?.access_token ?? readPersistedSupabaseAccessToken();
