/**
 * Canonical Motion Control video-drop source resolution.
 * Converts AI Studio structured drops into provider-staged video input candidates.
 */
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { INTERNAL_MEDIA_REF_BUCKET } from "../../../lib/media/internalMediaRefs";
import {
  buildAiStudioDropSnapshotTransfer,
  type AiStudioDropSnapshot,
} from "./aiStudioDropSnapshot";
import {
  readMediaLibraryDragPayload,
  type MediaLibraryDragPayload,
} from "./mediaLibraryDragPayload";
import type { AgentComposerDirectDropPayload } from "./agentComposerDirectDropPayload";
import type { ResolveInternalReferenceDrop } from "./referenceSource/internalReferenceSource";
import {
  extractInternalReferenceDragPayload,
  extractVideoDragDropPayload,
  isVideoFile,
  looksLikeVideoUrl,
  normalizeReferenceTransferUrlCandidate,
  type InternalReferenceDragPayload,
} from "../utils/dragDrop";

export type MotionReferenceVideoDropSource =
  | { kind: "file"; videoFile: File }
  | { kind: "url"; videoUrl: string; storagePath?: string | null }
  | null;

type ResolveVideoUrlById = (id: string | null) => string | null;

type MotionReferenceVideoResolutionParams = {
  resolveInternalReferenceVideoDropSource?: ResolveInternalReferenceDrop;
  resolveMotionVideoUrlById?: ResolveVideoUrlById;
  resolvePreviewUrlById?: ResolveVideoUrlById;
};

type MotionReferenceVideoDropSnapshotParams = MotionReferenceVideoResolutionParams & {
  snapshot: AiStudioDropSnapshot;
};

type MotionReferenceVideoPayloadParams = MotionReferenceVideoResolutionParams & {
  payload: AgentComposerDirectDropPayload;
};

const trimOptionalString = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
};

const resolveTypedVideoUrlCandidate = (value: string | null | undefined): string | null =>
  normalizeReferenceTransferUrlCandidate(value, { unwrapNextImage: false }) ??
  trimOptionalString(value);

const isVideoMediaKind = (value: string | null | undefined): boolean => value === "video";

const isKnownNonVideoMediaKind = (value: string | null | undefined): boolean =>
  value === "image" || value === "audio" || value === "text";

const resolveVideoStoragePath = ({
  mediaKind,
  fullStoragePath,
  previewStoragePath,
}: {
  mediaKind: string | null | undefined;
  fullStoragePath?: string | null;
  previewStoragePath?: string | null;
}): string | null => {
  const fullPath = trimOptionalString(fullStoragePath);
  const previewPath = trimOptionalString(previewStoragePath);
  if (isVideoMediaKind(mediaKind)) {
    return fullPath ?? (previewPath && looksLikeVideoUrl(previewPath) ? previewPath : null);
  }
  if (fullPath && looksLikeVideoUrl(fullPath)) return fullPath;
  if (previewPath && looksLikeVideoUrl(previewPath)) return previewPath;
  return null;
};

const signVideoStoragePath = async (storagePath: string | null): Promise<string | null> => {
  if (!storagePath) return null;
  return await getSignedMediaUrl({
    bucket: INTERNAL_MEDIA_REF_BUCKET,
    storagePath,
    previewProfile: "none",
  }).catch(() => null);
};

const resolveFromInternalPayload = async ({
  internalPayload,
  fallbackVideoUrl,
  resolveInternalReferenceVideoDropSource,
}: {
  internalPayload: InternalReferenceDragPayload | null;
  fallbackVideoUrl?: string | null;
  resolveInternalReferenceVideoDropSource?: ResolveInternalReferenceDrop;
}): Promise<MotionReferenceVideoDropSource> => {
  if (!internalPayload) return null;
  if (isKnownNonVideoMediaKind(internalPayload.mediaKind)) return null;

  const resolvedSource = resolveInternalReferenceVideoDropSource
    ? await resolveInternalReferenceVideoDropSource(internalPayload).catch(() => null)
    : null;
  if (resolveInternalReferenceVideoDropSource && !resolvedSource) return null;

  const resolvedStoragePath = resolveVideoStoragePath({
    mediaKind: resolvedSource ? "video" : internalPayload.mediaKind,
    fullStoragePath: resolvedSource?.fullStoragePath ?? internalPayload.fullStoragePath,
    previewStoragePath: resolvedSource?.previewStoragePath ?? internalPayload.previewStoragePath,
  });
  const signedStorageUrl = await signVideoStoragePath(resolvedStoragePath);
  if (signedStorageUrl) {
    return { kind: "url", videoUrl: signedStorageUrl, storagePath: resolvedStoragePath };
  }

  const resolvedPreparedUrl = resolveTypedVideoUrlCandidate(resolvedSource?.preparedImageUrl);
  if (resolvedPreparedUrl) return { kind: "url", videoUrl: resolvedPreparedUrl };

  const resolvedPreviewUrl = resolveTypedVideoUrlCandidate(resolvedSource?.preview.url);
  if (resolvedPreviewUrl && looksLikeVideoUrl(resolvedPreviewUrl)) {
    return { kind: "url", videoUrl: resolvedPreviewUrl };
  }

  const fallbackUrl = resolveTypedVideoUrlCandidate(
    fallbackVideoUrl ?? internalPayload.referenceUrl
  );
  if (fallbackUrl && looksLikeVideoUrl(fallbackUrl)) return { kind: "url", videoUrl: fallbackUrl };

  return null;
};

