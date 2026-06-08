/**
 * Token verification helpers for API route auth boundaries.
 * This module is the single source of truth for bearer parsing and Supabase
 * /auth/v1/user verification in server routes.
 */
import type { NextApiRequest } from "next";

export const AUTH_VERIFICATION_UNAVAILABLE_CODE = "AUTH_VERIFICATION_UNAVAILABLE" as const;

export type AuthVerificationUnavailableError = Error & {
  code: typeof AUTH_VERIFICATION_UNAVAILABLE_CODE;
  statusCode: number | null;
};

export type AuthenticatedApiUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

type VerifiedUserCacheEntry = {
  user: AuthenticatedApiUser;
  expiresAtMs: number;
};

export const SUPABASE_USER_VERIFICATION_CACHE_TTL_MS = 5_000;
const SUPABASE_USER_VERIFICATION_CACHE_MAX_ENTRIES = 128;
const SUPABASE_USER_VERIFICATION_TIMEOUT_MS = 8_000;

const verifiedUserCache = new Map<string, VerifiedUserCacheEntry>();
const inFlightUserLookups = new Map<string, Promise<AuthenticatedApiUser | null>>();

const createAuthVerificationUnavailableError = (
  message: string,
  statusCode: number | null = null
): AuthVerificationUnavailableError => {
  const error = new Error(message) as AuthVerificationUnavailableError;
  error.code = AUTH_VERIFICATION_UNAVAILABLE_CODE;
  error.statusCode = statusCode;
  return error;
};

export const isAuthVerificationUnavailableError = (
  error: unknown
): error is AuthVerificationUnavailableError => {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === AUTH_VERIFICATION_UNAVAILABLE_CODE;
};

/**
 * Parses a bearer token from an Authorization header.
 */
export const parseBearerToken = (authorizationHeader: string | null | undefined): string | null => {
  if (!authorizationHeader) return null;
  const [scheme, value] = authorizationHeader.split(" ");
  if (!scheme || !value) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return value.trim() || null;
};

const readCachedVerifiedUser = (token: string): AuthenticatedApiUser | null => {
  const cached = verifiedUserCache.get(token);
  if (!cached) return null;
  if (cached.expiresAtMs <= Date.now()) {
    verifiedUserCache.delete(token);
    return null;
  }
  return cached.user;
};

const writeCachedVerifiedUser = (token: string, user: AuthenticatedApiUser): void => {
  verifiedUserCache.delete(token);
  verifiedUserCache.set(token, {
    user,
    expiresAtMs: Date.now() + SUPABASE_USER_VERIFICATION_CACHE_TTL_MS,
  });

  while (verifiedUserCache.size > SUPABASE_USER_VERIFICATION_CACHE_MAX_ENTRIES) {
    const oldestKey = verifiedUserCache.keys().next().value;
    if (!oldestKey) break;
    verifiedUserCache.delete(oldestKey);
  }
};

/**
 * Clears verification cache state so tests can isolate auth behavior.
 */
export const resetSupabaseUserVerificationCache = (): void => {
  verifiedUserCache.clear();
  inFlightUserLookups.clear();
};

/**
 * Calls Supabase auth to verify a bearer token and resolve the authenticated principal.
 */
export const fetchSupabaseUser = async (token: string): Promise<AuthenticatedApiUser | null> => {
  const cachedUser = readCachedVerifiedUser(token);
  if (cachedUser) {
    return cachedUser;
  }

  const inFlightLookup = inFlightUserLookups.get(token);
  if (inFlightLookup) {
    return await inFlightLookup;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw createAuthVerificationUnavailableError("Authentication verification is unavailable.");
  }

  const pendingLookup = (async () => {
    let response: Response;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, SUPABASE_USER_VERIFICATION_TIMEOUT_MS);
    try {
      response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: "GET",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`,
        },
        signal: abortController.signal,
      });
    } catch {
      throw createAuthVerificationUnavailableError(
        "Authentication verification is temporarily unavailable."
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) {
      throw createAuthVerificationUnavailableError(
        "Authentication verification is temporarily unavailable.",
        response.status
      );
    }
    const data = (await response.json()) as AuthenticatedApiUser;
    if (!data?.id) return null;
    writeCachedVerifiedUser(token, data);
    return data;
  })().finally(() => {
    inFlightUserLookups.delete(token);
  });

  inFlightUserLookups.set(token, pendingLookup);
  return await pendingLookup;
};

/**
 * Resolves a verified principal from request bearer auth.
 */
export const verifyBearerRequestUser = async (
  req: NextApiRequest
): Promise<AuthenticatedApiUser | null> => {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) return null;
  return await fetchSupabaseUser(token);
};
