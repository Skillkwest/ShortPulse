/**
 * Media-library ingestion payload preparation.
 * Refreshes/normalizes drag payload URLs at ingest time so Reference Grid cards receive
 * renderable signed URLs without changing drag contracts.
 */
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import { isWorkflowReloadConfigV1 } from "../logic/workflowReload";
import { refreshSupabaseSignedUrlIfNeeded } from "../utils/imageUpload";
import type { ReferenceIngestionInput } from "./types";

const MEDIA_LIBRARY_BUCKET = "media_library";
const SIGNED_URL_TTL_SECONDS = 3600;

type LibraryMediaPayload = Extract<ReferenceIngestionInput, { kind: "libraryMedia" }>["payload"];
type MediaStoragePathRow = {
  filename?: unknown;
  file_type?: unknown;
  height?: unknown;
  metadata?: unknown;
  storage_path?: unknown;
  poster_variant_path?: unknown;
  source?: unknown;
  source_ref?: unknown;
  thumb_variant_path?: unknown;
  preview_variant_path?: unknown;
  width?: unknown;
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
  filename: string | null;
  source: string | null;
  sourceRef: string | null;
  workflowReload: LibraryMediaPayload["workflowReload"] | null;
  previewStoragePath: string | null;
  previewPosterStoragePath: string | null;
  fullStoragePath: string | null;
  width: number | undefined;
  height: number | undefined;
}> => {
  const normalizedMediaId = normalizeText(mediaId);
  if (!normalizedMediaId) {
    return {
      filename: null,
      source: null,
      sourceRef: null,
      workflowReload: null,
      previewStoragePath: null,
      previewPosterStoragePath: null,
      fullStoragePath: null,
      width: undefined,
      height: undefined,
    };
  }
  try {
    const supabase = ensureSupabaseQueryClient();
    const { data, error } = (await supabase
      .from("media_files")
      .select(
        "filename, file_type, width, height, source, source_ref, metadata, storage_path, poster_variant_path, thumb_variant_path, preview_variant_path"
      )
      .eq("id", normalizedMediaId)
      .limit(1)
      .maybeSingle()) as unknown as { data: MediaStoragePathRow | null; error: unknown };
    if (error) {
      return {
        filename: null,
        source: null,
        sourceRef: null,
        workflowReload: null,
        previewStoragePath: null,
        previewPosterStoragePath: null,
        fullStoragePath: null,
        width: undefined,
        height: undefined,
      };
    }
    const paths = resolveStoragePathsFromRow(data, fileType);
    const metadata =
      data?.metadata && typeof data.metadata === "object"
        ? (data.metadata as Record<string, unknown>)
        : null;
    const workflowReload = isWorkflowReloadConfigV1(metadata?.workflow_reload)
      ? metadata.workflow_reload
      : null;
    const width =
      typeof data?.width === "number" && Number.isFinite(data.width) ? data.width : undefined;
    const height =
      typeof data?.height === "number" && Number.isFinite(data.height) ? data.height : undefined;
    return {
      filename: normalizeText(typeof data?.filename === "string" ? data.filename : null),
      source: normalizeText(typeof data?.source === "string" ? data.source : null),
      sourceRef: normalizeText(typeof data?.source_ref === "string" ? data.source_ref : null),
      workflowReload,
      ...paths,
      width,
      height,
    };
  } catch {
    return {
      filename: null,
      source: null,
      sourceRef: null,
      workflowReload: null,
      previewStoragePath: null,
      previewPosterStoragePath: null,
      fullStoragePath: null,
      width: undefined,
      height: undefined,
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
  const normalizedSource = normalizeText(payload.source);
  const normalizedSourceRef = normalizeText(payload.sourceRef ?? payload.generationId ?? null);
  const hasWorkflowReload = isWorkflowReloadConfigV1(payload.workflowReload);
  const looksLikeGeneratedMedia =
    normalizedSource === "ai_studio" || Boolean(normalizedSourceRef) || hasWorkflowReload;
  const needsMediaIdFallback =
    !initialPreviewStoragePath ||
    !initialFullStoragePath ||
    (payload.fileType === "video" && !initialPreviewPosterStoragePath) ||
    !normalizedSource ||
    (looksLikeGeneratedMedia && (!normalizedSourceRef || !hasWorkflowReload));
  const mediaIdFallbackPaths = needsMediaIdFallback
    ? await resolveStoragePathsFromMediaId(payload.id, payload.fileType)
    : {
        filename: null,
        source: null,
        sourceRef: null,
        workflowReload: null,
        previewStoragePath: null,
        previewPosterStoragePath: null,
        fullStoragePath: null,
        width: undefined,
        height: undefined,
      };
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
    filename: normalizeText(payload.filename) ?? mediaIdFallbackPaths.filename,
    source: normalizedSource ?? mediaIdFallbackPaths.source,
    sourceRef:
      normalizeText(payload.sourceRef) ??
      normalizeText(payload.generationId) ??
      mediaIdFallbackPaths.sourceRef,
    generationId:
      normalizeText(payload.generationId) ??
      normalizeText(payload.sourceRef) ??
      mediaIdFallbackPaths.sourceRef,
    workflowReload: hasWorkflowReload
      ? payload.workflowReload
      : mediaIdFallbackPaths.workflowReload,
    width: payload.width ?? mediaIdFallbackPaths.width,
    height: payload.height ?? mediaIdFallbackPaths.height,
  };
};
