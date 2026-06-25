import {
  hasMediaLibraryDragTypeHints,
  readMediaLibraryDragPayload,
} from "../logic/mediaLibraryDragPayload";
import type { ReferenceDragPreviewKind } from "./dragDropGhost";
import {
  findAudioFile,
  findImageFile,
  findVideoFile,
  isLikelyImageTransferUrl,
  looksLikeAudioUrl,
  looksLikeImageUrl,
  looksLikeVideoUrl,
  normalizeReferenceTransferUrlCandidate,
  resolveDraggedUrl,
} from "./dragDropMediaResolution";
import {
  COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_PAYLOAD_TYPE,
  extractComposerImageDropPayload,
  extractInternalReferenceDragPayload,
  extractPromptReferenceDragPayload,
  getNormalizedTransferTypes,
  hasInternalReferenceDragTypeHints,
  INTERNAL_REFERENCE_DRAG_ORIGIN,
  REFERENCE_TRANSFER_HEIGHT_TYPE,
  REFERENCE_TRANSFER_ID_TYPE,
  REFERENCE_TRANSFER_MEDIA_KIND_TYPE,
  REFERENCE_TRANSFER_ORIGIN_TYPE,
  REFERENCE_TRANSFER_RENDER_URL_TYPE,
  REFERENCE_TRANSFER_URL_TYPE,
  REFERENCE_TRANSFER_WIDTH_TYPE,
} from "../../../lib/internalReferenceDragPayload";
import {
  COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_SESSION_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
} from "../../../lib/internalReferenceDragSession";
export {
  COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_PAYLOAD_TYPE,
  extractComposerImageDropPayload,
  extractInternalReferenceDragPayload,
  extractPromptReferenceDragPayload,
  getNormalizedTransferTypes,
  hasInternalReferenceDragTypeHints,
  INTERNAL_REFERENCE_DRAG_ORIGIN,
  REFERENCE_TRANSFER_RENDER_URL_TYPE,
  type ComposerImageDropPayload,
  type InternalReferenceDragPayload,
  type ReferenceDragSourceSurface,
} from "../../../lib/internalReferenceDragPayload";
export {
  PROMPT_REFERENCE_DRAG_SESSION_TEXT_TYPE,
  PROMPT_REFERENCE_DRAG_SESSION_TYPE,
} from "../../../lib/internalReferenceDragSession";
export {
  clearDragState,
  preparePromptReferenceDrag,
  prepareReferenceDrag,
  type ReferenceComposerImageDragArtifact,
} from "./dragDropOutbound";
export {
  isAudioFile,
  isImageFile,
  isVideoFile,
  looksLikeAudioUrl,
  looksLikeImageUrl,
  looksLikeVideoUrl,
  normalizeReferenceTransferUrlCandidate,
  resolveReferenceTransferUrl,
} from "./dragDropMediaResolution";

const dedupeText = (value?: string) => (value ? value.trim() : "");

const getFirstUriListValue = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .find(Boolean);

export type DragDropPayload = {
  imageUrl: string | null;
  imageFile?: File | null;
  promptText: string | null;
  referenceId?: string | null;
  fromFile?: boolean;
  width?: number;
  height?: number;
  mediaKind?: ReferenceDragPreviewKind | null;
};

export type VideoDragDropPayload = {
  videoUrl: string | null;
  videoFile?: File | null;
  promptText: string | null;
  referenceId?: string | null;
  fromFile?: boolean;
};

export type AudioDragDropPayload = {
  audioUrl: string | null;
  audioFile?: File | null;
  promptText: string | null;
  referenceId?: string | null;
  fromFile?: boolean;
};

const parseReferenceMediaKind = (
  value: string | null | undefined
): ReferenceDragPreviewKind | null => {
  const candidate = (value ?? "").trim().toLowerCase();
  if (
    candidate === "image" ||
    candidate === "video" ||
    candidate === "audio" ||
    candidate === "text"
  ) {
    return candidate;
  }
  return null;
};

const resolveReferenceTransferMediaKind = (
  transfer: DataTransfer
): ReferenceDragPreviewKind | null => {
  const mediaLibraryPayload = readMediaLibraryDragPayload(transfer);
  return (
    extractInternalReferenceDragPayload(transfer)?.mediaKind ??
    parseReferenceMediaKind(transfer.getData(REFERENCE_TRANSFER_MEDIA_KIND_TYPE)) ??
    (mediaLibraryPayload?.kind === "libraryMedia" ? mediaLibraryPayload.payload.fileType : null)
  );
};

