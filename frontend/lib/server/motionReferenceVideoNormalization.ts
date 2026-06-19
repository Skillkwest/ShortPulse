/**
 * Server-side Motion Control source video normalization.
 * Enforces provider duration/format requirements before a motion reference reaches Kie.
 */
import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";
import ffmpegStatic from "ffmpeg-static";
import {
  createTempDir,
  makeTempFileHandle,
  probeMediaDurationSeconds,
} from "./mediaAudioExtraction";
import { detectVideoMimeType } from "./uploadSignature";

const execFileAsync = promisify(execFile);

export const MOTION_REFERENCE_VIDEO_MIN_DURATION_SECONDS = 3;
export const MOTION_REFERENCE_VIDEO_MAX_DURATION_SECONDS = 30;
export const MOTION_REFERENCE_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const MOTION_REFERENCE_VIDEO_MIN_DIMENSION_PX = 341;
export const MOTION_REFERENCE_VIDEO_MIN_ASPECT_RATIO = 2 / 5;
export const MOTION_REFERENCE_VIDEO_MAX_ASPECT_RATIO = 5 / 2;

const SOURCE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
  "video/webm": "webm",
};

export class MotionReferenceVideoNormalizationError extends Error {
  readonly status: number;
  readonly details?: string;

  constructor(status: number, message: string, details?: string) {
    super(message);
    this.name = "MotionReferenceVideoNormalizationError";
    this.status = status;
    this.details = details;
  }
}

const resolveSourceExtension = ({
  filename,
  mimeType,
}: {
  filename: string;
  mimeType: string;
}): string => {
  const extension = path.extname(filename).replace(/^\./, "").trim().toLowerCase();
  return extension || SOURCE_EXTENSION_BY_MIME_TYPE[mimeType] || "bin";
};

const replaceFileExtension = (filename: string, extension: string): string => {
  const parsed = path.parse(filename.trim() || "motion-reference");
  const baseName = parsed.name || parsed.base || "motion-reference";
  return `${baseName}.${extension}`;
};

const parseVideoDimensions = (value: string): { width: number; height: number } | null => {
  const match = value.match(/Video:[^\n\r]*?[, ](\d{2,5})x(\d{2,5})(?:[, \n\r]|$)/i);
  if (!match) return null;
  const width = Number.parseInt(match[1] ?? "", 10);
  const height = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
};

