/**
 * Detail modal for reference items (prompt/image/video/audio).
 * Supports prompt-only view and media preview with metadata.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TrashSimple } from "phosphor-react";
import {
  asCanonicalStoragePath,
  logAdaptiveDetailFullQualityUsed,
} from "../../../lib/adaptive-media";
import { StudioOutput } from "../types";
import { isAudioUrl, isVideoUrl, resolveModelLabel } from "../logic/stateParsers";
import { resolveStudioOutputMediaDisplayAuthority } from "../logic/referenceGridMedia";
import { downloadUrlToFile } from "../logic/referenceDownload";
import { createStudioOutputDetailModalItem } from "../logic/studioOutputDetailModal";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import { MEDIA_STORAGE_FULL_USER_MESSAGE } from "../../../lib/mediaStorageQuota";
import { resolveCustomerFacingModelLabel } from "../../../lib/customerFacingProviderText";
import { resolveExpertEditStyleById } from "./edit/expertEditStyles";
import { useAvatarResilience } from "../hooks/useAvatarResilience";
import {
  parseAspectToken,
  resolveClosestDisplayAspectToken,
  resolveClosestDisplayAspectTokenFromDimensions,
} from "../logic/displayAspectRatio";
import { useExclusiveSoundMediaElement } from "./shared/exclusiveSoundPlayback";
import { DetailModalContext } from "./detail-modal/detailModalPlatformTypes";
import {
  buildUniquePreviewCandidates,
  createPreviewSelectionState,
  type DetailPreviewSelectionState,
  isFullQualityDetailImageUrl,
  resolveCanonicalDetailAuthorityUrl,
  resolveDetailPreviewCandidates,
  resolveNextPreviewCandidateUrl,
} from "./detail-modal/detailModalPreviewAuthority";
import { SharedMediaDetailPreviewMedia } from "./detail-modal/SharedMediaDetailPreviewMedia";
import { SharedMediaDetailContentLayout } from "./detail-modal/SharedMediaDetailContentLayout";
import { SharedMediaDetailActionBar } from "./detail-modal/SharedMediaDetailActionBar";
import { SharedMediaDetailInfoPanel } from "./detail-modal/SharedMediaDetailInfoPanel";
import { SharedMediaDetailModalShell } from "./detail-modal/SharedMediaDetailModalShell";
import { resolveSharedMediaDetailMediaActionItems } from "./detail-modal/sharedMediaDetailActions";
import { SharedMediaDetailTopBar } from "./detail-modal/SharedMediaDetailTopBar";
import type {
  SharedMediaDetailActionItem,
  SharedMediaDetailTopBarItem,
} from "./detail-modal/detailModalPlatformTypes";
import {
  resolveSharedMediaDetailBladeContent,
  resolveSharedMediaDetailBladePlaceholder,
  resolveSharedMediaDetailTopBarItems,
} from "./detail-modal/sharedMediaDetailPresentation";

type DetailModalProps = {
  output: StudioOutput | null;
  context?: DetailModalContext | null;
  projectId?: string | null;
  onClose: () => void;
  onUpdatePrompt: (id: string, prompt: string) => void;
  onDeleteOutput: (id: string) => void;
  onDownloadReference?: (id: string) => void;
  onSaveReference?: (id: string) => void;
  isMediaStorageFull?: boolean;
  onSavePrompt?: (promptText: string) => void;
  refreshCharacterOptions?: () => Promise<
    Array<{ id: string; name: string; profileImageUrl: string | null }>
  >;
  resolveCharacterAvatarUrlById?: (characterId: string | null | undefined) => string | null;
};

/**
 * Renders the detail modal for a selected reference.
 */
