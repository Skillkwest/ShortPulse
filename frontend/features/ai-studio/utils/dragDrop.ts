import { StudioOutput } from "../types";
import { readMediaLibraryDragPayload } from "../logic/mediaLibraryDragPayload";
import { canExposeDirectReferenceUrls, hasSavedMediaIds } from "../logic/referenceOutputAuthority";
import { isAudioUrl, isVideoUrl } from "../logic/stateParsers";
import { isRenderableAdaptiveUrl } from "../../../lib/adaptive-media";
import {
  COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_PAYLOAD_TYPE,
  extractComposerImageDropPayload,
  extractInternalReferenceDragPayload,
  hasInternalReferenceDragTypeHints,
  INTERNAL_REFERENCE_DRAG_ORIGIN,
} from "../../../lib/internalReferenceDragPayload";
import {
  clearComposerImageDropSession,
  COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_SESSION_TYPE,
  clearInternalReferenceDragSession,
  INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
  registerComposerImageDropSession,
  registerInternalReferenceDragSession,
  scheduleClearComposerImageDropSession,
  scheduleClearInternalReferenceDragSession,
} from "../../../lib/internalReferenceDragSession";
import {
  buildCanvasPromptDragGhost,
  CANVAS_PROMPT_DRAG_HOTSPOT_X,
  CANVAS_PROMPT_DRAG_HOTSPOT_Y,
} from "../logic/canvasPromptDragGhost";
import type { ReferenceDragSourceSurface } from "../../../lib/internalReferenceDragPayload";
export {
  COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_PAYLOAD_TYPE,
  extractComposerImageDropPayload,
  extractInternalReferenceDragPayload,
  getNormalizedTransferTypes,
  hasInternalReferenceDragTypeHints,
  INTERNAL_REFERENCE_DRAG_ORIGIN,
  type ComposerImageDropPayload,
  type InternalReferenceDragPayload,
  type ReferenceDragSourceSurface,
} from "../../../lib/internalReferenceDragPayload";

