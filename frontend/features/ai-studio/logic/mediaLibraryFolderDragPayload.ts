const MEDIA_LIBRARY_FOLDER_DRAG_TYPE = "application/x-shortpulse-media-library-folder";
const MEDIA_LIBRARY_FOLDER_DRAG_TEXT_TYPE = "text/x-shortpulse-media-library-folder";
const MEDIA_LIBRARY_FOLDER_FALLBACK_MARKER_TYPE = "text/shortpulse-media-library-folder-marker";
const MEDIA_LIBRARY_FOLDER_FALLBACK_ID_TYPE = "text/shortpulse-media-library-folder-id";
const MEDIA_LIBRARY_FOLDER_FALLBACK_PARENT_ID_TYPE =
  "text/shortpulse-media-library-folder-parent-id";
const MEDIA_LIBRARY_FOLDER_FALLBACK_NAME_TYPE = "text/shortpulse-media-library-folder-name";
const MEDIA_LIBRARY_FOLDER_FALLBACK_MARKER_VALUE = "shortpulse-media-library-folder-v1";

export type MediaLibraryFolderDragPayload = {
  source: "mediaLibraryFolder";
  payload: {
    id: string;
    name: string;
    parentFolderId: string | null;
  };
};

const normalizeTransferText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const safeTransferSetData = (
  transfer: Pick<DataTransfer, "setData">,
  type: string,
  value: string
): void => {
  try {
    transfer.setData(type, value);
  } catch {
    // Some browser engines reject specific transfer MIME types; keep drag active.
  }
};

const parseFolderDragPayload = (value: string): MediaLibraryFolderDragPayload | null => {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const row = parsed as {
      source?: unknown;
      payload?: {
        id?: unknown;
        name?: unknown;
        parentFolderId?: unknown;
      };
    };
    if (row.source !== "mediaLibraryFolder") return null;
    const id = normalizeTransferText(typeof row.payload?.id === "string" ? row.payload.id : null);
    const name = normalizeTransferText(
      typeof row.payload?.name === "string" ? row.payload.name : null
    );
    const parentFolderId =
      row.payload?.parentFolderId == null
        ? null
        : normalizeTransferText(
            typeof row.payload.parentFolderId === "string" ? row.payload.parentFolderId : null
          );
    if (!id || !name) return null;
    return {
      source: "mediaLibraryFolder",
      payload: {
        id,
        name,
        parentFolderId,
      },
    };
  } catch {
    return null;
  }
};

export const getMediaLibraryFolderDragTypes = (): string[] => [
  MEDIA_LIBRARY_FOLDER_DRAG_TYPE,
  MEDIA_LIBRARY_FOLDER_DRAG_TEXT_TYPE,
  MEDIA_LIBRARY_FOLDER_FALLBACK_MARKER_TYPE,
  MEDIA_LIBRARY_FOLDER_FALLBACK_ID_TYPE,
];

export const writeMediaLibraryFolderDragPayload = (
  transfer: Pick<DataTransfer, "setData">,
  payload: MediaLibraryFolderDragPayload
): void => {
  const serialized = JSON.stringify(payload);
  safeTransferSetData(
    transfer,
    MEDIA_LIBRARY_FOLDER_FALLBACK_MARKER_TYPE,
    MEDIA_LIBRARY_FOLDER_FALLBACK_MARKER_VALUE
  );
  safeTransferSetData(transfer, MEDIA_LIBRARY_FOLDER_FALLBACK_ID_TYPE, payload.payload.id);
  if (payload.payload.parentFolderId) {
    safeTransferSetData(
      transfer,
      MEDIA_LIBRARY_FOLDER_FALLBACK_PARENT_ID_TYPE,
      payload.payload.parentFolderId
    );
  }
  safeTransferSetData(transfer, MEDIA_LIBRARY_FOLDER_FALLBACK_NAME_TYPE, payload.payload.name);
  safeTransferSetData(transfer, MEDIA_LIBRARY_FOLDER_DRAG_TEXT_TYPE, serialized);
  safeTransferSetData(transfer, MEDIA_LIBRARY_FOLDER_DRAG_TYPE, serialized);
};

export const readMediaLibraryFolderDragPayload = (
  transfer: Pick<DataTransfer, "getData"> | null | undefined
): MediaLibraryFolderDragPayload | null => {
  if (!transfer) return null;
  const rawPayload =
    normalizeTransferText(transfer.getData(MEDIA_LIBRARY_FOLDER_DRAG_TYPE)) ??
    normalizeTransferText(transfer.getData(MEDIA_LIBRARY_FOLDER_DRAG_TEXT_TYPE));
  if (rawPayload) {
    const parsed = parseFolderDragPayload(rawPayload);
    if (parsed) return parsed;
  }
  const marker = normalizeTransferText(transfer.getData(MEDIA_LIBRARY_FOLDER_FALLBACK_MARKER_TYPE));
  if (marker !== MEDIA_LIBRARY_FOLDER_FALLBACK_MARKER_VALUE) return null;
  const id = normalizeTransferText(transfer.getData(MEDIA_LIBRARY_FOLDER_FALLBACK_ID_TYPE));
  const name = normalizeTransferText(transfer.getData(MEDIA_LIBRARY_FOLDER_FALLBACK_NAME_TYPE));
  if (!id || !name) return null;
  return {
    source: "mediaLibraryFolder",
    payload: {
      id,
      name,
      parentFolderId: normalizeTransferText(
        transfer.getData(MEDIA_LIBRARY_FOLDER_FALLBACK_PARENT_ID_TYPE)
      ),
    },
  };
};
