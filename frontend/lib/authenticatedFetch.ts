/**
 * Browser fetch helper that attaches the current Supabase access token.
 * Use this for authenticated API routes so server handlers can enforce session checks.
 */
import { ensureSupabaseClient } from "./supabaseClient";
import { reportAppError } from "./appErrorReporter";
import { addBreadcrumb, redactUrlForTelemetry } from "./clientBreadcrumbs";

type ShortPulseFetchInit = RequestInit & {
  shortpulseLogScope?: "app" | "generation";
  shortpulseSkipErrorLogging?: boolean;
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

/**
 * Executes `fetch` with a bearer token from the active Supabase session.
 */
export const fetchWithAuth = async (
  input: RequestInfo | URL,
  init?: ShortPulseFetchInit
): Promise<Response> => {
  const token = await readAccessToken();
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
      scope === "app" &&
      response.status >= 500 &&
      !endpoint.includes("/api/log/client-error")
    ) {
      void reportAppError({
        source: "client.api_response",
        scope: "app",
        severity: response.status >= 502 ? "high" : "medium",
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

    if (!skipErrorLogging && scope === "app" && !endpoint.includes("/api/log/client-error")) {
      void reportAppError({
        source: "client.api_network",
        scope: "app",
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
