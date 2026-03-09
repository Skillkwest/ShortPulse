/**
 * Workspace action and UI policy hook for AI Studio.
 * Centralizes page-level selection handlers and workspace file/media actions.
 */
import { useCallback, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import type { ModelModalContext } from "../components/ModelModal";
import type { PromptOrigin } from "../logic/agentPromptOwnership";
import { isReferencePromptTool } from "../logic/promptTargeting";
import { isPrimaryCharacterTool } from "../logic/primaryCharacterTool";
import { isCreateWorkflow, normalizeToolId } from "../logic/workflowIdentity";
import type { StudioMode, ToolId } from "../types";

const MEDIA_LIBRARY_PANEL_ENABLED =
  process.env.NEXT_PUBLIC_AI_STUDIO_MEDIA_LIBRARY_PANEL_ENABLED !== "false";

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
  addCharacterReferences,
  addOutputsFromFiles,
  setActiveOutputId,
}: UseAiStudioWorkspaceActionsParams) => {
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);

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
      if (tool === "media-library" && !MEDIA_LIBRARY_PANEL_ENABLED) {
        setShowCreateTools(false);
        setIsMediaLibraryOpen(true);
        return;
      }
      const normalizedTool = normalizeToolId(tool);
      const nextTool = normalizedTool ?? tool ?? null;
      setSelectedTool(nextTool);
      if (isMediaLibraryOpen) {
        setIsMediaLibraryOpen(false);
      }
      if (isCreateWorkflow(nextTool) || nextTool === "edit") {
        setMode("image");
      }
      if (!nextTool) {
        setShowCreateTools(false);
      }
    },
    [isMediaLibraryOpen, setMode, setSelectedTool, setShowCreateTools]
  );

  const handleOpenMediaLibrary = useCallback(() => {
    handleToolSelect("media-library");
  }, [handleToolSelect]);

  const handleCloseMediaLibrary = useCallback(() => {
    setIsMediaLibraryOpen(false);
  }, []);

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
      if (isPrimaryCharacterTool(selectedTool)) {
        addCharacterReferences(files);
      } else {
        addOutputsFromFiles(files, "drop");
      }
    },
    [addCharacterReferences, addOutputsFromFiles, selectedTool]
  );

  const handleSelectOutput = useCallback(
    (id: string) => {
      setActiveOutputId((prev) => (prev === id ? null : id));
    },
    [setActiveOutputId]
  );

  return {
    isMediaLibraryOpen,
    isMediaLibraryPanelEnabled: MEDIA_LIBRARY_PANEL_ENABLED,
    handleOpenModelModal,
    handleSelectModelFromModal,
    handleManualPromptChange,
    handleEditPromptTextChange,
    handleVideoPromptTextChange,
    handleToolSelect,
    handleOpenMediaLibrary,
    handleCloseMediaLibrary,
    handleFileBrowserSelection,
    handleReferenceGridFiles,
    /**
     * @deprecated Use `handleReferenceGridFiles`.
     */
    handleReferenceCanvasFiles: handleReferenceGridFiles,
    handleSelectOutput,
  };
};
