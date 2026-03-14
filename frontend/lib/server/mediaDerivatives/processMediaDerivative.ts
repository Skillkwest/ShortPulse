/**
 * Media derivative processor for image `media_files` rows.
 * Generates local thumbs, uploads variants, and updates variant metadata rows.
 */
import sharp from "sharp";
import { assertUserScopedMediaStoragePath } from "../../mediaStoragePath";
import type { MediaDerivativesRuntimeFlags } from "../api/mediaDerivativesRuntimeFlags";
import type { SupabaseClient } from "@supabase/supabase-js";

const MEDIA_BUCKET = "media_library";
const TRAVERSAL_SEGMENT_REGEX = /(?:^|\/)\.\.(?:\/|$)/;

type SupabaseAdminClient = SupabaseClient;
type DerivativeErrorCode =
  | "unsupported_input"
  | "decode_failed"
  | "upload_failed"
  | "variant_upsert_failed";

export type ClaimedMediaDerivativeRow = {
  id: string;
  user_id: string;
  storage_path: string;
  file_type: string;
  processing_attempts: number;
  processing_status: string;
};

export type ProcessMediaDerivativeResult = {
  thumbPath: string;
  width: number;
  generatedVariants: number;
};

type DerivativeVariantSpec = {
  variantKind: "thumb_240" | "thumb_480";
  width: number;
  quality: number;
  storagePath: string;
};

const DERIVATIVE_MIME_TYPE = "image/webp";

const isSafeStoragePath = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized.startsWith("/")) return false;
  if (normalized.includes("\\")) return false;
  if (TRAVERSAL_SEGMENT_REGEX.test(normalized)) return false;
  return true;
};

const buildDerivativeErrorMessage = (code: DerivativeErrorCode, detail?: string | null): string =>
  detail?.trim() ? `${code}: ${detail.trim()}` : code;

const throwDerivativeError = (code: DerivativeErrorCode, detail?: string | null): never => {
  throw new Error(buildDerivativeErrorMessage(code, detail));
};

const buildVariantSpecs = (
  userId: string,
  mediaFileId: string,
  flags: MediaDerivativesRuntimeFlags
): DerivativeVariantSpec[] => {
  const root = assertUserScopedMediaStoragePath({
    path: `${userId}/variants/images/${mediaFileId}`,
    userId,
    label: "Media derivatives root path",
  });
  return [
    {
      variantKind: "thumb_240",
      width: 240,
      quality: flags.thumb240Quality,
      storagePath: `${root}/thumb_240`,
    },
    {
      variantKind: "thumb_480",
      width: 480,
      quality: flags.thumb480Quality,
      storagePath: `${root}/thumb_480`,
    },
  ];
};

const toBufferFromDownload = async (data: unknown): Promise<Buffer> => {
  if (!data) return throwDerivativeError("unsupported_input", "source_download_empty");
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
  return throwDerivativeError("unsupported_input", "source_download_unreadable");
};

const downloadSourceImageBuffer = async ({
  supabaseAdmin,
  sourcePath,
}: {
  supabaseAdmin: SupabaseAdminClient;
  sourcePath: string;
}): Promise<Buffer> => {
  const { data, error } = await supabaseAdmin.storage.from(MEDIA_BUCKET).download(sourcePath);
  if (error || !data) {
    throwDerivativeError("unsupported_input", error?.message ?? "source_download_failed");
  }
  const buffer = await toBufferFromDownload(data);
  if (!buffer.byteLength) throwDerivativeError("unsupported_input", "source_download_empty");
  return buffer;
};

const encodeVariantBuffer = async ({
  sourceBuffer,
  spec,
}: {
  sourceBuffer: Buffer;
  spec: DerivativeVariantSpec;
}): Promise<Buffer> => {
  try {
    return await sharp(sourceBuffer, { failOn: "error" })
      .rotate()
      .resize({
        width: spec.width,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: spec.quality })
      .toBuffer();
  } catch (error) {
    return throwDerivativeError(
      "decode_failed",
      error instanceof Error ? error.message : "encode_failed"
    );
  }
};

const uploadVariantObject = async ({
  supabaseAdmin,
  storagePath,
  body,
}: {
  supabaseAdmin: SupabaseAdminClient;
  storagePath: string;
  body: Buffer;
}): Promise<void> => {
  const { error } = await supabaseAdmin.storage.from(MEDIA_BUCKET).upload(storagePath, body, {
    contentType: DERIVATIVE_MIME_TYPE,
    upsert: true,
  });
  if (error) {
    throwDerivativeError("upload_failed", error.message);
  }
};

const writeVariantRow = async ({
  supabaseAdmin,
  mediaFileId,
  userId,
  spec,
  byteSize,
}: {
  supabaseAdmin: SupabaseAdminClient;
  mediaFileId: string;
  userId: string;
  spec: DerivativeVariantSpec;
  byteSize: number;
}): Promise<void> => {
  const { error } = await supabaseAdmin.from("media_asset_variants").upsert(
    {
      media_file_id: mediaFileId,
      user_id: userId,
      variant_kind: spec.variantKind,
      storage_path: spec.storagePath,
      mime_type: DERIVATIVE_MIME_TYPE,
      width: spec.width,
      byte_size: byteSize,
      status: "ready",
      metadata: {
        generated_by: "internal-media-derivatives-run",
        derivative_pipeline: "v3_local_sharp",
      },
    },
    {
      onConflict: "media_file_id,variant_kind",
    }
  );
  if (error) {
    throwDerivativeError("variant_upsert_failed", error.message);
  }
};

/**
 * Processes one claimed image row by generating/uploading derivative thumbs.
 * Returns the promoted thumb path for `media_files.thumb_variant_path`.
 */
export const processClaimedMediaDerivative = async ({
  row,
  flags,
  supabaseAdmin,
}: {
  row: ClaimedMediaDerivativeRow;
  flags: MediaDerivativesRuntimeFlags;
  supabaseAdmin: SupabaseAdminClient;
}): Promise<ProcessMediaDerivativeResult> => {
  if (!isSafeStoragePath(row.storage_path)) {
    throwDerivativeError("unsupported_input", "invalid_source_storage_path");
  }
  const sourcePath = assertUserScopedMediaStoragePath({
    path: row.storage_path,
    userId: row.user_id,
    label: "Claimed media source path",
  });

  const sourceBuffer = await downloadSourceImageBuffer({
    supabaseAdmin,
    sourcePath,
  });

  const specs = buildVariantSpecs(row.user_id, row.id, flags);
  let generatedVariants = 0;

  for (const spec of specs) {
    const encodedBuffer = await encodeVariantBuffer({
      sourceBuffer,
      spec,
    });
    if (!encodedBuffer.byteLength) {
      throwDerivativeError("decode_failed", "encoded_variant_empty");
    }

    await uploadVariantObject({
      supabaseAdmin,
      storagePath: spec.storagePath,
      body: encodedBuffer,
    });

    await writeVariantRow({
      supabaseAdmin,
      mediaFileId: row.id,
      userId: row.user_id,
      spec,
      byteSize: encodedBuffer.byteLength,
    });

    generatedVariants += 1;
  }

  const promotedThumb = specs.find((spec) => spec.variantKind === "thumb_480") ?? specs[0];
  if (!promotedThumb) {
    throw new Error("No derivative variants were generated.");
  }

  return {
    thumbPath: promotedThumb.storagePath,
    width: promotedThumb.width,
    generatedVariants,
  };
};
