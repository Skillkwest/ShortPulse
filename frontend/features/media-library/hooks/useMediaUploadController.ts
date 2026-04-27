/**
 * Upload pipeline controller for Media Library.
 * Handles drag-drop/file-picker intake, optimistic placeholders, and upload/insert reconciliation.
 */
import {
  useCallback,
  useState,
  type ChangeEvent,
  type Dispatch,
  type DragEvent,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { readSupabaseUserId } from "../../../lib/supabaseClient";
import type { MediaTab } from "../logic/mediaMoveRouting";
import { resolveMediaPreviewStoragePath } from "../logic/mediaPreviewStoragePath";
import {
  PRIVATE_MEDIA_SOURCE,
  fileTypeFromMime,
  type MediaDataTab,
} from "../logic/mediaLibraryPageHelpers";

const MEDIA_UPLOAD_API_ROUTE = "/api/media/upload";

type UploadDestinationTab = "uploaded_images" | "uploaded_videos" | "private";

type UploadMediaRowBase = {
  id: string;
  filename: string;
  storage_path: string;
  preview_storage_path?: string;
  file_type: string;
  file_size: number | null;
  source?: string | null;
  created_at: string;
  signedUrl?: string;
  status?: "uploading" | "ready";
};

type UseMediaUploadControllerArgs<TRow extends UploadMediaRowBase> = {
  activeMediaTab: MediaDataTab | null;
  activeTab: MediaTab;
  currentUserIdRef: MutableRefObject<string | null>;
  getErrorMessage: (error: unknown, fallback: string) => string;
  logMediaEvent: (
    eventType: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>
  ) => Promise<void>;
  markInactiveMediaCachesStale: (currentTab: MediaDataTab | null) => void;
  refreshStorageUsageBytes: () => Promise<void>;
  setError: Dispatch<SetStateAction<string | null>>;
  updateVisibleRows: (updater: (prev: TRow[]) => TRow[]) => void;
};

type ApiUploadResponse = {
  file?: UploadMediaRowBase;
  error?: string;
  details?: string;
};

const resolveUploadDestinationTab = (
  file: File,
  isPrivateUpload: boolean
): UploadDestinationTab => {
  if (isPrivateUpload) return "private";
  return file.type.toLowerCase().startsWith("video/") ? "uploaded_videos" : "uploaded_images";
};

const uploadViaServerApi = async ({
  file,
  destinationTab,
}: {
  file: File;
  destinationTab: UploadDestinationTab;
}): Promise<UploadMediaRowBase> => {
  const body = new FormData();
  body.append("file", file);
  body.append("destinationTab", destinationTab);

  const response = await fetchWithAuth(MEDIA_UPLOAD_API_ROUTE, {
    method: "POST",
    body,
    shortpulseLogScope: "app",
  });

  const payload = (await response.json().catch(() => null)) as ApiUploadResponse | null;
  if (!response.ok) {
    throw new Error(
      payload?.details ?? payload?.error ?? `Unable to upload media (${response.status})`
    );
  }

  if (!payload?.file?.id || !payload.file.storage_path) {
    throw new Error("Upload API returned an invalid media payload.");
  }

  return payload.file;
};

/**
 * Creates upload handlers and upload-state flags for the Media Library page.
 * Inputs: active tab metadata, row reconciliation callbacks, and signing/event helpers.
 * Output: drag-drop/file-picker handlers plus uploading state and manual upload action.
 * Side effects: posts files to the upload API, reconciles optimistic rows, and refreshes usage totals.
 */
export const useMediaUploadController = <TRow extends UploadMediaRowBase>({
  activeMediaTab,
  activeTab,
  currentUserIdRef,
  getErrorMessage,
  logMediaEvent,
  markInactiveMediaCachesStale,
  refreshStorageUsageBytes,
  setError,
  updateVisibleRows,
}: UseMediaUploadControllerArgs<TRow>) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadCount, setUploadCount] = useState(0);
  const [uploading, setUploading] = useState(false);

  const uploadSelected = useCallback(
    async (incoming?: File[]) => {
      setError(null);
      setUploading(true);
      let placeholderIds: string[] = [];
      try {
        const userId = await readSupabaseUserId();
        if (!userId) {
          setError("Not signed in");
          return;
        }
        currentUserIdRef.current = userId;

        const filesToProcess = incoming ?? selectedFiles;
        if (!filesToProcess.length) return;
        const isPrivateUpload = activeTab === "private";
        if (isPrivateUpload) {
          const hasUnsupportedFile = filesToProcess.some(
            (file) => !file.type.toLowerCase().startsWith("image/")
          );
          if (hasUnsupportedFile) {
            setError("Private uploads only support images.");
            return;
          }
        }
        const uploads: TRow[] = [];
        // Create optimistic placeholders so users see upload activity in the grid immediately.
        const placeholders: TRow[] = filesToProcess.map((file) => ({
          id: crypto.randomUUID(),
          filename: file.name,
          storage_path: "",
          preview_storage_path: "",
          file_type: fileTypeFromMime(file.type || "application/octet-stream"),
          file_size: file.size,
          source: isPrivateUpload ? PRIVATE_MEDIA_SOURCE : "upload",
          created_at: new Date().toISOString(),
          status: "uploading",
        })) as TRow[];
        placeholderIds = placeholders.map((item) => item.id);
        updateVisibleRows((prev) => [...placeholders, ...prev]);
        setUploadCount(filesToProcess.length);
        for (let idx = 0; idx < filesToProcess.length; idx += 1) {
          const file = filesToProcess[idx];
          const placeholderId = placeholders[idx]?.id;
          const mimeType = file.type || "application/octet-stream";
          const resolvedFileType = fileTypeFromMime(mimeType);
          const destinationTab = resolveUploadDestinationTab(file, isPrivateUpload);

          const inserted = await uploadViaServerApi({
            file,
            destinationTab,
          });
          const previewStoragePath = resolveMediaPreviewStoragePath(inserted, userId);
          const signedUrl = inserted.signedUrl ?? null;

          if (inserted?.id) {
            void logMediaEvent("upload", "media_file", inserted.id, {
              storage_path: inserted.storage_path,
              file_type: inserted.file_type ?? resolvedFileType,
              file_size: inserted.file_size ?? file.size,
              visibility:
                (inserted.source ?? "upload") === PRIVATE_MEDIA_SOURCE ? "private" : "standard",
            });
          }

          uploads.push({
            ...inserted,
            preview_storage_path: previewStoragePath,
            signedUrl: signedUrl ?? undefined,
            status: "ready",
          } as TRow);

          // Swap placeholder with real row once the insert + sign pass returns.
          updateVisibleRows((prev) =>
            prev.map((row) =>
              placeholderId && row.id === placeholderId ? { ...uploads[uploads.length - 1] } : row
            )
          );
        }

        if (uploads.length) {
          updateVisibleRows((prev) => {
            const withoutDangling = prev.filter(
              (row) => row.status !== "uploading" || uploads.some((upload) => upload.id === row.id)
            );
            return withoutDangling;
          });
          markInactiveMediaCachesStale(activeMediaTab);
          void refreshStorageUsageBytes();
        }
        setSelectedFiles([]);
        setUploadCount(0);
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Upload failed"));
        if (placeholderIds.length) {
          updateVisibleRows((prev) =>
            prev.filter((row) => !(row.status === "uploading" && placeholderIds.includes(row.id)))
          );
        }
      } finally {
        setUploading(false);
        setUploadCount(0);
      }
    },
    [
      activeMediaTab,
      activeTab,
      currentUserIdRef,
      getErrorMessage,
      logMediaEvent,
      markInactiveMediaCachesStale,
      refreshStorageUsageBytes,
      selectedFiles,
      setError,
      updateVisibleRows,
    ]
  );

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const list = event.target.files;
      if (!list) return;
      const filesToUpload = Array.from(list);
      setSelectedFiles(filesToUpload);
      void uploadSelected(filesToUpload);
    },
    [uploadSelected]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const dropped = event.dataTransfer.files;
      if (!dropped?.length) return;
      const filesToUpload = Array.from(dropped);
      setSelectedFiles(filesToUpload);
      void uploadSelected(filesToUpload);
    },
    [uploadSelected]
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return {
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileChange,
    isDragging,
    selectedFiles,
    uploadCount,
    uploadSelected,
    uploading,
  };
};
