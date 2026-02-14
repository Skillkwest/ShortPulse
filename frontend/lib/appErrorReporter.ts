/**
 * Browser-side reporter for actionable application failures.
 * Sends structured events to `/api/log/client-error` for admin triage.
 */
import { ensureSupabaseClient } from "./supabaseClient";
import { getBreadcrumbsSnapshot } from "./clientBreadcrumbs";

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

const isFastRefreshNoise = (event: ClientAppErrorEvent): boolean => {
  // Only suppress in development. In production, we want to see everything.
  if (process.env.NODE_ENV !== "development") return false;

  const message = (normalizeText(event.message) ?? "").toLowerCase();
  const stack = (normalizeText(event.stack ?? "", 8000) ?? "").toLowerCase();
  const metaFilename = normalizeText(
    (event.metadata as { filename?: unknown } | undefined)?.filename,
    400
  );

  const haystack = `${message}\n${stack}`;

  // Next/React Fast Refresh commonly surfaces hook-state invariants during HMR.
  const hasReactRefreshFrames =
    haystack.includes("react-refresh") ||
    haystack.includes("performreactrefresh") ||
    haystack.includes("schedulerefresh") ||
    haystack.includes("@next/react-refresh-utils") ||
    haystack.includes("_next/static/chunks/webpack") ||
    haystack.includes("webpack-internal:///./node_modules/next/dist/compiled/react-refresh");

  if (!hasReactRefreshFrames) return false;

  // Narrow further to the common dev-only hook queue invariant we saw in incidents.
  const looksLikeHookQueueInvariant =
    message.includes("should have a queue") || stack.includes("should have a queue");

  if (looksLikeHookQueueInvariant) return true;

  // If we have react-refresh frames and the error originates from the refresh runtime file,
  // treat it as non-actionable dev noise.
  if (typeof metaFilename === "string" && /react-refresh|webpack|hot-update/i.test(metaFilename)) {
    return true;
  }

  return false;
};

const shouldSkip = (event: ClientAppErrorEvent): boolean => {
  const scope = event.scope ?? "app";
  if (isFastRefreshNoise(event)) return true;

  const message = normalizeText(event.message) ?? "Unknown runtime error";
  const endpoint = endpointPath(event.endpoint);
  if (endpoint?.includes("/api/log/client-error")) return true;

  if (typeof event.statusCode === "number" && Number.isFinite(event.statusCode)) {
    const statusCode = event.statusCode;
    if (scope === "app" && statusCode < 400) {
      return true;
    }
    if (scope === "generation" && statusCode < 400) {
      return true;
    }
  }

  if (
    scope === "app" &&
    event.source === "client.api_network" &&
    /aborterror|aborted/i.test(message)
  ) {
    return true;
  }

  return false;
};

const resolveClientReleaseMetadata = (): JsonObject => ({
  client_release:
    normalizeText(process.env.NEXT_PUBLIC_SHORTPULSE_RELEASE, 120) ??
    normalizeText(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA, 120) ??
    null,
  client_environment:
    normalizeText(process.env.NEXT_PUBLIC_VERCEL_ENV, 80) ??
    normalizeText(process.env.NODE_ENV, 80) ??
    null,
});

const resolveClientRuntimeMetadata = (): JsonObject => {
  if (typeof window === "undefined") {
    return {
      build_id: null,
      session_id: null,
      is_secure_context: null,
      visibility_state: null,
    };
  }

  const nextData = (window as unknown as { __NEXT_DATA__?: { buildId?: unknown } }).__NEXT_DATA__;
  const buildId = normalizeText(nextData?.buildId, 120);

  let sessionId: string | null = null;
  try {
    const stored = window.sessionStorage.getItem("sp_session_id");
    if (stored) {
      sessionId = stored;
    } else if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      sessionId = crypto.randomUUID();
      window.sessionStorage.setItem("sp_session_id", sessionId);
    } else {
      sessionId = `sp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem("sp_session_id", sessionId);
    }
  } catch {
    sessionId = null;
  }

  return {
    build_id: buildId,
    session_id: sessionId,
    is_secure_context: typeof window.isSecureContext === "boolean" ? window.isSecureContext : null,
    visibility_state:
      typeof document !== "undefined" ? normalizeText(document.visibilityState, 40) : null,
  };
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
      metadata: {
        ...resolveClientReleaseMetadata(),
        ...resolveClientRuntimeMetadata(),
        breadcrumbs: getBreadcrumbsSnapshot(),
        ...(event.metadata ?? {}),
      },
      occurredAt: event.occurredAt ?? new Date().toISOString(),
    }),
    keepalive: true,
  });
};

/**
 * Reports one client-side app error event when it is actionable.
 */
export const reportAppError = async (event: ClientAppErrorEvent): Promise<void> => {
  try {
    if (shouldSkip(event)) return;
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
