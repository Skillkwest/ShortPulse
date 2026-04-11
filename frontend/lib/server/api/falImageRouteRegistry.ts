/**
 * Generic active-image route registry for Fal submit/status cutover.
 * Reuses the shared Fal proxy runtimes while keeping model routing centralized.
 */
import type { NextApiHandler } from "next";
import { createFalSubmitHandler } from "./falSubmitProxy";
import { createFalStatusHandler } from "./falStatusProxy";
import { validateFalPayloadForModel } from "./falPayloadValidation";
import {
  validateSeedreamEditPayload,
  validateSeedreamImageSizePayload,
} from "./seedreamPayloadValidation";
import {
  getFalStatusBaseUrlsRequired,
  getFalSubmitUrlRequired,
  getFalTimeoutMsOrDefault,
} from "./falRouteConfig";
import { getFalImageModelLabel, isFalImageModelId } from "../../model-runtime/falImageModelSupport";

type SubmitValidator = Parameters<typeof createFalSubmitHandler>[0]["validatePayload"];

const submitHandlerCache = new Map<string, NextApiHandler>();
const statusHandlerCache = new Map<string, NextApiHandler>();

const resolveSubmitValidator = (modelId: string): SubmitValidator => {
  if (
    modelId === "fal-ai/bytedance/seedream/v4.5/text-to-image" ||
    modelId === "fal-ai/bytedance/seedream/v5/lite/text-to-image"
  ) {
    return validateSeedreamImageSizePayload;
  }
  if (
    modelId === "fal-ai/bytedance/seedream/v4.5/edit" ||
    modelId === "fal-ai/bytedance/seedream/v5/lite/edit"
  ) {
    return validateSeedreamEditPayload;
  }
  return validateFalPayloadForModel(modelId);
};

/**
 * Resolves a generic Fal image submit handler for the provided active model.
 */
export const resolveFalImageSubmitHandler = (modelId: string): NextApiHandler | null => {
  if (!isFalImageModelId(modelId)) return null;
  const cached = submitHandlerCache.get(modelId);
  if (cached) return cached;
  const handler = createFalSubmitHandler({
    modelId,
    submitUrl: getFalSubmitUrlRequired(modelId),
    routeLabel: `Fal image submit (${getFalImageModelLabel(modelId)})`,
    timeoutMs: getFalTimeoutMsOrDefault(modelId, 60_000),
    validatePayload: resolveSubmitValidator(modelId),
  });
  submitHandlerCache.set(modelId, handler);
  return handler;
};

/**
 * Resolves a generic Fal image status handler for the provided active model.
 */
export const resolveFalImageStatusHandler = (modelId: string): NextApiHandler | null => {
  if (!isFalImageModelId(modelId)) return null;
  const cached = statusHandlerCache.get(modelId);
  if (cached) return cached;
  const handler = createFalStatusHandler({
    modelId,
    queueBaseUrl: getFalStatusBaseUrlsRequired(modelId),
    routeLabel: `Fal image status (${getFalImageModelLabel(modelId)})`,
    timeoutMs: getFalTimeoutMsOrDefault(modelId, 60_000),
  });
  statusHandlerCache.set(modelId, handler);
  return handler;
};
