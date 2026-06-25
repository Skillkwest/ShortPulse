import { promises as fs } from "fs";
import path from "path";
import { ElevenLabsProviderError } from "./api/elevenlabsProviderError";
import {
  extractAudioTrack,
  isVideoSource,
  makeTempFileHandle,
  normalizeAudioForVoiceClone,
  remuxVideoWithAudioTrack,
  type TempFileHandle,
} from "./mediaAudioExtraction";

/**
 * Provider-facing ElevenLabs client for voice, audio, music, and voice-changer requests.
 * Keeps upstream HTTP details separate from ShortPulse persistence and projection writes.
 */
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io";
const OUTPUT_CONTENT_TYPE_BY_FORMAT_PREFIX: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  pcm: "audio/wav",
  ulaw: "audio/basic",
};
const ELEVENLABS_TRANSIENT_UPSTREAM_STATUSES = new Set([502, 503, 504]);
const ELEVENLABS_TRANSIENT_UPSTREAM_CODES = new Set(["rate_limit_exceeded", "system_busy"]);
const ELEVENLABS_SOUND_EFFECT_MAX_ATTEMPTS = 2;
const ELEVENLABS_JSON_REQUEST_TIMEOUT_MS = 10_000;

type ElevenLabsMusicDetailedMetadata = {
  composition_plan?: {
    sections?: Array<{
      lines?: unknown;
    }>;
  };
  compositionPlan?: {
    sections?: Array<{
      lines?: unknown;
    }>;
  };
};

type ElevenLabsMusicDetailedResponse = {
  audioBuffer: Buffer;
  audioContentType: string | null;
  metadata: ElevenLabsMusicDetailedMetadata | null;
};

export type ElevenLabsVoice = {
  voiceId: string;
  name: string;
  previewUrl: string | null;
  description: string | null;
  isFallback: boolean;
  providerCategory: string | null;
  providerVoiceType: string | null;
};

export type ElevenLabsDesignedVoicePreview = {
  generatedVoiceId: string;
  audioBase64: string;
  mediaType: string | null;
  durationSecs: number | null;
  language: string | null;
};

export type RemuxedVoiceChangerVideoResult = {
  buffer: Buffer;
  contentType: "video/mp4" | "video/webm";
};

type ElevenLabsJsonOptions = {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
};

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const indexOfHeaderSeparator = (
  buffer: Buffer
): { index: number; separatorLength: number } | null => {
  const crlfIndex = buffer.indexOf("\r\n\r\n");
  if (crlfIndex >= 0) return { index: crlfIndex, separatorLength: 4 };
  const lfIndex = buffer.indexOf("\n\n");
  if (lfIndex >= 0) return { index: lfIndex, separatorLength: 2 };
  return null;
};

const stripTrailingLineBreak = (buffer: Buffer): Buffer => {
  if (buffer.length >= 2 && buffer[buffer.length - 2] === 13 && buffer[buffer.length - 1] === 10) {
    return buffer.subarray(0, buffer.length - 2);
  }
  if (buffer.length >= 1 && buffer[buffer.length - 1] === 10) {
    return buffer.subarray(0, buffer.length - 1);
  }
  return buffer;
};

const parseHeaderLines = (headerText: string): Record<string, string> => {
  const headers: Record<string, string> = {};
  for (const line of headerText.split(/\r?\n/)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex <= 0) continue;
    headers[line.slice(0, separatorIndex).trim().toLowerCase()] = line
      .slice(separatorIndex + 1)
      .trim();
  }
  return headers;
};

const resolveMultipartBoundary = (contentType: string | null): string | null => {
  if (!contentType) return null;
  const boundaryMatch = contentType.match(/(?:^|;)\s*boundary=(?:"([^"]+)"|([^;]+))/i);
  return (boundaryMatch?.[1] ?? boundaryMatch?.[2] ?? null)?.trim() || null;
};

const parseElevenLabsMusicDetailedMultipart = ({
  buffer,
  contentType,
}: {
  buffer: Buffer;
  contentType: string | null;
}): ElevenLabsMusicDetailedResponse => {
  const boundary = resolveMultipartBoundary(contentType);
  if (!boundary) {
    return {
      audioBuffer: buffer,
      audioContentType: contentType,
      metadata: null,
    };
  }

  const boundaryMarker = Buffer.from(`--${boundary}`);
  let cursor = buffer.indexOf(boundaryMarker);
  let metadata: ElevenLabsMusicDetailedMetadata | null = null;
  let audioBuffer: Buffer | null = null;
  let audioContentType: string | null = null;

  while (cursor >= 0) {
    cursor += boundaryMarker.length;
    if (buffer.subarray(cursor, cursor + 2).toString("utf8") === "--") break;
    if (buffer[cursor] === 13 && buffer[cursor + 1] === 10) {
      cursor += 2;
    } else if (buffer[cursor] === 10) {
      cursor += 1;
    }

    const nextBoundaryIndex = buffer.indexOf(boundaryMarker, cursor);
    if (nextBoundaryIndex < 0) break;

    const partBuffer = stripTrailingLineBreak(buffer.subarray(cursor, nextBoundaryIndex));
    const separator = indexOfHeaderSeparator(partBuffer);
    if (separator) {
      const headers = parseHeaderLines(partBuffer.subarray(0, separator.index).toString("utf8"));
      const partContentType = headers["content-type"]?.toLowerCase() ?? "";
      const body = partBuffer.subarray(separator.index + separator.separatorLength);
      if (partContentType.includes("application/json")) {
        metadata = JSON.parse(body.toString("utf8")) as ElevenLabsMusicDetailedMetadata;
      } else if (
        partContentType.startsWith("audio/") ||
        partContentType.includes("application/octet-stream")
      ) {
        audioBuffer = body;
        audioContentType = headers["content-type"] ?? null;
      }
    }

    cursor = nextBoundaryIndex;
  }

  return {
    audioBuffer: audioBuffer ?? Buffer.alloc(0),
    audioContentType,
    metadata,
  };
};

