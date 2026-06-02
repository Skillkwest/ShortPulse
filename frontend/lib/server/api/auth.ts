/**
 * Server-side route-auth orchestration.
 * Protected API routes must verify bearer identity server-side and may use
 * matching proxy headers only as advisory metadata after verification.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { readProxyAuthenticatedUser } from "./authProxyContext";
import {
  isAuthVerificationUnavailableError,
  parseBearerToken,
  verifyBearerRequestUser,
  type AuthenticatedApiUser,
} from "./authTokenVerifier";

export type { AuthenticatedApiUser } from "./authTokenVerifier";
export type AdminAccessVia = "role" | "none";
export type OptionalApiUserResult = {
  user: AuthenticatedApiUser | null;
  authVerificationUnavailable: boolean;
};

const resolveVerifiedApiUser = async (
  req: NextApiRequest
): Promise<AuthenticatedApiUser | null> => {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) return null;

  const verifiedUser = await verifyBearerRequestUser(req);
  if (!verifiedUser) return null;

  const proxyUser = readProxyAuthenticatedUser(req);
  if (proxyUser && proxyUser.id === verifiedUser.id) {
    return {
      ...verifiedUser,
      email: verifiedUser.email ?? proxyUser.email,
      app_metadata: verifiedUser.app_metadata ?? proxyUser.app_metadata,
      user_metadata: verifiedUser.user_metadata ?? proxyUser.user_metadata,
    };
  }

  return verifiedUser;
};

/**
 * Attempts to resolve an authenticated user without writing an HTTP response.
 */
export const getOptionalApiUser = async (
  req: NextApiRequest
): Promise<AuthenticatedApiUser | null> => {
  const result = await getOptionalApiUserResult(req);
  return result.user;
};

/**
 * Attempts to resolve an authenticated user without writing an HTTP response,
 * preserving whether verification was unavailable.
 */
export const getOptionalApiUserResult = async (
  req: NextApiRequest
): Promise<OptionalApiUserResult> => {
  try {
    const verifiedUser = await resolveVerifiedApiUser(req);
    return {
      user: verifiedUser,
      authVerificationUnavailable: false,
    };
  } catch (error) {
    if (isAuthVerificationUnavailableError(error)) {
      return {
        user: null,
        authVerificationUnavailable: true,
      };
    }
    throw error;
  }
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

  let user: AuthenticatedApiUser | null = null;
  try {
    user = await resolveVerifiedApiUser(req);
  } catch (error) {
    if (isAuthVerificationUnavailableError(error)) {
      res.status(503).json({
        error: "Authentication verification is temporarily unavailable.",
        code: "AUTH_VERIFICATION_UNAVAILABLE",
      });
      return null;
    }
    throw error;
  }
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
