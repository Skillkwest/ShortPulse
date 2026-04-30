/**
 * Server-side video poster variant helpers.
 * Extracts a first-frame poster from generated/uploaded videos and records it as a durable media variant.
 */
import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import ffmpegStatic from "ffmpeg-static";
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { extractImageDimensionsFromBuffer } from "./imageDimensions";
import type { getSupabaseAdmin } from "./api/supabaseAdmin";

const execFileAsync = promisify(execFile);
const MEDIA_BUCKET = "media_library";
const VIDEO_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
  "video/webm": "webm",
};

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

const normalizeMimeType = (value: string | null | undefined): string | null => {
  const normalized = value?.split(";")[0]?.trim().toLowerCase() ?? "";
  return normalized || null;
};

const resolveVideoExtension = ({
  filename,
  mimeType,
}: {
  filename?: string | null;
  mimeType?: string | null;
}): string => {
  const fromName = path
    .extname(filename ?? "")
    .replace(/^\./, "")
    .trim()
    .toLowerCase();
  if (fromName) return fromName;
  return VIDEO_EXTENSION_BY_MIME_TYPE[normalizeMimeType(mimeType) ?? ""] ?? "mp4";
};

const createTempDir = async (): Promise<string> =>
  fs.mkdtemp(path.join(os.tmpdir(), "shortpulse-video-poster-"));

const removeTempDir = async (dir: string): Promise<void> => {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
};

/**
 * Extracts a JPEG poster from the first decodable frame of a video buffer.
 */
export const extractVideoPosterBuffer = async ({
  videoBuffer,
  videoMimeType,
  filename,
}: {
  videoBuffer: Buffer;
  videoMimeType?: string | null;
  filename?: string | null;
}): Promise<Buffer | null> => {
  if (!ffmpegStatic) return null;
  const tempDir = await createTempDir();
  const inputPath = path.join(
    tempDir,
    `source.${resolveVideoExtension({ filename, mimeType: videoMimeType })}`
  );
  const outputPath = path.join(tempDir, "poster.jpg");

  try {
    await fs.writeFile(inputPath, videoBuffer);
    await execFileAsync(ffmpegStatic, [
      "-y",
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-q:v",
      "3",
      outputPath,
    ]);
    return await fs.readFile(outputPath);
  } catch {
    return null;
  } finally {
    await removeTempDir(tempDir);
  }
};

/**
 * Creates or replaces a media-library poster_720 variant from a video buffer.
 */
export const upsertVideoPosterVariantFromBuffer = async ({
  supabaseAdmin,
  userId,
  mediaFileId,
  videoBuffer,
  videoMimeType,
  filename,
  metadata = {},
}: {
  supabaseAdmin: SupabaseAdminClient;
  userId: string;
  mediaFileId: string;
  videoBuffer: Buffer;
  videoMimeType?: string | null;
  filename?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<string | null> => {
  const posterBuffer = await extractVideoPosterBuffer({
    videoBuffer,
    videoMimeType,
    filename,
  });
  if (!posterBuffer) return null;

  const storagePath = assertUserScopedMediaStoragePath({
    path: `${userId}/variants/videos/${mediaFileId}/poster_720.jpg`,
    userId,
    label: "Generated video poster storage path",
  });

  const { error: uploadError } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, posterBuffer, {
      upsert: true,
      contentType: "image/jpeg",
    });
  if (uploadError) return null;

  const dimensions = extractImageDimensionsFromBuffer(posterBuffer);
  const { error: variantError } = await supabaseAdmin.from("media_asset_variants").upsert(
    {
      media_file_id: mediaFileId,
      user_id: userId,
      variant_kind: "poster_720",
      storage_path: storagePath,
      mime_type: "image/jpeg",
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      byte_size: posterBuffer.byteLength,
      status: "ready",
      metadata: {
        generated_by: "server_video_poster_variant",
        ...metadata,
      },
    },
    {
      onConflict: "media_file_id,variant_kind",
    }
  );
  if (variantError) return null;

  const { error: updateError } = await supabaseAdmin
    .from("media_files")
    .update({
      poster_variant_path: storagePath,
    })
    .eq("id", mediaFileId)
    .eq("user_id", userId);
  if (updateError) return null;

  return storagePath;
};

/**
 * Returns a signed URL for a durable poster variant.
 */
export const signVideoPosterVariant = async ({
  supabaseAdmin,
  storagePath,
}: {
  supabaseAdmin: SupabaseAdminClient;
  storagePath: string | null;
}): Promise<string | null> => {
  if (!storagePath) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
};
