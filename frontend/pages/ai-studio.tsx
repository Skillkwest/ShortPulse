/**
 * AI Studio workspace page.
 * Orchestrates toolbar, properties panels, reference grid, and preview surfaces using the feature module.
 */
import Head from "next/head";
import Link from "next/link";
import React, { useMemo, useRef } from "react";
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
import { computeCostForModel, getModelConfig } from "../features/ai-studio/logic/pricing";

export default function AiStudioPage() {
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
  } = useAiStudioState();

  const referenceCanvasFileInputRef = useRef<HTMLInputElement | null>(null);

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

  const renderProperties = () => {
    switch (selectedTool) {
      case "create":
        return (
          <CreatePropertiesPanel
            mode={mode}
            aspect={aspect}
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
          />
        );
      case "image-to-image":
        return (
          <RecreatePropertiesPanel
            title="Image to Image"
            subtitle="Recreate images using references."
            aspect={aspect}
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
            resolvePreviewUrlById={resolvePreviewUrlById}
          />
        );
      case "image-to-video":
        return (
          <RecreatePropertiesPanel
            title="Image to Video"
            subtitle="Animate still images using references and prompts."
            aspect={aspect}
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
            resolvePreviewUrlById={resolvePreviewUrlById}
          />
        );
      default:
        return null;
    }
  };

  const isTemplateView =
    selectedTool === "templates" || selectedTool === "workflows" || selectedTool === "my-generations" || selectedTool === "community";

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

  const { balanceCents, balanceLoading, debit } = useCredits();
  const balanceCredits = useMemo(() => {
    if (balanceCents == null) return null;
    return Math.max(0, Math.floor(balanceCents)); // cents == credits
  }, [balanceCents]);
  const modelConfig = useMemo(() => getModelConfig(model), [model]);

  const currentCost = useMemo(() => {
    if (selectedTool === "create" && mode === "image") {
      return computeCostForModel(model, { aspect });
    }
    return null;
  }, [aspect, mode, model, selectedTool]);

  const currentCostCredits = currentCost?.credits ?? null;

  const handleGenerate = () => {
    if (currentCostCredits) {
      const memo = `${modelConfig?.label ?? model} generation`;
      debit(currentCostCredits, memo, `out-${Date.now()}`).catch(() => {});
    }
    generateOutput();
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
