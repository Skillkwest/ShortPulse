import React from "react";
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsInCardinal,
  ArrowsOutSimple,
  ArrowsOutCardinal,
  CircleDashed,
  CircleHalf,
  GearSix,
  PaintBrush,
  PencilSimple,
  Sliders,
  TrashSimple,
} from "phosphor-react";

import { AspectDropdown } from "../AspectDropdown";
import {
  INPAINT_STROKE_SIZE_DEFAULT,
  MARKUP_COLOR_SWATCHES,
  MARKUP_STROKE_SIZE_DEFAULT,
  MARKUP_STROKE_SIZE_MAX,
  clampNumber,
  editPresetUtilityActions,
  type InpaintMode,
  type InpaintSelectionTab,
  type MarkupMode,
  type RailTool,
} from "./expertEditPanelViewContract";
import type { HsvColor } from "./expertEditColorUtils";
import { EDIT_PRESET_MORE_LABEL, type ExpertEditPresetId } from "./expertEditPresets";
import {
  MOVE_STAGE_ZOOM_SLIDER_DEFAULT,
  MOVE_STAGE_ZOOM_SLIDER_MAX,
  MOVE_STAGE_ZOOM_SLIDER_MIN,
} from "./expertEditViewportUtils";
import type { AspectOption } from "../../types";

