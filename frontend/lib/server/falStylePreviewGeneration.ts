/**
 * Direct Fal FLUX 2 Klein image helper for internal prompt-only image generation.
 * Callers own billing and persistence; this module only submits, polls, and
 * fetches trusted provider media.
 */
import type { StatusProbeCandidate } from "./falIntegration/contracts";
import { FAL_FLUX_2_KLEIN_9B_MODEL_ID } from "../model-runtime/falModelIds";
import { falSizeForAspect } from "../model-runtime/pricing";
import { normalizeCustomerFacingProviderError } from "../customerFacingProviderText";
import { validateFalPayloadForModel } from "./api/falPayloadValidation";
import {
  getFalStatusBaseUrlsRequired,
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "./api/falRouteConfig";
import { assertTrustedFalProviderUrl } from "./falIntegration/providerTrustPolicy";
import {
  probeResponseUrlsForMedia,
  probeResultBasesForMedia,
  readJsonSafe,
} from "./falIntegration/statusProxyRuntime";
import { dispatchProviderSubmit } from "./providerIntegration/submitProviderDispatcher";
import {
  dispatchProviderStatusRequest,
  resolveProviderStatusBaseUrls,
} from "./providerIntegration/statusProviderDispatcher";
import {
  resolveFalStatusBaseUrlsFromProviderUrls,
  uniqueProviderUrls,
} from "./providerIntegration/providerReturnedUrls";
import { readProviderApiKey } from "./providerIntegration/providerRuntimeConfig";
import {
  providerPayloadHasMedia,
  readProviderContentPolicyMessage,
  readProviderLifecycleStatus,
  readProviderMediaUrls,
  readProviderResponseUrl,
} from "./providerIntegration/statusProviderPayload";
import {
  isProviderCompletedStatus,
  isProviderFailedStatus,
  isProviderRetryableUpstreamResponse,
} from "./providerIntegration/statusProviderPolicy";
import { selectBestProviderStatusCandidate } from "./providerIntegration/statusProviderSelection";

export type FalFluxKleinImagePayload = {
  prompt: string;
  image_size: { width: number; height: number };
  num_images: 1;
  output_format: "jpeg";
  num_inference_steps: 4;
  enable_safety_checker: false;
};

export type FalFluxKleinStylePreviewPayload = FalFluxKleinImagePayload;

type GenerateFalFluxKleinImageInput = {
  payload: FalFluxKleinImagePayload;
  timeoutMs?: number;
  pollIntervalMs?: number;
  initialPollDelayMs?: number;
};

type GenerateFalFluxKleinStylePreviewImageInput = GenerateFalFluxKleinImageInput;

export type FalFluxKleinImageResult = {
  buffer: Buffer;
  contentType: string;
  providerRequestId: string;
  mediaUrl: string;
};

export type FalFluxKleinStylePreviewImageResult = FalFluxKleinImageResult;

const FAL_PROVIDER_KEY = "fal";
export const FAL_FLUX_2_KLEIN_MODEL_ID = FAL_FLUX_2_KLEIN_9B_MODEL_ID;
export const FAL_FLUX_2_KLEIN_SQUARE_SIZE = "1024x1024";
export const FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_SIZE = "512x512";
export const FAL_FLUX_2_KLEIN_OUTPUT_FORMAT = "jpeg";
export const FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID = FAL_FLUX_2_KLEIN_MODEL_ID;
export const FAL_FLUX_2_KLEIN_STYLE_PREVIEW_SIZE = FAL_FLUX_2_KLEIN_SQUARE_SIZE;
export const FAL_FLUX_2_KLEIN_STYLE_PREVIEW_OUTPUT_FORMAT = FAL_FLUX_2_KLEIN_OUTPUT_FORMAT;
const STYLE_PREVIEW_ASPECT = "1:1";
const AUDIO_COMPANION_ART_IMAGE_SIZE = { width: 512, height: 512 } as const;
const FAL_FLUX_2_KLEIN_POLL_INTERVAL_MS = 2000;
const FAL_FLUX_2_KLEIN_SUBMIT_TIMEOUT_SECONDS = 30;
const STYLE_PREVIEW_STATUS_CHECK_FAILED_MESSAGE = "Style preview generation status check failed.";
const STYLE_PREVIEW_FAILED_MESSAGE = "Style preview generation failed.";
const STYLE_PREVIEW_SUBMIT_FAILED_MESSAGE = "Style preview generation submit failed.";

type StatusCandidate = {
  probe: StatusProbeCandidate;
  response: Response;
  data: Awaited<ReturnType<typeof readJsonSafe>>;
};

const sleep = async (ms: number, signal: AbortSignal): Promise<void> => {
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Operation was aborted.", "AbortError"));
      return;
    }
    const timeout = windowlessSetTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        windowlessClearTimeout(timeout);
        reject(new DOMException("Operation was aborted.", "AbortError"));
      },
      { once: true }
    );
  });
};

