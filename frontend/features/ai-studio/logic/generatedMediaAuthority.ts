import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import { hasDurableGeneratedMediaDisplayAuthority } from "../../../lib/generatedMediaDisplayAuthority";
import { resolveImageDimensionsFromMetadata } from "../../../lib/mediaDimensionMetadata";
import { getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";
import type { StudioOutput } from "../types";
import { isAudioUrl, isVideoUrl, resolveModelLabel } from "./stateParsers";
import {
  normalizeVideoPosterStoragePathCandidate,
  resolveVideoPosterStoragePath,
} from "./videoPosterStoragePaths";

type SupabaseClient = ReturnType<typeof ensureSupabaseQueryClient>;

type MediaFileRow = {
  id?: unknown;
  storage_path?: unknown;
  filename?: unknown;
  file_type?: unknown;
  thumb_variant_path?: unknown;
  poster_variant_path?: unknown;
  preview_variant_path?: unknown;
  width?: unknown;
  height?: unknown;
  metadata?: unknown;
};

type GenerationOutputRow = {
  id?: unknown;
  generation_id?: unknown;
  media_file_id?: unknown;
  output_index?: unknown;
  created_at?: unknown;
};

type GenerationPublicationRow = {
  generation_id?: unknown;
  owned_media_file_id?: unknown;
  preview_url?: unknown;
  full_url?: unknown;
  preview_storage_path?: unknown;
  full_storage_path?: unknown;
  created_at?: unknown;
};

type GenerationProjectionDeliveryRow = {
  generation_id?: unknown;
  project_id?: unknown;
  workspace_runtime_key?: unknown;
  request_id?: unknown;
  source_ref?: unknown;
  provider?: unknown;
  model_id?: unknown;
  display_prompt?: unknown;
  transcript_text?: unknown;
  preview_url?: unknown;
  companion_art_status?: unknown;
  companion_art_storage_path?: unknown;
  result_urls?: unknown;
  preview_storage_path?: unknown;
  full_storage_path?: unknown;
  task_state?: unknown;
  queue_state?: unknown;
  error_message_short?: unknown;
  error_detail?: unknown;
  hidden_in_reference_grid?: unknown;
  reference_grid_visible?: unknown;
  generation_replay?: unknown;
  workflow_reload?: unknown;
  character_context?: unknown;
  style_context?: unknown;
  started_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

const GENERATION_PROJECTION_DELIVERY_SELECT_COLUMNS = [
  "generation_id",
  "project_id",
  "workspace_runtime_key",
  "request_id",
  "source_ref",
  "provider",
  "model_id",
  "display_prompt",
  "transcript_text",
  "preview_url",
  "companion_art_status",
  "companion_art_storage_path",
  "result_urls",
  "preview_storage_path",
  "full_storage_path",
  "task_state",
  "queue_state",
  "error_message_short",
  "error_detail",
  "hidden_in_reference_grid",
  "reference_grid_visible",
  "generation_replay",
  "workflow_reload",
  "character_context",
  "style_context",
  "started_at",
  "created_at",
  "updated_at",
].join(", ");

export type GeneratedMediaFileRecord = {
  storagePath: string;
  filename: string | null;
};

export type GeneratedMediaLibraryRow = GeneratedMediaFileRecord & {
  mediaFileId: string;
  fileType: "image" | "video";
  fullStoragePath: string | null;
  previewStoragePath: string | null;
  thumbVariantPath: string | null;
  posterVariantPath: string | null;
  previewVariantPath: string | null;
  width: number | null;
  height: number | null;
};

export type VisibleGenerationDelivery = {
  previewUrl: string | null;
  previewPosterUrl: string | null;
  previewPosterStoragePath: string | null;
  companionArtUrl: string | null;
  companionArtStoragePath: string | null;
  companionArtStatus: StudioOutput["companionArtStatus"] | null;
  fullUrl: string | null;
  previewStoragePath: string | null;
  fullStoragePath: string | null;
};

export type PublishedGenerationDelivery = VisibleGenerationDelivery;

export type VisibleGenerationReconcile = {
  generationId: string;
  previewUrl: string | null;
  previewPosterUrl?: string | null;
  previewPosterStoragePath?: string | null;
  companionArtUrl?: string | null;
  companionArtStoragePath?: string | null;
  companionArtStatus?: StudioOutput["companionArtStatus"];
  previewStoragePath: string | null;
  fullStoragePath: string | null;
  resultUrls: string[];
};

export type VisibleGeneratedOutputRuntimeIdentity = {
  generationId?: string | null;
  requestId?: string | null;
  sourceRef?: string | null;
};

export type GenerationProjectionLifecycle = {
  generationId: string;
  taskState: StudioOutput["taskState"] | undefined;
  queueState: StudioOutput["queueState"] | undefined;
  hiddenInReferenceGrid: boolean;
  referenceGridVisible: boolean;
  errorMessageShort: string | null;
  errorDetail: string | null;
};

const VIDEO_MODEL_MARKER_PATTERN =
  /(?:veo|kling|seedance|image-to-video|text-to-video|video|i2v|t2v)/i;
const AUDIO_MODEL_MARKER_PATTERN = /(?:audio|speech|music|tts|voice)/i;

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const toPositiveInteger = (value: unknown): number | null => {
  const numericValue = typeof value === "string" ? Number(value) : value;
  if (typeof numericValue !== "number") return null;
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return Math.max(1, Math.round(numericValue));
};

const parseIsoTimestampMs = (value: unknown): number | null => {
  const iso = asTrimmedString(value);
  const parsed = Date.parse(iso ?? "");
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveGenerationProjectionRecencyMs = (row: Record<string, unknown>): number | null =>
  parseIsoTimestampMs(row.started_at) ??
  parseIsoTimestampMs(row.created_at) ??
  parseIsoTimestampMs(row.updated_at);

const resolveGenerationProjectionCreatedAt = (
  row: GenerationProjectionDeliveryRow
): string | null =>
  asTrimmedString(row.started_at) ??
  asTrimmedString(row.created_at) ??
  asTrimmedString(row.updated_at);

const resolveProjectId = (value: string | null | undefined): string | null =>
  asTrimmedString(value);

const resolveWorkspaceRuntimeKey = (value: string | null | undefined): string | null =>
  asTrimmedString(value);

const asTrimmedStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => Boolean(entry));
};

const resolveVideoDeliveryPosterStoragePath = ({
  mode,
  previewStoragePath,
  fullStoragePath,
}: {
  mode: StudioOutput["mode"];
  previewStoragePath: string | null;
  fullStoragePath: string | null;
}): string | null => {
  if (mode !== "video") return null;
  return resolveVideoPosterStoragePath({
    previewPosterStoragePath: null,
    previewStoragePath,
    fullStoragePath,
  });
};

const resolveVideoDeliveryPrimaryStoragePath = ({
  mode,
  previewStoragePath,
  fullStoragePath,
}: {
  mode: StudioOutput["mode"];
  previewStoragePath: string | null;
  fullStoragePath: string | null;
}): string | null => {
  if (mode !== "video") return previewStoragePath;
  if (previewStoragePath && isVideoUrl(previewStoragePath)) return previewStoragePath;
  if (fullStoragePath) return fullStoragePath;
  return previewStoragePath;
};

const signReferenceGridStoragePath = async (storagePath: string | null): Promise<string | null> => {
  if (!storagePath) return null;
  const signedByPath = await getSignedMediaUrlsBatch({
    bucket: "media_library",
    storagePaths: [storagePath],
    surface: "reference-grid",
    queryMode: "default",
  }).catch(() => null);
  return signedByPath?.get(storagePath) ?? null;
};

const signReferenceGridStoragePaths = async (
  storagePaths: Iterable<string | null | undefined>
): Promise<Map<string, string>> => {
  const normalizedPaths = Array.from(
    new Set(
      Array.from(storagePaths)
        .map((value) => asCanonicalStoragePath(asTrimmedString(value)))
        .filter((value): value is string => Boolean(value))
    )
  );
  if (!normalizedPaths.length) return new Map();
  return (
    (await getSignedMediaUrlsBatch({
      bucket: "media_library",
      storagePaths: normalizedPaths,
      surface: "reference-grid",
      queryMode: "default",
    }).catch(() => null)) ?? new Map()
  );
};

const signVisibleGenerationDelivery = async (
  delivery: VisibleGenerationDelivery
): Promise<VisibleGenerationDelivery> => {
  const signedByPath = await signReferenceGridStoragePaths([
    delivery.previewStoragePath,
    delivery.fullStoragePath,
    delivery.previewPosterStoragePath,
    delivery.companionArtStoragePath,
  ]);
  if (signedByPath.size === 0) return delivery;

  const signedPreviewUrl = delivery.previewStoragePath
    ? (signedByPath.get(delivery.previewStoragePath) ?? null)
    : null;
  const signedFullUrl = delivery.fullStoragePath
    ? (signedByPath.get(delivery.fullStoragePath) ?? null)
    : null;
  const signedPosterUrl = delivery.previewPosterStoragePath
    ? (signedByPath.get(delivery.previewPosterStoragePath) ?? null)
    : null;
  const signedCompanionArtUrl = delivery.companionArtStoragePath
    ? (signedByPath.get(delivery.companionArtStoragePath) ?? null)
    : null;
  const isVideoDelivery =
    Boolean(delivery.fullStoragePath && isVideoUrl(delivery.fullStoragePath)) ||
    Boolean(delivery.fullUrl && isVideoUrl(delivery.fullUrl)) ||
    Boolean(delivery.previewUrl && isVideoUrl(delivery.previewUrl));
  const signedPreviewVideoUrl =
    delivery.previewStoragePath && isVideoUrl(delivery.previewStoragePath)
      ? signedPreviewUrl
      : null;

  return {
    ...delivery,
    previewUrl: isVideoDelivery
      ? (signedFullUrl ?? signedPreviewVideoUrl ?? delivery.previewUrl)
      : (signedPreviewUrl ?? signedFullUrl ?? delivery.previewUrl),
    previewPosterUrl: signedPosterUrl ?? delivery.previewPosterUrl,
    companionArtUrl: signedCompanionArtUrl ?? delivery.companionArtUrl,
    fullUrl: isVideoDelivery
      ? (signedFullUrl ?? signedPreviewVideoUrl ?? delivery.fullUrl)
      : (signedFullUrl ?? signedPreviewUrl ?? delivery.fullUrl),
  };
};

const sanitizeFilename = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const safe = trimmed
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return safe.length ? safe : null;
};

