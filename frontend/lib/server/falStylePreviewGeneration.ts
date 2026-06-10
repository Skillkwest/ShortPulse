/**
 * Direct Fal FLUX 2 Klein helper for prompt-only Styles Library thumbnails.
 * This intentionally avoids normal generation/media persistence; the Styles
 * route stores only the compact data URL in style preferences.
 */
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

type FalFluxKleinStylePreviewPayload = {
  prompt: string;
  image_size: { width: number; height: number };
  num_images: 1;
  output_format: "jpeg";
  num_inference_steps: 4;
  enable_safety_checker: false;
};

type GenerateFalFluxKleinStylePreviewImageInput = {
  payload: FalFluxKleinStylePreviewPayload;
  timeoutMs?: number;
  pollIntervalMs?: number;
};

export type FalFluxKleinStylePreviewImageResult = {
  buffer: Buffer;
  contentType: string;
  providerRequestId: string;
  mediaUrl: string;
};

const FAL_PROVIDER_KEY = "fal";
export const FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID = FAL_FLUX_2_KLEIN_9B_MODEL_ID;
export const FAL_FLUX_2_KLEIN_STYLE_PREVIEW_SIZE = "1024x1024";
export const FAL_FLUX_2_KLEIN_STYLE_PREVIEW_OUTPUT_FORMAT = "jpeg";
const STYLE_PREVIEW_ASPECT = "1:1";
const STYLE_PREVIEW_POLL_INTERVAL_MS = 2000;
const STYLE_PREVIEW_SUBMIT_TIMEOUT_SECONDS = 30;

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
    modelId: FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID,
    payload,
  });

const fetchGeneratedImage = async ({
  imageUrl,
  signal,
}: {
  imageUrl: string;
  signal: AbortSignal;
}): Promise<{ buffer: Buffer; contentType: string }> => {
  assertTrustedFalProviderUrl(imageUrl, "style_preview_media");
  const response = await fetch(imageUrl, { signal });
  if (!response.ok) {
    throw new Error(`Fal FLUX 2 Klein media fetch failed (${response.status}).`);
  }
  const contentType = response.headers.get("content-type")?.trim() || "image/jpeg";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error("Fal FLUX 2 Klein media response was not an image.");
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType,
  };
};

const validateStylePreviewPayload = (payload: FalFluxKleinStylePreviewPayload) => {
  const validation = validateFalPayloadForModel(FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID)(payload);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  return validation.projectedPayload as FalFluxKleinStylePreviewPayload;
};

const resolvePayloadWithMedia = async ({
  providerRequestId,
  apiKey,
  statusBaseUrls,
  pollIntervalMs,
  signal,
  timeoutAt,
}: {
  providerRequestId: string;
  apiKey: string;
  statusBaseUrls: string[];
  pollIntervalMs: number;
  signal: AbortSignal;
  timeoutAt: number;
}): Promise<Record<string, unknown>> => {
  while (Date.now() < timeoutAt) {
    await sleep(pollIntervalMs, signal);
    for (const baseUrl of statusBaseUrls) {
      const response = await dispatchProviderStatusRequest({
        provider: FAL_PROVIDER_KEY,
        baseUrl,
        requestId: providerRequestId,
        apiKey,
        signal,
      });
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
      if (!response.ok) {
        throw new Error(
          readProviderFailureMessage(statusData.json, "Fal FLUX 2 Klein status check failed.")
        );
      }

      if (
        statusData.isJson &&
        providerPayloadHasMedia({
          provider: FAL_PROVIDER_KEY,
          modelId: FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID,
          payload: statusData.json,
        })
      ) {
        return statusData.json;
      }

      const status = statusData.isJson
        ? readProviderLifecycleStatus({
            provider: FAL_PROVIDER_KEY,
            modelId: FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID,
            payload: statusData.json,
          })
        : null;
      if (isProviderFailedStatus({ provider: FAL_PROVIDER_KEY, status })) {
        throw new Error(
          readProviderFailureMessage(statusData.json, "Fal FLUX 2 Klein style preview failed.")
        );
      }
      if (!isProviderCompletedStatus({ provider: FAL_PROVIDER_KEY, status })) {
        continue;
      }

      const responseUrl = readProviderResponseUrl({
        provider: FAL_PROVIDER_KEY,
        modelId: FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID,
        payload: statusData.json,
      });
      const responseProbe = responseUrl
        ? await probeResponseUrlsForMedia({
            provider: FAL_PROVIDER_KEY,
            modelId: FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID,
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
        modelId: FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID,
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
  }

  throw new Error("Fal FLUX 2 Klein style preview generation timed out.");
};

export const buildFalFluxKleinStylePreviewPayload = (
  prompt: string
): FalFluxKleinStylePreviewPayload => {
  const size = falSizeForAspect(STYLE_PREVIEW_ASPECT);
  return {
    prompt,
    image_size: { width: size.width, height: size.height },
    num_images: 1,
    output_format: FAL_FLUX_2_KLEIN_STYLE_PREVIEW_OUTPUT_FORMAT,
    num_inference_steps: 4,
    enable_safety_checker: false,
  };
};

export const generateFalFluxKleinStylePreviewImage = async ({
  payload,
  timeoutMs = getFalTimeoutMsOrDefault(FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID, 60000),
  pollIntervalMs = STYLE_PREVIEW_POLL_INTERVAL_MS,
}: GenerateFalFluxKleinStylePreviewImageInput): Promise<FalFluxKleinStylePreviewImageResult> => {
  const projectedPayload = validateStylePreviewPayload(payload);
  const submitUrl = getFalSubmitUrlRequired(FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID);
  const statusBaseUrls = resolveProviderStatusBaseUrls({
    provider: FAL_PROVIDER_KEY,
    configuredBaseUrls: getFalStatusBaseUrlsRequired(FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID),
    modelId: FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID,
  });
  const apiKey = readProviderApiKey(FAL_PROVIDER_KEY);
  const controller = new AbortController();
  const timeout = windowlessSetTimeout(() => controller.abort(), timeoutMs);

  try {
    const submitResult = await dispatchProviderSubmit({
      provider: FAL_PROVIDER_KEY,
      modelId: FAL_FLUX_2_KLEIN_STYLE_PREVIEW_MODEL_ID,
      targets: [{ submitUrl }],
      payload: projectedPayload,
      apiKey,
      signal: controller.signal,
      requestStartTimeoutSeconds: STYLE_PREVIEW_SUBMIT_TIMEOUT_SECONDS,
      maxAttemptsPerTarget: 2,
    });
    if (!submitResult.response.ok) {
      throw new Error(
        readProviderFailureMessage(submitResult.data, "Fal FLUX 2 Klein submit failed.")
      );
    }
    if (!submitResult.providerRequestId) {
      throw new Error("Fal FLUX 2 Klein did not return a request id.");
    }

    const submitMediaUrls = collectMediaUrls(submitResult.data);
    const mediaPayload =
      submitMediaUrls.length > 0
        ? submitResult.data
        : await resolvePayloadWithMedia({
            providerRequestId: submitResult.providerRequestId,
            apiKey,
            statusBaseUrls,
            pollIntervalMs,
            signal: controller.signal,
            timeoutAt: Date.now() + timeoutMs,
          });
    const [mediaUrl] = collectMediaUrls(mediaPayload);
    if (!mediaUrl) {
      throw new Error("Fal FLUX 2 Klein completed without an image.");
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
