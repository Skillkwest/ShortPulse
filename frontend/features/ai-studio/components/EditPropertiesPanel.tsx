/**
 * Dedicated properties panel for the Edit/Image workflow.
 */
import React from "react";
import type { AspectOption } from "../types";
import { modelLogos } from "../constants";
import type { ModelModalContext } from "./ModelModal";
import { ReferenceGenerateStep } from "./ReferenceGenerateStep";
import { ReferenceImageResolutionStep } from "./ReferenceImageResolutionStep";
import { ReferenceMediaStep } from "./ReferenceMediaStep";
import { ReferenceModelStep } from "./ReferenceModelStep";
import { ReferencePromptStep } from "./ReferencePromptStep";
import { useReferencePropertiesConstraintEffects } from "./useReferencePropertiesConstraintEffects";
import { useReferencePropertiesDerivedState } from "./useReferencePropertiesDerivedState";
import { useReferencePropertiesInteractions } from "./useReferencePropertiesInteractions";

export type EditPropertiesPanelProps = {
  aspect: string;
  modelId: string | null;
  modelLabel: string;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  referenceText: string | null;
  imageResolution?: string;
  aspectOptions: AspectOption[];
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (
    anchorId: string,
    target: HTMLElement,
    context?: ModelModalContext | null
  ) => void;
  onPrimaryImageChange: (url: string | null) => void;
  onExtraImageChange: (index: number, url: string | null) => void;
  onPromptTextChange: (value: string) => void;
  onSave: () => void;
  onRegenerate: () => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  costCredits?: number | null;
  isGenerateDisabled?: boolean;
  referenceImageWarning?: string | null;
  agentIsSending?: boolean;
  agentError?: string;
  onAgentEnhanceSend?: () => void;
  onImageResolutionChange?: (value: string) => void;
  beginnerMode?: boolean;
};

/**
 * Renders Edit/Image controls with no video-path branching.
 */
