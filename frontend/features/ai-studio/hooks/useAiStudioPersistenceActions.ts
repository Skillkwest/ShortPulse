/**
 * Persistence and save-action callbacks for AI Studio outputs and prompts.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { randomId } from "../logic/ids";
import { isVideoUrl, resolveModelLabel, type Provider } from "../logic/stateParsers";
import type { StudioOutput } from "../types";
import {
  createGenerationRecord,
  logMediaEvent,
  saveMediaUrlToLibrary,
  savePromptRecord,
  updateGenerationRecord,
} from "../logic/mediaLibraryPersistence";

type UseAiStudioPersistenceActionsArgs = {
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

/**
 * Builds output persistence callbacks used across generation and manual saves.
 */
export const useAiStudioPersistenceActions = ({
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
      provider,
      taskId,
      durationSeconds,
      resolution,
      metadata,
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
        try {
          await updateGenerationRecord(output.generationId, {
            provider,
            modelId: output.modelId ?? output.model,
            promptText: output.prompt,
            aspect: output.aspect,
            durationSeconds,
            resolution: resolution ?? null,
            requestId: taskId ?? output.taskId ?? null,
            status: "running",
            metadata,
          });
        } catch {
          return output.generationId;
        }
        return output.generationId;
      }

      try {
        const generationId = await createGenerationRecord({
          mode: output.mode,
          provider,
          modelId: output.modelId ?? output.model,
          promptText: output.prompt,
          aspect: output.aspect,
          durationSeconds,
          resolution: resolution ?? null,
          requestId: taskId ?? output.taskId ?? null,
          status: "running",
          metadata,
        });
        if (generationId) {
          updateOutputById(outputId, (item) => ({ ...item, generationId }));
        }
        return generationId;
      } catch {
        return null;
      }
    },
    [findOutputById, updateOutputById]
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
    [setUiError]
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
      delivery: {
        previewStoragePath: string | null;
        fullStoragePath: string | null;
        previewUrl: string | null;
        fullUrl: string | null;
      } | null;
    }> => {
      const output = findOutputById(outputId);
      if (!output) return { mediaFileIds: [], errors: ["Output not found"], delivery: null };
      const mediaFileIds: string[] = [];
      const errors: string[] = [];
      let delivery: {
        previewStoragePath: string | null;
        fullStoragePath: string | null;
        previewUrl: string | null;
        fullUrl: string | null;
      } | null = null;

      for (let index = 0; index < urls.length; index += 1) {
        try {
          const result = await saveMediaUrlToLibrary({
            url: urls[index],
            promptText: output.prompt,
            mode: output.mode,
            source,
            fileTypeHint: isVideoUrl(urls[index]) ? "video" : "image",
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
            },
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
    [findOutputById]
  );

  const persistOutputSave = useCallback(
    async (outputId: string) => {
      const output = findOutputById(outputId);
      if (!output) return;
      updateOutputById(outputId, (item) => ({
        ...item,
        saveState: "saving",
        saveError: null,
      }));
      if (output.savedMediaIds?.length) {
        await new Promise((resolve) => window.setTimeout(resolve, 260));
        markOutputSaved(outputId, output.savedMediaIds);
        return;
      }

      const previewText = output.previewText?.trim();
      const promptOnly = Boolean(previewText) && !output.previewUrl;
      if (promptOnly && previewText) {
        if (output.promptId) {
          await new Promise((resolve) => window.setTimeout(resolve, 220));
          markOutputSaved(outputId, undefined, { timestamp: "Saved prompt" });
          return;
        }
        const promptId = await persistPromptSave({
          promptText: previewText,
          modelId: output.modelId ?? null,
        });
        if (promptId) {
          updateOutputById(outputId, (item) => ({ ...item, promptId }));
          markOutputSaved(outputId, undefined, { timestamp: "Saved prompt" });
          return;
        }
        markOutputSaveFailed(outputId, "Unable to save prompt.");
        return;
      }

      const urls = output.resultUrls?.length
        ? output.resultUrls
        : output.previewUrl
          ? [output.previewUrl]
          : [];
      if (!urls.length) {
        markOutputSaveFailed(outputId, "No media available to save.");
        setUiError("No media available to save.");
        return;
      }
      const provider = (output.provider ?? "fal") as Provider;
      const source = output.generationId || output.taskId ? "ai_studio" : "upload";
      const generationId =
        source === "ai_studio"
          ? (output.generationId ??
            (await ensureGenerationRecord({
              outputId,
              provider,
              taskId: output.taskId,
            })))
          : null;
      const { mediaFileIds, errors, delivery } = await persistMediaUrls({
        outputId,
        urls,
        provider,
        source,
        generationId: generationId ?? null,
      });
      if (delivery) {
        updateOutputById(outputId, (item) => ({
          ...item,
          previewStoragePath: delivery.previewStoragePath ?? item.previewStoragePath ?? null,
          fullStoragePath:
            delivery.fullStoragePath ?? item.fullStoragePath ?? item.previewStoragePath ?? null,
          previewUrl: item.previewUrl ?? delivery.previewUrl ?? delivery.fullUrl ?? undefined,
        }));
      }
      if (mediaFileIds.length) {
        markOutputSaved(outputId, mediaFileIds);
        return;
      }
      if (errors.length) {
        markOutputSaveFailed(outputId, errors[0] ?? "Unable to save media to the library.");
      }
      setUiError("Unable to save media to the library.");
    },
    [
      ensureGenerationRecord,
      findOutputById,
      markOutputSaveFailed,
      markOutputSaved,
      persistMediaUrls,
      persistPromptSave,
      setUiError,
      updateOutputById,
    ]
  );

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
    (outputId: string) => {
      void persistOutputSave(outputId);
    },
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
    persistOutputSave,
    saveActiveOutput,
    saveReferenceToLibrary,
    savePromptReference,
    savePromptToLibrary,
  };
};
