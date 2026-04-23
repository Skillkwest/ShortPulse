import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import { promises as fs } from "fs";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  assertTrustedRemoteMediaUrl,
  TrustedRemoteMediaUrlError,
} from "../../../lib/server/api/trustedRemoteMediaUrl";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import {
  generateElevenLabsVoiceChanger,
  persistGeneratedAudioAsset,
  readRemoteSourceBuffer,
} from "../../../lib/server/elevenlabs";
import { readStoredMediaBuffer } from "../../../lib/server/mediaAudioExtraction";

type GenerateAudioSuccessResponse = {
  output: {
    provider: "elevenlabs";
    mode: "audio";
    generationId: string;
    mediaFileId: string | null;
    requestId: string;
    previewUrl: string;
    resultUrls: string[];
    previewStoragePath: string;
    fullStoragePath: string;
    mimeType: string;
    durationMs: null;
    waveformPeaks: null;
    modelId: string;
    voiceId: string;
    voiceName: string;
  };
};

type GenerateAudioErrorResponse = {
  error: string;
  details?: string;
};

type ParsedMultipart = {
  fields: formidable.Fields;
  files: formidable.Files;
};

const normalizeRequiredString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readFieldString = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return normalizeRequiredString(value[0]);
  return normalizeRequiredString(value);
};

const parseBooleanField = (value: string | string[] | undefined): boolean => {
  const normalized = readFieldString(value)?.toLowerCase();
  return normalized === "true";
};

const parseSourceOrigin = (
  value: string | string[] | undefined
): "local" | "reference-grid" | "url" => {
  const normalized = readFieldString(value)?.toLowerCase();
  if (normalized === "reference-grid") return "reference-grid";
  if (normalized === "url") return "url";
  return "local";
};

const parseMultipart = async (req: NextApiRequest): Promise<ParsedMultipart> => {
  const form = formidable({
    maxFileSize: 100 * 1024 * 1024,
    keepExtensions: true,
  });

  return await new Promise<ParsedMultipart>((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ fields, files });
    });
  });
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateAudioSuccessResponse | GenerateAudioErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const { fields, files } = await parseMultipart(req);
    const voiceId = readFieldString(fields.voiceId);
    const voiceName = readFieldString(fields.voiceName);
    const outputFormat = readFieldString(fields.outputFormat);
    const modelId = readFieldString(fields.modelId);
    const inputFormat = readFieldString(fields.inputFormat);
    const sourceUrl = readFieldString(fields.sourceUrl);
    const sourceStoragePath = readFieldString(fields.sourceStoragePath);
    const sourceOrigin = parseSourceOrigin(fields.sourceOrigin);
    const sourceName = readFieldString(fields.sourceName) ?? "Voice changer source";
    const removeBackgroundNoise = parseBooleanField(fields.removeBackgroundNoise);
    const voiceSettingsField = readFieldString(fields.voiceSettings);
    const voiceSettings = voiceSettingsField ? JSON.parse(voiceSettingsField) : null;

    if (!voiceId || !voiceName || !outputFormat || !modelId || !inputFormat || !voiceSettings) {
      return res.status(400).json({
        error: "Invalid request",
        details:
          "voiceId, voiceName, outputFormat, modelId, inputFormat, and voiceSettings are required.",
      });
    }

    const sourceFileInput = files.file;
    const sourceFile = Array.isArray(sourceFileInput) ? sourceFileInput[0] : sourceFileInput;

    let sourceBuffer: Buffer | null = null;
    let sourceMimeType: string | null = null;
    let sourceFilename: string | null = null;

    if (sourceFile?.filepath) {
      sourceBuffer = await fs.readFile(sourceFile.filepath);
      sourceMimeType = normalizeRequiredString(sourceFile.mimetype) ?? null;
      sourceFilename =
        normalizeRequiredString(sourceFile.originalFilename) ??
        sourceFile.filepath.split("/").filter(Boolean).pop() ??
        "source";
    } else if (sourceStoragePath) {
      const trustedStoragePath = assertUserScopedMediaStoragePath({
        path: sourceStoragePath,
        userId: user.id,
        label: "Voice changer source storage path",
      });
      const storedSource = await readStoredMediaBuffer({ storagePath: trustedStoragePath });
      sourceBuffer = storedSource.buffer;
      sourceMimeType = storedSource.contentType;
      sourceFilename = trustedStoragePath.split("/").filter(Boolean).pop() ?? "source";
    } else if (sourceUrl) {
      const trustedSourceUrl = await assertTrustedRemoteMediaUrl({
        rawUrl: sourceUrl,
        req,
        userId: user.id,
        requireUserScope: sourceOrigin === "reference-grid",
        label: "Voice changer source URL",
      });
      const remoteSource = await readRemoteSourceBuffer({ sourceUrl: trustedSourceUrl.toString() });
      sourceBuffer = remoteSource.buffer;
      sourceMimeType = remoteSource.contentType;
      sourceFilename = trustedSourceUrl.pathname.split("/").filter(Boolean).pop() ?? "source";
    }

    if (!sourceBuffer || !sourceFilename) {
      return res.status(400).json({
        error: "Invalid request",
        details: "A local file upload, sourceStoragePath, or sourceUrl is required.",
      });
    }

    const generated = await generateElevenLabsVoiceChanger({
      voiceId,
      sourceBuffer,
      sourceFilename,
      sourceMimeType,
      outputFormat,
      modelId,
      voiceSettings,
      removeBackgroundNoise,
      inputFormat,
    });

    const persisted = await persistGeneratedAudioAsset({
      userId: user.id,
      promptText: `${sourceName} -> ${voiceName}`,
      provider: "elevenlabs",
      modelId,
      sourceMode: "voice-changer",
      voiceId,
      voiceName,
      outputBuffer: generated.buffer,
      outputContentType: generated.contentType,
      outputFormat,
    });

    return res.status(200).json({
      output: {
        provider: "elevenlabs",
        mode: "audio",
        generationId: persisted.generationId,
        mediaFileId: persisted.mediaFileId,
        requestId: persisted.requestId,
        previewUrl: persisted.signedUrl,
        resultUrls: [persisted.signedUrl],
        previewStoragePath: persisted.storagePath,
        fullStoragePath: persisted.storagePath,
        mimeType: generated.contentType,
        durationMs: null,
        waveformPeaks: null,
        modelId,
        voiceId,
        voiceName,
      },
    });
  } catch (error) {
    if (error instanceof TrustedRemoteMediaUrlError) {
      return res.status(error.statusCode).json({
        error: "Invalid request",
        details: error.message,
      });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "elevenlabs-speech-to-speech",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to convert voice",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
