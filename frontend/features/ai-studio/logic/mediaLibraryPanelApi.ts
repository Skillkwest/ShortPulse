import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { maybeTranscodeLocalImageBlobForUpload } from "../../../lib/adaptive-media";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
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
  itemCount?: number;
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
  target?: Partial<PreparedMediaUploadTarget>;
  error?: string;
  details?: string;
};

type PreparedMediaUploadTarget = {
  storagePath: string;
  uploadToken: string;
  mimeType: string;
  name: string;
};

type MediaLibraryHttpRequestError = Error & {
  code: "MEDIA_LIBRARY_HTTP_ERROR";
  status: number;
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

const createMediaLibraryHttpRequestError = (
  message: string,
  status: number
): MediaLibraryHttpRequestError => {
  const error = new Error(message) as MediaLibraryHttpRequestError;
  error.code = "MEDIA_LIBRARY_HTTP_ERROR";
  error.status = Math.trunc(status);
  return error;
};

const readResponseErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = asRecord(await response.clone().json());
    const error = asString(payload.error);
    if (error) return error;
    const message = asString(payload.message);
    if (message) return message;
  } catch {
    // Fall through to text response read.
  }
  try {
    const text = (await response.clone().text()).trim();
    return text || fallback;
  } catch {
    return fallback;
  }
};

const IMAGE_UPLOAD_MAX_MB = 25;
const VIDEO_UPLOAD_MAX_MB = 100;
const AUDIO_UPLOAD_MAX_MB = 100;

const isImageFile = (file: File): boolean => file.type.trim().toLowerCase().startsWith("image/");

const normalizeUploadFileForApi = async (file: File): Promise<File> => {
  if (!isImageFile(file)) return file;
  const transcodedBlob = await maybeTranscodeLocalImageBlobForUpload(file);
  if (transcodedBlob === file) return file;
  return new File([transcodedBlob], file.name, {
    type: transcodedBlob.type || file.type,
    lastModified: file.lastModified,
  });
};

const resolveUploadTooLargeMessage = (file: File): string => {
  const normalizedType = file.type.trim().toLowerCase();
  if (normalizedType.startsWith("image/")) {
    return `Image file is too large. ShortPulse accepts images up to ${IMAGE_UPLOAD_MAX_MB} MB.`;
  }
  if (normalizedType.startsWith("video/")) {
    return `Video file is too large. ShortPulse accepts videos up to ${VIDEO_UPLOAD_MAX_MB} MB.`;
  }
  if (normalizedType.startsWith("audio/")) {
    return `Audio file is too large. ShortPulse accepts audio files up to ${AUDIO_UPLOAD_MAX_MB} MB.`;
  }
  return "Selected file is too large for upload.";
};

const readUploadErrorResponse = async (
  response: Response
): Promise<{
  payload: MediaUploadResponse | null;
  rawText: string;
}> => {
  const rawText = await response.text().catch(() => "");
  if (!rawText.trim()) {
    return {
      payload: null,
      rawText: "",
    };
  }
  try {
    return {
      payload: JSON.parse(rawText) as MediaUploadResponse,
      rawText,
    };
  } catch {
    return {
      payload: null,
      rawText,
    };
  }
};

const resolveUploadErrorMessage = ({
  response,
  file,
  payload,
  rawText,
}: {
  response: Response;
  file: File;
  payload: MediaUploadResponse | null;
  rawText: string;
}): string => {
  const details = asString(payload?.details);
  if (details) return details;
  const error = asString(payload?.error);
  if (error) return error;
  if (response.status === 413) {
    return resolveUploadTooLargeMessage(file);
  }
  const trimmedRawText = rawText.trim();
  if (trimmedRawText && !trimmedRawText.startsWith("<")) {
    return trimmedRawText;
  }
  return "Unable to upload media.";
};

const toNonNegativeInteger = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
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