export function EditPropertiesPanel({
  aspect,
  modelId,
  modelLabel,
  referenceImageUrl,
  extraImageUrls,
  referenceText,
  imageResolution,
  aspectOptions,
  isModelModalOpen,
  modelModalAnchor,
  onAspectChange,
  onModelPickerOpen,
  onPrimaryImageChange,
  onExtraImageChange,
  onPromptTextChange,
  onSave,
  onRegenerate,
  resolvePreviewUrlById,
  costCredits,
  isGenerateDisabled = false,
  referenceImageWarning,
  agentIsSending = false,
  agentError,
  onAgentEnhanceSend,
  onImageResolutionChange,
  beginnerMode = false,
}: EditPropertiesPanelProps) {
  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;
  const {
    primaryInputRef,
    extraOneInputRef,
    extraTwoInputRef,
    extraThreeInputRef,
    motionVideoInputRef,
    primaryDragActive,
    extraDragActive,
    motionVideoDragActive,
    setMotionVideoDragActive,
    collapsedSteps,
    toggleStep,
    expandIfCollapsed,
    canSwapFrames,
    handleSwapFrames,
    handleFileSelection,
    handlePromptDrop,
    handlePrimaryDrop,
    handleExtraDrop,
    handlePrimaryDragEnter,
    handlePrimaryDragOver,
    handlePrimaryDragLeave,
    handleExtraDragEnter,
    handleExtraDragOver,
    handleExtraDragLeave,
    allowVideoDrag,
    handleMotionVideoDrop,
    handleMotionVideoSelection,
  } = useReferencePropertiesInteractions({
    referenceImageUrl,
    extraImageUrls,
    onPrimaryImageChange,
    onExtraImageChange,
    onPromptTextChange,
    resolvePreviewUrlById,
    klingMultiPrompts: [],
    klingElements: [],
  });

  const {
    imageResolutionValue,
    imageResolutionOptions,
    modelConfig,
    aspectOptionsForModel,
    promptOrder,
    modelOrder,
    imageSettingsOrder,
    referenceOrder,
    generateOrder,
    generateBadge,
    referenceStepTitle,
    referenceStepSubtitle,
  } = useReferencePropertiesDerivedState({
    variant: "image",
    modelId,
    aspectOptions,
    klingMultiPrompts: [],
    klingElements: [],
    klingVoiceIds: ["", ""],
    klingCfgScale: 0.5,
    klingNegativePrompt: "",
    imageResolution,
  });

  useReferencePropertiesConstraintEffects({
    modelConfig,
    videoDurationValue: 6,
    videoResolutionValue: "1080p",
    isVideoVariant: false,
    imageResolution,
    imageResolutionValue,
    onImageResolutionChange,
  });

  return (
    <div className="tool-properties reference-properties-panel edit-properties-panel">
      <div className="tool-header">
        <p className="eyebrow">Image</p>
        <p className="subdued tiny helper-text">Generate images using reference inputs.</p>
      </div>
      <div className="reference-drop-layout-inner">
        <ReferencePromptStep
          promptOrder={promptOrder}
          isVideoVariant={false}
          referenceText={referenceText}
          onPromptTextChange={onPromptTextChange}
          onSave={onSave}
          collapsed={collapsedSteps.prompt}
          onToggleCollapse={() => toggleStep("prompt")}
          onDrop={handlePromptDrop}
          beginnerMode={beginnerMode}
          agentIsSending={agentIsSending}
          agentError={agentError}
          onAgentEnhanceSend={onAgentEnhanceSend}
          showEnhanceButton={false}
          beginnerHelperText="Think like an art director: describe the subject, setting, style, lighting, and camera angle."
        />
        <ReferenceModelStep
          variant="image"
          isVideoVariant={false}
          isKeyframesMode={false}
          beginnerMode={beginnerMode}
          collapsed={collapsedSteps.model}
          modelOrder={modelOrder}
          modelId={modelId}
          modelLabel={modelLabel}
          modelLogoSrc={modelLogoSrc}
          isModelModalOpen={isModelModalOpen}
          modelModalAnchor={modelModalAnchor}
          aspect={aspect}
          aspectOptionsForModel={aspectOptionsForModel}
          onExpand={() => expandIfCollapsed("model")}
          onToggle={() => toggleStep("model")}
          onAspectChange={onAspectChange}
          onModelPickerOpen={onModelPickerOpen}
        />
        {!beginnerMode ? (
          <ReferenceImageResolutionStep
            imageSettingsOrder={imageSettingsOrder}
            imageResolutionValue={imageResolutionValue}
            imageResolutionOptions={imageResolutionOptions}
            onImageResolutionChange={onImageResolutionChange}
          />
        ) : null}
        <ReferenceMediaStep
          referenceOrder={referenceOrder}
          collapsedReference={collapsedSteps.reference}
          onExpandReference={() => expandIfCollapsed("reference")}
          onToggleReference={() => toggleStep("reference")}
          beginnerMode={beginnerMode}
          isVideoVariant={false}
          referenceStepTitle={referenceStepTitle}
          referenceStepSubtitle={referenceStepSubtitle}
          activeVideoMode="standard"
          isMotionMode={false}
          isKling3Mode={false}
          isStandardMode={true}
          isKeyframesMode={false}
          referenceImageUrl={referenceImageUrl}
          extraImageUrls={extraImageUrls}
          motionVideoUrl={null}
          primaryDragActive={primaryDragActive}
          extraDragActive={extraDragActive}
          motionVideoDragActive={motionVideoDragActive}
          setMotionVideoDragActive={setMotionVideoDragActive}
          handlePrimaryDrop={handlePrimaryDrop}
          handlePrimaryDragEnter={handlePrimaryDragEnter}
          handlePrimaryDragOver={handlePrimaryDragOver}
          handlePrimaryDragLeave={handlePrimaryDragLeave}
          handleExtraDrop={handleExtraDrop}
          handleExtraDragEnter={handleExtraDragEnter}
          handleExtraDragOver={handleExtraDragOver}
          handleExtraDragLeave={handleExtraDragLeave}
          allowVideoDrag={allowVideoDrag}
          handleMotionVideoDrop={handleMotionVideoDrop}
          canSwapFrames={canSwapFrames}
          handleSwapFrames={handleSwapFrames}
          primaryInputRef={primaryInputRef}
          extraOneInputRef={extraOneInputRef}
          extraTwoInputRef={extraTwoInputRef}
          extraThreeInputRef={extraThreeInputRef}
          motionVideoInputRef={motionVideoInputRef}
          onPrimaryImageChange={onPrimaryImageChange}
          onExtraImageChange={onExtraImageChange}
          handleFileSelection={handleFileSelection}
          handleMotionVideoSelection={handleMotionVideoSelection}
        />
        <ReferenceGenerateStep
          beginnerMode={beginnerMode}
          collapsed={collapsedSteps.generate}
          generateOrder={generateOrder}
          generateBadge={generateBadge}
          onExpand={() => expandIfCollapsed("generate")}
          onRegenerate={onRegenerate}
          isGenerateDisabled={isGenerateDisabled}
          isBusy={agentIsSending}
          costCredits={costCredits}
          promptRequiredMessage={
            referenceText?.trim() ? null : 'Add a prompt in "Write Your Prompt" to generate.'
          }
          referenceImageWarning={referenceImageWarning}
        />
      </div>
    </div>
  );
}