const toProjectionDelivery = (
  row: GenerationProjectionDeliveryRow | null | undefined
): VisibleGenerationDelivery | null => {
  if (!row) return null;
  if (asTrimmedString(row.task_state) !== "success") return null;
  if (row.hidden_in_reference_grid === true) return null;
  if (row.reference_grid_visible === false) return null;

  const resultUrls = asTrimmedStringArray(row.result_urls);
  const previewUrl = asTrimmedString(row.preview_url) ?? resultUrls[0] ?? null;
  const fullUrl = resultUrls[0] ?? previewUrl;
  const rawPreviewStoragePath = asCanonicalStoragePath(asTrimmedString(row.preview_storage_path));
  const fullStoragePath = asCanonicalStoragePath(asTrimmedString(row.full_storage_path));
  const mode = inferGeneratedOutputMode({
    modelId: asTrimmedString(row.model_id),
    previewUrl,
    resultUrls,
  });
  const previewPosterStoragePath = resolveVideoDeliveryPosterStoragePath({
    mode,
    previewStoragePath: rawPreviewStoragePath,
    fullStoragePath,
  });
  const previewStoragePath = resolveVideoDeliveryPrimaryStoragePath({
    mode,
    previewStoragePath: rawPreviewStoragePath,
    fullStoragePath,
  });
  const previewPosterUrl =
    mode === "video" && previewUrl && !isVideoUrl(previewUrl) ? previewUrl : null;
  const companionArtStoragePath = asCanonicalStoragePath(
    asTrimmedString(row.companion_art_storage_path)
  );
  const normalizedCompanionArtStatus = asTrimmedString(row.companion_art_status)?.toLowerCase();
  const companionArtStatus =
    normalizedCompanionArtStatus === "pending" ||
    normalizedCompanionArtStatus === "processing" ||
    normalizedCompanionArtStatus === "ready" ||
    normalizedCompanionArtStatus === "failed"
      ? normalizedCompanionArtStatus
      : null;

  if (!previewUrl && !fullUrl && !previewStoragePath && !fullStoragePath) {
    return null;
  }

  return {
    previewUrl,
    previewPosterUrl,
    previewPosterStoragePath,
    companionArtUrl: null,
    companionArtStoragePath,
    companionArtStatus,
    fullUrl,
    previewStoragePath,
    fullStoragePath,
  };
};

const asObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const normalizeProjectionTaskState = (value: unknown): StudioOutput["taskState"] | undefined => {
  const normalized = asTrimmedString(value)?.toLowerCase();
  switch (normalized) {
    case "pending":
      return "pending";
    case "running":
      return "running";
    case "success":
    case "completed":
    case "complete":
    case "ready":
      return "success";
    case "fail":
    case "failed":
    case "error":
      return "fail";
    default:
      return undefined;
  }
};

const normalizeProjectionQueueState = (value: unknown): StudioOutput["queueState"] | undefined => {
  const normalized = asTrimmedString(value)?.toLowerCase();
  switch (normalized) {
    case "queued":
      return "queued";
    case "dispatching":
      return "dispatching";
    case "dispatched":
      return "dispatched";
    default:
      return undefined;
  }
};

const inferGeneratedOutputMode = ({
  modelId,
  previewUrl,
  resultUrls,
}: {
  modelId: string | null;
  previewUrl: string | null;
  resultUrls: string[];
}): StudioOutput["mode"] => {
  const firstMediaUrl = previewUrl ?? resultUrls[0] ?? null;
  if (isAudioUrl(firstMediaUrl)) return "audio";
  if (isVideoUrl(firstMediaUrl)) return "video";
  if (AUDIO_MODEL_MARKER_PATTERN.test(modelId ?? "")) return "audio";
  if (VIDEO_MODEL_MARKER_PATTERN.test(modelId ?? "")) return "video";
  return "image";
};

const resolveHydratedTimestamp = (taskState: StudioOutput["taskState"] | undefined): string => {
  if (taskState === "success") return "Just now";
  if (taskState === "fail") return "Failed";
  return "Processing...";
};

const hasGeneratedOutputDurableDisplayAuthority = (output: StudioOutput): boolean => {
  if (output.taskState === "pending" || output.taskState === "running") return true;
  if (output.taskState === "fail") return true;
  return hasDurableGeneratedMediaDisplayAuthority(output);
};

const hasGeneratedOutputRestorableDisplayAuthority = (output: StudioOutput): boolean => {
  if (hasGeneratedOutputDurableDisplayAuthority(output)) return true;
  if (output.taskState !== "success") return false;
  return Boolean(
    asTrimmedString(output.previewUrl) ||
    asTrimmedString(output.previewPosterUrl) ||
    asTrimmedString(output.resultUrls?.[0])
  );
};

const hasVisibleGenerationDeliveryDurableDisplayAuthority = (
  delivery: VisibleGenerationDelivery
): boolean => {
  return hasDurableGeneratedMediaDisplayAuthority({
    previewPosterStoragePath: delivery.previewPosterStoragePath,
    previewStoragePath: delivery.previewStoragePath,
    fullStoragePath: delivery.fullStoragePath,
    companionArtStoragePath: delivery.companionArtStoragePath,
  });
};

const hasVisibleGenerationDeliveryDisplayAuthority = (
  delivery: VisibleGenerationDelivery
): boolean => {
  if (hasVisibleGenerationDeliveryDurableDisplayAuthority(delivery)) return true;
  return Boolean(
    asTrimmedString(delivery.previewUrl) ||
    asTrimmedString(delivery.previewPosterUrl) ||
    asTrimmedString(delivery.fullUrl)
  );
};

