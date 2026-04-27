import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import ffmpegStatic from "ffmpeg-static";
import { getSupabaseAdmin } from "./api/supabaseAdmin";

const execFileAsync = promisify(execFile);
const MEDIA_BUCKET = "media_library";
const VIDEO_EXTENSION_PATTERN = /\.(m4v|mov|mp4|webm)(?:$|[?#])/i;
const VIDEO_MIME_PATTERN = /^video\//i;
const AUDIO_MIME_PATTERN = /^audio\//i;
export const MAX_VOICE_CHANGER_SOURCE_BYTES = 40 * 1024 * 1024;
const AUDIO_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
};
const VIDEO_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
  "video/webm": "webm",
};
const DURATION_PATTERN = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i;

export type TempFileHandle = {
  path: string;
  cleanup: () => Promise<void>;
};

export class MediaAudioExtractionInputError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "MediaAudioExtractionInputError";
    this.statusCode = statusCode;
  }
}

const formatBytes = (bytes: number): string => {
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1) {
    return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
  }
  const kilobytes = bytes / 1024;
  return `${kilobytes.toFixed(kilobytes >= 10 ? 0 : 1)} KB`;
};

const assertByteLimit = ({
  byteLength,
  maxBytes,
}: {
  byteLength: number;
  maxBytes: number | null;
}): void => {
  if (maxBytes !== null && byteLength > maxBytes) {
    throw new MediaAudioExtractionInputError(
      `Voice changer source videos must be ${formatBytes(maxBytes)} or smaller. Trim the clip and try again.`,
      413
    );
  }
};

export const createTempDir = async (): Promise<string> => {
  return await fs.mkdtemp(path.join(os.tmpdir(), "shortpulse-media-audio-"));
};

export const makeTempFileHandle = async ({
  buffer,
  extension,
}: {
  buffer: Buffer;
  extension: string;
}): Promise<TempFileHandle> => {
  const dir = await createTempDir();
  const filePath = path.join(dir, `source.${extension.replace(/^\./, "")}`);
  await fs.writeFile(filePath, buffer);
  return {
    path: filePath,
    cleanup: async () => {
      await fs.unlink(filePath).catch(() => undefined);
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    },
  };
};

const parseDurationSeconds = (value: string): number | null => {
  const match = value.match(DURATION_PATTERN);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  if (![hours, minutes, seconds].every((part) => Number.isFinite(part) && part >= 0)) {
    return null;
  }
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;
  return Number(totalSeconds.toFixed(3));
};

const resolveSourceExtension = ({
  filename,
  mimeType,
}: {
  filename: string | null;
  mimeType: string | null;
}): string => {
  const filenameExtension = path
    .extname(filename ?? "")
    .replace(/^\./, "")
    .trim()
    .toLowerCase();
  if (filenameExtension) return filenameExtension;
  const normalizedMimeType = mimeType?.trim().toLowerCase() ?? "";
  return (
    AUDIO_EXTENSION_BY_MIME_TYPE[normalizedMimeType] ??
    VIDEO_EXTENSION_BY_MIME_TYPE[normalizedMimeType] ??
    "bin"
  );
};

export const isVideoSource = (mimeType: string | null, filename: string | null): boolean => {
  if (mimeType && VIDEO_MIME_PATTERN.test(mimeType)) return true;
  if (mimeType && AUDIO_MIME_PATTERN.test(mimeType)) return false;
  return VIDEO_EXTENSION_PATTERN.test(filename ?? "");
};

export const extractAudioTrack = async ({
  sourcePath,
}: {
  sourcePath: string;
}): Promise<TempFileHandle> => {
  if (!ffmpegStatic) {
    throw new Error("FFmpeg runtime is unavailable.");
  }

  const dir = await createTempDir();
  const outputPath = path.join(dir, "extracted.wav");
  try {
    await execFileAsync(ffmpegStatic, [
      "-y",
      "-i",
      sourcePath,
      "-map",
      "0:a:0",
      "-vn",
      "-ac",
      "1",
      "-ar",
      "44100",
      "-c:a",
      "pcm_s16le",
      outputPath,
    ]);
  } catch (error) {
    const detail = error instanceof Error && error.message.trim() ? error.message.trim() : "";
    await fs.unlink(outputPath).catch(() => undefined);
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    throw new Error(
      detail
        ? `Unable to extract audio from the provided video. ${detail}`
        : "Unable to extract audio from the provided video."
    );
  }

  return {
    path: outputPath,
    cleanup: async () => {
      await fs.unlink(outputPath).catch(() => undefined);
      await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    },
  };
};

export const probeMediaDurationSeconds = async ({
  buffer,
  filename,
  mimeType,
}: {
  buffer: Buffer;
  filename: string | null;
  mimeType: string | null;
}): Promise<number | null> => {
  if (!ffmpegStatic) {
    throw new Error("FFmpeg runtime is unavailable.");
  }

  const sourceHandle = await makeTempFileHandle({
    buffer,
    extension: resolveSourceExtension({ filename, mimeType }),
  });
  try {
    try {
      const { stdout, stderr } = await execFileAsync(ffmpegStatic, [
        "-hide_banner",
        "-i",
        sourceHandle.path,
        "-f",
        "null",
        "-",
      ]);
      return parseDurationSeconds(`${stdout}\n${stderr}`);
    } catch (error) {
      const stderr =
        typeof (error as { stderr?: unknown }).stderr === "string"
          ? (error as { stderr: string }).stderr
          : error instanceof Error
            ? error.message
            : "";
      return parseDurationSeconds(stderr);
    }
  } finally {
    await sourceHandle.cleanup().catch(() => undefined);
  }
};

