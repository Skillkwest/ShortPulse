/**
 * Right-column drag/drop payload resolution for AI Studio.
 * Converts browser transfer data into the shell DnD controller's stable drop contract.
 */
import {
  buildAiStudioDropSnapshotTransfer,
  captureAiStudioDropSnapshot,
} from "./aiStudioDropSnapshot";
import {
  getMediaLibraryBulkMediaDragTypes,
  getMediaLibraryDragTypes,
  readMediaLibraryBulkMediaDragPayload,
  readMediaLibraryDragPayload,
} from "./mediaLibraryDragPayload";
import type {
  LibraryMediaReferencePayload,
  LibraryPromptReferencePayload,
} from "../reference-grid/referenceGridTypes";
import { getNormalizedTransferTypes, hasInternalReferenceDragTypeHints } from "../utils/dragDrop";

export type RightColumnDropMode = "none" | "text" | "media";
export type PastedRightColumnMediaReference = { url: string; mimeType?: string | null };
export type RightColumnDropPayload =
  | { kind: "none" }
  | { kind: "internal" }
  | { kind: "files"; files: FileList }
  | { kind: "media"; reference: PastedRightColumnMediaReference }
  | { kind: "libraryMedia"; payload: LibraryMediaReferencePayload }
  | { kind: "bulkLibraryMedia"; payloads: LibraryMediaReferencePayload[] }
  | { kind: "libraryPrompt"; payload: LibraryPromptReferencePayload }
  | { kind: "text"; text: string };

