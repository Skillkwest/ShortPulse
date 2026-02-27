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
import { resolveMediaSigningStoragePaths } from "../../../lib/mediaPreviewPath";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import type { MediaTab } from "../logic/mediaMoveRouting";
import {
  BUCKET,
  PRIVATE_MEDIA_SOURCE,
  fileTypeFromMime,
  sanitizeFileName,
  type MediaDataTab,
} from "../logic/mediaLibraryPageHelpers";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";

const PRIVATE_MEDIA_FOLDER = "private";
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
  signStoragePath: (
    storagePath: string,
    options?: { forceRefresh?: boolean }
  ) => Promise<string | null>;
  updateVisibleRows: (updater: (prev: TRow[]) => TRow[]) => void;
};

type ApiUploadResponse = {
  file?: UploadMediaRowBase;
  error?: string;
  details?: string;
};

const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

const isMediaUploadApiEnabled = (): boolean =>
  parseBooleanEnv(process.env.NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED, true);

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
 * Side effects: writes files to Supabase storage, inserts `media_files` rows, and refreshes usage totals.
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
  signStoragePath,
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
        const supabase = ensureSupabaseClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
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
        const useServerUploadApi = isMediaUploadApiEnabled();
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
          const destinationTab = resolveUploadDestinationTab(file, isPrivateUpload);

          let inserted: UploadMediaRowBase;
          let previewStoragePath: string;
          let signedUrl: string | null;

          if (useServerUploadApi) {
            inserted = await uploadViaServerApi({
              file,
              destinationTab,
            });
            previewStoragePath = inserted.preview_storage_path ?? inserted.storage_path;
            signedUrl = inserted.signedUrl ?? null;
          } else {
            const typeFolder = fileTypeFromMime(mimeType) === "video" ? "videos" : "images";
            const extension = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
            const storedName = `${crypto.randomUUID()}-${sanitizeFileName(file.name.replace(extension, ""))}${extension}`;
            const path = assertUserScopedMediaStoragePath({
              path: isPrivateUpload
                ? `${userId}/${PRIVATE_MEDIA_FOLDER}/images/${storedName}`
                : `${userId}/${typeFolder}/${storedName}`,
              userId,
              label: "Upload storage path",
            });

            const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
              upsert: false,
              contentType: mimeType,
            });
            if (uploadError) {
              throw uploadError;
            }

            const { data, error: insertError } = await supabase
              .from("media_files")
              .insert({
                user_id: userId,
                filename: file.name,
                storage_path: path,
                file_type: fileTypeFromMime(mimeType),
                file_size: file.size,
                source: isPrivateUpload ? PRIVATE_MEDIA_SOURCE : "upload",
              })
              .select("*")
              .single();
            if (insertError || !data) {
              throw insertError ?? new Error("Missing inserted media row.");
            }

            inserted = data as UploadMediaRowBase;
            previewStoragePath =
              resolveMediaSigningStoragePaths(inserted ?? { storage_path: path }, userId)[0] ??
              path;
            signedUrl = await signStoragePath(previewStoragePath, { forceRefresh: true });
          }

          if (inserted?.id) {
            void logMediaEvent("upload", "media_file", inserted.id, {
              storage_path: inserted.storage_path,
              file_type: inserted.file_type,
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
      signStoragePath,
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
