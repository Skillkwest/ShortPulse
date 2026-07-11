import { randomUUID } from "crypto";
import { canAutoPersistRecoveryMedia } from "../mediaAutosavePolicy";
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { resolveMediaStorageQuotaUserMessage } from "../mediaStorageQuota";
import { readMediaAutosaveEnabledForUser } from "./api/mediaAutosavePreference";
import { resolveMediaAutosavePreferenceLookupUserMessage } from "./api/mediaAutosavePreference";
import { toErrorMessage } from "./api/errorMessage";
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { persistGenerationOutputRecords } from "./api/generationOutputs";
import { upsertGenerationProjection } from "./api/generationProjection";
import { upsertGenerationPublication } from "./api/generationPublications";
import { writeAppErrorLog } from "./api/appErrorLogs";
import {
  GENERATED_AUDIO_REFERENCE_TITLE_VARIANT_COUNT,
  applyAudioReferenceTitleVariant,
} from "./audioTitleGeneration";
import { associateGenerationAndMediaWithProjectForUserBestEffort } from "./projectGenerationAssociationsService";
import {
  signVideoPosterVariant,
  upsertVideoPosterVariantFromBuffer,
  upsertVideoPreviewVariantFromBuffer,
} from "./videoPosterVariant";
import { normalizeGenerationWorkspaceRuntimeKey } from "./api/generationWorkspaceRuntimeKey";
import { DURABLE_MEDIA_CACHE_CONTROL_SECONDS } from "./mediaIngest";
export {
  createElevenLabsClonedVoice,
  createElevenLabsDesignedVoice,
  createRemuxedVoiceChangerVideo,
  deleteElevenLabsVoice,
  designElevenLabsVoice,
  generateElevenLabsMusic,
  generateElevenLabsSoundEffect,
  generateElevenLabsVoiceChanger,
  generateElevenLabsVoiceover,
  listElevenLabsVoices,
  readRemoteSourceBuffer,
} from "./elevenlabsProviderClient";
export type {
  ElevenLabsDesignedVoicePreview,
  ElevenLabsVoice,
  RemuxedVoiceChangerVideoResult,
} from "./elevenlabsProviderClient";

/**
 * ElevenLabs persistence facade for generated audio/video assets.
 * Re-exports provider client calls while owning ShortPulse storage, projection, and publication writes.
 */
const MEDIA_BUCKET = "media_library";
const AUDIO_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "application/octet-stream": "bin",
};
const VIDEO_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};
type ElevenLabsAudioSourceMode = "voiceover" | "voice-changer" | "sound-effects" | "music";
type ElevenLabsVideoSourceMode = "voice-changer";

type PersistGeneratedAudioInput = {
  userId: string;
  promptText: string;
  transcriptText?: string | null;
  provider: "elevenlabs";
  modelId: string;
  providerRequestId?: string | null;
  requestId?: string | null;
  projectId?: string | null;
  workspaceRuntimeKey?: string | null;
  sourceMode: ElevenLabsAudioSourceMode;
  displayTitle?: string | null;
  voiceId?: string | null;
  voiceName?: string | null;
  outputBuffer: Buffer;
  outputContentType: string;
  outputFormat: string;
  workflowReload?: Record<string, unknown>;
  extraMetadata?: Record<string, unknown>;
  beforeVisibleSettlement?: (context: {
    generationId: string;
    requestId: string;
    providerRequestId: string | null;
    outputRowId: string | null;
    mediaFileId: string | null;
    mediaKind: "audio";
    sourceMode: ElevenLabsAudioSourceMode;
  }) => Promise<void>;
};

type PersistGeneratedVideoInput = {
  userId: string;
  promptText: string;
  transcriptText?: string | null;
  provider: "elevenlabs";
  modelId: string;
  providerRequestId?: string | null;
  requestId?: string | null;
  projectId?: string | null;
  workspaceRuntimeKey?: string | null;
  sourceMode: ElevenLabsVideoSourceMode;
  outputBuffer: Buffer;
  outputContentType: "video/mp4" | "video/webm";
  generationReplay?: Record<string, unknown>;
  workflowReload?: Record<string, unknown>;
  extraMetadata?: Record<string, unknown>;
  beforeVisibleSettlement?: (context: {
    generationId: string;
    requestId: string;
    providerRequestId: string | null;
    outputRowId: string | null;
    mediaFileId: string | null;
    mediaKind: "video";
    sourceMode: ElevenLabsVideoSourceMode;
  }) => Promise<void>;
};

