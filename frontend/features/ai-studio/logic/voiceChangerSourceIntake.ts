/**
 * Voice Changer source intake logic.
 * Normalizes local files, reference-grid transfers, and URL drops into source models
 * without owning React UI, upload staging, or recorder lifecycle side effects.
 */
import {
  extractInternalReferenceDragPayload,
  getNormalizedTransferTypes,
  hasInternalReferenceDragTypeHints,
  normalizeReferenceTransferUrlCandidate,
  type InternalReferenceDragPayload,
} from "../utils/dragDrop";
import type {
  AcceptedVoiceSourceKind,
  VoiceChangerSource,
  VoiceChangerSourceKind,
  VoiceChangerSourceOrigin,
  VoiceSourceDropSnapshot,
} from "./voiceChangerSourceTypes";
import {
  getVoiceChangerSourceUrlFilename,
  inferVoiceChangerSourceKindFromUrl,
  inferVoiceChangerSourceMimeTypeFromUrl,
  isRemoteFetchableUrlProtocol,
} from "./voiceChangerSourceUrl";
import {
  INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
} from "../../../lib/internalReferenceDragSession";
export type {
  AcceptedVoiceSourceKind,
  ResolveVoiceChangerInternalReferenceSource,
  VoiceChangerSource,
  VoiceChangerSourceKind,
  VoiceChangerSourceOrigin,
  VoiceChangerSourceStatus,
  VoiceSourceDropSnapshot,
} from "./voiceChangerSourceTypes";

