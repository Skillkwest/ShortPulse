/**
 * Interaction hook for AI Studio reference properties UI.
 * Centralizes collapse state, drag/drop handling, and Kling list mutations.
 */
import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import {
  extractDragDropPayload,
  extractVideoDragDropPayload,
  isImageDragTransfer,
  isVideoDragTransfer,
  looksLikeVideoUrl,
} from "../utils/dragDrop";

export type ReferenceStepKey =
  | "reference"
  | "model"
  | "imageSettings"
  | "prompt"
  | "motionAudio"
  | "videoSettings"
  | "klingAdvanced"
  | "klingAssets"
  | "klingGuidance"
  | "generate";

type KlingMultiPrompt = { id: string; prompt: string; duration: number };

type KlingElement = {
  id: string;
  frontalImageUrl: string;
  referenceImageUrls: string;
  videoUrl: string;
};

type UseReferencePropertiesInteractionsParams = {
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  onPrimaryImageChange: (url: string | null) => void;
  onExtraImageChange: (index: number, url: string | null) => void;
  onPromptTextChange: (value: string) => void;
  onMotionVideoChange?: (url: string | null) => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  klingMultiPrompts: KlingMultiPrompt[];
  onKlingMultiPromptsChange?: (value: KlingMultiPrompt[]) => void;
  klingElements: KlingElement[];
  onKlingElementsChange?: (value: KlingElement[]) => void;
};

/**
 * Returns UI interaction state and handlers for reference properties editing.
 */
