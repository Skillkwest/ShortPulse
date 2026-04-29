/**
 * Submit engine for Fal routes.
 * One model resolves to one canonical provider submit URL; retry only repeats that URL.
 */

import type { SubmitPayload, SubmitTarget, SubmitTargetAttemptDiagnostic } from "./contracts";
import { assertTrustedFalProviderUrl } from "./providerTrustPolicy";

export type SubmitResult = {
  response: Response;
  data: Record<string, unknown>;
  targetUrl: string;
  targetIndex: number;
  diagnostics: {
    attemptsTried: number;
    targetCount: number;
    totalDurationMs: number;
    targetAttempts: SubmitTargetAttemptDiagnostic[];
  };
};

const clampStartTimeoutSeconds = (value: number): number => {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.trunc(value));
};

const retryableSubmitStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const sleep = async (ms: number): Promise<void> =>
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isRetryableFalSubmitFailure = ({
  response,
  data,
}: {
  response: Response;
  data: Record<string, unknown>;
}): boolean => {
  if (retryableSubmitStatuses.has(response.status)) return true;
  const retryableHeader = response.headers.get("x-fal-retryable");
  if (typeof retryableHeader === "string" && retryableHeader.trim().toLowerCase() === "true") {
    return true;
  }
  const upstreamCode = String(data.code ?? "").toLowerCase();
  return upstreamCode === "rate_limit" || upstreamCode === "overloaded";
};

const isRetryableSubmitTransportError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  const detail = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|network|fetch failed|econnreset|etimedout|eai_again/i.test(detail);
};

const readJsonSafe = async (response: Response): Promise<Record<string, unknown>> => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: "Non-JSON response from Fal", raw: text.slice(0, 4000) };
  }
};

const runSubmitTarget = async ({
  target,
  payload,
  apiKey,
  signal,
  targetIndex,
  requestStartTimeoutSeconds,
  maxAttemptsPerTarget,
}: {
  target: SubmitTarget;
  payload: SubmitPayload;
  apiKey: string;
  signal: AbortSignal;
  targetIndex: number;
  requestStartTimeoutSeconds: number;
  maxAttemptsPerTarget: number;
}): Promise<SubmitResult> => {
  const body = target.transformPayload ? target.transformPayload(payload) : payload;
  const startedAt = Date.now();
  for (let attempt = 1; attempt <= maxAttemptsPerTarget; attempt += 1) {
    try {
      assertTrustedFalProviderUrl(target.submitUrl, `submit_target_${targetIndex}`);
      const response = await fetch(target.submitUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${apiKey}`,
          "X-Fal-Request-Timeout": String(requestStartTimeoutSeconds),
        },
        body: JSON.stringify(body),
        signal,
      });
      const data = await readJsonSafe(response);
      if (
        !response.ok &&
        attempt < maxAttemptsPerTarget &&
        isRetryableFalSubmitFailure({ response, data })
      ) {
        await sleep(120 * attempt);
        continue;
      }
      return {
        response,
        data,
        targetUrl: target.submitUrl,
        targetIndex,
        diagnostics: {
          attemptsTried: attempt,
          targetCount: 1,
          totalDurationMs: Math.max(0, Date.now() - startedAt),
          targetAttempts: [
            {
              targetIndex,
              attemptsTried: attempt,
              finalStatus: response.status,
              ok: response.ok,
              durationMs: Math.max(0, Date.now() - startedAt),
            },
          ],
        },
      };
    } catch (error) {
      if (attempt < maxAttemptsPerTarget && isRetryableSubmitTransportError(error)) {
        await sleep(120 * attempt);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Fal submit attempts exhausted unexpectedly.");
};

export const submitSingleTargetWithRetry = async ({
  target,
  payload,
  apiKey,
  signal,
  requestStartTimeoutSeconds,
  maxAttemptsPerTarget = 2,
}: {
  target: SubmitTarget;
  payload: SubmitPayload;
  apiKey: string;
  signal: AbortSignal;
  requestStartTimeoutSeconds?: number;
  maxAttemptsPerTarget?: number;
}): Promise<SubmitResult> => {
  const resolvedStartTimeoutSeconds = clampStartTimeoutSeconds(requestStartTimeoutSeconds ?? 30);
  const resolvedMaxAttemptsPerTarget = Math.max(1, Math.min(3, Math.trunc(maxAttemptsPerTarget)));

  return runSubmitTarget({
    target,
    payload,
    apiKey,
    signal,
    targetIndex: 0,
    requestStartTimeoutSeconds: resolvedStartTimeoutSeconds,
    maxAttemptsPerTarget: resolvedMaxAttemptsPerTarget,
  });
};
