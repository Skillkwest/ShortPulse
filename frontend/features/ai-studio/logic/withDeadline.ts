/**
 * Async deadline utility for pre-submit generation phases.
 * Prevents indefinite UI spinners when prerequisite work stalls.
 */

export class DeadlineExceededError extends Error {
  readonly timeoutMs: number;
  readonly code: "DEADLINE_EXCEEDED";

  constructor(message: string, timeoutMs: number) {
    super(message);
    this.name = "DeadlineExceededError";
    this.timeoutMs = timeoutMs;
    this.code = "DEADLINE_EXCEEDED";
  }
}

type WithDeadlineInput<T> = {
  timeoutMs: number;
  timeoutMessage: string;
  run: () => Promise<T>;
};

type WithAbortableDeadlineInput<T> = {
  timeoutMs: number;
  timeoutMessage: string;
  run: (signal: AbortSignal) => Promise<T>;
};

/**
 * Runs async work with a deadline and rejects with `DeadlineExceededError` on timeout.
 */
export const withDeadline = async <T>({
  timeoutMs,
  timeoutMessage,
  run,
}: WithDeadlineInput<T>): Promise<T> => {
  let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutHandle = globalThis.setTimeout(() => {
      reject(new DeadlineExceededError(timeoutMessage, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([run(), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      globalThis.clearTimeout(timeoutHandle);
    }
  }
};

/**
 * Runs async work with a deadline and a timeout-linked abort signal.
 * If the deadline expires, callers receive `DeadlineExceededError` and in-flight work is aborted.
 */
export const withAbortableDeadline = async <T>({
  timeoutMs,
  timeoutMessage,
  run,
}: WithAbortableDeadlineInput<T>): Promise<T> => {
  const timeoutController = new AbortController();
  let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutHandle = globalThis.setTimeout(() => {
      timeoutController.abort();
      reject(new DeadlineExceededError(timeoutMessage, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([run(timeoutController.signal), timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      globalThis.clearTimeout(timeoutHandle);
    }
  }
};
