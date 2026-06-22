/**
 * Reference ingestion action bundle for AI Studio state.
 * Centralizes agent/paste/library/file ingestion callbacks and agent-context projection.
 */
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
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
import { rememberObjectUrlBlob } from "../utils/objectUrlBlobRegistry";

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

type PendingReferenceFileUpload = {
  file: File;
  destinationTab: MediaUploadDestinationTab;
  outputId: string;
  optimisticOutput: StudioOutput;
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

const createLocalPreviewUrls = (
  file: File
): {
  previewUrl?: string;
  localObjectUrl?: string | null;
} => {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return {};
  }
  try {
    const objectUrl = URL.createObjectURL(file);
    rememberObjectUrlBlob(objectUrl, file);
    if (file.type.startsWith("video/")) {
      return {
        previewUrl: `${objectUrl}#video=1`,
        localObjectUrl: objectUrl,
      };
    }
    if (file.type.startsWith("audio/")) {
      return {
        previewUrl: objectUrl,
        localObjectUrl: objectUrl,
      };
    }
    return {
      previewUrl: objectUrl,
      localObjectUrl: objectUrl,
    };
  } catch {
    return {};
  }
};

const buildPendingReferenceFileOutput = ({
  file,
  outputId,
  source,
  aspect,
  model,
}: {
  file: File;
  outputId: string;
  source: "filePicker" | "drop";
  aspect: string;
  model: string | null;
}): StudioOutput => {
  const isAudio = file.type.startsWith("audio/");
  const isVideo = !isAudio && file.type.startsWith("video/");
  const localPreview = createLocalPreviewUrls(file);
  const modelLabel = model ? resolveModelLabel(model) : "Upload pending";
  return {
    id: outputId,
    prompt: file.name || "Media upload",
    title: isAudio ? file.name || null : null,
    mode: isAudio ? "audio" : isVideo ? "video" : "image",
    aspect,
    model: modelLabel,
    createdAt: new Date().toISOString(),
    modelId: model ?? undefined,
    status: "ready",
    timestamp: source === "drop" ? "Dropped" : "Uploaded",
    taskState: "pending",
    previewUrl: localPreview.previewUrl,
    previewPosterUrl: null,
    previewStoragePath: null,
    fullStoragePath: null,
    previewTier: "full",
    mimeType: file.type || null,
    mediaSource: "upload",
    localObjectUrl: localPreview.localObjectUrl,
    saveState: "saving",
    saveError: null,
    archivedAt: null,
    archiveReason: null,
  };
};

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

