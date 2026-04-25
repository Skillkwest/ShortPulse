import type { NextApiRequest } from "next";
import { parseBearerToken, type AuthenticatedApiUser } from "./authTokenVerifier";

type SupabaseAuthUserUpdateParams = {
  req: NextApiRequest;
  payload: Record<string, unknown>;
};

export const MAX_ACCOUNT_DISPLAY_NAME_LENGTH = 80;

export const resolveAuthDisplayName = (
  user: Pick<AuthenticatedApiUser, "user_metadata" | "email">
): string | null => {
  const userMetadata = user.user_metadata ?? {};
  const rawValue = userMetadata.display_name ?? userMetadata.full_name ?? null;
  if (typeof rawValue !== "string") return null;
  const normalized = rawValue.trim();
  return normalized.length > 0 ? normalized : null;
};

export const normalizeDisplayNameInput = (value: unknown): string => {
  return typeof value === "string" ? value.trim().slice(0, MAX_ACCOUNT_DISPLAY_NAME_LENGTH) : "";
};

export const normalizeEmailInput = (value: unknown): string => {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
};

export const isValidEmailAddress = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

export const updateSupabaseAuthUser = async ({
  req,
  payload,
}: SupabaseAuthUserUpdateParams): Promise<Record<string, unknown>> => {
  const token = parseBearerToken(req.headers.authorization);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase auth is not configured.");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as {
    error_description?: string;
    msg?: string;
    message?: string;
  } & Record<string, unknown>;

  if (!response.ok) {
    throw new Error(
      data.error_description || data.msg || data.message || "Unable to update account identity."
    );
  }

  return data;
};
