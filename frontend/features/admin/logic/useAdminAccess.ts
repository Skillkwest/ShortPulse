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

type AdminAccessViewState = Pick<
  UseAdminAccessResult,
  "status" | "isAdmin" | "accessVia" | "error"
> & {
  key: string;
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

const getAdminAccessStateKey = (enabled: boolean, userId: string | null | undefined) =>
  enabled && userId ? userId : "disabled";

const createAdminAccessViewState = (
  enabled: boolean,
  userId: string | null | undefined
): AdminAccessViewState => ({
  key: getAdminAccessStateKey(enabled, userId),
  ...getInitialAdminAccessState(enabled, userId),
});

const resolveAdminAccessError = (error: unknown, fallback = "Failed to verify access."): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error) {
    const message = (error as { error?: unknown }).error;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
};

/**
 * Resolves admin access via a dedicated endpoint so pages do not gate on /api/admin/users.
 */
export const useAdminAccess = ({
  enabled,
  userId,
}: UseAdminAccessOptions): UseAdminAccessResult => {
  const stateKey = getAdminAccessStateKey(enabled, userId);
  const [adminAccessState, setAdminAccessState] = useState<AdminAccessViewState>(() =>
    createAdminAccessViewState(enabled, userId)
  );
  const [refreshTick, setRefreshTick] = useState(0);
  const visibleAdminAccessState =
    adminAccessState.key === stateKey
      ? adminAccessState
      : createAdminAccessViewState(enabled, userId);

  const refresh = useCallback(() => {
    setRefreshTick((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !userId) {
      return;
    }

    let cancelled = false;
    const cachedAdminAccessState = cachedAdminAccessStateByUserId.get(userId) ?? null;

    const run = async () => {
      if (!cachedAdminAccessState) {
        setAdminAccessState((current) => ({
          ...current,
          key: stateKey,
          status: "checking",
          isAdmin: false,
          accessVia: null,
        }));
      }
      setAdminAccessState((current) => ({
        ...current,
        key: stateKey,
        error: null,
      }));

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
          setAdminAccessState({
            key: stateKey,
            status: "denied",
            isAdmin: false,
            accessVia: "none",
            error: null,
          });
          return;
        }

        if (!response.ok) {
          cachedAdminAccessStateByUserId.delete(userId);
          setAdminAccessState({
            key: stateKey,
            status: "error",
            isAdmin: false,
            accessVia: null,
            error: resolveAdminAccessError(payload),
          });
          return;
        }

        const adminAccess = payload as AdminAccessResponse;
        cachedAdminAccessStateByUserId.set(userId, {
          status: adminAccess.isAdmin ? "granted" : "denied",
          isAdmin: adminAccess.isAdmin,
          accessVia: adminAccess.accessVia,
        });
        setAdminAccessState({
          key: stateKey,
          status: adminAccess.isAdmin ? "granted" : "denied",
          isAdmin: adminAccess.isAdmin,
          accessVia: adminAccess.accessVia,
          error: null,
        });
      } catch (accessError) {
        if (cancelled) return;
        cachedAdminAccessStateByUserId.delete(userId);
        setAdminAccessState({
          key: stateKey,
          status: "error",
          isAdmin: false,
          accessVia: null,
          error: resolveAdminAccessError(accessError),
        });
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [enabled, refreshTick, stateKey, userId]);

  return {
    status: enabled && userId ? visibleAdminAccessState.status : "idle",
    isLoading: enabled && userId ? visibleAdminAccessState.status === "checking" : false,
    isAdmin: enabled && userId ? visibleAdminAccessState.isAdmin : false,
    accessVia: enabled && userId ? visibleAdminAccessState.accessVia : null,
    error: enabled && userId ? visibleAdminAccessState.error : null,
    refresh,
  };
};
