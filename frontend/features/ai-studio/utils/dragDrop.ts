import { StudioOutput } from "../types";

const imageUrlPattern = /^(data:image\/|blob:|https?:\/\/)/i;
const videoUrlPattern = /^(data:video\/|blob:|https?:\/\/)/i;
const videoExtensionPattern = /\.(mp4|webm|mov|m4v)(\?|$)/i;

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

const isBlobUrl = (value?: string | null) => Boolean(value && value.startsWith("blob:"));

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
  const candidate = value.trim();
  if (!candidate) return null;
  if (!referenceUrl) return candidate;
  if ((isBlobUrl(candidate) || isCurrentDocumentUrl(candidate)) && matcher(referenceUrl)) {
    return referenceUrl;
  }
  return candidate;
};

export const looksLikeImageUrl = (value?: string) => {
  if (!value) return false;
  return imageUrlPattern.test(value.trim());
};

export const looksLikeVideoUrl = (value?: string) => {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.startsWith("data:video/")) return true;
  if (trimmed.startsWith("blob:")) return true;
  return (
    videoUrlPattern.test(trimmed) &&
    (videoExtensionPattern.test(trimmed) ||
      trimmed.includes("/video") ||
      trimmed.includes("video="))
  );
};

const isLikelyImageTransferUrl = (value?: string) =>
  looksLikeImageUrl(value) && !looksLikeVideoUrl(value);

export const extractDragDropPayload = (transfer: DataTransfer): DragDropPayload => {
  const imageFile = findImageFile(transfer.files);
  const referenceUrl = transfer.getData("text/reference-url");
  const referenceId = transfer.getData("text/reference-id") || null;
  const normalizedReferenceUrl = isLikelyImageTransferUrl(referenceUrl)
    ? referenceUrl.trim()
    : null;

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
    const cleanUri = getFirstUriListValue(uriListValue);
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

  const imageUrl = transfer.getData("image/url");
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
  if (rawText && isLikelyImageTransferUrl(rawText)) {
    const resolvedTextUrl = resolveDraggedUrl(
      rawText,
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
  const referenceUrl = transfer.getData("text/reference-url");
  const referenceId = transfer.getData("text/reference-id") || null;
  const normalizedReferenceUrl = looksLikeVideoUrl(referenceUrl) ? referenceUrl.trim() : null;

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
    const cleanUri = getFirstUriListValue(uriListValue);
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

  const imageUrl = transfer.getData("image/url");
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
  if (rawText && looksLikeVideoUrl(rawText)) {
    const resolvedTextUrl = resolveDraggedUrl(rawText, normalizedReferenceUrl, looksLikeVideoUrl);
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
  return looksLikeImageUrl(promptText) ? null : promptText.trim();
};

export const isImageDragTransfer = (transfer: DataTransfer) => {
  if (transfer.types.includes("Files")) return true;
  if (transfer.types.includes("text/uri-list") || transfer.types.includes("image/url")) return true;
  const plainText = transfer.getData("text/plain");
  return looksLikeImageUrl(plainText);
};

export const isVideoDragTransfer = (transfer: DataTransfer) => {
  const videoFile = findVideoFile(transfer.files);
  if (videoFile) return true;
  if (transfer.types.includes("text/uri-list") || transfer.types.includes("image/url")) {
    const uriList = transfer.getData("text/uri-list");
    const imageUrl = transfer.getData("image/url");
    if (looksLikeVideoUrl(uriList) || looksLikeVideoUrl(imageUrl)) return true;
  }
  const plainText = transfer.getData("text/plain");
  return looksLikeVideoUrl(plainText);
};

export const prepareReferenceDrag = (
  event: React.DragEvent<HTMLElement>,
  output: StudioOutput,
  options?: { dragImage?: HTMLElement }
) => {
  const transfer = event.dataTransfer;
  transfer.effectAllowed = "copy";
  const promptText = dedupeText(output.prompt ?? output.previewText);
  if (output.previewUrl) {
    transfer.setData("text/uri-list", output.previewUrl);
    transfer.setData("image/url", output.previewUrl);
    transfer.setData("text/reference-url", output.previewUrl);
  }
  if (output.id) {
    transfer.setData("text/reference-id", output.id);
  }
  if (promptText) {
    transfer.setData("text/plain", promptText);
    transfer.setData("text/prompt", promptText);
  } else if (output.previewUrl) {
    transfer.setData("text/plain", output.previewUrl);
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
