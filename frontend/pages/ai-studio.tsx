/**
 * AI Studio workspace page.
 * Orchestrates toolbar, properties panels, reference grid, and preview surfaces using the feature module.
 */
import Head from "next/head";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloudArrowUp, UploadSimple } from "phosphor-react";
import { AiStudioToolbar } from "../features/ai-studio/components/AiStudioToolbar";
import { CreatePropertiesPanel } from "../features/ai-studio/components/CreatePropertiesPanel";
import { DetailModal } from "../features/ai-studio/components/DetailModal";
import { ModelModal } from "../features/ai-studio/components/ModelModal";
import { ReferenceCanvas } from "../features/ai-studio/components/ReferenceCanvas";
import { RecreatePropertiesPanel } from "../features/ai-studio/components/RecreatePropertiesPanel";
import { StudioPreview } from "../features/ai-studio/components/StudioPreview";
import { aspectOptions, modelOptions } from "../features/ai-studio/constants";
import { useAiStudioState } from "../features/ai-studio/hooks/useAiStudioState";
import { ToolId } from "../features/ai-studio/types";
import { useCredits } from "../features/ai-studio/hooks/useCredits";
import {
  buildDefaultPricingParams,
  computeCostForModel,
  getModelConfig,
} from "../features/ai-studio/logic/pricing";
import type { PricingParams } from "../features/ai-studio/logic/pricingTypes";
import { estimatePromptTokens, estimateDescribeTokens } from "../features/ai-studio/logic/tokenEstimates";
import { TEXT_PROMPT_MODEL_ID } from "../features/ai-studio/logic/promptGeneration";

