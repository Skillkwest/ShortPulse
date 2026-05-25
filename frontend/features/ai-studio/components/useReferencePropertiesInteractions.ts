/**
 * Interaction hook for AI Studio reference properties UI.
 * Centralizes collapse state, drag/drop handling, and Kling list mutations.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import {
  extractDragDropPayload,
  extractInternalReferenceDragPayload,
  extractVideoDragDropPayload,
  isImageDragTransfer,
  isVideoDragTransfer,
  looksLikeImageUrl,
  looksLikeVideoUrl,
} from "../utils/dragDrop";
import { createEmptyAiStudioKlingElement, type AiStudioKlingElement } from "../logic/klingElements";
import { forgetObjectUrlBlob, rememberObjectUrlBlob } from "../utils/objectUrlBlobRegistry";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";

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

type KlingElement = AiStudioKlingElement;

type UseReferencePropertiesInteractionsParams = {
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  onPrimaryImageChange: (url: string | null) => void;
  onExtraImageChange: (index: number, url: string | null) => void;
  onPromptTextChange: (value: string) => void;
  onMotionVideoChange?: (url: string | null) => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  resolveInternalReferenceImageDropSource?: ResolveInternalReferenceDrop;
  klingMultiPrompts: KlingMultiPrompt[];
  onKlingMultiPromptsChange?: (value: KlingMultiPrompt[]) => void;
  klingElements: KlingElement[];
  onKlingElementsChange?: (value: KlingElement[]) => void;
};

const VIDEO_BLOB_MARKER = "#video=1";

const isLocalMemoryVideoUrl = (value: string | null | undefined): value is string => {
  if (!value) return false;
  return value.startsWith("blob:") || /^data:video\//i.test(value);
};

const stripVideoBlobMarker = (value: string): string => value.replace(/#video=1$/i, "");

const ensureVideoBlobMarker = (value: string): string => {
  if (!value.startsWith("blob:")) return value;
  const base = stripVideoBlobMarker(value);
  return `${base}${VIDEO_BLOB_MARKER}`;
};

const cloneMotionBlobVideoUrl = async (value: string): Promise<string | null> => {
  if (!value.startsWith("blob:")) return null;
  try {
    const source = stripVideoBlobMarker(value);
    const response = await fetch(source);
    if (!response.ok) return null;
    const blob = await response.blob();
    return `${URL.createObjectURL(blob)}${VIDEO_BLOB_MARKER}`;
  } catch {
    return null;
  }
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
  resolveInternalReferenceImageDropSource,
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
  const ownedImageObjectUrlsRef = useRef<Set<string>>(new Set());
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
    if (klingElements.length >= 3) return;
    onKlingElementsChange?.([...klingElements, createEmptyAiStudioKlingElement()]);
  };

  const removeKlingElement = (id: string) => {
    onKlingElementsChange?.(klingElements.filter((item) => item.id !== id));
  };

  const releaseOwnedImageObjectUrl = useCallback((url: string) => {
    if (!ownedImageObjectUrlsRef.current.has(url)) return;
    ownedImageObjectUrlsRef.current.delete(url);
    forgetObjectUrlBlob(url);
    URL.revokeObjectURL(url);
  }, []);

  const trackOwnedImageObjectUrl = (url: string, blob?: Blob) => {
    if (!url.startsWith("blob:")) return url;
    if (blob) {
      rememberObjectUrlBlob(url, blob);
    }
    ownedImageObjectUrlsRef.current.add(url);
    return url;
  };

  const stabilizeDroppedImageUrl = async ({
    imageUrl,
    fromFile,
    sourceBlob,
  }: {
    imageUrl: string;
    fromFile: boolean;
    sourceBlob?: Blob | null;
  }): Promise<string | null> => {
    if (!imageUrl.startsWith("blob:")) return imageUrl;
    if (fromFile) {
      trackOwnedImageObjectUrl(imageUrl, sourceBlob ?? undefined);
      return imageUrl;
    }
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) return null;
      const blob = await response.blob();
      const clonedUrl = URL.createObjectURL(blob);
      return trackOwnedImageObjectUrl(clonedUrl, blob);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const activeBlobUrls = new Set(
      [referenceImageUrl, ...extraImageUrls].filter(
        (value): value is string => typeof value === "string" && value.startsWith("blob:")
      )
    );
    Array.from(ownedImageObjectUrlsRef.current).forEach((url) => {
      if (!activeBlobUrls.has(url)) {
        releaseOwnedImageObjectUrl(url);
      }
    });
  }, [extraImageUrls, referenceImageUrl, releaseOwnedImageObjectUrl]);

  useEffect(
    () => () => {
      Array.from(ownedImageObjectUrlsRef.current).forEach((url) => {
        releaseOwnedImageObjectUrl(url);
      });
    },
    [releaseOwnedImageObjectUrl]
  );

  const handleFileSelection =
    (setter: (url: string | null) => void) => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        event.target.value = "";
        return;
      }
      const url = URL.createObjectURL(file);
      setter(trackOwnedImageObjectUrl(url, file));
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
    (setter: (url: string | null) => void) => async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const internalPayload = extractInternalReferenceDragPayload(event.dataTransfer);
      const { imageUrl, imageFile, fromFile, referenceId, mediaKind } = extractDragDropPayload(
        event.dataTransfer
      );
      if (mediaKind && mediaKind !== "image") return;
      let nextUrl: string | null = null;

      if (internalPayload && resolveInternalReferenceImageDropSource) {
        const resolvedSource = await resolveInternalReferenceImageDropSource(internalPayload).catch(
          () => null
        );
        nextUrl =
          resolvedSource?.preparedImageUrl?.trim() || resolvedSource?.preview.url?.trim() || null;
      }

      if (!nextUrl) {
        nextUrl =
          (internalPayload?.referenceUrl && looksLikeImageUrl(internalPayload.referenceUrl)
            ? internalPayload.referenceUrl
            : null) ?? imageUrl;
      }

      if ((!nextUrl || nextUrl.startsWith("blob:")) && referenceId && resolvePreviewUrlById) {
        nextUrl = resolvePreviewUrlById(referenceId) ?? nextUrl;
      }

      if (!nextUrl) return;
      if (!looksLikeImageUrl(nextUrl)) return;

      const isBlobUrl = nextUrl.startsWith("blob:");
      const canAcceptBlob = fromFile || Boolean(referenceId);

      if (!isBlobUrl || canAcceptBlob) {
        const stableUrl = isBlobUrl
          ? await stabilizeDroppedImageUrl({
              imageUrl: nextUrl,
              fromFile: Boolean(fromFile),
              sourceBlob: imageFile ?? null,
            })
          : nextUrl;
        if (!stableUrl) return;
        setter(stableUrl);
      }
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

  const handleMotionVideoDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setMotionVideoDragActive(false);

    const payload = extractVideoDragDropPayload(event.dataTransfer);
    let nextVideoUrl = payload.videoUrl;

    if (
      (!nextVideoUrl || isLocalMemoryVideoUrl(nextVideoUrl)) &&
      payload.referenceId &&
      resolvePreviewUrlById
    ) {
      const resolvedUrl = resolvePreviewUrlById(payload.referenceId);
      if (resolvedUrl && looksLikeVideoUrl(resolvedUrl)) {
        nextVideoUrl = resolvedUrl;
      }
    }

    if (nextVideoUrl && nextVideoUrl.startsWith("blob:")) {
      const stabilized = await cloneMotionBlobVideoUrl(nextVideoUrl);
      nextVideoUrl = stabilized ?? ensureVideoBlobMarker(nextVideoUrl);
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
