/**
 * Server-side Voice Changer source-video normalization.
 * Compresses oversized source videos into processing-safe MP4s before extraction/remux.
 */
import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";
import ffmpegStatic from "ffmpeg-static";
import {
  createTempDir,
  makeTempFileHandle,
  MAX_VOICE_CHANGER_SOURCE_BYTES,
  probeMediaDurationSeconds,
} from "./mediaAudioExtraction";
import { detectVideoMimeType } from "./uploadSignature";

const execFileAsync = promisify(execFile);

const SOURCE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
  "video/webm": "webm",
};

const NORMALIZATION_PLANS = [
  { maxLongEdge: 1280, targetRatio: 0.92 },
  { maxLongEdge: 960, targetRatio: 0.8 },
  { maxLongEdge: 720, targetRatio: 0.68 },
] as const;

export class VoiceChangerSourceVideoNormalizationError extends Error {
  readonly status: number;
  readonly details?: string;

  constructor(status: number, message: string, details?: string) {
    super(message);
    this.name = "VoiceChangerSourceVideoNormalizationError";
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
  const parsed = path.parse(filename.trim() || "voice-changer-source");
  const baseName = parsed.name || parsed.base || "voice-changer-source";
  return `${baseName}.${extension}`;
};

const assertPlayableVideoDuration = async ({
  buffer,
  filename,
  mimeType,
}: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<number> => {
  let durationSeconds: number | null = null;
  try {
    durationSeconds = await probeMediaDurationSeconds({ buffer, filename, mimeType });
  } catch {
    durationSeconds = null;
  }

  if (!durationSeconds || durationSeconds <= 0) {
    throw new VoiceChangerSourceVideoNormalizationError(
      400,
      "Invalid voice changer source video",
      "Voice changer source video must be a playable video."
    );
  }

  return durationSeconds;
};

const calculateBitratePlan = ({
  durationSeconds,
  maxBytes,
  targetRatio,
}: {
  durationSeconds: number;
  maxBytes: number;
  targetRatio: number;
}): { videoKbps: number; audioKbps: number } => {
  const targetBytes = Math.floor(maxBytes * targetRatio);
  const totalKbps = Math.max(220, Math.floor((targetBytes * 8) / durationSeconds / 1000));
  const audioKbps = Math.min(128, Math.max(48, Math.floor(totalKbps * 0.15)));
  const videoKbps = Math.max(160, totalKbps - audioKbps);
  return { videoKbps, audioKbps };
};

const buildScaleFilter = (maxLongEdge: number): string =>
  [
    `if(gte(iw,ih),max(2,trunc(min(${maxLongEdge},iw)/2)*2),-2)`,
    `if(gte(iw,ih),-2,max(2,trunc(min(${maxLongEdge},ih)/2)*2))`,
  ].join(":");

/**
 * Returns an MP4 source video that fits the Voice Changer processing byte ceiling.
 */
export const normalizeVoiceChangerSourceVideoForProcessing = async ({
  buffer,
  filename,
  mimeType,
  maxBytes = MAX_VOICE_CHANGER_SOURCE_BYTES,
}: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  maxBytes?: number;
}): Promise<{
  buffer: Buffer;
  filename: string;
  mimeType: "video/mp4";
}> => {
  if (!ffmpegStatic) {
    throw new VoiceChangerSourceVideoNormalizationError(
      503,
      "Voice changer video preparation is temporarily unavailable."
    );
  }

  const durationSeconds = await assertPlayableVideoDuration({ buffer, filename, mimeType });
  const sourceHandle = await makeTempFileHandle({
    buffer,
    extension: resolveSourceExtension({ filename, mimeType }),
  });
  const outputDir = await createTempDir();
  const outputPath = path.join(outputDir, "voice-changer-source.mp4");

  try {
    for (const plan of NORMALIZATION_PLANS) {
      const { videoKbps, audioKbps } = calculateBitratePlan({
        durationSeconds,
        maxBytes,
        targetRatio: plan.targetRatio,
      });
      await execFileAsync(ffmpegStatic, [
        "-y",
        "-i",
        sourceHandle.path,
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-vf",
        buildScaleFilter(plan.maxLongEdge),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-b:v",
        `${videoKbps}k`,
        "-maxrate",
        `${Math.ceil(videoKbps * 1.2)}k`,
        "-bufsize",
        `${Math.ceil(videoKbps * 2)}k`,
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        `${audioKbps}k`,
        "-movflags",
        "+faststart",
        outputPath,
      ]);

      const normalizedBuffer = await fs.readFile(outputPath);
      if (detectVideoMimeType(normalizedBuffer) !== "video/mp4") {
        throw new Error("Normalized video did not produce an MP4 container.");
      }
      if (normalizedBuffer.length <= maxBytes) {
        return {
          buffer: normalizedBuffer,
          filename: replaceFileExtension(filename, "mp4"),
          mimeType: "video/mp4",
        };
      }
      await fs.unlink(outputPath).catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof VoiceChangerSourceVideoNormalizationError) {
      throw error;
    }
    throw new VoiceChangerSourceVideoNormalizationError(
      400,
      "Invalid voice changer source video",
      "Voice changer source video could not be prepared for processing."
    );
  } finally {
    await fs.unlink(outputPath).catch(() => undefined);
    await fs.rm(outputDir, { recursive: true, force: true }).catch(() => undefined);
    await sourceHandle.cleanup().catch(() => undefined);
  }

  throw new VoiceChangerSourceVideoNormalizationError(
    413,
    "Invalid request",
    "Voice changer source video could not be compressed under the processing limit. Use a shorter clip and try again."
  );
};
