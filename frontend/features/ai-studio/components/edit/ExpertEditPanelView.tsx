import Image from "next/image";
import React from "react";
import {
  ArrowsOutCardinal,
  CaretRight,
  CircleDashed,
  CircleHalf,
  Eraser,
  GearSix,
  MagicWand,
  PaintBrush,
  PaintBrushBroad,
  Plus,
  PlusCircle,
  Sliders,
  Sparkle,
  StackSimple,
  Sticker,
  TrashSimple,
  UploadSimple,
} from "phosphor-react";
import { AgentGenerateButton } from "../../../../prefabs/agent";
import type { AspectOption } from "../../types";
import { modelLogos } from "../../constants";
import type { ModelModalContext } from "../ModelModal";
import { AspectDropdown } from "../AspectDropdown";
import { ResolutionDropdown } from "../ResolutionDropdown";
import { stripEditLabel } from "../../utils/modelLabels";
import { useReferencePropertiesConstraintEffects } from "../useReferencePropertiesConstraintEffects";
import { useReferencePropertiesDerivedState } from "../useReferencePropertiesDerivedState";
import { useReferencePropertiesInteractions } from "../useReferencePropertiesInteractions";
import {
  getCreateCharacterInitials,
  type CreateCharacterOption,
  useCreateCharacterModeController,
} from "../create/useCreateCharacterModeController";

export type ExpertEditPanelViewProps = {
  expertEditEligible: boolean;
  aspect: string;
  modelId: string | null;
  modelLabel: string;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  referenceText: string | null;
  imageResolution?: string;
  aspectOptions: AspectOption[];
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (
    anchorId: string,
    target: HTMLElement,
    context?: ModelModalContext | null
  ) => void;
  onPrimaryImageChange: (url: string | null) => void;
  onExtraImageChange: (index: number, url: string | null) => void;
  onPromptTextChange: (value: string) => void;
  onRegenerate: () => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  costCredits?: number | null;
  isGenerateDisabled?: boolean;
  isGenerateBusy?: boolean;
  referenceImageWarning?: string | null;
  onImageResolutionChange?: (value: string) => void;
  characterOptions?: CreateCharacterOption[];
  selectedCharacterId?: string;
  onSelectedCharacterIdChange?: (value: string) => void;
  isCharacterOptionsLoading?: boolean;
  characterModeEnabled?: boolean;
  onCharacterModeEnabledChange?: (value: boolean) => void;
};

type CharacterPickerModalProps = {
  isOpen: boolean;
  characterModeEnabled: boolean;
  onClose: () => void;
  characterOptions: CreateCharacterOption[];
  selectedCharacterId: string;
  onSelectedCharacterIdChange?: (value: string) => void;
};

