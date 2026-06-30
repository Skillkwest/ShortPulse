/**
 * Fail-fast guard for optional build-time data used by ISR pages.
 * Prevents slow upstream reads from consuming Vercel's static-page timeout budget.
 */
const DEFAULT_STATIC_GENERATION_DATA_TIMEOUT_MS = 5_000;

export class StaticGenerationDataTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms during static generation.`);
    this.name = "StaticGenerationDataTimeoutError";
  }
}

const resolveStaticGenerationDataTimeoutMs = (): number => {
  const raw = process.env.SHORTPULSE_STATIC_GENERATION_DATA_TIMEOUT_MS;
  const parsed = typeof raw === "string" ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.max(100, Math.trunc(parsed));
  }
  return DEFAULT_STATIC_GENERATION_DATA_TIMEOUT_MS;
};

export const withStaticGenerationDataTimeout = async <T>(
  promise: Promise<T>,
  label: string,
  timeoutMs = resolveStaticGenerationDataTimeoutMs()
): Promise<T> => {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      reject(new StaticGenerationDataTimeoutError(label, timeoutMs));
    }, timeoutMs);
    timeoutId.unref?.();
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
  }
};
