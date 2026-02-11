/**
 * Reference properties panel for AI Studio.
 * Provides reference dropzones, aspect/model selection, and prompt capture for image/video workflows.
 */
import React from "react";
import { AspectOption } from "../types";
import { modelLogos } from "../constants";
import type { AgentActions, AgentMessage } from "../../../prefabs/agent";
import type { ModelModalContext } from "./ModelModal";
import { ReferenceGenerateStep } from "./ReferenceGenerateStep";
import { ReferenceImageResolutionStep } from "./ReferenceImageResolutionStep";
import { ReferenceKlingAdvancedSteps } from "./ReferenceKlingAdvancedSteps";
import { ReferenceMediaStep } from "./ReferenceMediaStep";
import { ReferenceModelStep } from "./ReferenceModelStep";
import { ReferencePromptStep } from "./ReferencePromptStep";
import { useReferencePropertiesConstraintEffects } from "./useReferencePropertiesConstraintEffects";
import { useReferencePropertiesDerivedState } from "./useReferencePropertiesDerivedState";
import { ReferenceVideoSettingsStep } from "./ReferenceVideoSettingsStep";
import { useReferencePropertiesInteractions } from "./useReferencePropertiesInteractions";

type ReferencePropertiesPanelProps = {
  variant: "image" | "video";
  title: string;
  subtitle: string;
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
  imageResolution?: string;
  videoGenerateAudio?: boolean;
  videoCameraFixed?: boolean;
  videoAutoFix?: boolean;
  onVideoDurationChange?: (value: number) => void;
  onVideoResolutionChange?: (value: string) => void;
  onImageResolutionChange?: (value: string) => void;
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
  // Agent props
  agentEnabled?: boolean;
  agentMessages?: AgentMessage[];
  agentActions?: AgentActions;
  agentInput?: string;
  agentIsSending?: boolean;
  agentError?: string;
  agentPrimarySource?: "agent" | "manual" | "reference";
  stagedPrompt?: string | null;
  agentChatOpen?: boolean;
  onAgentInputChange?: (value: string) => void;
  onAgentSend?: () => void;
  onAgentEnhanceSend?: () => void;
  onAgentMessageClick?: (message: AgentMessage) => void;
  onExpandChat?: () => void;
  onClearAgentChat?: () => void;
  onAgentApplyPrompt?: (prompt: string) => void;
  onAgentSelectVariation?: (prompt: string) => void;
  onAgentUseQuestion?: (question: string) => void;
  onAgentDescribeTargets?: (targets: string[]) => void;
  beginnerMode?: boolean;
};

/**
 * Renders reference-based image/video tool controls.
 */
