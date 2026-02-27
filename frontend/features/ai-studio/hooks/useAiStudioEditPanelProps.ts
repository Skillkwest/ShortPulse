/**
 * Edit workflow panel-prop composition hook for AI Studio.
 * Isolates edit properties panel wiring from create/video workflows.
 */
import { useMemo, type Dispatch, type SetStateAction } from "react";
import { aspectOptions } from "../constants";
import type { AiStudioEditPanelContract } from "./contracts/pageContentContracts";

type UseAiStudioEditPanelPropsParams = {
  aspect: string;
  model: string | null;
  currentModelLabel: string;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  editReferenceText: string;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  setAspect: (value: string) => void;
  handleOpenModelModal: (
    anchorId: string,
    target: HTMLElement,
    context?:
      | "reference-image"
      | "reference-video"
      | "reference-keyframes"
      | "text-image"
      | "text-video"
      | null
  ) => void;
  setReferenceImageUrl: (url: string | null) => void;
  setExtraImageUrl: (index: number, url: string | null) => void;
  handleEditPromptTextChange: (value: string) => void;
  handleEditPromptSave: () => void;
  handleImageRegenerateWithDebit: () => void;
  currentCostCredits: number | null;
  isGenerateDisabled: boolean;
  isGenerateClickLocked: boolean;
  isPromptGenerating: boolean;
  referenceImageWarning: string | null;
  resolveOutputPreviewUrl: (id: string | null | undefined) => string | null;
  isReferencePromptEnhancing: boolean;
  handleReferencePromptEnhance: () => void;
  imageResolution: string;
  setImageResolution: Dispatch<SetStateAction<string>>;
  beginnerMode: boolean;
};

/**
 * Builds props for the edit properties panel.
 */
export const useAiStudioEditPanelProps = ({
  aspect,
  model,
  currentModelLabel,
  referenceImageUrl,
  extraImageUrls,
  editReferenceText,
  isModelModalOpen,
  modelModalAnchor,
  setAspect,
  handleOpenModelModal,
  setReferenceImageUrl,
  setExtraImageUrl,
  handleEditPromptTextChange,
  handleEditPromptSave,
  handleImageRegenerateWithDebit,
  currentCostCredits,
  isGenerateDisabled,
  isGenerateClickLocked,
  isPromptGenerating,
  referenceImageWarning,
  resolveOutputPreviewUrl,
  isReferencePromptEnhancing,
  handleReferencePromptEnhance,
  imageResolution,
  setImageResolution,
  beginnerMode,
}: UseAiStudioEditPanelPropsParams): AiStudioEditPanelContract =>
  useMemo(
    () => ({
      aspect,
      modelId: model,
      modelLabel: currentModelLabel,
      referenceImageUrl,
      extraImageUrls,
      referenceText: editReferenceText,
      aspectOptions,
      isModelModalOpen,
      modelModalAnchor,
      onAspectChange: setAspect,
      onModelPickerOpen: handleOpenModelModal,
      onPrimaryImageChange: setReferenceImageUrl,
      onExtraImageChange: setExtraImageUrl,
      onPromptTextChange: handleEditPromptTextChange,
      onSave: handleEditPromptSave,
      onRegenerate: handleImageRegenerateWithDebit,
      costCredits: currentCostCredits,
      isGenerateDisabled: isGenerateDisabled || isGenerateClickLocked || isPromptGenerating,
      referenceImageWarning,
      resolvePreviewUrlById: resolveOutputPreviewUrl,
      agentIsSending: isReferencePromptEnhancing || isPromptGenerating,
      onAgentEnhanceSend: handleReferencePromptEnhance,
      imageResolution,
      onImageResolutionChange: setImageResolution,
      beginnerMode,
    }),
    [
      aspect,
      beginnerMode,
      currentCostCredits,
      currentModelLabel,
      editReferenceText,
      extraImageUrls,
      handleEditPromptTextChange,
      handleEditPromptSave,
      handleImageRegenerateWithDebit,
      handleOpenModelModal,
      handleReferencePromptEnhance,
      imageResolution,
      isGenerateClickLocked,
      isGenerateDisabled,
      isModelModalOpen,
      isPromptGenerating,
      isReferencePromptEnhancing,
      model,
      modelModalAnchor,
      referenceImageUrl,
      referenceImageWarning,
      resolveOutputPreviewUrl,
      setAspect,
      setExtraImageUrl,
      setImageResolution,
      setReferenceImageUrl,
    ]
  );
