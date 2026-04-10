import Image from "next/image";
import React from "react";
import { Plus, TrashSimple } from "phosphor-react";
import type { AspectOption } from "../../types";
import { AspectDropdown } from "../AspectDropdown";
import { ResolutionDropdown } from "../ResolutionDropdown";
import { StylesControl } from "../StylesControl";
import type { ExpertEditStyleTile } from "./expertEditStyles";

type ExpertEditSecondaryReferencesProps = {
  extraImageUrls: readonly (string | null)[];
  inputRefs: readonly React.RefObject<HTMLInputElement | null>[];
  extraDragActive: readonly boolean[];
  isPromptTokenPickerOpen: boolean;
  promptTokenPickerSelectedSlotIndex: number | "main" | null;
  onSecondaryDragStart: (event: React.DragEvent<HTMLDivElement>, index: number) => void;
  onSecondaryDrop: (index: number) => React.DragEventHandler<HTMLDivElement>;
  onSecondaryDragEnter: (index: number) => React.DragEventHandler<HTMLDivElement>;
  onSecondaryDragOver: (index: number) => React.DragEventHandler<HTMLDivElement>;
  onSecondaryDragLeave: (index: number) => React.DragEventHandler<HTMLDivElement>;
  onExtraImageChange: (index: number, url: string | null) => void;
  isStylesPanelOpen?: boolean;
  selectedStyleId?: string | null;
  stylesCatalog?: readonly ExpertEditStyleTile[];
  onStylesPanelToggle?: () => void;
};

export function ExpertEditSecondaryReferences({
  extraImageUrls,
  inputRefs,
  extraDragActive,
  isPromptTokenPickerOpen,
  promptTokenPickerSelectedSlotIndex,
  onSecondaryDragStart,
  onSecondaryDrop,
  onSecondaryDragEnter,
  onSecondaryDragOver,
  onSecondaryDragLeave,
  onExtraImageChange,
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
          {extraImageUrls.map((previewUrl, index) => {
            const inputRef = inputRefs[index];
            return (
              <div className="edit-expert-secondary-slot" key={`expert-edit-secondary-${index}`}>
                <div
                  className={`reference-dropzone extra ${previewUrl ? "has-preview" : ""} ${
                    extraDragActive[index] ? "is-dragging" : ""
                  } ${isPromptTokenPickerOpen && previewUrl ? "is-picker-target" : ""} ${
                    isPromptTokenPickerOpen && promptTokenPickerSelectedSlotIndex === index
                      ? "is-picker-selected"
                      : ""
                  }`.trim()}
                  draggable={Boolean(previewUrl)}
                  onDragStart={(event) => onSecondaryDragStart(event, index)}
                  onDrop={onSecondaryDrop(index)}
                  onDragEnter={onSecondaryDragEnter(index)}
                  onDragOver={onSecondaryDragOver(index)}
                  onDragLeave={onSecondaryDragLeave(index)}
                  onClick={() => inputRef.current?.click()}
                  style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
                  aria-label={`Secondary edit image ${index + 1}`}
                >
                  {previewUrl ? (
                    <button
                      type="button"
                      className="dropzone-clear"
                      aria-label={`Remove secondary image ${index + 1}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onExtraImageChange(index, null);
                      }}
                    >
                      <TrashSimple size={14} weight="regular" />
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
  return (
    <div className="edit-expert-selector-row create-expert-secondary-row create-expert-controls-row">
      <div className="create-expert-controls">
        <div className="create-expert-control create-expert-model-control">
          <button
            type="button"
            className={`model-picker-btn create-expert-picker-control create-expert-model-picker-trigger ${
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
                className="model-chip-logo-img"
                src={effectiveModelPickerLogoSrc}
                alt=""
                aria-hidden
                width={74}
                height={18}
                unoptimized={false}
              />
            ) : null}
            <span className="model-picker-name">{effectiveModelPickerLabel}</span>
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
  );
}
