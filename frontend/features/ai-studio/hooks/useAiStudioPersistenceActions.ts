/**
 * Persistence and save-action callbacks for AI Studio outputs and prompts.
 */
import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import { randomId } from "../logic/ids";
import { isVideoUrl, resolveModelLabel, type Provider } from "../logic/stateParsers";
import type { StudioOutput } from "../types";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import {
  GENERATED_MEDIA_REQUIRES_GENERATION_ID_ERROR,
  associateGenerationWithProject,
  associateMediaFilesWithProject,
  associatePromptWithProject,
  logMediaEvent,
  resolveGenerationIdForRequestId,
  saveMediaUrlToLibrary,
  savePromptRecord,
} from "../logic/mediaLibraryPersistence";
import { resolvePublishedGenerationOutputStoragePathByIndex } from "../logic/generatedMediaAuthority";

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

export type PersistedMediaDelivery = {
  previewStoragePath: string | null;
  fullStoragePath: string | null;
  previewUrl: string | null;
  fullUrl: string | null;
};

export type PersistOutputSaveResult = {
  ok: boolean;
  mediaFileIds: string[];
  delivery: PersistedMediaDelivery | null;
  error: string | null;
};

const normalizeOptionalUrl = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const resolvePersistablePosterUrl = (output: StudioOutput): string | null => {
  if (output.mode !== "video") return null;
  const explicitPosterUrl = normalizeOptionalUrl(output.previewPosterUrl);
  if (explicitPosterUrl) return explicitPosterUrl;
  const previewUrl = normalizeOptionalUrl(output.previewUrl);
  if (previewUrl && !isVideoUrl(previewUrl)) return previewUrl;
  return null;
};

const uniqueUrls = (values: Array<string | null | undefined>): string[] => {
  const next: string[] = [];
  values.forEach((value) => {
    const normalized = normalizeOptionalUrl(value);
    if (!normalized || next.includes(normalized)) return;
    next.push(normalized);
  });
  return next;
};

export const resolvePersistableOutputUrls = (output: StudioOutput): string[] => {
  const uploadLocalSource = normalizeOptionalUrl(output.localObjectUrl);
  const baseUrls = output.resultUrls?.length
    ? uniqueUrls(output.resultUrls)
    : uniqueUrls([
        output.mediaSource === "upload" ? uploadLocalSource : null,
        output.previewUrl,
        uploadLocalSource,
      ]);
  if (!baseUrls.length) return [];
  if (output.mode !== "video") return baseUrls;
  const videoUrls = baseUrls.filter((value) => isVideoUrl(value));
  return videoUrls.length ? videoUrls : baseUrls;
};

const isLikelyStoragePath = (value: string | null | undefined): boolean => {
  const normalized = normalizeOptionalUrl(value);
  if (!normalized) return false;
  return !/^https?:\/\//i.test(normalized) && !normalized.startsWith("blob:");
};

export const resolvePersistableOutputUrlsForSave = async (
  output: StudioOutput
): Promise<string[]> => {
  if (output.mediaSource === "generated" || Boolean(output.generationId)) {
    if (output.generationId) {
      try {
        const supabase = ensureSupabaseQueryClient();
        const generationStoragePath = await resolvePublishedGenerationOutputStoragePathByIndex({
          supabase,
          generationId: output.generationId,
          imageIndex: 0,
        });
        if (generationStoragePath) {
          const signedUrl = await getSignedMediaUrl({
            bucket: "media_library",
            storagePath: generationStoragePath,
          });
          if (signedUrl) {
            return uniqueUrls([signedUrl]);
          }
        }
      } catch {
        // fall through to output state and legacy result URL handling
      }
    }

    const candidateStoragePaths = uniqueUrls(
      output.mode === "video"
        ? [output.fullStoragePath, output.previewStoragePath]
        : [output.previewStoragePath, output.fullStoragePath]
    ).filter((value) => isLikelyStoragePath(value));

    for (const storagePath of candidateStoragePaths) {
      const signedUrl = await getSignedMediaUrl({
        bucket: "media_library",
        storagePath,
      });
      if (signedUrl) {
        return uniqueUrls([signedUrl]);
      }
    }
  }

  return resolvePersistableOutputUrls(output);
};

export const isDurablyGeneratedOutput = (output: StudioOutput): boolean =>
  output.mediaSource === "generated" || Boolean(output.generationId);

export const hasDurableGenerationIdentity = (output: StudioOutput): boolean =>
  Boolean(output.generationId);

