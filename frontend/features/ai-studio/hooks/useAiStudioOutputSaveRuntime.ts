import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";

import { reportAppError } from "../../../lib/appErrorReporter";
import { GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR } from "../logic/mediaLibraryPersistence";
import { normalizeMediaStorageQuotaUiCopy } from "../../../lib/mediaStorageQuota";
import type { Provider } from "../logic/stateParsers";
import type { StudioOutput, StudioOutputSaveState } from "../types";
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
  setUiError: Dispatch<SetStateAction<string | null>>;
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

const resolveStorageQuotaUiMessage = (message: string): string | null =>
  normalizeMediaStorageQuotaUiCopy(message)?.message ?? null;

const isSafeUserFacingLibrarySaveMessage = (message: string): boolean =>
  Boolean(resolveStorageQuotaUiMessage(message));

const resolveLibrarySaveUiErrorMessage = (message: string): string =>
  resolveStorageQuotaUiMessage(message) ?? GENERIC_LIBRARY_SAVE_UI_ERROR;

const resolveOutputSaveFailureState = (message: string): StudioOutputSaveState =>
  resolveStorageQuotaUiMessage(message) ? "blocked_storage" : "failed";

const resolvePersistIntent = (options?: PersistOutputSaveOptions): "manual" | "auto" =>
  options?.intent === "auto" ? "auto" : "manual";

const shouldSurfaceLibrarySaveUiError = ({
  message,
  intent,
}: {
  message: string;
  intent: "manual" | "auto";
}): boolean => intent === "manual" || isSafeUserFacingLibrarySaveMessage(message);

type InFlightSaveEntry = {
  intent: "manual" | "auto";
  promise: Promise<PersistOutputSaveResult>;
};

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
  const saveInFlightRef = useRef<Map<string, InFlightSaveEntry>>(new Map());
  const lastLibrarySaveUiErrorRef = useRef<string | null>(null);
  const lastLibrarySaveTelemetrySignatureByKeyRef = useRef<Map<string, string>>(new Map());
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
      const persistIntent = resolvePersistIntent(options);
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
        const inFlightResult = await inFlight.promise;
        if (inFlight.intent === persistIntent || persistIntent === "auto" || inFlightResult.ok) {
          return inFlightResult;
        }
      }
      const task = (async (): Promise<PersistOutputSaveResult> => {
        const reportLibrarySaveFailure = (
          failureMessage: string,
          uiErrorMessage: string | null
        ) => {
          const signature = [saveKey, persistIntent, failureMessage, uiErrorMessage ?? ""].join(
            "|"
          );
          if (lastLibrarySaveTelemetrySignatureByKeyRef.current.get(saveKey) === signature) return;
          lastLibrarySaveTelemetrySignatureByKeyRef.current.set(saveKey, signature);
          void reportAppError({
            source: "client.ai_studio.media_library_save_failure",
            scope: "generation",
            severity: persistIntent === "manual" ? "high" : "medium",
            message: failureMessage,
            metadata: {
              output_id: output.id,
              project_id: projectId,
              persist_intent: persistIntent,
              save_key: saveKey,
              image_index:
                typeof options?.imageIndex === "number" && Number.isFinite(options.imageIndex)
                  ? Math.max(0, Math.floor(options.imageIndex))
                  : null,
              media_source: output.mediaSource ?? null,
              provider: output.provider ?? null,
              mode: output.mode,
              has_generation_id: Boolean(output.generationId),
              task_id: output.taskId ?? null,
              ui_error_message: uiErrorMessage,
            },
          });
        };
        const clearResolvedLibrarySaveUiError = () => {
          lastLibrarySaveTelemetrySignatureByKeyRef.current.delete(saveKey);
          const priorMessage = lastLibrarySaveUiErrorRef.current;
          if (!priorMessage) return;
          setUiError((current) => (current === priorMessage ? null : current));
          lastLibrarySaveUiErrorRef.current = null;
        };
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
            if (shortCircuitResult.ok) {
              clearResolvedLibrarySaveUiError();
            }
            return shortCircuitResult;
          }

          const urls = await resolvePersistableOutputUrlsForSave(output, options);
          if (!urls.length) {
            markOutputSaveFailed(outputId, "No media available to save.");
            const uiErrorMessage = shouldSurfaceLibrarySaveUiError({
              message: "No media available to save.",
              intent: persistIntent,
            })
              ? "No media available to save."
              : null;
            if (uiErrorMessage) {
              lastLibrarySaveUiErrorRef.current = uiErrorMessage;
              setUiError(uiErrorMessage);
            }
            reportLibrarySaveFailure("No media available to save.", uiErrorMessage);
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
            const uiErrorMessage = shouldSurfaceLibrarySaveUiError({
              message: GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR,
              intent: persistIntent,
            })
              ? GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR
              : null;
            if (uiErrorMessage) {
              lastLibrarySaveUiErrorRef.current = uiErrorMessage;
              setUiError(uiErrorMessage);
            }
            reportLibrarySaveFailure(GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR, uiErrorMessage);
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
            clearResolvedLibrarySaveUiError();
            return {
              ok: true,
              mediaFileIds,
              promptId: output.promptId ?? null,
              delivery,
              error: null,
            };
          }
          const failureMessage = resolveLibrarySaveFailureMessage(errors);
          markOutputSaveFailed(outputId, failureMessage, {
            state: resolveOutputSaveFailureState(failureMessage),
          });
          const uiErrorMessage = resolveLibrarySaveUiErrorMessage(failureMessage);
          const surfacedUiErrorMessage = shouldSurfaceLibrarySaveUiError({
            message: failureMessage,
            intent: persistIntent,
          })
            ? uiErrorMessage
            : null;
          if (surfacedUiErrorMessage) {
            lastLibrarySaveUiErrorRef.current = surfacedUiErrorMessage;
            setUiError(surfacedUiErrorMessage);
          }
          reportLibrarySaveFailure(failureMessage, surfacedUiErrorMessage);
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
      saveInFlightRef.current.set(saveKey, {
        intent: persistIntent,
        promise: task,
      });
      return await task;
    },
    [
      ensureGenerationRecord,
      findOutputById,
      markOutputSaveFailed,
      markOutputSaved,
      persistMediaUrls,
      projectId,
      resolveShortCircuitSave,
      setUiError,
      updateOutputById,
    ]
  );

  return {
    persistOutputSave,
  };
};
