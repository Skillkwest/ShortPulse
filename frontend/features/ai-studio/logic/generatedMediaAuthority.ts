import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import { getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";
import type { StudioOutput } from "../types";
import { isAudioUrl, isVideoUrl, resolveModelLabel } from "./stateParsers";

type SupabaseClient = ReturnType<typeof ensureSupabaseQueryClient>;

type MediaFileRow = {
  id?: unknown;
  storage_path?: unknown;
  filename?: unknown;
  preview_storage_path?: unknown;
  file_type?: unknown;
  thumb_variant_path?: unknown;
  poster_variant_path?: unknown;
  preview_variant_path?: unknown;
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
  request_id?: unknown;
  source_ref?: unknown;
  provider?: unknown;
  model_id?: unknown;
  display_prompt?: unknown;
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
  character_context?: unknown;
  style_context?: unknown;
  updated_at?: unknown;
};

const GENERATION_PROJECTION_DELIVERY_SELECT_COLUMNS = [
  "generation_id",
  "project_id",
  "request_id",
  "source_ref",
  "provider",
  "model_id",
  "display_prompt",
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
  "character_context",
  "style_context",
  "updated_at",
].join(", ");

export type GeneratedMediaFileRecord = {
  storagePath: string;
  filename: string | null;
};

export type GeneratedMediaLibraryRow = GeneratedMediaFileRecord & {
  mediaFileId: string;
  fileType: "image" | "video";
  posterVariantPath: string | null;
  previewVariantPath: string | null;
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

const resolveProjectId = (value: string | null | undefined): string | null =>
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
  if (!previewStoragePath) return null;
  if (previewStoragePath.includes("/variants/")) return previewStoragePath;
  if (fullStoragePath && previewStoragePath === fullStoragePath) return null;
  return fullStoragePath ? previewStoragePath : null;
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
  const previewStoragePath = asCanonicalStoragePath(asTrimmedString(row.preview_storage_path));
  const fullStoragePath = asCanonicalStoragePath(asTrimmedString(row.full_storage_path));
  const mode = inferGeneratedOutputMode({
    modelId: asTrimmedString(row.model_id),
    previewUrl,
    resultUrls,
  });
  const previewPosterStoragePath = resolveVideoDeliveryPosterStoragePath({
    mode,
    previewStoragePath,
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

const toHydratedGeneratedOutput = (
  row: GenerationProjectionDeliveryRow | null | undefined
): StudioOutput | null => {
  if (!row) return null;
  if (row.hidden_in_reference_grid === true || row.reference_grid_visible === false) return null;

  const generationId = asTrimmedString(row.generation_id);
  if (!generationId) return null;

  const resultUrls = asTrimmedStringArray(row.result_urls);
  const previewUrl = asTrimmedString(row.preview_url) ?? resultUrls[0] ?? undefined;
  const previewStoragePath = asCanonicalStoragePath(asTrimmedString(row.preview_storage_path));
  const fullStoragePath = asCanonicalStoragePath(asTrimmedString(row.full_storage_path));
  const taskState = normalizeProjectionTaskState(row.task_state);
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
    previewStoragePath,
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
    mode,
    aspect: replayAspect ?? "1:1",
    model: resolveModelLabel(modelId ?? undefined),
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

const isPreviewStoragePathSchemaError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const message =
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message.toLowerCase()
      : "";
  return message.includes("preview_storage_path") && message.includes("schema cache");
};

const runMaybeSingleMediaStorageQuery = async <TRow extends MediaFileRow>(args: {
  runSelect: (
    columns: "preview_storage_path, storage_path, filename" | "storage_path, filename"
  ) => Promise<{ data: TRow | null; error: unknown }>;
}): Promise<TRow | null> => {
  const primary = await args.runSelect("preview_storage_path, storage_path, filename");
  if (!primary.error) return primary.data;
  if (!isPreviewStoragePathSchemaError(primary.error)) return null;
  const storageOnly = await args.runSelect("storage_path, filename");
  return storageOnly.error ? null : storageOnly.data;
};

const toGeneratedMediaFileRecord = (
  row: MediaFileRow | null | undefined
): GeneratedMediaFileRecord | null => {
  const storagePath =
    asCanonicalStoragePath(asTrimmedString(row?.preview_storage_path)) ??
    asCanonicalStoragePath(asTrimmedString(row?.storage_path));
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
  return {
    mediaFileId,
    storagePath: baseRecord.storagePath,
    filename: baseRecord.filename,
    fileType: asTrimmedString(row?.file_type)?.toLowerCase().startsWith("video")
      ? "video"
      : "image",
    posterVariantPath: asTrimmedString(row?.poster_variant_path),
    previewVariantPath: asTrimmedString(row?.preview_variant_path),
  };
};

const runMaybeSingleMediaLibraryQuery = async <TRow extends MediaFileRow>(args: {
  runSelect: (
    columns:
      | "id, preview_storage_path, storage_path, filename, file_type, thumb_variant_path, poster_variant_path, preview_variant_path"
      | "id, storage_path, filename, file_type, thumb_variant_path, poster_variant_path, preview_variant_path"
  ) => Promise<{ data: TRow | null; error: unknown }>;
}): Promise<TRow | null> => {
  const primary = await args.runSelect(
    "id, preview_storage_path, storage_path, filename, file_type, thumb_variant_path, poster_variant_path, preview_variant_path"
  );
  if (!primary.error) return primary.data;
  if (!isPreviewStoragePathSchemaError(primary.error)) return null;
  const storageOnly = await args.runSelect(
    "id, storage_path, filename, file_type, thumb_variant_path, poster_variant_path, preview_variant_path"
  );
  return storageOnly.error ? null : storageOnly.data;
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
  if (!projectionError) {
    const generationId = asTrimmedString(
      (projectionData as Record<string, unknown> | null)?.generation_id
    );
    if (generationId) {
      const resolvedGenerationId = await resolveProjectAssociatedGenerationId({
        supabase,
        userId: resolvedUserId,
        projectId: projectId ?? null,
        generationId,
      });
      if (resolvedGenerationId) return resolvedGenerationId;
    }
  }

  return null;
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
  try {
    const normalizedGenerationIds = Array.from(
      new Set(
        generationIds
          .map((value) => asTrimmedString(value))
          .filter((value): value is string => Boolean(value))
      )
    );
    if (!normalizedGenerationIds.length) return new Map();

    const { data: publicationData, error: publicationError } = await supabase
      .from("generation_publications")
      .select("generation_id, owned_media_file_id, created_at")
      .eq("user_id", userId)
      .eq("publication_state", "published")
      .in("generation_id", normalizedGenerationIds)
      .order("created_at", { ascending: false })
      .limit(Math.max(normalizedGenerationIds.length * 3, normalizedGenerationIds.length));

    const mediaIdByGenerationId = new Map<string, string>();
    if (!publicationError && Array.isArray(publicationData)) {
      for (const rawRow of publicationData) {
        const row = rawRow as GenerationPublicationRow;
        const generationId = asTrimmedString(row.generation_id);
        const mediaFileId = asTrimmedString(row.owned_media_file_id);
        if (!generationId || !mediaFileId || mediaIdByGenerationId.has(generationId)) continue;
        mediaIdByGenerationId.set(generationId, mediaFileId);
      }
    }

    const missingGenerationIds = normalizedGenerationIds.filter(
      (generationId) => !mediaIdByGenerationId.has(generationId)
    );
    if (missingGenerationIds.length) {
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
    }

    const mediaFileIds = Array.from(new Set(mediaIdByGenerationId.values()));
    if (!mediaFileIds.length) return new Map();

    const { data: mediaData, error: mediaError } = await supabase
      .from("media_files")
      .select(
        "id, preview_storage_path, storage_path, filename, file_type, thumb_variant_path, poster_variant_path, preview_variant_path"
      )
      .eq("user_id", userId)
      .in("id", mediaFileIds)
      .limit(mediaFileIds.length);
    if (mediaError || !Array.isArray(mediaData)) return new Map();

    const mediaById = new Map<string, GeneratedMediaLibraryRow>();
    for (const rawRow of mediaData) {
      const mediaRow = toGeneratedMediaLibraryRow(rawRow as MediaFileRow);
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
  } catch {
    return new Map();
  }
};

const applyPublishedVideoPosterStoragePaths = (
  outputs: StudioOutput[],
  mediaByGenerationId: Map<string, GeneratedMediaLibraryRow>
): StudioOutput[] =>
  outputs.map((output) => {
    if (output.mode !== "video" || !output.generationId) return output;
    const mediaRow = mediaByGenerationId.get(output.generationId);
    if (!mediaRow || mediaRow.fileType !== "video") return output;
    const posterStoragePath =
      asCanonicalStoragePath(mediaRow.posterVariantPath) ??
      asCanonicalStoragePath(output.previewPosterStoragePath) ??
      asCanonicalStoragePath(output.previewStoragePath);
    if (!posterStoragePath) return output;
    if (
      output.previewPosterStoragePath === posterStoragePath &&
      output.previewStoragePath === posterStoragePath
    ) {
      return output;
    }
    return {
      ...output,
      previewPosterStoragePath: posterStoragePath,
      previewStoragePath: posterStoragePath,
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
    if (asTrimmedString(output.previewPosterUrl)) continue;
    const posterStoragePath =
      asCanonicalStoragePath(output.previewPosterStoragePath) ??
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
        const resolvedPreviewStoragePath =
          mediaPosterStoragePath ?? previewStoragePath ?? fullStoragePath;
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
            return await signVisibleGenerationDelivery({
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
            });
          }
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
  projectId,
}: {
  generationId?: string | null;
  requestId?: string | null;
  projectId?: string | null;
}): Promise<GenerationProjectionLifecycle | null> => {
  const normalizedGenerationId = asTrimmedString(generationId);
  const normalizedRequestId = asTrimmedString(requestId);
  if (!normalizedGenerationId && !normalizedRequestId) return null;

  const supabase = ensureSupabaseQueryClient();
  const userId = await readSupabaseUserId();
  if (!userId) return null;
  const normalizedProjectId = resolveProjectId(projectId);

  const candidateGenerationId =
    normalizedGenerationId ??
    (await resolveGenerationIdForRequestId({
      supabase,
      requestId: normalizedRequestId,
      userId,
      projectId: normalizedProjectId,
    }));
  if (!candidateGenerationId) return null;

  const resolvedGenerationId = await resolveProjectAssociatedGenerationId({
    supabase,
    userId,
    projectId: normalizedProjectId,
    generationId: candidateGenerationId,
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
  projectId,
}: {
  generationId?: string | null;
  requestId?: string | null;
  projectId?: string | null;
}): Promise<VisibleGenerationReconcile | null> => {
  const normalizedGenerationId = asTrimmedString(generationId);
  const normalizedRequestId = asTrimmedString(requestId);
  if (!normalizedGenerationId && !normalizedRequestId) return null;

  const supabase = ensureSupabaseQueryClient();
  const userId = await readSupabaseUserId();
  if (!userId) return null;
  const normalizedProjectId = resolveProjectId(projectId);

  const candidateGenerationId =
    normalizedGenerationId ??
    (await resolveGenerationIdForRequestId({
      supabase,
      requestId: normalizedRequestId,
      userId,
      projectId: normalizedProjectId,
    }));
  if (!candidateGenerationId) return null;

  let resolvedGenerationId: string | null = candidateGenerationId;
  if (normalizedProjectId) {
    resolvedGenerationId = await resolveProjectAssociatedGenerationId({
      supabase,
      userId,
      projectId: normalizedProjectId,
      generationId: candidateGenerationId,
    });
  }
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

export const listVisibleGeneratedOutputs = async ({
  limit = 48,
  projectId = null,
}: {
  limit?: number;
  projectId?: string | null;
} = {}): Promise<StudioOutput[]> => {
  try {
    const supabase = ensureSupabaseQueryClient();
    const userId = await readSupabaseUserId();
    if (!userId) return [];
    const normalizedProjectId = resolveProjectId(projectId);
    const boundedLimit = Math.max(1, Math.min(limit, 100));

    let data: unknown[] = [];
    if (normalizedProjectId) {
      const { data: projectGenerationData, error: projectGenerationError } = await supabase
        .from("project_generation_items")
        .select("generation_id, updated_at")
        .eq("user_id", userId)
        .eq("project_id", normalizedProjectId)
        .order("updated_at", { ascending: false })
        .limit(boundedLimit);
      const projectGenerationIds =
        projectGenerationError || !Array.isArray(projectGenerationData)
          ? []
          : projectGenerationData
              .map((row) =>
                row && typeof row === "object" && !Array.isArray(row)
                  ? asTrimmedString((row as Record<string, unknown>).generation_id)
                  : null
              )
              .filter((generationId): generationId is string => Boolean(generationId));

      const directProjectQuery = supabase
        .from("generation_projection")
        .select(GENERATION_PROJECTION_DELIVERY_SELECT_COLUMNS)
        .eq("user_id", userId)
        .eq("project_id", normalizedProjectId)
        .order("updated_at", { ascending: false })
        .limit(boundedLimit);
      const [{ data: directProjectData, error: directProjectError }, associatedProjectionResult] =
        await Promise.all([
          directProjectQuery,
          projectGenerationIds.length
            ? supabase
                .from("generation_projection")
                .select(GENERATION_PROJECTION_DELIVERY_SELECT_COLUMNS)
                .eq("user_id", userId)
                .in("generation_id", projectGenerationIds)
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
          const aUpdatedAt = Date.parse(
            asTrimmedString((a as Record<string, unknown>).updated_at) ?? ""
          );
          const bUpdatedAt = Date.parse(
            asTrimmedString((b as Record<string, unknown>).updated_at) ?? ""
          );
          return (
            (Number.isFinite(bUpdatedAt) ? bUpdatedAt : 0) -
            (Number.isFinite(aUpdatedAt) ? aUpdatedAt : 0)
          );
        })
        .slice(0, boundedLimit);
    } else {
      const projectionQuery = supabase
        .from("generation_projection")
        .select(GENERATION_PROJECTION_DELIVERY_SELECT_COLUMNS)
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(boundedLimit);
      const projectionResult = await projectionQuery;
      if (projectionResult.error || !Array.isArray(projectionResult.data)) return [];
      data = projectionResult.data;
    }

    const outputs = data
      .map((row) => toHydratedGeneratedOutput(row as GenerationProjectionDeliveryRow))
      .filter((row): row is StudioOutput => Boolean(row));
    const videoGenerationIds = outputs
      .filter((output) => output.mode === "video" && output.generationId)
      .map((output) => output.generationId as string);
    if (!videoGenerationIds.length) return await applySignedGeneratedMediaUrls(outputs);
    const mediaByGenerationId = await resolveLatestPublishedGenerationMediaByGenerationIds({
      supabase,
      generationIds: videoGenerationIds,
      userId,
    });
    const outputsWithPosterStoragePaths =
      mediaByGenerationId.size === 0
        ? outputs
        : applyPublishedVideoPosterStoragePaths(outputs, mediaByGenerationId);
    const outputsWithSignedMediaUrls = await applySignedGeneratedMediaUrls(
      outputsWithPosterStoragePaths
    );
    return await applySignedVideoPosterUrls(outputsWithSignedMediaUrls);
  } catch {
    return [];
  }
};

export const resolveLatestPublishedGenerationDeliveryByGenerationId =
  resolveVisibleGenerationDeliveryByGenerationId;

export const resolveLatestPublishedGenerationDelivery = resolveVisibleGenerationDelivery;