export const useReferencePropertiesInteractions = ({
  referenceImageUrl,
  extraImageUrls,
  onPrimaryImageChange,
  onExtraImageChange,
  onPromptTextChange,
  onMotionVideoChange,
  resolvePreviewUrlById,
  klingMultiPrompts,
  onKlingMultiPromptsChange,
  klingElements,
  onKlingElementsChange,
}: UseReferencePropertiesInteractionsParams) => {
  const primaryInputRef = useRef<HTMLInputElement | null>(null);
  const extraOneInputRef = useRef<HTMLInputElement | null>(null);
  const extraTwoInputRef = useRef<HTMLInputElement | null>(null);
  const extraThreeInputRef = useRef<HTMLInputElement | null>(null);
  const motionVideoInputRef = useRef<HTMLInputElement | null>(null);
  const makeId = () => `kling-${Math.random().toString(36).slice(2, 9)}`;

  const [primaryDragActive, setPrimaryDragActive] = useState(false);
  const [extraDragActive, setExtraDragActive] = useState([false, false, false]);
  const [motionVideoDragActive, setMotionVideoDragActive] = useState(false);
  const [collapsedSteps, setCollapsedSteps] = useState<Record<ReferenceStepKey, boolean>>({
    reference: false,
    model: false,
    imageSettings: false,
    prompt: false,
    motionAudio: false,
    videoSettings: false,
    klingAdvanced: false,
    klingAssets: false,
    klingGuidance: false,
    generate: false,
  });

  const toggleStep = (step: ReferenceStepKey) => {
    setCollapsedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  const expandIfCollapsed = (step: ReferenceStepKey) => {
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

  const updateKlingMultiPrompt = (
    id: string,
    key: "prompt" | "duration",
    value: string | number
  ) => {
    const next = klingMultiPrompts.map((item) =>
      item.id === id ? { ...item, [key]: value } : item
    );
    onKlingMultiPromptsChange?.(next);
  };

  const addKlingShot = () => {
    onKlingMultiPromptsChange?.([...klingMultiPrompts, { id: makeId(), prompt: "", duration: 5 }]);
  };

  const removeKlingShot = (id: string) => {
    onKlingMultiPromptsChange?.(klingMultiPrompts.filter((item) => item.id !== id));
  };

  const updateKlingElement = (
    id: string,
    key: "frontalImageUrl" | "referenceImageUrls" | "videoUrl",
    value: string
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
    (setter: (url: string | null) => void) => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setter(url);
      event.target.value = "";
    };

  const handlePromptDrop = (event: DragEvent<HTMLDivElement | HTMLTextAreaElement>) => {
    event.preventDefault();
    const { promptText } = extractDragDropPayload(event.dataTransfer);
    if (promptText) {
      onPromptTextChange(promptText);
    }
  };

  const handleImageDrop =
    (setter: (url: string | null) => void) => (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const { imageUrl, fromFile, referenceId } = extractDragDropPayload(event.dataTransfer);
      let nextUrl = imageUrl;

      if ((!nextUrl || nextUrl.startsWith("blob:")) && referenceId && resolvePreviewUrlById) {
        nextUrl = resolvePreviewUrlById(referenceId);
      }

      if (!nextUrl) return;

      const isBlobUrl = nextUrl.startsWith("blob:");
      const canAcceptBlob = fromFile || Boolean(referenceId);

      if (!isBlobUrl || canAcceptBlob) setter(nextUrl);
    };

  const setExtraDragActiveAt = (index: number, value: boolean) => {
    setExtraDragActive((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const allowImageDrag = (event: DragEvent<HTMLDivElement>) => {
    if (isImageDragTransfer(event.dataTransfer)) {
      event.preventDefault();
      return true;
    }
    return false;
  };

  const handlePrimaryDrop = (event: DragEvent<HTMLDivElement>) => {
    setPrimaryDragActive(false);
    handleImageDrop(onPrimaryImageChange)(event);
  };

  const handleExtraDrop = (index: number) => (event: DragEvent<HTMLDivElement>) => {
    setExtraDragActiveAt(index, false);
    handleImageDrop((url) => onExtraImageChange(index, url))(event);
  };

  const handlePrimaryDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (allowImageDrag(event)) {
      setPrimaryDragActive(true);
    }
  };

  const handlePrimaryDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (allowImageDrag(event)) {
      setPrimaryDragActive(true);
    }
  };

  const handlePrimaryDragLeave = () => {
    setPrimaryDragActive(false);
  };

  const handleExtraDragEnter = (index: number) => (event: DragEvent<HTMLDivElement>) => {
    if (allowImageDrag(event)) {
      setExtraDragActiveAt(index, true);
    }
  };

  const handleExtraDragOver = (index: number) => (event: DragEvent<HTMLDivElement>) => {
    if (allowImageDrag(event)) {
      setExtraDragActiveAt(index, true);
    }
  };

  const handleExtraDragLeave = (index: number) => () => {
    setExtraDragActiveAt(index, false);
  };

  const allowVideoDrag = (event: DragEvent<HTMLDivElement>) => {
    if (isVideoDragTransfer(event.dataTransfer)) {
      event.preventDefault();
      return true;
    }
    return false;
  };

  const handleMotionVideoDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setMotionVideoDragActive(false);

    const payload = extractVideoDragDropPayload(event.dataTransfer);
    let nextVideoUrl = payload.videoUrl;

    if (!nextVideoUrl && payload.referenceId && resolvePreviewUrlById) {
      const resolvedUrl = resolvePreviewUrlById(payload.referenceId);
      if (resolvedUrl && looksLikeVideoUrl(resolvedUrl)) {
        nextVideoUrl = resolvedUrl;
      }
    }

    if (nextVideoUrl) {
      onMotionVideoChange?.(nextVideoUrl);
    } else if (event.dataTransfer.files?.length) {
      const videoFile = Array.from(event.dataTransfer.files).find((f) =>
        f.type.startsWith("video/")
      );
      if (videoFile) {
        const url = URL.createObjectURL(videoFile);
        onMotionVideoChange?.(`${url}#video=1`);
      }
    }
  };

  const handleMotionVideoSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      onMotionVideoChange?.(`${url}#video=1`);
    }
    event.target.value = "";
  };

  return {
    primaryInputRef,
    extraOneInputRef,
    extraTwoInputRef,
    extraThreeInputRef,
    motionVideoInputRef,
    primaryDragActive,
    extraDragActive,
    motionVideoDragActive,
    setMotionVideoDragActive,
    collapsedSteps,
    toggleStep,
    expandIfCollapsed,
    canSwapFrames,
    handleSwapFrames,
    updateKlingMultiPrompt,
    addKlingShot,
    removeKlingShot,
    updateKlingElement,
    addKlingElement,
    removeKlingElement,
    handleFileSelection,
    handlePromptDrop,
    handlePrimaryDrop,
    handleExtraDrop,
    handlePrimaryDragEnter,
    handlePrimaryDragOver,
    handlePrimaryDragLeave,
    handleExtraDragEnter,
    handleExtraDragOver,
    handleExtraDragLeave,
    allowVideoDrag,
    handleMotionVideoDrop,
    handleMotionVideoSelection,
  };
};
