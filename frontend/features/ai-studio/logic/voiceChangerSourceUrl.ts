/**
 * URL helpers for Voice Changer source intake.
 */
import { normalizeReferenceTransferUrlCandidate } from "../utils/dragDrop";
import { isAudioUrl, isVideoUrl } from "./stateParsers";
import type { VoiceChangerSourceKind } from "./voiceChangerSourceTypes";

const REMOTE_FETCHABLE_URL_PROTOCOL_PATTERN = /^https?:$/i;

export const isRemoteFetchableUrlProtocol = (protocol: string): boolean =>
  REMOTE_FETCHABLE_URL_PROTOCOL_PATTERN.test(protocol);

export const getVoiceChangerSourceUrlFilename = (
  value: string | null | undefined
): string | null => {
  if (!value) return null;
  try {
    const parsed = new URL(
      value,
      typeof window === "undefined" ? "https://shortpulse.local" : window.location.href
    );
    const filename = parsed.pathname.split("/").filter(Boolean).pop()?.trim() ?? "";
    return filename || null;
  } catch {
    const segments = value.split("/").filter(Boolean);
    return segments.length ? segments[segments.length - 1] : null;
  }
};

export const inferVoiceChangerSourceKindFromUrl = (
  value: string | null | undefined
): VoiceChangerSourceKind | null => {
  const normalized = normalizeReferenceTransferUrlCandidate(value, { unwrapNextImage: false });
  if (!normalized) return null;
  if (isAudioUrl(normalized)) return "audio";
  if (isVideoUrl(normalized)) return "video";
  return null;
};

const resolveMimeTypeHintFromUrl = (value: string | null | undefined): string | null => {
  const normalized = normalizeReferenceTransferUrlCandidate(value, { unwrapNextImage: false });
  if (!normalized) return null;
  try {
    const parsed = new URL(
      normalized,
      typeof window === "undefined" ? "https://shortpulse.local" : window.location.href
    );
    const hint =
      parsed.searchParams.get("mimeType") ??
      parsed.searchParams.get("mime") ??
      parsed.searchParams.get("contentType") ??
      parsed.searchParams.get("type") ??
      "";
    const trimmed = hint.trim().toLowerCase();
    return trimmed || null;
  } catch {
    return null;
  }
};

export const inferVoiceChangerSourceMimeTypeFromUrl = (
  value: string | null | undefined
): string | null => {
  const normalized = normalizeReferenceTransferUrlCandidate(value, { unwrapNextImage: false });
  if (!normalized) return null;
  const mimeTypeHint = resolveMimeTypeHintFromUrl(normalized);
  if (mimeTypeHint?.startsWith("audio/") || mimeTypeHint?.startsWith("video/")) {
    return mimeTypeHint;
  }
  if (/\.mp3(?:$|[?#])/i.test(normalized)) return "audio/mpeg";
  if (/\.wav(?:$|[?#])/i.test(normalized)) return "audio/wav";
  if (/\.m4a(?:$|[?#])/i.test(normalized)) return "audio/mp4";
  if (/\.aac(?:$|[?#])/i.test(normalized)) return "audio/aac";
  if (/\.flac(?:$|[?#])/i.test(normalized)) return "audio/flac";
  if (/\.(?:ogg|oga)(?:$|[?#])/i.test(normalized)) return "audio/ogg";
  if (/\.mp4(?:$|[?#])/i.test(normalized)) return "video/mp4";
  if (/\.mov(?:$|[?#])/i.test(normalized)) return "video/quicktime";
  if (/\.m4v(?:$|[?#])/i.test(normalized)) return "video/x-m4v";
  if (/\.webm(?:$|[?#])/i.test(normalized)) return "video/webm";
  return null;
};