const windowlessSetTimeout = (callback: () => void, ms: number): ReturnType<typeof setTimeout> =>
  setTimeout(callback, ms);

const windowlessClearTimeout = (timer: ReturnType<typeof setTimeout>): void => {
  clearTimeout(timer);
};

const readProviderFailureMessage = (payload: unknown, fallback: string): string =>
  readProviderContentPolicyMessage({ provider: FAL_PROVIDER_KEY, payload }) ??
  normalizeCustomerFacingProviderError(payload, fallback);

const collectMediaUrls = (payload: unknown): string[] =>
  readProviderMediaUrls({
    provider: FAL_PROVIDER_KEY,
    modelId: FAL_FLUX_2_KLEIN_MODEL_ID,
    payload,
  });

const fetchGeneratedImage = async ({
  imageUrl,
  signal,
}: {
  imageUrl: string;
  signal: AbortSignal;
}): Promise<{ buffer: Buffer; contentType: string }> => {
  assertTrustedFalProviderUrl(imageUrl, "fal_flux_2_klein_media");
  const response = await fetch(imageUrl, { signal });
  if (!response.ok) {
    throw new Error(`Style preview image fetch failed (${response.status}).`);
  }
  const contentType = response.headers.get("content-type")?.trim() || "image/jpeg";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error("Style preview image response was not an image.");
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType,
  };
};

const validateFalFluxKleinPayload = (payload: FalFluxKleinImagePayload) => {
  const validation = validateFalPayloadForModel(FAL_FLUX_2_KLEIN_MODEL_ID)(payload);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  return validation.projectedPayload as FalFluxKleinImagePayload;
};

const buildStatusCandidate = ({
  baseUrl,
  index,
  response,
  data,
}: {
  baseUrl: string;
  index: number;
  response: Response;
  data: Awaited<ReturnType<typeof readJsonSafe>>;
}): StatusCandidate => {
  const status = data.isJson
    ? readProviderLifecycleStatus({
        provider: FAL_PROVIDER_KEY,
        modelId: FAL_FLUX_2_KLEIN_MODEL_ID,
        payload: data.json,
      })
    : null;
  const isCompleted = Boolean(
    status && isProviderCompletedStatus({ provider: FAL_PROVIDER_KEY, status })
  );
  const isFailed = Boolean(
    status && isProviderFailedStatus({ provider: FAL_PROVIDER_KEY, status })
  );
  return {
    probe: {
      index,
      baseUrl,
      isJson: data.isJson,
      isRetryableAlias: false,
      httpStatus: response.status,
      isHttpOk: response.ok,
      status,
      isTerminal: isCompleted || isFailed,
      isCompleted,
      isFailed,
      hasResponseUrl: data.isJson
        ? Boolean(
            readProviderResponseUrl({
              provider: FAL_PROVIDER_KEY,
              modelId: FAL_FLUX_2_KLEIN_MODEL_ID,
              payload: data.json,
            })
          )
        : false,
      hasMedia: data.isJson
        ? providerPayloadHasMedia({
            provider: FAL_PROVIDER_KEY,
            modelId: FAL_FLUX_2_KLEIN_MODEL_ID,
            payload: data.json,
          })
        : false,
    },
    response,
    data,
  };
};

