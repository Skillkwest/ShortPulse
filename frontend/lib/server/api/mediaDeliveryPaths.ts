import { getSupabaseAdmin } from "./supabaseAdmin";
import { asCanonicalStoragePath } from "../../adaptive-media";

type JsonObject = Record<string, unknown>;

export type MediaDeliveryPaths = {
  previewStoragePath: string;
  fullStoragePath: string;
};

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const isPreviewStoragePathSchemaError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const message =
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message.toLowerCase()
      : "";
  return (
    message.includes("preview_storage_path") &&
    (message.includes("schema cache") || message.includes("does not exist"))
  );
};

export const readMediaDeliveryPathsById = async ({
  mediaFileIds,
  userId,
  supabaseAdmin,
}: {
  mediaFileIds: string[];
  userId: string;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
}): Promise<Map<string, MediaDeliveryPaths>> => {
  const ids = mediaFileIds
    .map((value) => asString(value))
    .filter((value): value is string => Boolean(value));
  if (!ids.length) return new Map();

  const adminClient = supabaseAdmin ?? getSupabaseAdmin();
  const runSelect = async (
    fields:
      | "id, preview_storage_path, storage_path, file_type, poster_variant_path, preview_variant_path"
      | "id, storage_path, file_type, poster_variant_path, preview_variant_path"
  ) =>
    await adminClient
      .from("media_files")
      .select(fields)
      .in("id", ids)
      .eq("user_id", userId)
      .limit(ids.length);

  let { data, error } = await runSelect(
    "id, preview_storage_path, storage_path, file_type, poster_variant_path, preview_variant_path"
  );
  if (error && isPreviewStoragePathSchemaError(error)) {
    ({ data, error } = await runSelect(
      "id, storage_path, file_type, poster_variant_path, preview_variant_path"
    ));
  }
  if (error || !Array.isArray(data)) return new Map();

  const map = new Map<string, MediaDeliveryPaths>();
  for (const rawRow of data) {
    const row = asObject(rawRow);
    const mediaFileId = asString(row.id);
    const storagePath = asCanonicalStoragePath(asString(row.storage_path));
    if (!mediaFileId || !storagePath) continue;
    const fileType = asString(row.file_type)?.toLowerCase() ?? "";
    const isVideo = fileType.startsWith("video");
    const previewVariantPath = asCanonicalStoragePath(asString(row.preview_variant_path));
    const previewStoragePathCandidate = asCanonicalStoragePath(asString(row.preview_storage_path));
    const previewStoragePath = isVideo
      ? (previewVariantPath ?? previewStoragePathCandidate ?? storagePath)
      : (previewStoragePathCandidate ?? storagePath);
    if (!previewStoragePath) continue;
    map.set(mediaFileId, {
      previewStoragePath,
      fullStoragePath: storagePath,
    });
  }
  return map;
};
