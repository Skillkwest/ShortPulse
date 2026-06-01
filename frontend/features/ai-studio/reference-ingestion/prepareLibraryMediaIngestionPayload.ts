/**
 * Media-library ingestion payload preparation.
 * Refreshes/normalizes drag payload URLs at ingest time so Reference Grid cards receive
 * renderable signed URLs without changing drag contracts.
 */
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import { refreshSupabaseSignedUrlIfNeeded } from "../utils/imageUpload";
import type { ReferenceIngestionInput } from "./types";

const MEDIA_LIBRARY_BUCKET = "media_library";
const SIGNED_URL_TTL_SECONDS = 3600;

type LibraryMediaPayload = Extract<ReferenceIngestionInput, { kind: "libraryMedia" }>["payload"];
type MediaStoragePathRow = {
  storage_path?: unknown;
  poster_variant_path?: unknown;
  thumb_variant_path?: unknown;
  preview_variant_path?: unknown;
};

const normalizeText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const resolveStoragePathsFromRow = (
  row: MediaStoragePathRow | null | undefined,
  fileType: LibraryMediaPayload["fileType"]
): {
  previewStoragePath: string | null;
  previewPosterStoragePath: string | null;
  fullStoragePath: string | null;
} => {
  const previewPosterStoragePath =
    asCanonicalStoragePath(
      typeof row?.poster_variant_path === "string" ? row.poster_variant_path : null
    ) ??
    asCanonicalStoragePath(
      typeof row?.thumb_variant_path === "string" ? row.thumb_variant_path : null
    );
  const fullStoragePath = asCanonicalStoragePath(
    typeof row?.storage_path === "string" ? row.storage_path : null
  );
  const previewVariantPath = asCanonicalStoragePath(
    typeof row?.preview_variant_path === "string" ? row.preview_variant_path : null
  );
  const imageThumbStoragePath = asCanonicalStoragePath(
    typeof row?.thumb_variant_path === "string" ? row.thumb_variant_path : null
  );
  const previewStoragePath =
    fileType === "video"
      ? (previewVariantPath ?? fullStoragePath)
      : (imageThumbStoragePath ?? fullStoragePath);
  return {
    previewStoragePath,
    previewPosterStoragePath,
    fullStoragePath,
  };
};

