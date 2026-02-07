/**
 * Reference properties panel for AI Studio.
 * Provides reference dropzones, aspect/model selection, and prompt capture for image/video workflows.
 */
import React, { useRef, useState } from "react";
import { ArrowFatLinesRight, BracketsSquare, ImageSquare, Plus, UploadSimple, VideoCamera } from "phosphor-react";
import { AspectDropdown } from "./AspectDropdown";
import { AspectOption } from "../types";
import { extractDragDropPayload, extractVideoDragDropPayload, isImageDragTransfer, isVideoDragTransfer } from "../utils/dragDrop";
import { modelLogos } from "../constants";
import { stripEditLabel } from "../utils/modelLabels";
import { PromptStep } from "./PromptStep";
import { CaretDown } from "phosphor-react";
import { AgentGenerateButton } from "../../../prefabs/agent";
import type { AgentActions, AgentMessage } from "../../../prefabs/agent";
import type { ModelModalContext } from "./ModelModal";

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
  videoReferenceMode?: "standard" | "keyframes" | "motion";
  onVideoReferenceModeChange?: (value: "standard" | "keyframes" | "motion") => void;
  motionCharacterUrl?: string | null;
  motionReferenceVideoUrl?: string | null;
  onMotionCharacterChange?: (url: string | null) => void;
  onMotionReferenceVideoChange?: (url: string | null) => void;
  videoDurationSeconds?: number;
  videoResolution?: string;
  videoGenerateAudio?: boolean;
  onVideoDurationChange?: (value: number) => void;
  onVideoResolutionChange?: (value: string) => void;
  onVideoGenerateAudioChange?: (value: boolean) => void;
  aspectOptions: AspectOption[];
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (anchorId: string, target: HTMLElement, context?: ModelModalContext | null) => void;
  onPrimaryImageChange: (url: string | null) => void;
  onExtraImageChange: (index: number, url: string | null) => void;
  onPromptTextChange: (value: string) => void;
  onSave: () => void;
  onRegenerate: () => void;
  onOpenMediaLibrary?: () => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  costCredits?: number | null;
  isGenerateDisabled?: boolean;
  guardrailReason?: string | null;
  // Agent props
  agentEnabled?: boolean;
  agentMessages?: AgentMessage[];
  agentActions?: AgentActions;
  agentInput?: string;
  agentIsSending?: boolean;
  agentError?: string;
  stagedPrompt?: string | null;
  agentChatOpen?: boolean;
  onAgentInputChange?: (value: string) => void;
  onAgentSend?: () => void;
  onAgentEnhanceSend?: () => void;
  onAgentMessageClick?: (message: AgentMessage) => void;
  onExpandChat?: () => void;
  onCloseAgentChat?: () => void;
  onClearAgentChat?: () => void;
  beginnerMode?: boolean;
};

type StepHeaderActionButtonProps = {
  label: string;
  isCollapsed?: boolean;
  onClick: () => void;
};

