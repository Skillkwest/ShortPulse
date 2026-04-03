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
import { ReferencePromptStep } from "./ReferencePromptStep";
import { useReferencePropertiesConstraintEffects } from "./useReferencePropertiesConstraintEffects";
import { useReferencePropertiesDerivedState } from "./useReferencePropertiesDerivedState";
import { ReferenceVideoSettingsStep } from "./ReferenceVideoSettingsStep";
import { useReferencePropertiesInteractions } from "./useReferencePropertiesInteractions";
import { KIE_KLING_30_MODEL_ID } from "../../../lib/model-runtime/providerModelIds";

export type VideoPropertiesPanelProps = {
  aspect: string;
  modelId: string | null;
  modelLabel: string;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  referenceText: string | null;
  videoReferenceMode?: "standard" | "modify" | "keyframes" | "kling3" | "motion";
  onVideoReferenceModeChange?: (
    value: "standard" | "modify" | "keyframes" | "kling3" | "motion"
  ) => void;
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
    referenceStepTitle,
    referenceStepSubtitle,
    promptOrder,
    referenceOrder,
    referenceBadge,
    promptBadge,
    videoSettingsOrder,
    motionAudioOrder,
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

  const isKieKlingWorkspace = isKling3Mode && modelId === "kie-ai/kling-3.0";
  const isKieKlingModelSelected = modelId === KIE_KLING_30_MODEL_ID;
  React.useEffect(() => {
    if (activeVideoMode === "keyframes") {
      onVideoReferenceModeChange?.("standard");
    }
  }, [activeVideoMode, onVideoReferenceModeChange]);

  const visibleVideoMode =
    activeVideoMode === "motion" ? "motion" : activeVideoMode === "modify" ? "modify" : "standard";
  const videoModeIndex =
    visibleVideoMode === "standard" ? 0 : visibleVideoMode === "motion" ? 1 : 2;
  const videoModeTabsStyle = React.useMemo(
    () =>
      ({
        "--video-reference-mode-index": videoModeIndex,
      }) as React.CSSProperties,
    [videoModeIndex]
  );
  const isMultiShotEnabled = klingMultiPrompts.length > 0;
  const handleToggleMultiShot = React.useCallback(() => {
    if (!onKlingMultiPromptsChange) return;
    if (isMultiShotEnabled) {
      onKlingMultiPromptsChange([]);
      return;
    }
    const nextId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `kling-${Math.random().toString(36).slice(2, 9)}`;
    onKlingMultiPromptsChange([
      {
        id: nextId,
        prompt: referenceText?.trim() ?? "",
        duration: videoDurationValue,
      },
    ]);
  }, [isMultiShotEnabled, onKlingMultiPromptsChange, referenceText, videoDurationValue]);

  return (
    <div className="tool-properties reference-properties-panel video-properties-panel">
      <div className="video-properties-workspace">
        <div className="reference-drop-layout-inner video-properties-primary-column">
          <div className="video-setup-columns">
            <div className="video-setup-column video-setup-column--left">
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
                topContent={
                  <div
                    className="video-reference-mode-tabs"
                    role="tablist"
                    aria-label="Video reference mode"
                    style={videoModeTabsStyle}
                  >
                    <span className="video-reference-mode-indicator" aria-hidden="true" />
                    <button
                      type="button"
                      role="tab"
                      aria-selected={visibleVideoMode === "standard"}
                      className={`video-reference-mode-tab ${visibleVideoMode === "standard" ? "is-active" : ""}`}
                      onClick={() => onVideoReferenceModeChange?.("standard")}
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={visibleVideoMode === "motion"}
                      className={`video-reference-mode-tab ${visibleVideoMode === "motion" ? "is-active" : ""}`}
                      onClick={() => onVideoReferenceModeChange?.("motion")}
                    >
                      Motion Control
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={visibleVideoMode === "modify"}
                      className={`video-reference-mode-tab ${visibleVideoMode === "modify" ? "is-active" : ""}`}
                      onClick={() => onVideoReferenceModeChange?.("modify")}
                    >
                      Modify
                    </button>
                  </div>
                }
              />
            </div>
            <div className="video-setup-column video-setup-column--right">
              <ReferenceVideoSettingsStep
                isVideoVariant={true}
                isMotionMode={isMotionMode}
                showMultiShotToggle={isKieKlingModelSelected}
                multiShotEnabled={isMultiShotEnabled}
                multiShotShotCount={klingMultiPrompts.length}
                modelId={modelId}
                modelLabel={modelLabel}
                modelLogoSrc={modelLogoSrc}
                isModelModalOpen={isModelModalOpen}
                modelModalAnchor={modelModalAnchor}
                aspect={aspect}
                aspectOptionsForModel={aspectOptionsForModel}
                videoSettingsOrder={videoSettingsOrder}
                motionAudioOrder={motionAudioOrder}
                videoDurationValue={videoDurationValue}
                videoResolutionValue={videoResolutionValue}
                durationOptions={durationOptions}
                resolutionOptions={resolutionOptions}
                videoGenerateAudioValue={videoGenerateAudioValue}
                isVeoImageToVideoStandard={isVeoImageToVideoStandard}
                isVeoFirstLastModel={isVeoFirstLastModel}
                isSeedanceI2VModel={isSeedanceI2VModel}
                videoCameraFixed={videoCameraFixed}
                isVeoModel={isVeoModel}
                videoAutoFix={videoAutoFix}
                onAspectChange={onAspectChange}
                onModelPickerOpen={onModelPickerOpen}
                onVideoDurationChange={onVideoDurationChange}
                onVideoResolutionChange={onVideoResolutionChange}
                onVideoGenerateAudioChange={onVideoGenerateAudioChange}
                onVideoCameraFixedChange={onVideoCameraFixedChange}
                onVideoAutoFixChange={onVideoAutoFixChange}
                onToggleMultiShot={handleToggleMultiShot}
              />
            </div>
          </div>
          <div className="video-prompt-generate-row">
            <div className="video-prompt-generate-main">
              <ReferencePromptStep
                promptBadge={promptBadge}
                promptOrder={promptOrder}
                referenceText={referenceText}
                onPromptTextChange={onPromptTextChange}
                collapsed={collapsedSteps.prompt}
                onToggleCollapse={() => toggleStep("prompt")}
                onDrop={handlePromptDrop}
                beginnerMode={beginnerMode}
                agentIsSending={agentIsSending}
                agentError={agentError}
                onAgentEnhanceSend={onAgentEnhanceSend}
                showEnhanceButton={false}
                hideHeader={true}
                autoResize
                beginnerHelperText="Direct the shot: describe the subject, motion, camera movement, and mood you want in the clip."
              />
            </div>
            <div className="video-prompt-generate-aside">
              {activeVideoMode === "standard" && !isMultiShotEnabled ? (
                <div className="video-shot-status-card" aria-label="Shot mode status">
                  Single shot
                </div>
              ) : null}
              <ReferenceGenerateStep
                inline
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
                suppressInlineGuardrailReason
              />
            </div>
          </div>
          <ReferenceKlingAdvancedSteps
            isKling3Mode={isKling3Mode}
            isKieKlingModel={isKieKlingWorkspace}
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
        </div>
      </div>
    </div>
  );
}
