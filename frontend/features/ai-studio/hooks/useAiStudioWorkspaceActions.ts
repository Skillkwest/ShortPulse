/**
 * Workspace action and UI policy hook for AI Studio.
 * Centralizes page-level selection handlers and prompt-reference generate gating.
 */
import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ModelModalContext } from "../components/ModelModal";
import type { PromptOrigin } from "../logic/agentPromptOwnership";
import { isReferencePromptTool } from "../logic/promptTargeting";
import { isPrimaryCharacterTool } from "../logic/primaryCharacterTool";
import {
  isCreateWorkflow,
  isEditWorkflow,
  isVideoWorkflow,
  normalizeToolId,
} from "../logic/workflowIdentity";
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
  model: string | null;
  hasSufficientCreditsForCost: boolean;
  referenceImageUrl: string | null;
  extraImageUrls: Array<string | null>;
  motionReferenceVideoUrl: string | null;
  editReferenceText: string;
  videoReferenceText: string;
  videoReferenceMode: string;
};

/**
 * Returns stable workspace action handlers and prompt-reference generate visibility flags.
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
  model,
  hasSufficientCreditsForCost,
  referenceImageUrl,
  extraImageUrls,
  motionReferenceVideoUrl,
  editReferenceText,
  videoReferenceText,
  videoReferenceMode,
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
      const normalizedTool = normalizeToolId(tool);
      setSelectedTool(normalizedTool);
      if (isCreateWorkflow(normalizedTool) || normalizedTool === "edit") {
        setMode("image");
      }
      if (!normalizedTool) {
        setShowCreateTools(false);
      }
    },
    [setMode, setSelectedTool, setShowCreateTools]
  );

  const handleOpenMediaLibrary = useCallback(() => {
    setIsMediaLibraryOpen(true);
  }, []);

  const handleCloseMediaLibrary = useCallback(() => {
    setIsMediaLibraryOpen(false);
  }, []);

  const handleFileBrowserSelection = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        if (isPrimaryCharacterTool(selectedTool)) {
          addCharacterReferences(files);
        } else {
          addOutputsFromFiles(files, "filePicker");
        }
      }
      event.target.value = "";
    },
    [addCharacterReferences, addOutputsFromFiles, selectedTool]
  );

  const handleReferenceCanvasFiles = useCallback(
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

  const showReferencePromptGenerate = useMemo(() => {
    const isCreateWorkflowSelected = isCreateWorkflow(selectedTool);
    const isEditWorkflowSelected = isEditWorkflow(selectedTool);
    const isVideoWorkflowSelected = isVideoWorkflow(selectedTool);
    const hasModelSelected = Boolean(model);
    const hasPrimaryReferenceImage = Boolean(referenceImageUrl);
    const hasFirstLastFrameReferences = Boolean(referenceImageUrl && extraImageUrls[0]);
    const hasMotionReferences = Boolean(referenceImageUrl && motionReferenceVideoUrl);
    const hasEditPromptText = Boolean(editReferenceText.trim());
    const hasVideoPromptText = Boolean(videoReferenceText.trim());

    const canShowCreatePromptReferenceGenerate = hasModelSelected && hasSufficientCreditsForCost;
    const canShowEditPromptReferenceGenerate =
      hasModelSelected &&
      hasSufficientCreditsForCost &&
      hasPrimaryReferenceImage &&
      !hasEditPromptText;
    const videoReferencesReadyForPromptGenerate =
      videoReferenceMode === "standard"
        ? hasPrimaryReferenceImage
        : videoReferenceMode === "keyframes"
          ? hasFirstLastFrameReferences
          : videoReferenceMode === "motion"
            ? hasMotionReferences
            : hasPrimaryReferenceImage;
    const canShowVideoPromptReferenceGenerate =
      hasModelSelected &&
      hasSufficientCreditsForCost &&
      !hasVideoPromptText &&
      videoReferencesReadyForPromptGenerate;

    if (isCreateWorkflowSelected) return canShowCreatePromptReferenceGenerate;
    if (isEditWorkflowSelected) return canShowEditPromptReferenceGenerate;
    if (isVideoWorkflowSelected) return canShowVideoPromptReferenceGenerate;
    return false;
  }, [
    editReferenceText,
    extraImageUrls,
    hasSufficientCreditsForCost,
    model,
    motionReferenceVideoUrl,
    referenceImageUrl,
    selectedTool,
    videoReferenceMode,
    videoReferenceText,
  ]);

  return {
    isMediaLibraryOpen,
    handleOpenModelModal,
    handleSelectModelFromModal,
    handleManualPromptChange,
    handleEditPromptTextChange,
    handleVideoPromptTextChange,
    handleToolSelect,
    handleOpenMediaLibrary,
    handleCloseMediaLibrary,
    handleFileBrowserSelection,
    handleReferenceCanvasFiles,
    handleSelectOutput,
    showReferencePromptGenerate,
    disableReferencePromptGenerate: !showReferencePromptGenerate,
  };
};
