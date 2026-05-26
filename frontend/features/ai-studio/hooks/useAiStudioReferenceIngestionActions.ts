/**
 * Reference ingestion action bundle for AI Studio state.
 * Centralizes agent/paste/library/file ingestion callbacks and agent-context projection.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { AgentContext } from "../../ai-agent/types";
import { randomId } from "../logic/ids";
import {
  uploadMediaFile,
  type MediaUploadDestinationTab,
  type MediaUploadRow,
} from "../logic/mediaLibraryPanelApi";
import { associateMediaFilesWithProject } from "../logic/mediaLibraryPersistence";
import { resolveModelLabel } from "../logic/stateParsers";
import type { StudioMode, StudioOutput } from "../types";
import { buildStudioOutputsFromReferenceInputSync } from "../reference-ingestion";
import { prepareLibraryMediaIngestionPayload } from "../reference-ingestion/prepareLibraryMediaIngestionPayload";
import type { ReferenceIngestionInput } from "../reference-ingestion/types";
import {
  normalizeMediaFile,
  type PastedMediaReference,
} from "../reference-grid/controllers/referenceGridClipboard";
import { buildAiStudioAgentContext } from "./stateAdapters/agentContextAdapter";

type UseAiStudioReferenceIngestionActionsArgs = {
  activeOutput?: StudioOutput | null;
  projectId?: string | null;
  mode: StudioMode;
  aspect: string;
  model: string | null;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  setUiError?: Dispatch<SetStateAction<string | null>>;
};

type LibraryMediaReferencePayload = Extract<
  ReferenceIngestionInput,
  { kind: "libraryMedia" }
>["payload"];

type LibraryPromptReferencePayload = {
  id: string;
  promptText: string;
  createdAt?: string | null;
  originFolderId?: string | null;
  title?: string | null;
};

type QuickSlotLibraryPlacement = {
  targetId: string | null;
  placement: "before" | "after" | "end";
};

type IngestedReferenceMediaResult = {
  outputId: string;
  payload: LibraryMediaReferencePayload;
  output: StudioOutput;
};

type IngestedReferenceFileResult = IngestedReferenceMediaResult & {
  file: File;
};

const resolveUploadDestinationTabForReferenceFile = (
  file: File
): MediaUploadDestinationTab | null => {
  const normalizedType = file.type.trim().toLowerCase();
  if (normalizedType.startsWith("image/")) return "uploaded_images";
  if (normalizedType.startsWith("video/")) return "uploaded_videos";
  if (normalizedType.startsWith("audio/")) return "uploaded_images";
  return null;
};

const normalizeReferenceUploadFile = (file: File, index: number): File | null =>
  normalizeMediaFile(file, null, index);

const toLibraryMediaReferencePayloadFromUpload = (
  row: MediaUploadRow
): LibraryMediaReferencePayload => {
  const fileType =
    row.file_type === "video" ? "video" : row.file_type === "audio" ? "audio" : ("image" as const);
  return {
    id: row.id,
    url: row.signedUrl,
    fileType,
    createdAt: row.created_at,
    filename: row.filename,
    promptText: row.filename,
    source: row.source,
    previewStoragePath: row.preview_storage_path,
    fullStoragePath: row.storage_path,
    previewUrl: row.signedUrl,
    fullUrl: row.signedUrl,
  };
};

type UseAiStudioReferenceIngestionActionsResult = {
  addAgentPromptReference: (promptText: string, title?: string | null) => void;
  addPastedPromptReference: (promptText: string) => void;
  addPastedMediaReference: (payload: { url: string; mimeType?: string | null }) => void;
  insertPastedMediaReference: (payload: PastedMediaReference) => StudioOutput[];
  addLibraryMediaReference: (payload: LibraryMediaReferencePayload) => void;
  addLibraryMediaReferenceToQuickSlot: (
    payload: LibraryMediaReferencePayload,
    placement?: QuickSlotLibraryPlacement
  ) => Promise<string | null>;
  addLibraryPromptReference: (payload: LibraryPromptReferencePayload) => void;
  addLibraryPromptReferenceToQuickSlot: (
    payload: LibraryPromptReferencePayload,
    placement?: QuickSlotLibraryPlacement
  ) => string | null;
  ingestReferenceFiles: (
    files: FileList | File[],
    source?: "filePicker" | "drop"
  ) => Promise<IngestedReferenceFileResult[]>;
  addOutputsFromFiles: (files: FileList, source?: "filePicker" | "drop") => Promise<void>;
  getAgentContext: (options?: {
    lastAssistantMessage?: string | null;
    selectedOverride?: StudioOutput | null;
    includeActiveOutput?: boolean;
    modeHint?: "chat" | "text" | "describe" | "reference";
  }) => AgentContext;
};

export const useAiStudioReferenceIngestionActions = ({
  activeOutput = null,
  projectId = null,
  mode,
  aspect,
  model,
  setOutputs,
  updateOutputById,
  setUiError,
}: UseAiStudioReferenceIngestionActionsArgs): UseAiStudioReferenceIngestionActionsResult => {
  const libraryMediaIngestionErrorMessage =
    "Unable to add that media from Media Library right now. Please try again.";
  const buildLibraryMediaOutputWithId = useCallback(
    (payload: LibraryMediaReferencePayload, outputId: string): StudioOutput | null => {
      const result = buildStudioOutputsFromReferenceInputSync(
        {
          kind: "libraryMedia",
          source: "mediaLibrary",
          payload,
        },
        {
          mode,
          aspect,
          model,
          resolveModelLabel,
          randomId,
          nowIso: () => new Date().toISOString(),
        }
      );
      const nextOutput = result.outputs[0];
      if (!nextOutput) return null;
      return {
        ...nextOutput,
        id: outputId,
      };
    },
    [aspect, mode, model]
  );

  const buildLibraryPromptOutputWithId = useCallback(
    (payload: LibraryPromptReferencePayload, outputId: string): StudioOutput | null => {
      const result = buildStudioOutputsFromReferenceInputSync(
        {
          kind: "libraryPrompt",
          source: "mediaLibrary",
          payload,
        },
        {
          mode,
          aspect,
          model,
          resolveModelLabel,
          randomId,
          nowIso: () => new Date().toISOString(),
        }
      );
      const nextOutput = result.outputs[0];
      if (!nextOutput) return null;
      return {
        ...nextOutput,
        id: outputId,
      };
    },
    [aspect, mode, model]
  );

  const insertLibraryMediaReference = useCallback(
    async (payload: LibraryMediaReferencePayload): Promise<IngestedReferenceMediaResult | null> => {
      const outputId = `library-${randomId()}`;
      const optimisticOutput = buildLibraryMediaOutputWithId(payload, outputId);
      if (!optimisticOutput) {
        setUiError?.(libraryMediaIngestionErrorMessage);
        return null;
      }

      setOutputs((prev) => [optimisticOutput, ...prev]);

      if (payload.id && projectId) {
        try {
          await associateMediaFilesWithProject({
            projectId,
            mediaFileIds: [payload.id],
          });
        } catch {
          // Continue hydration even if project association fails transiently.
        }
      }

      let resolvedPayload = payload;
      let resolvedOutput = optimisticOutput;
      try {
        const preparedPayload = await prepareLibraryMediaIngestionPayload(payload);
        const refreshedOutput = buildLibraryMediaOutputWithId(preparedPayload, outputId);
        resolvedPayload = preparedPayload;
        if (refreshedOutput) {
          resolvedOutput = refreshedOutput;
          updateOutputById(outputId, (item) => ({
            ...item,
            prompt: refreshedOutput.prompt,
            model: refreshedOutput.model,
            status: refreshedOutput.status,
            timestamp: refreshedOutput.timestamp,
            resultUrls: refreshedOutput.resultUrls,
            previewUrl: refreshedOutput.previewUrl,
            previewPosterUrl: refreshedOutput.previewPosterUrl,
            previewPosterStoragePath: refreshedOutput.previewPosterStoragePath,
            companionArtUrl: refreshedOutput.companionArtUrl,
            companionArtStoragePath: refreshedOutput.companionArtStoragePath,
            previewStoragePath: refreshedOutput.previewStoragePath,
            fullStoragePath: refreshedOutput.fullStoragePath,
            mediaSource: refreshedOutput.mediaSource,
            previewTier: refreshedOutput.previewTier,
            savedMediaIds: refreshedOutput.savedMediaIds,
          }));
        }
      } catch {
        // Keep the optimistic card visible. The current drag payload already contains
        // a renderable preview candidate for right-rail insertion.
      }

      return {
        outputId,
        payload: resolvedPayload,
        output: resolvedOutput,
      };
    },
    [
      buildLibraryMediaOutputWithId,
      libraryMediaIngestionErrorMessage,
      projectId,
      setOutputs,
      setUiError,
      updateOutputById,
    ]
  );

  const insertLibraryPromptReference = useCallback(
    (payload: LibraryPromptReferencePayload): string | null => {
      const outputId = `prompt-library-${randomId()}`;
      const promptOutput = buildLibraryPromptOutputWithId(payload, outputId);
      if (!promptOutput) return null;
      setOutputs((prev) => [promptOutput, ...prev]);
      return outputId;
    },
    [buildLibraryPromptOutputWithId, setOutputs]
  );

  const addAgentPromptReference = useCallback(
    (promptText: string, title?: string | null) => {
      const result = buildStudioOutputsFromReferenceInputSync(
        {
          kind: "prompt",
          source: "agent",
          promptText,
          title,
        },
        {
          mode,
          aspect,
          model,
          resolveModelLabel,
          randomId,
          nowIso: () => new Date().toISOString(),
        }
      );
      const [promptReference] = result.outputs;
      if (!promptReference) return;
      setOutputs((prev) => [promptReference, ...prev]);
    },
    [aspect, mode, model, setOutputs]
  );

  const addPastedPromptReference = useCallback(
    (promptText: string) => {
      const result = buildStudioOutputsFromReferenceInputSync(
        {
          kind: "prompt",
          source: "paste",
          promptText,
        },
        {
          mode,
          aspect,
          model,
          resolveModelLabel,
          randomId,
          nowIso: () => new Date().toISOString(),
        }
      );
      if (!result.outputs.length) return;
      setOutputs((prev) => [...result.outputs, ...prev]);
    },
    [aspect, mode, model, setOutputs]
  );

  const addPastedMediaReference = useCallback(
    (payload: { url: string; mimeType?: string | null }) => {
      const result = buildStudioOutputsFromReferenceInputSync(
        {
          kind: "mediaUrl",
          source: "paste",
          url: payload.url,
          mimeType: payload.mimeType,
        },
        {
          mode,
          aspect,
          model,
          resolveModelLabel,
          randomId,
          nowIso: () => new Date().toISOString(),
        }
      );
      if (!result.outputs.length) return [];
      setOutputs((prev) => [...result.outputs, ...prev]);
      return result.outputs;
    },
    [aspect, mode, model, setOutputs]
  );

  const insertPastedMediaReference = useCallback(
    (payload: PastedMediaReference): StudioOutput[] => addPastedMediaReference(payload) ?? [],
    [addPastedMediaReference]
  );

  const addLibraryMediaReference = useCallback(
    (payload: LibraryMediaReferencePayload) => {
      void insertLibraryMediaReference(payload);
    },
    [insertLibraryMediaReference]
  );

  const addLibraryPromptReference = useCallback(
    (payload: LibraryPromptReferencePayload) => {
      insertLibraryPromptReference(payload);
    },
    [insertLibraryPromptReference]
  );

  const addLibraryMediaReferenceToQuickSlot = useCallback(
    async (payload: LibraryMediaReferencePayload): Promise<string | null> => {
      const inserted = await insertLibraryMediaReference(payload);
      return inserted?.outputId ?? null;
    },
    [insertLibraryMediaReference]
  );

  const addLibraryPromptReferenceToQuickSlot = useCallback(
    (payload: LibraryPromptReferencePayload): string | null => {
      return insertLibraryPromptReference(payload);
    },
    [insertLibraryPromptReference]
  );

  const ingestReferenceFiles = useCallback(
    async (files: FileList | File[]): Promise<IngestedReferenceFileResult[]> => {
      const orderedFiles = Array.from(files);
      const supportedCandidates = orderedFiles
        .map((file, index) => {
          const normalizedFile = normalizeReferenceUploadFile(file, index);
          return {
            file: normalizedFile,
            destinationTab: normalizedFile
              ? resolveUploadDestinationTabForReferenceFile(normalizedFile)
              : null,
          };
        })
        .filter(
          (
            candidate
          ): candidate is {
            file: File;
            destinationTab: MediaUploadDestinationTab;
          } => candidate.destinationTab !== null
        );
      const rejectedFileCount = Math.max(0, orderedFiles.length - supportedCandidates.length);
      let importedCount = 0;
      let firstErrorMessage: string | null = null;
      const insertedResults: IngestedReferenceFileResult[] = [];

      for (let index = supportedCandidates.length - 1; index >= 0; index -= 1) {
        const candidate = supportedCandidates[index];
        if (!candidate) continue;
        try {
          const uploaded = await uploadMediaFile({
            file: candidate.file,
            destinationTab: candidate.destinationTab,
          });
          const inserted = await insertLibraryMediaReference(
            toLibraryMediaReferencePayloadFromUpload(uploaded)
          );
          if (inserted) {
            insertedResults.unshift({
              ...inserted,
              file: candidate.file,
            });
          }
          importedCount += 1;
        } catch (error) {
          if (!firstErrorMessage) {
            firstErrorMessage =
              error instanceof Error && error.message.trim().length
                ? error.message.trim()
                : "Unable to add those files right now. Please try again.";
          }
        }
      }

      if (importedCount === 0) {
        if (firstErrorMessage || rejectedFileCount > 0) {
          setUiError?.(
            firstErrorMessage ?? "Unable to add those files right now. Please try again."
          );
        }
        return [];
      }

      if (firstErrorMessage || rejectedFileCount > 0) {
        setUiError?.("Some files could not be added. The rest were added.");
      }
      return insertedResults;
    },
    [insertLibraryMediaReference, setUiError]
  );

  const addOutputsFromFiles = useCallback(
    async (files: FileList) => {
      await ingestReferenceFiles(files);
    },
    [ingestReferenceFiles]
  );

  const getAgentContext = useCallback(
    (options?: {
      lastAssistantMessage?: string | null;
      selectedOverride?: StudioOutput | null;
      includeActiveOutput?: boolean;
      modeHint?: "chat" | "text" | "describe" | "reference";
    }): AgentContext => {
      const selected =
        options?.selectedOverride === null
          ? null
          : (options?.selectedOverride ?? (options?.includeActiveOutput ? activeOutput : null));
      return buildAiStudioAgentContext({
        selected,
        model,
        mode,
        lastAssistantMessage: options?.lastAssistantMessage ?? null,
        modeHint: options?.modeHint,
      });
    },
    [activeOutput, model, mode]
  );

  return {
    addAgentPromptReference,
    addPastedPromptReference,
    addPastedMediaReference,
    insertPastedMediaReference,
    addLibraryMediaReference,
    addLibraryMediaReferenceToQuickSlot,
    addLibraryPromptReference,
    addLibraryPromptReferenceToQuickSlot,
    ingestReferenceFiles,
    addOutputsFromFiles,
    getAgentContext,
  };
};
