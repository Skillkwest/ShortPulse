/**
 * Persistence and save-action callbacks for AI Studio outputs and prompts.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { randomId } from "../logic/ids";
import { isVideoUrl, resolveModelLabel, type Provider } from "../logic/stateParsers";
import type { StudioOutput } from "../types";
import {
  GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR,
  associateGenerationWithProject,
  logMediaEvent,
  resolveGenerationIdForRequestId,
  saveMediaUrlToLibrary,
  savePromptRecord,
} from "../logic/mediaLibraryPersistence";
import type {
  PersistedMediaDelivery,
  PersistOutputSaveOptions,
} from "./persistenceActionContracts";
import { resolvePersistedPosterUrlHint } from "./persistenceOutputSaveUtils";
import { useAiStudioOutputSaveRuntime } from "./useAiStudioOutputSaveRuntime";

export type {
  PersistedMediaDelivery,
  PersistOutputSaveResult,
  PersistOutputSaveOptions,
} from "./persistenceActionContracts";
export {
  hasDurableGenerationIdentity,
  isDurablyGeneratedOutput,
  mergeOutputWithPersistedDelivery,
  resolvePersistableOutputUrls,
  resolvePersistableOutputUrlsForSave,
} from "./persistenceOutputSaveUtils";

type UseAiStudioPersistenceActionsArgs = {
  projectId?: string | null;
  findOutputById: (id: string) => StudioOutput | null;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  setUiError: Dispatch<SetStateAction<string | null>>;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  activeOutputId: string | null;
  model: string | null;
  aspect: string;
  prompt: string;
};

const resolveFileTypeHintForPersistedUrl = (
  output: StudioOutput,
  url: string
): "image" | "video" | "audio" => {
  if (output.mode === "audio") return "audio";
  return isVideoUrl(url) ? "video" : "image";
};

/**
 * Builds output persistence callbacks used across generation and manual saves.
 */
