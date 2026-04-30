/**
 * OpenAI GPT Image 2 generation and persistence helpers.
 * Owns the direct-response provider call plus normalized AI Studio media/output persistence.
 */
import { randomUUID } from "crypto";
import {
  type OpenAiImage2InputFidelity,
  type OpenAiImage2Quality,
  type OpenAiImage2Size,
  OPENAI_GPT_IMAGE_2_DEFAULT_INPUT_FIDELITY,
  OPENAI_GPT_IMAGE_2_MODEL_ID,
} from "../model-runtime/openAiImage2";
import { canAutoPersistRecoveryMedia } from "../mediaAutosavePolicy";
import { withCanonicalImageDimensions } from "../mediaDimensionMetadata";
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { extractImageDimensionsFromBuffer } from "./imageDimensions";
import {
  attachMediaFileToGenerationOutput,
  persistGenerationOutputRecords,
} from "./api/generationOutputs";
import { upsertGenerationProjection } from "./api/generationProjection";
import { upsertGenerationPublication } from "./api/generationPublications";
import { readGenerationAbandonmentContext } from "./api/generationAbandonment";
import { writeAppErrorLog } from "./api/appErrorLogs";
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { associateGenerationWithProjectForUser } from "./projectGenerationAssociationsService";

const DEFAULT_OPENAI_API_BASE = "https://api.openai.com/v1";
const MEDIA_BUCKET = "media_library";

type OpenAiGenerateImageInput = {
  prompt: string;
  size: OpenAiImage2Size;
  quality: OpenAiImage2Quality;
};

type OpenAiEditImageInput = OpenAiGenerateImageInput & {
  images: string[];
  inputFidelity?: OpenAiImage2InputFidelity;
  maskUrl?: string | null;
};

type PersistGeneratedImageInput = {
  userId: string;
  projectId?: string | null;
  promptText: string;
  modelId: string;
  providerRequestId?: string | null;
  requestId?: string | null;
  requestedSize: OpenAiImage2Size;
  requestedQuality: OpenAiImage2Quality;
  outputBuffer: Buffer;
  outputContentType: string;
  generationReplay?: Record<string, unknown>;
  characterContext?: Record<string, unknown>;
  styleContext?: Record<string, unknown>;
  hiddenInReferenceGrid?: boolean;
  extraMetadata?: Record<string, unknown>;
};

export type PersistGeneratedImageResult = {
  generationId: string;
  mediaFileId: string | null;
  requestId: string;
  storagePath: string;
  signedUrl: string;
  outputRowId: string | null;
};

type OpenAiImageGenerationResult = {
  buffer: Buffer;
  contentType: string;
  providerRequestId: string | null;
  revisedPrompt: string | null;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
    inputImageTokens: number | null;
    inputTextTokens: number | null;
    outputImageTokens: number | null;
    outputTextTokens: number | null;
  } | null;
};

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeStem = (value: string): string => {
  const normalized = value.trim().replace(/[^a-zA-Z0-9]+/g, "-");
  const compact = normalized.replace(/^-+|-+$/g, "").slice(0, 80);
  return compact || "generated-image";
};

const resolveOutputContentType = (): string => "image/png";

const resolveOpenAiApiBase = (): string => {
  const raw = (process.env.OPENAI_API_BASE ?? "").trim();
  if (!raw.length) return DEFAULT_OPENAI_API_BASE;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
};

const readOpenAiErrorMessage = (payload: unknown): string => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "OpenAI image generation failed.";
  }
  const record = payload as Record<string, unknown>;
  const direct = normalizeOptionalString(record.error);
  if (direct) return direct;
  const errorRecord =
    record.error && typeof record.error === "object" && !Array.isArray(record.error)
      ? (record.error as Record<string, unknown>)
      : null;
  const message = normalizeOptionalString(errorRecord?.message);
  if (message) return message;
  return "OpenAI image generation failed.";
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const readOpenAiImageUsage = (
  payload: Record<string, unknown>
): OpenAiImageGenerationResult["usage"] => {
  const usage = asRecord(payload.usage);
  if (!usage) return null;
  const inputTokensDetails = asRecord(usage.input_tokens_details);
  const outputTokensDetails = asRecord(usage.output_tokens_details);
  return {
    inputTokens: asNumber(usage.input_tokens),
    outputTokens: asNumber(usage.output_tokens),
    totalTokens: asNumber(usage.total_tokens),
    inputImageTokens: asNumber(inputTokensDetails?.image_tokens),
    inputTextTokens: asNumber(inputTokensDetails?.text_tokens),
    outputImageTokens: asNumber(outputTokensDetails?.image_tokens),
    outputTextTokens: asNumber(outputTokensDetails?.text_tokens),
  };
};

