/**
 * Provider-aware submit dispatcher.
 * Routes submit calls through provider-specific engines behind a stable contract.
 */

import type { SubmitPayload, SubmitTarget } from "../falIntegration/contracts";
import { submitWithFallbackTargets } from "../falIntegration/submitEngine";
import { readCanonicalProviderRequestId } from "./canonicalProviderPayload";
import { normalizeKieSubmitPayloadForModel } from "./kieModelContracts";
import {
  assertKieRuntimeEnabledForModel,
  isTrustedKieProviderUrl,
  readKieRuntimeFlags,
  resolveKieSubmitTargetsForModel,
} from "./providerRuntimeConfig";
import { isFalProviderKey, isKieProviderKey } from "./providerKey";

export type ProviderSubmitResult = {
  response: Response;
  data: Record<string, unknown>;
  targetUrl: string;
  targetIndex: number;
  providerRequestId: string | null;
};

const toProviderSubmitResult = (result: {
  response: Response;
  data: Record<string, unknown>;
  targetUrl: string;
  targetIndex: number;
}): ProviderSubmitResult => ({
  ...result,
  providerRequestId: readCanonicalProviderRequestId(result.data, { allowGenericId: true }),
});

const retryableSubmitStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const sleep = async (ms: number): Promise<void> =>
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const readJsonSafe = async (response: Response): Promise<Record<string, unknown>> => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: "Non-JSON response from provider", raw: text.slice(0, 4000) };
  }
};

const isRetryableTransportError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  const detail = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|network|fetch failed|econnreset|etimedout|eai_again/i.test(detail);
};

const isRetryableKieSubmitFailure = ({
  response,
  data,
}: {
  response: Response;
  data: Record<string, unknown>;
}): boolean => {
  if (retryableSubmitStatuses.has(response.status)) return true;
  const retryableHeader = response.headers.get("x-kie-retryable");
  if (typeof retryableHeader === "string" && retryableHeader.trim().toLowerCase() === "true") {
    return true;
  }
  const upstreamCode = String(data.code ?? "").toLowerCase();
  return upstreamCode === "rate_limit" || upstreamCode === "overloaded";
};

const submitKieTarget = async ({
  target,
  targetIndex,
  payload,
  apiKey,
  signal,
  requestStartTimeoutSeconds,
  maxAttemptsPerTarget,
}: {
  target: SubmitTarget;
  targetIndex: number;
  payload: SubmitPayload;
  apiKey: string;
  signal: AbortSignal;
  requestStartTimeoutSeconds: number;
  maxAttemptsPerTarget: number;
}): Promise<{
  response: Response;
  data: Record<string, unknown>;
  targetUrl: string;
  targetIndex: number;
}> => {
  const body = target.transformPayload ? target.transformPayload(payload) : payload;
  for (let attempt = 1; attempt <= maxAttemptsPerTarget; attempt += 1) {
    try {
      const response = await fetch(target.submitUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "X-Kie-Request-Timeout": String(requestStartTimeoutSeconds),
        },
        body: JSON.stringify(body),
        signal,
      });
      const data = await readJsonSafe(response);
      if (
        !response.ok &&
        attempt < maxAttemptsPerTarget &&
        isRetryableKieSubmitFailure({ response, data })
      ) {
        await sleep(120 * attempt);
        continue;
      }
      return { response, data, targetUrl: target.submitUrl, targetIndex };
    } catch (error) {
      if (attempt < maxAttemptsPerTarget && isRetryableTransportError(error)) {
        await sleep(120 * attempt);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Kie submit attempts exhausted unexpectedly.");
};

const submitKieWithFallbackTargets = async ({
  targets,
  payload,
  apiKey,
  signal,
  requestStartTimeoutSeconds = 30,
  maxAttemptsPerTarget = 2,
}: {
  targets: SubmitTarget[];
  payload: SubmitPayload;
  apiKey: string;
  signal: AbortSignal;
  requestStartTimeoutSeconds?: number;
  maxAttemptsPerTarget?: number;
}): Promise<{
  response: Response;
  data: Record<string, unknown>;
  targetUrl: string;
  targetIndex: number;
}> => {
  if (!targets.length) {
    throw new Error("Kie submit requires at least one trusted submit target.");
  }
  const timeoutSeconds = Math.max(1, Math.trunc(requestStartTimeoutSeconds));
  const attempts = Math.max(1, Math.min(3, Math.trunc(maxAttemptsPerTarget)));

  let fallbackFailure: {
    response: Response;
    data: Record<string, unknown>;
    targetUrl: string;
    targetIndex: number;
  } | null = null;

  for (const [index, target] of targets.entries()) {
    const result = await submitKieTarget({
      target,
      targetIndex: index,
      payload,
      apiKey,
      signal,
      requestStartTimeoutSeconds: timeoutSeconds,
      maxAttemptsPerTarget: attempts,
    });
    if (result.response.ok) {
      return result;
    }
    fallbackFailure = result;
  }

  if (fallbackFailure) return fallbackFailure;
  throw new Error("Kie submit fallback exhausted without a response.");
};

/**
 * Dispatches a generation submit request to the correct provider adapter.
 */
export const dispatchProviderSubmit = async ({
  provider,
  modelId,
  targets,
  payload,
  apiKey,
  signal,
  requestStartTimeoutSeconds,
  maxAttemptsPerTarget,
}: {
  provider: string;
  modelId: string;
  targets: SubmitTarget[];
  payload: SubmitPayload;
  apiKey: string;
  signal: AbortSignal;
  requestStartTimeoutSeconds?: number;
  maxAttemptsPerTarget?: number;
}): Promise<ProviderSubmitResult> => {
  if (isFalProviderKey(provider)) {
    const result = await submitWithFallbackTargets({
      targets,
      payload,
      apiKey,
      signal,
      requestStartTimeoutSeconds,
      maxAttemptsPerTarget,
    });
    return toProviderSubmitResult(result);
  }

  if (isKieProviderKey(provider)) {
    const kieFlags = readKieRuntimeFlags();
    assertKieRuntimeEnabledForModel({ modelId, flags: kieFlags });
    const normalizedPayload = normalizeKieSubmitPayloadForModel({ modelId, payload });
    const configuredTargets = targets.length
      ? targets
      : resolveKieSubmitTargetsForModel(modelId, kieFlags);
    const trustedTargets = configuredTargets.filter((target) =>
      isTrustedKieProviderUrl(target.submitUrl, kieFlags)
    );
    if (!trustedTargets.length) {
      throw new Error(`No trusted Kie submit target configured for model: ${modelId}`);
    }
    const result = await submitKieWithFallbackTargets({
      targets: trustedTargets,
      payload: normalizedPayload,
      apiKey,
      signal,
      requestStartTimeoutSeconds,
      maxAttemptsPerTarget,
    });
    return toProviderSubmitResult(result);
  }

  throw new Error(`Unsupported provider for submit dispatch: ${provider}`);
};
