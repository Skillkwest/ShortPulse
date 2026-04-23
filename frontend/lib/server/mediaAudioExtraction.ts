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