const CharacterPickerModal = ({
  isOpen,
  characterModeEnabled,
  onClose,
  characterOptions,
  selectedCharacterId,
  onSelectedCharacterIdChange,
}: CharacterPickerModalProps) => {
  if (!isOpen || !characterModeEnabled) {
    return null;
  }

  return (
    <>
      <div className="model-modal-backdrop ai-character-picker-backdrop" onClick={onClose} />
      <div
        className="model-modal ai-character-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Choose character"
      >
        <div className="model-modal-header">
          <div className="model-modal-title-group">
            <h3 className="model-modal-title">Character Picker</h3>
            <p className="model-modal-subtitle">
              Select a character profile from Character Manager.
            </p>
          </div>
          <button
            type="button"
            className="ghost-btn mini model-modal-close"
            aria-label="Close character picker"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="model-modal-scroll">
          {characterOptions.length > 0 ? (
            <div className="ai-character-picker-grid" role="list" aria-label="Character options">
              {characterOptions.map((option) => {
                const isActive = option.id === selectedCharacterId;
                return (
                  <article
                    key={option.id}
                    role="listitem"
                    className={`ai-character-list-card ai-character-picker-card ${
                      isActive ? "is-active" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="ai-character-list-select-btn"
                      aria-pressed={isActive}
                      onClick={() => {
                        onSelectedCharacterIdChange?.(option.id);
                        onClose();
                      }}
                    >
                      <div className="ai-character-list-main">
                        <span className="ai-character-list-avatar" aria-hidden="true">
                          {option.profileImageUrl ? (
                            <Image
                              src={option.profileImageUrl}
                              alt=""
                              className="ai-character-list-avatar-image"
                              width={44}
                              height={44}
                              unoptimized
                            />
                          ) : (
                            <span className="ai-character-list-avatar-initials">
                              {getCreateCharacterInitials(option.name)}
                            </span>
                          )}
                        </span>
                        <div className="ai-character-list-copy">
                          <p className="metric-label tiny">{isActive ? "Selected" : "Character"}</p>
                          <p className="ai-character-list-name">{option.name}</p>
                        </div>
                      </div>
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="tiny subdued ai-character-picker-empty">
              No character profiles available.
            </p>
          )}
        </div>
      </div>
    </>
  );
};

const secondaries = [0, 1, 2] as const;
const editPresetLabels = [
  "Selfie",
  "Side Profile",
  "Over Shoulder",
  "From Behind",
  "Low Angle",
  "Drone View",
  "Zoom In",
  "Zoom Out",
  "Enhance Realism",
  "Custom 1",
  "Custom 2",
  "More presets",
] as const;
const editPresetUtilityActions = [
  {
    label: "Remove Background",
    icon: MagicWand,
    iconWeight: "fill" as const,
    buttonClassName: "edit-expert-preset-action-btn--remove-bg",
    creditCost: 1,
    hideIcon: true,
    requiresPrimaryImage: true,
  },
] as const;
const editLayerUtilityActions = [
  {
    label: "Flatten Image",
    icon: StackSimple,
    buttonClassName: "edit-expert-preset-action-btn--compose-image",
  },
] as const;
type InpaintMode = "lasso" | "brush" | "auto";
type InpaintSelectionTab = "select" | "unselect";
const MAX_LAYERS = 10;
const formatLayerName = (indexOneBased: number) => `layer ${indexOneBased}`;
const autoLayerNamePattern = /^layer\s*'?\d+'?$/i;
const isAutoLayerName = (value: string) => autoLayerNamePattern.test(value.trim());
const normalizeAutoLayerNames = (names: string[]) =>
  names.map((name, index) => (isAutoLayerName(name) ? formatLayerName(index + 1) : name));

export function ExpertEditPanelView({
  aspect,
  modelId,
  modelLabel,
  referenceImageUrl,
  extraImageUrls,
  referenceText,
  imageResolution,
  aspectOptions,
  isModelModalOpen,
  modelModalAnchor,
  onAspectChange,
  onModelPickerOpen,
  onPrimaryImageChange,
  onExtraImageChange,
  onPromptTextChange,
  onRegenerate,
  resolvePreviewUrlById,
  costCredits,
  isGenerateDisabled = false,
  isGenerateBusy = false,
  onImageResolutionChange,
  characterOptions = [],
  selectedCharacterId = "",
  onSelectedCharacterIdChange,
  isCharacterOptionsLoading = false,
  characterModeEnabled = false,
  onCharacterModeEnabledChange,
}: ExpertEditPanelViewProps) {
  const [selectedInpaintMode, setSelectedInpaintMode] = React.useState<InpaintMode>("brush");
  const [selectedInpaintSelectionTab, setSelectedInpaintSelectionTab] =
    React.useState<InpaintSelectionTab>("select");
  const [isInpaintCollapsed, setIsInpaintCollapsed] = React.useState(false);
  const [layers, setLayers] = React.useState<string[]>([formatLayerName(1)]);
  const [selectedLayerIndex, setSelectedLayerIndex] = React.useState<number | null>(0);
  const [editingLayerIndex, setEditingLayerIndex] = React.useState<number | null>(null);
  const [editingLayerValue, setEditingLayerValue] = React.useState("");
  const modelLogoSrc = modelId ? modelLogos[modelId] : undefined;
  const {
    primaryInputRef,
    extraOneInputRef,
    extraTwoInputRef,
    extraThreeInputRef,
    primaryDragActive,
    extraDragActive,
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
  } = useReferencePropertiesInteractions({
    referenceImageUrl,
    extraImageUrls,
    onPrimaryImageChange,
    onExtraImageChange,
    onPromptTextChange,
    resolvePreviewUrlById,
    klingMultiPrompts: [],
    klingElements: [],
  });

  const { imageResolutionValue, imageResolutionOptions, modelConfig, aspectOptionsForModel } =
    useReferencePropertiesDerivedState({
      variant: "image",
      modelId,
      aspectOptions,
      klingMultiPrompts: [],
      klingElements: [],
      klingVoiceIds: ["", ""],
      klingCfgScale: 0.5,
      klingNegativePrompt: "",
      imageResolution,
    });

  useReferencePropertiesConstraintEffects({
    modelConfig,
    videoDurationValue: 6,
    videoResolutionValue: "1080p",
    isVideoVariant: false,
    imageResolution,
    imageResolutionValue,
    onImageResolutionChange,
  });

  const {
    isCharacterPickerOpen,
    openCharacterPicker,
    closeCharacterPicker,
    handleCharacterModeEnabledToggle,
    characterSelectDisabled,
    isCharacterSelectionEmpty,
    selectedCharacterName,
    selectedCharacterProfileImageUrl,
    selectedCharacterInitials,
  } = useCreateCharacterModeController({
    beginnerMode: false,
    characterModeEnabled,
    characterOptions,
    selectedCharacterId,
    isCharacterOptionsLoading,
    onCharacterModeEnabledChange,
  });

  const inputRefs = [extraOneInputRef, extraTwoInputRef, extraThreeInputRef] as const;
  const shouldShowResolutionControl = imageResolutionOptions.length > 0;
  const inlineGenerateDisabled = isGenerateDisabled || !referenceImageUrl;

  return (
    <div
      className="tool-properties edit-expert-panel create-expert-panel"
      role="group"
      aria-label="Expert edit composer"
    >
      <div className="edit-expert-main-stage">
        <div className="edit-expert-preset-toolbar" aria-label="Edit preset toolbar">
          <div className="edit-expert-preset-toolbar-title-card">
            <p className="edit-expert-preset-toolbar-title">Presets</p>
            <span className="edit-expert-preset-toolbar-title-icon" aria-hidden="true">
              <Sliders size={14} weight="regular" />
            </span>
          </div>
          <div className="edit-expert-preset-toolbar-card">
            <div className="edit-expert-preset-toolbar-list">
              {editPresetLabels.map((label) => (
                <React.Fragment key={label}>
                  {label === "More presets" ? (
                    <div className="edit-expert-preset-divider" aria-hidden="true" />
                  ) : null}
                  <button
                    type="button"
                    className="edit-expert-preset-btn"
                    aria-label={`Apply ${label} preset`}
                  >
                    {label === "More presets" ? (
                      <span className="edit-expert-preset-btn-icon" aria-hidden="true">
                        <GearSix size={12} weight="regular" />
                      </span>
                    ) : null}
                    {label}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="edit-expert-preset-actions" aria-label="Preset utility actions">
            {editPresetUtilityActions.map((action) => {
              const Icon = action.icon;
              const isActionDisabled = Boolean(action.requiresPrimaryImage && !referenceImageUrl);
              return (
                <button
                  key={action.label}
                  type="button"
                  className={`edit-expert-preset-action-btn ${action.buttonClassName ?? ""}`.trim()}
                  aria-label={action.label}
                  disabled={isActionDisabled}
                >
                  {!action.hideIcon ? (
                    <span className="edit-expert-preset-action-btn-icon" aria-hidden="true">
                      <Icon size={20} weight={action.iconWeight ?? "regular"} />
                    </span>
                  ) : null}
                  <span className="edit-expert-preset-action-btn-copy">
                    <span>{action.label}</span>
                  </span>
                  {action.creditCost != null ? (
                    <span className="edit-expert-preset-action-btn-cost-column" aria-hidden="true">
                      <span className="edit-expert-preset-action-btn-cost">
                        <span className="model-chip-icon">✦</span>
                        <span className="model-chip-credits">{action.creditCost}</span>
                      </span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="edit-expert-layers-toolbar" aria-label="Edit layers toolbar">
          <div className="edit-expert-layers-toolbar-title-card">
            <p className="edit-expert-layers-toolbar-title">Layers</p>
            <span className="edit-expert-layers-toolbar-title-icon" aria-hidden="true">
              <StackSimple size={14} weight="regular" />
            </span>
          </div>
          <div className="edit-expert-layers-toolbar-card">
            <div className="edit-expert-layers-toolbar-list">
              {layers.map((layerName, index) =>
                editingLayerIndex === index ? (
                  <input
                    key={`${layerName}-${index}`}
                    type="text"
                    className="edit-expert-layer-input"
                    value={editingLayerValue}
                    autoFocus
                    aria-label={`Rename ${layerName}`}
                    onChange={(event) => setEditingLayerValue(event.target.value)}
                    onBlur={() => {
                      const nextName = editingLayerValue.trim();
                      if (nextName.length > 0) {
                        setLayers((previous) =>
                          previous.map((value, valueIndex) =>
                            valueIndex === index ? nextName : value
                          )
                        );
                      }
                      setEditingLayerIndex(null);
                      setEditingLayerValue("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        (event.currentTarget as HTMLInputElement).blur();
                        return;
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setEditingLayerIndex(null);
                        setEditingLayerValue("");
                      }
                    }}
                  />
                ) : (
                  <div key={`${layerName}-${index}`} className="edit-expert-layer-row">
                    <button
                      type="button"
                      className={`edit-expert-preset-btn edit-expert-layer-btn ${
                        selectedLayerIndex === index ? "is-selected" : ""
                      }`}
                      onClick={() => setSelectedLayerIndex(index)}
                      onDoubleClick={() => {
                        setEditingLayerIndex(index);
                        setEditingLayerValue(layerName);
                      }}
                    >
                      <span className="edit-expert-layer-label">{layerName}</span>
                    </button>
                    <button
                      type="button"
                      className="edit-expert-layer-delete-btn"
                      aria-label={`Delete ${layerName}`}
                      onClick={() => {
                        if (index === 0) {
                          setLayers((previous) =>
                            previous.map((value, valueIndex) =>
                              valueIndex === 0 ? formatLayerName(1) : value
                            )
                          );
                          setEditingLayerIndex((previousIndex) =>
                            previousIndex === 0 ? null : previousIndex
                          );
                          setEditingLayerValue("");
                          return;
                        }

                        setLayers((previous) =>
                          normalizeAutoLayerNames(
                            previous.filter((_, valueIndex) => valueIndex !== index)
                          )
                        );
                        setEditingLayerIndex((previousIndex) => {
                          if (previousIndex == null) {
                            return previousIndex;
                          }
                          if (previousIndex === index) {
                            setEditingLayerValue("");
                            return null;
                          }
                          if (previousIndex > index) {
                            return previousIndex - 1;
                          }
                          return previousIndex;
                        });
                        setSelectedLayerIndex((previousIndex) => {
                          if (previousIndex == null) {
                            return previousIndex;
                          }
                          if (previousIndex === index) {
                            const nextCount = layers.length - 1;
                            if (nextCount <= 0) {
                              return null;
                            }
                            return Math.min(index, nextCount - 1);
                          }
                          if (previousIndex > index) {
                            return previousIndex - 1;
                          }
                          return previousIndex;
                        });
                      }}
                    >
                      <TrashSimple size={12} weight="regular" />
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
          {layers.length < MAX_LAYERS ? (
            <button
              type="button"
              className="edit-expert-layers-add-btn"
              aria-label="Add layer"
              onClick={() => {
                setLayers((previous) => {
                  if (previous.length >= MAX_LAYERS) {
                    return previous;
                  }
                  return normalizeAutoLayerNames([
                    ...previous,
                    formatLayerName(previous.length + 1),
                  ]);
                });
              }}
            >
              <Plus size={12} weight="bold" />
            </button>
          ) : null}
          <div className="edit-expert-layers-actions" aria-label="Layer utility actions">
            {editLayerUtilityActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  className={`edit-expert-preset-action-btn ${action.buttonClassName ?? ""}`.trim()}
                  aria-label={action.label}
                >
                  <Icon size={20} weight="regular" />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={`edit-expert-primary-dropzone ${referenceImageUrl ? "has-preview" : ""} ${
            primaryDragActive ? "is-dragging" : ""
          }`}
          onDrop={handlePrimaryDrop}
          onDragEnter={handlePrimaryDragEnter}
          onDragOver={handlePrimaryDragOver}
          onDragLeave={handlePrimaryDragLeave}
          onClick={() => primaryInputRef.current?.click()}
          style={referenceImageUrl ? { backgroundImage: `url(${referenceImageUrl})` } : undefined}
          aria-label="Primary edit image"
        >
          {referenceImageUrl ? (
            <button
              type="button"
              className="dropzone-clear"
              onClick={(event) => {
                event.stopPropagation();
                onPrimaryImageChange(null);
              }}
            >
              ×
            </button>
          ) : (
            <div className="reference-drop-content image-drop-content">
              <UploadSimple size={28} weight="regular" />
              <p className="reference-drop-title">Click to upload an image</p>
            </div>
          )}
        </div>

        <div className={`edit-expert-inpaint-row ${isInpaintCollapsed ? "is-collapsed" : ""}`}>
          <div
            className={`edit-expert-inpaint-wrapper ${isInpaintCollapsed ? "is-collapsed" : ""}`}
            role="group"
            aria-label="Inpaint controls group"
          >
            <div className="edit-expert-inpaint-collapse-control">
              {isInpaintCollapsed ? (
                <p className="edit-expert-inpaint-collapse-title">Tools</p>
              ) : null}
              <button
                type="button"
                className="edit-expert-inpaint-collapse-btn"
                aria-label={
                  isInpaintCollapsed ? "Expand inpaint controls" : "Collapse inpaint controls"
                }
                aria-expanded={!isInpaintCollapsed}
                aria-controls="edit-expert-inpaint-content"
                onClick={() => setIsInpaintCollapsed((previous) => !previous)}
              >
                {isInpaintCollapsed ? (
                  <PaintBrushBroad
                    size={20}
                    weight="regular"
                    data-testid="inpaint-collapse-icon-brush"
                  />
                ) : (
                  <CaretRight size={20} weight="fill" data-testid="inpaint-collapse-icon-dots" />
                )}
              </button>
            </div>
            {!isInpaintCollapsed ? (
              <div id="edit-expert-inpaint-content" className="edit-expert-inpaint-content">
                <div className="edit-expert-inpaint-tool-rail" aria-label="Inpaint action tools">
                  <button type="button" className="edit-expert-inpaint-tool-rail-btn">
                    <ArrowsOutCardinal size={14} weight="regular" />
                    <span>Move</span>
                  </button>
                  <button type="button" className="edit-expert-inpaint-tool-rail-btn">
                    <PaintBrushBroad size={14} weight="regular" />
                    <span>In-paint</span>
                  </button>
                  <button type="button" className="edit-expert-inpaint-tool-rail-btn">
                    <PlusCircle size={14} weight="regular" />
                    <span>Insert</span>
                  </button>
                  <button type="button" className="edit-expert-inpaint-tool-rail-btn">
                    <Eraser size={14} weight="regular" />
                    <span>Erase</span>
                  </button>
                </div>
                <div
                  className="edit-expert-inpaint-controls"
                  role="group"
                  aria-label="Inpaint tools"
                >
                  <div className="edit-expert-inpaint-mode-row">
                    <button
                      type="button"
                      className={`edit-expert-inpaint-mode-btn ${
                        selectedInpaintMode === "brush" ? "is-active" : ""
                      }`}
                      aria-pressed={selectedInpaintMode === "brush"}
                      onClick={() => setSelectedInpaintMode("brush")}
                    >
                      <PaintBrush size={16} weight="regular" />
                      <span>Brush</span>
                    </button>
                    <button
                      type="button"
                      className={`edit-expert-inpaint-mode-btn ${
                        selectedInpaintMode === "lasso" ? "is-active" : ""
                      }`}
                      aria-pressed={selectedInpaintMode === "lasso"}
                      onClick={() => setSelectedInpaintMode("lasso")}
                    >
                      <CircleDashed size={16} weight="regular" />
                      <span>Lasso</span>
                    </button>
                    <button
                      type="button"
                      className={`edit-expert-inpaint-mode-btn ${
                        selectedInpaintMode === "auto" ? "is-active" : ""
                      }`}
                      aria-pressed={selectedInpaintMode === "auto"}
                      onClick={() => setSelectedInpaintMode("auto")}
                    >
                      <Sparkle size={16} weight="regular" />
                      <span>Auto</span>
                    </button>
                  </div>
                  <div className="edit-expert-inpaint-divider" aria-hidden="true" />
                  <div className="edit-expert-inpaint-selection-row">
                    <div
                      className="edit-expert-inpaint-select-tabs"
                      role="tablist"
                      aria-label="Selection mode"
                    >
                      <button
                        type="button"
                        className={`edit-expert-inpaint-select-tab ${
                          selectedInpaintSelectionTab === "select" ? "is-active" : ""
                        }`}
                        role="tab"
                        aria-selected={selectedInpaintSelectionTab === "select"}
                        onClick={() => setSelectedInpaintSelectionTab("select")}
                      >
                        Select
                      </button>
                      <button
                        type="button"
                        className={`edit-expert-inpaint-select-tab ${
                          selectedInpaintSelectionTab === "unselect" ? "is-active" : ""
                        }`}
                        role="tab"
                        aria-selected={selectedInpaintSelectionTab === "unselect"}
                        onClick={() => setSelectedInpaintSelectionTab("unselect")}
                      >
                        Unselect
                      </button>
                    </div>
                    <button
                      type="button"
                      className="edit-expert-inpaint-action-btn"
                      aria-label="Invert selection"
                    >
                      <CircleHalf size={18} weight="regular" />
                    </button>
                    <button
                      type="button"
                      className="edit-expert-inpaint-action-btn"
                      aria-label="Clear selection"
                    >
                      <TrashSimple size={18} weight="regular" />
                    </button>
                  </div>
                  <div className="edit-expert-inpaint-stroke-row">
                    <label
                      className="edit-expert-inpaint-stroke-label"
                      htmlFor="edit-expert-inpaint-stroke-size"
                    >
                      Stroke Size
                    </label>
                    <input
                      id="edit-expert-inpaint-stroke-size"
                      className="edit-expert-inpaint-stroke-slider"
                      type="range"
                      min={1}
                      max={100}
                      defaultValue={58}
                      aria-label="Stroke size"
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className="edit-expert-secondary-control">
            <p className="edit-expert-secondary-title">Reference Images</p>
            <div className="edit-expert-secondary-row">
              {secondaries.map((index) => {
                const previewUrl = extraImageUrls[index];
                const inputRef = inputRefs[index];
                return (
                  <div
                    className="edit-expert-secondary-slot"
                    key={`expert-edit-secondary-${index}`}
                  >
                    <div
                      className={`reference-dropzone extra ${previewUrl ? "has-preview" : ""} ${
                        extraDragActive[index] ? "is-dragging" : ""
                      }`}
                      onDrop={handleExtraDrop(index)}
                      onDragEnter={handleExtraDragEnter(index)}
                      onDragOver={handleExtraDragOver(index)}
                      onDragLeave={handleExtraDragLeave(index)}
                      onClick={() => inputRef.current?.click()}
                      style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
                      aria-label={`Secondary edit image ${index + 1}`}
                    >
                      {previewUrl ? (
                        <button
                          type="button"
                          className="dropzone-clear"
                          onClick={(event) => {
                            event.stopPropagation();
                            onExtraImageChange(index, null);
                          }}
                        >
                          ×
                        </button>
                      ) : (
                        <Plus size={18} weight="regular" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="edit-expert-styles-control">
            <p className="edit-expert-styles-title">Styles</p>
            <button type="button" className="edit-expert-styles-btn" aria-label="Styles">
              <Sticker size={22} weight="regular" />
            </button>
          </div>
        </div>
      </div>

      <div className="edit-expert-bottom-row">
        <div className="edit-expert-prompt-shell">
          <div className="edit-expert-prompt-row">
            <textarea
              className="prompt-drop-input edit-expert-prompt-input"
              value={referenceText ?? ""}
              onChange={(event) => onPromptTextChange(event.target.value)}
              onDrop={handlePromptDrop}
              onDragOver={(event) => event.preventDefault()}
              placeholder="Write your prompt..."
              aria-label="Edit prompt"
            />
          </div>
        </div>
        <div className="edit-expert-inline-generate edit-expert-inline-generate--outside">
          <AgentGenerateButton
            onClick={onRegenerate}
            disabled={inlineGenerateDisabled}
            isBusy={isGenerateBusy}
            cost={costCredits != null ? costCredits : "—"}
          />
        </div>
      </div>
      <div className="edit-expert-selector-row create-expert-secondary-row create-expert-controls-row">
        <div className="create-expert-controls">
          <div
            className={`create-expert-control create-expert-character-mode-control ${
              characterModeEnabled ? "is-character-mode-on" : "is-character-mode-off"
            }`}
          >
            <div className="create-expert-character-mode-meta">
              <p className="create-expert-character-mode-title">Character</p>
              <button
                type="button"
                className={`audio-toggle ai-character-mode-toggle create-expert-toggle-control ${
                  characterModeEnabled ? "is-active" : ""
                }`}
                aria-pressed={characterModeEnabled}
                aria-label={
                  characterModeEnabled ? "Disable character mode" : "Enable character mode"
                }
                onClick={handleCharacterModeEnabledToggle}
              >
                <span className="audio-toggle-track" aria-hidden="true">
                  <span className="audio-toggle-dot" />
                </span>
              </button>
            </div>
            {characterModeEnabled ? (
              <button
                type="button"
                className={`model-picker-btn create-expert-picker-control create-expert-character-picker-trigger ${
                  isCharacterSelectionEmpty ? "is-empty" : ""
                } ${isCharacterPickerOpen ? "is-open" : ""}`}
                aria-haspopup="dialog"
                aria-expanded={isCharacterPickerOpen}
                aria-label="Open character picker"
                disabled={characterSelectDisabled}
                onClick={openCharacterPicker}
              >
                {selectedCharacterProfileImageUrl ? (
                  <Image
                    src={selectedCharacterProfileImageUrl}
                    alt={`${selectedCharacterName} profile`}
                    className="ai-character-picker-trigger-avatar"
                    width={20}
                    height={20}
                    unoptimized
                  />
                ) : selectedCharacterInitials ? (
                  <span className="ai-character-picker-trigger-avatar ai-character-picker-trigger-avatar--fallback">
                    {selectedCharacterInitials}
                  </span>
                ) : null}
                <span className="model-picker-name">{selectedCharacterName}</span>
              </button>
            ) : null}
          </div>

          <div className="create-expert-control create-expert-model-control">
            <button
              type="button"
              className={`model-picker-btn create-expert-picker-control create-expert-model-picker-trigger ${
                !modelId ? "is-empty" : ""
              } ${isModelModalOpen && modelModalAnchor === "reference-model" ? "is-open" : ""}`}
              data-model-anchor="reference-model"
              aria-label="Open model picker"
              onClick={(event) =>
                onModelPickerOpen("reference-model", event.currentTarget, "reference-image")
              }
            >
              {modelLogoSrc ? (
                <Image
                  className="model-chip-logo-img"
                  src={modelLogoSrc}
                  alt=""
                  aria-hidden
                  width={74}
                  height={18}
                  unoptimized={false}
                />
              ) : null}
              <span className="model-picker-name">{stripEditLabel(modelLabel)}</span>
            </button>
          </div>

          <div className="create-expert-control create-expert-aspect-control">
            <AspectDropdown
              aspect={aspect}
              onSelect={onAspectChange}
              options={aspectOptionsForModel}
            />
          </div>

          {shouldShowResolutionControl ? (
            <div className="create-expert-control create-expert-resolution-control">
              <ResolutionDropdown
                value={imageResolutionValue}
                options={imageResolutionOptions}
                onSelect={onImageResolutionChange}
              />
            </div>
          ) : null}
        </div>
      </div>

      <input
        ref={primaryInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection(onPrimaryImageChange)}
      />
      <input
        ref={extraOneInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection((url) => onExtraImageChange(0, url))}
      />
      <input
        ref={extraTwoInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection((url) => onExtraImageChange(1, url))}
      />
      <input
        ref={extraThreeInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelection((url) => onExtraImageChange(2, url))}
      />

      <CharacterPickerModal
        isOpen={isCharacterPickerOpen}
        characterModeEnabled={characterModeEnabled}
        onClose={closeCharacterPicker}
        characterOptions={characterOptions}
        selectedCharacterId={selectedCharacterId}
        onSelectedCharacterIdChange={onSelectedCharacterIdChange}
      />
    </div>
  );
}