const AUDIO_EXTENSION_PATTERN = /\.(?:mp3|wav|m4a|aac|flac|ogg|oga)(?:$|[?#])/i;
const VIDEO_EXTENSION_PATTERN = /\.(?:mp4|mov|m4v|webm)(?:$|[?#])/i;

const buildSourceId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const inferSourceKindFromFile = (file: File): VoiceChangerSourceKind | null => {
  const normalizedType = file.type.trim().toLowerCase();
  if (normalizedType.startsWith("audio/")) return "audio";
  if (normalizedType.startsWith("video/")) return "video";
  if (AUDIO_EXTENSION_PATTERN.test(file.name)) return "audio";
  if (VIDEO_EXTENSION_PATTERN.test(file.name)) return "video";
  return null;
};

export const createVoiceChangerSourceFromFile = (
  file: File,
  options?: {
    origin?: VoiceChangerSourceOrigin;
    referenceOutputId?: string | null;
    referenceMediaId?: string | null;
    durationMs?: number | null;
  }
): VoiceChangerSource | null => {
  const kind = inferSourceKindFromFile(file);
  if (!kind) return null;
  const objectUrl = URL.createObjectURL(file);
  return {
    id: buildSourceId("voice-changer-file"),
    kind,
    origin: options?.origin ?? "local",
    status: "ready",
    aspect: null,
    durationMs: options?.durationMs ?? null,
    name: file.name.trim() || `uploaded-${kind}`,
    mimeType: file.type.trim() || null,
    file,
    previewUrl: kind === "video" ? objectUrl : null,
    sourceUrl: objectUrl,
    objectUrl,
    storagePath: null,
    referenceOutputId: options?.referenceOutputId ?? null,
    referenceMediaId: options?.referenceMediaId ?? null,
    errorMessage: null,
    extractedFrom: null,
  };
};

const isAcceptedSourceKind = (
  kind: VoiceChangerSourceKind | null,
  acceptedKinds: AcceptedVoiceSourceKind[]
): kind is VoiceChangerSourceKind => Boolean(kind && acceptedKinds.includes(kind));

export const findFirstSupportedFile = (
  files: FileList | File[] | null | undefined,
  acceptedKinds: AcceptedVoiceSourceKind[] = ["audio", "video"]
): File | null => {
  if (!files) return null;
  return (
    Array.from(files).find((file) =>
      isAcceptedSourceKind(inferSourceKindFromFile(file), acceptedKinds)
    ) ?? null
  );
};

export const captureVoiceSourceDropSnapshot = (
  transfer: DataTransfer
): VoiceSourceDropSnapshot => ({
  transferTypes: getNormalizedTransferTypes(transfer),
  files: Array.from(transfer.files ?? []),
  internalReferenceDragToken:
    transfer.getData(INTERNAL_REFERENCE_DRAG_SESSION_TYPE) ||
    transfer.getData(INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE),
  referenceOrigin: transfer.getData("text/reference-origin"),
  referenceId: transfer.getData("text/reference-id"),
  referenceOutputId: transfer.getData("text/reference-output-id"),
  referenceMediaId: transfer.getData("text/reference-media-id"),
  referenceMediaKind: transfer.getData("text/reference-media-kind"),
  referencePreviewStoragePath: transfer.getData("text/reference-preview-storage-path"),
  referenceFullStoragePath: transfer.getData("text/reference-full-storage-path"),
  referenceSourceSurface: transfer.getData("text/reference-source-surface"),
  referenceUrl: transfer.getData("text/reference-url"),
  referenceRenderUrl: transfer.getData("text/reference-render-url"),
  imageUrl: transfer.getData("image/url"),
  plainText: transfer.getData("text/plain"),
  uriList: transfer.getData("text/uri-list"),
});

export const buildVoiceSourceDropSnapshotTransfer = (
  snapshot: VoiceSourceDropSnapshot
): DataTransfer =>
  ({
    types: snapshot.transferTypes,
    files: snapshot.files,
    getData: (type: string) => {
      switch (type) {
        case INTERNAL_REFERENCE_DRAG_SESSION_TYPE:
        case INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE:
          return snapshot.internalReferenceDragToken;
        case "text/reference-origin":
          return snapshot.referenceOrigin;
        case "text/reference-id":
          return snapshot.referenceId;
        case "text/reference-output-id":
          return snapshot.referenceOutputId;
        case "text/reference-media-id":
          return snapshot.referenceMediaId;
        case "text/reference-media-kind":
          return snapshot.referenceMediaKind;
        case "text/reference-preview-storage-path":
          return snapshot.referencePreviewStoragePath;
        case "text/reference-full-storage-path":
          return snapshot.referenceFullStoragePath;
        case "text/reference-source-surface":
          return snapshot.referenceSourceSurface;
        case "text/reference-url":
          return snapshot.referenceUrl;
        case "text/reference-render-url":
          return snapshot.referenceRenderUrl;
        case "image/url":
          return snapshot.imageUrl;
        case "text/plain":
          return snapshot.plainText;
        case "text/uri-list":
          return snapshot.uriList;
        default:
          return "";
      }
    },
  }) as unknown as DataTransfer;

export const hasVoiceSourceDropSnapshotInternalReferenceHints = (
  snapshot: VoiceSourceDropSnapshot
): boolean => {
  const normalizedReferenceUrl = normalizeReferenceTransferUrlCandidate(snapshot.referenceUrl, {
    unwrapNextImage: false,
  });
  const normalizedRenderUrl = normalizeReferenceTransferUrlCandidate(snapshot.referenceRenderUrl, {
    unwrapNextImage: false,
  });

  return Boolean(
    snapshot.internalReferenceDragToken ||
    snapshot.transferTypes.some(
      (type) =>
        type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE.toLowerCase() ||
        type === INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE.toLowerCase() ||
        type === "text/reference-origin" ||
        type === "text/reference-id" ||
        type === "text/reference-output-id" ||
        type === "text/reference-media-id" ||
        type === "text/reference-source-surface" ||
        type === "text/reference-url" ||
        type === "text/reference-render-url"
    ) ||
    snapshot.referenceOrigin.trim() ||
    snapshot.referenceId.trim() ||
    snapshot.referenceOutputId.trim() ||
    snapshot.referenceMediaId.trim() ||
    snapshot.referenceSourceSurface.trim() ||
    normalizedReferenceUrl ||
    normalizedRenderUrl
  );
};

const isLikelyNativeFileTransfer = (
  transfer: DataTransfer,
  acceptedKinds: AcceptedVoiceSourceKind[] = ["audio", "video"]
): boolean => {
  if (findFirstSupportedFile(transfer.files, acceptedKinds)) return true;

  const transferItems = Array.from(transfer.items ?? []);
  if (
    transferItems.some((item) => {
      if (item.kind !== "file") return false;
      const normalizedType = item.type.trim().toLowerCase();
      return (
        !normalizedType ||
        (acceptedKinds.includes("audio") && normalizedType.startsWith("audio/")) ||
        (acceptedKinds.includes("video") && normalizedType.startsWith("video/"))
      );
    })
  ) {
    return true;
  }

  return Array.from(transfer.types ?? []).some(
    (type) => type === "Files" || type === "application/x-moz-file"
  );
};

export const createVoiceChangerSourceFromReference = ({
  kind,
  origin,
  name,
  mimeType,
  sourceUrl,
  previewUrl = null,
  storagePath = null,
  durationMs = null,
  aspect = null,
  referenceOutputId = null,
  referenceMediaId = null,
}: {
  kind: VoiceChangerSourceKind;
  origin: VoiceChangerSourceOrigin;
  name: string;
  mimeType?: string | null;
  sourceUrl?: string | null;
  previewUrl?: string | null;
  storagePath?: string | null;
  durationMs?: number | null;
  aspect?: string | null;
  referenceOutputId?: string | null;
  referenceMediaId?: string | null;
}): VoiceChangerSource | null => {
  const normalizedUrl = normalizeReferenceTransferUrlCandidate(sourceUrl, {
    unwrapNextImage: false,
  });
  if (normalizedUrl && /^(?:blob:|data:)/i.test(normalizedUrl)) return null;
  if (normalizedUrl) {
    try {
      const parsed = new URL(
        normalizedUrl,
        typeof window === "undefined" ? "https://shortpulse.local" : window.location.href
      );
      if (!isRemoteFetchableUrlProtocol(parsed.protocol)) {
        return null;
      }
    } catch {
      return null;
    }
  }
  const normalizedStoragePath = storagePath?.trim() || null;
  if (!normalizedUrl && !normalizedStoragePath) return null;
  const normalizedPreviewUrl =
    kind === "video"
      ? normalizeReferenceTransferUrlCandidate(previewUrl ?? normalizedUrl, {
          unwrapNextImage: false,
        })
      : null;
  return {
    id: buildSourceId("voice-changer-reference"),
    kind,
    origin,
    status: "ready",
    aspect,
    durationMs,
    name: name.trim() || `Reference Grid ${kind}`,
    mimeType:
      mimeType?.trim() ||
      (normalizedUrl ? inferVoiceChangerSourceMimeTypeFromUrl(normalizedUrl) : null),
    file: null,
    previewUrl: normalizedPreviewUrl,
    sourceUrl: normalizedUrl,
    objectUrl: null,
    storagePath: normalizedStoragePath,
    referenceOutputId,
    referenceMediaId,
    errorMessage: null,
    extractedFrom: null,
  };
};

const createSourceFromUrl = ({
  url,
  origin,
  fallbackName,
  referenceOutputId = null,
  referenceMediaId = null,
  acceptedKinds = ["audio", "video"],
}: {
  url: string;
  origin: VoiceChangerSourceOrigin;
  fallbackName: string;
  referenceOutputId?: string | null;
  referenceMediaId?: string | null;
  acceptedKinds?: AcceptedVoiceSourceKind[];
}): VoiceChangerSource | null => {
  const normalizedUrl = normalizeReferenceTransferUrlCandidate(url, { unwrapNextImage: false });
  if (!normalizedUrl || /^(?:blob:|data:)/i.test(normalizedUrl)) return null;
  const kind = inferVoiceChangerSourceKindFromUrl(normalizedUrl);
  if (!isAcceptedSourceKind(kind, acceptedKinds)) return null;
  const filename = getVoiceChangerSourceUrlFilename(normalizedUrl);
  const source = createVoiceChangerSourceFromReference({
    kind,
    origin,
    name: filename ?? fallbackName,
    sourceUrl: normalizedUrl,
    referenceOutputId,
    referenceMediaId,
  });
  return source ? { ...source, id: buildSourceId("voice-changer-url") } : null;
};

const createSourceFromInternalPayload = (
  payload: InternalReferenceDragPayload,
  acceptedKinds: AcceptedVoiceSourceKind[] = ["audio", "video"]
): VoiceChangerSource | null => {
  const storagePath = payload.fullStoragePath?.trim() || payload.previewStoragePath?.trim() || null;
  const referenceUrl = normalizeReferenceTransferUrlCandidate(payload.referenceUrl, {
    unwrapNextImage: false,
  });
  const renderUrl = normalizeReferenceTransferUrlCandidate(payload.referenceRenderUrl, {
    unwrapNextImage: false,
  });
  const kind =
    payload.mediaKind === "audio" || payload.mediaKind === "video"
      ? payload.mediaKind
      : inferVoiceChangerSourceKindFromUrl(referenceUrl ?? renderUrl);
  if (!isAcceptedSourceKind(kind, acceptedKinds)) return null;

  const remoteSourceUrl = [referenceUrl, renderUrl].find(
    (candidate): candidate is string =>
      typeof candidate === "string" &&
      !/^(?:blob:|data:)/i.test(candidate) &&
      inferVoiceChangerSourceKindFromUrl(candidate) === kind
  );
  const previewUrl =
    kind === "video"
      ? normalizeReferenceTransferUrlCandidate(renderUrl ?? referenceUrl, {
          unwrapNextImage: false,
        })
      : null;
  const fallbackName =
    getVoiceChangerSourceUrlFilename(remoteSourceUrl ?? previewUrl) ??
    `Reference Grid ${kind} source`;

  return createVoiceChangerSourceFromReference({
    kind,
    origin: "reference-grid",
    name: fallbackName,
    sourceUrl: remoteSourceUrl ?? null,
    previewUrl,
    storagePath,
    referenceOutputId: payload.outputId,
    referenceMediaId: payload.mediaId,
  });
};

export const createSourceFromTransfer = (
  transfer: DataTransfer,
  acceptedKinds: AcceptedVoiceSourceKind[] = ["audio", "video"],
  options?: {
    skipFiles?: boolean;
  }
): VoiceChangerSource | null => {
  const internalPayload = extractInternalReferenceDragPayload(transfer);
  if (internalPayload) {
    const internalSource = createSourceFromInternalPayload(internalPayload, acceptedKinds);
    if (internalSource) return internalSource;
  }

  if (!options?.skipFiles) {
    const supportedFile = findFirstSupportedFile(transfer.files, acceptedKinds);
    if (supportedFile) {
      return createVoiceChangerSourceFromFile(supportedFile);
    }
  }

  const urlCandidates = [
    transfer.getData("text/reference-render-url"),
    transfer.getData("text/reference-url"),
    transfer
      .getData("text/uri-list")
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find((value) => value && !value.startsWith("#")) ?? "",
    transfer.getData("text/plain"),
  ];
  for (const candidate of urlCandidates) {
    const source = createSourceFromUrl({
      url: candidate,
      origin: "url",
      fallbackName: "Linked media source",
      acceptedKinds,
    });
    if (source) return source;
  }

  return null;
};

export const canAcceptTransfer = (
  transfer: DataTransfer | null | undefined,
  canResolveInternalReference = false,
  acceptedKinds: AcceptedVoiceSourceKind[] = ["audio", "video"]
): boolean => {
  if (!transfer) return false;
  const snapshot = captureVoiceSourceDropSnapshot(transfer);
  const transferSnapshot = buildVoiceSourceDropSnapshotTransfer(snapshot);
  const hasInternalReferenceHints = hasVoiceSourceDropSnapshotInternalReferenceHints(snapshot);
  if (hasInternalReferenceHints) {
    if (canResolveInternalReference && hasInternalReferenceDragTypeHints(transferSnapshot))
      return true;
    return Boolean(
      createSourceFromTransfer(transferSnapshot, acceptedKinds, {
        skipFiles: true,
      })
    );
  }
  if (isLikelyNativeFileTransfer(transfer, acceptedKinds)) return true;
  if (canResolveInternalReference && hasInternalReferenceDragTypeHints(transferSnapshot))
    return true;
  return Boolean(createSourceFromTransfer(transferSnapshot, acceptedKinds));
};

/**
 * Revokes any owned local object URL for a selected voice changer source.
 */
export const releaseVoiceChangerSource = (source: VoiceChangerSource | null): void => {
  if (!source?.objectUrl) return;
  URL.revokeObjectURL(source.objectUrl);
};
