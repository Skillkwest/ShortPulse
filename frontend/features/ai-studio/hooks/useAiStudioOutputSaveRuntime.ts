import { useCallback, useRef } from "react";

import { GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR } from "../logic/mediaLibraryPersistence";
import { MEDIA_STORAGE_LIMIT_EXCEEDED_MESSAGE } from "../../../lib/mediaStorageQuota";
import type { Provider } from "../logic/stateParsers";
import type { StudioOutput } from "../types";
import type {
  PersistOutputSaveOptions,
  PersistOutputSaveResult,
} from "./persistenceActionContracts";
import {
  isDurablyGeneratedOutput,
  mergeSavedMediaIdsForRequest,
  mergeOutputWithPersistedDelivery,
  resolvePersistOutputSaveKey,
  resolvePersistableOutputUrlsForSave,
  shouldMergePersistedDeliveryForRequest,
} from "./persistenceOutputSaveUtils";
import { useAiStudioOutputSaveShortCircuitRuntime } from "./useAiStudioOutputSaveShortCircuitRuntime";

type UseAiStudioOutputSaveRuntimeArgs = {
  projectId?: string | null;
  findOutputById: (id: string) => StudioOutput | null;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  setUiError: (value: string) => void;
  ensureGenerationRecord: (input: {
    outputId: string;
    provider: Provider;
    taskId?: string;
  }) => Promise<string | null>;
  persistPromptSave: (input: {
    promptText: string;
    modelId?: string | null;
    source?: "manual" | "ai_studio" | "agent";
  }) => Promise<string | null>;
  persistMediaUrls: (input: {
    outputId: string;
    urls: string[];
    provider: Provider;
    source: "upload" | "ai_studio";
    generationId?: string | null;
  }) => Promise<{
    mediaFileIds: string[];
    errors: string[];
    delivery: PersistOutputSaveResult["delivery"];
  }>;
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

const GENERIC_LIBRARY_SAVE_UI_ERROR =
  "Unable to save media to the library right now. Please try again.";

const resolveLibrarySaveFailureMessage = (errors: string[]): string =>
  errors[0] ?? "Media library save did not return a media id.";

const isSafeUserFacingLibrarySaveMessage = (message: string): boolean => {
  const normalized = message.trim();
  if (!normalized) return false;
  return normalized.startsWith(MEDIA_STORAGE_LIMIT_EXCEEDED_MESSAGE);
};

const resolveLibrarySaveUiErrorMessage = (message: string): string =>
  isSafeUserFacingLibrarySaveMessage(message) ? message : GENERIC_LIBRARY_SAVE_UI_ERROR;

export const useAiStudioOutputSaveRuntime = ({
  projectId = null,
  findOutputById,
  updateOutputById,
  setUiError,
  ensureGenerationRecord,
  persistPromptSave,
  persistMediaUrls,
  markOutputSaved,
  markOutputSaveFailed,
}: UseAiStudioOutputSaveRuntimeArgs) => {
  const saveInFlightRef = useRef<Map<string, Promise<PersistOutputSaveResult>>>(new Map());
  const { resolveShortCircuitSave } = useAiStudioOutputSaveShortCircuitRuntime({
    projectId,
    updateOutputById,
    persistPromptSave,
    markOutputSaved,
    markOutputSaveFailed,
  });

  const persistOutputSave = useCallback(
    async (
      outputId: string,
      options?: PersistOutputSaveOptions
    ): Promise<PersistOutputSaveResult> => {
      const output = findOutputById(outputId);
      if (!output) {
        return {
          ok: false,
          mediaFileIds: [],
          promptId: null,
          delivery: null,
          error: "Output not found.",
        };
      }
      const saveKey = resolvePersistOutputSaveKey(outputId, options);
      const inFlight = saveInFlightRef.current.get(saveKey);
      if (inFlight) {
        return await inFlight;
      }
      const task = (async (): Promise<PersistOutputSaveResult> => {
        updateOutputById(outputId, (item) => ({
          ...item,
          saveState: "saving",
          saveError: null,
        }));
        try {
          const shortCircuitResult = await resolveShortCircuitSave({
            outputId,
            output,
            options,
          });
          if (shortCircuitResult) {
            return shortCircuitResult;
          }

          const urls = await resolvePersistableOutputUrlsForSave(output, options);
          if (!urls.length) {
            markOutputSaveFailed(outputId, "No media available to save.");
            setUiError("No media available to save.");
            return {
              ok: false,
              mediaFileIds: [],
              promptId: output.promptId ?? null,
              delivery: null,
              error: "No media available to save.",
            };
          }
          const provider = (output.provider ?? "fal") as Provider;
          const generatedOutput = isDurablyGeneratedOutput(output);
          const source = generatedOutput ? "ai_studio" : "upload";
          const generationId = generatedOutput
            ? (output.generationId ??
              (await ensureGenerationRecord({
                outputId,
                provider,
                taskId: output.taskId,
              })))
            : null;
          if (generatedOutput && !generationId) {
            markOutputSaveFailed(outputId, GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR);
            setUiError(GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR);
            return {
              ok: false,
              mediaFileIds: [],
              promptId: output.promptId ?? null,
              delivery: null,
              error: GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR,
            };
          }
          const { mediaFileIds, errors, delivery } = await persistMediaUrls({
            outputId,
            urls,
            provider,
            source,
            generationId: generationId ?? null,
          });
          if (delivery && shouldMergePersistedDeliveryForRequest(output, options)) {
            updateOutputById(outputId, (item) => mergeOutputWithPersistedDelivery(item, delivery));
          }
          if (mediaFileIds.length) {
            markOutputSaved(
              outputId,
              mergeSavedMediaIdsForRequest({
                output,
                savedMediaIds: mediaFileIds,
                options,
              })
            );
            return {
              ok: true,
              mediaFileIds,
              promptId: output.promptId ?? null,
              delivery,
              error: null,
            };
          }
          const failureMessage = resolveLibrarySaveFailureMessage(errors);
          markOutputSaveFailed(outputId, failureMessage);
          setUiError(resolveLibrarySaveUiErrorMessage(failureMessage));
          return {
            ok: false,
            mediaFileIds,
            promptId: output.promptId ?? null,
            delivery,
            error: failureMessage,
          };
        } finally {
          saveInFlightRef.current.delete(saveKey);
        }
      })();
      saveInFlightRef.current.set(saveKey, task);
      return await task;
    },
    [
      ensureGenerationRecord,
      findOutputById,
      markOutputSaveFailed,
      markOutputSaved,
      persistMediaUrls,
      resolveShortCircuitSave,
      setUiError,
      updateOutputById,
    ]
  );

  return {
    persistOutputSave,
  };
};
