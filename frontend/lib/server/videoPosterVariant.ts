/**
 * Server-side video preview helpers.
 * Extracts durable poster and preview-loop variants from generated/uploaded videos.
 */
import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import ffmpegStatic from "ffmpeg-static";
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { DURABLE_MEDIA_CACHE_CONTROL_SECONDS } from "./mediaIngest";
import { extractImageDimensionsFromBuffer } from "./imageDimensions";
import type { getSupabaseAdmin } from "./api/supabaseAdmin";

const execFileAsync = promisify(execFile);
const MEDIA_BUCKET = "media_library";
export const VIDEO_PREVIEW_SCALE_FILTER =
  "scale=360:-2:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2";
export const VIDEO_PREVIEW_SECONDS = 3;
export const VIDEO_PREVIEW_CRF = 30;
export const VIDEO_PREVIEW_FPS: number | null = null;
export const VIDEO_PREVIEW_PROFILE: VideoPreviewProfile | null = null;
export const VIDEO_PREVIEW_PRESET: VideoPreviewPreset = "veryfast";
export const VIDEO_POSTER_SEEK_SECONDS = 0.5;
export const VIDEO_POSTER_FILTER = "thumbnail,scale=720:-2:force_original_aspect_ratio=decrease";
export const VIDEO_POSTER_JPEG_QUALITY = 2;
const VIDEO_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
  "video/webm": "webm",
};

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;
type VideoPreviewProfile = "baseline" | "main" | "high";
type VideoPreviewPreset =
  | "ultrafast"
  | "superfast"
  | "veryfast"
  | "faster"
  | "fast"
  | "medium"
  | "slow"
  | "slower";

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
 * Builds ffmpeg arguments for extracting a non-zero representative poster frame.
 */
export const buildVideoPosterExtractionArgs = ({
  inputPath,
  outputPath,
  seekSeconds = VIDEO_POSTER_SEEK_SECONDS,
  posterFilter = VIDEO_POSTER_FILTER,
  jpegQuality = VIDEO_POSTER_JPEG_QUALITY,
}: {
  inputPath: string;
  outputPath: string;
  seekSeconds?: number;
  posterFilter?: string;
  jpegQuality?: number;
}): string[] => {
  const normalizedSeekSeconds =
    Number.isFinite(seekSeconds) && seekSeconds > 0 ? seekSeconds : VIDEO_POSTER_SEEK_SECONDS;
  const normalizedPosterFilter =
    (posterFilter ?? VIDEO_POSTER_FILTER).trim() || VIDEO_POSTER_FILTER;
  const normalizedJpegQuality =
    Number.isFinite(jpegQuality) && jpegQuality >= 2 && jpegQuality <= 31
      ? Math.trunc(jpegQuality)
      : VIDEO_POSTER_JPEG_QUALITY;
  return [
    "-y",
    "-ss",
    String(normalizedSeekSeconds),
    "-i",
    inputPath,
    "-vf",
    normalizedPosterFilter,
    "-frames:v",
    "1",
    "-q:v",
    String(normalizedJpegQuality),
    outputPath,
  ];
};

const buildFallbackFirstFramePosterExtractionArgs = ({
  inputPath,
  outputPath,
  posterFilter = VIDEO_POSTER_FILTER,
  jpegQuality = 3,
}: {
  inputPath: string;
  outputPath: string;
  posterFilter?: string;
  jpegQuality?: number;
}): string[] => {
  const normalizedPosterFilter =
    (posterFilter ?? VIDEO_POSTER_FILTER).trim() || VIDEO_POSTER_FILTER;
  const normalizedJpegQuality =
    Number.isFinite(jpegQuality) && jpegQuality >= 2 && jpegQuality <= 31
      ? Math.trunc(jpegQuality)
      : 3;
  return [
    "-y",
    "-i",
    inputPath,
    "-vf",
    normalizedPosterFilter,
    "-frames:v",
    "1",
    "-q:v",
    String(normalizedJpegQuality),
    outputPath,
  ];
};

/**
 * Builds ffmpeg arguments for a silent MP4 preview/display derivative.
 */