const resolveProviderRequestId = ({
  payload,
  response,
}: {
  payload: Record<string, unknown>;
  response: Response;
}): string | null =>
  normalizeOptionalString(payload.id) ??
  normalizeOptionalString(response.headers.get("x-request-id")) ??
  normalizeOptionalString(response.headers.get("request-id"));

const parseOpenAiImageResponse = async (
  response: Response
): Promise<OpenAiImageGenerationResult> => {
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(readOpenAiErrorMessage(payload));
  }

  const data = Array.isArray(payload.data) ? payload.data[0] : null;
  const imageRecord = asRecord(data);
  const b64Json = normalizeOptionalString(imageRecord?.b64_json);
  if (!b64Json) {
    throw new Error("OpenAI image generation returned no image data.");
  }

  return {
    buffer: Buffer.from(b64Json, "base64"),
    contentType: resolveOutputContentType(),
    providerRequestId: resolveProviderRequestId({ payload, response }),
    revisedPrompt: normalizeOptionalString(imageRecord?.revised_prompt),
    usage: readOpenAiImageUsage(payload),
  };
};

const readMediaAutosaveEnabledForUser = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("user_preferences")
      .select("media_autosave_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return true;
    const value = (data as { media_autosave_enabled?: unknown } | null)?.media_autosave_enabled;
    return typeof value === "boolean" ? value : true;
  } catch {
    return true;
  }
};

const associateGeneratedOpenAiImageWithProject = async ({
  generationId,
  modelId,
  projectId,
  providerRequestId,
  requestId,
  userId,
}: {
  generationId: string;
  modelId: string;
  projectId: string | null;
  providerRequestId: string | null;
  requestId: string;
  userId: string;
}): Promise<void> => {
  if (!projectId) return;
  try {
    await associateGenerationWithProjectForUser({
      userId,
      projectId,
      generationId,
    });
  } catch (error) {
    await writeAppErrorLog({
      source: "telemetry.openai_image.project_association_failed",
      message: "OpenAI image generation project association failed.",
      requestId,
      userId,
      statusCode: 200,
      metadata: {
        generation_id: generationId,
        project_id: projectId,
        provider: "openai",
        provider_request_id: providerRequestId,
        model_id: modelId,
        association_error: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => undefined);
  }
};

/**
 * Calls the OpenAI Images API for a single GPT Image 2 generation.
 */
export const generateOpenAiImage = async ({
  prompt,
  size,
  quality,
}: OpenAiGenerateImageInput): Promise<OpenAiImageGenerationResult> => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch(`${resolveOpenAiApiBase()}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_GPT_IMAGE_2_MODEL_ID,
      prompt,
      size,
      quality,
      n: 1,
      output_format: "png",
      moderation: "auto",
    }),
  });

  return parseOpenAiImageResponse(response);
};

/**
 * Calls the OpenAI Images API for a single GPT Image 2 edit.
 */
export const editOpenAiImage = async ({
  prompt,
  size,
  quality,
  images,
  inputFidelity = OPENAI_GPT_IMAGE_2_DEFAULT_INPUT_FIDELITY,
  maskUrl = null,
}: OpenAiEditImageInput): Promise<OpenAiImageGenerationResult> => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch(`${resolveOpenAiApiBase()}/images/edits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_GPT_IMAGE_2_MODEL_ID,
      images: images.map((imageUrl) => ({ image_url: imageUrl })),
      prompt,
      size,
      quality,
      n: 1,
      output_format: "png",
      moderation: "auto",
      input_fidelity: inputFidelity,
      ...(maskUrl ? { mask: { image_url: maskUrl } } : {}),
    }),
  });

  return parseOpenAiImageResponse(response);
};

