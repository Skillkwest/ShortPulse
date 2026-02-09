/**
 * Text properties panel for AI Studio.
 * Handles prompt entry, mode selection, and model/aspect choices for text-first generation.
 */
import React, { useEffect, useMemo } from "react";
import {
  CaretDown,
  ImageSquare,
  MagicWand,
  Trash,
  VideoCamera,
} from "phosphor-react";
import { AspectDropdown } from "./AspectDropdown";
import { StudioMode } from "../types";
import { modelLogos } from "../constants";
import type { ModelModalContext } from "./ModelModal";
import { AgentSaveButton, AgentGenerateButton } from "../../../prefabs/agent";
import type { AgentActions, AgentMessage } from "../../../prefabs/agent";
import { PromptStep } from "./PromptStep";
import { getModelConfig } from "../logic/modelRegistry";

const VIDEO_DURATION_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const VIDEO_RESOLUTION_OPTIONS = [
  { value: "480p", label: "480p (SD)" },
  { value: "720p", label: "720p (HD)" },
  { value: "1080p", label: "1080p (Full HD)" },
  { value: "1k", label: "1K (1024px wide)" },
  { value: "2k", label: "2K (1440p)" },
  { value: "4k", label: "4K (2160p)" },
];

type TextPropertiesPanelProps = {
  mode: StudioMode;
  aspect: string;
  modelId: string | null;
  modelLabel: string;
  prompt: string;
  promptRef: React.RefObject<HTMLTextAreaElement>;
  agentEnabled?: boolean;
  agentMessages?: AgentMessage[];
  agentActions?: AgentActions;
  agentInput?: string;
  agentIsSending?: boolean;
  agentError?: string;
  stagedPrompt?: string | null;
  useReferenceImageIndicator: boolean;
  hasReferencePreview: boolean;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  onModeChange: (mode: StudioMode) => void;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (anchorId: string, target: HTMLElement, context?: ModelModalContext | null) => void;
  onPromptChange: (value: string) => void;
  onToggleReferenceIndicator: () => void;
  costCredits?: number | null;
  balanceCredits?: number | null;
  balanceLoading?: boolean;
  isPromptGenerating?: boolean;
  isGenerateDisabled?: boolean;
  guardrailReason?: string | null;
  onExpandChat?: () => void;
  onStepActionClick?: (step: "mode" | "model" | "prompt" | "videoSettings") => void;
  agentChatOpen?: boolean;
  onAgentInputChange?: (value: string) => void;
  onAgentSend?: () => void;
  onAgentEnhanceSend?: () => void;
  onAgentMessageClick?: (message: AgentMessage) => void;
  onGenerate: () => void;
  onSavePrompt: () => void;
  onOpenMediaLibrary?: () => void;
  shouldDisableSave?: boolean;
  onCloseAgentChat?: () => void;
  onClearAgentChat?: () => void;
  beginnerMode?: boolean;
  // Video settings props
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
};

type ComposeSendCardProps = {
  mode: StudioMode;
  agentEnabled?: boolean;
  agentMessages?: AgentMessage[];
  agentActions?: AgentActions;
  agentInput?: string;
  agentIsSending?: boolean;
  agentError?: string;
  promptRef: React.RefObject<HTMLTextAreaElement>;
  prompt: string;
  onAgentInputChange?: (value: string) => void;
  onAgentSend?: () => void;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  onSavePrompt: () => void;
  costCredits?: number | null;
  isPromptGenerating?: boolean;
  isGenerateDisabled?: boolean;
  guardrailReason?: string | null;
  shouldDisableSave?: boolean;
  beginnerMode?: boolean;
};

type StepHeaderActionButtonProps = {
  label: string;
  isCollapsed?: boolean;
  onClick: () => void;
};