const extractLyricsTextFromMusicMetadata = (
  metadata: ElevenLabsMusicDetailedMetadata | null
): string | null => {
  const sections = metadata?.composition_plan?.sections ?? metadata?.compositionPlan?.sections;
  if (!Array.isArray(sections)) return null;
  const lines = sections.flatMap((section) =>
    Array.isArray(section.lines)
      ? section.lines
          .map((line) => normalizeOptionalString(line))
          .filter((line): line is string => Boolean(line))
      : []
  );
  return lines.length ? lines.join("\n") : null;
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

const normalizeVoiceLookupKey = (value: string): string => value.trim().toLowerCase();

const parseOptionalNumber = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseRetryAfterSeconds = (value: string | null): number | null => {
  const parsed = parseOptionalNumber(value);
  if (parsed === null) return null;
  return Math.max(1, Math.trunc(parsed));
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

const buildElevenLabsProviderError = async (
  response: Response,
  fallbackMessage: string
): Promise<ElevenLabsProviderError> => {
  const payload = await response.json().catch(() => null);
  const detailRecord =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).detail &&
        typeof (payload as Record<string, unknown>).detail === "object" &&
        !Array.isArray((payload as Record<string, unknown>).detail)
        ? ((payload as Record<string, unknown>).detail as Record<string, unknown>)
        : (payload as Record<string, unknown>)
      : null;
  const message =
    normalizeProviderErrorMessage((payload as { detail?: unknown } | null)?.detail) ??
    normalizeProviderErrorMessage((payload as { error?: unknown } | null)?.error) ??
    normalizeProviderErrorMessage(payload) ??
    fallbackMessage;
  return new ElevenLabsProviderError(message, {
    status: response.status,
    retryAfterSeconds: parseRetryAfterSeconds(response.headers.get("retry-after")),
    code:
      normalizeOptionalString(detailRecord?.code) ??
      normalizeOptionalString((payload as { code?: unknown } | null)?.code),
    type:
      normalizeOptionalString(detailRecord?.type) ??
      normalizeOptionalString((payload as { type?: unknown } | null)?.type),
    requestId:
      normalizeOptionalString(detailRecord?.request_id) ??
      normalizeOptionalString((payload as { request_id?: unknown } | null)?.request_id) ??
      readProviderRequestId(response.headers),
  });
};

const shouldRetryElevenLabsProviderError = (error: ElevenLabsProviderError): boolean => {
  if (isTransientElevenLabsUpstreamResponse({ status: error.status } as Response)) {
    return true;
  }
  if (error.status !== 429) return false;
  return error.code !== null && ELEVENLABS_TRANSIENT_UPSTREAM_CODES.has(error.code.toLowerCase());
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
    providerCategory: normalizeOptionalString(voice.category)?.toLowerCase() ?? null,
    providerVoiceType: normalizeOptionalString(voice.voice_type)?.toLowerCase() ?? null,
  };
};