export const useAiStudioPersistenceActions = ({
  projectId = null,
  findOutputById,
  updateOutputById,
  setUiError,
  setOutputs,
  setSaved,
  activeOutputId,
  model,
  aspect,
  prompt,
}: UseAiStudioPersistenceActionsArgs) => {
  const markOutputSaved = useCallback(
    (
      outputId: string,
      mediaFileIds?: string[],
      options?: { showPill?: boolean; timestamp?: string; status?: "ready" | "saved" }
    ) => {
      const showPill = options?.showPill ?? true;
      updateOutputById(outputId, (item) => ({
        ...item,
        status: options?.status ?? "saved",
        timestamp: options?.timestamp ?? "Saved",
        saveState: showPill ? "saved" : item.saveState,
        saveError: showPill ? null : item.saveError,
        savedMediaIds: mediaFileIds?.length ? mediaFileIds : item.savedMediaIds,
      }));
    },
    [updateOutputById]
  );

  const markOutputSaveFailed = useCallback(
    (outputId: string, message: string, options?: { showPill?: boolean }) => {
      const showPill = options?.showPill ?? true;
      updateOutputById(outputId, (item) => ({
        ...item,
        saveState: showPill ? "failed" : item.saveState,
        saveError: showPill ? message : item.saveError,
      }));
    },
    [updateOutputById]
  );

  const ensureGenerationRecord = useCallback(
    async ({
      outputId,
      taskId,
    }: {
      outputId: string;
      provider: Provider;
      taskId?: string;
      durationSeconds?: number;
      resolution?: string | null;
      metadata?: Record<string, unknown>;
    }) => {
      const output = findOutputById(outputId);
      if (!output) return null;
      if (output.generationId) {
        if (projectId) {
          try {
            await associateGenerationWithProject({
              projectId,
              generationId: output.generationId,
            });
          } catch {
            // Project association is best-effort here; direct polling remains authoritative.
          }
        }
        return output.generationId;
      }
      if (taskId && taskId !== output.taskId) {
        updateOutputById(outputId, (item) => ({ ...item, taskId }));
      }
      const resolvedGenerationId = await resolveGenerationIdForRequestId(
        taskId ?? output.taskId,
        projectId
      );
      if (resolvedGenerationId) {
        if (projectId) {
          try {
            await associateGenerationWithProject({
              projectId,
              generationId: resolvedGenerationId,
            });
          } catch {
            // Project association is best-effort here; direct polling remains authoritative.
          }
        }
        updateOutputById(outputId, (item) => ({
          ...item,
          taskId: taskId ?? item.taskId,
          generationId: resolvedGenerationId,
        }));
        return resolvedGenerationId;
      }
      return null;
    },
    [findOutputById, projectId, updateOutputById]
  );

  const persistPromptSave = useCallback(
    async ({
      promptText,
      modelId,
      source,
    }: {
      promptText: string;
      modelId?: string | null;
      source?: "manual" | "ai_studio" | "agent";
    }) => {
      try {
        const promptId = await savePromptRecord({
          promptText,
          mode: "text",
          modelId: modelId ?? null,
          source: source ?? "manual",
          projectId,
        });
        if (promptId) {
          try {
            await logMediaEvent({
              eventType: "prompt_saved",
              entityType: "media_prompt",
              entityId: promptId,
            });
          } catch {
            // best-effort logging only
          }
        }
        return promptId;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to save prompt.";
        setUiError(message);
        return null;
      }
    },
    [projectId, setUiError]
  );

  const persistMediaUrls = useCallback(
    async ({
      outputId,
      urls,
      provider,
      source,
      generationId,
    }: {
      outputId: string;
      urls: string[];
      provider: Provider;
      source: "upload" | "ai_studio";
      generationId?: string | null;
    }): Promise<{
      mediaFileIds: string[];
      errors: string[];
      delivery: PersistedMediaDelivery | null;
    }> => {
      if (source === "ai_studio" && !generationId) {
        return {
          mediaFileIds: [],
          errors: [GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR],
          delivery: null,
        };
      }
      const output = findOutputById(outputId);
      if (!output) return { mediaFileIds: [], errors: ["Output not found"], delivery: null };
      const mediaFileIds: string[] = [];
      const errors: string[] = [];
      let delivery: PersistedMediaDelivery | null = null;

      for (let index = 0; index < urls.length; index += 1) {
        try {
          const result = await saveMediaUrlToLibrary({
            url: urls[index],
            promptText: output.prompt,
            mode: output.mode,
            source,
            fileTypeHint: resolveFileTypeHintForPersistedUrl(output, urls[index] ?? ""),
            provider,
            modelId: output.modelId ?? null,
            generationId: generationId ?? null,
            promptId: output.promptId ?? null,
            index,
            previewStoragePathHint: output.previewStoragePath ?? null,
            fullStoragePathHint: output.fullStoragePath ?? null,
            previewUrlHint: output.previewUrl ?? null,
            fullUrlHint: output.previewUrl ?? null,
            metadata: {
              task_id: output.taskId ?? null,
              generation_trace_id: output.generationTraceId ?? output.taskId ?? null,
              submission_trace_id: output.submissionTraceId ?? null,
            },
            posterUrlHint: resolvePersistedPosterUrlHint(output),
            projectId,
          });
          if (!delivery) {
            delivery = result.delivery;
          }
          if (result?.mediaFileId) {
            mediaFileIds.push(result.mediaFileId);
            try {
              const eventType = source === "ai_studio" ? "generation_saved" : "upload";
              await logMediaEvent({
                eventType,
                entityType: "media_file",
                entityId: result.mediaFileId,
                metadata: {
                  output_id: output.id,
                  provider,
                  storage_path: result.storagePath,
                },
              });
            } catch {
              // best-effort logging only
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to save media.";
          errors.push(message);
        }
      }

      if (errors.length && generationId && source === "ai_studio") {
        try {
          await logMediaEvent({
            eventType: "generation_failed",
            entityType: "ai_generation",
            entityId: generationId,
            metadata: {
              stage: "storage_upload",
              errors,
            },
          });
        } catch {
          // best-effort logging only
        }
      }

      return { mediaFileIds, errors, delivery };
    },
    [findOutputById, projectId]
  );

  const { persistOutputSave } = useAiStudioOutputSaveRuntime({
    projectId,
    findOutputById,
    updateOutputById,
    setUiError: (value) => setUiError(value),
    ensureGenerationRecord,
    persistPromptSave,
    persistMediaUrls,
    markOutputSaved,
    markOutputSaveFailed,
  });

  const saveActiveOutput = useCallback(
    (outputId?: string | null) => {
      const targetId = outputId ?? activeOutputId ?? null;
      if (!targetId) return;
      void persistOutputSave(targetId);
      if (!outputId) {
        setSaved(true);
      }
    },
    [activeOutputId, persistOutputSave, setSaved]
  );

  const saveReferenceToLibrary = useCallback(
    async (outputId: string, options?: PersistOutputSaveOptions) =>
      await persistOutputSave(outputId, options),
    [persistOutputSave]
  );

  const ensureOutputPersisted = useCallback(
    async (outputId: string, options?: PersistOutputSaveOptions) =>
      await persistOutputSave(outputId, options),
    [persistOutputSave]
  );

  const savePromptReference = useCallback(
    (customPrompt?: string) => {
      const cleanedPrompt = (typeof customPrompt === "string" ? customPrompt : prompt).trim();
      if (!cleanedPrompt) return;
      const id = `prompt-ref-${randomId()}`;
      const placeholderModelLabel = model ? resolveModelLabel(model) : "Model pending selection";
      const promptReference: StudioOutput = {
        id,
        prompt: cleanedPrompt,
        mode: "text",
        aspect,
        model: placeholderModelLabel,
        modelId: model ?? undefined,
        status: "ready",
        timestamp: "Pinned",
        previewText: cleanedPrompt,
        saveState: "idle",
        saveError: null,
      };
      setOutputs((previous) => [promptReference, ...previous]);
    },
    [aspect, model, prompt, setOutputs]
  );

  const savePromptToLibrary = useCallback(
    (customPrompt?: string) => {
      const cleanedPrompt = (typeof customPrompt === "string" ? customPrompt : prompt).trim();
      if (!cleanedPrompt) return;
      void persistPromptSave({
        promptText: cleanedPrompt,
        modelId: model ?? null,
        source: "ai_studio",
      });
    },
    [model, persistPromptSave, prompt]
  );

  return {
    markOutputSaved,
    markOutputSaveFailed,
    ensureGenerationRecord,
    persistMediaUrls,
    ensureOutputPersisted,
    persistOutputSave,
    saveActiveOutput,
    saveReferenceToLibrary,
    savePromptReference,
    savePromptToLibrary,
  };
};