export function ReferencePropertiesPanel({
  variant,
  title,
  subtitle,
  aspect,
  modelId,
  modelLabel,
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
  imageResolution,
  videoGenerateAudio,
  videoCameraFixed = false,
  videoAutoFix = false,
  onVideoDurationChange,
  onVideoResolutionChange,
  onImageResolutionChange,
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
  referenceImageWarning,
  agentEnabled = false,
  agentMessages = [],
  agentActions,
  agentInput = "",
  agentIsSending = false,
  agentError,
  agentPrimarySource = "manual",
  stagedPrompt = null,
  agentChatOpen = false,
  onAgentInputChange,
  onAgentSend,
  onAgentEnhanceSend,
  onAgentMessageClick,
  onExpandChat,
  onClearAgentChat,
  onAgentApplyPrompt,
  onAgentSelectVariation,
  onAgentUseQuestion,
  onAgentDescribeTargets,
  beginnerMode = false,
}: ReferencePropertiesPanelProps) {
  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;
  const {
    primaryInputRef,
    extraOneInputRef,
    extraTwoInputRef,
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
    isVideoVariant,
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
    imageSettingsOrder,
    referenceOrder,
    videoSettingsOrder,
    klingAdvancedOrder,
    generateOrder,
    generateBadge,
    klingShotSummary,
    klingAssetsSummary,
    klingGuidanceSummary,
    videoDurationValue,
    videoResolutionValue,
    imageResolutionValue,
    imageResolutionOptions,
    videoGenerateAudioValue,
    modelConfig,
    durationOptions,
    resolutionOptions,
    aspectOptionsForModel,
  } = useReferencePropertiesDerivedState({
    variant,
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
    imageResolution,
    videoGenerateAudio,
  });

  useReferencePropertiesConstraintEffects({
    modelConfig,
    videoDurationValue,
    onVideoDurationChange,
    videoResolutionValue,
    onVideoResolutionChange,
    isVideoVariant,
    imageResolution,
    imageResolutionValue,
    onImageResolutionChange,
  });

  return (
    <div className="tool-properties reference-properties-panel">
      <div className="tool-header">
        <p className="eyebrow">{title}</p>
        <p className="subdued tiny helper-text">{subtitle}</p>
      </div>
      <div className="reference-drop-layout-inner">
        <ReferencePromptStep
          promptOrder={promptOrder}
          isVideoVariant={isVideoVariant}
          referenceText={referenceText}
          onPromptTextChange={onPromptTextChange}
          onSave={onSave}
          collapsed={collapsedSteps.prompt}
          onToggleCollapse={() => toggleStep("prompt")}
          onDrop={handlePromptDrop}
          beginnerMode={beginnerMode}
          agentEnabled={agentEnabled}
          agentMessages={agentMessages}
          agentActions={agentActions}
          agentInput={agentInput}
          agentIsSending={agentIsSending}
          agentError={agentError}
          agentPrimarySource={agentPrimarySource}
          stagedPrompt={stagedPrompt}
          agentChatOpen={agentChatOpen}
          onAgentInputChange={onAgentInputChange}
          onAgentSend={onAgentSend}
          onAgentEnhanceSend={onAgentEnhanceSend}
          onAgentMessageClick={onAgentMessageClick}
          onExpandChat={onExpandChat}
          onClearAgentChat={onClearAgentChat}
          onAgentApplyPrompt={onAgentApplyPrompt}
          onAgentSelectVariation={onAgentSelectVariation}
          onAgentUseQuestion={onAgentUseQuestion}
          onAgentDescribeTargets={onAgentDescribeTargets}
        />
        {!isKeyframesMode && !isMotionMode ? (
          <ReferenceModelStep
            variant={variant}
            isVideoVariant={isVideoVariant}
            isKeyframesMode={isKeyframesMode}
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
        ) : null}
        {!isVideoVariant && !beginnerMode ? (
          <ReferenceImageResolutionStep
            imageSettingsOrder={imageSettingsOrder}
            collapsedImageSettings={collapsedSteps.imageSettings}
            imageResolutionValue={imageResolutionValue}
            imageResolutionOptions={imageResolutionOptions}
            onExpandImageSettings={() => expandIfCollapsed("imageSettings")}
            onToggleImageSettings={() => toggleStep("imageSettings")}
            onImageResolutionChange={onImageResolutionChange}
          />
        ) : null}
        <ReferenceMediaStep
          referenceOrder={referenceOrder}
          collapsedReference={collapsedSteps.reference}
          onExpandReference={() => expandIfCollapsed("reference")}
          onToggleReference={() => toggleStep("reference")}
          beginnerMode={beginnerMode}
          isVideoVariant={isVideoVariant}
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
          motionVideoInputRef={motionVideoInputRef}
          onPrimaryImageChange={onPrimaryImageChange}
          onExtraImageChange={onExtraImageChange}
          onMotionVideoChange={onMotionVideoChange}
          handleFileSelection={handleFileSelection}
          handleMotionVideoSelection={handleMotionVideoSelection}
        />
        <ReferenceVideoSettingsStep
          isVideoVariant={isVideoVariant}
          isMotionMode={isMotionMode}
          beginnerMode={beginnerMode}
          videoSettingsOrder={videoSettingsOrder}
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
          isGenerateDisabled={isGenerateDisabled}
          isBusy={agentIsSending}
          costCredits={costCredits}
          referenceImageWarning={referenceImageWarning}
        />
      </div>
    </div>
  );
}
