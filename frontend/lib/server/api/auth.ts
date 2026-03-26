/**
 * Server-side route-auth orchestration.
 * Bearer verification is authoritative; proxy headers are advisory metadata only.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { mergeVerifiedUserWithProxyContext, readProxyAuthenticatedUser } from "./authProxyContext";
import {
  parseBearerToken,
  verifyBearerRequestUser,
  type AuthenticatedApiUser,
} from "./authTokenVerifier";

export type { AuthenticatedApiUser } from "./authTokenVerifier";
export type AdminAccessVia = "role" | "allowlist" | "none";

const resolveVerifiedApiUser = async (
  req: NextApiRequest
): Promise<AuthenticatedApiUser | null> => {
  const verifiedUser = await verifyBearerRequestUser(req);
  if (!verifiedUser) return null;

  const proxyUser = readProxyAuthenticatedUser(req);
  return mergeVerifiedUserWithProxyContext(verifiedUser, proxyUser);
};

/**
 * Attempts to resolve an authenticated user without writing an HTTP response.
 */
export const getOptionalApiUser = async (
  req: NextApiRequest
): Promise<AuthenticatedApiUser | null> => {
  const verifiedUser = await resolveVerifiedApiUser(req);
  if (verifiedUser) return verifiedUser;

  return null;
};

/**
 * Returns the authenticated Supabase user or sends a 401 response.
 */
export const requireApiUser = async (
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AuthenticatedApiUser | null> => {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const user = await resolveVerifiedApiUser(req);
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
 * Resolves admin access source for a verified user.
 */
export const resolveAdminAccessVia = (user: AuthenticatedApiUser): AdminAccessVia => {
  const normalizedRoles = adminRolesFromAppMetadata(user);
  if (normalizedRoles.includes("admin") || normalizedRoles.includes("operator")) {
    return "role";
  }

  const configuredEmails =
    process.env.SHORTPULSE_ADMIN_EMAILS?.split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean) ?? [];
  const userEmail = user.email?.trim().toLowerCase();
  if (userEmail && configuredEmails.includes(userEmail)) {
    return "allowlist";
  }

  return "none";
};

/**
 * Determines if the user is an operator/admin.
 */
export const isAdminUser = (user: AuthenticatedApiUser): boolean => {
  return resolveAdminAccessVia(user) !== "none";
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
