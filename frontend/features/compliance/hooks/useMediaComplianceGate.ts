/**
 * Client-side media-compliance gate state.
 * Fetches the current acceptance status once per signed-in user and records acceptance on demand.
 */
import { useCallback, useEffect, useState } from "react";
import {
  MEDIA_COMPLIANCE_AGREEMENT,
  type MediaComplianceAgreementDefinition,
  type MediaComplianceStatusResponse,
} from "../../../lib/compliance/mediaAgreement";
import {
  AUTH_REQUIRED_CODE,
  AUTH_SESSION_TIMEOUT_CODE,
  fetchWithAuth,
  isAuthRequiredError,
  isAuthSessionTimeoutError,
} from "../../../lib/authenticatedFetch";
import { reportAppError } from "../../../lib/appErrorReporter";

type UseMediaComplianceGateOptions = {
  enabled: boolean;
  userId: string | null;
};

type MediaComplianceGateState = {
  agreement: MediaComplianceAgreementDefinition;
  acceptedAt: string | null;
  error: string | null;
  loading: boolean;
  status:
    | "idle"
    | "loading"
    | "accepted"
    | "needs_consent"
    | "auth_recovery_required"
    | "service_unavailable";
};

const INITIAL_STATE: MediaComplianceGateState = {
  agreement: MEDIA_COMPLIANCE_AGREEMENT,
  acceptedAt: null,
  error: null,
  loading: false,
  status: "idle",
};

const isAgreementPayload = (value: unknown): value is MediaComplianceAgreementDefinition => {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<MediaComplianceAgreementDefinition>;
  return (
    typeof record.key === "string" &&
    typeof record.version === "string" &&
    typeof record.title === "string" &&
    typeof record.intro === "string" &&
    Array.isArray(record.rules) &&
    record.rules.every((rule) => typeof rule === "string") &&
    typeof record.checkboxLabel === "string" &&
    typeof record.confirmLabel === "string"
  );
};

const parseStatusPayload = (payload: unknown): MediaComplianceStatusResponse => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid compliance status response.");
  }

  const record = payload as Partial<MediaComplianceStatusResponse>;
  return {
    agreement: isAgreementPayload(record.agreement) ? record.agreement : MEDIA_COMPLIANCE_AGREEMENT,
    accepted: record.accepted === true,
    acceptedAt: typeof record.acceptedAt === "string" ? record.acceptedAt : null,
  };
};

type MediaComplianceErrorInfo = {
  code: string | null;
  message: string;
  status: number | null;
};

const readErrorMessage = (payload: unknown, fallback: string): string => {
  if (!payload || typeof payload !== "object") return fallback;
  const message = (payload as { error?: unknown }).error;
  return typeof message === "string" && message.trim() ? message : fallback;
};

const readErrorCode = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const code = (payload as { code?: unknown }).code;
  return typeof code === "string" && code.trim() ? code : null;
};

const isAuthRecoveryFailure = (errorInfo: MediaComplianceErrorInfo): boolean => {
  if (errorInfo.status === 401) return true;
  if (errorInfo.code === AUTH_SESSION_TIMEOUT_CODE) return true;
  return errorInfo.code === AUTH_REQUIRED_CODE;
};

const resolveServiceUnavailableMessage = (errorInfo: MediaComplianceErrorInfo): string => {
  if (errorInfo.message.trim()) return errorInfo.message;
  return "Media agreement service is temporarily unavailable.";
};

const reportMediaComplianceFailure = (errorInfo: MediaComplianceErrorInfo, routeStatus: string) => {
  const authRecoveryRequired = isAuthRecoveryFailure(errorInfo);
  void reportAppError({
    source: authRecoveryRequired
      ? "client.media_compliance_auth_recovery_required"
      : "client.media_compliance_service_unavailable",
    scope: "app",
    severity: authRecoveryRequired ? "low" : "medium",
    message: authRecoveryRequired
      ? "Media compliance requires auth recovery."
      : "Media compliance service is unavailable.",
    endpoint: "/api/account/media-compliance",
    route: typeof window !== "undefined" ? window.location.pathname : null,
    statusCode: errorInfo.status,
    metadata: {
      media_compliance_error_code: errorInfo.code,
      media_compliance_error_message: errorInfo.message,
      media_compliance_route_status: routeStatus,
    },
  });
};

/**
 * Keeps one protected-session media-compliance status in sync with the server.
 */
