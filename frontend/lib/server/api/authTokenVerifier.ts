/**
 * Token verification helpers for API route auth boundaries.
 * This module is the single source of truth for bearer parsing and Supabase
 * /auth/v1/user verification in server routes.
 */
import type { NextApiRequest } from "next";

export type AuthenticatedApiUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

/**
 * Parses a bearer token from an Authorization header.
 */
export const parseBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) return null;
  const [scheme, value] = authorizationHeader.split(" ");
  if (!scheme || !value) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return value.trim() || null;
};

/**
 * Calls Supabase auth to verify a bearer token and resolve the authenticated principal.
 */
export const fetchSupabaseUser = async (token: string): Promise<AuthenticatedApiUser | null> => {
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
 * Resolves a verified principal from request bearer auth.
 */
export const verifyBearerRequestUser = async (
  req: NextApiRequest
): Promise<AuthenticatedApiUser | null> => {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) return null;

  try {
    return await fetchSupabaseUser(token);
  } catch {
    return null;
  }
};