export const buildVideoPreviewVariantExtractionArgs = ({
  inputPath,
  outputPath,
  scaleFilter = VIDEO_PREVIEW_SCALE_FILTER,
  previewSeconds = VIDEO_PREVIEW_SECONDS,
  crf = VIDEO_PREVIEW_CRF,
  fps = VIDEO_PREVIEW_FPS,
  profile = VIDEO_PREVIEW_PROFILE,
  preset = VIDEO_PREVIEW_PRESET,
  maxRate = null,
  bufSize = null,
}: {
  inputPath: string;
  outputPath: string;
  scaleFilter?: string;
  previewSeconds?: number | null;
  crf?: number;
  fps?: number | null;
  profile?: string | null;
  preset?: string | null;
  maxRate?: string | null;
  bufSize?: string | null;
}): string[] => {
  const normalizedScaleFilter = scaleFilter.trim() || VIDEO_PREVIEW_SCALE_FILTER;
  const normalizedCrf =
    Number.isFinite(crf) && crf >= 0 && crf <= 51 ? Math.trunc(crf) : VIDEO_PREVIEW_CRF;
  const normalizedProfile =
    profile === "baseline" || profile === "main" || profile === "high"
      ? profile
      : VIDEO_PREVIEW_PROFILE;
  const normalizedPreset =
    preset === "ultrafast" ||
    preset === "superfast" ||
    preset === "veryfast" ||
    preset === "faster" ||
    preset === "fast" ||
    preset === "medium" ||
    preset === "slow" ||
    preset === "slower"
      ? preset
      : VIDEO_PREVIEW_PRESET;
  const normalizedMaxRate =
    typeof maxRate === "string" && /^\d+[kKmM]$/.test(maxRate.trim()) ? maxRate.trim() : null;
  const normalizedBufSize =
    typeof bufSize === "string" && /^\d+[kKmM]$/.test(bufSize.trim()) ? bufSize.trim() : null;
  const normalizedFps =
    fps === null
      ? null
      : Number.isFinite(fps) && fps > 0 && fps <= 60
        ? Math.trunc(fps)
        : VIDEO_PREVIEW_FPS;
  const normalizedVideoFilter = normalizedFps
    ? `${normalizedScaleFilter},fps=${normalizedFps}`
    : normalizedScaleFilter;
  const normalizedPreviewSeconds =
    previewSeconds === null
      ? null
      : Number.isFinite(previewSeconds) && previewSeconds > 0
        ? previewSeconds
        : VIDEO_PREVIEW_SECONDS;
  const args = ["-y", "-i", inputPath, "-an"];
  if (normalizedPreviewSeconds !== null) {
    args.push("-t", String(normalizedPreviewSeconds));
  }
  args.push("-vf", normalizedVideoFilter, "-c:v", "libx264");
  if (normalizedProfile) {
    args.push("-profile:v", normalizedProfile);
  }
  args.push("-preset", normalizedPreset, "-crf", String(normalizedCrf));
  if (normalizedMaxRate) {
    args.push("-maxrate", normalizedMaxRate);
  }
  if (normalizedBufSize) {
    args.push("-bufsize", normalizedBufSize);
  }
  args.push("-pix_fmt", "yuv420p", "-movflags", "+faststart", outputPath);
  return args;
};

/**
 * Extracts a JPEG poster from a representative early video frame.
 */
export const extractVideoPosterBuffer = async ({
  videoBuffer,
  videoMimeType,
  filename,
  posterFilter,
  jpegQuality,
}: {
  videoBuffer: Buffer;
  videoMimeType?: string | null;
  filename?: string | null;
  posterFilter?: string;
  jpegQuality?: number;
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
    try {
      await execFileAsync(
        ffmpegStatic,
        buildVideoPosterExtractionArgs({
          inputPath,
          outputPath,
          posterFilter,
          jpegQuality,
        })
      );
    } catch {
      await execFileAsync(
        ffmpegStatic,
        buildFallbackFirstFramePosterExtractionArgs({
          inputPath,
          outputPath,
          posterFilter,
          jpegQuality,
        })
      );
    }
    return await fs.readFile(outputPath);
  } catch {
    return null;
  } finally {
    await removeTempDir(tempDir);
  }
};

/**
 * Extracts a short MP4 preview loop from the first decodable seconds of a video buffer.
 */
export const extractVideoPreviewVariantBuffer = async ({
  videoBuffer,
  videoMimeType,
  filename,
  scaleFilter,
  previewSeconds,
  crf,
  fps,
  profile,
  preset,
  maxRate,
  bufSize,
  outputBasename = "preview_loop_360p.mp4",
}: {
  videoBuffer: Buffer;
  videoMimeType?: string | null;
  filename?: string | null;
  scaleFilter?: string;
  previewSeconds?: number | null;
  crf?: number;
  fps?: number | null;
  profile?: string | null;
  preset?: string | null;
  maxRate?: string | null;
  bufSize?: string | null;
  outputBasename?: string;
}): Promise<Buffer | null> => {
  if (!ffmpegStatic) return null;
  const tempDir = await createTempDir();
  const inputPath = path.join(
    tempDir,
    `source.${resolveVideoExtension({ filename, mimeType: videoMimeType })}`
  );
  const outputPath = path.join(tempDir, outputBasename);

  try {
    await fs.writeFile(inputPath, videoBuffer);
    await execFileAsync(
      ffmpegStatic,
      buildVideoPreviewVariantExtractionArgs({
        inputPath,
        outputPath,
        scaleFilter,
        previewSeconds,
        crf,
        fps,
        profile,
        preset,
        maxRate,
        bufSize,
      })
    );
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
      cacheControl: DURABLE_MEDIA_CACHE_CONTROL_SECONDS,
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
 * Creates or replaces a media-library preview_loop_360p variant from a video buffer.
 */
export const upsertVideoPreviewVariantFromBuffer = async ({
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
  const previewBuffer = await extractVideoPreviewVariantBuffer({
    videoBuffer,
    videoMimeType,
    filename,
  });
  if (!previewBuffer) return null;

  const storagePath = assertUserScopedMediaStoragePath({
    path: `${userId}/variants/videos/${mediaFileId}/preview_loop_360p.mp4`,
    userId,
    label: "Generated video preview storage path",
  });

  const { error: uploadError } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, previewBuffer, {
      upsert: true,
      contentType: "video/mp4",
      cacheControl: DURABLE_MEDIA_CACHE_CONTROL_SECONDS,
    });
  if (uploadError) return null;

  const { error: variantError } = await supabaseAdmin.from("media_asset_variants").upsert(
    {
      media_file_id: mediaFileId,
      user_id: userId,
      variant_kind: "preview_loop_360p",
      storage_path: storagePath,
      mime_type: "video/mp4",
      width: null,
      height: null,
      duration_seconds: null,
      byte_size: previewBuffer.byteLength,
      status: "ready",
      metadata: {
        generated_by: "server_video_preview_variant",
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
      preview_variant_path: storagePath,
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