const resolveFromMediaLibraryPayload = async (
  mediaLibraryPayload: MediaLibraryDragPayload | null
): Promise<MotionReferenceVideoDropSource> => {
  if (!mediaLibraryPayload) return null;
  if (mediaLibraryPayload.kind !== "libraryMedia") return null;
  if (mediaLibraryPayload.payload.fileType !== "video") return null;

  const storagePath = resolveVideoStoragePath({
    mediaKind: "video",
    fullStoragePath: mediaLibraryPayload.payload.fullStoragePath,
    previewStoragePath: mediaLibraryPayload.payload.previewStoragePath,
  });
  const signedStorageUrl = await signVideoStoragePath(storagePath);
  if (signedStorageUrl) return { kind: "url", videoUrl: signedStorageUrl, storagePath };

  const directUrl =
    resolveTypedVideoUrlCandidate(mediaLibraryPayload.payload.fullUrl) ??
    resolveTypedVideoUrlCandidate(mediaLibraryPayload.payload.url) ??
    resolveTypedVideoUrlCandidate(mediaLibraryPayload.payload.previewUrl);
  if (directUrl && looksLikeVideoUrl(directUrl)) return { kind: "url", videoUrl: directUrl };

  return null;
};

const resolveByReferenceId = ({
  referenceId,
  resolveMotionVideoUrlById,
  resolvePreviewUrlById,
}: {
  referenceId: string | null | undefined;
  resolveMotionVideoUrlById?: ResolveVideoUrlById;
  resolvePreviewUrlById?: ResolveVideoUrlById;
}): MotionReferenceVideoDropSource => {
  const normalizedReferenceId = trimOptionalString(referenceId);
  if (!normalizedReferenceId) return null;
  const resolvedUrl =
    resolveMotionVideoUrlById?.(normalizedReferenceId) ??
    resolvePreviewUrlById?.(normalizedReferenceId) ??
    null;
  if (!resolvedUrl || !looksLikeVideoUrl(resolvedUrl)) return null;
  return { kind: "url", videoUrl: resolvedUrl };
};

export const resolveMotionReferenceVideoDropSourceFromPayload = async ({
  payload,
  resolveInternalReferenceVideoDropSource,
  resolveMotionVideoUrlById,
  resolvePreviewUrlById,
}: MotionReferenceVideoPayloadParams): Promise<MotionReferenceVideoDropSource> => {
  if (payload.kind !== "video") return null;

  const internalSource = await resolveFromInternalPayload({
    internalPayload: payload.internalPayload ?? null,
    fallbackVideoUrl: payload.videoUrl,
    resolveInternalReferenceVideoDropSource,
  });
  if (internalSource) return internalSource;

  const directVideoUrl = resolveTypedVideoUrlCandidate(payload.videoUrl);
  if (directVideoUrl && looksLikeVideoUrl(directVideoUrl)) {
    return { kind: "url", videoUrl: directVideoUrl };
  }

  return resolveByReferenceId({
    referenceId: payload.outputId ?? payload.mediaId ?? null,
    resolveMotionVideoUrlById,
    resolvePreviewUrlById,
  });
};

export const resolveMotionReferenceVideoDropSource = async ({
  snapshot,
  resolveInternalReferenceVideoDropSource,
  resolveMotionVideoUrlById,
  resolvePreviewUrlById,
}: MotionReferenceVideoDropSnapshotParams): Promise<MotionReferenceVideoDropSource> => {
  const transfer = buildAiStudioDropSnapshotTransfer(snapshot);
  const internalPayload = extractInternalReferenceDragPayload(transfer);
  const mediaLibraryPayload = readMediaLibraryDragPayload(transfer);
  const payload = extractVideoDragDropPayload(transfer);

  const internalSource = await resolveFromInternalPayload({
    internalPayload,
    fallbackVideoUrl: payload.videoUrl,
    resolveInternalReferenceVideoDropSource,
  });
  if (internalSource) return internalSource;

  const mediaLibrarySource = await resolveFromMediaLibraryPayload(mediaLibraryPayload);
  if (mediaLibrarySource) return mediaLibrarySource;

  const videoFile =
    payload.videoFile ?? snapshot.files.find((candidate) => isVideoFile(candidate)) ?? null;
  if (videoFile) return { kind: "file", videoFile };

  const directVideoUrl = resolveTypedVideoUrlCandidate(payload.videoUrl);
  if (directVideoUrl && looksLikeVideoUrl(directVideoUrl)) {
    return { kind: "url", videoUrl: directVideoUrl };
  }

  return resolveByReferenceId({
    referenceId: payload.referenceId,
    resolveMotionVideoUrlById,
    resolvePreviewUrlById,
  });
};
