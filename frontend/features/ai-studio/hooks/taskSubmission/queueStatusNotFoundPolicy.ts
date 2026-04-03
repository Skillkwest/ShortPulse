export const QUEUE_STATUS_NOT_FOUND_MAX_RETRIES = 8;
export const QUEUE_STATUS_NOT_FOUND_MIN_AGE_MS = 120_000;

export const shouldEscalateQueuedNotFoundRecovery = ({
  notFoundRetries,
  queueEnqueuedAtMs,
  nowMs,
}: {
  notFoundRetries: number;
  queueEnqueuedAtMs?: number;
  nowMs: number;
}): boolean => {
  if (notFoundRetries < QUEUE_STATUS_NOT_FOUND_MAX_RETRIES) {
    return false;
  }

  if (typeof queueEnqueuedAtMs !== "number" || !Number.isFinite(queueEnqueuedAtMs)) {
    return true;
  }

  return nowMs - queueEnqueuedAtMs >= QUEUE_STATUS_NOT_FOUND_MIN_AGE_MS;
};
