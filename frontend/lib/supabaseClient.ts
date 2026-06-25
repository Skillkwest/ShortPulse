/**
 * Supabase client factory.
 * Centralizes environment variable handling for client-side Supabase usage.
 */
import { useEffect, useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import {
  getDisabledSupabaseSessionSnapshot,
  getServerSupabaseSessionSnapshot,
  getSupabaseSessionSnapshot,
  replaceSupabaseSessionSnapshot,
  setSupabaseSessionSnapshot,
  subscribeToDisabledSupabaseSessionSnapshot,
  subscribeToSupabaseSessionSnapshot,
  type SupabaseSessionSnapshot,
} from "./supabaseSessionSnapshotStore";
import {
  clearLogoutEpochWhenSessionIsFresh,
  markAuthSessionLoggedOut,
} from "./authSessionInvalidation";

export {
  readPersistedSupabaseSessionHint,
  readSupabaseSessionBootstrapHint,
} from "./supabaseSessionHints";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type UseSupabaseSessionStateOptions = {
  enabled?: boolean;
};
let currentSessionReadPromise: Promise<Session | null> | null = null;
let authStateSubscriptionStarted = false;
const SUPABASE_SESSION_EXPIRY_MARGIN_MS = 90_000;

export const supabaseClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

export const supabaseQueryClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        accessToken: async () => getSupabaseSessionSnapshot().session?.access_token ?? null,
      })
    : null;

/**
 * Ensure a Supabase client exists and surface a descriptive error when env vars are missing.
 */
