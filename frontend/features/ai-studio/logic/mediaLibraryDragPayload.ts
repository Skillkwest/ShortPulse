/**
 * Media Library drag payload serialization/parsing helpers.
 * Supports custom MIME payloads plus text/* fallback markers for degraded browser transfers.
 */
import type { ReferenceIngestionInput } from "../reference-ingestion/types";

const MEDIA_LIBRARY_DRAG_TYPE = "application/x-shortpulse-media-library-item";
const MEDIA_LIBRARY_DRAG_TEXT_TYPE = "text/x-shortpulse-media-library-item";
const MEDIA_LIBRARY_FALLBACK_MARKER_TYPE = "text/shortpulse-media-library-marker";
const MEDIA_LIBRARY_FALLBACK_KIND_TYPE = "text/shortpulse-media-library-kind";
const MEDIA_LIBRARY_FALLBACK_ID_TYPE = "text/shortpulse-media-library-id";
const MEDIA_LIBRARY_FALLBACK_URL_TYPE = "text/shortpulse-media-library-url";
const MEDIA_LIBRARY_FALLBACK_FILE_TYPE_TYPE = "text/shortpulse-media-library-file-type";
const MEDIA_LIBRARY_FALLBACK_ORIGIN_FOLDER_ID_TYPE =
  "text/shortpulse-media-library-origin-folder-id";
const MEDIA_LIBRARY_FALLBACK_FILENAME_TYPE = "text/shortpulse-media-library-filename";
const MEDIA_LIBRARY_FALLBACK_SOURCE_TYPE = "text/shortpulse-media-library-source";
const MEDIA_LIBRARY_FALLBACK_PREVIEW_STORAGE_PATH_TYPE =
  "text/shortpulse-media-library-preview-storage-path";
const MEDIA_LIBRARY_FALLBACK_FULL_STORAGE_PATH_TYPE =
  "text/shortpulse-media-library-full-storage-path";
