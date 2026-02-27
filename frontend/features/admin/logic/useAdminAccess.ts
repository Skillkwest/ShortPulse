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

/**
 * Resolves admin access via a dedicated endpoint so pages do not gate on /api/admin/users.
 */
export const useAdminAccess = ({ enabled }: UseAdminAccessOptions): UseAdminAccessResult => {
  const [status, setStatus] = useState<AdminAccessStatus>(enabled ? "checking" : "idle");
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessVia, setAccessVia] = useState<AdminAccessVia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => {
    setRefreshTick((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setStatus("checking");
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
          setStatus("denied");
          setIsAdmin(false);
          setAccessVia("none");
          setError(null);
          return;
        }

        if (!response.ok) {
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
        setStatus(adminAccess.isAdmin ? "granted" : "denied");
        setIsAdmin(adminAccess.isAdmin);
        setAccessVia(adminAccess.accessVia);
        setError(null);
      } catch (accessError) {
        if (cancelled) return;
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