const resolvePayloadWithMedia = async ({
  providerRequestId,
  apiKey,
  statusBaseUrls,
  pollIntervalMs,
  initialPollDelayMs,
  signal,
  timeoutAt,
}: {
  providerRequestId: string;
  apiKey: string;
  statusBaseUrls: string[];
  pollIntervalMs: number;
  initialPollDelayMs: number;
  signal: AbortSignal;
  timeoutAt: number;
}): Promise<Record<string, unknown>> => {
  let pollAttempt = 0;
  while (Date.now() < timeoutAt) {
    const delayMs = pollAttempt === 0 ? initialPollDelayMs : pollIntervalMs;
    pollAttempt += 1;
    await sleep(delayMs, signal);
    const statusCandidates: StatusCandidate[] = [];
    let nonRetryableStatusFailure: string | null = null;
    for (const [index, baseUrl] of statusBaseUrls.entries()) {
      let response: Response;
      try {
        response = await dispatchProviderStatusRequest({
          provider: FAL_PROVIDER_KEY,
          baseUrl,
          requestId: providerRequestId,
          apiKey,
          signal,
        });
      } catch {
        continue;
      }
      const statusData = await readJsonSafe(response);
      if (
        !response.ok &&
        isProviderRetryableUpstreamResponse({
          provider: FAL_PROVIDER_KEY,
          response,
          payload: statusData.json,
        })
      ) {
        continue;
      }
      const candidate = buildStatusCandidate({
        baseUrl,
        index,
        response,
        data: statusData,
      });
      statusCandidates.push(candidate);
      if (!response.ok) {
        nonRetryableStatusFailure = readProviderFailureMessage(
          statusData.json,
          STYLE_PREVIEW_STATUS_CHECK_FAILED_MESSAGE
        );
        continue;
      }
    }

    const bestStatusProbe = selectBestProviderStatusCandidate({
      provider: FAL_PROVIDER_KEY,
      candidates: statusCandidates.map((candidate) => candidate.probe),
    });
    const bestStatusCandidate =
      bestStatusProbe &&
      statusCandidates.find((candidate) => candidate.probe.index === bestStatusProbe.index);
    if (!bestStatusCandidate) {
      if (nonRetryableStatusFailure) {
        throw new Error(nonRetryableStatusFailure);
      }
      continue;
    }

    const statusMediaCandidate = statusCandidates.find(
      (candidate) => candidate.probe.isHttpOk && candidate.probe.hasMedia && candidate.data.isJson
    );
    if (statusMediaCandidate) {
      return statusMediaCandidate.data.json;
    }

    const { response, data: statusData, probe } = bestStatusCandidate;
    if (!response.ok) {
      throw new Error(
        readProviderFailureMessage(statusData.json, STYLE_PREVIEW_STATUS_CHECK_FAILED_MESSAGE)
      );
    }

    if (statusData.isJson && probe.hasMedia) {
      return statusData.json;
    }

    const status = probe.status;
    if (probe.isFailed) {
      throw new Error(readProviderFailureMessage(statusData.json, STYLE_PREVIEW_FAILED_MESSAGE));
    }
    if (!probe.isCompleted) {
      continue;
    }

    const responseUrl = statusData.isJson
      ? readProviderResponseUrl({
          provider: FAL_PROVIDER_KEY,
          modelId: FAL_FLUX_2_KLEIN_MODEL_ID,
          payload: statusData.json,
        })
      : null;
    const responseProbe = responseUrl
      ? await probeResponseUrlsForMedia({
          provider: FAL_PROVIDER_KEY,
          modelId: FAL_FLUX_2_KLEIN_MODEL_ID,
          responseUrls: [responseUrl],
          statusHint: status,
          apiKey,
          signal,
        })
      : null;
    if (responseProbe?.payload) {
      return responseProbe.payload;
    }

    const resultProbe = await probeResultBasesForMedia({
      provider: FAL_PROVIDER_KEY,
      modelId: FAL_FLUX_2_KLEIN_MODEL_ID,
      resultBaseUrls: statusBaseUrls,
      requestId: providerRequestId,
      statusHint: status,
      apiKey,
      signal,
    });
    if (resultProbe?.payload) {
      return resultProbe.payload;
    }
  }

  throw new Error("Style preview image generation timed out.");
};

export const buildFalFluxKleinImagePayload = (
  prompt: string,
  aspect: string = STYLE_PREVIEW_ASPECT
): FalFluxKleinImagePayload => {
  const size = falSizeForAspect(aspect);
  return {
    prompt,
    image_size: { width: size.width, height: size.height },
    num_images: 1,
    output_format: FAL_FLUX_2_KLEIN_OUTPUT_FORMAT,
    num_inference_steps: 4,
    enable_safety_checker: false,
  };
};

