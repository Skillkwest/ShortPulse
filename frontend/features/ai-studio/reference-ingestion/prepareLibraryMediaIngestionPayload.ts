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
  preview_storage_path?: unknown;
  storage_path?: unknown;
};

const normalizeText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const isPreviewStoragePathSchemaError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const message =
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message.toLowerCase()
      : "";
  return message.includes("preview_storage_path") && message.includes("schema cache");
};

const resolveStoragePathsFromRow = (
  row: MediaStoragePathRow | null | undefined
): {
  previewStoragePath: string | null;
  fullStoragePath: string | null;
} => {
  const explicitPreviewStoragePath = asCanonicalStoragePath(
    typeof row?.preview_storage_path === "string" ? row.preview_storage_path : null
  );
  const fullStoragePath =
    asCanonicalStoragePath(typeof row?.storage_path === "string" ? row.storage_path : null) ??
    explicitPreviewStoragePath ??
    null;
  return {
    previewStoragePath: explicitPreviewStoragePath ?? fullStoragePath,
    fullStoragePath,
  };
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
    const supabase = ensureSupabaseQueryClient();
    const readByColumns = async (columns: "preview_storage_path, storage_path" | "storage_path") =>
      (await supabase
        .from("media_files")
        .select(columns)
        .eq("id", normalizedMediaId)
        .limit(1)
        .maybeSingle()) as unknown as { data: MediaStoragePathRow | null; error: unknown };
    let { data, error } = await readByColumns("preview_storage_path, storage_path");
    if (error && isPreviewStoragePathSchemaError(error)) {
      ({ data, error } = await readByColumns("storage_path"));
    }
    if (error) {
      return {
        previewStoragePath: null,
        fullStoragePath: null,
      };
    }
    return resolveStoragePathsFromRow(data);
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
