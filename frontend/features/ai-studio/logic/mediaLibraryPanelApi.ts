import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { MediaListCursor } from "../../media-library/logic/mediaListApi";
import { isTransientMediaLibraryNetworkError } from "./mediaLibraryErrorText";

export const MEDIA_LIBRARY_ROOT_FOLDER_ID = "all_items" as const;

export type MediaFolderId = typeof MEDIA_LIBRARY_ROOT_FOLDER_ID | string;

export type MediaFolder = {
  id: string;
  name: string;
  parentFolderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FolderMembershipBatchAction = "assign" | "unassign" | "move";

export type MediaFolderMembershipBatch = {
  action: FolderMembershipBatchAction;
  folderId?: string;
  sourceFolderId?: string;
  targetFolderId?: string;
  mediaIds?: string[];
  promptIds?: string[];
};

export type MediaFolderMembershipBatchResult = {
  action: FolderMembershipBatchAction;
  folderId: string | null;
  sourceFolderId: string | null;
  targetFolderId: string | null;
  mediaAssigned: number;
  mediaUnassigned: number;
  promptsAssigned: number;
  promptsUnassigned: number;
  mediaDuplicates: number;
  promptDuplicates: number;
  mediaSkipped: number;
  promptSkipped: number;
};

export type PromptListCursor = {
  createdAt: string;
  id: string;
};

export type PromptListRow = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode: string | null;
  source: string | null;
  created_at: string;
  updated_at: string | null;
};

export type PromptListPageResult = {
  rows: PromptListRow[];
  nextCursor: PromptListCursor | null;
  hasMore: boolean;
};

export type MediaUploadDestinationTab = "uploaded_images" | "uploaded_videos" | "private";

export type MediaUploadRow = {
  id: string;
  filename: string;
  storage_path: string;
  preview_storage_path: string;
  file_type: string;
  file_size: number | null;
  source: string | null;
  created_at: string;
  signedUrl: string;
};

type MediaUploadResponse = {
  file?: Partial<MediaUploadRow>;
  error?: string;
  details?: string;
};

export type MediaFolderCanvasState = {
  folderId: string;
  schemaVersion: number;
  snapshot: Record<string, unknown>;
  saveSeq: number;
  createdAt: string;
  updatedAt: string;
};

const TRANSIENT_NETWORK_RETRY_ATTEMPTS = 2;
const TRANSIENT_NETWORK_RETRY_BASE_DELAY_MS = 180;

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const asString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const toCursor = (value: unknown): MediaListCursor | null => {
  const record = asRecord(value);
  const createdAt = asString(record.createdAt);
  const id = asString(record.id);
  if (!createdAt || !id) return null;
  return { createdAt, id };
};

