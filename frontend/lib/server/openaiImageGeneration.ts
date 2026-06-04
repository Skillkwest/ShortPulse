/**
 * GPT Image 2 generation and persistence helpers.
 * Owns the direct-response provider call plus normalized AI Studio media/output persistence.
 */
import { randomUUID } from "crypto";
import {
  OPENAI_GPT_IMAGE_2_DEFAULT_MODERATION,
  type OpenAiImage2Quality,
  type OpenAiImage2Size,
  OPENAI_GPT_IMAGE_2_MODEL_ID,
} from "../model-runtime/openAiImage2";
import { canAutoPersistRecoveryMedia } from "../mediaAutosavePolicy";
import { withCanonicalImageDimensions } from "../mediaDimensionMetadata";
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { resolveMediaStorageQuotaUserMessage } from "../mediaStorageQuota";
import { extractImageDimensionsFromBuffer } from "./imageDimensions";
import {
  attachMediaFileToGenerationOutput,
  persistGenerationOutputRecords,
} from "./api/generationOutputs";
import { resolveGenerationPromptFromPayload } from "./api/generationPayloadMetadata";
import { upsertGenerationProjection } from "./api/generationProjection";
import { upsertGenerationPublication } from "./api/generationPublications";
import { readGenerationAbandonmentContext } from "./api/generationAbandonment";
import { writeAppErrorLog } from "./api/appErrorLogs";
import { toErrorMessage } from "./api/errorMessage";
import { readMediaAutosaveEnabledForUser } from "./api/mediaAutosavePreference";
import { resolveMediaAutosavePreferenceLookupUserMessage } from "./api/mediaAutosavePreference";
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { associateGenerationAndMediaWithProjectForUserBestEffort } from "./projectGenerationAssociationsService";

const DEFAULT_OPENAI_API_BASE = "https://api.openai.com/v1";
const MEDIA_BUCKET = "media_library";

type OpenAiGenerateImageInput = {
  prompt: string;
  size: OpenAiImage2Size;
  quality: OpenAiImage2Quality;
};

export type OpenAiEditImageSource =
  | {
      kind: "url";
      imageUrl: string;
    }
  | {
      kind: "file";
      buffer: Buffer;
      contentType: string;
      filename: string;
      sourceId?: string;
    };

type OpenAiEditImageInput = OpenAiGenerateImageInput & {
  images: OpenAiEditImageSource[];
  mask?: OpenAiEditImageSource | null;
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
  beforeVisibleSettlement?: (context: {
    generationId: string;
    requestId: string;
    providerRequestId: string | null;
    outputRowId: string | null;
    mediaFileId: string | null;
  }) => Promise<void>;
};