const StepHeaderActionButton: React.FC<StepHeaderActionButtonProps> = ({
  label,
  isCollapsed = false,
  onClick,
}) => {
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

const VIDEO_DURATION_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const VIDEO_RESOLUTION_OPTIONS = [
  { value: "720p", label: "720p (HD)" },
  { value: "1080p", label: "1080p (Full HD)" },
  { value: "1k", label: "1K (1024px wide)" },
  { value: "2k", label: "2K (1440p)" },
  { value: "4k", label: "4K (2160p)" },
];

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
  motionCharacterUrl,
  motionReferenceVideoUrl,
  onMotionCharacterChange,
  onMotionReferenceVideoChange,
  videoDurationSeconds,
  videoResolution,
  videoGenerateAudio,
  onVideoDurationChange,
  onVideoResolutionChange,
  onVideoGenerateAudioChange,
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
  onOpenMediaLibrary,
  resolvePreviewUrlById,
  costCredits,
  isGenerateDisabled = false,
  guardrailReason = null,
  agentEnabled = false,
  agentMessages = [],
  agentActions,
  agentInput = "",
  agentIsSending = false,
  agentError,
  stagedPrompt = null,
  agentChatOpen = false,
  onAgentInputChange,
  onAgentSend,
  onAgentEnhanceSend,
  onAgentMessageClick,
  onExpandChat,
  onCloseAgentChat,
  onClearAgentChat,
  beginnerMode = false,
}: ReferencePropertiesPanelProps) {
  const primaryInputRef = useRef<HTMLInputElement | null>(null);
  const extraOneInputRef = useRef<HTMLInputElement | null>(null);
  const extraTwoInputRef = useRef<HTMLInputElement | null>(null);
  const motionImageInputRef = useRef<HTMLInputElement | null>(null);
  const motionVideoInputRef = useRef<HTMLInputElement | null>(null);
  const [primaryDragActive, setPrimaryDragActive] = useState(false);
  const [extraDragActive, setExtraDragActive] = useState([false, false]);
  const [motionImageDragActive, setMotionImageDragActive] = useState(false);
  const [motionVideoDragActive, setMotionVideoDragActive] = useState(false);
  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;

  const [collapsedSteps, setCollapsedSteps] = React.useState<{
    reference: boolean;
    model: boolean;
    prompt: boolean;
    videoSettings: boolean;
    generate: boolean;
  }>({
    reference: false,
    model: false,
    prompt: false,
    videoSettings: false,
    generate: false,
  });

  const toggleStep = (step: "reference" | "model" | "prompt" | "videoSettings" | "generate") => {
    setCollapsedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  const expandIfCollapsed = (step: "reference" | "model" | "prompt" | "videoSettings" | "generate") => {
    setCollapsedSteps((prev) => {
      if (!prev[step]) return prev;
      return { ...prev, [step]: false };
    });
  };

  const canSwapFrames = Boolean(referenceImageUrl || extraImageUrls[0]);

  const handleSwapFrames = () => {
    if (!canSwapFrames) return;
    onPrimaryImageChange(extraImageUrls[0]);
    onExtraImageChange(0, referenceImageUrl);
  };

  const handleFileSelection =
    (setter: (url: string | null) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setter(url);
      event.target.value = "";
    };

  const handleVideoFileSelection =
    (setter?: (url: string | null) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!setter) return;
      const file = event.target.files?.[0];
      if (!file || !file.type.startsWith("video/")) return;
      const url = URL.createObjectURL(file);
      setter(url);
      event.target.value = "";
    };

  const handlePromptDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const { promptText } = extractDragDropPayload(event.dataTransfer);
    if (promptText) {
      onPromptTextChange(promptText);
    }
  };

  const handleImageDrop = (setter: (url: string | null) => void) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const { imageUrl, fromFile, referenceId } = extractDragDropPayload(event.dataTransfer);
    let nextUrl = imageUrl;

    // If we only got a blob and we have a reference id, resolve from state.
    if ((!nextUrl || nextUrl.startsWith("blob:")) && referenceId && resolvePreviewUrlById) {
      nextUrl = resolvePreviewUrlById(referenceId);
    }

    if (!nextUrl) return;

    const isBlobUrl = nextUrl.startsWith("blob:");
    const canAcceptBlob = fromFile || Boolean(referenceId); // allow reference grid drags that use object URLs

    if (!isBlobUrl || canAcceptBlob) setter(nextUrl);
  };

  const handleVideoDrop = (setter?: (url: string | null) => void) => (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!setter) return;
    const { videoUrl, fromFile, referenceId } = extractVideoDragDropPayload(event.dataTransfer);
    let nextUrl = videoUrl;

    if ((!nextUrl || nextUrl.startsWith("blob:")) && referenceId && resolvePreviewUrlById) {
      const resolved = resolvePreviewUrlById(referenceId);
      if (resolved) {
        nextUrl = resolved;
      }
    }

    if (!nextUrl) return;

    const isBlobUrl = nextUrl.startsWith("blob:");
    const canAcceptBlob = fromFile || Boolean(referenceId);

    if (!isBlobUrl || canAcceptBlob) setter(nextUrl);
  };

  const setExtraDragActiveAt = (index: number, value: boolean) => {
    setExtraDragActive((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const allowImageDrag = (event: React.DragEvent<HTMLDivElement>) => {
    if (isImageDragTransfer(event.dataTransfer)) {
      event.preventDefault();
      return true;
    }
    return false;
  };

  const allowVideoDrag = (event: React.DragEvent<HTMLDivElement>) => {
    if (isVideoDragTransfer(event.dataTransfer)) {
      event.preventDefault();
      return true;
    }
    return false;
  };

  const handlePrimaryDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setPrimaryDragActive(false);
    handleImageDrop(onPrimaryImageChange)(event);
  };

  const handleMotionImageDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setMotionImageDragActive(false);
    if (onMotionCharacterChange) {
      handleImageDrop(onMotionCharacterChange)(event);
    }
  };

  const handleMotionVideoDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setMotionVideoDragActive(false);
    if (onMotionReferenceVideoChange) {
      handleVideoDrop(onMotionReferenceVideoChange)(event);
    }
  };

  const handleExtraDrop = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    setExtraDragActiveAt(index, false);
    handleImageDrop((url) => onExtraImageChange(index, url))(event);
  };

  const handlePrimaryDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (allowImageDrag(event)) {
      setPrimaryDragActive(true);
    }
  };

  const handlePrimaryDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (allowImageDrag(event)) {
      setPrimaryDragActive(true);
    }
  };

  const handlePrimaryDragLeave = () => {
    setPrimaryDragActive(false);
  };

  const handleMotionImageDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (allowImageDrag(event)) {
      setMotionImageDragActive(true);
    }
  };

  const handleMotionImageDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (allowImageDrag(event)) {
      setMotionImageDragActive(true);
    }
  };

  const handleMotionImageDragLeave = () => {
    setMotionImageDragActive(false);
  };

  const handleMotionVideoDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (allowVideoDrag(event)) {
      setMotionVideoDragActive(true);
    }
  };

  const handleMotionVideoDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (allowVideoDrag(event)) {
      setMotionVideoDragActive(true);
    }
  };

  const handleMotionVideoDragLeave = () => {
    setMotionVideoDragActive(false);
  };

  const handleExtraDragEnter = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    if (allowImageDrag(event)) {
      setExtraDragActiveAt(index, true);
    }
  };

  const handleExtraDragOver = (index: number) => (event: React.DragEvent<HTMLDivElement>) => {
    if (allowImageDrag(event)) {
      setExtraDragActiveAt(index, true);
    }
  };

  const handleExtraDragLeave = (index: number) => () => {
    setExtraDragActiveAt(index, false);
  };

  const isVideoVariant = variant === "video";
  const activeVideoMode = videoReferenceMode ?? "standard";
  const isMotionMode = isVideoVariant && activeVideoMode === "motion";
  const isKeyframesMode = isVideoVariant && activeVideoMode === "keyframes";
  const isStandardMode = !isVideoVariant || activeVideoMode === "standard";
  const motionCharacterValue = motionCharacterUrl ?? null;
  const motionVideoValue = motionReferenceVideoUrl ?? null;
  const referenceStepTitle = isVideoVariant
    ? isMotionMode
      ? "Add Motion References"
      : isKeyframesMode
        ? "Add Reference Frames"
        : "Add Reference Image"
    : "Add Reference Images";
  const referenceStepSubtitle = isVideoVariant
    ? isMotionMode
      ? "Upload a character image and a motion reference video."
      : isKeyframesMode
        ? "Upload or drag and drop images from the reference grid."
        : "Upload or drag and drop a single image for standard image-to-video."
    : "Upload or drag and drop images from the reference grid.";
  const promptOrder = isVideoVariant ? 4 : 2;
  const modelOrder = isVideoVariant ? 2 : 3;
  const referenceOrder = isVideoVariant ? 1 : 1;
  const videoSettingsOrder = isVideoVariant ? 3 : 0;
  const generateOrder = isVideoVariant ? 5 : 4;
  const videoDurationValue = videoDurationSeconds ?? 6;
  const videoResolutionValue = videoResolution ?? "1080p";
  const videoGenerateAudioValue = Boolean(videoGenerateAudio);

  return (
    <div className="tool-properties reference-properties-panel">
      <div className="tool-header">
        <p className="eyebrow">{title}</p>
        <p className="subdued tiny helper-text">{subtitle}</p>
      </div>
      <div className="reference-drop-layout-inner">
        <div className="reference-dropzone-block prompt-block" style={{ order: promptOrder }}>
          <PromptStep
            stepNumber={isVideoVariant ? "4" : "2"}
            title="Write Your Prompt"
            subtitle="Start typing your prompt or drag & drop a prompt from the reference grid."
            prompt={referenceText ?? ""}
            onPromptChange={onPromptTextChange}
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
            onSavePrompt={onSave}
            onOpenMediaLibrary={onOpenMediaLibrary}
            isCollapsed={collapsedSteps.prompt}
            onToggleCollapse={() => toggleStep("prompt")}
            isGenerating={false} // Reference flows don't have a specific prompt generating state in top-level prop, but could pass isGeneratorDisabled
            onDrop={handlePromptDrop as any}
            onDragOver={(e) => e.preventDefault()}
            className="reference-step-card"
            beginnerMode={beginnerMode}
          />
        </div>
        {!isMotionMode ? (
          <div
            className={`step-card reference-frame-card ${collapsedSteps.model ? "is-collapsed" : ""}`}
            onClick={() => expandIfCollapsed("model")}
            style={{ order: modelOrder }}
          >
            <div className="step-card-header">
              {beginnerMode && <span className="step-badge">{isVideoVariant ? "2" : "3"}</span>}
              <div className="step-header-copy">
                <p className="step-title">Choose Frame & Model</p>
                <span className="step-subtitle tiny helper-text">Pick the target aspect ratio and AI model before you generate.</span>
              </div>
              {!beginnerMode ? (
                <div className="step-header-actions">
                  <StepHeaderActionButton
                    label="Open model options"
                    isCollapsed={collapsedSteps.model}
                    onClick={() => toggleStep("model")}
                  />
                </div>
              ) : null}
            </div>
            {!collapsedSteps.model ? (
              <div className="create-controls dual-controls reference-frame-controls frame-model-controls">
                <div className="control-row compact">
                  <label className="input-label">Aspect ratio</label>
                  <AspectDropdown aspect={aspect} onSelect={onAspectChange} options={aspectOptions} />
                </div>
                <div className="control-row compact">
                  <label className="input-label">Model</label>
                  <button
                    type="button"
                    className={`model-picker-btn ${isModelModalOpen && modelModalAnchor === "reference-model" ? "is-open" : ""}`}
                    data-model-anchor="reference-model"
                    onClick={(event) =>
                      onModelPickerOpen(
                        "reference-model",
                        event.currentTarget,
                        variant === "image" ? "reference-image" : "reference-video",
                      )
                    }
                  >
                    <div className="model-picker-row">
                      <span className="model-picker-value">
                        {modelLogoSrc ? <img className="model-chip-logo-img" src={modelLogoSrc} alt="" aria-hidden /> : null}
                        {stripEditLabel(modelLabel)}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="reference-dropzone-block image-block" style={{ order: referenceOrder }}>
          <div
            className={`reference-step-card ${collapsedSteps.reference ? "is-collapsed" : ""} ${isVideoVariant ? "is-video-refs" : "is-image-refs"}`}
            onClick={() => expandIfCollapsed("reference")}
          >
            <div className="reference-step-header">
              {beginnerMode && <span className="step-badge mini">{isVideoVariant ? "1" : "1"}</span>}
              <div className="reference-step-copy">
                <p className="step-title">{referenceStepTitle}</p>
                <span className="step-subtitle tiny helper-text">
                  {referenceStepSubtitle}
                </span>
              </div>
            { !beginnerMode ? (
              <div className="reference-drop-header-actions">
                <StepHeaderActionButton
                  label="Open reference options"
                  isCollapsed={collapsedSteps.reference}
                  onClick={() => toggleStep("reference")}
                />
              </div>
            ) : null }
            </div>
            {!collapsedSteps.reference ? (
              <>
                {isVideoVariant ? (
                  <div className="reference-mode-toggle-row prompt-mode-toggle-row full-width" role="tablist" aria-label="Video reference mode">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeVideoMode === "standard"}
                      className={`mode-toggle-btn ${activeVideoMode === "standard" ? "is-active" : ""}`}
                      onClick={() => onVideoReferenceModeChange?.("standard")}
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeVideoMode === "keyframes"}
                      className={`mode-toggle-btn ${activeVideoMode === "keyframes" ? "is-active" : ""}`}
                      onClick={() => onVideoReferenceModeChange?.("keyframes")}
                    >
                      Keyframes
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeVideoMode === "motion"}
                      className={`mode-toggle-btn ${activeVideoMode === "motion" ? "is-active" : ""}`}
                      onClick={() => onVideoReferenceModeChange?.("motion")}
                    >
                      Motion Control
                    </button>
                  </div>
                ) : null}
                {isMotionMode ? (
                  <div className="drop-image-row motion-drop-row">
                    <div className="primary-drop">
                      <div
                        className={`reference-dropzone ${motionCharacterValue ? "has-preview" : ""} ${motionImageDragActive ? "is-dragging" : ""}`}
                        onDrop={handleMotionImageDrop}
                        onDragEnter={handleMotionImageDragEnter}
                        onDragOver={handleMotionImageDragOver}
                        onDragLeave={handleMotionImageDragLeave}
                        onClick={() => motionImageInputRef.current?.click()}
                        style={motionCharacterValue ? { backgroundImage: `url(${motionCharacterValue})` } : undefined}
                      >
                        {motionCharacterValue ? (
                          <button
                            type="button"
                            className="dropzone-clear"
                            onClick={(event) => {
                              event.stopPropagation();
                              onMotionCharacterChange?.(null);
                            }}
                          >
                            ×
                          </button>
                        ) : null}
                        <div className="reference-drop-content motion-drop-content">
                          <span className="motion-drop-icon" aria-hidden="true">
                            <ImageSquare size={18} weight="bold" />
                          </span>
                          <p className="motion-drop-title">Add your character</p>
                          <p className="motion-drop-subtitle">Image with visible face and body</p>
                        </div>
                      </div>
                    </div>
                    <div className="motion-plus" aria-hidden="true">
                      <Plus size={25} weight="thin" />
                    </div>
                    <div className="primary-drop">
                      <div
                        className={`reference-dropzone ${motionVideoValue ? "has-preview has-video" : ""} ${motionVideoDragActive ? "is-dragging" : ""}`}
                        onDrop={handleMotionVideoDrop}
                        onDragEnter={handleMotionVideoDragEnter}
                        onDragOver={handleMotionVideoDragOver}
                        onDragLeave={handleMotionVideoDragLeave}
                        onClick={() => motionVideoInputRef.current?.click()}
                      >
                        {motionVideoValue ? (
                          <button
                            type="button"
                            className="dropzone-clear"
                            onClick={(event) => {
                              event.stopPropagation();
                              onMotionReferenceVideoChange?.(null);
                            }}
                          >
                            ×
                          </button>
                        ) : null}
                        {motionVideoValue ? (
                          <video
                            className="reference-drop-video"
                            src={motionVideoValue}
                            autoPlay
                            muted
                            loop
                            playsInline
                          />
                        ) : null}
                        <div className="reference-drop-content motion-drop-content">
                          <span className="motion-drop-icon" aria-hidden="true">
                            <VideoCamera size={18} weight="bold" />
                          </span>
                          <p className="motion-drop-title">Add motion to copy</p>
                          <p className="motion-drop-subtitle">Video duration: 3-30 seconds</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="drop-image-row">
                    <div className="primary-drop">
                      <div
                        className={`reference-dropzone ${referenceImageUrl ? "has-preview" : ""} ${primaryDragActive ? "is-dragging" : ""}`}
                        onDrop={handlePrimaryDrop}
                        onDragEnter={handlePrimaryDragEnter}
                        onDragOver={handlePrimaryDragOver}
                        onDragLeave={handlePrimaryDragLeave}
                        onClick={() => primaryInputRef.current?.click()}
                        style={referenceImageUrl ? { backgroundImage: `url(${referenceImageUrl})` } : undefined}
                      >
                        {isVideoVariant ? (
                          <span className="dropzone-tag">
                            {isStandardMode ? "Reference image" : "First frame"}
                          </span>
                        ) : null}
                        {referenceImageUrl ? (
                          <button
                            type="button"
                            className="dropzone-clear"
                            onClick={(event) => {
                              event.stopPropagation();
                              onPrimaryImageChange(null);
                            }}
                          >
                            ×
                          </button>
                        ) : null}
                        <div className="reference-drop-content image-drop-content">
                          <UploadSimple size={22} weight="regular" />
                          <p className="reference-drop-title helper-text">Click to upload an image</p>
                        </div>
                      </div>
                    </div>
                    {isVideoVariant && isKeyframesMode ? (
                      <>
                        <button
                          type="button"
                          className="reference-swap-control"
                          onClick={handleSwapFrames}
                          disabled={!canSwapFrames}
                          aria-label="Swap first and last frame references"
                        >
                          <ArrowFatLinesRight size={24} weight="regular" aria-hidden />
                        </button>
                        <div className="primary-drop">
                          <div
                            className={`reference-dropzone ${extraImageUrls[0] ? "has-preview" : ""} ${extraDragActive[0] ? "is-dragging" : ""}`}
                            onDrop={handleExtraDrop(0)}
                            onDragEnter={handleExtraDragEnter(0)}
                            onDragOver={handleExtraDragOver(0)}
                            onDragLeave={handleExtraDragLeave(0)}
                            onClick={() => extraOneInputRef.current?.click()}
                            style={extraImageUrls[0] ? { backgroundImage: `url(${extraImageUrls[0]})` } : undefined}
                          >
                            <span className="dropzone-tag">Last frame</span>
                            {extraImageUrls[0] ? (
                              <button
                                type="button"
                                className="dropzone-clear"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onExtraImageChange(0, null);
                                }}
                              >
                                ×
                              </button>
                            ) : (
                              <div className="reference-drop-content image-drop-content">
                                <UploadSimple size={22} weight="regular" />
                                <p className="reference-drop-title helper-text">Click to upload an image</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : !isVideoVariant ? (
                      <>
                        <div className="reference-drop-divider" aria-hidden="true">
                          <BracketsSquare size={22} weight="bold" />
                        </div>
                        {[extraOneInputRef, extraTwoInputRef].map((inputRef, index) => {
                          const previewUrl = extraImageUrls[index];
                          return (
                            <div className="secondary-drop" key={`extra-drop-${index}`}>
                              <div
                                className={`reference-dropzone extra ${previewUrl ? "has-preview" : ""} ${extraDragActive[index] ? "is-dragging" : ""}`}
                                onDrop={handleExtraDrop(index)}
                                onDragEnter={handleExtraDragEnter(index)}
                                onDragOver={handleExtraDragOver(index)}
                                onDragLeave={handleExtraDragLeave(index)}
                                onClick={() => inputRef.current?.click()}
                                style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
                              >
                                {previewUrl ? (
                                  <button
                                    type="button"
                                    className="dropzone-clear"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      onExtraImageChange(index, null);
                                    }}
                                  >
                                    ×
                                  </button>
                                ) : (
                                  <Plus size={22} weight="regular" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    ) : null}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
        {isVideoVariant ? (
          <div
            className={`step-card video-settings-card ${collapsedSteps.videoSettings ? "is-collapsed" : ""}`}
            onClick={() => expandIfCollapsed("videoSettings")}
            style={{ order: videoSettingsOrder }}
          >
            <div className="step-card-header">
              {beginnerMode && <span className="step-badge">3</span>}
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
                {!isMotionMode ? (
                  <div className="control-row compact fixed-select">
                    <label className="input-label">Duration</label>
                    <select
                      className="model-select"
                      value={videoDurationValue}
                      onChange={(event) => onVideoDurationChange?.(Number(event.target.value))}
                    >
                      {VIDEO_DURATION_OPTIONS.map((seconds) => (
                        <option value={seconds} key={`duration-${seconds}`}>
                          {seconds} seconds
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="control-row compact fixed-select">
                  <label className="input-label">Resolution</label>
                  <select
                    className="model-select"
                    value={videoResolutionValue}
                    onChange={(event) => onVideoResolutionChange?.(event.target.value)}
                  >
                    {VIDEO_RESOLUTION_OPTIONS.map((option) => (
                      <option value={option.value} key={`resolution-${option.value}`}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {!isMotionMode ? (
                  <div className="video-settings-toggle-row">
                    <div className="video-settings-toggle-copy">
                      <span className="input-label">Generate audio</span>
                      <span className="tiny helper-text">Include ambient audio in the output.</span>
                    </div>
                    <button
                      type="button"
                      className={`reference-toggle ${videoGenerateAudioValue ? "is-active" : ""}`}
                      aria-pressed={videoGenerateAudioValue}
                      aria-label={videoGenerateAudioValue ? "Disable audio generation" : "Enable audio generation"}
                      onClick={() => onVideoGenerateAudioChange?.(!videoGenerateAudioValue)}
                    >
                      <span className="reference-toggle-track" aria-hidden="true">
                        <span className="reference-toggle-dot" />
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <div
          className={`step-card reference-generate-step ${collapsedSteps.generate ? "is-collapsed" : ""}`}
          onClick={() => expandIfCollapsed("generate")}
          style={{ order: generateOrder }}
        >
          {beginnerMode ? (
            <div className="step-card-header">
              <span className="step-badge">{isVideoVariant ? "5" : "4"}</span>
              <div className="step-header-copy">
                <p className="step-title">Generate</p>
                <span className="step-subtitle tiny helper-text">Run generation with the current prompt and selections.</span>
              </div>
            </div>
          ) : null}
          {!collapsedSteps.generate ? (
            <div className="create-controls single-control">
              <AgentGenerateButton
                onClick={onRegenerate}
                disabled={isGenerateDisabled}
                isBusy={agentIsSending}
                cost={costCredits != null ? costCredits : "—"}
              />
              {/* Guardrail warning intentionally hidden; disabled button communicates state. */}
            </div>
          ) : null}
        </div>
      </div>
      <input
        ref={primaryInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection(onPrimaryImageChange)}
      />
      <input
        ref={extraOneInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection((url) => onExtraImageChange(0, url))}
      />
      <input
        ref={extraTwoInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection((url) => onExtraImageChange(1, url))}
      />
      <input
        ref={motionImageInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection((url) => onMotionCharacterChange?.(url))}
      />
      <input
        ref={motionVideoInputRef}
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        onChange={handleVideoFileSelection(onMotionReferenceVideoChange)}
      />
    </div>
  );
}
