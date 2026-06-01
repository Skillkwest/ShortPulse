/**
 * Lightweight admin access gate hook backed by /api/admin/access.
 */
import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { AdminAccessResponse, AdminAccessVia } from "../types";

export type AdminAccessStatus = "idle" | "checking" | "granted" | "denied" | "error";

type UseAdminAccessOptions = {
  enabled: boolean;
  userId?: string | null;
};

type UseAdminAccessResult = {
  status: AdminAccessStatus;
  isLoading: boolean;
  isAdmin: boolean;
  accessVia: AdminAccessVia | null;
  error: string | null;
  refresh: () => void;
};

type CachedAdminAccessState = {
  status: Exclude<AdminAccessStatus, "idle" | "checking">;
  isAdmin: boolean;
  accessVia: AdminAccessVia | null;
};

let cachedAdminAccessStateByUserId = new Map<string, CachedAdminAccessState>();

export const resetCachedAdminAccessStateForTests = (): void => {
  cachedAdminAccessStateByUserId = new Map();
};

const getInitialAdminAccessState = (
  enabled: boolean,
  userId: string | null | undefined
): Pick<UseAdminAccessResult, "status" | "isAdmin" | "accessVia" | "error"> => {
  if (!enabled || !userId) {
    return {
      status: "idle",
      isAdmin: false,
      accessVia: null,
      error: null,
    };
  }

  const cachedAdminAccessState = cachedAdminAccessStateByUserId.get(userId) ?? null;
  if (cachedAdminAccessState) {
    return {
      status: cachedAdminAccessState.status,
      isAdmin: cachedAdminAccessState.isAdmin,
      accessVia: cachedAdminAccessState.accessVia,
      error: null,
    };
  }

  return {
    status: "checking",
    isAdmin: false,
    accessVia: null,
    error: null,
  };
};

/**
 * Resolves admin access via a dedicated endpoint so pages do not gate on /api/admin/users.
 */
export const useAdminAccess = ({
  enabled,
  userId,
}: UseAdminAccessOptions): UseAdminAccessResult => {
  const initialState = getInitialAdminAccessState(enabled, userId);
  const [status, setStatus] = useState<AdminAccessStatus>(initialState.status);
  const [isAdmin, setIsAdmin] = useState(initialState.isAdmin);
  const [accessVia, setAccessVia] = useState<AdminAccessVia | null>(initialState.accessVia);
  const [error, setError] = useState<string | null>(initialState.error);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => {
    setRefreshTick((current) => current + 1);
  }, []);

  useEffect(() => {
    const nextState = getInitialAdminAccessState(enabled, userId);
    setStatus(nextState.status);
    setIsAdmin(nextState.isAdmin);
    setAccessVia(nextState.accessVia);
    setError(nextState.error);
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    let cancelled = false;
    const cachedAdminAccessState = cachedAdminAccessStateByUserId.get(userId) ?? null;
    const hadGrantedCache = cachedAdminAccessState?.status === "granted";

    const run = async () => {
      if (!cachedAdminAccessState) {
        setStatus("checking");
      }
      setError(null);

      try {
        const response = await fetchWithAuth("/api/admin/access", {
          method: "GET",
          shortpulseSkipErrorLogging: true,
        });
        const payload = (await response.json().catch(() => ({}))) as
          | AdminAccessResponse
          | { error?: string };

        if (cancelled) return;

        if (response.status === 403) {
          cachedAdminAccessStateByUserId.set(userId, {
            status: "denied",
            isAdmin: false,
            accessVia: "none",
          });
          setStatus("denied");
          setIsAdmin(false);
          setAccessVia("none");
          setError(null);
          return;
        }

        if (!response.ok) {
          if (hadGrantedCache) {
            setStatus("granted");
            setIsAdmin(true);
            setAccessVia(cachedAdminAccessState?.accessVia ?? "role");
            setError(
              payload && "error" in payload
                ? (payload.error ?? "Failed to verify access.")
                : "Failed to verify access."
            );
            return;
          }
          setStatus("error");
          setIsAdmin(false);
          setAccessVia(null);
          setError(
            payload && "error" in payload
              ? (payload.error ?? "Failed to verify access.")
              : "Failed to verify access."
          );
          return;
        }

        const adminAccess = payload as AdminAccessResponse;
        cachedAdminAccessStateByUserId.set(userId, {
          status: adminAccess.isAdmin ? "granted" : "denied",
          isAdmin: adminAccess.isAdmin,
          accessVia: adminAccess.accessVia,
        });
        setStatus(adminAccess.isAdmin ? "granted" : "denied");
        setIsAdmin(adminAccess.isAdmin);
        setAccessVia(adminAccess.accessVia);
        setError(null);
      } catch (accessError) {
        if (cancelled) return;
        if (hadGrantedCache) {
          setStatus("granted");
          setIsAdmin(true);
          setAccessVia(cachedAdminAccessState?.accessVia ?? "role");
          setError(accessError instanceof Error ? accessError.message : "Failed to verify access.");
          return;
        }
        setStatus("error");
        setIsAdmin(false);
        setAccessVia(null);
        setError(accessError instanceof Error ? accessError.message : "Failed to verify access.");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [enabled, refreshTick, userId]);

  return {
    status: enabled && userId ? status : "idle",
    isLoading: enabled && userId ? status === "checking" : false,
    isAdmin: enabled && userId ? isAdmin : false,
    accessVia: enabled && userId ? accessVia : null,
    error: enabled && userId ? error : null,
    refresh,
  };
};
