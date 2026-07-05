/**
 * Detail modal for reference items (prompt/image/video/audio).
 * Supports prompt-only view and media preview with metadata.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlowArrow, FloppyDisk, TrashSimple } from "phosphor-react";
import type { StudioOutput, WorkflowReloadMediaKindHint } from "../types";
import { resolveModelLabel } from "../logic/stateParsers";
import { downloadUrlToFile } from "../logic/referenceDownload";
import { createStudioOutputDetailModalItem } from "../logic/studioOutputDetailModal";
import {
  canReloadWorkflowOutput,
  inferWorkflowReloadMediaKindForOutput,
} from "../logic/workflowReload";
import { AppMessage } from "../../../components/AppMessage";
import { MEDIA_STORAGE_FULL_USER_MESSAGE } from "../../../lib/mediaStorageQuota";
import { resolveCustomerFacingModelLabel } from "../../../lib/customerFacingProviderText";
import { FAL_OMNIHUMAN_V15_MODEL_ID } from "../../../lib/model-runtime/falModelIds";
import { stripHiddenVideoShotModePromptPrefix } from "../../../lib/model-runtime/videoShotModePromptVisibility";
import { isSupabaseRenderImageUrl } from "../../../lib/mediaPreviewTrustPolicy";
import { stripEditLabel } from "../utils/modelLabels";
import { useAvatarResilience } from "../hooks/useAvatarResilience";
import {
  parseAspectToken,
  resolveClosestDisplayAspectToken,
  resolveClosestDisplayAspectTokenFromDimensions,
} from "../logic/displayAspectRatio";
import { formatImageResolutionLabel } from "../logic/imageResolution";
import { useExclusiveSoundMediaElement } from "./shared/exclusiveSoundPlayback";
import { DetailModalContext } from "./detail-modal/detailModalPlatformTypes";
import { SharedMediaDetailPreviewMedia } from "./detail-modal/SharedMediaDetailPreviewMedia";
import { SharedMediaDetailContentLayout } from "./detail-modal/SharedMediaDetailContentLayout";
import { SharedMediaDetailActionBar } from "./detail-modal/SharedMediaDetailActionBar";
import { SharedMediaDetailInfoPanel } from "./detail-modal/SharedMediaDetailInfoPanel";
import { SharedMediaDetailModalShell } from "./detail-modal/SharedMediaDetailModalShell";
import { PromptCopyButton } from "./detail-modal/PromptCopyButton";
import { resolveSharedMediaDetailMediaActionItems } from "./detail-modal/sharedMediaDetailActions";
import { SharedMediaDetailTopBar } from "./detail-modal/SharedMediaDetailTopBar";
import { SharedMediaDetailVideoSnapshotControl } from "./detail-modal/SharedMediaDetailVideoSnapshotControl";
import { useDetailNavigationKeys } from "./detail-modal/useDetailNavigationKeys";
import type {
  SharedMediaDetailActionItem,
  SharedMediaDetailVideoSnapshotErrorHandler,
  SharedMediaDetailVideoSnapshotHandler,
  SharedMediaDetailTopBarItem,
} from "./detail-modal/detailModalPlatformTypes";
import type { AiStudioDetailNavigationContract } from "../hooks/contracts/pageContentContracts";
import {
  resolveSharedMediaDetailBladeContent,
  resolveSharedMediaDetailBladePlaceholder,
  resolveSharedMediaDetailReferenceNames,
  resolveSharedMediaDetailTopBarItems,
  shouldRenderSharedMediaDetailInfoPanel,
} from "./detail-modal/sharedMediaDetailPresentation";
import { useStudioOutputDetailMediaPreview } from "./detail-modal/useStudioOutputDetailMediaPreview";

type DetailModalProps = {
  output: StudioOutput | null;
  detailNavigation?: AiStudioDetailNavigationContract | null;
  context?: DetailModalContext | null;
  projectId?: string | null;
  onClose: () => void;
  onUpdatePrompt: (id: string, prompt: string) => void;
  onDeleteOutput: (id: string) => void;
  onDownloadReference?: (id: string) => void;
  onSaveReference?: (id: string) => void;
  onSnapshotVideoFrame?: SharedMediaDetailVideoSnapshotHandler;
  onSnapshotVideoFrameError?: SharedMediaDetailVideoSnapshotErrorHandler;
  onReloadWorkflowReference?: (
    output: StudioOutput,
    options?: { mediaKindHint?: WorkflowReloadMediaKindHint | null }
  ) => void;
  onPinPromptReference?: (text: string) => void;
  isMediaStorageFull?: boolean;
  onSavePrompt?: (promptText: string) => void | boolean | Promise<boolean>;
  refreshCharacterOptions?: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  resolveCharacterAvatarUrlById?: (characterId: string | null | undefined) => string | null;
};

const resolveDetailWorkflowReloadMediaKindHint = (
  output: StudioOutput
): WorkflowReloadMediaKindHint => inferWorkflowReloadMediaKindForOutput(output);

const LIP_SYNC_DETAIL_MODEL_LABEL = "Lip Sync";

const normalizeDetailAudioBackgroundUrl = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  if (!normalized || isSupabaseRenderImageUrl(normalized)) return null;
  return normalized;
};

const shouldStripDetailModelEditLabel = (output: StudioOutput, label: string): boolean => {
  const modelId = output.modelId?.trim().toLowerCase() ?? "";
  const model = output.model?.trim().toLowerCase() ?? "";
  return (
    label.trim().toLowerCase().includes("gpt image 2") ||
    modelId.includes("gpt-image-2") ||
    model.includes("gpt image 2")
  );
};

const isLipSyncDetailOutput = (output: StudioOutput): boolean => {
  const payload = output.workflowReload?.payload;
  return (
    (payload?.kind === "video" && payload.videoReferenceMode === "lip-sync") ||
    output.modelId === FAL_OMNIHUMAN_V15_MODEL_ID ||
    output.workflowReload?.model.id === FAL_OMNIHUMAN_V15_MODEL_ID
  );
};

const formatVideoResolutionLabel = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const progressiveMatch = trimmed.match(/^(\d{3,4})p$/i);
  if (progressiveMatch) return `${progressiveMatch[1]}p`;
  const kiloMatch = trimmed.match(/^(\d+)k$/i);
  if (kiloMatch) return `${kiloMatch[1]}K`;
  return trimmed;
};

/**
 * Renders the detail modal for a selected reference.
 */
export function DetailModal({
  output,
  detailNavigation = null,
  context = null,
  projectId = null,
  onClose,
  onUpdatePrompt,
  onDeleteOutput,
  onDownloadReference,
  onSaveReference,
  onSnapshotVideoFrame,
  onSnapshotVideoFrameError,
  onReloadWorkflowReference,
  onPinPromptReference,
  isMediaStorageFull = false,
  onSavePrompt,
  refreshCharacterOptions,
  resolveCharacterAvatarUrlById,
}: DetailModalProps) {
  if (!output) return null;
  return (
    <DetailModalContent
      output={output}
      detailNavigation={detailNavigation}
      context={context}
      projectId={projectId}
      onClose={onClose}
      onUpdatePrompt={onUpdatePrompt}
      onDeleteOutput={onDeleteOutput}
      onDownloadReference={onDownloadReference}
      onSaveReference={onSaveReference}
      onSnapshotVideoFrame={onSnapshotVideoFrame}
      onSnapshotVideoFrameError={onSnapshotVideoFrameError}
      onReloadWorkflowReference={onReloadWorkflowReference}
      onPinPromptReference={onPinPromptReference}
      isMediaStorageFull={isMediaStorageFull}
      onSavePrompt={onSavePrompt}
      refreshCharacterOptions={refreshCharacterOptions}
      resolveCharacterAvatarUrlById={resolveCharacterAvatarUrlById}
    />
  );
}

