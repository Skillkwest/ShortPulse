/**
 * Voice changer Reference Grid source resolution helpers.
 * Keeps storage paths, render URLs, and local browser URLs in separate lanes.
 */
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import { isAudioUrl, isVideoUrl } from "./stateParsers";
import type { StudioOutput } from "../types";

type VoiceChangerReferenceSourceKind = "audio" | "video";

const REMOTE_MEDIA_URL_PROTOCOL_PATTERN = /^https?:\/\//i;
const LOCAL_BROWSER_MEDIA_URL_PATTERN = /^(?:blob:|data:)/i;
const ROOT_RELATIVE_URL_PATTERN = /^\//;

export const normalizeOptionalText = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
};

const resolveCanonicalStoragePath = (value: string | null | undefined): string | null => {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed || ROOT_RELATIVE_URL_PATTERN.test(trimmed)) return null;
  return asCanonicalStoragePath(trimmed);
};

export const resolveVoiceChangerOutputStoragePath = (output: StudioOutput): string | null =>
  resolveCanonicalStoragePath(output.fullStoragePath) ??
  resolveCanonicalStoragePath(output.previewStoragePath);

const hasCanonicalVoiceChangerSourceStorage = (output: StudioOutput): boolean =>
  resolveVoiceChangerOutputStoragePath(output) !== null;

const matchesVoiceChangerKind = (value: string, kind: VoiceChangerReferenceSourceKind): boolean =>
  kind === "audio" ? isAudioUrl(value) : isVideoUrl(value);

const normalizeRemoteUrl = (candidate: string | null | undefined): string | null => {
  const normalized = normalizeOptionalText(candidate);
  if (!normalized || !REMOTE_MEDIA_URL_PROTOCOL_PATTERN.test(normalized)) return null;
  return normalized;
};

export const resolveVoiceChangerOutputRemoteUrl = ({
  output,
  kind,
  payloadReferenceUrl,
}: {
  output: StudioOutput;
  kind: VoiceChangerReferenceSourceKind;
  payloadReferenceUrl?: string | null;
}): string | null => {
  if (output.mediaSource === "generated" && !hasCanonicalVoiceChangerSourceStorage(output)) {
    return null;
  }

  const sourceCandidates = [
    output.fullStoragePath,
    ...(output.resultUrls ?? []),
    payloadReferenceUrl,
  ];
  for (const candidate of sourceCandidates) {
    const normalized = normalizeRemoteUrl(candidate);
    if (!normalized) continue;
    if (matchesVoiceChangerKind(normalized, kind) || output.mode === kind) return normalized;
  }

  const previewCandidates = [output.previewStoragePath, output.previewUrl];
  for (const candidate of previewCandidates) {
    const normalized = normalizeRemoteUrl(candidate);
    if (normalized && matchesVoiceChangerKind(normalized, kind)) return normalized;
  }

  return null;
};

export const resolveVoiceChangerOutputLocalUrl = (output: StudioOutput): string | null => {
  const candidates = [output.localObjectUrl, output.previewUrl, ...(output.resultUrls ?? [])];
  for (const candidate of candidates) {
    const normalized = normalizeOptionalText(candidate);
    if (normalized && LOCAL_BROWSER_MEDIA_URL_PATTERN.test(normalized)) return normalized;
  }
  return null;
};

export const resolveVoiceChangerBlobFilename = ({
  output,
  kind,
  mimeType,
}: {
  output: StudioOutput;
  kind: VoiceChangerReferenceSourceKind;
  mimeType: string | null;
}): string => {
  const existingName = normalizeOptionalText(output.prompt || output.previewText);
  if (existingName && /\.[a-z0-9]{2,5}$/i.test(existingName)) return existingName;
  const extension = (() => {
    const normalizedMime = mimeType?.toLowerCase() ?? "";
    if (normalizedMime.includes("wav")) return "wav";
    if (normalizedMime.includes("mpeg") || normalizedMime.includes("mp3")) return "mp3";
    if (normalizedMime.includes("mp4")) return kind === "audio" ? "m4a" : "mp4";
    if (normalizedMime.includes("ogg")) return "ogg";
    if (normalizedMime.includes("webm")) return "webm";
    if (normalizedMime.includes("quicktime")) return "mov";
    return kind === "audio" ? "mp3" : "mp4";
  })();
  return `${existingName ?? `reference-grid-${kind}`}.${extension}`;
};