const toHydratedGeneratedOutput = (
  row: GenerationProjectionDeliveryRow | null | undefined
): StudioOutput | null => {
  if (!row) return null;
  if (row.hidden_in_reference_grid === true || row.reference_grid_visible === false) return null;

  const generationId = asTrimmedString(row.generation_id);
  if (!generationId) return null;

  const resultUrls = asTrimmedStringArray(row.result_urls);
  const previewUrl = asTrimmedString(row.preview_url) ?? resultUrls[0] ?? undefined;
  const rawPreviewStoragePath = asCanonicalStoragePath(asTrimmedString(row.preview_storage_path));
  const fullStoragePath = asCanonicalStoragePath(asTrimmedString(row.full_storage_path));
  const taskState = normalizeProjectionTaskState(row.task_state);
  if (taskState === "fail") return null;
  const queueState = normalizeProjectionQueueState(row.queue_state);
  const modelId = asTrimmedString(row.model_id);
  const mode = inferGeneratedOutputMode({
    modelId,
    previewUrl: previewUrl ?? null,
    resultUrls,
  });
  const previewPosterUrl =
    mode === "video" && previewUrl && !isVideoUrl(previewUrl) ? previewUrl : null;
  const previewPosterStoragePath = resolveVideoDeliveryPosterStoragePath({
    mode,
    previewStoragePath: rawPreviewStoragePath,
    fullStoragePath,
  });
  const previewStoragePath = resolveVideoDeliveryPrimaryStoragePath({
    mode,
    previewStoragePath: rawPreviewStoragePath,
    fullStoragePath,
  });
  const companionArtStoragePath = asCanonicalStoragePath(
    asTrimmedString(row.companion_art_storage_path)
  );
  const normalizedCompanionArtStatus = asTrimmedString(row.companion_art_status)?.toLowerCase();
  const companionArtStatus =
    normalizedCompanionArtStatus === "pending" ||
    normalizedCompanionArtStatus === "processing" ||
    normalizedCompanionArtStatus === "ready" ||
    normalizedCompanionArtStatus === "failed"
      ? normalizedCompanionArtStatus
      : undefined;
  const generationReplay = (asObject(row.generation_replay) ?? undefined) as
    | StudioOutput["generationReplay"]
    | undefined;
  const workflowReload = (asObject(row.workflow_reload) ?? undefined) as
    | StudioOutput["workflowReload"]
    | undefined;
  const replayAspect = asTrimmedString(generationReplay?.aspect);
  const characterContext = (asObject(row.character_context) ?? undefined) as
    | StudioOutput["characterContext"]
    | undefined;
  const styleContext = (asObject(row.style_context) ?? undefined) as
    | StudioOutput["styleContext"]
    | undefined;
  const errorMessageShort = asTrimmedString(row.error_message_short) ?? undefined;
  const errorDetail = asTrimmedString(row.error_detail) ?? undefined;

  return {
    id: `generated:${generationId}`,
    prompt: asTrimmedString(row.display_prompt) ?? "",
    transcriptText: asTrimmedString(row.transcript_text) ?? null,
    mode,
    aspect: replayAspect ?? "1:1",
    model: resolveModelLabel(modelId ?? undefined),
    createdAt: resolveGenerationProjectionCreatedAt(row),
    modelId: modelId ?? undefined,
    provider: asTrimmedString(row.provider) ?? undefined,
    sourceRef: asTrimmedString(row.source_ref) ?? undefined,
    generationId,
    status: "ready",
    timestamp: resolveHydratedTimestamp(taskState),
    taskId: asTrimmedString(row.request_id) ?? undefined,
    queueState,
    taskState,
    errorMessage: errorMessageShort ?? null,
    errorMessageShort: errorMessageShort ?? null,
    errorDetail: errorDetail ?? null,
    resultUrls,
    previewUrl,
    previewPosterUrl,
    previewPosterStoragePath,
    companionArtUrl: null,
    companionArtStoragePath,
    companionArtStatus,
    previewStoragePath,
    fullStoragePath,
    mediaSource: "generated",
    hiddenInReferenceGrid: false,
    previewTier: mode === "video" ? "preview_loop" : "full",
    characterContext,
    styleContext,
    generationReplay,
    workflowReload,
  };
};

const toProjectionLifecycle = (
  row: GenerationProjectionDeliveryRow | null | undefined
): GenerationProjectionLifecycle | null => {
  if (!row) return null;
  const generationId = asTrimmedString(row.generation_id);
  if (!generationId) return null;
  return {
    generationId,
    taskState: normalizeProjectionTaskState(row.task_state),
    queueState: normalizeProjectionQueueState(row.queue_state),
    hiddenInReferenceGrid: row.hidden_in_reference_grid === true,
    referenceGridVisible: row.reference_grid_visible !== false,
    errorMessageShort: asTrimmedString(row.error_message_short),
    errorDetail: asTrimmedString(row.error_detail),
  };
};

const runMaybeSingleMediaStorageQuery = async <TRow extends MediaFileRow>(args: {
  runSelect: (columns: "storage_path, filename") => Promise<{ data: TRow | null; error: unknown }>;
}): Promise<TRow | null> => {
  const result = await args.runSelect("storage_path, filename");
  return result.error ? null : result.data;
};

const toGeneratedMediaFileRecord = (
  row: MediaFileRow | null | undefined
): GeneratedMediaFileRecord | null => {
  const storagePath = asCanonicalStoragePath(asTrimmedString(row?.storage_path));
  if (!storagePath) return null;
  return {
    storagePath,
    filename: sanitizeFilename(asTrimmedString(row?.filename)),
  };
};

const toGeneratedMediaLibraryRow = (
  row: MediaFileRow | null | undefined
): GeneratedMediaLibraryRow | null => {
  const mediaFileId = asTrimmedString(row?.id);
  const baseRecord = toGeneratedMediaFileRecord(row);
  if (!mediaFileId || !baseRecord) return null;
  const fullStoragePath = asCanonicalStoragePath(asTrimmedString(row?.storage_path));
  const fileType = asTrimmedString(row?.file_type)?.toLowerCase().startsWith("video")
    ? "video"
    : "image";
  const thumbVariantPath = asCanonicalStoragePath(asTrimmedString(row?.thumb_variant_path));
  const posterVariantPath = asCanonicalStoragePath(asTrimmedString(row?.poster_variant_path));
  const previewVariantPath = asCanonicalStoragePath(asTrimmedString(row?.preview_variant_path));
  const previewStoragePath =
    fileType === "video"
      ? (previewVariantPath ?? fullStoragePath)
      : (thumbVariantPath ?? fullStoragePath);
  const metadata = asObject(row?.metadata);
  const metadataDimensions = resolveImageDimensionsFromMetadata(metadata);
  return {
    mediaFileId,
    storagePath: baseRecord.storagePath,
    filename: baseRecord.filename,
    fileType,
    fullStoragePath,
    previewStoragePath,
    thumbVariantPath,
    posterVariantPath,
    previewVariantPath,
    width: toPositiveInteger(row?.width) ?? metadataDimensions?.width ?? null,
    height: toPositiveInteger(row?.height) ?? metadataDimensions?.height ?? null,
  };
};

const runMaybeSingleMediaLibraryQuery = async <TRow extends MediaFileRow>(args: {
  runSelect: (
    columns: "id, storage_path, filename, file_type, thumb_variant_path, poster_variant_path, preview_variant_path, width, height, metadata"
  ) => Promise<{ data: TRow | null; error: unknown }>;
}): Promise<TRow | null> => {
  const result = await args.runSelect(
    "id, storage_path, filename, file_type, thumb_variant_path, poster_variant_path, preview_variant_path, width, height, metadata"
  );
  return result.error ? null : result.data;
};

export const resolveGeneratedMediaFileRecordById = async ({
  supabase,
  mediaFileId,
}: {
  supabase: SupabaseClient;
  mediaFileId: string;
}): Promise<GeneratedMediaFileRecord | null> => {
  const mediaRow = await runMaybeSingleMediaStorageQuery({
    runSelect: async (columns) =>
      (await supabase
        .from("media_files")
        .select(columns)
        .eq("id", mediaFileId)
        .limit(1)
        .maybeSingle()) as unknown as { data: MediaFileRow | null; error: unknown },
  });
  return toGeneratedMediaFileRecord(mediaRow);
};

export const resolveGeneratedMediaLibraryRowById = async ({
  supabase,
  mediaFileId,
}: {
  supabase: SupabaseClient;
  mediaFileId: string;
}): Promise<GeneratedMediaLibraryRow | null> => {
  const mediaRow = await runMaybeSingleMediaLibraryQuery({
    runSelect: async (columns) =>
      (await supabase
        .from("media_files")
        .select(columns)
        .eq("id", mediaFileId)
        .limit(1)
        .maybeSingle()) as unknown as { data: MediaFileRow | null; error: unknown },
  });
  return toGeneratedMediaLibraryRow(mediaRow);
};

const resolveProjectAssociatedGenerationId = async ({
  supabase,
  userId,
  projectId,
  generationId,
}: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string | null;
  generationId: string | null;
}): Promise<string | null> => {
  const normalizedProjectId = resolveProjectId(projectId);
  const normalizedGenerationId = asTrimmedString(generationId);
  if (!normalizedGenerationId) return null;
  if (!normalizedProjectId) return normalizedGenerationId;

  const { data, error } = await supabase
    .from("project_generation_items")
    .select("generation_id")
    .eq("user_id", userId)
    .eq("project_id", normalizedProjectId)
    .eq("generation_id", normalizedGenerationId)
    .limit(1)
    .maybeSingle();
  const associatedGenerationId = error
    ? null
    : asTrimmedString((data as Record<string, unknown> | null)?.generation_id);
  if (associatedGenerationId) return associatedGenerationId;

  const { data: projectionData, error: projectionError } = await supabase
    .from("generation_projection")
    .select("generation_id, project_id")
    .eq("user_id", userId)
    .eq("project_id", normalizedProjectId)
    .eq("generation_id", normalizedGenerationId)
    .limit(1)
    .maybeSingle();
  if (projectionError) return null;
  const projectionRow = projectionData as Record<string, unknown> | null;
  if (asTrimmedString(projectionRow?.project_id) !== normalizedProjectId) return null;
  return asTrimmedString(projectionRow?.generation_id);
};

