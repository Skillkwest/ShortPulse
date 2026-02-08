/**
 * Reference properties panel for AI Studio.
 * Provides reference dropzones, aspect/model selection, and prompt capture for image/video workflows.
 */
import React, { useEffect, useRef, useState } from "react";
import { ArrowFatLinesRight, Image, Plus, UploadSimple } from "phosphor-react";
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
  videoReferenceMode?: "standard" | "keyframes" | "kling3" | "motion";
  onVideoReferenceModeChange?: (value: "standard" | "keyframes" | "kling3" | "motion") => void;
  klingNegativePrompt?: string;
  klingCfgScale?: number;
  klingShotType?: "customize" | "intelligent";
  klingVoiceIds?: [string, string];
  klingMultiPrompts?: { id: string; prompt: string; duration: number }[];
  klingElements?: { id: string; frontalImageUrl: string; referenceImageUrls: string; videoUrl: string }[];
  onKlingNegativePromptChange?: (value: string) => void;
  onKlingCfgScaleChange?: (value: number) => void;
  onKlingShotTypeChange?: (value: "customize" | "intelligent") => void;
  onKlingVoiceIdChange?: (index: 0 | 1, value: string) => void;
  onKlingMultiPromptsChange?: (value: { id: string; prompt: string; duration: number }[]) => void;
  onKlingElementsChange?: (value: { id: string; frontalImageUrl: string; referenceImageUrls: string; videoUrl: string }[]) => void;
  motionVideoUrl?: string | null;
  onMotionVideoChange?: (url: string | null) => void;
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

