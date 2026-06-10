/**
 * Interaction hook for AI Studio reference properties UI.
 * Centralizes collapse state, drag/drop handling, and Kling list mutations.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, RefObject } from "react";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { INTERNAL_MEDIA_REF_BUCKET } from "../../../lib/media/internalMediaRefs";
import type { AgentComposerDirectDropPayload } from "../logic/agentComposerDirectDropPayload";
import { readMediaLibraryDragPayload } from "../logic/mediaLibraryDragPayload";
import {
  extractDragDropPayload,
  extractPromptDropText,
  extractInternalReferenceDragPayload,
  extractVideoDragDropPayload,
  isImageDragTransfer,
  isImageFile,
  isVideoFile,
  isVideoDragTransfer,
  looksLikeImageUrl,
  looksLikeVideoUrl,
} from "../utils/dragDrop";
import {
  createEmptyAiStudioKlingElement,
  getAiStudioKlingElementReferenceUrls,
  type AiStudioKlingElement,
} from "../logic/klingElements";
import { forgetObjectUrlBlob, rememberObjectUrlBlob } from "../utils/objectUrlBlobRegistry";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";
import {
  createInternalMediaRefFromResolvedSource,
  registerInternalMediaRefForUrl,
} from "../logic/referenceInputInternalMediaRegistry";
import {
  prepareLocalImageBlobForEditIngress,
  prepareLocalImageFileForEditIngress,
} from "../logic/editImageIngress";

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

type ReferenceImageDropSnapshot = {
  internalPayload: ReturnType<typeof extractInternalReferenceDragPayload> | null;
  imageUrl: string | null;
  imageFile?: File | null;
  fromFile?: boolean;
  referenceId?: string | null;
  mediaKind?: string | null;
};

type UseReferencePropertiesInteractionsParams = {
  referenceImageUrl: string | null;
  extraImageUrls: readonly (string | null)[];
  onPrimaryImageChange: (url: string | null) => void;
  onExtraImageChange: (index: number, url: string | null) => void;
  onPromptTextChange: (value: string) => void;
  onMotionVideoChange?: (url: string | null) => void;
  onStageMotionVideoSelection?: (input: {
    videoFile?: File | null;
    videoUrl?: string | null;
  }) => Promise<void>;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  resolveMotionVideoUrlById?: (id: string | null) => string | null;
  resolveInternalReferenceImageDropSource?: ResolveInternalReferenceDrop;
  klingMultiPrompts: KlingMultiPrompt[];
  onKlingMultiPromptsChange?: (value: KlingMultiPrompt[]) => void;
  klingElements: KlingElement[];
  onKlingElementsChange?: (value: KlingElement[]) => void;
  seedanceElementSlotCount?: number;
  onSeedanceElementImageSlotChange?: (slotIndex: number, url: string | null) => void;
};

const isLocalMemoryVideoUrl = (value: string | null | undefined): value is string => {
  if (!value) return false;
  return value.startsWith("blob:") || /^data:video\//i.test(value);
};

const reconcileBooleanListLength = (values: boolean[], length: number): boolean[] =>
  Array.from({ length }, (_, index) => values[index] ?? false);

const trimOptionalString = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
};

const resolveMotionVideoStoragePathFromInternalPayload = (
  payload: ReturnType<typeof extractInternalReferenceDragPayload> | null
): string | null => {
  if (payload?.mediaKind !== "video") return null;
  const candidates = [payload.fullStoragePath, payload.previewStoragePath];
  return candidates.find((candidate) => candidate && looksLikeVideoUrl(candidate))?.trim() ?? null;
};

const resolveMotionVideoStoragePathFromMediaLibraryPayload = (
  payload: ReturnType<typeof readMediaLibraryDragPayload> | null
): string | null => {
  if (payload?.kind !== "libraryMedia" || payload.payload.fileType !== "video") return null;
  const candidates = [payload.payload.fullStoragePath, payload.payload.previewStoragePath];
  return candidates.find((candidate) => candidate && looksLikeVideoUrl(candidate))?.trim() ?? null;
};

const resolveCanvasTearOutReferenceImageSnapshot = (
  payload: AgentComposerDirectDropPayload
): ReferenceImageDropSnapshot | null => {
  if (payload.kind !== "image") return null;
  const internalPayload = payload.internalPayload ?? null;
  const composerImagePayload = payload.composerImagePayload ?? null;
  const imageUrl =
    trimOptionalString(composerImagePayload?.displayArtifactUrl) ??
    trimOptionalString(internalPayload?.referenceRenderUrl) ??
    trimOptionalString(internalPayload?.referenceUrl);
  const referenceId =
    trimOptionalString(composerImagePayload?.referenceId) ??
    trimOptionalString(internalPayload?.referenceId) ??
    trimOptionalString(composerImagePayload?.outputId) ??
    trimOptionalString(internalPayload?.outputId) ??
    trimOptionalString(composerImagePayload?.mediaId) ??
    trimOptionalString(internalPayload?.mediaId);
  return {
    internalPayload,
    imageUrl,
    referenceId,
    mediaKind: internalPayload?.mediaKind ?? null,
  };
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
  onStageMotionVideoSelection,
  resolvePreviewUrlById,
  resolveMotionVideoUrlById,
  resolveInternalReferenceImageDropSource,
  klingMultiPrompts,
  onKlingMultiPromptsChange,
  klingElements,
  onKlingElementsChange,
  seedanceElementSlotCount = 0,
  onSeedanceElementImageSlotChange,
}: UseReferencePropertiesInteractionsParams) => {
  const primaryInputRef = useRef<HTMLInputElement | null>(null);
  const extraInputRefsRef = useRef<RefObject<HTMLInputElement | null>[]>([]);
  while (extraInputRefsRef.current.length < Math.max(3, extraImageUrls.length)) {
    extraInputRefsRef.current.push({ current: null });
  }
  const inputRefs = extraInputRefsRef.current.slice(0, Math.max(3, extraImageUrls.length));
  const extraOneInputRef = inputRefs[0] ?? { current: null };
  const extraTwoInputRef = inputRefs[1] ?? { current: null };
  const extraThreeInputRef = inputRefs[2] ?? { current: null };
  const motionVideoInputRef = useRef<HTMLInputElement | null>(null);
  const seedanceElementImageInputRefsRef = useRef<Array<{ current: HTMLInputElement | null }>>([]);
  while (seedanceElementImageInputRefsRef.current.length < seedanceElementSlotCount) {
    seedanceElementImageInputRefsRef.current.push({ current: null });
  }
  const seedanceElementImageInputRefs = seedanceElementImageInputRefsRef.current.slice(
    0,
    seedanceElementSlotCount
  );
  const ownedImageObjectUrlsRef = useRef<Set<string>>(new Set());
  const pendingCommittedImageObjectUrlsRef = useRef<Set<string>>(new Set());
  const makeId = () => `kling-${Math.random().toString(36).slice(2, 9)}`;

  const [primaryDragActive, setPrimaryDragActive] = useState(false);
  const [extraDragActive, setExtraDragActive] = useState([false, false, false]);
  const [primaryImageLoading, setPrimaryImageLoading] = useState(false);
  const [extraImageLoading, setExtraImageLoading] = useState([false, false, false]);
  const [seedanceElementImageDragActive, setSeedanceElementImageDragActive] = useState<boolean[]>(
    []
  );
  const [seedanceElementImageLoading, setSeedanceElementImageLoading] = useState<boolean[]>([]);
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

  useEffect(() => {
    setExtraDragActive((prev) => reconcileBooleanListLength(prev, inputRefs.length));
    setExtraImageLoading((prev) => reconcileBooleanListLength(prev, inputRefs.length));
  }, [inputRefs.length]);

  useEffect(() => {
    setSeedanceElementImageDragActive((prev) =>
      reconcileBooleanListLength(prev, seedanceElementSlotCount)
    );
    setSeedanceElementImageLoading((prev) =>
      reconcileBooleanListLength(prev, seedanceElementSlotCount)
    );
  }, [seedanceElementSlotCount]);

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

  const commitImageUrl = (setter: (url: string | null) => void, url: string | null) => {
    if (url?.startsWith("blob:")) {
      pendingCommittedImageObjectUrlsRef.current.add(url);
    }
    setter(url);
  };

  const commitMotionVideoUrl = useCallback(
    (url: string | null) => {
      onMotionVideoChange?.(url);
    },
    [onMotionVideoChange]
  );

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
      if (sourceBlob instanceof File) {
        const prepared = await prepareLocalImageFileForEditIngress(sourceBlob);
        URL.revokeObjectURL(imageUrl);
        return trackOwnedImageObjectUrl(prepared.url, prepared.blob);
      }
      trackOwnedImageObjectUrl(imageUrl, sourceBlob ?? undefined);
      return imageUrl;
    }
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) return null;
      const blob = await response.blob();
      const prepared = await prepareLocalImageBlobForEditIngress(blob);
      return trackOwnedImageObjectUrl(prepared.url, prepared.blob);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const klingElementBlobUrls = klingElements.flatMap((element) => [
      element.profileImageUrl ?? "",
      ...getAiStudioKlingElementReferenceUrls(element),
    ]);
    const propBlobUrls = new Set(
      [referenceImageUrl, ...extraImageUrls, ...klingElementBlobUrls].filter(
        (value): value is string => typeof value === "string" && value.startsWith("blob:")
      )
    );
    propBlobUrls.forEach((url) => {
      pendingCommittedImageObjectUrlsRef.current.delete(url);
    });
    const activeBlobUrls = new Set([
      ...propBlobUrls,
      ...pendingCommittedImageObjectUrlsRef.current,
    ]);
    Array.from(ownedImageObjectUrlsRef.current).forEach((url) => {
      if (!activeBlobUrls.has(url)) {
        releaseOwnedImageObjectUrl(url);
      }
    });
  }, [extraImageUrls, klingElements, referenceImageUrl, releaseOwnedImageObjectUrl]);

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
      if (!isImageFile(file)) {
        event.target.value = "";
        return;
      }
      void (async () => {
        try {
          const prepared = await prepareLocalImageFileForEditIngress(file);
          commitImageUrl(setter, trackOwnedImageObjectUrl(prepared.url, prepared.blob));
        } catch (error) {
          console.error("AI Studio reference image file ingress failed:", error);
        }
      })();
      event.target.value = "";
    };

  const handlePromptDrop = (event: DragEvent<HTMLDivElement | HTMLTextAreaElement>) => {
    event.preventDefault();
    const promptText = extractPromptDropText(event.dataTransfer);
    if (promptText) {
      onPromptTextChange(promptText);
    }
  };

  const acceptImageDropSnapshot = async (
    snapshot: ReferenceImageDropSnapshot,
    setter: (url: string | null) => void,
    setLoading: (value: boolean) => void
  ) => {
    const { internalPayload, imageUrl, imageFile, fromFile, referenceId, mediaKind } = snapshot;
    const effectiveMediaKind = internalPayload?.mediaKind ?? mediaKind ?? null;
    let nextUrl: string | null = null;
    let resolvedInternalMediaRef = null;
    let didSetLoading = false;

    try {
      if (internalPayload) {
        if (effectiveMediaKind && effectiveMediaKind !== "image") {
          return;
        }
        setLoading(true);
        didSetLoading = true;
        const resolvedSource = resolveInternalReferenceImageDropSource
          ? await resolveInternalReferenceImageDropSource(internalPayload).catch(() => null)
          : null;
        resolvedInternalMediaRef = resolvedSource
          ? createInternalMediaRefFromResolvedSource(resolvedSource)
          : null;
        if (resolveInternalReferenceImageDropSource && !resolvedSource) {
          return;
        }
        nextUrl =
          resolvedSource?.preparedImageUrl?.trim() || resolvedSource?.preview.url?.trim() || null;
        if (!nextUrl) {
          return;
        }
      } else if (effectiveMediaKind && effectiveMediaKind !== "image") {
        return;
      }

      if (!nextUrl) {
        nextUrl =
          (internalPayload?.referenceUrl && looksLikeImageUrl(internalPayload.referenceUrl)
            ? internalPayload.referenceUrl
            : null) ?? imageUrl;
      }

      if (
        !internalPayload &&
        (!nextUrl || nextUrl.startsWith("blob:")) &&
        referenceId &&
        resolvePreviewUrlById
      ) {
        nextUrl = resolvePreviewUrlById(referenceId) ?? nextUrl;
      }

      if (!nextUrl) return;
      if (!looksLikeImageUrl(nextUrl)) return;

      if (!internalPayload) {
        setLoading(true);
        didSetLoading = true;
      }

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
        registerInternalMediaRefForUrl(stableUrl, resolvedInternalMediaRef);
        commitImageUrl(setter, stableUrl);
      }
    } catch (error) {
      console.error("AI Studio reference image drop ingress failed:", error);
    } finally {
      if (didSetLoading) {
        setLoading(false);
      }
    }
  };

  const handleImageDrop =
    (setter: (url: string | null) => void, setLoading: (value: boolean) => void) =>
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const internalPayload = extractInternalReferenceDragPayload(event.dataTransfer);
      const { imageUrl, imageFile, fromFile, referenceId, mediaKind } = extractDragDropPayload(
        event.dataTransfer
      );
      await acceptImageDropSnapshot(
        { internalPayload, imageUrl, imageFile, fromFile, referenceId, mediaKind },
        setter,
        setLoading
      );
    };

  const setExtraDragActiveAt = (index: number, value: boolean) => {
    setExtraDragActive((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const setExtraImageLoadingAt = (index: number, value: boolean) => {
    setExtraImageLoading((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const setSeedanceElementImageDragActiveAt = (index: number, value: boolean) => {
    setSeedanceElementImageDragActive((prev) =>
      reconcileBooleanListLength(prev, seedanceElementSlotCount).map((item, idx) =>
        idx === index ? value : item
      )
    );
  };

  const setSeedanceElementImageLoadingAt = (index: number, value: boolean) => {
    setSeedanceElementImageLoading((prev) =>
      reconcileBooleanListLength(prev, seedanceElementSlotCount).map((item, idx) =>
        idx === index ? value : item
      )
    );
  };

  const acceptPrimaryCanvasTearOutPayload = (payload: AgentComposerDirectDropPayload) => {
    const snapshot = resolveCanvasTearOutReferenceImageSnapshot(payload);
    if (!snapshot) return;
    setPrimaryDragActive(false);
    void acceptImageDropSnapshot(snapshot, onPrimaryImageChange, setPrimaryImageLoading);
  };

  const acceptExtraCanvasTearOutPayload = (
    index: number,
    payload: AgentComposerDirectDropPayload
  ) => {
    const snapshot = resolveCanvasTearOutReferenceImageSnapshot(payload);
    if (!snapshot) return;
    setExtraDragActiveAt(index, false);
    void acceptImageDropSnapshot(
      snapshot,
      (url) => onExtraImageChange(index, url),
      (value) => setExtraImageLoadingAt(index, value)
    );
  };

  const acceptSeedanceElementImageCanvasTearOutPayload = (
    index: number,
    payload: AgentComposerDirectDropPayload
  ) => {
    const snapshot = resolveCanvasTearOutReferenceImageSnapshot(payload);
    if (!snapshot || !onSeedanceElementImageSlotChange) return;
    setSeedanceElementImageDragActiveAt(index, false);
    void acceptImageDropSnapshot(
      snapshot,
      (url) => onSeedanceElementImageSlotChange(index, url),
      (value) => setSeedanceElementImageLoadingAt(index, value)
    );
  };

  const acceptMotionVideoCanvasTearOutPayload = (payload: AgentComposerDirectDropPayload) => {
    if (payload.kind !== "video") return;
    setMotionVideoDragActive(false);
    if (onStageMotionVideoSelection) {
      void onStageMotionVideoSelection?.({ videoUrl: payload.videoUrl });
      return;
    }
    commitMotionVideoUrl(payload.videoUrl);
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
    return handleImageDrop(onPrimaryImageChange, setPrimaryImageLoading)(event);
  };

  const handleExtraDrop = (index: number) => (event: DragEvent<HTMLDivElement>) => {
    setExtraDragActiveAt(index, false);
    return handleImageDrop(
      (url) => onExtraImageChange(index, url),
      (value) => setExtraImageLoadingAt(index, value)
    )(event);
  };

  const handleSeedanceElementImageFileSelection = (index: number) =>
    handleFileSelection((url) => onSeedanceElementImageSlotChange?.(index, url));

  const handleSeedanceElementImageDrop = (index: number) => (event: DragEvent<HTMLDivElement>) => {
    setSeedanceElementImageDragActiveAt(index, false);
    if (!onSeedanceElementImageSlotChange) return;
    return handleImageDrop(
      (url) => onSeedanceElementImageSlotChange(index, url),
      (value) => setSeedanceElementImageLoadingAt(index, value)
    )(event);
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

  const handleSeedanceElementImageDragEnter =
    (index: number) => (event: DragEvent<HTMLDivElement>) => {
      if (allowImageDrag(event)) {
        setSeedanceElementImageDragActiveAt(index, true);
      }
    };

  const handleSeedanceElementImageDragOver =
    (index: number) => (event: DragEvent<HTMLDivElement>) => {
      if (allowImageDrag(event)) {
        setSeedanceElementImageDragActiveAt(index, true);
      }
    };

  const handleSeedanceElementImageDragLeave = (index: number) => () => {
    setSeedanceElementImageDragActiveAt(index, false);
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

    const internalPayload = extractInternalReferenceDragPayload(event.dataTransfer);
    const mediaLibraryPayload = readMediaLibraryDragPayload(event.dataTransfer);
    const payload = extractVideoDragDropPayload(event.dataTransfer);
    let nextVideoUrl = payload.videoUrl;
    const nextVideoFile =
      payload.videoFile ?? Array.from(event.dataTransfer.files ?? []).find(isVideoFile) ?? null;

    if (
      (!nextVideoUrl || isLocalMemoryVideoUrl(nextVideoUrl)) &&
      payload.referenceId &&
      (resolveMotionVideoUrlById || resolvePreviewUrlById)
    ) {
      const resolvedUrl =
        resolveMotionVideoUrlById?.(payload.referenceId) ??
        resolvePreviewUrlById?.(payload.referenceId) ??
        null;
      if (resolvedUrl && looksLikeVideoUrl(resolvedUrl)) {
        nextVideoUrl = resolvedUrl;
      }
    }

    if (!nextVideoUrl) {
      const storagePath =
        resolveMotionVideoStoragePathFromInternalPayload(internalPayload) ??
        resolveMotionVideoStoragePathFromMediaLibraryPayload(mediaLibraryPayload);
      if (storagePath) {
        const signedVideoUrl = await getSignedMediaUrl({
          bucket: INTERNAL_MEDIA_REF_BUCKET,
          storagePath,
          previewProfile: "none",
        }).catch(() => null);
        if (signedVideoUrl && looksLikeVideoUrl(signedVideoUrl)) {
          nextVideoUrl = signedVideoUrl;
        }
      }
    }

    if (nextVideoFile) {
      await onStageMotionVideoSelection?.({ videoFile: nextVideoFile });
      return;
    }

    if (nextVideoUrl && (onStageMotionVideoSelection || isLocalMemoryVideoUrl(nextVideoUrl))) {
      await onStageMotionVideoSelection?.({ videoUrl: nextVideoUrl });
      if (onStageMotionVideoSelection) {
        return;
      }
    }

    if (nextVideoUrl && isLocalMemoryVideoUrl(nextVideoUrl)) {
      return;
    }

    if (nextVideoUrl) {
      commitMotionVideoUrl(nextVideoUrl);
    }
  };

  const handleMotionVideoSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (isVideoFile(file)) {
      await onStageMotionVideoSelection?.({ videoFile: file });
    }
    event.target.value = "";
  };

  return {
    primaryInputRef,
    inputRefs,
    extraOneInputRef,
    extraTwoInputRef,
    extraThreeInputRef,
    motionVideoInputRef,
    seedanceElementImageInputRefs,
    primaryDragActive,
    extraDragActive,
    seedanceElementImageDragActive,
    primaryImageLoading,
    extraImageLoading,
    seedanceElementImageLoading,
    setSeedanceElementImageDragActiveAt,
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
    handleSeedanceElementImageFileSelection,
    handleSeedanceElementImageDrop,
    handleSeedanceElementImageDragEnter,
    handleSeedanceElementImageDragOver,
    handleSeedanceElementImageDragLeave,
    acceptPrimaryCanvasTearOutPayload,
    acceptExtraCanvasTearOutPayload,
    acceptSeedanceElementImageCanvasTearOutPayload,
    acceptMotionVideoCanvasTearOutPayload,
    allowVideoDrag,
    handleMotionVideoDrop,
    handleMotionVideoSelection,
  };
};