export type PersistGeneratedImageResult = {
  generationId: string;
  mediaFileId: string | null;
  requestId: string;
  storagePath: string;
  signedUrl: string;
  outputRowId: string | null;
  saveState: "saved" | "idle" | "failed" | "blocked_storage";
  saveError: string | null;
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

const resolveAutosaveSaveOutcome = ({
  mediaFileId,
  autosaveDecisionReason,
  autosavePreferenceLookupMessage,
}: {
  mediaFileId: string | null;
  autosaveDecisionReason: string;
  autosavePreferenceLookupMessage: string | null;
}): {
  saveState: "saved" | "idle" | "failed" | "blocked_storage";
  saveError: string | null;
} => {
  if (mediaFileId) {
    return {
      saveState: "saved",
      saveError: null,
    };
  }
  if (autosavePreferenceLookupMessage) {
    return {
      saveState: "failed",
      saveError: autosavePreferenceLookupMessage,
    };
  }
  const quotaMessage = resolveMediaStorageQuotaUserMessage(autosaveDecisionReason);
  return {
    saveState: quotaMessage ? "blocked_storage" : "idle",
    saveError: quotaMessage,
  };
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

const buildOpenAiImageEditPayloadRef = async ({
  apiKey,
  image,
}: {
  apiKey: string;
  image: OpenAiEditImageSource;
}): Promise<{
  payload: { image_url: string } | { file_id: string };
  uploadedFileId: string | null;
}> => {
  if (image.kind === "url") {
    return {
      payload: { image_url: image.imageUrl },
      uploadedFileId: null,
    };
  }

  const formData = new FormData();
  formData.set("purpose", "vision");
  formData.set(
    "file",
    new Blob([image.buffer], { type: image.contentType || "application/octet-stream" }),
    image.filename
  );

  const response = await fetch(`${resolveOpenAiApiBase()}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(readOpenAiErrorMessage(payload));
  }

  const fileId = normalizeOptionalString(payload.id);
  if (!fileId) {
    throw new Error("OpenAI file upload returned no file id.");
  }

  return {
    payload: { file_id: fileId },
    uploadedFileId: fileId,
  };
};

const deleteOpenAiUploadedFile = async ({
  apiKey,
  fileId,
}: {
  apiKey: string;
  fileId: string;
}): Promise<void> => {
  await fetch(`${resolveOpenAiApiBase()}/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  }).catch(() => undefined);
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

const associateGeneratedOpenAiImageWithProject = async ({
  generationId,
  mediaFileId,
  modelId,
  projectId,
  providerRequestId,
  requestId,
  userId,
}: {
  generationId: string;
  mediaFileId: string | null;
  modelId: string;
  projectId: string | null;
  providerRequestId: string | null;
  requestId: string;
  userId: string;
}): Promise<void> => {
  await associateGenerationAndMediaWithProjectForUserBestEffort({
    userId,
    projectId,
    generationId,
    mediaFileIds: mediaFileId ? [mediaFileId] : [],
    onError: async ({ projectId: normalizedProjectId, error }) => {
      await writeAppErrorLog({
        source: "telemetry.openai_image.project_association_failed",
        message: "OpenAI image generation project association failed.",
        requestId,
        userId,
        statusCode: 200,
        metadata: {
          generation_id: generationId,
          media_file_id: mediaFileId,
          project_id: normalizedProjectId,
          provider: "openai",
          provider_request_id: providerRequestId,
          model_id: modelId,
          association_error: error instanceof Error ? error.message : String(error),
        },
      }).catch(() => undefined);
    },
  });
};

const logBestEffortProjectionFailure = async ({
  generationId,
  mediaFileId,
  modelId,
  projectId,
  providerRequestId,
  requestId,
  userId,
  error,
}: {
  generationId: string;
  mediaFileId: string | null;
  modelId: string;
  projectId: string | null;
  providerRequestId: string | null;
  requestId: string;
  userId: string;
  error: unknown;
}): Promise<void> => {
  await writeAppErrorLog({
    source: "telemetry.openai_image.projection_write_failed",
    message:
      "OpenAI image generation projection write failed after canonical persistence succeeded.",
    requestId,
    userId,
    statusCode: 200,
    metadata: {
      generation_id: generationId,
      media_file_id: mediaFileId,
      project_id: projectId,
      provider: "openai",
      provider_request_id: providerRequestId,
      model_id: modelId,
      projection_error: toErrorMessage(error, "Unknown error"),
    },
  }).catch(() => undefined);
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
      moderation: OPENAI_GPT_IMAGE_2_DEFAULT_MODERATION,
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
  mask = null,
}: OpenAiEditImageInput): Promise<OpenAiImageGenerationResult> => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const uploadedFileIds: string[] = [];

  try {
    const providerImages: Array<{ image_url: string } | { file_id: string }> = [];
    for (const image of images) {
      const resolved = await buildOpenAiImageEditPayloadRef({
        apiKey,
        image,
      });
      if (resolved.uploadedFileId) {
        uploadedFileIds.push(resolved.uploadedFileId);
      }
      providerImages.push(resolved.payload);
    }
    const resolvedMask = mask
      ? await buildOpenAiImageEditPayloadRef({
          apiKey,
          image: mask,
        })
      : null;
    if (resolvedMask?.uploadedFileId) {
      uploadedFileIds.push(resolvedMask.uploadedFileId);
    }

    const response = await fetch(`${resolveOpenAiApiBase()}/images/edits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_GPT_IMAGE_2_MODEL_ID,
        images: providerImages,
        prompt,
        size,
        quality,
        n: 1,
        output_format: "png",
        moderation: OPENAI_GPT_IMAGE_2_DEFAULT_MODERATION,
        ...(resolvedMask ? { mask: resolvedMask.payload } : {}),
      }),
    });

    return parseOpenAiImageResponse(response);
  } finally {
    await Promise.all(
      uploadedFileIds.map((fileId) =>
        deleteOpenAiUploadedFile({
          apiKey,
          fileId,
        })
      )
    );
  }
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
  beforeVisibleSettlement,
}: PersistGeneratedImageInput): Promise<PersistGeneratedImageResult> => {
  const supabaseAdmin = getSupabaseAdmin();
  const generationId = randomUUID();
  const resolvedRequestId = normalizeOptionalString(requestId) ?? randomUUID();
  const resolvedProviderRequestId = normalizeOptionalString(providerRequestId);
  const resolvedProjectId = normalizeOptionalString(projectId);
  const createdAtIso = new Date().toISOString();
  const displayPrompt = resolveGenerationPromptFromPayload("openai-image", {
    prompt: promptText,
    generation_replay: generationReplay,
  });
  const abandonment = await readGenerationAbandonmentContext({
    userId,
    sourceRef: resolvedRequestId,
    requestId: resolvedRequestId,
  });
  const effectiveHiddenInReferenceGrid = hiddenInReferenceGrid || abandonment.abandoned;
  const mediaAutosavePreference = await readMediaAutosaveEnabledForUser({ userId, supabaseAdmin });
  const mediaAutosaveEnabled = mediaAutosavePreference.enabled;
  const autosavePreferenceLookupMessage =
    resolveMediaAutosavePreferenceLookupUserMessage(mediaAutosavePreference);
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
      autosave_preference_source: mediaAutosavePreference.source,
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
  await beforeVisibleSettlement?.({
    generationId,
    requestId: resolvedRequestId,
    providerRequestId: resolvedProviderRequestId,
    outputRowId: null,
    mediaFileId: null,
  });

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
          autosave_preference_source: mediaAutosavePreference.source,
          autosave_error: autosaveDecisionReason,
        },
      }).catch(() => undefined);
    }
  }
  const outputRowId = outputRows[0]?.id ?? null;
  const saveOutcome = resolveAutosaveSaveOutcome({
    mediaFileId,
    autosaveDecisionReason,
    autosavePreferenceLookupMessage,
  });
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

  try {
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
      displayPrompt,
      modelId,
      previewUrl: signedResult.data.signedUrl,
      previewStoragePath: storagePath,
      fullStoragePath: storagePath,
      saveState: saveOutcome.saveState,
      saveError: saveOutcome.saveError,
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
  } catch (error) {
    await logBestEffortProjectionFailure({
      generationId,
      mediaFileId,
      modelId,
      projectId: resolvedProjectId,
      providerRequestId: resolvedProviderRequestId,
      requestId: resolvedRequestId,
      userId,
      error,
    });
  }

  await associateGeneratedOpenAiImageWithProject({
    generationId,
    mediaFileId,
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
    saveState: saveOutcome.saveState,
    saveError: saveOutcome.saveError,
  };
};