export const useMediaComplianceGate = ({
  enabled,
  userId,
}: UseMediaComplianceGateOptions): MediaComplianceGateState & {
  accepted: boolean;
  initialized: boolean;
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
      status: "loading",
      loading: true,
      error: null,
    }));

    try {
      const response = await fetchWithAuth("/api/account/media-compliance", {
        shortpulseLogScope: "app",
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const errorInfo: MediaComplianceErrorInfo = {
          code: readErrorCode(errorPayload),
          message: readErrorMessage(errorPayload, "Unable to load the media agreement status."),
          status: response.status,
        };
        throw errorInfo;
      }
      const payload = parseStatusPayload(await response.json().catch(() => null));

      setState({
        agreement: payload.agreement,
        acceptedAt: payload.acceptedAt,
        error: null,
        loading: false,
        status: payload.accepted ? "accepted" : "needs_consent",
      });
    } catch (error) {
      const errorInfo: MediaComplianceErrorInfo = (() => {
        if (isAuthSessionTimeoutError(error)) {
          return {
            code: AUTH_SESSION_TIMEOUT_CODE,
            message: "Timed out resolving your session. Sign in again to continue.",
            status: null,
          };
        }
        if (isAuthRequiredError(error)) {
          return {
            code: AUTH_REQUIRED_CODE,
            message: error.message,
            status: null,
          };
        }
        if (
          error &&
          typeof error === "object" &&
          "message" in error &&
          "status" in error &&
          "code" in error
        ) {
          return error as MediaComplianceErrorInfo;
        }
        return {
          code: null,
          message:
            error instanceof Error ? error.message : "Unable to load the media agreement status.",
          status: null,
        };
      })();
      reportMediaComplianceFailure(errorInfo, "status_read");

      setState((current) => ({
        ...current,
        loading: false,
        status: isAuthRecoveryFailure(errorInfo) ? "auth_recovery_required" : "service_unavailable",
        error: isAuthRecoveryFailure(errorInfo)
          ? "Your session expired. Sign in again to continue."
          : resolveServiceUnavailableMessage(errorInfo),
      }));
    }
  }, [enabled, userId]);

  const acceptAgreement = useCallback(async () => {
    if (!enabled || !userId) {
      return;
    }

    setState((current) => ({
      ...current,
      status: current.status === "idle" ? "loading" : current.status,
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
        const errorInfo: MediaComplianceErrorInfo = {
          code: readErrorCode(errorPayload),
          message: readErrorMessage(errorPayload, "Unable to save the media agreement."),
          status: response.status,
        };
        throw errorInfo;
      }
      const payload = parseStatusPayload(await response.json().catch(() => null));
      if (!payload.accepted) {
        throw new Error("Unable to save the media agreement.");
      }

      setState({
        agreement: payload.agreement,
        acceptedAt: payload.acceptedAt,
        error: null,
        loading: false,
        status: "accepted",
      });
    } catch (error) {
      const errorInfo: MediaComplianceErrorInfo = (() => {
        if (isAuthSessionTimeoutError(error)) {
          return {
            code: AUTH_SESSION_TIMEOUT_CODE,
            message: "Timed out resolving your session. Sign in again to continue.",
            status: null,
          };
        }
        if (isAuthRequiredError(error)) {
          return {
            code: AUTH_REQUIRED_CODE,
            message: error.message,
            status: null,
          };
        }
        if (
          error &&
          typeof error === "object" &&
          "message" in error &&
          "status" in error &&
          "code" in error
        ) {
          return error as MediaComplianceErrorInfo;
        }
        return {
          code: null,
          message: error instanceof Error ? error.message : "Unable to save the media agreement.",
          status: null,
        };
      })();
      reportMediaComplianceFailure(errorInfo, "accept_save");

      setState((current) => ({
        ...current,
        loading: false,
        status: isAuthRecoveryFailure(errorInfo) ? "auth_recovery_required" : "service_unavailable",
        error: isAuthRecoveryFailure(errorInfo)
          ? "Your session expired. Sign in again to continue."
          : resolveServiceUnavailableMessage(errorInfo),
      }));
      throw new Error(errorInfo.message);
    }
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled || !userId) {
      setState(INITIAL_STATE);
      return;
    }
    setState((current) => ({
      ...current,
      status: "loading",
      loading: true,
      error: null,
    }));
    void refreshStatus();
  }, [enabled, refreshStatus, userId]);

  return {
    ...state,
    accepted: state.status === "accepted",
    initialized: state.status !== "idle" && state.status !== "loading",
    acceptAgreement,
    refreshStatus,
  };
};
