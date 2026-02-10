/**
 * Server-authoritative credit charging for generation requests.
 * Computes model cost from request payload, debits before provider submit,
 * tracks provider request ids for reconciliation, and exposes idempotent
 * refund helpers for failed submits and failed status outcomes.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";
import { computeCostForModel, getModelConfig } from "../../../features/ai-studio/logic/pricing";
import type { PricingParams } from "../../../features/ai-studio/logic/pricingTypes";
import { requireApiUser } from "./auth";
import { insertCreditLedgerEntry } from "./creditLedger";
import { getSupabaseAdmin } from "./supabaseAdmin";

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
  markSubmitted: (providerRequestId: string, extra?: JsonObject) => Promise<void>;
  refund: (message?: string, extra?: JsonObject) => Promise<void>;
};

type LedgerChargeRow = {
  id: string;
  source_ref: string | null;
  change_cents: number;
  metadata: JsonObject | null;
};

type FailedGenerationSettlementOptions = {
  userId: string;
  providerRequestId: string;
  reason: string;
  routeLabel: string;
  detail?: JsonObject;
};

type FailedGenerationSettlementResult = {
  settled: boolean;
  sourceRef?: string | null;
  note: string;
};

type ReservationRpcState =
  | "reserved"
  | "already_reserved"
  | "captured"
  | "already_captured"
  | "released"
  | "already_released"
  | "not_found"
  | "failed";

type ReservationRpcResult = {
  status: ReservationRpcState;
  sourceRef?: string | null;
  message?: string | null;
};

type RpcErrorLike = {
  code?: string | null;
  message?: string | null;
};

type RpcInvoker = {
  rpc: (
    functionName: string,
    params: Record<string, unknown>
  ) => Promise<{ data: unknown; error: RpcErrorLike | null }>;
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
const isMissingLedgerSchemaError = (code?: string | null, message?: string): boolean => {
  const normalizedCode = String(code ?? "").toUpperCase();
  if (normalizedCode === "42703" || normalizedCode === "PGRST204") return true;
  const text = String(message ?? "");
  return (
    /column .*ai_credit_ledger.*does not exist/i.test(text) ||
    /could not find the '.*' column of 'ai_credit_ledger'/i.test(text)
  );
};
const isMissingRpcFunctionError = (code?: string | null, message?: string): boolean => {
  const normalizedCode = String(code ?? "").toUpperCase();
  if (normalizedCode === "PGRST202" || normalizedCode === "42883") return true;
  return /function .* does not exist/i.test(String(message ?? ""));
};

const readJsonObject = (value: unknown): JsonObject => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonObject;
};

const readErrorCode = (error: unknown): string | null => {
  if (!error || typeof error !== "object") return null;
  const candidate = (error as { code?: unknown }).code;
  return typeof candidate === "string" ? candidate : null;
};

const readObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const parseReservationRow = (
  data: unknown,
  fallbackStatus: ReservationRpcState,
  fallbackSourceRef: string | null
): ReservationRpcResult => {
  const row = readObject(Array.isArray(data) ? data[0] : data);
  return {
    status: normalizeRpcStatus(row.status, fallbackStatus),
    sourceRef: asString(row.source_ref) ?? fallbackSourceRef,
    message: asString(row.message) ?? null,
  };
};

const parseLedgerChargeRow = (data: unknown): LedgerChargeRow | null => {
  if (!data) return null;
  const row = readObject(data);
  const id = row.id;
  if (id === undefined || id === null) return null;
  return {
    id: String(id),
    source_ref: asString(row.source_ref) ?? null,
    change_cents: Number(row.change_cents ?? 0),
    metadata: readJsonObject(row.metadata),
  };
};

const normalizeRpcStatus = (value: unknown, fallback: ReservationRpcState): ReservationRpcState => {
  const normalized = String(value ?? fallback).toLowerCase();
  switch (normalized) {
    case "reserved":
    case "already_reserved":
    case "captured":
    case "already_captured":
    case "released":
    case "already_released":
    case "not_found":
      return normalized;
    default:
      return fallback;
  }
};

const isFalModel = (modelId: string): boolean => {
  const config = getModelConfig(modelId);
  if (config?.provider === "fal") return true;
  return modelId.toLowerCase().startsWith("fal");
};

const reserveGenerationCredits = async ({
  userId,
  sourceRef,
  modelId,
  amountCents,
  reason,
  metadata,
}: {
  userId: string;
  sourceRef: string;
  modelId: string;
  amountCents: number;
  reason: string;
  metadata: JsonObject;
}): Promise<ReservationRpcResult> => {
  try {
    const rpcClient = getSupabaseAdmin() as unknown as RpcInvoker;
    const { data, error } = await rpcClient.rpc("reserve_generation_credits", {
      p_user_id: userId,
      p_source_ref: sourceRef,
      p_model_id: modelId,
      p_amount_cents: amountCents,
      p_reason: reason,
      p_metadata: metadata,
    });
    if (error) {
      if (isMissingRpcFunctionError(readErrorCode(error), error.message ?? undefined)) {
        return { status: "failed", message: "missing_reservation_function" };
      }
      if (isInsufficientCreditError(error.message ?? undefined)) {
        return { status: "failed", message: "insufficient_credits" };
      }
      return { status: "failed", message: error.message ?? "reservation_failed" };
    }
    return parseReservationRow(data, "reserved", sourceRef);
  } catch (error) {
    return { status: "failed", message: String(error) };
  }
};

const markGenerationReservationSubmitted = async ({
  userId,
  sourceRef,
  providerRequestId,
  metadata,
}: {
  userId: string;
  sourceRef: string;
  providerRequestId: string;
  metadata: JsonObject;
}): Promise<ReservationRpcResult> => {
  try {
    const rpcClient = getSupabaseAdmin() as unknown as RpcInvoker;
    const { data, error } = await rpcClient.rpc("mark_generation_reservation_submitted", {
      p_user_id: userId,
      p_source_ref: sourceRef,
      p_provider_request_id: providerRequestId,
      p_metadata: metadata,
    });
    if (error) {
      if (isMissingRpcFunctionError(readErrorCode(error), error.message ?? undefined)) {
        return { status: "failed", message: "missing_reservation_function" };
      }
      console.error(
        "[generationBilling] mark_generation_reservation_submitted failed",
        error.message
      );
      return { status: "failed", message: error.message ?? "mark_submitted_failed" };
    }
    return parseReservationRow(data, "not_found", sourceRef);
  } catch (error) {
    return { status: "failed", message: String(error) };
  }
};

const releaseGenerationReservationBySourceRef = async ({
  userId,
  sourceRef,
  reason,
  metadata,
}: {
  userId: string;
  sourceRef: string;
  reason: string;
  metadata: JsonObject;
}): Promise<ReservationRpcResult> => {
  try {
    const rpcClient = getSupabaseAdmin() as unknown as RpcInvoker;
    const { data, error } = await rpcClient.rpc("release_generation_reservation_by_source_ref", {
      p_user_id: userId,
      p_source_ref: sourceRef,
      p_reason: reason,
      p_metadata: metadata,
    });
    if (error) {
      if (isMissingRpcFunctionError(readErrorCode(error), error.message ?? undefined)) {
        return { status: "failed", message: "missing_reservation_function" };
      }
      console.error("[generationBilling] release by source_ref failed", error.message);
      return { status: "failed", message: error.message ?? "release_failed" };
    }
    return parseReservationRow(data, "not_found", sourceRef);
  } catch (error) {
    return { status: "failed", message: String(error) };
  }
};

const releaseGenerationReservationByProviderRequest = async ({
  userId,
  providerRequestId,
  reason,
  metadata,
}: {
  userId: string;
  providerRequestId: string;
  reason: string;
  metadata: JsonObject;
}): Promise<ReservationRpcResult> => {
  try {
    const rpcClient = getSupabaseAdmin() as unknown as RpcInvoker;
    const { data, error } = await rpcClient.rpc(
      "release_generation_reservation_by_provider_request",
      {
        p_user_id: userId,
        p_provider_request_id: providerRequestId,
        p_reason: reason,
        p_metadata: metadata,
      }
    );
    if (error) {
      if (isMissingRpcFunctionError(readErrorCode(error), error.message ?? undefined)) {
        return { status: "failed", message: "missing_reservation_function" };
      }
      console.error("[generationBilling] release by provider_request failed", error.message);
      return { status: "failed", message: error.message ?? "release_failed" };
    }
    return parseReservationRow(data, "not_found", null);
  } catch (error) {
    return { status: "failed", message: String(error) };
  }
};

const captureGenerationReservationByProviderRequest = async ({
  userId,
  providerRequestId,
  reason,
  metadata,
}: {
  userId: string;
  providerRequestId: string;
  reason: string;
  metadata: JsonObject;
}): Promise<ReservationRpcResult> => {
  try {
    const rpcClient = getSupabaseAdmin() as unknown as RpcInvoker;
    const { data, error } = await rpcClient.rpc(
      "capture_generation_reservation_by_provider_request",
      {
        p_user_id: userId,
        p_provider_request_id: providerRequestId,
        p_reason: reason,
        p_metadata: metadata,
      }
    );
    if (error) {
      if (isMissingRpcFunctionError(readErrorCode(error), error.message ?? undefined)) {
        return { status: "failed", message: "missing_reservation_function" };
      }
      console.error("[generationBilling] capture by provider_request failed", error.message);
      return { status: "failed", message: error.message ?? "capture_failed" };
    }
    return parseReservationRow(data, "not_found", null);
  } catch (error) {
    return { status: "failed", message: String(error) };
  }
};

const lookupChargeBySourceRef = async (
  userId: string,
  sourceRef: string
): Promise<LedgerChargeRow | null> => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("ai_credit_ledger")
      .select("id, source_ref, change_cents, metadata")
      .eq("user_id", userId)
      .eq("source", "generation_charge")
      .eq("source_ref", sourceRef)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (!isMissingLedgerSchemaError(readErrorCode(error), error.message)) {
        console.error("[generationBilling] lookupChargeBySourceRef failed", error.message);
      }
      return null;
    }
    return parseLedgerChargeRow(data);
  } catch (error) {
    console.error("[generationBilling] lookupChargeBySourceRef threw", String(error));
    return null;
  }
};

const lookupChargeByProviderRequestId = async (
  userId: string,
  providerRequestId: string
): Promise<LedgerChargeRow | null> => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("ai_credit_ledger")
      .select("id, source_ref, change_cents, metadata")
      .eq("user_id", userId)
      .eq("source", "generation_charge")
      .contains("metadata", { provider_request_id: providerRequestId })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (!isMissingLedgerSchemaError(readErrorCode(error), error.message)) {
        console.error("[generationBilling] lookupChargeByProviderRequestId failed", error.message);
      }
      return null;
    }
    return parseLedgerChargeRow(data);
  } catch (error) {
    console.error("[generationBilling] lookupChargeByProviderRequestId threw", String(error));
    return null;
  }
};

const attachProviderRequestToCharge = async ({
  userId,
  sourceRef,
  providerRequestId,
  metadataExtra = {},
}: {
  userId: string;
  sourceRef: string;
  providerRequestId: string;
  metadataExtra?: JsonObject;
}) => {
  if (!providerRequestId) return;
  const existing = await lookupChargeBySourceRef(userId, sourceRef);
  if (!existing) return;

  const nextMetadata = {
    ...readJsonObject(existing.metadata),
    provider_request_id: providerRequestId,
    ...metadataExtra,
  };
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from("ai_credit_ledger")
      .update({ metadata: nextMetadata })
      .eq("id", existing.id);
    if (error && !isMissingLedgerSchemaError(readErrorCode(error), error.message)) {
      console.error("[generationBilling] attachProviderRequestToCharge failed", error.message);
    }
  } catch (error) {
    console.error("[generationBilling] attachProviderRequestToCharge threw", String(error));
  }
};

const refundChargeRow = async ({
  userId,
  charge,
  reason,
  metadata,
}: {
  userId: string;
  charge: LedgerChargeRow;
  reason: string;
  metadata: JsonObject;
}): Promise<FailedGenerationSettlementResult> => {
  if (!charge.source_ref) {
    return { settled: false, sourceRef: null, note: "charge_missing_source_ref" };
  }
  const refundCents = Math.abs(Math.trunc(Number(charge.change_cents ?? 0)));
  if (!refundCents) {
    return { settled: false, sourceRef: charge.source_ref, note: "charge_missing_amount" };
  }
  const { error } = await insertCreditLedgerEntry({
    userId,
    changeCents: refundCents,
    reason,
    source: "generation_refund",
    sourceRef: charge.source_ref,
    metadata,
    createdBy: userId,
  });
  if (!error) {
    return { settled: true, sourceRef: charge.source_ref, note: "refund_inserted" };
  }
  if (isDuplicateError(readErrorCode(error), error.message)) {
    return { settled: true, sourceRef: charge.source_ref, note: "refund_already_exists" };
  }
  return { settled: false, sourceRef: charge.source_ref, note: error.message ?? "refund_failed" };
};

/**
 * Settles failed generation outcomes by provider request id.
 * This is called from status routes when the upstream reports a definitive failure.
 */