const applyLibraryMediaOutputPatch = (
  current: StudioOutput,
  prepared: StudioOutput
): StudioOutput => ({
  ...current,
  prompt: prepared.prompt,
  title: prepared.title,
  transcriptText: prepared.transcriptText,
  mode: prepared.mode,
  aspect: prepared.aspect,
  model: prepared.model,
  modelId: prepared.modelId,
  status: prepared.status,
  timestamp: prepared.timestamp,
  taskId: prepared.taskId,
  queueState: prepared.queueState,
  taskState: prepared.taskState,
  errorMessage: prepared.errorMessage,
  errorMessageShort: prepared.errorMessageShort,
  errorDetail: prepared.errorDetail,
  resultUrls: prepared.resultUrls,
  previewUrl: prepared.previewUrl,
  previewPosterUrl: prepared.previewPosterUrl,
  previewPosterStoragePath: prepared.previewPosterStoragePath,
  companionArtUrl: prepared.companionArtUrl,
  companionArtStoragePath: prepared.companionArtStoragePath,
  previewStoragePath: prepared.previewStoragePath,
  fullStoragePath: prepared.fullStoragePath,
  previewTier: prepared.previewTier,
  mimeType: prepared.mimeType,
  audioSourceMode: prepared.audioSourceMode,
  durationMs: prepared.durationMs,
  waveformPeaks: prepared.waveformPeaks,
  mediaSource: prepared.mediaSource,
  localObjectUrl: prepared.localObjectUrl,
  saveState: prepared.saveState,
  saveError: prepared.saveError,
  savedMediaIds: prepared.savedMediaIds,
});

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
  const visibleOutputIdSetRef = useRef(new Set(outputs.map((output) => output.id)));
  const libraryMediaIngestionErrorMessage =
    "Unable to add that media from Media Library right now. Please try again.";
  useEffect(() => {
    visibleOutputIdSetRef.current = new Set(outputs.map((output) => output.id));
  }, [outputs]);
  const isReferenceOutputStillVisible = useCallback(
    (outputId: string): boolean => visibleOutputIdSetRef.current.has(outputId),
    []
  );
  const associateMediaWithProject = useCallback(
    (mediaFileId: string | null | undefined) => {
      if (!mediaFileId || !projectId) return;
      void (async () => {
        try {
          await associateMediaFilesWithProject({
            projectId,
            mediaFileIds: [mediaFileId],
            userId: currentUserId,
          });
        } catch {
          // Project membership should not block media authority hydration.
        }
      })();
    },
    [currentUserId, projectId]
  );
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
        associateMediaWithProject(payload.id);
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

      associateMediaWithProject(payload.id);
      setOutputs((prev) => [optimisticOutput, ...prev]);
      visibleOutputIdSetRef.current = new Set([
        optimisticOutput.id,
        ...visibleOutputIdSetRef.current,
      ]);

      void (async () => {
        const prepared = await buildPreparedOutput();
        if (!prepared) return;
        if (!isReferenceOutputStillVisible(outputId)) return;
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
      associateMediaWithProject,
      isReferenceOutputStillVisible,
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
    async (
      files: FileList | File[],
      source: "filePicker" | "drop" = "filePicker"
    ): Promise<IngestedReferenceFileResult[]> => {
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
      const pendingUploads: PendingReferenceFileUpload[] = uploadCandidates.map((candidate) => {
        const outputId = `upload-${randomId()}`;
        return {
          ...candidate,
          outputId,
          optimisticOutput: buildPendingReferenceFileOutput({
            file: candidate.file,
            outputId,
            source,
            aspect,
            model,
          }),
        };
      });

      if (pendingUploads.length > 0) {
        setOutputs((prev) => [
          ...pendingUploads.map((candidate) => candidate.optimisticOutput),
          ...prev,
        ]);
        visibleOutputIdSetRef.current = new Set([
          ...pendingUploads.map((candidate) => candidate.outputId),
          ...visibleOutputIdSetRef.current,
        ]);
      }

      for (const candidate of pendingUploads) {
        try {
          const uploaded = await uploadMediaFile({
            file: candidate.file,
            destinationTab: candidate.destinationTab,
          });
          if (!isReferenceOutputStillVisible(candidate.outputId)) {
            continue;
          }
          const payload = toLibraryMediaReferencePayloadFromUpload(uploaded);
          const uploadedOutput = buildLibraryMediaOutputWithId(payload, candidate.outputId);
          if (!uploadedOutput) {
            throw new Error("Unable to add those files right now. Please try again.");
          }
          associateMediaWithProject(payload.id);
          setOutputs((prev) =>
            prev.map((item) =>
              item.id === candidate.outputId
                ? applyLibraryMediaOutputPatch(item, uploadedOutput)
                : item
            )
          );
          void (async () => {
            try {
              const preparedPayload = await prepareLibraryMediaIngestionPayload(payload);
              if (!isReferenceOutputStillVisible(candidate.outputId)) return;
              const preparedOutput = buildLibraryMediaOutputWithId(
                preparedPayload,
                candidate.outputId
              );
              if (!preparedOutput) return;
              setOutputs((prev) =>
                prev.map((item) =>
                  item.id === candidate.outputId
                    ? applyLibraryMediaOutputPatch(item, preparedOutput)
                    : item
                )
              );
            } catch {
              // Keep the already uploaded card visible when optional payload prep fails.
            }
          })();
          insertedResults.push({
            outputId: candidate.outputId,
            payload,
            output: uploadedOutput,
            file: candidate.file,
          });
          importedCount += 1;
        } catch (error) {
          setOutputs((prev) => prev.filter((item) => item.id !== candidate.outputId));
          visibleOutputIdSetRef.current.delete(candidate.outputId);
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
    [
      aspect,
      associateMediaWithProject,
      buildLibraryMediaOutputWithId,
      isReferenceOutputStillVisible,
      model,
      outputs,
      setOutputs,
      setUiError,
    ]
  );

  const addOutputsFromFiles = useCallback(
    async (files: FileList, source: "filePicker" | "drop" = "filePicker") => {
      await ingestReferenceFiles(files, source);
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
