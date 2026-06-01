/**
 * Project generation association helpers.
 * Owns project-scoped association and snapshot-delivery refresh for generated outputs
 * without changing the global generation inventory/read models.
 */
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { filterTrustedMediaDirectPreviewUrls } from "../mediaPreviewTrustPolicy";
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { chunkValues } from "./queryBatching";
import { hasDurableGeneratedMediaDisplayAuthority } from "../generatedMediaDisplayAuthority";

const PROJECT_GENERATION_PROJECTION_SELECT_COLUMNS = [
  "generation_id",
  "project_id",
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
  "started_at",
  "created_at",
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
  transcript_text?: unknown;
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
  started_at?: unknown;
  created_at?: unknown;
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

const toSafeUserScopedPath = (value: unknown, userId: string): string | null => {
  const candidate = asTrimmedString(value);
  if (!candidate) return null;
  try {
    return assertUserScopedMediaStoragePath({
      path: candidate,
      userId,
      label: "Project generation delivery path",
    });
  } catch {
    return null;
  }
};

const parseIsoTimestampMs = (value: unknown): number | null => {
  const iso = asTrimmedString(value);
  const parsed = Date.parse(iso ?? "");
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveProjectionCreatedAt = (
  projection: ProjectGenerationProjectionRow | null | undefined
): string | null =>
  asTrimmedString(projection?.started_at) ??
  asTrimmedString(projection?.created_at) ??
  asTrimmedString(projection?.updated_at);

const asTrimmedStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => Boolean(entry));
};

const asIsoTimestampString = (value: unknown): string | null => {
  const normalized = asTrimmedString(value);
  if (!normalized) return null;
  return parseIsoTimestampMs(normalized) === null ? null : normalized;
};

const asBoolean = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

const keepTrustedMediaPreviewUrlForUser = ({
  userId,
  url,
}: {
  userId: string;
  url: string | null;
}): string | null => {
  if (!url) return null;
  const trustedIgnoringScope = filterTrustedMediaDirectPreviewUrls([url], {
    userId,
    requireUserScope: false,
  });
  if (trustedIgnoringScope.length === 0) {
    return url;
  }
  return (
    filterTrustedMediaDirectPreviewUrls([url], {
      userId,
      requireUserScope: true,
    })[0] ?? null
  );
};

const sanitizeTrustedMediaPreviewUrlListForUser = ({
  userId,
  urls,
}: {
  userId: string;
  urls: string[];
}): string[] => {
  const trusted: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    const safeUrl = keepTrustedMediaPreviewUrlForUser({ userId, url });
    if (!safeUrl || seen.has(safeUrl)) continue;
    seen.add(safeUrl);
    trusted.push(safeUrl);
  }
  return trusted;
};