export type PersistGeneratedAudioResult = {
  generationId: string;
  mediaFileId: string | null;
  requestId: string;
  storagePath: string;
  signedUrl: string;
  displayTitle: string | null;
  outputRowId: string | null;
  saveState: "saved" | "idle" | "failed" | "blocked_storage";
  saveError: string | null;
};

export type PersistGeneratedVideoResult = PersistGeneratedAudioResult & {
  previewStoragePath: string;
  fullStoragePath: string;
  previewPosterStoragePath: string | null;
  previewPosterUrl: string | null;
};

type AutosaveDecision = "auto_persisted" | "autosave_skipped";

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const hasGeneratedAudioDisplayTitleForUser = async ({
  supabaseAdmin,
  userId,
  title,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  title: string;
}): Promise<boolean> => {
  const [mediaResult, generationResult] = await Promise.all([
    supabaseAdmin
      .from("media_files")
      .select("id")
      .eq("user_id", userId)
      .eq("source", "ai_studio")
      .filter("metadata->>display_title", "eq", title)
      .limit(1),
    supabaseAdmin
      .from("ai_generations")
      .select("id")
      .eq("user_id", userId)
      .eq("mode", "audio")
      .filter("metadata->>display_title", "eq", title)
      .limit(1),
  ]);

  if (mediaResult.error || generationResult.error) return false;
  return Boolean(mediaResult.data?.length || generationResult.data?.length);
};

const resolveUniqueGeneratedAudioDisplayTitle = async ({
  supabaseAdmin,
  userId,
  title,
  generationId,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  title: string | null;
  generationId: string;
}): Promise<string | null> => {
  if (!title) return null;
  if (!(await hasGeneratedAudioDisplayTitleForUser({ supabaseAdmin, userId, title }))) {
    return title;
  }

  for (
    let variantOffset = 1;
    variantOffset <= GENERATED_AUDIO_REFERENCE_TITLE_VARIANT_COUNT;
    variantOffset += 1
  ) {
    const candidate = applyAudioReferenceTitleVariant({
      baseTitle: title,
      uniqueSeed: generationId,
      variantOffset,
    });
    if (
      !(await hasGeneratedAudioDisplayTitleForUser({ supabaseAdmin, userId, title: candidate }))
    ) {
      return candidate;
    }
  }

  return applyAudioReferenceTitleVariant({ baseTitle: title, uniqueSeed: generationId });
};

const buildGeneratedAudioDisplayTitleMetadata = (
  sourceMode: ElevenLabsAudioSourceMode,
  displayTitle: string | null
): Record<string, string> => {
  if (!displayTitle) return {};
  switch (sourceMode) {
    case "music":
      return { song_title: displayTitle };
    case "sound-effects":
      return { sound_effect_title: displayTitle };
    case "voiceover":
      return { voiceover_title: displayTitle };
    case "voice-changer":
      return { voice_changer_title: displayTitle };
  }
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

const associateGeneratedElevenLabsAssetWithProject = async ({
  generationId,
  mediaFileId,
  mediaKind,
  modelId,
  projectId,
  providerRequestId,
  requestId,
  sourceMode,
  userId,
}: {
  generationId: string;
  mediaFileId: string | null;
  mediaKind: "audio" | "video";
  modelId: string;
  projectId: string | null;
  providerRequestId: string | null;
  requestId: string;
  sourceMode: string;
  userId: string;
}): Promise<void> => {
  await associateGenerationAndMediaWithProjectForUserBestEffort({
    userId,
    projectId,
    generationId,
    mediaFileIds: mediaFileId ? [mediaFileId] : [],
    onError: async ({ projectId: normalizedProjectId, error }) => {
      await writeAppErrorLog({
        source: "telemetry.elevenlabs.project_association_failed",
        message: "ElevenLabs generation project association failed.",
        requestId,
        userId,
        statusCode: 200,
        metadata: {
          generation_id: generationId,
          media_file_id: mediaFileId,
          project_id: normalizedProjectId,
          provider: "elevenlabs",
          provider_request_id: providerRequestId,
          model_id: modelId,
          media_kind: mediaKind,
          source_mode: sourceMode,
          association_error: error instanceof Error ? error.message : String(error),
        },
      }).catch(() => undefined);
    },
  });
};

const logBestEffortProjectionFailure = async ({
  generationId,
  mediaFileId,
  mediaKind,
  modelId,
  projectId,
  providerRequestId,
  requestId,
  sourceMode,
  userId,
  error,
}: {
  generationId: string;
  mediaFileId: string | null;
  mediaKind: "audio" | "video";
  modelId: string;
  projectId: string | null;
  providerRequestId: string | null;
  requestId: string;
  sourceMode: string;
  userId: string;
  error: unknown;
}): Promise<void> => {
  await writeAppErrorLog({
    source: "telemetry.elevenlabs.projection_write_failed",
    message: "ElevenLabs generation projection write failed after canonical persistence succeeded.",
    requestId,
    userId,
    statusCode: 200,
    metadata: {
      generation_id: generationId,
      media_file_id: mediaFileId,
      project_id: projectId,
      provider: "elevenlabs",
      provider_request_id: providerRequestId,
      model_id: modelId,
      media_kind: mediaKind,
      source_mode: sourceMode,
      projection_error: toErrorMessage(error, "Unknown error"),
    },
  }).catch(() => undefined);
};

const sanitizeStem = (value: string): string => {
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, 72);
  const sanitized = normalized.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "");
  return sanitized || "audio";
};

