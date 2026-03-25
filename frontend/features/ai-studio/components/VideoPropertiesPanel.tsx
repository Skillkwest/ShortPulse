/**
 * Dedicated properties panel for the Video workflow.
 */
import React from "react";
import type { AspectOption } from "../types";
import { modelLogos } from "../constants";
import type { ModelModalContext } from "./ModelModal";
import { ReferenceGenerateStep } from "./ReferenceGenerateStep";
import { ReferenceKlingAdvancedSteps } from "./ReferenceKlingAdvancedSteps";
import { ReferenceMediaStep } from "./ReferenceMediaStep";
import { ReferenceModelStep } from "./ReferenceModelStep";
import { ReferencePromptStep } from "./ReferencePromptStep";
import { useReferencePropertiesConstraintEffects } from "./useReferencePropertiesConstraintEffects";
import { useReferencePropertiesDerivedState } from "./useReferencePropertiesDerivedState";
import { ReferenceVideoSettingsStep } from "./ReferenceVideoSettingsStep";
import { useReferencePropertiesInteractions } from "./useReferencePropertiesInteractions";

export type VideoPropertiesPanelProps = {
  aspect: string;
  modelId: string | null;
  modelLabel: string;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  referenceText: string | null;
  videoReferenceMode?: "standard" | "keyframes" | "kling3" | "motion";
  onVideoReferenceModeChange?: (value: "standard" | "keyframes" | "kling3" | "motion") => void;
  klingNegativePrompt?: string;
  klingCfgScale?: number;
  klingShotType?: "customize" | "intelligent";
  klingVoiceIds?: [string, string];
  klingMultiPrompts?: { id: string; prompt: string; duration: number }[];
  klingElements?: {
    id: string;
    frontalImageUrl: string;
    referenceImageUrls: string;
    videoUrl: string;
  }[];
  onKlingNegativePromptChange?: (value: string) => void;
  onKlingCfgScaleChange?: (value: number) => void;
  onKlingShotTypeChange?: (value: "customize" | "intelligent") => void;
  onKlingVoiceIdChange?: (index: 0 | 1, value: string) => void;
  onKlingMultiPromptsChange?: (value: { id: string; prompt: string; duration: number }[]) => void;
  onKlingElementsChange?: (
    value: { id: string; frontalImageUrl: string; referenceImageUrls: string; videoUrl: string }[]
  ) => void;
  motionVideoUrl?: string | null;
  onMotionVideoChange?: (url: string | null) => void;
  videoDurationSeconds?: number;
  videoResolution?: string;
  videoGenerateAudio?: boolean;
  videoCameraFixed?: boolean;
  videoAutoFix?: boolean;
  onVideoDurationChange?: (value: number) => void;
  onVideoResolutionChange?: (value: string) => void;
  onVideoGenerateAudioChange?: (value: boolean) => void;
  onVideoCameraFixedChange?: (value: boolean) => void;
  onVideoAutoFixChange?: (value: boolean) => void;
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
  guardrailReason?: string | null;
  referenceImageWarning?: string | null;
  agentIsSending?: boolean;
  agentError?: string;
  onAgentEnhanceSend?: () => void;
  beginnerMode?: boolean;
};

/**
 * Renders Video controls with video/Kling mode handling.
 */
