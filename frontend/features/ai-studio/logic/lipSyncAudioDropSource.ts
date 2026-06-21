/**
 * Canonical Lip Sync voice-audio drop source resolution.
 * Converts AI Studio structured drops into durable audio candidates before
 * falling back to true local desktop audio files.
 */
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { INTERNAL_MEDIA_REF_BUCKET } from "../../../lib/media/internalMediaRefs";
import {
  buildAiStudioDropSnapshotTransfer,
  hasAiStudioStructuredDropHints,
  type AiStudioDropSnapshot,
} from "./aiStudioDropSnapshot";
import {
  readMediaLibraryDragPayload,
  type MediaLibraryDragPayload,
} from "./mediaLibraryDragPayload";
import { resolveLipSyncAudioDurableSource } from "./lipSyncAudioState";
import {
  extractInternalReferenceDragPayload,
  looksLikeAudioUrl,
  normalizeReferenceTransferUrlCandidate,
  type InternalReferenceDragPayload,
} from "../utils/dragDrop";

export type LipSyncAudioDropSource =
  | {
      kind: "durable";
      url: string | null;
      storagePath: string | null;
      durationMs: number | null;
      sourceKind: "library" | "reference";
    }
  | { kind: "file"; audioFile: File }
  | null;

type ResolveAudioUrlById = (id: string | null) => string | null;

type LipSyncAudioDropSourceParams = {
  snapshot: AiStudioDropSnapshot;
  resolveAudioUrlById?: ResolveAudioUrlById;
  resolvePreviewUrlById?: ResolveAudioUrlById;
};

const AUDIO_FILE_EXTENSION_PATTERN = /\.(?:aac|flac|m4a|mp3|oga|ogg|wav|webm)$/i;

const trimOptionalString = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
};

const isKnownNonAudioMediaKind = (value: string | null | undefined): boolean =>
  value === "image" || value === "video" || value === "text";

const isAudioFile = (file: File | null | undefined): file is File => {
  if (!file) return false;
  if (file.type.trim().toLowerCase().startsWith("audio/")) return true;
  return AUDIO_FILE_EXTENSION_PATTERN.test(file.name.trim());
};

const resolveTypedAudioUrlCandidate = (value: string | null | undefined): string | null => {
  const normalized =
    normalizeReferenceTransferUrlCandidate(value, { unwrapNextImage: false }) ??
    trimOptionalString(value);
  return normalized && looksLikeAudioUrl(normalized) ? normalized : null;
};

const signAudioStoragePath = async (storagePath: string | null): Promise<string | null> => {
  if (!storagePath) return null;
  return await getSignedMediaUrl({
    bucket: INTERNAL_MEDIA_REF_BUCKET,
    storagePath,
    previewProfile: "none",
  }).catch(() => null);
};

const resolveDurableSource = async ({
  urlCandidates,
  storagePathCandidates,
  durationMs = null,
  sourceKind,
}: {
  urlCandidates: (string | null | undefined)[];
  storagePathCandidates: (string | null | undefined)[];
  durationMs?: number | null;
  sourceKind: "library" | "reference";
}): Promise<LipSyncAudioDropSource> => {
  const durable = resolveLipSyncAudioDurableSource({
    urlCandidates,
    storagePathCandidates,
  });
  const signedStorageUrl = await signAudioStoragePath(durable.storagePath);
  const url = signedStorageUrl ?? durable.url;
  if (!url && !durable.storagePath) return null;
  return {
    kind: "durable",
    url,
    storagePath: durable.storagePath,
    durationMs,
    sourceKind,
  };
};

const resolveFromInternalPayload = async ({
  internalPayload,
  fallbackAudioUrl,
}: {
  internalPayload: InternalReferenceDragPayload | null;
  fallbackAudioUrl?: string | null;
}): Promise<LipSyncAudioDropSource> => {
  if (!internalPayload) return null;
  if (isKnownNonAudioMediaKind(internalPayload.mediaKind)) return null;
  return await resolveDurableSource({
    urlCandidates: [
      internalPayload.referenceUrl,
      internalPayload.referenceRenderUrl,
      fallbackAudioUrl,
    ],
    storagePathCandidates: [internalPayload.fullStoragePath, internalPayload.previewStoragePath],
    sourceKind: "reference",
  });
};