const imageUrlPattern = /^(data:image\/|blob:|https?:\/\/)/i;
const NEXT_IMAGE_OPTIMIZER_PATH = "/_next/image";
const RELATIVE_MEDIA_PATH_HINT_PATTERN =
  /^\/(?:_next\/image|storage\/|.*\.(?:aac|avif|bmp|flac|gif|heic|heif|jpe?g|m4a|mp3|oga|ogg|png|wav|webp|m4v|mov|mp4|ogv|webm)(?:$|[?#]))/i;
const VIDEO_STORAGE_PATH_PATTERN = /\.(?:m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#])/i;

const dedupeText = (value?: string) => (value ? value.trim() : "");

const getFirstUriListValue = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .find(Boolean);

const findImageFile = (files?: FileList) => {
  if (!files) return null;
  return Array.from(files).find((file) => file.type.startsWith("image/")) ?? null;
};

const findVideoFile = (files?: FileList) => {
  if (!files) return null;
  return Array.from(files).find((file) => file.type.startsWith("video/")) ?? null;
};

const dragGhostMap = new WeakMap<HTMLElement, HTMLElement>();
const DRAG_GHOST_SCALE = 0.68;
const DRAG_GHOST_MIN_SIZE_PX = 108;
const DRAG_GHOST_MAX_SIZE_PX = 244;
const DRAG_GHOST_ASPECT_RATIO = 4 / 5;
const DRAG_GHOST_SNAPSHOT_WIDTH = 768;
const DRAG_GHOST_SNAPSHOT_HEIGHT = 960;
const DRAG_GHOST_SNAPSHOT_QUALITY = 0.82;

type ReferenceDragPreviewKind = "image" | "video" | "audio" | "text";

type ReferenceDragPreviewDataset = {
  previewUrl: string | null;
  imageSrc: string | null;
  snapshotSrc: string | null;
  previewKind: ReferenceDragPreviewKind | null;
};

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

export type ReferenceComposerImageDragArtifact = {
  displayArtifactUrl: string;
  displayArtifactKind: "blob" | "data" | "url";
  promptText?: string | null;
  mediaId?: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  referenceUrl?: string | null;
  mimeType?: string | null;
  width?: number;
  height?: number;
};

const INTERNAL_REFERENCE_DRAG_VERSION = 1;
const REFERENCE_TRANSFER_ORIGIN_TYPE = "text/reference-origin";
const REFERENCE_TRANSFER_VERSION_TYPE = "text/reference-version";
const REFERENCE_TRANSFER_OUTPUT_ID_TYPE = "text/reference-output-id";
const REFERENCE_TRANSFER_IMAGE_INDEX_TYPE = "text/reference-image-index";
const REFERENCE_TRANSFER_SOURCE_SURFACE_TYPE = "text/reference-source-surface";
const REFERENCE_TRANSFER_MEDIA_ID_TYPE = "text/reference-media-id";
const REFERENCE_TRANSFER_MEDIA_KIND_TYPE = "text/reference-media-kind";
const REFERENCE_TRANSFER_WIDTH_TYPE = "text/reference-width";
const REFERENCE_TRANSFER_HEIGHT_TYPE = "text/reference-height";
const REFERENCE_TRANSFER_PREVIEW_STORAGE_PATH_TYPE = "text/reference-preview-storage-path";
const REFERENCE_TRANSFER_FULL_STORAGE_PATH_TYPE = "text/reference-full-storage-path";
export const REFERENCE_TRANSFER_RENDER_URL_TYPE = "text/reference-render-url";
const INTERNAL_REFERENCE_DRAG_TOKEN_DATASET_KEY = "internalReferenceDragToken";
const COMPOSER_IMAGE_DROP_TOKEN_DATASET_KEY = "composerImageDropToken";

const isBlobUrl = (value?: string | null) => Boolean(value && value.startsWith("blob:"));
const isInlineTransferHeavyUrl = (value?: string | null) =>
  Boolean(value && (value.startsWith("blob:") || value.startsWith("data:")));

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
): ReferenceDragPreviewKind | null =>
  extractInternalReferenceDragPayload(transfer)?.mediaKind ??
  parseReferenceMediaKind(transfer.getData(REFERENCE_TRANSFER_MEDIA_KIND_TYPE));

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

const clampDragGhostSize = (value: number): number =>
  Math.max(DRAG_GHOST_MIN_SIZE_PX, Math.min(DRAG_GHOST_MAX_SIZE_PX, value));

const trimDragGhostText = (value: string | null, maxLength = 160): string => {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 3)}...` : trimmed;
};

const safeSetDragImage = (
  transfer: DataTransfer,
  element: HTMLElement,
  x: number,
  y: number
): void => {
  try {
    transfer.setDragImage(element, x, y);
  } catch {
    // Some browsers ignore custom drag images for specific node types; preserve drag payload semantics.
  }
};

const resolveOutputPreviewKind = (output: StudioOutput): ReferenceDragPreviewKind => {
  if (output.mode === "image") return "image";
  if (output.mode === "video") return "video";
  if (output.mode === "audio") return "audio";
  return "text";
};

const resolveVideoPrimaryStoragePath = ({
  mode,
  previewStoragePath,
  fullStoragePath,
}: {
  mode: StudioOutput["mode"];
  previewStoragePath: string | null;
  fullStoragePath: string | null;
}): string | null => {
  if (mode !== "video") return previewStoragePath;
  if (previewStoragePath && VIDEO_STORAGE_PATH_PATTERN.test(previewStoragePath)) {
    return previewStoragePath;
  }
  if (fullStoragePath) return fullStoragePath;
  return previewStoragePath;
};

const resolveDragGhostDimensions = ({
  width,
  height,
}: {
  width: number;
  height: number;
}): { ghostWidth: number; ghostHeight: number } => {
  const scaledHeight =
    height > 0
      ? height * DRAG_GHOST_SCALE
      : width > 0
        ? (width / DRAG_GHOST_ASPECT_RATIO) * DRAG_GHOST_SCALE
        : DRAG_GHOST_MAX_SIZE_PX;
  const ghostHeight = clampDragGhostSize(scaledHeight);
  const ghostWidth = Math.round(ghostHeight * DRAG_GHOST_ASPECT_RATIO);
  return { ghostWidth, ghostHeight };
};

const createDragGhostSnapshotSrc = (imageNode: HTMLImageElement | null): string | null => {
  if (!imageNode) return null;
  if (!imageNode.complete || imageNode.naturalWidth <= 0 || imageNode.naturalHeight <= 0)
    return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = DRAG_GHOST_SNAPSHOT_WIDTH;
    canvas.height = DRAG_GHOST_SNAPSHOT_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) return null;

    const sourceWidth = imageNode.naturalWidth;
    const sourceHeight = imageNode.naturalHeight;
    const sourceAspect = sourceWidth / sourceHeight;
    const targetAspect = DRAG_GHOST_SNAPSHOT_WIDTH / DRAG_GHOST_SNAPSHOT_HEIGHT;
    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;
    if (sourceAspect > targetAspect) {
      sw = Math.max(1, Math.round(sourceHeight * targetAspect));
      sx = Math.round((sourceWidth - sw) / 2);
    } else if (sourceAspect < targetAspect) {
      sh = Math.max(1, Math.round(sourceWidth / targetAspect));
      sy = Math.round((sourceHeight - sh) / 2);
    }

    context.drawImage(
      imageNode,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      DRAG_GHOST_SNAPSHOT_WIDTH,
      DRAG_GHOST_SNAPSHOT_HEIGHT
    );
    return canvas.toDataURL("image/jpeg", DRAG_GHOST_SNAPSHOT_QUALITY);
  } catch {
    return null;
  }
};

const readReferenceDragPreviewDataset = (
  node?: HTMLElement | null
): ReferenceDragPreviewDataset => {
  const previewKindRaw = node?.dataset.dragPreviewKind?.trim().toLowerCase() ?? "";
  const previewKind: ReferenceDragPreviewKind | null =
    previewKindRaw === "image" ||
    previewKindRaw === "video" ||
    previewKindRaw === "audio" ||
    previewKindRaw === "text"
      ? previewKindRaw
      : null;
  const renderedImageNode = node?.querySelector("img.reference-card-image");
  const renderedImageElement =
    renderedImageNode instanceof HTMLImageElement ? renderedImageNode : null;
  const renderedImageSrc = renderedImageElement
    ? renderedImageElement.currentSrc ||
      renderedImageElement.getAttribute("src") ||
      renderedImageElement.dataset.src ||
      null
    : null;
  return {
    previewUrl: normalizeReferenceTransferUrlCandidate(node?.dataset.dragPreviewUrl ?? null),
    imageSrc: normalizeReferenceTransferUrlCandidate(
      renderedImageSrc ?? node?.dataset.dragImageSrc ?? null,
      { unwrapNextImage: false }
    ),
    snapshotSrc: createDragGhostSnapshotSrc(renderedImageElement),
    previewKind,
  };
};

const resolveGhostImageUrl = ({
  output,
  previewDataset,
}: {
  output: StudioOutput;
  previewDataset: ReferenceDragPreviewDataset;
}): string | null => {
  const candidates = [
    previewDataset.snapshotSrc,
    previewDataset.imageSrc,
    previewDataset.previewUrl,
    output.mode === "audio" ? (output.companionArtUrl ?? null) : null,
    resolveReferenceTransferUrl(output, "image"),
  ];
  for (const candidate of candidates) {
    const normalized = normalizeReferenceTransferUrlCandidate(candidate, {
      unwrapNextImage: false,
    });
    if (!normalized) continue;
    if (isLikelyImageTransferUrl(normalized)) return normalized;
  }
  return null;
};

const buildReferenceDragGhost = ({
  output,
  previewDataset,
  width,
  height,
}: {
  output: StudioOutput;
  previewDataset: ReferenceDragPreviewDataset;
  width: number;
  height: number;
}): HTMLElement => {
  const { ghostWidth, ghostHeight } = resolveDragGhostDimensions({ width, height });
  const ghost = document.createElement("div");
  ghost.className = "reference-drag-ghost";
  ghost.style.width = `${ghostWidth}px`;
  ghost.style.height = `${ghostHeight}px`;
  ghost.style.aspectRatio = "4 / 5";
  ghost.style.boxSizing = "border-box";
  ghost.style.position = "absolute";
  ghost.style.top = "-9999px";
  ghost.style.left = "-9999px";
  ghost.style.overflow = "hidden";
  ghost.style.borderRadius = "6px";
  ghost.style.border = "none";
  ghost.style.background = "rgba(13, 18, 28, 0.92)";
  ghost.style.pointerEvents = "none";
  ghost.style.display = "flex";
  ghost.style.flexDirection = "column";
  ghost.style.justifyContent = "space-between";
  ghost.style.boxShadow = "0 12px 30px rgba(0,0,0,0.45)";

  const imageUrl = resolveGhostImageUrl({
    output,
    previewDataset,
  });
  const videoUrl = resolveReferenceTransferUrl(output, "video");
  const previewKind = previewDataset.previewKind ?? resolveOutputPreviewKind(output);
  const promptText = trimDragGhostText(dedupeText(output.prompt ?? output.previewText) || null);
  const isMediaGhost = Boolean(imageUrl || videoUrl);

  if (previewKind === "text" && !isMediaGhost && promptText) {
    return buildCanvasPromptDragGhost({
      detail: promptText,
      className: "reference-drag-ghost",
    });
  }

  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = "";
    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = "cover";
    image.style.display = "block";
    ghost.appendChild(image);
  } else if (videoUrl || previewKind === "video") {
    const videoPlaceholder = document.createElement("div");
    videoPlaceholder.style.flex = "1";
    videoPlaceholder.style.width = "100%";
    videoPlaceholder.style.height = "100%";
    videoPlaceholder.style.background =
      "linear-gradient(160deg, rgba(24,31,45,0.95), rgba(10,14,22,0.85))";
    ghost.appendChild(videoPlaceholder);
  } else if (previewKind === "audio") {
    const textBody = document.createElement("div");
    textBody.style.flex = "1";
    textBody.style.padding = "10px";
    textBody.style.fontSize = "11px";
    textBody.style.lineHeight = "1.3";
    textBody.style.color = "rgba(229, 238, 255, 0.92)";
    textBody.style.overflow = "hidden";
    textBody.style.display = "-webkit-box";
    textBody.style.setProperty("-webkit-line-clamp", "5");
    textBody.style.setProperty("-webkit-box-orient", "vertical");
    textBody.textContent = promptText || "Audio";
    ghost.appendChild(textBody);
  } else if (promptText) {
    const textBody = document.createElement("div");
    textBody.style.flex = "1";
    textBody.style.padding = "10px";
    textBody.style.fontSize = "11px";
    textBody.style.lineHeight = "1.3";
    textBody.style.color = "rgba(229, 238, 255, 0.92)";
    textBody.style.overflow = "hidden";
    textBody.style.display = "-webkit-box";
    textBody.style.setProperty("-webkit-line-clamp", "5");
    textBody.style.setProperty("-webkit-box-orient", "vertical");
    textBody.textContent = promptText;
    ghost.appendChild(textBody);
  }
  return ghost;
};

const toAbsoluteTransferUrl = (value: string): string => {
  if (!value.startsWith("/")) return value;
  if (!RELATIVE_MEDIA_PATH_HINT_PATTERN.test(value)) return value;
  if (typeof window === "undefined") return value;
  try {
    return new URL(value, window.location.href).toString();
  } catch {
    return value;
  }
};

const unwrapNextImageTransferUrl = (value: string): string => {
  if (typeof window === "undefined") return value;
  try {
    const parsed = new URL(value, window.location.href);
    if (parsed.pathname !== NEXT_IMAGE_OPTIMIZER_PATH) return value;
    const sourceUrl = parsed.searchParams.get("url")?.trim();
    if (!sourceUrl) return value;
    return toAbsoluteTransferUrl(sourceUrl);
  } catch {
    return value;
  }
};

type NormalizeReferenceTransferUrlCandidateOptions = {
  unwrapNextImage?: boolean;
};

export const normalizeReferenceTransferUrlCandidate = (
  value: string | null | undefined,
  options?: NormalizeReferenceTransferUrlCandidateOptions
): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withAbsoluteOrigin = toAbsoluteTransferUrl(trimmed);
  const shouldUnwrapNextImage = options?.unwrapNextImage ?? true;
  const unwrapped = (
    shouldUnwrapNextImage ? unwrapNextImageTransferUrl(withAbsoluteOrigin) : withAbsoluteOrigin
  ).trim();
  return unwrapped || null;
};

const isCurrentDocumentUrl = (value?: string | null) => {
  if (!value || typeof window === "undefined") return false;
  try {
    const current = new URL(window.location.href);
    const candidate = new URL(value, window.location.href);
    return (
      candidate.origin === current.origin &&
      candidate.pathname === current.pathname &&
      candidate.search === current.search
    );
  } catch {
    return false;
  }
};

const resolveDraggedUrl = (
  value: string,
  referenceUrl: string | null,
  matcher: (value?: string) => boolean
) => {
  const candidate = normalizeReferenceTransferUrlCandidate(value) ?? value.trim();
  if (!candidate) return null;
  if (matcher(candidate)) return candidate;
  if (!referenceUrl) return null;
  if ((isBlobUrl(candidate) || isCurrentDocumentUrl(candidate)) && matcher(referenceUrl)) {
    return referenceUrl;
  }
  return null;
};

export const looksLikeImageUrl = (value?: string) => {
  if (!value) return false;
  const normalized = normalizeReferenceTransferUrlCandidate(value) ?? value.trim();
  if (isVideoUrl(normalized) || isAudioUrl(normalized)) return false;
  return (
    isRenderableAdaptiveUrl(normalized) ||
    imageUrlPattern.test(normalized) ||
    RELATIVE_MEDIA_PATH_HINT_PATTERN.test(normalized)
  );
};

export const looksLikeVideoUrl = (value?: string) => {
  if (!value) return false;
  const normalized = normalizeReferenceTransferUrlCandidate(value) ?? value.trim();
  return isVideoUrl(normalized);
};

export const looksLikeAudioUrl = (value?: string) => {
  if (!value) return false;
  const normalized = normalizeReferenceTransferUrlCandidate(value) ?? value.trim();
  return isAudioUrl(normalized);
};

const isLikelyImageTransferUrl = (value?: string) =>
  looksLikeImageUrl(value) && !looksLikeVideoUrl(value) && !looksLikeAudioUrl(value);

export const resolveReferenceTransferUrl = (
  output: Pick<
    StudioOutput,
    "previewUrl" | "previewStoragePath" | "fullStoragePath" | "resultUrls"
  >,
  kind: "image" | "video" | "audio" | "any" = "any"
): string | null => {
  const candidates = [
    output.fullStoragePath,
    output.previewStoragePath,
    ...(output.resultUrls ?? []),
    output.previewUrl,
  ];
  const localCandidates: string[] = [];

  for (const candidate of candidates) {
    const normalized = normalizeReferenceTransferUrlCandidate(candidate);
    if (!normalized) continue;
    if (isBlobUrl(normalized) || normalized.startsWith("data:")) {
      localCandidates.push(normalized);
      continue;
    }
    if (!isRenderableAdaptiveUrl(normalized)) continue;
    if (kind === "image" && isLikelyImageTransferUrl(normalized)) return normalized;
    if (kind === "video" && looksLikeVideoUrl(normalized)) return normalized;
    if (kind === "audio" && looksLikeAudioUrl(normalized)) return normalized;
    if (
      kind === "any" &&
      (isLikelyImageTransferUrl(normalized) ||
        looksLikeVideoUrl(normalized) ||
        looksLikeAudioUrl(normalized))
    ) {
      return normalized;
    }
  }

  for (const candidate of localCandidates) {
    if (kind === "image" && isLikelyImageTransferUrl(candidate)) return candidate;
    if (kind === "video" && looksLikeVideoUrl(candidate)) return candidate;
    if (kind === "audio" && looksLikeAudioUrl(candidate)) return candidate;
    if (
      kind === "any" &&
      (isLikelyImageTransferUrl(candidate) ||
        looksLikeVideoUrl(candidate) ||
        looksLikeAudioUrl(candidate))
    ) {
      return candidate;
    }
  }

  return null;
};

export const extractDragDropPayload = (transfer: DataTransfer): DragDropPayload => {
  const imageFile = findImageFile(transfer.files);
  const internalPayload = extractInternalReferenceDragPayload(transfer);
  const hasAuthoritativeInternalPayload = Boolean(
    transfer.getData(INTERNAL_REFERENCE_DRAG_SESSION_TYPE).trim() ||
    transfer.getData(INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE).trim() ||
    transfer.getData(REFERENCE_TRANSFER_ORIGIN_TYPE).trim()
  );
  const mediaKind =
    internalPayload?.mediaKind ??
    parseReferenceMediaKind(transfer.getData(REFERENCE_TRANSFER_MEDIA_KIND_TYPE));
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
    transfer.getData("text/reference-url")
  );
  const referenceId =
    internalPayload?.referenceId ?? (transfer.getData("text/reference-id") || null);
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
  const dimensions = resolveReferenceTransferDimensions(transfer);

  if (imageFile) {
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
  const mediaKind = resolveReferenceTransferMediaKind(transfer);
  const referenceUrl = normalizeReferenceTransferUrlCandidate(
    transfer.getData("text/reference-url")
  );
  const referenceId = transfer.getData("text/reference-id") || null;
  const normalizedReferenceUrl =
    referenceUrl && looksLikeVideoUrl(referenceUrl) ? referenceUrl : null;

  if (videoFile) {
    return {
      videoUrl: null,
      videoFile,
      promptText: null,
      referenceId,
      fromFile: true,
    };
  }

  if (mediaKind && mediaKind !== "video") {
    return {
      videoUrl: null,
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

  return {
    videoUrl: null,
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
  const promptText = extractPromptText(transfer);
  if (!promptText) return null;

  if (extractComposerImageDropPayload(transfer)) return null;

  const mediaLibraryPayload = readMediaLibraryDragPayload(transfer);
  if (mediaLibraryPayload?.kind === "libraryMedia") return null;

  const internalPayload = extractInternalReferenceDragPayload(transfer);
  const mediaKind =
    internalPayload?.mediaKind ??
    parseReferenceMediaKind(transfer.getData(REFERENCE_TRANSFER_MEDIA_KIND_TYPE));
  if (mediaKind && mediaKind !== "text") return null;

  const referenceCandidates = [
    transfer.getData("text/reference-url"),
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
  if (hasDroppedFiles && !hasExplicitPromptType) return null;

  return promptText;
};

export const isImageDragTransfer = (transfer: DataTransfer) => {
  const imageFile = findImageFile(transfer.files);
  if (imageFile) return true;
  if (transfer.types.includes("Files")) return !transfer.files?.length;
  const mediaKind = resolveReferenceTransferMediaKind(transfer);
  if (mediaKind) return mediaKind === "image";
  if (hasInternalReferenceDragTypeHints(transfer)) {
    const referenceUrl = normalizeReferenceTransferUrlCandidate(
      transfer.getData("text/reference-url")
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
  if (transfer.types.includes("text/uri-list") || transfer.types.includes("image/url")) {
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
  if (transfer.types.includes("Files")) return true;
  if (
    transfer.types.includes("text/reference-url") ||
    transfer.types.includes("text/reference-id")
  ) {
    return true;
  }
  if (transfer.types.includes("text/uri-list") || transfer.types.includes("image/url")) return true;
  const plainText = normalizeReferenceTransferUrlCandidate(transfer.getData("text/plain"));
  return Boolean(plainText && looksLikeVideoUrl(plainText));
};

export const prepareReferenceDrag = (
  event: React.DragEvent<HTMLElement>,
  output: StudioOutput,
  options?: {
    dragImage?: HTMLElement;
    sourceSurface?: ReferenceDragSourceSurface;
    imageIndex?: number;
    composerImageArtifact?: ReferenceComposerImageDragArtifact | null;
  }
) => {
  const transfer = event.dataTransfer;
  transfer.effectAllowed = "copy";
  const sourceSurface = options?.sourceSurface ?? "all-refs";
  const imageIndex = Math.max(0, Math.floor(options?.imageIndex ?? 0));
  const promptText = dedupeText(output.prompt ?? output.previewText);
  const dragNode = options?.dragImage ?? (event.currentTarget as HTMLElement);
  const composerImageArtifact =
    output.mode === "image" ? (options?.composerImageArtifact ?? null) : null;
  const previewDataset = readReferenceDragPreviewDataset(dragNode);
  const allowDirectReferenceUrls = canExposeDirectReferenceUrls(output);
  const transferKind =
    output.mode === "video" ? "video" : output.mode === "audio" ? "audio" : "any";
  const previewUrl = allowDirectReferenceUrls
    ? resolveReferenceTransferUrl(output, transferKind)
    : null;
  const imagePreviewUrl = allowDirectReferenceUrls
    ? resolveReferenceTransferUrl(output, "image")
    : null;
  const datasetImageUrl = normalizeReferenceTransferUrlCandidate(previewDataset.imageSrc, {
    unwrapNextImage: false,
  });
  const datasetPreviewUrl = normalizeReferenceTransferUrlCandidate(previewDataset.previewUrl);
  const datasetSnapshotUrl = normalizeReferenceTransferUrlCandidate(previewDataset.snapshotSrc);
  const datasetImageTransferUrl =
    datasetImageUrl && isLikelyImageTransferUrl(datasetImageUrl) ? datasetImageUrl : null;
  const datasetPreviewTransferUrl =
    datasetPreviewUrl && isLikelyImageTransferUrl(datasetPreviewUrl) ? datasetPreviewUrl : null;
  const datasetSnapshotTransferUrl =
    datasetSnapshotUrl && isLikelyImageTransferUrl(datasetSnapshotUrl) ? datasetSnapshotUrl : null;
  const resolvedImageTransferUrl = imagePreviewUrl ?? datasetPreviewTransferUrl ?? null;
  const resolvedRenderedTransferUrl =
    datasetSnapshotTransferUrl ?? datasetImageTransferUrl ?? resolvedImageTransferUrl;
  const internalRenderOnlyUrl =
    !allowDirectReferenceUrls &&
    (hasSavedMediaIds(output) || Boolean(output.generationId?.trim())) &&
    resolvedRenderedTransferUrl
      ? resolvedRenderedTransferUrl
      : null;
  const exposedRenderedTransferUrl = allowDirectReferenceUrls
    ? resolvedRenderedTransferUrl
    : internalRenderOnlyUrl;
  const resolvedReferenceTransferUrl =
    output.mode === "image"
      ? (resolvedImageTransferUrl ?? previewUrl ?? null)
      : (previewUrl ?? resolvedImageTransferUrl ?? null);
  const resolvedComposerDisplayArtifactUrl =
    composerImageArtifact && output.mode === "image"
      ? (datasetSnapshotTransferUrl ?? composerImageArtifact.displayArtifactUrl)
      : (composerImageArtifact?.displayArtifactUrl ?? null);
  const resolvedComposerDisplayArtifactKind = resolvedComposerDisplayArtifactUrl?.startsWith(
    "blob:"
  )
    ? ("blob" as const)
    : resolvedComposerDisplayArtifactUrl?.startsWith("data:")
      ? ("data" as const)
      : resolvedComposerDisplayArtifactUrl
        ? ("url" as const)
        : (composerImageArtifact?.displayArtifactKind ?? "url");
  const resolvedPrimaryImagePreviewUrl =
    resolvedComposerDisplayArtifactUrl ??
    (output.mode === "image"
      ? (exposedRenderedTransferUrl ??
        resolvedImageTransferUrl ??
        (allowDirectReferenceUrls ? resolvedReferenceTransferUrl : null))
      : null);
  const shouldInlinePrimaryImagePreviewUrl = !isInlineTransferHeavyUrl(
    resolvedPrimaryImagePreviewUrl
  );
  const shouldInlineRenderedTransferUrl = !isInlineTransferHeavyUrl(exposedRenderedTransferUrl);
  const referenceMediaId =
    output.savedMediaIds?.[imageIndex]?.trim() ?? output.savedMediaIds?.[0]?.trim();
  const previewImageNode = dragNode.querySelector(".reference-card-image");
  const naturalWidth =
    previewImageNode instanceof HTMLImageElement && previewImageNode.naturalWidth > 0
      ? previewImageNode.naturalWidth
      : 0;
  const naturalHeight =
    previewImageNode instanceof HTMLImageElement && previewImageNode.naturalHeight > 0
      ? previewImageNode.naturalHeight
      : 0;
  const dragNodeDataset = dragNode?.dataset ?? null;
  const previousDragSessionToken =
    dragNodeDataset?.[INTERNAL_REFERENCE_DRAG_TOKEN_DATASET_KEY]?.trim() ?? "";
  if (previousDragSessionToken) {
    clearInternalReferenceDragSession(previousDragSessionToken);
  }
  const normalizedPreviewStoragePath = resolveVideoPrimaryStoragePath({
    mode: output.mode,
    previewStoragePath: output.previewStoragePath?.trim() || null,
    fullStoragePath: output.fullStoragePath?.trim() || null,
  });
  const normalizedFullStoragePath = output.fullStoragePath?.trim() || null;
  const dragSessionToken = registerInternalReferenceDragSession({
    version: INTERNAL_REFERENCE_DRAG_VERSION,
    origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
    referenceId: output.id?.trim() || null,
    outputId: output.id?.trim() || null,
    imageIndex,
    mediaId: referenceMediaId ?? null,
    mediaKind: resolveOutputPreviewKind(output),
    previewStoragePath: normalizedPreviewStoragePath,
    fullStoragePath: normalizedFullStoragePath,
    referenceUrl:
      composerImageArtifact?.referenceUrl ??
      (allowDirectReferenceUrls ? (resolvedReferenceTransferUrl ?? null) : null),
    referenceRenderUrl: resolvedComposerDisplayArtifactUrl ?? exposedRenderedTransferUrl ?? null,
    sourceSurface,
    ...(naturalWidth > 0 ? { width: naturalWidth } : {}),
    ...(naturalHeight > 0 ? { height: naturalHeight } : {}),
  });
  if (dragNodeDataset) {
    dragNodeDataset[INTERNAL_REFERENCE_DRAG_TOKEN_DATASET_KEY] = dragSessionToken;
  }
  transfer.setData(INTERNAL_REFERENCE_DRAG_SESSION_TYPE, dragSessionToken);
  transfer.setData(INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE, dragSessionToken);
  if (allowDirectReferenceUrls && resolvedReferenceTransferUrl) {
    transfer.setData("text/uri-list", resolvedReferenceTransferUrl);
    transfer.setData("text/reference-url", resolvedReferenceTransferUrl);
  }
  if (
    output.mode === "image" &&
    resolvedPrimaryImagePreviewUrl &&
    shouldInlinePrimaryImagePreviewUrl
  ) {
    transfer.setData("image/url", resolvedPrimaryImagePreviewUrl);
  } else if (allowDirectReferenceUrls && resolvedImageTransferUrl) {
    transfer.setData("image/url", resolvedImageTransferUrl);
  }
  if (exposedRenderedTransferUrl && shouldInlineRenderedTransferUrl) {
    transfer.setData(REFERENCE_TRANSFER_RENDER_URL_TYPE, exposedRenderedTransferUrl);
  }
  if (output.id) {
    transfer.setData("text/reference-id", output.id);
    transfer.setData(REFERENCE_TRANSFER_OUTPUT_ID_TYPE, output.id);
  }
  transfer.setData(REFERENCE_TRANSFER_ORIGIN_TYPE, INTERNAL_REFERENCE_DRAG_ORIGIN);
  transfer.setData(REFERENCE_TRANSFER_VERSION_TYPE, String(INTERNAL_REFERENCE_DRAG_VERSION));
  transfer.setData(REFERENCE_TRANSFER_IMAGE_INDEX_TYPE, String(imageIndex));
  transfer.setData(REFERENCE_TRANSFER_SOURCE_SURFACE_TYPE, sourceSurface);
  transfer.setData(REFERENCE_TRANSFER_MEDIA_KIND_TYPE, resolveOutputPreviewKind(output));
  if (naturalWidth > 0 && naturalHeight > 0) {
    transfer.setData(REFERENCE_TRANSFER_WIDTH_TYPE, String(naturalWidth));
    transfer.setData(REFERENCE_TRANSFER_HEIGHT_TYPE, String(naturalHeight));
  }
  if (referenceMediaId) {
    transfer.setData(REFERENCE_TRANSFER_MEDIA_ID_TYPE, referenceMediaId);
  }
  const previewStoragePath =
    composerImageArtifact?.previewStoragePath?.trim() || normalizedPreviewStoragePath || "";
  const fullStoragePath =
    composerImageArtifact?.fullStoragePath?.trim() || normalizedFullStoragePath || "";
  if (previewStoragePath) {
    transfer.setData(REFERENCE_TRANSFER_PREVIEW_STORAGE_PATH_TYPE, previewStoragePath);
  }
  if (fullStoragePath) {
    transfer.setData(REFERENCE_TRANSFER_FULL_STORAGE_PATH_TYPE, fullStoragePath);
  }
  if (composerImageArtifact) {
    const previousComposerDropToken =
      dragNodeDataset?.[COMPOSER_IMAGE_DROP_TOKEN_DATASET_KEY]?.trim() ?? "";
    if (previousComposerDropToken) {
      clearComposerImageDropSession(previousComposerDropToken);
    }
    const composerPayload = {
      version: INTERNAL_REFERENCE_DRAG_VERSION,
      origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
      referenceId: output.id?.trim() || null,
      outputId: output.id?.trim() || null,
      mediaId: composerImageArtifact.mediaId?.trim() || referenceMediaId || null,
      displayArtifactUrl:
        resolvedComposerDisplayArtifactUrl ?? composerImageArtifact.displayArtifactUrl,
      displayArtifactKind: resolvedComposerDisplayArtifactKind,
      previewStoragePath: previewStoragePath || null,
      fullStoragePath: fullStoragePath || null,
      referenceUrl:
        composerImageArtifact.referenceUrl?.trim() ||
        (allowDirectReferenceUrls ? resolvedReferenceTransferUrl : null) ||
        null,
      promptText: composerImageArtifact.promptText?.trim() || promptText || null,
      sourceSurface,
      width: composerImageArtifact.width ?? (naturalWidth > 0 ? naturalWidth : undefined),
      height: composerImageArtifact.height ?? (naturalHeight > 0 ? naturalHeight : undefined),
      mimeType: composerImageArtifact.mimeType?.trim() || output.mimeType?.trim() || null,
    };
    const composerDropSessionToken = registerComposerImageDropSession(composerPayload);
    if (dragNodeDataset) {
      dragNodeDataset[COMPOSER_IMAGE_DROP_TOKEN_DATASET_KEY] = composerDropSessionToken;
    }
    transfer.setData(COMPOSER_IMAGE_DROP_SESSION_TYPE, composerDropSessionToken);
    transfer.setData(COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE, composerDropSessionToken);
    if (composerImageArtifact.displayArtifactKind === "url") {
      const serializedComposerPayload = JSON.stringify(composerPayload);
      transfer.setData(COMPOSER_IMAGE_DROP_PAYLOAD_TYPE, serializedComposerPayload);
      transfer.setData(COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE, serializedComposerPayload);
    }
  }
  if (promptText) {
    transfer.setData("text/plain", promptText);
    transfer.setData("text/prompt", promptText);
  } else if (allowDirectReferenceUrls && resolvedReferenceTransferUrl) {
    transfer.setData("text/plain", resolvedReferenceTransferUrl);
  }

  if (dragNode) {
    dragNode.classList.add("is-dragging");
    // Use a dedicated drag ghost so selected-card controls never leak into drag previews.
    try {
      const rect = dragNode.getBoundingClientRect();
      const ghost = buildReferenceDragGhost({
        output,
        previewDataset,
        width: rect.width || dragNode.offsetWidth || DRAG_GHOST_MAX_SIZE_PX,
        height: rect.height || dragNode.offsetHeight || DRAG_GHOST_MAX_SIZE_PX,
      });
      document.body.appendChild(ghost);
      dragGhostMap.set(dragNode, ghost);
      safeSetDragImage(
        transfer,
        ghost,
        output.mode === "text"
          ? CANVAS_PROMPT_DRAG_HOTSPOT_X
          : Math.round((rect.width || dragNode.offsetWidth) / 2),
        output.mode === "text"
          ? CANVAS_PROMPT_DRAG_HOTSPOT_Y
          : Math.round((rect.height || dragNode.offsetHeight) / 2)
      );
    } catch {
      // Keep drag payload semantics even if ghost construction fails.
    }
  }
};

export const clearDragState = (event: React.DragEvent<HTMLElement>) => {
  const node = event.currentTarget as HTMLElement;
  node.classList.remove("is-dragging");
  const dragSessionToken = node.dataset[INTERNAL_REFERENCE_DRAG_TOKEN_DATASET_KEY];
  if (dragSessionToken) {
    scheduleClearInternalReferenceDragSession(dragSessionToken);
    delete node.dataset[INTERNAL_REFERENCE_DRAG_TOKEN_DATASET_KEY];
  }
  const composerDropSessionToken = node.dataset[COMPOSER_IMAGE_DROP_TOKEN_DATASET_KEY];
  if (composerDropSessionToken) {
    scheduleClearComposerImageDropSession(composerDropSessionToken);
    delete node.dataset[COMPOSER_IMAGE_DROP_TOKEN_DATASET_KEY];
  }
  const ghost = dragGhostMap.get(node);
  if (ghost && ghost.parentNode) {
    ghost.parentNode.removeChild(ghost);
  }
  dragGhostMap.delete(node);
};
