/**
 * Interaction hook for AI Studio reference properties UI.
 * Centralizes collapse state, drag/drop handling, and Kling list mutations.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, RefObject } from "react";
import type { AgentComposerDirectDropPayload } from "../logic/agentComposerDirectDropPayload";
import {
  buildAiStudioDropSnapshotTransfer,
  captureAiStudioDropSnapshot,
} from "../logic/aiStudioDropSnapshot";
import {
  extractDragDropPayload,
  extractComposerImageDropPayload,
  extractPromptDropText,
  extractInternalReferenceDragPayload,
  isImageDragTransfer,
  isImageFile,
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
import { getAiStudioKlingElementReferenceUrls } from "../logic/klingElements";
import {
  readRememberedObjectUrlBlob,
  rememberObjectUrlBlob,
  revokeRememberedObjectUrl,
} from "../utils/objectUrlBlobRegistry";
import { registerInternalMediaRefForUrl } from "../logic/referenceInputInternalMediaRegistry";
import {
  prepareLocalImageBlobForEditIngress,
  prepareLocalImageFileForEditIngress,
} from "../logic/editImageIngress";
import {
  createImageSlotInternalMediaRef,
  createUploadedImageInternalMediaRef,
  isLocalRenderArtifactUrl,
  resolveImageStoragePath,
  resolveCanvasTearOutReferenceImageSnapshot,
  trimOptionalString,
  type ReferenceImageDropSnapshot,
  type ReferenceStepKey,
  type UseReferencePropertiesInteractionsParams,
} from "./referencePropertiesTypes";
import { stageProviderImageSelection } from "./referencePropertiesMediaStaging";
import { createSmallImageDisplayPreviewUrl } from "./referencePropertiesDisplayPreviews";
import { useReferencePropertiesImageDisplayPreviews } from "./useReferencePropertiesImageDisplayPreviews";
import { useReferencePropertiesKlingActions } from "./useReferencePropertiesKlingActions";
import { useReferencePropertiesMotionVideoInteractions } from "./useReferencePropertiesMotionVideoInteractions";
import { useReferencePropertiesSeedanceInteractions } from "./useReferencePropertiesSeedanceInteractions";

const reconcileBooleanListLength = (values: boolean[], length: number): boolean[] =>
  Array.from({ length }, (_, index) => values[index] ?? false);

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
  const ownedImageObjectUrlsRef = useRef<Set<string>>(new Set());
  const pendingCommittedImageObjectUrlsRef = useRef<Set<string>>(new Set());

  const [primaryDragActive, setPrimaryDragActive] = useState(false);
  const [extraDragActive, setExtraDragActive] = useState([false, false, false]);
  const [primaryImageLoading, setPrimaryImageLoading] = useState(false);
  const [extraImageLoading, setExtraImageLoading] = useState([false, false, false]);
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

  const { extraImageDisplayUrls, setExtraImageDisplayPreviewAt } =
    useReferencePropertiesImageDisplayPreviews({
      extraImageUrls,
      slotCount: inputRefs.length,
    });

  useEffect(() => {
    setExtraDragActive((prev) => reconcileBooleanListLength(prev, inputRefs.length));
    setExtraImageLoading((prev) => reconcileBooleanListLength(prev, inputRefs.length));
  }, [inputRefs.length]);

  const handleSwapFrames = () => {
    if (!canSwapFrames) return;
    onPrimaryImageChange(extraImageUrls[0]);
    onExtraImageChange(0, referenceImageUrl);
  };

  const {
    updateKlingMultiPrompt,
    addKlingShot,
    removeKlingShot,
    updateKlingElement,
    addKlingElement,
    removeKlingElement,
  } = useReferencePropertiesKlingActions({
    enabled: enableFullReferenceInteractions,
    klingMultiPrompts: effectiveKlingMultiPrompts,
    onKlingMultiPromptsChange,
    klingElements: effectiveKlingElements,
    onKlingElementsChange,
  });

  const releaseOwnedImageObjectUrl = useCallback((url: string) => {
    if (!ownedImageObjectUrlsRef.current.has(url)) return;
    ownedImageObjectUrlsRef.current.delete(url);
    revokeRememberedObjectUrl(url);
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

  const {
    motionVideoInputRef,
    motionVideoDragActive,
    setMotionVideoDragActive,
    acceptMotionVideoCanvasTearOutPayload,
    allowVideoDrag,
    handleMotionVideoDrop,
    handleMotionVideoSelection,
  } = useReferencePropertiesMotionVideoInteractions({
    enabled: enableFullReferenceInteractions,
    onMotionVideoChange,
    onStageMotionVideoSelection,
    resolvePreviewUrlById,
    resolveMotionVideoUrlById,
    resolveInternalReferenceVideoDropSource,
  });

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
        revokeRememberedObjectUrl(imageUrl);
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

  const {
    seedanceElementImageInputRefs,
    seedanceElementImageDragActive,
    seedanceElementImageLoading,
    setSeedanceElementImageDragActiveAt,
    handleSeedanceElementMediaFileSelection,
    handleSeedanceElementMediaDrop,
    handleSeedanceElementMediaDragEnter,
    handleSeedanceElementMediaDragOver,
    handleSeedanceElementMediaDragLeave,
    acceptSeedanceElementMediaCanvasTearOutPayload,
  } = useReferencePropertiesSeedanceInteractions({
    enabled: enableFullReferenceInteractions,
    slotCount: effectiveSeedanceElementSlotCount,
    onSeedanceElementMediaSlotChange,
    resolvePreviewUrlById,
    resolveMotionVideoUrlById,
    resolveInternalReferenceVideoDropSource,
    acceptImageDropSnapshot,
    handleImageDrop,
  });

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
