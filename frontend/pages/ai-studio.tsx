/**
 * AI Studio workspace page.
 * Photoshop-like layout with left toolbar, center preview/output rail, and right-side properties per tool.
 */
import Head from "next/head";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowClockwise,
  ArrowFatLinesRight,
  Activity,
  CaretDown,
  CloudArrowUp,
  FloppyDisk,
  ImageSquare,
  MagicWand,
  Plus,
  ShieldCheck,
  Sparkle,
  SquaresFour,
  UploadSimple,
  VideoCamera,
} from "phosphor-react";

// --- Types ------------------------------------------------------------------

type StudioMode = "enhance" | "image" | "video";

type AspectOption = {
  value: string;
  ratioLabel: string;
  name: string;
  orientation: "square" | "vertical" | "horizontal" | "widescreen";
};

type PromptTemplate = {
  id: string;
  label: string;
  text: string;
};

type StudioOutput = {
  id: string;
  prompt: string;
  mode: StudioMode;
  aspect: string;
  model: string;
  status: "ready" | "saved";
  timestamp: string;
  previewUrl?: string;
  previewText?: string;
};

// --- Configurable options ---------------------------------------------------

const aspectOptions: AspectOption[] = [
  { value: "1:1", ratioLabel: "1:1", name: "Square", orientation: "square" },
  { value: "16:9", ratioLabel: "16:9", name: "Widescreen", orientation: "widescreen" },
  { value: "9:16", ratioLabel: "9:16", name: "Social story", orientation: "vertical" },
  { value: "2:3", ratioLabel: "2:3", name: "Portrait", orientation: "vertical" },
  { value: "3:4", ratioLabel: "3:4", name: "Traditional", orientation: "vertical" },
  { value: "1:2", ratioLabel: "1:2", name: "Vertical", orientation: "vertical" },
  { value: "2:1", ratioLabel: "2:1", name: "Horizontal", orientation: "horizontal" },
  { value: "4:5", ratioLabel: "4:5", name: "Social post", orientation: "vertical" },
  { value: "3:2", ratioLabel: "3:2", name: "Standard", orientation: "horizontal" },
  { value: "4:3", ratioLabel: "4:3", name: "Classic", orientation: "horizontal" },
];

const modelOptions = [
  { value: "pulse-vision", label: "Pulse Vision v2" },
  { value: "kinetic-video", label: "Kinetic v1" },
  { value: "aura-diffusion", label: "Aura Diffusion" },
  { value: "lumen-pro", label: "Lumen Pro" },
  { value: "vortex-hd", label: "Vortex HD" },
  { value: "studio-core", label: "Studio Core" },
  { value: "nebula-gen", label: "Nebula Gen" },
  { value: "flux-motion", label: "Flux Motion" },
  { value: "echo-style", label: "Echo Style" },
];

const promptTemplates: PromptTemplate[] = [
  {
    id: "product-demo",
    label: "Product demo",
    text: "Close-up vertical shot of the product in use with soft window light and a clean backdrop.",
  },
  {
    id: "tutorial",
    label: "Tutorial beat",
    text: "Step-by-step short tutorial showing setup, middle action, and a clear call to action on-screen.",
  },
  {
    id: "mood",
    label: "Moodboard",
    text: "Cinematic stills with shallow depth of field, teal accents, and tactile close-ups.",
  },
  {
    id: "promo",
    label: "Promo CTA",
    text: "Hero shot centered, dark backdrop, crisp text overlay for a quick promo message.",
  },
];

const randomId = () => Math.random().toString(36).slice(2);

const previewPlaceholders = [
  "/dashboard/ai-studio-hero.png",
  "/dashboard/welcome-art.png",
  "/brand-logo.png",
  "/placeholder-portrait.png",
  "/placeholder-portrait-2.png",
];

// --- Tool metadata ----------------------------------------------------------

type ToolId = "create" | "edit-parent" | "image-to-image" | "image-to-video";

const toolIcons: Record<ToolId, React.ComponentType<any>> = {
  create: Sparkle,
  "edit-parent": Activity,
  "image-to-image": ImageSquare,
  "image-to-video": VideoCamera,
};