export default function AiStudioPage() {
  const { balanceCents, balanceLoading, debit } = useCredits();
  const balanceCredits = useMemo(() => {
    if (balanceCents == null) return null;
    return Math.max(0, Math.floor(balanceCents)); // cents == credits
  }, [balanceCents]);

  const {
    promptRef,
    mode,
    setMode,
    aspect,
    setAspect,
    model,
    setModel,
    currentModelLabel,
    prompt,
    setPrompt,
    outputs,
    activeOutput,
    activeOutputId,
    setActiveOutputId,
    saved,
    selectedTool,
    setSelectedTool,
    showEditTools,
    setShowEditTools,
    referenceImageUrl,
    setReferenceImageUrl,
    extraImageUrls,
    setExtraImageUrl,
    referenceText,
    setReferenceText,
    useReferenceImageIndicator,
    detailOutput,
    setDetailOutputId,
    isModelModalOpen,
    modelModalAnchor,
    modelModalPosition,
    isPromptGenerating,
    generateOutput,
    regenerateOutput,
    saveActiveOutput,
    savePromptReference,
    addOutputsFromFiles,
    toggleReferenceIndicator,
    clearReferenceImages,
    openModelModal,
    closeModelModal,
    resolvePreviewUrlById,
    updateOutputPrompt,
    uiError,
    setUiError,
    getDefaultDurationSeconds,
  } = useAiStudioState({ onDebitCredits: debit });

  const referenceCanvasFileInputRef = useRef<HTMLInputElement | null>(null);
  const [dismissedFailureIds, setDismissedFailureIds] = useState<Set<string>>(new Set());

  const handleOpenModelModal = (anchorId: string, target: HTMLElement) => {
    openModelModal(anchorId, target);
  };

  const handleSelectModelFromModal = (value: string) => {
    setModel(value);
    closeModelModal();
  };

  const handleToolSelect = (tool: ToolId | null) => {
    setSelectedTool(tool);
    if (!tool) {
      setShowEditTools(false);
    }
  };

  const handleFileBrowserSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      addOutputsFromFiles(files);
    }
    event.target.value = "";
  };

  const handleReferenceCanvasFiles = (files: FileList) => addOutputsFromFiles(files);
  const triggerFilePicker = () => referenceCanvasFileInputRef.current?.click();
  const dismissError = () => setUiError(null);

  const failedOutputs = useMemo(
    () => outputs.filter((item) => item.taskState === "fail" && item.errorMessage),
    [outputs],
  );

  const visibleFailures = useMemo(
    () => failedOutputs.filter((item) => !dismissedFailureIds.has(item.id)),
    [dismissedFailureIds, failedOutputs],
  );

  useEffect(() => {
    setDismissedFailureIds((prev) => {
      if (!prev.size) return prev;
      const activeIds = new Set(failedOutputs.map((item) => item.id));
      const filtered = Array.from(prev).filter((id) => activeIds.has(id));
      if (filtered.length === prev.size) return prev;
      return new Set(filtered);
    });
  }, [failedOutputs]);

  const dismissFailure = (id: string) => {
    setDismissedFailureIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const focusFailure = (id: string) => {
    setActiveOutputId(id);
    setDetailOutputId(id);
  };

  const renderProperties = () => {
    switch (selectedTool) {
      case "create":
        return (
          <CreatePropertiesPanel
            mode={mode}
            aspect={aspect}
            modelId={model}
            modelLabel={currentModelLabel}
            prompt={prompt}
            promptRef={promptRef}
            useReferenceImageIndicator={useReferenceImageIndicator}
            hasReferencePreview={Boolean(activeOutput?.previewUrl)}
            isModelModalOpen={isModelModalOpen}
            modelModalAnchor={modelModalAnchor}
            onModeChange={setMode}
            onAspectChange={setAspect}
            onModelPickerOpen={handleOpenModelModal}
            onPromptChange={setPrompt}
            onGenerate={handleGenerate}
            onSavePrompt={savePromptReference}
            onToggleReferenceIndicator={toggleReferenceIndicator}
            isPromptGenerating={isPromptGenerating}
            costCredits={currentCostCredits}
            isGenerateDisabled={isGenerateDisabled}
            guardrailReason={generationGuardrail}
          />
        );
      case "image-to-image":
        return (
          <RecreatePropertiesPanel
            title="Image to Image"
            subtitle="Recreate images using references."
            aspect={aspect}
            modelId={model}
            modelLabel={currentModelLabel}
            referenceImageUrl={referenceImageUrl}
            extraImageUrls={extraImageUrls}
            referenceText={referenceText}
            aspectOptions={aspectOptions}
            isModelModalOpen={isModelModalOpen}
            modelModalAnchor={modelModalAnchor}
            onAspectChange={setAspect}
            onModelPickerOpen={handleOpenModelModal}
            onPrimaryImageChange={setReferenceImageUrl}
            onExtraImageChange={setExtraImageUrl}
            onClearImages={clearReferenceImages}
            onPromptTextChange={setReferenceText}
            onSave={saveActiveOutput}
            onRegenerate={regenerateOutput}
            costCredits={currentCostCredits}
            guardrailReason={generationGuardrail}
            resolvePreviewUrlById={resolvePreviewUrlById}
          />
        );
      case "image-to-video":
        return (
          <RecreatePropertiesPanel
            title="Image to Video"
            subtitle="Animate still images using references and prompts."
            aspect={aspect}
            modelId={model}
            modelLabel={currentModelLabel}
            referenceImageUrl={referenceImageUrl}
            extraImageUrls={extraImageUrls}
            referenceText={referenceText}
            aspectOptions={aspectOptions}
            isModelModalOpen={isModelModalOpen}
            modelModalAnchor={modelModalAnchor}
            onAspectChange={setAspect}
            onModelPickerOpen={handleOpenModelModal}
            onPrimaryImageChange={setReferenceImageUrl}
            onExtraImageChange={setExtraImageUrl}
            onClearImages={clearReferenceImages}
            onPromptTextChange={setReferenceText}
            onSave={saveActiveOutput}
            onRegenerate={handleRegenerateWithDebit}
            costCredits={currentCostCredits}
            isGenerateDisabled={isGenerateDisabled}
            guardrailReason={generationGuardrail}
            resolvePreviewUrlById={resolvePreviewUrlById}
          />
        );
      default:
        return null;
    }
  };

  const isTemplateView =
    selectedTool === "templates" || selectedTool === "workflows" || selectedTool === "my-generations" || selectedTool === "community";

  const defaultPricingParams = useMemo(
    () => (model ? buildDefaultPricingParams(model) : {}),
    [model],
  );

  const costParamsForModel = useCallback(
    (overrides: Omit<PricingParams, "modelId"> = {}) => ({
      ...defaultPricingParams,
      aspect,
      ...overrides,
    }),
    [aspect, defaultPricingParams],
  );

  const modelMediaFilter = useMemo(() => {
    if (selectedTool === "create") {
      if (mode === "image") return "image";
      if (mode === "video") return "video";
    }
    if (selectedTool === "image-to-video") return "video";
    if (selectedTool === "image-to-image") return "image";
    return null;
  }, [mode, selectedTool]);

  const filteredModelOptions = useMemo(() => {
    if (!modelMediaFilter) return modelOptions;
    return modelOptions.filter((opt) => !opt.mediaType || opt.mediaType === modelMediaFilter || opt.mediaType === "multi");
  }, [modelMediaFilter]);

  const isDescribeMode = selectedTool === "create" && mode === "enhance" && useReferenceImageIndicator;
  const requiresModelSelection =
    (selectedTool === "create" && mode !== "enhance") || selectedTool === "image-to-video";
  const isModelSelected = Boolean(model);
  const hasDescribeImage = Boolean(referenceImageUrl || activeOutput?.previewUrl);

  const estimatedTextTokens = useMemo(() => estimatePromptTokens(prompt), [prompt]);
  const estimatedDescribeTokens = useMemo(() => (prompt ? estimatePromptTokens(prompt) : estimateDescribeTokens()), [prompt]);

  const currentCost = useMemo(() => {
    if (selectedTool === "create") {
      if (mode === "image") {
        if (!model) return null;
        return computeCostForModel(model, costParamsForModel());
      }
      if (mode === "video") {
        if (!model) return null;
        return computeCostForModel(model, costParamsForModel({ durationSeconds: getDefaultDurationSeconds(model) }));
      }
      if (mode === "enhance") {
        if (isDescribeMode) {
          return computeCostForModel(TEXT_PROMPT_MODEL_ID, estimatedDescribeTokens);
        }
        return computeCostForModel(TEXT_PROMPT_MODEL_ID, estimatedTextTokens);
      }
      return null;
    }

    if (selectedTool === "image-to-image") {
      if (!model) return null;
      return computeCostForModel(model, costParamsForModel());
    }

    if (selectedTool === "image-to-video") {
      if (!model) return null;
      return computeCostForModel(model, costParamsForModel({ durationSeconds: getDefaultDurationSeconds(model) }));
    }

    return null;
  }, [
    estimatedDescribeTokens,
    estimatedTextTokens,
    isDescribeMode,
    costParamsForModel,
    getDefaultDurationSeconds,
    mode,
    model,
    selectedTool,
  ]);

  const currentCostCredits = currentCost?.credits ?? null;
  const costedFlow =
    (selectedTool === "create" && (mode === "image" || mode === "video")) || selectedTool === "image-to-video";
  const hasSufficientCreditsForCost =
    !costedFlow || balanceCredits == null || currentCostCredits == null
      ? true
      : balanceCredits >= currentCostCredits;
  const requiresVideoReference =
    selectedTool === "image-to-video" &&
    model === "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
  const hasVideoReference = [referenceImageUrl, ...extraImageUrls].some((url) => Boolean(url));

  const generationGuardrail = useMemo(() => {
    if (requiresModelSelection && !isModelSelected) return "Select a model before running a generation.";
    if (isDescribeMode && !hasDescribeImage) return "Add or select an image to describe.";
    if (costedFlow && !hasSufficientCreditsForCost) return "You do not have enough credits for this run.";
    if (requiresVideoReference && !hasVideoReference) return "Image-to-video requires at least one reference image.";
    return null;
  }, [
    costedFlow,
    hasDescribeImage,
    hasSufficientCreditsForCost,
    isDescribeMode,
    isModelSelected,
    requiresModelSelection,
    requiresVideoReference,
    hasVideoReference,
  ]);

  const isGenerateDisabled = Boolean(generationGuardrail);

  const modelConfig = useMemo(() => (model ? getModelConfig(model) : null), [model]);

  const handleBlockedGeneration = () => {
    if (generationGuardrail) {
      setUiError(generationGuardrail);
    }
  };

  const handleGenerate = () => {
    if (isGenerateDisabled) {
      handleBlockedGeneration();
      return;
    }
    if (
      selectedTool === "create" &&
      (mode === "image" || mode === "video") &&
      currentCostCredits &&
      model &&
      hasSufficientCreditsForCost
    ) {
      const memo = `${modelConfig?.label ?? model} generation`;
      debit(currentCostCredits, memo, `out-${Date.now()}`).catch(() => {});
    }
    generateOutput();
  };

  const handleRegenerateWithDebit = () => {
    if (isGenerateDisabled) {
      handleBlockedGeneration();
      return;
    }
    if (selectedTool === "image-to-video" && currentCostCredits && model && hasSufficientCreditsForCost) {
      const memo = `${modelConfig?.label ?? model} generation`;
      debit(currentCostCredits, memo, `out-${Date.now()}`).catch(() => {});
    }
    regenerateOutput();
  };

  return (
    <>
      <Head>
        <title>ShortPulse · AI Studio</title>
        <meta name="description" content="AI Studio — prompt, generate, preview, save." />
      </Head>
      <main className="page page-wide ai-studio-page">
        <input
          ref={referenceCanvasFileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleFileBrowserSelection}
        />

        {uiError ? (
          <div className="ai-error-banner" role="alert">
            <div className="ai-error-text">
              <strong>Error:</strong> {uiError}
            </div>
            <button type="button" className="ghost-btn mini" onClick={dismissError} aria-label="Dismiss error">
              Dismiss
            </button>
          </div>
        ) : null}

        <section className="ai-hero panel hero-banner ai-amber-hero">
          <div className="hero-text">
            <p className="eyebrow">AI Studio</p>
            <p className="tiny subdued">Prompt, generate, preview, and save from a single space.</p>
          </div>
          <div className="hero-right">
            <div className="ai-credit-inline header-embedded">
              <span className="credit-label">Credits</span>
              <span className="credit-value">
                {balanceLoading ? "…" : balanceCredits != null ? balanceCredits.toLocaleString() : "—"}
              </span>
            </div>
          </div>
        </section>

        {visibleFailures.length ? (
          <div className="ai-error-stack" role="alert" aria-live="polite">
            <div className="ai-error-stack-header">
              <div>
                <p className="eyebrow">Generation issues</p>
                <p className="tiny subdued">We could not finish these runs. Inspect, adjust the model, then try again.</p>
              </div>
              <span className="error-count-pill">{visibleFailures.length}</span>
            </div>
            <div className="ai-error-card-grid">
              {visibleFailures.map((item) => {
                const modelLabel = item.model || item.modelId || "Generation";
                const promptPreview = item.prompt.length > 140 ? `${item.prompt.slice(0, 140)}…` : item.prompt;
                const isNanoBanana =
                  (item.modelId ?? "").toLowerCase().includes("nano-banana") ||
                  (item.model ?? "").toLowerCase().includes("nano banana");
                return (
                  <div key={item.id} className="ai-error-card">
                    <div className="ai-error-card-body">
                      <p className="ai-error-card-title">{modelLabel} failed</p>
                      <p className="ai-error-card-message">{item.errorMessage}</p>
                      <p className="ai-error-card-meta">
                        Prompt: <span className="ai-error-card-prompt">{promptPreview}</span>
                      </p>
                      {isNanoBanana ? (
                        <p className="ai-error-card-hint">
                          Nano Banana is unstable right now. Try FLUX.2 Pro or Seedream 4.5 instead.
                        </p>
                      ) : null}
                    </div>
                    <div className="ai-error-card-actions">
                      <button type="button" className="ghost-btn mini" onClick={() => focusFailure(item.id)}>
                        Inspect
                      </button>
                      <button type="button" className="ghost-btn mini" onClick={() => dismissFailure(item.id)}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className={`ai-layout${isTemplateView ? " templates-active" : ""}`}>
          <AiStudioToolbar
            selectedTool={selectedTool}
            showEditTools={showEditTools}
            onSelectTool={handleToolSelect}
            onToggleEditTools={setShowEditTools}
          />

          <div className="ai-content">
            <section className={`ai-shell ${selectedTool ? "" : "ai-shell-wide"}`}>
              {selectedTool ? <aside className="panel ai-panel ai-properties">{renderProperties()}</aside> : null}

              <div className="ai-preview-column reference-column">
                <div className="preview-column-header">
                  <div>
                    <p className="eyebrow">Reference Grid</p>
                    <p className="tiny subdued">Double-click a reference to expand.</p>
                  </div>
                  <div className="preview-header-actions">
                    <button
                      type="button"
                      className="ghost-btn mini preview-media-btn"
                      onClick={triggerFilePicker}
                    >
                      <UploadSimple size={14} weight="regular" />
                      Add files
                    </button>
                    <Link href="/media-library" className="ghost-btn mini preview-media-btn">
                      <CloudArrowUp size={14} weight="regular" />
                      Media library
                    </Link>
                  </div>
                </div>
                <ReferenceCanvas
                  outputs={outputs}
                  activeOutputId={activeOutputId}
                  showHeader={false}
                  onSelectOutput={setActiveOutputId}
                  onOpenDetails={setDetailOutputId}
                  onDropFiles={handleReferenceCanvasFiles}
                  onTriggerFileSelect={triggerFilePicker}
                />
              </div>

              <StudioPreview
                activeOutput={activeOutput}
                referenceImageUrl={referenceImageUrl}
                referenceText={referenceText}
                onReferenceImageChange={setReferenceImageUrl}
                onReferenceTextChange={setReferenceText}
                onRegenerate={regenerateOutput}
                onTriggerFileSelect={triggerFilePicker}
                onDropFiles={handleReferenceCanvasFiles}
              />
            </section>
          </div>
        </div>
      </main>
      <ModelModal
        isOpen={isModelModalOpen}
        position={modelModalPosition}
        onClose={closeModelModal}
        onSelect={handleSelectModelFromModal}
        options={filteredModelOptions}
      />
      <DetailModal
        output={detailOutput}
        onClose={() => setDetailOutputId(null)}
        onUpdatePrompt={updateOutputPrompt}
      />
    </>
  );
}
