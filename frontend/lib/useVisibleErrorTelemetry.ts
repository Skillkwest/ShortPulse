/**
 * Hook to report user-visible error messages to the client telemetry pipeline.
 * Logs once per distinct visible message and resets dedupe when the message clears.
 */
import { useEffect, useRef } from "react";
import {
  reportAppError,
  type ClientAppErrorEvent,
  type ClientErrorScope,
  type ClientErrorSeverity,
} from "./appErrorReporter";

type JsonObject = Record<string, unknown>;

type UseVisibleErrorTelemetryParams = {
  source: string;
  message: string | null | undefined;
  scope?: ClientErrorScope;
  severity?: ClientErrorSeverity;
  route?: string | null;
  endpoint?: string | null;
  requestId?: string | null;
  statusCode?: number | null;
  metadata?: JsonObject;
};

const normalizeText = (value: string | null | undefined, maxLength = 600): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  return trimmed.slice(0, maxLength);
};

const currentRoute = (): string | null => {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}`.slice(0, 300);
};

const safeSerialize = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? null) ?? "";
  } catch {
    return "";
  }
};

/**
 * Reports a visible error message as an app-error event.
 */
export const useVisibleErrorTelemetry = ({
  source,
  message,
  scope = "app",
  severity = "medium",
  route,
  endpoint,
  requestId,
  statusCode,
  metadata,
}: UseVisibleErrorTelemetryParams): void => {
  const lastSignatureRef = useRef<string | null>(null);
  const normalizedMessage = normalizeText(message);
  const metadataJson = safeSerialize(metadata ?? {});

  useEffect(() => {
    if (process.env.NODE_ENV === "test") return;

    if (!normalizedMessage) {
      lastSignatureRef.current = null;
      return;
    }

    const resolvedRoute = normalizeText(route, 300) ?? currentRoute();
    const signature = [
      source,
      scope,
      severity,
      normalizedMessage,
      normalizeText(endpoint, 400) ?? "",
      normalizeText(requestId, 120) ?? "",
      String(typeof statusCode === "number" ? Math.trunc(statusCode) : ""),
      resolvedRoute ?? "",
      metadataJson,
    ].join("|");

    if (lastSignatureRef.current === signature) return;
    lastSignatureRef.current = signature;

    const payload: ClientAppErrorEvent = {
      source,
      scope,
      severity,
      message: normalizedMessage,
      route: resolvedRoute,
      endpoint: normalizeText(endpoint, 400),
      requestId: normalizeText(requestId, 120),
      statusCode: typeof statusCode === "number" ? Math.trunc(statusCode) : null,
      metadata: metadata ?? {},
    };
    void reportAppError(payload);
  }, [
    endpoint,
    metadata,
    metadataJson,
    normalizedMessage,
    requestId,
    route,
    scope,
    severity,
    source,
    statusCode,
  ]);
};