type ExpertEditMarkupControlsContentProps = {
  scope: "inline" | "modal";
  selectedMarkupMode: MarkupMode;
  isMarkupToolSelected: boolean;
  isMarkupExpandSelected: boolean;
  resolvedMarkupStrokeSize: number;
  markupColor: string;
  markupColorHsv: HsvColor;
  markupColorPickerAnchorRef: React.Ref<HTMLDivElement>;
  markupColorSaturationRef: React.Ref<HTMLDivElement>;
  isMarkupColorPickerOpen: boolean;
  toggleMarkupColorPicker: (scope: "inline" | "modal") => void;
  setSelectedRailTool: React.Dispatch<React.SetStateAction<RailTool>>;
  setSelectedMarkupMode: React.Dispatch<React.SetStateAction<MarkupMode>>;
  setMarkupStrokeSize: React.Dispatch<React.SetStateAction<number>>;
  clearMarkupStrokesWithHistory: () => void;
  closeMarkupModal: () => void;
  openMarkupModal: (tool?: RailTool) => void;
  applyMarkupColorFromHex: (value: string) => void;
  handleMarkupSaturationPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleMarkupSaturationPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleMarkupSaturationPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleMarkupHueChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export function ExpertEditMarkupControlsContent({
  scope,
  selectedMarkupMode,
  isMarkupToolSelected,
  isMarkupExpandSelected,
  resolvedMarkupStrokeSize,
  markupColor,
  markupColorHsv,
  markupColorPickerAnchorRef,
  markupColorSaturationRef,
  isMarkupColorPickerOpen,
  toggleMarkupColorPicker,
  setSelectedRailTool,
  setSelectedMarkupMode,
  setMarkupStrokeSize,
  clearMarkupStrokesWithHistory,
  closeMarkupModal,
  openMarkupModal,
  applyMarkupColorFromHex,
  handleMarkupSaturationPointerDown,
  handleMarkupSaturationPointerMove,
  handleMarkupSaturationPointerUp,
  handleMarkupHueChange,
}: ExpertEditMarkupControlsContentProps) {
  const isModalScope = scope === "modal";
  const isMarkupToolActive = isMarkupToolSelected;
  const modeIconSize = isModalScope ? 19 : 16;
  const strokeSizeControlId = `edit-expert-markup-stroke-size-${scope}`;
  const colorPickerId = `edit-expert-markup-color-picker-${scope}`;
  const hueSliderId = `edit-expert-markup-color-hue-${scope}`;

  return (
    <div className="edit-expert-markup-controls-content">
      <div
        className="edit-expert-inpaint-mode-row edit-expert-markup-mode-row"
        role="group"
        aria-label="Markup tool mode"
      >
        <button
          type="button"
          className={`edit-expert-inpaint-mode-btn ${isModalScope ? "edit-expert-markup-icon-only-btn" : ""} ${
            selectedMarkupMode === "pen" && isMarkupToolActive ? "is-active" : ""
          }`.trim()}
          aria-pressed={selectedMarkupMode === "pen" && isMarkupToolActive}
          aria-label="Pen"
          onClick={() => {
            setSelectedRailTool("markup");
            setSelectedMarkupMode("pen");
          }}
        >
          <PencilSimple size={modeIconSize} weight="regular" />
          {!isModalScope ? <span>Pen</span> : null}
        </button>
        <button
          type="button"
          className={`edit-expert-inpaint-mode-btn edit-expert-markup-lasso-btn ${
            isModalScope ? "edit-expert-markup-icon-only-btn" : ""
          } ${selectedMarkupMode === "lasso" && isMarkupToolActive ? "is-active" : ""}`.trim()}
          aria-pressed={selectedMarkupMode === "lasso" && isMarkupToolActive}
          aria-label="Lasso"
          onClick={() => {
            setSelectedRailTool("markup");
            setSelectedMarkupMode("lasso");
          }}
        >
          <CircleDashed size={modeIconSize} weight="regular" />
          {!isModalScope ? <span>Lasso</span> : null}
        </button>
        {isModalScope ? (
          <button
            type="button"
            className="edit-expert-inpaint-action-btn edit-expert-markup-clear-btn-modal"
            aria-label="Clear markup strokes"
            onClick={clearMarkupStrokesWithHistory}
          >
            <TrashSimple size={19} weight="regular" />
          </button>
        ) : (
          <button
            type="button"
            className={`edit-expert-inpaint-mode-btn edit-expert-markup-collapse-btn ${
              isMarkupExpandSelected ? "is-active" : ""
            }`}
            aria-pressed={isMarkupExpandSelected}
            onClick={() => {
              if (isMarkupExpandSelected) {
                closeMarkupModal();
                return;
              }
              openMarkupModal("markup");
            }}
            aria-label="Expand markup tools"
          >
            <ArrowsOutSimple size={modeIconSize} weight="regular" />
          </button>
        )}
      </div>
      <div className="edit-expert-inpaint-stroke-row">
        <label className="edit-expert-inpaint-stroke-label" htmlFor={strokeSizeControlId}>
          Stroke Size
        </label>
        <input
          id={strokeSizeControlId}
          className="edit-expert-inpaint-stroke-slider"
          type="range"
          min={1}
          max={MARKUP_STROKE_SIZE_MAX}
          value={resolvedMarkupStrokeSize}
          onChange={(event) =>
            setMarkupStrokeSize(clampNumber(Number(event.target.value), 1, MARKUP_STROKE_SIZE_MAX))
          }
          onDoubleClick={() => setMarkupStrokeSize(MARKUP_STROKE_SIZE_DEFAULT)}
          aria-label="Stroke size"
        />
      </div>
      <div className="edit-expert-markup-color-row">
        <span className="edit-expert-markup-color-label">Color</span>
        {!isMarkupColorPickerOpen ? (
          <div className="edit-expert-markup-color-picker-anchor" ref={markupColorPickerAnchorRef}>
            <button
              id={colorPickerId}
              type="button"
              className="edit-expert-markup-color-picker"
              style={{ backgroundColor: markupColor }}
              aria-label="Markup color"
              aria-expanded={isMarkupColorPickerOpen}
              aria-haspopup="dialog"
              onClick={(event) => {
                event.stopPropagation();
                toggleMarkupColorPicker(scope);
              }}
            />
          </div>
        ) : null}
        {!isModalScope ? (
          <button
            type="button"
            className="edit-expert-inpaint-action-btn edit-expert-markup-clear-btn"
            aria-label="Clear markup strokes"
            onClick={clearMarkupStrokesWithHistory}
          >
            <TrashSimple size={18} weight="regular" />
          </button>
        ) : null}
      </div>
      {isMarkupColorPickerOpen ? (
        <div
          className="edit-expert-markup-color-popover"
          role="dialog"
          aria-label="Markup color picker"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="edit-expert-markup-color-popover-header">
            <p className="edit-expert-markup-color-popover-title">Markup Color</p>
            <span className="edit-expert-markup-color-popover-value">
              {markupColor.toUpperCase()}
            </span>
          </div>
          <div
            ref={markupColorSaturationRef}
            className="edit-expert-markup-color-popover-saturation"
            style={{
              background: `linear-gradient(to top, #000000, rgba(0, 0, 0, 0)), linear-gradient(to right, #ffffff, hsl(${Math.round(markupColorHsv.h)}, 100%, 50%))`,
            }}
            onPointerDown={handleMarkupSaturationPointerDown}
            onPointerMove={handleMarkupSaturationPointerMove}
            onPointerUp={handleMarkupSaturationPointerUp}
            onPointerCancel={handleMarkupSaturationPointerUp}
          >
            <span
              className="edit-expert-markup-color-popover-saturation-thumb"
              style={{
                left: `${markupColorHsv.s * 100}%`,
                top: `${(1 - markupColorHsv.v) * 100}%`,
              }}
              aria-hidden="true"
            />
          </div>
          <div className="edit-expert-markup-color-popover-hue">
            <label htmlFor={hueSliderId} className="edit-expert-markup-color-popover-hue-label">
              Hue
            </label>
            <input
              id={hueSliderId}
              type="range"
              min={0}
              max={360}
              step={1}
              value={Math.round(markupColorHsv.h)}
              className="edit-expert-markup-color-popover-hue-slider"
              aria-label="Markup hue"
              onChange={handleMarkupHueChange}
            />
          </div>
          <div className="edit-expert-markup-color-popover-swatches" aria-label="Markup swatches">
            {MARKUP_COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={`edit-expert-markup-color-popover-swatch ${
                  markupColor.toLowerCase() === swatch.toLowerCase() ? "is-active" : ""
                }`}
                style={{ backgroundColor: swatch }}
                aria-label={`Select ${swatch} color`}
                onClick={() => applyMarkupColorFromHex(swatch)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type ExpertEditMoveControlsContentProps = {
  scope: "inline" | "modal";
  isMoveToolSelected: boolean;
  moveStageZoomSliderValue: number;
  canUndoGeneralAction: boolean;
  canRedoGeneralAction: boolean;
  showHistoryActions?: boolean;
  setSelectedRailTool: React.Dispatch<React.SetStateAction<RailTool>>;
  handleRecenterMoveAction: () => void;
  handleMoveZoomSliderChange: (value: number) => void;
  handleUndoGeneralAction: () => void;
  handleRedoGeneralAction: () => void;
};

export function ExpertEditMoveControlsContent({
  scope,
  isMoveToolSelected,
  moveStageZoomSliderValue,
  canUndoGeneralAction,
  canRedoGeneralAction,
  showHistoryActions,
  setSelectedRailTool,
  handleRecenterMoveAction,
  handleMoveZoomSliderChange,
  handleUndoGeneralAction,
  handleRedoGeneralAction,
}: ExpertEditMoveControlsContentProps) {
  const isModalScope = scope === "modal";
  if (scope === "inline") {
    return null;
  }
  const shouldRenderHistoryActions = showHistoryActions ?? true;
  const modeIconSize = isModalScope ? 18 : 16;
  const recenterIconSize = isModalScope ? 16 : 14;
  const zoomSliderId = isModalScope
    ? "edit-expert-move-zoom-slider-modal"
    : "edit-expert-move-zoom-slider";

  return (
    <div className="edit-expert-move-controls-content">
      {isModalScope ? (
        <div
          className="edit-expert-move-mode-row edit-expert-move-mode-row--modal"
          role="group"
          aria-label="Move tool mode"
        >
          <button
            type="button"
            className={`edit-expert-move-mode-btn edit-expert-move-adjust-btn ${
              isMoveToolSelected ? "is-active" : ""
            }`.trim()}
            aria-pressed={isMoveToolSelected}
            aria-label="Adjust"
            onClick={() => setSelectedRailTool("move")}
          >
            <ArrowsOutCardinal size={modeIconSize} weight="regular" />
            Adjust
          </button>
          <button
            type="button"
            className="edit-expert-move-mode-btn edit-expert-move-center-btn"
            aria-label="Center move action"
            onClick={handleRecenterMoveAction}
          >
            <ArrowsInCardinal size={recenterIconSize} weight="regular" />
            Center
          </button>
        </div>
      ) : null}
      <div className="edit-expert-move-zoom-row">
        <label className="edit-expert-move-zoom-label" htmlFor={zoomSliderId}>
          Zoom
        </label>
        <input
          id={zoomSliderId}
          className="edit-expert-move-zoom-slider"
          type="range"
          min={MOVE_STAGE_ZOOM_SLIDER_MIN}
          max={MOVE_STAGE_ZOOM_SLIDER_MAX}
          step={0.1}
          value={moveStageZoomSliderValue}
          onChange={(event) => handleMoveZoomSliderChange(Number(event.target.value))}
          onDoubleClick={() => handleMoveZoomSliderChange(MOVE_STAGE_ZOOM_SLIDER_DEFAULT)}
          aria-label="Zoom stage"
        />
      </div>
      {!isModalScope && shouldRenderHistoryActions ? (
        <div className="edit-expert-move-history-row">
          <button
            type="button"
            className="edit-expert-move-history-btn"
            aria-label="Undo move action"
            onClick={handleUndoGeneralAction}
            disabled={!canUndoGeneralAction}
          >
            <ArrowCounterClockwise size={14} weight="regular" />
            Undo
          </button>
          <button
            type="button"
            className="edit-expert-move-history-btn"
            aria-label="Redo move action"
            onClick={handleRedoGeneralAction}
            disabled={!canRedoGeneralAction}
          >
            <ArrowClockwise size={14} weight="regular" />
            Redo
          </button>
        </div>
      ) : null}
    </div>
  );
}

type ExpertEditInlineHistoryControlsProps = {
  canUndoGeneralAction: boolean;
  canRedoGeneralAction: boolean;
  handleUndoGeneralAction: () => void;
  handleRedoGeneralAction: () => void;
};

export function ExpertEditInlineHistoryControls({
  canUndoGeneralAction,
  canRedoGeneralAction,
  handleUndoGeneralAction,
  handleRedoGeneralAction,
}: ExpertEditInlineHistoryControlsProps) {
  return (
    <div
      className="edit-expert-stage-history-controls"
      role="group"
      aria-label="Edit history controls"
    >
      <div className="edit-expert-move-history-row">
        <button
          type="button"
          className="edit-expert-move-history-btn"
          aria-label="Undo move action"
          onClick={handleUndoGeneralAction}
          disabled={!canUndoGeneralAction}
        >
          <ArrowCounterClockwise size={14} weight="regular" />
          Undo
        </button>
        <button
          type="button"
          className="edit-expert-move-history-btn"
          aria-label="Redo move action"
          onClick={handleRedoGeneralAction}
          disabled={!canRedoGeneralAction}
        >
          <ArrowClockwise size={14} weight="regular" />
          Redo
        </button>
      </div>
    </div>
  );
}

type ExpertEditInpaintControlsContentProps = {
  scope: "inline" | "modal" | "rail";
  selectedInpaintMode: InpaintMode;
  isInpaintToolSelected: boolean;
  inpaintStrokeSize: number;
  selectedInpaintSelectionTab: InpaintSelectionTab;
  imageHasInteractiveMask: boolean;
  setSelectedRailTool: React.Dispatch<React.SetStateAction<RailTool>>;
  setSelectedInpaintMode: React.Dispatch<React.SetStateAction<InpaintMode>>;
  setInpaintStrokeSize: React.Dispatch<React.SetStateAction<number>>;
  setSelectedInpaintSelectionTab: React.Dispatch<React.SetStateAction<InpaintSelectionTab>>;
  clearInpaintSelectionWithHistory: () => void;
  invertInpaintSelectionWithHistory: () => void;
  openMarkupModal: (tool?: RailTool) => void;
};

export function ExpertEditInpaintControlsContent({
  scope,
  selectedInpaintMode,
  isInpaintToolSelected,
  inpaintStrokeSize,
  selectedInpaintSelectionTab,
  imageHasInteractiveMask,
  setSelectedRailTool,
  setSelectedInpaintMode,
  setInpaintStrokeSize,
  setSelectedInpaintSelectionTab,
  clearInpaintSelectionWithHistory,
  invertInpaintSelectionWithHistory,
  openMarkupModal,
}: ExpertEditInpaintControlsContentProps) {
  const isInlineScope = scope === "inline";
  const isRailScope = scope === "rail";
  const modeIconSize = isInlineScope ? 16 : 19;
  const strokeSizeControlId = `edit-expert-inpaint-stroke-size-${scope}`;

  return (
    <div
      className={
        isInlineScope
          ? "edit-expert-inpaint-controls-content"
          : `edit-expert-markup-modal-inpaint-content ${
              isRailScope ? "edit-expert-markup-modal-inpaint-content--rail" : ""
            }`.trim()
      }
    >
      <div
        className={`edit-expert-inpaint-mode-row ${
          isRailScope ? "edit-expert-inpaint-mode-row--rail" : ""
        }`.trim()}
        role="group"
        aria-label="In-paint tool mode"
      >
        <button
          type="button"
          className={`edit-expert-inpaint-mode-btn ${
            !isInlineScope ? "edit-expert-markup-icon-only-btn" : ""
          } ${selectedInpaintMode === "brush" && isInpaintToolSelected ? "is-active" : ""}`.trim()}
          aria-pressed={selectedInpaintMode === "brush" && isInpaintToolSelected}
          aria-label="Brush"
          onClick={() => {
            setSelectedRailTool("inpaint");
            setSelectedInpaintMode("brush");
          }}
        >
          <PaintBrush size={modeIconSize} weight="regular" />
          {isInlineScope ? <span>Brush</span> : null}
        </button>
        <button
          type="button"
          className={`edit-expert-inpaint-mode-btn ${
            !isInlineScope ? "edit-expert-markup-icon-only-btn" : ""
          } ${selectedInpaintMode === "lasso" && isInpaintToolSelected ? "is-active" : ""}`.trim()}
          aria-pressed={selectedInpaintMode === "lasso" && isInpaintToolSelected}
          aria-label="Lasso"
          onClick={() => {
            setSelectedRailTool("inpaint");
            setSelectedInpaintMode("lasso");
          }}
        >
          <CircleDashed size={modeIconSize} weight="regular" />
          {isInlineScope ? <span>Lasso</span> : null}
        </button>
        {isInlineScope ? (
          <button
            type="button"
            className="edit-expert-inpaint-mode-btn edit-expert-inpaint-expand-btn"
            aria-label="Expand markup tools"
            onClick={() => openMarkupModal("markup")}
          >
            <ArrowsOutSimple size={modeIconSize} weight="regular" />
          </button>
        ) : (
          <button
            type="button"
            className="edit-expert-inpaint-action-btn edit-expert-markup-modal-inpaint-clear-btn"
            aria-label="Clear in-paint selection"
            onClick={clearInpaintSelectionWithHistory}
            disabled={!imageHasInteractiveMask}
          >
            <TrashSimple size={19} weight="regular" />
          </button>
        )}
      </div>
      <div className="edit-expert-inpaint-stroke-row">
        <label className="edit-expert-inpaint-stroke-label" htmlFor={strokeSizeControlId}>
          Stroke Size
        </label>
        <input
          id={strokeSizeControlId}
          className="edit-expert-inpaint-stroke-slider"
          type="range"
          min={1}
          max={100}
          value={inpaintStrokeSize}
          onChange={(event) => setInpaintStrokeSize(Number(event.target.value))}
          onDoubleClick={() => setInpaintStrokeSize(INPAINT_STROKE_SIZE_DEFAULT)}
          aria-label="In-paint stroke size"
        />
      </div>
      <div className="edit-expert-inpaint-selection-row">
        <div
          className="edit-expert-inpaint-select-tabs"
          role="tablist"
          aria-label="In-paint selection mode"
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
        {!isRailScope ? (
          <button
            type="button"
            className={`edit-expert-inpaint-action-btn ${
              isInlineScope
                ? "edit-expert-inpaint-invert-btn"
                : "edit-expert-markup-modal-inpaint-invert-btn"
            }`}
            aria-label="Invert in-paint selection"
            onClick={invertInpaintSelectionWithHistory}
            disabled={!imageHasInteractiveMask}
          >
            <CircleHalf size={18} weight="regular" />
          </button>
        ) : null}
        {isInlineScope ? (
          <button
            type="button"
            className="edit-expert-inpaint-action-btn edit-expert-inpaint-clear-btn"
            aria-label="Clear selection"
            onClick={clearInpaintSelectionWithHistory}
            disabled={!imageHasInteractiveMask}
          >
            <TrashSimple size={18} weight="regular" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

type ExpertEditMarkupModalGeneralPanelProps = {
  aspect: string;
  aspectOptionsForModel: AspectOption[];
  canUndoGeneralAction: boolean;
  canRedoGeneralAction: boolean;
  isGeneralResetDisabled: boolean;
  onAspectChange: (value: string) => void;
  handleUndoGeneralAction: () => void;
  handleRedoGeneralAction: () => void;
  handleResetGeneralAction: () => void;
};

export function ExpertEditMarkupModalGeneralPanel({
  aspect,
  aspectOptionsForModel,
  canUndoGeneralAction,
  canRedoGeneralAction,
  isGeneralResetDisabled,
  onAspectChange,
  handleUndoGeneralAction,
  handleRedoGeneralAction,
  handleResetGeneralAction,
}: ExpertEditMarkupModalGeneralPanelProps) {
  return (
    <div className="edit-expert-markup-modal-general-content">
      <div
        className="edit-expert-markup-modal-general-row"
        role="group"
        aria-label="General actions"
      >
        <button
          type="button"
          className="edit-expert-markup-modal-general-btn edit-expert-markup-modal-general-btn--icon"
          aria-label="Undo action"
          onClick={handleUndoGeneralAction}
          disabled={!canUndoGeneralAction}
        >
          <ArrowCounterClockwise size={15} weight="regular" />
        </button>
        <button
          type="button"
          className="edit-expert-markup-modal-general-btn edit-expert-markup-modal-general-btn--icon"
          aria-label="Redo action"
          onClick={handleRedoGeneralAction}
          disabled={!canRedoGeneralAction}
        >
          <ArrowClockwise size={15} weight="regular" />
        </button>
        <button
          type="button"
          className="edit-expert-markup-modal-general-btn edit-expert-markup-modal-general-btn--reset"
          aria-label="Reset all edit work"
          onClick={handleResetGeneralAction}
          disabled={isGeneralResetDisabled}
        >
          Reset All
        </button>
      </div>
      <div
        className="edit-expert-markup-modal-general-row edit-expert-markup-modal-general-row--aspect"
        role="group"
        aria-label="Aspect ratio selector"
      >
        <p className="edit-expert-markup-modal-general-subtitle">Frame</p>
        <AspectDropdown aspect={aspect} onSelect={onAspectChange} options={aspectOptionsForModel} />
      </div>
    </div>
  );
}

type ExpertEditPresetUtilityActionButtonsProps = {
  isGenerateDisabled: boolean;
  selectedLayerImageUrl: string | null;
  handleCompositeRegeneratePromptInsert: () => void;
};

export function ExpertEditPresetUtilityActionButtons({
  isGenerateDisabled,
  selectedLayerImageUrl,
  handleCompositeRegeneratePromptInsert,
}: ExpertEditPresetUtilityActionButtonsProps) {
  return editPresetUtilityActions.map((action) => {
    const Icon = action.icon;
    const isActionDisabled = Boolean(
      isGenerateDisabled || (action.requiresPrimaryImage && !selectedLayerImageUrl)
    );
    const actionCreditCost = action.creditCost;
    return (
      <button
        key={action.id}
        type="button"
        className={`edit-expert-preset-action-btn ${action.buttonClassName ?? ""}`.trim()}
        aria-label={action.label}
        disabled={isActionDisabled}
        onClick={
          action.id === "composite-regenerate" ? handleCompositeRegeneratePromptInsert : undefined
        }
      >
        {!action.hideIcon ? (
          <span className="edit-expert-preset-action-btn-icon" aria-hidden="true">
            <Icon size={20} weight={action.iconWeight ?? "regular"} />
          </span>
        ) : null}
        <span className="edit-expert-preset-action-btn-copy">
          <span>{action.label}</span>
        </span>
        {actionCreditCost != null ? (
          <span className="edit-expert-preset-action-btn-cost-column" aria-hidden="true">
            <span className="edit-expert-preset-action-btn-cost">
              <span className="model-chip-icon">✦</span>
              <span className="model-chip-credits">{actionCreditCost}</span>
            </span>
          </span>
        ) : null}
      </button>
    );
  });
}

type ExpertEditPresetToolbarCardProps = {
  hasSelectedPresetIds: boolean;
  selectedPanelPresets: Array<{ presetId: ExpertEditPresetId; label: string }>;
  isPresetPanelDropActive: boolean;
  isMorePresetsSurfaceOpen: boolean;
  morePresetsSurfaceId: string;
  setIsMorePresetsSurfaceOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handlePanelPresetApply: (presetId: ExpertEditPresetId) => void;
  handlePanelPresetDragStart: (
    event: React.DragEvent<HTMLButtonElement>,
    presetId: ExpertEditPresetId
  ) => void;
  handlePresetDragEnd: () => void;
  handlePresetPanelDragOver: (event: React.DragEvent<HTMLElement>) => void;
  handlePresetPanelDragLeave: (event: React.DragEvent<HTMLElement>) => void;
  handlePresetPanelDrop: (event: React.DragEvent<HTMLElement>) => void;
  toggleMorePresetsSurface: () => void;
};

export function ExpertEditPresetToolbarCard({
  hasSelectedPresetIds,
  selectedPanelPresets,
  isPresetPanelDropActive,
  isMorePresetsSurfaceOpen,
  morePresetsSurfaceId,
  setIsMorePresetsSurfaceOpen,
  handlePanelPresetApply,
  handlePanelPresetDragStart,
  handlePresetDragEnd,
  handlePresetPanelDragOver,
  handlePresetPanelDragLeave,
  handlePresetPanelDrop,
  toggleMorePresetsSurface,
}: ExpertEditPresetToolbarCardProps) {
  return (
    <div className="edit-expert-preset-toolbar-card edit-expert-preset-toolbar-card--inline">
      <div className="edit-expert-preset-toolbar-title-card edit-expert-preset-toolbar-title-card--embedded">
        <p className="edit-expert-preset-toolbar-title">Prompt Presets</p>
        <span className="edit-expert-preset-toolbar-title-icon" aria-hidden="true">
          <Sliders size={14} weight="regular" />
        </span>
      </div>
      <div className="edit-expert-preset-toolbar-list">
        <div
          className={`edit-expert-preset-dropzone ${
            hasSelectedPresetIds ? "is-populated" : "is-empty"
          } ${isPresetPanelDropActive ? "is-drop-active" : ""}`.trim()}
          aria-label="Preset panel list"
          onDragOver={handlePresetPanelDragOver}
          onDragLeave={handlePresetPanelDragLeave}
          onDrop={handlePresetPanelDrop}
        >
          {hasSelectedPresetIds ? (
            selectedPanelPresets.map((preset) => (
              <button
                key={preset.presetId}
                type="button"
                draggable
                className="edit-expert-preset-btn edit-expert-preset-btn--selected"
                aria-label={`Apply ${preset.label} preset`}
                onClick={() => handlePanelPresetApply(preset.presetId)}
                onDragStart={(event) => handlePanelPresetDragStart(event, preset.presetId)}
                onDragEnd={handlePresetDragEnd}
              >
                {preset.label}
              </button>
            ))
          ) : (
            <button
              type="button"
              className="edit-expert-preset-empty-drop"
              aria-label="Empty preset drop target"
              onClick={() => setIsMorePresetsSurfaceOpen(true)}
            >
              Drag presets here
            </button>
          )}
        </div>
        <div className="edit-expert-preset-divider" aria-hidden="true" />
        <button
          type="button"
          className="edit-expert-preset-btn"
          aria-label={`Apply ${EDIT_PRESET_MORE_LABEL} preset`}
          aria-expanded={isMorePresetsSurfaceOpen}
          aria-controls={morePresetsSurfaceId}
          onClick={toggleMorePresetsSurface}
        >
          <span className="edit-expert-preset-btn-icon" aria-hidden="true">
            <GearSix size={12} weight="regular" />
          </span>
          {EDIT_PRESET_MORE_LABEL}
        </button>
      </div>
    </div>
  );
}