const toolList: { id: ToolId; label: string; desc: string }[] = [
  { id: "create", label: "Create", desc: "Prompt and output type" },
  { id: "edit-parent", label: "Pulse", desc: "Show edit tools" },
];

const editChildTools: { id: ToolId; label: string; desc: string }[] = [
  { id: "image-to-image", label: "Image to Image", desc: "Regenerate from a reference" },
  { id: "image-to-video", label: "Image to Video", desc: "Animate a still image" },
];

const modeLabel = (value: StudioMode) => {
  switch (value) {
    case "video":
      return "Video";
    case "image":
      return "Image";
    default:
      return "Enhance";
  }
};

const modeIconMap: Record<StudioMode, React.ComponentType<any>> = {
  enhance: MagicWand,
  image: ImageSquare,
  video: VideoCamera,
};

/**
 * Render AI Studio with a tool sidebar, preview canvas, and properties pane.
 */
export default function AiStudioPage() {
  // --- Refs & core state ----------------------------------------------------
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const aspectDropdownRef = useRef<HTMLDivElement | null>(null);

  // Creation inputs
  const [mode, setMode] = useState<StudioMode>("image");
  const [aspect, setAspect] = useState<string>("9:16");
  const [model, setModel] = useState<string>(modelOptions[0]?.value ?? "pulse-vision");
  const [prompt, setPrompt] = useState<string>("");

  // Output management
  const [outputs, setOutputs] = useState<StudioOutput[]>([]);
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // UI selections and references (shared across tools)
  const [selectedTool, setSelectedTool] = useState<ToolId | null>(null);
  const [showEditTools, setShowEditTools] = useState<boolean>(false);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [extraImageUrlOne, setExtraImageUrlOne] = useState<string | null>(null);
  const [extraImageUrlTwo, setExtraImageUrlTwo] = useState<string | null>(null);
  const [extraImageUrlThree, setExtraImageUrlThree] = useState<string | null>(null);
  const [referenceText, setReferenceText] = useState<string | null>(null);
  const [useReferenceImageIndicator, setUseReferenceImageIndicator] = useState<boolean>(false);
  const [detailOutputId, setDetailOutputId] = useState<string | null>(null);
  const [isModelModalOpen, setIsModelModalOpen] = useState<boolean>(false);
  const [modelModalAnchor, setModelModalAnchor] = useState<string | null>(null);
  const [modelModalPosition, setModelModalPosition] = useState<{ top: number; left: number } | null>(null);
  const [isAspectMenuOpen, setIsAspectMenuOpen] = useState<boolean>(false);

  // --- Derived state --------------------------------------------------------
  const activeOutput = useMemo(
    () => outputs.find((item) => item.id === activeOutputId) ?? outputs[0] ?? null,
    [activeOutputId, outputs],
  );
  const currentModelLabel = useMemo(
    () => modelOptions.find((opt) => opt.value === model)?.label ?? "Select model",
    [model],
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
    const handleClickOutside = (event: MouseEvent) => {
      if (aspectDropdownRef.current && !aspectDropdownRef.current.contains(event.target as Node)) {
        setIsAspectMenuOpen(false);
      }
    };
    if (isAspectMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAspectMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailOutputId(null);
        handleCloseModelModal();
      }
    };

    const handleReposition = () => {
      if (!isModelModalOpen || !modelModalAnchor) return;
      const anchorEl = document.querySelector<HTMLElement>(`[data-model-anchor='${modelModalAnchor}']`);
      if (anchorEl) {
        const position = computeModalPosition(anchorEl);
        setModelModalPosition(position);
      } else {
        handleCloseModelModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [detailOutputId, isModelModalOpen, modelModalAnchor]);

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
  const renderCreateProperties = () => {
    const isEnhanceMode = mode === "enhance";
    const promptStepNumber = "3";
    const selectedAspect = aspectOptions.find((option) => option.value === aspect);

    return (
      <div className="tool-properties">
        <div className="tool-header">
          <p className="eyebrow">Create</p>
          <p className="subdued tiny">Generate new content using text input.</p>
        </div>
        <div className="step-card">
          <div className="step-card-header">
            <span className="step-badge">1</span>
            <div className="step-header-copy">
              <p className="step-title">Select Generation Mode</p>
              <span className="step-subtitle tiny">Select the output type you want to generate. </span>
            </div>
          </div>
          <div className="create-controls top-row mode-toggle-row" role="group" aria-label="Select generation mode">
            <button
              type="button"
              className={`ghost-btn small mode-toggle-btn ${mode === "enhance" ? "is-active" : ""}`}
              aria-pressed={mode === "enhance"}
              onClick={() => setMode("enhance")}
            >
              Text
            </button>
            <button
              type="button"
              className={`ghost-btn small mode-toggle-btn ${mode === "image" ? "is-active" : ""}`}
              aria-pressed={mode === "image"}
              onClick={() => setMode("image")}
            >
              Image
            </button>
            <button
              type="button"
              className={`ghost-btn small mode-toggle-btn ${mode === "video" ? "is-active" : ""}`}
              aria-pressed={mode === "video"}
              onClick={() => setMode("video")}
            >
              Video
            </button>
          </div>
        </div>
        {isEnhanceMode ? (
          <div className="step-card">
            <div className="step-card-header">
              <span className="step-badge">2</span>
              <div className="step-header-copy">
                <p className="step-title">Describe Image Mode (Optional)</p>
                <span className="step-subtitle tiny">Select a reference to generate a description of the image →</span>
              </div>
              <div className="step-header-actions">
                <button
                  type="button"
                  className={`reference-toggle ${useReferenceImageIndicator ? "is-active" : ""}`}
                  onClick={handleReferenceIndicatorToggle}
                  disabled={!activeOutput?.previewUrl}
                  aria-pressed={useReferenceImageIndicator}
                  aria-label={
                    useReferenceImageIndicator
                      ? "Reference linked; click to unlink"
                      : activeOutput?.previewUrl
                        ? "Link selected reference"
                        : "No image selected"
                  }
                >
                  <span className="reference-toggle-track">
                    <span className="reference-toggle-dot" aria-hidden="true" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="step-card">
            <div className="step-card-header">
              <span className="step-badge">2</span>
              <div className="step-header-copy">
                <p className="step-title">Choose frame & model</p>
                <span className="step-subtitle tiny">Set the aspect ratio, then select the model.</span>
              </div>
            </div>
            <div className="create-controls dual-controls">
              <div className="control-row compact">
                <label className="input-label">Aspect ratio</label>
                <div className="aspect-dropdown" ref={aspectDropdownRef}>
                  <button
                    type="button"
                    className="aspect-trigger"
                    onClick={() => setIsAspectMenuOpen((open) => !open)}
                    aria-haspopup="listbox"
                    aria-expanded={isAspectMenuOpen}
                  >
                    <span className={`aspect-shape ${selectedAspect?.orientation ?? "horizontal"}`} aria-hidden="true" />
                    <span className="aspect-meta">
                      <span className="aspect-ratio">{selectedAspect?.ratioLabel ?? aspect}</span>
                      <span className="aspect-name tiny subdued">{selectedAspect?.name ?? ""}</span>
                    </span>
                    <CaretDown size={16} weight="bold" className="aspect-caret" aria-hidden="true" />
                  </button>
                  {isAspectMenuOpen ? (
                    <div className="aspect-menu" role="listbox">
                      {aspectOptions.map((option) => {
                        const isActive = option.value === aspect;
                        return (
                          <button
                            type="button"
                            key={option.value}
                            className={`aspect-menu-item ${isActive ? "is-active" : ""}`}
                            role="option"
                            aria-selected={isActive}
                            onClick={() => {
                              setAspect(option.value);
                              setIsAspectMenuOpen(false);
                            }}
                          >
                            <span className={`aspect-shape ${option.orientation}`} aria-hidden="true" />
                            <span className="aspect-ratio">{option.ratioLabel}</span>
                            <span className="aspect-name">{option.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="control-row compact">
                <label className="input-label">Model</label>
                <button
                  type="button"
                  className={`model-picker-btn ${isModelModalOpen && modelModalAnchor === "create-model" ? "is-open" : ""}`}
                  data-model-anchor="create-model"
                  onClick={(event) => handleOpenModelModal("create-model", event.currentTarget)}
                >
                  <span className="model-picker-title">Select model here</span>
                  <span className="model-picker-value">{currentModelLabel}</span>
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="step-card prompt-step">
          <div className="step-card-header">
            <span className="step-badge">{promptStepNumber}</span>
            <div className="step-header-copy">
              <p className="step-title">Write Your Prompt</p>
              <span className="step-subtitle tiny">Describe What you want to create, then click Generate.</span>
            </div>
          </div>
          <textarea
            ref={promptRef}
            className="prompt-input"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={8}
            placeholder={
              mode === "enhance" ? "Type a simple prompt you want enhanced." : "Describe the image or video you want to create."
            }
          />
          <div className="ai-control-strip">
            <div className="ai-control-actions">
              <button type="button" className="ghost-btn mini">
                <CloudArrowUp size={12} weight="regular" /> Media library
              </button>
              <button type="button" className="ghost-btn mini" onClick={handleSavePromptReference}>
                <FloppyDisk size={12} weight="regular" /> Save prompt
              </button>
            </div>
            <button type="button" className="primary-btn" onClick={handleGenerate}>
              {modeIconMap[mode] ? (
                React.createElement(modeIconMap[mode], { size: 18, weight: "fill" })
              ) : (
                <Sparkle size={18} weight="fill" />
              )}{" "}
              Generate
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderRecreateProperties = (title: string, subtitle: string) => {
    const selectedAspect = aspectOptions.find((option) => option.value === aspect);
    return (
      <div className="tool-properties">
        <div className="tool-header">
          <p className="eyebrow">{title}</p>
          <p className="subdued tiny">{subtitle}</p>
        </div>
        <div className="reference-drop-layout-inner">
          <div className="reference-dropzone-block image-block">
            <div className="regenerate-step-card">
              <div className="regenerate-step-header">
                <span className="step-badge mini">1</span>
                <div className="regenerate-step-copy">
                  <p className="step-title">Add Image</p>
                  <span className="step-subtitle tiny">Drag a reference from the canvas or upload one manually.</span>
                </div>
                <div className="reference-drop-header-actions">
                  <button type="button" className="ghost-btn mini" onClick={handleClearDropImages}>
                    Clear
                  </button>
                </div>
              </div>
              <div className="drop-image-row">
                <div className="primary-drop">
                  <div
                    className={`reference-dropzone ${referenceImageUrl ? "has-preview" : ""}`}
                    onDrop={handleImageDrop}
                    onDragOver={handleDragOver}
                    onClick={() => referenceImageInputRef.current?.click()}
                    style={referenceImageUrl ? { backgroundImage: `url(${referenceImageUrl})` } : undefined}
                  >
                    {referenceImageUrl ? (
                      <button
                        type="button"
                        className="dropzone-clear"
                        onClick={(event) => {
                          event.stopPropagation();
                          clearReferenceImage(setReferenceImageUrl);
                        }}
                      >
                        ×
                      </button>
                    ) : null}
                    <div className="reference-drop-content image-drop-content">
                      <UploadSimple size={22} weight="regular" />
                      <p className="reference-drop-title">Click to upload an image</p>
                    </div>
                  </div>
                </div>
                <div className="secondary-drop">
                  <div
                    className={`reference-dropzone extra ${extraImageUrlOne ? "has-preview" : ""}`}
                    onDrop={handleExtraImageDropOne}
                    onDragOver={handleDragOver}
                    onClick={() => extraImageOneInputRef.current?.click()}
                    style={extraImageUrlOne ? { backgroundImage: `url(${extraImageUrlOne})` } : undefined}
                  >
                    {extraImageUrlOne ? (
                      <button
                        type="button"
                        className="dropzone-clear"
                        onClick={(event) => {
                          event.stopPropagation();
                          clearReferenceImage(setExtraImageUrlOne);
                        }}
                      >
                        ×
                      </button>
                    ) : (
                      <Plus size={22} weight="regular" />
                    )}
                  </div>
                </div>
                <div className="secondary-drop">
                  <div
                    className={`reference-dropzone extra ${extraImageUrlTwo ? "has-preview" : ""}`}
                    onDrop={handleExtraImageDropTwo}
                    onDragOver={handleDragOver}
                    onClick={() => extraImageTwoInputRef.current?.click()}
                    style={extraImageUrlTwo ? { backgroundImage: `url(${extraImageUrlTwo})` } : undefined}
                  >
                    {extraImageUrlTwo ? (
                      <button
                        type="button"
                        className="dropzone-clear"
                        onClick={(event) => {
                          event.stopPropagation();
                          clearReferenceImage(setExtraImageUrlTwo);
                        }}
                      >
                        ×
                      </button>
                    ) : (
                      <Plus size={22} weight="regular" />
                    )}
                  </div>
                </div>
                <div className="secondary-drop">
                  <div
                    className={`reference-dropzone extra ${extraImageUrlThree ? "has-preview" : ""}`}
                    onDrop={handleExtraImageDropThree}
                    onDragOver={handleDragOver}
                    onClick={() => extraImageThreeInputRef.current?.click()}
                    style={extraImageUrlThree ? { backgroundImage: `url(${extraImageUrlThree})` } : undefined}
                  >
                    {extraImageUrlThree ? (
                      <button
                        type="button"
                        className="dropzone-clear"
                        onClick={(event) => {
                          event.stopPropagation();
                          clearReferenceImage(setExtraImageUrlThree);
                        }}
                      >
                        ×
                      </button>
                    ) : (
                      <Plus size={22} weight="regular" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="step-card recreate-frame-card">
            <div className="step-card-header">
              <span className="step-badge">2</span>
              <div className="step-header-copy">
                <p className="step-title">Choose Frame & Model</p>
                <span className="step-subtitle tiny">Pick the target aspect ratio and AI model before you regenerate.</span>
              </div>
            </div>
            <div className="create-controls dual-controls recreate-frame-controls">
              <div className="control-row compact">
                <label className="input-label">Aspect ratio</label>
                <div className="aspect-dropdown" ref={aspectDropdownRef}>
                  <button
                    type="button"
                    className="aspect-trigger"
                    onClick={() => setIsAspectMenuOpen((open) => !open)}
                    aria-haspopup="listbox"
                    aria-expanded={isAspectMenuOpen}
                  >
                    <span
                      className={`aspect-shape ${selectedAspect?.orientation ?? "horizontal"} ratio-${selectedAspect?.value.replace(":", "-") ?? "16-9"}`}
                      aria-hidden="true"
                    />
                    <span className="aspect-meta">
                      <span className="aspect-ratio">{selectedAspect?.ratioLabel ?? aspect}</span>
                      <span className="aspect-name tiny subdued">{selectedAspect?.name ?? ""}</span>
                    </span>
                    <CaretDown size={16} weight="bold" className="aspect-caret" aria-hidden="true" />
                  </button>
                  {isAspectMenuOpen ? (
                    <div className="aspect-menu" role="listbox">
                      {aspectOptions.map((option) => {
                        const isActive = option.value === aspect;
                        return (
                          <button
                            type="button"
                            key={option.value}
                            className={`aspect-menu-item ${isActive ? "is-active" : ""}`}
                            role="option"
                            aria-selected={isActive}
                            onClick={() => {
                              setAspect(option.value);
                              setIsAspectMenuOpen(false);
                            }}
                          >
                            <span
                              className={`aspect-shape ${option.orientation} ratio-${option.value.replace(":", "-")}`}
                              aria-hidden="true"
                            />
                            <span className="aspect-ratio">{option.ratioLabel}</span>
                            <span className="aspect-name">{option.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="control-row compact">
                <label className="input-label">Model</label>
                <button
                  type="button"
                  className={`model-picker-btn ${isModelModalOpen && modelModalAnchor === "recreate-model" ? "is-open" : ""}`}
                  data-model-anchor="recreate-model"
                  onClick={(event) => handleOpenModelModal("recreate-model", event.currentTarget)}
                >
                  <span className="model-picker-title">Select model here</span>
                  <span className="model-picker-value">{currentModelLabel}</span>
                </button>
              </div>
            </div>
          </div>
          <div className="reference-dropzone-block prompt-block">
            <div className="regenerate-step-card">
              <div className="regenerate-step-header">
                <span className="step-badge mini">3</span>
                <div className="regenerate-step-copy">
                  <p className="step-title">Add Prompt</p>
                  <span className="step-subtitle tiny">Drop a saved prompt or describe the look you want to recreate.</span>
                </div>
              </div>
              <div
                className={`text-dropzone prompt-text-dropzone ${referenceText ? "has-text" : ""}`}
                onDrop={handlePromptDrop}
                onDragOver={handleDragOver}
              >
                <textarea
                  className="prompt-drop-input"
                  placeholder="Drag and drop a prompt from the Reference Grid or start typing"
                  value={referenceText ?? ""}
                  onChange={(event) => setReferenceText(event.target.value)}
                />
              </div>
              <div className="recreate-actions">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={activeOutput ? handleSave : undefined}
                  disabled={!activeOutput || saved || activeOutput.status === "saved"}
                >
                  <FloppyDisk size={18} weight="bold" /> {activeOutput?.status === "saved" ? "Saved" : "Save"}
                </button>
                <button type="button" className="ghost-btn" onClick={handleGenerate}>
                  <ArrowClockwise size={18} weight="bold" /> Regenerate
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEditProperties = () => renderRecreateProperties("Recreate", "Recreate images using references.");

  const renderImageToVideoProperties = () =>
    renderRecreateProperties("Image to Video", "Animate still images using references and prompts.");

  const renderProperties = () => {
    if (!selectedTool) {
      return null;
    }
    switch (selectedTool) {
      case "create":
        return renderCreateProperties();
      case "image-to-image":
        return renderEditProperties();
      case "image-to-video":
        return renderImageToVideoProperties();
      default:
        return null;
    }
  };

  const handleCloseModelModal = () => {
    setIsModelModalOpen(false);
    setModelModalAnchor(null);
  };
  const handleSelectModelFromModal = (value: string) => {
    setModel(value);
    setIsModelModalOpen(false);
    setModelModalAnchor(null);
  };

  const computeModalPosition = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const scrollY = window.scrollY || 0;
    const scrollX = window.scrollX || 0;
    const offsetX = 16;
    const top = rect.top + scrollY + rect.height / 2;
    const left = rect.right + scrollX + offsetX;
    return { top, left, caretOffset: rect.height / 2 };
  };

  const handleOpenModelModal = (anchorId: string, target: HTMLElement) => {
    const position = computeModalPosition(target);
    setModelModalAnchor(anchorId);
    setModelModalPosition(position);
    setIsModelModalOpen(true);
  };

  // --- Preview surfaces -----------------------------------------------------
  // Studio Preview card layout; tweak sizing, drop targets, and prompt display here.
  const renderPreviewCard = (
    eyebrowLabel: string,
    variant: "default" | "reference-drop" | "empty" = "default",
    showMediaButton = false,
    referenceImageUrl: string | null = null,
    referenceText: string | null = null,
    onReferenceDrop?: (url: string) => void,
    onReferenceTextDrop?: (text: string) => void,
    showHeader = true,
    wrapContainer = true,
  ) => {
    const isReferenceDrop = variant === "reference-drop";
    const showSurface = variant !== "empty";
    const previewImage = activeOutput?.previewUrl || referenceImageUrl;
    const activePromptText = referenceText ?? "";
    const handleReferenceDrop = (event: React.DragEvent<HTMLDivElement>) => {
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        return;
      }
      event.preventDefault();
      const url = event.dataTransfer.getData("text/plain");
      if (url && onReferenceDrop) {
        onReferenceDrop(url);
      }
    };
    const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
    };
    const handleTextDrop = (event: React.DragEvent<HTMLDivElement>) => {
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        return;
      }
      event.preventDefault();
      const text = event.dataTransfer.getData("text/plain");
      if (text && onReferenceTextDrop) {
        onReferenceTextDrop(text);
      }
    };
    const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (onReferenceTextDrop) {
        onReferenceTextDrop(event.target.value);
      }
    };
    const cardBody = (
      <>
        {showHeader ? (
          <div className={`panel-header ${showMediaButton ? "preview-header" : ""}`}>
            <div>
              <p className="eyebrow">{eyebrowLabel}</p>
            </div>
            {showMediaButton ? (
              <div className="preview-header-actions">
                <button type="button" className="ghost-btn mini preview-media-btn">
                  <UploadSimple size={14} weight="regular" />
                  Add files
                </button>
                <Link href="/media-library" className="ghost-btn mini preview-media-btn">
                  <CloudArrowUp size={14} weight="regular" />
                  Media library
                </Link>
              </div>
            ) : null}
          </div>
        ) : null}
        {isReferenceDrop ? (
          <div className="step-card studio-preview-card">
            <div
              className="studio-preview-square"
              onDrop={handleReferenceDrop}
              onDragOver={handleDragOver}
            >
              {previewImage ? (
                <div className="studio-preview-square-image" style={{ backgroundImage: `url(${previewImage})` }} />
              ) : (
                <div className="studio-preview-square-empty">
                  <ImageSquare size={24} weight="regular" />
                  <p className="tiny">Generated images will appear here.</p>
                </div>
              )}
            </div>
            <div
              className={`prompt-preview-card ${activePromptText ? "" : "is-empty"}`}
              onDrop={handleTextDrop}
              onDragOver={handleDragOver}
            >
              <textarea
                className="prompt-preview-input"
                value={activePromptText}
                placeholder="Prompt preview will appear here."
                onChange={handleTextChange}
              />
            </div>
          </div>
        ) : null}
        {showSurface && !isReferenceDrop ? (
          <div className="preview-surface">
            <div className="ai-empty">
              <p className="preview-title">Your preview appears here.</p>
              <p className="subdued tiny">Select Generate from the left to create an image or video.</p>
            </div>
          </div>
        ) : null}
      </>
    );

    if (!wrapContainer) {
      return cardBody;
    }

    return (
      <div className="panel ai-panel ai-preview-panel reference-canvas-panel">
        {cardBody}
      </div>
    );
  };

  // Reference Grid (left column) — tweak drop behavior or card styling here.
  const renderReferenceCanvas = (
    outputs: StudioOutput[],
    activeOutputId: string | null,
    setActiveOutputId: (id: string) => void,
    showHeader = true,
    onExternalDrop?: (files: FileList) => void,
  ) => {
    const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0 && onExternalDrop) {
        onExternalDrop(event.dataTransfer.files);
      }
    };

    const handleCanvasDragOver = (event: React.DragEvent<HTMLDivElement>) => {
      if (event.dataTransfer.types.includes("Files")) {
        event.preventDefault();
      }
    };

    return (
      <div
        className="panel ai-panel ai-preview-panel reference-canvas-panel"
        onDrop={handleCanvasDrop}
        onDragOver={handleCanvasDragOver}
      >
        {showHeader ? (
          <div className="panel-header preview-header">
            <div>
              <p className="eyebrow">Reference Grid</p>
            </div>
            <div className="preview-header-actions">
              <button type="button" className="ghost-btn mini preview-media-btn">
                <UploadSimple size={14} weight="regular" />
                Add files
              </button>
              <Link href="/media-library" className="ghost-btn mini preview-media-btn">
                <CloudArrowUp size={14} weight="regular" />
                Media library
              </Link>
            </div>
          </div>
        ) : null}
        <div className="reference-canvas-scroll">
          <div className="reference-canvas-grid">
            {outputs.length === 0 ? (
              <div className="reference-empty">
                <p className="preview-title">Upload or generate to see your media here.</p>
                <p className="subdued tiny">New prompts, images, and videos will appear in this grid.</p>
              </div>
            ) : (
              outputs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`reference-card ${item.previewUrl ? "has-preview" : ""} ${item.previewText ? "has-text" : ""} ${activeOutputId === item.id ? "is-active" : ""}`}
                  style={item.previewUrl ? { backgroundImage: `url(${item.previewUrl})` } : undefined}
                  onClick={() => setActiveOutputId(item.id)}
                  onDoubleClick={() => setDetailOutputId(item.id)}
                  draggable={!!item.previewUrl || !!item.previewText}
                  onDragStart={(event) => {
                    if (item.previewUrl) {
                      event.dataTransfer.setData("text/plain", item.previewUrl);
                    }
                    if (item.previewText) {
                      event.dataTransfer.setData("text/plain", item.previewText);
                    }
                  }}
                >
                  {item.previewText ? <div className="reference-card-text">{item.previewText}</div> : null}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
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

        <section className="ai-hero panel hero-banner ai-amber-hero" />

        <div className="ai-layout">
          <aside className="panel ai-panel ai-toolbar ai-toolbar-floating">
            <div className="toolbar-logo-card">
              <img src="/brand-logo.png" alt="Brand logo" />
            </div>
            <Link href="/dashboard" className="ghost-btn small toolbar-back-link">
              ← Back to dashboard
            </Link>
            <div className="toolbar-brand toolbar-title-only">
              <div>
                <p className="eyebrow">Tools</p>
              </div>
            </div>
            <div className="toolbar-list">
              {toolList.map((tool) => {
                const IconComponent = toolIcons[tool.id];
                const isEditParent = tool.id === "edit-parent";
                const isEditChildSelected =
                  selectedTool === "image-to-image" || selectedTool === "image-to-video";
                const isActive =
                  selectedTool === tool.id || (isEditParent && (showEditTools || isEditChildSelected));
                return (
                  <button
                    key={tool.id}
                    type="button"
                    className={`toolbar-item ${isActive ? "is-active" : ""}`}
                    onClick={() => {
                      if (isEditParent) {
                        setShowEditTools(true);
                        if (!isEditChildSelected) {
                          setSelectedTool("image-to-image");
                        }
                        return;
                      }
                      setShowEditTools(false);
                      setSelectedTool(tool.id);
                    }}
                  >
                    {IconComponent ? <IconComponent size={18} weight="bold" /> : null}
                    <div className="toolbar-copy">
                      <span className="toolbar-label">{tool.label}</span>
                    </div>
                  </button>
                );
              })}
              {showEditTools
                ? editChildTools.map((tool) => {
                    const IconComponent = toolIcons[tool.id];
                    const isActive = selectedTool === tool.id;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        className={`toolbar-item toolbar-item-child ${isActive ? "is-active" : ""}`}
                        onClick={() => setSelectedTool(tool.id)}
                      >
                        {IconComponent ? <IconComponent size={18} weight="bold" /> : null}
                        <div className="toolbar-copy">
                          <span className="toolbar-label">{tool.label}</span>
                        </div>
                      </button>
                    );
                  })
                : null}
            </div>
          </aside>

          <div className="ai-content">
            <section className="ai-shell">
              {selectedTool ? (
                <aside className="panel ai-panel ai-properties">{renderProperties()}</aside>
              ) : null}

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
                {/* Reference grid column — tweak grid/drop behavior in renderReferenceCanvas */}
                {renderReferenceCanvas(outputs, activeOutputId, setActiveOutputId, false, handleReferenceCanvasFiles)}
              </div>

              <div className="ai-preview-column studio-column">
              <div className="studio-preview-header-row">
                <p className="eyebrow">Studio Preview</p>
              </div>
                {/* Studio preview column — adjust square/prompt presentation in renderPreviewCard */}
                {renderPreviewCard(
                  "Studio Preview",
                  "reference-drop",
                  false,
                  referenceImageUrl,
                  referenceText,
                  setReferenceImageUrl,
                  setReferenceText,
                  false,
                  false,
                )}
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
      {isModelModalOpen ? (
        <div className="model-modal-backdrop" onClick={handleCloseModelModal}>
          <div
            className="model-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={
              modelModalPosition
                ? { top: `${modelModalPosition.top}px`, left: `${modelModalPosition.left}px` }
                : undefined
            }
          >
            <div className="model-modal-header">
              <p className="model-modal-title">Models</p>
              <button type="button" className="ghost-btn mini model-modal-close" onClick={handleCloseModelModal}>
                Close
              </button>
            </div>
            <div className="model-modal-grid">
              {modelOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="model-chip"
                  onClick={() => handleSelectModelFromModal(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {renderDetailModal()}
    </>
  );
}
