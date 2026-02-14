/**
 * Server-side helpers for validating Supabase bearer tokens in API routes.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { isProtectedApiPath } from "./protectedApiPaths";

export type AuthenticatedApiUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

const parseBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) return null;
  const [scheme, value] = authorizationHeader.split(" ");
  if (!scheme || !value) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return value.trim() || null;
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

const getProxyAuthenticatedUser = (req: NextApiRequest): AuthenticatedApiUser | null => {
  const pathname = parsePathname(req.url);
  if (!pathname || !isProtectedApiPath(pathname)) return null;

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

const fetchSupabaseUser = async (token: string): Promise<AuthenticatedApiUser | null> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) return null;
  const data = (await response.json()) as AuthenticatedApiUser;
  if (!data?.id) return null;
  return data;
};

/**
 * Attempts to resolve an authenticated user without writing an HTTP response.
 */
export const getOptionalApiUser = async (
  req: NextApiRequest
): Promise<AuthenticatedApiUser | null> => {
  const userFromProxy = getProxyAuthenticatedUser(req);
  if (userFromProxy) return userFromProxy;

  const token = parseBearerToken(req.headers.authorization);
  if (!token) return null;
  try {
    return await fetchSupabaseUser(token);
  } catch {
    return null;
  }
};

/**
 * Returns the authenticated Supabase user or sends a 401 response.
 */
export const requireApiUser = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthenticatedApiUser | null> => {
  const userFromProxy = getProxyAuthenticatedUser(req);
  if (userFromProxy) return userFromProxy;

  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const user = await fetchSupabaseUser(token);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return user;
};

const adminRolesFromAppMetadata = (user: AuthenticatedApiUser): string[] => {
  const appRole = user.app_metadata?.role;
  const appRoles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
  return [appRole, ...appRoles].filter(Boolean).map((value) => String(value).toLowerCase());
};

/**
 * Determines if the user is an operator/admin.
 */
export const isAdminUser = (user: AuthenticatedApiUser): boolean => {
  const normalizedRoles = adminRolesFromAppMetadata(user);
  if (normalizedRoles.includes("admin") || normalizedRoles.includes("operator")) {
    return true;
  }

  const configuredEmails =
    process.env.SHORTPULSE_ADMIN_EMAILS?.split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean) ?? [];
  const userEmail = user.email?.trim().toLowerCase();
  return Boolean(userEmail && configuredEmails.includes(userEmail));
};

/**
 * Returns an authenticated admin user or sends a 403 response.
 */
export const requireAdminUser = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthenticatedApiUser | null> => {
  const user = await requireApiUser(req, res);
  if (!user) return null;
  if (!isAdminUser(user)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return user;
};