const hasStructuredReferenceTransferHints = (transfer: DataTransfer): boolean => {
  if (hasInternalReferenceDragTypeHints(transfer)) return true;
  if (hasMediaLibraryDragTypeHints(transfer)) return true;

  const transferTypes = Array.from(transfer.types ?? []).map((type) => type.trim().toLowerCase());
  if (
    transferTypes.some(
      (type) =>
        type === COMPOSER_IMAGE_DROP_PAYLOAD_TYPE ||
        type === COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE ||
        type === COMPOSER_IMAGE_DROP_SESSION_TYPE ||
        type === COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE ||
        type.startsWith("text/reference-") ||
        type === "image/url"
    )
  ) {
    return true;
  }

  if (extractComposerImageDropPayload(transfer)) return true;
  if (readMediaLibraryDragPayload(transfer)) return true;

  const uriList = getFirstUriListValue(transfer.getData("text/uri-list") ?? "");
  const text = transfer.getData("text/plain");
  const referenceCandidates = [
    transfer.getData(REFERENCE_TRANSFER_URL_TYPE),
    transfer.getData(REFERENCE_TRANSFER_RENDER_URL_TYPE),
    transfer.getData("image/url"),
    uriList,
    text,
  ];

  return referenceCandidates.some((candidate) => {
    const normalized = normalizeReferenceTransferUrlCandidate(candidate, {
      unwrapNextImage: false,
    });
    return Boolean(
      normalized &&
      (looksLikeImageUrl(normalized) ||
        looksLikeVideoUrl(normalized) ||
        looksLikeAudioUrl(normalized))
    );
  });
};

