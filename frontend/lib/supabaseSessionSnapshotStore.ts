/**
 * Shared browser-side Supabase session snapshot store.
 * Keeps in-memory auth state and subscriptions separate from persisted storage hints.
 */
import type { Session, User } from "@supabase/supabase-js";

export type SupabaseSessionSnapshot = {
  initialized: boolean;
  session: Session | null;
  user: User | null;
};

export const EMPTY_SESSION_SNAPSHOT: SupabaseSessionSnapshot = {
  initialized: false,
  session: null,
  user: null,
};

let currentSessionSnapshot = EMPTY_SESSION_SNAPSHOT;
const sessionSubscribers = new Set<() => void>();

const emitSessionSnapshot = () => {
  sessionSubscribers.forEach((subscriber) => {
    subscriber();
  });
};

/**
 * Replaces the shared client session snapshot and notifies subscribers.
 */
export const replaceSupabaseSessionSnapshot = (snapshot: SupabaseSessionSnapshot): void => {
  currentSessionSnapshot = snapshot;
  emitSessionSnapshot();
};

/**
 * Updates the shared client session snapshot from a raw Supabase session payload.
 */
export const setSupabaseSessionSnapshot = (session: Session | null, initialized = true): void => {
  replaceSupabaseSessionSnapshot({
    initialized,
    session,
    user: session?.user ?? null,
  });
};

/**
 * Subscribes to the shared browser session snapshot.
 */
export const subscribeToSupabaseSessionSnapshot = (listener: () => void) => {
  sessionSubscribers.add(listener);
  return () => {
    sessionSubscribers.delete(listener);
  };
};

/**
 * No-op subscription for surfaces that intentionally skip session bootstrap.
 */
export const subscribeToDisabledSupabaseSessionSnapshot = () => () => {};

/**
 * Reads the current in-memory browser snapshot.
 */
export const getSupabaseSessionSnapshot = (): SupabaseSessionSnapshot => currentSessionSnapshot;

/**
 * Reads the empty server-side snapshot used during SSR.
 */
export const getServerSupabaseSessionSnapshot = (): SupabaseSessionSnapshot =>
  EMPTY_SESSION_SNAPSHOT;

/**
 * Reads the empty disabled snapshot used when session bootstrap is explicitly off.
 */
export const getDisabledSupabaseSessionSnapshot = (): SupabaseSessionSnapshot =>
  EMPTY_SESSION_SNAPSHOT;
