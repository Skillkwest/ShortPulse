/**
 * Canonical helpers for Lip Sync voice-audio state, durability, and readiness.
 */
import type { LipSyncAudioSourceKind, LipSyncAudioState } from "../types";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

const stripAudioUrlFragment = (value: string): string => value.replace(/#.*$/, "").trim();

const normalizeLipSyncAudioTitle = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const isPrivateIpv4Address = (hostname: string): boolean => {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map((segment) => Number.parseInt(segment, 10));
  if (octets.some((octet) => !Number.isFinite(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  const [first, second] = octets;
  return (
    first === 10 ||
    first === 127 ||
    (first === 192 && second === 168) ||
    (first === 172 && second >= 16 && second <= 31)
  );
};

export const normalizeLipSyncAudioUrl = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = stripAudioUrlFragment(value);
  return normalized.length > 0 ? normalized : null;
};

export const normalizeLipSyncAudioStoragePath = (
  value: string | null | undefined
): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const isNonDurableLipSyncAudioUrl = (value: string | null | undefined): boolean => {
  const normalized = normalizeLipSyncAudioUrl(value);
  if (!normalized) return true;
  if (normalized.startsWith("blob:") || /^data:audio\//i.test(normalized)) return true;
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return true;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
  const hostname = parsed.hostname.trim().toLowerCase();
  if (!hostname) return true;
  if (LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) return true;
  return isPrivateIpv4Address(hostname);
};

export const resolveLipSyncAudioDurableSource = ({
  urlCandidates,
  storagePathCandidates,
}: {
  urlCandidates: (string | null | undefined)[];
  storagePathCandidates?: (string | null | undefined)[];
}): { url: string | null; storagePath: string | null } => {
  const url =
    urlCandidates
      .map(normalizeLipSyncAudioUrl)
      .find((candidate): candidate is string =>
        Boolean(candidate && !isNonDurableLipSyncAudioUrl(candidate))
      ) ?? null;
  const storagePath =
    (storagePathCandidates ?? [])
      .map(normalizeLipSyncAudioStoragePath)
      .find((candidate): candidate is string => Boolean(candidate)) ?? null;
  return { url, storagePath };
};

export const createEmptyLipSyncAudioState = (): LipSyncAudioState => ({
  url: null,
  durationMs: null,
  status: "empty",
  sourceKind: null,
});

export const createUploadingLipSyncAudioState = ({
  durationMs,
  previewUrl,
  title,
  mimeType,
  size,
}: {
  durationMs: number | null;
  previewUrl: string;
  title?: string | null;
  mimeType?: string | null;
  size?: number | null;
}): LipSyncAudioState => ({
  url: null,
  ...(normalizeLipSyncAudioTitle(title) ? { title: normalizeLipSyncAudioTitle(title) } : {}),
  durationMs,
  status: "uploading",
  sourceKind: "local",
  previewUrl,
  mimeType: mimeType ?? null,
  size: size ?? null,
});

export const createFailedLipSyncAudioState = ({
  durationMs,
  previewUrl,
  title,
  error,
  mimeType,
  size,
}: {
  durationMs: number | null;
  previewUrl?: string | null;
  title?: string | null;
  error: string;
  mimeType?: string | null;
  size?: number | null;
}): LipSyncAudioState => ({
  url: null,
  ...(normalizeLipSyncAudioTitle(title) ? { title: normalizeLipSyncAudioTitle(title) } : {}),
  durationMs,
  status: "failed",
  sourceKind: "local",
  previewUrl: previewUrl ?? null,
  error,
  mimeType: mimeType ?? null,
  size: size ?? null,
});

export const createReadyLipSyncAudioState = ({
  url,
  title,
  durationMs,
  sourceKind,
  storagePath = null,
  previewUrl = null,
  mimeType = null,
  size = null,
}: {
  url: string | null;
  title?: string | null;
  durationMs: number | null;
  sourceKind: NonNullable<LipSyncAudioSourceKind>;
  storagePath?: string | null;
  previewUrl?: string | null;
  mimeType?: string | null;
  size?: number | null;
}): LipSyncAudioState => ({
  url: normalizeLipSyncAudioUrl(url),
  ...(normalizeLipSyncAudioTitle(title) ? { title: normalizeLipSyncAudioTitle(title) } : {}),
  durationMs,
  status: "ready",
  sourceKind,
  storagePath: normalizeLipSyncAudioStoragePath(storagePath),
  previewUrl,
  mimeType,
  size,
});

export const createLipSyncAudioStateFromDurableUrl = ({
  url,
  title,
  durationMs,
  sourceKind,
  storagePath,
}: {
  url: string | null | undefined;
  title?: string | null;
  durationMs: number | null;
  sourceKind: NonNullable<LipSyncAudioSourceKind>;
  storagePath?: string | null;
}): LipSyncAudioState => {
  const normalized = normalizeLipSyncAudioUrl(url);
  const normalizedStoragePath = normalizeLipSyncAudioStoragePath(storagePath);
  if ((!normalized || isNonDurableLipSyncAudioUrl(normalized)) && !normalizedStoragePath) {
    return createEmptyLipSyncAudioState();
  }
  return createReadyLipSyncAudioState({
    url: normalized,
    title,
    durationMs,
    sourceKind,
    storagePath: normalizedStoragePath,
  });
};

export const createFailedNonDurableLipSyncAudioState = (
  previewUrl?: string | null
): LipSyncAudioState => ({
  ...createEmptyLipSyncAudioState(),
  status: "failed",
  previewUrl: previewUrl ?? null,
  error: "Local voice audio is no longer available. Re-add the audio file and try again.",
});

export const getLipSyncAudioPlaybackUrl = (value: LipSyncAudioState): string | null =>
  normalizeLipSyncAudioUrl(value.previewUrl ?? value.url);

export const resolveLipSyncAudioStatus = (value: LipSyncAudioState): LipSyncAudioState["status"] =>
  value.status;

export const isLipSyncAudioReadyForSubmit = (value: LipSyncAudioState): boolean =>
  value.status === "ready" &&
  (Boolean(normalizeLipSyncAudioStoragePath(value.storagePath)) ||
    (Boolean(normalizeLipSyncAudioUrl(value.url)) && !isNonDurableLipSyncAudioUrl(value.url)));

export const getDurableLipSyncAudioUrl = (value: LipSyncAudioState): string | null =>
  value.status === "ready" && !isNonDurableLipSyncAudioUrl(value.url)
    ? normalizeLipSyncAudioUrl(value.url)
    : null;

export const getLipSyncAudioStoragePath = (value: LipSyncAudioState): string | null =>
  value.status === "ready" ? normalizeLipSyncAudioStoragePath(value.storagePath) : null;