const DROPPED_IMAGE_URL_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;
const DROPPED_AUDIO_URL_PATTERN = /\.(aac|flac|m4a|mp3|oga|ogg|wav)(?:[?#].*)?$/i;
const DROPPED_VIDEO_URL_PATTERN = /\.(m4v|mov|mp4|ogv|webm)(?:[?#].*)?$/i;

const parseDropUrlCandidate = (value: string): string | null => {
  const candidate = value.trim();
  if (!candidate || (typeof window !== "undefined" && candidate === window.location.href))
    return null;
  if (/^data:(image|video|audio)\//i.test(candidate)) return candidate;
  if (/^blob:/i.test(candidate)) return candidate;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const inferDropMediaMimeType = (url: string): string | null => {
  if (/^data:image\//i.test(url) || DROPPED_IMAGE_URL_PATTERN.test(url)) return "image/*";
  if (/^data:audio\//i.test(url) || DROPPED_AUDIO_URL_PATTERN.test(url)) return "audio/*";
  if (/^data:video\//i.test(url) || DROPPED_VIDEO_URL_PATTERN.test(url)) return "video/*";
  return null;
};

const isDropMediaUrl = (url: string): boolean => Boolean(inferDropMediaMimeType(url));

const getDropMediaReferenceFromUriList = (
  uriList: string
): PastedRightColumnMediaReference | null => {
  const entries = uriList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  for (const entry of entries) {
    const parsed = parseDropUrlCandidate(entry);
    if (!parsed || !isDropMediaUrl(parsed)) continue;
    return { url: parsed, mimeType: inferDropMediaMimeType(parsed) };
  }
  return null;
};

const getDropMediaReferenceFromHtml = (html: string): PastedRightColumnMediaReference | null => {
  const trimmed = html.trim();
  if (!trimmed || typeof DOMParser === "undefined") return null;
  const fragment = new DOMParser().parseFromString(trimmed, "text/html");
  const nodes = Array.from(fragment.querySelectorAll("img[src],video[src],source[src],a[href]"));
  for (const node of nodes) {
    const raw =
      node.getAttribute("src") ??
      node.getAttribute("href") ??
      (node instanceof HTMLAnchorElement ? node.href : "");
    if (!raw) continue;
    const parsed = parseDropUrlCandidate(raw);
    if (!parsed || !isDropMediaUrl(parsed)) continue;
    return { url: parsed, mimeType: inferDropMediaMimeType(parsed) };
  }
  return null;
};

const getDroppedMediaReference = (
  transfer: DataTransfer
): PastedRightColumnMediaReference | null => {
  const explicitRefUrl = transfer.getData("text/reference-url");
  const parsedReferenceUrl = parseDropUrlCandidate(explicitRefUrl);
  if (parsedReferenceUrl && isDropMediaUrl(parsedReferenceUrl)) {
    return { url: parsedReferenceUrl, mimeType: inferDropMediaMimeType(parsedReferenceUrl) };
  }
  const uriListReference = getDropMediaReferenceFromUriList(transfer.getData("text/uri-list"));
  if (uriListReference) return uriListReference;
  const htmlReference = getDropMediaReferenceFromHtml(transfer.getData("text/html"));
  if (htmlReference) return htmlReference;
  const plainTextUrl = parseDropUrlCandidate(transfer.getData("text/plain"));
  if (plainTextUrl && isDropMediaUrl(plainTextUrl)) {
    return { url: plainTextUrl, mimeType: inferDropMediaMimeType(plainTextUrl) };
  }
  return null;
};

const normalizeDroppedPromptText = (transfer: DataTransfer): string | null => {
  const promptText = (
    transfer.getData("text/prompt") ||
    transfer.getData("text/plain") ||
    transfer.getData("text")
  ).trim();
  if (!promptText) return null;
  if (/^data:(image|video|audio)\//i.test(promptText)) return null;
  if (
    DROPPED_IMAGE_URL_PATTERN.test(promptText) ||
    DROPPED_AUDIO_URL_PATTERN.test(promptText) ||
    DROPPED_VIDEO_URL_PATTERN.test(promptText)
  ) {
    return null;
  }
  return promptText;
};

const MEDIA_LIBRARY_DRAG_TYPES_LOWERCASE = getMediaLibraryDragTypes().map((type) =>
  type.toLowerCase()
);
const MEDIA_LIBRARY_BULK_DRAG_TYPES_LOWERCASE = getMediaLibraryBulkMediaDragTypes().map((type) =>
  type.toLowerCase()
);

/**
 * Resolves the shell drop highlight mode from a browser transfer.
 */
export const resolveRightColumnDropMode = (
  transfer: DataTransfer | null | undefined
): RightColumnDropMode => {
  if (!transfer) return "none";
  const types = getNormalizedTransferTypes(transfer);
  const fileCount = transfer.files?.length ?? 0;
  const hasFileType = types.includes("files");
  const hasLibraryDragType = MEDIA_LIBRARY_DRAG_TYPES_LOWERCASE.some((type) =>
    types.includes(type)
  );
  const hasBulkLibraryDragType = MEDIA_LIBRARY_BULK_DRAG_TYPES_LOWERCASE.some((type) =>
    types.includes(type)
  );
  const hasMediaUrlHints =
    types.includes("text/reference-url") ||
    types.includes("text/uri-list") ||
    types.includes("application/x-moz-file");
  const hasTextLikeType = types.some(
    (type) =>
      type.includes("text") ||
      type.includes("plain") ||
      type.includes("prompt") ||
      type.includes("utf8")
  );
  if (hasLibraryDragType || hasBulkLibraryDragType) return "media";
  if (hasInternalReferenceDragTypeHints(transfer)) return "none";
  if (fileCount > 0) return "media";
  if (hasMediaUrlHints) return "media";
  if (hasTextLikeType) return "text";
  if (types.length === 0 && fileCount === 0) return "text";
  // Some browsers report "Files" for custom text drags while exposing zero files.
  // Treat that as droppable so the right column stays pre-warmed.
  if (hasFileType && fileCount === 0) return "text";
  return "none";
};

/**
 * Resolves the concrete drop payload for shell capture handlers.
 */
export const resolveRightColumnDropPayload = (transfer: DataTransfer): RightColumnDropPayload => {
  const snapshot = captureAiStudioDropSnapshot(transfer);
  const resolvedTransfer = buildAiStudioDropSnapshotTransfer(snapshot);

  const bulkMediaLibraryDragPayload = readMediaLibraryBulkMediaDragPayload(resolvedTransfer);
  if (bulkMediaLibraryDragPayload) {
    return { kind: "bulkLibraryMedia", payloads: bulkMediaLibraryDragPayload.payload.items };
  }
  const mediaLibraryDragPayload = readMediaLibraryDragPayload(resolvedTransfer);
  if (mediaLibraryDragPayload?.kind === "libraryMedia") {
    return { kind: "libraryMedia", payload: mediaLibraryDragPayload.payload };
  }
  if (mediaLibraryDragPayload?.kind === "libraryPrompt") {
    return { kind: "libraryPrompt", payload: mediaLibraryDragPayload.payload };
  }
  if (hasInternalReferenceDragTypeHints(resolvedTransfer)) return { kind: "internal" };
  const droppedMedia = getDroppedMediaReference(resolvedTransfer);
  if (droppedMedia) {
    return { kind: "media", reference: droppedMedia };
  }
  const droppedFiles = resolvedTransfer.files;
  if (droppedFiles && droppedFiles.length > 0) {
    return { kind: "files", files: droppedFiles };
  }
  const droppedPromptText = normalizeDroppedPromptText(resolvedTransfer);
  if (droppedPromptText) {
    return { kind: "text", text: droppedPromptText };
  }
  return { kind: "none" };
};
