/**
 * Canonical Voice Changer remux service.
 * Owns video/audio assembly, deterministic persistence identity, and recoverable metadata updates.
 */
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { upsertGenerationProjection } from "./api/generationProjection";
import { readPersistedGenerationOutputs } from "./api/generationOutputs";
import { reconcileOwnedGenerationOutputSlot } from "./api/generationOutputConvergence";
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import {
  createRemuxedVoiceChangerVideo,
  persistGeneratedVideoAsset,
  type PersistGeneratedVideoResult,
  type RemuxedVoiceChangerVideoResult,
} from "./elevenlabs";

export type VoiceChangerRemuxStage = "assembly" | "persistence";

export type VoiceChangerRemuxExecutionResult = {
  remuxedVideo: RemuxedVoiceChangerVideoResult;
  persistedVideo: PersistGeneratedVideoResult;
};

export type VoiceChangerRemuxFailure = Error & {
  stage: VoiceChangerRemuxStage;
  code: "VOICE_CHANGER_REMUX_ASSEMBLY_FAILED" | "VOICE_CHANGER_REMUX_PERSISTENCE_FAILED";
};

export const buildVoiceChangerRemuxRequestId = (audioGenerationId: string): string =>
  `voice-changer-remux:${audioGenerationId}`;

const normalizeOptionalString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export type PublishedVoiceChangerGeneration = {
  generationId: string;
  modelId: string | null;
  promptText: string | null;
  transcriptText: string | null;
  mimeType: string | null;
  previewStoragePath: string;
  fullStoragePath: string;
  mediaFileId: string | null;
  signedUrl: string;
  saveState: string | null;
  saveError: string | null;
};

export const VOICE_CHANGER_REMUX_STALE_GENERATION_MS = 10 * 60 * 1000;

export type ExistingVoiceChangerRemuxResolution =
  | { state: "none" }
  | { state: "published"; generation: PublishedVoiceChangerGeneration }
  | { state: "in_progress"; generationId: string }
  | { state: "stale_unpublished"; generationId: string }
  | { state: "reclaimed"; generationId: string };

/**
 * Rebuilds the disposable generation projection from the canonical generation,
 * output, and publication records, then returns a freshly signed delivery URL.
 */
