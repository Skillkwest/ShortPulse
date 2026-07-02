/**
 * Server-owned admitted image reference variants.
 * Creates durable under-25 MB product-use derivatives for oversized generated images only.
 */
import { IMAGE_ADMISSION_MAX_BYTES, IMAGE_ADMISSION_VARIANT_KIND } from "../imageAdmissionPolicy";
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { admitImageBufferForProductUse, type ImageAdmissionMetadata } from "./imageAdmission";
import {
  createSignedMediaUrl,
  DURABLE_MEDIA_CACHE_CONTROL_SECONDS,
  MEDIA_BUCKET,
  removeScopedMediaStorageObject,
  resolveDetectedMediaMimeType,
  resolveMediaStorageExtension,
  uploadMediaBufferToStoragePath,
} from "./mediaIngest";
import { getSupabaseAdmin } from "./api/supabaseAdmin";

type MediaFileRow = {
  id: string;
  user_id: string;
  storage_path: string;
  file_type: string | null;
  file_size: number | null;
  source: string | null;
  metadata: Record<string, unknown> | null;
};

type MediaAssetVariantRow = {
  media_file_id: string;
  user_id: string;
  variant_kind: string;
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  byte_size: number | null;
  status: string;
  metadata: Record<string, unknown> | null;
};

export type ResolvedProductUseImageReference = {
  mediaFileId: string;
  storagePath: string;
  signedUrl: string | null;
  mimeType: string | null;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  variantKind: typeof IMAGE_ADMISSION_VARIANT_KIND | null;
  admissionMetadata: ImageAdmissionMetadata | null;
};

const MEDIA_FILE_SELECT = "id, user_id, storage_path, file_type, file_size, source, metadata";
const VARIANT_SELECT =
  "media_file_id, user_id, variant_kind, storage_path, mime_type, width, height, byte_size, status, metadata";

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizePositiveNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
};

const isGeneratedImageRow = (row: MediaFileRow): boolean =>
  row.file_type === "image" &&
  row.source === "ai_studio" &&
  row.storage_path.startsWith(`${row.user_id}/generations/images/`);

const shouldAttemptGeneratedImageAdmission = (row: MediaFileRow): boolean =>
  isGeneratedImageRow(row) &&
  (typeof row.file_size !== "number" || row.file_size > IMAGE_ADMISSION_MAX_BYTES);

const buildAdmittedVariantStoragePath = ({
  userId,
  mediaFileId,
  extension,
}: {
  userId: string;
  mediaFileId: string;
  extension: string;
}): string =>
  assertUserScopedMediaStoragePath({
    path: `${userId}/variants/images/${mediaFileId}/${IMAGE_ADMISSION_VARIANT_KIND}.${extension}`,
    userId,
    label: "Admitted image reference variant path",
  });

const readMediaFileForUser = async ({
  userId,
  mediaFileId,
}: {
  userId: string;
  mediaFileId: string;
}): Promise<MediaFileRow> => {
  const { data, error } = await getSupabaseAdmin()
    .from("media_files")
    .select(MEDIA_FILE_SELECT)
    .eq("id", mediaFileId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to resolve media file for image admission: ${error.message}`);
  }
  if (!data) {
    throw new Error("Media file is not available for this user.");
  }

  const row = data as Partial<MediaFileRow>;
  const id = normalizeNonEmptyString(row.id);
  const rowUserId = normalizeNonEmptyString(row.user_id);
  const storagePath = normalizeNonEmptyString(row.storage_path);
  if (!id || !rowUserId || rowUserId !== userId || !storagePath) {
    throw new Error("Media file ownership could not be verified.");
  }

  return {
    id,
    user_id: rowUserId,
    storage_path: assertUserScopedMediaStoragePath({
      path: storagePath,
      userId,
      label: "Media file storage path",
    }),
    file_type: normalizeNonEmptyString(row.file_type),
    file_size: normalizePositiveNumber(row.file_size),
    source: normalizeNonEmptyString(row.source),
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
  };
};

const readReadyAdmittedVariant = async ({
  userId,
  mediaFileId,
}: {
  userId: string;
  mediaFileId: string;
}): Promise<MediaAssetVariantRow | null> => {
  const { data, error } = await getSupabaseAdmin()
    .from("media_asset_variants")
    .select(VARIANT_SELECT)
    .eq("media_file_id", mediaFileId)
    .eq("user_id", userId)
    .eq("variant_kind", IMAGE_ADMISSION_VARIANT_KIND)
    .eq("status", "ready")
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to resolve admitted image variant: ${error.message}`);
  }
  if (!data) return null;

  return coerceVerifiedVariantRow({
    value: data,
    userId,
    mediaFileId,
    label: "Admitted image variant storage path",
  });
};

