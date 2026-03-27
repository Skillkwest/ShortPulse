/**
 * Reference asset actions hook for AI Studio.
 * Encapsulates download/save handlers used by reference cards and detail modal.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
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

type UseAiStudioReferenceAssetActionsParams = {
  findOutputById: (id: string) => StudioOutput | null;
  saveReferenceToLibrary: (outputId: string) => void;
  setUiError: Dispatch<SetStateAction<string | null>>;
};

/**
 * Returns reference asset handlers for card/detail interactions.
 */
export const useAiStudioReferenceAssetActions = ({
  findOutputById,
  saveReferenceToLibrary,
  setUiError,
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
        });
        const downloadFilename = resolveReferenceDownloadFilename({
          preferredFilename: resolvedTarget.fileRecord?.filename ?? null,
          prompt: target.prompt,
          outputId: target.id,
          previewUrl: resolvedTarget.directUrl ?? target.previewUrl ?? null,
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
          downloadBlobToFile(blob, downloadFilename);
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
            downloadBlobToFile(blob, downloadFilename);
            return;
          }

          const startedDownload = downloadUrlToFile(directUrl, downloadFilename);
          if (!startedDownload) {
            throw new Error("No media available to download.");
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
    [findOutputById, setUiError]
  );

  const handleSaveReference = useCallback(
    (outputId: string) => {
      if (!outputId) return;
      saveReferenceToLibrary(outputId);
    },
    [saveReferenceToLibrary]
  );

  return {
    handleDownloadReference,
    handleSaveReference,
  };
};
