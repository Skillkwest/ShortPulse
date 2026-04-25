/**
 * Lightweight admin access gate hook backed by /api/admin/access.
 */
import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { AdminAccessResponse, AdminAccessVia } from "../types";

export type AdminAccessStatus = "idle" | "checking" | "granted" | "denied" | "error";

type UseAdminAccessOptions = {
  enabled: boolean;
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

let cachedAdminAccessState: CachedAdminAccessState | null = null;

export const resetCachedAdminAccessStateForTests = (): void => {
  cachedAdminAccessState = null;
};

const getInitialAdminAccessState = (
  enabled: boolean
): Pick<UseAdminAccessResult, "status" | "isAdmin" | "accessVia" | "error"> => {
  if (!enabled) {
    return {
      status: "idle",
      isAdmin: false,
      accessVia: null,
      error: null,
    };
  }

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
export const useAdminAccess = ({ enabled }: UseAdminAccessOptions): UseAdminAccessResult => {
  const initialState = getInitialAdminAccessState(enabled);
  const [status, setStatus] = useState<AdminAccessStatus>(initialState.status);
  const [isAdmin, setIsAdmin] = useState(initialState.isAdmin);
  const [accessVia, setAccessVia] = useState<AdminAccessVia | null>(initialState.accessVia);
  const [error, setError] = useState<string | null>(initialState.error);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => {
    setRefreshTick((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;
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
          cachedAdminAccessState = {
            status: "denied",
            isAdmin: false,
            accessVia: "none",
          };
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
            setAccessVia(cachedAdminAccessState?.accessVia ?? "allowlist");
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
        cachedAdminAccessState = {
          status: adminAccess.isAdmin ? "granted" : "denied",
          isAdmin: adminAccess.isAdmin,
          accessVia: adminAccess.accessVia,
        };
        setStatus(adminAccess.isAdmin ? "granted" : "denied");
        setIsAdmin(adminAccess.isAdmin);
        setAccessVia(adminAccess.accessVia);
        setError(null);
      } catch (accessError) {
        if (cancelled) return;
        if (hadGrantedCache) {
          setStatus("granted");
          setIsAdmin(true);
          setAccessVia(cachedAdminAccessState?.accessVia ?? "allowlist");
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
  }, [enabled, refreshTick]);

  return {
    status: enabled ? status : "idle",
    isLoading: enabled ? status === "checking" : false,
    isAdmin: enabled ? isAdmin : false,
    accessVia: enabled ? accessVia : null,
    error: enabled ? error : null,
    refresh,
  };
};
