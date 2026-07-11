/**
 * Loads the active runtime model-pricing policy for authenticated AI Studio surfaces.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
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
let modelPricingPolicyConflictRefreshPromise: Promise<ModelPricingPolicySnapshot> | null = null;

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

const loadFreshModelPricingPolicySnapshotAfterConflict =
  async (): Promise<ModelPricingPolicySnapshot> => {
    if (modelPricingPolicyConflictRefreshPromise) {
      return await modelPricingPolicyConflictRefreshPromise;
    }

    const request = (async () => {
      const requestActiveBeforeConflict = modelPricingPolicyInFlightPromise;
      if (requestActiveBeforeConflict) {
        try {
          await requestActiveBeforeConflict;
        } catch {
          // A failed stale request must not prevent the post-conflict refresh.
        }
      }
      return await loadSharedModelPricingPolicySnapshot();
    })();

    modelPricingPolicyConflictRefreshPromise = request;
    try {
      return await request;
    } finally {
      if (modelPricingPolicyConflictRefreshPromise === request) {
        modelPricingPolicyConflictRefreshPromise = null;
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
  const pricingPolicyLoadSequenceRef = useRef(0);
  const materializedModelPricingPolicy = modelPricingPolicySnapshot?.document ?? null;

  const fetchModelPricingPolicy =
    useCallback(async (): Promise<ModelPricingPolicySnapshot | null> => {
      if (!enabled) return null;

      const loadSequence = ++pricingPolicyLoadSequenceRef.current;
      setModelPricingPolicyLoading(true);
      setModelPricingPolicyError(null);

      try {
        const snapshot = await loadSharedModelPricingPolicySnapshot();
        if (pricingPolicyLoadSequenceRef.current === loadSequence) {
          setModelPricingPolicySnapshot(snapshot);
        }
        return snapshot;
      } catch (error) {
        if (pricingPolicyLoadSequenceRef.current === loadSequence) {
          setModelPricingPolicySnapshot(null);
          setModelPricingPolicyError(
            error instanceof Error ? error.message : "Failed to load model pricing policy."
          );
        }
        return null;
      } finally {
        if (pricingPolicyLoadSequenceRef.current === loadSequence) {
          setModelPricingPolicyLoading(false);
        }
      }
    }, [enabled]);

  const refreshModelPricingPolicyAfterConflict = useCallback(async () => {
    if (!enabled) return null;

    const loadSequence = ++pricingPolicyLoadSequenceRef.current;
    setModelPricingPolicySnapshot(null);
    setModelPricingPolicyLoading(true);
    setModelPricingPolicyError(null);

    try {
      const snapshot = await loadFreshModelPricingPolicySnapshotAfterConflict();
      if (pricingPolicyLoadSequenceRef.current === loadSequence) {
        setModelPricingPolicySnapshot(snapshot);
      }
      return snapshot;
    } catch (error) {
      if (pricingPolicyLoadSequenceRef.current === loadSequence) {
        setModelPricingPolicyError(
          error instanceof Error ? error.message : "Failed to load model pricing policy."
        );
      }
      return null;
    } finally {
      if (pricingPolicyLoadSequenceRef.current === loadSequence) {
        setModelPricingPolicyLoading(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void fetchModelPricingPolicy();
  }, [enabled, fetchModelPricingPolicy]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const refresh = () => void refreshModelPricingPolicyAfterConflict();
    window.addEventListener(PRICING_POLICY_REFRESH_REQUESTED_EVENT, refresh);
    return () => window.removeEventListener(PRICING_POLICY_REFRESH_REQUESTED_EVENT, refresh);
  }, [enabled, refreshModelPricingPolicyAfterConflict]);

  return {
    modelPricingPolicy: materializedModelPricingPolicy,
    modelPricingPolicySnapshot,
    modelPricingPolicyLoading,
    modelPricingPolicyError,
    modelPricingPolicyReady: modelPricingPolicySnapshot !== null,
    refreshModelPricingPolicy: refreshModelPricingPolicyAfterConflict,
  };
};
