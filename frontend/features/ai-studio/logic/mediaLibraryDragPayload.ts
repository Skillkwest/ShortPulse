import type { ReferenceIngestionInput } from "../reference-ingestion/types";

const MEDIA_LIBRARY_DRAG_TYPE = "application/x-shortpulse-media-library-item";
const MEDIA_LIBRARY_DRAG_TEXT_TYPE = "text/x-shortpulse-media-library-item";

type LibraryMediaPayload = Extract<ReferenceIngestionInput, { kind: "libraryMedia" }>;
type LibraryPromptPayload = Extract<ReferenceIngestionInput, { kind: "libraryPrompt" }>;

export type MediaLibraryDragPayload = LibraryMediaPayload | LibraryPromptPayload;

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

/**
 * Reads a serialized media-library drag payload from a transfer object.
 */
export const readMediaLibraryDragPayload = (
  transfer: Pick<DataTransfer, "getData"> | null | undefined
): MediaLibraryDragPayload | null => {
  if (!transfer) return null;
  const primary = transfer.getData(MEDIA_LIBRARY_DRAG_TYPE);
  const fallback = transfer.getData(MEDIA_LIBRARY_DRAG_TEXT_TYPE);
  return parseDragPayload(primary || fallback);
};

/**
 * Writes a media-library drag payload to a transfer object.
 */
export const writeMediaLibraryDragPayload = (
  transfer: Pick<DataTransfer, "setData">,
  payload: MediaLibraryDragPayload
): void => {
  const serialized = JSON.stringify(payload);
  transfer.setData(MEDIA_LIBRARY_DRAG_TYPE, serialized);
  transfer.setData(MEDIA_LIBRARY_DRAG_TEXT_TYPE, serialized);
};

/**
 * Returns transfer types used by media-library payload drags.
 */
export const getMediaLibraryDragTypes = (): readonly string[] => [
  MEDIA_LIBRARY_DRAG_TYPE,
  MEDIA_LIBRARY_DRAG_TEXT_TYPE,
];