const toPromptRow = (value: unknown): PromptListRow | null => {
  const row = asRecord(value);
  const id = asString(row.id);
  const promptText = asString(row.prompt_text);
  const createdAt = asString(row.created_at);
  if (!id || !promptText || !createdAt) return null;
  return {
    id,
    title: typeof row.title === "string" ? row.title : null,
    prompt_text: promptText,
    mode: typeof row.mode === "string" ? row.mode : null,
    source: typeof row.source === "string" ? row.source : null,
    created_at: createdAt,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
};

const toMediaUploadRow = (value: unknown): MediaUploadRow | null => {
  const row = asRecord(value);
  const id = asString(row.id);
  const filename = asString(row.filename);
  const storagePath = asString(row.storage_path);
  const previewStoragePath = asString(row.preview_storage_path) || storagePath;
  const fileType = asString(row.file_type);
  const createdAt = asString(row.created_at);
  const signedUrl = asString(row.signedUrl);
  if (
    !id ||
    !filename ||
    !storagePath ||
    !previewStoragePath ||
    !fileType ||
    !createdAt ||
    !signedUrl
  ) {
    return null;
  }
  const rawFileSize = Number(row.file_size);
  return {
    id,
    filename,
    storage_path: storagePath,
    preview_storage_path: previewStoragePath,
    file_type: fileType,
    file_size: Number.isFinite(rawFileSize) ? Math.max(0, Math.trunc(rawFileSize)) : null,
    source: asString(row.source) || null,
    created_at: createdAt,
    signedUrl,
  };
};

const sleep = async (ms: number): Promise<void> =>
  await new Promise((resolve) => {
    globalThis.setTimeout(resolve, Math.max(0, Math.trunc(ms)));
  });

const withTransientNetworkRetry = async <T>(
  operation: () => Promise<T>,
  attempts = TRANSIENT_NETWORK_RETRY_ATTEMPTS
): Promise<T> => {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const hasRemainingAttempts = attempt < attempts;
      if (!hasRemainingAttempts || !isTransientMediaLibraryNetworkError(error)) {
        throw error;
      }
      await sleep(TRANSIENT_NETWORK_RETRY_BASE_DELAY_MS * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unexpected Media Library retry error.");
};

/**
 * Loads user-owned custom folders.
 */
export const listMediaFolders = async (): Promise<MediaFolder[]> => {
  const response = await withTransientNetworkRetry(
    async () =>
      await fetchWithAuth("/api/media/folders/list", {
        method: "GET",
        shortpulseLogScope: "app",
      })
  );
  if (!response.ok) {
    throw new Error("Unable to load media folders.");
  }
  const payload = asRecord(await response.json().catch(() => ({})));
  const rows = Array.isArray(payload.folders) ? payload.folders : [];
  return rows
    .map((raw) => {
      const row = asRecord(raw);
      const id = asString(row.id);
      const name = asString(row.name);
      const parentFolderId =
        row.parentFolderId == null ? null : asString(row.parentFolderId) || null;
      const createdAt = asString(row.createdAt);
      const updatedAt = asString(row.updatedAt);
      if (!id || !name) return null;
      return {
        id,
        name,
        parentFolderId,
        createdAt,
        updatedAt,
      } as MediaFolder;
    })
    .filter((row): row is MediaFolder => Boolean(row));
};

/**
 * Creates a folder.
 */
export const createMediaFolder = async (
  name: string,
  parentFolderId: string | null = null
): Promise<MediaFolder> => {
  const response = await fetchWithAuth("/api/media/folders/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, parentFolderId }),
    shortpulseLogScope: "app",
  });
  if (!response.ok) {
    const payload = asRecord(await response.json().catch(() => ({})));
    throw new Error(asString(payload.error) || "Unable to create folder.");
  }
  const payload = asRecord(await response.json().catch(() => ({})));
  const folder = asRecord(payload.folder);
  const id = asString(folder.id);
  const folderName = asString(folder.name);
  if (!id || !folderName) {
    throw new Error("Unable to create folder.");
  }
  return {
    id,
    name: folderName,
    parentFolderId: folder.parentFolderId == null ? null : asString(folder.parentFolderId) || null,
    createdAt: asString(folder.createdAt),
    updatedAt: asString(folder.updatedAt),
  };
};

/**
 * Renames a folder.
 */
export const renameMediaFolder = async ({
  folderId,
  name,
}: {
  folderId: string;
  name: string;
}): Promise<MediaFolder> => {
  const response = await fetchWithAuth("/api/media/folders/rename", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ folderId, name }),
    shortpulseLogScope: "app",
  });
  if (!response.ok) {
    const payload = asRecord(await response.json().catch(() => ({})));
    throw new Error(asString(payload.error) || "Unable to rename folder.");
  }
  const payload = asRecord(await response.json().catch(() => ({})));
  const folder = asRecord(payload.folder);
  const id = asString(folder.id);
  const folderName = asString(folder.name);
  if (!id || !folderName) {
    throw new Error("Unable to rename folder.");
  }
  return {
    id,
    name: folderName,
    parentFolderId: folder.parentFolderId == null ? null : asString(folder.parentFolderId) || null,
    createdAt: asString(folder.createdAt),
    updatedAt: asString(folder.updatedAt),
  };
};

/**
 * Deletes a folder.
 */
export const deleteMediaFolder = async (folderId: string): Promise<void> => {
  const response = await fetchWithAuth("/api/media/folders/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ folderId }),
    shortpulseLogScope: "app",
  });
  if (!response.ok) {
    const payload = asRecord(await response.json().catch(() => ({})));
    throw new Error(asString(payload.error) || "Unable to delete folder.");
  }
};

/**
 * Applies assign/unassign membership operations for media/prompt ids.
 */
export const applyMediaFolderMembershipBatch = async (
  input: MediaFolderMembershipBatch
): Promise<MediaFolderMembershipBatchResult> => {
  const response = await withTransientNetworkRetry(
    async () =>
      await fetchWithAuth("/api/media/folders/membership-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: input.action,
          folderId: input.folderId,
          sourceFolderId: input.sourceFolderId,
          targetFolderId: input.targetFolderId,
          mediaIds: input.mediaIds ?? [],
          promptIds: input.promptIds ?? [],
        }),
        shortpulseLogScope: "app",
      })
  );
  if (!response.ok) {
    const payload = asRecord(await response.json().catch(() => ({})));
    throw new Error(asString(payload.error) || "Unable to update folder membership.");
  }
  const payload = asRecord(await response.json().catch(() => ({})));
  const action = payload.action;
  if (action !== "assign" && action !== "unassign" && action !== "move") {
    throw new Error("Unable to update folder membership.");
  }
  const asCount = (value: unknown): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.trunc(parsed));
  };
  const parseOptionalId = (value: unknown): string | null => {
    const normalized = asString(value);
    return normalized || null;
  };
  return {
    action,
    folderId: parseOptionalId(payload.folderId),
    sourceFolderId: parseOptionalId(payload.sourceFolderId),
    targetFolderId: parseOptionalId(payload.targetFolderId),
    mediaAssigned: asCount(payload.mediaAssigned),
    mediaUnassigned: asCount(payload.mediaUnassigned),
    promptsAssigned: asCount(payload.promptsAssigned),
    promptsUnassigned: asCount(payload.promptsUnassigned),
    mediaDuplicates: asCount(payload.mediaDuplicates),
    promptDuplicates: asCount(payload.promptDuplicates),
    mediaSkipped: asCount(payload.mediaSkipped),
    promptSkipped: asCount(payload.promptSkipped),
  };
};