const toPreparedMediaUploadTarget = (value: unknown): PreparedMediaUploadTarget | null => {
  const target = asRecord(value);
  const storagePath = asString(target.storagePath);
  const uploadToken = asString(target.uploadToken);
  const mimeType = asString(target.mimeType);
  const name = asString(target.name);
  if (!storagePath || !uploadToken || !mimeType || !name) return null;
  return {
    storagePath,
    uploadToken,
    mimeType,
    name,
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

const resolveProjectFolderApiPath = (
  _projectId: string | null | undefined,
  suffix: string
): string => {
  void _projectId;
  return `/api/media/folders/${suffix}`;
};

const toMediaFolderFromPayload = (value: unknown, fallback: string): MediaFolder => {
  const folder = asRecord(value);
  const id = asString(folder.id);
  const name = asString(folder.name);
  if (!id || !name) {
    throw new Error(fallback);
  }
  return {
    id,
    name,
    parentFolderId: folder.parentFolderId == null ? null : asString(folder.parentFolderId) || null,
    createdAt: asString(folder.createdAt),
    updatedAt: asString(folder.updatedAt),
    itemCount: toNonNegativeInteger(folder.itemCount),
  };
};

/**
 * Loads user-owned custom folders.
 */
export const listMediaFolders = async (projectId?: string | null): Promise<MediaFolder[]> => {
  const response = await withTransientNetworkRetry(
    async () =>
      await fetchWithAuth(resolveProjectFolderApiPath(projectId, "list"), {
        method: "GET",
        shortpulseLogScope: "app",
      })
  );
  if (!response.ok) {
    throw createMediaLibraryHttpRequestError(
      await readResponseErrorMessage(response, "Unable to load media folders."),
      response.status
    );
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
        itemCount: toNonNegativeInteger(row.itemCount),
      } as MediaFolder;
    })
    .filter((row): row is MediaFolder => Boolean(row));
};

/**
 * Creates a folder.
 */
export const createMediaFolder = async (
  name: string,
  parentFolderId: string | null = null,
  projectId?: string | null
): Promise<MediaFolder> => {
  const response = await fetchWithAuth(resolveProjectFolderApiPath(projectId, "create"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, parentFolderId }),
    shortpulseLogScope: "app",
  });
  if (!response.ok) {
    throw createMediaLibraryHttpRequestError(
      await readResponseErrorMessage(response, "Unable to create folder."),
      response.status
    );
  }
  const payload = asRecord(await response.json().catch(() => ({})));
  return toMediaFolderFromPayload(payload.folder, "Unable to create folder.");
};

/**
 * Renames a folder.
 */
export const renameMediaFolder = async ({
  folderId,
  name,
  projectId,
}: {
  folderId: string;
  name: string;
  projectId?: string | null;
}): Promise<MediaFolder> => {
  const response = await withTransientNetworkRetry(
    async () =>
      await fetchWithAuth(resolveProjectFolderApiPath(projectId, "rename"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folderId, name }),
        shortpulseLogScope: "app",
      })
  );
  if (!response.ok) {
    throw createMediaLibraryHttpRequestError(
      await readResponseErrorMessage(response, "Unable to rename folder."),
      response.status
    );
  }
  const payload = asRecord(await response.json().catch(() => ({})));
  return toMediaFolderFromPayload(payload.folder, "Unable to rename folder.");
};

/**
 * Moves a folder to a new parent.
 */
export const moveMediaFolder = async ({
  folderId,
  parentFolderId,
  projectId,
}: {
  folderId: string;
  parentFolderId: string | null;
  projectId?: string | null;
}): Promise<MediaFolder> => {
  const response = await withTransientNetworkRetry(
    async () =>
      await fetchWithAuth(resolveProjectFolderApiPath(projectId, "move"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folderId, parentFolderId }),
        shortpulseLogScope: "app",
      })
  );
  if (!response.ok) {
    throw createMediaLibraryHttpRequestError(
      await readResponseErrorMessage(response, "Unable to move folder."),
      response.status
    );
  }
  const payload = asRecord(await response.json().catch(() => ({})));
  return toMediaFolderFromPayload(payload.folder, "Unable to move folder.");
};

