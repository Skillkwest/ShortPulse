/**
 * Interaction hook for AI Studio reference properties UI.
 * Centralizes collapse state, drag/drop handling, and Kling list mutations.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, RefObject } from "react";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { AgentComposerDirectDropPayload } from "../logic/agentComposerDirectDropPayload";
import {
  buildAiStudioDropSnapshotTransfer,
  captureAiStudioDropSnapshot,
} from "../logic/aiStudioDropSnapshot";
import {
  resolveMotionReferenceVideoDropSource,
  resolveMotionReferenceVideoDropSourceFromPayload,
} from "../logic/motionReferenceVideoDropSource";
import {
  resolveLipSyncAudioDropSource,
  resolveLipSyncAudioDropSourceFromPayload,
} from "../logic/lipSyncAudioDropSource";
import {
  extractDragDropPayload,
  extractComposerImageDropPayload,
  extractPromptDropText,
  extractInternalReferenceDragPayload,
  isAudioDragTransfer,
  isAudioFile,
  isImageDragTransfer,
  isImageFile,
  isVideoFile,
  isVideoDragTransfer,
  looksLikeImageUrl,
} from "../utils/dragDrop";
import {
  resolveDroppedPromptTextEdit,
  resolveDroppedPromptTextEditMode,
  useAgentComposerPromptDropModifierTracking,
} from "./promptStep/agentComposerDrop";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import {
  createInternalMediaRef,
  INTERNAL_MEDIA_REF_BUCKET,
} from "../../../lib/media/internalMediaRefs";
import { readMediaLibraryDragPayload } from "../logic/mediaLibraryDragPayload";
import {
  createEmptyAiStudioKlingElement,
  getAiStudioKlingElementReferenceUrls,
  type AiStudioKlingElement,
} from "../logic/klingElements";
import {
  forgetObjectUrlBlob,
  readRememberedObjectUrlBlob,
  rememberObjectUrlBlob,
} from "../utils/objectUrlBlobRegistry";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";
import {
  registerInternalMediaRefForUrl,
  resolveInternalMediaRefForUrl,
} from "../logic/referenceInputInternalMediaRegistry";
import {
  prepareLocalImageBlobForEditIngress,
  prepareLocalImageFileForEditIngress,
} from "../logic/editImageIngress";
import {
  uploadImageAssetToStorage,
  uploadImageBlobAssetToStorage,
  type ImageUploadResponse,
} from "../utils/imageUpload";
import {
  uploadReferenceVideoAssetToStorage,
  uploadReferenceVideoFileToStorage,
  type VideoUploadResult,
} from "../utils/videoUpload";
import { uploadAudioBlobToStorage, type AudioUploadResult } from "../utils/audioUpload";

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
  mediaId?: string | null;
  mediaKind?: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  displayPreviewUrl?: string | null;
  preferLocalRenderArtifact?: boolean;
};

type ImageDisplayPreviewEntry = {
  sourceUrl: string;
  displayUrl: string;
  ownsObjectUrl: boolean;
};

type ServerCopiedMediaResponse = {
  storagePath?: unknown;
  fileSize?: unknown;
  delivery?: {
    previewUrl?: unknown;
    fullUrl?: unknown;
  } | null;
};

type UseReferencePropertiesInteractionsParams = {
  interactionScope?: "full" | "image";
  referenceImageUrl: string | null;
  extraImageUrls: readonly (string | null)[];
  onPrimaryImageChange: (url: string | null) => void;
  onExtraImageChange: (index: number, url: string | null) => void;
  onPromptTextChange: (value: string) => void;
  stagePrimaryImageForProviderAccess?: boolean;
  onMotionVideoChange?: (url: string | null) => void;
  onStageMotionVideoSelection?: (input: {
    videoFile?: File | null;
    videoUrl?: string | null;
  }) => Promise<void>;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  resolveMotionVideoUrlById?: (id: string | null) => string | null;
  resolveInternalReferenceImageDropSource?: ResolveInternalReferenceDrop;
  resolveInternalReferenceVideoDropSource?: ResolveInternalReferenceDrop;
  klingMultiPrompts: KlingMultiPrompt[];
  onKlingMultiPromptsChange?: (value: KlingMultiPrompt[]) => void;
  klingElements: KlingElement[];
  onKlingElementsChange?: (value: KlingElement[]) => void;
  seedanceElementSlotCount?: number;
  onSeedanceElementMediaSlotChange?: (
    slotIndex: number,
    value: { kind: "image" | "video" | "audio"; url: string; name?: string | null } | null
  ) => void;
};

const reconcileBooleanListLength = (values: boolean[], length: number): boolean[] =>
  Array.from({ length }, (_, index) => values[index] ?? false);

const trimOptionalString = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
};

const isLocalRenderArtifactUrl = (value: string | null | undefined): boolean => {
  const trimmed = value?.trim() ?? "";
  return trimmed.startsWith("blob:") || trimmed.startsWith("data:image/");
};

const IMAGE_STORAGE_PATH_PATTERN = /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)(?:$|[?#])/i;
const NON_IMAGE_STORAGE_PATH_PATTERN =
  /\.(?:aac|flac|m4a|m4v|mov|mp3|mp4|oga|ogg|ogv|wav|webm)(?:$|[?#])/i;

const isImageStoragePath = (value: string | null | undefined): boolean =>
  Boolean(value && IMAGE_STORAGE_PATH_PATTERN.test(value.trim()));

const isKnownNonImageStoragePath = (value: string | null | undefined): boolean =>
  Boolean(value && NON_IMAGE_STORAGE_PATH_PATTERN.test(value.trim()));

const resolveImageStoragePath = ({
  fullStoragePath,
  previewStoragePath,
  mediaKind,
}: {
  fullStoragePath?: string | null;
  previewStoragePath?: string | null;
  mediaKind?: string | null;
}): string | null => {
  const fullPath = trimOptionalString(fullStoragePath);
  const previewPath = trimOptionalString(previewStoragePath);
  if (!fullPath) return previewPath;
  if (!previewPath) return isKnownNonImageStoragePath(fullPath) ? null : fullPath;
  if (mediaKind && mediaKind !== "image") {
    return isImageStoragePath(previewPath) ? previewPath : null;
  }
  if (isKnownNonImageStoragePath(fullPath) && isImageStoragePath(previewPath)) return previewPath;
  return fullPath;
};

const createImageSlotInternalMediaRef = ({
  fullStoragePath,
  previewStoragePath,
  mediaId,
  mediaKind,
}: {
  fullStoragePath?: string | null;
  previewStoragePath?: string | null;
  mediaId?: string | null;
  mediaKind?: string | null;
}) => {
  const storagePath = resolveImageStoragePath({
    fullStoragePath,
    previewStoragePath,
    mediaKind,
  });
  if (!storagePath) return null;
  return createInternalMediaRef({
    bucket: INTERNAL_MEDIA_REF_BUCKET,
    storagePath,
    mediaFileId: mediaId ?? null,
  });
};

const createUploadedImageInternalMediaRef = (uploaded: ImageUploadResponse) =>
  createInternalMediaRef({
    bucket: INTERNAL_MEDIA_REF_BUCKET,
    storagePath: uploaded.path,
  });

const createUploadedVideoInternalMediaRef = (uploaded: VideoUploadResult) =>
  createInternalMediaRef({
    bucket: INTERNAL_MEDIA_REF_BUCKET,
    storagePath: uploaded.path,
  });

const createUploadedAudioInternalMediaRef = (uploaded: AudioUploadResult) =>
  createInternalMediaRef({
    bucket: INTERNAL_MEDIA_REF_BUCKET,
    storagePath: uploaded.path,
  });

const isHttpImageSourceUrl = (value: string): boolean => /^https?:\/\//i.test(value.trim());
const isHttpMediaSourceUrl = (value: string): boolean => /^https?:\/\//i.test(value.trim());

const EDIT_SECONDARY_DISPLAY_PREVIEW_LONG_EDGE_PX = 224;
const EDIT_SECONDARY_DISPLAY_PREVIEW_QUALITY = 0.82;
const EDIT_SECONDARY_DISPLAY_PREVIEW_LOAD_TIMEOUT_MS = 250;

const loadImageElementFromObjectUrl = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const timeoutId = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error("Timed out while loading display preview image."));
    }, EDIT_SECONDARY_DISPLAY_PREVIEW_LOAD_TIMEOUT_MS);
    image.onload = () => {
      window.clearTimeout(timeoutId);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error("Unable to load display preview image."));
    };
    image.src = src;
  });

const resolveBlobImageSource = async (
  blob: Blob
): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
} | null> => {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap,
        width: Math.max(1, Math.round(bitmap.width)),
        height: Math.max(1, Math.round(bitmap.height)),
        release: () => bitmap.close(),
      };
    } catch {
      // Fall back to image-element loading below.
    }
  }

  let objectUrl: string | null = URL.createObjectURL(blob);
  const releaseObjectUrl = () => {
    if (!objectUrl) return;
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  };
  try {
    const image = await loadImageElementFromObjectUrl(objectUrl);
    return {
      source: image,
      width: Math.max(1, Math.round(image.naturalWidth || image.width || 1)),
      height: Math.max(1, Math.round(image.naturalHeight || image.height || 1)),
      release: releaseObjectUrl,
    };
  } catch {
    releaseObjectUrl();
    return null;
  }
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> =>
  new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    } catch {
      resolve(null);
    }
  });

const createSmallImageDisplayPreviewUrl = async (blob: Blob | null): Promise<string | null> => {
  if (!blob || typeof document === "undefined") return null;
  if (!blob.type.toLowerCase().startsWith("image/")) return null;
  const resolved = await resolveBlobImageSource(blob);
  if (!resolved) return null;
  try {
    const longEdge = Math.max(resolved.width, resolved.height);
    const scale = Math.min(1, EDIT_SECONDARY_DISPLAY_PREVIEW_LONG_EDGE_PX / longEdge);
    const width = Math.max(1, Math.round(resolved.width * scale));
    const height = Math.max(1, Math.round(resolved.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(resolved.source, 0, 0, width, height);
    const previewBlob =
      (await canvasToBlob(canvas, "image/webp", EDIT_SECONDARY_DISPLAY_PREVIEW_QUALITY)) ??
      (await canvasToBlob(canvas, "image/jpeg", EDIT_SECONDARY_DISPLAY_PREVIEW_QUALITY));
    return previewBlob ? URL.createObjectURL(previewBlob) : null;
  } finally {
    resolved.release();
  }
};

const copyRemoteImageToStorage = async (sourceUrl: string): Promise<ImageUploadResponse> => {
  const response = await fetchWithAuth("/api/media/copy-from-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: sourceUrl,
      mode: "image",
      source: "upload",
      fileTypeHint: "image",
      metadata: {
        ai_studio_reference_provider_staging: true,
      },
    }),
    shortpulseLogScope: "generation",
  });
  const payload = (await response.json().catch(() => null)) as ServerCopiedMediaResponse | null;
  if (!response.ok) {
    throw new Error(
      typeof (payload as { error?: unknown } | null)?.error === "string"
        ? (payload as { error: string }).error
        : "Unable to copy remote reference image."
    );
  }
  const path = typeof payload?.storagePath === "string" ? payload.storagePath.trim() : "";
  const delivery = payload?.delivery ?? null;
  const url =
    typeof delivery?.previewUrl === "string" && delivery.previewUrl.trim()
      ? delivery.previewUrl.trim()
      : typeof delivery?.fullUrl === "string" && delivery.fullUrl.trim()
        ? delivery.fullUrl.trim()
        : "";
  if (!path || !url) {
    throw new Error("Remote reference image copy did not return durable media.");
  }
  return {
    url,
    path,
    size: typeof payload?.fileSize === "number" ? payload.fileSize : 0,
  };
};

const copyRemoteSeedanceMediaToStorage = async (
  sourceUrl: string,
  mediaKind: "video" | "audio"
): Promise<VideoUploadResult | AudioUploadResult> => {
  const response = await fetchWithAuth("/api/media/copy-from-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: sourceUrl,
      mode: mediaKind,
      source: "upload",
      fileTypeHint: mediaKind,
      metadata: {
        ai_studio_reference_provider_staging: true,
      },
    }),
    shortpulseLogScope: "generation",
  });
  const payload = (await response.json().catch(() => null)) as ServerCopiedMediaResponse | null;
  if (!response.ok) {
    throw new Error(
      typeof (payload as { error?: unknown } | null)?.error === "string"
        ? (payload as { error: string }).error
        : `Unable to copy remote reference ${mediaKind}.`
    );
  }
  const path = typeof payload?.storagePath === "string" ? payload.storagePath.trim() : "";
  const delivery = payload?.delivery ?? null;
  const url =
    typeof delivery?.fullUrl === "string" && delivery.fullUrl.trim()
      ? delivery.fullUrl.trim()
      : typeof delivery?.previewUrl === "string" && delivery.previewUrl.trim()
        ? delivery.previewUrl.trim()
        : "";
  if (!path || !url) {
    throw new Error(`Remote reference ${mediaKind} copy did not return durable media.`);
  }
  return {
    url,
    path,
    size: typeof payload?.fileSize === "number" ? payload.fileSize : 0,
  };
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
    displayPreviewUrl: trimOptionalString(composerImagePayload?.displayArtifactUrl),
    preferLocalRenderArtifact: Boolean(composerImagePayload?.displayArtifactUrl),
  };
};

/**
 * Returns UI interaction state and handlers for reference properties editing.
 */
