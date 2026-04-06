/**
 * Dedicated properties panel for the Video workflow.
 */
import React from "react";
import { flushSync } from "react-dom";
import { Trash } from "phosphor-react";
import type { AspectOption } from "../types";
import { modelLogos } from "../constants";
import { AgentGenerateButton } from "../../../prefabs/agent";
import type { ModelModalContext } from "./ModelModal";
import { ReferenceKlingAdvancedSteps } from "./ReferenceKlingAdvancedSteps";
import { ReferenceMediaStep } from "./ReferenceMediaStep";
import { ReferencePromptStep } from "./ReferencePromptStep";
import { useReferencePropertiesConstraintEffects } from "./useReferencePropertiesConstraintEffects";
import { useReferencePropertiesDerivedState } from "./useReferencePropertiesDerivedState";
import { ReferenceVideoSettingsStep } from "./ReferenceVideoSettingsStep";
import { useReferencePropertiesInteractions } from "./useReferencePropertiesInteractions";
import { KIE_KLING_30_MODEL_ID } from "../../../lib/model-runtime/providerModelIds";
import { resolveVideoGenerationLaneFromFrameInputs } from "../logic/referenceInputs";

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
  klingWorkflowMode?: "single" | "multi" | "custom";
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
  onKlingWorkflowModeChange?: (value: "single" | "multi" | "custom") => void;
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
  klingWorkflowMode = "single",
  klingShotType = "customize",
  klingVoiceIds = ["", ""],
  klingMultiPrompts = [],
  klingElements = [],
  onKlingNegativePromptChange,
  onKlingCfgScaleChange,
  onKlingWorkflowModeChange,
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
  agentIsSending = false,
  agentError,
  onAgentEnhanceSend,
  beginnerMode = false,
}: VideoPropertiesPanelProps) {
  const runWithViewTransition = React.useCallback((update: () => void) => {
    const viewTransitionDocument = document as Document & {
      startViewTransition?: (callback: () => void) => { finished: Promise<void> };
    };
    if (typeof viewTransitionDocument.startViewTransition !== "function") {
      update();
      return;
    }
    viewTransitionDocument.startViewTransition(() => {
      flushSync(update);
    });
  }, []);

  const shotWorkspaceScrollRef = React.useRef<HTMLDivElement | null>(null);
  const shotWorkspaceStackRef = React.useRef<HTMLDivElement | null>(null);
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
    isSeedanceModel,
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

  const isKieKlingWorkspace = isKling3Mode && modelId === KIE_KLING_30_MODEL_ID;
  const isKieKlingModelSelected = modelId === KIE_KLING_30_MODEL_ID;
  const isVeo31ModelSelected =
    modelId?.includes("veo3.1") === true || modelId?.includes("veo-3.1") === true;

  React.useEffect(() => {
    if (isVeo31ModelSelected && videoAutoFix) {
      onVideoAutoFixChange?.(false);
    }
  }, [isVeo31ModelSelected, onVideoAutoFixChange, videoAutoFix]);

  const visibleVideoMode = activeVideoMode === "motion" ? "motion" : "standard";
  const resolvedVideoLane = resolveVideoGenerationLaneFromFrameInputs({
    primary: referenceImageUrl,
    extras: extraImageUrls,
    referenceMode: activeVideoMode,
  });
  const modelPickerContext: ModelModalContext =
    resolvedVideoLane === "text"
      ? "text-video"
      : resolvedVideoLane === "first-last"
        ? "reference-keyframes"
        : "reference-video";
  const standardVideoRequiresReferenceImage =
    activeVideoMode === "standard" && modelId === KIE_KLING_30_MODEL_ID;
  const shouldShowKlingReferenceImageWarning =
    standardVideoRequiresReferenceImage && !referenceImageUrl && !extraImageUrls[0];
  const videoModeIndex = visibleVideoMode === "motion" ? 1 : 0;
  const videoModeTabsStyle = React.useMemo(
    () =>
      ({
        "--video-reference-mode-index": videoModeIndex,
      }) as React.CSSProperties,
    [videoModeIndex]
  );
  const klingMode = klingWorkflowMode;
  const isMultiShotEnabled = klingMode === "custom";
  const isCustomKlingWorkflow = klingMode === "custom";
  const customKlingPrompts = isCustomKlingWorkflow ? klingMultiPrompts : [];
  const hasAnyPromptText = isCustomKlingWorkflow
    ? customKlingPrompts.some((shot) => shot.prompt.trim().length > 0)
    : Boolean(referenceText?.trim());
  const videoModeSummaryLabel = visibleVideoMode === "motion" ? "Motion Control" : "Standard";
  const shotModeSummaryLabel = !isKieKlingModelSelected
    ? "Single"
    : klingMode === "multi"
      ? "Multi"
      : klingMode === "custom"
        ? "Custom"
        : "Single";
  const createInitialMultiShot = React.useCallback(() => {
    const nextId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `kling-${Math.random().toString(36).slice(2, 9)}`;
    return [
      {
        id: nextId,
        prompt: referenceText?.trim() ?? "",
        duration: videoDurationValue,
      },
    ];
  }, [referenceText, videoDurationValue]);
  const showShotModeSelector = activeVideoMode === "standard";
  const shouldShowShotModeSelector = showShotModeSelector && isKieKlingModelSelected;
  const textareaResizeFrameMapRef = React.useRef(new WeakMap<HTMLTextAreaElement, number>());

  const resizeTextareaToContent = React.useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    const previousFrameId = textareaResizeFrameMapRef.current.get(textarea);
    if (typeof previousFrameId === "number") {
      window.cancelAnimationFrame(previousFrameId);
    }
    const frameId = window.requestAnimationFrame(() => {
      const computedMinHeight = Number.parseFloat(window.getComputedStyle(textarea).minHeight) || 0;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.max(textarea.scrollHeight, computedMinHeight)}px`;
      textareaResizeFrameMapRef.current.delete(textarea);
    });
    textareaResizeFrameMapRef.current.set(textarea, frameId);
  }, []);

  const ensureCustomKlingShots = () => {
    if (!onKlingMultiPromptsChange || klingMultiPrompts.length > 0) return;
    onKlingMultiPromptsChange(createInitialMultiShot());
  };
  const handleSetKlingWorkflowMode = (nextMode: "single" | "multi" | "custom") => {
    runWithViewTransition(() => {
      onKlingWorkflowModeChange?.(nextMode);
      if (nextMode === "custom") {
        ensureCustomKlingShots();
      }
    });
  };
  const handleAddShotPrompt = () => {
    runWithViewTransition(() => {
      onKlingWorkflowModeChange?.("custom");
      ensureCustomKlingShots();
      addKlingShot();
    });
  };
  const shouldShowAddCustomShotButton =
    isKieKlingModelSelected && klingMode === "custom" && Boolean(onKlingMultiPromptsChange);
  const isCustomMultiShotWorkspace = shouldShowAddCustomShotButton;
  const handleCustomShotPromptChange = React.useCallback(
    (shotId: string, value: string) => {
      updateKlingMultiPrompt(shotId, "prompt", value);
    },
    [updateKlingMultiPrompt]
  );
  const handlePrimaryPromptChange = (value: string) => {
    if (isCustomKlingWorkflow) {
      const firstShot = klingMultiPrompts[0];
      if (firstShot) {
        updateKlingMultiPrompt(firstShot.id, "prompt", value);
        return;
      }
    }
    onPromptTextChange(value);
  };
  const showShotLabels = shouldShowAddCustomShotButton;
  const totalShotCount = isCustomKlingWorkflow ? Math.max(customKlingPrompts.length, 1) : 1;
  const primaryPromptValue = isCustomKlingWorkflow
    ? (customKlingPrompts[0]?.prompt ?? "")
    : (referenceText ?? "");
  const primaryPromptPlaceholder =
    isKieKlingModelSelected && klingMode === "multi"
      ? "Write the full multi-scene direction in one prompt. Use @Element01 style tags to reference Kling elements."
      : "Describe the shot you want to create: subject, action, camera movement, framing, lighting, and mood.";
  const primaryPromptHelperText =
    isKieKlingModelSelected && klingMode === "multi"
      ? "Write the complete scene sequence in one prompt. Reference uploaded elements with @Element01, @Element02, and so on."
      : "Direct the shot: describe the subject, motion, camera movement, and mood you want in the clip.";
  const customShotWorkspaceStyle = isCustomMultiShotWorkspace
    ? ({ "--video-shot-count": totalShotCount } as React.CSSProperties)
    : undefined;

  React.useLayoutEffect(() => {
    if (!isCustomMultiShotWorkspace) return;
    const scrollContainer = shotWorkspaceScrollRef.current;
    const stack = shotWorkspaceStackRef.current;
    if (!scrollContainer || !stack) return;

    const scrollToBottom = () => {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    };

    scrollToBottom();

    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      scrollToBottom();
    });
    observer.observe(stack);
    return () => observer.disconnect();
  }, [isCustomMultiShotWorkspace]);

  return (
    <div className="tool-properties reference-properties-panel video-properties-panel">
      <div className="video-properties-workspace">
        <div className="reference-drop-layout-inner video-properties-primary-column">
          <div className="video-properties-main-columns">
            <div className="video-properties-main-column video-properties-main-column--left">
              <div className="video-setup-row-shell">
                <div className="video-panel-title">Select Video Mode</div>
                <div className="video-setup-columns">
                  <div className="video-setup-column video-setup-column--single">
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
                    </div>
                    <div className="video-setup-reference-slot">
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
                        primaryImageRequired={standardVideoRequiresReferenceImage}
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
                          <div className="video-reference-card-title">Add References</div>
                        }
                      />
                    </div>
                    <div className="video-setup-settings-slot">
                      <ReferenceVideoSettingsStep
                        isVideoVariant={true}
                        isMotionMode={isMotionMode}
                        multiShotEnabled={isMultiShotEnabled}
                        multiShotShotCount={klingMultiPrompts.length}
                        modelId={modelId}
                        modelLabel={modelLabel}
                        modelLogoSrc={modelLogoSrc}
                        isModelModalOpen={isModelModalOpen}
                        modelModalAnchor={modelModalAnchor}
                        modelModalContext={modelPickerContext}
                        aspect={aspect}
                        aspectOptionsForModel={aspectOptionsForModel}
                        videoSettingsOrder={videoSettingsOrder}
                        motionAudioOrder={motionAudioOrder}
                        videoDurationValue={videoDurationValue}
                        videoResolutionValue={videoResolutionValue}
                        durationOptions={durationOptions}
                        resolutionOptions={resolutionOptions}
                        videoGenerateAudioValue={videoGenerateAudioValue}
                        isSeedanceModel={isSeedanceModel}
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
                        onToggleMultiShot={
                          shouldShowShotModeSelector
                            ? () =>
                                handleSetKlingWorkflowMode(
                                  klingMode === "custom" ? "single" : "custom"
                                )
                            : undefined
                        }
                      />
                    </div>
                    {isKieKlingModelSelected && !isMotionMode ? (
                      <div className="video-setup-elements-slot">
                        <div className="step-card video-elements-card">
                          <div className="video-elements-card-title video-elements-card-title--large">
                            Kling 3.0 Settings
                          </div>
                          {shouldShowShotModeSelector ? (
                            <div className="video-shot-mode-section video-elements-shot-mode-section">
                              <span className="input-label video-shot-mode-label">Shot mode</span>
                              <div
                                className="video-shot-mode-tabs"
                                role="tablist"
                                aria-label="Shot structure mode"
                                style={
                                  {
                                    "--video-shot-mode-slots": 3,
                                    "--video-shot-mode-index":
                                      klingMode === "multi" ? 1 : klingMode === "custom" ? 2 : 0,
                                  } as React.CSSProperties
                                }
                              >
                                <span className="video-shot-mode-indicator" aria-hidden="true" />
                                <button
                                  type="button"
                                  role="tab"
                                  aria-selected={klingMode === "single"}
                                  aria-label="Single shot"
                                  className={`video-shot-mode-tab ${klingMode === "single" ? "is-active" : ""}`}
                                  onClick={() => handleSetKlingWorkflowMode("single")}
                                >
                                  Single
                                </button>
                                <button
                                  type="button"
                                  role="tab"
                                  aria-selected={klingMode === "multi"}
                                  aria-label="Multi-shot"
                                  className={`video-shot-mode-tab ${klingMode === "multi" ? "is-active" : ""}`}
                                  onClick={() => handleSetKlingWorkflowMode("multi")}
                                >
                                  Multi
                                </button>
                                <button
                                  type="button"
                                  role="tab"
                                  aria-selected={klingMode === "custom"}
                                  aria-label="Custom multi-shot"
                                  className={`video-shot-mode-tab ${klingMode === "custom" ? "is-active" : ""}`}
                                  onClick={() => handleSetKlingWorkflowMode("custom")}
                                >
                                  Custom
                                </button>
                              </div>
                            </div>
                          ) : null}
                          <div className="video-elements-card-title video-elements-card-title--sub">
                            Add @Elements
                          </div>
                          <div
                            className="video-elements-placeholder-grid"
                            aria-label="Element reference slots"
                          >
                            {Array.from({ length: 3 }).map((_, index) => (
                              <div
                                key={`video-element-slot-${index}`}
                                className="video-elements-placeholder-tile"
                              >
                                <span
                                  className="video-elements-placeholder-plus"
                                  aria-hidden="true"
                                >
                                  +
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {!isKieKlingModelSelected ? (
                      <p className="video-kling-tip">
                        Tip: Switch to the Kling 3.0 model to access multi-shot capability.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="video-properties-main-column video-properties-main-column--right">
              <div
                className={`video-direction-column-shell ${hasAnyPromptText ? "has-active-prompt-content" : ""} ${isCustomMultiShotWorkspace ? "is-custom-multishot-workspace" : ""}`}
              >
                {!hasAnyPromptText ? (
                  <p className="video-panel-hero-text">How will you direct this scene?</p>
                ) : null}
                <div className="video-shot-workspace-shell" style={customShotWorkspaceStyle}>
                  <div className="video-shot-workspace-scroll" ref={shotWorkspaceScrollRef}>
                    <div className="video-shot-workspace-stack" ref={shotWorkspaceStackRef}>
                      <div className="video-prompt-generate-row">
                        <div className="video-prompt-generate-main">
                          <div className="video-prompt-stack">
                            <div className="video-primary-prompt-shell">
                              {showShotLabels ? (
                                <div className="video-shot-label-row video-shot-label-row--primary">
                                  <span className="video-shot-label-pill">Shot 1</span>
                                  <span className="video-shot-label-divider" aria-hidden="true" />
                                </div>
                              ) : null}
                              <ReferencePromptStep
                                promptBadge={promptBadge}
                                promptOrder={promptOrder}
                                referenceText={primaryPromptValue}
                                onPromptTextChange={handlePrimaryPromptChange}
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
                                promptPlaceholder={primaryPromptPlaceholder}
                                beginnerHelperText={primaryPromptHelperText}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      {customKlingPrompts.slice(1).map((shot, index) => (
                        <div className="video-secondary-prompt-shell" key={shot.id}>
                          {showShotLabels ? (
                            <div className="video-shot-label-row">
                              <span className="video-shot-label-pill">{`Shot ${index + 2}`}</span>
                              <button
                                type="button"
                                className="video-shot-remove-button"
                                aria-label={`Remove shot ${index + 2}`}
                                onClick={() => removeKlingShot(shot.id)}
                              >
                                <Trash size={14} weight="regular" aria-hidden="true" />
                              </button>
                            </div>
                          ) : null}
                          <div className="prompt-enhanced-wrapper">
                            <textarea
                              className="prompt-input agent-step-textarea enhanced-prompt-input"
                              value={shot.prompt}
                              onChange={(event) =>
                                handleCustomShotPromptChange(shot.id, event.target.value)
                              }
                              onInput={(event) =>
                                resizeTextareaToContent(event.currentTarget as HTMLTextAreaElement)
                              }
                              rows={4}
                              placeholder={`Describe shot ${index + 2}.`}
                            />
                          </div>
                        </div>
                      ))}
                      {shouldShowAddCustomShotButton ? (
                        <div className="video-add-shot-row">
                          <div className="video-add-shot-main">
                            <button
                              type="button"
                              className="video-add-shot-button"
                              onClick={handleAddShotPrompt}
                              aria-label="Add another shot prompt"
                            >
                              + Add Custom Shot
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="video-right-generate-slot">
                  <div className="video-generate-summary-panel" aria-label="Current video settings">
                    <div className="video-generate-summary-row">
                      <div className="video-generate-summary-item">
                        <span className="video-generate-summary-label">Mode</span>
                        <span className="video-generate-summary-value">
                          {videoModeSummaryLabel}
                        </span>
                      </div>
                      <div className="video-generate-summary-item">
                        <span className="video-generate-summary-label">Shot</span>
                        <span className="video-generate-summary-value">{shotModeSummaryLabel}</span>
                      </div>
                    </div>
                  </div>
                  {shouldShowKlingReferenceImageWarning ? (
                    <div className="video-inline-warning-bubble" role="status" aria-live="polite">
                      Reference image required for generation
                    </div>
                  ) : null}
                  <div className="video-right-generate-button">
                    <AgentGenerateButton
                      onClick={onRegenerate}
                      disabled={
                        isGenerateDisabled ||
                        !hasAnyPromptText ||
                        shouldShowKlingReferenceImageWarning
                      }
                      isBusy={agentIsSending}
                      cost={costCredits != null ? costCredits : "—"}
                    />
                  </div>
                </div>
              </div>
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
