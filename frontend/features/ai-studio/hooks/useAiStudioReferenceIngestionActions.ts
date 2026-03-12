/**
 * Reference ingestion action bundle for AI Studio state.
 * Centralizes agent/paste/library/file ingestion callbacks and agent-context projection.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { AgentContext } from "../../ai-agent/types";
import { randomId } from "../logic/ids";
import { resolveModelLabel } from "../logic/stateParsers";
import type { StudioMode, StudioOutput } from "../types";
import {
  buildStudioOutputsFromReferenceInput,
  buildStudioOutputsFromReferenceInputSync,
} from "../reference-ingestion";
import { prepareLibraryMediaIngestionPayload } from "../reference-ingestion/prepareLibraryMediaIngestionPayload";
import { buildAiStudioAgentContext } from "./stateAdapters/agentContextAdapter";

type UseAiStudioReferenceIngestionActionsArgs = {
  mode: StudioMode;
  aspect: string;
  model: string | null;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  setSharedPrompt: (value: string) => void;
};

type UseAiStudioReferenceIngestionActionsResult = {
  addAgentPromptReference: (promptText: string, title?: string | null) => void;
  addPastedPromptReference: (promptText: string) => void;
  addPastedMediaReference: (payload: { url: string; mimeType?: string | null }) => void;
  addLibraryMediaReference: (payload: {
    id: string;
    url: string;
    fileType: "image" | "video";
    originFolderId?: string | null;
    filename?: string | null;
    promptText?: string | null;
    source?: string | null;
    previewStoragePath?: string | null;
    fullStoragePath?: string | null;
    previewUrl?: string | null;
    fullUrl?: string | null;
  }) => void;
  addLibraryPromptReference: (payload: {
    id: string;
    promptText: string;
    originFolderId?: string | null;
    title?: string | null;
  }) => void;
  addOutputsFromFiles: (files: FileList, source?: "filePicker" | "drop") => Promise<void>;
  getAgentContext: (options?: {
    lastAssistantMessage?: string | null;
    selectedOverride?: StudioOutput | null;
    modeHint?: "chat" | "text" | "describe" | "reference";
  }) => AgentContext;
};

export const useAiStudioReferenceIngestionActions = ({
  mode,
  aspect,
  model,
  setOutputs,
  setSharedPrompt,
}: UseAiStudioReferenceIngestionActionsArgs): UseAiStudioReferenceIngestionActionsResult => {
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
      setSharedPrompt(promptReference.prompt);
    },
    [aspect, mode, model, setOutputs, setSharedPrompt]
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
        }
      );
      if (!result.outputs.length) return;
      setOutputs((prev) => [...result.outputs, ...prev]);
    },
    [aspect, mode, model, setOutputs]
  );

  const addLibraryMediaReference = useCallback(
    (payload: {
      id: string;
      url: string;
      fileType: "image" | "video";
      originFolderId?: string | null;
      filename?: string | null;
      promptText?: string | null;
      source?: string | null;
      previewStoragePath?: string | null;
      fullStoragePath?: string | null;
      previewUrl?: string | null;
      fullUrl?: string | null;
    }) => {
      void (async () => {
        const preparedPayload = await prepareLibraryMediaIngestionPayload(payload);
        const result = buildStudioOutputsFromReferenceInputSync(
          {
            kind: "libraryMedia",
            source: "mediaLibrary",
            payload: preparedPayload,
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
      })();
    },
    [aspect, mode, model, setOutputs]
  );

  const addLibraryPromptReference = useCallback(
    (payload: {
      id: string;
      promptText: string;
      originFolderId?: string | null;
      title?: string | null;
    }) => {
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
      if (!result.outputs.length) return;
      setOutputs((prev) => [...result.outputs, ...prev]);
    },
    [aspect, mode, model, setOutputs]
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
      setOutputs((prev) => [...result.outputs, ...prev]);
    },
    [aspect, model, mode, setOutputs]
  );

  const getAgentContext = useCallback(
    (options?: {
      lastAssistantMessage?: string | null;
      selectedOverride?: StudioOutput | null;
      modeHint?: "chat" | "text" | "describe" | "reference";
    }): AgentContext => {
      return buildAiStudioAgentContext({
        selected: options?.selectedOverride ?? null,
        model,
        mode,
        lastAssistantMessage: options?.lastAssistantMessage ?? null,
        modeHint: options?.modeHint,
      });
    },
    [model, mode]
  );

  return {
    addAgentPromptReference,
    addPastedPromptReference,
    addPastedMediaReference,
    addLibraryMediaReference,
    addLibraryPromptReference,
    addOutputsFromFiles,
    getAgentContext,
  };
};