const VEO_I2V_DURATION_OPTIONS = [4, 6, 8];
const VEO_I2V_RESOLUTION_OPTIONS = [
  { value: "720p", label: "720p (HD)" },
  { value: "1080p", label: "1080p (Full HD)" },
  { value: "4k", label: "4K (2160p)" },
];
const VEO_FIRST_LAST_DURATION_OPTIONS = [4, 6, 8];
const VEO_FIRST_LAST_RESOLUTION_OPTIONS = [
  { value: "720p", label: "720p (HD)" },
  { value: "1080p", label: "1080p (Full HD)" },
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
  const motionVideoInputRef = useRef<HTMLInputElement | null>(null);
  const makeId = () => `kling-${Math.random().toString(36).slice(2, 9)}`;

  const [primaryDragActive, setPrimaryDragActive] = useState(false);
  const [extraDragActive, setExtraDragActive] = useState([false, false]);
  const [motionVideoDragActive, setMotionVideoDragActive] = useState(false);
  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;

  const [collapsedSteps, setCollapsedSteps] = React.useState<{
    reference: boolean;
    model: boolean;
    prompt: boolean;
    motionSettings: boolean;
    videoSettings: boolean;
    klingAdvanced: boolean;
    klingAssets: boolean;
    klingGuidance: boolean;
    generate: boolean;
  }>({
    reference: false,
    model: false,
    prompt: false,
    motionSettings: false,
    videoSettings: false,
    klingAdvanced: false,
    klingAssets: false,
    klingGuidance: false,
    generate: false,
  });

  const toggleStep = (
    step:
      | "reference"
      | "model"
      | "prompt"
      | "motionSettings"
      | "videoSettings"
      | "klingAdvanced"
      | "klingAssets"
      | "klingGuidance"
      | "generate",
  ) => {
    setCollapsedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  const expandIfCollapsed = (
    step:
      | "reference"
      | "model"
      | "prompt"
      | "motionSettings"
      | "videoSettings"
      | "klingAdvanced"
      | "klingAssets"
      | "klingGuidance"
      | "generate",
  ) => {
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

  const updateKlingMultiPrompt = (id: string, key: "prompt" | "duration", value: string | number) => {
    const next = klingMultiPrompts.map((item) => (item.id === id ? { ...item, [key]: value } : item));
    onKlingMultiPromptsChange?.(next);
  };

  const addKlingShot = () => {
    onKlingMultiPromptsChange?.([
      ...klingMultiPrompts,
      { id: makeId(), prompt: "", duration: 5 },
    ]);
  };

  const removeKlingShot = (id: string) => {
    onKlingMultiPromptsChange?.(klingMultiPrompts.filter((item) => item.id !== id));
  };

  const updateKlingElement = (
    id: string,
    key: "frontalImageUrl" | "referenceImageUrls" | "videoUrl",
    value: string,
  ) => {
    const next = klingElements.map((item) => (item.id === id ? { ...item, [key]: value } : item));
    onKlingElementsChange?.(next);
  };

  const addKlingElement = () => {
    onKlingElementsChange?.([
      ...klingElements,
      { id: makeId(), frontalImageUrl: "", referenceImageUrls: "", videoUrl: "" },
    ]);
  };

  const removeKlingElement = (id: string) => {
    onKlingElementsChange?.(klingElements.filter((item) => item.id !== id));
  };

  const handleFileSelection =
    (setter: (url: string | null) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
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

  const handlePrimaryDrop = (event: React.DragEvent<HTMLDivElement>) => {
    setPrimaryDragActive(false);
    handleImageDrop(onPrimaryImageChange)(event);
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

  const allowVideoDrag = (event: React.DragEvent<HTMLDivElement>) => {
    if (isVideoDragTransfer(event.dataTransfer)) {
      event.preventDefault();
      return true;
    }
    return false;
  };

  const handleMotionVideoDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setMotionVideoDragActive(false);

    const payload = extractVideoDragDropPayload(event.dataTransfer);
    if (payload.videoUrl) {
      onMotionVideoChange?.(payload.videoUrl);
    } else if (event.dataTransfer.files?.length) {
      const videoFile = Array.from(event.dataTransfer.files).find(f =>
        f.type.startsWith("video/")
      );
      if (videoFile) {
        const url = URL.createObjectURL(videoFile);
        onMotionVideoChange?.(url);
      }
    }
  };

  const handleMotionVideoSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      onMotionVideoChange?.(url);
    }
    event.target.value = "";
  };

  const isVideoVariant = variant === "video";
  const activeVideoMode = videoReferenceMode ?? "standard";
  const isKling3Mode = isVideoVariant && activeVideoMode === "kling3";
  const isKeyframesMode = isVideoVariant && activeVideoMode === "keyframes";
  const isMotionMode = isVideoVariant && activeVideoMode === "motion";
  const isStandardMode = !isVideoVariant || activeVideoMode === "standard";
  const isVeoImageToVideoModel = modelId === "fal-ai/veo3.1/image-to-video";
  const isVeoImageToVideoStandard = isStandardMode && isVeoImageToVideoModel;
  const isVeoFirstLastModel = modelId === "fal-ai/veo3.1/first-last-frame-to-video";
  const referenceStepTitle = isVideoVariant
    ? isKling3Mode
      ? "Add Kling 3.0 References"
      : isKeyframesMode
        ? "Add Reference Frames"
        : isMotionMode
          ? "Add Motion References"
          : "Add Reference Image"
    : "Add Reference Images";
  const referenceStepSubtitle = isVideoVariant
    ? isKling3Mode
      ? "Upload start/end frames plus Kling controls."
      : isKeyframesMode
        ? "Upload or drag and drop images from the reference grid."
        : isMotionMode
          ? "Upload a character image and motion reference video."
          : "Upload or drag and drop a single image for standard image-to-video."
    : "Upload or drag and drop images from the reference grid.";
  const promptOrder = isVideoVariant ? 4 : 2;
  const modelOrder = isVideoVariant ? 2 : 3;
  const referenceOrder = isVideoVariant ? 1 : 1;
  const videoSettingsOrder = isVideoVariant ? 3 : 0;
  const klingAdvancedOrder = isKling3Mode ? 4 : undefined;
  const generateOrder = isVideoVariant ? (isKling3Mode ? 6 : 5) : 4;
  const generateBadge = isVideoVariant ? (isKling3Mode ? "6" : "5") : "4";
  const klingShotSummary =
    klingMultiPrompts?.length ? `${klingMultiPrompts.length} shot${klingMultiPrompts.length > 1 ? "s" : ""}` : "No shots";
  const klingAssetsSummary = (() => {
    const elementCount = klingElements?.length ?? 0;
    const voices = klingVoiceIds?.filter((v) => v.trim()).length ?? 0;
    const parts = [];
    parts.push(elementCount ? `${elementCount} element${elementCount > 1 ? "s" : ""}` : "No elements");
    parts.push(voices ? `${voices} voice${voices > 1 ? "s" : ""}` : "No voices");
    return parts.join(" · ");
  })();
  const klingGuidanceSummary = `CFG ${klingCfgScale.toFixed(2)} · ${klingNegativePrompt ? "Neg prompt set" : "Neg prompt empty"}`;
  const videoDurationValue = videoDurationSeconds ?? 6;
  const videoResolutionValue = videoResolution ?? "1080p";
  const videoGenerateAudioValue = Boolean(videoGenerateAudio);
  const durationOptions = isVeoImageToVideoStandard
    ? VEO_I2V_DURATION_OPTIONS
    : isVeoFirstLastModel
      ? VEO_FIRST_LAST_DURATION_OPTIONS
      : VIDEO_DURATION_OPTIONS;
  const resolutionOptions = isVeoImageToVideoStandard
    ? VEO_I2V_RESOLUTION_OPTIONS
    : isVeoFirstLastModel
      ? VEO_FIRST_LAST_RESOLUTION_OPTIONS
      : VIDEO_RESOLUTION_OPTIONS;
  const aspectOptionsForModel = isVeoImageToVideoStandard
    ? [{ value: "auto", ratioLabel: "Auto", name: "Auto (from input)", orientation: "widescreen" } as AspectOption]
    : aspectOptions;

  useEffect(() => {
    if (isVeoImageToVideoStandard && aspect !== "auto") {
      onAspectChange("auto");
    }
  }, [isVeoImageToVideoStandard, aspect, onAspectChange]);

  useEffect(() => {
    if ((isVeoImageToVideoStandard || isVeoFirstLastModel) && !durationOptions.includes(videoDurationValue)) {
      onVideoDurationChange?.(durationOptions[1] ?? durationOptions[0]);
    }
  }, [isVeoImageToVideoStandard, isVeoFirstLastModel, durationOptions, videoDurationValue, onVideoDurationChange]);

  useEffect(() => {
    if ((isVeoImageToVideoStandard || isVeoFirstLastModel) && !resolutionOptions.some((option) => option.value === videoResolutionValue)) {
      onVideoResolutionChange?.(resolutionOptions[0]?.value ?? "auto");
    }
  }, [isVeoImageToVideoStandard, isVeoFirstLastModel, resolutionOptions, videoResolutionValue, onVideoResolutionChange]);

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
        {!isKeyframesMode && !isMotionMode ? (
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
                <div className="create-controls reference-frame-controls frame-model-controls">
                  {!isVideoVariant ? (
                    <div className="control-row compact">
                      <label className="input-label">Aspect ratio</label>
                      <AspectDropdown aspect={aspect} onSelect={onAspectChange} options={aspectOptionsForModel} />
                    </div>
                  ) : null}
                  <div className={`control-row compact ${isVideoVariant ? "full-span" : ""}`}>
                    <label className="input-label">Model</label>
                    <button
                      type="button"
                      className={`model-picker-btn ${!modelId ? "is-empty" : ""} ${isModelModalOpen && modelModalAnchor === "reference-model" ? "is-open" : ""}`}
                      data-model-anchor="reference-model"
                      onClick={(event) =>
                        onModelPickerOpen(
                          "reference-model",
                          event.currentTarget,
                          variant === "image"
                            ? "reference-image"
                            : isKeyframesMode
                              ? "reference-keyframes"
                              : "reference-video",
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
                      First/Last Frame
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
                    {/* Character Image Dropzone */}
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
                        <span className="dropzone-tag">Character image</span>
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
                        ) : (
                          <div className="reference-drop-content image-drop-content">
                            <UploadSimple size={22} weight="regular" />
                            <p className="reference-drop-title helper-text">Click to upload character</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Motion Video Dropzone */}
                    <div className="primary-drop">
                      <div
                        className={`reference-dropzone video-dropzone ${motionVideoUrl ? "has-preview" : ""} ${motionVideoDragActive ? "is-dragging" : ""}`}
                        onDrop={handleMotionVideoDrop}
                        onDragEnter={(e) => {
                          if (allowVideoDrag(e)) {
                            setMotionVideoDragActive(true);
                          }
                        }}
                        onDragOver={(e) => {
                          if (allowVideoDrag(e)) {
                            setMotionVideoDragActive(true);
                          }
                        }}
                        onDragLeave={() => setMotionVideoDragActive(false)}
                        onClick={() => motionVideoInputRef.current?.click()}
                      >
                        <span className="dropzone-tag">Motion video</span>
                        {motionVideoUrl ? (
                          <>
                            <video
                              className="reference-dropzone-video"
                              src={motionVideoUrl}
                              autoPlay
                              muted
                              loop
                              playsInline
                            />
                            <button
                              type="button"
                              className="dropzone-clear"
                              onClick={(event) => {
                                event.stopPropagation();
                                onMotionVideoChange?.(null);
                              }}
                            >
                              ×
                            </button>
                          </>
                        ) : (
                          <div className="reference-drop-content video-drop-content">
                            <UploadSimple size={22} weight="regular" />
                            <p className="reference-drop-title helper-text">Click to upload motion reference</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : isKling3Mode ? (
                  <div className="drop-image-row kling-drop-row">
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
                        <span className="dropzone-tag">Start frame</span>
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
                          <p className="reference-drop-title helper-text">Upload a starting frame</p>
                        </div>
                      </div>
                    </div>
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
                        <span className="dropzone-tag subtle">End frame (optional)</span>
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
                        ) : null}
                        <div className="reference-drop-content image-drop-content">
                          <UploadSimple size={22} weight="regular" />
                          <p className="reference-drop-title helper-text">Upload an end frame</p>
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
                            <span className="dropzone-tag">
                              Last frame
                            </span>
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
                          <Image size={22} weight="bold" />
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
        {isVideoVariant && !isMotionMode ? (
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
                <div className="control-row compact fixed-select">
                  <label className="input-label">Duration</label>
                  <select
                    className="model-select"
                    value={videoDurationValue}
                    onChange={(event) => onVideoDurationChange?.(Number(event.target.value))}
                  >
                    {durationOptions.map((seconds) => (
                      <option value={seconds} key={`duration-${seconds}`}>
                        {seconds} seconds
                      </option>
                    ))}
                  </select>
                </div>
                <div className="control-row compact fixed-select">
                  <label className="input-label">Resolution</label>
                  <select
                    className="model-select"
                    value={videoResolutionValue}
                    onChange={(event) => onVideoResolutionChange?.(event.target.value)}
                  >
                    {resolutionOptions.map((option) => (
                      <option value={option.value} key={`resolution-${option.value}`}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="video-settings-toggle-row">
                  <div className="video-settings-toggle-copy">
                    <span className="input-label">Generate audio</span>
                    <span className="tiny helper-text">
                      {isVeoImageToVideoStandard
                        ? "Use Veo's optional audio track when enabled."
                        : isVeoFirstLastModel
                          ? "Use Veo's optional audio track when enabled for first/last frame."
                        : "Include ambient audio in the output."}
                    </span>
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
              </div>
            ) : null}
          </div>
        ) : null}
        {isKling3Mode ? (
          <>
            <div
              className={`step-card kling-advanced-card ${collapsedSteps.klingAdvanced ? "is-collapsed" : ""}`}
              onClick={() => expandIfCollapsed("klingAdvanced")}
              style={{ order: klingAdvancedOrder }}
            >
              <div className="step-card-header">
                {beginnerMode && <span className="step-badge">5</span>}
                <div className="step-header-copy">
                  <p className="step-title">Shots & Timing</p>
                  <span className="step-subtitle tiny helper-text">{klingShotSummary}</span>
                </div>
                {!beginnerMode ? (
                  <div className="step-header-actions">
                    <StepHeaderActionButton
                      label="Toggle Kling 3.0 shots"
                      isCollapsed={collapsedSteps.klingAdvanced}
                      onClick={() => toggleStep("klingAdvanced")}
                    />
                  </div>
                ) : null}
              </div>
              {!collapsedSteps.klingAdvanced ? (
                <div className="create-controls kling-advanced-grid">
                  <div className="kling-pill-row">
                    <span className="kling-pill">Launch limit: 3 concurrent</span>
                    <span className="kling-pill">Cost: $0.224s (no audio) · $0.336s (audio) · $0.392s (voice)</span>
                  </div>
                  <div className="control-row compact">
                    <label className="input-label">Shot type</label>
                    <select
                      className="model-select"
                      value={klingShotType}
                      onChange={(event) => onKlingShotTypeChange?.(event.target.value as "customize" | "intelligent")}
                    >
                      <option value="customize">Customize (per-shot prompts)</option>
                      <option value="intelligent">Intelligent (auto pacing)</option>
                    </select>
                    <span className="tiny helper-text">Use multi-shot for micro-beats; intelligent for automatic pacing.</span>
                  </div>
                  <div className="control-row compact full-span">
                    <label className="input-label">Multi-shot prompts</label>
                    <div className="kling-multi-shot-list">
                      {klingMultiPrompts.length === 0 ? (
                        <p className="tiny helper-text">Add shots to split the video into multiple beats.</p>
                      ) : null}
                      {klingMultiPrompts.map((shot, index) => (
                        <div className="kling-shot-row" key={shot.id}>
                          <div className="shot-meta">
                            <span className="shot-index">Shot {index + 1}</span>
                            <button type="button" className="ghost-btn mini" onClick={() => removeKlingShot(shot.id)}>
                              Remove
                            </button>
                          </div>
                          <textarea
                            className="model-select kling-textarea"
                            value={shot.prompt}
                            rows={2}
                            onChange={(event) => updateKlingMultiPrompt(shot.id, "prompt", event.target.value)}
                            placeholder="Describe this shot..."
                          />
                          <div className="kling-shot-controls">
                            <label className="tiny helper-text">Duration</label>
                            <select
                              className="model-select"
                              value={shot.duration}
                              onChange={(event) => updateKlingMultiPrompt(shot.id, "duration", Number(event.target.value))}
                            >
                              {VIDEO_DURATION_OPTIONS.map((seconds) => (
                                <option value={seconds} key={`shot-duration-${seconds}`}>
                                  {seconds}s
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                      <button type="button" className="ghost-btn small" onClick={addKlingShot}>
                        + Add shot
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div
              className={`step-card kling-advanced-card ${collapsedSteps.klingAssets ? "is-collapsed" : ""}`}
              onClick={() => expandIfCollapsed("klingAssets")}
              style={{ order: (klingAdvancedOrder ?? 4) + 0.1 }}
            >
              <div className="step-card-header">
                {beginnerMode && <span className="step-badge">5b</span>}
                <div className="step-header-copy">
                  <p className="step-title">Assets & Voices</p>
                  <span className="step-subtitle tiny helper-text">{klingAssetsSummary}</span>
                </div>
                {!beginnerMode ? (
                  <div className="step-header-actions">
                    <StepHeaderActionButton
                      label="Toggle Kling 3.0 assets"
                      isCollapsed={collapsedSteps.klingAssets}
                      onClick={() => toggleStep("klingAssets")}
                    />
                  </div>
                ) : null}
              </div>
              {!collapsedSteps.klingAssets ? (
                <div className="create-controls kling-advanced-grid">
                  <div className="control-row compact full-span">
                    <label className="input-label">Elements (characters/objects)</label>
                    <div className="kling-elements-list">
                      {klingElements.map((element) => (
                        <div className="kling-element-row" key={element.id}>
                          <div className="kling-element-grid">
                            <input
                              className="model-select"
                              placeholder="Frontal image URL"
                              value={element.frontalImageUrl}
                              onChange={(event) => updateKlingElement(element.id, "frontalImageUrl", event.target.value)}
                            />
                            <input
                              className="model-select"
                              placeholder="Reference images (comma or newline separated)"
                              value={element.referenceImageUrls}
                              onChange={(event) => updateKlingElement(element.id, "referenceImageUrls", event.target.value)}
                            />
                            <input
                              className="model-select"
                              placeholder="Reference video URL (optional)"
                              value={element.videoUrl}
                              onChange={(event) => updateKlingElement(element.id, "videoUrl", event.target.value)}
                            />
                          </div>
                          <div className="kling-element-actions">
                            <span className="tiny helper-text">Reference as @Element{element.id.slice(-2)}</span>
                            <button type="button" className="ghost-btn mini" onClick={() => removeKlingElement(element.id)}>
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                      <button type="button" className="ghost-btn small" onClick={addKlingElement}>
                        + Add element
                      </button>
                    </div>
                  </div>
                  <div className="control-row compact full-span kling-voice-row">
                    <label className="input-label">Voice IDs (optional)</label>
                    <div className="kling-voice-inputs">
                      {[0, 1].map((idx) => (
                        <input
                          key={`voice-${idx}`}
                          className="model-select"
                          placeholder={`voice_${idx + 1} ID (from create-voice)`}
                          value={klingVoiceIds[idx]}
                          onChange={(event) => onKlingVoiceIdChange?.(idx as 0 | 1, event.target.value)}
                        />
                      ))}
                    </div>
                    <span className="tiny helper-text">Reference in prompt as &lt;&lt;&lt;voice_{1}&gt;&gt;&gt; and &lt;&lt;&lt;voice_{2}&gt;&gt;&gt; (max 2).</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div
              className={`step-card kling-advanced-card ${collapsedSteps.klingGuidance ? "is-collapsed" : ""}`}
              onClick={() => expandIfCollapsed("klingGuidance")}
              style={{ order: (klingAdvancedOrder ?? 4) + 0.2 }}
            >
              <div className="step-card-header">
                {beginnerMode && <span className="step-badge">5c</span>}
                <div className="step-header-copy">
                  <p className="step-title">Guidance & Safety</p>
                  <span className="step-subtitle tiny helper-text">{klingGuidanceSummary}</span>
                </div>
                {!beginnerMode ? (
                  <div className="step-header-actions">
                    <StepHeaderActionButton
                      label="Toggle Kling guidance"
                      isCollapsed={collapsedSteps.klingGuidance}
                      onClick={() => toggleStep("klingGuidance")}
                    />
                  </div>
                ) : null}
              </div>
              {!collapsedSteps.klingGuidance ? (
                <div className="create-controls kling-advanced-grid">
                  <div className="control-row compact">
                    <label className="input-label">CFG scale</label>
                    <div className="kling-slider-row">
                      <input
                        type="range"
                        min={0}
                        max={1.5}
                        step={0.05}
                        value={klingCfgScale}
                        onChange={(event) => onKlingCfgScaleChange?.(Number(event.target.value))}
                      />
                      <span className="slider-value">{klingCfgScale.toFixed(2)}</span>
                    </div>
                    <span className="tiny helper-text">Lower = freer motion/visuals, higher = tighter adherence.</span>
                  </div>
                  <div className="control-row compact full-span">
                    <label className="input-label">Negative prompt</label>
                    <textarea
                      className="model-select kling-textarea"
                      value={klingNegativePrompt}
                      rows={2}
                      onChange={(event) => onKlingNegativePromptChange?.(event.target.value)}
                      placeholder="blur, distort, and low quality"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
        <div
          className={`step-card reference-generate-step ${collapsedSteps.generate ? "is-collapsed" : ""}`}
          onClick={() => expandIfCollapsed("generate")}
          style={{ order: generateOrder }}
        >
          {beginnerMode ? (
            <div className="step-card-header">
              <span className="step-badge">{generateBadge}</span>
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
        ref={motionVideoInputRef}
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        onChange={handleMotionVideoSelection}
      />
    </div>
  );
}
