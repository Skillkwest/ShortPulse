import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { canAutoPersistRecoveryMedia } from "../mediaAutosavePolicy";
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";
import { getSupabaseAdmin } from "./api/supabaseAdmin";
import { persistGenerationOutputRecords } from "./api/generationOutputs";
import { upsertGenerationProjection } from "./api/generationProjection";
import { upsertGenerationPublication } from "./api/generationPublications";
import { writeAppErrorLog } from "./api/appErrorLogs";
import { associateGenerationWithProjectForUser } from "./projectGenerationAssociationsService";
import {
  extractAudioTrack,
  isVideoSource,
  makeTempFileHandle,
  remuxVideoWithAudioTrack,
  type TempFileHandle,
} from "./mediaAudioExtraction";
import { signVideoPosterVariant, upsertVideoPosterVariantFromBuffer } from "./videoPosterVariant";
const MEDIA_BUCKET = "media_library";
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io";
const AUDIO_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "application/octet-stream": "bin",
};
const VIDEO_EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
};
const OUTPUT_CONTENT_TYPE_BY_FORMAT_PREFIX: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  pcm: "audio/wav",
  ulaw: "audio/basic",
};
const ELEVENLABS_TRANSIENT_UPSTREAM_STATUSES = new Set([502, 503, 504]);
const ELEVENLABS_SOUND_EFFECT_MAX_ATTEMPTS = 2;

export type ElevenLabsVoice = {
  voiceId: string;
  name: string;
  previewUrl: string | null;
  description: string | null;
  isFallback: boolean;
};

export type ElevenLabsDesignedVoicePreview = {
  generatedVoiceId: string;
  audioBase64: string;
  mediaType: string | null;
  durationSecs: number | null;
  language: string | null;
};

type ElevenLabsJsonOptions = {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
};

type PersistGeneratedAudioInput = {
  userId: string;
  promptText: string;
  provider: "elevenlabs";
  modelId: string;
  providerRequestId?: string | null;
  requestId?: string | null;
  projectId?: string | null;
  sourceMode: "voiceover" | "voice-changer" | "sound-effects" | "music";
  voiceId?: string | null;
  voiceName?: string | null;
  outputBuffer: Buffer;
  outputContentType: string;
  outputFormat: string;
  extraMetadata?: Record<string, unknown>;
};

type PersistGeneratedVideoInput = {
  userId: string;
  promptText: string;
  provider: "elevenlabs";
  modelId: string;
  providerRequestId?: string | null;
  requestId?: string | null;
  projectId?: string | null;
  sourceMode: "voice-changer";
  outputBuffer: Buffer;
  outputContentType: "video/mp4" | "video/webm";
  generationReplay?: Record<string, unknown>;
  extraMetadata?: Record<string, unknown>;
};

export type PersistGeneratedAudioResult = {
  generationId: string;
  mediaFileId: string | null;
  requestId: string;
  storagePath: string;
  signedUrl: string;
  outputRowId: string | null;
};

export type PersistGeneratedVideoResult = PersistGeneratedAudioResult & {
  previewStoragePath: string;
  fullStoragePath: string;
  previewPosterStoragePath: string | null;
  previewPosterUrl: string | null;
};

export type RemuxedVoiceChangerVideoResult = {
  buffer: Buffer;
  contentType: "video/mp4" | "video/webm";
};

type AutosaveDecision = "auto_persisted" | "autosave_skipped";

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeProviderErrorMessage = (value: unknown): string | null => {
  const directMessage = normalizeOptionalString(value);
  if (directMessage) return directMessage;
  if (Array.isArray(value)) {
    const messages = value
      .map((entry) => normalizeProviderErrorMessage(entry))
      .filter((entry): entry is string => Boolean(entry));
    return messages.length ? messages.join(" ") : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const message =
      normalizeOptionalString(record.message) ??
      normalizeOptionalString(record.msg) ??
      normalizeOptionalString(record.reason) ??
      normalizeOptionalString(record.error);
    if (message) return message;
    const nested = normalizeProviderErrorMessage(record.detail);
    if (nested) return nested;
  }
  return null;
};

const associateGeneratedElevenLabsAssetWithProject = async ({
  generationId,
  mediaKind,
  modelId,
  projectId,
  providerRequestId,
  requestId,
  sourceMode,
  userId,
}: {
  generationId: string;
  mediaKind: "audio" | "video";
  modelId: string;
  projectId: string | null;
  providerRequestId: string | null;
  requestId: string;
  sourceMode: string;
  userId: string;
}): Promise<void> => {
  if (!projectId) return;
  try {
    await associateGenerationWithProjectForUser({
      userId,
      projectId,
      generationId,
    });
  } catch (error) {
    await writeAppErrorLog({
      source: "telemetry.elevenlabs.project_association_failed",
      message: "ElevenLabs generation project association failed.",
      requestId,
      userId,
      statusCode: 200,
      metadata: {
        generation_id: generationId,
        project_id: projectId,
        provider: "elevenlabs",
        provider_request_id: providerRequestId,
        model_id: modelId,
        media_kind: mediaKind,
        source_mode: sourceMode,
        association_error: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => undefined);
  }
};

const normalizeVoiceLookupKey = (value: string): string => value.trim().toLowerCase();

const parseOptionalNumber = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeOptionalFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
};

const getElevenLabsApiKey = (): string => {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured.");
  }
  return apiKey;
};