/**
 * Fetches one prompt page for panel listing.
 */
export const fetchMediaPromptListPage = async ({
  folderId,
  query,
  cursor,
  limit,
}: {
  folderId: MediaFolderId;
  query: string;
  cursor: PromptListCursor | null;
  limit: number;
}): Promise<PromptListPageResult> => {
  const response = await withTransientNetworkRetry(
    async () =>
      await fetchWithAuth("/api/media/prompts/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderId,
          query,
          cursor,
          limit,
        }),
        shortpulseLogScope: "app",
      })
  );
  if (!response.ok) {
    const payload = asRecord(await response.json().catch(() => ({})));
    throw new Error(asString(payload.error) || "Unable to load prompts.");
  }
  const payload = asRecord(await response.json().catch(() => ({})));
  const rows = (Array.isArray(payload.rows) ? payload.rows : [])
    .map((row) => toPromptRow(row))
    .filter((row): row is PromptListRow => Boolean(row));
  return {
    rows,
    nextCursor: toCursor(payload.nextCursor),
    hasMore: payload.hasMore === true,
  };
};

/**
 * Loads one custom-folder canvas state for the panel.
 */
export const getMediaFolderCanvasState = async (
  folderId: string
): Promise<MediaFolderCanvasState | null> => {
  const response = await withTransientNetworkRetry(
    async () =>
      await fetchWithAuth(`/api/ai/media-folder-canvas/${encodeURIComponent(folderId)}`, {
        method: "GET",
        shortpulseLogScope: "app",
      })
  );
  if (!response.ok) {
    const payload = asRecord(await response.json().catch(() => ({})));
    throw new Error(asString(payload.error) || "Unable to load folder canvas state.");
  }
  const payload = asRecord(await response.json().catch(() => ({})));
  const state = asRecord(payload.state);
  const id = asString(state.folderId);
  if (!id) return null;
  const schemaVersion = Number(state.schemaVersion);
  const saveSeq = Number(state.saveSeq);
  const snapshot = asRecord(state.snapshot);
  return {
    folderId: id,
    schemaVersion: Number.isFinite(schemaVersion) ? Math.trunc(schemaVersion) : 1,
    snapshot,
    saveSeq: Number.isFinite(saveSeq) ? Math.max(0, Math.trunc(saveSeq)) : 0,
    createdAt: asString(state.createdAt),
    updatedAt: asString(state.updatedAt),
  };
};

/**
 * Saves one custom-folder canvas state for the panel.
 */
export const saveMediaFolderCanvasState = async ({
  folderId,
  schemaVersion,
  snapshot,
}: {
  folderId: string;
  schemaVersion: number;
  snapshot: Record<string, unknown>;
}): Promise<{ schemaVersion: number; saveSeq: number; updatedAt: string }> => {
  const response = await withTransientNetworkRetry(
    async () =>
      await fetchWithAuth("/api/ai/media-folder-canvas/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderId,
          schemaVersion,
          snapshot,
        }),
        shortpulseLogScope: "app",
      })
  );
  if (!response.ok) {
    const payload = asRecord(await response.json().catch(() => ({})));
    throw new Error(asString(payload.error) || "Unable to save folder canvas state.");
  }
  const payload = asRecord(await response.json().catch(() => ({})));
  const resolvedSchemaVersion = Number(payload.schemaVersion);
  const resolvedSaveSeq = Number(payload.saveSeq);
  return {
    schemaVersion: Number.isFinite(resolvedSchemaVersion) ? Math.trunc(resolvedSchemaVersion) : 1,
    saveSeq: Number.isFinite(resolvedSaveSeq) ? Math.max(0, Math.trunc(resolvedSaveSeq)) : 0,
    updatedAt: asString(payload.updatedAt),
  };
};

/**
 * Uploads one file via the server-authoritative Media Library API.
 */
export const uploadMediaFile = async ({
  file,
  destinationTab,
}: {
  file: File;
  destinationTab: MediaUploadDestinationTab;
}): Promise<MediaUploadRow> => {
  const body = new FormData();
  body.append("file", file);
  body.append("destinationTab", destinationTab);

  const response = await fetchWithAuth("/api/media/upload", {
    method: "POST",
    body,
    shortpulseLogScope: "app",
  });

  const payload = (await response.json().catch(() => null)) as MediaUploadResponse | null;
  if (!response.ok) {
    throw new Error(
      asString(payload?.details) || asString(payload?.error) || "Unable to upload media."
    );
  }

  const row = toMediaUploadRow(payload?.file);
  if (!row) {
    throw new Error("Upload API returned an invalid media payload.");
  }
  return row;
};
