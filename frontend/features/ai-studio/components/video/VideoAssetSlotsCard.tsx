/**
 * Video workflow asset-slot card for Kling Elements and Seedance 2 media inputs.
 */
import React from "react";
import {
  DotsSixVertical,
  Pause,
  Play,
  SpeakerHigh,
  Trash,
  UploadSimple,
  VideoCamera,
} from "phosphor-react";
import { AppMessage } from "../../../../components/AppMessage";
import {
  getAiStudioKlingElementReferenceUrls,
  isPromptTokenEligibleKlingElement,
  isSeedanceAudioReferenceSlot,
  isSeedanceImageReferenceSlot,
  isSeedanceVideoReferenceSlot,
  resolveAiStudioKlingElementDisplayLabel,
  type AiStudioKlingElement,
} from "../../logic/klingElements";
import { setKlingElementPromptTokenDragData } from "../../logic/klingPromptReferences";
import { buildElementProfileImageBackgroundStyle } from "../../../elements-manager/logic/elementProfileImageTransform";
import { handleVideoSegmentedTabListKeyDown } from "./videoSegmentedTabs";
import { getSignedMediaUrlsBatch } from "../../../../lib/mediaSignedUrlCache";
import { INTERNAL_MEDIA_REF_BUCKET } from "../../../../lib/media/internalMediaRefs";
import { resolveInternalMediaRefForUrl } from "../../logic/referenceInputInternalMediaRegistry";
import type { VideoElementSlotReorderPlacement } from "./useVideoElementSlotsController";

const VIDEO_KLING_ELEMENT_SLOT_SIZE = 68;
export const VIDEO_ELEMENT_SLOT_REORDER_TRANSFER_MIME =
  "application/x-shortpulse-video-asset-slot-index";
const SHOT_MODE_TAB_VALUES = ["single", "multi"] as const;
const SEEDANCE_REFERENCE_MODE_TAB_VALUES = ["elements", "keyframes"] as const;

type ShotMode = (typeof SHOT_MODE_TAB_VALUES)[number];
type SeedanceReferenceMode = (typeof SEEDANCE_REFERENCE_MODE_TAB_VALUES)[number];

type VideoAssetSlotsCardProps = {
  isSeedance2FamilyModelSelected: boolean;
  shouldShowShotModeSelector: boolean;
  visibleShotMode: ShotMode;
  shotModeTabCount: number;
  handleSetKlingWorkflowMode: (mode: ShotMode) => void;
  seedanceReferenceMode: SeedanceReferenceMode;
  handleSetSeedanceReferenceMode: (mode: SeedanceReferenceMode) => void;
  referenceMediaStep: React.ReactNode;
  renderPromptTokenPicker: (target: string) => React.ReactNode;
  activePromptTarget: string;
  seedanceSlotLimitWarning: string | null;
  klingElementSlotCount: number;
  modelVisibleKlingElements: Array<AiStudioKlingElement | null>;
  klingElementCanonicalPromptTokens: string[];
  seedanceElementImageDragActive: boolean[];
  seedanceElementImageLoading: boolean[];
  seedanceElementImageInputRefs: Array<{ current: HTMLInputElement | null }>;
  seedanceElementSlotRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  handleSeedanceElementMediaDragEnter: (
    index: number
  ) => (event: React.DragEvent<HTMLDivElement>) => void;
  handleSeedanceElementMediaDragOver: (
    index: number
  ) => (event: React.DragEvent<HTMLDivElement>) => void;
  handleSeedanceElementMediaDragLeave: (
    index: number
  ) => (event: React.DragEvent<HTMLDivElement>) => void;
  handleSeedanceElementMediaDrop: (
    index: number
  ) => (event: React.DragEvent<HTMLDivElement>) => void;
  handleSeedanceElementMediaFileSelection: (
    index: number
  ) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  openElementPicker: (slotIndex: number) => void;
  reorderSelectedElementSlot: (
    sourceSlotIndex: number,
    targetSlotIndex: number,
    placement?: VideoElementSlotReorderPlacement
  ) => void;
  removeSelectedElement: (slotIndex: number) => void;
  elementPickerError: string | null;
};

