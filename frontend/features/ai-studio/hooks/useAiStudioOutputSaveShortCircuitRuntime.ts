import { useCallback } from "react";

import type { StudioOutput } from "../types";
import type {
  PersistOutputSaveOptions,
  PersistOutputSaveResult,
} from "./persistenceActionContracts";
import {
  mergeSavedMediaIdsForRequest,
  resolveSavedMediaIdsForRequest,
} from "./persistenceOutputSaveUtils";

type UseAiStudioOutputSaveShortCircuitRuntimeArgs = {
  projectId?: string | null;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  persistPromptSave: (input: {
    promptText: string;
    modelId?: string | null;
    source?: "manual" | "ai_studio" | "agent";
  }) => Promise<string | null>;
  markOutputSaved: (
    outputId: string,
    mediaFileIds?: string[],
    options?: { showPill?: boolean; timestamp?: string; status?: "ready" | "saved" }
  ) => void;
  markOutputSaveFailed: (
    outputId: string,
    message: string,
    options?: { showPill?: boolean }
  ) => void;
};

/**
 * Handles output-save branches that do not require media persistence.
 */
export const useAiStudioOutputSaveShortCircuitRuntime = ({
  projectId = null,
  updateOutputById,
  persistPromptSave,
  markOutputSaved,
  markOutputSaveFailed,
}: UseAiStudioOutputSaveShortCircuitRuntimeArgs) => {
  const logProjectAssociationWarning = useCallback(
    (entityType: "media" | "prompt", entityIds: string[], error: unknown) => {
      if (!projectId) return;
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "message" in error
            ? String((error as { message?: unknown }).message ?? error)
            : String(error);
      console.warn(`[media/save] project ${entityType} association failed for ${projectId}`, {
        entityIds,
        message,
      });
    },
    [projectId]
  );

  const resolveShortCircuitSave = useCallback(
    async ({
      outputId,
      output,
      options,
    }: {
      outputId: string;
      output: StudioOutput;
      options?: PersistOutputSaveOptions;
    }): Promise<PersistOutputSaveResult | null> => {
      const savedMediaIdsForRequest = resolveSavedMediaIdsForRequest(output, options);
      if (savedMediaIdsForRequest.length) {
        if (projectId) {
          const { associateMediaFilesWithProject } =
            await import("../logic/mediaLibraryPersistence");
          try {
            await associateMediaFilesWithProject({
              projectId,
              mediaFileIds: savedMediaIdsForRequest,
            });
          } catch (error) {
            logProjectAssociationWarning("media", savedMediaIdsForRequest, error);
          }
        }
        await new Promise((resolve) => window.setTimeout(resolve, 260));
        markOutputSaved(
          outputId,
          mergeSavedMediaIdsForRequest({
            output,
            savedMediaIds: savedMediaIdsForRequest,
            options,
          })
        );
        return {
          ok: true,
          mediaFileIds: savedMediaIdsForRequest,
          promptId: output.promptId ?? null,
          delivery: {
            previewStoragePath: output.previewStoragePath ?? null,
            previewPosterStoragePath: output.previewPosterStoragePath ?? null,
            fullStoragePath: output.fullStoragePath ?? null,
            previewUrl: output.previewUrl ?? null,
            previewPosterUrl: output.previewPosterUrl ?? null,
            fullUrl:
              output.resultUrls?.[Math.max(0, Math.floor(options?.imageIndex ?? 0))] ??
              output.resultUrls?.[0] ??
              output.previewUrl ??
              null,
          },
          error: null,
        };
      }

      const previewText = output.previewText?.trim();
      const promptOnly = Boolean(previewText) && !output.previewUrl;
      if (!promptOnly || !previewText) {
        return null;
      }

      if (output.promptId) {
        if (projectId) {
          const { associatePromptWithProject } = await import("../logic/mediaLibraryPersistence");
          try {
            await associatePromptWithProject({
              projectId,
              promptId: output.promptId,
            });
          } catch (error) {
            logProjectAssociationWarning("prompt", [output.promptId], error);
          }
        }
        await new Promise((resolve) => window.setTimeout(resolve, 220));
        markOutputSaved(outputId, undefined, { timestamp: "Saved prompt" });
        return {
          ok: true,
          mediaFileIds: [],
          promptId: output.promptId,
          delivery: null,
          error: null,
        };
      }

      const promptId = await persistPromptSave({
        promptText: previewText,
        modelId: output.modelId ?? null,
      });
      if (promptId) {
        updateOutputById(outputId, (item) => ({ ...item, promptId }));
        markOutputSaved(outputId, undefined, { timestamp: "Saved prompt" });
        return {
          ok: true,
          mediaFileIds: [],
          promptId,
          delivery: null,
          error: null,
        };
      }

      markOutputSaveFailed(outputId, "Unable to save prompt.");
      return {
        ok: false,
        mediaFileIds: [],
        promptId: null,
        delivery: null,
        error: "Unable to save prompt.",
      };
    },
    [
      logProjectAssociationWarning,
      markOutputSaveFailed,
      markOutputSaved,
      persistPromptSave,
      projectId,
      updateOutputById,
    ]
  );

  return {
    resolveShortCircuitSave,
  };
};
