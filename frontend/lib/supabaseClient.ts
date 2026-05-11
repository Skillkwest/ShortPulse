/**
 * Supabase client factory.
 * Centralizes environment variable handling for client-side Supabase usage.
 */
import { useEffect, useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type SupabaseSessionSnapshot = {
  initialized: boolean;
  session: Session | null;
  user: User | null;
};

const EMPTY_SESSION_SNAPSHOT: SupabaseSessionSnapshot = {
  initialized: false,
  session: null,
  user: null,
};

let currentSessionSnapshot = EMPTY_SESSION_SNAPSHOT;
let currentSessionReadPromise: Promise<Session | null> | null = null;
let authStateSubscriptionStarted = false;
const sessionSubscribers = new Set<() => void>();

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
        accessToken: async () => currentSessionSnapshot.session?.access_token ?? null,
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

const emitSessionSnapshot = () => {
  sessionSubscribers.forEach((subscriber) => {
    subscriber();
  });
};

const setSessionSnapshot = (session: Session | null, initialized = true) => {
  currentSessionSnapshot = {
    initialized,
    session,
    user: session?.user ?? null,
  };
  emitSessionSnapshot();
};

const setSessionSnapshotFromError = () => {
  if (!currentSessionSnapshot.initialized || currentSessionSnapshot.session) {
    setSessionSnapshot(null, true);
  }
};

const subscribeToSessionSnapshot = (listener: () => void) => {
  sessionSubscribers.add(listener);
  return () => {
    sessionSubscribers.delete(listener);
  };
};

const getSessionSnapshot = (): SupabaseSessionSnapshot => currentSessionSnapshot;

const getServerSessionSnapshot = (): SupabaseSessionSnapshot => EMPTY_SESSION_SNAPSHOT;

const startAuthStateSubscription = () => {
  if (authStateSubscriptionStarted || typeof window === "undefined") return;
  authStateSubscriptionStarted = true;

  try {
    const supabase = ensureSupabaseClient();
    supabase.auth.onAuthStateChange((_event, session) => {
      setSessionSnapshot(session ?? null, true);
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
    setSessionSnapshot(session, true);
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
    setSessionSnapshot(session, true);
    return session;
  } catch (error) {
    setSessionSnapshotFromError();
    throw error;
  }
};

/**
 * Reads the current browser session through one shared in-flight request.
 * Prefer this over calling `supabase.auth.getSession()` at leaf consumers.
 */
export const readSupabaseSession = async (options?: {
  forceRefresh?: boolean;
}): Promise<Session | null> => {
  const forceRefresh = options?.forceRefresh === true;
  if (!forceRefresh && currentSessionSnapshot.initialized && !currentSessionReadPromise) {
    return currentSessionSnapshot.session;
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
  setSessionSnapshot(session ?? null, true);
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
export const useSupabaseSessionState = (): SupabaseSessionSnapshot => {
  const snapshot = useSyncExternalStore(
    subscribeToSessionSnapshot,
    getSessionSnapshot,
    getServerSessionSnapshot
  );

  useEffect(() => {
    startAuthStateSubscription();
    if (!snapshot.initialized) {
      // Background bootstrap reads should never surface a global unhandled rejection.
      // Callers that need explicit auth errors perform their own awaited session reads.
      void readSupabaseSession().catch(() => undefined);
    }
  }, [snapshot.initialized]);

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