type SeedanceSlotPreviewSigningRequest = {
  sourceUrl: string;
  storagePath: string;
};

const resolveSeedanceSlotPreviewSourceUrl = (element: AiStudioKlingElement | null): string | null =>
  element?.profileImageUrl ??
  getAiStudioKlingElementReferenceUrls(
    element ?? {
      frontalImageUrl: "",
      referenceImageUrls: "",
    }
  )[0] ??
  null;

const hasVideoElementSlotReorderData = (dataTransfer: DataTransfer): boolean =>
  Array.from(dataTransfer.types ?? []).includes(VIDEO_ELEMENT_SLOT_REORDER_TRANSFER_MIME);

const resolveSlotReorderPlacement = (
  event: React.DragEvent<HTMLElement>,
  isTargetEmpty: boolean
): VideoElementSlotReorderPlacement => {
  if (isTargetEmpty) return "replace";
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientX < rect.left + rect.width / 2 ? "before" : "after";
};

/**
 * Renders the Video asset-slot controls while the parent keeps selection and upload state.
 */
export function VideoAssetSlotsCard({
  isSeedance2FamilyModelSelected,
  shouldShowShotModeSelector,
  visibleShotMode,
  shotModeTabCount,
  handleSetKlingWorkflowMode,
  seedanceReferenceMode,
  handleSetSeedanceReferenceMode,
  referenceMediaStep,
  renderPromptTokenPicker,
  activePromptTarget,
  seedanceSlotLimitWarning,
  klingElementSlotCount,
  modelVisibleKlingElements,
  klingElementCanonicalPromptTokens,
  seedanceElementImageDragActive,
  seedanceElementImageLoading,
  seedanceElementImageInputRefs,
  seedanceElementSlotRefs,
  handleSeedanceElementMediaDragEnter,
  handleSeedanceElementMediaDragOver,
  handleSeedanceElementMediaDragLeave,
  handleSeedanceElementMediaDrop,
  handleSeedanceElementMediaFileSelection,
  openElementPicker,
  reorderSelectedElementSlot,
  removeSelectedElement,
  elementPickerError,
}: VideoAssetSlotsCardProps) {
  const audioPreviewElementRef = React.useRef<HTMLAudioElement | null>(null);
  const [playingAudioPreviewUrl, setPlayingAudioPreviewUrl] = React.useState<string | null>(null);
  const [slotReorderState, setSlotReorderState] = React.useState<{
    sourceIndex: number;
    targetIndex: number | null;
    placement: VideoElementSlotReorderPlacement;
  } | null>(null);
  const [signedSeedanceSlotPreviewUrls, setSignedSeedanceSlotPreviewUrls] = React.useState<
    Record<string, string>
  >({});
  const seedanceSlotPreviewSigningRequests = React.useMemo(
    () =>
      Array.from(
        modelVisibleKlingElements
          .reduce<Map<string, SeedanceSlotPreviewSigningRequest>>((requests, element) => {
            if (!isSeedanceImageReferenceSlot(element)) return requests;
            const sourceUrl = resolveSeedanceSlotPreviewSourceUrl(element);
            const internalMediaRef = resolveInternalMediaRefForUrl(sourceUrl);
            if (
              !sourceUrl ||
              !internalMediaRef?.storagePath ||
              internalMediaRef.bucket !== INTERNAL_MEDIA_REF_BUCKET
            ) {
              return requests;
            }
            requests.set(sourceUrl, {
              sourceUrl,
              storagePath: internalMediaRef.storagePath,
            });
            return requests;
          }, new Map<string, SeedanceSlotPreviewSigningRequest>())
          .values()
      ),
    [modelVisibleKlingElements]
  );

  React.useEffect(() => {
    if (!seedanceSlotPreviewSigningRequests.length) return;
    let cancelled = false;

    getSignedMediaUrlsBatch({
      bucket: INTERNAL_MEDIA_REF_BUCKET,
      storagePaths: seedanceSlotPreviewSigningRequests.map((request) => request.storagePath),
      previewProfile: "none",
      surface: "reference-grid",
    })
      .then((signedByPath) => {
        if (cancelled) return;
        setSignedSeedanceSlotPreviewUrls((current) => {
          let changed = false;
          const next = { ...current };
          seedanceSlotPreviewSigningRequests.forEach((request) => {
            const signedUrl = signedByPath.get(request.storagePath);
            if (!signedUrl || next[request.sourceUrl] === signedUrl) return;
            next[request.sourceUrl] = signedUrl;
            changed = true;
          });
          return changed ? next : current;
        });
      })
      .catch(() => {
        // Keep the original URL visible if refresh signing is temporarily unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [seedanceSlotPreviewSigningRequests]);

  React.useEffect(
    () => () => {
      if (audioPreviewElementRef.current?.paused === false) {
        audioPreviewElementRef.current.pause();
      }
    },
    []
  );

  React.useEffect(() => {
    if (!playingAudioPreviewUrl) return;
    const audioPreviewElement = audioPreviewElementRef.current;
    if (!audioPreviewElement) return;
    const playResult = audioPreviewElement.play();
    void playResult.catch(() => {
      setPlayingAudioPreviewUrl(null);
    });
  }, [playingAudioPreviewUrl]);

  const toggleAudioPreview = React.useCallback(
    (audioUrl: string) => {
      const normalizedAudioUrl = audioUrl.trim();
      if (!normalizedAudioUrl) return;
      const audioPreviewElement = audioPreviewElementRef.current;

      if (playingAudioPreviewUrl === normalizedAudioUrl && audioPreviewElement?.paused === false) {
        audioPreviewElement.pause();
        setPlayingAudioPreviewUrl(null);
        return;
      }

      setPlayingAudioPreviewUrl(normalizedAudioUrl);
    },
    [playingAudioPreviewUrl]
  );

  const updateSlotReorderTarget = React.useCallback(
    (event: React.DragEvent<HTMLElement>, targetIndex: number, isTargetEmpty: boolean) => {
      if (!hasVideoElementSlotReorderData(event.dataTransfer) && !slotReorderState) return false;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      const rawSourceIndex = event.dataTransfer.getData(VIDEO_ELEMENT_SLOT_REORDER_TRANSFER_MIME);
      const parsedSourceIndex = Number.parseInt(rawSourceIndex, 10);
      const sourceIndex = Number.isInteger(parsedSourceIndex)
        ? parsedSourceIndex
        : slotReorderState?.sourceIndex;
      if (typeof sourceIndex !== "number" || !Number.isInteger(sourceIndex)) return true;
      if (sourceIndex === targetIndex) return true;
      setSlotReorderState({
        sourceIndex,
        targetIndex,
        placement: resolveSlotReorderPlacement(event, isTargetEmpty),
      });
      return true;
    },
    [slotReorderState]
  );

  const handleSlotReorderDrop = React.useCallback(
    (event: React.DragEvent<HTMLElement>, targetIndex: number, isTargetEmpty: boolean) => {
      if (!hasVideoElementSlotReorderData(event.dataTransfer)) return false;
      event.preventDefault();
      event.stopPropagation();
      const rawSourceIndex = event.dataTransfer.getData(VIDEO_ELEMENT_SLOT_REORDER_TRANSFER_MIME);
      const sourceIndex = Number.parseInt(rawSourceIndex, 10);
      if (Number.isInteger(sourceIndex) && sourceIndex !== targetIndex) {
        reorderSelectedElementSlot(
          sourceIndex,
          targetIndex,
          resolveSlotReorderPlacement(event, isTargetEmpty)
        );
      }
      setSlotReorderState(null);
      return true;
    },
    [reorderSelectedElementSlot]
  );

  const handleSlotReorderKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, sourceIndex: number) => {
      const columnCount = 3;
      const directionByKey: Record<string, number> = {
        ArrowLeft: -1,
        ArrowRight: 1,
        ArrowUp: -columnCount,
        ArrowDown: columnCount,
      };
      const delta = directionByKey[event.key];
      if (!delta) return;
      const targetIndex = sourceIndex + delta;
      if (targetIndex < 0 || targetIndex >= klingElementSlotCount) return;
      event.preventDefault();
      const placement: VideoElementSlotReorderPlacement = modelVisibleKlingElements[targetIndex]
        ? delta > 0
          ? "after"
          : "before"
        : "replace";
      reorderSelectedElementSlot(sourceIndex, targetIndex, placement);
    },
    [klingElementSlotCount, modelVisibleKlingElements, reorderSelectedElementSlot]
  );

  return (
    <div className="video-setup-elements-slot">
      <audio
        ref={audioPreviewElementRef}
        src={playingAudioPreviewUrl ?? undefined}
        preload="none"
        className="sr-only"
        onEnded={() => setPlayingAudioPreviewUrl(null)}
        onError={() => setPlayingAudioPreviewUrl(null)}
      />
      <div
        className={`step-card video-elements-card ${
          isSeedance2FamilyModelSelected ? "video-elements-card--seedance" : ""
        }`.trim()}
      >
        <div className="video-elements-card-title video-elements-card-title--large">
          {isSeedance2FamilyModelSelected ? "Seedance 2 Settings" : "Elements"}
        </div>
        {shouldShowShotModeSelector ? (
          <div className="video-shot-mode-section video-elements-shot-mode-section">
            <span className="input-label video-shot-mode-label">Shot Type</span>
            <div
              className={`video-shot-mode-tabs ${
                isSeedance2FamilyModelSelected ? "video-shot-mode-tabs--compact" : ""
              }`.trim()}
              role="tablist"
              aria-label="Video structure"
              onKeyDown={(event) =>
                handleVideoSegmentedTabListKeyDown(
                  event,
                  visibleShotMode === "multi" ? 1 : 0,
                  SHOT_MODE_TAB_VALUES.length,
                  (index) => handleSetKlingWorkflowMode(SHOT_MODE_TAB_VALUES[index])
                )
              }
              style={
                {
                  "--video-shot-mode-slots": shotModeTabCount,
                  "--video-shot-mode-index": visibleShotMode === "multi" ? 1 : 0,
                } as React.CSSProperties
              }
            >
              <span className="video-shot-mode-indicator" aria-hidden="true" />
              <button
                type="button"
                role="tab"
                aria-selected={visibleShotMode === "single"}
                tabIndex={visibleShotMode === "single" ? 0 : -1}
                aria-label="Single shot"
                className={`video-shot-mode-tab ${visibleShotMode === "single" ? "is-active" : ""}`}
                onClick={() => handleSetKlingWorkflowMode("single")}
              >
                Single
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={visibleShotMode === "multi"}
                tabIndex={visibleShotMode === "multi" ? 0 : -1}
                aria-label="Multi-shot"
                className={`video-shot-mode-tab ${visibleShotMode === "multi" ? "is-active" : ""}`}
                onClick={() => handleSetKlingWorkflowMode("multi")}
              >
                Multi
              </button>
            </div>
          </div>
        ) : null}
        {isSeedance2FamilyModelSelected ? (
          <div className="video-shot-mode-section video-elements-shot-mode-section">
            <span className="input-label video-shot-mode-label">Input type</span>
            <div
              className="video-shot-mode-tabs video-shot-mode-tabs--compact"
              role="tablist"
              aria-label="Seedance input type"
              onKeyDown={(event) =>
                handleVideoSegmentedTabListKeyDown(
                  event,
                  seedanceReferenceMode === "elements" ? 0 : 1,
                  SEEDANCE_REFERENCE_MODE_TAB_VALUES.length,
                  (index) =>
                    handleSetSeedanceReferenceMode(SEEDANCE_REFERENCE_MODE_TAB_VALUES[index])
                )
              }
              style={
                {
                  "--video-shot-mode-slots": 2,
                  "--video-shot-mode-index": seedanceReferenceMode === "elements" ? 0 : 1,
                } as React.CSSProperties
              }
            >
              <span className="video-shot-mode-indicator" aria-hidden="true" />
              <button
                type="button"
                role="tab"
                aria-selected={seedanceReferenceMode === "elements"}
                tabIndex={seedanceReferenceMode === "elements" ? 0 : -1}
                aria-label="Assets"
                className={`video-shot-mode-tab ${
                  seedanceReferenceMode === "elements" ? "is-active" : ""
                }`}
                onClick={() => handleSetSeedanceReferenceMode("elements")}
              >
                Assets
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={seedanceReferenceMode === "keyframes"}
                tabIndex={seedanceReferenceMode === "keyframes" ? 0 : -1}
                aria-label="Frames"
                className={`video-shot-mode-tab ${
                  seedanceReferenceMode === "keyframes" ? "is-active" : ""
                }`}
                onClick={() => handleSetSeedanceReferenceMode("keyframes")}
              >
                Frames
              </button>
            </div>
          </div>
        ) : null}
        {isSeedance2FamilyModelSelected && seedanceReferenceMode === "keyframes" ? (
          <div className="video-setup-reference-slot video-setup-reference-slot--seedance">
            {referenceMediaStep}
          </div>
        ) : null}
        {!isSeedance2FamilyModelSelected || seedanceReferenceMode === "elements" ? (
          <div className="video-kling-elements-picker-anchor">
            {renderPromptTokenPicker(activePromptTarget)}
            <div className="video-elements-card-title video-elements-card-title--sub">
              Add Assets
            </div>
            {seedanceSlotLimitWarning ? (
              <AppMessage
                tone="warning"
                className="video-inline-warning-bubble video-seedance-slot-limit-warning"
              >
                {seedanceSlotLimitWarning}
              </AppMessage>
            ) : null}
            <div className="video-elements-placeholder-grid" aria-label="Element reference slots">
              {Array.from({ length: klingElementSlotCount }).map((_, index) => {
                const selectedElement = modelVisibleKlingElements[index] ?? null;
                const canUseSeedanceImageIngress =
                  isSeedance2FamilyModelSelected && seedanceReferenceMode === "elements";
                const isReferenceImageSlot = isSeedanceImageReferenceSlot(selectedElement);
                const isReferenceVideoSlot = isSeedanceVideoReferenceSlot(selectedElement);
                const isReferenceAudioSlot = isSeedanceAudioReferenceSlot(selectedElement);
                const audioPreviewUrl =
                  isReferenceAudioSlot && selectedElement?.audioUrl
                    ? selectedElement.audioUrl.trim()
                    : "";
                const isAudioPreviewPlaying =
                  Boolean(audioPreviewUrl) && playingAudioPreviewUrl === audioPreviewUrl;
                const isImageDropActive = Boolean(seedanceElementImageDragActive[index]);
                const isImageLoading = Boolean(seedanceElementImageLoading[index]);
                const seedanceImageInputRef = seedanceElementImageInputRefs[index] ?? null;
                const previewSourceUrl = resolveSeedanceSlotPreviewSourceUrl(selectedElement);
                const previewUrl = previewSourceUrl
                  ? (signedSeedanceSlotPreviewUrls[previewSourceUrl] ?? previewSourceUrl)
                  : null;
                const previewAvatarStyle = previewUrl
                  ? buildElementProfileImageBackgroundStyle(
                      previewUrl,
                      selectedElement?.profileImageTransform ?? null,
                      VIDEO_KLING_ELEMENT_SLOT_SIZE
                    )
                  : undefined;
                const dragToken =
                  selectedElement && isPromptTokenEligibleKlingElement(selectedElement)
                    ? (klingElementCanonicalPromptTokens[index] ?? "")
                    : "";
                const openMediaFilePicker = () => {
                  seedanceImageInputRef?.current?.click();
                };
                const reorderTargetClass =
                  slotReorderState?.targetIndex === index
                    ? `is-slot-reorder-target is-slot-reorder-target--${slotReorderState.placement}`
                    : "";
                const reorderSourceClass =
                  slotReorderState?.sourceIndex === index ? "is-slot-reorder-source" : "";

                if (!selectedElement) {
                  return (
                    <div
                      key={`video-element-slot-${index}`}
                      ref={(element) => {
                        seedanceElementSlotRefs.current[index] = element;
                      }}
                      className={`video-elements-placeholder-tile ${
                        isImageDropActive ? "is-dragging" : ""
                      } ${isImageLoading ? "is-loading" : ""} ${reorderTargetClass}`.trim()}
                      onDragEnter={
                        canUseSeedanceImageIngress
                          ? (event) => {
                              if (updateSlotReorderTarget(event, index, true)) return;
                              handleSeedanceElementMediaDragEnter(index)(event);
                            }
                          : (event) => {
                              updateSlotReorderTarget(event, index, true);
                            }
                      }
                      onDragOver={
                        canUseSeedanceImageIngress
                          ? (event) => {
                              if (updateSlotReorderTarget(event, index, true)) return;
                              handleSeedanceElementMediaDragOver(index)(event);
                            }
                          : (event) => {
                              updateSlotReorderTarget(event, index, true);
                            }
                      }
                      onDragLeave={
                        canUseSeedanceImageIngress
                          ? (event) => {
                              setSlotReorderState((current) =>
                                current?.targetIndex === index ? null : current
                              );
                              handleSeedanceElementMediaDragLeave(index)(event);
                            }
                          : () => {
                              setSlotReorderState((current) =>
                                current?.targetIndex === index ? null : current
                              );
                            }
                      }
                      onDrop={
                        canUseSeedanceImageIngress
                          ? (event) => {
                              if (handleSlotReorderDrop(event, index, true)) return;
                              handleSeedanceElementMediaDrop(index)(event);
                            }
                          : (event) => {
                              handleSlotReorderDrop(event, index, true);
                            }
                      }
                      aria-label={`Add element to slot ${index + 1}`}
                    >
                      <button
                        type="button"
                        className="video-elements-placeholder-select video-elements-placeholder-select--empty"
                        onClick={() => openElementPicker(index)}
                        aria-label={`Add element to slot ${index + 1}`}
                      >
                        <span className="video-elements-placeholder-plus" aria-hidden="true">
                          +
                        </span>
                      </button>
                      {canUseSeedanceImageIngress ? (
                        <>
                          <input
                            ref={(element) => {
                              if (seedanceImageInputRef) {
                                seedanceImageInputRef.current = element;
                              }
                            }}
                            type="file"
                            accept="image/*,video/*,audio/*"
                            className="sr-only"
                            tabIndex={-1}
                            onChange={handleSeedanceElementMediaFileSelection(index)}
                          />
                          <button
                            type="button"
                            className="video-elements-slot-upload"
                            aria-label={`Upload media reference to slot ${index + 1}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              openMediaFilePicker();
                            }}
                          >
                            <UploadSimple size={12} />
                          </button>
                        </>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <div
                    key={`video-element-slot-${index}`}
                    ref={(element) => {
                      seedanceElementSlotRefs.current[index] = element;
                    }}
                    className={`video-elements-placeholder-tile video-elements-placeholder-tile--filled ${
                      selectedElement.sourceKind === "character"
                        ? "video-elements-placeholder-tile--character"
                        : isReferenceImageSlot
                          ? "video-elements-placeholder-tile--reference-image"
                          : isReferenceVideoSlot
                            ? "video-elements-placeholder-tile--reference-video"
                            : isReferenceAudioSlot
                              ? "video-elements-placeholder-tile--reference-audio"
                              : "video-elements-placeholder-tile--element"
                    } ${isImageDropActive ? "is-dragging" : ""} ${
                      isImageLoading ? "is-loading" : ""
                    } ${reorderSourceClass} ${reorderTargetClass}`.trim()}
                    draggable={Boolean(dragToken)}
                    onDragEnter={
                      canUseSeedanceImageIngress
                        ? (event) => {
                            if (updateSlotReorderTarget(event, index, false)) return;
                            handleSeedanceElementMediaDragEnter(index)(event);
                          }
                        : (event) => {
                            updateSlotReorderTarget(event, index, false);
                          }
                    }
                    onDragOver={
                      canUseSeedanceImageIngress
                        ? (event) => {
                            if (updateSlotReorderTarget(event, index, false)) return;
                            handleSeedanceElementMediaDragOver(index)(event);
                          }
                        : (event) => {
                            updateSlotReorderTarget(event, index, false);
                          }
                    }
                    onDragLeave={
                      canUseSeedanceImageIngress
                        ? (event) => {
                            setSlotReorderState((current) =>
                              current?.targetIndex === index ? null : current
                            );
                            handleSeedanceElementMediaDragLeave(index)(event);
                          }
                        : () => {
                            setSlotReorderState((current) =>
                              current?.targetIndex === index ? null : current
                            );
                          }
                    }
                    onDrop={
                      canUseSeedanceImageIngress
                        ? (event) => {
                            if (handleSlotReorderDrop(event, index, false)) return;
                            handleSeedanceElementMediaDrop(index)(event);
                          }
                        : (event) => {
                            handleSlotReorderDrop(event, index, false);
                          }
                    }
                    onDragStart={(event) => {
                      if (!dragToken) return;
                      event.dataTransfer.effectAllowed = "copy";
                      setKlingElementPromptTokenDragData(event.dataTransfer, dragToken);
                    }}
                  >
                    <button
                      type="button"
                      className="video-elements-placeholder-select"
                      onClick={() => openElementPicker(index)}
                      aria-label={`Replace attached element ${resolveAiStudioKlingElementDisplayLabel(
                        selectedElement,
                        index,
                        modelVisibleKlingElements
                      )}`}
                    >
                      {previewUrl ? (
                        <span
                          className="video-elements-slot-avatar-image"
                          style={previewAvatarStyle}
                          aria-hidden="true"
                        />
                      ) : isReferenceVideoSlot ? (
                        <span className="video-elements-slot-video-preview" aria-hidden="true">
                          <VideoCamera size={22} />
                        </span>
                      ) : isReferenceAudioSlot ? (
                        <span className="video-elements-slot-audio-preview" aria-hidden="true">
                          <SpeakerHigh size={22} />
                        </span>
                      ) : null}
                    </button>
                    {audioPreviewUrl ? (
                      <button
                        type="button"
                        className="video-elements-slot-audio-play"
                        aria-label={`${isAudioPreviewPlaying ? "Pause" : "Play"} audio reference ${
                          selectedElement.name || index + 1
                        }`}
                        aria-pressed={isAudioPreviewPlaying}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleAudioPreview(audioPreviewUrl);
                        }}
                      >
                        {isAudioPreviewPlaying ? (
                          <Pause size={20} />
                        ) : (
                          <Play size={20} weight="fill" />
                        )}
                      </button>
                    ) : null}
                    {canUseSeedanceImageIngress ? (
                      <input
                        ref={(element) => {
                          if (seedanceImageInputRef) {
                            seedanceImageInputRef.current = element;
                          }
                        }}
                        type="file"
                        accept="image/*,video/*,audio/*"
                        className="sr-only"
                        tabIndex={-1}
                        onChange={handleSeedanceElementMediaFileSelection(index)}
                      />
                    ) : null}
                    <span className="video-elements-slot-actions">
                      <button
                        type="button"
                        className="ghost-btn mini video-elements-slot-reorder-handle"
                        draggable
                        aria-label={`Reorder attached element ${selectedElement.name || index + 1}`}
                        onDragStart={(event) => {
                          event.stopPropagation();
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            VIDEO_ELEMENT_SLOT_REORDER_TRANSFER_MIME,
                            String(index)
                          );
                          setSlotReorderState({
                            sourceIndex: index,
                            targetIndex: null,
                            placement: "replace",
                          });
                        }}
                        onDragEnd={() => setSlotReorderState(null)}
                        onKeyDown={(event) => handleSlotReorderKeyDown(event, index)}
                      >
                        <DotsSixVertical size={12} weight="bold" />
                      </button>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        aria-label={`Remove attached element ${selectedElement.name || index + 1}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeSelectedElement(index);
                        }}
                      >
                        <Trash size={12} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        {elementPickerError ? <p className="tiny helper-text">{elementPickerError}</p> : null}
      </div>
    </div>
  );
}
