/**
 * Regenerate/Image-to-video properties panel.
 * Provides reference dropzones, aspect/model selection, and prompt capture for regen flows.
 */
import React, { useRef, useState } from "react";
import { CloudArrowUp, FloppyDisk, Plus, UploadSimple } from "phosphor-react";
import { AspectDropdown } from "./AspectDropdown";
import { AspectOption } from "../types";
import { extractDragDropPayload, isImageDragTransfer } from "../utils/dragDrop";
import { modelLogos } from "../constants";
import { PromptStep } from "./PromptStep";
import type { AgentActions, AgentMessage } from "../../ai-agent/types";
import { CaretDown } from "phosphor-react";
import { AgentGenerateButton } from "../../ai-agent/components/AgentGenerateButton";

type RecreatePropertiesPanelProps = {
  title: string;
  subtitle: string;
  aspect: string;
  modelId: string | null;
  modelLabel: string;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  referenceText: string | null;
  aspectOptions: AspectOption[];
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (anchorId: string, target: HTMLElement) => void;
  onPrimaryImageChange: (url: string | null) => void;
  onExtraImageChange: (index: number, url: string | null) => void;
  onPromptTextChange: (value: string) => void;
  onSave: () => void;
  onRegenerate: () => void;
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

/**
 * Renders reference/image-to-video tool controls.
 */
export function RecreatePropertiesPanel({
  title,
  subtitle,
  aspect,
  modelId,
  modelLabel,
  referenceImageUrl,
  extraImageUrls,
  referenceText,
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
}: RecreatePropertiesPanelProps) {
  const primaryInputRef = useRef<HTMLInputElement | null>(null);
  const extraOneInputRef = useRef<HTMLInputElement | null>(null);
  const extraTwoInputRef = useRef<HTMLInputElement | null>(null);
  const extraThreeInputRef = useRef<HTMLInputElement | null>(null);
  const [primaryDragActive, setPrimaryDragActive] = useState(false);
  const [extraDragActive, setExtraDragActive] = useState([false, false, false]);
  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;

  const [collapsedSteps, setCollapsedSteps] = React.useState<{ reference: boolean; model: boolean; prompt: boolean; generate: boolean }>({
    reference: false,
    model: false,
    prompt: false,
    generate: false,
  });

  const toggleStep = (step: "reference" | "model" | "prompt" | "generate") => {
    setCollapsedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  const expandIfCollapsed = (step: "reference" | "model" | "prompt" | "generate") => {
    setCollapsedSteps((prev) => {
      if (!prev[step]) return prev;
      return { ...prev, [step]: false };
    });
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

  return (
    <div className="tool-properties">
      <div className="tool-header">
        <p className="eyebrow">{title}</p>
        <p className="subdued tiny helper-text">{subtitle}</p>
      </div>
      <div className="reference-drop-layout-inner">
        <div className="reference-dropzone-block image-block">
          <div
            className={`regenerate-step-card ${collapsedSteps.reference ? "is-collapsed" : ""}`}
            onClick={() => expandIfCollapsed("reference")}
          >
            <div className="regenerate-step-header">
              {beginnerMode && <span className="step-badge mini">1</span>}
              <div className="regenerate-step-copy">
                <p className="step-title">Add Reference Image</p>
                <span className="step-subtitle tiny helper-text">Drag a reference from the canvas or upload one manually.</span>
              </div>
            <div className="reference-drop-header-actions">
                <StepHeaderActionButton
                  label="Open reference options"
                  isCollapsed={collapsedSteps.reference}
                  onClick={() => toggleStep("reference")}
                />
              </div>
            </div>
            {!collapsedSteps.reference ? (
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
                {[extraOneInputRef, extraTwoInputRef, extraThreeInputRef].map((inputRef, index) => {
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
              </div>
            ) : null}
          </div>
        </div>
        <div
          className={`step-card recreate-frame-card ${collapsedSteps.model ? "is-collapsed" : ""}`}
          onClick={() => expandIfCollapsed("model")}
        >
          <div className="step-card-header">
            {beginnerMode && <span className="step-badge">2</span>}
            <div className="step-header-copy">
              <p className="step-title">Choose Frame & Model</p>
              <span className="step-subtitle tiny helper-text">Pick the target aspect ratio and AI model before you regenerate.</span>
            </div>
            <div className="step-header-actions">
              <StepHeaderActionButton
                label="Open model options"
                isCollapsed={collapsedSteps.model}
                onClick={() => toggleStep("model")}
              />
            </div>
          </div>
          {!collapsedSteps.model ? (
            <div className="create-controls dual-controls recreate-frame-controls">
              <div className="control-row compact">
                <label className="input-label">Aspect ratio</label>
                <AspectDropdown aspect={aspect} onSelect={onAspectChange} options={aspectOptions} />
              </div>
              <div className="control-row compact">
                <label className="input-label">Model</label>
                <button
                  type="button"
                  className={`model-picker-btn ${isModelModalOpen && modelModalAnchor === "recreate-model" ? "is-open" : ""}`}
                  data-model-anchor="recreate-model"
                  onClick={(event) => onModelPickerOpen("recreate-model", event.currentTarget)}
                >
                  <div className="model-picker-row">
                    <span className="model-picker-value">
                      {modelLogoSrc ? <img className="model-chip-logo-img" src={modelLogoSrc} alt="" aria-hidden /> : null}
                      {modelLabel}
                    </span>
                    <span className="model-chip-pill model-picker-pill">
                      <span aria-hidden="true" className="model-chip-icon">✦</span>
                      <span className="model-chip-credits">{costCredits != null ? costCredits : "—"}</span>
                    </span>
                  </div>
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="reference-dropzone-block prompt-block">
          <PromptStep
            stepNumber="3"
            title="Write Your Prompt"
            subtitle="Drop a saved prompt or describe the look you want to recreate."
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
            onGenerate={onRegenerate}
            onSavePrompt={onSave}
            isCollapsed={collapsedSteps.prompt}
            onToggleCollapse={() => toggleStep("prompt")}
            costCredits={costCredits}
            isGenerating={false} // Recreate doesn't have a specific prompt generating state in top-level prop, but could pass isGeneratorDisabled
            isGenerateDisabled={isGenerateDisabled}
            onDrop={handlePromptDrop as any}
            onDragOver={(e) => e.preventDefault()}
            className="regenerate-step-card"
            beginnerMode={beginnerMode}
          />
        </div>
        <div
          className={`step-card recreate-generate-step ${collapsedSteps.generate ? "is-collapsed" : ""}`}
          onClick={() => expandIfCollapsed("generate")}
        >
          <div className="step-card-header">
            {beginnerMode && <span className="step-badge">4</span>}
            <div className="step-header-copy">
              <p className="step-title">Generate</p>
              <span className="step-subtitle tiny helper-text">Run generation with the current prompt and selections.</span>
            </div>
            <div className="step-header-actions">
              <StepHeaderActionButton
                label="Open generate options"
                isCollapsed={collapsedSteps.generate}
                onClick={() => toggleStep("generate")}
              />
            </div>
          </div>
          {!collapsedSteps.generate ? (
            <div className="create-controls single-control">
              <AgentGenerateButton
                onClick={onRegenerate}
                disabled={isGenerateDisabled}
                isBusy={agentIsSending}
                cost={costCredits != null ? costCredits : "—"}
              />
              {isGenerateDisabled && guardrailReason && !agentIsSending ? (
                <div className="inline-error-hint step-card-error" role="status">
                  {guardrailReason}
                </div>
              ) : null}
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
        ref={extraThreeInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection((url) => onExtraImageChange(2, url))}
      />
    </div>
  );
}
