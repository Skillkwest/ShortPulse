/**
 * Reference asset actions hook for AI Studio.
 * Encapsulates download/save handlers used by reference cards and detail modal.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import { MEDIA_STORAGE_FULL_USER_MESSAGE } from "../../../lib/mediaStorageQuota";
import { requestMediaStorageQuotaSummaryRefresh } from "../../billing/useMediaStorageQuotaSummary";
import { logMediaEvent } from "../../media-library/logic/mediaLibraryDataEffects";
import {
  downloadBlobToFile,
  downloadUrlToFile,
  downloadReferenceProviderBlob,
  REFERENCE_MISSING_GENERATION_ID_ERROR_MESSAGE,
  REFERENCE_PROVIDER_DOWNLOAD_ERROR_MESSAGE,
  resolveReferenceDownloadFilename,
  resolveReferenceDownloadTarget,
} from "../logic/referenceDownload";
import type { StudioOutput } from "../types";
import type { PersistOutputSaveResult } from "./persistenceActionContracts";

type UseAiStudioReferenceAssetActionsParams = {
  projectId?: string | null;
  findOutputById: (id: string) => StudioOutput | null;
  saveReferenceToLibrary: (outputId: string) => Promise<PersistOutputSaveResult>;
  setUiError: Dispatch<SetStateAction<string | null>>;
  isMediaStorageFull?: boolean;
  onStorageBlockedSaveAttempt?: () => void;
};

/**
 * Returns reference asset handlers for card/detail interactions.
 */
export const useAiStudioReferenceAssetActions = ({
  projectId = null,
  findOutputById,
  saveReferenceToLibrary,
  setUiError,
  isMediaStorageFull = false,
  onStorageBlockedSaveAttempt,
}: UseAiStudioReferenceAssetActionsParams) => {
  const handleDownloadReference = useCallback(
    async (outputId: string) => {
      const target = findOutputById(outputId);
      if (!target || typeof window === "undefined") return;
      try {
        const supabase = ensureSupabaseQueryClient();
        const resolvedTarget = await resolveReferenceDownloadTarget({
          output: target,
          supabase,
          projectId,
        });

        if (resolvedTarget.fileRecord?.storagePath) {
          const { data, error } = await supabase.storage
            .from("media_library")
            .download(resolvedTarget.fileRecord.storagePath);
          if (error) throw error;
          if (!data) {
            throw new Error("Unable to download media.");
          }
          const blob = data as Blob;
          const downloadFilename = resolveReferenceDownloadFilename({
            preferredFilename: resolvedTarget.fileRecord.filename,
            prompt: target.prompt,
            outputId: target.id,
            previewUrl: resolvedTarget.directUrl ?? target.previewUrl ?? null,
            storagePath: resolvedTarget.fileRecord.storagePath,
            mimeType: blob.type,
            mode: target.mode,
          });
          downloadBlobToFile(blob, downloadFilename);
          if (resolvedTarget.fileRecord.mediaFileId) {
            void logMediaEvent("download", "media_file", resolvedTarget.fileRecord.mediaFileId, {
              output_id: target.id,
              storage_path: resolvedTarget.fileRecord.storagePath,
              surface: "ai-studio-reference",
            });
          } else if (resolvedTarget.generationId) {
            void logMediaEvent("download", "ai_generation", resolvedTarget.generationId, {
              output_id: target.id,
              storage_path: resolvedTarget.fileRecord.storagePath,
              surface: "ai-studio-reference",
            });
          }
          return;
        }

        const directUrl = resolvedTarget.directUrl ?? target.previewUrl ?? null;
        if (directUrl) {
          const isGeneratedReference =
            target.mediaSource === "generated" || Boolean(target.generationId);
          if (isGeneratedReference) {
            if (!resolvedTarget.generationId && !resolvedTarget.fileRecord?.storagePath) {
              throw new Error(REFERENCE_MISSING_GENERATION_ID_ERROR_MESSAGE);
            }
            const blob = await downloadReferenceProviderBlob({
              url: directUrl,
            });
            const downloadFilename = resolveReferenceDownloadFilename({
              preferredFilename: null,
              prompt: target.prompt,
              outputId: target.id,
              previewUrl: directUrl,
              mimeType: blob.type,
              mode: target.mode,
            });
            downloadBlobToFile(blob, downloadFilename);
            if (resolvedTarget.generationId) {
              void logMediaEvent("download", "ai_generation", resolvedTarget.generationId, {
                output_id: target.id,
                source: "provider_url",
                surface: "ai-studio-reference",
              });
            }
            return;
          }

          const downloadFilename = resolveReferenceDownloadFilename({
            preferredFilename: null,
            prompt: target.prompt,
            outputId: target.id,
            previewUrl: directUrl,
            mode: target.mode,
          });
          const startedDownload = downloadUrlToFile(directUrl, downloadFilename);
          if (!startedDownload) {
            throw new Error("No media available to download.");
          }
          if (resolvedTarget.generationId) {
            void logMediaEvent("download", "ai_generation", resolvedTarget.generationId, {
              output_id: target.id,
              source: "direct_url",
              surface: "ai-studio-reference",
            });
          }
          return;
        }
        throw new Error("No media available to download.");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : target?.mediaSource === "generated"
              ? REFERENCE_PROVIDER_DOWNLOAD_ERROR_MESSAGE
              : "Unable to download media.";
        setUiError(message);
      }
    },
    [findOutputById, projectId, setUiError]
  );

  const handleSaveReference = useCallback(
    (outputId: string) => {
      if (!outputId) return;
      if (isMediaStorageFull) {
        if (onStorageBlockedSaveAttempt) {
          onStorageBlockedSaveAttempt();
        } else {
          setUiError(MEDIA_STORAGE_FULL_USER_MESSAGE);
        }
        return;
      }
      void saveReferenceToLibrary(outputId)
        .catch((error) => {
          const message =
            error instanceof Error && error.message.trim().length
              ? error.message.trim()
              : "Unable to save media.";
          setUiError(message);
        })
        .finally(() => {
          requestMediaStorageQuotaSummaryRefresh();
        });
    },
    [isMediaStorageFull, onStorageBlockedSaveAttempt, saveReferenceToLibrary, setUiError]
  );

  return {
    handleDownloadReference,
    handleSaveReference,
  };
};
