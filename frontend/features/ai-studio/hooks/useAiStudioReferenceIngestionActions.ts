/**
 * Reference ingestion action bundle for AI Studio state.
 * Centralizes agent/paste/library/file ingestion callbacks and agent-context projection.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { AgentContext } from "../../ai-agent/types";
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import { randomId } from "../logic/ids";
import { associateMediaFilesWithProject } from "../logic/mediaLibraryPersistence";
import { resolveModelLabel } from "../logic/stateParsers";
import type { StudioMode, StudioOutput } from "../types";
import {
  buildStudioOutputsFromReferenceInput,
  buildStudioOutputsFromReferenceInputSync,
} from "../reference-ingestion";
import { prepareLibraryMediaIngestionPayload } from "../reference-ingestion/prepareLibraryMediaIngestionPayload";
import type { LibraryMediaFileType } from "../reference-ingestion/types";
import { uploadAudioAssetToStorage } from "../utils/audioUpload";
import { uploadImageAssetToStorage } from "../utils/imageUpload";
import { uploadVideoAssetToStorage } from "../utils/videoUpload";
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

type LibraryMediaReferencePayload = {
  id: string;
  url: string;
  fileType: LibraryMediaFileType;
  originFolderId?: string | null;
  filename?: string | null;
  promptText?: string | null;
  source?: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  previewUrl?: string | null;
  previewPosterUrl?: string | null;
  previewPosterStoragePath?: string | null;
  fullUrl?: string | null;
};

type LibraryPromptReferencePayload = {
  id: string;
  promptText: string;
  originFolderId?: string | null;
  title?: string | null;
};

type QuickSlotLibraryPlacement = {
  targetId: string | null;
  placement: "before" | "after" | "end";
};

type UseAiStudioReferenceIngestionActionsResult = {
  addAgentPromptReference: (promptText: string, title?: string | null) => void;
  addPastedPromptReference: (promptText: string) => void;
  addPastedMediaReference: (payload: { url: string; mimeType?: string | null }) => void;
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
  addOutputsFromFiles: (files: FileList, source?: "filePicker" | "drop") => Promise<void>;
  getAgentContext: (options?: {
    lastAssistantMessage?: string | null;
    selectedOverride?: StudioOutput | null;
    includeActiveOutput?: boolean;
    modeHint?: "chat" | "text" | "describe" | "reference";
  }) => AgentContext;
};

const isTransientLocalMediaUrl = (value: string | null | undefined): boolean => {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  return normalized.startsWith("blob:") || normalized.startsWith("data:");
};

const hasProjectRouteDurabilityRisk = (output: StudioOutput): boolean =>
  isTransientLocalMediaUrl(output.previewUrl) ||
  (output.mode === "video" && isTransientLocalMediaUrl(output.previewPosterUrl));

const revokeLocalObjectUrlIfPresent = (value: string | null | undefined): void => {
  if (typeof value !== "string") return;
  const normalized = value.trim();
  if (!normalized.startsWith("blob:")) return;
  try {
    URL.revokeObjectURL(normalized);
  } catch {
    // Best-effort cleanup only.
  }
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
  const projectMediaDurabilityErrorMessage =
    "Unable to add that media to the project right now. Please try again.";
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
    async (payload: LibraryMediaReferencePayload): Promise<string | null> => {
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

      try {
        const preparedPayload = await prepareLibraryMediaIngestionPayload(payload);
        const refreshedOutput = buildLibraryMediaOutputWithId(preparedPayload, outputId);
        if (!refreshedOutput) return outputId;
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
          previewStoragePath: refreshedOutput.previewStoragePath,
          fullStoragePath: refreshedOutput.fullStoragePath,
          mediaSource: refreshedOutput.mediaSource,
          previewTier: refreshedOutput.previewTier,
          savedMediaIds: refreshedOutput.savedMediaIds,
        }));
      } catch {
        // Keep the optimistic card visible. The current drag payload already contains
        // a renderable preview candidate for right-rail insertion.
      }

      return outputId;
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

  const durabilizeProjectReferenceOutput = useCallback(
    async (output: StudioOutput): Promise<StudioOutput> => {
      if (!projectId || !hasProjectRouteDurabilityRisk(output)) {
        return output;
      }

      const previewUrl = output.previewUrl?.trim() ?? "";
      if (!previewUrl) return output;

      let uploaded: { url: string; path: string } | null = null;
      let uploadedPoster: { url: string; path: string } | null = null;

      if (output.mode === "video") {
        uploaded = await uploadVideoAssetToStorage(previewUrl);
        const previewPosterUrl = output.previewPosterUrl?.trim() ?? "";
        if (previewPosterUrl) {
          uploadedPoster = await uploadImageAssetToStorage(previewPosterUrl);
        }
      } else if (output.mode === "audio") {
        uploaded = await uploadAudioAssetToStorage(previewUrl);
      } else {
        uploaded = await uploadImageAssetToStorage(previewUrl);
      }

      const canonicalPath = asCanonicalStoragePath(uploaded.path);
      const signedUrl = uploaded.url?.trim() ?? "";
      if (!canonicalPath || !signedUrl) {
        throw new Error("Project reference durability upload returned invalid metadata.");
      }

      const canonicalPosterPath =
        output.mode === "video" ? asCanonicalStoragePath(uploadedPoster?.path) : null;
      const signedPosterUrl =
        output.mode === "video" ? (uploadedPoster?.url?.trim() ?? null) : null;

      revokeLocalObjectUrlIfPresent(output.localObjectUrl);

      return {
        ...output,
        previewUrl: signedUrl,
        previewPosterUrl: output.mode === "video" ? signedPosterUrl : null,
        previewPosterStoragePath: output.mode === "video" ? canonicalPosterPath : null,
        previewStoragePath: canonicalPosterPath ?? canonicalPath,
        fullStoragePath: canonicalPath,
        resultUrls:
          output.mode === "audio" || output.mode === "video" || output.mode === "image"
            ? [signedUrl]
            : output.resultUrls,
        localObjectUrl: undefined,
      };
    },
    [projectId]
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
        }
      );
      if (!result.outputs.length) return;
      setOutputs((prev) => [...result.outputs, ...prev]);
    },
    [aspect, mode, model, setOutputs]
  );

  const addPastedMediaReference = useCallback(
    async (payload: { url: string; mimeType?: string | null }) => {
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
        }
      );
      if (!result.outputs.length) return;
      try {
        const outputs =
          projectId == null
            ? result.outputs
            : await Promise.all(result.outputs.map(durabilizeProjectReferenceOutput));
        if (!outputs.length) return;
        setOutputs((prev) => [...outputs, ...prev]);
      } catch {
        setUiError?.(projectMediaDurabilityErrorMessage);
      }
    },
    [
      aspect,
      durabilizeProjectReferenceOutput,
      mode,
      model,
      projectId,
      projectMediaDurabilityErrorMessage,
      setOutputs,
      setUiError,
    ]
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
      return await insertLibraryMediaReference(payload);
    },
    [insertLibraryMediaReference]
  );

  const addLibraryPromptReferenceToQuickSlot = useCallback(
    (payload: LibraryPromptReferencePayload): string | null => {
      return insertLibraryPromptReference(payload);
    },
    [insertLibraryPromptReference]
  );

  const addOutputsFromFiles = useCallback(
    async (files: FileList, source: "filePicker" | "drop" = "filePicker") => {
      const result = await buildStudioOutputsFromReferenceInput(
        {
          kind: "files",
          source,
          files,
        },
        {
          mode,
          aspect,
          model,
          resolveModelLabel,
          randomId,
        }
      );
      if (!result.outputs.length) return;
      try {
        const outputs =
          projectId == null
            ? result.outputs
            : await Promise.all(result.outputs.map(durabilizeProjectReferenceOutput));
        if (!outputs.length) return;
        setOutputs((prev) => [...outputs, ...prev]);
      } catch {
        setUiError?.(projectMediaDurabilityErrorMessage);
      }
    },
    [
      aspect,
      durabilizeProjectReferenceOutput,
      model,
      mode,
      projectId,
      projectMediaDurabilityErrorMessage,
      setOutputs,
      setUiError,
    ]
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
    addLibraryMediaReference,
    addLibraryMediaReferenceToQuickSlot,
    addLibraryPromptReference,
    addLibraryPromptReferenceToQuickSlot,
    addOutputsFromFiles,
    getAgentContext,
  };
};
