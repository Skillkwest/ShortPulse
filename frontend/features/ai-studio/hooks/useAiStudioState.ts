/**
 * Shared state + actions for AI Studio.
 * Encapsulates creation/regeneration flows, output book-keeping, and modal state so the page can stay declarative.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aspectOptions, modelOptions, previewPlaceholders } from "../constants";
import { randomId } from "../logic/ids";
import { StudioMode, StudioOutput, ToolId } from "../types";

type ModelModalPosition = { top: number; left: number };

const computeModalPosition = (target: HTMLElement): ModelModalPosition => {
  const rect = target.getBoundingClientRect();
  const scrollY = window.scrollY || 0;
  const scrollX = window.scrollX || 0;
  const offsetX = 16;
  const top = rect.top + scrollY + rect.height / 2;
  const left = rect.right + scrollX + offsetX;
  return { top, left };
};

/**
 * Provides AI Studio state and handlers for create/regenerate flows.
 */
export const useAiStudioState = () => {
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

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
  const [extraImageUrls, setExtraImageUrls] = useState<[string | null, string | null, string | null]>([
    null,
    null,
    null,
  ]);
  const [referenceText, setReferenceText] = useState<string | null>(null);
  const [useReferenceImageIndicator, setUseReferenceImageIndicator] = useState<boolean>(false);
  const [detailOutputId, setDetailOutputId] = useState<string | null>(null);
  const [isModelModalOpen, setIsModelModalOpen] = useState<boolean>(false);
  const [modelModalAnchor, setModelModalAnchor] = useState<string | null>(null);
  const [modelModalPosition, setModelModalPosition] = useState<ModelModalPosition | null>(null);

  const activeOutput = useMemo(
    () => outputs.find((item) => item.id === activeOutputId) ?? outputs[0] ?? null,
    [activeOutputId, outputs],
  );
  const detailOutput = useMemo(
    () => outputs.find((item) => item.id === detailOutputId) ?? null,
    [detailOutputId, outputs],
  );
  const currentModelLabel = useMemo(
    () => modelOptions.find((opt) => opt.value === model)?.label ?? "Select model",
    [model],
  );

  // --- Lifecycle ----------------------------------------------------------
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

  // Escape closes modals; model modal repositions on viewport changes.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailOutputId(null);
        setIsModelModalOpen(false);
        setModelModalAnchor(null);
      }
    };

    const handleReposition = () => {
      if (!isModelModalOpen || !modelModalAnchor) return;
      const anchorEl = document.querySelector<HTMLElement>(`[data-model-anchor='${modelModalAnchor}']`);
      if (anchorEl) {
        setModelModalPosition(computeModalPosition(anchorEl));
      } else {
        setIsModelModalOpen(false);
        setModelModalAnchor(null);
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
  }, [isModelModalOpen, modelModalAnchor]);

  // --- Output + prompt actions -------------------------------------------
  const generateOutput = useCallback(() => {
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
  }, [aspect, mode, model, prompt]);

  const regenerateOutput = useCallback(() => {
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
    setOutputs((prev) => [nextOutput, ...prev]);
    setActiveOutputId(id);
    setSaved(false);
  }, [aspect, mode, model, referenceText]);

  const saveActiveOutput = useCallback(() => {
    if (!activeOutput) return;
    setOutputs((prev) =>
      prev.map((item) =>
        item.id === activeOutput.id ? { ...item, status: "saved", timestamp: "Saved" } : item,
      ),
    );
    setSaved(true);
  }, [activeOutput]);

  const savePromptReference = useCallback(() => {
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
  }, [prompt, mode, aspect, model]);

  const addOutputsFromFiles = useCallback(
    (files: FileList) => {
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
    },
    [aspect, model, mode],
  );

  const toggleReferenceIndicator = useCallback(() => {
    if (!activeOutput?.previewUrl) return;
    setUseReferenceImageIndicator((prev) => !prev);
  }, [activeOutput?.previewUrl]);

  const clearReferenceImages = useCallback(() => {
    setReferenceImageUrl(null);
    setExtraImageUrls([null, null, null]);
  }, []);

  const setExtraImageUrl = useCallback((index: number, url: string | null) => {
    setExtraImageUrls((prev) => {
      const next: [string | null, string | null, string | null] = [...prev];
      next[index] = url;
      return next;
    });
  }, []);

  const openModelModal = useCallback((anchorId: string, target: HTMLElement) => {
    setModelModalAnchor(anchorId);
    setModelModalPosition(computeModalPosition(target));
    setIsModelModalOpen(true);
  }, []);

  const closeModelModal = useCallback(() => {
    setIsModelModalOpen(false);
    setModelModalAnchor(null);
  }, []);

  return {
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
    setOutputs,
    activeOutput,
    activeOutputId,
    setActiveOutputId,
    saved,
    setSaved,
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
    detailOutputId,
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
  };
};
