import Image from "next/image";
import React from "react";
import { Plus, TrashSimple } from "phosphor-react";
import type { AspectOption } from "../../types";
import { AspectDropdown } from "../AspectDropdown";
import { ResolutionDropdown } from "../ResolutionDropdown";
import { StylesControl } from "../StylesControl";
import { LOCKED_EDIT_TOOL_MODEL_LOGO_SRC } from "./expertEditPanelViewContract";
import type { ExpertEditStyleTile } from "./expertEditStyles";

type ExpertEditSecondaryReferencesProps = {
  extraImageUrls: readonly (string | null)[];
  visibleSlotIndexes: readonly number[];
  onAddSlot: () => void;
  onRemoveSlot: (index: number) => void;
  inputRefs: readonly React.RefObject<HTMLInputElement | null>[];
  extraDragActive: readonly boolean[];
  isPromptTokenPickerOpen: boolean;
  highlightPromptPickerSecondaryTargets?: boolean;
  promptTokenPickerSelectedSlotIndex: number | "main" | null;
  allowPromptTokenSecondaryDrag?: boolean;
  onSecondaryDragStart: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  onSecondaryDrop: (index: number) => React.DragEventHandler<HTMLDivElement>;
  onSecondaryDragEnter: (index: number) => React.DragEventHandler<HTMLDivElement>;
  onSecondaryDragOver: (index: number) => React.DragEventHandler<HTMLDivElement>;
  onSecondaryDragLeave: (index: number) => React.DragEventHandler<HTMLDivElement>;
  isStylesPanelOpen?: boolean;
  selectedStyleId?: string | null;
  stylesCatalog?: readonly ExpertEditStyleTile[];
  onStylesPanelToggle?: () => void;
};

