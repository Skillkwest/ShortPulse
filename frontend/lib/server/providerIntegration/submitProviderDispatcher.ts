/**
 * Provider-aware submit dispatcher.
 * Routes submit calls through provider-specific engines behind a stable contract.
 */

import type { SubmitPayload, SubmitTarget } from "../falIntegration/contracts";
import { submitWithFallbackTargets } from "../falIntegration/submitEngine";
import { readCanonicalProviderRequestId } from "./canonicalProviderPayload";
import { KIE_KLING_30_MODEL_ID } from "./kieModelIds";
import { normalizeKieSubmitPayloadForModel } from "./kieModelContracts";
import {
  buildKieSubmitMediaDiagnostics,
  validateKieKlingSubmitMediaInputs,
} from "./kieSubmitMediaGuards";
import { normalizeKieSubmitTransportResult } from "./kieSubmitTransportContracts";
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
  providerDiagnostics: Record<string, unknown> | null;
};

export class ProviderSubmitValidationError extends Error {
  code: string;
  detail: unknown;
  statusCode: number;

  constructor({
    message,
    code,
    detail,
    statusCode = 400,
  }: {
    message: string;
    code: string;
    detail?: unknown;
    statusCode?: number;
  }) {
    super(message);
    this.name = "ProviderSubmitValidationError";
    this.code = code;
    this.detail = detail ?? null;
    this.statusCode = statusCode;
  }
}

const toProviderSubmitResult = (
  result: {
    response: Response;
    data: Record<string, unknown>;
    targetUrl: string;
    targetIndex: number;
    diagnostics?: Record<string, unknown> | null;
  },
  providerDiagnostics: Record<string, unknown> | null = null
): ProviderSubmitResult => ({
  ...result,
  providerRequestId: readCanonicalProviderRequestId(result.data, { allowGenericId: true }),
  providerDiagnostics:
    result.diagnostics || providerDiagnostics
      ? {
          ...(result.diagnostics ?? {}),
          ...(providerDiagnostics ?? {}),
        }
      : null,
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
  bodyCode,
}: {
  response: Response;
  data: Record<string, unknown>;
  bodyCode: number | null;
}): boolean => {
  if (retryableSubmitStatuses.has(response.status)) return true;
  const retryableHeader = response.headers.get("x-kie-retryable");
  if (typeof retryableHeader === "string" && retryableHeader.trim().toLowerCase() === "true") {
    return true;
  }
  if (bodyCode !== null && retryableSubmitStatuses.has(bodyCode)) return true;
  if (bodyCode === 455) return true;
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
  diagnostics: Record<string, unknown>;
}> => {
  const body = target.transformPayload ? target.transformPayload(payload) : payload;
  const startedAt = Date.now();
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
      const normalized = normalizeKieSubmitTransportResult({ response, data });
      if (
        !normalized.response.ok &&
        attempt < maxAttemptsPerTarget &&
        isRetryableKieSubmitFailure({
          response: normalized.response,
          data: normalized.data,
          bodyCode: normalized.bodyCode,
        })
      ) {
        await sleep(120 * attempt);
        continue;
      }
      return {
        response: normalized.response,
        data: normalized.data,
        targetUrl: target.submitUrl,
        targetIndex,
        diagnostics: {
          attemptsTried: attempt,
          fallbackCount: targetIndex,
          targetCount: 1,
          totalDurationMs: Math.max(0, Date.now() - startedAt),
        },
      };
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
  diagnostics: Record<string, unknown>;
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
    diagnostics: Record<string, unknown>;
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
      return {
        ...result,
        diagnostics: {
          ...result.diagnostics,
          fallbackCount: index,
          targetCount: targets.length,
        },
      };
    }
    fallbackFailure = result;
  }

  if (fallbackFailure) {
    return {
      ...fallbackFailure,
      diagnostics: {
        ...fallbackFailure.diagnostics,
        fallbackCount: fallbackFailure.targetIndex,
        targetCount: targets.length,
      },
    };
  }
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
    let providerDiagnostics: Record<string, unknown> | null = null;
    if (modelId === KIE_KLING_30_MODEL_ID) {
      const mediaValidation = await validateKieKlingSubmitMediaInputs({
        payload: normalizedPayload,
        signal,
      });
      if (!mediaValidation.ok) {
        throw new ProviderSubmitValidationError({
          message: mediaValidation.error,
          code: mediaValidation.code,
          detail: mediaValidation.detail,
        });
      }
      providerDiagnostics = mediaValidation.diagnostics as Record<string, unknown>;
    }
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
    return toProviderSubmitResult(result, providerDiagnostics);
  }

  throw new Error(`Unsupported provider for submit dispatch: ${provider}`);
};

/**
 * Creates redacted Kie media diagnostics for submit-failure telemetry.
 */
export const collectKieSubmitMediaDiagnostics = (
  payload: SubmitPayload
): Record<string, unknown> => {
  return buildKieSubmitMediaDiagnostics(payload as Record<string, unknown>);
};
