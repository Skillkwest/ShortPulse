/**
 * Media-library ingestion payload preparation.
 * Refreshes/normalizes drag payload URLs at ingest time so Reference Grid cards receive
 * renderable signed URLs without changing drag contracts.
 */
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import { refreshSupabaseSignedUrlIfNeeded } from "../utils/imageUpload";
import type { ReferenceIngestionInput } from "./types";

const MEDIA_LIBRARY_BUCKET = "media_library";
const SIGNED_URL_TTL_SECONDS = 3600;

type LibraryMediaPayload = Extract<ReferenceIngestionInput, { kind: "libraryMedia" }>["payload"];

const normalizeText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const signStoragePath = async (storagePath: string | null): Promise<string | null> => {
  if (!storagePath) return null;
  try {
    return await getSignedMediaUrl({
      bucket: MEDIA_LIBRARY_BUCKET,
      storagePath,
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
      forceRefresh: true,
    });
  } catch {
    return null;
  }
};

const resolveStoragePathsFromMediaId = async (
  mediaId: string
): Promise<{
  previewStoragePath: string | null;
  fullStoragePath: string | null;
}> => {
  const normalizedMediaId = normalizeText(mediaId);
  if (!normalizedMediaId) {
    return {
      previewStoragePath: null,
      fullStoragePath: null,
    };
  }
  try {
    const supabase = ensureSupabaseClient();
    const { data, error } = await supabase
      .from("media_files")
      .select("preview_storage_path, storage_path")
      .eq("id", normalizedMediaId)
      .limit(1)
      .maybeSingle();
    if (error) {
      return {
        previewStoragePath: null,
        fullStoragePath: null,
      };
    }
    const previewStoragePath = asCanonicalStoragePath(data?.preview_storage_path);
    const fullStoragePath =
      asCanonicalStoragePath(data?.storage_path) ?? previewStoragePath ?? null;
    return {
      previewStoragePath,
      fullStoragePath,
    };
  } catch {
    return {
      previewStoragePath: null,
      fullStoragePath: null,
    };
  }
};

const refreshUrlCandidate = async (
  candidate: string | null,
  cache: Map<string, string>
): Promise<string | null> => {
  if (!candidate) return null;
  const cached = cache.get(candidate);
  if (cached) return cached;
  try {
    const refreshed = await refreshSupabaseSignedUrlIfNeeded(candidate);
    const normalized = normalizeText(refreshed) ?? candidate;
    cache.set(candidate, normalized);
    return normalized;
  } catch {
    cache.set(candidate, candidate);
    return candidate;
  }
};

/**
 * Normalizes and refreshes a library-media payload while preserving its wire shape.
 */
export const prepareLibraryMediaIngestionPayload = async (
  payload: LibraryMediaPayload
): Promise<LibraryMediaPayload> => {
  const initialPreviewStoragePath = asCanonicalStoragePath(payload.previewStoragePath);
  const initialFullStoragePath =
    asCanonicalStoragePath(payload.fullStoragePath) ?? initialPreviewStoragePath;
  const mediaIdFallbackPaths =
    !initialPreviewStoragePath && !initialFullStoragePath
      ? await resolveStoragePathsFromMediaId(payload.id)
      : { previewStoragePath: null, fullStoragePath: null };
  const normalizedPreviewStoragePath =
    initialPreviewStoragePath ?? mediaIdFallbackPaths.previewStoragePath;
  const normalizedFullStoragePath =
    initialFullStoragePath ??
    mediaIdFallbackPaths.fullStoragePath ??
    normalizedPreviewStoragePath ??
    null;

  const [signedPreviewUrl, signedFullUrl] = await Promise.all([
    signStoragePath(normalizedPreviewStoragePath),
    signStoragePath(normalizedFullStoragePath),
  ]);

  const urlRefreshCache = new Map<string, string>();
  const normalizedPayloadUrl = normalizeText(payload.url);
  const normalizedPreviewUrl = normalizeText(payload.previewUrl);
  const normalizedFullUrl = normalizeText(payload.fullUrl);

  const fallbackPreviewUrl = signedPreviewUrl
    ? null
    : ((await refreshUrlCandidate(normalizedPreviewUrl, urlRefreshCache)) ??
      (await refreshUrlCandidate(normalizedPayloadUrl, urlRefreshCache)));
  const fallbackFullUrl = signedFullUrl
    ? null
    : ((await refreshUrlCandidate(normalizedFullUrl, urlRefreshCache)) ??
      (await refreshUrlCandidate(normalizedPayloadUrl, urlRefreshCache)));

  const resolvedPreviewUrl = signedPreviewUrl ?? fallbackPreviewUrl ?? fallbackFullUrl;
  const resolvedFullUrl =
    signedFullUrl ?? fallbackFullUrl ?? fallbackPreviewUrl ?? signedPreviewUrl;
  const resolvedUrl = resolvedFullUrl ?? resolvedPreviewUrl ?? normalizedPayloadUrl ?? payload.url;

  return {
    ...payload,
    url: resolvedUrl,
    previewStoragePath: normalizedPreviewStoragePath ?? null,
    fullStoragePath: normalizedFullStoragePath ?? null,
    previewUrl: resolvedPreviewUrl ?? null,
    fullUrl: resolvedFullUrl ?? null,
  };
};