const StepHeaderActionButton: React.FC<StepHeaderActionButtonProps> = ({ label, isCollapsed = false, onClick }) => {
  return (
    <button
      type="button"
      className="ghost-btn mini step-utility-btn"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-expanded={!isCollapsed}
    >
      <CaretDown size={16} weight="bold" aria-hidden />
    </button>
  );
};

const modeIconMap: Record<StudioMode, React.ComponentType<any>> = {
  text: MagicWand,
  image: ImageSquare,
  video: VideoCamera,
};

/**
 * Renders the Create tool controls.
 */
export function TextPropertiesPanel({
  mode,
  aspect,
  modelId,
  modelLabel,
  prompt,
  promptRef,
  useReferenceImageIndicator,
  hasReferencePreview,
  isModelModalOpen,
  modelModalAnchor,
  onModeChange,
  onAspectChange,
  onModelPickerOpen,
  onPromptChange,
  onToggleReferenceIndicator,
  agentEnabled = false,
  agentMessages = [],
  agentActions,
  agentInput = "",
  agentIsSending = false,
  agentError,
  stagedPrompt = null,
  onExpandChat,
  onStepActionClick,
  onAgentInputChange,
  onAgentSend,
  onAgentEnhanceSend,
  onAgentMessageClick,
  agentChatOpen = false,
  onSavePrompt,
  onOpenMediaLibrary,
  shouldDisableSave = false,
  onGenerate,
  costCredits,
  balanceCredits,
  balanceLoading,
  isPromptGenerating = false,
  isGenerateDisabled = false,
  guardrailReason = null,
  onCloseAgentChat,
  onClearAgentChat,
  beginnerMode = false,
  // Video settings props
  videoDurationSeconds,
  videoResolution,
  videoGenerateAudio,
  videoCameraFixed,
  videoAutoFix,
  onVideoDurationChange,
  onVideoResolutionChange,
  onVideoGenerateAudioChange,
  onVideoCameraFixedChange,
  onVideoAutoFixChange,
}: TextPropertiesPanelProps) {


  const isTextMode = mode === "text";
  const shouldHidePromptStep = isTextMode && useReferenceImageIndicator;
  const showPromptInput = !shouldHidePromptStep;
  const promptStepNumber = "2";
  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;
  const primaryActionLabel = isTextMode ? "Send" : "Generate";
  const primaryActionBusyLabel = isTextMode ? "Sending…" : "Generating…";
  const isTextPromptMode = mode === "text";
  const [collapsedSteps, setCollapsedSteps] = React.useState<{ mode: boolean; model: boolean; prompt: boolean; videoSettings: boolean }>({
    mode: false,
    model: false,
    prompt: false,
    videoSettings: false,
  });

  const toggleStep = (step: "mode" | "model" | "prompt" | "videoSettings") => {
    setCollapsedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
    onStepActionClick?.(step);
  };

  const handleCreateModelOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    const context: ModelModalContext | null =
      mode === "image" ? "text-image" : mode === "video" ? "text-video" : null;
    onModelPickerOpen("create-model", event.currentTarget, context);
  };

  const expandIfCollapsed = (step: "mode" | "model" | "prompt" | "videoSettings") => {
    setCollapsedSteps((prev) => {
      if (!prev[step]) {
        return prev;
      }
      const next = { ...prev, [step]: false };
      onStepActionClick?.(step);
      return next;
    });
  };

  // Model-specific detection for conditional UI
  const modelConfig = useMemo(() => modelId ? getModelConfig(modelId) : null, [modelId]);
  const isSeedanceI2VModel = modelId === "fal-ai/bytedance/seedance/v1.5/pro/image-to-video";
  const isVeoModel = modelId?.includes("veo3.1") ?? false;
  const isKling3Model = modelId?.includes("kling-video/v3/pro") ?? false;

  // Dynamic filtering for video settings
  const durationOptions = useMemo(() => {
    if (!modelConfig?.allowedDurations) {
      return VIDEO_DURATION_OPTIONS;
    }
    return modelConfig.allowedDurations;
  }, [modelConfig]);

  const resolutionOptions = useMemo(() => {
    if (!modelConfig?.allowedResolutions) {
      return VIDEO_RESOLUTION_OPTIONS;
    }
    return VIDEO_RESOLUTION_OPTIONS.filter(option =>
      modelConfig.allowedResolutions?.includes(option.value)
    );
  }, [modelConfig]);

  // Auto-clamp invalid duration values when switching models
  useEffect(() => {
    if (!modelConfig || !onVideoDurationChange) return;
    if (modelConfig.allowedDurations && videoDurationSeconds && !modelConfig.allowedDurations.includes(videoDurationSeconds)) {
      const closestDuration = modelConfig.allowedDurations.reduce((prev, curr) =>
        Math.abs(curr - videoDurationSeconds) < Math.abs(prev - videoDurationSeconds) ? curr : prev
      );
      onVideoDurationChange(closestDuration);
    }
  }, [modelConfig, videoDurationSeconds, onVideoDurationChange]);

  // Auto-clamp invalid resolution values when switching models
  useEffect(() => {
    if (!modelConfig || !onVideoResolutionChange) return;
    if (modelConfig.allowedResolutions && videoResolution && !modelConfig.allowedResolutions.includes(videoResolution)) {
      onVideoResolutionChange(modelConfig.defaultResolution ?? modelConfig.allowedResolutions[0]);
    }
  }, [modelConfig, videoResolution, onVideoResolutionChange]);

  return (
    <div className="tool-properties text-properties-panel">
      <div className="tool-header">
        <p className="eyebrow">Text</p>
        <p className="subdued tiny helper-text">Generate new content using text prompts.</p>
      </div>
      <div
        className={`step-card ${collapsedSteps.mode ? "is-collapsed" : ""}`}
        onClick={() => expandIfCollapsed("mode")}
        role="group"
        aria-label="Select generation mode section"
      >
        <div className="step-card-header">
          {beginnerMode && <span className="step-badge">1</span>}
          <div className="step-header-copy">
            <p className="step-title">{beginnerMode ? "Select Generation Mode" : "Choose Generation Mode"}</p>
            <span className="step-subtitle tiny helper-text">Select the output type you want to generate. </span>
          </div>
          {!beginnerMode ? (
            <div className="step-header-actions">
              <StepHeaderActionButton
                label="Open generation mode options"
                isCollapsed={collapsedSteps.mode}
                onClick={() => toggleStep("mode")}
              />
            </div>
          ) : null}
        </div>
        {!collapsedSteps.mode ? (
          <div className="create-controls top-row mode-toggle-row" role="group" aria-label="Select generation mode">
            <button
              type="button"
              className={`ghost-btn small mode-toggle-btn ${mode === "text" ? "is-active" : ""}`}
              aria-pressed={mode === "text"}
              onClick={() => onModeChange("text")}
            >
              Text Prompt
            </button>
            <button
              type="button"
              className={`ghost-btn small mode-toggle-btn ${mode === "image" ? "is-active" : ""}`}
              aria-pressed={mode === "image"}
              onClick={() => onModeChange("image")}
            >
              Image
            </button>
            <button
              type="button"
              className={`ghost-btn small mode-toggle-btn ${mode === "video" ? "is-active" : ""}`}
              aria-pressed={mode === "video"}
              onClick={() => onModeChange("video")}
            >
              Video
            </button>
          </div>
        ) : null}
      </div>
      <PromptStep
        stepNumber={promptStepNumber}
        title="Write your prompt"
        subtitle="Start typing your prompt or drag & drop a prompt from the reference grid."
        prompt={prompt}
        onPromptChange={onPromptChange}
        agentEnabled={agentEnabled}
        agentMessages={agentMessages}
        agentActions={agentActions}
        agentInput={agentInput}
        agentIsSending={agentIsSending}
        agentError={agentError}
        stagedPrompt={stagedPrompt}
        agentChatOpen={agentChatOpen}
        onAgentInputChange={onAgentInputChange}
        onAgentSend={onAgentSend}
        onAgentEnhanceSend={onAgentEnhanceSend}
        onAgentMessageClick={onAgentMessageClick}
        onExpandChat={onExpandChat}
        onCloseAgentChat={onCloseAgentChat}
        onClearAgentChat={onClearAgentChat}
        onSavePrompt={onSavePrompt}
        onOpenMediaLibrary={onOpenMediaLibrary}
        isCollapsed={collapsedSteps.prompt}
        onToggleCollapse={() => toggleStep("prompt")}
        isGenerating={isPromptGenerating}
        shouldDisableSave={shouldDisableSave}
        beginnerMode={beginnerMode}
        className={isTextMode ? "step2-text-mode" : ""}
      />
      {!isTextMode ? (
        <div
          className={`step-card ${collapsedSteps.model ? "is-collapsed" : ""}`}
          onClick={() => expandIfCollapsed("model")}
          role="group"
          aria-label="Choose frame and model section"
        >
          <div className="step-card-header">
            {beginnerMode && <span className="step-badge">3</span>}
            <div className="step-header-copy">
              <p className="step-title">Choose frame & model</p>
              <span className="step-subtitle tiny helper-text">Set the aspect ratio, then select the model.</span>
            </div>
            {!beginnerMode ? (
              <div className="step-header-actions">
                <StepHeaderActionButton
                  label="Open aspect ratio and model options"
                  isCollapsed={collapsedSteps.model}
                  onClick={() => toggleStep("model")}
                />
              </div>
            ) : null}
          </div>
          {!collapsedSteps.model ? (
            <div className="create-controls dual-controls frame-model-controls">
              <div className="control-row compact">
                <label className="input-label">Aspect ratio</label>
                <AspectDropdown aspect={aspect} onSelect={onAspectChange} />
              </div>
              <div className="control-row compact">
                <label className="input-label">Model</label>
                <button
                  type="button"
                  className={`model-picker-btn ${!modelId ? "is-empty" : ""} ${isModelModalOpen && modelModalAnchor === "create-model" ? "is-open" : ""}`}
                  data-model-anchor="create-model"
                  onClick={handleCreateModelOpen}
                >
                  <div className="model-picker-row">
                    <span className="model-picker-value">
                      {modelLogoSrc ? <img className="model-chip-logo-img" src={modelLogoSrc} alt="" aria-hidden /> : null}
                      {modelLabel}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {!isTextMode && mode === "video" ? (
        <div
          className={`step-card video-settings-card ${collapsedSteps.videoSettings ? "is-collapsed" : ""}`}
          onClick={() => expandIfCollapsed("videoSettings")}
          role="group"
          aria-label="Choose video settings section"
        >
          <div className="step-card-header">
            {beginnerMode && <span className="step-badge">4</span>}
            <div className="step-header-copy">
              <p className="step-title">Choose video settings</p>
              <span className="step-subtitle tiny helper-text">Set duration, resolution, and audio output before generating.</span>
            </div>
            {!beginnerMode ? (
              <div className="step-header-actions">
                <StepHeaderActionButton
                  label="Open video settings"
                  isCollapsed={collapsedSteps.videoSettings}
                  onClick={() => toggleStep("videoSettings")}
                />
              </div>
            ) : null}
          </div>
          {!collapsedSteps.videoSettings ? (
            <div className="create-controls video-settings-controls">
              {/* Duration Dropdown */}
              <div className="control-row compact fixed-select">
                <label className="input-label">Duration</label>
                <select
                  className="model-select"
                  value={videoDurationSeconds ?? 8}
                  onChange={(e) => onVideoDurationChange?.(Number(e.target.value))}
                >
                  {durationOptions.map((duration) => (
                    <option key={duration} value={duration}>
                      {duration} second{duration !== 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Resolution Dropdown */}
              <div className="control-row compact fixed-select">
                <label className="input-label">Resolution</label>
                <select
                  className="model-select"
                  value={videoResolution ?? "1080p"}
                  onChange={(e) => onVideoResolutionChange?.(e.target.value)}
                >
                  {resolutionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Generate Audio Toggle */}
              <div className="video-settings-toggle-row">
                <div className="video-settings-toggle-copy">
                  <span className="input-label">Generate audio</span>
                  <span className="tiny helper-text">Generate native synchronized audio with the video</span>
                </div>
                <button
                  type="button"
                  className={`audio-toggle ${videoGenerateAudio ? "is-active" : ""}`}
                  onClick={() => onVideoGenerateAudioChange?.(!videoGenerateAudio)}
                >
                  <span className="audio-toggle-track">
                    <span className="audio-toggle-dot" />
                  </span>
                </button>
              </div>

              {/* Seedance Camera Fixed Toggle */}
              {isSeedanceI2VModel && (
                <div className="video-settings-toggle-row">
                  <div className="video-settings-toggle-copy">
                    <span className="input-label">Camera Fixed</span>
                    <span className="tiny helper-text">Lock camera position (tripod shot)</span>
                  </div>
                  <button
                    type="button"
                    className={`reference-toggle ${videoCameraFixed ? "is-active" : ""}`}
                    onClick={() => onVideoCameraFixedChange?.(!videoCameraFixed)}
                  >
                    <span className="reference-toggle-track">
                      <span className="reference-toggle-dot" />
                    </span>
                  </button>
                </div>
              )}

              {/* Veo Auto-fix Toggle */}
              {isVeoModel && (
                <div className="video-settings-toggle-row">
                  <div className="video-settings-toggle-copy">
                    <span className="input-label">Auto-fix</span>
                    <span className="tiny helper-text">Automatically correct visual issues</span>
                  </div>
                  <button
                    type="button"
                    className={`reference-toggle ${videoAutoFix ? "is-active" : ""}`}
                    onClick={() => onVideoAutoFixChange?.(!videoAutoFix)}
                  >
                    <span className="reference-toggle-track">
                      <span className="reference-toggle-dot" />
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ComposeSendCard({
  mode,
  agentEnabled = false,
  agentMessages = [],
  agentActions,
  agentInput = "",
  agentIsSending = false,
  agentError,
  promptRef,
  prompt,
  onAgentInputChange,
  onAgentSend,
  onPromptChange,
  onGenerate,
  onSavePrompt,
  costCredits,
  isPromptGenerating = false,
  isGenerateDisabled = false,
  guardrailReason = null,
  shouldDisableSave = false,
  beginnerMode = false,
}: ComposeSendCardProps) {
  if (mode === "text") {
    return null;
  }
  const primaryActionLabel = "Generate";
  const primaryActionBusyLabel = "Generating…";
  const costValue = costCredits != null ? costCredits : "—";
  const promptThinking = agentIsSending || isPromptGenerating;

  return (
    <div className="step-card prompt-step generate-step-card">
      <div className="step-card-header">
        {beginnerMode && <span className="step-badge">{mode === "video" ? "5" : "4"}</span>}
        <div className="step-header-copy">
          {beginnerMode ? <p className="step-title">Generate</p> : null}
          <span className="step-subtitle tiny helper-text">Run generation with the current prompt and selections.</span>
        </div>
      </div>
      <div className="create-controls single-control">
        <AgentGenerateButton
          onClick={onGenerate}
          disabled={isGenerateDisabled || isPromptGenerating}
          isBusy={isPromptGenerating}
          cost={costValue}
        />
        {/* Guardrail warning intentionally hidden; disabled button communicates state. */}
        {agentEnabled && agentError ? <div className="inline-error-hint">{agentError}</div> : null}
      </div>
    </div>
  );
}
