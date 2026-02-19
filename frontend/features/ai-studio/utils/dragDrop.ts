import { StudioOutput } from "../types";
import { isVideoUrl } from "../logic/stateParsers";

const imageUrlPattern = /^(data:image\/|blob:|https?:\/\/)/i;
const NEXT_IMAGE_OPTIMIZER_PATH = "/_next/image";
const RELATIVE_MEDIA_PATH_HINT_PATTERN =
  /^\/(?:_next\/image|storage\/|.*\.(?:avif|bmp|gif|heic|heif|jpe?g|png|webp|m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#]))/i;

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

export type DragDropPayload = {
  imageUrl: string | null;
  promptText: string | null;
  referenceId?: string | null;
  fromFile?: boolean;
};

export type VideoDragDropPayload = {
  videoUrl: string | null;
  promptText: string | null;
  referenceId?: string | null;
  fromFile?: boolean;
};

export type ReferenceDragSourceSurface = "all-refs" | "curated";

const isBlobUrl = (value?: string | null) => Boolean(value && value.startsWith("blob:"));

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

export const normalizeReferenceTransferUrlCandidate = (
  value: string | null | undefined
): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withAbsoluteOrigin = toAbsoluteTransferUrl(trimmed);
  const unwrapped = unwrapNextImageTransferUrl(withAbsoluteOrigin).trim();
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
  return imageUrlPattern.test(value.trim());
};

export const looksLikeVideoUrl = (value?: string) => {
  if (!value) return false;
  const normalized = normalizeReferenceTransferUrlCandidate(value) ?? value.trim();
  return isVideoUrl(normalized);
};

const isLikelyImageTransferUrl = (value?: string) =>
  looksLikeImageUrl(value) && !looksLikeVideoUrl(value);

export const resolveReferenceTransferUrl = (
  output: Pick<
    StudioOutput,
    "previewUrl" | "previewStoragePath" | "fullStoragePath" | "resultUrls"
  >,
  kind: "image" | "video" | "any" = "any"
): string | null => {
  const candidates = [
    output.previewUrl,
    output.fullStoragePath,
    output.previewStoragePath,
    ...(output.resultUrls ?? []),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeReferenceTransferUrlCandidate(candidate);
    if (!normalized) continue;
    if (kind === "image" && isLikelyImageTransferUrl(normalized)) return normalized;
    if (kind === "video" && looksLikeVideoUrl(normalized)) return normalized;
    if (kind === "any" && (isLikelyImageTransferUrl(normalized) || looksLikeVideoUrl(normalized))) {
      return normalized;
    }
  }

  return null;
};

export const extractDragDropPayload = (transfer: DataTransfer): DragDropPayload => {
  const imageFile = findImageFile(transfer.files);
  const referenceUrl = normalizeReferenceTransferUrlCandidate(
    transfer.getData("text/reference-url")
  );
  const referenceId = transfer.getData("text/reference-id") || null;
  const normalizedReferenceUrl =
    referenceUrl && isLikelyImageTransferUrl(referenceUrl) ? referenceUrl : null;

  if (imageFile) {
    return {
      imageUrl: URL.createObjectURL(imageFile),
      promptText: null,
      referenceId,
      fromFile: true,
    };
  }

  if (normalizedReferenceUrl) {
    return {
      imageUrl: normalizedReferenceUrl,
      promptText: extractPromptText(transfer),
      referenceId,
      fromFile: false,
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
        };
      }
    }
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
      };
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
      };
    }
  }

  return {
    imageUrl: null,
    promptText: extractPromptText(transfer),
    referenceId,
    fromFile: false,
  };
};