const isLikelyImagePath = (value: string | null): boolean =>
  Boolean(value && /\.(?:avif|gif|heic|heif|jpe?g|png|webp)(?:$|[?#])/i.test(value));

const isLikelyVideoPath = (value: string | null): boolean =>
  Boolean(value && /\.(?:m4v|mov|mp4|ogv|webm)(?:$|[?#])/i.test(value));

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
  const ownedGenerationIds = new Set<string>();

  for (const generationIdChunk of chunkValues(generationIds)) {
    const [
      { data: generationData, error: generationError },
      { data: projectionData, error: projectionError },
    ] = await Promise.all([
      supabaseAdmin
        .from("ai_generations")
        .select("id")
        .eq("user_id", userId)
        .in("id", generationIdChunk),
      supabaseAdmin
        .from("generation_projection")
        .select("generation_id")
        .eq("user_id", userId)
        .in("generation_id", generationIdChunk),
    ]);

    if (generationError) {
      throw new Error(generationError.message || "Failed to resolve owned ai_generations ids");
    }
    if (projectionError) {
      throw new Error(
        projectionError.message || "Failed to resolve owned generation_projection ids"
      );
    }

    (Array.isArray(generationData) ? generationData : [])
      .map((row) => asTrimmedString(asRecord(row).id))
      .filter((id): id is string => Boolean(id))
      .forEach((id) => ownedGenerationIds.add(id));
    (Array.isArray(projectionData) ? projectionData : [])
      .map((row) => asTrimmedString(asRecord(row).generation_id))
      .filter((id): id is string => Boolean(id))
      .forEach((id) => ownedGenerationIds.add(id));
  }

  return [...ownedGenerationIds];
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
  const associatedGenerationIds = new Set<string>();

  for (const generationIdChunk of chunkValues(generationIds)) {
    const { data, error } = await supabaseAdmin
      .from("project_generation_items")
      .select("generation_id")
      .eq("user_id", userId)
      .eq("project_id", projectId)
      .in("generation_id", generationIdChunk);

    if (error) {
      throw new Error(error.message || "Failed to resolve project-associated generations");
    }

    (Array.isArray(data) ? data : [])
      .map((row) => asTrimmedString(asRecord(row).generation_id))
      .filter((generationId): generationId is string => Boolean(generationId))
      .forEach((generationId) => associatedGenerationIds.add(generationId));

    const { data: projectionData, error: projectionError } = await supabaseAdmin
      .from("generation_projection")
      .select("generation_id")
      .eq("user_id", userId)
      .eq("project_id", projectId)
      .in("generation_id", generationIdChunk);

    if (projectionError) {
      throw new Error(projectionError.message || "Failed to resolve project-scoped projections");
    }

    (Array.isArray(projectionData) ? projectionData : [])
      .map((row) => asTrimmedString(asRecord(row).generation_id))
      .filter((generationId): generationId is string => Boolean(generationId))
      .forEach((generationId) => associatedGenerationIds.add(generationId));
  }

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
    .select("generation_id, started_at, created_at, updated_at")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("started_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(boundedLimit);

  if (projectionError) {
    throw new Error(projectionError.message || "Failed to load project-scoped projection ids");
  }

  const generationRecencyById = new Map<string, number | null>();
  (Array.isArray(data) ? data : [])
    .map((row) => {
      const record = asRecord(row);
      return {
        generationId: asTrimmedString(record.generation_id),
        recencyMs: parseIsoTimestampMs(record.updated_at),
      };
    })
    .forEach(({ generationId, recencyMs }) => {
      if (!generationId) return;
      generationRecencyById.set(generationId, recencyMs);
    });

  (Array.isArray(projectionData) ? projectionData : [])
    .map((row) => {
      const record = asRecord(row);
      return {
        generationId: asTrimmedString(record.generation_id),
        recencyMs:
          parseIsoTimestampMs(record.started_at) ??
          parseIsoTimestampMs(record.created_at) ??
          parseIsoTimestampMs(record.updated_at),
      };
    })
    .forEach(({ generationId, recencyMs }) => {
      if (!generationId) return;
      const existingRecencyMs = generationRecencyById.get(generationId) ?? null;
      generationRecencyById.set(
        generationId,
        Math.max(
          existingRecencyMs ?? Number.NEGATIVE_INFINITY,
          recencyMs ?? Number.NEGATIVE_INFINITY
        )
      );
    });

  return [...generationRecencyById.entries()]
    .sort(([, aRecencyMs], [, bRecencyMs]) => {
      const aMs = aRecencyMs ?? Number.NEGATIVE_INFINITY;
      const bMs = bRecencyMs ?? Number.NEGATIVE_INFINITY;
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
  const projectionByGenerationId = new Map<string, ProjectGenerationProjectionRow>();

  for (const generationIdChunk of chunkValues(generationIds)) {
    const { data, error } = await supabaseAdmin
      .from("generation_projection")
      .select(PROJECT_GENERATION_PROJECTION_SELECT_COLUMNS)
      .eq("user_id", userId)
      .in("generation_id", generationIdChunk);

    if (error) {
      throw new Error(error.message || "Failed to load generation projection rows");
    }

    (Array.isArray(data) ? data : [])
      .map((row) => {
        const generationId = asTrimmedString(asRecord(row).generation_id);
        if (!generationId) return null;
        return [generationId, row as ProjectGenerationProjectionRow] as const;
      })
      .filter((entry): entry is readonly [string, ProjectGenerationProjectionRow] => Boolean(entry))
      .forEach(([generationId, row]) => projectionByGenerationId.set(generationId, row));
  }

  return projectionByGenerationId;
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
  const byGenerationId = new Map<string, ProjectGenerationPublicationRow>();

  for (const generationIdChunk of chunkValues(generationIds)) {
    const { data, error } = await supabaseAdmin
      .from("generation_publications")
      .select(
        "generation_id, owned_media_file_id, preview_storage_path, full_storage_path, created_at"
      )
      .eq("user_id", userId)
      .in("generation_id", generationIdChunk)
      .eq("publication_state", "published")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message || "Failed to load project generation publication rows");
    }

    (Array.isArray(data) ? data : []).forEach((rawRow) => {
      const row = rawRow as ProjectGenerationPublicationRow;
      const generationId = asTrimmedString(row.generation_id);
      if (!generationId || byGenerationId.has(generationId)) return;
      byGenerationId.set(generationId, row);
    });
  }

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
  const mediaById = new Map<string, ProjectGenerationMediaFileRow>();
  for (const mediaFileIdChunk of chunkValues(normalizedMediaFileIds)) {
    const { data, error } = await supabaseAdmin
      .from("media_files")
      .select(
        "id, storage_path, file_type, poster_variant_path, thumb_variant_path, preview_variant_path"
      )
      .eq("user_id", userId)
      .in("id", mediaFileIdChunk);

    if (error) {
      throw new Error(error.message || "Failed to load project generation media rows");
    }

    (Array.isArray(data) ? data : [])
      .map((rawRow) => {
        const row = rawRow as ProjectGenerationMediaFileRow;
        const mediaFileId = asTrimmedString(row.id);
        if (!mediaFileId) return null;
        return [mediaFileId, row] as const;
      })
      .filter((entry): entry is readonly [string, ProjectGenerationMediaFileRow] => Boolean(entry))
      .forEach(([mediaFileId, row]) => mediaById.set(mediaFileId, row));
  }

  return mediaById;
};

const resolveDeliveryFromMediaRows = ({
  userId,
  mediaRow,
  publicationRow,
}: {
  userId: string;
  mediaRow: ProjectGenerationMediaFileRow | null;
  publicationRow: ProjectGenerationPublicationRow | null;
}): ProjectGenerationMediaDelivery | null => {
  const fileType = asTrimmedString(mediaRow?.file_type)?.toLowerCase() ?? "";
  const mediaStoragePath = toSafeUserScopedPath(mediaRow?.storage_path, userId);
  const mediaPreviewVariantPath = toSafeUserScopedPath(mediaRow?.preview_variant_path, userId);
  const mediaThumbVariantPath = toSafeUserScopedPath(mediaRow?.thumb_variant_path, userId);
  const mediaPosterVariantPath = toSafeUserScopedPath(mediaRow?.poster_variant_path, userId);
  const publicationPreviewStoragePath = toSafeUserScopedPath(
    publicationRow?.preview_storage_path,
    userId
  );
  const publicationFullStoragePath = toSafeUserScopedPath(
    publicationRow?.full_storage_path,
    userId
  );
  const fullStoragePath = publicationFullStoragePath ?? mediaStoragePath ?? null;
  const isVideo =
    fileType.startsWith("video") ||
    isLikelyVideoPath(fullStoragePath) ||
    isLikelyVideoPath(mediaStoragePath);
  const isImage =
    fileType.startsWith("image") ||
    isLikelyImagePath(fullStoragePath) ||
    isLikelyImagePath(mediaStoragePath);
  if (!isVideo && !isImage) return null;

  if (isImage) {
    const previewStoragePath =
      publicationPreviewStoragePath ??
      mediaPreviewVariantPath ??
      mediaThumbVariantPath ??
      fullStoragePath;
    if (!previewStoragePath && !fullStoragePath) return null;
    return {
      previewPosterStoragePath: null,
      previewStoragePath,
      fullStoragePath,
    };
  }

  const previewPosterStoragePath =
    mediaPosterVariantPath ??
    mediaThumbVariantPath ??
    resolveVideoPosterStoragePath({
      previewStoragePath: publicationPreviewStoragePath,
      fullStoragePath,
    }) ??
    resolveVideoPosterStoragePath({
      previewStoragePath: mediaPreviewVariantPath,
      fullStoragePath,
    });
  const previewStoragePath =
    publicationPreviewStoragePath ?? mediaPreviewVariantPath ?? fullStoragePath;
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
  const mediaBackedProjectionEntries = [...projectionByGenerationId.entries()].filter(
    ([, projection]) => resolveSnapshotOutputMode(projection) !== "audio"
  );
  if (!mediaBackedProjectionEntries.length) return new Map();

  const generationIds = mediaBackedProjectionEntries.map(([generationId]) => generationId);
  const publicationByGenerationId = await readPublishedGenerationRowsByGenerationId({
    userId,
    generationIds,
  });
  const mediaFileIds = new Set<string>();
  mediaBackedProjectionEntries.forEach(([, projection]) => {
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
  mediaBackedProjectionEntries.forEach(([generationId, projection]) => {
    const publicationRow = publicationByGenerationId.get(generationId) ?? null;
    const publicationMediaId = asTrimmedString(publicationRow?.owned_media_file_id);
    const savedMediaIds = asTrimmedStringArray(projection.saved_media_ids);
    const mediaRow =
      (publicationMediaId ? mediaById.get(publicationMediaId) : null) ??
      savedMediaIds.map((mediaId) => mediaById.get(mediaId)).find(Boolean) ??
      null;
    const delivery = resolveDeliveryFromMediaRows({
      userId,
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
  const ownedMediaFileIds = new Set<string>();

  for (const mediaFileIdChunk of chunkValues(normalizedMediaFileIds)) {
    const { data, error } = await supabaseAdmin
      .from("media_files")
      .select("id")
      .eq("user_id", userId)
      .in("id", mediaFileIdChunk);

    if (error) {
      throw new Error(error.message || "Failed to verify owned media files before association");
    }

    (Array.isArray(data) ? data : [])
      .map((row) => asTrimmedString(asRecord(row).id))
      .filter((value): value is string => Boolean(value))
      .forEach((id) => ownedMediaFileIds.add(id));
  }

  return [...ownedMediaFileIds];
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

export const associateGenerationWithProjectForUserBestEffort = async ({
  userId,
  projectId,
  generationId,
  onError,
}: {
  userId: string;
  projectId: string | null | undefined;
  generationId: string;
  onError?: (payload: { projectId: string; error: unknown }) => Promise<void> | void;
}): Promise<boolean> => {
  const normalizedProjectId = asTrimmedString(projectId);
  if (!normalizedProjectId) return false;
  try {
    return await associateGenerationWithProjectForUser({
      userId,
      projectId: normalizedProjectId,
      generationId,
    });
  } catch (error) {
    await onError?.({
      projectId: normalizedProjectId,
      error,
    });
    return false;
  }
};

export const associateGenerationAndMediaWithProjectForUserBestEffort = async ({
  userId,
  projectId,
  generationId,
  mediaFileIds,
  onError,
}: {
  userId: string;
  projectId: string | null | undefined;
  generationId: string;
  mediaFileIds?: string[] | null;
  onError?: (payload: { projectId: string; error: unknown }) => Promise<void> | void;
}): Promise<boolean> => {
  const normalizedProjectId = asTrimmedString(projectId);
  if (!normalizedProjectId) return false;
  try {
    const associatedGeneration = await associateGenerationWithProjectForUser({
      userId,
      projectId: normalizedProjectId,
      generationId,
    });
    const normalizedMediaFileIds =
      Array.isArray(mediaFileIds) && mediaFileIds.length > 0 ? mediaFileIds : [];
    if (normalizedMediaFileIds.length === 0) {
      return associatedGeneration;
    }
    const associatedMedia = await associateMediaFilesWithProjectForUser({
      userId,
      projectId: normalizedProjectId,
      mediaFileIds: normalizedMediaFileIds,
    });
    return associatedGeneration || associatedMedia;
  } catch (error) {
    await onError?.({
      projectId: normalizedProjectId,
      error,
    });
    return false;
  }
};

const patchSnapshotOutputRow = ({
  userId,
  row,
  projection,
  mediaDelivery,
}: {
  userId: string;
  row: SnapshotRecord;
  projection: ProjectGenerationProjectionRow;
  mediaDelivery?: ProjectGenerationMediaDelivery | null;
}): SnapshotRecord => {
  const nextResultUrls = sanitizeTrustedMediaPreviewUrlListForUser({
    userId,
    urls: asTrimmedStringArray(projection.result_urls),
  });
  const nextPreviewUrl = keepTrustedMediaPreviewUrlForUser({
    userId,
    url: asTrimmedString(projection.preview_url) ?? nextResultUrls[0] ?? null,
  });
  const safeRowResultUrls = sanitizeTrustedMediaPreviewUrlListForUser({
    userId,
    urls: asTrimmedStringArray(row.resultUrls),
  });
  const safeRowPreviewUrl = keepTrustedMediaPreviewUrlForUser({
    userId,
    url: asTrimmedString(row.previewUrl),
  });
  const safeRowPreviewPosterUrl = keepTrustedMediaPreviewUrlForUser({
    userId,
    url: asTrimmedString(row.previewPosterUrl),
  });
  const safeRowCompanionArtUrl = keepTrustedMediaPreviewUrlForUser({
    userId,
    url: asTrimmedString(row.companionArtUrl),
  });
  const nextMode = asTrimmedString(row.mode) ?? resolveSnapshotOutputMode(projection);
  const projectedPreviewStoragePath = toSafeUserScopedPath(projection.preview_storage_path, userId);
  const nextPreviewStoragePath =
    mediaDelivery?.previewStoragePath ?? projectedPreviewStoragePath ?? null;
  const nextFullStoragePath =
    mediaDelivery?.fullStoragePath ??
    toSafeUserScopedPath(projection.full_storage_path, userId) ??
    nextPreviewStoragePath ??
    null;
  const nextPreviewPosterStoragePath =
    nextMode === "video"
      ? (mediaDelivery?.previewPosterStoragePath ??
        toSafeUserScopedPath(row.previewPosterStoragePath, userId) ??
        resolveVideoPosterStoragePath({
          previewStoragePath: nextPreviewStoragePath,
          fullStoragePath: nextFullStoragePath,
        }))
      : null;
  const nextPreviewPosterUrl =
    nextMode === "video" && nextPreviewUrl && isLikelyImagePath(nextPreviewUrl)
      ? nextPreviewUrl
      : safeRowPreviewPosterUrl;
  const nextTaskState = normalizeProjectionTaskState(projection.task_state);
  const nextQueueState = normalizeProjectionQueueState(projection.queue_state);
  const nextCompanionArtStatus = asTrimmedString(projection.companion_art_status);
  const nextCompanionArtStoragePath = toSafeUserScopedPath(
    projection.companion_art_storage_path,
    userId
  );
  const nextErrorMessage = asTrimmedString(projection.error_message);
  const nextErrorMessageShort = asTrimmedString(projection.error_message_short);
  const nextErrorDetail = asTrimmedString(projection.error_detail);
  const nextPrompt = asTrimmedString(projection.display_prompt);
  const nextTranscriptText = asTrimmedString(projection.transcript_text);
  const nextProvider = asTrimmedString(projection.provider);
  const nextModelId = asTrimmedString(projection.model_id);
  const nextSourceRef = asTrimmedString(projection.source_ref);
  const nextTaskId = asTrimmedString(projection.request_id);
  const nextGenerationId = asTrimmedString(projection.generation_id);
  const nextGenerationReplay = asRecord(projection.generation_replay);
  const nextCharacterContext = asRecord(projection.character_context);
  const nextStyleContext = asRecord(projection.style_context);
  const nextSavedMediaIds = asTrimmedStringArray(projection.saved_media_ids);
  const nextSaveState = resolveRestoredOutputSaveState({ projection, row });
  const nextStatus = nextSaveState === "saved" ? "saved" : (row.status ?? "ready");

  return {
    ...row,
    createdAt:
      resolveProjectionCreatedAt(projection) ??
      asIsoTimestampString(row.createdAt) ??
      asIsoTimestampString(row.timestamp) ??
      null,
    prompt: nextPrompt ?? row.prompt ?? "",
    transcriptText: nextTranscriptText ?? row.transcriptText ?? null,
    provider: nextProvider ?? row.provider,
    modelId: nextModelId ?? row.modelId,
    sourceRef: nextSourceRef ?? row.sourceRef,
    generationId: nextGenerationId ?? row.generationId,
    taskId: nextTaskId ?? row.taskId,
    taskState: nextTaskState ?? row.taskState,
    queueState: nextQueueState ?? row.queueState,
    errorMessage: nextErrorMessage ?? row.errorMessage ?? null,
    errorMessageShort: nextErrorMessageShort ?? row.errorMessageShort ?? null,
    errorDetail: nextErrorDetail ?? row.errorDetail ?? null,
    savedMediaIds: nextSavedMediaIds.length > 0 ? nextSavedMediaIds : (row.savedMediaIds ?? []),
    saveState: nextSaveState,
    status: nextStatus,
    resultUrls: nextResultUrls.length > 0 ? nextResultUrls : safeRowResultUrls,
    previewUrl: nextPreviewUrl ?? safeRowPreviewUrl ?? null,
    previewPosterUrl: nextMode === "video" ? (nextPreviewPosterUrl ?? null) : null,
    previewPosterStoragePath: nextMode === "video" ? (nextPreviewPosterStoragePath ?? null) : null,
    companionArtUrl: safeRowCompanionArtUrl ?? null,
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

const hasProjectGenerationMediaDelivery = (
  mediaDelivery: ProjectGenerationMediaDelivery | null | undefined
): boolean =>
  Boolean(
    mediaDelivery?.previewPosterStoragePath ||
    mediaDelivery?.previewStoragePath ||
    mediaDelivery?.fullStoragePath
  );

const hasProjectionDurableDisplayAuthority = ({
  userId,
  projection,
  mediaDelivery,
}: {
  userId: string;
  projection: ProjectGenerationProjectionRow;
  mediaDelivery?: ProjectGenerationMediaDelivery | null;
}): boolean =>
  hasProjectGenerationMediaDelivery(mediaDelivery) ||
  hasDurableGeneratedMediaDisplayAuthority({
    savedMediaIds: asTrimmedStringArray(projection.saved_media_ids),
    previewStoragePath: toSafeUserScopedPath(projection.preview_storage_path, userId),
    fullStoragePath: toSafeUserScopedPath(projection.full_storage_path, userId),
    companionArtStoragePath: toSafeUserScopedPath(projection.companion_art_storage_path, userId),
  });

const hasSnapshotRowDurableDisplayAuthority = ({
  userId,
  row,
}: {
  userId: string;
  row: SnapshotRecord;
}): boolean =>
  hasDurableGeneratedMediaDisplayAuthority({
    previewText: asTrimmedString(row.previewText),
    savedMediaIds: asTrimmedStringArray(row.savedMediaIds),
    previewPosterStoragePath: toSafeUserScopedPath(row.previewPosterStoragePath, userId),
    previewStoragePath: toSafeUserScopedPath(row.previewStoragePath, userId),
    fullStoragePath: toSafeUserScopedPath(row.fullStoragePath, userId),
    companionArtStoragePath: toSafeUserScopedPath(row.companionArtStoragePath, userId),
  });

const shouldRestoreProjectionAsDisplayRow = ({
  userId,
  projection,
  mediaDelivery,
  row,
}: {
  userId: string;
  projection: ProjectGenerationProjectionRow;
  mediaDelivery?: ProjectGenerationMediaDelivery | null;
  row?: SnapshotRecord | null;
}): boolean => {
  if (asBoolean(projection.hidden_in_reference_grid) === true) return false;
  if (asBoolean(projection.reference_grid_visible) === false) return false;
  const taskState = normalizeProjectionTaskState(projection.task_state);
  if (taskState === "fail") return false;
  if (taskState === "pending" || taskState === "running") return true;
  return (
    hasProjectionDurableDisplayAuthority({ userId, projection, mediaDelivery }) ||
    Boolean(row && hasSnapshotRowDurableDisplayAuthority({ userId, row }))
  );
};

const shouldAppendProjectionToSnapshot = (projection: ProjectGenerationProjectionRow): boolean => {
  if (asBoolean(projection.hidden_in_reference_grid) === true) return false;
  if (asBoolean(projection.reference_grid_visible) === false) return false;
  if (normalizeProjectionTaskState(projection.task_state) === "fail") return false;
  return Boolean(asTrimmedString(projection.generation_id));
};

const shouldRetainProjectionSnapshotRow = (
  userId: string,
  projection: ProjectGenerationProjectionRow | null | undefined,
  row: SnapshotRecord,
  mediaDelivery?: ProjectGenerationMediaDelivery | null
): boolean => {
  if (!projection) return false;
  return shouldRestoreProjectionAsDisplayRow({ userId, projection, mediaDelivery, row });
};

const createSnapshotOutputRowFromProjection = ({
  userId,
  projection,
  mediaDelivery,
}: {
  userId: string;
  projection: ProjectGenerationProjectionRow;
  mediaDelivery?: ProjectGenerationMediaDelivery | null;
}): SnapshotRecord | null => {
  const generationId = asTrimmedString(projection.generation_id);
  if (!generationId || !shouldAppendProjectionToSnapshot(projection)) return null;
  if (!shouldRestoreProjectionAsDisplayRow({ userId, projection, mediaDelivery })) return null;
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
    userId,
    row: {
      id: `generated:${generationId}`,
      mode,
      model: modelId ?? "Generated media",
      modelId: modelId ?? undefined,
      prompt: asTrimmedString(projection.display_prompt) ?? "",
      transcriptText: asTrimmedString(projection.transcript_text) ?? null,
      status: restoredStatus,
      timestamp: "Just now",
      createdAt: resolveProjectionCreatedAt(projection),
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

const orderActiveSnapshotRowsByProjectGenerationRecency = ({
  rows,
}: {
  rows: SnapshotRecord[];
}): SnapshotRecord[] => {
  if (rows.length <= 1) return rows;
  const indexedRows = rows.map((row, index) => ({
    row,
    index,
    createdAtMs: parseIsoTimestampMs(asRecord(row).createdAt),
  }));
  if (indexedRows.some((entry) => entry.createdAtMs === null)) {
    return indexedRows.map(({ row }) => row);
  }
  return indexedRows
    .sort((left, right) => {
      if (left.createdAtMs !== right.createdAtMs) {
        return (right.createdAtMs as number) - (left.createdAtMs as number);
      }
      return left.index - right.index;
    })
    .map(({ row }) => row);
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
  const projectionByTaskId = new Map<string, ProjectGenerationProjectionRow>();
  const projectionBySourceRef = new Map<string, ProjectGenerationProjectionRow>();
  projectionByGenerationId.forEach((projection) => {
    const requestId = asTrimmedString(projection.request_id);
    if (requestId && !projectionByTaskId.has(requestId)) {
      projectionByTaskId.set(requestId, projection);
    }
    const sourceRef = asTrimmedString(projection.source_ref);
    if (sourceRef && !projectionBySourceRef.has(sourceRef)) {
      projectionBySourceRef.set(sourceRef, projection);
    }
  });
  const patchRows = (value: unknown): unknown => {
    if (!Array.isArray(value)) return value;
    return value
      .map((row) => {
        const normalizedRow = asRecord(row);
        const generationId = asTrimmedString(normalizedRow.generationId);
        if (generationId && !associatedSnapshotGenerationIds.has(generationId)) {
          return normalizedRow;
        }
        const projection =
          (generationId ? projectionByGenerationId.get(generationId) : null) ??
          projectionByTaskId.get(asTrimmedString(normalizedRow.taskId) ?? "") ??
          projectionBySourceRef.get(asTrimmedString(normalizedRow.sourceRef) ?? "");
        if (!generationId && !projection) {
          return row;
        }
        if (!projection) {
          return normalizedRow;
        }
        const projectionGenerationId = asTrimmedString(projection.generation_id);
        const mediaDeliveryGenerationId = generationId ?? projectionGenerationId;
        const mediaDelivery = mediaDeliveryGenerationId
          ? (mediaDeliveryByGenerationId.get(mediaDeliveryGenerationId) ?? null)
          : null;
        if (!shouldRetainProjectionSnapshotRow(userId, projection, normalizedRow, mediaDelivery)) {
          changed = true;
          return null;
        }
        changed = true;
        return patchSnapshotOutputRow({
          userId,
          row: normalizedRow,
          projection,
          mediaDelivery,
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
            userId,
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
    ...(Array.isArray(activeRows) ? activeRows : []),
    ...appendedActiveRows,
  ];
  const orderedActiveRows = orderActiveSnapshotRowsByProjectGenerationRecency({
    rows: unorderedActiveRows,
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
