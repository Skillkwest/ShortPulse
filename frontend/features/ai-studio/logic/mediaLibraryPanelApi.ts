import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { MediaListCursor } from "../../media-library/logic/mediaListApi";

export const MEDIA_LIBRARY_ROOT_FOLDER_ID = "all_items" as const;

export type MediaFolderId = typeof MEDIA_LIBRARY_ROOT_FOLDER_ID | string;

export type MediaFolder = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type FolderMembershipBatchAction = "assign" | "unassign";

export type MediaFolderMembershipBatch = {
  folderId: string;
  action: FolderMembershipBatchAction;
  mediaIds?: string[];
  promptIds?: string[];
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

/**
 * Loads user-owned custom folders.
 */
export const listMediaFolders = async (): Promise<MediaFolder[]> => {
  const response = await fetchWithAuth("/api/media/folders/list", {
    method: "GET",
    shortpulseLogScope: "app",
  });
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
      const createdAt = asString(row.createdAt);
      const updatedAt = asString(row.updatedAt);
      if (!id || !name) return null;
      return {
        id,
        name,
        createdAt,
        updatedAt,
      } as MediaFolder;
    })
    .filter((row): row is MediaFolder => Boolean(row));
};

/**
 * Creates a folder.
 */
export const createMediaFolder = async (name: string): Promise<MediaFolder> => {
  const response = await fetchWithAuth("/api/media/folders/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
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
): Promise<void> => {
  const response = await fetchWithAuth("/api/media/folders/membership-batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      folderId: input.folderId,
      action: input.action,
      mediaIds: input.mediaIds ?? [],
      promptIds: input.promptIds ?? [],
    }),
    shortpulseLogScope: "app",
  });
  if (!response.ok) {
    const payload = asRecord(await response.json().catch(() => ({})));
    throw new Error(asString(payload.error) || "Unable to update folder membership.");
  }
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
  const response = await fetchWithAuth("/api/media/prompts/list", {
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
  });
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
