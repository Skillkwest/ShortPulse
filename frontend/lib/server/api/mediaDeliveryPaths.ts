import { assertUserScopedMediaStoragePath } from "../../mediaStoragePath";
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

const toSafeUserScopedPath = (value: unknown, userId: string): string | null => {
  const candidate = asCanonicalStoragePath(asString(value));
  if (!candidate) return null;
  try {
    return assertUserScopedMediaStoragePath({
      path: candidate,
      userId,
      label: "Media delivery path",
    });
  } catch {
    return null;
  }
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
  const { data, error } = await adminClient
    .from("media_files")
    .select(
      "id, storage_path, file_type, thumb_variant_path, poster_variant_path, preview_variant_path"
    )
    .in("id", ids)
    .eq("user_id", userId)
    .limit(ids.length);
  if (error || !Array.isArray(data)) return new Map();

  const map = new Map<string, MediaDeliveryPaths>();
  for (const rawRow of data) {
    const row = asObject(rawRow);
    const mediaFileId = asString(row.id);
    const storagePath = toSafeUserScopedPath(row.storage_path, userId);
    if (!mediaFileId || !storagePath) continue;
    const fileType = asString(row.file_type)?.toLowerCase() ?? "";
    const isVideo = fileType.startsWith("video");
    const thumbVariantPath = toSafeUserScopedPath(row.thumb_variant_path, userId);
    const posterVariantPath = toSafeUserScopedPath(row.poster_variant_path, userId);
    const previewVariantPath = toSafeUserScopedPath(row.preview_variant_path, userId);
    const previewStoragePath = isVideo
      ? (previewVariantPath ?? posterVariantPath ?? storagePath)
      : (thumbVariantPath ?? storagePath);
    if (!previewStoragePath) continue;
    map.set(mediaFileId, {
      previewStoragePath,
      fullStoragePath: storagePath,
    });
  }
  return map;
};