const resolveCanonicalGenerationId = async ({
  supabase,
  userId,
  projectId,
  generationId,
}: {
  supabase: SupabaseClient;
  userId: string;
  projectId?: string | null;
  generationId: string | null;
}): Promise<string | null> =>
  await resolveProjectAssociatedGenerationId({
    supabase,
    userId,
    projectId: projectId ?? null,
    generationId,
  });

const resolveProjectionGenerationIdByColumn = async ({
  supabase,
  userId,
  column,
  value,
}: {
  supabase: SupabaseClient;
  userId: string;
  column: "request_id" | "source_ref";
  value: string | null;
}): Promise<string | null> => {
  const normalizedValue = asTrimmedString(value);
  if (!normalizedValue) return null;

  const { data: projectionData, error: projectionError } = await supabase
    .from("generation_projection")
    .select("generation_id")
    .eq("user_id", userId)
    .eq(column, normalizedValue)
    .limit(1)
    .maybeSingle();
  if (projectionError) return null;

  return asTrimmedString((projectionData as Record<string, unknown> | null)?.generation_id);
};

const resolveCanonicalGenerationIdFromRuntimeIdentity = async ({
  supabase,
  userId,
  projectId,
  generationId,
  requestId,
  sourceRef,
}: {
  supabase: SupabaseClient;
  userId: string;
  projectId?: string | null;
  generationId?: string | null;
  requestId?: string | null;
  sourceRef?: string | null;
}): Promise<string | null> => {
  const triedGenerationIds = new Set<string>();

  const resolveCandidate = async (candidateGenerationId: string | null): Promise<string | null> => {
    const normalizedCandidateGenerationId = asTrimmedString(candidateGenerationId);
    if (
      !normalizedCandidateGenerationId ||
      triedGenerationIds.has(normalizedCandidateGenerationId)
    ) {
      return null;
    }
    triedGenerationIds.add(normalizedCandidateGenerationId);
    return await resolveCanonicalGenerationId({
      supabase,
      userId,
      projectId,
      generationId: normalizedCandidateGenerationId,
    });
  };

  const requestScopedGenerationId = await resolveProjectionGenerationIdByColumn({
    supabase,
    userId,
    column: "request_id",
    value: requestId ?? null,
  });
  const resolvedRequestScopedGenerationId = await resolveCandidate(requestScopedGenerationId);
  if (resolvedRequestScopedGenerationId) return resolvedRequestScopedGenerationId;

  const sourceScopedGenerationId = await resolveProjectionGenerationIdByColumn({
    supabase,
    userId,
    column: "source_ref",
    value: sourceRef ?? null,
  });
  const resolvedSourceScopedGenerationId = await resolveCandidate(sourceScopedGenerationId);
  if (resolvedSourceScopedGenerationId) return resolvedSourceScopedGenerationId;

  return await resolveCandidate(generationId ?? null);
};

export const resolveGenerationIdForRequestId = async ({
  supabase,
  requestId,
  userId,
  projectId,
}: {
  supabase: SupabaseClient;
  requestId: string | null | undefined;
  userId?: string | null;
  projectId?: string | null;
}): Promise<string | null> => {
  const normalizedRequestId = asTrimmedString(requestId);
  if (!normalizedRequestId) return null;
  const resolvedUserId = asTrimmedString(userId) ?? (await readSupabaseUserId());
  if (!resolvedUserId) return null;

  const { data: projectionData, error: projectionError } = await supabase
    .from("generation_projection")
    .select("generation_id")
    .eq("user_id", resolvedUserId)
    .eq("request_id", normalizedRequestId)
    .limit(1)
    .maybeSingle();
  if (projectionError) return null;
  return await resolveCanonicalGenerationId({
    supabase,
    userId: resolvedUserId,
    projectId,
    generationId: asTrimmedString(
      (projectionData as Record<string, unknown> | null)?.generation_id
    ),
  });
};

export const resolvePublishedGenerationOutputStoragePathByIndex = async ({
  supabase,
  generationId,
  imageIndex,
}: {
  supabase: SupabaseClient;
  generationId: string;
  imageIndex: number;
}): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from("ai_generation_outputs")
      .select("id, media_file_id")
      .eq("generation_id", generationId)
      .eq("output_index", imageIndex)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;

    const canonicalOutputRow = data as GenerationOutputRow;
    const generationOutputId = asTrimmedString(canonicalOutputRow.id);
    if (generationOutputId) {
      const { data: publicationData, error: publicationError } = await supabase
        .from("generation_publications")
        .select("owned_media_file_id, preview_storage_path, full_storage_path")
        .eq("generation_output_id", generationOutputId)
        .eq("publication_state", "published")
        .limit(1)
        .maybeSingle();
      if (!publicationError && publicationData) {
        const publicationRow = publicationData as GenerationPublicationRow;
        const publicationStoragePath =
          asCanonicalStoragePath(asTrimmedString(publicationRow.full_storage_path)) ??
          asCanonicalStoragePath(asTrimmedString(publicationRow.preview_storage_path));
        if (publicationStoragePath) return publicationStoragePath;
        const ownedMediaFileId = asTrimmedString(publicationRow.owned_media_file_id);
        if (ownedMediaFileId) {
          const publicationMediaRecord = await resolveGeneratedMediaFileRecordById({
            supabase,
            mediaFileId: ownedMediaFileId,
          });
          if (publicationMediaRecord) return publicationMediaRecord.storagePath;
        }
      }
    }

    const mediaFileId = asTrimmedString(canonicalOutputRow.media_file_id);
    if (!mediaFileId) return null;
    const canonicalMediaRecord = await resolveGeneratedMediaFileRecordById({
      supabase,
      mediaFileId,
    });
    return canonicalMediaRecord?.storagePath ?? null;
  } catch {
    return null;
  }
};

export const resolvePublishedGenerationMediaByIndex = async ({
  supabase,
  generationId,
  imageIndex,
}: {
  supabase: SupabaseClient;
  generationId: string;
  imageIndex: number;
}): Promise<GeneratedMediaLibraryRow | null> => {
  try {
    const { data, error } = await supabase
      .from("ai_generation_outputs")
      .select("id, media_file_id")
      .eq("generation_id", generationId)
      .eq("output_index", imageIndex)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;

    const canonicalOutputRow = data as GenerationOutputRow;
    const generationOutputId = asTrimmedString(canonicalOutputRow.id);
    if (generationOutputId) {
      const { data: publicationData, error: publicationError } = await supabase
        .from("generation_publications")
        .select("owned_media_file_id")
        .eq("generation_output_id", generationOutputId)
        .eq("publication_state", "published")
        .limit(1)
        .maybeSingle();
      if (!publicationError && publicationData) {
        const ownedMediaFileId = asTrimmedString(
          (publicationData as GenerationPublicationRow).owned_media_file_id
        );
        if (ownedMediaFileId) {
          const publicationMediaRow = await resolveGeneratedMediaLibraryRowById({
            supabase,
            mediaFileId: ownedMediaFileId,
          });
          if (publicationMediaRow) return publicationMediaRow;
        }
      }
    }

    const mediaFileId = asTrimmedString(canonicalOutputRow.media_file_id);
    if (!mediaFileId) return null;
    return await resolveGeneratedMediaLibraryRowById({
      supabase,
      mediaFileId,
    });
  } catch {
    return null;
  }
};