/**
 * Persists one generated image into canonical generation/output/media tables.
 */
export const persistGeneratedImageAsset = async ({
  userId,
  projectId = null,
  promptText,
  modelId,
  providerRequestId = null,
  requestId = null,
  requestedSize,
  requestedQuality,
  outputBuffer,
  outputContentType,
  generationReplay = {},
  characterContext = {},
  styleContext = {},
  hiddenInReferenceGrid = false,
  extraMetadata = {},
}: PersistGeneratedImageInput): Promise<PersistGeneratedImageResult> => {
  const supabaseAdmin = getSupabaseAdmin();
  const generationId = randomUUID();
  const resolvedRequestId = normalizeOptionalString(requestId) ?? randomUUID();
  const resolvedProviderRequestId = normalizeOptionalString(providerRequestId);
  const resolvedProjectId = normalizeOptionalString(projectId);
  const createdAtIso = new Date().toISOString();
  const abandonment = await readGenerationAbandonmentContext({
    userId,
    sourceRef: resolvedRequestId,
    requestId: resolvedRequestId,
  });
  const effectiveHiddenInReferenceGrid = hiddenInReferenceGrid || abandonment.abandoned;
  const mediaAutosaveEnabled = await readMediaAutosaveEnabledForUser(userId);
  const autosavePolicyDecision = canAutoPersistRecoveryMedia({
    intent: "auto",
    mediaAutosaveEnabled,
  });
  const imageDimensions = extractImageDimensionsFromBuffer(outputBuffer);
  const filename = `${sanitizeStem(promptText)}.png`;
  const storagePath = assertUserScopedMediaStoragePath({
    userId,
    path: `${userId}/generations/images/${generationId}/${filename}`,
    label: "Generated GPT Image 2 storage path",
  });

  const uploadResult = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, outputBuffer, {
      contentType: outputContentType,
      upsert: false,
    });
  if (uploadResult.error) {
    throw new Error(uploadResult.error.message || "Unable to persist generated image.");
  }

  const signedResult = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (signedResult.error || !signedResult.data?.signedUrl) {
    throw new Error(signedResult.error?.message || "Unable to sign generated image.");
  }

  const generationMetadata = withCanonicalImageDimensions(
    {
      provider_request_id: resolvedProviderRequestId,
      requested_size: requestedSize,
      requested_quality: requestedQuality,
      autosave_enabled: mediaAutosaveEnabled,
      user_abandoned: abandonment.abandoned,
      abandoned_no_refund: abandonment.noRefund,
      hidden_in_reference_grid: effectiveHiddenInReferenceGrid,
      autosave_decision: autosavePolicyDecision.allowed ? "auto_persisted" : "autosave_skipped",
      autosave_decision_reason: autosavePolicyDecision.reason,
      mime_type: outputContentType,
      ...extraMetadata,
    },
    imageDimensions
  );

  const generationInsert = await supabaseAdmin
    .from("ai_generations")
    .insert({
      id: generationId,
      user_id: userId,
      mode: "image",
      provider: "openai",
      model_id: modelId,
      prompt_text: promptText,
      request_id: resolvedRequestId,
      status: "success",
      completed_at: createdAtIso,
      metadata: generationMetadata,
    })
    .select("id")
    .single();
  if (generationInsert.error) {
    throw new Error(generationInsert.error.message || "Unable to record image generation.");
  }

  let autosaveDecision: string = autosavePolicyDecision.allowed
    ? "auto_persisted"
    : "autosave_skipped";
  let autosaveDecisionReason: string = autosavePolicyDecision.reason;
  let mediaFileId: string | null = null;
  let outputRows = await persistGenerationOutputRecords({
    generationId,
    providerRequestId: resolvedProviderRequestId,
    userId,
    resultUrls: [signedResult.data.signedUrl],
    metadata: generationMetadata,
  });

  if (autosavePolicyDecision.allowed) {
    try {
      const mediaInsert = await supabaseAdmin
        .from("media_files")
        .insert({
          filename,
          storage_path: storagePath,
          file_type: "image",
          file_size: outputBuffer.length,
          source: "ai_studio",
          source_ref: generationId,
          metadata: generationMetadata,
          user_id: userId,
        })
        .select("id")
        .single();
      if (mediaInsert.error || !mediaInsert.data?.id) {
        throw new Error(mediaInsert.error?.message || "Unable to record generated image media.");
      }
      mediaFileId = mediaInsert.data.id as string;
      await attachMediaFileToGenerationOutput({
        generationId,
        userId,
        outputIndex: 0,
        mediaFileId,
        resultUrl: signedResult.data.signedUrl,
        providerRequestId: resolvedProviderRequestId,
        metadata: generationMetadata,
      });
      outputRows = await persistGenerationOutputRecords({
        generationId,
        providerRequestId: resolvedProviderRequestId,
        userId,
        resultUrls: [signedResult.data.signedUrl],
        mediaFileIds: [mediaFileId],
        metadata: generationMetadata,
      });
    } catch (error) {
      autosaveDecision = "autosave_skipped";
      autosaveDecisionReason = error instanceof Error ? error.message : "media_autosave_failed";
      await writeAppErrorLog({
        source: "telemetry.openai_image.media_autosave_failed",
        message: "OpenAI image generation kept result URL after media autosave failed.",
        requestId: resolvedRequestId,
        userId,
        statusCode: 200,
        metadata: {
          generation_id: generationId,
          provider_request_id: resolvedProviderRequestId,
          model_id: modelId,
          autosave_error: autosaveDecisionReason,
        },
      }).catch(() => undefined);
    }
  }
  const outputRowId = outputRows[0]?.id ?? null;
  const publicationMetadata = {
    ...generationMetadata,
    autosave_decision: autosaveDecision,
    autosave_decision_reason: autosaveDecisionReason,
  };

  if (outputRowId) {
    await upsertGenerationPublication({
      generationId,
      generationOutputId: outputRowId,
      userId,
      publicationState: abandonment.abandoned ? "suppressed" : "published",
      ownedMediaFileId: mediaFileId,
      previewUrl: signedResult.data.signedUrl,
      fullUrl: signedResult.data.signedUrl,
      previewStoragePath: storagePath,
      fullStoragePath: storagePath,
      publishedAt: createdAtIso,
      visibleInReferenceGrid: !effectiveHiddenInReferenceGrid,
      metadata: publicationMetadata,
    });
  }

  await upsertGenerationProjection({
    generationId,
    userId,
    projectId: resolvedProjectId,
    sourceRef: resolvedRequestId,
    requestId: resolvedRequestId,
    provider: "openai",
    providerRequestId: resolvedProviderRequestId,
    status: "success",
    taskState: "success",
    queueState: "dispatched",
    displayPrompt: promptText,
    modelId,
    previewUrl: signedResult.data.signedUrl,
    previewStoragePath: storagePath,
    fullStoragePath: storagePath,
    saveState: mediaFileId ? "saved" : "idle",
    hiddenInReferenceGrid: effectiveHiddenInReferenceGrid,
    referenceGridVisible: !effectiveHiddenInReferenceGrid,
    publicationState: abandonment.abandoned ? "suppressed" : "published",
    resultUrls: [signedResult.data.signedUrl],
    savedMediaIds: mediaFileId ? [mediaFileId] : [],
    generationReplay,
    characterContext,
    styleContext,
    startedAt: createdAtIso,
    completedAt: createdAtIso,
  });

  await associateGeneratedOpenAiImageWithProject({
    generationId,
    modelId,
    projectId: resolvedProjectId,
    providerRequestId: resolvedProviderRequestId,
    requestId: resolvedRequestId,
    userId,
  });

  return {
    generationId,
    mediaFileId,
    requestId: resolvedRequestId,
    storagePath,
    signedUrl: signedResult.data.signedUrl,
    outputRowId,
  };
};
