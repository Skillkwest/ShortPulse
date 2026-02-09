/**
 * Browser-side reporter for actionable application failures.
 * Sends structured events to `/api/log/client-error` for admin triage.
 */
import { ensureSupabaseClient } from "./supabaseClient";

type JsonObject = Record<string, unknown>;

export type ClientErrorScope = "app" | "generation";
export type ClientErrorSeverity = "low" | "medium" | "high";

export type ClientAppErrorEvent = {
  source: string;
  scope?: ClientErrorScope;
  severity?: ClientErrorSeverity;
  message: string;
  stack?: string | null;
  route?: string | null;
  endpoint?: string | null;
  requestId?: string | null;
  statusCode?: number | null;
  metadata?: JsonObject;
  occurredAt?: string | null;
};

const MAX_MESSAGE_LENGTH = 600;
const THROTTLE_WINDOW_MS = 30_000;
const recentFingerprints = new Map<string, number>();
let listenersInstalled = false;

const normalizeText = (value: unknown, maxLength = MAX_MESSAGE_LENGTH): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  return trimmed.slice(0, maxLength);
};

const currentRoute = (): string | null => {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}`.slice(0, 300);
};

const resolveMessageAndStack = (error: unknown): { message: string; stack: string | null } => {
  if (error instanceof Error) {
    return {
      message: normalizeText(error.message) ?? "Unknown runtime error",
      stack: normalizeText(error.stack, 6000),
    };
  }
  if (typeof error === "string") {
    return { message: normalizeText(error) ?? "Unknown runtime error", stack: null };
  }
  if (error && typeof error === "object") {
    const maybeMessage = normalizeText((error as { message?: unknown }).message);
    return {
      message: maybeMessage ?? normalizeText(String(error)) ?? "Unknown runtime error",
      stack: null,
    };
  }
  return { message: "Unknown runtime error", stack: null };
};

const readAccessToken = async (): Promise<string | null> => {
  try {
    const supabase = ensureSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
};

const endpointPath = (endpoint: string | null | undefined): string | null => {
  const normalized = normalizeText(endpoint, 400);
  if (!normalized) return null;
  if (normalized.startsWith("/")) return normalized;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const parsed = new URL(normalized, base);
    return `${parsed.pathname}${parsed.search}`.slice(0, 400);
  } catch {
    return normalized;
  }
};

const shouldSkip = (event: ClientAppErrorEvent): boolean => {
  const scope = event.scope ?? "app";
  if (scope !== "app") return true;

  const message = normalizeText(event.message) ?? "Unknown runtime error";
  const endpoint = endpointPath(event.endpoint);
  if (endpoint?.includes("/api/log/client-error")) return true;

  if (typeof event.statusCode === "number" && Number.isFinite(event.statusCode) && event.statusCode < 500) {
    return true;
  }

  if (event.source === "client.api_network" && /aborterror|aborted/i.test(message)) {
    return true;
  }

  return false;
};

const buildFingerprint = (event: ClientAppErrorEvent): string => {
  const scope = event.scope ?? "app";
  const endpoint = endpointPath(event.endpoint) ?? "";
  const route = normalizeText(event.route) ?? currentRoute() ?? "";
  const message = normalizeText(event.message) ?? "unknown";
  const stackLine = normalizeText(event.stack ?? "", 300)?.split("\n")[0] ?? "";
  return [event.source, scope, endpoint, route, message, stackLine, String(event.statusCode ?? "")].join("|");
};

const throttleDuplicate = (fingerprint: string): boolean => {
  const now = Date.now();
  const previous = recentFingerprints.get(fingerprint);
  recentFingerprints.set(fingerprint, now);
  if (!previous) return false;
  return now - previous < THROTTLE_WINDOW_MS;
};

const reportToApi = async (event: ClientAppErrorEvent): Promise<void> => {
  const token = await readAccessToken();
  if (!token) return;

  const endpoint = "/api/log/client-error";
  await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      source: event.source,
      scope: event.scope ?? "app",
      severity: event.severity ?? "medium",
      message: normalizeText(event.message) ?? "Unknown runtime error",
      stack: normalizeText(event.stack ?? "", 6000),
      route: normalizeText(event.route) ?? currentRoute(),
      endpoint: endpointPath(event.endpoint),
      requestId: normalizeText(event.requestId, 120),
      statusCode: typeof event.statusCode === "number" ? Math.trunc(event.statusCode) : null,
      metadata: event.metadata ?? {},
      occurredAt: event.occurredAt ?? new Date().toISOString(),
    }),
    keepalive: true,
  });
};

/**
 * Reports one client-side app error if it is actionable and not recently duplicated.
 */
export const reportAppError = async (event: ClientAppErrorEvent): Promise<void> => {
  try {
    if (shouldSkip(event)) return;
    const fingerprint = buildFingerprint(event);
    if (throttleDuplicate(fingerprint)) return;
    await reportToApi(event);
  } catch {
    // Best-effort telemetry only.
  }
};

/**
 * Installs global browser handlers for uncaught runtime errors and rejected promises.
 */
export const installGlobalAppErrorHandlers = (): (() => void) => {
  if (typeof window === "undefined" || listenersInstalled) {
    return () => undefined;
  }

  const onError = (event: ErrorEvent) => {
    const resolved = resolveMessageAndStack(event.error ?? event.message);
    void reportAppError({
      source: "client.runtime",
      scope: "app",
      severity: "high",
      message: resolved.message,
      stack: resolved.stack,
      route: currentRoute(),
      metadata: {
        filename: normalizeText(event.filename, 260),
        lineno: event.lineno ?? null,
        colno: event.colno ?? null,
      },
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const resolved = resolveMessageAndStack(event.reason);
    void reportAppError({
      source: "client.unhandledrejection",
      scope: "app",
      severity: "high",
      message: resolved.message,
      stack: resolved.stack,
      route: currentRoute(),
    });
  };

  listenersInstalled = true;
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return () => {
    listenersInstalled = false;
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
};
