/**
 * Loads the active runtime model-pricing policy for authenticated AI Studio surfaces.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { materializeImageBilledCreditPolicy } from "../../../lib/model-runtime/materializeImageBilledCreditPolicy";
import type {
  ModelPricingPolicyDocument,
  ModelPricingPolicySnapshot,
} from "../../../lib/model-runtime/pricingPolicy";
import { PRICING_POLICY_REFRESH_REQUESTED_EVENT } from "../../../lib/model-runtime/pricingPolicyFreshness";

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
  refreshModelPricingPolicy: () => Promise<ModelPricingPolicySnapshot | null>;
};

let modelPricingPolicyInFlightPromise: Promise<ModelPricingPolicySnapshot> | null = null;

const loadSharedModelPricingPolicySnapshot = async (): Promise<ModelPricingPolicySnapshot> => {
  if (modelPricingPolicyInFlightPromise) {
    return await modelPricingPolicyInFlightPromise;
  }

  const request = (async () => {
    const response = await fetchWithAuth("/api/pricing/model-policy", {
      cache: "no-store",
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

    return (payload as ModelPricingPolicyApiResponse).modelPolicy;
  })();

  modelPricingPolicyInFlightPromise = request;
  try {
    return await request;
  } finally {
    if (modelPricingPolicyInFlightPromise === request) {
      modelPricingPolicyInFlightPromise = null;
    }
  }
};

export const useActiveModelPricingPolicy = ({
  enabled,
}: UseActiveModelPricingPolicyParams): UseActiveModelPricingPolicyResult => {
  const [modelPricingPolicySnapshot, setModelPricingPolicySnapshot] =
    useState<ModelPricingPolicySnapshot | null>(null);
  const [modelPricingPolicyLoading, setModelPricingPolicyLoading] = useState(enabled);
  const [modelPricingPolicyError, setModelPricingPolicyError] = useState<string | null>(null);
  const materializedModelPricingPolicy = useMemo(
    () =>
      modelPricingPolicySnapshot?.document
        ? materializeImageBilledCreditPolicy(modelPricingPolicySnapshot.document)
        : null,
    [modelPricingPolicySnapshot]
  );

  const fetchModelPricingPolicy =
    useCallback(async (): Promise<ModelPricingPolicySnapshot | null> => {
      if (!enabled) return null;

      setModelPricingPolicyLoading(true);
      setModelPricingPolicyError(null);

      try {
        const snapshot = await loadSharedModelPricingPolicySnapshot();
        setModelPricingPolicySnapshot(snapshot);
        return snapshot;
      } catch (error) {
        setModelPricingPolicySnapshot(null);
        setModelPricingPolicyError(
          error instanceof Error ? error.message : "Failed to load model pricing policy."
        );
        return null;
      } finally {
        setModelPricingPolicyLoading(false);
      }
    }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void fetchModelPricingPolicy();
  }, [enabled, fetchModelPricingPolicy]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const refresh = () => void fetchModelPricingPolicy();
    window.addEventListener(PRICING_POLICY_REFRESH_REQUESTED_EVENT, refresh);
    return () => window.removeEventListener(PRICING_POLICY_REFRESH_REQUESTED_EVENT, refresh);
  }, [enabled, fetchModelPricingPolicy]);

  return {
    modelPricingPolicy: materializedModelPricingPolicy,
    modelPricingPolicySnapshot,
    modelPricingPolicyLoading,
    modelPricingPolicyError,
    modelPricingPolicyReady: modelPricingPolicySnapshot !== null,
    refreshModelPricingPolicy: fetchModelPricingPolicy,
  };
};