export const settleFailedGenerationByProviderRequest = async ({
  userId,
  providerRequestId,
  reason,
  routeLabel,
  detail = {},
}: FailedGenerationSettlementOptions): Promise<FailedGenerationSettlementResult> => {
  if (!providerRequestId) {
    return { settled: false, note: "missing_provider_request_id" };
  }

  const releaseResult = await releaseGenerationReservationByProviderRequest({
    userId,
    providerRequestId,
    reason,
    metadata: {
      route: routeLabel,
      provider_request_id: providerRequestId,
      settled_at: new Date().toISOString(),
      ...detail,
    },
  });
  if (releaseResult.status === "released" || releaseResult.status === "already_released") {
    return {
      settled: true,
      sourceRef: releaseResult.sourceRef ?? null,
      note: releaseResult.status,
    };
  }
  if (releaseResult.status === "already_captured") {
    return {
      settled: false,
      sourceRef: releaseResult.sourceRef ?? null,
      note: "already_captured",
    };
  }
  if (
    releaseResult.status === "failed" &&
    releaseResult.message !== "missing_reservation_function"
  ) {
    return {
      settled: false,
      sourceRef: releaseResult.sourceRef ?? null,
      note: releaseResult.message ?? "reservation_release_failed",
    };
  }

  const charge = await lookupChargeByProviderRequestId(userId, providerRequestId);
  if (!charge) {
    return { settled: false, note: "charge_not_found" };
  }

  return refundChargeRow({
    userId,
    charge,
    reason,
    metadata: {
      provider_request_id: providerRequestId,
      route: routeLabel,
      settled_at: new Date().toISOString(),
      ...detail,
    },
  });
};