const coerceVerifiedVariantRow = ({
  value,
  userId,
  mediaFileId,
  label,
}: {
  value: unknown;
  userId: string;
  mediaFileId: string;
  label: string;
}): MediaAssetVariantRow => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Admitted image variant is malformed.");
  }
  const row = value as Partial<MediaAssetVariantRow>;
  const rowMediaFileId = normalizeNonEmptyString(row.media_file_id);
  const storagePath = normalizeNonEmptyString(row.storage_path);
  const rowUserId = normalizeNonEmptyString(row.user_id);
  const variantKind = normalizeNonEmptyString(row.variant_kind);
  if (
    rowMediaFileId !== mediaFileId ||
    rowUserId !== userId ||
    variantKind !== IMAGE_ADMISSION_VARIANT_KIND ||
    !storagePath
  ) {
    throw new Error("Admitted image variant ownership could not be verified.");
  }

  return {
    media_file_id: rowMediaFileId,
    user_id: rowUserId,
    variant_kind: IMAGE_ADMISSION_VARIANT_KIND,
    storage_path: assertUserScopedMediaStoragePath({
      path: storagePath,
      userId,
      label,
    }),
    mime_type: normalizeNonEmptyString(row.mime_type) ?? "image/jpeg",
    width: normalizePositiveNumber(row.width),
    height: normalizePositiveNumber(row.height),
    byte_size: normalizePositiveNumber(row.byte_size),
    status: "ready",
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
  };
};

const toBufferFromDownload = async (data: unknown): Promise<Buffer> => {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === "string") return Buffer.from(data);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  if (typeof (data as { arrayBuffer?: unknown }).arrayBuffer === "function") {
    const raw = await (data as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
    return Buffer.from(raw);
  }
  throw new Error("Unable to read generated image bytes for admission.");
};

const downloadMediaStorageObject = async (
  storagePath: string
): Promise<{ buffer: Buffer; contentType: string | null }> => {
  const { data, error } = await getSupabaseAdmin().storage.from(MEDIA_BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(
      `Unable to download generated image for admission: ${error?.message ?? storagePath}`
    );
  }
  return {
    buffer: await toBufferFromDownload(data),
    contentType: normalizeNonEmptyString((data as { type?: unknown }).type),
  };
};

const signResolvedStoragePath = async ({
  storagePath,
  expiresInSeconds,
}: {
  storagePath: string;
  expiresInSeconds: number;
}): Promise<string> => createSignedMediaUrl(storagePath, expiresInSeconds);

const fromMediaFileOriginal = async ({
  row,
  expiresInSeconds,
  sign,
}: {
  row: MediaFileRow;
  expiresInSeconds: number;
  sign: boolean;
}): Promise<ResolvedProductUseImageReference> => ({
  mediaFileId: row.id,
  storagePath: row.storage_path,
  signedUrl: sign
    ? await signResolvedStoragePath({ storagePath: row.storage_path, expiresInSeconds })
    : null,
  mimeType: null,
  byteSize: row.file_size,
  width: normalizePositiveNumber(row.metadata?.width),
  height: normalizePositiveNumber(row.metadata?.height),
  variantKind: null,
  admissionMetadata: null,
});

