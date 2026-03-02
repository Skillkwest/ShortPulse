/**
 * Timeout-aware recovery probe fetch wrapper.
 * Keeps probe transport timeout behavior deterministic while preserving caller abort semantics.
 */

export type RecoveryFetchErrorCode = "timeout" | "aborted";

export class RecoveryFetchError extends Error {
  code: RecoveryFetchErrorCode;

  constructor(code: RecoveryFetchErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RecoveryFetchError";
    this.code = code;
  }
}

const asAbortLikeError = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  const maybeName = (value as { name?: unknown }).name;
  return maybeName === "AbortError";
};

/**
 * Runs a probe request with a bounded timeout, combining parent cancellation with local timeout abort.
 */
export const recoveryFetchWithTimeout = async <T>({
  execute,
  timeoutMs,
  signal,
}: {
  execute: (signal: AbortSignal) => Promise<T>;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<T> => {
  const controller = new AbortController();
  const resolvedTimeoutMs = Math.max(Math.floor(timeoutMs), 1);
  let timeoutTriggered = false;
  const timeoutId = setTimeout(() => {
    timeoutTriggered = true;
    controller.abort();
  }, resolvedTimeoutMs);

  const abortFromParent = () => controller.abort();
  if (signal?.aborted) {
    controller.abort();
  } else if (signal) {
    signal.addEventListener("abort", abortFromParent, { once: true });
  }

  try {
    return await execute(controller.signal);
  } catch (error) {
    if (timeoutTriggered) {
      throw new RecoveryFetchError(
        "timeout",
        `Recovery probe request timed out after ${resolvedTimeoutMs}ms.`,
        { cause: error }
      );
    }
    if (asAbortLikeError(error) || controller.signal.aborted) {
      throw new RecoveryFetchError("aborted", "Recovery probe request aborted.", {
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromParent);
  }
};