const resolveFileExtension = (contentType: string, outputFormat: string): string => {
  const normalizedContentType = contentType.trim().toLowerCase();
  if (AUDIO_EXTENSION_BY_CONTENT_TYPE[normalizedContentType]) {
    return AUDIO_EXTENSION_BY_CONTENT_TYPE[normalizedContentType];
  }
  const formatPrefix = outputFormat.split("_")[0]?.trim().toLowerCase() ?? "";
  return formatPrefix || "bin";
};

const resolveVideoFileExtension = (contentType: string): string => {
  const normalizedContentType = contentType.trim().toLowerCase();
  return VIDEO_EXTENSION_BY_CONTENT_TYPE[normalizedContentType] ?? "mp4";
};

export const persistGeneratedAudioAsset = async ({
  userId,
  promptText,
  transcriptText = null,
  provider,
  modelId,
  providerRequestId = null,
  requestId = null,
  projectId = null,
  workspaceRuntimeKey = null,
  sourceMode,
  displayTitle = null,
  voiceId = null,
  voiceName = null,
  outputBuffer,
  outputContentType,
  outputFormat,
  workflowReload = {},
  extraMetadata = {},
  beforeVisibleSettlement,
}: PersistGeneratedAudioInput): Promise<PersistGeneratedAudioResult> => {
  const supabaseAdmin = getSupabaseAdmin();
  const generationId = randomUUID();
  const resolvedRequestId = normalizeOptionalString(requestId) ?? randomUUID();
  const resolvedProviderRequestId = normalizeOptionalString(providerRequestId);
  const resolvedProjectId = normalizeOptionalString(projectId);
  const resolvedWorkspaceRuntimeKey = resolvedProjectId
    ? null
    : normalizeGenerationWorkspaceRuntimeKey(workspaceRuntimeKey);
  const createdAtIso = new Date().toISOString();
  const normalizedTranscriptText = normalizeOptionalString(transcriptText);
  const normalizedDisplayTitle = await resolveUniqueGeneratedAudioDisplayTitle({
    supabaseAdmin,
    userId,
    title: normalizeOptionalString(displayTitle),
    generationId,
  });
  const displayTitleMetadata = buildGeneratedAudioDisplayTitleMetadata(
    sourceMode,
    normalizedDisplayTitle
  );
  const mediaAutosavePreference = await readMediaAutosaveEnabledForUser({
    supabaseAdmin,
    userId,
  });
  const mediaAutosaveEnabled = mediaAutosavePreference.enabled;
  const autosavePreferenceLookupMessage =
    resolveMediaAutosavePreferenceLookupUserMessage(mediaAutosavePreference);
  const autosavePolicyDecision = canAutoPersistRecoveryMedia({
    intent: "auto",
    mediaAutosaveEnabled,
  });
  const extension = resolveFileExtension(outputContentType, outputFormat);
  const filename = `${sanitizeStem(normalizedDisplayTitle ?? promptText)}.${extension}`;
  const storagePath = assertUserScopedMediaStoragePath({
    userId,
    path: `${userId}/generations/audio/${generationId}/${filename}`,
    label: "Generated audio storage path",
  });

  const uploadResult = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, outputBuffer, {
      contentType: outputContentType,
      upsert: false,
      cacheControl: DURABLE_MEDIA_CACHE_CONTROL_SECONDS,
    });
  if (uploadResult.error) {
    throw new Error(uploadResult.error.message || "Unable to persist generated audio.");
  }

  const signedResult = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (signedResult.error || !signedResult.data?.signedUrl) {
    throw new Error(signedResult.error?.message || "Unable to sign generated audio.");
  }

  const generationMetadata = {
    provider_request_id: resolvedProviderRequestId,
    source_mode: sourceMode,
    display_title: normalizedDisplayTitle,
    voice_id: voiceId,
    voice_name: voiceName,
    transcript_text: normalizedTranscriptText,
    autosave_enabled: mediaAutosaveEnabled,
    autosave_preference_source: mediaAutosavePreference.source,
    autosave_decision: autosavePolicyDecision.allowed ? "autosave_requested" : "autosave_skipped",
    autosave_decision_reason: autosavePolicyDecision.reason,
    output_format: outputFormat,
    mime_type: outputContentType,
    project_id: resolvedProjectId,
    workspace_runtime_key: resolvedWorkspaceRuntimeKey,
    ...extraMetadata,
    ...displayTitleMetadata,
    ...(Object.keys(workflowReload).length > 0 ? { workflow_reload: workflowReload } : {}),
  };

  const generationInsert = await supabaseAdmin
    .from("ai_generations")
    .insert({
      id: generationId,
      user_id: userId,
      mode: "audio",
      provider,
      model_id: modelId,
      prompt_text: promptText,
      request_id: resolvedRequestId,
      status: "running",
      metadata: generationMetadata,
    })
    .select("id")
    .single();
  if (generationInsert.error) {
    throw new Error(generationInsert.error.message || "Unable to record audio generation.");
  }

  let mediaFileId: string | null = null;
  let autosaveDecision: AutosaveDecision = autosavePolicyDecision.allowed
    ? "auto_persisted"
    : "autosave_skipped";
  let autosaveDecisionReason: string = autosavePolicyDecision.reason;

  let outputRows = await persistGenerationOutputRecords({
    generationId,
    providerRequestId: resolvedProviderRequestId,
    userId,
    resultUrls: [signedResult.data.signedUrl],
    mediaFileIds: [],
    metadata: {
      media_kind: "audio",
      display_title: normalizedDisplayTitle,
      provider_request_id: resolvedProviderRequestId,
      autosave_enabled: mediaAutosaveEnabled,
      autosave_preference_source: mediaAutosavePreference.source,
      autosave_decision: autosavePolicyDecision.allowed
        ? "provider_urls_persisted"
        : "autosave_skipped",
      autosave_decision_reason: autosavePolicyDecision.allowed
        ? "canonical_outputs_before_media_autosave"
        : autosavePolicyDecision.reason,
      project_id: resolvedProjectId,
      ...extraMetadata,
      ...displayTitleMetadata,
      ...(Object.keys(workflowReload).length > 0 ? { workflow_reload: workflowReload } : {}),
    },
    supabaseAdmin,
  });

  if (autosavePolicyDecision.allowed) {
    try {
      const mediaInsert = await supabaseAdmin
        .from("media_files")
        .insert({
          filename,
          storage_path: storagePath,
          file_type: "audio",
          file_size: outputBuffer.length,
          source: "ai_studio",
          source_ref: generationId,
          metadata: {
            provider,
            model_id: modelId,
            provider_request_id: resolvedProviderRequestId,
            source_mode: sourceMode,
            display_title: normalizedDisplayTitle,
            mime_type: outputContentType,
            output_format: outputFormat,
            voice_id: voiceId,
            voice_name: voiceName,
            transcript_text: normalizedTranscriptText,
            autosave_enabled: mediaAutosaveEnabled,
            autosave_preference_source: mediaAutosavePreference.source,
            autosave_decision: "auto_persisted",
            autosave_decision_reason: autosavePolicyDecision.reason,
            project_id: resolvedProjectId,
            ...extraMetadata,
            ...displayTitleMetadata,
            ...(Object.keys(workflowReload).length > 0 ? { workflow_reload: workflowReload } : {}),
          },
          user_id: userId,
        })
        .select("id")
        .single();
      if (mediaInsert.error || !mediaInsert.data?.id) {
        throw new Error(mediaInsert.error?.message || "Unable to record generated audio media.");
      }
      mediaFileId = mediaInsert.data.id as string;
      outputRows = await persistGenerationOutputRecords({
        generationId,
        providerRequestId: resolvedProviderRequestId,
        userId,
        resultUrls: [signedResult.data.signedUrl],
        mediaFileIds: [mediaFileId],
        metadata: {
          media_kind: "audio",
          display_title: normalizedDisplayTitle,
          provider_request_id: resolvedProviderRequestId,
          autosave_enabled: mediaAutosaveEnabled,
          autosave_preference_source: mediaAutosavePreference.source,
          autosave_decision: "auto_persisted",
          autosave_decision_reason: autosavePolicyDecision.reason,
          project_id: resolvedProjectId,
          ...extraMetadata,
          ...displayTitleMetadata,
          ...(Object.keys(workflowReload).length > 0 ? { workflow_reload: workflowReload } : {}),
        },
        supabaseAdmin,
      });
    } catch (error) {
      autosaveDecision = "autosave_skipped";
      autosaveDecisionReason = error instanceof Error ? error.message : "media_autosave_failed";
      await writeAppErrorLog({
        source: "telemetry.elevenlabs.media_autosave_failed",
        message: "ElevenLabs audio generation kept result URL after media autosave failed.",
        requestId: resolvedRequestId,
        userId,
        statusCode: 200,
        metadata: {
          generation_id: generationId,
          provider,
          provider_request_id: resolvedProviderRequestId,
          model_id: modelId,
          media_kind: "audio",
          source_mode: sourceMode,
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
  try {
    await beforeVisibleSettlement?.({
      generationId,
      requestId: resolvedRequestId,
      providerRequestId: resolvedProviderRequestId,
      outputRowId,
      mediaFileId,
      mediaKind: "audio",
      sourceMode,
    });
  } catch (error) {
    const settlementError = toErrorMessage(error, "billing_settlement_failed");
    const failureUpdate = await supabaseAdmin
      .from("ai_generations")
      .update({
        status: "fail",
        completed_at: new Date().toISOString(),
        failure_reason_code: "billing_settlement_failed",
        error_message: settlementError,
        metadata: {
          ...publicationMetadata,
          direct_provider_settlement_failed: true,
          settlement_error: settlementError,
        },
      })
      .eq("id", generationId)
      .eq("user_id", userId);
    if (failureUpdate.error) {
      await writeAppErrorLog({
        source: "telemetry.elevenlabs_audio.settlement_failure_lifecycle_update_failed",
        message:
          "ElevenLabs audio generation settlement failed before visibility, and failure lifecycle update failed.",
        requestId: resolvedRequestId,
        userId,
        statusCode: 500,
        metadata: {
          generation_id: generationId,
          provider_request_id: resolvedProviderRequestId,
          settlement_error: settlementError,
          lifecycle_update_error: failureUpdate.error.message,
        },
      }).catch(() => undefined);
    }
    throw error;
  }

  const successUpdate = await supabaseAdmin
    .from("ai_generations")
    .update({
      status: "success",
      completed_at: createdAtIso,
      failure_reason_code: null,
      error_message: null,
      metadata: publicationMetadata,
    })
    .eq("id", generationId)
    .eq("user_id", userId);
  if (successUpdate.error) {
    throw new Error(successUpdate.error.message || "Unable to finalize audio generation.");
  }

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
      metadata: { ...publicationMetadata, media_kind: "audio" },
    });
  }

  try {
    await upsertGenerationProjection({
      generationId,
      userId,
      projectId: resolvedProjectId,
      workspaceRuntimeKey: resolvedWorkspaceRuntimeKey,
      sourceRef: resolvedRequestId,
      requestId: resolvedRequestId,
      provider,
      providerRequestId: resolvedProviderRequestId,
      status: "success",
      taskState: "success",
      displayPrompt: promptText,
      displayTitle: normalizedDisplayTitle,
      transcriptText: normalizedTranscriptText,
      modelId,
      previewUrl: signedResult.data.signedUrl,
      previewStoragePath: storagePath,
      fullStoragePath: storagePath,
      saveState: saveOutcome.saveState,
      saveError: saveOutcome.saveError,
      hiddenInReferenceGrid: false,
      referenceGridVisible: true,
      publicationState: "published",
      resultUrls: [signedResult.data.signedUrl],
      savedMediaIds: mediaFileId ? [mediaFileId] : [],
      workflowReload,
      startedAt: createdAtIso,
      completedAt: createdAtIso,
    });
  } catch (error) {
    await logBestEffortProjectionFailure({
      generationId,
      mediaFileId,
      mediaKind: "audio",
      modelId,
      projectId: resolvedProjectId,
      providerRequestId: resolvedProviderRequestId,
      requestId: resolvedRequestId,
      sourceMode,
      userId,
      error,
    });
  }

  await associateGeneratedElevenLabsAssetWithProject({
    generationId,
    mediaFileId,
    mediaKind: "audio",
    modelId,
    projectId: resolvedProjectId,
    providerRequestId: resolvedProviderRequestId,
    requestId: resolvedRequestId,
    sourceMode,
    userId,
  });

  return {
    generationId,
    mediaFileId,
    requestId: resolvedRequestId,
    storagePath,
    signedUrl: signedResult.data.signedUrl,
    displayTitle: normalizedDisplayTitle,
    outputRowId,
    saveState: saveOutcome.saveState,
    saveError: saveOutcome.saveError,
  };
};

export const persistGeneratedVideoAsset = async ({
  userId,
  promptText,
  transcriptText = null,
  provider,
  modelId,
  providerRequestId = null,
  requestId = null,
  projectId = null,
  workspaceRuntimeKey = null,
  sourceMode,
  outputBuffer,
  outputContentType,
  generationReplay = {},
  workflowReload = {},
  extraMetadata = {},
  beforeVisibleSettlement,
}: PersistGeneratedVideoInput): Promise<PersistGeneratedVideoResult> => {
  const supabaseAdmin = getSupabaseAdmin();
  const generationId = randomUUID();
  const resolvedRequestId = normalizeOptionalString(requestId) ?? randomUUID();
  const resolvedProviderRequestId = normalizeOptionalString(providerRequestId);
  const resolvedProjectId = normalizeOptionalString(projectId);
  const resolvedWorkspaceRuntimeKey = resolvedProjectId
    ? null
    : normalizeGenerationWorkspaceRuntimeKey(workspaceRuntimeKey);
  const createdAtIso = new Date().toISOString();
  const normalizedTranscriptText = normalizeOptionalString(transcriptText);
  const mediaAutosavePreference = await readMediaAutosaveEnabledForUser({
    supabaseAdmin,
    userId,
  });
  const mediaAutosaveEnabled = mediaAutosavePreference.enabled;
  const autosavePreferenceLookupMessage =
    resolveMediaAutosavePreferenceLookupUserMessage(mediaAutosavePreference);
  const autosavePolicyDecision = canAutoPersistRecoveryMedia({
    intent: "auto",
    mediaAutosaveEnabled,
  });
  const extension = resolveVideoFileExtension(outputContentType);
  const filename = `${sanitizeStem(promptText)}.${extension}`;
  const storagePath = assertUserScopedMediaStoragePath({
    userId,
    path: `${userId}/generations/video/${generationId}/${filename}`,
    label: "Generated video storage path",
  });

  const uploadResult = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, outputBuffer, {
      contentType: outputContentType,
      upsert: false,
      cacheControl: DURABLE_MEDIA_CACHE_CONTROL_SECONDS,
    });
  if (uploadResult.error) {
    throw new Error(uploadResult.error.message || "Unable to persist generated video.");
  }

  const signedResult = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (signedResult.error || !signedResult.data?.signedUrl) {
    throw new Error(signedResult.error?.message || "Unable to sign generated video.");
  }

  const generationMetadata = {
    provider_request_id: resolvedProviderRequestId,
    source_mode: sourceMode,
    transcript_text: normalizedTranscriptText,
    autosave_enabled: mediaAutosaveEnabled,
    autosave_preference_source: mediaAutosavePreference.source,
    autosave_decision: autosavePolicyDecision.allowed ? "autosave_requested" : "autosave_skipped",
    autosave_decision_reason: autosavePolicyDecision.reason,
    mime_type: outputContentType,
    project_id: resolvedProjectId,
    workspace_runtime_key: resolvedWorkspaceRuntimeKey,
    ...extraMetadata,
    ...(Object.keys(generationReplay).length > 0 ? { generation_replay: generationReplay } : {}),
    ...(Object.keys(workflowReload).length > 0 ? { workflow_reload: workflowReload } : {}),
  };

  const generationInsert = await supabaseAdmin
    .from("ai_generations")
    .insert({
      id: generationId,
      user_id: userId,
      mode: "video",
      provider,
      model_id: modelId,
      prompt_text: promptText,
      request_id: resolvedRequestId,
      status: "running",
      metadata: generationMetadata,
    })
    .select("id")
    .single();
  if (generationInsert.error) {
    await supabaseAdmin.storage
      .from(MEDIA_BUCKET)
      .remove([storagePath])
      .catch(() => undefined);
    throw new Error(generationInsert.error.message || "Unable to record video generation.");
  }

  let mediaFileId: string | null = null;
  let autosaveDecision: AutosaveDecision = autosavePolicyDecision.allowed
    ? "auto_persisted"
    : "autosave_skipped";
  let autosaveDecisionReason: string = autosavePolicyDecision.reason;
  let previewStoragePath: string = storagePath;
  let previewPosterStoragePath: string | null = null;
  let previewPosterUrl: string | null = null;

  let outputRows = await persistGenerationOutputRecords({
    generationId,
    providerRequestId: resolvedProviderRequestId,
    userId,
    resultUrls: [signedResult.data.signedUrl],
    mediaFileIds: [],
    metadata: {
      media_kind: "video",
      provider_request_id: resolvedProviderRequestId,
      autosave_enabled: mediaAutosaveEnabled,
      autosave_preference_source: mediaAutosavePreference.source,
      autosave_decision: autosavePolicyDecision.allowed
        ? "provider_urls_persisted"
        : "autosave_skipped",
      autosave_decision_reason: autosavePolicyDecision.allowed
        ? "canonical_outputs_before_media_autosave"
        : autosavePolicyDecision.reason,
      project_id: resolvedProjectId,
      ...extraMetadata,
      ...(Object.keys(workflowReload).length > 0 ? { workflow_reload: workflowReload } : {}),
    },
    supabaseAdmin,
  });

  if (autosavePolicyDecision.allowed) {
    try {
      const mediaInsert = await supabaseAdmin
        .from("media_files")
        .insert({
          filename,
          storage_path: storagePath,
          file_type: "video",
          file_size: outputBuffer.length,
          source: "ai_studio",
          source_ref: generationId,
          metadata: {
            provider,
            model_id: modelId,
            provider_request_id: resolvedProviderRequestId,
            source_mode: sourceMode,
            mime_type: outputContentType,
            transcript_text: normalizedTranscriptText,
            autosave_enabled: mediaAutosaveEnabled,
            autosave_preference_source: mediaAutosavePreference.source,
            autosave_decision: "auto_persisted",
            autosave_decision_reason: autosavePolicyDecision.reason,
            project_id: resolvedProjectId,
            ...extraMetadata,
            ...(Object.keys(workflowReload).length > 0 ? { workflow_reload: workflowReload } : {}),
          },
          user_id: userId,
        })
        .select("id")
        .single();
      if (mediaInsert.error || !mediaInsert.data?.id) {
        throw new Error(mediaInsert.error?.message || "Unable to record generated video media.");
      }
      mediaFileId = mediaInsert.data.id as string;
      previewStoragePath =
        (await upsertVideoPreviewVariantFromBuffer({
          supabaseAdmin,
          userId,
          mediaFileId,
          videoBuffer: outputBuffer,
          videoMimeType: outputContentType,
          filename,
          metadata: {
            generated_by: "elevenlabs_video_persistence",
            generation_id: generationId,
            source_mode: sourceMode,
            provider_request_id: resolvedProviderRequestId,
          },
        }).catch(() => null)) ?? storagePath;
      previewPosterStoragePath = await upsertVideoPosterVariantFromBuffer({
        supabaseAdmin,
        userId,
        mediaFileId,
        videoBuffer: outputBuffer,
        videoMimeType: outputContentType,
        filename,
        metadata: {
          generated_by: "elevenlabs_video_persistence",
          generation_id: generationId,
          source_mode: sourceMode,
          provider_request_id: resolvedProviderRequestId,
        },
      }).catch(() => null);
      previewPosterUrl = await signVideoPosterVariant({
        supabaseAdmin,
        storagePath: previewPosterStoragePath,
      });
      outputRows = await persistGenerationOutputRecords({
        generationId,
        providerRequestId: resolvedProviderRequestId,
        userId,
        resultUrls: [signedResult.data.signedUrl],
        mediaFileIds: [mediaFileId],
        metadata: {
          media_kind: "video",
          provider_request_id: resolvedProviderRequestId,
          autosave_enabled: mediaAutosaveEnabled,
          autosave_preference_source: mediaAutosavePreference.source,
          autosave_decision: "auto_persisted",
          autosave_decision_reason: autosavePolicyDecision.reason,
          project_id: resolvedProjectId,
          ...extraMetadata,
          ...(Object.keys(workflowReload).length > 0 ? { workflow_reload: workflowReload } : {}),
        },
        supabaseAdmin,
      });
    } catch (error) {
      autosaveDecision = "autosave_skipped";
      autosaveDecisionReason = error instanceof Error ? error.message : "media_autosave_failed";
      await writeAppErrorLog({
        source: "telemetry.elevenlabs.media_autosave_failed",
        message: "ElevenLabs video generation kept result URL after media autosave failed.",
        requestId: resolvedRequestId,
        userId,
        statusCode: 200,
        metadata: {
          generation_id: generationId,
          provider,
          provider_request_id: resolvedProviderRequestId,
          model_id: modelId,
          media_kind: "video",
          source_mode: sourceMode,
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
  try {
    await beforeVisibleSettlement?.({
      generationId,
      requestId: resolvedRequestId,
      providerRequestId: resolvedProviderRequestId,
      outputRowId,
      mediaFileId,
      mediaKind: "video",
      sourceMode,
    });
  } catch (error) {
    const settlementError = toErrorMessage(error, "billing_settlement_failed");
    const failureUpdate = await supabaseAdmin
      .from("ai_generations")
      .update({
        status: "fail",
        completed_at: new Date().toISOString(),
        failure_reason_code: "billing_settlement_failed",
        error_message: settlementError,
        metadata: {
          ...publicationMetadata,
          direct_provider_settlement_failed: true,
          settlement_error: settlementError,
        },
      })
      .eq("id", generationId)
      .eq("user_id", userId);
    if (failureUpdate.error) {
      await writeAppErrorLog({
        source: "telemetry.elevenlabs_video.settlement_failure_lifecycle_update_failed",
        message:
          "ElevenLabs video generation settlement failed before visibility, and failure lifecycle update failed.",
        requestId: resolvedRequestId,
        userId,
        statusCode: 500,
        metadata: {
          generation_id: generationId,
          provider_request_id: resolvedProviderRequestId,
          settlement_error: settlementError,
          lifecycle_update_error: failureUpdate.error.message,
        },
      }).catch(() => undefined);
    }
    throw error;
  }

  const successUpdate = await supabaseAdmin
    .from("ai_generations")
    .update({
      status: "success",
      completed_at: createdAtIso,
      failure_reason_code: null,
      error_message: null,
      metadata: publicationMetadata,
    })
    .eq("id", generationId)
    .eq("user_id", userId);
  if (successUpdate.error) {
    throw new Error(successUpdate.error.message || "Unable to finalize video generation.");
  }

  if (outputRowId) {
    await upsertGenerationPublication({
      generationId,
      generationOutputId: outputRowId,
      userId,
      publicationState: "published",
      ownedMediaFileId: mediaFileId,
      previewUrl: signedResult.data.signedUrl,
      fullUrl: signedResult.data.signedUrl,
      previewStoragePath,
      fullStoragePath: storagePath,
      publishedAt: createdAtIso,
      metadata: { ...publicationMetadata, media_kind: "video" },
    });
  }

  try {
    await upsertGenerationProjection({
      generationId,
      userId,
      projectId: resolvedProjectId,
      workspaceRuntimeKey: resolvedWorkspaceRuntimeKey,
      sourceRef: resolvedRequestId,
      requestId: resolvedRequestId,
      provider,
      providerRequestId: resolvedProviderRequestId,
      status: "success",
      taskState: "success",
      displayPrompt: promptText,
      transcriptText: normalizedTranscriptText,
      modelId,
      previewUrl: signedResult.data.signedUrl,
      previewStoragePath,
      fullStoragePath: storagePath,
      saveState: saveOutcome.saveState,
      saveError: saveOutcome.saveError,
      hiddenInReferenceGrid: false,
      referenceGridVisible: true,
      publicationState: "published",
      resultUrls: [signedResult.data.signedUrl],
      savedMediaIds: mediaFileId ? [mediaFileId] : [],
      generationReplay,
      workflowReload,
      startedAt: createdAtIso,
      completedAt: createdAtIso,
    });
  } catch (error) {
    await logBestEffortProjectionFailure({
      generationId,
      mediaFileId,
      mediaKind: "video",
      modelId,
      projectId: resolvedProjectId,
      providerRequestId: resolvedProviderRequestId,
      requestId: resolvedRequestId,
      sourceMode,
      userId,
      error,
    });
  }

  await associateGeneratedElevenLabsAssetWithProject({
    generationId,
    mediaFileId,
    mediaKind: "video",
    modelId,
    projectId: resolvedProjectId,
    providerRequestId: resolvedProviderRequestId,
    requestId: resolvedRequestId,
    sourceMode,
    userId,
  });

  return {
    generationId,
    mediaFileId,
    requestId: resolvedRequestId,
    storagePath,
    signedUrl: signedResult.data.signedUrl,
    displayTitle: null,
    previewStoragePath,
    fullStoragePath: storagePath,
    previewPosterStoragePath,
    previewPosterUrl,
    outputRowId,
    saveState: saveOutcome.saveState,
    saveError: saveOutcome.saveError,
  };
};