export const readAndRepairPublishedVoiceChangerGeneration = async ({
  userId,
  generationId,
  remuxRecovery,
  allowRepair = true,
}: {
  userId: string;
  generationId: string;
  remuxRecovery?: Record<string, unknown> | null;
  allowRepair?: boolean;
}): Promise<PublishedVoiceChangerGeneration | null> => {
  const admin = getSupabaseAdmin();
  const generationResult = await admin
    .from("ai_generations")
    .select("id, provider, model_id, prompt_text, request_id, status, completed_at, metadata")
    .eq("id", generationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (generationResult.error) throw new Error(generationResult.error.message);
  if (!generationResult.data) return null;
  const generationMetadata = asObject(generationResult.data.metadata);

  const readPublication = () =>
    admin
      .from("generation_publications")
      .select(
        "owned_media_file_id, preview_storage_path, full_storage_path, publication_state, metadata"
      )
      .eq("generation_id", generationId)
      .eq("user_id", userId)
      .eq("publication_state", "published")
      .maybeSingle();
  let publicationResult = await readPublication();
  if (publicationResult.error) throw new Error(publicationResult.error.message);

  if (!publicationResult.data && allowRepair) {
    const outputRows = await readPersistedGenerationOutputs({
      generationId,
      userId,
      supabaseAdmin: admin,
    });
    const ownedOutput = outputRows.find((row) => row.id && row.mediaFileId);
    if (ownedOutput?.id && ownedOutput.mediaFileId) {
      await reconcileOwnedGenerationOutputSlot({
        generationId,
        userId,
        outputIndex: ownedOutput.outputIndex,
        mediaFileId: ownedOutput.mediaFileId,
        resultUrl: ownedOutput.resultUrl,
        providerRequestId: normalizeOptionalString(generationResult.data.request_id),
        metadata: generationMetadata,
        supabaseAdmin: admin,
      });
      publicationResult = await readPublication();
      if (publicationResult.error) throw new Error(publicationResult.error.message);
    }
  }

  const publishedFullStoragePath = normalizeOptionalString(
    publicationResult.data?.full_storage_path
  );
  if (!publicationResult.data || !publishedFullStoragePath) return null;
  const fullStoragePath = assertUserScopedMediaStoragePath({
    path: publishedFullStoragePath,
    userId,
    label: "Published Voice Changer full storage path",
  });
  const publishedPreviewStoragePath =
    normalizeOptionalString(publicationResult.data.preview_storage_path) ?? fullStoragePath;
  const previewStoragePath = assertUserScopedMediaStoragePath({
    path: publishedPreviewStoragePath,
    userId,
    label: "Published Voice Changer preview storage path",
  });
  const signed = await admin.storage.from("media_library").createSignedUrl(fullStoragePath, 3600);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(signed.error?.message ?? "Unable to sign published Voice Changer media.");
  }

  const publicationMetadata = asObject(publicationResult.data.metadata);
  const mediaFileId = normalizeOptionalString(publicationResult.data.owned_media_file_id);
  const savedMediaIds = mediaFileId ? [mediaFileId] : [];
  const saveState = mediaFileId
    ? "saved"
    : publicationMetadata.autosave_enabled === false
      ? "idle"
      : "failed";
  const saveError =
    saveState === "failed"
      ? normalizeOptionalString(publicationMetadata.autosave_decision_reason)
      : null;
  const workflowReload = asObject(generationMetadata.workflow_reload);
  const generationReplay = asObject(generationMetadata.generation_replay);

  if (allowRepair && generationResult.data.status === "running") {
    const promoted = await admin
      .from("ai_generations")
      .update({
        status: "success",
        completed_at:
          normalizeOptionalString(generationResult.data.completed_at) ?? new Date().toISOString(),
        failure_reason_code: null,
        error_message: null,
      })
      .eq("id", generationId)
      .eq("user_id", userId)
      .eq("status", "running");
    if (promoted.error) throw new Error(promoted.error.message);
  }

  if (allowRepair) {
    await upsertGenerationProjection({
      supabaseAdmin: admin,
      generationId,
      userId,
      projectId: normalizeOptionalString(generationMetadata.project_id),
      workspaceRuntimeKey: normalizeOptionalString(generationMetadata.workspace_runtime_key),
      sourceRef: normalizeOptionalString(generationResult.data.request_id),
      requestId: normalizeOptionalString(generationResult.data.request_id),
      provider: normalizeOptionalString(generationResult.data.provider),
      providerRequestId: normalizeOptionalString(generationMetadata.provider_request_id),
      status: "success",
      taskState: "success",
      displayPrompt: normalizeOptionalString(generationResult.data.prompt_text),
      displayTitle: normalizeOptionalString(generationMetadata.display_title),
      transcriptText: normalizeOptionalString(generationMetadata.transcript_text),
      modelId: normalizeOptionalString(generationResult.data.model_id),
      previewUrl: signed.data.signedUrl,
      previewStoragePath,
      fullStoragePath,
      saveState,
      saveError,
      hiddenInReferenceGrid: false,
      referenceGridVisible: true,
      publicationState: "published",
      resultUrls: [signed.data.signedUrl],
      savedMediaIds,
      generationReplay,
      workflowReload,
      remuxRecovery,
      completedAt: normalizeOptionalString(generationResult.data.completed_at),
    });
  }

  return {
    generationId,
    modelId: normalizeOptionalString(generationResult.data.model_id),
    promptText: normalizeOptionalString(generationResult.data.prompt_text),
    transcriptText: normalizeOptionalString(generationMetadata.transcript_text),
    mimeType: normalizeOptionalString(generationMetadata.mime_type),
    previewStoragePath,
    fullStoragePath,
    mediaFileId,
    signedUrl: signed.data.signedUrl,
    saveState,
    saveError,
  };
};

