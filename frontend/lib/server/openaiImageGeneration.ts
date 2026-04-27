/**
 * OpenAI GPT Image 2 generation and persistence helpers.
 * Owns the direct-response provider call plus normalized AI Studio media/output persistence.
 */
import { randomUUID } from "crypto";
import {
  type OpenAiImage2Quality,
  type OpenAiImage2Size,
  OPENAI_GPT_IMAGE_2_MODEL_ID,
} from "../model-runtime/openAiImage2";
import { canAutoPersistRecoveryMedia } from "../mediaAutosavePolicy";
import { withCanonicalImageDimensions } from "../mediaDimensionMetadata";
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { extractImageDimensionsFromBuffer } from "./imageDimensions";
import { persistGenerationOutputRecords } from "./api/generationOutputs";
import { upsertGenerationProjection } from "./api/generationProjection";
import { upsertGenerationPublication } from "./api/generationPublications";
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { associateGenerationWithProjectForUser } from "./projectGenerationAssociationsService";

const DEFAULT_OPENAI_API_BASE = "https://api.openai.com/v1";
const MEDIA_BUCKET = "media_library";

type OpenAiGenerateImageInput = {
  prompt: string;
  size: OpenAiImage2Size;
  quality: OpenAiImage2Quality;
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

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(readOpenAiErrorMessage(payload));
  }

  const data = Array.isArray(payload.data) ? payload.data[0] : null;
  const imageRecord =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  const b64Json = normalizeOptionalString(imageRecord?.b64_json);
  if (!b64Json) {
    throw new Error("OpenAI image generation returned no image data.");
  }

  return {
    buffer: Buffer.from(b64Json, "base64"),
    contentType: resolveOutputContentType(),
    providerRequestId:
      normalizeOptionalString(payload.id) ??
      normalizeOptionalString(response.headers.get("x-request-id")) ??
      normalizeOptionalString(response.headers.get("request-id")),
    revisedPrompt: normalizeOptionalString(imageRecord?.revised_prompt),
  };
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

  let mediaFileId: string | null = null;
  if (autosavePolicyDecision.allowed) {
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
  }

  const outputRows = await persistGenerationOutputRecords({
    generationId,
    providerRequestId: resolvedProviderRequestId,
    userId,
    resultUrls: [signedResult.data.signedUrl],
    mediaFileIds: mediaFileId ? [mediaFileId] : [],
    metadata: generationMetadata,
  });
  const outputRowId = outputRows[0]?.id ?? null;

  if (outputRowId) {
    await upsertGenerationPublication({
      generationId,
      generationOutputId: outputRowId,
      userId,
      publicationState: "published",
      ownedMediaFileId: mediaFileId,
      previewUrl: signedResult.data.signedUrl,
      fullUrl: signedResult.data.signedUrl,
      previewStoragePath: storagePath,
      fullStoragePath: storagePath,
      publishedAt: createdAtIso,
      visibleInReferenceGrid: !hiddenInReferenceGrid,
      metadata: generationMetadata,
    });
  }

  await upsertGenerationProjection({
    generationId,
    userId,
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
    hiddenInReferenceGrid,
    referenceGridVisible: !hiddenInReferenceGrid,
    publicationState: "published",
    resultUrls: [signedResult.data.signedUrl],
    savedMediaIds: mediaFileId ? [mediaFileId] : [],
    generationReplay,
    characterContext,
    styleContext,
    startedAt: createdAtIso,
    completedAt: createdAtIso,
  });

  if (resolvedProjectId) {
    await associateGenerationWithProjectForUser({
      userId,
      projectId: resolvedProjectId,
      generationId,
    });
  }

  return {
    generationId,
    mediaFileId,
    requestId: resolvedRequestId,
    storagePath,
    signedUrl: signedResult.data.signedUrl,
    outputRowId,
  };
};