export const useReferencePropertiesInteractions = ({
  interactionScope = "full",
  referenceImageUrl,
  extraImageUrls,
  onPrimaryImageChange,
  onExtraImageChange,
  onPromptTextChange,
  stagePrimaryImageForProviderAccess = false,
  onMotionVideoChange,
  onStageMotionVideoSelection,
  resolvePreviewUrlById,
  resolveMotionVideoUrlById,
  resolveInternalReferenceImageDropSource,
  resolveInternalReferenceVideoDropSource,
  klingMultiPrompts,
  onKlingMultiPromptsChange,
  klingElements,
  onKlingElementsChange,
  seedanceElementSlotCount = 0,
  onSeedanceElementMediaSlotChange,
}: UseReferencePropertiesInteractionsParams) => {
  useAgentComposerPromptDropModifierTracking();

  const enableFullReferenceInteractions = interactionScope === "full";
  const effectiveSeedanceElementSlotCount = enableFullReferenceInteractions
    ? seedanceElementSlotCount
    : 0;
  const effectiveKlingMultiPrompts = useMemo(
    () => (enableFullReferenceInteractions ? klingMultiPrompts : []),
    [enableFullReferenceInteractions, klingMultiPrompts]
  );
  const effectiveKlingElements = useMemo(
    () => (enableFullReferenceInteractions ? klingElements : []),
    [enableFullReferenceInteractions, klingElements]
  );
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
  while (seedanceElementImageInputRefsRef.current.length < effectiveSeedanceElementSlotCount) {
    seedanceElementImageInputRefsRef.current.push({ current: null });
  }
  const seedanceElementImageInputRefs = seedanceElementImageInputRefsRef.current.slice(
    0,
    effectiveSeedanceElementSlotCount
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
  const extraImageDisplayPreviewEntriesRef = useRef<Array<ImageDisplayPreviewEntry | null>>([]);
  const [extraImageDisplayPreviewVersion, setExtraImageDisplayPreviewVersion] = useState(0);
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

  const releaseDisplayPreviewEntry = useCallback((entry: ImageDisplayPreviewEntry | null) => {
    if (!entry?.ownsObjectUrl || !entry.displayUrl.startsWith("blob:")) return;
    URL.revokeObjectURL(entry.displayUrl);
  }, []);

  const setExtraImageDisplayPreviewAt = useCallback(
    (index: number, sourceUrl: string | null, displayUrl: string | null, ownsObjectUrl = false) => {
      const previous = extraImageDisplayPreviewEntriesRef.current[index] ?? null;
      releaseDisplayPreviewEntry(previous);
      const nextEntries = [...extraImageDisplayPreviewEntriesRef.current];
      nextEntries[index] =
        sourceUrl && displayUrl
          ? {
              sourceUrl,
              displayUrl,
              ownsObjectUrl,
            }
          : null;
      extraImageDisplayPreviewEntriesRef.current = nextEntries;
      setExtraImageDisplayPreviewVersion((version) => version + 1);
    },
    [releaseDisplayPreviewEntry]
  );

  const extraImageDisplayUrls = useMemo(() => {
    void extraImageDisplayPreviewVersion;
    return inputRefs.map((_, index) => {
      const sourceUrl = extraImageUrls[index] ?? null;
      const entry = extraImageDisplayPreviewEntriesRef.current[index] ?? null;
      if (!sourceUrl || !entry || entry.sourceUrl !== sourceUrl) return null;
      return entry.displayUrl;
    });
  }, [extraImageDisplayPreviewVersion, extraImageUrls, inputRefs]);

  useEffect(() => {
    setExtraDragActive((prev) => reconcileBooleanListLength(prev, inputRefs.length));
    setExtraImageLoading((prev) => reconcileBooleanListLength(prev, inputRefs.length));
  }, [inputRefs.length]);

  useEffect(() => {
    let didChange = false;
    const nextEntries = extraImageDisplayPreviewEntriesRef.current.map((entry, index) => {
      const sourceUrl = extraImageUrls[index] ?? null;
      if (!entry || entry.sourceUrl === sourceUrl) return entry ?? null;
      releaseDisplayPreviewEntry(entry);
      didChange = true;
      return null;
    });
    if (didChange) {
      extraImageDisplayPreviewEntriesRef.current = nextEntries;
      setExtraImageDisplayPreviewVersion((version) => version + 1);
    }
  }, [extraImageUrls, releaseDisplayPreviewEntry]);

  useEffect(
    () => () => {
      extraImageDisplayPreviewEntriesRef.current.forEach(releaseDisplayPreviewEntry);
      extraImageDisplayPreviewEntriesRef.current = [];
    },
    [releaseDisplayPreviewEntry]
  );

  useEffect(() => {
    setSeedanceElementImageDragActive((prev) =>
      reconcileBooleanListLength(prev, effectiveSeedanceElementSlotCount)
    );
    setSeedanceElementImageLoading((prev) =>
      reconcileBooleanListLength(prev, effectiveSeedanceElementSlotCount)
    );
  }, [effectiveSeedanceElementSlotCount]);

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
    if (!enableFullReferenceInteractions) return;
    const next = effectiveKlingMultiPrompts.map((item) =>
      item.id === id ? { ...item, [key]: value } : item
    );
    onKlingMultiPromptsChange?.(next);
  };

  const addKlingShot = () => {
    if (!enableFullReferenceInteractions) return;
    onKlingMultiPromptsChange?.([
      ...effectiveKlingMultiPrompts,
      { id: makeId(), prompt: "", duration: 5 },
    ]);
  };

  const removeKlingShot = (id: string) => {
    if (!enableFullReferenceInteractions) return;
    onKlingMultiPromptsChange?.(effectiveKlingMultiPrompts.filter((item) => item.id !== id));
  };

  const updateKlingElement = (
    id: string,
    key: "frontalImageUrl" | "referenceImageUrls" | "videoUrl",
    value: string
  ) => {
    if (!enableFullReferenceInteractions) return;
    const next = effectiveKlingElements.map((item) =>
      item.id === id ? { ...item, [key]: value } : item
    );
    onKlingElementsChange?.(next);
  };

  const addKlingElement = () => {
    if (!enableFullReferenceInteractions) return;
    if (effectiveKlingElements.length >= 3) return;
    onKlingElementsChange?.([...effectiveKlingElements, createEmptyAiStudioKlingElement()]);
  };

  const removeKlingElement = (id: string) => {
    if (!enableFullReferenceInteractions) return;
    onKlingElementsChange?.(effectiveKlingElements.filter((item) => item.id !== id));
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
      const rememberedBlob = readRememberedObjectUrlBlob(imageUrl);
      if (rememberedBlob) {
        const prepared = await prepareLocalImageBlobForEditIngress(rememberedBlob);
        return trackOwnedImageObjectUrl(prepared.url, prepared.blob);
      }
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
    const klingElementBlobUrls = effectiveKlingElements.flatMap((element) => [
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
  }, [effectiveKlingElements, extraImageUrls, referenceImageUrl, releaseOwnedImageObjectUrl]);

  // Committed image URLs live in parent workflow state, which survives panel unmounts
  // during tool navigation. Revoking them here would leave restored slots pointing at
  // dead blob URLs; replacement/removal cleanup still runs while the hook is mounted.

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

  const stageProviderImageSelection = async ({
    imageFile,
    imageUrl,
    imageBlob,
  }: {
    imageFile?: File | null;
    imageUrl?: string | null;
    imageBlob?: Blob | null;
  }): Promise<ImageUploadResponse | null> => {
    if (imageFile) {
      return await uploadImageBlobAssetToStorage(imageFile);
    }
    if (imageBlob) {
      return await uploadImageBlobAssetToStorage(imageBlob);
    }
    const normalizedUrl = imageUrl?.trim() ?? "";
    if (!normalizedUrl) return null;
    if (isHttpImageSourceUrl(normalizedUrl)) {
      return await copyRemoteImageToStorage(normalizedUrl);
    }
    return await uploadImageAssetToStorage(normalizedUrl);
  };

  const stageSeedanceVideoSelection = async ({
    videoFile,
    videoUrl,
    storagePath,
  }: {
    videoFile?: File | null;
    videoUrl?: string | null;
    storagePath?: string | null;
  }): Promise<{ url: string; name?: string | null } | null> => {
    if (videoFile) {
      const uploaded = await uploadReferenceVideoFileToStorage(videoFile);
      registerInternalMediaRefForUrl(uploaded.url, createUploadedVideoInternalMediaRef(uploaded));
      return { url: uploaded.url, name: uploaded.name ?? videoFile.name };
    }
    const normalizedUrl = videoUrl?.trim() ?? "";
    if (!normalizedUrl) return null;
    const normalizedStoragePath = storagePath?.trim() ?? "";
    const existingInternalRef = resolveInternalMediaRefForUrl(normalizedUrl);
    if (normalizedStoragePath) {
      registerInternalMediaRefForUrl(
        normalizedUrl,
        createInternalMediaRef({
          bucket: INTERNAL_MEDIA_REF_BUCKET,
          storagePath: normalizedStoragePath,
        })
      );
      return { url: normalizedUrl };
    }
    if (existingInternalRef?.storagePath) {
      return { url: normalizedUrl };
    }
    if (normalizedUrl.startsWith("blob:") || /^data:video\//i.test(normalizedUrl)) {
      const uploaded = await uploadReferenceVideoAssetToStorage(normalizedUrl);
      registerInternalMediaRefForUrl(uploaded.url, createUploadedVideoInternalMediaRef(uploaded));
      return { url: uploaded.url, name: uploaded.name ?? null };
    }
    if (isHttpMediaSourceUrl(normalizedUrl)) {
      const uploaded = await copyRemoteSeedanceMediaToStorage(normalizedUrl, "video");
      registerInternalMediaRefForUrl(uploaded.url, createUploadedVideoInternalMediaRef(uploaded));
      return { url: uploaded.url, name: "name" in uploaded ? (uploaded.name ?? null) : null };
    }
    return { url: normalizedUrl };
  };

  const stageSeedanceAudioSelection = async ({
    audioFile,
    audioUrl,
    storagePath,
    name,
  }: {
    audioFile?: File | null;
    audioUrl?: string | null;
    storagePath?: string | null;
    name?: string | null;
  }): Promise<{ url: string; name?: string | null } | null> => {
    if (audioFile) {
      const uploaded = await uploadAudioBlobToStorage(audioFile, {
        sourceName: audioFile.name,
        mimeType: audioFile.type,
      });
      registerInternalMediaRefForUrl(uploaded.url, createUploadedAudioInternalMediaRef(uploaded));
      return { url: uploaded.url, name: audioFile.name };
    }
    const normalizedUrl = audioUrl?.trim() ?? "";
    if (!normalizedUrl) return null;
    const normalizedStoragePath = storagePath?.trim() ?? "";
    const existingInternalRef = resolveInternalMediaRefForUrl(normalizedUrl);
    if (normalizedStoragePath) {
      registerInternalMediaRefForUrl(
        normalizedUrl,
        createInternalMediaRef({
          bucket: INTERNAL_MEDIA_REF_BUCKET,
          storagePath: normalizedStoragePath,
        })
      );
      return { url: normalizedUrl, name };
    }
    if (existingInternalRef?.storagePath) {
      return { url: normalizedUrl, name };
    }
    if (normalizedUrl.startsWith("blob:") || /^data:audio\//i.test(normalizedUrl)) {
      const rememberedBlob = normalizedUrl.startsWith("blob:")
        ? readRememberedObjectUrlBlob(normalizedUrl)
        : null;
      const sourceBlob =
        rememberedBlob ?? (await fetch(normalizedUrl).then((response) => response.blob()));
      if (!sourceBlob) return null;
      const uploaded = await uploadAudioBlobToStorage(sourceBlob, {
        sourceName: name,
        mimeType: sourceBlob.type,
      });
      registerInternalMediaRefForUrl(uploaded.url, createUploadedAudioInternalMediaRef(uploaded));
      return { url: uploaded.url, name };
    }
    if (isHttpMediaSourceUrl(normalizedUrl)) {
      const uploaded = await copyRemoteSeedanceMediaToStorage(normalizedUrl, "audio");
      registerInternalMediaRefForUrl(uploaded.url, createUploadedAudioInternalMediaRef(uploaded));
      return { url: uploaded.url, name };
    }
    return { url: normalizedUrl, name };
  };

  const handlePrimaryFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!stagePrimaryImageForProviderAccess) {
      handleFileSelection(onPrimaryImageChange)(event);
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isImageFile(file)) {
      event.target.value = "";
      return;
    }
    setPrimaryImageLoading(true);
    try {
      const stagedImage = await stageProviderImageSelection({ imageFile: file });
      if (stagedImage) {
        registerInternalMediaRefForUrl(
          stagedImage.url,
          createUploadedImageInternalMediaRef(stagedImage)
        );
        onPrimaryImageChange(stagedImage.url);
      }
    } catch (error) {
      console.error("AI Studio motion reference image staging failed:", error);
    } finally {
      setPrimaryImageLoading(false);
      event.target.value = "";
    }
  };

  const handlePromptDrop = (event: DragEvent<HTMLDivElement | HTMLTextAreaElement>) => {
    event.preventDefault();
    const promptText = extractPromptDropText(event.dataTransfer);
    if (promptText) {
      const textarea =
        event.currentTarget instanceof HTMLTextAreaElement ? event.currentTarget : null;
      if (!textarea) {
        onPromptTextChange(promptText);
        return;
      }
      const selectionStart = textarea.selectionStart ?? textarea.value.length;
      const selectionEnd = textarea.selectionEnd ?? selectionStart;
      const nextPrompt = resolveDroppedPromptTextEdit({
        composerText: textarea.value,
        droppedPromptText: promptText,
        selectionStart,
        selectionEnd,
        editMode: resolveDroppedPromptTextEditMode(event),
      });
      onPromptTextChange(nextPrompt.prompt);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(nextPrompt.caret, nextPrompt.caret);
      });
    }
  };

  const acceptImageDropSnapshot = async (
    snapshot: ReferenceImageDropSnapshot,
    setter: (url: string | null) => void,
    setLoading: (value: boolean) => void,
    options?: {
      stageForProviderAccess?: boolean;
      setDisplayPreview?: (
        sourceUrl: string | null,
        displayUrl: string | null,
        ownsObjectUrl?: boolean
      ) => void;
    }
  ) => {
    const {
      internalPayload,
      imageUrl,
      imageFile,
      fromFile,
      referenceId,
      mediaId,
      mediaKind,
      previewStoragePath,
      fullStoragePath,
      displayPreviewUrl: snapshotDisplayPreviewUrl,
      preferLocalRenderArtifact,
    } = snapshot;
    const effectiveMediaKind = internalPayload?.mediaKind ?? mediaKind ?? null;
    const effectivePreviewStoragePath =
      internalPayload?.previewStoragePath ?? previewStoragePath ?? null;
    const effectiveFullStoragePath = internalPayload?.fullStoragePath ?? fullStoragePath ?? null;
    const effectiveStoragePath = resolveImageStoragePath({
      fullStoragePath: effectiveFullStoragePath,
      previewStoragePath: effectivePreviewStoragePath,
      mediaKind: effectiveMediaKind,
    });
    let nextUrl: string | null = null;
    let displayPreviewUrl: string | null =
      snapshotDisplayPreviewUrl && looksLikeImageUrl(snapshotDisplayPreviewUrl)
        ? snapshotDisplayPreviewUrl
        : null;
    let ownsDisplayPreviewUrl = false;
    let resolvedInternalMediaRef = null;
    let didSetLoading = false;

    try {
      if (internalPayload) {
        if (effectiveMediaKind && effectiveMediaKind !== "image") {
          return;
        }
        setLoading(true);
        didSetLoading = true;
        const hasPreferredLocalRenderFallback =
          Boolean(preferLocalRenderArtifact) && isLocalRenderArtifactUrl(imageUrl);
        const resolvedSource =
          resolveInternalReferenceImageDropSource && !hasPreferredLocalRenderFallback
            ? await resolveInternalReferenceImageDropSource(internalPayload).catch(() => null)
            : null;
        resolvedInternalMediaRef = resolvedSource
          ? createImageSlotInternalMediaRef({
              fullStoragePath: resolvedSource.fullStoragePath,
              previewStoragePath: resolvedSource.previewStoragePath,
              mediaId: resolvedSource.mediaId ?? mediaId ?? referenceId ?? null,
              mediaKind: effectiveMediaKind,
            })
          : null;
        if (
          resolveInternalReferenceImageDropSource &&
          !resolvedSource &&
          !hasPreferredLocalRenderFallback
        ) {
          return;
        }
        const resolvedPreparedImageUrl = resolvedSource?.preparedImageUrl?.trim() || null;
        const resolvedPreviewUrl = resolvedSource?.preview.url?.trim() || null;
        displayPreviewUrl =
          resolvedPreviewUrl && looksLikeImageUrl(resolvedPreviewUrl) ? resolvedPreviewUrl : null;
        nextUrl =
          (resolvedPreparedImageUrl && looksLikeImageUrl(resolvedPreparedImageUrl)
            ? resolvedPreparedImageUrl
            : null) ??
          (resolvedPreviewUrl && looksLikeImageUrl(resolvedPreviewUrl) ? resolvedPreviewUrl : null);
        if (
          !nextUrl &&
          !resolvedInternalMediaRef?.storagePath &&
          !hasPreferredLocalRenderFallback
        ) {
          return;
        }
      } else if (effectiveMediaKind && effectiveMediaKind !== "image") {
        return;
      }

      if (!resolvedInternalMediaRef && effectiveStoragePath) {
        resolvedInternalMediaRef = createInternalMediaRef({
          bucket: INTERNAL_MEDIA_REF_BUCKET,
          storagePath: effectiveStoragePath,
          mediaFileId: mediaId ?? referenceId ?? null,
        });
      }

      if (!nextUrl) {
        nextUrl =
          (internalPayload?.referenceUrl && looksLikeImageUrl(internalPayload.referenceUrl)
            ? internalPayload.referenceUrl
            : null) ?? imageUrl;
      }

      const signingStoragePath = resolvedInternalMediaRef?.storagePath ?? effectiveStoragePath;
      if (!nextUrl && signingStoragePath) {
        setLoading(true);
        didSetLoading = true;
        nextUrl = await getSignedMediaUrl({
          bucket: INTERNAL_MEDIA_REF_BUCKET,
          storagePath: signingStoragePath,
          previewProfile: "none",
        }).catch(() => null);
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
      const hasTrustedStorageImageRef = Boolean(resolvedInternalMediaRef?.storagePath);
      if (!looksLikeImageUrl(nextUrl) && !hasTrustedStorageImageRef) return;

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
        if (stableUrl.startsWith("blob:") && options?.setDisplayPreview) {
          const displayBlob = readRememberedObjectUrlBlob(stableUrl) ?? imageFile ?? null;
          const smallDisplayUrl = await createSmallImageDisplayPreviewUrl(displayBlob);
          if (smallDisplayUrl) {
            displayPreviewUrl = smallDisplayUrl;
            ownsDisplayPreviewUrl = true;
          }
        }
        const shouldStageProviderImage =
          (options?.stageForProviderAccess ||
            (setter === onPrimaryImageChange && stagePrimaryImageForProviderAccess)) &&
          (fromFile || isLocalRenderArtifactUrl(stableUrl) || !resolvedInternalMediaRef);
        if (shouldStageProviderImage) {
          const rememberedBlob = stableUrl.startsWith("blob:")
            ? readRememberedObjectUrlBlob(stableUrl)
            : null;
          const stagedImage = await stageProviderImageSelection({
            imageFile: fromFile ? (imageFile ?? null) : null,
            imageBlob: rememberedBlob,
            imageUrl: stableUrl,
          });
          if (!stagedImage) return;
          registerInternalMediaRefForUrl(
            stagedImage.url,
            resolvedInternalMediaRef ?? createUploadedImageInternalMediaRef(stagedImage)
          );
          commitImageUrl(setter, stagedImage.url);
          options?.setDisplayPreview?.(
            stagedImage.url,
            displayPreviewUrl ?? stableUrl,
            ownsDisplayPreviewUrl
          );
          return;
        }
        registerInternalMediaRefForUrl(stableUrl, resolvedInternalMediaRef);
        commitImageUrl(setter, stableUrl);
        options?.setDisplayPreview?.(stableUrl, displayPreviewUrl, ownsDisplayPreviewUrl);
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
    (
      setter: (url: string | null) => void,
      setLoading: (value: boolean) => void,
      options?: {
        stageForProviderAccess?: boolean;
        setDisplayPreview?: (
          sourceUrl: string | null,
          displayUrl: string | null,
          ownsObjectUrl?: boolean
        ) => void;
      }
    ) =>
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const dropSnapshot = captureAiStudioDropSnapshot(event.dataTransfer);
      const snapshotTransfer = buildAiStudioDropSnapshotTransfer(dropSnapshot);
      const internalPayload = extractInternalReferenceDragPayload(snapshotTransfer);
      const composerImagePayload = extractComposerImageDropPayload(snapshotTransfer);
      const mediaLibraryPayload = readMediaLibraryDragPayload(snapshotTransfer);
      const { imageUrl, imageFile, fromFile, referenceId, mediaKind } =
        extractDragDropPayload(snapshotTransfer);
      const composerDisplayArtifactUrl = composerImagePayload?.displayArtifactUrl?.trim() || null;
      const libraryImagePayload =
        mediaLibraryPayload?.kind === "libraryMedia" &&
        mediaLibraryPayload.payload.fileType === "image"
          ? mediaLibraryPayload.payload
          : null;
      await acceptImageDropSnapshot(
        {
          internalPayload,
          imageUrl: composerDisplayArtifactUrl ?? imageUrl,
          imageFile,
          fromFile,
          referenceId:
            trimOptionalString(composerImagePayload?.referenceId) ??
            trimOptionalString(composerImagePayload?.outputId) ??
            referenceId ??
            libraryImagePayload?.id ??
            null,
          mediaId: libraryImagePayload?.id ?? null,
          mediaKind,
          previewStoragePath: libraryImagePayload?.previewStoragePath ?? null,
          fullStoragePath: libraryImagePayload?.fullStoragePath ?? null,
          displayPreviewUrl:
            trimOptionalString(libraryImagePayload?.previewUrl) ??
            trimOptionalString(composerImagePayload?.displayArtifactUrl) ??
            null,
          preferLocalRenderArtifact: Boolean(composerDisplayArtifactUrl),
        },
        setter,
        setLoading,
        options
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
      reconcileBooleanListLength(prev, effectiveSeedanceElementSlotCount).map((item, idx) =>
        idx === index ? value : item
      )
    );
  };

  const setSeedanceElementImageLoadingAt = (index: number, value: boolean) => {
    setSeedanceElementImageLoading((prev) =>
      reconcileBooleanListLength(prev, effectiveSeedanceElementSlotCount).map((item, idx) =>
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
      (value) => setExtraImageLoadingAt(index, value),
      {
        setDisplayPreview: (sourceUrl, displayUrl, ownsObjectUrl) =>
          setExtraImageDisplayPreviewAt(index, sourceUrl, displayUrl, ownsObjectUrl),
      }
    );
  };

  const acceptSeedanceElementMediaCanvasTearOutPayload = (
    index: number,
    payload: AgentComposerDirectDropPayload
  ) => {
    if (!enableFullReferenceInteractions) return;
    setSeedanceElementImageDragActiveAt(index, false);
    if (!onSeedanceElementMediaSlotChange) return;
    if (payload.kind === "image") {
      const snapshot = resolveCanvasTearOutReferenceImageSnapshot(payload);
      if (!snapshot) return;
      void acceptImageDropSnapshot(
        snapshot,
        (url) => onSeedanceElementMediaSlotChange(index, url ? { kind: "image", url } : null),
        (value) => setSeedanceElementImageLoadingAt(index, value),
        { stageForProviderAccess: true }
      );
      return;
    }
    if (payload.kind === "audio") {
      setSeedanceElementImageLoadingAt(index, true);
      void (async () => {
        try {
          const resolvedAudioSource = await resolveLipSyncAudioDropSourceFromPayload({
            payload,
            resolvePreviewUrlById,
          });
          const stagedAudio =
            resolvedAudioSource?.kind === "durable"
              ? await stageSeedanceAudioSelection({
                  audioUrl: resolvedAudioSource.url,
                  storagePath: resolvedAudioSource.storagePath,
                  name: resolvedAudioSource.title,
                })
              : null;
          if (!stagedAudio) return;
          onSeedanceElementMediaSlotChange(index, {
            kind: "audio",
            url: stagedAudio.url,
            name: stagedAudio.name,
          });
        } catch (error) {
          console.error("AI Studio Seedance audio reference staging failed:", error);
        } finally {
          setSeedanceElementImageLoadingAt(index, false);
        }
      })();
      return;
    }
    if (payload.kind !== "video") return;
    setSeedanceElementImageLoadingAt(index, true);
    void (async () => {
      try {
        const resolvedSource = await resolveMotionReferenceVideoDropSourceFromPayload({
          payload,
          resolveInternalReferenceVideoDropSource,
          resolveMotionVideoUrlById,
          resolvePreviewUrlById,
        });
        if (!resolvedSource) return;
        const stagedVideo =
          resolvedSource.kind === "file"
            ? await stageSeedanceVideoSelection({ videoFile: resolvedSource.videoFile })
            : await stageSeedanceVideoSelection({
                videoUrl: resolvedSource.videoUrl,
                storagePath: resolvedSource.storagePath,
              });
        if (!stagedVideo) return;
        onSeedanceElementMediaSlotChange(index, {
          kind: "video",
          url: stagedVideo.url,
          name: stagedVideo.name,
        });
      } catch (error) {
        console.error("AI Studio Seedance video reference staging failed:", error);
      } finally {
        setSeedanceElementImageLoadingAt(index, false);
      }
    })();
  };

  const acceptMotionVideoCanvasTearOutPayload = async (payload: AgentComposerDirectDropPayload) => {
    if (!enableFullReferenceInteractions) return;
    if (payload.kind !== "video") return;
    setMotionVideoDragActive(false);
    const resolvedSource = await resolveMotionReferenceVideoDropSourceFromPayload({
      payload,
      resolveInternalReferenceVideoDropSource,
      resolveMotionVideoUrlById,
      resolvePreviewUrlById,
    });
    if (!resolvedSource || resolvedSource.kind !== "url") return;
    if (onStageMotionVideoSelection) {
      await onStageMotionVideoSelection({ videoUrl: resolvedSource.videoUrl });
      return;
    }
    commitMotionVideoUrl(resolvedSource.videoUrl);
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
      (value) => setExtraImageLoadingAt(index, value),
      {
        setDisplayPreview: (sourceUrl, displayUrl, ownsObjectUrl) =>
          setExtraImageDisplayPreviewAt(index, sourceUrl, displayUrl, ownsObjectUrl),
      }
    )(event);
  };

  const handleExtraFileSelection = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isImageFile(file)) {
      event.target.value = "";
      return;
    }
    setExtraImageLoadingAt(index, true);
    void (async () => {
      try {
        const prepared = await prepareLocalImageFileForEditIngress(file);
        const sourceUrl = trackOwnedImageObjectUrl(prepared.url, prepared.blob);
        const displayUrl = await createSmallImageDisplayPreviewUrl(prepared.blob);
        commitImageUrl((url) => onExtraImageChange(index, url), sourceUrl);
        setExtraImageDisplayPreviewAt(index, sourceUrl, displayUrl, Boolean(displayUrl));
      } catch (error) {
        console.error("AI Studio reference image file ingress failed:", error);
      } finally {
        setExtraImageLoadingAt(index, false);
        event.target.value = "";
      }
    })();
  };

  const handleSeedanceElementMediaFileSelection =
    (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
      if (!enableFullReferenceInteractions) return;
      const file = event.target.files?.[0];
      if (!file) return;
      const isImage = isImageFile(file);
      const isVideo = isVideoFile(file);
      const isAudio = isAudioFile(file);
      const fileName = file.name;
      if (!isImage && !isVideo && !isAudio) {
        event.target.value = "";
        return;
      }
      setSeedanceElementImageLoadingAt(index, true);
      void (async () => {
        try {
          if (isImage) {
            const stagedImage = await stageProviderImageSelection({ imageFile: file });
            if (!stagedImage) return;
            registerInternalMediaRefForUrl(
              stagedImage.url,
              createUploadedImageInternalMediaRef(stagedImage)
            );
            onSeedanceElementMediaSlotChange?.(index, {
              kind: "image",
              url: stagedImage.url,
              name: fileName,
            });
            return;
          }
          if (isAudio) {
            const stagedAudio = await stageSeedanceAudioSelection({ audioFile: file });
            if (!stagedAudio) return;
            onSeedanceElementMediaSlotChange?.(index, {
              kind: "audio",
              url: stagedAudio.url,
              name: stagedAudio.name ?? fileName,
            });
            return;
          }
          const stagedVideo = await stageSeedanceVideoSelection({ videoFile: file });
          if (!stagedVideo) return;
          onSeedanceElementMediaSlotChange?.(index, {
            kind: "video",
            url: stagedVideo.url,
            name: stagedVideo.name ?? fileName,
          });
        } catch (error) {
          console.error("AI Studio Seedance media reference staging failed:", error);
        } finally {
          setSeedanceElementImageLoadingAt(index, false);
        }
      })();
      event.target.value = "";
    };

  const handleSeedanceElementMediaDrop = (index: number) => (event: DragEvent<HTMLDivElement>) => {
    if (!enableFullReferenceInteractions) return;
    setSeedanceElementImageDragActiveAt(index, false);
    if (!onSeedanceElementMediaSlotChange) return;
    if (isImageDragTransfer(event.dataTransfer)) {
      return handleImageDrop(
        (url) => onSeedanceElementMediaSlotChange(index, url ? { kind: "image", url } : null),
        (value) => setSeedanceElementImageLoadingAt(index, value),
        { stageForProviderAccess: true }
      )(event);
    }
    if (!isVideoDragTransfer(event.dataTransfer) && !isAudioDragTransfer(event.dataTransfer))
      return;
    event.preventDefault();
    event.stopPropagation();
    const snapshot = captureAiStudioDropSnapshot(event.dataTransfer);
    setSeedanceElementImageLoadingAt(index, true);
    void (async () => {
      try {
        const resolvedSource = await resolveMotionReferenceVideoDropSource({
          snapshot,
          resolveInternalReferenceVideoDropSource,
          resolveMotionVideoUrlById,
          resolvePreviewUrlById,
        });
        if (resolvedSource) {
          const stagedVideo =
            resolvedSource.kind === "file"
              ? await stageSeedanceVideoSelection({ videoFile: resolvedSource.videoFile })
              : await stageSeedanceVideoSelection({
                  videoUrl: resolvedSource.videoUrl,
                  storagePath: resolvedSource.storagePath,
                });
          if (stagedVideo) {
            onSeedanceElementMediaSlotChange(index, {
              kind: "video",
              url: stagedVideo.url,
              name: stagedVideo.name,
            });
            return;
          }
        }
        const resolvedAudioSource = await resolveLipSyncAudioDropSource({
          snapshot,
          resolvePreviewUrlById,
        });
        const stagedAudio =
          resolvedAudioSource?.kind === "file"
            ? await stageSeedanceAudioSelection({ audioFile: resolvedAudioSource.audioFile })
            : resolvedAudioSource?.kind === "durable"
              ? await stageSeedanceAudioSelection({
                  audioUrl: resolvedAudioSource.url,
                  storagePath: resolvedAudioSource.storagePath,
                  name: resolvedAudioSource.title,
                })
              : null;
        if (!stagedAudio) return;
        onSeedanceElementMediaSlotChange(index, {
          kind: "audio",
          url: stagedAudio.url,
          name: stagedAudio.name,
        });
      } catch (error) {
        console.error("AI Studio Seedance media reference drop failed:", error);
      } finally {
        setSeedanceElementImageLoadingAt(index, false);
      }
    })();
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

  const allowMediaDrag = (event: DragEvent<HTMLDivElement>) => {
    if (
      isImageDragTransfer(event.dataTransfer) ||
      isVideoDragTransfer(event.dataTransfer) ||
      isAudioDragTransfer(event.dataTransfer)
    ) {
      event.preventDefault();
      return true;
    }
    return false;
  };

  const handleSeedanceElementMediaDragEnter =
    (index: number) => (event: DragEvent<HTMLDivElement>) => {
      if (!enableFullReferenceInteractions) return;
      if (allowMediaDrag(event)) {
        setSeedanceElementImageDragActiveAt(index, true);
      }
    };

  const handleSeedanceElementMediaDragOver =
    (index: number) => (event: DragEvent<HTMLDivElement>) => {
      if (!enableFullReferenceInteractions) return;
      if (allowMediaDrag(event)) {
        setSeedanceElementImageDragActiveAt(index, true);
      }
    };

  const handleSeedanceElementMediaDragLeave = (index: number) => () => {
    if (!enableFullReferenceInteractions) return;
    setSeedanceElementImageDragActiveAt(index, false);
  };

  const allowVideoDrag = (event: DragEvent<HTMLDivElement>) => {
    if (!enableFullReferenceInteractions) return false;
    if (isVideoDragTransfer(event.dataTransfer)) {
      event.preventDefault();
      return true;
    }
    return false;
  };

  const handleMotionVideoDrop = async (event: DragEvent<HTMLDivElement>) => {
    if (!enableFullReferenceInteractions) return;
    event.preventDefault();
    event.stopPropagation();
    setMotionVideoDragActive(false);
    const snapshot = captureAiStudioDropSnapshot(event.dataTransfer);

    const resolvedSource = await resolveMotionReferenceVideoDropSource({
      snapshot,
      resolveInternalReferenceVideoDropSource,
      resolveMotionVideoUrlById,
      resolvePreviewUrlById,
    });
    if (!resolvedSource) return;

    if (resolvedSource.kind === "file") {
      await onStageMotionVideoSelection?.({ videoFile: resolvedSource.videoFile });
      return;
    }

    if (onStageMotionVideoSelection) {
      await onStageMotionVideoSelection({ videoUrl: resolvedSource.videoUrl });
      return;
    }

    commitMotionVideoUrl(resolvedSource.videoUrl);
  };

  const handleMotionVideoSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!enableFullReferenceInteractions) return;
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
    extraImageDisplayUrls,
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
    handleExtraFileSelection,
    handlePrimaryFileSelection,
    handlePromptDrop,
    handlePrimaryDrop,
    handleExtraDrop,
    handlePrimaryDragEnter,
    handlePrimaryDragOver,
    handlePrimaryDragLeave,
    handleExtraDragEnter,
    handleExtraDragOver,
    handleExtraDragLeave,
    handleSeedanceElementMediaFileSelection,
    handleSeedanceElementMediaDrop,
    handleSeedanceElementMediaDragEnter,
    handleSeedanceElementMediaDragOver,
    handleSeedanceElementMediaDragLeave,
    acceptPrimaryCanvasTearOutPayload,
    acceptExtraCanvasTearOutPayload,
    acceptSeedanceElementMediaCanvasTearOutPayload,
    acceptMotionVideoCanvasTearOutPayload,
    allowVideoDrag,
    handleMotionVideoDrop,
    handleMotionVideoSelection,
  };
};
