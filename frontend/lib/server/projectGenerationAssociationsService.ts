/**
 * Project generation association helpers.
 * Owns project-scoped association and snapshot-delivery refresh for generated outputs
 * without changing the global generation inventory/read models.
 */
import { getSupabaseAdmin } from "./api/supabaseAdmin";

const PROJECT_GENERATION_PROJECTION_SELECT_COLUMNS = [
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
  "saved_media_ids",
  "save_state",
  "save_error",
  "preview_storage_path",
  "full_storage_path",
  "task_state",
  "queue_state",
  "error_message",
  "error_message_short",
  "error_detail",
  "generation_replay",
  "character_context",
  "style_context",
  "updated_at",
  "hidden_in_reference_grid",
  "reference_grid_visible",
].join(", ");

const PROJECT_SNAPSHOT_GENERATED_OUTPUT_APPEND_LIMIT = 100;

type SnapshotRecord = Record<string, unknown>;

type ProjectGenerationProjectionRow = {
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
  saved_media_ids?: unknown;
  save_state?: unknown;
  save_error?: unknown;
  preview_storage_path?: unknown;
  full_storage_path?: unknown;
  task_state?: unknown;
  queue_state?: unknown;
  error_message?: unknown;
  error_message_short?: unknown;
  error_detail?: unknown;
  generation_replay?: unknown;
  character_context?: unknown;
  style_context?: unknown;
  updated_at?: unknown;
  hidden_in_reference_grid?: unknown;
  reference_grid_visible?: unknown;
};

type ProjectGenerationPublicationRow = {
  generation_id?: unknown;
  owned_media_file_id?: unknown;
  preview_storage_path?: unknown;
  full_storage_path?: unknown;
  created_at?: unknown;
};

type ProjectGenerationMediaFileRow = {
  id?: unknown;
  storage_path?: unknown;
  preview_storage_path?: unknown;
  file_type?: unknown;
  poster_variant_path?: unknown;
  thumb_variant_path?: unknown;
  preview_variant_path?: unknown;
};

type ProjectGenerationMediaDelivery = {
  previewPosterStoragePath: string | null;
  previewStoragePath: string | null;
  fullStoragePath: string | null;
};

const asRecord = (value: unknown): SnapshotRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as SnapshotRecord) : {};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const asTrimmedStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => Boolean(entry));
};

const asBoolean = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