/**
 * Deletes a folder.
 */
export const deleteMediaFolder = async (
  folderId: string,
  projectId?: string | null
): Promise<void> => {
  const response = await fetchWithAuth(resolveProjectFolderApiPath(projectId, "delete"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ folderId }),
    shortpulseLogScope: "app",
  });
  if (!response.ok) {
    throw createMediaLibraryHttpRequestError(
      await readResponseErrorMessage(response, "Unable to delete folder."),
      response.status
    );
  }
};

/**
 * Applies assign/unassign membership operations for media/prompt ids.
 */
export const applyMediaFolderMembershipBatch = async (
  input: MediaFolderMembershipBatch,
  projectId?: string | null
): Promise<MediaFolderMembershipBatchResult> => {
  const response = await withTransientNetworkRetry(
    async () =>
      await fetchWithAuth(resolveProjectFolderApiPath(projectId, "membership-batch"), {
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
  projectId,
  query,
  cursor,
  limit,
}: {
  folderId: MediaFolderId;
  projectId?: string | null;
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
          projectId:
            typeof projectId === "string" && projectId.trim() ? projectId.trim() : undefined,
          query,
          cursor,
          limit,
        }),
        shortpulseLogScope: "app",
      })
  );
  if (!response.ok) {
    throw createMediaLibraryHttpRequestError(
      await readResponseErrorMessage(response, "Unable to load prompts."),
      response.status
    );
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
 * Uploads one file via the server-authoritative Media Library API.
 */
export const uploadMediaFile = async ({
  file,
  destinationTab,
}: {
  file: File;
  destinationTab: MediaUploadDestinationTab;
}): Promise<MediaUploadRow> => {
  const normalizedFile = await normalizeUploadFileForApi(file);
  const prepareResponse = await fetchWithAuth("/api/media/prepare-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      destinationTab,
      sourceMimeType: normalizedFile.type,
      sourceName: normalizedFile.name,
    }),
    shortpulseLogScope: "app",
  });
  const { payload: preparePayload, rawText: prepareRawText } =
    await readUploadErrorResponse(prepareResponse);
  if (!prepareResponse.ok) {
    throw new Error(
      resolveUploadErrorMessage({
        response: prepareResponse,
        file: normalizedFile,
        payload: preparePayload,
        rawText: prepareRawText,
      })
    );
  }
  const preparedTarget = toPreparedMediaUploadTarget(preparePayload?.target);
  if (!preparedTarget) {
    throw new Error("Upload preparation returned an invalid target.");
  }

  const supabase = ensureSupabaseQueryClient();
  const uploadResult = await supabase.storage
    .from("media_library")
    .uploadToSignedUrl(preparedTarget.storagePath, preparedTarget.uploadToken, normalizedFile, {
      contentType: preparedTarget.mimeType,
      upsert: false,
    });
  if (uploadResult.error) {
    throw new Error(uploadResult.error.message || "Unable to upload media.");
  }

  const finalizeResponse = await fetchWithAuth("/api/media/finalize-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      destinationTab,
      sourceMimeType: preparedTarget.mimeType,
      sourceName: preparedTarget.name,
      sourceStoragePath: preparedTarget.storagePath,
    }),
    shortpulseLogScope: "app",
  });
  const { payload, rawText } = await readUploadErrorResponse(finalizeResponse);
  if (!finalizeResponse.ok) {
    throw new Error(
      resolveUploadErrorMessage({
        response: finalizeResponse,
        file: normalizedFile,
        payload,
        rawText,
      })
    );
  }

  const row = toMediaUploadRow(payload?.file);
  if (!row) {
    throw new Error("Upload API returned an invalid media payload.");
  }
  return row;
};
