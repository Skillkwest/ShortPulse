/**
 * Video workflow asset-slot card for Kling Elements and Seedance 2 media inputs.
 */
import React from "react";
import { SpeakerHigh, Trash, UploadSimple, VideoCamera } from "phosphor-react";
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

const VIDEO_KLING_ELEMENT_SLOT_SIZE = 68;
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
  removeSelectedElement: (slotIndex: number) => void;
  elementPickerError: string | null;
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
  removeSelectedElement,
  elementPickerError,
}: VideoAssetSlotsCardProps) {
  return (
    <div className="video-setup-elements-slot">
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
            <span className="input-label video-shot-mode-label">Structure</span>
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
                const isImageDropActive = Boolean(seedanceElementImageDragActive[index]);
                const isImageLoading = Boolean(seedanceElementImageLoading[index]);
                const seedanceImageInputRef = seedanceElementImageInputRefs[index] ?? null;
                const previewUrl =
                  selectedElement?.profileImageUrl ??
                  getAiStudioKlingElementReferenceUrls(
                    selectedElement ?? {
                      frontalImageUrl: "",
                      referenceImageUrls: "",
                    }
                  )[0] ??
                  null;
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

                if (!selectedElement) {
                  return (
                    <div
                      key={`video-element-slot-${index}`}
                      ref={(element) => {
                        seedanceElementSlotRefs.current[index] = element;
                      }}
                      className={`video-elements-placeholder-tile ${
                        isImageDropActive ? "is-dragging" : ""
                      } ${isImageLoading ? "is-loading" : ""}`.trim()}
                      onDragEnter={
                        canUseSeedanceImageIngress
                          ? handleSeedanceElementMediaDragEnter(index)
                          : undefined
                      }
                      onDragOver={
                        canUseSeedanceImageIngress
                          ? handleSeedanceElementMediaDragOver(index)
                          : undefined
                      }
                      onDragLeave={
                        canUseSeedanceImageIngress
                          ? handleSeedanceElementMediaDragLeave(index)
                          : undefined
                      }
                      onDrop={
                        canUseSeedanceImageIngress
                          ? handleSeedanceElementMediaDrop(index)
                          : undefined
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
                    }`.trim()}
                    draggable={Boolean(dragToken)}
                    onDragEnter={
                      canUseSeedanceImageIngress
                        ? handleSeedanceElementMediaDragEnter(index)
                        : undefined
                    }
                    onDragOver={
                      canUseSeedanceImageIngress
                        ? handleSeedanceElementMediaDragOver(index)
                        : undefined
                    }
                    onDragLeave={
                      canUseSeedanceImageIngress
                        ? handleSeedanceElementMediaDragLeave(index)
                        : undefined
                    }
                    onDrop={
                      canUseSeedanceImageIngress ? handleSeedanceElementMediaDrop(index) : undefined
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