const probeMotionReferenceVideoDimensions = async ({
  buffer,
  filename,
  mimeType,
}: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<{ width: number; height: number } | null> => {
  if (!ffmpegStatic) {
    throw new MotionReferenceVideoNormalizationError(
      503,
      "Motion reference video preparation is temporarily unavailable."
    );
  }

  const inputHandle = await makeTempFileHandle({
    buffer,
    extension: resolveSourceExtension({ filename, mimeType }),
  });
  try {
    try {
      const { stdout, stderr } = await execFileAsync(ffmpegStatic, [
        "-hide_banner",
        "-i",
        inputHandle.path,
        "-f",
        "null",
        "-",
      ]);
      return parseVideoDimensions(`${stdout}\n${stderr}`);
    } catch (error) {
      const stderr =
        typeof (error as { stderr?: unknown }).stderr === "string"
          ? (error as { stderr: string }).stderr
          : error instanceof Error
            ? error.message
            : "";
      return parseVideoDimensions(stderr);
    }
  } finally {
    await inputHandle.cleanup().catch(() => undefined);
  }
};

const assertMotionReferenceDuration = async ({
  buffer,
  filename,
  mimeType,
}: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<void> => {
  let durationSeconds: number | null = null;
  try {
    durationSeconds = await probeMediaDurationSeconds({ buffer, filename, mimeType });
  } catch {
    durationSeconds = null;
  }

  if (!durationSeconds) {
    throw new MotionReferenceVideoNormalizationError(
      400,
      "Invalid motion reference video",
      "Motion reference video must be a playable video between 3 and 30 seconds."
    );
  }

  if (
    durationSeconds < MOTION_REFERENCE_VIDEO_MIN_DURATION_SECONDS ||
    durationSeconds > MOTION_REFERENCE_VIDEO_MAX_DURATION_SECONDS
  ) {
    throw new MotionReferenceVideoNormalizationError(
      400,
      "Invalid motion reference video",
      "Motion reference video must be between 3 and 30 seconds."
    );
  }
};

const transcodeMotionReferenceToMp4 = async ({
  buffer,
  filename,
  mimeType,
  maxBytes,
}: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  maxBytes: number;
}): Promise<Buffer> => {
  if (!ffmpegStatic) {
    throw new MotionReferenceVideoNormalizationError(
      503,
      "Motion reference video preparation is temporarily unavailable."
    );
  }

  const inputHandle = await makeTempFileHandle({
    buffer,
    extension: resolveSourceExtension({ filename, mimeType }),
  });
  const outputDir = await createTempDir();
  const outputPath = path.join(outputDir, "motion-reference.mp4");

  try {
    await execFileAsync(ffmpegStatic, [
      "-y",
      "-i",
      inputHandle.path,
      "-vf",
      "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
    const normalizedBuffer = await fs.readFile(outputPath);
    if (detectVideoMimeType(normalizedBuffer) !== "video/mp4") {
      throw new Error("Normalized video did not produce an MP4 container.");
    }
    if (normalizedBuffer.length > maxBytes) {
      throw new MotionReferenceVideoNormalizationError(
        413,
        "Invalid motion reference video",
        "Motion reference video must be under Kie's 100 MB provider limit after preparation."
      );
    }
    return normalizedBuffer;
  } catch (error) {
    if (error instanceof MotionReferenceVideoNormalizationError) throw error;
    throw new MotionReferenceVideoNormalizationError(
      400,
      "Invalid motion reference video",
      "Motion reference video could not be converted to MP4."
    );
  } finally {
    await fs.unlink(outputPath).catch(() => undefined);
    await fs.rm(outputDir, { recursive: true, force: true }).catch(() => undefined);
    await inputHandle.cleanup().catch(() => undefined);
  }
};

const assertMotionReferenceDimensions = async ({
  buffer,
  filename,
  mimeType,
  minDimensionPx,
  minAspectRatio,
  maxAspectRatio,
}: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  minDimensionPx: number;
  minAspectRatio: number;
  maxAspectRatio: number;
}): Promise<void> => {
  const dimensions = await probeMotionReferenceVideoDimensions({ buffer, filename, mimeType });
  if (!dimensions) return;
  if (dimensions.width < minDimensionPx || dimensions.height < minDimensionPx) {
    throw new MotionReferenceVideoNormalizationError(
      400,
      "Invalid motion reference video",
      "Motion reference video must be at least 341 px wide and 341 px tall."
    );
  }
  const aspectRatio = dimensions.width / dimensions.height;
  if (aspectRatio < minAspectRatio || aspectRatio > maxAspectRatio) {
    throw new MotionReferenceVideoNormalizationError(
      400,
      "Invalid motion reference video",
      "Motion reference video aspect ratio must be between 2:5 and 5:2."
    );
  }
};

/**
 * Returns a provider-ready Motion Control source video buffer.
 */
export const normalizeMotionReferenceVideoForProvider = async ({
  buffer,
  filename,
  mimeType,
  maxBytes = MOTION_REFERENCE_VIDEO_MAX_BYTES,
  minDimensionPx = MOTION_REFERENCE_VIDEO_MIN_DIMENSION_PX,
  minAspectRatio = MOTION_REFERENCE_VIDEO_MIN_ASPECT_RATIO,
  maxAspectRatio = MOTION_REFERENCE_VIDEO_MAX_ASPECT_RATIO,
}: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  maxBytes?: number;
  minDimensionPx?: number;
  minAspectRatio?: number;
  maxAspectRatio?: number;
}): Promise<{
  buffer: Buffer;
  filename: string;
  mimeType: "video/mp4";
}> => {
  await assertMotionReferenceDuration({ buffer, filename, mimeType });

  const normalizedBuffer = await transcodeMotionReferenceToMp4({
    buffer,
    filename,
    mimeType,
    maxBytes,
  });
  await assertMotionReferenceDimensions({
    buffer: normalizedBuffer,
    filename: replaceFileExtension(filename, "mp4"),
    mimeType: "video/mp4",
    minDimensionPx,
    minAspectRatio,
    maxAspectRatio,
  });
  return {
    buffer: normalizedBuffer,
    filename: replaceFileExtension(filename, "mp4"),
    mimeType: "video/mp4",
  };
};
