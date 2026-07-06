/**
 * Browser fetch helper that attaches the current Supabase access token.
 * Use this for authenticated API routes so server handlers can enforce session checks.
 */
import { readSupabaseAccessToken } from "./supabaseClient";
import { reportAppError } from "./appErrorReporter";
import type { ClientErrorSeverity } from "./appErrorReporter";
import { addBreadcrumb, redactUrlForTelemetry } from "./clientBreadcrumbs";

export type ShortPulseFetchInit = RequestInit & {
  shortpulseLogScope?: "app" | "generation";
  shortpulseSkipErrorLogging?: boolean;
  shortpulseAuthTimeoutMs?: number;
  shortpulseRetryNetworkOnce?: boolean;
  shortpulseRetryAuth401?: boolean;
  shortpulseNetworkErrorSeverity?: ClientErrorSeverity;
};

export const AUTH_SESSION_TIMEOUT_CODE = "AUTH_SESSION_TIMEOUT" as const;
export const AUTH_REQUIRED_CODE = "AUTH_REQUIRED" as const;

export type AuthSessionTimeoutError = Error & {
  code: typeof AUTH_SESSION_TIMEOUT_CODE;
  timeoutMs: number;
};

export type AuthRequiredError = Error & {
  code: typeof AUTH_REQUIRED_CODE;
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

const createAuthRequiredError = (): AuthRequiredError => {
  const error = new Error("You must be signed in to call this endpoint.") as AuthRequiredError;
  error.code = AUTH_REQUIRED_CODE;
  return error;
};

export const isAuthSessionTimeoutError = (error: unknown): error is AuthSessionTimeoutError => {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === AUTH_SESSION_TIMEOUT_CODE;
};

export const isAuthRequiredError = (error: unknown): error is AuthRequiredError => {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === AUTH_REQUIRED_CODE;
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

const readAccessToken = async (options?: {
  timeoutMs?: number;
  forceRefresh?: boolean;
}): Promise<string | null> => {
  try {
    const timeoutMs = options?.timeoutMs;
    const accessTokenPromise = readSupabaseAccessToken({
      forceRefresh: options?.forceRefresh === true,
    });
    return typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0
      ? await withTimeout(accessTokenPromise, timeoutMs)
      : await accessTokenPromise;
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
  if (/^\/api\/admin\/billing-diagnostics(?:\?|$)/.test(endpoint) && status === 404) {
    return false;
  }
  if (scope === "generation") return status >= 400;
  return status >= 400;
};

const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { name?: unknown; message?: unknown };
  if (maybeError.name === "AbortError") return true;
  if (typeof maybeError.message !== "string") return false;
  return /\babort(?:ed)?\b/i.test(maybeError.message);
};

/**
 * Executes `fetch` with a bearer token from the active Supabase session.
 */
export const fetchWithAuth = async (
  input: RequestInfo | URL,
  init?: ShortPulseFetchInit
): Promise<Response> => {
  const timeoutMs = init?.shortpulseAuthTimeoutMs;
  let token = await readAccessToken({ timeoutMs });
  if (!token) {
    token = await readAccessToken({ timeoutMs, forceRefresh: true });
  }
  if (!token) {
    throw createAuthRequiredError();
  }

  const endpoint = normalizeEndpoint(input);
  const scope = init?.shortpulseLogScope ?? "app";
  const skipErrorLogging = Boolean(init?.shortpulseSkipErrorLogging);
  const retryNetworkOnce = Boolean(init?.shortpulseRetryNetworkOnce);
  const retryAuth401 = init?.shortpulseRetryAuth401 !== false;
  const networkErrorSeverity = init?.shortpulseNetworkErrorSeverity ?? "high";

  const headers = asHeaders(init?.headers);
  const callerProvidedAuthorization = headers.has("Authorization");
  if (!callerProvidedAuthorization) {
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
  delete (requestInit as ShortPulseFetchInit).shortpulseRetryNetworkOnce;
  delete (requestInit as ShortPulseFetchInit).shortpulseRetryAuth401;
  delete (requestInit as ShortPulseFetchInit).shortpulseNetworkErrorSeverity;
  const startedAt = Date.now();
  const method = (requestInit.method ?? "GET").toString().toUpperCase();
  const breadcrumbEndpoint = redactUrlForTelemetry(endpoint);

  const executeRequest = async (requestHeaders: Headers): Promise<Response> =>
    await fetch(input, {
      ...requestInit,
      headers: new Headers(requestHeaders),
    });

  const executeWithAuthRefresh = async (): Promise<Response> => {
    let response = await executeRequest(headers);
    if (response.status === 401 && retryAuth401 && !callerProvidedAuthorization) {
      const refreshedToken = await readAccessToken({ timeoutMs, forceRefresh: true });
      if (refreshedToken) {
        const retryHeaders = new Headers(headers);
        retryHeaders.set("Authorization", `Bearer ${refreshedToken}`);
        response = await executeRequest(retryHeaders);
      }
    }
    return response;
  };

  try {
    let response: Response;
    try {
      response = await executeWithAuthRefresh();
    } catch (error) {
      if (!retryNetworkOnce || isAbortError(error)) {
        throw error;
      }
      response = await executeWithAuthRefresh();
    }

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
    const aborted = isAbortError(error);
    addBreadcrumb({
      type: "network",
      level: aborted ? "info" : "error",
      message: aborted ? "fetch_aborted" : "fetch_error",
      data: {
        method,
        endpoint: breadcrumbEndpoint,
        duration_ms: Date.now() - startedAt,
        request_id: requestId,
      },
    });

    if (!aborted && !skipErrorLogging && !endpoint.includes("/api/log/client-error")) {
      void reportAppError({
        source: "client.api_network",
        scope,
        severity: networkErrorSeverity,
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