const resolveLatestPublishedGenerationMediaByGenerationIds = async ({
  supabase,
  generationIds,
  userId,
}: {
  supabase: SupabaseClient;
  generationIds: string[];
  userId: string;
}): Promise<Map<string, GeneratedMediaLibraryRow>> => {
  const normalizedGenerationIds = Array.from(
    new Set(
      generationIds
        .map((value) => asTrimmedString(value))
        .filter((value): value is string => Boolean(value))
    )
  );
  if (!normalizedGenerationIds.length) return new Map();

  const mediaIdByGenerationId = new Map<string, string>();
  try {
    const { data: publicationData, error: publicationError } = await supabase
      .from("generation_publications")
      .select("generation_id, owned_media_file_id, created_at")
      .eq("user_id", userId)
      .eq("publication_state", "published")
      .in("generation_id", normalizedGenerationIds)
      .order("created_at", { ascending: false })
      .limit(Math.max(normalizedGenerationIds.length * 3, normalizedGenerationIds.length));

    if (!publicationError && Array.isArray(publicationData)) {
      for (const rawRow of publicationData) {
        const row = rawRow as GenerationPublicationRow;
        const generationId = asTrimmedString(row.generation_id);
        const mediaFileId = asTrimmedString(row.owned_media_file_id);
        if (!generationId || !mediaFileId || mediaIdByGenerationId.has(generationId)) continue;
        mediaIdByGenerationId.set(generationId, mediaFileId);
      }
    }
  } catch {
    // Canonical output fallback remains authoritative when publication reads are unavailable.
  }

  const missingGenerationIds = normalizedGenerationIds.filter(
    (generationId) => !mediaIdByGenerationId.has(generationId)
  );
  if (missingGenerationIds.length) {
    try {
      const { data: canonicalOutputData, error: canonicalOutputError } = await supabase
        .from("ai_generation_outputs")
        .select("generation_id, media_file_id, output_index, created_at")
        .eq("user_id", userId)
        .in("generation_id", missingGenerationIds)
        .order("output_index", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(Math.max(missingGenerationIds.length * 3, missingGenerationIds.length));

      if (!canonicalOutputError && Array.isArray(canonicalOutputData)) {
        for (const rawRow of canonicalOutputData) {
          const row = rawRow as GenerationOutputRow;
          const generationId = asTrimmedString(row.generation_id);
          const mediaFileId = asTrimmedString(row.media_file_id);
          if (!generationId || !mediaFileId || mediaIdByGenerationId.has(generationId)) continue;
          mediaIdByGenerationId.set(generationId, mediaFileId);
        }
      }
    } catch {
      return new Map();
    }
  }

  const mediaFileIds = Array.from(new Set(mediaIdByGenerationId.values()));
  if (!mediaFileIds.length) return new Map();

  let mediaData: unknown[] = [];
  try {
    const mediaResult = await supabase
      .from("media_files")
      .select(
        "id, storage_path, filename, file_type, thumb_variant_path, poster_variant_path, preview_variant_path, width, height, metadata"
      )
      .eq("user_id", userId)
      .in("id", mediaFileIds)
      .limit(mediaFileIds.length);
    if (mediaResult.error || !Array.isArray(mediaResult.data)) {
      mediaData = [];
    } else {
      mediaData = mediaResult.data;
    }
  } catch {
    mediaData = [];
  }

  const mediaById = new Map<string, GeneratedMediaLibraryRow>();
  for (const rawRow of mediaData) {
    const mediaRow = toGeneratedMediaLibraryRow(rawRow as MediaFileRow);
    if (mediaRow) {
      mediaById.set(mediaRow.mediaFileId, mediaRow);
    }
  }

  const missingMediaFileIds = mediaFileIds.filter((mediaFileId) => !mediaById.has(mediaFileId));
  for (const mediaFileId of missingMediaFileIds) {
    const mediaRow = await resolveGeneratedMediaLibraryRowById({
      supabase,
      mediaFileId,
    });
    if (mediaRow) {
      mediaById.set(mediaRow.mediaFileId, mediaRow);
    }
  }

  const mediaByGenerationId = new Map<string, GeneratedMediaLibraryRow>();
  for (const [generationId, mediaFileId] of mediaIdByGenerationId.entries()) {
    const mediaRow = mediaById.get(mediaFileId);
    if (mediaRow) {
      mediaByGenerationId.set(generationId, mediaRow);
    }
  }
  return mediaByGenerationId;
};

const applyPublishedGeneratedMediaAuthority = (
  outputs: StudioOutput[],
  mediaByGenerationId: Map<string, GeneratedMediaLibraryRow>
): StudioOutput[] =>
  outputs.map((output) => {
    if (!output.generationId) return output;
    const mediaRow = mediaByGenerationId.get(output.generationId);
    if (!mediaRow) return output;
    const mediaStoragePath = asCanonicalStoragePath(mediaRow.storagePath);
    const mediaFullStoragePath =
      asCanonicalStoragePath(mediaRow.fullStoragePath) ?? mediaStoragePath;
    const mediaPreviewStoragePath =
      mediaRow.fileType === "video"
        ? (asCanonicalStoragePath(mediaRow.previewVariantPath) ?? mediaFullStoragePath)
        : (asCanonicalStoragePath(mediaRow.thumbVariantPath) ??
          asCanonicalStoragePath(mediaRow.previewStoragePath) ??
          mediaFullStoragePath);
    const mediaPosterStoragePath = normalizeVideoPosterStoragePathCandidate(
      mediaRow.posterVariantPath
    );
    const mediaPreviewVariantPath = asCanonicalStoragePath(mediaRow.previewVariantPath);
    const shouldPreferCanonicalImagePaths =
      output.mode === "image" && mediaRow.fileType === "image";
    const nextFullStoragePath = shouldPreferCanonicalImagePaths
      ? mediaFullStoragePath
      : (asCanonicalStoragePath(output.fullStoragePath) ?? mediaFullStoragePath);
    const nextPreviewStoragePath = shouldPreferCanonicalImagePaths
      ? mediaPreviewStoragePath
      : (asCanonicalStoragePath(output.previewStoragePath) ??
        (mediaRow.fileType === "video"
          ? (mediaPreviewVariantPath ?? mediaFullStoragePath)
          : mediaPreviewStoragePath));
    const nextPreviewPosterStoragePath =
      normalizeVideoPosterStoragePathCandidate(output.previewPosterStoragePath) ??
      mediaPosterStoragePath ??
      resolveVideoDeliveryPosterStoragePath({
        mode: output.mode,
        previewStoragePath: nextPreviewStoragePath,
        fullStoragePath: nextFullStoragePath,
      });
    if (!nextPreviewStoragePath && !nextFullStoragePath && !nextPreviewPosterStoragePath) {
      return output;
    }
    if (
      output.previewPosterStoragePath === nextPreviewPosterStoragePath &&
      output.previewStoragePath === nextPreviewStoragePath &&
      output.fullStoragePath === nextFullStoragePath &&
      output.width === (mediaRow.width ?? null) &&
      output.height === (mediaRow.height ?? null)
    ) {
      return output;
    }
    return {
      ...output,
      previewPosterStoragePath: nextPreviewPosterStoragePath,
      previewStoragePath: nextPreviewStoragePath,
      fullStoragePath: nextFullStoragePath,
      width: mediaRow.width ?? output.width ?? null,
      height: mediaRow.height ?? output.height ?? null,
    };
  });

const applySignedGeneratedMediaUrls = async (outputs: StudioOutput[]): Promise<StudioOutput[]> => {
  const signedByPath = await signReferenceGridStoragePaths(
    outputs.flatMap((output) => [
      output.previewStoragePath,
      output.fullStoragePath,
      output.companionArtStoragePath,
    ])
  );
  if (signedByPath.size === 0) return outputs;

  let changed = false;
  const patched = outputs.map((output) => {
    const previewStoragePath = asCanonicalStoragePath(output.previewStoragePath ?? null);
    const fullStoragePath = asCanonicalStoragePath(output.fullStoragePath ?? null);
    const companionArtStoragePath = asCanonicalStoragePath(output.companionArtStoragePath ?? null);
    const signedPreviewUrl = previewStoragePath
      ? (signedByPath.get(previewStoragePath) ?? null)
      : null;
    const signedFullUrl = fullStoragePath ? (signedByPath.get(fullStoragePath) ?? null) : null;
    const signedCompanionArtUrl = companionArtStoragePath
      ? (signedByPath.get(companionArtStoragePath) ?? null)
      : null;
    if (!signedPreviewUrl && !signedFullUrl && !signedCompanionArtUrl) return output;
    const signedPreviewVideoUrl =
      previewStoragePath && isVideoUrl(previewStoragePath) ? signedPreviewUrl : null;

    const previewUrl =
      output.mode === "video"
        ? (signedFullUrl ?? signedPreviewVideoUrl ?? output.previewUrl)
        : (signedPreviewUrl ?? signedFullUrl ?? output.previewUrl);
    const resultUrls = signedFullUrl
      ? [signedFullUrl]
      : signedPreviewUrl && (!output.resultUrls || output.resultUrls.length === 0)
        ? [signedPreviewUrl]
        : output.resultUrls;
    if (
      previewUrl === output.previewUrl &&
      resultUrls === output.resultUrls &&
      signedCompanionArtUrl === output.companionArtUrl &&
      companionArtStoragePath === output.companionArtStoragePath
    ) {
      return output;
    }
    changed = true;
    return {
      ...output,
      previewUrl,
      companionArtUrl: signedCompanionArtUrl ?? output.companionArtUrl,
      companionArtStoragePath,
      resultUrls,
    };
  });

  return changed ? patched : outputs;
};

const applySignedVideoPosterUrls = async (outputs: StudioOutput[]): Promise<StudioOutput[]> => {
  const posterPathByOutputId = new Map<string, string>();
  const storagePaths = new Set<string>();
  for (const output of outputs) {
    if (output.mode !== "video") continue;
    const posterStoragePath =
      normalizeVideoPosterStoragePathCandidate(output.previewPosterStoragePath) ??
      resolveVideoDeliveryPosterStoragePath({
        mode: output.mode,
        previewStoragePath: asCanonicalStoragePath(output.previewStoragePath),
        fullStoragePath: asCanonicalStoragePath(output.fullStoragePath),
      });
    if (!posterStoragePath) continue;
    posterPathByOutputId.set(output.id, posterStoragePath);
    storagePaths.add(posterStoragePath);
  }

  if (storagePaths.size === 0) return outputs;
  const signedByPath = await getSignedMediaUrlsBatch({
    bucket: "media_library",
    storagePaths: Array.from(storagePaths),
    surface: "reference-grid",
    queryMode: "default",
  }).catch(() => null);
  if (!signedByPath) return outputs;

  let changed = false;
  const patched = outputs.map((output) => {
    const posterStoragePath = posterPathByOutputId.get(output.id);
    if (!posterStoragePath) return output;
    const signedPosterUrl = signedByPath.get(posterStoragePath) ?? null;
    if (!signedPosterUrl || output.previewPosterUrl === signedPosterUrl) return output;
    changed = true;
    return {
      ...output,
      previewPosterUrl: signedPosterUrl,
      previewPosterStoragePath: posterStoragePath,
    };
  });

  return changed ? patched : outputs;
};

export const resolveLatestPublishedGenerationMediaFile = async ({
  supabase,
  generationId,
}: {
  supabase: SupabaseClient;
  generationId: string;
}): Promise<GeneratedMediaFileRecord | null> => {
  const { data, error } = await supabase
    .from("generation_publications")
    .select("owned_media_file_id, preview_storage_path, full_storage_path, created_at")
    .eq("generation_id", generationId)
    .eq("publication_state", "published")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    throw new Error(error.message || "Failed to resolve published generation media.");
  }

  for (const rawRow of Array.isArray(data) ? data : []) {
    const row = rawRow as GenerationPublicationRow;
    const storagePath =
      asCanonicalStoragePath(asTrimmedString(row.full_storage_path)) ??
      asCanonicalStoragePath(asTrimmedString(row.preview_storage_path));
    if (storagePath) {
      return {
        storagePath,
        filename: null,
      };
    }
    const mediaFileId = asTrimmedString(row.owned_media_file_id);
    if (mediaFileId) {
      const fileRecord = await resolveGeneratedMediaFileRecordById({
        supabase,
        mediaFileId,
      });
      if (fileRecord) return fileRecord;
    }
  }

  return null;
};

