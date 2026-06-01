/**
 * Protected-route session context.
 * Shares an already-resolved protected session from route gates down to pages so
 * they do not re-run auth recovery logic after the gate has already cleared.
 */
import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useSupabaseSessionState } from "./supabaseClient";
import type { SupabaseSessionSnapshot } from "./supabaseSessionSnapshotStore";

type ProtectedRouteSessionContextValue = {
  session: Session;
  user: User;
};

const ProtectedRouteSessionContext = createContext<ProtectedRouteSessionContextValue | null>(null);

type ProtectedRouteSessionProviderProps = {
  session: Session;
  user: User;
  children: ReactNode;
};

/**
 * Provides the already-resolved protected session to pages rendered behind a shared gate.
 */
export function ProtectedRouteSessionProvider({
  session,
  user,
  children,
}: ProtectedRouteSessionProviderProps) {
  const value = useMemo(
    () => ({
      session,
      user,
    }),
    [session, user]
  );

  return createElement(ProtectedRouteSessionContext.Provider, { value }, children);
}

/**
 * Reads the shared protected session when a route gate already resolved auth upstream.
 */
export const useProtectedRouteSessionContext = (): ProtectedRouteSessionContextValue | null =>
  useContext(ProtectedRouteSessionContext);

type UseResolvedProtectedSessionStateOptions = {
  enabled?: boolean;
};

/**
 * Reuses a route-owned protected session when available and only falls back to
 * the shared Supabase bootstrap store for surfaces outside those gates.
 */
export const useResolvedProtectedSessionState = (
  options?: UseResolvedProtectedSessionStateOptions
): SupabaseSessionSnapshot => {
  const enabled = options?.enabled !== false;
  const protectedRouteSession = useProtectedRouteSessionContext();
  const fallbackSnapshot = useSupabaseSessionState({
    enabled: enabled && !protectedRouteSession,
  });

  if (!enabled || !protectedRouteSession) {
    return fallbackSnapshot;
  }

  return {
    initialized: true,
    session: protectedRouteSession.session,
    user: protectedRouteSession.user,
  };
};
