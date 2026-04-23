/**
 * Authenticated storage staging route for local Voice Changer source files.
 * Accepts one raw audio or video upload, stores it under the caller's private namespace, and returns signed access metadata.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import { detectVideoMimeType } from "../../../lib/server/uploadSignature";
import { MAX_VOICE_CHANGER_SOURCE_BYTES } from "../../../lib/server/mediaAudioExtraction";

const MEDIA_BUCKET = "media_library";
const MAX_AUDIO_STAGE_BYTES = 100 * 1024 * 1024;
const AUDIO_EXTENSION_BY_MIME: Record<string, string> = {
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/m4a": "m4a",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/x-wav": "wav",
};
const VIDEO_EXTENSION_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
};
const AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  aac: "audio/aac",
  flac: "audio/flac",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  webm: "audio/webm",
};
const VIDEO_MIME_BY_EXTENSION: Record<string, string> = {
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  mp4: "video/mp4",
  webm: "video/webm",
};
const ALLOWED_AUDIO_MIME_TYPES = new Set(Object.keys(AUDIO_EXTENSION_BY_MIME));
const ALLOWED_VIDEO_MIME_TYPES = new Set(Object.keys(VIDEO_EXTENSION_BY_MIME));

type VoiceChangerSourceKind = "audio" | "video";

type StageVoiceChangerSourceSuccessResponse = {
  source: {
    storagePath: string;
    previewUrl: string;
    mimeType: string;
    name: string;
    size: number;
  };
};

type StageVoiceChangerSourceErrorResponse = {
  error: string;
  details?: string;
};

const normalizeHeaderString = (value: string | string[] | undefined): string => {
  const header = Array.isArray(value) ? value[0] : value;
  return header?.split(";")[0]?.trim().toLowerCase() ?? "";
};

const readHeaderString = (value: string | string[] | undefined): string => {
  const header = Array.isArray(value) ? value[0] : value;
  return header?.trim() ?? "";
};

const sanitizeFileStem = (value: string): string =>
  value
    .trim()
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "voice_changer_source";

const resolveRequestedKind = (value: string): VoiceChangerSourceKind | null => {
  if (value === "audio" || value === "video") return value;
  return null;
};

const resolveExtensionFromFilename = (filename: string): string | null => {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex < 0) return null;
  const extension = filename
    .slice(dotIndex + 1)
    .trim()
    .toLowerCase();
  return extension || null;
};

const resolveAllowedMimeType = ({
  requestedKind,
  declaredMimeType,
  filename,
  buffer,
}: {
  requestedKind: VoiceChangerSourceKind;
  declaredMimeType: string;
  filename: string;
  buffer: Buffer;
}): { mimeType: string; extension: string } => {
  const filenameExtension = resolveExtensionFromFilename(filename);
  if (requestedKind === "video") {
    const detectedMimeType = detectVideoMimeType(buffer);
    const candidateMimeType =
      detectedMimeType && ALLOWED_VIDEO_MIME_TYPES.has(detectedMimeType)
        ? detectedMimeType
        : declaredMimeType && ALLOWED_VIDEO_MIME_TYPES.has(declaredMimeType)
          ? declaredMimeType
          : filenameExtension && VIDEO_MIME_BY_EXTENSION[filenameExtension]
            ? VIDEO_MIME_BY_EXTENSION[filenameExtension]
            : null;
    if (!candidateMimeType || !ALLOWED_VIDEO_MIME_TYPES.has(candidateMimeType)) {
      throw new Error("Voice changer source file is not a supported video format.");
    }
    return {
      mimeType: candidateMimeType,
      extension:
        VIDEO_EXTENSION_BY_MIME[candidateMimeType] ??
        filenameExtension ??
        VIDEO_EXTENSION_BY_MIME["video/mp4"],
    };
  }

  const candidateMimeType =
    declaredMimeType && ALLOWED_AUDIO_MIME_TYPES.has(declaredMimeType)
      ? declaredMimeType
      : filenameExtension && AUDIO_MIME_BY_EXTENSION[filenameExtension]
        ? AUDIO_MIME_BY_EXTENSION[filenameExtension]
        : null;
  if (!candidateMimeType || !ALLOWED_AUDIO_MIME_TYPES.has(candidateMimeType)) {
    throw new Error("Voice changer source file is not a supported audio format.");
  }
  return {
    mimeType: candidateMimeType,
    extension:
      AUDIO_EXTENSION_BY_MIME[candidateMimeType] ??
      filenameExtension ??
      AUDIO_EXTENSION_BY_MIME["audio/wav"],
  };
};

const readRawBody = async (req: NextApiRequest, maxBytes: number): Promise<Buffer> =>
  await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onAborted);
      callback();
    };

    const onData = (chunk: Buffer | string) => {
      const chunkBuffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      totalBytes += chunkBuffer.length;
      if (totalBytes > maxBytes) {
        settle(() =>
          reject(
            new Error(
              maxBytes === MAX_VOICE_CHANGER_SOURCE_BYTES
                ? "Voice changer source videos must be 40 MB or smaller. Trim the clip and try again."
                : "Voice changer source audio must be 100 MB or smaller."
            )
          )
        );
        req.destroy();
        return;
      }
      chunks.push(chunkBuffer);
    };

    const onEnd = () => {
      settle(() => resolve(Buffer.concat(chunks)));
    };

    const onError = (error: Error) => {
      settle(() => reject(error));
    };

    const onAborted = () => {
      settle(() => reject(new Error("Voice changer source upload was interrupted.")));
    };

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("aborted", onAborted);
  });

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    StageVoiceChangerSourceSuccessResponse | StageVoiceChangerSourceErrorResponse
  >
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const requestedKind = resolveRequestedKind(
      readHeaderString(req.headers["x-shortpulse-voice-changer-kind"])
    );
    if (!requestedKind) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Voice changer source kind must be 'audio' or 'video'.",
      });
    }

    const filename =
      readHeaderString(req.headers["x-shortpulse-upload-filename"]) ||
      `voice-changer-source.${requestedKind === "video" ? "mp4" : "wav"}`;
    const declaredMimeType = normalizeHeaderString(req.headers["content-type"]);
    const maxBytes =
      requestedKind === "video" ? MAX_VOICE_CHANGER_SOURCE_BYTES : MAX_AUDIO_STAGE_BYTES;
    const body = await readRawBody(req, maxBytes);
    if (!body.length) {
      return res.status(400).json({
        error: "Invalid request",
        details: "Voice changer source upload is empty.",
      });
    }

    const { mimeType, extension } = resolveAllowedMimeType({
      requestedKind,
      declaredMimeType,
      filename,
      buffer: body,
    });
    const storedFilename = `${Date.now()}-${Math.random().toString(36).slice(2)}-${sanitizeFileStem(
      filename
    )}.${extension}`;
    const storagePath = assertUserScopedMediaStoragePath({
      path: `${user.id}/voice-changer/source-${requestedKind}/${storedFilename}`,
      userId: user.id,
      label: "Voice changer source storage path",
    });

    const supabaseAdmin = getSupabaseAdmin();
    const uploadResult = await supabaseAdmin.storage.from(MEDIA_BUCKET).upload(storagePath, body, {
      contentType: mimeType,
      upsert: false,
    });
    if (uploadResult.error) {
      throw new Error(uploadResult.error.message || "Unable to stage the voice changer source.");
    }

    const signedResult = await supabaseAdmin.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(storagePath, 60 * 60);
    if (signedResult.error || !signedResult.data?.signedUrl) {
      await supabaseAdmin.storage
        .from(MEDIA_BUCKET)
        .remove([storagePath])
        .catch(() => undefined);
      throw new Error(
        signedResult.error?.message || "Unable to sign the staged voice changer source."
      );
    }

    return res.status(200).json({
      source: {
        storagePath,
        previewUrl: signedResult.data.signedUrl,
        mimeType,
        name: filename,
        size: body.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.trim() : "";
    if (
      message ===
        "Voice changer source videos must be 40 MB or smaller. Trim the clip and try again." ||
      message === "Voice changer source audio must be 100 MB or smaller." ||
      message === "Voice changer source file is not a supported video format." ||
      message === "Voice changer source file is not a supported audio format." ||
      message === "Voice changer source upload was interrupted."
    ) {
      return res.status(message.includes("smaller") ? 413 : 400).json({
        error: "Invalid request",
        details: message,
      });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "media-stage-voice-changer-source",
      scope: "generation",
      user,
    });

    return res.status(500).json({
      error: "Unable to stage voice changer source",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