const parseTransferDimension = (value: string | null | undefined): number | undefined => {
  const parsed = Number.parseFloat((value ?? "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
};

const resolveReferenceTransferDimensions = (
  transfer: DataTransfer
): Pick<DragDropPayload, "width" | "height"> => {
  const internalPayload = extractInternalReferenceDragPayload(transfer);
  const width =
    internalPayload?.width ??
    parseTransferDimension(transfer.getData(REFERENCE_TRANSFER_WIDTH_TYPE));
  const height =
    internalPayload?.height ??
    parseTransferDimension(transfer.getData(REFERENCE_TRANSFER_HEIGHT_TYPE));
  return {
    ...(typeof width === "number" ? { width } : {}),
    ...(typeof height === "number" ? { height } : {}),
  };
};

export const extractDragDropPayload = (transfer: DataTransfer): DragDropPayload => {
  const imageFile = findImageFile(transfer.files);
  const hasStructuredHints = hasStructuredReferenceTransferHints(transfer);
  const internalPayload = extractInternalReferenceDragPayload(transfer);
  const mediaLibraryPayload = readMediaLibraryDragPayload(transfer);
  const hasAuthoritativeInternalPayload = Boolean(
    transfer.getData(INTERNAL_REFERENCE_DRAG_SESSION_TYPE).trim() ||
    transfer.getData(INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE).trim() ||
    transfer.getData(REFERENCE_TRANSFER_ORIGIN_TYPE).trim()
  );
  const mediaKind = resolveReferenceTransferMediaKind(transfer);
  const internalRenderUrl = normalizeReferenceTransferUrlCandidate(
    internalPayload?.referenceRenderUrl,
    { unwrapNextImage: false }
  );
  const internalReferenceUrl = normalizeReferenceTransferUrlCandidate(
    internalPayload?.referenceUrl,
    { unwrapNextImage: false }
  );
  const transferRenderUrl = normalizeReferenceTransferUrlCandidate(
    transfer.getData(REFERENCE_TRANSFER_RENDER_URL_TYPE),
    { unwrapNextImage: false }
  );
  const referenceUrl = normalizeReferenceTransferUrlCandidate(
    transfer.getData(REFERENCE_TRANSFER_URL_TYPE)
  );
  const referenceId =
    internalPayload?.referenceId ??
    (mediaLibraryPayload?.kind === "libraryMedia" ? mediaLibraryPayload.payload.id : null) ??
    (transfer.getData(REFERENCE_TRANSFER_ID_TYPE) || null);
  const normalizedReferenceUrl =
    referenceUrl && isLikelyImageTransferUrl(referenceUrl) ? referenceUrl : null;
  const normalizedTransferRenderUrl =
    transferRenderUrl && isLikelyImageTransferUrl(transferRenderUrl) ? transferRenderUrl : null;
  const normalizedInternalImageUrl = hasAuthoritativeInternalPayload
    ? ((internalRenderUrl && isLikelyImageTransferUrl(internalRenderUrl)
        ? internalRenderUrl
        : null) ??
      (internalReferenceUrl && isLikelyImageTransferUrl(internalReferenceUrl)
        ? internalReferenceUrl
        : null))
    : null;
  const normalizedLibraryImageUrl =
    mediaLibraryPayload?.kind === "libraryMedia" && mediaLibraryPayload.payload.fileType === "image"
      ? ([
          mediaLibraryPayload.payload.fullUrl,
          mediaLibraryPayload.payload.previewUrl,
          mediaLibraryPayload.payload.url,
        ]
          .map((candidate) => normalizeReferenceTransferUrlCandidate(candidate))
          .find((candidate): candidate is string =>
            Boolean(candidate && isLikelyImageTransferUrl(candidate))
          ) ?? null)
      : null;
  const dimensions = resolveReferenceTransferDimensions(transfer);

  if (mediaKind && mediaKind !== "image") {
    return {
      imageUrl: null,
      promptText: extractPromptText(transfer),
      referenceId,
      fromFile: false,
      mediaKind,
      ...dimensions,
    };
  }

  if (normalizedInternalImageUrl) {
    return {
      imageUrl: normalizedInternalImageUrl,
      promptText: extractPromptText(transfer),
      referenceId,
      fromFile: false,
      mediaKind,
      ...dimensions,
    };
  }

  if (normalizedLibraryImageUrl) {
    return {
      imageUrl: normalizedLibraryImageUrl,
      promptText: extractPromptText(transfer),
      referenceId,
      fromFile: false,
      mediaKind,
      ...dimensions,
    };
  }

  if (normalizedTransferRenderUrl) {
    return {
      imageUrl: normalizedTransferRenderUrl,
      promptText: extractPromptText(transfer),
      referenceId,
      fromFile: false,
      mediaKind,
      ...dimensions,
    };
  }

  const imageUrl = normalizeReferenceTransferUrlCandidate(transfer.getData("image/url"));
  if (imageUrl) {
    const resolvedImageUrl = resolveDraggedUrl(
      imageUrl,
      normalizedReferenceUrl,
      isLikelyImageTransferUrl
    );
    if (resolvedImageUrl) {
      return {
        imageUrl: resolvedImageUrl,
        promptText: extractPromptText(transfer),
        referenceId,
        fromFile: false,
        mediaKind,
        ...dimensions,
      };
    }
  }

  if (normalizedReferenceUrl) {
    return {
      imageUrl: normalizedReferenceUrl,
      promptText: extractPromptText(transfer),
      referenceId,
      fromFile: false,
      mediaKind,
      ...dimensions,
    };
  }

  const uriListValue = transfer.getData("text/uri-list");
  if (uriListValue) {
    const cleanUriValue = getFirstUriListValue(uriListValue);
    const cleanUri = normalizeReferenceTransferUrlCandidate(cleanUriValue) ?? cleanUriValue;
    if (cleanUri) {
      const resolvedUri = resolveDraggedUrl(
        cleanUri,
        normalizedReferenceUrl,
        isLikelyImageTransferUrl
      );
      if (resolvedUri) {
        return {
          imageUrl: resolvedUri,
          promptText: extractPromptText(transfer),
          referenceId,
          fromFile: false,
          mediaKind,
          ...dimensions,
        };
      }
    }
  }

  const rawText = transfer.getData("text/plain");
  const normalizedRawText = normalizeReferenceTransferUrlCandidate(rawText);
  if (normalizedRawText && isLikelyImageTransferUrl(normalizedRawText)) {
    const resolvedTextUrl = resolveDraggedUrl(
      normalizedRawText,
      normalizedReferenceUrl,
      isLikelyImageTransferUrl
    );
    if (resolvedTextUrl) {
      return {
        imageUrl: resolvedTextUrl,
        promptText: extractPromptText(transfer),
        referenceId,
        fromFile: false,
        mediaKind,
        ...dimensions,
      };
    }
  }

  if (imageFile && !hasStructuredHints) {
    const objectUrl = URL.createObjectURL(imageFile);
    return {
      imageUrl: objectUrl,
      imageFile,
      promptText: null,
      referenceId,
      fromFile: true,
      mediaKind: "image",
    };
  }

  return {
    imageUrl: null,
    promptText: extractPromptText(transfer),
    referenceId,
    fromFile: false,
    mediaKind,
    ...dimensions,
  };
};

export const extractVideoDragDropPayload = (transfer: DataTransfer): VideoDragDropPayload => {
  const videoFile = findVideoFile(transfer.files);
  const hasStructuredHints = hasStructuredReferenceTransferHints(transfer);
  const internalPayload = extractInternalReferenceDragPayload(transfer);
  const mediaLibraryPayload = readMediaLibraryDragPayload(transfer);
  const mediaKind = resolveReferenceTransferMediaKind(transfer);
  const internalReferenceUrl = normalizeReferenceTransferUrlCandidate(
    internalPayload?.referenceUrl,
    { unwrapNextImage: false }
  );
  const referenceUrl = normalizeReferenceTransferUrlCandidate(
    transfer.getData(REFERENCE_TRANSFER_URL_TYPE)
  );
  const referenceId =
    internalPayload?.referenceId ??
    mediaLibraryPayload?.payload.id ??
    (transfer.getData(REFERENCE_TRANSFER_ID_TYPE) || null);
  const normalizedReferenceUrl =
    referenceUrl && looksLikeVideoUrl(referenceUrl) ? referenceUrl : null;
  const normalizedInternalVideoUrl =
    internalReferenceUrl && looksLikeVideoUrl(internalReferenceUrl) ? internalReferenceUrl : null;
  const normalizedLibraryVideoUrl =
    mediaLibraryPayload?.kind === "libraryMedia" && mediaLibraryPayload.payload.fileType === "video"
      ? ([
          mediaLibraryPayload.payload.fullUrl,
          mediaLibraryPayload.payload.url,
          mediaLibraryPayload.payload.previewUrl,
        ]
          .map((candidate) =>
            normalizeReferenceTransferUrlCandidate(candidate, { unwrapNextImage: false })
          )
          .find((candidate): candidate is string =>
            Boolean(candidate && looksLikeVideoUrl(candidate))
          ) ?? null)
      : null;

  if (mediaKind && mediaKind !== "video") {
    return {
      videoUrl: null,
      promptText: extractPromptText(transfer),
      referenceId,
      fromFile: false,
    };
  }

  if (normalizedInternalVideoUrl) {
    return {
      videoUrl: normalizedInternalVideoUrl,
      promptText: extractPromptText(transfer),
      referenceId,
      fromFile: false,
    };
  }

  if (normalizedLibraryVideoUrl) {
    return {
      videoUrl: normalizedLibraryVideoUrl,
      promptText: extractPromptText(transfer),
      referenceId,
      fromFile: false,
    };
  }

  if (normalizedReferenceUrl) {
    return {
      videoUrl: normalizedReferenceUrl,
      promptText: extractPromptText(transfer),
      referenceId,
      fromFile: false,
    };
  }

  const uriListValue = transfer.getData("text/uri-list");
  if (uriListValue) {
    const cleanUriValue = getFirstUriListValue(uriListValue);
    const cleanUri = normalizeReferenceTransferUrlCandidate(cleanUriValue) ?? cleanUriValue;
    if (cleanUri && looksLikeVideoUrl(cleanUri)) {
      const resolvedUri = resolveDraggedUrl(cleanUri, normalizedReferenceUrl, looksLikeVideoUrl);
      if (resolvedUri) {
        return {
          videoUrl: resolvedUri,
          promptText: extractPromptText(transfer),
          referenceId,
          fromFile: false,
        };
      }
    }
  }

  const imageUrl = normalizeReferenceTransferUrlCandidate(transfer.getData("image/url"));
  if (imageUrl && looksLikeVideoUrl(imageUrl)) {
    const resolvedImageUrl = resolveDraggedUrl(imageUrl, normalizedReferenceUrl, looksLikeVideoUrl);
    if (resolvedImageUrl) {
      return {
        videoUrl: resolvedImageUrl,
        promptText: extractPromptText(transfer),
        referenceId,
        fromFile: false,
      };
    }
  }

  const rawText = transfer.getData("text/plain");
  const normalizedRawText = normalizeReferenceTransferUrlCandidate(rawText);
  if (normalizedRawText && looksLikeVideoUrl(normalizedRawText)) {
    const resolvedTextUrl = resolveDraggedUrl(
      normalizedRawText,
      normalizedReferenceUrl,
      looksLikeVideoUrl
    );
    if (resolvedTextUrl) {
      return {
        videoUrl: resolvedTextUrl,
        promptText: extractPromptText(transfer),
        referenceId,
        fromFile: false,
      };
    }
  }

  if (videoFile && !hasStructuredHints) {
    return {
      videoUrl: null,
      videoFile,
      promptText: null,
      referenceId,
      fromFile: true,
    };
  }

  return {
    videoUrl: null,
    promptText: extractPromptText(transfer),
    referenceId,
    fromFile: false,
  };
};

export const extractAudioDragDropPayload = (transfer: DataTransfer): AudioDragDropPayload => {
  const audioFile = findAudioFile(transfer.files);
  const hasStructuredHints = hasStructuredReferenceTransferHints(transfer);
  const internalPayload = extractInternalReferenceDragPayload(transfer);
  const mediaLibraryPayload = readMediaLibraryDragPayload(transfer);
  const mediaKind = resolveReferenceTransferMediaKind(transfer);
  const internalReferenceUrl = normalizeReferenceTransferUrlCandidate(
    internalPayload?.referenceUrl,
    { unwrapNextImage: false }
  );
  const referenceUrl = normalizeReferenceTransferUrlCandidate(
    transfer.getData(REFERENCE_TRANSFER_URL_TYPE)
  );
  const referenceId =
    internalPayload?.referenceId ??
    mediaLibraryPayload?.payload.id ??
    (transfer.getData(REFERENCE_TRANSFER_ID_TYPE) || null);
  const normalizedReferenceUrl =
    referenceUrl && looksLikeAudioUrl(referenceUrl) ? referenceUrl : null;
  const normalizedInternalAudioUrl =
    internalReferenceUrl && looksLikeAudioUrl(internalReferenceUrl) ? internalReferenceUrl : null;
  const normalizedLibraryAudioUrl =
    mediaLibraryPayload?.kind === "libraryMedia" && mediaLibraryPayload.payload.fileType === "audio"
      ? ([
          mediaLibraryPayload.payload.fullUrl,
          mediaLibraryPayload.payload.url,
          mediaLibraryPayload.payload.previewUrl,
        ]
          .map((candidate) =>
            normalizeReferenceTransferUrlCandidate(candidate, { unwrapNextImage: false })
          )
          .find((candidate): candidate is string =>
            Boolean(candidate && looksLikeAudioUrl(candidate))
          ) ?? null)
      : null;

  if (mediaKind && mediaKind !== "audio") {
    return {
      audioUrl: null,
      promptText: extractPromptText(transfer),
      referenceId,
      fromFile: false,
    };
  }

  if (normalizedInternalAudioUrl) {
    return {
      audioUrl: normalizedInternalAudioUrl,
      promptText: extractPromptText(transfer),
      referenceId,
      fromFile: false,
    };
  }

  if (normalizedLibraryAudioUrl) {
    return {
      audioUrl: normalizedLibraryAudioUrl,
      promptText: extractPromptText(transfer),
      referenceId,
      fromFile: false,
    };
  }

  if (normalizedReferenceUrl) {
    return {
      audioUrl: normalizedReferenceUrl,
      promptText: extractPromptText(transfer),
      referenceId,
      fromFile: false,
    };
  }

  const uriListValue = transfer.getData("text/uri-list");
  if (uriListValue) {
    const cleanUriValue = getFirstUriListValue(uriListValue);
    const cleanUri = normalizeReferenceTransferUrlCandidate(cleanUriValue) ?? cleanUriValue;
    if (cleanUri && looksLikeAudioUrl(cleanUri)) {
      const resolvedUri = resolveDraggedUrl(cleanUri, normalizedReferenceUrl, looksLikeAudioUrl);
      if (resolvedUri) {
        return {
          audioUrl: resolvedUri,
          promptText: extractPromptText(transfer),
          referenceId,
          fromFile: false,
        };
      }
    }
  }

  const imageUrl = normalizeReferenceTransferUrlCandidate(transfer.getData("image/url"));
  if (imageUrl && looksLikeAudioUrl(imageUrl)) {
    const resolvedImageUrl = resolveDraggedUrl(imageUrl, normalizedReferenceUrl, looksLikeAudioUrl);
    if (resolvedImageUrl) {
      return {
        audioUrl: resolvedImageUrl,
        promptText: extractPromptText(transfer),
        referenceId,
        fromFile: false,
      };
    }
  }

  const rawText = transfer.getData("text/plain");
  const normalizedRawText = normalizeReferenceTransferUrlCandidate(rawText);
  if (normalizedRawText && looksLikeAudioUrl(normalizedRawText)) {
    const resolvedTextUrl = resolveDraggedUrl(
      normalizedRawText,
      normalizedReferenceUrl,
      looksLikeAudioUrl
    );
    if (resolvedTextUrl) {
      return {
        audioUrl: resolvedTextUrl,
        promptText: extractPromptText(transfer),
        referenceId,
        fromFile: false,
      };
    }
  }

  if (audioFile && !hasStructuredHints) {
    return {
      audioUrl: null,
      audioFile,
      promptText: null,
      referenceId,
      fromFile: true,
    };
  }

  return {
    audioUrl: null,
    promptText: extractPromptText(transfer),
    referenceId,
    fromFile: false,
  };
};

export const extractPromptText = (transfer: DataTransfer) => {
  const promptText = transfer.getData("text/prompt") || transfer.getData("text/plain");
  if (!promptText) return null;
  const normalizedPromptUrl = normalizeReferenceTransferUrlCandidate(promptText);
  if (
    normalizedPromptUrl &&
    (looksLikeImageUrl(normalizedPromptUrl) ||
      looksLikeVideoUrl(normalizedPromptUrl) ||
      looksLikeAudioUrl(normalizedPromptUrl))
  ) {
    return null;
  }
  return promptText.trim();
};

export const extractPromptDropText = (transfer: DataTransfer): string | null => {
  if (extractComposerImageDropPayload(transfer)) return null;

  const mediaLibraryPayload = readMediaLibraryDragPayload(transfer);
  if (mediaLibraryPayload?.kind === "libraryMedia") return null;

  const promptReferencePayload = extractPromptReferenceDragPayload(transfer);
  const internalPayload = extractInternalReferenceDragPayload(transfer);
  const mediaKind =
    internalPayload?.mediaKind ??
    parseReferenceMediaKind(transfer.getData(REFERENCE_TRANSFER_MEDIA_KIND_TYPE));
  if (mediaKind && mediaKind !== "text") return null;

  const promptReferenceText =
    promptReferencePayload?.sessionBacked && promptReferencePayload.promptText
      ? dedupeText(promptReferencePayload.promptText)
      : "";
  const internalSessionPromptText =
    internalPayload?.sessionBacked && mediaKind === "text"
      ? dedupeText(internalPayload.promptText ?? undefined)
      : "";
  const sessionPromptText = promptReferenceText || internalSessionPromptText;

  const referenceCandidates = [
    transfer.getData(REFERENCE_TRANSFER_URL_TYPE),
    transfer.getData(REFERENCE_TRANSFER_RENDER_URL_TYPE),
    transfer.getData("image/url"),
    getFirstUriListValue(transfer.getData("text/uri-list")),
  ];
  const hasExplicitMediaUrlHint = referenceCandidates.some((candidate) => {
    const normalized = normalizeReferenceTransferUrlCandidate(candidate, {
      unwrapNextImage: false,
    });
    return Boolean(
      normalized &&
      (looksLikeImageUrl(normalized) ||
        looksLikeVideoUrl(normalized) ||
        looksLikeAudioUrl(normalized))
    );
  });
  if (hasExplicitMediaUrlHint) return null;

  const hasExplicitPromptType = Array.from(transfer.types ?? []).some(
    (type) => type.trim().toLowerCase() === "text/prompt"
  );
  const hasDroppedFiles = (transfer.files?.length ?? 0) > 0;
  const requiresSessionPromptAuthority =
    (internalPayload?.origin === INTERNAL_REFERENCE_DRAG_ORIGIN && mediaKind === "text") ||
    mediaLibraryPayload?.kind === "libraryPrompt";
  if (requiresSessionPromptAuthority && !sessionPromptText) return null;
  if (hasDroppedFiles && !hasExplicitPromptType && !sessionPromptText) return null;

  const promptText = sessionPromptText || extractPromptText(transfer);
  if (!promptText) return null;

  return promptText;
};

export const isImageDragTransfer = (transfer: DataTransfer) => {
  const imageFile = findImageFile(transfer.files);
  if (imageFile) return true;
  const transferTypes = getNormalizedTransferTypes(transfer);
  if (transferTypes.includes("files")) return !transfer.files?.length;
  const mediaKind = resolveReferenceTransferMediaKind(transfer);
  if (mediaKind) return mediaKind === "image";
  if (hasInternalReferenceDragTypeHints(transfer)) {
    const referenceUrl = normalizeReferenceTransferUrlCandidate(
      transfer.getData(REFERENCE_TRANSFER_URL_TYPE)
    );
    const renderUrl = normalizeReferenceTransferUrlCandidate(
      transfer.getData(REFERENCE_TRANSFER_RENDER_URL_TYPE)
    );
    const imageUrl = normalizeReferenceTransferUrlCandidate(transfer.getData("image/url"));
    if (referenceUrl && !isLikelyImageTransferUrl(referenceUrl)) return false;
    return Boolean(
      (referenceUrl && isLikelyImageTransferUrl(referenceUrl)) ||
      (renderUrl && isLikelyImageTransferUrl(renderUrl)) ||
      (imageUrl && isLikelyImageTransferUrl(imageUrl)) ||
      (!referenceUrl && !renderUrl && !imageUrl)
    );
  }
  if (transferTypes.includes("text/uri-list") || transferTypes.includes("image/url")) {
    const uriList = getFirstUriListValue(transfer.getData("text/uri-list"));
    const imageUrl = transfer.getData("image/url");
    return Boolean(
      (uriList && isLikelyImageTransferUrl(uriList)) ||
      (imageUrl && isLikelyImageTransferUrl(imageUrl)) ||
      (!uriList && !imageUrl)
    );
  }
  const plainText = normalizeReferenceTransferUrlCandidate(transfer.getData("text/plain"));
  return Boolean(plainText && looksLikeImageUrl(plainText));
};

export const isVideoDragTransfer = (transfer: DataTransfer) => {
  // For dragenter/dragover, some browsers do not expose payload text values yet.
  // Prefer transfer types for acceptance, then validate/resolve on drop.
  const mediaKind = resolveReferenceTransferMediaKind(transfer);
  if (mediaKind) return mediaKind === "video";
  const videoFile = findVideoFile(transfer.files);
  if (videoFile) return true;
  if (transfer.files?.length) return false;
  const transferTypes = getNormalizedTransferTypes(transfer);
  if (transferTypes.includes("files")) return true;
  if (hasInternalReferenceDragTypeHints(transfer)) {
    return true;
  }
  if (transferTypes.includes("text/uri-list") || transferTypes.includes("image/url")) return true;
  const plainText = normalizeReferenceTransferUrlCandidate(transfer.getData("text/plain"));
  return Boolean(plainText && looksLikeVideoUrl(plainText));
};

export const isAudioDragTransfer = (transfer: DataTransfer) => {
  const mediaKind = resolveReferenceTransferMediaKind(transfer);
  if (mediaKind) return mediaKind === "audio";
  const audioFile = findAudioFile(transfer.files);
  if (audioFile) return true;
  if (transfer.files?.length) return false;
  const transferTypes = getNormalizedTransferTypes(transfer);
  if (transferTypes.includes("files")) return true;
  if (hasInternalReferenceDragTypeHints(transfer)) {
    return true;
  }
  if (transferTypes.includes("text/uri-list") || transferTypes.includes("image/url")) return true;
  const plainText = normalizeReferenceTransferUrlCandidate(transfer.getData("text/plain"));
  return Boolean(plainText && looksLikeAudioUrl(plainText));
};