export const ensureSupabaseClient = () => {
  if (!supabaseClient) {
    throw new Error(
      "Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return supabaseClient;
};

/**
 * Ensure a Supabase query/storage client exists without attaching auth ownership to each request.
 */
export const ensureSupabaseQueryClient = () => {
  if (!supabaseQueryClient) {
    throw new Error(
      "Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return supabaseQueryClient;
};

const setSessionSnapshotFromError = () => {
  const snapshot = getSupabaseSessionSnapshot();
  if (!snapshot.initialized || snapshot.session) {
    setSupabaseSessionSnapshot(null, true);
  }
};

const setSessionSnapshotFromSession = (session: Session | null) => {
  setSupabaseSessionSnapshot(session, true);
  clearLogoutEpochWhenSessionIsFresh(session);
};

const startAuthStateSubscription = () => {
  if (authStateSubscriptionStarted || typeof window === "undefined") return;
  authStateSubscriptionStarted = true;

  try {
    const supabase = ensureSupabaseClient();
    supabase.auth.onAuthStateChange((_event, session) => {
      setSessionSnapshotFromSession(session ?? null);
    });
  } catch {
    setSessionSnapshotFromError();
  }
};

const readSessionFromClient = async (): Promise<Session | null> => {
  try {
    const supabase = ensureSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const session = data.session ?? null;
    setSessionSnapshotFromSession(session);
    return session;
  } catch (error) {
    setSessionSnapshotFromError();
    throw error;
  }
};

const refreshSessionFromClient = async (): Promise<Session | null> => {
  try {
    const supabase = ensureSupabaseClient();
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    const session = data.session ?? null;
    setSessionSnapshotFromSession(session);
    return session;
  } catch (error) {
    setSessionSnapshotFromError();
    throw error;
  }
};

const refreshSessionFromClientPreservingSnapshot = async (): Promise<Session | null> => {
  const previousSnapshot = getSupabaseSessionSnapshot();
  try {
    const supabase = ensureSupabaseClient();
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    const session = data.session ?? null;
    setSessionSnapshotFromSession(session);
    return session;
  } catch (error) {
    replaceSupabaseSessionSnapshot(previousSnapshot);
    throw error;
  }
};

const resolveSessionExpiresAtMs = (session: Session | null): number | null => {
  if (!session || typeof session.expires_at !== "number" || !Number.isFinite(session.expires_at)) {
    return null;
  }
  return Math.trunc(session.expires_at * 1000);
};

const isSessionExpiredOrExpiringSoon = (session: Session | null): boolean => {
  const expiresAtMs = resolveSessionExpiresAtMs(session);
  if (expiresAtMs == null) return false;
  return expiresAtMs - Date.now() <= SUPABASE_SESSION_EXPIRY_MARGIN_MS;
};

/**
 * Reads the current browser session through one shared in-flight request.
 * Prefer this over calling `supabase.auth.getSession()` at leaf consumers.
 */
export const readSupabaseSession = async (options?: {
  forceRefresh?: boolean;
}): Promise<Session | null> => {
  const forceRefresh = options?.forceRefresh === true;
  const snapshot = getSupabaseSessionSnapshot();
  if (
    !forceRefresh &&
    snapshot.initialized &&
    snapshot.session &&
    !currentSessionReadPromise &&
    isSessionExpiredOrExpiringSoon(snapshot.session)
  ) {
    const pendingRefresh = refreshSessionFromClientPreservingSnapshot().finally(() => {
      if (currentSessionReadPromise === pendingRefresh) {
        currentSessionReadPromise = null;
      }
    });
    currentSessionReadPromise = pendingRefresh;
    return await pendingRefresh;
  }
  if (!forceRefresh && snapshot.initialized && !currentSessionReadPromise) {
    return snapshot.session;
  }
  if (!forceRefresh && currentSessionReadPromise) {
    return await currentSessionReadPromise;
  }

  const pendingRead = (forceRefresh ? refreshSessionFromClient() : readSessionFromClient()).finally(
    () => {
      if (currentSessionReadPromise === pendingRead) {
        currentSessionReadPromise = null;
      }
    }
  );
  currentSessionReadPromise = pendingRead;
  return await pendingRead;
};

/**
 * Updates the shared session cache after an auth transition that already returned a session.
 */
export const primeSupabaseSession = (session: Session | null) => {
  setSupabaseSessionSnapshot(session ?? null, true);
  clearLogoutEpochWhenSessionIsFresh(session ?? null);
};

/**
 * Clears local browser session authority without calling the Supabase network sign-out path.
 */
export const clearSupabaseSessionSnapshot = () => {
  currentSessionReadPromise = null;
  setSupabaseSessionSnapshot(null, true);
};

export const refreshSupabaseSession = async (options?: {
  preserveSnapshotOnError?: boolean;
}): Promise<Session | null> => {
  if (options?.preserveSnapshotOnError === true) {
    return await refreshSessionFromClientPreservingSnapshot();
  }
  return await readSupabaseSession({ forceRefresh: true });
};

/**
 * Signs the current user out and clears the shared session cache.
 */
export const signOutSupabaseSession = async (): Promise<void> => {
  const supabase = ensureSupabaseClient();
  markAuthSessionLoggedOut();
  clearSupabaseSessionSnapshot();
  await supabase.auth.signOut();
  clearSupabaseSessionSnapshot();
};

/**
 * Reads the cached/current browser user.
 */
export const readSupabaseUser = async (options?: {
  forceRefresh?: boolean;
}): Promise<User | null> => {
  const session = await readSupabaseSession(options);
  return session?.user ?? null;
};

/**
 * Reads the cached/current browser user id.
 */
export const readSupabaseUserId = async (options?: {
  forceRefresh?: boolean;
}): Promise<string | null> => {
  const user = await readSupabaseUser(options);
  return user?.id ?? null;
};

/**
 * Reads the cached/current browser access token.
 */
export const readSupabaseAccessToken = async (options?: {
  forceRefresh?: boolean;
}): Promise<string | null> => {
  const session = await readSupabaseSession(options);
  return session?.access_token ?? null;
};

/**
 * Subscribes to the shared client session state and starts the singleton auth listener.
 */
export const useSupabaseSessionState = (
  options?: UseSupabaseSessionStateOptions
): SupabaseSessionSnapshot => {
  const enabled = options?.enabled !== false;
  const snapshot = useSyncExternalStore(
    enabled ? subscribeToSupabaseSessionSnapshot : subscribeToDisabledSupabaseSessionSnapshot,
    enabled ? getSupabaseSessionSnapshot : getDisabledSupabaseSessionSnapshot,
    getServerSupabaseSessionSnapshot
  );

  useEffect(() => {
    if (!enabled) return;
    startAuthStateSubscription();
    if (!snapshot.initialized) {
      // Background bootstrap reads should never surface a global unhandled rejection.
      // Callers that need explicit auth errors perform their own awaited session reads.
      void readSupabaseSession().catch(() => undefined);
    }
  }, [enabled, snapshot.initialized]);

  return snapshot;
};

/**
 * Identifies the auth-js abort shape surfaced during cancelled session reads in the browser.
 */
export const isSupabaseAbortError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError") return true;
  return error.message.toLowerCase().includes("signal is aborted");
};