export function VideoPropertiesPanel({
  modelId,
  modelLabel,
  aspect,
  referenceImageUrl,
  extraImageUrls,
  referenceText,
  videoReferenceMode,
  onVideoReferenceModeChange,
  klingNegativePrompt = "blur, distort, and low quality",
  klingCfgScale = 0.5,
  klingShotType = "customize",
  klingVoiceIds = ["", ""],
  klingMultiPrompts = [],
  klingElements = [],
  onKlingNegativePromptChange,
  onKlingCfgScaleChange,
  onKlingShotTypeChange,
  onKlingVoiceIdChange,
  onKlingMultiPromptsChange,
  onKlingElementsChange,
  motionVideoUrl = null,
  onMotionVideoChange,
  videoDurationSeconds,
  videoResolution,
  videoGenerateAudio,
  videoCameraFixed = false,
  videoAutoFix = false,
  onVideoDurationChange,
  onVideoResolutionChange,
  onVideoGenerateAudioChange,
  onVideoCameraFixedChange,
  onVideoAutoFixChange,
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
  guardrailReason,
  agentIsSending = false,
  agentError,
  onAgentEnhanceSend,
  beginnerMode = false,
}: VideoPropertiesPanelProps) {
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
    updateKlingMultiPrompt,
    addKlingShot,
    removeKlingShot,
    updateKlingElement,
    addKlingElement,
    removeKlingElement,
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
    onMotionVideoChange,
    resolvePreviewUrlById,
    klingMultiPrompts,
    onKlingMultiPromptsChange,
    klingElements,
    onKlingElementsChange,
  });

  const {
    activeVideoMode,
    isKling3Mode,
    isKeyframesMode,
    isMotionMode,
    isStandardMode,
    isVeoImageToVideoStandard,
    isVeoFirstLastModel,
    isSeedanceI2VModel,
    isVeoModel,
    isKling3Model,
    referenceStepTitle,
    referenceStepSubtitle,
    promptOrder,
    modelOrder,
    referenceOrder,
    referenceBadge,
    promptBadge,
    modelBadge,
    videoSettingsOrder,
    videoSettingsBadge,
    motionAudioOrder,
    motionAudioBadge,
    klingAdvancedOrder,
    klingAdvancedBadge,
    klingAssetsOrder,
    klingAssetsBadge,
    klingGuidanceOrder,
    klingGuidanceBadge,
    generateOrder,
    generateBadge,
    klingShotSummary,
    klingAssetsSummary,
    klingGuidanceSummary,
    videoDurationValue,
    videoResolutionValue,
    videoGenerateAudioValue,
    modelConfig,
    durationOptions,
    resolutionOptions,
    aspectOptionsForModel,
  } = useReferencePropertiesDerivedState({
    variant: "video",
    videoReferenceMode,
    modelId,
    aspectOptions,
    klingMultiPrompts,
    klingElements,
    klingVoiceIds,
    klingCfgScale,
    klingNegativePrompt,
    videoDurationSeconds,
    videoResolution,
    videoGenerateAudio,
  });

  useReferencePropertiesConstraintEffects({
    modelConfig,
    videoDurationValue,
    onVideoDurationChange,
    videoResolutionValue,
    onVideoResolutionChange,
    isVideoVariant: true,
    imageResolution: undefined,
    imageResolutionValue: "model_default",
    onImageResolutionChange: undefined,
  });

  return (
    <div className="tool-properties reference-properties-panel video-properties-panel">
      <div className="tool-header">
        <p className="eyebrow">Video</p>
        <p className="subdued tiny helper-text">
          Animate still images using reference inputs and prompts.
        </p>
      </div>
      <div className="reference-drop-layout-inner">
        <ReferencePromptStep
          promptBadge={promptBadge}
          promptOrder={promptOrder}
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
          beginnerHelperText="Direct the shot: describe the subject, motion, camera movement, and mood you want in the clip."
          beginnerPinHelperText="Click this button to pin your prompt to the reference grid."
          promptSaveButtonClassName="video-reference-pin-btn"
          promptSaveButtonUnstyled
        />
        {!isMotionMode ? (
          <ReferenceModelStep
            variant="video"
            isVideoVariant={true}
            isKeyframesMode={isKeyframesMode}
            beginnerMode={beginnerMode}
            modelBadge={modelBadge}
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
        ) : null}
        <ReferenceMediaStep
          referenceOrder={referenceOrder}
          referenceBadge={referenceBadge}
          collapsedReference={collapsedSteps.reference}
          onExpandReference={() => expandIfCollapsed("reference")}
          onToggleReference={() => toggleStep("reference")}
          beginnerMode={beginnerMode}
          isVideoVariant={true}
          referenceStepTitle={referenceStepTitle}
          referenceStepSubtitle={referenceStepSubtitle}
          activeVideoMode={activeVideoMode}
          onVideoReferenceModeChange={onVideoReferenceModeChange}
          isMotionMode={isMotionMode}
          isKling3Mode={isKling3Mode}
          isStandardMode={isStandardMode}
          isKeyframesMode={isKeyframesMode}
          referenceImageUrl={referenceImageUrl}
          extraImageUrls={extraImageUrls}
          motionVideoUrl={motionVideoUrl}
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
          onMotionVideoChange={onMotionVideoChange}
          handleFileSelection={handleFileSelection}
          handleMotionVideoSelection={handleMotionVideoSelection}
        />
        <ReferenceVideoSettingsStep
          isVideoVariant={true}
          isMotionMode={isMotionMode}
          beginnerMode={beginnerMode}
          videoSettingsOrder={videoSettingsOrder}
          videoSettingsBadge={videoSettingsBadge}
          motionAudioOrder={motionAudioOrder}
          motionAudioBadge={motionAudioBadge}
          collapsedVideoSettings={collapsedSteps.videoSettings}
          collapsedMotionAudio={collapsedSteps.motionAudio}
          videoDurationValue={videoDurationValue}
          videoResolutionValue={videoResolutionValue}
          durationOptions={durationOptions}
          resolutionOptions={resolutionOptions}
          videoGenerateAudioValue={videoGenerateAudioValue}
          isVeoImageToVideoStandard={isVeoImageToVideoStandard}
          isVeoFirstLastModel={isVeoFirstLastModel}
          isSeedanceI2VModel={isSeedanceI2VModel}
          videoCameraFixed={videoCameraFixed}
          isKling3Model={isKling3Model}
          klingShotType={klingShotType}
          isVeoModel={isVeoModel}
          videoAutoFix={videoAutoFix}
          onExpandVideoSettings={() => expandIfCollapsed("videoSettings")}
          onToggleVideoSettings={() => toggleStep("videoSettings")}
          onExpandMotionAudio={() => expandIfCollapsed("motionAudio")}
          onToggleMotionAudio={() => toggleStep("motionAudio")}
          onVideoDurationChange={onVideoDurationChange}
          onVideoResolutionChange={onVideoResolutionChange}
          onVideoGenerateAudioChange={onVideoGenerateAudioChange}
          onVideoCameraFixedChange={onVideoCameraFixedChange}
          onKlingShotTypeChange={onKlingShotTypeChange}
          onVideoAutoFixChange={onVideoAutoFixChange}
        />
        <ReferenceKlingAdvancedSteps
          isKling3Mode={isKling3Mode}
          beginnerMode={beginnerMode}
          klingAdvancedOrder={klingAdvancedOrder}
          klingAdvancedBadge={klingAdvancedBadge}
          klingAssetsOrder={klingAssetsOrder}
          klingAssetsBadge={klingAssetsBadge}
          klingGuidanceOrder={klingGuidanceOrder}
          klingGuidanceBadge={klingGuidanceBadge}
          collapsedKlingAdvanced={collapsedSteps.klingAdvanced}
          collapsedKlingAssets={collapsedSteps.klingAssets}
          collapsedKlingGuidance={collapsedSteps.klingGuidance}
          klingShotSummary={klingShotSummary}
          klingAssetsSummary={klingAssetsSummary}
          klingGuidanceSummary={klingGuidanceSummary}
          klingShotType={klingShotType}
          klingMultiPrompts={klingMultiPrompts}
          klingElements={klingElements}
          klingVoiceIds={klingVoiceIds}
          klingCfgScale={klingCfgScale}
          klingNegativePrompt={klingNegativePrompt}
          onExpandKlingAdvanced={() => expandIfCollapsed("klingAdvanced")}
          onExpandKlingAssets={() => expandIfCollapsed("klingAssets")}
          onExpandKlingGuidance={() => expandIfCollapsed("klingGuidance")}
          onToggleKlingAdvanced={() => toggleStep("klingAdvanced")}
          onToggleKlingAssets={() => toggleStep("klingAssets")}
          onToggleKlingGuidance={() => toggleStep("klingGuidance")}
          onKlingShotTypeChange={onKlingShotTypeChange}
          onKlingVoiceIdChange={onKlingVoiceIdChange}
          onKlingCfgScaleChange={onKlingCfgScaleChange}
          onKlingNegativePromptChange={onKlingNegativePromptChange}
          addKlingShot={addKlingShot}
          removeKlingShot={removeKlingShot}
          updateKlingMultiPrompt={updateKlingMultiPrompt}
          addKlingElement={addKlingElement}
          removeKlingElement={removeKlingElement}
          updateKlingElement={updateKlingElement}
        />
        <ReferenceGenerateStep
          beginnerMode={beginnerMode}
          collapsed={collapsedSteps.generate}
          generateOrder={generateOrder}
          generateBadge={generateBadge}
          onExpand={() => expandIfCollapsed("generate")}
          onRegenerate={onRegenerate}
          isGenerateDisabled={
            isGenerateDisabled ||
            !referenceText?.trim() ||
            (activeVideoMode === "standard" && !referenceImageUrl)
          }
          isBusy={agentIsSending}
          costCredits={costCredits}
          guardrailReason={guardrailReason}
          promptRequiredMessage={null}
        />
      </div>
    </div>
  );
}