const resolveNormalizedPreviewStoragePath = ({
  fileType,
  previewStoragePath,
  previewPosterStoragePath,
  fullStoragePath,
}: {
  fileType: LibraryMediaPayload["fileType"];
  previewStoragePath: string | null;
  previewPosterStoragePath: string | null;
  fullStoragePath: string | null;
}): string | null => {
  if (fileType !== "video") return previewStoragePath ?? fullStoragePath;
  if (previewStoragePath && /\.(?:m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#])/i.test(previewStoragePath)) {
    return previewStoragePath;
  }
  if (
    previewStoragePath &&
    previewPosterStoragePath &&
    previewStoragePath === previewPosterStoragePath &&
    fullStoragePath
  ) {
    return fullStoragePath;
  }
  return previewStoragePath ?? fullStoragePath;
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
  mediaId: string,
  fileType: LibraryMediaPayload["fileType"]
): Promise<{
  previewStoragePath: string | null;
  previewPosterStoragePath: string | null;
  fullStoragePath: string | null;
}> => {
  const normalizedMediaId = normalizeText(mediaId);
  if (!normalizedMediaId) {
    return {
      previewStoragePath: null,
      previewPosterStoragePath: null,
      fullStoragePath: null,
    };
  }
  try {
    const supabase = ensureSupabaseQueryClient();
    const { data, error } = (await supabase
      .from("media_files")
      .select("storage_path, poster_variant_path, thumb_variant_path, preview_variant_path")
      .eq("id", normalizedMediaId)
      .limit(1)
      .maybeSingle()) as unknown as { data: MediaStoragePathRow | null; error: unknown };
    if (error) {
      return {
        previewStoragePath: null,
        previewPosterStoragePath: null,
        fullStoragePath: null,
      };
    }
    return resolveStoragePathsFromRow(data, fileType);
  } catch {
    return {
      previewStoragePath: null,
      previewPosterStoragePath: null,
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
  const initialPreviewPosterStoragePath =
    payload.fileType === "video" ? asCanonicalStoragePath(payload.previewPosterStoragePath) : null;
  const initialFullStoragePath =
    asCanonicalStoragePath(payload.fullStoragePath) ?? initialPreviewStoragePath;
  const initialCompanionArtStoragePath =
    payload.fileType === "audio" ? asCanonicalStoragePath(payload.companionArtStoragePath) : null;
  const needsMediaIdFallback =
    !initialPreviewStoragePath ||
    !initialFullStoragePath ||
    (payload.fileType === "video" && !initialPreviewPosterStoragePath);
  const mediaIdFallbackPaths = needsMediaIdFallback
    ? await resolveStoragePathsFromMediaId(payload.id, payload.fileType)
    : { previewStoragePath: null, previewPosterStoragePath: null, fullStoragePath: null };
  const normalizedPreviewPosterStoragePath =
    payload.fileType === "video"
      ? (initialPreviewPosterStoragePath ?? mediaIdFallbackPaths.previewPosterStoragePath)
      : null;
  const normalizedFullStoragePath =
    initialFullStoragePath ??
    mediaIdFallbackPaths.fullStoragePath ??
    initialPreviewStoragePath ??
    mediaIdFallbackPaths.previewStoragePath ??
    null;
  const normalizedPreviewStoragePath = resolveNormalizedPreviewStoragePath({
    fileType: payload.fileType,
    previewStoragePath: initialPreviewStoragePath ?? mediaIdFallbackPaths.previewStoragePath,
    previewPosterStoragePath: normalizedPreviewPosterStoragePath,
    fullStoragePath: normalizedFullStoragePath,
  });

  const [signedPreviewUrl, signedPreviewPosterUrl, signedFullUrl, signedCompanionArtUrl] =
    await Promise.all([
      signStoragePath(normalizedPreviewStoragePath),
      signStoragePath(normalizedPreviewPosterStoragePath),
      signStoragePath(normalizedFullStoragePath),
      signStoragePath(initialCompanionArtStoragePath),
    ]);

  const urlRefreshCache = new Map<string, string>();
  const normalizedPayloadUrl = normalizeText(payload.url);
  const normalizedPreviewUrl = normalizeText(payload.previewUrl);
  const normalizedPreviewPosterUrl = normalizeText(payload.previewPosterUrl);
  const normalizedFullUrl = normalizeText(payload.fullUrl);
  const normalizedCompanionArtUrl = normalizeText(payload.companionArtUrl);

  const fallbackPreviewUrl = signedPreviewUrl
    ? null
    : ((await refreshUrlCandidate(normalizedPreviewUrl, urlRefreshCache)) ??
      (await refreshUrlCandidate(normalizedPayloadUrl, urlRefreshCache)));
  const fallbackFullUrl = signedFullUrl
    ? null
    : ((await refreshUrlCandidate(normalizedFullUrl, urlRefreshCache)) ??
      (await refreshUrlCandidate(normalizedPayloadUrl, urlRefreshCache)));

  const resolvedPreviewUrl = signedPreviewUrl ?? fallbackPreviewUrl ?? fallbackFullUrl;
  const resolvedPreviewPosterUrl =
    payload.fileType === "video"
      ? (signedPreviewPosterUrl ??
        (await refreshUrlCandidate(normalizedPreviewPosterUrl, urlRefreshCache)))
      : null;
  const resolvedFullUrl =
    signedFullUrl ?? fallbackFullUrl ?? fallbackPreviewUrl ?? signedPreviewUrl;
  const resolvedUrl = resolvedFullUrl ?? resolvedPreviewUrl ?? normalizedPayloadUrl ?? payload.url;
  const resolvedCompanionArtUrl =
    payload.fileType === "audio" ? (signedCompanionArtUrl ?? normalizedCompanionArtUrl) : null;

  return {
    ...payload,
    url: resolvedUrl,
    previewStoragePath: normalizedPreviewStoragePath ?? null,
    previewPosterStoragePath: normalizedPreviewPosterStoragePath ?? null,
    fullStoragePath: normalizedFullStoragePath ?? null,
    previewUrl: resolvedPreviewUrl ?? null,
    previewPosterUrl: resolvedPreviewPosterUrl ?? null,
    fullUrl: resolvedFullUrl ?? null,
    companionArtUrl: resolvedCompanionArtUrl,
    companionArtStoragePath: initialCompanionArtStoragePath,
  };
};
