/**
 * Media derivative processor for image `media_files` rows.
 * Generates transformed thumbs, uploads variants, and updates variant metadata rows.
 */
import { assertUserScopedMediaStoragePath } from "../../mediaStoragePath";
import type { MediaDerivativesRuntimeFlags } from "../api/mediaDerivativesRuntimeFlags";
import type { SupabaseClient } from "@supabase/supabase-js";

const MEDIA_BUCKET = "media_library";
const TRAVERSAL_SEGMENT_REGEX = /(?:^|\/)\.\.(?:\/|$)/;

type SupabaseAdminClient = SupabaseClient;

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

const isSafeStoragePath = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized.startsWith("/")) return false;
  if (normalized.includes("\\")) return false;
  if (TRAVERSAL_SEGMENT_REGEX.test(normalized)) return false;
  return true;
};

const toBuffer = async (response: Response): Promise<Buffer> => {
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const resolveMimeType = (response: Response): string => {
  const raw = response.headers.get("content-type")?.trim().toLowerCase() ?? "";
  const contentType = raw.split(";")[0] ?? "";
  if (!contentType.startsWith("image/")) {
    return "image/webp";
  }
  return contentType;
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

const signSourceTransform = async ({
  supabaseAdmin,
  sourcePath,
  expiresInSeconds,
  width,
  quality,
}: {
  supabaseAdmin: SupabaseAdminClient;
  sourcePath: string;
  expiresInSeconds: number;
  width: number;
  quality: number;
}): Promise<string> => {
  const { data, error } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(sourcePath, expiresInSeconds, {
      transform: {
        width,
        resize: "contain",
        quality,
      },
    });
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Unable to sign transformed source URL.");
  }
  return data.signedUrl;
};

const uploadVariant = async ({
  supabaseAdmin,
  storagePath,
  body,
  contentType,
}: {
  supabaseAdmin: SupabaseAdminClient;
  storagePath: string;
  body: Buffer;
  contentType: string;
}): Promise<void> => {
  const { error } = await supabaseAdmin.storage.from(MEDIA_BUCKET).upload(storagePath, body, {
    contentType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Variant upload failed: ${error.message}`);
  }
};

const upsertVariantRow = async ({
  supabaseAdmin,
  mediaFileId,
  userId,
  spec,
  contentType,
  byteSize,
}: {
  supabaseAdmin: SupabaseAdminClient;
  mediaFileId: string;
  userId: string;
  spec: DerivativeVariantSpec;
  contentType: string;
  byteSize: number;
}): Promise<void> => {
  const { error } = await supabaseAdmin.from("media_asset_variants").upsert(
    {
      media_file_id: mediaFileId,
      user_id: userId,
      variant_kind: spec.variantKind,
      storage_path: spec.storagePath,
      mime_type: contentType,
      width: spec.width,
      byte_size: byteSize,
      status: "ready",
      metadata: {
        generated_by: "internal-media-derivatives-run",
        derivative_pipeline: "v2",
      },
    },
    {
      onConflict: "media_file_id,variant_kind",
    }
  );
  if (error) {
    throw new Error(`Variant row upsert failed: ${error.message}`);
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
  fetchImpl = fetch,
}: {
  row: ClaimedMediaDerivativeRow;
  flags: MediaDerivativesRuntimeFlags;
  supabaseAdmin: SupabaseAdminClient;
  fetchImpl?: typeof fetch;
}): Promise<ProcessMediaDerivativeResult> => {
  if (!isSafeStoragePath(row.storage_path)) {
    throw new Error("Claim row has an invalid source storage path.");
  }
  const sourcePath = assertUserScopedMediaStoragePath({
    path: row.storage_path,
    userId: row.user_id,
    label: "Claimed media source path",
  });

  const specs = buildVariantSpecs(row.user_id, row.id, flags);
  let generatedVariants = 0;

  for (const spec of specs) {
    const signedTransformUrl = await signSourceTransform({
      supabaseAdmin,
      sourcePath,
      expiresInSeconds: flags.sourceSignedUrlTtlSeconds,
      width: spec.width,
      quality: spec.quality,
    });
    const response = await fetchImpl(signedTransformUrl, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Transformed source fetch failed (${response.status}).`);
    }
    const contentType = resolveMimeType(response);
    const body = await toBuffer(response);
    if (!body.byteLength) {
      throw new Error("Transformed derivative payload is empty.");
    }

    await uploadVariant({
      supabaseAdmin,
      storagePath: spec.storagePath,
      body,
      contentType,
    });

    await upsertVariantRow({
      supabaseAdmin,
      mediaFileId: row.id,
      userId: row.user_id,
      spec,
      contentType,
      byteSize: body.byteLength,
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
