/**
 * Client session-key helpers for the AI agent hook.
 * Responsible for stable session identity across reloads and namespace changes.
 */
const AGENT_SESSION_STORAGE_KEY_PREFIX = "shortpulse.agent.clientSession.v2.";

/**
 * Create a random identifier for client trace/session usage.
 * Uses `crypto.randomUUID` when available and falls back to timestamp+random.
 */
export const randomId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `agent_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Build the per-namespace sessionStorage key.
 */
export const buildSessionStorageKey = (namespace: string): string =>
  `${AGENT_SESSION_STORAGE_KEY_PREFIX}${namespace.trim() || "default"}`;

/**
 * Load a previously persisted client session key from sessionStorage.
 */
export const loadSessionKey = (namespace: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(buildSessionStorageKey(namespace));
    return stored?.trim() ? stored.trim() : null;
  } catch {
    return null;
  }
};

/**
 * Persist a client session key to sessionStorage.
 */
export const persistSessionKey = (namespace: string, value: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(buildSessionStorageKey(namespace), value);
  } catch {
    // no-op: storage may be unavailable in privacy modes
  }
};

/**
 * Resolve the active client session key for a namespace, creating one if absent.
 * `seed` is used only when no prior key is stored for this namespace.
 */
export const ensureSessionKey = (namespace: string, seed?: string): string => {
  const fromStorage = loadSessionKey(namespace);
  if (fromStorage) return fromStorage;
  const next = seed?.trim() || randomId();
  persistSessionKey(namespace, next);
  return next;
};
