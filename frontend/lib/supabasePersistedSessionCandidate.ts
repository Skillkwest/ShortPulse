/**
 * Browser-side reader for persisted Supabase auth payloads.
 * Shared by bootstrap hints and best-effort access-token helpers without coupling their public APIs.
 */
const hasTokenCandidate = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    access_token?: unknown;
    refresh_token?: unknown;
  };
  return typeof candidate.access_token === "string" || typeof candidate.refresh_token === "string";
};

const getSupabaseAuthStorageKeys = (): string[] => {
  const keys = new Set<string>();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (supabaseUrl) {
    try {
      const hostname = new URL(supabaseUrl).hostname;
      const projectRef = hostname.split(".")[0]?.trim();
      if (projectRef) {
        keys.add(`sb-${projectRef}-auth-token`);
      }
    } catch {
      // Ignore malformed env values and fall back to storage scanning.
    }
  }

  return [...keys];
};

/**
 * Reads the persisted Supabase token payload candidate from browser storage when available.
 */
export const readPersistedSupabaseTokenCandidate = (): {
  access_token?: unknown;
  refresh_token?: unknown;
} | null => {
  if (typeof window === "undefined") return null;

  try {
    const storage = window.localStorage;
    const candidateKeys = new Set<string>(getSupabaseAuthStorageKeys());

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key) {
        candidateKeys.add(key);
      }
    }

    for (const key of candidateKeys) {
      if (!/auth-token/i.test(key)) continue;
      const rawValue = storage.getItem(key);
      if (!rawValue) continue;

      try {
        const parsed = JSON.parse(rawValue) as unknown;
        const candidates = [
          parsed,
          (parsed as { currentSession?: unknown } | null)?.currentSession,
          (parsed as { session?: unknown } | null)?.session,
        ];

        for (const candidate of candidates) {
          if (hasTokenCandidate(candidate)) {
            return candidate as {
              access_token?: unknown;
              refresh_token?: unknown;
            };
          }
        }
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }

  return null;
};

/**
 * Reads whether browser storage contains a persisted Supabase auth payload.
 */
export const hasPersistedSupabaseSessionCandidate = (): boolean =>
  hasTokenCandidate(readPersistedSupabaseTokenCandidate());
