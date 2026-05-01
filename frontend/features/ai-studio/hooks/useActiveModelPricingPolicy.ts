/**
 * Loads the active runtime model-pricing policy for authenticated AI Studio surfaces.
 */
import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type {
  ModelPricingPolicyDocument,
  ModelPricingPolicySnapshot,
} from "../../../lib/model-runtime/pricingPolicy";

type ModelPricingPolicyApiResponse = {
  modelPolicy: ModelPricingPolicySnapshot;
};

type UseActiveModelPricingPolicyParams = {
  enabled: boolean;
};

type UseActiveModelPricingPolicyResult = {
  modelPricingPolicy: ModelPricingPolicyDocument | null;
  modelPricingPolicySnapshot: ModelPricingPolicySnapshot | null;
  modelPricingPolicyLoading: boolean;
  modelPricingPolicyError: string | null;
  modelPricingPolicyReady: boolean;
  refreshModelPricingPolicy: () => Promise<void>;
};

export const useActiveModelPricingPolicy = ({
  enabled,
}: UseActiveModelPricingPolicyParams): UseActiveModelPricingPolicyResult => {
  const [modelPricingPolicySnapshot, setModelPricingPolicySnapshot] =
    useState<ModelPricingPolicySnapshot | null>(null);
  const [modelPricingPolicyLoading, setModelPricingPolicyLoading] = useState(enabled);
  const [modelPricingPolicyError, setModelPricingPolicyError] = useState<string | null>(null);

  const fetchModelPricingPolicy = useCallback(async () => {
    if (!enabled) return;

    setModelPricingPolicyLoading(true);
    setModelPricingPolicyError(null);

    try {
      const response = await fetchWithAuth("/api/pricing/model-policy", {
        method: "GET",
        shortpulseRetryNetworkOnce: true,
      });
      const payload = (await response.json().catch(() => ({}))) as
        | ModelPricingPolicyApiResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error(
          payload && "error" in payload
            ? (payload.error ?? "Failed to load model pricing policy.")
            : "Failed to load model pricing policy."
        );
      }

      setModelPricingPolicySnapshot((payload as ModelPricingPolicyApiResponse).modelPolicy);
    } catch (error) {
      setModelPricingPolicyError(
        error instanceof Error ? error.message : "Failed to load model pricing policy."
      );
    } finally {
      setModelPricingPolicyLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void fetchModelPricingPolicy();
  }, [enabled, fetchModelPricingPolicy]);

  return {
    modelPricingPolicy: modelPricingPolicySnapshot?.document ?? null,
    modelPricingPolicySnapshot,
    modelPricingPolicyLoading,
    modelPricingPolicyError,
    modelPricingPolicyReady: modelPricingPolicySnapshot !== null,
    refreshModelPricingPolicy: fetchModelPricingPolicy,
  };
};