/**
 * Captures a previously reserved generation after provider success.
 */
export const captureSucceededGenerationByProviderRequest = async ({
  userId,
  providerRequestId,
  reason,
  routeLabel,
  detail = {},
}: FailedGenerationSettlementOptions): Promise<FailedGenerationSettlementResult> => {
  if (!providerRequestId) {
    return { settled: false, note: "missing_provider_request_id" };
  }

  const captureResult = await captureGenerationReservationByProviderRequest({
    userId,
    providerRequestId,
    reason,
    metadata: {
      route: routeLabel,
      provider_request_id: providerRequestId,
      captured_at: new Date().toISOString(),
      ...detail,
    },
  });
  if (captureResult.status === "captured" || captureResult.status === "already_captured") {
    return {
      settled: true,
      sourceRef: captureResult.sourceRef ?? null,
      note: captureResult.status,
    };
  }
  if (captureResult.status === "already_released") {
    return {
      settled: false,
      sourceRef: captureResult.sourceRef ?? null,
      note: "already_released",
    };
  }
  if (
    captureResult.status === "failed" &&
    captureResult.message !== "missing_reservation_function"
  ) {
    return {
      settled: false,
      sourceRef: captureResult.sourceRef ?? null,
      note: captureResult.message ?? "reservation_capture_failed",
    };
  }

  const legacyCharge = await lookupChargeByProviderRequestId(userId, providerRequestId);
  if (legacyCharge) {
    return {
      settled: true,
      sourceRef: legacyCharge.source_ref ?? null,
      note: "legacy_charge_exists",
    };
  }
  return { settled: false, note: "charge_not_found" };
};

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

  const useReservationMode = isFalModel(modelId);
  if (useReservationMode) {
    const reserveResult = await reserveGenerationCredits({
      userId: user.id,
      sourceRef,
      modelId,
      amountCents: Math.abs(Math.trunc(breakdown.credits)),
      reason,
      metadata: chargeMetadata,
    });
    if (reserveResult.status === "failed") {
      if (reserveResult.message === "insufficient_credits") {
        res.status(402).json({ error: "Insufficient credits for this generation." });
        return null;
      }
      if (reserveResult.message !== "missing_reservation_function") {
        res.status(500).json({
          error: reserveResult.message ?? "Unable to reserve credits for generation.",
        });
        return null;
      }
    } else if (
      reserveResult.status === "already_captured" ||
      reserveResult.status === "already_released"
    ) {
      res.status(409).json({ error: "Duplicate submit request id. Retry with a new request id." });
      return null;
    } else if (reserveResult.status === "reserved" || reserveResult.status === "already_reserved") {
      const markSubmitted = async (providerRequestId: string, extra: JsonObject = {}) => {
        if (!providerRequestId) return;
        const status = await markGenerationReservationSubmitted({
          userId: user.id,
          sourceRef,
          providerRequestId,
          metadata: {
            submit_marked_at: new Date().toISOString(),
            ...extra,
          },
        });
        if (status.status === "failed") {
          console.error("[generationBilling] reservation markSubmitted failed", status.message);
        }
      };

      const refund = async (
        message = "Auto-release: generation submit failed.",
        extra: JsonObject = {}
      ) => {
        const released = await releaseGenerationReservationBySourceRef({
          userId: user.id,
          sourceRef,
          reason: message,
          metadata: {
            route: req.url ?? null,
            released_credits: breakdown.credits,
            ...extra,
          },
        });
        if (
          released.status === "failed" ||
          (released.status !== "released" &&
            released.status !== "already_released" &&
            released.status !== "already_captured" &&
            released.status !== "not_found")
        ) {
          console.error(
            "[generationBilling] reservation release failed",
            released.message ?? released.status
          );
        }
      };

      return {
        userId: user.id,
        modelId,
        credits: breakdown.credits,
        sourceRef,
        markSubmitted,
        refund,
      };
    }
  }

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
    if (isDuplicateError(readErrorCode(debitError), debitError.message)) {
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
    if (error && !isDuplicateError(readErrorCode(error), error.message)) {
      console.error("[generationBilling] refund insert failed", error.message);
    }
  };

  const markSubmitted = async (providerRequestId: string, extra: JsonObject = {}) => {
    if (!providerRequestId) return;
    await attachProviderRequestToCharge({
      userId: user.id,
      sourceRef,
      providerRequestId,
      metadataExtra: {
        submit_marked_at: new Date().toISOString(),
        reservation_mode: false,
        ...extra,
      },
    });
  };

  return {
    userId: user.id,
    modelId,
    credits: breakdown.credits,
    sourceRef,
    markSubmitted,
    refund,
  };
};