export const buildFalFluxKleinStylePreviewPayload = (
  prompt: string
): FalFluxKleinStylePreviewPayload => buildFalFluxKleinImagePayload(prompt, STYLE_PREVIEW_ASPECT);

export const buildFalFluxKleinAudioCompanionArtPayload = (
  prompt: string
): FalFluxKleinImagePayload => ({
  prompt,
  image_size: { ...AUDIO_COMPANION_ART_IMAGE_SIZE },
  num_images: 1,
  output_format: FAL_FLUX_2_KLEIN_OUTPUT_FORMAT,
  num_inference_steps: 4,
  enable_safety_checker: false,
});

export const generateFalFluxKleinImage = async ({
  payload,
  timeoutMs = getFalTimeoutMsOrDefault(FAL_FLUX_2_KLEIN_MODEL_ID, 60000),
  pollIntervalMs = FAL_FLUX_2_KLEIN_POLL_INTERVAL_MS,
  initialPollDelayMs = FAL_FLUX_2_KLEIN_POLL_INTERVAL_MS,
}: GenerateFalFluxKleinImageInput): Promise<FalFluxKleinImageResult> => {
  const projectedPayload = validateFalFluxKleinPayload(payload);
  const submitUrl = getFalSubmitUrlRequired(FAL_FLUX_2_KLEIN_MODEL_ID);
  const configuredStatusBaseUrls = getFalStatusBaseUrlsRequired(FAL_FLUX_2_KLEIN_MODEL_ID);
  const apiKey = readProviderApiKey(FAL_PROVIDER_KEY);
  const controller = new AbortController();
  const timeout = windowlessSetTimeout(() => controller.abort(), timeoutMs);

  try {
    const submitResult = await dispatchProviderSubmit({
      provider: FAL_PROVIDER_KEY,
      modelId: FAL_FLUX_2_KLEIN_MODEL_ID,
      targets: [{ submitUrl }],
      payload: projectedPayload,
      apiKey,
      signal: controller.signal,
      requestStartTimeoutSeconds: FAL_FLUX_2_KLEIN_SUBMIT_TIMEOUT_SECONDS,
      maxAttemptsPerTarget: 2,
    });
    if (!submitResult.response.ok) {
      throw new Error(
        readProviderFailureMessage(submitResult.data, STYLE_PREVIEW_SUBMIT_FAILED_MESSAGE)
      );
    }
    if (!submitResult.providerRequestId) {
      throw new Error("Style preview generation did not return a request id.");
    }

    const providerReturnedStatusBaseUrls = resolveFalStatusBaseUrlsFromProviderUrls({
      requestId: submitResult.providerRequestId,
      providerStatusUrl: submitResult.providerStatusUrl,
      providerResponseUrl: submitResult.providerResponseUrl,
    });
    const statusBaseUrls = resolveProviderStatusBaseUrls({
      provider: FAL_PROVIDER_KEY,
      configuredBaseUrls: uniqueProviderUrls([
        ...providerReturnedStatusBaseUrls,
        ...configuredStatusBaseUrls,
      ]),
      modelId: FAL_FLUX_2_KLEIN_MODEL_ID,
    });
    const submitMediaUrls = collectMediaUrls(submitResult.data);
    const mediaPayload =
      submitMediaUrls.length > 0
        ? submitResult.data
        : await resolvePayloadWithMedia({
            providerRequestId: submitResult.providerRequestId,
            apiKey,
            statusBaseUrls,
            pollIntervalMs,
            initialPollDelayMs,
            signal: controller.signal,
            timeoutAt: Date.now() + timeoutMs,
          });
    const [mediaUrl] = collectMediaUrls(mediaPayload);
    if (!mediaUrl) {
      throw new Error("Style preview generation completed without an image.");
    }
    const image = await fetchGeneratedImage({
      imageUrl: mediaUrl,
      signal: controller.signal,
    });

    return {
      ...image,
      providerRequestId: submitResult.providerRequestId,
      mediaUrl,
    };
  } finally {
    windowlessClearTimeout(timeout);
  }
};

export const generateFalFluxKleinStylePreviewImage = async (
  input: GenerateFalFluxKleinStylePreviewImageInput
): Promise<FalFluxKleinStylePreviewImageResult> => generateFalFluxKleinImage(input);
