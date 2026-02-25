/**
 * Browser fetch helper that attaches the current Supabase access token.
 * Use this for authenticated API routes so server handlers can enforce session checks.
 */
import { ensureSupabaseClient } from "./supabaseClient";
import { reportAppError } from "./appErrorReporter";
import { addBreadcrumb, redactUrlForTelemetry } from "./clientBreadcrumbs";

export type ShortPulseFetchInit = RequestInit & {
  shortpulseLogScope?: "app" | "generation";
  shortpulseSkipErrorLogging?: boolean;
  shortpulseAuthTimeoutMs?: number;
};

export const AUTH_SESSION_TIMEOUT_CODE = "AUTH_SESSION_TIMEOUT" as const;

export type AuthSessionTimeoutError = Error & {
  code: typeof AUTH_SESSION_TIMEOUT_CODE;
  timeoutMs: number;
};

const asHeaders = (headers?: HeadersInit): Headers => {
  if (headers instanceof Headers) return new Headers(headers);
  return new Headers(headers ?? {});
};

const buildRequestId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const createAuthSessionTimeoutError = (timeoutMs: number): AuthSessionTimeoutError => {
  const error = new Error(
    `Timed out resolving auth session after ${Math.max(0, Math.trunc(timeoutMs))}ms.`
  ) as AuthSessionTimeoutError;
  error.code = AUTH_SESSION_TIMEOUT_CODE;
  error.timeoutMs = Math.max(0, Math.trunc(timeoutMs));
  return error;
};

export const isAuthSessionTimeoutError = (error: unknown): error is AuthSessionTimeoutError => {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === AUTH_SESSION_TIMEOUT_CODE;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  await new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(createAuthSessionTimeoutError(timeoutMs));
    }, timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });

const readAccessToken = async (timeoutMs?: number): Promise<string | null> => {
  try {
    const supabase = ensureSupabaseClient();
    const sessionPromise = supabase.auth.getSession();
    const authSession =
      typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0
        ? await withTimeout(sessionPromise, timeoutMs)
        : await sessionPromise;
    const { data, error } = authSession;
    if (error) return null;
    return data.session?.access_token ?? null;
  } catch (error) {
    if (isAuthSessionTimeoutError(error)) {
      throw error;
    }
    return null;
  }
};

const resolvePath = (input: RequestInfo | URL): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return `${input.pathname}${input.search}`;
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return String(input);
};

const normalizeEndpoint = (input: RequestInfo | URL): string => {
  const resolved = resolvePath(input);
  if (resolved.startsWith("/")) return resolved;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const parsed = new URL(resolved, base);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return resolved;
  }
};

const shouldLogHttpFailure = (
  scope: "app" | "generation",
  endpoint: string,
  status: number
): boolean => {
  if (!Number.isFinite(status)) return false;
  // Admin routes can return 401/403 during expected auth/session transitions.
  // Keep these in UI/network breadcrumbs, but avoid escalating as incidents.
  if (endpoint.startsWith("/api/admin") && (status === 401 || status === 403)) {
    return false;
  }
  if (scope === "generation") return status >= 400;
  return status >= 400;
};

/**
 * Executes `fetch` with a bearer token from the active Supabase session.
 */
export const fetchWithAuth = async (
  input: RequestInfo | URL,
  init?: ShortPulseFetchInit
): Promise<Response> => {
  const token = await readAccessToken(init?.shortpulseAuthTimeoutMs);
  if (!token) {
    throw new Error("You must be signed in to call this endpoint.");
  }

  const endpoint = normalizeEndpoint(input);
  const scope = init?.shortpulseLogScope ?? "app";
  const skipErrorLogging = Boolean(init?.shortpulseSkipErrorLogging);

  const headers = asHeaders(init?.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("x-shortpulse-request-id")) {
    headers.set("x-shortpulse-request-id", buildRequestId());
  }

  const requestId = headers.get("x-shortpulse-request-id");
  const requestInit: RequestInit = { ...(init ?? {}) };
  delete (requestInit as ShortPulseFetchInit).shortpulseLogScope;
  delete (requestInit as ShortPulseFetchInit).shortpulseSkipErrorLogging;
  delete (requestInit as ShortPulseFetchInit).shortpulseAuthTimeoutMs;
  const startedAt = Date.now();
  const method = (requestInit.method ?? "GET").toString().toUpperCase();
  const breadcrumbEndpoint = redactUrlForTelemetry(endpoint);

  try {
    const response = await fetch(input, {
      ...requestInit,
      headers,
    });

    addBreadcrumb({
      type: "network",
      level: response.ok ? "info" : response.status >= 500 ? "error" : "warn",
      message: "fetch",
      data: {
        method,
        endpoint: breadcrumbEndpoint,
        status: response.status,
        duration_ms: Date.now() - startedAt,
        request_id: requestId,
      },
    });

    if (
      !skipErrorLogging &&
      shouldLogHttpFailure(scope, endpoint, response.status) &&
      !endpoint.includes("/api/log/client-error")
    ) {
      void reportAppError({
        source: "client.api_response",
        scope,
        severity: response.status >= 502 ? "high" : response.status >= 500 ? "medium" : "low",
        message: `API ${response.status} response from ${endpoint}`,
        endpoint,
        requestId,
        statusCode: response.status,
        route: typeof window !== "undefined" ? window.location.pathname : null,
        metadata: {
          method,
        },
      });
    }

    return response;
  } catch (error) {
    addBreadcrumb({
      type: "network",
      level: "error",
      message: "fetch_error",
      data: {
        method,
        endpoint: breadcrumbEndpoint,
        duration_ms: Date.now() - startedAt,
        request_id: requestId,
      },
    });

    if (!skipErrorLogging && !endpoint.includes("/api/log/client-error")) {
      void reportAppError({
        source: "client.api_network",
        scope,
        severity: "high",
        message: error instanceof Error ? error.message : "Network request failed",
        stack: error instanceof Error ? error.stack : null,
        endpoint,
        requestId,
        route: typeof window !== "undefined" ? window.location.pathname : null,
        metadata: {
          method,
        },
      });
    }
    throw error;
  }
};