const buildElevenLabsHeaders = (): HeadersInit => ({
  "xi-api-key": getElevenLabsApiKey(),
});

const isTransientElevenLabsUpstreamResponse = (response: Response): boolean =>
  ELEVENLABS_TRANSIENT_UPSTREAM_STATUSES.has(response.status);

const readElevenLabsErrorMessage = async (
  response: Response,
  fallbackMessage: string
): Promise<string> => {
  const payload = await response.json().catch(() => null);
  return (
    normalizeOptionalString((payload as { detail?: unknown } | null)?.detail) ??
    normalizeOptionalString((payload as { error?: unknown } | null)?.error) ??
    fallbackMessage
  );
};

const readProviderRequestId = (headers: Headers): string | null =>
  normalizeOptionalString(headers.get("request-id")) ??
  normalizeOptionalString(headers.get("x-request-id")) ??
  normalizeOptionalString(headers.get("request_id"));

const normalizeElevenLabsVoice = (voice: Record<string, unknown>): ElevenLabsVoice | null => {
  const voiceId = normalizeOptionalString(voice.voice_id) ?? normalizeOptionalString(voice.voiceId);
  const name = normalizeOptionalString(voice.name);
  if (!voiceId || !name) return null;

  const labels =
    voice.labels && typeof voice.labels === "object" && !Array.isArray(voice.labels)
      ? (voice.labels as Record<string, unknown>)
      : null;
  const description =
    normalizeOptionalString(voice.description) ??
    normalizeOptionalString(labels?.description) ??
    normalizeOptionalString(labels?.descriptive) ??
    normalizeOptionalString(labels?.use_case)?.replace(/_/g, " ") ??
    null;

  return {
    voiceId,
    name,
    previewUrl:
      normalizeOptionalString(voice.preview_url) ??
      normalizeOptionalString(voice.previewUrl) ??
      null,
    description,
    isFallback: false,
  };
};

const fetchElevenLabsJson = async <TResponse>(
  pathname: string,
  options?: ElevenLabsJsonOptions
): Promise<TResponse> => {
  const response = await fetch(`${ELEVENLABS_BASE_URL}${pathname}`, {
    method: options?.method ?? "GET",
    headers: {
      ...buildElevenLabsHeaders(),
      "Content-Type": "application/json",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      normalizeOptionalString((payload as { detail?: unknown } | null)?.detail) ??
      normalizeOptionalString((payload as { error?: unknown } | null)?.error) ??
      "ElevenLabs request failed.";
    throw new Error(message);
  }
  return payload as TResponse;
};

const resolveOutputContentType = (
  outputFormat: string,
  headerContentType: string | null
): string => {
  const normalizedHeader = headerContentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (normalizedHeader) return normalizedHeader;
  const formatPrefix = outputFormat.split("_")[0]?.trim().toLowerCase() ?? "";
  return OUTPUT_CONTENT_TYPE_BY_FORMAT_PREFIX[formatPrefix] ?? "application/octet-stream";
};

const sanitizeStem = (value: string): string => {
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, 72);
  const sanitized = normalized.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "");
  return sanitized || "audio";
};

const resolveFileExtension = (contentType: string, outputFormat: string): string => {
  const normalizedContentType = contentType.trim().toLowerCase();
  if (AUDIO_EXTENSION_BY_CONTENT_TYPE[normalizedContentType]) {
    return AUDIO_EXTENSION_BY_CONTENT_TYPE[normalizedContentType];
  }
  const formatPrefix = outputFormat.split("_")[0]?.trim().toLowerCase() ?? "";
  return formatPrefix || "bin";
};

const resolveVideoFileExtension = (contentType: string): string => {
  const normalizedContentType = contentType.trim().toLowerCase();
  return VIDEO_EXTENSION_BY_CONTENT_TYPE[normalizedContentType] ?? "mp4";
};

