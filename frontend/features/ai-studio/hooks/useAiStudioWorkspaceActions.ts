/**
 * Workspace action hook for AI Studio.
 * Centralizes page-level selection handlers and workspace file/media actions.
 */
import { useCallback, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import type { ModelModalContext } from "../components/ModelModal";
import type { PromptOrigin } from "../logic/agentPromptOwnership";
import { isReferencePromptTool } from "../logic/promptTargeting";
import { normalizeToolId } from "../logic/workflowIdentity";
import type { StudioMode, ToolId } from "../types";

type UseAiStudioWorkspaceActionsParams = {
  selectedTool: ToolId | null;
  setSelectedTool: (tool: ToolId | null) => void;
  setMode: Dispatch<SetStateAction<StudioMode>>;
  setShowCreateTools: Dispatch<SetStateAction<boolean>>;
  setVideoReferenceText: (value: string) => void;
  setEditReferenceText: (value: string) => void;
  setSharedPrompt: (value: string) => void;
  setPromptOrigin: Dispatch<SetStateAction<PromptOrigin>>;
  openModelModal: (
    anchorId: string,
    target: HTMLElement,
    context: ModelModalContext | null
  ) => void;
  closeModelModal: () => void;
  setModel: (value: string) => void;
  addCharacterReferences: (files: FileList) => void;
  addOutputsFromFiles: (files: FileList, source?: "filePicker" | "drop") => void;
  setActiveOutputId: Dispatch<SetStateAction<string | null>>;
};

/**
 * Returns stable workspace action handlers for tool/model/file/media interactions.
 */
export const useAiStudioWorkspaceActions = ({
  selectedTool,
  setSelectedTool,
  setMode,
  setShowCreateTools,
  setVideoReferenceText,
  setEditReferenceText,
  setSharedPrompt,
  setPromptOrigin,
  openModelModal,
  closeModelModal,
  setModel,
  addCharacterReferences: _addCharacterReferences,
  addOutputsFromFiles,
  setActiveOutputId,
}: UseAiStudioWorkspaceActionsParams) => {
  const handleOpenModelModal = useCallback(
    (anchorId: string, target: HTMLElement, context: ModelModalContext | null = null) => {
      openModelModal(anchorId, target, context);
    },
    [openModelModal]
  );

  const handleSelectModelFromModal = useCallback(
    (value: string) => {
      setModel(value);
      closeModelModal();
    },
    [closeModelModal, setModel]
  );

  const handleManualPromptChange = useCallback(
    (value: string) => {
      if (isReferencePromptTool(selectedTool)) {
        if (selectedTool === "video" || selectedTool === "kling") {
          setVideoReferenceText(value);
        } else {
          setEditReferenceText(value);
        }
      } else {
        setSharedPrompt(value);
      }
      setPromptOrigin("manual");
    },
    [selectedTool, setEditReferenceText, setPromptOrigin, setSharedPrompt, setVideoReferenceText]
  );

  const handleEditPromptTextChange = useCallback(
    (value: string) => {
      setEditReferenceText(value);
      setPromptOrigin("manual");
    },
    [setEditReferenceText, setPromptOrigin]
  );

  const handleVideoPromptTextChange = useCallback(
    (value: string) => {
      setVideoReferenceText(value);
      setPromptOrigin("manual");
    },
    [setPromptOrigin, setVideoReferenceText]
  );

  const handleToolSelect = useCallback(
    (tool: ToolId | null) => {
      const normalizedTool = normalizeToolId(tool);
      const nextTool = normalizedTool ?? tool ?? null;
      setSelectedTool(nextTool);
      if (nextTool === "edit") {
        setMode("image");
      }
      if (!nextTool) {
        setShowCreateTools(false);
      }
    },
    [setMode, setSelectedTool, setShowCreateTools]
  );

  const handleOpenMediaLibrary = useCallback(() => {
    handleToolSelect("media-library");
  }, [handleToolSelect]);

  const handleFileBrowserSelection = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        addOutputsFromFiles(files, "filePicker");
      }
      event.target.value = "";
    },
    [addOutputsFromFiles]
  );

  const handleReferenceGridFiles = useCallback(
    (files: FileList) => {
      addOutputsFromFiles(files, "drop");
    },
    [addOutputsFromFiles]
  );

  const handleSelectOutput = useCallback(
    (id: string) => {
      setActiveOutputId((prev) => (prev === id ? null : id));
    },
    [setActiveOutputId]
  );

  return {
    handleOpenModelModal,
    handleSelectModelFromModal,
    handleManualPromptChange,
    handleEditPromptTextChange,
    handleVideoPromptTextChange,
    handleToolSelect,
    handleOpenMediaLibrary,
    handleFileBrowserSelection,
    handleReferenceGridFiles,
    handleSelectOutput,
  };
};
