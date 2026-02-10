/**
 * Server-authoritative credit charging for generation requests.
 * Computes model cost from request payload, debits before provider submit,
 * and exposes an idempotent refund helper for failed submits.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";
import { computeCostForModel, getModelConfig } from "../../../features/ai-studio/logic/pricing";
import type { PricingParams } from "../../../features/ai-studio/logic/pricingTypes";
import { requireApiUser } from "./auth";
import { insertCreditLedgerEntry } from "./creditLedger";

type JsonObject = Record<string, unknown>;

type ChargeOptions = {
  req: NextApiRequest;
  res: NextApiResponse;
  modelId: string;
  payload: JsonObject;
  reason: string;
};

type ChargeResult = {
  userId: string;
  modelId: string;
  credits: number;
  sourceRef: string;
  refund: (message?: string, extra?: JsonObject) => Promise<void>;
};

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/s$/i, "").trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const resolveAspectFromImageSize = (payload: JsonObject): string | undefined => {
  const directAspect = asString(payload.aspect) ?? asString(payload.aspect_ratio);
  if (directAspect) return directAspect;

  const imageSize = payload.image_size;
  if (!imageSize || typeof imageSize !== "object") return undefined;
  const size = imageSize as Record<string, unknown>;
  const width = asNumber(size.width);
  const height = asNumber(size.height);
  if (!width || !height) return undefined;

  if (width === height) return "1:1";
  if (width === 1200 && height === 900) return "4:3";
  if (width === 900 && height === 1200) return "3:4";
  if (width === 960 && height === 1200) return "4:5";
  if (width === 1344 && height === 756) return "16:9";
  if (width === 756 && height === 1344) return "9:16";
  return undefined;
};

const resolveResolution = (payload: JsonObject): string | undefined => {
  const resolution = asString(payload.resolution);
  if (resolution) return resolution;

  const imageSize = asString(payload.image_size);
  if (!imageSize) return undefined;
  const normalized = imageSize.toLowerCase();
  if (normalized.includes("4k")) return "4K";
  if (normalized.includes("1080")) return "1080p";
  if (normalized.includes("720")) return "720p";
  if (normalized.includes("480")) return "480p";
  return undefined;
};

const summarizePayload = (payload: JsonObject): JsonObject => {
  const keys = [
    "aspect",
    "aspect_ratio",
    "duration",
    "resolution",
    "generate_audio",
    "voice_ids",
    "image_size",
    "model",
  ] as const;
  return keys.reduce((acc, key) => {
    if (payload[key] !== undefined) {
      acc[key] = payload[key];
    }
    return acc;
  }, {} as JsonObject);
};

const buildPricingParams = (
  modelId: string,
  payload: JsonObject
): Omit<PricingParams, "modelId"> => {
  const params: Omit<PricingParams, "modelId"> = {};

  const aspect = resolveAspectFromImageSize(payload);
  if (aspect) params.aspect = aspect;

  const duration = asNumber(payload.duration_seconds) ?? asNumber(payload.duration);
  if (duration) params.durationSeconds = duration;

  const resolution = resolveResolution(payload);
  if (resolution) params.resolution = resolution;

  const audio = asBoolean(payload.generate_audio) ?? asBoolean(payload.audio);
  if (audio !== undefined) params.audio = audio;

  const voiceIds = payload.voice_ids;
  if (
    Array.isArray(voiceIds) &&
    voiceIds.filter((item) => typeof item === "string" && item.trim().length > 0).length > 0
  ) {
    params.voiceControl = true;
  }

  const webSearch = asBoolean(payload.enable_web_search) ?? asBoolean(payload.web_search);
  if (webSearch !== undefined) params.webSearch = webSearch;

  const config = getModelConfig(modelId);
  if (!params.durationSeconds && config?.defaultDurationSeconds) {
    params.durationSeconds = config.defaultDurationSeconds;
  }
  if (!params.resolution && config?.defaultResolution) {
    params.resolution = config.defaultResolution;
  }
  if (params.audio === undefined && config?.defaultAudio !== undefined) {
    params.audio = config.defaultAudio;
  }
  if (!params.aspect && config?.defaultAspect) {
    params.aspect = config.defaultAspect;
  }

  return params;
};

const resolveSourceRef = (req: NextApiRequest): string => {
  const headerValue = req.headers["x-shortpulse-request-id"];
  if (typeof headerValue === "string" && headerValue.trim()) return headerValue.trim();
  if (Array.isArray(headerValue) && headerValue[0]?.trim()) return headerValue[0].trim();
  return randomUUID();
};

const isInsufficientCreditError = (message?: string): boolean =>
  /insufficient credits/i.test(message ?? "");
const isDuplicateError = (code?: string | null, message?: string): boolean =>
  code === "23505" || /duplicate key value/i.test(message ?? "");

/**
 * Debits credits for a model call before provider submission.
 */
export const chargeGenerationRequest = async ({
  req,
  res,
  modelId,
  payload,
  reason,
}: ChargeOptions): Promise<ChargeResult | null> => {
  const user = await requireApiUser(req, res);
  if (!user) return null;

  const pricingParams = buildPricingParams(modelId, payload);
  const breakdown = computeCostForModel(modelId, pricingParams);
  if (!breakdown?.credits || breakdown.credits <= 0) {
    res.status(500).json({ error: `No pricing strategy is configured for '${modelId}'.` });
    return null;
  }

  const sourceRef = resolveSourceRef(req);
  const chargeMetadata = {
    model_id: modelId,
    route: req.url ?? null,
    params: summarizePayload(payload),
    pricing_params: pricingParams,
    debited_credits: breakdown.credits,
  };

  const { error: debitError } = await insertCreditLedgerEntry({
    userId: user.id,
    changeCents: -Math.abs(Math.trunc(breakdown.credits)),
    reason,
    source: "generation_charge",
    sourceRef,
    metadata: chargeMetadata,
    createdBy: user.id,
  });

  if (debitError) {
    if (isInsufficientCreditError(debitError.message)) {
      res.status(402).json({ error: "Insufficient credits for this generation." });
      return null;
    }
    if (isDuplicateError((debitError as any).code, debitError.message)) {
      res.status(409).json({ error: "Duplicate submit request id. Retry with a new request id." });
      return null;
    }
    res.status(500).json({ error: debitError.message });
    return null;
  }

  const refund = async (
    message = "Auto-refund: generation submit failed.",
    extra: JsonObject = {}
  ) => {
    const { error } = await insertCreditLedgerEntry({
      userId: user.id,
      changeCents: Math.abs(Math.trunc(breakdown.credits)),
      reason: message,
      source: "generation_refund",
      sourceRef,
      metadata: {
        model_id: modelId,
        route: req.url ?? null,
        refunded_credits: breakdown.credits,
        ...extra,
      },
      createdBy: user.id,
    });
    if (error && !isDuplicateError((error as any).code, error.message)) {
      console.error("[generationBilling] refund insert failed", error.message);
    }
  };

  return {
    userId: user.id,
    modelId,
    credits: breakdown.credits,
    sourceRef,
    refund,
  };
};