const downloadRemoteFile = async (
  url: string
): Promise<{
  buffer: Buffer;
  contentType: string | null;
}> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch source media (${response.status}).`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type"),
  };
};

const readMediaAutosaveEnabledForUser = async ({
  supabaseAdmin,
  userId,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
}): Promise<boolean> => {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_preferences")
      .select("media_autosave_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return true;
    const value = (data as { media_autosave_enabled?: unknown } | null)?.media_autosave_enabled;
    return typeof value === "boolean" ? value : true;
  } catch {
    return true;
  }
};

export const listElevenLabsVoices = async (): Promise<ElevenLabsVoice[]> => {
  const payload = await fetchElevenLabsJson<{
    voices?: Array<Record<string, unknown>>;
  }>("/v2/voices?page_size=100&include_total_count=false");

  const liveVoices = payload.voices
    ?.map((voice) => {
      const normalizedVoice = normalizeElevenLabsVoice(voice);
      if (!normalizedVoice) return null;
      return {
        voice: normalizedVoice,
        category: normalizeOptionalString(voice.category)?.toLowerCase() ?? null,
      };
    })
    .filter((entry): entry is { voice: ElevenLabsVoice; category: string | null } =>
      Boolean(entry?.voice)
    );

  if (liveVoices && liveVoices.length > 0) {
    const dedupedVoices = new Map<string, { voice: ElevenLabsVoice; category: string | null }>();
    for (const entry of liveVoices) {
      const lookupKey = normalizeVoiceLookupKey(entry.voice.voiceId);
      if (!dedupedVoices.has(lookupKey)) {
        dedupedVoices.set(lookupKey, entry);
      }
    }
    return Array.from(dedupedVoices.values())
      .sort((leftEntry, rightEntry) => {
        const leftRank = leftEntry.category === "premade" ? 0 : 1;
        const rightRank = rightEntry.category === "premade" ? 0 : 1;
        if (leftRank !== rightRank) return leftRank - rightRank;
        return leftEntry.voice.name.localeCompare(rightEntry.voice.name, undefined, {
          sensitivity: "base",
        });
      })
      .map((entry) => entry.voice);
  }

  return [];
};

export const designElevenLabsVoice = async ({
  voiceDescription,
  modelId,
  autoGenerateText,
  text,
  outputFormat,
}: {
  voiceDescription: string;
  modelId: string;
  autoGenerateText: boolean;
  text: string | null;
  outputFormat: string;
}): Promise<{
  previews: ElevenLabsDesignedVoicePreview[];
  text: string | null;
}> => {
  const response = await fetch(
    `${ELEVENLABS_BASE_URL}/v1/text-to-voice/design?output_format=${encodeURIComponent(outputFormat)}`,
    {
      method: "POST",
      headers: {
        ...buildElevenLabsHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voice_description: voiceDescription,
        model_id: modelId,
        auto_generate_text: autoGenerateText,
        text,
      }),
    }
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      normalizeOptionalString((payload as { detail?: unknown } | null)?.detail) ??
      normalizeOptionalString((payload as { error?: unknown } | null)?.error) ??
      "ElevenLabs voice design request failed.";
    throw new Error(message);
  }

  const previews = Array.isArray((payload as { previews?: unknown[] } | null)?.previews)
    ? (payload as { previews: Record<string, unknown>[] }).previews
        .map((preview) => {
          const generatedVoiceId =
            normalizeOptionalString(preview.generated_voice_id) ??
            normalizeOptionalString(preview.generatedVoiceId);
          const audioBase64 =
            normalizeOptionalString(preview.audio_base_64) ??
            normalizeOptionalString(preview.audioBase64);
          if (!generatedVoiceId || !audioBase64) return null;
          return {
            generatedVoiceId,
            audioBase64,
            mediaType:
              normalizeOptionalString(preview.media_type) ??
              normalizeOptionalString(preview.mediaType),
            durationSecs:
              normalizeOptionalFiniteNumber(preview.duration_secs) ??
              normalizeOptionalFiniteNumber(preview.durationSecs),
            language: normalizeOptionalString(preview.language),
          };
        })
        .filter((preview): preview is ElevenLabsDesignedVoicePreview => Boolean(preview))
    : [];

  return {
    previews,
    text: normalizeOptionalString((payload as { text?: unknown } | null)?.text),
  };
};

export const createElevenLabsDesignedVoice = async ({
  voiceName,
  voiceDescription,
  generatedVoiceId,
  playedNotSelectedVoiceIds = [],
}: {
  voiceName: string;
  voiceDescription: string;
  generatedVoiceId: string;
  playedNotSelectedVoiceIds?: string[];
}): Promise<ElevenLabsVoice> => {
  const payload = await fetchElevenLabsJson<Record<string, unknown>>("/v1/text-to-voice", {
    method: "POST",
    body: {
      voice_name: voiceName,
      voice_description: voiceDescription,
      generated_voice_id: generatedVoiceId,
      ...(playedNotSelectedVoiceIds.length > 0
        ? {
            played_not_selected_voice_ids: playedNotSelectedVoiceIds,
          }
        : {}),
    },
  });
  const normalizedVoice = normalizeElevenLabsVoice(payload);
  if (!normalizedVoice) {
    throw new Error("ElevenLabs returned an invalid created voice payload.");
  }
  return normalizedVoice;
};

export const createElevenLabsClonedVoice = async ({
  voiceName,
  voiceDescription,
  sourceBuffer,
  sourceFilename,
  sourceMimeType,
  removeBackgroundNoise,
}: {
  voiceName: string;
  voiceDescription?: string | null;
  sourceBuffer: Buffer;
  sourceFilename: string;
  sourceMimeType: string | null;
  removeBackgroundNoise: boolean;
}): Promise<ElevenLabsVoice> => {
  const formData = new FormData();
  formData.append("name", voiceName);
  if (voiceDescription?.trim()) {
    formData.append("description", voiceDescription.trim());
  }
  formData.append("remove_background_noise", removeBackgroundNoise ? "true" : "false");
  formData.append(
    "files[]",
    new Blob([sourceBuffer], { type: sourceMimeType ?? "application/octet-stream" }),
    sourceFilename
  );

  const response = await fetch(`${ELEVENLABS_BASE_URL}/v1/voices/add`, {
    method: "POST",
    headers: buildElevenLabsHeaders(),
    body: formData,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      normalizeProviderErrorMessage((payload as { detail?: unknown } | null)?.detail) ??
      normalizeProviderErrorMessage((payload as { error?: unknown } | null)?.error) ??
      "ElevenLabs voice clone request failed.";
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const normalizedVoice = normalizeElevenLabsVoice(payload as Record<string, unknown>);
  if (normalizedVoice) {
    return normalizedVoice;
  }
  const clonedVoiceId =
    normalizeOptionalString(
      (payload as { voice_id?: unknown; voiceId?: unknown } | null)?.voice_id
    ) ??
    normalizeOptionalString((payload as { voice_id?: unknown; voiceId?: unknown } | null)?.voiceId);
  if (!clonedVoiceId) {
    throw new Error("ElevenLabs returned an invalid cloned voice payload.");
  }
  return {
    voiceId: clonedVoiceId,
    name: voiceName,
    previewUrl: null,
    description: voiceDescription?.trim() || null,
    isFallback: false,
  };
};

/**
 * Deletes a provider-backed ElevenLabs voice by id.
 * Throws a status-bearing error when the upstream request fails.
 */
export const deleteElevenLabsVoice = async (voiceId: string): Promise<void> => {
  const response = await fetch(`${ELEVENLABS_BASE_URL}/v1/voices/${encodeURIComponent(voiceId)}`, {
    method: "DELETE",
    headers: buildElevenLabsHeaders(),
  });

  if (response.ok) {
    return;
  }

  const payload = await response.json().catch(() => null);
  const message =
    normalizeOptionalString((payload as { detail?: unknown } | null)?.detail) ??
    normalizeOptionalString((payload as { error?: unknown } | null)?.error) ??
    "ElevenLabs voice deletion failed.";
  const error = new Error(message) as Error & { status?: number };
  error.status = response.status;
  throw error;
};

export const generateElevenLabsVoiceover = async ({
  voiceId,
  text,
  outputFormat,
  body,
}: {
  voiceId: string;
  text: string;
  outputFormat: string;
  body: Record<string, unknown>;
}): Promise<{ buffer: Buffer; contentType: string; providerRequestId: string | null }> => {
  const response = await fetch(
    `${ELEVENLABS_BASE_URL}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`,
    {
      method: "POST",
      headers: {
        ...buildElevenLabsHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        ...body,
      }),
    }
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      normalizeOptionalString((payload as { detail?: unknown } | null)?.detail) ??
      normalizeOptionalString((payload as { error?: unknown } | null)?.error) ??
      "ElevenLabs voiceover request failed.";
    throw new Error(message);
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: resolveOutputContentType(outputFormat, response.headers.get("content-type")),
    providerRequestId: readProviderRequestId(response.headers),
  };
};

export const generateElevenLabsSoundEffect = async ({
  text,
  outputFormat,
  body,
}: {
  text: string;
  outputFormat: string;
  body: Record<string, unknown>;
}): Promise<{
  buffer: Buffer;
  characterCost: number | null;
  contentType: string;
  providerRequestId: string | null;
}> => {
  let lastErrorMessage = "ElevenLabs sound effects request failed.";
  for (let attempt = 1; attempt <= ELEVENLABS_SOUND_EFFECT_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(
      `${ELEVENLABS_BASE_URL}/v1/sound-generation?output_format=${encodeURIComponent(outputFormat)}`,
      {
        method: "POST",
        headers: {
          ...buildElevenLabsHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          ...body,
        }),
      }
    );
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        contentType: resolveOutputContentType(outputFormat, response.headers.get("content-type")),
        characterCost: parseOptionalNumber(response.headers.get("character-cost")),
        providerRequestId: readProviderRequestId(response.headers),
      };
    }

    lastErrorMessage = await readElevenLabsErrorMessage(
      response,
      "ElevenLabs sound effects request failed."
    );
    if (
      attempt < ELEVENLABS_SOUND_EFFECT_MAX_ATTEMPTS &&
      isTransientElevenLabsUpstreamResponse(response)
    ) {
      continue;
    }
    throw new Error(lastErrorMessage);
  }

  throw new Error(lastErrorMessage);
};

export const generateElevenLabsMusic = async ({
  prompt,
  outputFormat,
  body,
}: {
  prompt: string;
  outputFormat: string;
  body: Record<string, unknown>;
}): Promise<{
  buffer: Buffer;
  contentType: string;
  providerRequestId: string | null;
  songId: string | null;
}> => {
  const response = await fetch(
    `${ELEVENLABS_BASE_URL}/v1/music?output_format=${encodeURIComponent(outputFormat)}`,
    {
      method: "POST",
      headers: {
        ...buildElevenLabsHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        ...body,
      }),
    }
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      normalizeOptionalString((payload as { detail?: unknown } | null)?.detail) ??
      normalizeOptionalString((payload as { error?: unknown } | null)?.error) ??
      "ElevenLabs music request failed.";
    throw new Error(message);
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: resolveOutputContentType(outputFormat, response.headers.get("content-type")),
    providerRequestId: readProviderRequestId(response.headers),
    songId: normalizeOptionalString(response.headers.get("song-id")),
  };
};

export const generateElevenLabsVoiceChanger = async ({
  voiceId,
  sourceBuffer,
  sourceFilename,
  sourceMimeType,
  outputFormat,
  modelId,
  voiceSettings,
  removeBackgroundNoise,
  inputFormat,
}: {
  voiceId: string;
  sourceBuffer: Buffer;
  sourceFilename: string;
  sourceMimeType: string | null;
  outputFormat: string;
  modelId: string;
  voiceSettings: Record<string, unknown>;
  removeBackgroundNoise: boolean;
  inputFormat: string;
}): Promise<{ buffer: Buffer; contentType: string; providerRequestId: string | null }> => {
  const sourceExtension =
    path.extname(sourceFilename).replace(/^\./, "") ||
    (sourceMimeType?.split("/")[1]?.replace(/[^a-z0-9]+/gi, "") ?? "bin");
  const sourceHandle = await makeTempFileHandle({
    buffer: sourceBuffer,
    extension: sourceExtension,
  });
  let extractedHandle: TempFileHandle | null = null;
  try {
    const needsAudioExtraction = isVideoSource(sourceMimeType, sourceFilename);
    extractedHandle = needsAudioExtraction
      ? await extractAudioTrack({ sourcePath: sourceHandle.path })
      : null;
    const uploadPath = extractedHandle?.path ?? sourceHandle.path;
    const uploadBuffer = await fs.readFile(uploadPath);
    const uploadFilename = extractedHandle ? "source.wav" : path.basename(sourceFilename);
    const uploadMimeType = extractedHandle
      ? "audio/wav"
      : (sourceMimeType ?? "application/octet-stream");
    const formData = new FormData();
    formData.append("audio", new Blob([uploadBuffer], { type: uploadMimeType }), uploadFilename);
    formData.append("model_id", modelId);
    formData.append("voice_settings", JSON.stringify(voiceSettings));
    formData.append("remove_background_noise", removeBackgroundNoise ? "true" : "false");
    formData.append("file_format", inputFormat);

    const response = await fetch(
      `${ELEVENLABS_BASE_URL}/v1/speech-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`,
      {
        method: "POST",
        headers: buildElevenLabsHeaders(),
        body: formData,
      }
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const message =
        normalizeOptionalString((payload as { detail?: unknown } | null)?.detail) ??
        normalizeOptionalString((payload as { error?: unknown } | null)?.error) ??
        "ElevenLabs voice changer request failed.";
      throw new Error(message);
    }
    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: resolveOutputContentType(outputFormat, response.headers.get("content-type")),
      providerRequestId: readProviderRequestId(response.headers),
    };
  } finally {
    await extractedHandle?.cleanup().catch(() => undefined);
    await sourceHandle.cleanup().catch(() => undefined);
  }
};

export const createRemuxedVoiceChangerVideo = async ({
  sourceVideoBuffer,
  sourceVideoFilename,
  sourceVideoMimeType,
  convertedAudioBuffer,
  convertedAudioContentType,
}: {
  sourceVideoBuffer: Buffer;
  sourceVideoFilename: string;
  sourceVideoMimeType: string | null;
  convertedAudioBuffer: Buffer;
  convertedAudioContentType: string;
}): Promise<RemuxedVoiceChangerVideoResult> => {
  return await remuxVideoWithAudioTrack({
    videoBuffer: sourceVideoBuffer,
    videoFilename: sourceVideoFilename,
    videoMimeType: sourceVideoMimeType,
    audioBuffer: convertedAudioBuffer,
    audioMimeType: convertedAudioContentType,
  });
};

export const persistGeneratedAudioAsset = async ({
  userId,
  promptText,
  provider,
  modelId,
  providerRequestId = null,
  requestId = null,
  projectId = null,
  sourceMode,
  voiceId = null,
  voiceName = null,
  outputBuffer,
  outputContentType,
  outputFormat,
  extraMetadata = {},
}: PersistGeneratedAudioInput): Promise<PersistGeneratedAudioResult> => {
  const supabaseAdmin = getSupabaseAdmin();
  const generationId = randomUUID();
  const resolvedRequestId = normalizeOptionalString(requestId) ?? randomUUID();
  const resolvedProviderRequestId = normalizeOptionalString(providerRequestId);
  const resolvedProjectId = normalizeOptionalString(projectId);
  const createdAtIso = new Date().toISOString();
  const mediaAutosaveEnabled = await readMediaAutosaveEnabledForUser({ supabaseAdmin, userId });
  const autosavePolicyDecision = canAutoPersistRecoveryMedia({
    intent: "auto",
    mediaAutosaveEnabled,
  });
  const extension = resolveFileExtension(outputContentType, outputFormat);
  const filename = `${sanitizeStem(promptText)}.${extension}`;
  const storagePath = assertUserScopedMediaStoragePath({
    userId,
    path: `${userId}/generations/audio/${generationId}/${filename}`,
    label: "Generated audio storage path",
  });

  const uploadResult = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, outputBuffer, {
      contentType: outputContentType,
      upsert: false,
    });
  if (uploadResult.error) {
    throw new Error(uploadResult.error.message || "Unable to persist generated audio.");
  }

  const signedResult = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (signedResult.error || !signedResult.data?.signedUrl) {
    throw new Error(signedResult.error?.message || "Unable to sign generated audio.");
  }

  const generationInsert = await supabaseAdmin
    .from("ai_generations")
    .insert({
      id: generationId,
      user_id: userId,
      mode: "audio",
      provider,
      model_id: modelId,
      prompt_text: promptText,
      request_id: resolvedRequestId,
      status: "success",
      completed_at: createdAtIso,
      metadata: {
        provider_request_id: resolvedProviderRequestId,
        source_mode: sourceMode,
        voice_id: voiceId,
        voice_name: voiceName,
        autosave_enabled: mediaAutosaveEnabled,
        autosave_decision: autosavePolicyDecision.allowed
          ? "autosave_requested"
          : "autosave_skipped",
        autosave_decision_reason: autosavePolicyDecision.reason,
        output_format: outputFormat,
        mime_type: outputContentType,
        project_id: resolvedProjectId,
        ...extraMetadata,
      },
    })
    .select("id")
    .single();
  if (generationInsert.error) {
    throw new Error(generationInsert.error.message || "Unable to record audio generation.");
  }

  let mediaFileId: string | null = null;
  let autosaveDecision: AutosaveDecision = autosavePolicyDecision.allowed
    ? "auto_persisted"
    : "autosave_skipped";
  let autosaveDecisionReason: string = autosavePolicyDecision.reason;
  let outputRows = await persistGenerationOutputRecords({
    generationId,
    providerRequestId: resolvedProviderRequestId,
    userId,
    resultUrls: [signedResult.data.signedUrl],
    mediaFileIds: [],
    metadata: {
      media_kind: "audio",
      provider_request_id: resolvedProviderRequestId,
      autosave_enabled: mediaAutosaveEnabled,
      autosave_decision: autosavePolicyDecision.allowed
        ? "provider_urls_persisted"
        : "autosave_skipped",
      autosave_decision_reason: autosavePolicyDecision.allowed
        ? "canonical_outputs_before_media_autosave"
        : autosavePolicyDecision.reason,
      project_id: resolvedProjectId,
      ...extraMetadata,
    },
  });

  if (autosavePolicyDecision.allowed) {
    try {
      const mediaInsert = await supabaseAdmin
        .from("media_files")
        .insert({
          filename,
          storage_path: storagePath,
          file_type: "audio",
          file_size: outputBuffer.length,
          source: "ai_studio",
          source_ref: generationId,
          metadata: {
            provider,
            model_id: modelId,
            provider_request_id: resolvedProviderRequestId,
            source_mode: sourceMode,
            mime_type: outputContentType,
            output_format: outputFormat,
            voice_id: voiceId,
            voice_name: voiceName,
            autosave_enabled: mediaAutosaveEnabled,
            autosave_decision: "auto_persisted",
            autosave_decision_reason: autosavePolicyDecision.reason,
            project_id: resolvedProjectId,
            ...extraMetadata,
          },
          user_id: userId,
        })
        .select("id")
        .single();
      if (mediaInsert.error || !mediaInsert.data?.id) {
        throw new Error(mediaInsert.error?.message || "Unable to record generated audio media.");
      }
      mediaFileId = mediaInsert.data.id as string;
      outputRows = await persistGenerationOutputRecords({
        generationId,
        providerRequestId: resolvedProviderRequestId,
        userId,
        resultUrls: [signedResult.data.signedUrl],
        mediaFileIds: [mediaFileId],
        metadata: {
          media_kind: "audio",
          provider_request_id: resolvedProviderRequestId,
          autosave_enabled: mediaAutosaveEnabled,
          autosave_decision: "auto_persisted",
          autosave_decision_reason: autosavePolicyDecision.reason,
          project_id: resolvedProjectId,
          ...extraMetadata,
        },
      });
    } catch (error) {
      autosaveDecision = "autosave_skipped";
      autosaveDecisionReason = error instanceof Error ? error.message : "media_autosave_failed";
      await writeAppErrorLog({
        source: "telemetry.elevenlabs.media_autosave_failed",
        message: "ElevenLabs audio generation kept result URL after media autosave failed.",
        requestId: resolvedRequestId,
        userId,
        statusCode: 200,
        metadata: {
          generation_id: generationId,
          provider,
          provider_request_id: resolvedProviderRequestId,
          model_id: modelId,
          media_kind: "audio",
          source_mode: sourceMode,
          autosave_error: autosaveDecisionReason,
        },
      }).catch(() => undefined);
    }
  }
  const outputRowId = outputRows[0]?.id ?? null;

  if (outputRowId) {
    await upsertGenerationPublication({
      generationId,
      generationOutputId: outputRowId,
      userId,
      publicationState: "published",
      ownedMediaFileId: mediaFileId,
      previewUrl: signedResult.data.signedUrl,
      fullUrl: signedResult.data.signedUrl,
      previewStoragePath: storagePath,
      fullStoragePath: storagePath,
      publishedAt: createdAtIso,
      metadata: {
        media_kind: "audio",
        provider_request_id: resolvedProviderRequestId,
        autosave_enabled: mediaAutosaveEnabled,
        autosave_decision: autosaveDecision,
        autosave_decision_reason: autosaveDecisionReason,
        project_id: resolvedProjectId,
        ...extraMetadata,
      },
    });
  }

  await upsertGenerationProjection({
    generationId,
    userId,
    projectId: resolvedProjectId,
    sourceRef: resolvedRequestId,
    requestId: resolvedRequestId,
    provider,
    providerRequestId: resolvedProviderRequestId,
    status: "success",
    taskState: "success",
    displayPrompt: promptText,
    modelId,
    previewUrl: signedResult.data.signedUrl,
    previewStoragePath: storagePath,
    fullStoragePath: storagePath,
    saveState: mediaFileId ? "saved" : "idle",
    hiddenInReferenceGrid: false,
    referenceGridVisible: true,
    publicationState: "published",
    resultUrls: [signedResult.data.signedUrl],
    savedMediaIds: mediaFileId ? [mediaFileId] : [],
    startedAt: createdAtIso,
    completedAt: createdAtIso,
  });

  await associateGeneratedElevenLabsAssetWithProject({
    generationId,
    mediaKind: "audio",
    modelId,
    projectId: resolvedProjectId,
    providerRequestId: resolvedProviderRequestId,
    requestId: resolvedRequestId,
    sourceMode,
    userId,
  });

  return {
    generationId,
    mediaFileId,
    requestId: resolvedRequestId,
    storagePath,
    signedUrl: signedResult.data.signedUrl,
    outputRowId,
  };
};

export const persistGeneratedVideoAsset = async ({
  userId,
  promptText,
  provider,
  modelId,
  providerRequestId = null,
  requestId = null,
  projectId = null,
  sourceMode,
  outputBuffer,
  outputContentType,
  generationReplay = {},
  extraMetadata = {},
}: PersistGeneratedVideoInput): Promise<PersistGeneratedVideoResult> => {
  const supabaseAdmin = getSupabaseAdmin();
  const generationId = randomUUID();
  const resolvedRequestId = normalizeOptionalString(requestId) ?? randomUUID();
  const resolvedProviderRequestId = normalizeOptionalString(providerRequestId);
  const resolvedProjectId = normalizeOptionalString(projectId);
  const createdAtIso = new Date().toISOString();
  const mediaAutosaveEnabled = await readMediaAutosaveEnabledForUser({ supabaseAdmin, userId });
  const autosavePolicyDecision = canAutoPersistRecoveryMedia({
    intent: "auto",
    mediaAutosaveEnabled,
  });
  const extension = resolveVideoFileExtension(outputContentType);
  const filename = `${sanitizeStem(promptText)}.${extension}`;
  const storagePath = assertUserScopedMediaStoragePath({
    userId,
    path: `${userId}/generations/video/${generationId}/${filename}`,
    label: "Generated video storage path",
  });

  const uploadResult = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, outputBuffer, {
      contentType: outputContentType,
      upsert: false,
    });
  if (uploadResult.error) {
    throw new Error(uploadResult.error.message || "Unable to persist generated video.");
  }

  const signedResult = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (signedResult.error || !signedResult.data?.signedUrl) {
    throw new Error(signedResult.error?.message || "Unable to sign generated video.");
  }

  const generationInsert = await supabaseAdmin
    .from("ai_generations")
    .insert({
      id: generationId,
      user_id: userId,
      mode: "video",
      provider,
      model_id: modelId,
      prompt_text: promptText,
      request_id: resolvedRequestId,
      status: "success",
      completed_at: createdAtIso,
      metadata: {
        provider_request_id: resolvedProviderRequestId,
        source_mode: sourceMode,
        autosave_enabled: mediaAutosaveEnabled,
        autosave_decision: autosavePolicyDecision.allowed
          ? "autosave_requested"
          : "autosave_skipped",
        autosave_decision_reason: autosavePolicyDecision.reason,
        mime_type: outputContentType,
        project_id: resolvedProjectId,
        ...extraMetadata,
      },
    })
    .select("id")
    .single();
  if (generationInsert.error) {
    throw new Error(generationInsert.error.message || "Unable to record video generation.");
  }

  let mediaFileId: string | null = null;
  let autosaveDecision: AutosaveDecision = autosavePolicyDecision.allowed
    ? "auto_persisted"
    : "autosave_skipped";
  let autosaveDecisionReason: string = autosavePolicyDecision.reason;
  let previewPosterStoragePath: string | null = null;
  let previewPosterUrl: string | null = null;
  let outputRows = await persistGenerationOutputRecords({
    generationId,
    providerRequestId: resolvedProviderRequestId,
    userId,
    resultUrls: [signedResult.data.signedUrl],
    mediaFileIds: [],
    metadata: {
      media_kind: "video",
      provider_request_id: resolvedProviderRequestId,
      autosave_enabled: mediaAutosaveEnabled,
      autosave_decision: autosavePolicyDecision.allowed
        ? "provider_urls_persisted"
        : "autosave_skipped",
      autosave_decision_reason: autosavePolicyDecision.allowed
        ? "canonical_outputs_before_media_autosave"
        : autosavePolicyDecision.reason,
      project_id: resolvedProjectId,
      ...extraMetadata,
    },
  });

  if (autosavePolicyDecision.allowed) {
    try {
      const mediaInsert = await supabaseAdmin
        .from("media_files")
        .insert({
          filename,
          storage_path: storagePath,
          file_type: "video",
          file_size: outputBuffer.length,
          source: "ai_studio",
          source_ref: generationId,
          metadata: {
            provider,
            model_id: modelId,
            provider_request_id: resolvedProviderRequestId,
            source_mode: sourceMode,
            mime_type: outputContentType,
            autosave_enabled: mediaAutosaveEnabled,
            autosave_decision: "auto_persisted",
            autosave_decision_reason: autosavePolicyDecision.reason,
            project_id: resolvedProjectId,
            ...extraMetadata,
          },
          user_id: userId,
        })
        .select("id")
        .single();
      if (mediaInsert.error || !mediaInsert.data?.id) {
        throw new Error(mediaInsert.error?.message || "Unable to record generated video media.");
      }
      mediaFileId = mediaInsert.data.id as string;
      previewPosterStoragePath = await upsertVideoPosterVariantFromBuffer({
        supabaseAdmin,
        userId,
        mediaFileId,
        videoBuffer: outputBuffer,
        videoMimeType: outputContentType,
        filename,
        metadata: {
          generated_by: "elevenlabs_video_persistence",
          generation_id: generationId,
          source_mode: sourceMode,
          provider_request_id: resolvedProviderRequestId,
        },
      }).catch(() => null);
      previewPosterUrl = await signVideoPosterVariant({
        supabaseAdmin,
        storagePath: previewPosterStoragePath,
      });
      outputRows = await persistGenerationOutputRecords({
        generationId,
        providerRequestId: resolvedProviderRequestId,
        userId,
        resultUrls: [signedResult.data.signedUrl],
        mediaFileIds: [mediaFileId],
        metadata: {
          media_kind: "video",
          provider_request_id: resolvedProviderRequestId,
          autosave_enabled: mediaAutosaveEnabled,
          autosave_decision: "auto_persisted",
          autosave_decision_reason: autosavePolicyDecision.reason,
          project_id: resolvedProjectId,
          ...extraMetadata,
        },
      });
    } catch (error) {
      autosaveDecision = "autosave_skipped";
      autosaveDecisionReason = error instanceof Error ? error.message : "media_autosave_failed";
      await writeAppErrorLog({
        source: "telemetry.elevenlabs.media_autosave_failed",
        message: "ElevenLabs video generation kept result URL after media autosave failed.",
        requestId: resolvedRequestId,
        userId,
        statusCode: 200,
        metadata: {
          generation_id: generationId,
          provider,
          provider_request_id: resolvedProviderRequestId,
          model_id: modelId,
          media_kind: "video",
          source_mode: sourceMode,
          autosave_error: autosaveDecisionReason,
        },
      }).catch(() => undefined);
    }
  }
  const outputRowId = outputRows[0]?.id ?? null;
  const previewStoragePath = previewPosterStoragePath ?? storagePath;

  if (outputRowId) {
    await upsertGenerationPublication({
      generationId,
      generationOutputId: outputRowId,
      userId,
      publicationState: "published",
      ownedMediaFileId: mediaFileId,
      previewUrl: signedResult.data.signedUrl,
      fullUrl: signedResult.data.signedUrl,
      previewStoragePath,
      fullStoragePath: storagePath,
      publishedAt: createdAtIso,
      metadata: {
        media_kind: "video",
        provider_request_id: resolvedProviderRequestId,
        autosave_enabled: mediaAutosaveEnabled,
        autosave_decision: autosaveDecision,
        autosave_decision_reason: autosaveDecisionReason,
        project_id: resolvedProjectId,
        ...extraMetadata,
      },
    });
  }

  await upsertGenerationProjection({
    generationId,
    userId,
    projectId: resolvedProjectId,
    sourceRef: resolvedRequestId,
    requestId: resolvedRequestId,
    provider,
    providerRequestId: resolvedProviderRequestId,
    status: "success",
    taskState: "success",
    displayPrompt: promptText,
    modelId,
    previewUrl: signedResult.data.signedUrl,
    previewStoragePath,
    fullStoragePath: storagePath,
    saveState: mediaFileId ? "saved" : "idle",
    hiddenInReferenceGrid: false,
    referenceGridVisible: true,
    publicationState: "published",
    resultUrls: [signedResult.data.signedUrl],
    savedMediaIds: mediaFileId ? [mediaFileId] : [],
    generationReplay,
    startedAt: createdAtIso,
    completedAt: createdAtIso,
  });

  await associateGeneratedElevenLabsAssetWithProject({
    generationId,
    mediaKind: "video",
    modelId,
    projectId: resolvedProjectId,
    providerRequestId: resolvedProviderRequestId,
    requestId: resolvedRequestId,
    sourceMode,
    userId,
  });

  return {
    generationId,
    mediaFileId,
    requestId: resolvedRequestId,
    storagePath,
    signedUrl: signedResult.data.signedUrl,
    previewStoragePath,
    fullStoragePath: storagePath,
    previewPosterStoragePath,
    previewPosterUrl,
    outputRowId,
  };
};

export const readRemoteSourceBuffer = async ({
  sourceUrl,
}: {
  sourceUrl: string;
}): Promise<{ buffer: Buffer; contentType: string | null }> => {
  return await downloadRemoteFile(sourceUrl);
};
