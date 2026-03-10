/**
 * User-scoped localStorage helpers for Character Manager client persistence.
 * Keeps per-user UI preferences isolated on shared browsers.
 */

/**
 * Builds a user-scoped storage key.
 * Falls back to the base key when no user id is available.
 */
export const buildUserScopedStorageKey = (
  baseKey: string,
  userId: string | null | undefined
): string => {
  const normalizedUserId = (userId ?? "").trim();
  if (!normalizedUserId) return baseKey;
  return `${baseKey}:${normalizedUserId}`;
};

/**
 * Reads a raw string value from localStorage.
 * Returns null when unavailable or inaccessible.
 */
export const readLocalStorageValue = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

/**
 * Writes a raw string value to localStorage.
 * No-ops when localStorage is unavailable.
 */
export const writeLocalStorageValue = (key: string, value: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore write failures so UI state can continue in-memory.
  }
};

/**
 * Removes a key from localStorage.
 * No-ops when localStorage is unavailable.
 */
export const removeLocalStorageValue = (key: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore remove failures so UI state can continue in-memory.
  }
};