const resolvePublishedGenerationDeliveryByGenerationId = async ({
  supabase,
  generationId,
  userId,
}: {
  supabase: SupabaseClient;
  generationId: string;
  userId?: string | null;
}): Promise<VisibleGenerationDelivery | null> => {
  try {
    let query = supabase
      .from("generation_publications")
      .select(
        "owned_media_file_id, preview_url, full_url, preview_storage_path, full_storage_path, created_at"
      )
      .eq("generation_id", generationId)
      .eq("publication_state", "published")
      .order("created_at", { ascending: false })
      .limit(50);
    const resolvedUserId = asTrimmedString(userId);
    if (resolvedUserId) {
      query = query.eq("user_id", resolvedUserId);
    }
    const { data, error } = await query;
    if (error) return null;

    for (const rawRow of Array.isArray(data) ? data : []) {
      const row = rawRow as GenerationPublicationRow;
      const previewUrl = asTrimmedString(row.preview_url);
      const fullUrl = asTrimmedString(row.full_url);
      const ownedMediaFileId = asTrimmedString(row.owned_media_file_id);
      const previewStoragePath = asCanonicalStoragePath(asTrimmedString(row.preview_storage_path));
      const fullStoragePath = asCanonicalStoragePath(asTrimmedString(row.full_storage_path));
      if (previewUrl || fullUrl || previewStoragePath || fullStoragePath) {
        const mediaRow = ownedMediaFileId
          ? await resolveGeneratedMediaLibraryRowById({
              supabase,
              mediaFileId: ownedMediaFileId,
            })
          : null;
        const mediaPosterStoragePath =
          mediaRow?.fileType === "video"
            ? asCanonicalStoragePath(mediaRow.posterVariantPath)
            : null;
        const mediaPreviewVariantPath =
          mediaRow?.fileType === "video"
            ? asCanonicalStoragePath(mediaRow.previewVariantPath)
            : null;
        const resolvedPreviewStoragePath =
          mediaRow?.fileType === "video"
            ? resolveVideoDeliveryPrimaryStoragePath({
                mode: "video",
                previewStoragePath: mediaPreviewVariantPath ?? previewStoragePath,
                fullStoragePath,
              })
            : (previewStoragePath ?? fullStoragePath);
        return {
          previewUrl,
          previewPosterUrl: null,
          previewPosterStoragePath: mediaPosterStoragePath,
          fullUrl,
          previewStoragePath: resolvedPreviewStoragePath,
          fullStoragePath,
          companionArtUrl: null,
          companionArtStoragePath: null,
          companionArtStatus: null,
        };
      }
    }

    if (resolvedUserId) {
      const canonicalMediaByGenerationId =
        await resolveLatestPublishedGenerationMediaByGenerationIds({
          supabase,
          generationIds: [generationId],
          userId: resolvedUserId,
        });
      const canonicalMediaRow = canonicalMediaByGenerationId.get(generationId);
      if (canonicalMediaRow) {
        const fullStoragePath = asCanonicalStoragePath(canonicalMediaRow.storagePath);
        const previewPosterStoragePath =
          canonicalMediaRow.fileType === "video"
            ? asCanonicalStoragePath(canonicalMediaRow.posterVariantPath)
            : null;
        const previewStoragePath =
          canonicalMediaRow.fileType === "video"
            ? resolveVideoDeliveryPrimaryStoragePath({
                mode: "video",
                previewStoragePath: asCanonicalStoragePath(canonicalMediaRow.previewVariantPath),
                fullStoragePath,
              })
            : fullStoragePath;
        if (previewStoragePath || fullStoragePath || previewPosterStoragePath) {
          return {
            previewUrl: null,
            previewPosterUrl: null,
            previewPosterStoragePath,
            fullUrl: null,
            previewStoragePath,
            fullStoragePath,
            companionArtUrl: null,
            companionArtStoragePath: null,
            companionArtStatus: null,
          };
        }
      }
    }

    return null;
  } catch {
    return null;
  }
};