/**
 * Resolves the deterministic remux request slot. Published work wins; fresh unpublished work is
 * left alone; only stale/terminal rows with no publication or owned media are reclaimed.
 */
export const resolveExistingVoiceChangerRemuxGeneration = async ({
  userId,
  remuxRequestId,
  nowMs = Date.now(),
  allowMutations = true,
}: {
  userId: string;
  remuxRequestId: string;
  nowMs?: number;
  allowMutations?: boolean;
}): Promise<ExistingVoiceChangerRemuxResolution> => {
  const admin = getSupabaseAdmin();
  const existing = await admin
    .from("ai_generations")
    .select("id, status, created_at")
    .eq("user_id", userId)
    .eq("request_id", remuxRequestId)
    .eq("mode", "video")
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  const generationId = normalizeOptionalString(existing.data?.id);
  if (!generationId) return { state: "none" };

  const published = await readAndRepairPublishedVoiceChangerGeneration({
    userId,
    generationId,
    allowRepair: allowMutations,
  });
  if (published) return { state: "published", generation: published };

  const outputRows = await readPersistedGenerationOutputs({
    generationId,
    userId,
    supabaseAdmin: admin,
  });
  if (outputRows.some((row) => row.mediaFileId)) {
    return { state: "in_progress", generationId };
  }

  const status = normalizeOptionalString(existing.data?.status);
  const createdAtMs = Date.parse(normalizeOptionalString(existing.data?.created_at) ?? "");
  if (
    status === "running" &&
    (!Number.isFinite(createdAtMs) || nowMs - createdAtMs < VOICE_CHANGER_REMUX_STALE_GENERATION_MS)
  ) {
    return { state: "in_progress", generationId };
  }
  if (!allowMutations) return { state: "stale_unpublished", generationId };

  const deleted = await admin
    .from("ai_generations")
    .delete()
    .eq("id", generationId)
    .eq("user_id", userId)
    .eq("request_id", remuxRequestId)
    .eq("status", status ?? "running")
    .select("id")
    .maybeSingle();
  if (deleted.error) throw new Error(deleted.error.message);
  if (!deleted.data?.id) return { state: "in_progress", generationId };

  const folder = `${userId}/generations/video/${generationId}`;
  const listed = await admin.storage.from("media_library").list(folder, { limit: 100 });
  if (!listed.error && Array.isArray(listed.data) && listed.data.length > 0) {
    const paths = listed.data
      .map((item) => normalizeOptionalString(item?.name))
      .filter((name): name is string => Boolean(name))
      .map((name) => `${folder}/${name}`);
    if (paths.length) {
      await admin.storage
        .from("media_library")
        .remove(paths)
        .catch(() => undefined);
    }
  }

  return { state: "reclaimed", generationId };
};

const toRemuxFailure = (
  error: unknown,
  stage: VoiceChangerRemuxStage
): VoiceChangerRemuxFailure => {
  const failure = new Error(
    error instanceof Error && error.message.trim()
      ? error.message
      : stage === "assembly"
        ? "Unable to assemble the converted video."
        : "Unable to save the converted video."
  ) as VoiceChangerRemuxFailure;
  failure.stage = stage;
  failure.code =
    stage === "assembly"
      ? "VOICE_CHANGER_REMUX_ASSEMBLY_FAILED"
      : "VOICE_CHANGER_REMUX_PERSISTENCE_FAILED";
  return failure;
};

