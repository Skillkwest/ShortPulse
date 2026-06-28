/**
 * Persistence and save-action callbacks for AI Studio outputs and prompts.
 */
import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { useResolvedProtectedSessionState } from "../../../lib/protectedRouteSessionContext";
import { isVideoUrl, type Provider } from "../logic/stateParsers";
import type { StudioOutput, StudioOutputSaveState } from "../types";
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeOptionalString = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeUuid = (value: string | null | undefined): string | null => {
  const normalized = normalizeOptionalString(value);
  return normalized && UUID_PATTERN.test(normalized) ? normalized : null;
};

const buildGenerationProjectAssociationKey = ({
  projectId,
  generationId,
  userId,
}: {
  projectId: string;
  generationId: string;
  userId: string | null;
}) => `${userId ?? "anonymous"}:${projectId}:${generationId}`;

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
  const sessionSnapshot = useResolvedProtectedSessionState();
  const currentUserId = sessionSnapshot.user?.id ?? null;
  const associatedGenerationProjectKeysRef = useRef<Set<string>>(new Set());
  void setOutputs;
  void aspect;
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
    (
      outputId: string,
      message: string,
      options?: { showPill?: boolean; state?: StudioOutputSaveState }
    ) => {
      const showPill = options?.showPill ?? true;
      const failedState = options?.state ?? "failed";
      updateOutputById(outputId, (item) => ({
        ...item,
        saveState: showPill ? failedState : item.saveState,
        saveError: showPill ? message : item.saveError,
      }));
    },
    [updateOutputById]
  );

  const associateGenerationWithActiveProject = useCallback(
    async (generationId: string) => {
      const normalizedProjectId = normalizeOptionalString(projectId);
      const normalizedGenerationId = normalizeUuid(generationId);
      if (!normalizedProjectId || !normalizedGenerationId) return;

      const associationKey = buildGenerationProjectAssociationKey({
        projectId: normalizedProjectId,
        generationId: normalizedGenerationId,
        userId: currentUserId,
      });
      if (associatedGenerationProjectKeysRef.current.has(associationKey)) return;

      await associateGenerationWithProject({
        projectId: normalizedProjectId,
        generationId: normalizedGenerationId,
        userId: currentUserId,
      });
      associatedGenerationProjectKeysRef.current.add(associationKey);
    },
    [currentUserId, projectId]
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
      const existingGenerationId = normalizeUuid(output.generationId);
      const resolvedTaskId =
        normalizeOptionalString(taskId) ?? normalizeOptionalString(output.taskId);
      if (taskId && taskId !== output.taskId) {
        updateOutputById(outputId, (item) => ({ ...item, taskId }));
      }
      if (existingGenerationId) {
        try {
          await associateGenerationWithActiveProject(existingGenerationId);
        } catch {
          // Project association is best-effort here; direct polling remains authoritative.
        }
        if (existingGenerationId !== output.generationId) {
          updateOutputById(outputId, (item) => ({
            ...item,
            generationId: existingGenerationId,
            taskId: resolvedTaskId ?? item.taskId,
          }));
        }
        return existingGenerationId;
      }
      const resolvedGenerationId = resolvedTaskId
        ? await resolveGenerationIdForRequestId(resolvedTaskId, projectId, currentUserId)
        : null;
      if (resolvedGenerationId) {
        try {
          await associateGenerationWithActiveProject(resolvedGenerationId);
        } catch {
          // Project association is best-effort here; direct polling remains authoritative.
        }
        updateOutputById(outputId, (item) => ({
          ...item,
          taskId: resolvedTaskId ?? item.taskId,
          generationId: resolvedGenerationId,
        }));
        return resolvedGenerationId;
      }
      return null;
    },
    [
      associateGenerationWithActiveProject,
      currentUserId,
      findOutputById,
      projectId,
      updateOutputById,
    ]
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
          userId: currentUserId,
        });
        if (promptId) {
          try {
            await logMediaEvent({
              eventType: "prompt_saved",
              entityType: "media_prompt",
              entityId: promptId,
              userId: currentUserId,
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
    [currentUserId, projectId, setUiError]
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
          const outputDurationMs =
            typeof output.durationMs === "number" &&
            Number.isFinite(output.durationMs) &&
            output.durationMs > 0
              ? Math.round(output.durationMs)
              : null;
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
              transcript_text: output.transcriptText ?? null,
              lyrics_text: output.lyricsText ?? null,
              music_mode: output.musicMode ?? null,
              source_mode: output.audioSourceMode ?? null,
              ...(outputDurationMs !== null
                ? {
                    duration_ms: outputDurationMs,
                    duration_seconds: outputDurationMs / 1000,
                  }
                : {}),
              ...(output.workflowReload ? { workflow_reload: output.workflowReload } : {}),
              ...(output.generationReplay ? { generation_replay: output.generationReplay } : {}),
              ...(output.characterContext ? { character_context: output.characterContext } : {}),
              ...(output.styleContext ? { style_context: output.styleContext } : {}),
            },
            posterUrlHint: resolvePersistedPosterUrlHint(output),
            projectId,
            userId: currentUserId,
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
                userId: currentUserId,
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
            userId: currentUserId,
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
    [currentUserId, findOutputById, projectId]
  );

  const { persistOutputSave } = useAiStudioOutputSaveRuntime({
    currentUserId,
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

  const savePromptToLibrary = useCallback(
    async (customPrompt?: string): Promise<boolean> => {
      const cleanedPrompt = (typeof customPrompt === "string" ? customPrompt : prompt).trim();
      if (!cleanedPrompt) return false;
      const promptId = await persistPromptSave({
        promptText: cleanedPrompt,
        modelId: model ?? null,
        source: "ai_studio",
      });
      return Boolean(promptId);
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
    savePromptToLibrary,
  };
};
