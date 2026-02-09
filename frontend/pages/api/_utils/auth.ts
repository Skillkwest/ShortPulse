/**
 * Server-side helpers for validating Supabase bearer tokens in API routes.
 */
import type { NextApiRequest, NextApiResponse } from "next";

export type AuthenticatedApiUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
};

const parseBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) return null;
  const [scheme, value] = authorizationHeader.split(" ");
  if (!scheme || !value) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return value.trim() || null;
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
export const getOptionalApiUser = async (req: NextApiRequest): Promise<AuthenticatedApiUser | null> => {
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
  res: NextApiResponse,
): Promise<AuthenticatedApiUser | null> => {
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

const userRoles = (user: AuthenticatedApiUser): string[] => {
  const appRole = user.app_metadata?.role;
  const appRoles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
  const userRole = user.user_metadata?.role;
  const userRolesList = Array.isArray(user.user_metadata?.roles) ? user.user_metadata.roles : [];
  return [appRole, userRole, ...appRoles, ...userRolesList]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
};

/**
 * Determines if the user is an operator/admin.
 */
export const isAdminUser = (user: AuthenticatedApiUser): boolean => {
  const normalizedRoles = userRoles(user);
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
  res: NextApiResponse,
): Promise<AuthenticatedApiUser | null> => {
  const user = await requireApiUser(req, res);
  if (!user) return null;
  if (!isAdminUser(user)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return user;
};
