/**
 * Provider-aware polling session policy.
 * Centralizes timeout and abort-signal lifecycle for provider polling flows.
 */

import { resolveProviderModelStatusTimeoutMs } from "./statusProviderTopology";

type ProviderPollingSession = {
  signal: AbortSignal;
  timeoutMs: number;
  abort: () => void;
  dispose: () => void;
};

const DEFAULT_FALLBACK_TIMEOUT_MS = 60000;

const sanitizeTimeoutMs = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_FALLBACK_TIMEOUT_MS;
  const rounded = Math.floor(value);
  if (rounded <= 0) return DEFAULT_FALLBACK_TIMEOUT_MS;
  return rounded;
};

/**
 * Starts a provider polling session with a bounded abort timeout.
 */
export const startProviderPollingSession = ({
  provider,
  modelId,
  timeoutMs,
}: {
  provider: string;
  modelId: string;
  timeoutMs?: number;
}): ProviderPollingSession => {
  const resolvedTimeoutMs = sanitizeTimeoutMs(
    timeoutMs ??
      resolveProviderModelStatusTimeoutMs({
        provider,
        modelId,
        defaultTimeoutMs: DEFAULT_FALLBACK_TIMEOUT_MS,
      })
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, resolvedTimeoutMs);

  return {
    signal: controller.signal,
    timeoutMs: resolvedTimeoutMs,
    abort: () => {
      controller.abort();
    },
    dispose: () => {
      clearTimeout(timeoutId);
    },
  };
};
