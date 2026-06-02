import type { NextApiRequest } from "next";

type HeaderValue = string | string[] | undefined;
type RuntimeEnvironment = "development" | "preview" | "production";

export const SHORTPULSE_PRODUCTION_APP_ORIGIN = "https://www.shortpulse.ai";
const SHORTPULSE_PRODUCTION_HOSTNAMES = new Set(["shortpulse.ai", "www.shortpulse.ai"]);
const LOOPBACK_ORIGIN = "http://localhost:3000";

const readHeaderValue = (value: HeaderValue): string | null => {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : null;
  }
  return typeof value === "string" ? value : null;
};

const readForwardedValue = (value: HeaderValue): string | null => {
  const header = readHeaderValue(value);
  if (!header) return null;
  const firstValue = header
    .split(",")
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0);
  return firstValue ?? null;
};

const isLoopbackHostname = (hostname: string): boolean =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1" ||
  hostname === "[::1]" ||
  hostname === "0.0.0.0";

const isApprovedProductionHostname = (hostname: string): boolean =>
  SHORTPULSE_PRODUCTION_HOSTNAMES.has(hostname.toLowerCase());

const normalizeOrigin = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const resolveConfiguredOrigin = (): string | null => {
  const appBaseUrl = process.env.APP_BASE_URL?.trim() ?? "";
  const publicApiBaseUrl = process.env.SHORTPULSE_PUBLIC_API_BASE_URL?.trim() ?? "";
  const normalizedAppBaseUrl = appBaseUrl ? normalizeOrigin(appBaseUrl) : null;
  const normalizedPublicApiBaseUrl = publicApiBaseUrl ? normalizeOrigin(publicApiBaseUrl) : null;

  if (appBaseUrl && !normalizedAppBaseUrl) {
    throw new Error("APP_BASE_URL must be a valid URL.");
  }
  if (publicApiBaseUrl && !normalizedPublicApiBaseUrl) {
    throw new Error("SHORTPULSE_PUBLIC_API_BASE_URL must be a valid URL.");
  }
  if (
    normalizedAppBaseUrl &&
    normalizedPublicApiBaseUrl &&
    normalizedAppBaseUrl !== normalizedPublicApiBaseUrl
  ) {
    throw new Error(
      "APP_BASE_URL and SHORTPULSE_PUBLIC_API_BASE_URL must match when both are configured."
    );
  }

  return normalizedAppBaseUrl ?? normalizedPublicApiBaseUrl ?? null;
};

const readRuntimeEnvironment = (options: {
  requestOrigin: string | null;
  configuredOrigin: string | null;
}): RuntimeEnvironment => {
  const vercelEnvironment = process.env.VERCEL_ENV?.trim().toLowerCase();
  if (
    vercelEnvironment === "development" ||
    vercelEnvironment === "preview" ||
    vercelEnvironment === "production"
  ) {
    return vercelEnvironment;
  }
  if (process.env.NODE_ENV === "production") {
    return "production";
  }

  const requestHostname = options.requestOrigin ? new URL(options.requestOrigin).hostname : null;
  if (requestHostname && isApprovedProductionHostname(requestHostname)) {
    return "production";
  }

  const configuredHostname = options.configuredOrigin
    ? new URL(options.configuredOrigin).hostname
    : null;
  if (configuredHostname && isApprovedProductionHostname(configuredHostname)) {
    return "production";
  }

  return "development";
};

const resolveRequestOrigin = (req: Pick<NextApiRequest, "headers">): string | null => {
  const host =
    readForwardedValue(req.headers["x-forwarded-host"]) ?? readHeaderValue(req.headers.host);
  if (!host) return null;
  const proto = readForwardedValue(req.headers["x-forwarded-proto"]) ?? "http";
  try {
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return null;
  }
};

export const readConfiguredPublicAppOrigin = (): string | null => resolveConfiguredOrigin();

export const getConfiguredPublicAppOrigin = (): string => {
  const configuredOrigin = resolveConfiguredOrigin();
  if (configuredOrigin) return configuredOrigin;
  if (process.env.NODE_ENV !== "production") {
    return LOOPBACK_ORIGIN;
  }
  throw new Error("A public app origin is not configured.");
};

export const resolvePublicAppOrigin = (req: Pick<NextApiRequest, "headers">): string | null => {
  const requestOrigin = resolveRequestOrigin(req);
  const configuredOrigin = resolveConfiguredOrigin();
  const runtimeEnvironment = readRuntimeEnvironment({
    requestOrigin,
    configuredOrigin,
  });

  if (runtimeEnvironment === "production") {
    const configuredHostname = configuredOrigin ? new URL(configuredOrigin).hostname : null;
    if (configuredHostname && isApprovedProductionHostname(configuredHostname)) {
      return SHORTPULSE_PRODUCTION_APP_ORIGIN;
    }

    const requestHostname = requestOrigin ? new URL(requestOrigin).hostname : null;
    if (requestHostname && isApprovedProductionHostname(requestHostname)) {
      return SHORTPULSE_PRODUCTION_APP_ORIGIN;
    }

    return null;
  }

  if (runtimeEnvironment === "preview") {
    if (requestOrigin && !isLoopbackHostname(new URL(requestOrigin).hostname)) {
      return requestOrigin;
    }
    return configuredOrigin ?? requestOrigin;
  }

  return requestOrigin ?? configuredOrigin ?? LOOPBACK_ORIGIN;
};