const resolveAudioExtension = (mimeType: string | null, fallback = "wav"): string => {
  const normalizedMimeType = mimeType?.trim().toLowerCase() ?? "";
  return AUDIO_EXTENSION_BY_MIME_TYPE[normalizedMimeType] ?? fallback;
};

const resolveVideoContainerPlan = ({
  mimeType,
  filename,
}: {
  mimeType: string | null;
  filename: string | null;
}): {
  extension: "mp4" | "webm";
  contentType: "video/mp4" | "video/webm";
  ffmpegArgs: string[];
  fallbackFfmpegArgs?: string[];
} => {
  const normalizedMimeType = mimeType?.trim().toLowerCase() ?? "";
  const normalizedFilename = filename?.trim().toLowerCase() ?? "";
  const declaredExtension =
    VIDEO_EXTENSION_BY_MIME_TYPE[normalizedMimeType] ??
    normalizedFilename
      .split(".")
      .pop()
      ?.replace(/[^a-z0-9]+/g, "") ??
    "";

  if (declaredExtension === "webm") {
    return {
      extension: "webm",
      contentType: "video/webm",
      ffmpegArgs: ["-c:v", "copy", "-c:a", "libopus", "-b:a", "128k"],
    };
  }

  return {
    extension: "mp4",
    contentType: "video/mp4",
    ffmpegArgs: ["-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"],
    fallbackFfmpegArgs: [
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
      "192k",
      "-movflags",
      "+faststart",
    ],
  };
};

export const remuxVideoWithAudioTrack = async ({
  videoBuffer,
  videoFilename,
  videoMimeType,
  audioBuffer,
  audioMimeType,
}: {
  videoBuffer: Buffer;
  videoFilename: string;
  videoMimeType: string | null;
  audioBuffer: Buffer;
  audioMimeType: string | null;
}): Promise<{
  buffer: Buffer;
  contentType: "video/mp4" | "video/webm";
  extension: "mp4" | "webm";
}> => {
  if (!ffmpegStatic) {
    throw new Error("FFmpeg runtime is unavailable.");
  }
  const ffmpegPath = ffmpegStatic;

  const videoExtension =
    path.extname(videoFilename).replace(/^\./, "") ||
    VIDEO_EXTENSION_BY_MIME_TYPE[videoMimeType?.trim().toLowerCase() ?? ""] ||
    "mp4";
  const audioExtension = resolveAudioExtension(audioMimeType);
  const videoHandle = await makeTempFileHandle({
    buffer: videoBuffer,
    extension: videoExtension,
  });
  const audioHandle = await makeTempFileHandle({
    buffer: audioBuffer,
    extension: audioExtension,
  });
  const outputDir = await createTempDir();
  const plan = resolveVideoContainerPlan({
    mimeType: videoMimeType,
    filename: videoFilename,
  });
  const outputPath = path.join(outputDir, `remuxed.${plan.extension}`);

  try {
    const runRemux = async (ffmpegArgs: string[]) => {
      await execFileAsync(ffmpegPath, [
        "-y",
        "-i",
        videoHandle.path,
        "-i",
        audioHandle.path,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        ...ffmpegArgs,
        "-shortest",
        outputPath,
      ]);
    };

    try {
      await runRemux(plan.ffmpegArgs);
    } catch (error) {
      if (!plan.fallbackFfmpegArgs) {
        throw error;
      }
      await runRemux(plan.fallbackFfmpegArgs);
    }
    const buffer = await fs.readFile(outputPath);
    return {
      buffer,
      contentType: plan.contentType,
      extension: plan.extension,
    };
  } catch (error) {
    const detail = error instanceof Error && error.message.trim() ? error.message.trim() : "";
    throw new Error(
      detail
        ? `Unable to combine the converted audio with the source video. ${detail}`
        : "Unable to combine the converted audio with the source video."
    );
  } finally {
    await fs.unlink(outputPath).catch(() => undefined);
    await fs.rm(outputDir, { recursive: true, force: true }).catch(() => undefined);
    await audioHandle.cleanup().catch(() => undefined);
    await videoHandle.cleanup().catch(() => undefined);
  }
};

export const readStoredMediaBuffer = async ({
  storagePath,
  maxBytes = null,
}: {
  storagePath: string;
  maxBytes?: number | null;
}): Promise<{ buffer: Buffer; contentType: string | null; size: number }> => {
  const { data, error } = await getSupabaseAdmin().storage.from(MEDIA_BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(error?.message || "Unable to download stored media.");
  }
  assertByteLimit({ byteLength: data.size, maxBytes });
  const arrayBuffer = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: data.type || null,
    size: data.size,
  };
};

export const readRemoteMediaBuffer = async ({
  sourceUrl,
  maxBytes = null,
}: {
  sourceUrl: string;
  maxBytes?: number | null;
}): Promise<{ buffer: Buffer; contentType: string | null; size: number }> => {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Unable to fetch source media (${response.status}).`);
  }

  const contentLengthHeader = response.headers.get("content-length");
  const contentLength = Number.parseInt(contentLengthHeader ?? "", 10);
  if (Number.isFinite(contentLength)) {
    assertByteLimit({ byteLength: contentLength, maxBytes });
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const arrayBuffer = await response.arrayBuffer();
    assertByteLimit({ byteLength: arrayBuffer.byteLength, maxBytes });
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get("content-type"),
      size: arrayBuffer.byteLength,
    };
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      totalBytes += chunk.byteLength;
      assertByteLimit({ byteLength: totalBytes, maxBytes });
      chunks.push(chunk);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }

  return {
    buffer: Buffer.concat(chunks, totalBytes),
    contentType: response.headers.get("content-type"),
    size: totalBytes,
  };
};
