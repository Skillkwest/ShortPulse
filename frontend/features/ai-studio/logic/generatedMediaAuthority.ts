import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";

type SupabaseClient = ReturnType<typeof ensureSupabaseQueryClient>;

type MediaFileRow = {
  id?: unknown;
  storage_path?: unknown;
  filename?: unknown;
  preview_storage_path?: unknown;
  file_type?: unknown;
  poster_variant_path?: unknown;
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
  preview_url?: unknown;
  result_urls?: unknown;
  preview_storage_path?: unknown;
  full_storage_path?: unknown;
  task_state?: unknown;
  hidden_in_reference_grid?: unknown;
  reference_grid_visible?: unknown;
};

export type GeneratedMediaFileRecord = {
  storagePath: string;
  filename: string | null;
};

export type GeneratedMediaLibraryRow = GeneratedMediaFileRecord & {
  mediaFileId: string;
  fileType: "image" | "video";
  posterVariantPath: string | null;
};

export type VisibleGenerationDelivery = {
  previewUrl: string | null;
  fullUrl: string | null;
  previewStoragePath: string | null;
  fullStoragePath: string | null;
};

export type PublishedGenerationDelivery = VisibleGenerationDelivery;

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

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
  };
};

const runMaybeSingleMediaLibraryQuery = async <TRow extends MediaFileRow>(args: {
  runSelect: (
    columns:
      | "id, preview_storage_path, storage_path, filename, file_type, poster_variant_path"
      | "id, storage_path, filename, file_type, poster_variant_path"
  ) => Promise<{ data: TRow | null; error: unknown }>;
}): Promise<TRow | null> => {
  const primary = await args.runSelect(
    "id, preview_storage_path, storage_path, filename, file_type, poster_variant_path"
  );
  if (!primary.error) return primary.data;
  if (!isPreviewStoragePathSchemaError(primary.error)) return null;
  const fallback = await args.runSelect(
    "id, storage_path, filename, file_type, poster_variant_path"
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

export const resolveGenerationIdForRequestId = async ({
  supabase,
  requestId,
  userId,
}: {
  supabase: SupabaseClient;
  requestId: string | null | undefined;
  userId?: string | null;
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
    if (generationId) return generationId;
  }

  const { data: generationData, error: generationError } = await supabase
    .from("ai_generations")
    .select("id")
    .eq("user_id", resolvedUserId)
    .eq("request_id", normalizedRequestId)
    .limit(1)
    .maybeSingle();
  if (generationError) return null;

  return asTrimmedString((generationData as Record<string, unknown> | null)?.id);
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

export const resolveLatestPublishedGenerationDeliveryByGenerationId =
  resolveVisibleGenerationDeliveryByGenerationId;

export const resolveLatestPublishedGenerationDelivery = resolveVisibleGenerationDelivery;
