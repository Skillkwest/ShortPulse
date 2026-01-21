/**
 * AI Studio workspace page.
 * Orchestrates toolbar, properties panels, reference grid, and preview surfaces using the feature module.
 */
import Head from "next/head";
import Link from "next/link";
import React, { useRef } from "react";
import { CloudArrowUp, UploadSimple } from "phosphor-react";
import { AiStudioToolbar } from "../features/ai-studio/components/AiStudioToolbar";
import { CreatePropertiesPanel } from "../features/ai-studio/components/CreatePropertiesPanel";
import { DetailModal } from "../features/ai-studio/components/DetailModal";
import { ModelModal } from "../features/ai-studio/components/ModelModal";
import { ReferenceCanvas } from "../features/ai-studio/components/ReferenceCanvas";
import { RecreatePropertiesPanel } from "../features/ai-studio/components/RecreatePropertiesPanel";
import { StudioPreview } from "../features/ai-studio/components/StudioPreview";
import { aspectOptions } from "../features/ai-studio/constants";
import { useAiStudioState } from "../features/ai-studio/hooks/useAiStudioState";
import { ToolId } from "../features/ai-studio/types";

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
    generateOutput,
    regenerateOutput,
    saveActiveOutput,
    savePromptReference,
    addOutputsFromFiles,
    toggleReferenceIndicator,
    clearReferenceImages,
    openModelModal,
    closeModelModal,
  } = useAiStudioState();

  const referenceCanvasFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenModelModal = (anchorId: string, target: HTMLElement) => {
    openModelModal(anchorId, target);
  };

  const handleSelectModelFromModal = (value: string) => {
    setModel(value);
    closeModelModal();
  };

  const handleToolSelect = (tool: ToolId) => setSelectedTool(tool);

  const handleFileBrowserSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      addOutputsFromFiles(files);
    }
    event.target.value = "";
  };

  const handleReferenceCanvasFiles = (files: FileList) => addOutputsFromFiles(files);
  const triggerFilePicker = () => referenceCanvasFileInputRef.current?.click();

  const canSave = Boolean(activeOutput) && !saved && activeOutput?.status !== "saved";
  const saveLabel = activeOutput?.status === "saved" ? "Saved" : "Save";

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
            onGenerate={generateOutput}
            onSavePrompt={savePromptReference}
            onToggleReferenceIndicator={toggleReferenceIndicator}
          />
        );
      case "image-to-image":
        return (
          <RecreatePropertiesPanel
            title="Recreate"
            subtitle="Recreate images using references."
            aspect={aspect}
            modelLabel={currentModelLabel}
            referenceImageUrl={referenceImageUrl}
            extraImageUrls={extraImageUrls}
            referenceText={referenceText}
            aspectOptions={aspectOptions}
            isModelModalOpen={isModelModalOpen}
            modelModalAnchor={modelModalAnchor}
            canSave={canSave}
            saveLabel={saveLabel}
            onAspectChange={setAspect}
            onModelPickerOpen={handleOpenModelModal}
            onPrimaryImageChange={setReferenceImageUrl}
            onExtraImageChange={setExtraImageUrl}
            onClearImages={clearReferenceImages}
            onPromptTextChange={setReferenceText}
            onSave={saveActiveOutput}
            onRegenerate={generateOutput}
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
            canSave={canSave}
            saveLabel={saveLabel}
            onAspectChange={setAspect}
            onModelPickerOpen={handleOpenModelModal}
            onPrimaryImageChange={setReferenceImageUrl}
            onExtraImageChange={setExtraImageUrl}
            onClearImages={clearReferenceImages}
            onPromptTextChange={setReferenceText}
            onSave={saveActiveOutput}
            onRegenerate={generateOutput}
          />
        );
      default:
        return null;
    }
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

        <section className="ai-hero panel hero-banner ai-amber-hero" />

        <div className="ai-layout">
          <AiStudioToolbar
            selectedTool={selectedTool}
            showEditTools={showEditTools}
            onSelectTool={handleToolSelect}
            onToggleEditTools={setShowEditTools}
          />

          <div className="ai-content">
            <section className="ai-shell">
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
      />
      <DetailModal output={detailOutput} onClose={() => setDetailOutputId(null)} />
    </>
  );
}
