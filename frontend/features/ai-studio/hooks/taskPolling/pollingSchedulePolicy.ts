/**
 * Polling cadence and retry-budget policy for AI Studio task orchestration.
 */
import type { Provider } from "../../logic/stateParsers";
import { longRunningVideoProviders } from "./providerStatusPolicy";

export const MAX_CONCURRENT_STATUS_REQUESTS = 3;
export const IMAGE_POLL_MAX_WAIT_MS = 12 * 60 * 1000;
export const VIDEO_POLL_MAX_WAIT_MS = 20 * 60 * 1000;
export const POLL_DELAY_INITIAL_MS = 2_200;
export const POLL_DELAY_BACKOFF_STEP_MS = 800;
export const POLL_DELAY_MAX_MS = 10_000;
export const IMAGE_NO_MEDIA_RETRY_DELAYS_MS = [1500, 2000, 3000, 5000, 8000, 12000];
export const STATUS_NOT_FOUND_MAX_ATTEMPTS = 5;
export const STATUS_ERROR_MAX_ATTEMPTS = 30;

/**
 * Resolves poll max-wait budget by provider class.
 */
export const getPollMaxWaitMs = (provider: Provider): number =>
  longRunningVideoProviders.has(provider) ? VIDEO_POLL_MAX_WAIT_MS : IMAGE_POLL_MAX_WAIT_MS;

/**
 * Resolves standard poll delay with linear backoff and max cap.
 */
export const getPollDelayMs = (attempt: number): number =>
  Math.min(POLL_DELAY_MAX_MS, POLL_DELAY_INITIAL_MS + attempt * POLL_DELAY_BACKOFF_STEP_MS);

/**
 * Resolves deferred retry delay when status request concurrency budget is exhausted.
 */
export const getStatusConcurrencyRetryDelayMs = (currentDelayMs: number): number =>
  Math.min(4000, currentDelayMs + 600);

type NoMediaRetryPolicyInput = {
  provider: Provider;
  noMediaAttempt: number;
  fallbackDelayMs: number;
};

type NoMediaRetryPolicy = {
  maxNoMediaAttempts: number;
  shouldRetryForMedia: boolean;
  retryDelayMs: number;
};

/**
 * Computes retry budget and delay when provider reports success without media URLs yet.
 */
export const resolveNoMediaRetryPolicy = ({
  provider,
  noMediaAttempt,
  fallbackDelayMs,
}: NoMediaRetryPolicyInput): NoMediaRetryPolicy => {
  const maxNoMediaAttempts = longRunningVideoProviders.has(provider)
    ? 30
    : IMAGE_NO_MEDIA_RETRY_DELAYS_MS.length;
  const shouldRetryForMedia = noMediaAttempt < maxNoMediaAttempts;
  const retryDelayMs = longRunningVideoProviders.has(provider)
    ? fallbackDelayMs
    : (IMAGE_NO_MEDIA_RETRY_DELAYS_MS[
        Math.min(noMediaAttempt, IMAGE_NO_MEDIA_RETRY_DELAYS_MS.length - 1)
      ] ?? fallbackDelayMs);
  return { maxNoMediaAttempts, shouldRetryForMedia, retryDelayMs };
};

type ExhaustedStatusErrorInput = {
  message: string;
  attempt: number;
};

/**
 * Determines if status transport errors have exceeded retry budget.
 */
export const isStatusErrorRetryBudgetExhausted = ({
  message,
  attempt,
}: ExhaustedStatusErrorInput): boolean => {
  const isNotFound = /404|not found/i.test(message);
  return (
    (isNotFound && attempt >= STATUS_NOT_FOUND_MAX_ATTEMPTS) || attempt >= STATUS_ERROR_MAX_ATTEMPTS
  );
};
