/**
 * Browser-local auth invalidation markers for protected-route restore checks.
 * Stores only non-sensitive timestamps; never store identity, tokens, URLs, or project data here.
 */
import type { Session } from "@supabase/supabase-js";

const AUTH_LOGOUT_EPOCH_KEY = "shortpulse.auth.logoutEpoch";

const canUseLocalStorage = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const readStorageValue = (key: string): string | null => {
  if (!canUseLocalStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorageValue = (key: string, value: string): void => {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Best-effort marker only; protected-route restore still force-refreshes session state.
  }
};

const removeStorageValue = (key: string): void => {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Best-effort cleanup only.
  }
};

const parseEpochMs = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const decodeBase64UrlJson = (value: string): Record<string, unknown> | null => {
  if (typeof globalThis.atob !== "function") return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(globalThis.atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const resolveSessionIssuedAtMs = (session: Session | null): number | null => {
  const token = session?.access_token;
  if (!token) return null;
  const [, payload] = token.split(".");
  if (!payload) return null;
  const decoded = decodeBase64UrlJson(payload);
  const issuedAtSeconds = decoded?.iat;
  return typeof issuedAtSeconds === "number" && Number.isFinite(issuedAtSeconds)
    ? Math.trunc(issuedAtSeconds * 1000)
    : null;
};

/**
 * Marks the local browser as having intentionally ended authenticated authority.
 */
export const markAuthSessionLoggedOut = (epochMs: number = Date.now()): number => {
  const normalizedEpoch = Math.max(1, Math.trunc(epochMs));
  writeStorageValue(AUTH_LOGOUT_EPOCH_KEY, String(normalizedEpoch));
  return normalizedEpoch;
};

/**
 * Reads the latest local logout epoch if one exists.
 */
export const readAuthSessionLogoutEpoch = (): number | null =>
  parseEpochMs(readStorageValue(AUTH_LOGOUT_EPOCH_KEY));

/**
 * Clears the logout marker once a session issued after the marker is proven.
 */
export const clearAuthSessionLogoutEpoch = (): void => {
  removeStorageValue(AUTH_LOGOUT_EPOCH_KEY);
};

/**
 * Determines whether a session predates the local logout marker.
 */
export const isSessionOlderThanLogoutEpoch = (session: Session | null): boolean => {
  const logoutEpochMs = readAuthSessionLogoutEpoch();
  if (logoutEpochMs == null) return false;
  const issuedAtMs = resolveSessionIssuedAtMs(session);
  if (issuedAtMs == null) return true;
  return issuedAtMs <= logoutEpochMs;
};

/**
 * Clears the marker only when a session was issued after the latest logout.
 */
export const clearLogoutEpochWhenSessionIsFresh = (session: Session | null): void => {
  const logoutEpochMs = readAuthSessionLogoutEpoch();
  if (logoutEpochMs == null || !session) return;
  const issuedAtMs = resolveSessionIssuedAtMs(session);
  if (issuedAtMs != null && issuedAtMs > logoutEpochMs) {
    clearAuthSessionLogoutEpoch();
  }
};