type DetailModalContentProps = Omit<DetailModalProps, "output"> & {
  output: StudioOutput;
};

function DetailModalContent({
  output,
  detailNavigation = null,
  context = null,
  projectId = null,
  onClose,
  onUpdatePrompt,
  onDeleteOutput,
  onDownloadReference,
  onSaveReference,
  onSnapshotVideoFrame,
  onSnapshotVideoFrameError,
  onReloadWorkflowReference,
  onPinPromptReference,
  isMediaStorageFull = false,
  onSavePrompt,
  refreshCharacterOptions,
  resolveCharacterAvatarUrlById,
}: DetailModalContentProps) {
  const imageVesselRef = useRef<HTMLDivElement | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const imagePanDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const promptOnlyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const promptLibrarySavedTimerRef = useRef<number | null>(null);
  const lastAutoSavedPromptRef = useRef<{ outputId: string; value: string } | null>(null);
  const detailAudioAssetKey = `studio-output:${output.id}`;
  const audioPreviewPlayback = useExclusiveSoundMediaElement(
    `detail-modal-audio:${output.id}`,
    audioPreviewRef,
    detailAudioAssetKey
  );
  const videoPreviewPlayback = useExclusiveSoundMediaElement(
    `detail-modal-video:${output.id}`,
    videoPreviewRef
  );
  const [draftPromptsById, setDraftPromptsById] = useState<Record<string, string>>({});
  const [promptOnlySavedOutputId, setPromptOnlySavedOutputId] = useState<string | null>(null);
  const [promptLibrarySavedOutputId, setPromptLibrarySavedOutputId] = useState<string | null>(null);
  const [loadedPreviewAspect, setLoadedPreviewAspect] = useState<{
    outputId: string;
    url: string;
    ratio: number;
  } | null>(null);
  const [loadedImageNaturalSize, setLoadedImageNaturalSize] = useState<{
    outputId: string;
    url: string;
    width: number;
    height: number;
  } | null>(null);
  const [reflectedPreviewByOutput, setReflectedPreviewByOutput] = useState<{
    outputId: string;
    url: string | null;
  } | null>(null);
  const [imageZoomScaleByOutput, setImageZoomScaleByOutput] = useState<{
    outputId: string;
    value: number;
  } | null>(null);
  const [imagePanByOutput, setImagePanByOutput] = useState<{
    outputId: string;
    x: number;
    y: number;
  } | null>(null);
  const [imagePanningByOutput, setImagePanningByOutput] = useState<{
    outputId: string;
    value: boolean;
  } | null>(null);
  const [resolvedCharacterAvatarByOutput, setResolvedCharacterAvatarByOutput] = useState<{
    outputId: string;
    url: string | null;
  } | null>(null);
  const [styleAvatarLoadErrorByOutput, setStyleAvatarLoadErrorByOutput] = useState<{
    outputId: string;
    value: boolean;
  } | null>(null);
  const { resolveAvatarUrl, clearAvatarFailure, handleAvatarError } = useAvatarResilience({
    surfaceId: "detail-character-chip",
  });

  const {
    outputId,
    detailVideoPosterUrl,
    displayPreviewUrl,
    isDetailPreviewLoading,
    isAudioOutput,
    isVideoOutput,
    isImageOutput,
    detailPreviewKind,
    mediaType,
    isPromptOnly,
    tryAdvancePreviewCandidate,
    refreshCanonicalPreviewCandidate,
    resetDetailMediaPreviewState,
  } = useStudioOutputDetailMediaPreview({
    output,
    projectId,
  });
  const workflowReloadMediaKindHint = resolveDetailWorkflowReloadMediaKindHint(output);
  const baseDetailModalItem = useMemo(
    () =>
      createStudioOutputDetailModalItem({
        output,
        canSavePrompt: Boolean(onSavePrompt),
      }),
    [onSavePrompt, output]
  );
  const characterContext = output?.characterContext;
  const hasCharacterContext = baseDetailModalItem.capabilities.canShowCharacterContext;
  const characterName =
    characterContext?.characterName?.trim() ||
    characterContext?.characterId?.trim() ||
    "Selected Character";
  const characterLookName =
    characterContext?.lookName?.trim() || characterContext?.lookId?.trim() || "";
  const styleContext = output?.styleContext;
  const hasStyleContext = baseDetailModalItem.capabilities.canShowStyleContext;
  const styleName =
    styleContext?.styleName?.trim() ||
    styleContext?.styleId?.trim() ||
    styleContext?.stylePrompt?.trim() ||
    "Selected Style";
  const stylePreviewImageUrl = useMemo(() => {
    const explicitPreviewUrl = styleContext?.stylePreviewImageUrl?.trim() || "";
    if (explicitPreviewUrl) return explicitPreviewUrl;
    return null;
  }, [styleContext?.stylePreviewImageUrl]);
  const characterInitials = useMemo(() => {
    const trimmed = characterName.trim();
    if (!trimmed) return "PC";
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
  }, [characterName]);
  const styleInitials = useMemo(() => {
    const trimmed = styleName.trim();
    if (!trimmed) return "ST";
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
  }, [styleName]);
  const characterId = characterContext?.characterId?.trim() ?? null;
  const characterAvatarRecoveryId =
    outputId && characterId
      ? `${outputId}:${characterId}`
      : outputId
        ? `${outputId}:character`
        : null;
  const candidateCharacterAvatarUrl =
    resolvedCharacterAvatarByOutput &&
    outputId &&
    resolvedCharacterAvatarByOutput.outputId === outputId
      ? resolvedCharacterAvatarByOutput.url
      : (characterContext?.characterProfileImageUrl?.trim() ??
        resolveCharacterAvatarUrlById?.(characterId) ??
        null);
  const characterAvatarUrl = resolveAvatarUrl(
    characterAvatarRecoveryId,
    candidateCharacterAvatarUrl
  );
  const isStyleAvatarLoadError =
    styleAvatarLoadErrorByOutput && outputId && styleAvatarLoadErrorByOutput.outputId === outputId
      ? styleAvatarLoadErrorByOutput.value
      : false;
  const shouldRenderCharacterAvatar = Boolean(characterAvatarUrl);
  const shouldRenderStyleAvatar = Boolean(stylePreviewImageUrl) && !isStyleAvatarLoadError;
  const isUploadedReference = useMemo(() => {
    if (!displayPreviewUrl) return false;
    if (output?.mediaSource === "upload" || output?.mediaSource === "clipboard") return true;
    if (output?.id?.startsWith("upload-")) return true;
    if (output?.id?.startsWith("media-paste-")) return true;
    if (output?.timestamp === "Dropped") return true;
    if (output?.timestamp === "Clipboard") return true;
    return false;
  }, [displayPreviewUrl, output?.id, output?.mediaSource, output?.timestamp]);
  const hasGeneratedReferenceAuthority = useMemo(
    () =>
      Boolean(
        output.mediaSource === "generated" || output.generationId?.trim() || output.taskId?.trim()
      ),
    [output.generationId, output.mediaSource, output.taskId]
  );
  const isNonGeneratedLoadedMedia = useMemo(() => {
    if (!displayPreviewUrl || !output) return false;
    if (hasGeneratedReferenceAuthority) return false;
    if (output.mediaSource) {
      return output.mediaSource !== "generated";
    }
    if (output.id.startsWith("library-")) return true;
    if (output.id.startsWith("upload-")) return true;
    if (output.id.startsWith("media-paste-")) return true;
    if (output.timestamp === "Dropped" || output.timestamp === "Library") return true;
    if (output.timestamp === "Clipboard") return true;
    return false;
  }, [displayPreviewUrl, hasGeneratedReferenceAuthority, output]);
  const isLibraryLoadedReference = useMemo(() => {
    if (!displayPreviewUrl || !output) return false;
    if (hasGeneratedReferenceAuthority) return false;
    if (output.mediaSource === "library") return true;
    if (output.id.startsWith("library-")) return true;
    if (output.timestamp === "Library") return true;
    return false;
  }, [displayPreviewUrl, hasGeneratedReferenceAuthority, output]);
  const normalizedAudioWorkflowLabel = useMemo(() => {
    const modelLabel = output.model?.trim().toLowerCase() ?? "";
    const modelId = output.modelId?.trim().toLowerCase() ?? "";
    if (modelLabel.includes("voice changer") || modelId.includes("sts")) {
      return "voice changer";
    }
    if (modelLabel.includes("voiceover") || modelLabel.includes("text to speech")) {
      return "voiceover";
    }
    if (modelLabel.includes("sound effects")) {
      return "SFX";
    }
    if (modelLabel.includes("music")) {
      return "music";
    }
    return null;
  }, [output.model, output.modelId]);
  const isGeneratedPureAudioOutput = Boolean(
    isAudioOutput &&
    output?.mediaSource === "generated" &&
    !isNonGeneratedLoadedMedia &&
    normalizedAudioWorkflowLabel
  );
  const isGeneratedVoiceChangerVideoOutput = Boolean(
    isVideoOutput &&
    output?.mediaSource === "generated" &&
    !isNonGeneratedLoadedMedia &&
    normalizedAudioWorkflowLabel === "voice changer"
  );
  const generatedVoiceChangerTranscript = useMemo(() => {
    if (!output || output.mediaSource !== "generated") return null;
    if (normalizedAudioWorkflowLabel !== "voice changer") return null;
    const transcriptText = output.transcriptText?.trim() ?? "";
    return transcriptText.length > 0 ? transcriptText : null;
  }, [normalizedAudioWorkflowLabel, output]);
  const isActiveVoiceChangerSourceVideo = Boolean(
    isVideoOutput && context?.activeVoiceChangerSourceVideo
  );
  const imageNaturalSize =
    loadedImageNaturalSize &&
    outputId &&
    loadedImageNaturalSize.outputId === outputId &&
    loadedImageNaturalSize.url === displayPreviewUrl
      ? loadedImageNaturalSize
      : null;
  const imageZoomScale =
    imageZoomScaleByOutput && outputId && imageZoomScaleByOutput.outputId === outputId
      ? imageZoomScaleByOutput.value
      : 1;
  const imagePan =
    imagePanByOutput && outputId && imagePanByOutput.outputId === outputId
      ? { x: imagePanByOutput.x, y: imagePanByOutput.y }
      : { x: 0, y: 0 };
  const isImagePanning =
    imagePanningByOutput && outputId && imagePanningByOutput.outputId === outputId
      ? imagePanningByOutput.value
      : false;
  const outputDimensionAspect =
    !isActiveVoiceChangerSourceVideo && output
      ? resolveClosestDisplayAspectTokenFromDimensions(output.width, output.height)
      : null;
  const outputWidth = typeof output.width === "number" && output.width > 0 ? output.width : null;
  const outputHeight =
    typeof output.height === "number" && output.height > 0 ? output.height : null;
  const outputDimensionAspectRatio =
    !isActiveVoiceChangerSourceVideo && outputWidth && outputHeight
      ? outputWidth / outputHeight
      : null;
  const measuredPreviewAspectRatio =
    loadedPreviewAspect &&
    outputId &&
    loadedPreviewAspect.outputId === outputId &&
    loadedPreviewAspect.url === displayPreviewUrl
      ? loadedPreviewAspect.ratio
      : null;
  const measuredPreviewAspect =
    !isActiveVoiceChangerSourceVideo && imageNaturalSize
      ? resolveClosestDisplayAspectTokenFromDimensions(
          imageNaturalSize.width,
          imageNaturalSize.height
        )
      : !isActiveVoiceChangerSourceVideo
        ? resolveClosestDisplayAspectToken(measuredPreviewAspectRatio)
        : null;
  const displayAspect =
    context?.activeVoiceChangerSourceVideo?.aspect ??
    measuredPreviewAspect ??
    outputDimensionAspect ??
    output?.aspect ??
    null;
  const outputAspectRatio = parseAspectToken(displayAspect);
  const previewAspectRatio = isActiveVoiceChangerSourceVideo
    ? outputAspectRatio
    : (measuredPreviewAspectRatio ?? outputDimensionAspectRatio ?? outputAspectRatio);
  const aspectStyle =
    previewAspectRatio && Number.isFinite(previewAspectRatio)
      ? { aspectRatio: String(previewAspectRatio) }
      : displayAspect && displayAspect.includes(":")
        ? { aspectRatio: displayAspect.replace(":", " / ") }
        : undefined;
  const displayPromptText =
    stripHiddenVideoShotModePromptPrefix(output?.generationReplay?.displayPrompt) ??
    stripHiddenVideoShotModePromptPrefix(output?.workflowReload?.prompt?.display) ??
    stripHiddenVideoShotModePromptPrefix(output?.previewText) ??
    stripHiddenVideoShotModePromptPrefix(output?.prompt) ??
    "";
  const draftPrompt =
    outputId && output ? (draftPromptsById[outputId] ?? displayPromptText) : displayPromptText;
  const isPromptOnlySaved = Boolean(outputId && promptOnlySavedOutputId === outputId);
  const isPromptLibrarySaved = Boolean(outputId && promptLibrarySavedOutputId === outputId);
  const mediaSaveState = output?.saveState ?? "idle";
  const canSaveReferenceMedia = baseDetailModalItem.capabilities.canSaveToLibrary;
  const canDownloadReferenceMedia = baseDetailModalItem.capabilities.canDownload;
  const isMediaSaveButtonVisible = Boolean(
    !isPromptOnly && displayPreviewUrl && outputId && onSaveReference && canSaveReferenceMedia
  );
  const isMediaSaveDisabled =
    isMediaStorageFull || mediaSaveState === "saving" || mediaSaveState === "saved";

  const isPromptEditable = baseDetailModalItem.capabilities.canEditPrompt;
  const trimmedPrompt = draftPrompt.trim();
  const hasPromptEdits = trimmedPrompt !== displayPromptText.trim();
  const isErrorDetail = output.taskState === "fail";
  const shouldUseTextDetailLayout = isPromptOnly || isErrorDetail;
  const detailModalStyle = useMemo(() => {
    if (shouldUseTextDetailLayout) return undefined;
    if (!previewAspectRatio || !Number.isFinite(previewAspectRatio)) return undefined;
    return {
      "--detail-preview-aspect": String(previewAspectRatio),
    } as React.CSSProperties;
  }, [previewAspectRatio, shouldUseTextDetailLayout]);
  const isImageZoomed = imageZoomScale > 1.001;

  const handleDetailImageError = useCallback(() => {
    const advanced = tryAdvancePreviewCandidate();
    if (advanced) return;
    void refreshCanonicalPreviewCandidate();
  }, [refreshCanonicalPreviewCandidate, tryAdvancePreviewCandidate]);

  const handleDetailVideoError = useCallback(() => {
    videoPreviewPlayback.handleError();
    const advanced = tryAdvancePreviewCandidate();
    if (advanced) return;
    void refreshCanonicalPreviewCandidate();
  }, [refreshCanonicalPreviewCandidate, tryAdvancePreviewCandidate, videoPreviewPlayback]);

  const handleDetailAudioError = useCallback(() => {
    audioPreviewPlayback.handleError();
    const advanced = tryAdvancePreviewCandidate();
    if (advanced) return;
    void refreshCanonicalPreviewCandidate();
  }, [audioPreviewPlayback, refreshCanonicalPreviewCandidate, tryAdvancePreviewCandidate]);

  const refreshCharacterAvatar = useCallback(async () => {
    if (!outputId || !characterId) return null;
    const refreshedOptions = await refreshCharacterOptions?.();
    const refreshedAvatarUrl =
      refreshedOptions?.find((item) => item.id === characterId)?.profileImageUrl ?? null;
    const resolvedAvatarUrl =
      refreshedAvatarUrl?.trim() ?? resolveCharacterAvatarUrlById?.(characterId) ?? null;
    if (resolvedAvatarUrl) {
      setResolvedCharacterAvatarByOutput({
        outputId,
        url: resolvedAvatarUrl,
      });
    }
    return resolvedAvatarUrl;
  }, [characterId, outputId, refreshCharacterOptions, resolveCharacterAvatarUrlById]);

  useEffect(() => {
    if (!hasCharacterContext || !outputId || !characterId) return;
    let isCancelled = false;
    void (async () => {
      try {
        const refreshedAvatarUrl = await refreshCharacterAvatar();
        if (isCancelled || !refreshedAvatarUrl) return;
        setResolvedCharacterAvatarByOutput((current) => {
          if (current?.outputId === outputId && current.url === refreshedAvatarUrl) {
            return current;
          }
          return {
            outputId,
            url: refreshedAvatarUrl,
          };
        });
      } catch {
        // Keep character attribution non-blocking if refresh fails.
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [characterId, hasCharacterContext, outputId, refreshCharacterAvatar]);

  const clampImagePan = useCallback(
    (nextX: number, nextY: number, scale: number) => {
      const vessel = imageVesselRef.current;
      if (!vessel || !imageNaturalSize || scale <= 1) return { x: 0, y: 0 };

      const vesselWidth = vessel.clientWidth;
      const vesselHeight = vessel.clientHeight;
      if (vesselWidth <= 0 || vesselHeight <= 0) return { x: 0, y: 0 };

      const fitScale = Math.min(
        vesselWidth / imageNaturalSize.width,
        vesselHeight / imageNaturalSize.height
      );
      const fittedWidth = imageNaturalSize.width * fitScale;
      const fittedHeight = imageNaturalSize.height * fitScale;
      const zoomedWidth = fittedWidth * scale;
      const zoomedHeight = fittedHeight * scale;

      const maxPanX = Math.max(0, (zoomedWidth - vesselWidth) / 2);
      const maxPanY = Math.max(0, (zoomedHeight - vesselHeight) / 2);

      return {
        x: Math.min(maxPanX, Math.max(-maxPanX, nextX)),
        y: Math.min(maxPanY, Math.max(-maxPanY, nextY)),
      };
    },
    [imageNaturalSize]
  );

  const setImageZoomScaleForOutput = useCallback(
    (nextScale: number) => {
      if (!outputId) return;
      setImageZoomScaleByOutput({ outputId, value: nextScale });
    },
    [outputId]
  );

  const setIsImagePanningForOutput = useCallback(
    (isPanning: boolean) => {
      if (!outputId) return;
      setImagePanningByOutput({ outputId, value: isPanning });
    },
    [outputId]
  );

  const setImagePanForOutput = useCallback(
    (
      next:
        | { x: number; y: number }
        | ((prev: { x: number; y: number }) => { x: number; y: number })
    ) => {
      if (!outputId) return;
      setImagePanByOutput((prev) => {
        const current =
          prev && prev.outputId === outputId ? { x: prev.x, y: prev.y } : { x: 0, y: 0 };
        const resolved = typeof next === "function" ? next(current) : next;
        return { outputId, x: resolved.x, y: resolved.y };
      });
    },
    [outputId]
  );

  const syncTextareaHeight = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) return;
    const minHeight = Number(element.dataset.minHeight || 180);
    const maxHeight = Number(element.dataset.maxHeight || 420);
    element.style.height = "auto";
    const nextHeight = Math.min(Math.max(element.scrollHeight, minHeight), maxHeight);
    element.style.height = `${nextHeight}px`;
  }, []);

  const clearPromptLibrarySavedTimer = useCallback(() => {
    if (typeof window === "undefined") return;
    if (promptLibrarySavedTimerRef.current == null) return;
    window.clearTimeout(promptLibrarySavedTimerRef.current);
    promptLibrarySavedTimerRef.current = null;
  }, []);

  useEffect(() => {
    syncTextareaHeight(promptTextareaRef.current);
  }, [draftPrompt, generatedVoiceChangerTranscript, syncTextareaHeight]);

  useEffect(() => {
    if (!isImageOutput) return;
    const handleResize = () => {
      setImagePanForOutput((prev) => {
        const clamped = clampImagePan(prev.x, prev.y, imageZoomScale);
        if (clamped.x === prev.x && clamped.y === prev.y) return prev;
        return clamped;
      });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [clampImagePan, imageZoomScale, isImageOutput, setImagePanForOutput]);

  useEffect(() => {
    return () => {
      clearPromptLibrarySavedTimer();
    };
  }, [clearPromptLibrarySavedTimer]);

  const commitTextReferenceEdit = useCallback(
    (options: { showFeedback?: boolean } = {}) => {
      if (!isPromptOnly || !isPromptEditable || !outputId || !trimmedPrompt || !hasPromptEdits) {
        return false;
      }
      const lastAutoSavedPrompt = lastAutoSavedPromptRef.current;
      if (lastAutoSavedPrompt?.outputId === outputId && lastAutoSavedPrompt.value === draftPrompt) {
        return false;
      }

      onUpdatePrompt(outputId, draftPrompt);
      lastAutoSavedPromptRef.current = { outputId, value: draftPrompt };
      if (options.showFeedback) {
        setPromptOnlySavedOutputId(outputId);
      }
      return true;
    },
    [
      draftPrompt,
      hasPromptEdits,
      isPromptEditable,
      isPromptOnly,
      onUpdatePrompt,
      outputId,
      trimmedPrompt,
    ]
  );

  const handleCloseModal = useCallback(() => {
    commitTextReferenceEdit();
    clearPromptLibrarySavedTimer();
    setPromptOnlySavedOutputId(null);
    setPromptLibrarySavedOutputId(null);
    setImageZoomScaleByOutput(null);
    setImagePanByOutput(null);
    setImagePanningByOutput(null);
    setLoadedImageNaturalSize(null);
    setLoadedPreviewAspect(null);
    resetDetailMediaPreviewState();
    imagePanDragRef.current = null;
    onClose();
  }, [
    clearPromptLibrarySavedTimer,
    commitTextReferenceEdit,
    onClose,
    resetDetailMediaPreviewState,
  ]);

  useDetailNavigationKeys({
    isEnabled: true,
    navigation: detailNavigation,
  });

  const generatedReferenceFallbackKind =
    detailPreviewKind ?? (output.mode === "text" ? "prompt" : output.mode);
  const isGeneratedReference = Boolean(
    !isNonGeneratedLoadedMedia && !isUploadedReference && hasGeneratedReferenceAuthority
  );
  const { detailReferenceName, filenameFromUrl, uploadedHeaderFilename } =
    resolveSharedMediaDetailReferenceNames({
      displayPreviewUrl,
      displayPromptText,
      generatedReferenceFallbackKind,
      isGeneratedReference,
      isLoadedReference: isNonGeneratedLoadedMedia,
      isPromptOnly,
      isUploadedReference,
      mediaTypeLabel: mediaType,
      title: output.title,
    });
  const shouldUseExternalFileLayout = Boolean(
    isUploadedReference || (isLibraryLoadedReference && !isActiveVoiceChangerSourceVideo)
  );
  const downloadFilename = uploadedHeaderFilename ?? filenameFromUrl ?? output?.id ?? "media";
  const bladeContent = useMemo(
    () =>
      resolveSharedMediaDetailBladeContent({
        item: baseDetailModalItem,
        promptTextOverride: draftPrompt,
        transcriptTextOverride: generatedVoiceChangerTranscript,
      }),
    [baseDetailModalItem, draftPrompt, generatedVoiceChangerTranscript]
  );
  const displayModelLabel = useMemo(() => {
    if (isUploadedReference) return null;
    if (isAudioOutput) return null;
    if (isLipSyncDetailOutput(output)) return LIP_SYNC_DETAIL_MODEL_LABEL;
    const resolvedLabel = resolveCustomerFacingModelLabel({
      model: output?.model,
      modelId: output?.modelId,
      resolveModelLabel,
      fallback: "",
    });
    return shouldStripDetailModelEditLabel(output, resolvedLabel)
      ? stripEditLabel(resolvedLabel)
      : resolvedLabel;
  }, [isAudioOutput, isUploadedReference, output]);
  const displayImageResolutionLabel = useMemo(() => {
    if (isUploadedReference || output?.mode !== "image") return null;
    const workflowPayload = output.workflowReload?.payload;
    const workflowResolution =
      workflowPayload?.kind === "image" ? workflowPayload.imageResolution?.trim() : "";
    const resolutionValue = output?.generationReplay?.imageResolution?.trim() || workflowResolution;
    if (!resolutionValue) return null;
    return formatImageResolutionLabel(resolutionValue);
  }, [isUploadedReference, output]);
  const displayVideoResolutionLabel = useMemo(() => {
    if (isUploadedReference || output?.mode !== "video") return null;
    const payload = output.workflowReload?.payload;
    if (payload?.kind !== "video") return null;
    return formatVideoResolutionLabel(payload.resolution);
  }, [isUploadedReference, output]);
  const metaPillItems = useMemo(() => {
    if (isErrorDetail) {
      return displayModelLabel ? ["Error", displayModelLabel] : ["Error"];
    }
    if (shouldUseExternalFileLayout) {
      return [mediaType];
    }
    if (isPromptOnly) {
      return [mediaType];
    }
    if (isActiveVoiceChangerSourceVideo) {
      return displayAspect
        ? [mediaType, "voice changer", displayAspect]
        : [mediaType, "voice changer"];
    }
    if (isAudioOutput) {
      return normalizedAudioWorkflowLabel ? [mediaType, normalizedAudioWorkflowLabel] : [mediaType];
    }
    if (isGeneratedVoiceChangerVideoOutput && normalizedAudioWorkflowLabel) {
      return displayAspect
        ? [mediaType, normalizedAudioWorkflowLabel, displayAspect]
        : [mediaType, normalizedAudioWorkflowLabel];
    }

    const items: string[] = [mediaType];
    if (!isNonGeneratedLoadedMedia && displayAspect) {
      items.push(displayAspect);
    }
    if (!isNonGeneratedLoadedMedia && displayImageResolutionLabel) {
      items.push(displayImageResolutionLabel);
    }
    if (!isNonGeneratedLoadedMedia && displayVideoResolutionLabel) {
      items.push(displayVideoResolutionLabel);
    }
    if (!isNonGeneratedLoadedMedia && uploadedHeaderFilename) {
      items.push(uploadedHeaderFilename);
    }
    if (!isNonGeneratedLoadedMedia && !isUploadedReference && displayModelLabel) {
      items.push(displayModelLabel);
    }
    return items;
  }, [
    displayModelLabel,
    displayImageResolutionLabel,
    displayVideoResolutionLabel,
    displayAspect,
    isErrorDetail,
    isActiveVoiceChangerSourceVideo,
    isGeneratedVoiceChangerVideoOutput,
    isNonGeneratedLoadedMedia,
    isAudioOutput,
    isPromptOnly,
    isUploadedReference,
    mediaType,
    normalizedAudioWorkflowLabel,
    shouldUseExternalFileLayout,
    uploadedHeaderFilename,
  ]);
  const sharedTopBarItems = useMemo<SharedMediaDetailTopBarItem[]>(
    () =>
      metaPillItems.map((item) => ({
        label: item,
        className: `art-meta-item ${
          !isGeneratedPureAudioOutput &&
          !isGeneratedVoiceChangerVideoOutput &&
          item === uploadedHeaderFilename
            ? "art-meta-filename"
            : !isGeneratedPureAudioOutput &&
                !isGeneratedVoiceChangerVideoOutput &&
                item === displayModelLabel
              ? "truncate-model"
              : ""
        }`.trim(),
        title: item === uploadedHeaderFilename ? uploadedHeaderFilename : undefined,
      })),
    [
      displayModelLabel,
      isGeneratedPureAudioOutput,
      isGeneratedVoiceChangerVideoOutput,
      metaPillItems,
      uploadedHeaderFilename,
    ]
  );
  const detailModalItem = useMemo(
    () =>
      createStudioOutputDetailModalItem({
        output,
        canSavePrompt: Boolean(onSavePrompt),
        presentation: {
          title: detailReferenceName,
          kindLabel: isErrorDetail ? "Error" : mediaType,
          topBarItems: sharedTopBarItems,
          bladePlaceholder: isErrorDetail
            ? "No error details were captured."
            : generatedVoiceChangerTranscript
              ? "No transcript metadata available."
              : "No prompt metadata available.",
        },
      }),
    [
      detailReferenceName,
      generatedVoiceChangerTranscript,
      isErrorDetail,
      mediaType,
      onSavePrompt,
      output,
      sharedTopBarItems,
    ]
  );
  const audioBackgroundImageUrl = normalizeDetailAudioBackgroundUrl(
    detailModalItem.media.companionArtUrl
  );
  const reflectedPreviewUrl =
    !displayPreviewUrl || isErrorDetail
      ? null
      : isAudioOutput
        ? audioBackgroundImageUrl
        : isImageOutput &&
            reflectedPreviewByOutput?.outputId === outputId &&
            reflectedPreviewByOutput.url
          ? reflectedPreviewByOutput.url
          : displayPreviewUrl;
  const shouldRenderDetailInfoPanel = shouldRenderSharedMediaDetailInfoPanel(
    detailModalItem,
    bladeContent
  );

  const handleSaveTextDetail = useCallback(async () => {
    if (!trimmedPrompt) return;
    if (!onSavePrompt) {
      const committedEdit = commitTextReferenceEdit({ showFeedback: true });
      if (!committedEdit && outputId) {
        setPromptOnlySavedOutputId(outputId);
      }
      return;
    }
    commitTextReferenceEdit({ showFeedback: false });
    const saved = await onSavePrompt(draftPrompt);
    if (saved === false) return;
    if (!outputId) return;
    setPromptLibrarySavedOutputId(outputId);
    if (typeof window === "undefined") return;
    clearPromptLibrarySavedTimer();
    promptLibrarySavedTimerRef.current = window.setTimeout(() => {
      setPromptLibrarySavedOutputId((current) => (current === outputId ? null : current));
      promptLibrarySavedTimerRef.current = null;
    }, 1400);
  }, [
    clearPromptLibrarySavedTimer,
    commitTextReferenceEdit,
    draftPrompt,
    onSavePrompt,
    outputId,
    trimmedPrompt,
  ]);

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isPromptEditable || !outputId) return;
    const nextValue = event.target.value;
    setPromptOnlySavedOutputId(null);
    setPromptLibrarySavedOutputId(null);
    lastAutoSavedPromptRef.current = null;
    clearPromptLibrarySavedTimer();
    setDraftPromptsById((prev) => ({
      ...prev,
      [outputId]: nextValue,
    }));
  };

  const handleDownload = useCallback(() => {
    if (output?.id && onDownloadReference) {
      onDownloadReference(output.id);
      return;
    }
    if (!displayPreviewUrl || typeof window === "undefined") return;
    downloadUrlToFile(displayPreviewUrl, downloadFilename);
  }, [displayPreviewUrl, downloadFilename, onDownloadReference, output]);

  const handleSaveMediaReference = useCallback(() => {
    if (!outputId || !onSaveReference || isMediaSaveDisabled) return;
    onSaveReference(outputId);
  }, [isMediaSaveDisabled, onSaveReference, outputId]);

  const handleReloadWorkflowReference = useCallback(() => {
    if (!onReloadWorkflowReference) return;
    onReloadWorkflowReference(output, { mediaKindHint: workflowReloadMediaKindHint });
    handleCloseModal();
  }, [handleCloseModal, onReloadWorkflowReference, output, workflowReloadMediaKindHint]);

  const handlePreviewAspectLoad = useCallback(
    (width: number, height: number) => {
      if (!outputId || !displayPreviewUrl) return;
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
      setLoadedPreviewAspect({ outputId, url: displayPreviewUrl, ratio: width / height });
    },
    [displayPreviewUrl, outputId]
  );

  const handleImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      if (!outputId || !displayPreviewUrl) return;
      const { naturalWidth, naturalHeight } = event.currentTarget;
      handlePreviewAspectLoad(naturalWidth, naturalHeight);
      setLoadedImageNaturalSize({
        outputId,
        url: displayPreviewUrl,
        width: naturalWidth,
        height: naturalHeight,
      });
      setImageZoomScaleForOutput(1);
      setImagePanForOutput({ x: 0, y: 0 });
      setIsImagePanningForOutput(false);
      imagePanDragRef.current = null;
    },
    [
      handlePreviewAspectLoad,
      displayPreviewUrl,
      outputId,
      setImagePanForOutput,
      setImageZoomScaleForOutput,
      setIsImagePanningForOutput,
    ]
  );

  const applyZoomAtPoint = useCallback(
    (container: HTMLDivElement, cursorX: number, cursorY: number, nextScale: number) => {
      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const focalX = (cursorX - centerX - imagePan.x) / imageZoomScale;
      const focalY = (cursorY - centerY - imagePan.y) / imageZoomScale;
      const nextPanX = cursorX - centerX - focalX * nextScale;
      const nextPanY = cursorY - centerY - focalY * nextScale;
      const clamped = clampImagePan(nextPanX, nextPanY, nextScale);
      setImageZoomScaleForOutput(nextScale);
      setImagePanForOutput(clamped);
      if (nextScale <= 1) {
        setIsImagePanningForOutput(false);
        imagePanDragRef.current = null;
      }
    },
    [
      clampImagePan,
      imagePan.x,
      imagePan.y,
      imageZoomScale,
      setImagePanForOutput,
      setImageZoomScaleForOutput,
      setIsImagePanningForOutput,
    ]
  );

  const handleImageWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!isImageOutput) return;
      if (event.nativeEvent.cancelable) {
        event.preventDefault();
      }

      const zoomFactor = event.deltaY < 0 ? 1.12 : 0.88;
      const nextScale = Math.min(6, Math.max(1, imageZoomScale * zoomFactor));
      if (Math.abs(nextScale - imageZoomScale) < 0.0001) return;

      const rect = event.currentTarget.getBoundingClientRect();
      applyZoomAtPoint(
        event.currentTarget,
        event.clientX - rect.left,
        event.clientY - rect.top,
        nextScale
      );
    },
    [applyZoomAtPoint, imageZoomScale, isImageOutput]
  );

  const handleImageDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isImageOutput) return;
      if (imageZoomScale <= 1) return;
      const rect = event.currentTarget.getBoundingClientRect();
      applyZoomAtPoint(event.currentTarget, event.clientX - rect.left, event.clientY - rect.top, 1);
    },
    [applyZoomAtPoint, imageZoomScale, isImageOutput]
  );

  const handleImagePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isImageOutput || imageZoomScale <= 1) return;
      if (event.button !== 0) return;
      imagePanDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPanX: imagePan.x,
        startPanY: imagePan.y,
      };
      setIsImagePanningForOutput(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [imagePan.x, imagePan.y, imageZoomScale, isImageOutput, setIsImagePanningForOutput]
  );

  const handleImagePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const dragState = imagePanDragRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      const clamped = clampImagePan(
        dragState.startPanX + deltaX,
        dragState.startPanY + deltaY,
        imageZoomScale
      );
      setImagePanForOutput(clamped);
    },
    [clampImagePan, imageZoomScale, setImagePanForOutput]
  );

  const handleImagePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const dragState = imagePanDragRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      imagePanDragRef.current = null;
      setIsImagePanningForOutput(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [setIsImagePanningForOutput]
  );

  const handleDisplayedImageUrlChange = useCallback(
    (displayedUrl: string | null) => {
      if (!outputId || isErrorDetail) return;
      setReflectedPreviewByOutput((current) => {
        if (current?.outputId === outputId && current.url === displayedUrl) return current;
        return {
          outputId,
          url: displayedUrl,
        };
      });
    },
    [isErrorDetail, outputId]
  );

  const imageVesselClassName = [
    "art-image-vessel",
    isImageOutput ? "is-zoomable" : "",
    isImageZoomed ? "is-zoomed" : "",
    isImagePanning ? "is-panning" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const imageStyle = isImageOutput
    ? ({
        transform: `translate3d(${imagePan.x}px, ${imagePan.y}px, 0) scale(${imageZoomScale})`,
        transition: isImagePanning ? "none" : "transform 0.1s ease-out",
      } as React.CSSProperties)
    : undefined;

  const handleRequestDelete = useCallback(() => {
    onDeleteOutput(output.id);
    onClose();
  }, [onClose, onDeleteOutput, output.id]);
  const shouldShowWorkflowReloadAction = Boolean(
    onReloadWorkflowReference &&
    canReloadWorkflowOutput(output, { mediaKindHint: workflowReloadMediaKindHint })
  );

  const sharedMediaActionItems = useMemo<SharedMediaDetailActionItem[]>(
    () => [
      ...(shouldShowWorkflowReloadAction
        ? [
            {
              id: "reload-workflow",
              label: "",
              onClick: handleReloadWorkflowReference,
              ariaLabel: "Reload workflow",
              title: "Reload workflow",
              icon: <FlowArrow size={16} weight="bold" aria-hidden />,
              className: "is-icon-only",
            },
          ]
        : []),
      ...resolveSharedMediaDetailMediaActionItems({
        saveState: isMediaSaveButtonVisible ? mediaSaveState : "hidden",
        isStorageFull: isMediaStorageFull,
        onSaveToLibrary: handleSaveMediaReference,
        canDownload: Boolean(displayPreviewUrl && canDownloadReferenceMedia),
        onDownload: handleDownload,
        canDelete: true,
        onDelete: handleRequestDelete,
        deleteIcon: <TrashSimple size={16} weight="bold" aria-hidden />,
      }),
    ],
    [
      canDownloadReferenceMedia,
      displayPreviewUrl,
      handleDownload,
      handleReloadWorkflowReference,
      handleRequestDelete,
      handleSaveMediaReference,
      isMediaSaveButtonVisible,
      isMediaStorageFull,
      mediaSaveState,
      shouldShowWorkflowReloadAction,
    ]
  );

  const sharedPromptActionItems = useMemo<SharedMediaDetailActionItem[]>(
    () => [
      {
        id: "delete-prompt-output",
        label: "",
        onClick: handleRequestDelete,
        ariaLabel: "Delete",
        title: "Delete",
        intent: "danger",
        icon: <TrashSimple size={16} weight="bold" aria-hidden />,
        className: "is-icon-only",
      },
      ...(isPromptEditable || (detailModalItem.capabilities.canSavePrompt && onSavePrompt)
        ? [
            {
              id: "save-prompt",
              label: "",
              onClick: handleSaveTextDetail,
              ariaLabel: isPromptOnlySaved || isPromptLibrarySaved ? "Saved" : "Save",
              title: isPromptOnlySaved || isPromptLibrarySaved ? "Saved" : "Save",
              disabled:
                !trimmedPrompt ||
                isPromptOnlySaved ||
                isPromptLibrarySaved ||
                (!hasPromptEdits && !onSavePrompt),
              intent: "save" as const,
              state:
                isPromptOnlySaved || isPromptLibrarySaved
                  ? ("saved" as const)
                  : ("default" as const),
              icon: <FloppyDisk size={16} weight="bold" aria-hidden />,
              className: "is-icon-only",
            },
          ]
        : []),
    ],
    [
      detailModalItem.capabilities.canSavePrompt,
      handleSaveTextDetail,
      handleRequestDelete,
      hasPromptEdits,
      isPromptEditable,
      isPromptOnlySaved,
      isPromptLibrarySaved,
      onSavePrompt,
      trimmedPrompt,
    ]
  );

  return (
    <>
      <SharedMediaDetailModalShell
        isOpen={Boolean(output)}
        modalActivityId="detail-modal"
        onClose={handleCloseModal}
        ariaLabel="Reference details"
        closeOnEscape={true}
        backdropClassName="reference-modal-backdrop"
        dialogClassName={`reference-modal-new ${shouldUseTextDetailLayout ? "is-text-only" : ""} ${shouldUseExternalFileLayout ? "is-uploaded" : ""} ${shouldUseExternalFileLayout ? "is-stage-only" : ""} ${isAudioOutput ? "is-audio-modal" : ""}`}
        dialogStyle={detailModalStyle}
        backdropDecoration={
          reflectedPreviewUrl && !isErrorDetail ? (
            <div
              className="reference-modal-bg-reflect"
              style={{ backgroundImage: `url(${reflectedPreviewUrl})` }}
            />
          ) : null
        }
      >
        {/* Floating Top Bar (Controls) */}
        {!shouldUseTextDetailLayout ? (
          <SharedMediaDetailContentLayout
            topBar={
              <SharedMediaDetailTopBar
                eyebrow="Media detail"
                title={detailModalItem.presentation?.title ?? null}
                items={resolveSharedMediaDetailTopBarItems(detailModalItem)}
                centerTitle={shouldUseExternalFileLayout}
                actions={
                  <SharedMediaDetailActionBar
                    items={sharedMediaActionItems}
                    notice={
                      isMediaStorageFull && isMediaSaveButtonVisible ? (
                        <p className="tiny subdued">{MEDIA_STORAGE_FULL_USER_MESSAGE}</p>
                      ) : null
                    }
                  />
                }
                onClose={handleCloseModal}
              />
            }
            stageRef={imageVesselRef}
            stageClassName={imageVesselClassName}
            onStageWheel={isImageOutput ? handleImageWheel : undefined}
            onStageDoubleClick={isImageOutput ? handleImageDoubleClick : undefined}
            onStagePointerDown={isImageOutput ? handleImagePointerDown : undefined}
            onStagePointerMove={isImageOutput ? handleImagePointerMove : undefined}
            onStagePointerUp={isImageOutput ? handleImagePointerUp : undefined}
            onStagePointerCancel={isImageOutput ? handleImagePointerUp : undefined}
            stage={
              <>
                <SharedMediaDetailPreviewMedia
                  mediaUrl={displayPreviewUrl}
                  mediaKind={detailPreviewKind}
                  altText={displayPromptText}
                  isLoading={isDetailPreviewLoading}
                  imageClassName="art-hero-image"
                  videoClassName="art-hero-image"
                  audioClassName="art-hero-audio"
                  audioId={detailModalItem.media.id}
                  audioAssetKey={detailAudioAssetKey}
                  audioSourceMode={detailModalItem.media.audioSourceMode ?? null}
                  audioMusicMode={detailModalItem.media.musicMode ?? null}
                  audioLyricsText={detailModalItem.media.lyricsText ?? null}
                  audioDurationMs={detailModalItem.media.durationMs ?? null}
                  audioWaveformPeaks={detailModalItem.media.waveformPeaks ?? null}
                  audioBackgroundImageUrl={audioBackgroundImageUrl}
                  videoPosterUrl={detailVideoPosterUrl}
                  imageStyle={imageStyle}
                  videoStyle={aspectStyle}
                  videoRef={videoPreviewRef}
                  audioRef={audioPreviewRef}
                  videoLoop
                  videoMuted
                  imageIdentityKey={outputId}
                  onImageDragStart={(event) => event.preventDefault()}
                  onImageLoad={handleImageLoad}
                  onImageError={handleDetailImageError}
                  onImageCandidateError={handleDetailImageError}
                  onDisplayedImageUrlChange={handleDisplayedImageUrlChange}
                  onVideoLoadedMetadata={(event) => {
                    handlePreviewAspectLoad(
                      event.currentTarget.videoWidth,
                      event.currentTarget.videoHeight
                    );
                  }}
                  onVideoPlay={videoPreviewPlayback.handlePlay}
                  onVideoPause={videoPreviewPlayback.handlePause}
                  onVideoEnded={videoPreviewPlayback.handleEnded}
                  onVideoError={handleDetailVideoError}
                  onVideoVolumeChange={videoPreviewPlayback.handleVolumeChange}
                  onAudioPlay={audioPreviewPlayback.handlePlay}
                  onAudioRequestPlayback={audioPreviewPlayback.requestPlayback}
                  onAudioPause={audioPreviewPlayback.handlePause}
                  onAudioEnded={audioPreviewPlayback.handleEnded}
                  onAudioError={handleDetailAudioError}
                  onAudioVolumeChange={audioPreviewPlayback.handleVolumeChange}
                />
                {detailPreviewKind === "video" ? (
                  <SharedMediaDetailVideoSnapshotControl
                    videoRef={videoPreviewRef}
                    filenameHint={displayPromptText || output.id}
                    onSnapshotVideoFrame={onSnapshotVideoFrame}
                    onSnapshotVideoFrameError={onSnapshotVideoFrameError}
                  />
                ) : null}
              </>
            }
            sidePanel={
              shouldRenderDetailInfoPanel ? (
                <SharedMediaDetailInfoPanel
                  leadingContent={
                    <>
                      {hasCharacterContext ? (
                        <div
                          className="art-character-chip"
                          aria-label="Character used for generation"
                        >
                          {shouldRenderCharacterAvatar ? (
                            // Character profile URLs can be signed/external and are not guaranteed to be allowlisted.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              className="art-character-chip-avatar"
                              src={characterAvatarUrl ?? ""}
                              alt={`${characterName} profile`}
                              onLoad={() => {
                                clearAvatarFailure(characterAvatarRecoveryId);
                              }}
                              onError={() => {
                                void handleAvatarError({
                                  avatarId: characterAvatarRecoveryId,
                                  recoverAvatarUrl: refreshCharacterAvatar,
                                });
                              }}
                            />
                          ) : (
                            <span className="art-character-chip-avatar art-character-chip-avatar--fallback">
                              {characterInitials}
                            </span>
                          )}
                          <div className="art-character-chip-copy">
                            <span className="art-character-chip-label">
                              {characterLookName ? `Character · ${characterLookName}` : "Character"}
                            </span>
                            <span className="art-character-chip-name">{characterName}</span>
                          </div>
                        </div>
                      ) : null}
                      {hasStyleContext ? (
                        <div className="art-character-chip" aria-label="Style used for generation">
                          {shouldRenderStyleAvatar ? (
                            // Style previews can point to external URLs and signed Supabase assets.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              className="art-character-chip-avatar"
                              src={stylePreviewImageUrl ?? ""}
                              alt={`${styleName} style`}
                              onError={() => {
                                if (!outputId) return;
                                setStyleAvatarLoadErrorByOutput({ outputId, value: true });
                              }}
                            />
                          ) : (
                            <span className="art-character-chip-avatar art-character-chip-avatar--fallback art-character-chip-avatar--style">
                              {styleInitials}
                            </span>
                          )}
                          <div className="art-character-chip-copy">
                            <span className="art-character-chip-label">Style</span>
                            <span className="art-character-chip-name">{styleName}</span>
                          </div>
                        </div>
                      ) : null}
                    </>
                  }
                  label={bladeContent.label}
                  value={bladeContent.value}
                  readOnly={!isPromptEditable}
                  rows={3}
                  textareaRef={promptTextareaRef}
                  placeholder={resolveSharedMediaDetailBladePlaceholder(detailModalItem)}
                  onChange={handlePromptChange}
                  copyText={bladeContent.label === "PROMPT" ? bladeContent.value : null}
                  onPinPromptReference={onPinPromptReference}
                />
              ) : null
            }
          />
        ) : null}

        {shouldUseTextDetailLayout ? (
          <SharedMediaDetailContentLayout
            topBar={
              <SharedMediaDetailTopBar
                eyebrow={isErrorDetail ? "Error detail" : null}
                title={detailModalItem.presentation?.title ?? null}
                items={isErrorDetail ? resolveSharedMediaDetailTopBarItems(detailModalItem) : []}
                actions={
                  <SharedMediaDetailActionBar
                    items={sharedPromptActionItems}
                    notice={
                      isPromptOnlySaved ? (
                        <AppMessage
                          className="art-save-feedback"
                          tone="success"
                          mode="inline"
                          message="Changes saved successfully."
                        />
                      ) : null
                    }
                  />
                }
                onClose={handleCloseModal}
                closeLabel={isErrorDetail ? "Close error detail" : "Close text detail"}
              />
            }
            mainContentClassName="art-text-detail-main"
            stageClassName="art-image-vessel art-text-detail-vessel"
            stage={
              <div className="art-text-detail-textarea-shell">
                {!isErrorDetail && trimmedPrompt ? (
                  <PromptCopyButton
                    text={draftPrompt}
                    className="art-copy-prompt-btn--text-detail"
                  />
                ) : null}
                <textarea
                  className={`art-text-detail-textarea ${isPromptEditable ? "is-editing" : ""}`.trim()}
                  ref={promptOnlyTextareaRef}
                  value={isErrorDetail ? bladeContent.value : draftPrompt}
                  onChange={handlePromptChange}
                  readOnly={!isPromptEditable}
                  rows={12}
                  placeholder={
                    isErrorDetail
                      ? resolveSharedMediaDetailBladePlaceholder(detailModalItem)
                      : "Describe your adjustments..."
                  }
                />
              </div>
            }
          />
        ) : null}
      </SharedMediaDetailModalShell>
    </>
  );
}