const resolveFromMediaLibraryPayload = async (
  mediaLibraryPayload: MediaLibraryDragPayload | null
): Promise<LipSyncAudioDropSource> => {
  if (!mediaLibraryPayload) return null;
  if (mediaLibraryPayload.kind !== "libraryMedia") return null;
  if (mediaLibraryPayload.payload.fileType !== "audio") return null;
  return await resolveDurableSource({
    urlCandidates: [
      mediaLibraryPayload.payload.fullUrl,
      mediaLibraryPayload.payload.previewUrl,
      mediaLibraryPayload.payload.url,
    ],
    storagePathCandidates: [
      mediaLibraryPayload.payload.fullStoragePath,
      mediaLibraryPayload.payload.previewStoragePath,
    ],
    durationMs: mediaLibraryPayload.payload.durationMs ?? null,
    sourceKind: "library",
  });
};

const getFirstUriListValue = (value: string): string | null =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.length > 0 && !item.startsWith("#")) ?? null;

const resolveDirectAudioUrl = (transfer: DataTransfer): string | null => {
  const candidates = [
    transfer.getData("text/reference-url"),
    transfer.getData("text/reference-render-url"),
    getFirstUriListValue(transfer.getData("text/uri-list")),
    transfer.getData("text/plain"),
  ];
  return (
    candidates
      .map(resolveTypedAudioUrlCandidate)
      .find((candidate): candidate is string => Boolean(candidate)) ?? null
  );
};

const resolveByReferenceId = ({
  referenceId,
  resolveAudioUrlById,
  resolvePreviewUrlById,
}: {
  referenceId: string | null | undefined;
  resolveAudioUrlById?: ResolveAudioUrlById;
  resolvePreviewUrlById?: ResolveAudioUrlById;
}): LipSyncAudioDropSource => {
  const normalizedReferenceId = trimOptionalString(referenceId);
  if (!normalizedReferenceId) return null;
  const resolvedUrl =
    resolveAudioUrlById?.(normalizedReferenceId) ??
    resolvePreviewUrlById?.(normalizedReferenceId) ??
    null;
  const audioUrl = resolveTypedAudioUrlCandidate(resolvedUrl);
  if (!audioUrl) return null;
  return {
    kind: "durable",
    url: audioUrl,
    storagePath: null,
    durationMs: null,
    sourceKind: "reference",
  };
};

const firstTrimmedString = (values: (string | null | undefined)[]): string | null =>
  values.map(trimOptionalString).find((candidate): candidate is string => Boolean(candidate)) ??
  null;

/**
 * Resolves Lip Sync audio drops using app-owned structured hints before files.
 */
export const resolveLipSyncAudioDropSource = async ({
  snapshot,
  resolveAudioUrlById,
  resolvePreviewUrlById,
}: LipSyncAudioDropSourceParams): Promise<LipSyncAudioDropSource> => {
  const transfer = buildAiStudioDropSnapshotTransfer(snapshot);
  const internalPayload = extractInternalReferenceDragPayload(transfer);
  const mediaLibraryPayload = readMediaLibraryDragPayload(transfer);

  const directAudioUrl = resolveDirectAudioUrl(transfer);
  const internalSource = await resolveFromInternalPayload({
    internalPayload,
    fallbackAudioUrl: directAudioUrl,
  });
  if (internalSource) return internalSource;
  if (internalPayload && isKnownNonAudioMediaKind(internalPayload.mediaKind)) return null;

  const mediaLibrarySource = await resolveFromMediaLibraryPayload(mediaLibraryPayload);
  if (mediaLibrarySource) return mediaLibrarySource;
  if (
    mediaLibraryPayload?.kind === "libraryMedia" &&
    mediaLibraryPayload.payload.fileType !== "audio"
  ) {
    return null;
  }

  if (directAudioUrl) {
    return {
      kind: "durable",
      url: directAudioUrl,
      storagePath: null,
      durationMs: null,
      sourceKind: "reference",
    };
  }

  const referenceId =
    internalPayload?.referenceId ??
    firstTrimmedString([
      mediaLibraryPayload?.kind === "libraryMedia" ? mediaLibraryPayload.payload.id : null,
      transfer.getData("text/reference-id"),
      transfer.getData("text/reference-output-id"),
      transfer.getData("text/reference-media-id"),
    ]);
  const referencedSource = resolveByReferenceId({
    referenceId,
    resolveAudioUrlById,
    resolvePreviewUrlById,
  });
  if (referencedSource) return referencedSource;

  if (!hasAiStudioStructuredDropHints(snapshot)) {
    const audioFile = snapshot.files.find(isAudioFile) ?? null;
    if (audioFile) return { kind: "file", audioFile };
  }

  return null;
};