const MEDIA_LIBRARY_FALLBACK_PREVIEW_URL_TYPE = "text/shortpulse-media-library-preview-url";
const MEDIA_LIBRARY_FALLBACK_FULL_URL_TYPE = "text/shortpulse-media-library-full-url";
const MEDIA_LIBRARY_FALLBACK_WIDTH_TYPE = "text/shortpulse-media-library-width";
const MEDIA_LIBRARY_FALLBACK_HEIGHT_TYPE = "text/shortpulse-media-library-height";
const MEDIA_LIBRARY_FALLBACK_PROMPT_TEXT_TYPE = "text/shortpulse-media-library-prompt";
const MEDIA_LIBRARY_FALLBACK_TITLE_TYPE = "text/shortpulse-media-library-title";
const MEDIA_LIBRARY_FALLBACK_MARKER_VALUE = "shortpulse-media-library-v1";
const URLISH_TEXT_PATTERN = /^(?:data:(?:image|video)\/|blob:|https?:\/\/)/i;
const VIDEO_URL_PATTERN = /\.(m4v|mov|mp4|ogg|ogv|webm)(?:[?#].*)?$/i;

type LibraryMediaPayload = Extract<ReferenceIngestionInput, { kind: "libraryMedia" }>;
type LibraryPromptPayload = Extract<ReferenceIngestionInput, { kind: "libraryPrompt" }>;

export type MediaLibraryDragPayload = LibraryMediaPayload | LibraryPromptPayload;

const MEDIA_LIBRARY_FALLBACK_TRANSFER_HINT_TYPES = [
  MEDIA_LIBRARY_FALLBACK_MARKER_TYPE,
  MEDIA_LIBRARY_FALLBACK_KIND_TYPE,
  MEDIA_LIBRARY_FALLBACK_ID_TYPE,
] as const;

const normalizeTransferText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const safeTransferSetData = (
  transfer: Pick<DataTransfer, "setData">,
  type: string,
  value: string
): boolean => {
  try {
    transfer.setData(type, value);
    return true;
  } catch {
    return false;
  }
};

const hasTransferType = (
  transfer: Pick<DataTransfer, "types"> | null | undefined,
  type: string
): boolean => {
  const rawTypes = transfer?.types as unknown;
  if (!rawTypes) return false;
  const typed = rawTypes as { contains?: (value: string) => boolean };
  if (typeof typed.contains === "function") {
    return typed.contains(type);
  }
  return Array.from(rawTypes as ArrayLike<string>).includes(type);
};

const normalizePositiveNumber = (value: string | null | undefined): number | undefined => {
  if (typeof value !== "string") return undefined;
  const parsed = Number.parseFloat(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
};

const getFirstUriListValue = (value: string): string | null =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.length > 0 && !item.startsWith("#")) ?? null;

const inferLibraryMediaFileType = (url: string | null): "image" | "video" => {
  if (!url) return "image";
  if (/^data:video\//i.test(url) || VIDEO_URL_PATTERN.test(url)) return "video";
  return "image";
};

const resolveFallbackMediaUrl = (transfer: Pick<DataTransfer, "getData">): string | null => {
  const explicitUrl = normalizeTransferText(transfer.getData(MEDIA_LIBRARY_FALLBACK_URL_TYPE));
  if (explicitUrl) return explicitUrl;
  const referenceUrl = normalizeTransferText(transfer.getData("text/reference-url"));
  if (referenceUrl) return referenceUrl;
  const uriList = getFirstUriListValue(transfer.getData("text/uri-list"));
  if (uriList) return uriList;
  const plainText = normalizeTransferText(transfer.getData("text/plain"));
  if (plainText && URLISH_TEXT_PATTERN.test(plainText)) return plainText;
  return null;
};

const parseDragPayload = (value: string): MediaLibraryDragPayload | null => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const row = parsed as { kind?: unknown; source?: unknown; payload?: unknown };
    if (row.source !== "mediaLibrary") return null;
    if (row.kind === "libraryMedia" || row.kind === "libraryPrompt") {
      return row as MediaLibraryDragPayload;
    }
    return null;
  } catch {
    return null;
  }
};

const readFallbackMediaLibraryDragPayload = (
  transfer: Pick<DataTransfer, "getData">
): MediaLibraryDragPayload | null => {
  const marker = normalizeTransferText(transfer.getData(MEDIA_LIBRARY_FALLBACK_MARKER_TYPE));
  if (marker !== MEDIA_LIBRARY_FALLBACK_MARKER_VALUE) return null;
  const kind = normalizeTransferText(transfer.getData(MEDIA_LIBRARY_FALLBACK_KIND_TYPE));
  const id = normalizeTransferText(transfer.getData(MEDIA_LIBRARY_FALLBACK_ID_TYPE));
  if (!kind || !id) return null;

  if (kind === "libraryMedia") {
    const url = resolveFallbackMediaUrl(transfer);
    if (!url) return null;
    const fileTypeRaw = normalizeTransferText(
      transfer.getData(MEDIA_LIBRARY_FALLBACK_FILE_TYPE_TYPE)
    );
    const fileType: "image" | "video" =
      fileTypeRaw === "image" || fileTypeRaw === "video"
        ? fileTypeRaw
        : inferLibraryMediaFileType(url);
    return {
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id,
        url,
        fileType,
        originFolderId: normalizeTransferText(
          transfer.getData(MEDIA_LIBRARY_FALLBACK_ORIGIN_FOLDER_ID_TYPE)
        ),
        filename: normalizeTransferText(transfer.getData(MEDIA_LIBRARY_FALLBACK_FILENAME_TYPE)),
        promptText:
          normalizeTransferText(transfer.getData(MEDIA_LIBRARY_FALLBACK_PROMPT_TEXT_TYPE)) ??
          normalizeTransferText(transfer.getData("text/prompt")),
        source: normalizeTransferText(transfer.getData(MEDIA_LIBRARY_FALLBACK_SOURCE_TYPE)),
        previewStoragePath: normalizeTransferText(
          transfer.getData(MEDIA_LIBRARY_FALLBACK_PREVIEW_STORAGE_PATH_TYPE)
        ),
        fullStoragePath: normalizeTransferText(
          transfer.getData(MEDIA_LIBRARY_FALLBACK_FULL_STORAGE_PATH_TYPE)
        ),
        previewUrl: normalizeTransferText(
          transfer.getData(MEDIA_LIBRARY_FALLBACK_PREVIEW_URL_TYPE)
        ),
        fullUrl: normalizeTransferText(transfer.getData(MEDIA_LIBRARY_FALLBACK_FULL_URL_TYPE)),
        width: normalizePositiveNumber(transfer.getData(MEDIA_LIBRARY_FALLBACK_WIDTH_TYPE)),
        height: normalizePositiveNumber(transfer.getData(MEDIA_LIBRARY_FALLBACK_HEIGHT_TYPE)),
      },
    };
  }

  if (kind === "libraryPrompt") {
    const promptText =
      normalizeTransferText(transfer.getData(MEDIA_LIBRARY_FALLBACK_PROMPT_TEXT_TYPE)) ??
      normalizeTransferText(transfer.getData("text/prompt")) ??
      normalizeTransferText(transfer.getData("text/plain"));
    if (!promptText) return null;
    return {
      kind: "libraryPrompt",
      source: "mediaLibrary",
      payload: {
        id,
        promptText,
        originFolderId: normalizeTransferText(
          transfer.getData(MEDIA_LIBRARY_FALLBACK_ORIGIN_FOLDER_ID_TYPE)
        ),
        title: normalizeTransferText(transfer.getData(MEDIA_LIBRARY_FALLBACK_TITLE_TYPE)),
      },
    };
  }

  return null;
};

/**
 * Reads a serialized media-library drag payload from a transfer object.
 */
export const readMediaLibraryDragPayload = (
  transfer: Pick<DataTransfer, "getData"> | null | undefined
): MediaLibraryDragPayload | null => {
  if (!transfer) return null;
  const primary = transfer.getData(MEDIA_LIBRARY_DRAG_TYPE);
  const fallback = transfer.getData(MEDIA_LIBRARY_DRAG_TEXT_TYPE);
  const parsed = parseDragPayload(primary || fallback);
  if (parsed) return parsed;
  return readFallbackMediaLibraryDragPayload(transfer);
};

