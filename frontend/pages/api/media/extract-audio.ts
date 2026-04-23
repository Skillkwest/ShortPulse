import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import {
  assertTrustedRemoteMediaUrl,
  TrustedRemoteMediaUrlError,
} from "../../../lib/server/api/trustedRemoteMediaUrl";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import {
  extractAudioTrack,
  isVideoSource,
  MAX_VOICE_CHANGER_SOURCE_BYTES,
  makeTempFileHandle,
  MediaAudioExtractionInputError,
  readRemoteMediaBuffer,
  readStoredMediaBuffer,
} from "../../../lib/server/mediaAudioExtraction";

const MEDIA_BUCKET = "media_library";

type ExtractAudioRequestBody = {
  sourceName?: unknown;
  sourceOrigin?: unknown;
  sourceMimeType?: unknown;
  sourceStoragePath?: unknown;
  sourceUrl?: unknown;
};

type ExtractAudioSuccessResponse = {
  audio: {
    name: string;
    mimeType: "audio/wav";
    previewUrl: string;
    storagePath: string;
    size: number;
  };
};

type ExtractAudioErrorResponse = {
  error: string;
  details?: string;
};

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeStem = (value: string): string => {
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, 72);
  const sanitized = normalized.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "");
  return sanitized || "voice_sample";
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ExtractAudioSuccessResponse | ExtractAudioErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const body = (req.body ?? {}) as ExtractAudioRequestBody;
    const sourceName = normalizeOptionalString(body.sourceName) ?? "Voice changer source";
    const sourceOrigin = normalizeOptionalString(body.sourceOrigin) ?? "local";
    const sourceMimeType = normalizeOptionalString(body.sourceMimeType);
    const sourceStoragePath = normalizeOptionalString(body.sourceStoragePath);
    const sourceUrl = normalizeOptionalString(body.sourceUrl);

    if (!sourceStoragePath && !sourceUrl) {
      return res.status(400).json({
        error: "Invalid request",
        details: "sourceStoragePath or sourceUrl is required.",
      });
    }

    let sourceBuffer: Buffer;
    let resolvedSourceMimeType = sourceMimeType;
    let resolvedSourceName = sourceName;

    if (sourceStoragePath) {
      const safeStoragePath = assertUserScopedMediaStoragePath({
        path: sourceStoragePath,
        userId: user.id,
        label: "Voice changer source storage path",
      });
      const stored = await readStoredMediaBuffer({
        storagePath: safeStoragePath,
        maxBytes: MAX_VOICE_CHANGER_SOURCE_BYTES,
      });
      sourceBuffer = stored.buffer;
      resolvedSourceMimeType = resolvedSourceMimeType ?? stored.contentType;
      resolvedSourceName = path.basename(safeStoragePath) || resolvedSourceName;
    } else {
      const trustedSourceUrl = await assertTrustedRemoteMediaUrl({
        rawUrl: sourceUrl!,
        req,
        userId: user.id,
        requireUserScope: sourceOrigin === "reference-grid",
        label: "Voice changer source URL",
      });
      const remote = await readRemoteMediaBuffer({
        sourceUrl: trustedSourceUrl.toString(),
        maxBytes: MAX_VOICE_CHANGER_SOURCE_BYTES,
      });
      sourceBuffer = remote.buffer;
      resolvedSourceMimeType = resolvedSourceMimeType ?? remote.contentType;
      resolvedSourceName =
        trustedSourceUrl.pathname.split("/").filter(Boolean).pop() ?? resolvedSourceName;
    }

    if (!isVideoSource(resolvedSourceMimeType, resolvedSourceName)) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Audio extraction is only supported for video sources.",
      });
    }

    const sourceExtension =
      path.extname(resolvedSourceName).replace(/^\./, "") ||
      (resolvedSourceMimeType?.split("/")[1]?.replace(/[^a-z0-9]+/gi, "") ?? "bin");
    const sourceHandle = await makeTempFileHandle({
      buffer: sourceBuffer,
      extension: sourceExtension,
    });
    let extractedHandle: Awaited<ReturnType<typeof extractAudioTrack>> | null = null;

    try {
      extractedHandle = await extractAudioTrack({ sourcePath: sourceHandle.path });
      const extractedBuffer = await fs.readFile(extractedHandle.path);
      const filename = `${sanitizeStem(path.parse(resolvedSourceName).name)}.wav`;
      const storagePath = assertUserScopedMediaStoragePath({
        path: `${user.id}/voice-changer/staged-audio/${randomUUID()}-${filename}`,
        userId: user.id,
        label: "Extracted voice changer audio storage path",
      });

      const uploadResult = await getSupabaseAdmin()
        .storage.from(MEDIA_BUCKET)
        .upload(storagePath, extractedBuffer, {
          contentType: "audio/wav",
          upsert: false,
        });
      if (uploadResult.error) {
        throw new Error(uploadResult.error.message || "Unable to store extracted audio.");
      }

      const signedResult = await getSupabaseAdmin()
        .storage.from(MEDIA_BUCKET)
        .createSignedUrl(storagePath, 60 * 60);
      if (signedResult.error || !signedResult.data?.signedUrl) {
        throw new Error(signedResult.error?.message || "Unable to sign extracted audio.");
      }

      return res.status(200).json({
        audio: {
          name: filename,
          mimeType: "audio/wav",
          previewUrl: signedResult.data.signedUrl,
          storagePath,
          size: extractedBuffer.length,
        },
      });
    } finally {
      await extractedHandle?.cleanup().catch(() => undefined);
      await sourceHandle.cleanup().catch(() => undefined);
    }
  } catch (error) {
    if (
      error instanceof TrustedRemoteMediaUrlError ||
      error instanceof MediaAudioExtractionInputError
    ) {
      return res.status(error.statusCode).json({
        error: "Invalid request",
        details: error.message,
      });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "media-extract-audio",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to extract audio",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
