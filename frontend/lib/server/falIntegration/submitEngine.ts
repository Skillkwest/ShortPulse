/**
 * Submit engine for Fal routes with deterministic fallback target handling.
 * It keeps fallback policy centralized so route handlers stay small.
 */

import type { SubmitPayload, SubmitTarget } from "./contracts";

export type SubmitResult = {
  response: Response;
  data: Record<string, unknown>;
  targetUrl: string;
  targetIndex: number;
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
}: {
  target: SubmitTarget;
  payload: SubmitPayload;
  apiKey: string;
  signal: AbortSignal;
  targetIndex: number;
}): Promise<SubmitResult> => {
  const body = target.transformPayload ? target.transformPayload(payload) : payload;
  const response = await fetch(target.submitUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  const data = await readJsonSafe(response);
  return { response, data, targetUrl: target.submitUrl, targetIndex };
};

/**
 * Executes one or more submit targets with fallback semantics:
 * - primary response is authoritative unless it is `404`
 * - any successful fallback supersedes the primary failure
 */
export const submitWithFallbackTargets = async ({
  targets,
  payload,
  apiKey,
  signal,
}: {
  targets: SubmitTarget[];
  payload: SubmitPayload;
  apiKey: string;
  signal: AbortSignal;
}): Promise<SubmitResult> => {
  if (!targets.length) {
    throw new Error("submitWithFallbackTargets requires at least one submit target.");
  }

  const primary = await runSubmitTarget({
    target: targets[0],
    payload,
    apiKey,
    signal,
    targetIndex: 0,
  });
  if (primary.response.ok || targets.length === 1) {
    return primary;
  }

  let fallbackFailure: SubmitResult | null = null;
  for (const [offset, target] of targets.slice(1).entries()) {
    const fallback = await runSubmitTarget({
      target,
      payload,
      apiKey,
      signal,
      targetIndex: offset + 1,
    });
    if (fallback.response.ok) {
      return fallback;
    }
    fallbackFailure = fallback;
  }

  if (primary.response.status === 404 && fallbackFailure) {
    return fallbackFailure;
  }
  return primary;
};