export const extractVideoDragDropPayload = (transfer: DataTransfer): VideoDragDropPayload => {
  const videoFile = findVideoFile(transfer.files);
  const referenceUrl = normalizeReferenceTransferUrlCandidate(
    transfer.getData("text/reference-url")
  );
  const referenceId = transfer.getData("text/reference-id") || null;
  const normalizedReferenceUrl =
    referenceUrl && looksLikeVideoUrl(referenceUrl) ? referenceUrl : null;

  if (videoFile) {
    return {
      videoUrl: URL.createObjectURL(videoFile),
      promptText: null,
      referenceId,
      fromFile: true,
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

const extractPromptText = (transfer: DataTransfer) => {
  const promptText = transfer.getData("text/prompt") || transfer.getData("text/plain");
  if (!promptText) return null;
  const normalizedPromptUrl = normalizeReferenceTransferUrlCandidate(promptText);
  if (
    normalizedPromptUrl &&
    (looksLikeImageUrl(normalizedPromptUrl) || looksLikeVideoUrl(normalizedPromptUrl))
  ) {
    return null;
  }
  return promptText.trim();
};

export const isImageDragTransfer = (transfer: DataTransfer) => {
  if (transfer.types.includes("Files")) return true;
  if (transfer.types.includes("text/uri-list") || transfer.types.includes("image/url")) return true;
  const plainText = normalizeReferenceTransferUrlCandidate(transfer.getData("text/plain"));
  return Boolean(plainText && looksLikeImageUrl(plainText));
};

export const isVideoDragTransfer = (transfer: DataTransfer) => {
  // For dragenter/dragover, some browsers do not expose payload text values yet.
  // Prefer transfer types for acceptance, then validate/resolve on drop.
  if (transfer.types.includes("Files")) return true;
  if (
    transfer.types.includes("text/reference-url") ||
    transfer.types.includes("text/reference-id")
  ) {
    return true;
  }
  if (transfer.types.includes("text/uri-list") || transfer.types.includes("image/url")) return true;
  const videoFile = findVideoFile(transfer.files);
  if (videoFile) return true;
  const plainText = normalizeReferenceTransferUrlCandidate(transfer.getData("text/plain"));
  return Boolean(plainText && looksLikeVideoUrl(plainText));
};

export const prepareReferenceDrag = (
  event: React.DragEvent<HTMLElement>,
  output: StudioOutput,
  options?: { dragImage?: HTMLElement; sourceSurface?: ReferenceDragSourceSurface }
) => {
  const transfer = event.dataTransfer;
  transfer.effectAllowed = "copy";
  const sourceSurface = options?.sourceSurface ?? "all-refs";
  const promptText = dedupeText(output.prompt ?? output.previewText);
  const previewUrl = resolveReferenceTransferUrl(output, "any");
  const imagePreviewUrl = resolveReferenceTransferUrl(output, "image");
  const referenceMediaId = output.savedMediaIds?.[0]?.trim();
  if (previewUrl) {
    transfer.setData("text/uri-list", previewUrl);
    transfer.setData("text/reference-url", previewUrl);
    if (imagePreviewUrl) {
      transfer.setData("image/url", imagePreviewUrl);
    }
  }
  if (output.id) {
    transfer.setData("text/reference-id", output.id);
  }
  transfer.setData("text/reference-source-surface", sourceSurface);
  if (referenceMediaId) {
    transfer.setData("text/reference-media-id", referenceMediaId);
  }
  if (promptText) {
    transfer.setData("text/plain", promptText);
    transfer.setData("text/prompt", promptText);
  } else if (previewUrl) {
    transfer.setData("text/plain", previewUrl);
  }

  const dragNode = options?.dragImage ?? (event.currentTarget as HTMLElement);
  if (dragNode) {
    // Shrink ghost to make drag feel lighter; fall back to default if clone fails.
    try {
      const rect = dragNode.getBoundingClientRect();
      const ghost = dragNode.cloneNode(true) as HTMLElement;
      ghost.style.boxSizing = "border-box";
      const scale = 0.6;
      const scaledWidth = rect.width * scale;
      const scaledHeight = rect.height * scale;
      ghost.style.width = `${scaledWidth}px`;
      ghost.style.height = `${scaledHeight}px`;
      ghost.style.transform = `scale(${scale})`;
      ghost.style.transformOrigin = "center";
      ghost.style.opacity = "0.9";
      ghost.style.position = "absolute";
      ghost.style.top = "-9999px";
      ghost.style.left = "-9999px";
      ghost.style.pointerEvents = "none";
      ghost.style.boxShadow = "0 12px 30px rgba(0,0,0,0.45)";
      document.body.appendChild(ghost);
      dragGhostMap.set(dragNode, ghost);
      transfer.setDragImage(ghost, scaledWidth / 2, scaledHeight / 2);
    } catch {
      transfer.setDragImage(dragNode, dragNode.offsetWidth / 2, dragNode.offsetHeight / 2);
    }
    dragNode.classList.add("is-dragging");
  }
};

export const clearDragState = (event: React.DragEvent<HTMLElement>) => {
  const node = event.currentTarget as HTMLElement;
  node.classList.remove("is-dragging");
  const ghost = dragGhostMap.get(node);
  if (ghost && ghost.parentNode) {
    ghost.parentNode.removeChild(ghost);
  }
  dragGhostMap.delete(node);
};