export function ExpertEditSecondaryReferences({
  extraImageUrls,
  visibleSlotIndexes,
  onAddSlot,
  onRemoveSlot,
  inputRefs,
  extraDragActive,
  isPromptTokenPickerOpen,
  highlightPromptPickerSecondaryTargets = true,
  promptTokenPickerSelectedSlotIndex,
  allowPromptTokenSecondaryDrag = true,
  onSecondaryDragStart,
  onSecondaryDrop,
  onSecondaryDragEnter,
  onSecondaryDragOver,
  onSecondaryDragLeave,
  isStylesPanelOpen,
  selectedStyleId,
  stylesCatalog,
  onStylesPanelToggle,
}: ExpertEditSecondaryReferencesProps) {
  return (
    <>
      <div className="edit-expert-secondary-control">
        <p className="edit-expert-secondary-title">Reference Images</p>
        <div className="edit-expert-secondary-row">
          {visibleSlotIndexes.map((index) => {
            const previewUrl = extraImageUrls[index] ?? null;
            const inputRef = inputRefs[index];
            return (
              <div className="edit-expert-secondary-slot" key={`expert-edit-secondary-${index}`}>
                <div
                  className={`reference-dropzone extra ${previewUrl ? "has-preview" : ""} ${
                    extraDragActive[index] ? "is-dragging" : ""
                  } ${
                    highlightPromptPickerSecondaryTargets && isPromptTokenPickerOpen && previewUrl
                      ? "is-picker-target"
                      : ""
                  } ${
                    isPromptTokenPickerOpen && promptTokenPickerSelectedSlotIndex === index
                      ? "is-picker-selected"
                      : ""
                  }`.trim()}
                  draggable={Boolean(previewUrl) && allowPromptTokenSecondaryDrag}
                  onDragStart={(event) => onSecondaryDragStart(event, index)}
                  onDrop={onSecondaryDrop(index)}
                  onDragEnter={onSecondaryDragEnter(index)}
                  onDragOver={onSecondaryDragOver(index)}
                  onDragLeave={onSecondaryDragLeave(index)}
                  onClick={() => inputRef?.current?.click()}
                  style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
                  aria-label={`Secondary edit image ${index + 1}`}
                >
                  <button
                    type="button"
                    className="dropzone-clear"
                    aria-label={`Remove reference slot ${index + 1}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemoveSlot(index);
                    }}
                  >
                    <TrashSimple size={14} weight="regular" />
                  </button>
                  {previewUrl ? null : <Plus size={18} weight="regular" />}
                </div>
              </div>
            );
          })}
          {visibleSlotIndexes.length < extraImageUrls.length ? (
            <div className="edit-expert-secondary-slot" key="expert-edit-secondary-add">
              <button
                type="button"
                className="reference-dropzone extra edit-expert-secondary-add-slot"
                aria-label="Add reference slot"
                onClick={onAddSlot}
              >
                <Plus size={18} weight="regular" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <StylesControl
        isOpen={isStylesPanelOpen}
        selectedStyleId={selectedStyleId}
        styles={stylesCatalog}
        onToggle={onStylesPanelToggle}
      />
    </>
  );
}

type ExpertEditSelectorControlsProps = {
  modelId: string | null;
  isModelPickerLocked: boolean;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  effectiveModelPickerLogoSrc?: string;
  effectiveModelPickerLabel: string;
  onModelPickerOpen: (anchorId: string, target: HTMLElement, context?: "reference-image") => void;
  aspect: string;
  onAspectChange: (value: string) => void;
  aspectOptionsForModel: AspectOption[];
  shouldShowResolutionControl: boolean;
  imageResolutionValue: string;
  imageResolutionOptions: React.ComponentProps<typeof ResolutionDropdown>["options"];
  onImageResolutionChange?: (value: string) => void;
};

export function ExpertEditSelectorControls({
  modelId,
  isModelPickerLocked,
  isModelModalOpen,
  modelModalAnchor,
  effectiveModelPickerLogoSrc,
  effectiveModelPickerLabel,
  onModelPickerOpen,
  aspect,
  onAspectChange,
  aspectOptionsForModel,
  shouldShowResolutionControl,
  imageResolutionValue,
  imageResolutionOptions,
  onImageResolutionChange,
}: ExpertEditSelectorControlsProps) {
  const isLockedEditToolLogo = effectiveModelPickerLogoSrc === LOCKED_EDIT_TOOL_MODEL_LOGO_SRC;

  return (
    <div className="edit-expert-selector-row create-composer-secondary-row create-composer-controls-row">
      <div className="create-composer-controls">
        <div className="create-composer-control create-composer-model-control">
          <button
            type="button"
            className={`model-picker-btn create-composer-picker-control create-composer-model-picker-trigger ${
              !modelId ? "is-empty" : ""
            } ${isModelPickerLocked ? "is-locked" : ""} ${
              isModelModalOpen && modelModalAnchor === "reference-model" ? "is-open" : ""
            }`}
            data-model-anchor="reference-model"
            aria-label="Open model picker"
            disabled={isModelPickerLocked}
            onClick={(event) =>
              onModelPickerOpen("reference-model", event.currentTarget, "reference-image")
            }
          >
            {effectiveModelPickerLogoSrc ? (
              <Image
                className={`model-chip-logo-img ${
                  isLockedEditToolLogo ? "model-chip-logo-img--locked-edit-tool" : ""
                }`.trim()}
                src={effectiveModelPickerLogoSrc}
                alt=""
                aria-hidden
                width={74}
                height={18}
                unoptimized={false}
                style={isLockedEditToolLogo ? { height: "auto" } : { width: "auto" }}
              />
            ) : null}
            <span className="model-picker-name">{effectiveModelPickerLabel}</span>
          </button>
        </div>

        <div className="create-composer-control create-composer-aspect-control">
          <AspectDropdown
            aspect={aspect}
            onSelect={onAspectChange}
            options={aspectOptionsForModel}
          />
        </div>

        {shouldShowResolutionControl ? (
          <div className="create-composer-control create-composer-resolution-control">
            <ResolutionDropdown
              value={imageResolutionValue}
              options={imageResolutionOptions}
              onSelect={onImageResolutionChange}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
