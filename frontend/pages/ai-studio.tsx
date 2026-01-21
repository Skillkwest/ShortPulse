import Head from "next/head";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowClockwise, CloudArrowUp, ShieldCheck, Sparkle, UploadSimple } from "phosphor-react";

import { CreateProperties } from "../components/ai-studio/CreateProperties";
import { DetailModal } from "../components/ai-studio/DetailModal";
import { OrganizeProperties } from "../components/ai-studio/OrganizeProperties";
import { PreviewCard } from "../components/ai-studio/PreviewCard";
import { ReferenceCanvas } from "../components/ai-studio/ReferenceCanvas";
import { RecreateProperties } from "../components/ai-studio/RecreateProperties";
import { Toolbar } from "../components/ai-studio/Toolbar";
import {
  aspectOptions,
  modelOptions,
  modeIconMap,
  previewPlaceholders,
  promptTemplates,
  toolIcons,
  toolList,
} from "../components/ai-studio/config";
import { StudioMode, StudioOutput, ToolId } from "../components/ai-studio/types";

const randomId = () => Math.random().toString(36).slice(2);

/**
 * Render AI Studio with a tool sidebar, preview canvas, and properties pane.
 */
export default function AiStudioPage() {
  // --- Refs & core state ----------------------------------------------------
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  // Creation inputs
  const [mode, setMode] = useState<StudioMode>("image");
  const [aspect, setAspect] = useState<string>(aspectOptions[0]?.value ?? "9:16");
  const [model, setModel] = useState<string>(modelOptions[0]?.value ?? "pulse-vision");
  const [prompt, setPrompt] = useState<string>("");

  // Output management
  const [outputs, setOutputs] = useState<StudioOutput[]>([]);
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // UI selections and references (shared across tools)
  const [selectedTool, setSelectedTool] = useState<ToolId>("create");
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [extraImageUrlOne, setExtraImageUrlOne] = useState<string | null>(null);
  const [extraImageUrlTwo, setExtraImageUrlTwo] = useState<string | null>(null);
  const [extraImageUrlThree, setExtraImageUrlThree] = useState<string | null>(null);
  const [referenceText, setReferenceText] = useState<string | null>(null);
  const [useReferenceImageIndicator, setUseReferenceImageIndicator] = useState<boolean>(false);
  const [detailOutputId, setDetailOutputId] = useState<string | null>(null);

  // --- Derived state --------------------------------------------------------
  const activeOutput = useMemo(
    () => outputs.find((item) => item.id === activeOutputId) ?? outputs[0] ?? null,
    [activeOutputId, outputs],
  );

  // --- Lifecycle ------------------------------------------------------------
  useEffect(() => {
    document.body.classList.add("ai-studio-body");
    document.documentElement.classList.add("ai-studio-body");
    promptRef.current?.focus();
    return () => {
      document.body.classList.remove("ai-studio-body");
      document.documentElement.classList.remove("ai-studio-body");
    };
  }, []);

  useEffect(() => {
    if (!activeOutputId && outputs.length > 0) {
      setActiveOutputId(outputs[0].id);
    }
  }, [activeOutputId, outputs]);

  useEffect(() => {
    if (!activeOutput?.previewUrl) {
      setUseReferenceImageIndicator(false);
    }
  }, [activeOutput?.previewUrl]);

  useEffect(() => {
    if (!detailOutputId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailOutputId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detailOutputId]);

  // --- Output + prompt actions ---------------------------------------------
  const handleGenerate = () => {
    const id = `out-${randomId()}`;
    const modelLabel = modelOptions.find((opt) => opt.value === model)?.label ?? "Selected model";
    const isPromptMode = mode === "enhance";
    const cleanedPrompt = prompt.trim() || "Untitled prompt";
    const previewUrl = isPromptMode ? undefined : previewPlaceholders[Math.floor(Math.random() * previewPlaceholders.length)];
    const previewText = isPromptMode ? cleanedPrompt : undefined;
    const nextOutput: StudioOutput = {
      id,
      prompt: cleanedPrompt,
      mode,
      aspect,
      model: modelLabel,
      status: "ready",
      timestamp: "Just now",
      previewUrl,
      previewText,
    };
    setOutputs((prev) => [nextOutput, ...prev]);
    setActiveOutputId(id);
    setSaved(false);
  };

  const handleRegenerate = () => {
    const promptToUse = referenceText?.trim();
    if (!promptToUse) return;
    const id = `out-${randomId()}`;
    const modelLabel = modelOptions.find((opt) => opt.value === model)?.label ?? "Selected model";
    const isPromptMode = mode === "enhance";
    const previewUrl = isPromptMode ? undefined : previewPlaceholders[Math.floor(Math.random() * previewPlaceholders.length)];
    const previewText = isPromptMode ? promptToUse : undefined;
    const nextOutput: StudioOutput = {
      id,
      prompt: promptToUse,
      mode,
      aspect,
      model: modelLabel,
      status: "ready",
      timestamp: "Just now",
      previewUrl,
      previewText,
    };
    const shouldSeedPromptReference = isPromptMode && promptToUse && !referenceText;

    if (shouldSeedPromptReference) {
      setReferenceText(promptToUse);
    }
    setOutputs((prev) => [nextOutput, ...prev]);
    setActiveOutputId(id);
    setSaved(false);
  };

  // Saving is separate so future "autosave" logic can live here.
  const handleSave = () => {
    if (!activeOutput) return;
    setOutputs((prev) =>
      prev.map((item) =>
        item.id === activeOutput.id ? { ...item, status: "saved", timestamp: "Saved" } : item,
      ),
    );
    setSaved(true);
  };

  const handleUsePreset = (text: string) => {
    setPrompt(text);
    setSelectedTool("create");
    promptRef.current?.focus();
  };

  const handleSavePromptReference = () => {
    const cleanedPrompt = prompt.trim();
    if (!cleanedPrompt) return;
    const id = `prompt-${randomId()}`;
    const promptReference: StudioOutput = {
      id,
      prompt: cleanedPrompt,
      mode,
      aspect,
      model: modelOptions.find((opt) => opt.value === model)?.label ?? "Selected model",
      status: "saved",
      timestamp: "Saved prompt",
      previewText: cleanedPrompt,
    };
    setOutputs((prev) => [promptReference, ...prev]);
    setActiveOutputId(id);
  };

  // --- Drop handlers (single responsibility setters) -----------------------
  const handleImageDropWithSetter = (
    setter: React.Dispatch<React.SetStateAction<string | null>>,
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    const textUrl = event.dataTransfer.getData("text/plain");
    if (files && files.length > 0) {
      const imageFile = Array.from(files).find((file) => file.type.startsWith("image/"));
      if (imageFile) {
        const url = URL.createObjectURL(imageFile);
        setter(url);
        return;
      }
    }
    if (textUrl) {
      setter(textUrl);
    }
  };

  const handleImageDrop = (event: React.DragEvent<HTMLDivElement>) =>
    handleImageDropWithSetter(setReferenceImageUrl, event);
  const handleExtraImageDropOne = (event: React.DragEvent<HTMLDivElement>) =>
    handleImageDropWithSetter(setExtraImageUrlOne, event);
  const handleExtraImageDropTwo = (event: React.DragEvent<HTMLDivElement>) =>
    handleImageDropWithSetter(setExtraImageUrlTwo, event);
  const handleExtraImageDropThree = (event: React.DragEvent<HTMLDivElement>) =>
    handleImageDropWithSetter(setExtraImageUrlThree, event);

  const handlePromptDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.dataTransfer.getData("text/plain");
    if (text) setReferenceText(text);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleClearDropImages = () => {
    setReferenceImageUrl(null);
    setExtraImageUrlOne(null);
    setExtraImageUrlTwo(null);
    setExtraImageUrlThree(null);
  };

  const referenceImageInputRef = useRef<HTMLInputElement | null>(null);
  const extraImageOneInputRef = useRef<HTMLInputElement | null>(null);
  const extraImageTwoInputRef = useRef<HTMLInputElement | null>(null);
  const extraImageThreeInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelection =
    (setter: React.Dispatch<React.SetStateAction<string | null>>) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setter(url);
      event.target.value = "";
    };

  const clearReferenceImage = (setter: React.Dispatch<React.SetStateAction<string | null>>) => {
    setter(null);
  };

  const handleReferenceIndicatorToggle = () => {
    if (!activeOutput?.previewUrl) return;
    setUseReferenceImageIndicator((prev) => !prev);
  };

  const detailOutput = useMemo(
    () => outputs.find((item) => item.id === detailOutputId) ?? null,
    [detailOutputId, outputs],
  );

  const renderDetailModal = () => {
    if (!detailOutput) return null;
    const mediaType =
      detailOutput.mode === "image" ? "Image" : detailOutput.mode === "video" ? "Video" : "Prompt";
    const isPromptOnly = detailOutput.mode === "enhance";
    return (
      <div className="reference-modal-backdrop" onClick={() => setDetailOutputId(null)}>
        <div
          className={`reference-modal ${isPromptOnly ? "prompt-only" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="Reference details"
          onClick={(event) => event.stopPropagation()}
        >
          {isPromptOnly ? (
            <div className="reference-modal-details prompt-only">
              <div className="reference-modal-header">
                <p className="eyebrow">Media details</p>
                <button
                  type="button"
                  className="reference-modal-close"
                  aria-label="Close"
                  onClick={() => setDetailOutputId(null)}
                >
                  ×
                </button>
              </div>
              <div className="reference-detail-row">
                <span className="reference-detail-label">Media type</span>
                <span className="reference-detail-value">{mediaType}</span>
              </div>
              <div className="prompt-only-block">
                <span className="reference-detail-label">Prompt</span>
                <p className="reference-modal-prompt-box">{detailOutput.prompt}</p>
              </div>
              <div className="reference-modal-actions">
                <button type="button" className="primary-btn">Save to Media Library</button>
              </div>
            </div>
          ) : (
            <>
              <div className="reference-modal-media">
                {detailOutput.previewUrl ? (
                  <div
                    className="reference-modal-media-frame"
                    style={{ backgroundImage: `url(${detailOutput.previewUrl})` }}
                  />
                ) : (
                  <div className="reference-modal-media-frame text-only">
                    <p className="reference-modal-prompt">{detailOutput.previewText ?? detailOutput.prompt}</p>
                  </div>
                )}
              </div>
              <div className="reference-modal-details">
                <div className="reference-modal-header">
                  <p className="eyebrow">Media details</p>
                  <button
                    type="button"
                    className="reference-modal-close"
                    aria-label="Close"
                    onClick={() => setDetailOutputId(null)}
                  >
                    ×
                  </button>
                </div>
                <div className="reference-detail-grid">
                  <div className="reference-detail-row">
                    <span className="reference-detail-label">Media type</span>
                    <span className="reference-detail-value">{mediaType}</span>
                  </div>
                  <div className="reference-detail-row">
                    <span className="reference-detail-label">Aspect ratio</span>
                    <span className="reference-detail-value">{detailOutput.aspect}</span>
                  </div>
                  <div className="reference-detail-row">
                    <span className="reference-detail-label">Model</span>
                    <span className="reference-detail-value">{detailOutput.model}</span>
                  </div>
                  <div className="reference-detail-row column">
                    <span className="reference-detail-label">Prompt</span>
                    <p className="reference-detail-value prompt-block">{detailOutput.prompt}</p>
                  </div>
                </div>
                <div className="reference-modal-actions">
                  <button type="button" className="primary-btn">Save to Media Library</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const referenceCanvasFileInputRef = useRef<HTMLInputElement | null>(null);
  const handleReferenceCanvasFiles = (files: FileList) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;
    setOutputs((prev) => {
      const newEntries: StudioOutput[] = imageFiles.map((file) => {
        const url = URL.createObjectURL(file);
        return {
          id: `upload-${randomId()}`,
          prompt: file.name,
          mode,
          aspect,
          model: modelOptions.find((opt) => opt.value === model)?.label ?? "Uploaded",
          status: "ready",
          timestamp: "Dropped",
          previewUrl: url,
        };
      });
      setActiveOutputId(newEntries[0].id);
      return [...newEntries, ...prev];
    });
  };

  const handleFileBrowserSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleReferenceCanvasFiles(files);
    }
    event.target.value = "";
  };

  // --- Properties panel renderers ------------------------------------------
  const renderProperties = () => {
    switch (selectedTool) {
      case "create":
        return (
          <CreateProperties
            mode={mode}
            aspect={aspect}
            model={model}
            prompt={prompt}
            activeOutput={activeOutput}
            useReferenceImageIndicator={useReferenceImageIndicator}
            promptRef={promptRef}
            aspectOptions={aspectOptions}
            modelOptions={modelOptions}
            modeIconMap={modeIconMap}
            onModeChange={setMode}
            onAspectChange={setAspect}
            onModelChange={setModel}
            onPromptChange={setPrompt}
            onToggleReferenceIndicator={handleReferenceIndicatorToggle}
            onSavePromptReference={handleSavePromptReference}
            onGenerate={handleGenerate}
          />
        );
      case "edit":
        return (
          <RecreateProperties
            title="Recreate"
            subtitle="Recreate images using references."
            aspect={aspect}
            model={model}
            referenceImageUrl={referenceImageUrl}
            extraImageUrlOne={extraImageUrlOne}
            extraImageUrlTwo={extraImageUrlTwo}
            extraImageUrlThree={extraImageUrlThree}
            referenceText={referenceText}
            saved={saved}
            activeOutput={activeOutput}
            aspectOptions={aspectOptions}
            modelOptions={modelOptions}
            onAspectChange={setAspect}
            onModelChange={setModel}
            onClearDropImages={handleClearDropImages}
            onPrimaryDrop={handleImageDrop}
            onExtraOneDrop={handleExtraImageDropOne}
            onExtraTwoDrop={handleExtraImageDropTwo}
            onExtraThreeDrop={handleExtraImageDropThree}
            onDragOver={handleDragOver}
            onPrimaryClick={() => referenceImageInputRef.current?.click()}
            onExtraOneClick={() => extraImageOneInputRef.current?.click()}
            onExtraTwoClick={() => extraImageTwoInputRef.current?.click()}
            onExtraThreeClick={() => extraImageThreeInputRef.current?.click()}
            onRemovePrimary={() => clearReferenceImage(setReferenceImageUrl)}
            onRemoveExtraOne={() => clearReferenceImage(setExtraImageUrlOne)}
            onRemoveExtraTwo={() => clearReferenceImage(setExtraImageUrlTwo)}
            onRemoveExtraThree={() => clearReferenceImage(setExtraImageUrlThree)}
            onPromptDrop={handlePromptDrop}
            onPromptTextChange={setReferenceText}
            onSave={handleSave}
            onGenerate={handleGenerate}
          />
        );
      case "image-to-video":
        return (
          <RecreateProperties
            title="Image to Video"
            subtitle="Animate still images using references and prompts."
            aspect={aspect}
            model={model}
            referenceImageUrl={referenceImageUrl}
            extraImageUrlOne={extraImageUrlOne}
            extraImageUrlTwo={extraImageUrlTwo}
            extraImageUrlThree={extraImageUrlThree}
            referenceText={referenceText}
            saved={saved}
            activeOutput={activeOutput}
            aspectOptions={aspectOptions}
            modelOptions={modelOptions}
            onAspectChange={setAspect}
            onModelChange={setModel}
            onClearDropImages={handleClearDropImages}
            onPrimaryDrop={handleImageDrop}
            onExtraOneDrop={handleExtraImageDropOne}
            onExtraTwoDrop={handleExtraImageDropTwo}
            onExtraThreeDrop={handleExtraImageDropThree}
            onDragOver={handleDragOver}
            onPrimaryClick={() => referenceImageInputRef.current?.click()}
            onExtraOneClick={() => extraImageOneInputRef.current?.click()}
            onExtraTwoClick={() => extraImageTwoInputRef.current?.click()}
            onExtraThreeClick={() => extraImageThreeInputRef.current?.click()}
            onRemovePrimary={() => clearReferenceImage(setReferenceImageUrl)}
            onRemoveExtraOne={() => clearReferenceImage(setExtraImageUrlOne)}
            onRemoveExtraTwo={() => clearReferenceImage(setExtraImageUrlTwo)}
            onRemoveExtraThree={() => clearReferenceImage(setExtraImageUrlThree)}
            onPromptDrop={handlePromptDrop}
            onPromptTextChange={setReferenceText}
            onSave={handleSave}
            onGenerate={handleGenerate}
          />
        );
      case "organize":
        return <OrganizeProperties promptTemplates={promptTemplates} onUsePreset={handleUsePreset} />;
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
          ref={referenceImageInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileSelection(setReferenceImageUrl)}
        />
        <input
          ref={extraImageOneInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileSelection(setExtraImageUrlOne)}
        />
        <input
          ref={extraImageTwoInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileSelection(setExtraImageUrlTwo)}
        />
        <input
          ref={extraImageThreeInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileSelection(setExtraImageUrlThree)}
        />
        <input
          ref={referenceCanvasFileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleFileBrowserSelection}
        />
        <div className="page-top">
          {/* intentionally empty; toolbar contains navigation */}
        </div>

        <section className="ai-hero panel hero-banner ai-amber-hero">
          <div className="hero-text">
            <h1>AI Studio</h1>
            <p className="subdued">
              Choose a tool, set your frame, and preview outputs.
            </p>
          </div>
          <div className="hero-right hero-stats">
            <div className="header-stat-card hero-stat">
              <div className="status-icon compact">
                <Sparkle size={16} weight="bold" />
              </div>
              <div className="header-card-body">
                <p className="metric-label tiny">AI credits</p>
                <p className="status-value small">48 / 100</p>
              </div>
            </div>
            <div className="header-stat-card hero-stat">
              <div className="status-icon compact">
                <ShieldCheck size={16} weight="bold" />
              </div>
              <div className="header-card-body">
                <p className="metric-label tiny">Plan</p>
                <p className="status-value small plan-creative">Creative Suite</p>
              </div>
            </div>
          </div>
        </section>

        <div className="ai-layout">
          <Toolbar tools={toolList} toolIcons={toolIcons} selectedTool={selectedTool} onSelect={setSelectedTool} />

          <div className="ai-content">
            <section className="ai-shell">
              <aside className="panel ai-panel ai-properties">{renderProperties()}</aside>

              <div className="ai-preview-column reference-column">
                <div className="preview-column-header">
                  <div>
                    <p className="eyebrow">Reference Canvas</p>
                    <p className="tiny subdued">Double-click a reference to expand.</p>
                  </div>
                  <div className="preview-header-actions">
                    <button
                      type="button"
                      className="ghost-btn mini preview-media-btn"
                      onClick={() => referenceCanvasFileInputRef.current?.click()}
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
                  onSelect={(id) => setActiveOutputId(id)}
                  onOpenDetail={setDetailOutputId}
                  showHeader={false}
                  onExternalDrop={handleReferenceCanvasFiles}
                />
              </div>

              <div className="ai-preview-column studio-column">
              <div className="studio-preview-header-row">
                <p className="eyebrow">Studio Preview</p>
              </div>
                <PreviewCard
                  eyebrowLabel="Studio Preview"
                  variant="reference-drop"
                  showMediaButton={false}
                  previewImage={referenceImageUrl}
                  referenceText={referenceText}
                  onReferenceDrop={setReferenceImageUrl}
                  onReferenceTextDrop={setReferenceText}
                  showHeader={false}
                  wrapContainer={false}
                />
                <div className="step-card regenerate-card">
                  <div className="preview-card-actions">
                    <button type="button" className="ghost-btn" onClick={handleRegenerate}>
                      <ArrowClockwise size={18} weight="bold" /> Regenerate
                    </button>
                  </div>
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>
      <DetailModal detailOutput={detailOutput} onClose={() => setDetailOutputId(null)} />
    </>
  );
}
