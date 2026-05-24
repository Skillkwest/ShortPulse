import type { NextApiRequest } from "next";
import { parseBearerToken, type AuthenticatedApiUser } from "./authTokenVerifier";

type SupabaseAuthUserUpdateParams = {
  req: NextApiRequest;
  emailRedirectTo?: string;
  payload: Record<string, unknown>;
};

type SupabasePasswordVerificationParams = {
  email: string;
  password: string;
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

export const verifySupabasePassword = async ({
  email,
  password,
}: SupabasePasswordVerificationParams): Promise<boolean> => {
  const normalizedEmail = normalizeEmailInput(email);
  const normalizedPassword = typeof password === "string" ? password : "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!normalizedEmail || !normalizedPassword || !supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase auth is not configured.");
  }

  const requestUrl = new URL(`${supabaseUrl}/auth/v1/token`);
  requestUrl.searchParams.set("grant_type", "password");

  const response = await fetch(requestUrl.toString(), {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: normalizedEmail,
      password: normalizedPassword,
    }),
  });

  if (response.ok) {
    return true;
  }

  const data = (await response.json().catch(() => ({}))) as {
    error_description?: string;
    msg?: string;
    message?: string;
    error?: string;
  };
  const normalizedMessage = [data.error_description, data.msg, data.message, data.error]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  if (
    response.status === 400 ||
    response.status === 401 ||
    normalizedMessage.includes("invalid login credentials") ||
    normalizedMessage.includes("invalid credentials") ||
    normalizedMessage.includes("invalid grant")
  ) {
    return false;
  }

  throw new Error("Unable to verify your current password.");
};

export const updateSupabaseAuthUser = async ({
  req,
  emailRedirectTo,
  payload,
}: SupabaseAuthUserUpdateParams): Promise<Record<string, unknown>> => {
  const token = parseBearerToken(req.headers.authorization);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase auth is not configured.");
  }

  const requestUrl = new URL(`${supabaseUrl}/auth/v1/user`);
  if (typeof emailRedirectTo === "string" && emailRedirectTo.trim().length > 0) {
    requestUrl.searchParams.set("redirect_to", emailRedirectTo.trim());
  }

  const response = await fetch(requestUrl.toString(), {
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