/**
 * Merges delivery metadata from persistence into an output row.
 * Prefers fresh delivery URLs over stale preview URLs when provided.
 */
export const mergeOutputWithPersistedDelivery = (
  output: StudioOutput,
  delivery: PersistedMediaDelivery
): StudioOutput => {
  const nextPreviewStoragePath = delivery.previewStoragePath ?? output.previewStoragePath ?? null;
  const nextFullStoragePath =
    delivery.fullStoragePath ?? output.fullStoragePath ?? nextPreviewStoragePath ?? null;
  const nextPreviewUrl =
    normalizeOptionalUrl(delivery.previewUrl) ??
    normalizeOptionalUrl(delivery.fullUrl) ??
    normalizeOptionalUrl(output.previewUrl) ??
    undefined;
  return {
    ...output,
    previewStoragePath: nextPreviewStoragePath,
    fullStoragePath: nextFullStoragePath,
    previewUrl: nextPreviewUrl,
  };
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
  const saveInFlightRef = useRef<Map<string, Promise<PersistOutputSaveResult>>>(new Map());

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
            posterUrlHint: resolvePersistablePosterUrl(output),
            metadata: {
              task_id: output.taskId ?? null,
              generation_trace_id: output.generationTraceId ?? output.taskId ?? null,
              submission_trace_id: output.submissionTraceId ?? null,
            },
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

  const persistOutputSave = useCallback(
    async (outputId: string): Promise<PersistOutputSaveResult> => {
      const output = findOutputById(outputId);
      if (!output) {
        return {
          ok: false,
          mediaFileIds: [],
          delivery: null,
          error: "Output not found.",
        };
      }
      const inFlight = saveInFlightRef.current.get(outputId);
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
          if (output.savedMediaIds?.length) {
            if (projectId) {
              await associateMediaFilesWithProject({
                projectId,
                mediaFileIds: output.savedMediaIds,
              });
            }
            await new Promise((resolve) => window.setTimeout(resolve, 260));
            markOutputSaved(outputId, output.savedMediaIds);
            return {
              ok: true,
              mediaFileIds: output.savedMediaIds,
              delivery: {
                previewStoragePath: output.previewStoragePath ?? null,
                fullStoragePath: output.fullStoragePath ?? null,
                previewUrl: output.previewUrl ?? null,
                fullUrl: output.resultUrls?.[0] ?? output.previewUrl ?? null,
              },
              error: null,
            };
          }

          const previewText = output.previewText?.trim();
          const promptOnly = Boolean(previewText) && !output.previewUrl;
          if (promptOnly && previewText) {
            if (output.promptId) {
              if (projectId) {
                await associatePromptWithProject({
                  projectId,
                  promptId: output.promptId,
                });
              }
              await new Promise((resolve) => window.setTimeout(resolve, 220));
              markOutputSaved(outputId, undefined, { timestamp: "Saved prompt" });
              return {
                ok: true,
                mediaFileIds: [],
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
                delivery: null,
                error: null,
              };
            }
            markOutputSaveFailed(outputId, "Unable to save prompt.");
            return {
              ok: false,
              mediaFileIds: [],
              delivery: null,
              error: "Unable to save prompt.",
            };
          }

          const urls = await resolvePersistableOutputUrlsForSave(output);
          if (!urls.length) {
            markOutputSaveFailed(outputId, "No media available to save.");
            setUiError("No media available to save.");
            return {
              ok: false,
              mediaFileIds: [],
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
          if (delivery) {
            updateOutputById(outputId, (item) => mergeOutputWithPersistedDelivery(item, delivery));
          }
          if (mediaFileIds.length) {
            markOutputSaved(outputId, mediaFileIds);
            return {
              ok: true,
              mediaFileIds,
              delivery,
              error: null,
            };
          }
          if (errors.length) {
            markOutputSaveFailed(outputId, errors[0] ?? "Unable to save media to the library.");
          }
          setUiError("Unable to save media to the library.");
          return {
            ok: false,
            mediaFileIds,
            delivery,
            error: errors[0] ?? "Unable to save media to the library.",
          };
        } finally {
          saveInFlightRef.current.delete(outputId);
        }
      })();
      saveInFlightRef.current.set(outputId, task);
      return await task;
    },
    [
      ensureGenerationRecord,
      findOutputById,
      markOutputSaveFailed,
      markOutputSaved,
      persistMediaUrls,
      persistPromptSave,
      projectId,
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

  const ensureOutputPersisted = useCallback(
    async (outputId: string) => await persistOutputSave(outputId),
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
