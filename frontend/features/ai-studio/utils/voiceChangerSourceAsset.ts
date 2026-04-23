import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";
import { BUCKET } from "../../media-library/logic/mediaLibraryPageHelpers";

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  if (typeof globalThis.atob === "function") {
    return globalThis.atob(padded);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  throw new Error("No base64 decoder available");
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const segments = token.split(".");
  if (segments.length < 2) return null;
  try {
    const rawPayload = decodeBase64Url(segments[1] ?? "");
    const parsed = JSON.parse(rawPayload);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const sanitizeFileStem = (value: string): string => {
  return (
    value
      .trim()
      .replace(/\.[^.]+$/, "")
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "voice_changer_source"
  );
};

const inferExtensionFromMimeType = (mimeType: string, fallback: "audio" | "video"): string => {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === "audio/mpeg") return "mp3";
  if (normalized === "audio/mp4") return "m4a";
  if (normalized === "audio/wav" || normalized === "audio/x-wav") return "wav";
  if (normalized === "audio/aac") return "aac";
  if (normalized === "audio/flac") return "flac";
  if (normalized === "audio/ogg") return "ogg";
  if (normalized === "audio/webm") return "webm";
  if (normalized === "video/mp4") return "mp4";
  if (normalized === "video/quicktime") return "mov";
  if (normalized === "video/x-m4v") return "m4v";
  if (normalized === "video/webm") return "webm";
  return fallback === "audio" ? "wav" : "mp4";
};

const parseSupabaseSignedObjectRef = (
  url: string
): { bucket: string; storagePath: string } | null => {
  try {
    const parsedUrl = new URL(url);
    const match = parsedUrl.pathname.match(/^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/i);
    if (!match) return null;

    const bucket = decodeURIComponent(match[1] ?? "").trim();
    const pathFromPathname = decodeURIComponent(match[2] ?? "").trim();
    if (!bucket || !pathFromPathname) return null;

    const token = parsedUrl.searchParams.get("token");
    const payload = token ? decodeJwtPayload(token) : null;
    const payloadUrl = typeof payload?.url === "string" ? payload.url.trim() : "";

    let storagePath = pathFromPathname;
    if (payloadUrl) {
      const normalized = payloadUrl.replace(/^\/+/, "");
      if (normalized.startsWith(`${bucket}/`)) {
        storagePath = normalized.slice(bucket.length + 1);
      }
    }

    if (!storagePath) return null;
    return { bucket, storagePath };
  } catch {
    return null;
  }
};

export const resolveVoiceChangerSourceStoragePath = (
  sourceUrl: string | null | undefined
): string | null => {
  if (typeof sourceUrl !== "string") return null;
  const normalized = sourceUrl.trim();
  if (!normalized) return null;
  const parsedSignedRef = parseSupabaseSignedObjectRef(normalized);
  if (parsedSignedRef && parsedSignedRef.bucket === BUCKET) {
    return parsedSignedRef.storagePath;
  }
  return null;
};

export const signVoiceChangerStoragePath = async (storagePath: string): Promise<string> => {
  const signedUrl = await getSignedMediaUrl({
    bucket: BUCKET,
    storagePath,
    forceRefresh: true,
  });
  if (!signedUrl?.trim()) {
    throw new Error("Unable to sign the stored voice changer source.");
  }
  return signedUrl;
};

export const uploadVoiceChangerSourceFile = async ({
  file,
  kind,
}: {
  file: File;
  kind: "audio" | "video";
}): Promise<{
  storagePath: string;
  signedUrl: string;
  mimeType: string;
  name: string;
  size: number;
}> => {
  const userId = await readSupabaseUserId();
  if (!userId) {
    throw new Error("You must be signed in to stage a voice changer source.");
  }

  const mimeType = file.type.trim() || (kind === "audio" ? "audio/wav" : "video/mp4");
  const extension = file.name.includes(".")
    ? file.name.split(".").pop()?.trim().toLowerCase() || inferExtensionFromMimeType(mimeType, kind)
    : inferExtensionFromMimeType(mimeType, kind);
  const storedName = `${crypto.randomUUID()}-${sanitizeFileStem(file.name)}.${extension}`;
  const storagePath = assertUserScopedMediaStoragePath({
    path: `${userId}/voice-changer/source-${kind}/${storedName}`,
    userId,
    label: "Voice changer source storage path",
  });

  const supabase = ensureSupabaseQueryClient();
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    upsert: false,
    contentType: mimeType,
  });
  if (error) {
    throw new Error(error.message || "Unable to store the voice changer source.");
  }

  return {
    storagePath,
    signedUrl: await signVoiceChangerStoragePath(storagePath),
    mimeType,
    name: file.name.trim() || storedName,
    size: file.size,
  };
};

type ExtractAudioResponse = {
  audio?: {
    name?: unknown;
    mimeType?: unknown;
    previewUrl?: unknown;
    storagePath?: unknown;
    size?: unknown;
  };
  error?: unknown;
  details?: unknown;
};

export const extractVoiceChangerVideoSource = async ({
  sourceName,
  sourceOrigin,
  sourceMimeType,
  sourceStoragePath,
  sourceUrl,
}: {
  sourceName: string;
  sourceOrigin: "local" | "reference-grid" | "url";
  sourceMimeType: string | null;
  sourceStoragePath: string | null;
  sourceUrl: string | null;
}): Promise<{
  storagePath: string;
  signedUrl: string;
  mimeType: "audio/wav";
  name: string;
  size: number;
}> => {
  const response = await fetchWithAuth("/api/media/extract-audio", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sourceName,
      sourceOrigin,
      sourceMimeType,
      sourceStoragePath,
      sourceUrl,
    }),
    shortpulseLogScope: "generation",
  });

  const payload = (await response.json().catch(() => null)) as ExtractAudioResponse | null;
  const audio = payload?.audio;
  const storagePath = typeof audio?.storagePath === "string" ? audio.storagePath.trim() : "";
  const signedUrl = typeof audio?.previewUrl === "string" ? audio.previewUrl.trim() : "";
  const name = typeof audio?.name === "string" ? audio.name.trim() : "";
  const mimeType = typeof audio?.mimeType === "string" ? audio.mimeType.trim() : "";
  const size = typeof audio?.size === "number" ? audio.size : NaN;

  if (!response.ok || !storagePath || !signedUrl || !name || mimeType !== "audio/wav") {
    const error =
      typeof payload?.details === "string" && payload.details.trim()
        ? payload.details.trim()
        : typeof payload?.error === "string" && payload.error.trim()
          ? payload.error.trim()
          : "Unable to extract audio from the selected video.";
    throw new Error(error);
  }

  return {
    storagePath,
    signedUrl,
    mimeType: "audio/wav",
    name,
    size: Number.isFinite(size) ? size : 0,
  };
};
