/**
 * Customer analytics controller for the admin stats workspace.
 * Loads one selected customer's detailed analytics without coupling the support queue to heavy reads.
 */
import React from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { AdminUserAnalyticsResponse } from "../types";

const CUSTOMER_ANALYTICS_REQUEST_TIMEOUT_MS = 18000;

type UseAdminCustomerAnalyticsControllerParams = {
  enabled: boolean;
  initialCustomerId: string | null;
};

type UseAdminCustomerAnalyticsControllerResult = {
  customerIdInput: string;
  activeCustomerId: string | null;
  analytics: AdminUserAnalyticsResponse | null;
  loading: boolean;
  error: string | null;
  loaded: boolean;
  setCustomerIdInput: (value: string) => void;
  loadCustomerAnalytics: (nextCustomerId?: string) => Promise<void>;
};

const normalizeCustomerId = (value: string | null | undefined): string =>
  String(value ?? "").trim();

/**
 * Provides explicit, bounded customer analytics loading for `/admin/stats`.
 */
export const useAdminCustomerAnalyticsController = ({
  enabled,
  initialCustomerId,
}: UseAdminCustomerAnalyticsControllerParams): UseAdminCustomerAnalyticsControllerResult => {
  const normalizedInitialCustomerId = normalizeCustomerId(initialCustomerId);
  const [customerIdInput, setCustomerIdInput] = React.useState(normalizedInitialCustomerId);
  const [activeCustomerId, setActiveCustomerId] = React.useState<string | null>(
    normalizedInitialCustomerId || null
  );
  const [analytics, setAnalytics] = React.useState<AdminUserAnalyticsResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const activeRequestRef = React.useRef<string | null>(null);

  const loadCustomerAnalytics = React.useCallback(
    async (nextCustomerId?: string) => {
      const requestedCustomerId = normalizeCustomerId(nextCustomerId ?? customerIdInput);
      if (!enabled || !requestedCustomerId) {
        setAnalytics(null);
        setActiveCustomerId(requestedCustomerId || null);
        setError(requestedCustomerId ? null : "Enter a customer user id.");
        setLoaded(false);
        return;
      }

      activeRequestRef.current = requestedCustomerId;
      setActiveCustomerId(requestedCustomerId);
      setCustomerIdInput(requestedCustomerId);
      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, CUSTOMER_ANALYTICS_REQUEST_TIMEOUT_MS);

      try {
        const response = await fetchWithAuth(
          `/api/admin/users/${encodeURIComponent(requestedCustomerId)}/analytics`,
          {
            method: "GET",
            signal: controller.signal,
          }
        );
        const payload = (await response.json().catch(() => ({}))) as
          | AdminUserAnalyticsResponse
          | { error?: string };
        if (!response.ok) {
          throw new Error(
            typeof (payload as { error?: unknown }).error === "string"
              ? (payload as { error: string }).error
              : "Failed to load customer analytics."
          );
        }

        if (activeRequestRef.current !== requestedCustomerId) return;
        setAnalytics(payload as AdminUserAnalyticsResponse);
        setLoaded(true);
      } catch (nextError) {
        if (activeRequestRef.current !== requestedCustomerId) return;
        setAnalytics(null);
        setLoaded(false);
        const isAbortError = nextError instanceof Error && nextError.name === "AbortError";
        setError(
          isAbortError
            ? "Customer analytics took too long to load. Try again after the current deployment settles."
            : nextError instanceof Error
              ? nextError.message
              : "Failed to load customer analytics."
        );
      } finally {
        window.clearTimeout(timeoutId);
        if (activeRequestRef.current === requestedCustomerId) {
          setLoading(false);
        }
      }
    },
    [customerIdInput, enabled]
  );

  React.useEffect(() => {
    if (!normalizedInitialCustomerId) return;
    setCustomerIdInput(normalizedInitialCustomerId);
  }, [normalizedInitialCustomerId]);

  React.useEffect(() => {
    if (!enabled || !normalizedInitialCustomerId) return;
    if (activeCustomerId === normalizedInitialCustomerId && (loading || loaded)) return;
    void loadCustomerAnalytics(normalizedInitialCustomerId);
  }, [
    activeCustomerId,
    enabled,
    loadCustomerAnalytics,
    loaded,
    loading,
    normalizedInitialCustomerId,
  ]);

  return {
    customerIdInput,
    activeCustomerId,
    analytics,
    loading,
    error,
    loaded,
    setCustomerIdInput,
    loadCustomerAnalytics,
  };
};