const fetchElevenLabsJson = async <TResponse>(
  pathname: string,
  options?: ElevenLabsJsonOptions
): Promise<TResponse> => {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort();
  }, ELEVENLABS_JSON_REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${ELEVENLABS_BASE_URL}${pathname}`, {
      method: options?.method ?? "GET",
      headers: {
        ...buildElevenLabsHeaders(),
        "Content-Type": "application/json",
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: abortController.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("ElevenLabs request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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

const assertGeneratedAudioPayload = ({
  buffer,
  contentType,
  label,
}: {
  buffer: Buffer;
  contentType: string;
  label: string;
}): void => {
  const normalizedContentType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!buffer.length) {
    throw new Error(`${label} returned an empty audio payload.`);
  }
  if (
    !normalizedContentType.startsWith("audio/") &&
    normalizedContentType !== "application/octet-stream"
  ) {
    throw new Error(`${label} returned a non-audio payload.`);
  }
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

export const listElevenLabsVoices = async (): Promise<ElevenLabsVoice[]> => {
  const payload = await fetchElevenLabsJson<{
    voices?: Array<Record<string, unknown>>;
  }>("/v2/voices?page_size=100&include_total_count=false");

  const liveVoices = payload.voices
    ?.map((voice) => {
      const normalizedVoice = normalizeElevenLabsVoice(voice);
      if (!normalizedVoice) return null;
      return normalizedVoice;
    })
    .filter((entry): entry is ElevenLabsVoice => Boolean(entry));

  if (liveVoices && liveVoices.length > 0) {
    const dedupedVoices = new Map<string, ElevenLabsVoice>();
    for (const entry of liveVoices) {
      const lookupKey = normalizeVoiceLookupKey(entry.voiceId);
      if (!dedupedVoices.has(lookupKey)) {
        dedupedVoices.set(lookupKey, entry);
      }
    }
    return Array.from(dedupedVoices.values()).sort((leftEntry, rightEntry) => {
      const leftRank = leftEntry.providerCategory === "premade" ? 0 : 1;
      const rightRank = rightEntry.providerCategory === "premade" ? 0 : 1;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return leftEntry.name.localeCompare(rightEntry.name, undefined, {
        sensitivity: "base",
      });
    });
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
  const normalizedSource = await normalizeAudioForVoiceClone({
    buffer: sourceBuffer,
    filename: sourceFilename,
    mimeType: sourceMimeType,
  });
  const formData = new FormData();
  formData.append("name", voiceName);
  if (voiceDescription?.trim()) {
    formData.append("description", voiceDescription.trim());
  }
  formData.append("remove_background_noise", removeBackgroundNoise ? "true" : "false");
  const uploadedSample = new File(
    [new Uint8Array(normalizedSource.buffer)],
    normalizedSource.filename,
    { type: normalizedSource.mimeType }
  );
  formData.append("files", uploadedSample);

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
    providerCategory: "cloned",
    providerVoiceType: null,
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
    throw await buildElevenLabsProviderError(response, "ElevenLabs voiceover request failed.");
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = resolveOutputContentType(outputFormat, response.headers.get("content-type"));
  assertGeneratedAudioPayload({
    buffer,
    contentType,
    label: "ElevenLabs voiceover request",
  });
  return {
    buffer,
    contentType,
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
  let lastError: ElevenLabsProviderError | null = null;
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
      const buffer = Buffer.from(arrayBuffer);
      const contentType = resolveOutputContentType(
        outputFormat,
        response.headers.get("content-type")
      );
      assertGeneratedAudioPayload({
        buffer,
        contentType,
        label: "ElevenLabs sound effects request",
      });
      return {
        buffer,
        contentType,
        characterCost: parseOptionalNumber(response.headers.get("character-cost")),
        providerRequestId: readProviderRequestId(response.headers),
      };
    }

    lastError = await buildElevenLabsProviderError(
      response,
      "ElevenLabs sound effects request failed."
    );
    if (
      attempt < ELEVENLABS_SOUND_EFFECT_MAX_ATTEMPTS &&
      shouldRetryElevenLabsProviderError(lastError)
    ) {
      continue;
    }
    throw lastError;
  }

  throw lastError ?? new Error("ElevenLabs sound effects request failed.");
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
  lyricsText: string | null;
}> => {
  const response = await fetch(
    `${ELEVENLABS_BASE_URL}/v1/music/detailed?output_format=${encodeURIComponent(outputFormat)}`,
    {
      method: "POST",
      headers: {
        ...buildElevenLabsHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        with_timestamps: false,
        ...body,
      }),
    }
  );
  if (!response.ok) {
    throw await buildElevenLabsProviderError(response, "ElevenLabs music request failed.");
  }
  const arrayBuffer = await response.arrayBuffer();
  const detailedResponse = parseElevenLabsMusicDetailedMultipart({
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type"),
  });
  const contentType = resolveOutputContentType(outputFormat, detailedResponse.audioContentType);
  assertGeneratedAudioPayload({
    buffer: detailedResponse.audioBuffer,
    contentType,
    label: "ElevenLabs music request",
  });
  return {
    buffer: detailedResponse.audioBuffer,
    contentType,
    providerRequestId: readProviderRequestId(response.headers),
    songId: normalizeOptionalString(response.headers.get("song-id")),
    lyricsText: extractLyricsTextFromMusicMetadata(detailedResponse.metadata),
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
      throw await buildElevenLabsProviderError(
        response,
        "ElevenLabs voice changer request failed."
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = resolveOutputContentType(
      outputFormat,
      response.headers.get("content-type")
    );
    assertGeneratedAudioPayload({
      buffer,
      contentType,
      label: "ElevenLabs voice changer request",
    });
    return {
      buffer,
      contentType,
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

export const readRemoteSourceBuffer = async ({
  sourceUrl,
}: {
  sourceUrl: string;
}): Promise<{ buffer: Buffer; contentType: string | null }> => {
  return await downloadRemoteFile(sourceUrl);
};
