/**
 * Admin pricing page controller.
 * Loads read-only pricing state for the admin pricing command center.
 */
import React from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { AdminPricingStateResponse } from "../types";

type UseAdminPricingControllerParams = {
  enabled: boolean;
};

type UseAdminPricingControllerResult = {
  pricingState: AdminPricingStateResponse | null;
  pricingLoading: boolean;
  pricingRefreshing: boolean;
  pricingError: string | null;
  refreshPricingState: () => Promise<void>;
};

export const useAdminPricingController = ({
  enabled,
}: UseAdminPricingControllerParams): UseAdminPricingControllerResult => {
  const [pricingState, setPricingState] = React.useState<AdminPricingStateResponse | null>(null);
  const [pricingLoading, setPricingLoading] = React.useState(false);
  const [pricingRefreshing, setPricingRefreshing] = React.useState(false);
  const [pricingError, setPricingError] = React.useState<string | null>(null);

  const fetchPricingState = React.useCallback(
    async (refresh = false) => {
      if (!enabled) return;
      if (refresh) {
        setPricingRefreshing(true);
      } else {
        setPricingLoading(true);
      }
      setPricingError(null);

      try {
        const response = await fetchWithAuth("/api/admin/pricing/state", {
          method: "GET",
        });
        const payload = (await response.json().catch(() => ({}))) as
          | AdminPricingStateResponse
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            payload && "error" in payload
              ? (payload.error ?? "Failed to load pricing state.")
              : "Failed to load pricing state."
          );
        }

        setPricingState(payload as AdminPricingStateResponse);
      } catch (error) {
        setPricingState(null);
        setPricingError(error instanceof Error ? error.message : "Failed to load pricing state.");
      } finally {
        setPricingLoading(false);
        setPricingRefreshing(false);
      }
    },
    [enabled]
  );

  React.useEffect(() => {
    if (!enabled) return;
    void fetchPricingState(false);
  }, [enabled, fetchPricingState]);

  const refreshPricingState = React.useCallback(async () => {
    await fetchPricingState(true);
  }, [fetchPricingState]);

  return {
    pricingState,
    pricingLoading,
    pricingRefreshing,
    pricingError,
    refreshPricingState,
  };
};