export const resolveVisibleGenerationDeliveryByGenerationId = async ({
  supabase,
  generationId,
  userId,
}: {
  supabase: SupabaseClient;
  generationId: string;
  userId?: string | null;
}): Promise<VisibleGenerationDelivery | null> => {
  try {
    const resolvedUserId = asTrimmedString(userId);
    let projectionQuery = supabase
      .from("generation_projection")
      .select(GENERATION_PROJECTION_DELIVERY_SELECT_COLUMNS)
      .eq("generation_id", generationId)
      .limit(1);
    if (resolvedUserId) {
      projectionQuery = projectionQuery.eq("user_id", resolvedUserId);
    }
    const { data: projectionData, error: projectionError } = await projectionQuery.maybeSingle();
    if (!projectionError) {
      const projectionDelivery = toProjectionDelivery(
        projectionData as GenerationProjectionDeliveryRow | null
      );
      if (projectionDelivery) {
        const projectionUrls = [projectionDelivery.previewUrl, projectionDelivery.fullUrl].filter(
          (url): url is string => Boolean(url)
        );
        const needsVideoPoster =
          !projectionDelivery.previewPosterStoragePath &&
          projectionUrls.some((url) => isVideoUrl(url));
        const needsPublishedStorageAuthority =
          resolvedUserId &&
          (!projectionDelivery.previewStoragePath || !projectionDelivery.fullStoragePath);
        if ((needsVideoPoster || needsPublishedStorageAuthority) && resolvedUserId) {
          const publishedDelivery = await resolvePublishedGenerationDeliveryByGenerationId({
            supabase,
            generationId,
            userId: resolvedUserId,
          });
          if (publishedDelivery) {
            const mergedDelivery = {
              ...projectionDelivery,
              previewPosterUrl:
                projectionDelivery.previewPosterUrl ?? publishedDelivery.previewPosterUrl,
              previewPosterStoragePath:
                projectionDelivery.previewPosterStoragePath ??
                publishedDelivery.previewPosterStoragePath,
              companionArtStoragePath:
                projectionDelivery.companionArtStoragePath ??
                publishedDelivery.companionArtStoragePath,
              companionArtStatus:
                projectionDelivery.companionArtStatus ?? publishedDelivery.companionArtStatus,
              previewStoragePath:
                projectionDelivery.previewStoragePath ?? publishedDelivery.previewStoragePath,
              fullStoragePath:
                projectionDelivery.fullStoragePath ?? publishedDelivery.fullStoragePath,
            };
            if (!hasVisibleGenerationDeliveryDisplayAuthority(mergedDelivery)) {
              return null;
            }
            return await signVisibleGenerationDelivery(mergedDelivery);
          }
        }
        if (!hasVisibleGenerationDeliveryDisplayAuthority(projectionDelivery)) {
          return null;
        }
        return await signVisibleGenerationDelivery(projectionDelivery);
      }
    }

    return null;
  } catch {
    return null;
  }
};

export const resolveVisibleGenerationDelivery = async ({
  generationId,
}: {
  generationId: string;
}): Promise<VisibleGenerationDelivery | null> => {
  const resolvedGenerationId = asTrimmedString(generationId);
  if (!resolvedGenerationId) return null;
  const supabase = ensureSupabaseQueryClient();
  const userId = await readSupabaseUserId();
  if (!userId) return null;
  return await resolveVisibleGenerationDeliveryByGenerationId({
    supabase,
    generationId: resolvedGenerationId,
    userId,
  });
};

export const resolveGenerationProjectionLifecycle = async ({
  generationId,
  requestId,
  sourceRef,
  projectId,
}: {
  generationId?: string | null;
  requestId?: string | null;
  sourceRef?: string | null;
  projectId?: string | null;
}): Promise<GenerationProjectionLifecycle | null> => {
  const normalizedGenerationId = asTrimmedString(generationId);
  const normalizedRequestId = asTrimmedString(requestId);
  const normalizedSourceRef = asTrimmedString(sourceRef);
  if (!normalizedGenerationId && !normalizedRequestId && !normalizedSourceRef) return null;

  const supabase = ensureSupabaseQueryClient();
  const userId = await readSupabaseUserId();
  if (!userId) return null;
  const resolvedGenerationId = await resolveCanonicalGenerationIdFromRuntimeIdentity({
    supabase,
    userId,
    projectId,
    generationId: normalizedGenerationId,
    requestId: normalizedRequestId,
    sourceRef: normalizedSourceRef,
  });
  if (!resolvedGenerationId) return null;

  const { data, error } = await supabase
    .from("generation_projection")
    .select(
      "generation_id, task_state, queue_state, error_message_short, error_detail, hidden_in_reference_grid, reference_grid_visible"
    )
    .eq("user_id", userId)
    .eq("generation_id", resolvedGenerationId)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return toProjectionLifecycle(data as GenerationProjectionDeliveryRow | null);
};

export const resolveVisibleGenerationReconcile = async ({
  generationId,
  requestId,
  sourceRef,
  projectId,
}: {
  generationId?: string | null;
  requestId?: string | null;
  sourceRef?: string | null;
  projectId?: string | null;
}): Promise<VisibleGenerationReconcile | null> => {
  const normalizedGenerationId = asTrimmedString(generationId);
  const normalizedRequestId = asTrimmedString(requestId);
  const normalizedSourceRef = asTrimmedString(sourceRef);
  if (!normalizedGenerationId && !normalizedRequestId && !normalizedSourceRef) return null;

  const supabase = ensureSupabaseQueryClient();
  const userId = await readSupabaseUserId();
  if (!userId) return null;
  const resolvedGenerationId = await resolveCanonicalGenerationIdFromRuntimeIdentity({
    supabase,
    userId,
    projectId,
    generationId: normalizedGenerationId,
    requestId: normalizedRequestId,
    sourceRef: normalizedSourceRef,
  });
  if (!resolvedGenerationId) return null;

  const delivery = await resolveVisibleGenerationDeliveryByGenerationId({
    supabase,
    generationId: resolvedGenerationId,
    userId,
  });
  if (!delivery) return null;

  const resultUrls = [delivery.fullUrl ?? delivery.previewUrl].filter((value): value is string =>
    Boolean(value)
  );
  const isVideoDelivery =
    resultUrls.some((value) => isVideoUrl(value)) ||
    Boolean(delivery.fullUrl && isVideoUrl(delivery.fullUrl)) ||
    Boolean(delivery.previewUrl && isVideoUrl(delivery.previewUrl));
  const previewPosterStoragePath =
    delivery.previewPosterStoragePath ??
    (isVideoDelivery
      ? resolveVideoDeliveryPosterStoragePath({
          mode: "video",
          previewStoragePath: delivery.previewStoragePath,
          fullStoragePath: delivery.fullStoragePath,
        })
      : null);
  const previewPosterUrl =
    delivery.previewPosterUrl ?? (await signReferenceGridStoragePath(previewPosterStoragePath));

  if (
    !delivery.previewUrl &&
    resultUrls.length === 0 &&
    !delivery.previewStoragePath &&
    !delivery.fullStoragePath
  ) {
    return null;
  }

  return {
    generationId: resolvedGenerationId,
    previewUrl: delivery.previewUrl,
    previewPosterUrl,
    previewPosterStoragePath,
    companionArtUrl: delivery.companionArtUrl,
    companionArtStoragePath: delivery.companionArtStoragePath,
    companionArtStatus: delivery.companionArtStatus,
    previewStoragePath: delivery.previewStoragePath,
    fullStoragePath: delivery.fullStoragePath,
    resultUrls,
  };
};

const normalizeVisibleGeneratedOutputRuntimeIdentity = (
  value: VisibleGeneratedOutputRuntimeIdentity
): VisibleGeneratedOutputRuntimeIdentity | null => {
  const generationId = asTrimmedString(value.generationId);
  const requestId = asTrimmedString(value.requestId);
  const sourceRef = asTrimmedString(value.sourceRef);
  if (!generationId && !requestId && !sourceRef) return null;
  return {
    generationId,
    requestId,
    sourceRef,
  };
};

const resolveCanonicalGenerationIdsForRuntimeIdentities = async ({
  supabase,
  userId,
  projectId,
  runtimeIdentities,
}: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string | null;
  runtimeIdentities: VisibleGeneratedOutputRuntimeIdentity[];
}): Promise<string[]> => {
  const generationIds = new Set<string>();
  for (const runtimeIdentity of runtimeIdentities) {
    const resolvedGenerationId = await resolveCanonicalGenerationIdFromRuntimeIdentity({
      supabase,
      userId,
      projectId,
      generationId: runtimeIdentity.generationId ?? null,
      requestId: runtimeIdentity.requestId ?? null,
      sourceRef: runtimeIdentity.sourceRef ?? null,
    });
    if (resolvedGenerationId) {
      generationIds.add(resolvedGenerationId);
    }
  }
  return [...generationIds];
};