export const patchVoiceChangerRemuxMetadata = async ({
  userId,
  audioGenerationId,
  patch,
}: {
  userId: string;
  audioGenerationId: string;
  patch: Record<string, unknown>;
}): Promise<void> => {
  const admin = getSupabaseAdmin();
  const current = await admin
    .from("ai_generations")
    .select("metadata")
    .eq("id", audioGenerationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (current.error) throw new Error(current.error.message);
  const metadata =
    current.data?.metadata && typeof current.data.metadata === "object"
      ? (current.data.metadata as Record<string, unknown>)
      : {};
  const nextMetadata = { ...metadata, ...patch };
  const updated = await admin
    .from("ai_generations")
    .update({ metadata: nextMetadata })
    .eq("id", audioGenerationId)
    .eq("user_id", userId);
  if (updated.error) throw new Error(updated.error.message);

  const remuxStatus = normalizeOptionalString(nextMetadata.remux_status);
  const remuxRequestId = normalizeOptionalString(nextMetadata.remux_request_id);
  const remuxRecovery =
    (remuxStatus === "pending" || remuxStatus === "failed") && remuxRequestId
      ? {
          sourceAudioGenerationId: audioGenerationId,
          remuxRequestId,
          status: remuxStatus,
          code: normalizeOptionalString(nextMetadata.remux_failure_code),
          stage: normalizeOptionalString(nextMetadata.remux_failure_stage),
          retryable: remuxStatus === "failed",
        }
      : null;
  const repaired = await readAndRepairPublishedVoiceChangerGeneration({
    userId,
    generationId: audioGenerationId,
    remuxRecovery,
  });
  if (!repaired) {
    await upsertGenerationProjection({
      supabaseAdmin: admin,
      generationId: audioGenerationId,
      userId,
      remuxRecovery,
    });
  }
};

/** Executes the one canonical remux and persistence path without provider generation or billing. */
export const executeVoiceChangerRemux = async ({
  userId,
  audioGenerationId,
  sourceVideoBuffer,
  sourceVideoFilename,
  sourceVideoMimeType,
  convertedAudioBuffer,
  convertedAudioContentType,
  promptText,
  transcriptText,
  modelId,
  providerRequestId,
  projectId,
  workspaceRuntimeKey,
  aspect,
  workflowReload,
  extraMetadata = {},
}: {
  userId: string;
  audioGenerationId: string;
  sourceVideoBuffer: Buffer;
  sourceVideoFilename: string;
  sourceVideoMimeType: string | null;
  convertedAudioBuffer: Buffer;
  convertedAudioContentType: string;
  promptText: string;
  transcriptText: string | null;
  modelId: string;
  providerRequestId: string | null;
  projectId: string | null;
  workspaceRuntimeKey: string | null;
  aspect: string | null;
  workflowReload: Record<string, unknown>;
  extraMetadata?: Record<string, unknown>;
}): Promise<VoiceChangerRemuxExecutionResult> => {
  let remuxedVideo: RemuxedVoiceChangerVideoResult;
  try {
    remuxedVideo = await createRemuxedVoiceChangerVideo({
      sourceVideoBuffer,
      sourceVideoFilename,
      sourceVideoMimeType,
      convertedAudioBuffer,
      convertedAudioContentType,
    });
  } catch (error) {
    throw toRemuxFailure(error, "assembly");
  }

  try {
    const persistedVideo = await persistGeneratedVideoAsset({
      userId,
      promptText,
      transcriptText,
      provider: "elevenlabs",
      modelId,
      providerRequestId,
      requestId: buildVoiceChangerRemuxRequestId(audioGenerationId),
      projectId,
      workspaceRuntimeKey,
      sourceMode: "voice-changer",
      outputBuffer: remuxedVideo.buffer,
      outputContentType: remuxedVideo.contentType,
      generationReplay: aspect ? { aspect } : {},
      workflowReload,
      extraMetadata: {
        derivative_kind: "voice_changer_remuxed_video",
        source_audio_generation_id: audioGenerationId,
        ...extraMetadata,
      },
    });
    return { remuxedVideo, persistedVideo };
  } catch (error) {
    throw toRemuxFailure(error, "persistence");
  }
};