export function DetailModal({
  output,
  context = null,
  projectId = null,
  onClose,
  onUpdatePrompt,
  onDeleteOutput,
  onDownloadReference,
  onSaveReference,
  isMediaStorageFull = false,
  onSavePrompt,
  refreshCharacterOptions,
  resolveCharacterAvatarUrlById,
}: DetailModalProps) {
  if (!output) return null;
  return (
    <DetailModalContent
      output={output}
      context={context}
      projectId={projectId}
      onClose={onClose}
      onUpdatePrompt={onUpdatePrompt}
      onDeleteOutput={onDeleteOutput}
      onDownloadReference={onDownloadReference}
      onSaveReference={onSaveReference}
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
  context = null,
  projectId = null,
  onClose,
  onUpdatePrompt,
  onDeleteOutput,
  onDownloadReference,
  onSaveReference,
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
  const promptOnlyCloseTimerRef = useRef<number | null>(null);
  const promptLibrarySavedTimerRef = useRef<number | null>(null);
  const audioPreviewPlayback = useExclusiveSoundMediaElement(
    `detail-modal-audio:${output.id}`,
    audioPreviewRef
  );
  const videoPreviewPlayback = useExclusiveSoundMediaElement(
    `detail-modal-video:${output.id}`,
    videoPreviewRef
  );
  const [deleteConfirmOutputId, setDeleteConfirmOutputId] = useState<string | null>(null);
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
  const [previewSelectionByOutput, setPreviewSelectionByOutput] =
    useState<DetailPreviewSelectionState>(() =>
      createPreviewSelectionState(output.id, resolveDetailPreviewCandidates(output))
    );
  const [resolvedCanonicalPreviewByOutput, setResolvedCanonicalPreviewByOutput] = useState<{
    outputId: string;
    url: string | null;
  } | null>(null);
  const [canonicalPreviewResolvingOutputId, setCanonicalPreviewResolvingOutputId] = useState<
    string | null
  >(null);
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

  const outputId = output?.id ?? null;
  const resolvedCanonicalPreviewUrl =
    resolvedCanonicalPreviewByOutput && resolvedCanonicalPreviewByOutput.outputId === outputId
      ? resolvedCanonicalPreviewByOutput.url
      : null;
  const detailMediaAuthority = useMemo(() => {
    if (!output) return null;
    return resolveStudioOutputMediaDisplayAuthority(
      {
        id: output.id,
        previewStoragePath: output.previewStoragePath,
        previewPosterStoragePath: output.previewPosterStoragePath,
        fullStoragePath: resolvedCanonicalPreviewUrl ?? output.fullStoragePath,
        mediaSource: output.mediaSource,
        generationId: output.generationId,
        taskId: output.taskId,
        taskState: output.taskState,
        savedMediaIds: output.savedMediaIds,
        mode: output.mode,
        previewUrl: output.previewUrl,
        previewPosterUrl: output.previewPosterUrl,
        resultUrls: output.resultUrls,
      },
      {
        strictPreviewLadder: true,
        adaptivePreviewQuality: false,
        surface: "detail-modal",
      }
    );
  }, [output, resolvedCanonicalPreviewUrl]);
  const preferredDetailMediaUrl =
    output.mode === "video" || output.mode === "audio"
      ? (detailMediaAuthority?.playableMediaUrl ?? null)
      : (detailMediaAuthority?.fullMediaUrl ?? detailMediaAuthority?.cardDisplayUrl ?? null);
  const detailVideoPosterUrl =
    output.mode === "video" ? (detailMediaAuthority?.posterPreviewUrl ?? null) : null;
  const canonicalAuthorityInput = useMemo(
    () => ({
      savedMediaIds: output.savedMediaIds,
      generationId: output.generationId,
      taskId: output.taskId,
      mediaSource: output.mediaSource,
      previewStoragePath: output.previewStoragePath,
      fullStoragePath: output.fullStoragePath,
      previewUrl: output.previewUrl,
      resultUrls: output.resultUrls,
    }),
    [
      output.fullStoragePath,
      output.generationId,
      output.mediaSource,
      output.previewStoragePath,
      output.previewUrl,
      output.resultUrls,
      output.savedMediaIds,
      output.taskId,
    ]
  );

  useEffect(() => {
    if (!output || !preferredDetailMediaUrl) return;
    logAdaptiveDetailFullQualityUsed({
      surface: "detail-modal",
      mediaKind: output.mode === "video" ? "video" : output.mode === "audio" ? "audio" : "image",
    });
  }, [output, preferredDetailMediaUrl]);
  const previewCandidates = useMemo(() => {
    return buildUniquePreviewCandidates([
      resolvedCanonicalPreviewUrl,
      preferredDetailMediaUrl,
      output.mode === "video" || output.mode === "audio"
        ? null
        : (detailMediaAuthority?.thumbnailPreviewUrl ?? null),
      output.mode === "video" || output.mode === "audio" ? null : output?.previewUrl,
      ...(output?.resultUrls ?? []),
    ]);
  }, [
    detailMediaAuthority?.thumbnailPreviewUrl,
    output.mode,
    output?.previewUrl,
    output?.resultUrls,
    preferredDetailMediaUrl,
    resolvedCanonicalPreviewUrl,
  ]);
  const fullQualityPromotionUrl = useMemo(() => {
    const hasExplicitFullStoragePath = Boolean(output?.fullStoragePath?.trim());
    return (
      [
        resolvedCanonicalPreviewUrl,
        hasExplicitFullStoragePath ? (detailMediaAuthority?.fullMediaUrl ?? null) : null,
      ].find((candidateUrl) => isFullQualityDetailImageUrl(candidateUrl)) ?? null
    );
  }, [detailMediaAuthority?.fullMediaUrl, output?.fullStoragePath, resolvedCanonicalPreviewUrl]);
  const previewSelection =
    previewSelectionByOutput && outputId && previewSelectionByOutput.outputId === outputId
      ? previewSelectionByOutput
      : null;
  const displayPreviewUrl = useMemo(() => {
    if (previewSelection?.currentUrl) {
      return previewSelection.currentUrl;
    }
    return (
      resolveNextPreviewCandidateUrl({
        currentUrl: null,
        previewCandidates,
        rejectedUrls: previewSelection?.rejectedUrls ?? [],
      }) ?? null
    );
  }, [previewCandidates, previewSelection]);
  useEffect(() => {
    if (!outputId) return;
    // Detail modal media should follow the highest-authority available candidate for the
    // selected output so restored/saved sessions can promote from compact previews to full media.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewSelectionByOutput((current) => {
      const rejectedUrls = current?.outputId === outputId ? current.rejectedUrls : [];
      const nextUrl = resolveNextPreviewCandidateUrl({
        currentUrl: null,
        previewCandidates,
        rejectedUrls,
      });
      if (!current || current.outputId !== outputId) {
        return {
          outputId,
          currentUrl: nextUrl,
          rejectedUrls,
        };
      }
      if (nextUrl === current.currentUrl) {
        return current;
      }
      const shouldPromoteToFullQuality =
        Boolean(nextUrl) && nextUrl === fullQualityPromotionUrl && current.currentUrl !== nextUrl;
      const rejectedUrlSet = new Set(rejectedUrls);
      const currentUrlWasRejected = Boolean(
        current.currentUrl && rejectedUrlSet.has(current.currentUrl)
      );
      const shouldPreserveCurrentUrl =
        Boolean(current.currentUrl) && !currentUrlWasRejected && !shouldPromoteToFullQuality;
      if (shouldPreserveCurrentUrl) {
        return current;
      }
      return {
        ...current,
        currentUrl: nextUrl,
      };
    });
  }, [fullQualityPromotionUrl, outputId, previewCandidates]);
  useEffect(() => {
    if (!outputId) return;
    let cancelled = false;
    // Keep the modal in a resolving state instead of showing a false unavailable verdict.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanonicalPreviewResolvingOutputId(outputId);
    setResolvedCanonicalPreviewByOutput((current) =>
      current?.outputId === outputId ? current : { outputId, url: null }
    );
    void (async () => {
      const nextUrl = await resolveCanonicalDetailAuthorityUrl(canonicalAuthorityInput, {
        projectId,
      });
      if (cancelled) return;
      setResolvedCanonicalPreviewByOutput({
        outputId,
        url: nextUrl,
      });
      setCanonicalPreviewResolvingOutputId((current) => (current === outputId ? null : current));
    })();
    return () => {
      cancelled = true;
    };
  }, [canonicalAuthorityInput, outputId, projectId]);
  useEffect(() => {
    if (!outputId || !resolvedCanonicalPreviewUrl) return;
    const hasRawStorageAuthority = Boolean(
      asCanonicalStoragePath(output.previewStoragePath) ||
      asCanonicalStoragePath(output.fullStoragePath)
    );
    if (!hasRawStorageAuthority) return;
    const legacyUrlCandidates = buildUniquePreviewCandidates([
      output.previewUrl,
      ...(output.resultUrls ?? []),
    ]);
    // The detail modal intentionally promotes canonical storage authority after it resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewSelectionByOutput((current) => {
      if (!current || current.outputId !== outputId) return current;
      if (current.currentUrl === resolvedCanonicalPreviewUrl) return current;
      if (current.currentUrl && !legacyUrlCandidates.includes(current.currentUrl)) {
        return current;
      }
      return {
        ...current,
        currentUrl: resolvedCanonicalPreviewUrl,
        rejectedUrls: current.rejectedUrls.filter((value) => value !== resolvedCanonicalPreviewUrl),
      };
    });
  }, [
    output.fullStoragePath,
    output.previewStoragePath,
    output.previewUrl,
    output.resultUrls,
    outputId,
    resolvedCanonicalPreviewUrl,
  ]);
  const isAudioOutput = Boolean(
    output?.mode === "audio" || (displayPreviewUrl && isAudioUrl(displayPreviewUrl))
  );
  const isVideoOutput = Boolean(
    !isAudioOutput &&
    output?.mode !== "image" &&
    (output?.mode === "video" || (displayPreviewUrl && isVideoUrl(displayPreviewUrl)))
  );
  const isImageOutput = Boolean(displayPreviewUrl) && !isVideoOutput && !isAudioOutput;
  const detailPreviewKind = displayPreviewUrl
    ? isVideoOutput
      ? "video"
      : isAudioOutput
        ? "audio"
        : "image"
    : null;
  const mediaType = displayPreviewUrl
    ? isAudioOutput
      ? "Audio"
      : isVideoOutput
        ? "Video"
        : "Image"
    : "Prompt";
  const isPromptOnly = output?.mode === "text" && !displayPreviewUrl;
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
    const fallbackStyleId = styleContext?.styleId?.trim() || null;
    const catalogStyle = resolveExpertEditStyleById(fallbackStyleId);
    const catalogPreviewUrl = catalogStyle?.previewUrl?.trim() || "";
    return catalogPreviewUrl || null;
  }, [styleContext?.styleId, styleContext?.stylePreviewImageUrl]);
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
    if (output?.id?.startsWith("upload-")) return true;
    if (output?.timestamp === "Dropped") return true;
    return false;
  }, [displayPreviewUrl, output?.id, output?.timestamp]);
  const isNonGeneratedLoadedMedia = useMemo(() => {
    if (!displayPreviewUrl || !output) return false;
    if (output.id.startsWith("library-")) return true;
    if (output.mediaSource) {
      return output.mediaSource !== "generated";
    }
    if (output.id.startsWith("upload-")) return true;
    if (output.id.startsWith("media-paste-")) return true;
    if (output.timestamp === "Dropped" || output.timestamp === "Library") return true;
    if (output.timestamp === "Clipboard") return true;
    return false;
  }, [displayPreviewUrl, output]);
  const normalizedAudioWorkflowLabel = useMemo(() => {
    const modelLabel = output?.model?.trim().toLowerCase() ?? "";
    const modelId = output?.modelId?.trim().toLowerCase() ?? "";
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
  }, [output?.model, output?.modelId]);
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
    output?.generationReplay?.displayPrompt?.trim() ||
    output?.previewText?.trim() ||
    output?.prompt ||
    "";
  const draftPrompt =
    outputId && output ? (draftPromptsById[outputId] ?? displayPromptText) : displayPromptText;
  const isDeleteConfirmOpen = Boolean(outputId && deleteConfirmOutputId === outputId);
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
  const canSave = useMemo(
    () => Boolean(trimmedPrompt) && (Boolean(onSavePrompt) || (isPromptEditable && hasPromptEdits)),
    [hasPromptEdits, isPromptEditable, onSavePrompt, trimmedPrompt]
  );
  const detailModalStyle = useMemo(() => {
    if (isPromptOnly) return undefined;
    if (!previewAspectRatio || !Number.isFinite(previewAspectRatio)) return undefined;
    return {
      "--detail-preview-aspect": String(previewAspectRatio),
    } as React.CSSProperties;
  }, [isPromptOnly, previewAspectRatio]);
  const isImageZoomed = imageZoomScale > 1.001;

  const tryAdvancePreviewCandidate = useCallback(() => {
    if (!outputId) return false;
    const currentUrl = previewSelection?.currentUrl ?? displayPreviewUrl;
    const rejectedUrls = previewSelection?.rejectedUrls ?? [];
    const nextUrl = resolveNextPreviewCandidateUrl({
      currentUrl,
      previewCandidates,
      rejectedUrls,
    });
    if (!nextUrl) {
      setPreviewSelectionByOutput((current) => {
        if (!current || current.outputId !== outputId) {
          return createPreviewSelectionState(
            outputId,
            previewCandidates,
            currentUrl ? [currentUrl] : []
          );
        }
        const nextRejectedUrls =
          currentUrl && !current.rejectedUrls.includes(currentUrl)
            ? [...current.rejectedUrls, currentUrl]
            : current.rejectedUrls;
        return {
          ...current,
          currentUrl: null,
          rejectedUrls: nextRejectedUrls,
        };
      });
      return false;
    }
    setPreviewSelectionByOutput({
      outputId,
      currentUrl: nextUrl,
      rejectedUrls: currentUrl ? [...rejectedUrls, currentUrl] : rejectedUrls,
    });
    return true;
  }, [displayPreviewUrl, outputId, previewCandidates, previewSelection]);

  const refreshCanonicalPreviewCandidate = useCallback(async () => {
    if (!outputId) return null;
    setCanonicalPreviewResolvingOutputId(outputId);
    const refreshedUrl = await resolveCanonicalDetailAuthorityUrl(canonicalAuthorityInput, {
      forceRefresh: true,
      projectId,
    });
    setCanonicalPreviewResolvingOutputId((current) => (current === outputId ? null : current));
    if (!refreshedUrl) return null;
    setResolvedCanonicalPreviewByOutput({
      outputId,
      url: refreshedUrl,
    });
    setPreviewSelectionByOutput((current) => {
      const rejectedUrls = current?.outputId === outputId ? current.rejectedUrls : [];
      return {
        outputId,
        currentUrl: refreshedUrl,
        rejectedUrls: rejectedUrls.filter((value) => value !== refreshedUrl),
      };
    });
    return refreshedUrl;
  }, [canonicalAuthorityInput, outputId, projectId]);

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

  const clearPromptOnlyCloseTimer = useCallback(() => {
    if (typeof window === "undefined") return;
    if (promptOnlyCloseTimerRef.current == null) return;
    window.clearTimeout(promptOnlyCloseTimerRef.current);
    promptOnlyCloseTimerRef.current = null;
  }, []);

  const clearPromptLibrarySavedTimer = useCallback(() => {
    if (typeof window === "undefined") return;
    if (promptLibrarySavedTimerRef.current == null) return;
    window.clearTimeout(promptLibrarySavedTimerRef.current);
    promptLibrarySavedTimerRef.current = null;
  }, []);

  useEffect(() => {
    syncTextareaHeight(promptTextareaRef.current);
    syncTextareaHeight(promptOnlyTextareaRef.current);
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
      clearPromptOnlyCloseTimer();
      clearPromptLibrarySavedTimer();
    };
  }, [clearPromptLibrarySavedTimer, clearPromptOnlyCloseTimer]);

  const handleCloseModal = useCallback(() => {
    clearPromptOnlyCloseTimer();
    clearPromptLibrarySavedTimer();
    setPromptOnlySavedOutputId(null);
    setPromptLibrarySavedOutputId(null);
    setDeleteConfirmOutputId(null);
    setImageZoomScaleByOutput(null);
    setImagePanByOutput(null);
    setImagePanningByOutput(null);
    setLoadedImageNaturalSize(null);
    setLoadedPreviewAspect(null);
    setResolvedCanonicalPreviewByOutput(null);
    setCanonicalPreviewResolvingOutputId(null);
    setPreviewSelectionByOutput(
      createPreviewSelectionState(output.id, resolveDetailPreviewCandidates(output))
    );
    imagePanDragRef.current = null;
    onClose();
  }, [clearPromptLibrarySavedTimer, clearPromptOnlyCloseTimer, onClose, output]);
  const looksLikeFilename = (value?: string | null) => {
    const candidate = value?.trim();
    if (!candidate) return false;
    if (candidate.length > 180) return false;
    if (/^data:/i.test(candidate) || /^blob:/i.test(candidate) || /^https?:\/\//i.test(candidate)) {
      return false;
    }
    if (/[\\/]/.test(candidate)) return false;
    return /\.[a-z0-9]{2,10}$/i.test(candidate);
  };

  const filenameFromUrl = (() => {
    if (!displayPreviewUrl) return null;
    try {
      const parsed = new URL(displayPreviewUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      const trailing = decodeURIComponent(
        parsed.pathname.split("/").filter(Boolean).pop() ?? ""
      ).trim();
      return looksLikeFilename(trailing) ? trailing : null;
    } catch {
      return null;
    }
  })();

  const outputPrompt = displayPromptText.trim() || null;
  const promptFilename = looksLikeFilename(outputPrompt) ? outputPrompt : null;
  const uploadedHeaderFilename = isUploadedReference ? (promptFilename ?? filenameFromUrl) : null;
  const shouldUseExternalFileLayout = Boolean(isUploadedReference && uploadedHeaderFilename);
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
    return resolveCustomerFacingModelLabel({
      model: output?.model,
      modelId: output?.modelId,
      resolveModelLabel,
      fallback: "",
    });
  }, [isUploadedReference, output?.model, output?.modelId]);
  const metaPillItems = useMemo(() => {
    if (shouldUseExternalFileLayout) {
      return [mediaType];
    }
    if (isActiveVoiceChangerSourceVideo) {
      return displayAspect ? ["voice changer", displayAspect] : ["voice changer"];
    }
    if (isGeneratedPureAudioOutput && normalizedAudioWorkflowLabel) {
      return [normalizedAudioWorkflowLabel];
    }
    if (isGeneratedVoiceChangerVideoOutput && normalizedAudioWorkflowLabel) {
      return displayAspect
        ? [normalizedAudioWorkflowLabel, displayAspect]
        : [normalizedAudioWorkflowLabel];
    }

    const items: string[] = [mediaType];
    if (!isNonGeneratedLoadedMedia && displayAspect) {
      items.push(displayAspect);
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
    displayAspect,
    isActiveVoiceChangerSourceVideo,
    isGeneratedPureAudioOutput,
    isGeneratedVoiceChangerVideoOutput,
    isNonGeneratedLoadedMedia,
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
          title:
            uploadedHeaderFilename ??
            displayPromptText.trim() ??
            output.previewText?.trim() ??
            output.id,
          kindLabel: mediaType.toLowerCase(),
          topBarItems: sharedTopBarItems,
          bladePlaceholder: generatedVoiceChangerTranscript
            ? "No transcript metadata available."
            : "No prompt metadata available.",
        },
      }),
    [
      displayPromptText,
      generatedVoiceChangerTranscript,
      mediaType,
      onSavePrompt,
      output,
      sharedTopBarItems,
      uploadedHeaderFilename,
    ]
  );

  const handleSavePrompt = useCallback(() => {
    if (!trimmedPrompt) return;
    if (isPromptEditable && output?.id && hasPromptEdits) {
      onUpdatePrompt(output.id, draftPrompt);
      return;
    }
    if (onSavePrompt) {
      onSavePrompt(draftPrompt);
    }
  }, [
    draftPrompt,
    hasPromptEdits,
    isPromptEditable,
    onSavePrompt,
    onUpdatePrompt,
    output,
    trimmedPrompt,
  ]);

  const handleSavePromptToLibrary = useCallback(() => {
    if (!trimmedPrompt || !onSavePrompt) return;
    onSavePrompt(draftPrompt);
    if (!outputId) return;
    setPromptLibrarySavedOutputId(outputId);
    if (typeof window === "undefined") return;
    clearPromptLibrarySavedTimer();
    promptLibrarySavedTimerRef.current = window.setTimeout(() => {
      setPromptLibrarySavedOutputId((current) => (current === outputId ? null : current));
      promptLibrarySavedTimerRef.current = null;
    }, 1400);
  }, [clearPromptLibrarySavedTimer, draftPrompt, onSavePrompt, outputId, trimmedPrompt]);

  const handlePromptOnlySaveAndClose = () => {
    if (!canSave || !isPromptEditable || isPromptOnlySaved) return;

    handleSavePrompt();
    if (outputId) {
      setPromptOnlySavedOutputId(outputId);
    }

    if (typeof window === "undefined") {
      handleCloseModal();
      return;
    }

    clearPromptOnlyCloseTimer();
    promptOnlyCloseTimerRef.current = window.setTimeout(() => {
      handleCloseModal();
    }, 900);
  };

  const handlePromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isPromptEditable || !outputId) return;
    const nextValue = event.target.value;
    setPromptOnlySavedOutputId(null);
    setPromptLibrarySavedOutputId(null);
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
    setDeleteConfirmOutputId(outputId);
  }, [outputId]);

  const handleCancelDelete = () => {
    setDeleteConfirmOutputId(null);
  };

  const handleConfirmDelete = () => {
    onDeleteOutput(output.id);
    setDeleteConfirmOutputId(null);
    handleCloseModal();
  };

  const sharedMediaActionItems = useMemo<SharedMediaDetailActionItem[]>(
    () =>
      resolveSharedMediaDetailMediaActionItems({
        saveState: isMediaSaveButtonVisible ? mediaSaveState : "hidden",
        isStorageFull: isMediaStorageFull,
        onSaveToLibrary: handleSaveMediaReference,
        canDownload: Boolean(displayPreviewUrl && canDownloadReferenceMedia),
        onDownload: handleDownload,
        canDelete: true,
        onDelete: handleRequestDelete,
        deleteIcon: <TrashSimple size={16} weight="bold" aria-hidden />,
      }),
    [
      canDownloadReferenceMedia,
      displayPreviewUrl,
      handleDownload,
      handleRequestDelete,
      handleSaveMediaReference,
      isMediaSaveButtonVisible,
      isMediaStorageFull,
      mediaSaveState,
    ]
  );

  const sharedPromptActionItems = useMemo<SharedMediaDetailActionItem[]>(
    () => [
      ...(detailModalItem.capabilities.canSavePrompt && onSavePrompt
        ? [
            {
              id: "save-prompt",
              label: isPromptLibrarySaved ? "Saved" : "Save Prompt",
              onClick: handleSavePromptToLibrary,
              disabled: !trimmedPrompt || isPromptLibrarySaved,
              intent: "save" as const,
              state: isPromptLibrarySaved ? ("saved" as const) : ("default" as const),
            },
          ]
        : []),
      {
        id: "delete-prompt-output",
        label: "Delete",
        onClick: handleRequestDelete,
        intent: "danger",
        icon: <TrashSimple size={16} weight="bold" aria-hidden />,
      },
    ],
    [
      detailModalItem.capabilities.canSavePrompt,
      handleRequestDelete,
      handleSavePromptToLibrary,
      isPromptLibrarySaved,
      onSavePrompt,
      trimmedPrompt,
    ]
  );

  return (
    <SharedMediaDetailModalShell
      isOpen={Boolean(output)}
      modalActivityId="detail-modal"
      onClose={handleCloseModal}
      ariaLabel="Reference details"
      backdropClassName="reference-modal-backdrop"
      dialogClassName={`reference-modal-new ${isPromptOnly ? "is-prompt-only" : ""} ${isUploadedReference ? "is-uploaded" : ""} ${shouldUseExternalFileLayout ? "is-stage-only" : ""} ${isAudioOutput ? "is-audio-modal" : ""}`}
      dialogStyle={detailModalStyle}
      backdropDecoration={
        displayPreviewUrl ? (
          <div
            className="reference-modal-bg-reflect"
            style={{ backgroundImage: `url(${displayPreviewUrl})` }}
          />
        ) : null
      }
    >
      {/* Floating Top Bar (Controls) */}
      {!isPromptOnly ? (
        <SharedMediaDetailContentLayout
          topBar={
            <SharedMediaDetailTopBar
              eyebrow="Media detail"
              title={detailModalItem.presentation?.title ?? displayPromptText}
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
            <SharedMediaDetailPreviewMedia
              mediaUrl={displayPreviewUrl}
              mediaKind={detailPreviewKind}
              altText={displayPromptText}
              isLoading={canonicalPreviewResolvingOutputId === outputId}
              imageClassName="art-hero-image"
              videoClassName="art-hero-image"
              audioClassName="art-hero-audio"
              videoPosterUrl={detailVideoPosterUrl}
              imageStyle={imageStyle}
              videoStyle={aspectStyle}
              videoRef={videoPreviewRef}
              audioRef={audioPreviewRef}
              videoLoop
              videoMuted
              onImageDragStart={(event) => event.preventDefault()}
              onImageLoad={handleImageLoad}
              onImageError={handleDetailImageError}
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
              onAudioPause={audioPreviewPlayback.handlePause}
              onAudioEnded={audioPreviewPlayback.handleEnded}
              onAudioError={handleDetailAudioError}
              onAudioVolumeChange={audioPreviewPlayback.handleVolumeChange}
            />
          }
          sidePanel={
            shouldUseExternalFileLayout ? null : (
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
              />
            )
          }
        />
      ) : null}

      {isPromptOnly && (
        <div className="art-prompt-only-header">
          <span className="reference-filename">Prompt</span>
          <div className="art-modal-action-row">
            <SharedMediaDetailActionBar items={sharedPromptActionItems} />
            <button type="button" className="art-close-btn" onClick={handleCloseModal}>
              ×
            </button>
          </div>
        </div>
      )}

      {isPromptOnly ? (
        <div className="art-modal-main-content">
          <div className="art-prompt-only-container">
            <textarea
              className="art-prompt-textarea large"
              ref={promptOnlyTextareaRef}
              value={draftPrompt}
              onChange={handlePromptChange}
              readOnly={!isPromptEditable}
              rows={12}
              placeholder="Describe your adjustments..."
            />
            <div className="art-modal-footer">
              <button
                type="button"
                className={`primary-btn wide art-prompt-save-btn ${isPromptOnlySaved ? "is-saved" : ""}`}
                onClick={handlePromptOnlySaveAndClose}
                disabled={!canSave || !isPromptEditable || isPromptOnlySaved}
              >
                {isPromptOnlySaved ? "Saved. Closing..." : "Save & Apply Changes"}
              </button>
              {isPromptOnlySaved ? (
                <p className="art-save-feedback" role="status" aria-live="polite">
                  Changes saved successfully.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {isDeleteConfirmOpen ? (
        <ConfirmationModal
          title="Delete this reference?"
          body={<p>This reference will be removed permanently.</p>}
          confirmLabel="Delete"
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </SharedMediaDetailModalShell>
  );
}
