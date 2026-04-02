import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import type { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";

type SupabaseClient = ReturnType<typeof ensureSupabaseQueryClient>;

type MediaFileRow = {
  storage_path?: unknown;
  filename?: unknown;
  preview_storage_path?: unknown;
};

type GenerationOutputRow = {
  id?: unknown;
  media_file_id?: unknown;
};

type GenerationPublicationRow = {
  owned_media_file_id?: unknown;
  preview_storage_path?: unknown;
  full_storage_path?: unknown;
  created_at?: unknown;
};

export type GeneratedMediaFileRecord = {
  storagePath: string;
  filename: string | null;
};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
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
