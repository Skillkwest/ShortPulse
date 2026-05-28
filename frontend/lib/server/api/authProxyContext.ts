/**
 * Proxy-auth header extraction helpers.
 * These values are advisory metadata only and must never be treated as
 * authorization authority without verified bearer identity.
 */
import type { NextApiRequest } from "next";
import { isProtectedApiPath } from "./protectedApiPaths";

type ProxyAuthenticatedApiUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

const readRequestHeader = (req: NextApiRequest, name: string): string | null => {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return typeof raw === "string" ? raw : null;
};

const parsePathname = (url?: string): string | null => {
  if (!url) return null;
  try {
    return new URL(url, "http://localhost").pathname;
  } catch {
    return url.split("?")[0] ?? null;
  }
};

const parseJsonHeader = (value: string | null): Record<string, unknown> | undefined => {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

const isProtectedRequestPath = (req: NextApiRequest): boolean => {
  const pathname = parsePathname(req.url);
  return Boolean(pathname && isProtectedApiPath(pathname));
};

/**
 * Returns middleware-provided user context when available on protected routes.
 */
export const readProxyAuthenticatedUser = (
  req: NextApiRequest
): ProxyAuthenticatedApiUser | null => {
  if (!isProtectedRequestPath(req)) return null;

  const proxyAuthenticated = readRequestHeader(req, "x-shortpulse-authenticated");
  if (proxyAuthenticated !== "1") return null;

  const id = readRequestHeader(req, "x-shortpulse-user-id")?.trim();
  if (!id) return null;

  const email = readRequestHeader(req, "x-shortpulse-user-email")?.trim();
  const appMetadata = parseJsonHeader(readRequestHeader(req, "x-shortpulse-user-app-metadata"));
  const userMetadata = parseJsonHeader(readRequestHeader(req, "x-shortpulse-user-user-metadata"));

  return {
    id,
    email: email || undefined,
    app_metadata: appMetadata,
    user_metadata: userMetadata,
  };
};