export const listVisibleGeneratedOutputs = async ({
  limit = 48,
  projectId = null,
  workspaceRuntimeKey = null,
  runtimeIdentities = null,
}: {
  limit?: number;
  projectId?: string | null;
  workspaceRuntimeKey?: string | null;
  runtimeIdentities?: VisibleGeneratedOutputRuntimeIdentity[] | null;
} = {}): Promise<StudioOutput[]> => {
  try {
    const supabase = ensureSupabaseQueryClient();
    const userId = await readSupabaseUserId();
    if (!userId) return [];
    const normalizedProjectId = resolveProjectId(projectId);
    const normalizedWorkspaceRuntimeKey = normalizedProjectId
      ? null
      : resolveWorkspaceRuntimeKey(workspaceRuntimeKey);
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const normalizedRuntimeIdentities = Array.isArray(runtimeIdentities)
      ? runtimeIdentities
          .map((value) => normalizeVisibleGeneratedOutputRuntimeIdentity(value))
          .filter((value): value is VisibleGeneratedOutputRuntimeIdentity => Boolean(value))
      : [];
    const scopedGenerationIds =
      normalizedRuntimeIdentities.length > 0
        ? await resolveCanonicalGenerationIdsForRuntimeIdentities({
            supabase,
            userId,
            projectId: normalizedProjectId,
            runtimeIdentities: normalizedRuntimeIdentities,
          })
        : [];
    const hasScopedGenerationFilter = scopedGenerationIds.length > 0;
    if (normalizedRuntimeIdentities.length > 0 && !hasScopedGenerationFilter) {
      return [];
    }
    if (!normalizedProjectId && !normalizedWorkspaceRuntimeKey && !hasScopedGenerationFilter) {
      return [];
    }

    let data: unknown[] = [];
    if (normalizedProjectId) {
      let projectGenerationQuery = supabase
        .from("project_generation_items")
        .select("generation_id, updated_at")
        .eq("user_id", userId)
        .eq("project_id", normalizedProjectId)
        .order("updated_at", { ascending: false });
      if (hasScopedGenerationFilter) {
        projectGenerationQuery = projectGenerationQuery.in("generation_id", scopedGenerationIds);
      }
      const { data: projectGenerationData, error: projectGenerationError } =
        await projectGenerationQuery.limit(boundedLimit);
      const projectGenerationRows =
        projectGenerationError || !Array.isArray(projectGenerationData)
          ? []
          : projectGenerationData
              .map((row) => {
                const record =
                  row && typeof row === "object" && !Array.isArray(row)
                    ? (row as Record<string, unknown>)
                    : null;
                return {
                  generationId: record ? asTrimmedString(record.generation_id) : null,
                  associatedAtMs: record ? parseIsoTimestampMs(record.updated_at) : null,
                };
              })
              .filter((row): row is { generationId: string; associatedAtMs: number | null } =>
                Boolean(row.generationId)
              );
      const projectGenerationIds = projectGenerationRows.map((row) => row.generationId);
      const projectAssociationRecencyById = new Map(
        projectGenerationRows.map(({ generationId, associatedAtMs }) => [
          generationId,
          associatedAtMs,
        ])
      );

      let directProjectQuery = supabase
        .from("generation_projection")
        .select(GENERATION_PROJECTION_DELIVERY_SELECT_COLUMNS)
        .eq("user_id", userId)
        .eq("project_id", normalizedProjectId)
        .order("started_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .order("updated_at", { ascending: false });
      if (hasScopedGenerationFilter) {
        directProjectQuery = directProjectQuery.in("generation_id", scopedGenerationIds);
      }
      const [{ data: directProjectData, error: directProjectError }, associatedProjectionResult] =
        await Promise.all([
          directProjectQuery.limit(boundedLimit),
          projectGenerationIds.length
            ? supabase
                .from("generation_projection")
                .select(GENERATION_PROJECTION_DELIVERY_SELECT_COLUMNS)
                .eq("user_id", userId)
                .in("generation_id", projectGenerationIds)
                .order("started_at", { ascending: false, nullsFirst: false })
                .order("created_at", { ascending: false })
                .order("updated_at", { ascending: false })
                .limit(boundedLimit)
            : Promise.resolve({ data: [], error: null }),
        ]);
      if (directProjectError && associatedProjectionResult.error) return [];

      const rowsByGenerationId = new Map<string, unknown>();
      [
        ...(Array.isArray(directProjectData) ? directProjectData : []),
        ...(Array.isArray(associatedProjectionResult.data) ? associatedProjectionResult.data : []),
      ].forEach((row) => {
        const generationId =
          row && typeof row === "object" && !Array.isArray(row)
            ? asTrimmedString((row as Record<string, unknown>).generation_id)
            : null;
        if (generationId && !rowsByGenerationId.has(generationId)) {
          rowsByGenerationId.set(generationId, row);
        }
      });
      data = [...rowsByGenerationId.values()]
        .sort((a, b) => {
          const aRecord = a as Record<string, unknown>;
          const bRecord = b as Record<string, unknown>;
          const aGenerationId = asTrimmedString(aRecord.generation_id);
          const bGenerationId = asTrimmedString(bRecord.generation_id);
          const aProjectionRecencyMs = resolveGenerationProjectionRecencyMs(aRecord);
          const bProjectionRecencyMs = resolveGenerationProjectionRecencyMs(bRecord);
          const aAssociationRecencyMs = aGenerationId
            ? (projectAssociationRecencyById.get(aGenerationId) ?? null)
            : null;
          const bAssociationRecencyMs = bGenerationId
            ? (projectAssociationRecencyById.get(bGenerationId) ?? null)
            : null;
          const aRecencyMs = Math.max(
            aProjectionRecencyMs ?? Number.NEGATIVE_INFINITY,
            aAssociationRecencyMs ?? Number.NEGATIVE_INFINITY
          );
          const bRecencyMs = Math.max(
            bProjectionRecencyMs ?? Number.NEGATIVE_INFINITY,
            bAssociationRecencyMs ?? Number.NEGATIVE_INFINITY
          );
          return (
            (Number.isFinite(bRecencyMs) ? bRecencyMs : 0) -
            (Number.isFinite(aRecencyMs) ? aRecencyMs : 0)
          );
        })
        .slice(0, boundedLimit);
    } else {
      let projectionQuery = supabase
        .from("generation_projection")
        .select(GENERATION_PROJECTION_DELIVERY_SELECT_COLUMNS)
        .eq("user_id", userId)
        .order("started_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .order("updated_at", { ascending: false });
      if (normalizedWorkspaceRuntimeKey) {
        projectionQuery = projectionQuery.eq(
          "workspace_runtime_key",
          normalizedWorkspaceRuntimeKey
        );
      }
      if (hasScopedGenerationFilter) {
        projectionQuery = projectionQuery.in("generation_id", scopedGenerationIds);
      }
      const projectionResult = await projectionQuery.limit(boundedLimit);
      if (projectionResult.error || !Array.isArray(projectionResult.data)) return [];
      data = [...projectionResult.data].sort((a, b) => {
        const aRecencyMs =
          a && typeof a === "object" && !Array.isArray(a)
            ? resolveGenerationProjectionRecencyMs(a as Record<string, unknown>)
            : null;
        const bRecencyMs =
          b && typeof b === "object" && !Array.isArray(b)
            ? resolveGenerationProjectionRecencyMs(b as Record<string, unknown>)
            : null;
        const normalizedARecencyMs = aRecencyMs ?? 0;
        const normalizedBRecencyMs = bRecencyMs ?? 0;
        return (
          (Number.isFinite(normalizedBRecencyMs) ? normalizedBRecencyMs : 0) -
          (Number.isFinite(normalizedARecencyMs) ? normalizedARecencyMs : 0)
        );
      });
    }

    const outputs = data
      .map((row) => toHydratedGeneratedOutput(row as GenerationProjectionDeliveryRow))
      .filter((row): row is StudioOutput => Boolean(row));
    const authorityRepairGenerationIds = outputs
      .filter((output) => {
        if (!output.generationId) return false;
        if (output.mode === "video") return true;
        if (output.mode === "image") return true;
        return (
          !asCanonicalStoragePath(output.previewStoragePath) ||
          !asCanonicalStoragePath(output.fullStoragePath)
        );
      })
      .map((output) => output.generationId as string);
    if (!authorityRepairGenerationIds.length) {
      const signedOutputs = await applySignedGeneratedMediaUrls(outputs);
      return signedOutputs.filter(hasGeneratedOutputRestorableDisplayAuthority);
    }
    const mediaByGenerationId = await resolveLatestPublishedGenerationMediaByGenerationIds({
      supabase,
      generationIds: authorityRepairGenerationIds,
      userId,
    });
    const outputsWithPosterStoragePaths =
      mediaByGenerationId.size === 0
        ? outputs
        : applyPublishedGeneratedMediaAuthority(outputs, mediaByGenerationId);
    const outputsWithSignedMediaUrls = await applySignedGeneratedMediaUrls(
      outputsWithPosterStoragePaths
    );
    const outputsWithSignedVideoPosterUrls = await applySignedVideoPosterUrls(
      outputsWithSignedMediaUrls
    );
    return outputsWithSignedVideoPosterUrls.filter(hasGeneratedOutputRestorableDisplayAuthority);
  } catch {
    return [];
  }
};

export const resolveLatestPublishedGenerationDeliveryByGenerationId =
  resolveVisibleGenerationDeliveryByGenerationId;

export const resolveLatestPublishedGenerationDelivery = resolveVisibleGenerationDelivery;
