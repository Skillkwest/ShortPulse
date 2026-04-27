/**
 * Client-side media-compliance gate state.
 * Fetches the current acceptance status once per signed-in user and records acceptance on demand.
 */
import { useCallback, useEffect, useState } from "react";
import {
  MEDIA_COMPLIANCE_AGREEMENT,
  type MediaComplianceStatusResponse,
} from "../../../lib/compliance/mediaAgreement";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

type UseMediaComplianceGateOptions = {
  enabled: boolean;
  userId: string | null;
};

type MediaComplianceGateState = {
  accepted: boolean;
  acceptedAt: string | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;
};

const INITIAL_STATE: MediaComplianceGateState = {
  accepted: false,
  acceptedAt: null,
  initialized: false,
  loading: false,
  error: null,
};

const parseStatusPayload = (payload: unknown): MediaComplianceStatusResponse => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid compliance status response.");
  }

  const record = payload as Partial<MediaComplianceStatusResponse>;
  return {
    agreement: MEDIA_COMPLIANCE_AGREEMENT,
    accepted: record.accepted === true,
    acceptedAt: typeof record.acceptedAt === "string" ? record.acceptedAt : null,
  };
};

const readErrorMessage = (payload: unknown, fallback: string): string => {
  if (!payload || typeof payload !== "object") return fallback;
  const message = (payload as { error?: unknown }).error;
  return typeof message === "string" && message.trim() ? message : fallback;
};

/**
 * Keeps one protected-session media-compliance status in sync with the server.
 */
export const useMediaComplianceGate = ({
  enabled,
  userId,
}: UseMediaComplianceGateOptions): MediaComplianceGateState & {
  agreement: typeof MEDIA_COMPLIANCE_AGREEMENT;
  acceptAgreement: () => Promise<void>;
  refreshStatus: () => Promise<void>;
} => {
  const [state, setState] = useState<MediaComplianceGateState>(INITIAL_STATE);

  const refreshStatus = useCallback(async () => {
    if (!enabled || !userId) {
      setState(INITIAL_STATE);
      return;
    }

    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    try {
      const response = await fetchWithAuth("/api/account/media-compliance", {
        shortpulseLogScope: "app",
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(
          readErrorMessage(errorPayload, "Unable to load the media agreement status.")
        );
      }
      const payload = parseStatusPayload(await response.json().catch(() => null));

      setState({
        accepted: payload.accepted,
        acceptedAt: payload.acceptedAt,
        initialized: true,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        initialized: true,
        loading: false,
        error:
          error instanceof Error ? error.message : "Unable to load the media agreement status.",
      }));
    }
  }, [enabled, userId]);

  const acceptAgreement = useCallback(async () => {
    if (!enabled || !userId) {
      return;
    }

    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    try {
      const response = await fetchWithAuth("/api/account/media-compliance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        shortpulseLogScope: "app",
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(readErrorMessage(errorPayload, "Unable to save the media agreement."));
      }
      const payload = parseStatusPayload(await response.json().catch(() => null));
      if (!payload.accepted) {
        throw new Error("Unable to save the media agreement.");
      }

      setState({
        accepted: true,
        acceptedAt: payload.acceptedAt,
        initialized: true,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Unable to save the media agreement.",
      }));
      throw error;
    }
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled || !userId) {
      setState(INITIAL_STATE);
      return;
    }
    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));
    void refreshStatus();
  }, [enabled, refreshStatus, userId]);

  return {
    ...state,
    agreement: MEDIA_COMPLIANCE_AGREEMENT,
    acceptAgreement,
    refreshStatus,
  };
};