const fromReadyVariant = async ({
  row,
  expiresInSeconds,
  sign,
}: {
  row: MediaAssetVariantRow;
  expiresInSeconds: number;
  sign: boolean;
}): Promise<ResolvedProductUseImageReference> => ({
  mediaFileId: row.media_file_id,
  storagePath: row.storage_path,
  signedUrl: sign
    ? await signResolvedStoragePath({ storagePath: row.storage_path, expiresInSeconds })
    : null,
  mimeType: row.mime_type,
  byteSize: row.byte_size,
  width: row.width,
  height: row.height,
  variantKind: IMAGE_ADMISSION_VARIANT_KIND,
  admissionMetadata:
    row.metadata?.image_admission &&
    typeof row.metadata.image_admission === "object" &&
    !Array.isArray(row.metadata.image_admission)
      ? (row.metadata.image_admission as ImageAdmissionMetadata)
      : null,
});

export const resolveProductUseImageReferenceForMediaFile = async ({
  userId,
  mediaFileId,
  sign = true,
  expiresInSeconds = 3600,
}: {
  userId: string;
  mediaFileId: string;
  sign?: boolean;
  expiresInSeconds?: number;
}): Promise<ResolvedProductUseImageReference> => {
  const original = await readMediaFileForUser({ userId, mediaFileId });

  if (original.file_type !== "image") {
    return fromMediaFileOriginal({ row: original, expiresInSeconds, sign });
  }

  if (!shouldAttemptGeneratedImageAdmission(original)) {
    return fromMediaFileOriginal({ row: original, expiresInSeconds, sign });
  }

  const readyVariant = await readReadyAdmittedVariant({ userId, mediaFileId });
  if (readyVariant) {
    return fromReadyVariant({ row: readyVariant, expiresInSeconds, sign });
  }

  const originalBytes = await downloadMediaStorageObject(original.storage_path);
  const originalMimeType = resolveDetectedMediaMimeType({
    contentType: originalBytes.contentType,
    buffer: originalBytes.buffer,
    fileType: "image",
  });
  const admission = await admitImageBufferForProductUse({
    buffer: originalBytes.buffer,
    mimeType: originalMimeType,
    originalPreserved: true,
    originalStoragePath: original.storage_path,
  });

  if (admission.status === "rejected") {
    throw new Error(admission.userMessage);
  }

  if (admission.status === "not_required") {
    return fromMediaFileOriginal({ row: original, expiresInSeconds, sign });
  }

  const extension = resolveMediaStorageExtension(admission.mimeType, "jpg");
  const admittedStoragePath = buildAdmittedVariantStoragePath({
    userId,
    mediaFileId,
    extension,
  });
  const imageAdmission: ImageAdmissionMetadata = {
    ...admission.metadata,
    admitted_storage_path: admittedStoragePath,
  };

  await uploadMediaBufferToStoragePath({
    storagePath: admittedStoragePath,
    buffer: admission.buffer,
    mimeType: admission.mimeType,
    upsert: true,
    cacheControl: DURABLE_MEDIA_CACHE_CONTROL_SECONDS,
  });

  const variantPayload = {
    media_file_id: original.id,
    user_id: userId,
    variant_kind: IMAGE_ADMISSION_VARIANT_KIND,
    storage_path: admittedStoragePath,
    mime_type: admission.mimeType,
    width: admission.dimensions?.width ?? null,
    height: admission.dimensions?.height ?? null,
    duration_seconds: null,
    byte_size: admission.buffer.byteLength,
    status: "ready",
    metadata: {
      generated_by: "product-use-image-admission",
      image_admission: imageAdmission,
    },
  };

  const { data: upsertedVariant, error: upsertError } = await getSupabaseAdmin()
    .from("media_asset_variants")
    .upsert(variantPayload, { onConflict: "media_file_id,variant_kind" })
    .select(VARIANT_SELECT)
    .single();

  if (upsertError || !upsertedVariant) {
    await removeScopedMediaStorageObject(admittedStoragePath);
    throw new Error(
      `Unable to persist admitted image variant: ${upsertError?.message ?? "missing row"}`
    );
  }

  const persistedVariant = coerceVerifiedVariantRow({
    value: upsertedVariant,
    userId,
    mediaFileId,
    label: "Persisted admitted image variant path",
  });
  return fromReadyVariant({
    row: {
      ...persistedVariant,
      metadata: variantPayload.metadata,
    },
    expiresInSeconds,
    sign,
  });
};
