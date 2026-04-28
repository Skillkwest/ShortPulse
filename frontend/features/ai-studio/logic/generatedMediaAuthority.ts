import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
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
  poster_variant_path?: unknown;
  preview_variant_path?: unknown;
};

type GenerationOutputRow = {
  id?: unknown;
  media_file_id?: unknown;
};

type GenerationPublicationRow = {
  owned_media_file_id?: unknown;
  preview_url?: unknown;
  full_url?: unknown;
  preview_storage_path?: unknown;
  full_storage_path?: unknown;
  created_at?: unknown;
};

type GenerationProjectionDeliveryRow = {
  generation_id?: unknown;
  request_id?: unknown;
  source_ref?: unknown;
  provider?: unknown;
  model_id?: unknown;
  display_prompt?: unknown;
  preview_url?: unknown;
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
  fullUrl: string | null;
  previewStoragePath: string | null;
  fullStoragePath: string | null;
};

export type PublishedGenerationDelivery = VisibleGenerationDelivery;

export type VisibleGenerationReconcile = {
  generationId: string;
  previewUrl: string | null;
  previewStoragePath: string | null;
  fullStoragePath: string | null;
  resultUrls: string[];
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

  if (!previewUrl && !fullUrl && !previewStoragePath && !fullStoragePath) {
    return null;
  }

  return {
    previewUrl,
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
  const taskState = normalizeProjectionTaskState(row.task_state);
  const queueState = normalizeProjectionQueueState(row.queue_state);
  const modelId = asTrimmedString(row.model_id);
  const mode = inferGeneratedOutputMode({
    modelId,
    previewUrl: previewUrl ?? null,
    resultUrls,
  });
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
    previewStoragePath: asCanonicalStoragePath(asTrimmedString(row.preview_storage_path)),
    fullStoragePath: asCanonicalStoragePath(asTrimmedString(row.full_storage_path)),
    mediaSource: "generated",
    hiddenInReferenceGrid: false,
    previewTier: mode === "video" ? "preview_loop" : "full",
    characterContext,
    styleContext,
    generationReplay,
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
  const fallback = await args.runSelect("storage_path, filename");
  return fallback.error ? null : fallback.data;
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
    fileType: asTrimmedString(row?.file_type)?.toLowerCase() === "video" ? "video" : "image",
    posterVariantPath: asTrimmedString(row?.poster_variant_path),
    previewVariantPath: asTrimmedString(row?.preview_variant_path),
  };
};

const runMaybeSingleMediaLibraryQuery = async <TRow extends MediaFileRow>(args: {
  runSelect: (
    columns:
      | "id, preview_storage_path, storage_path, filename, file_type, poster_variant_path, preview_variant_path"
      | "id, storage_path, filename, file_type, poster_variant_path, preview_variant_path"
  ) => Promise<{ data: TRow | null; error: unknown }>;
}): Promise<TRow | null> => {
  const primary = await args.runSelect(
    "id, preview_storage_path, storage_path, filename, file_type, poster_variant_path, preview_variant_path"
  );
  if (!primary.error) return primary.data;
  if (!isPreviewStoragePathSchemaError(primary.error)) return null;
  const fallback = await args.runSelect(
    "id, storage_path, filename, file_type, poster_variant_path, preview_variant_path"
  );
  return fallback.error ? null : fallback.data;
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
  if (error) return null;
  return asTrimmedString((data as Record<string, unknown> | null)?.generation_id);
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

  const { data: generationData, error: generationError } = await supabase
    .from("ai_generations")
    .select("id")
    .eq("user_id", resolvedUserId)
    .eq("request_id", normalizedRequestId)
    .limit(1)
    .maybeSingle();
  if (generationError) return null;

  return await resolveProjectAssociatedGenerationId({
    supabase,
    userId: resolvedUserId,
    projectId: projectId ?? null,
    generationId: asTrimmedString((generationData as Record<string, unknown> | null)?.id),
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
      .select("preview_url, full_url, preview_storage_path, full_storage_path, created_at")
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
      const previewStoragePath = asCanonicalStoragePath(asTrimmedString(row.preview_storage_path));
      const fullStoragePath = asCanonicalStoragePath(asTrimmedString(row.full_storage_path));
      if (previewUrl || fullUrl || previewStoragePath || fullStoragePath) {
        return {
          previewUrl,
          fullUrl,
          previewStoragePath,
          fullStoragePath,
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
      .select(
        "preview_url, result_urls, preview_storage_path, full_storage_path, task_state, hidden_in_reference_grid, reference_grid_visible"
      )
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
        return projectionDelivery;
      }
    }

    return await resolvePublishedGenerationDeliveryByGenerationId({
      supabase,
      generationId,
      userId: resolvedUserId,
    });
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
    const { data: projectGenerationData, error: projectGenerationError } = await supabase
      .from("project_generation_items")
      .select("generation_id")
      .eq("user_id", userId)
      .eq("project_id", normalizedProjectId)
      .eq("generation_id", candidateGenerationId)
      .limit(1)
      .maybeSingle();
    if (projectGenerationError) return null;
    resolvedGenerationId = asTrimmedString(
      (projectGenerationData as Record<string, unknown> | null)?.generation_id
    );
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

    let projectGenerationIds: string[] | null = null;
    if (normalizedProjectId) {
      const { data: projectGenerationData, error: projectGenerationError } = await supabase
        .from("project_generation_items")
        .select("generation_id, updated_at")
        .eq("user_id", userId)
        .eq("project_id", normalizedProjectId)
        .order("updated_at", { ascending: false })
        .limit(boundedLimit);
      if (projectGenerationError || !Array.isArray(projectGenerationData)) return [];
      projectGenerationIds = projectGenerationData
        .map((row) =>
          row && typeof row === "object" && !Array.isArray(row)
            ? asTrimmedString((row as Record<string, unknown>).generation_id)
            : null
        )
        .filter((generationId): generationId is string => Boolean(generationId));
      if (!projectGenerationIds.length) return [];
    }

    let projectionQuery = supabase
      .from("generation_projection")
      .select(
        [
          "generation_id",
          "request_id",
          "source_ref",
          "provider",
          "model_id",
          "display_prompt",
          "preview_url",
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
        ].join(", ")
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(boundedLimit);
    if (projectGenerationIds) {
      projectionQuery = projectionQuery.in("generation_id", projectGenerationIds);
    }
    const { data, error } = await projectionQuery;
    if (error || !Array.isArray(data)) return [];

    return data
      .map((row) => toHydratedGeneratedOutput(row as GenerationProjectionDeliveryRow))
      .filter((row): row is StudioOutput => Boolean(row));
  } catch {
    return [];
  }
};

export const resolveLatestPublishedGenerationDeliveryByGenerationId =
  resolveVisibleGenerationDeliveryByGenerationId;

export const resolveLatestPublishedGenerationDelivery = resolveVisibleGenerationDelivery;
