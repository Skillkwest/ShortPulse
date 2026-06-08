/**
 * Reference ingestion action bundle for AI Studio state.
 * Centralizes agent/paste/library/file ingestion callbacks and agent-context projection.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useResolvedProtectedSessionState } from "../../../lib/protectedRouteSessionContext";
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
import {
  admitReferenceGridIncomingOutputs,
  buildReferenceGridPartialCapMessage,
  getReferenceGridAvailableSlots,
  REFERENCE_GRID_CAP_REACHED_MESSAGE,
} from "../reference-grid/logic/referenceGridLimits";
import { buildAiStudioAgentContext } from "./stateAdapters/agentContextAdapter";

type UseAiStudioReferenceIngestionActionsArgs = {
  activeOutput?: StudioOutput | null;
  projectId?: string | null;
  outputs: StudioOutput[];
  mode: StudioMode;
  aspect: string;
  model: string | null;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
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
  placement: "start" | "before" | "after" | "end";
};

type IngestedReferenceMediaResult = {
  outputId: string;
  payload: LibraryMediaReferencePayload;
  output: StudioOutput;
};

type InsertLibraryMediaReferenceOptions = {
  waitForPreparedPayload?: boolean;
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
  // The Media Library upload API uses uploaded_images as the legacy mixed non-video
  // destination; the persisted media row's file_type preserves audio semantics.
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
  outputs,
  mode,
  aspect,
  model,
  setOutputs,
  setUiError,
}: UseAiStudioReferenceIngestionActionsArgs): UseAiStudioReferenceIngestionActionsResult => {
  const sessionSnapshot = useResolvedProtectedSessionState();
  const currentUserId = sessionSnapshot.user?.id ?? null;
  const libraryMediaIngestionErrorMessage =
    "Unable to add that media from Media Library right now. Please try again.";
  const admitIncomingOutputs = useCallback(
    (incoming: StudioOutput[]): StudioOutput[] => {
      const admission = admitReferenceGridIncomingOutputs(incoming, outputs);
      if (admission.skipped.length > 0) {
        setUiError?.(
          admission.skipped.length === 1
            ? REFERENCE_GRID_CAP_REACHED_MESSAGE
            : buildReferenceGridPartialCapMessage(admission.skipped.length)
        );
      }
      return admission.admitted;
    },
    [outputs, setUiError]
  );
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
    async (
      payload: LibraryMediaReferencePayload,
      options: InsertLibraryMediaReferenceOptions = {}
    ): Promise<IngestedReferenceMediaResult | null> => {
      const outputId = `library-${randomId()}`;

      const associateWithProject = () => {
        if (!payload.id || !projectId) return;
        void (async () => {
          try {
            await associateMediaFilesWithProject({
              projectId,
              mediaFileIds: [payload.id],
              userId: currentUserId,
            });
          } catch {
            // Project membership should not block media authority hydration.
          }
        })();
      };

      const buildPreparedOutput = async (): Promise<IngestedReferenceMediaResult | null> => {
        try {
          const preparedPayload = await prepareLibraryMediaIngestionPayload(payload);
          const preparedOutput = buildLibraryMediaOutputWithId(preparedPayload, outputId);
          return preparedOutput
            ? {
                outputId,
                payload: preparedPayload,
                output: preparedOutput,
              }
            : null;
        } catch {
          return null;
        }
      };

      if (options.waitForPreparedPayload) {
        const prepared = await buildPreparedOutput();
        const output = prepared?.output ?? buildLibraryMediaOutputWithId(payload, outputId);
        if (!output) {
          setUiError?.(libraryMediaIngestionErrorMessage);
          return null;
        }
        const [admittedOutput] = admitIncomingOutputs([output]);
        if (!admittedOutput) return null;
        associateWithProject();
        setOutputs((prev) => [output, ...prev]);
        return prepared ?? { outputId, payload, output };
      }

      const optimisticOutput = buildLibraryMediaOutputWithId(payload, outputId);
      if (!optimisticOutput) {
        setUiError?.(libraryMediaIngestionErrorMessage);
        return null;
      }
      const [admittedOutput] = admitIncomingOutputs([optimisticOutput]);
      if (!admittedOutput) return null;

      associateWithProject();
      setOutputs((prev) => [optimisticOutput, ...prev]);

      void (async () => {
        const prepared = await buildPreparedOutput();
        if (!prepared) return;
        try {
          setOutputs((prev) =>
            prev.map((item) =>
              item.id === outputId
                ? {
                    ...item,
                    prompt: prepared.output.prompt,
                    model: prepared.output.model,
                    status: prepared.output.status,
                    timestamp: prepared.output.timestamp,
                    resultUrls: prepared.output.resultUrls,
                    previewUrl: prepared.output.previewUrl,
                    previewPosterUrl: prepared.output.previewPosterUrl,
                    previewPosterStoragePath: prepared.output.previewPosterStoragePath,
                    companionArtUrl: prepared.output.companionArtUrl,
                    companionArtStoragePath: prepared.output.companionArtStoragePath,
                    previewStoragePath: prepared.output.previewStoragePath,
                    fullStoragePath: prepared.output.fullStoragePath,
                    mediaSource: prepared.output.mediaSource,
                    previewTier: prepared.output.previewTier,
                    savedMediaIds: prepared.output.savedMediaIds,
                  }
                : item
            )
          );
        } catch {
          // Keep the optimistic card visible. The current drag payload already contains
          // a renderable preview candidate for right-rail insertion.
        }
      })();

      return {
        outputId,
        payload,
        output: optimisticOutput,
      };
    },
    [
      buildLibraryMediaOutputWithId,
      libraryMediaIngestionErrorMessage,
      admitIncomingOutputs,
      currentUserId,
      projectId,
      setOutputs,
      setUiError,
    ]
  );

  const insertLibraryPromptReference = useCallback(
    (payload: LibraryPromptReferencePayload): string | null => {
      const outputId = `prompt-library-${randomId()}`;
      const promptOutput = buildLibraryPromptOutputWithId(payload, outputId);
      if (!promptOutput) return null;
      const [admittedOutput] = admitIncomingOutputs([promptOutput]);
      if (!admittedOutput) return null;
      setOutputs((prev) => [promptOutput, ...prev]);
      return outputId;
    },
    [admitIncomingOutputs, buildLibraryPromptOutputWithId, setOutputs]
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
      const admittedOutputs = admitIncomingOutputs([promptReference]);
      if (!admittedOutputs.length) return;
      setOutputs((prev) => [...admittedOutputs, ...prev]);
    },
    [admitIncomingOutputs, aspect, mode, model, setOutputs]
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
      const admittedOutputs = admitIncomingOutputs(result.outputs);
      if (!admittedOutputs.length) return;
      setOutputs((prev) => [...admittedOutputs, ...prev]);
    },
    [admitIncomingOutputs, aspect, mode, model, setOutputs]
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
      const admittedOutputs = admitIncomingOutputs(result.outputs);
      if (!admittedOutputs.length) return [];
      setOutputs((prev) => [...admittedOutputs, ...prev]);
      return admittedOutputs;
    },
    [admitIncomingOutputs, aspect, mode, model, setOutputs]
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
      const availableSlots = getReferenceGridAvailableSlots(outputs);
      const uploadCandidates = supportedCandidates.slice(0, availableSlots);
      const skippedForCapCount = Math.max(0, supportedCandidates.length - uploadCandidates.length);
      let importedCount = 0;
      let firstErrorMessage: string | null = null;
      const insertedResults: IngestedReferenceFileResult[] = [];

      for (let index = uploadCandidates.length - 1; index >= 0; index -= 1) {
        const candidate = uploadCandidates[index];
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
        if (skippedForCapCount > 0 && !firstErrorMessage && rejectedFileCount === 0) {
          setUiError?.(buildReferenceGridPartialCapMessage(skippedForCapCount));
          return [];
        }
        if (firstErrorMessage || rejectedFileCount > 0) {
          setUiError?.(
            firstErrorMessage ?? "Unable to add those files right now. Please try again."
          );
        }
        return [];
      }

      if (skippedForCapCount > 0) {
        setUiError?.(buildReferenceGridPartialCapMessage(skippedForCapCount));
        return insertedResults;
      }

      if (firstErrorMessage || rejectedFileCount > 0) {
        setUiError?.("Some files could not be added. The rest were added.");
      }
      return insertedResults;
    },
    [insertLibraryMediaReference, outputs, setUiError]
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
