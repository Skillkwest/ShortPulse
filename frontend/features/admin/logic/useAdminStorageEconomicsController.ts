/**
 * Admin storage-economics controller.
 * Loads and refreshes the Storage lens snapshot for the admin stats page.
 */
import React from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import {
  DEFAULT_ADMIN_STORAGE_ECONOMICS_RESPONSE,
  normalizeAdminStorageEconomicsResponse,
} from "./adminStorageEconomicsApi";
import type { AdminStorageEconomicsResponse } from "../types";

const STORAGE_ECONOMICS_REFRESH_INTERVAL_MS = 60000;

type UseAdminStorageEconomicsControllerParams = {
  enabled: boolean;
};

type UseAdminStorageEconomicsControllerResult = {
  storageEconomics: AdminStorageEconomicsResponse;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export const useAdminStorageEconomicsController = ({
  enabled,
}: UseAdminStorageEconomicsControllerParams): UseAdminStorageEconomicsControllerResult => {
  const [storageEconomics, setStorageEconomics] = React.useState(
    DEFAULT_ADMIN_STORAGE_ECONOMICS_RESPONSE
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth("/api/admin/storage-economics", {
        method: "GET",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load admin storage economics.");
      }
      setStorageEconomics(normalizeAdminStorageEconomicsResponse(data));
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Failed to load admin storage economics."
      );
      setStorageEconomics(DEFAULT_ADMIN_STORAGE_ECONOMICS_RESPONSE);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  React.useEffect(() => {
    if (!enabled) return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refresh();
    }, STORAGE_ECONOMICS_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [enabled, refresh]);

  return {
    storageEconomics,
    loading,
    error,
    refresh,
  };
};