/**
 * Returns whether a transfer advertises media-library drag payload types without reading payload data.
 */
export const hasMediaLibraryDragTypeHints = (
  transfer: Pick<DataTransfer, "types"> | null | undefined
): boolean =>
  getMediaLibraryDragTypes().some((type) => hasTransferType(transfer, type)) ||
  MEDIA_LIBRARY_FALLBACK_TRANSFER_HINT_TYPES.some((type) => hasTransferType(transfer, type));

const setTransferTextIfPresent = (
  transfer: Pick<DataTransfer, "setData">,
  type: string,
  value: string | null | undefined
) => {
  if (!value) return;
  const trimmed = value.trim();
  if (!trimmed.length) return;
  safeTransferSetData(transfer, type, trimmed);
};

const setTransferNumberIfPresent = (
  transfer: Pick<DataTransfer, "setData">,
  type: string,
  value: number | null | undefined
) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return;
  safeTransferSetData(transfer, type, String(value));
};

/**
 * Writes a media-library drag payload to a transfer object.
 */
export const writeMediaLibraryDragPayload = (
  transfer: Pick<DataTransfer, "setData">,
  payload: MediaLibraryDragPayload
): void => {
  const serialized = JSON.stringify(payload);
  // Write resilient text/* fallback fields first so folder-drop operations still work
  // on browsers that reject custom or non-text transfer MIME types.
  safeTransferSetData(
    transfer,
    MEDIA_LIBRARY_FALLBACK_MARKER_TYPE,
    MEDIA_LIBRARY_FALLBACK_MARKER_VALUE
  );
  safeTransferSetData(transfer, MEDIA_LIBRARY_FALLBACK_KIND_TYPE, payload.kind);
  setTransferTextIfPresent(transfer, MEDIA_LIBRARY_FALLBACK_ID_TYPE, payload.payload.id);
  safeTransferSetData(transfer, MEDIA_LIBRARY_DRAG_TEXT_TYPE, serialized);
  safeTransferSetData(transfer, MEDIA_LIBRARY_DRAG_TYPE, serialized);
  if (payload.kind === "libraryMedia") {
    safeTransferSetData(transfer, MEDIA_LIBRARY_FALLBACK_FILE_TYPE_TYPE, payload.payload.fileType);
    setTransferTextIfPresent(transfer, MEDIA_LIBRARY_FALLBACK_URL_TYPE, payload.payload.url);
    setTransferTextIfPresent(
      transfer,
      MEDIA_LIBRARY_FALLBACK_ORIGIN_FOLDER_ID_TYPE,
      payload.payload.originFolderId
    );
    setTransferTextIfPresent(
      transfer,
      MEDIA_LIBRARY_FALLBACK_FILENAME_TYPE,
      payload.payload.filename
    );
    setTransferTextIfPresent(
      transfer,
      MEDIA_LIBRARY_FALLBACK_PROMPT_TEXT_TYPE,
      payload.payload.promptText
    );
    setTransferTextIfPresent(transfer, MEDIA_LIBRARY_FALLBACK_SOURCE_TYPE, payload.payload.source);
    setTransferTextIfPresent(
      transfer,
      MEDIA_LIBRARY_FALLBACK_PREVIEW_STORAGE_PATH_TYPE,
      payload.payload.previewStoragePath
    );
    setTransferTextIfPresent(
      transfer,
      MEDIA_LIBRARY_FALLBACK_FULL_STORAGE_PATH_TYPE,
      payload.payload.fullStoragePath
    );
    setTransferTextIfPresent(
      transfer,
      MEDIA_LIBRARY_FALLBACK_PREVIEW_URL_TYPE,
      payload.payload.previewUrl
    );
    setTransferTextIfPresent(
      transfer,
      MEDIA_LIBRARY_FALLBACK_FULL_URL_TYPE,
      payload.payload.fullUrl
    );
    setTransferNumberIfPresent(transfer, MEDIA_LIBRARY_FALLBACK_WIDTH_TYPE, payload.payload.width);
    setTransferNumberIfPresent(
      transfer,
      MEDIA_LIBRARY_FALLBACK_HEIGHT_TYPE,
      payload.payload.height
    );
  } else {
    setTransferTextIfPresent(
      transfer,
      MEDIA_LIBRARY_FALLBACK_ORIGIN_FOLDER_ID_TYPE,
      payload.payload.originFolderId
    );
    setTransferTextIfPresent(
      transfer,
      MEDIA_LIBRARY_FALLBACK_PROMPT_TEXT_TYPE,
      payload.payload.promptText
    );
    setTransferTextIfPresent(transfer, MEDIA_LIBRARY_FALLBACK_TITLE_TYPE, payload.payload.title);
  }
};

/**
 * Returns transfer types used by media-library payload drags.
 */
export const getMediaLibraryDragTypes = (): readonly string[] => [
  MEDIA_LIBRARY_DRAG_TYPE,
  MEDIA_LIBRARY_DRAG_TEXT_TYPE,
  MEDIA_LIBRARY_FALLBACK_MARKER_TYPE,
];