const isLikelyImagePath = (value: string | null): boolean =>
  Boolean(value && /\.(?:avif|gif|heic|heif|jpe?g|png|webp)(?:$|[?#])/i.test(value));

const isLikelyVideoPath = (value: string | null): boolean =>
  Boolean(value && /\.(?:m4v|mov|mp4|ogv|webm)(?:$|[?#])/i.test(value));

const isPreviewStoragePathSchemaError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const message =
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message.toLowerCase()
      : "";
  return message.includes("preview_storage_path") && message.includes("schema cache");
};

const resolveVideoPosterStoragePath = ({
  previewStoragePath,
  fullStoragePath,
}: {
  previewStoragePath: string | null;
  fullStoragePath: string | null;
}): string | null => {
  if (!previewStoragePath) return null;
  if (previewStoragePath.includes("/poster_") || previewStoragePath.includes("/thumb_")) {
    return previewStoragePath;
  }
  if (fullStoragePath && previewStoragePath === fullStoragePath) return null;
  return isLikelyImagePath(previewStoragePath) ? previewStoragePath : null;
};

const collectSnapshotGenerationIds = (snapshot: SnapshotRecord): string[] => {
  const outputsRecord = asRecord(snapshot.outputs);
  const rows = [
    ...(Array.isArray(outputsRecord.active) ? outputsRecord.active : []),
    ...(Array.isArray(outputsRecord.archived) ? outputsRecord.archived : []),
  ];
  const generationIds = new Set<string>();

  rows.forEach((row) => {
    const generationId = asTrimmedString(asRecord(row).generationId);
    if (generationId) {
      generationIds.add(generationId);
    }
  });

  return [...generationIds];
};

const resolveOwnedGenerationIds = async ({
  userId,
  generationIds,
}: {
  userId: string;
  generationIds: string[];
}): Promise<string[]> => {
  if (generationIds.length === 0) return [];
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("ai_generations")
    .select("id")
    .eq("user_id", userId)
    .in("id", generationIds);

  if (error) {
    throw new Error(error.message || "Failed to resolve owned ai_generations ids");
  }

  return Array.isArray(data)
    ? data.map((row) => asTrimmedString(asRecord(row).id)).filter((id): id is string => Boolean(id))
    : [];
};

const readProjectAssociatedGenerationIds = async ({
  userId,
  projectId,
  generationIds,
}: {
  userId: string;
  projectId: string;
  generationIds: string[];
}): Promise<Set<string>> => {
  if (generationIds.length === 0) return new Set<string>();
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("project_generation_items")
    .select("generation_id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .in("generation_id", generationIds);

  if (error) {
    throw new Error(error.message || "Failed to resolve project-associated generations");
  }

  const associatedGenerationIds = new Set(
    (Array.isArray(data) ? data : [])
      .map((row) => asTrimmedString(asRecord(row).generation_id))
      .filter((generationId): generationId is string => Boolean(generationId))
  );
  const { data: projectionData, error: projectionError } = await supabaseAdmin
    .from("generation_projection")
    .select("generation_id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .in("generation_id", generationIds);

  if (projectionError) {
    throw new Error(projectionError.message || "Failed to resolve project-scoped projections");
  }

  (Array.isArray(projectionData) ? projectionData : [])
    .map((row) => asTrimmedString(asRecord(row).generation_id))
    .filter((generationId): generationId is string => Boolean(generationId))
    .forEach((generationId) => associatedGenerationIds.add(generationId));

  return associatedGenerationIds;
};

const readRecentProjectAssociatedGenerationIds = async ({
  userId,
  projectId,
  limit = PROJECT_SNAPSHOT_GENERATED_OUTPUT_APPEND_LIMIT,
}: {
  userId: string;
  projectId: string;
  limit?: number;
}): Promise<string[]> => {
  const supabaseAdmin = getSupabaseAdmin();
  const boundedLimit = Math.max(1, Math.min(limit, PROJECT_SNAPSHOT_GENERATED_OUTPUT_APPEND_LIMIT));
  const { data, error } = await supabaseAdmin
    .from("project_generation_items")
    .select("generation_id, updated_at")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(boundedLimit);

  if (error) {
    throw new Error(error.message || "Failed to load project-associated generation ids");
  }

  const { data: projectionData, error: projectionError } = await supabaseAdmin
    .from("generation_projection")
    .select("generation_id, updated_at")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false })
    .limit(boundedLimit);

  if (projectionError) {
    throw new Error(projectionError.message || "Failed to load project-scoped projection ids");
  }

  const generationIdsByUpdatedAt = new Map<string, string | null>();
  (Array.isArray(data) ? data : [])
    .map((row) => {
      const record = asRecord(row);
      return {
        generationId: asTrimmedString(record.generation_id),
        updatedAt: asTrimmedString(record.updated_at),
      };
    })
    .forEach(({ generationId, updatedAt }) => {
      if (!generationId) return;
      generationIdsByUpdatedAt.set(generationId, updatedAt);
    });

  (Array.isArray(projectionData) ? projectionData : [])
    .map((row) => {
      const record = asRecord(row);
      return {
        generationId: asTrimmedString(record.generation_id),
        updatedAt: asTrimmedString(record.updated_at),
      };
    })
    .forEach(({ generationId, updatedAt }) => {
      if (!generationId) return;
      generationIdsByUpdatedAt.set(
        generationId,
        updatedAt ?? generationIdsByUpdatedAt.get(generationId) ?? null
      );
    });

  return [...generationIdsByUpdatedAt.entries()]
    .sort(([, aUpdatedAt], [, bUpdatedAt]) => {
      const aMs = Date.parse(aUpdatedAt ?? "");
      const bMs = Date.parse(bUpdatedAt ?? "");
      return (Number.isFinite(bMs) ? bMs : 0) - (Number.isFinite(aMs) ? aMs : 0);
    })
    .slice(0, boundedLimit)
    .map(([generationId]) => generationId);
};

const normalizeProjectionTaskState = (value: unknown): string | null => {
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
      return null;
  }
};

const normalizeProjectionQueueState = (value: unknown): string | null => {
  const normalized = asTrimmedString(value)?.toLowerCase();
  switch (normalized) {
    case "queued":
      return "queued";
    case "dispatching":
      return "dispatching";
    case "dispatched":
      return "dispatched";
    default:
      return null;
  }
};

const normalizeProjectionSaveState = (
  value: unknown
): "idle" | "saving" | "saved" | "failed" | "blocked_storage" | null => {
  const normalized = asTrimmedString(value)?.toLowerCase();
  switch (normalized) {
    case "idle":
      return "idle";
    case "saving":
      return "saving";
    case "saved":
      return "saved";
    case "failed":
      return "failed";
    case "blocked_storage":
      return "blocked_storage";
    default:
      return null;
  }
};

const resolveRestoredOutputSaveState = ({
  projection,
  row,
}: {
  projection: ProjectGenerationProjectionRow;
  row: SnapshotRecord;
}): "idle" | "saving" | "saved" | "failed" | "blocked_storage" => {
  const savedMediaIds = asTrimmedStringArray(projection.saved_media_ids);
  if (savedMediaIds.length > 0) return "saved";
  return (
    normalizeProjectionSaveState(projection.save_state) ??
    (row.saveState === "saving" ||
    row.saveState === "saved" ||
    row.saveState === "failed" ||
    row.saveState === "blocked_storage"
      ? row.saveState
      : "idle")
  );
};

const buildProjectionByGenerationId = async ({
  userId,
  generationIds,
}: {
  userId: string;
  generationIds: string[];
}): Promise<Map<string, ProjectGenerationProjectionRow>> => {
  if (generationIds.length === 0) return new Map();
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("generation_projection")
    .select(PROJECT_GENERATION_PROJECTION_SELECT_COLUMNS)
    .eq("user_id", userId)
    .in("generation_id", generationIds);

  if (error) {
    throw new Error(error.message || "Failed to load generation projection rows");
  }

  return new Map(
    (Array.isArray(data) ? data : [])
      .map((row) => {
        const generationId = asTrimmedString(asRecord(row).generation_id);
        if (!generationId) return null;
        return [generationId, row as ProjectGenerationProjectionRow] as const;
      })
      .filter((entry): entry is readonly [string, ProjectGenerationProjectionRow] => Boolean(entry))
  );
};

const readPublishedGenerationRowsByGenerationId = async ({
  userId,
  generationIds,
}: {
  userId: string;
  generationIds: string[];
}): Promise<Map<string, ProjectGenerationPublicationRow>> => {
  if (!generationIds.length) return new Map();
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("generation_publications")
    .select(
      "generation_id, owned_media_file_id, preview_storage_path, full_storage_path, created_at"
    )
    .eq("user_id", userId)
    .in("generation_id", generationIds)
    .eq("publication_state", "published")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load project generation publication rows");
  }

  const byGenerationId = new Map<string, ProjectGenerationPublicationRow>();
  (Array.isArray(data) ? data : []).forEach((rawRow) => {
    const row = rawRow as ProjectGenerationPublicationRow;
    const generationId = asTrimmedString(row.generation_id);
    if (!generationId || byGenerationId.has(generationId)) return;
    byGenerationId.set(generationId, row);
  });
  return byGenerationId;
};

const readMediaFileRowsById = async ({
  userId,
  mediaFileIds,
}: {
  userId: string;
  mediaFileIds: string[];
}): Promise<Map<string, ProjectGenerationMediaFileRow>> => {
  const normalizedMediaFileIds = Array.from(new Set(mediaFileIds.map(asTrimmedString))).filter(
    (id): id is string => Boolean(id)
  );
  if (!normalizedMediaFileIds.length) return new Map();

  const supabaseAdmin = getSupabaseAdmin();
  const runSelect = async (
    fields:
      | "id, storage_path, preview_storage_path, file_type, poster_variant_path, thumb_variant_path, preview_variant_path"
      | "id, storage_path, file_type, poster_variant_path, thumb_variant_path, preview_variant_path"
  ) =>
    await supabaseAdmin
      .from("media_files")
      .select(fields)
      .eq("user_id", userId)
      .in("id", normalizedMediaFileIds);

  let { data, error } = await runSelect(
    "id, storage_path, preview_storage_path, file_type, poster_variant_path, thumb_variant_path, preview_variant_path"
  );
  if (error && isPreviewStoragePathSchemaError(error)) {
    ({ data, error } = await runSelect(
      "id, storage_path, file_type, poster_variant_path, thumb_variant_path, preview_variant_path"
    ));
  }

  if (error) {
    throw new Error(error.message || "Failed to load project generation media rows");
  }

  return new Map(
    (Array.isArray(data) ? data : [])
      .map((rawRow) => {
        const row = rawRow as ProjectGenerationMediaFileRow;
        const mediaFileId = asTrimmedString(row.id);
        if (!mediaFileId) return null;
        return [mediaFileId, row] as const;
      })
      .filter((entry): entry is readonly [string, ProjectGenerationMediaFileRow] => Boolean(entry))
  );
};

const resolveDeliveryFromMediaRows = ({
  mediaRow,
  publicationRow,
}: {
  mediaRow: ProjectGenerationMediaFileRow | null;
  publicationRow: ProjectGenerationPublicationRow | null;
}): ProjectGenerationMediaDelivery | null => {
  const fileType = asTrimmedString(mediaRow?.file_type)?.toLowerCase() ?? "";
  const mediaStoragePath = asTrimmedString(mediaRow?.storage_path);
  const mediaPreviewStoragePath = asTrimmedString(mediaRow?.preview_storage_path);
  const mediaPreviewVariantPath = asTrimmedString(mediaRow?.preview_variant_path);
  const publicationPreviewStoragePath = asTrimmedString(publicationRow?.preview_storage_path);
  const publicationFullStoragePath = asTrimmedString(publicationRow?.full_storage_path);
  const fullStoragePath = publicationFullStoragePath ?? mediaStoragePath ?? null;
  const isVideo =
    fileType.startsWith("video") ||
    isLikelyVideoPath(fullStoragePath) ||
    isLikelyVideoPath(mediaStoragePath);
  if (!isVideo) return null;

  const previewPosterStoragePath =
    asTrimmedString(mediaRow?.poster_variant_path) ??
    asTrimmedString(mediaRow?.thumb_variant_path) ??
    resolveVideoPosterStoragePath({
      previewStoragePath: publicationPreviewStoragePath,
      fullStoragePath,
    }) ??
    resolveVideoPosterStoragePath({
      previewStoragePath: mediaPreviewStoragePath,
      fullStoragePath,
    }) ??
    resolveVideoPosterStoragePath({
      previewStoragePath: mediaPreviewVariantPath,
      fullStoragePath,
    });
  const previewStoragePath =
    publicationPreviewStoragePath ??
    mediaPreviewStoragePath ??
    mediaPreviewVariantPath ??
    fullStoragePath;
  if (!previewStoragePath && !fullStoragePath) return null;

  return {
    previewPosterStoragePath,
    previewStoragePath,
    fullStoragePath,
  };
};

const buildProjectGenerationMediaDeliveryByGenerationId = async ({
  userId,
  projectionByGenerationId,
}: {
  userId: string;
  projectionByGenerationId: Map<string, ProjectGenerationProjectionRow>;
}): Promise<Map<string, ProjectGenerationMediaDelivery>> => {
  const videoProjectionEntries = [...projectionByGenerationId.entries()].filter(
    ([, projection]) => resolveSnapshotOutputMode(projection) === "video"
  );
  if (!videoProjectionEntries.length) return new Map();

  const generationIds = videoProjectionEntries.map(([generationId]) => generationId);
  const publicationByGenerationId = await readPublishedGenerationRowsByGenerationId({
    userId,
    generationIds,
  });
  const mediaFileIds = new Set<string>();
  videoProjectionEntries.forEach(([, projection]) => {
    asTrimmedStringArray(projection.saved_media_ids).forEach((id) => mediaFileIds.add(id));
  });
  publicationByGenerationId.forEach((publication) => {
    const mediaFileId = asTrimmedString(publication.owned_media_file_id);
    if (mediaFileId) mediaFileIds.add(mediaFileId);
  });
  const mediaById = await readMediaFileRowsById({
    userId,
    mediaFileIds: [...mediaFileIds],
  });

  const deliveryByGenerationId = new Map<string, ProjectGenerationMediaDelivery>();
  videoProjectionEntries.forEach(([generationId, projection]) => {
    const publicationRow = publicationByGenerationId.get(generationId) ?? null;
    const publicationMediaId = asTrimmedString(publicationRow?.owned_media_file_id);
    const savedMediaIds = asTrimmedStringArray(projection.saved_media_ids);
    const mediaRow =
      (publicationMediaId ? mediaById.get(publicationMediaId) : null) ??
      savedMediaIds.map((mediaId) => mediaById.get(mediaId)).find(Boolean) ??
      null;
    const delivery = resolveDeliveryFromMediaRows({
      mediaRow,
      publicationRow,
    });
    if (delivery) {
      deliveryByGenerationId.set(generationId, delivery);
    }
  });

  return deliveryByGenerationId;
};

const verifyOwnedProjectForUser = async ({
  userId,
  projectId,
}: {
  userId: string;
  projectId: string;
}): Promise<boolean> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: projectRow, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (projectError) {
    throw new Error(projectError.message || "Failed to verify owned project before association");
  }

  return Boolean(projectRow);
};

const resolveOwnedMediaFileIdsForUser = async ({
  userId,
  mediaFileIds,
}: {
  userId: string;
  mediaFileIds: string[];
}): Promise<string[]> => {
  const normalizedMediaFileIds = Array.from(
    new Set(
      mediaFileIds
        .map((value) => asTrimmedString(value))
        .filter((value): value is string => Boolean(value))
    )
  );
  if (!normalizedMediaFileIds.length) return [];

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("media_files")
    .select("id")
    .eq("user_id", userId)
    .in("id", normalizedMediaFileIds);

  if (error) {
    throw new Error(error.message || "Failed to verify owned media files before association");
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => asTrimmedString(asRecord(row).id))
    .filter((value): value is string => Boolean(value));
};

/**
 * Associates owned media files with one owned project.
 * This is used by project routes that reuse durable media ids and need
 * immediate project membership without waiting for workspace snapshot backfill.
 */
export const associateMediaFilesWithProjectForUser = async ({
  userId,
  projectId,
  mediaFileIds,
}: {
  userId: string;
  projectId: string;
  mediaFileIds: string[];
}): Promise<boolean> => {
  const normalizedProjectId = asTrimmedString(projectId);
  if (!normalizedProjectId) return false;

  const projectOwned = await verifyOwnedProjectForUser({
    userId,
    projectId: normalizedProjectId,
  });
  if (!projectOwned) return false;
  const ownedMediaFileIds = await resolveOwnedMediaFileIdsForUser({
    userId,
    mediaFileIds,
  });
  if (!ownedMediaFileIds.length) return false;

  const nowIso = new Date().toISOString();
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("project_media_items").upsert(
    ownedMediaFileIds.map((mediaFileId) => ({
      project_id: normalizedProjectId,
      media_file_id: mediaFileId,
      user_id: userId,
      updated_at: nowIso,
    })),
    {
      onConflict: "project_id,media_file_id",
    }
  );

  if (error) {
    throw new Error(error.message || "Failed to associate media files with project");
  }

  return true;
};

/**
 * Associates one owned generation with one owned project.
 * This is used by direct-complete provider lanes that must eagerly persist
 * project ownership at generation success time rather than waiting for later
 * workspace snapshot backfill.
 */
export const associateGenerationWithProjectForUser = async ({
  userId,
  projectId,
  generationId,
}: {
  userId: string;
  projectId: string;
  generationId: string;
}): Promise<boolean> => {
  const normalizedProjectId = asTrimmedString(projectId);
  const normalizedGenerationId = asTrimmedString(generationId);
  if (!normalizedProjectId || !normalizedGenerationId) return false;

  const projectOwned = await verifyOwnedProjectForUser({
    userId,
    projectId: normalizedProjectId,
  });
  if (!projectOwned) return false;
  const ownedGenerationIds = await resolveOwnedGenerationIds({
    userId,
    generationIds: [normalizedGenerationId],
  });
  if (!ownedGenerationIds.includes(normalizedGenerationId)) return false;

  const nowIso = new Date().toISOString();
  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.from("project_generation_items").upsert(
    {
      project_id: normalizedProjectId,
      generation_id: normalizedGenerationId,
      user_id: userId,
      updated_at: nowIso,
    },
    {
      onConflict: "project_id,generation_id",
    }
  );

  if (error) {
    throw new Error(error.message || "Failed to associate generation with project");
  }

  return true;
};

const patchSnapshotOutputRow = ({
  row,
  projection,
  mediaDelivery,
}: {
  row: SnapshotRecord;
  projection: ProjectGenerationProjectionRow;
  mediaDelivery?: ProjectGenerationMediaDelivery | null;
}): SnapshotRecord => {
  const nextResultUrls = asTrimmedStringArray(projection.result_urls);
  const nextPreviewUrl = asTrimmedString(projection.preview_url) ?? nextResultUrls[0] ?? null;
  const nextMode = asTrimmedString(row.mode) ?? resolveSnapshotOutputMode(projection);
  const projectedPreviewStoragePath = asTrimmedString(projection.preview_storage_path);
  const nextPreviewStoragePath =
    mediaDelivery?.previewStoragePath ?? projectedPreviewStoragePath ?? null;
  const nextFullStoragePath =
    mediaDelivery?.fullStoragePath ??
    asTrimmedString(projection.full_storage_path) ??
    nextPreviewStoragePath ??
    null;
  const nextPreviewPosterStoragePath =
    nextMode === "video"
      ? (mediaDelivery?.previewPosterStoragePath ??
        asTrimmedString(row.previewPosterStoragePath) ??
        resolveVideoPosterStoragePath({
          previewStoragePath: nextPreviewStoragePath,
          fullStoragePath: nextFullStoragePath,
        }))
      : null;
  const nextPreviewPosterUrl =
    nextMode === "video" && nextPreviewUrl && isLikelyImagePath(nextPreviewUrl)
      ? nextPreviewUrl
      : asTrimmedString(row.previewPosterUrl);
  const nextTaskState = normalizeProjectionTaskState(projection.task_state);
  const nextQueueState = normalizeProjectionQueueState(projection.queue_state);
  const nextCompanionArtStatus = asTrimmedString(projection.companion_art_status);
  const nextCompanionArtStoragePath = asTrimmedString(projection.companion_art_storage_path);
  const nextErrorMessage = asTrimmedString(projection.error_message);
  const nextErrorMessageShort = asTrimmedString(projection.error_message_short);
  const nextErrorDetail = asTrimmedString(projection.error_detail);
  const nextPrompt = asTrimmedString(projection.display_prompt);
  const nextProvider = asTrimmedString(projection.provider);
  const nextModelId = asTrimmedString(projection.model_id);
  const nextSourceRef = asTrimmedString(projection.source_ref);
  const nextTaskId = asTrimmedString(projection.request_id);
  const nextGenerationReplay = asRecord(projection.generation_replay);
  const nextCharacterContext = asRecord(projection.character_context);
  const nextStyleContext = asRecord(projection.style_context);
  const nextSavedMediaIds = asTrimmedStringArray(projection.saved_media_ids);
  const nextSaveState = resolveRestoredOutputSaveState({ projection, row });
  const nextStatus = nextSaveState === "saved" ? "saved" : (row.status ?? "ready");

  return {
    ...row,
    prompt: nextPrompt ?? row.prompt ?? "",
    provider: nextProvider ?? row.provider,
    modelId: nextModelId ?? row.modelId,
    sourceRef: nextSourceRef ?? row.sourceRef,
    taskId: nextTaskId ?? row.taskId,
    taskState: nextTaskState ?? row.taskState,
    queueState: nextQueueState ?? row.queueState,
    errorMessage: nextErrorMessage ?? row.errorMessage ?? null,
    errorMessageShort: nextErrorMessageShort ?? row.errorMessageShort ?? null,
    errorDetail: nextErrorDetail ?? row.errorDetail ?? null,
    savedMediaIds: nextSavedMediaIds.length > 0 ? nextSavedMediaIds : (row.savedMediaIds ?? []),
    saveState: nextSaveState,
    status: nextStatus,
    resultUrls: nextResultUrls.length > 0 ? nextResultUrls : (row.resultUrls ?? []),
    previewUrl: nextPreviewUrl ?? row.previewUrl ?? null,
    previewPosterUrl: nextMode === "video" ? (nextPreviewPosterUrl ?? null) : null,
    previewPosterStoragePath: nextMode === "video" ? (nextPreviewPosterStoragePath ?? null) : null,
    companionArtUrl: row.companionArtUrl ?? null,
    companionArtStoragePath: nextCompanionArtStoragePath ?? row.companionArtStoragePath ?? null,
    companionArtStatus: nextCompanionArtStatus ?? row.companionArtStatus ?? null,
    previewStoragePath: nextPreviewStoragePath ?? row.previewStoragePath ?? null,
    fullStoragePath: nextFullStoragePath ?? row.fullStoragePath ?? null,
    generationReplay:
      Object.keys(nextGenerationReplay).length > 0 ? nextGenerationReplay : row.generationReplay,
    characterContext:
      Object.keys(nextCharacterContext).length > 0 ? nextCharacterContext : row.characterContext,
    styleContext: Object.keys(nextStyleContext).length > 0 ? nextStyleContext : row.styleContext,
  };
};

const resolveSnapshotOutputMode = (projection: ProjectGenerationProjectionRow): string => {
  const modelId = asTrimmedString(projection.model_id)?.toLowerCase() ?? "";
  const provider = asTrimmedString(projection.provider)?.toLowerCase() ?? "";
  if (provider.includes("eleven") || modelId.includes("eleven")) return "audio";
  if (
    modelId.includes("video") ||
    modelId.includes("kling") ||
    modelId.includes("veo") ||
    modelId.includes("seedance")
  ) {
    return "video";
  }
  return "image";
};

const shouldAppendProjectionToSnapshot = (projection: ProjectGenerationProjectionRow): boolean => {
  if (asBoolean(projection.hidden_in_reference_grid) === true) return false;
  if (asBoolean(projection.reference_grid_visible) === false) return false;
  return Boolean(asTrimmedString(projection.generation_id));
};

const createSnapshotOutputRowFromProjection = ({
  projection,
  mediaDelivery,
}: {
  projection: ProjectGenerationProjectionRow;
  mediaDelivery?: ProjectGenerationMediaDelivery | null;
}): SnapshotRecord | null => {
  const generationId = asTrimmedString(projection.generation_id);
  if (!generationId || !shouldAppendProjectionToSnapshot(projection)) return null;
  const mode = resolveSnapshotOutputMode(projection);
  const requestId = asTrimmedString(projection.request_id);
  const modelId = asTrimmedString(projection.model_id);
  const restoredSavedMediaIds = asTrimmedStringArray(projection.saved_media_ids);
  const restoredSaveState =
    restoredSavedMediaIds.length > 0
      ? "saved"
      : (normalizeProjectionSaveState(projection.save_state) ?? "idle");
  const restoredStatus = restoredSaveState === "saved" ? "saved" : "ready";

  return patchSnapshotOutputRow({
    row: {
      id: `generated:${generationId}`,
      mode,
      model: modelId ?? "Generated media",
      modelId: modelId ?? undefined,
      prompt: asTrimmedString(projection.display_prompt) ?? "",
      status: restoredStatus,
      timestamp: "Just now",
      generationId,
      taskId: requestId ?? undefined,
      generationTraceId: requestId ?? undefined,
      sourceRef: asTrimmedString(projection.source_ref) ?? undefined,
      provider: asTrimmedString(projection.provider) ?? undefined,
      mediaSource: "generated",
      previewTier: mode === "video" ? "preview_loop" : "full",
      archivedAt: null,
      archiveReason: null,
      saveState: restoredSaveState,
      saveError: asTrimmedString(projection.save_error),
      savedMediaIds: restoredSavedMediaIds,
      hiddenInReferenceGrid: asBoolean(projection.hidden_in_reference_grid) ?? false,
    },
    projection,
    mediaDelivery,
  });
};

const areSnapshotRowsSameOrder = (left: SnapshotRecord[], right: SnapshotRecord[]): boolean =>
  left.length === right.length && left.every((row, index) => row === right[index]);

const projectionUpdatedAtMs = (
  projection: ProjectGenerationProjectionRow | undefined
): number | null => {
  const updatedAt = asTrimmedString(projection?.updated_at);
  const updatedAtMs = Date.parse(updatedAt ?? "");
  return Number.isFinite(updatedAtMs) ? updatedAtMs : null;
};

const orderActiveSnapshotRowsByProjectGenerationRecency = ({
  rows,
  recentAssociatedGenerationIds,
  projectionByGenerationId,
}: {
  rows: SnapshotRecord[];
  recentAssociatedGenerationIds: string[];
  projectionByGenerationId: Map<string, ProjectGenerationProjectionRow>;
}): SnapshotRecord[] => {
  if (rows.length <= 1) return rows;
  const generationRankById = new Map(
    recentAssociatedGenerationIds.map((generationId, index) => [generationId, index])
  );
  const rankedRows: Array<{
    row: SnapshotRecord;
    index: number;
    rank: number | null;
    updatedAtMs: number | null;
  }> = [];
  const unrankedRows: SnapshotRecord[] = [];

  rows.forEach((row, index) => {
    const generationId = asTrimmedString(row.generationId);
    if (!generationId) {
      unrankedRows.push(row);
      return;
    }
    const rank = generationRankById.get(generationId) ?? null;
    const updatedAtMs = projectionUpdatedAtMs(projectionByGenerationId.get(generationId));
    if (updatedAtMs !== null || rank !== null) {
      rankedRows.push({ row, index, rank, updatedAtMs });
      return;
    }
    unrankedRows.push(row);
  });

  if (rankedRows.length <= 1) return rows;
  return [
    ...rankedRows
      .sort((left, right) => {
        const leftUpdatedAtMs = left.updatedAtMs ?? Number.NEGATIVE_INFINITY;
        const rightUpdatedAtMs = right.updatedAtMs ?? Number.NEGATIVE_INFINITY;
        return (
          rightUpdatedAtMs - leftUpdatedAtMs ||
          (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER) ||
          left.index - right.index
        );
      })
      .map(({ row }) => row),
    ...unrankedRows,
  ];
};

/**
 * Associates the generated outputs referenced by a project workspace snapshot with that project.
 */
export const backfillProjectGenerationAssociationsForSnapshot = async ({
  userId,
  projectId,
  snapshot,
}: {
  userId: string;
  projectId: string;
  snapshot: SnapshotRecord;
}): Promise<void> => {
  const ownedGenerationIds = await resolveOwnedGenerationIds({
    userId,
    generationIds: collectSnapshotGenerationIds(snapshot),
  });
  if (ownedGenerationIds.length === 0) return;

  const supabaseAdmin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin.from("project_generation_items").upsert(
    ownedGenerationIds.map((generationId) => ({
      project_id: projectId,
      generation_id: generationId,
      user_id: userId,
      updated_at: nowIso,
    })),
    {
      onConflict: "project_id,generation_id",
    }
  );

  if (error) {
    throw new Error(error.message || "Failed to associate project generations");
  }
};

/**
 * Refreshes snapshot outputs from project-associated generation projection rows only.
 */
export const hydrateProjectSnapshotGeneratedOutputs = async ({
  userId,
  projectId,
  snapshot,
}: {
  userId: string;
  projectId: string;
  snapshot: SnapshotRecord;
}): Promise<SnapshotRecord> => {
  const outputsRecord = asRecord(snapshot.outputs);
  const snapshotGenerationIds = collectSnapshotGenerationIds(snapshot);
  const [associatedSnapshotGenerationIds, recentAssociatedGenerationIds] = await Promise.all([
    snapshotGenerationIds.length > 0
      ? readProjectAssociatedGenerationIds({
          userId,
          projectId,
          generationIds: snapshotGenerationIds,
        })
      : Promise.resolve(new Set<string>()),
    readRecentProjectAssociatedGenerationIds({
      userId,
      projectId,
    }),
  ]);

  let changed = false;
  const projectionGenerationIds = [
    ...new Set([...associatedSnapshotGenerationIds, ...recentAssociatedGenerationIds]),
  ];
  const projectionByGenerationId =
    projectionGenerationIds.length > 0
      ? await buildProjectionByGenerationId({
          userId,
          generationIds: projectionGenerationIds,
        })
      : new Map<string, ProjectGenerationProjectionRow>();
  const mediaDeliveryByGenerationId =
    projectionByGenerationId.size > 0
      ? await buildProjectGenerationMediaDeliveryByGenerationId({
          userId,
          projectionByGenerationId,
        })
      : new Map<string, ProjectGenerationMediaDelivery>();
  const patchRows = (value: unknown): unknown => {
    if (!Array.isArray(value)) return value;
    return value
      .map((row) => {
        const normalizedRow = asRecord(row);
        const generationId = asTrimmedString(normalizedRow.generationId);
        if (generationId && !associatedSnapshotGenerationIds.has(generationId)) {
          changed = true;
          return null;
        }
        if (!generationId) {
          return row;
        }
        const projection = projectionByGenerationId.get(generationId);
        if (!projection) {
          changed = true;
          return {
            ...normalizedRow,
            resultUrls: [],
            previewUrl: null,
            previewPosterUrl: null,
            previewPosterStoragePath: null,
            companionArtUrl: null,
            companionArtStoragePath: null,
            companionArtStatus: null,
            previewStoragePath: null,
            fullStoragePath: null,
          };
        }
        changed = true;
        return patchSnapshotOutputRow({
          row: normalizedRow,
          projection,
          mediaDelivery: mediaDeliveryByGenerationId.get(generationId) ?? null,
        });
      })
      .filter((row): row is SnapshotRecord => Boolean(row));
  };

  const activeRows = patchRows(outputsRecord.active);
  const archivedRows = patchRows(outputsRecord.archived);
  const existingGenerationIds = new Set(
    [
      ...(Array.isArray(activeRows) ? activeRows : []),
      ...(Array.isArray(archivedRows) ? archivedRows : []),
    ]
      .map((row) => asTrimmedString(asRecord(row).generationId))
      .filter((generationId): generationId is string => Boolean(generationId))
  );
  const appendedActiveRows = recentAssociatedGenerationIds
    .filter((generationId) => !existingGenerationIds.has(generationId))
    .map((generationId) => {
      const projection = projectionByGenerationId.get(generationId);
      return projection
        ? createSnapshotOutputRowFromProjection({
            projection,
            mediaDelivery: mediaDeliveryByGenerationId.get(generationId) ?? null,
          })
        : null;
    })
    .filter((row): row is SnapshotRecord => Boolean(row));

  if (appendedActiveRows.length > 0) {
    changed = true;
  }
  const unorderedActiveRows = [
    ...appendedActiveRows,
    ...(Array.isArray(activeRows) ? activeRows : []),
  ];
  const orderedActiveRows = orderActiveSnapshotRowsByProjectGenerationRecency({
    rows: unorderedActiveRows,
    recentAssociatedGenerationIds,
    projectionByGenerationId,
  });
  if (!areSnapshotRowsSameOrder(unorderedActiveRows, orderedActiveRows)) {
    changed = true;
  }

  const nextOutputs = {
    ...outputsRecord,
    active: orderedActiveRows,
    archived: Array.isArray(archivedRows) ? archivedRows : [],
  };

  return changed
    ? {
        ...snapshot,
        outputs: nextOutputs,
      }
    : snapshot;
};
