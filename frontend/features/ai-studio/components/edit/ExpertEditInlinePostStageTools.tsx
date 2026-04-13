import React from "react";
import {
  ArrowsOutSimple,
  CaretRight,
  CircleDashed,
  CircleHalf,
  PaintBrush,
  TrashSimple,
} from "phosphor-react";

import type { InpaintMode, InpaintSelectionTab, RailTool } from "./expertEditPanelViewContract";
import { INPAINT_STROKE_SIZE_DEFAULT, inpaintRailTools } from "./expertEditPanelViewContract";

type ExpertEditInlinePostStageToolsProps = {
  isInpaintCollapsed: boolean;
  isInpaintCollapsing: boolean;
  collapsedToolsThemeClass: string;
  selectedRailTool: RailTool;
  isInpaintToolSelected: boolean;
  isVideoToolSelected: boolean;
  isMoveToolSelected: boolean;
  isInpaintLikeToolSelected: boolean;
  selectedInpaintMode: InpaintMode;
  inpaintStrokeSize: number;
  selectedInpaintSelectionTab: InpaintSelectionTab;
  imageHasInteractiveMask: boolean;
  setSelectedRailTool: React.Dispatch<React.SetStateAction<RailTool>>;
  setSelectedInpaintMode: React.Dispatch<React.SetStateAction<InpaintMode>>;
  setInpaintStrokeSize: React.Dispatch<React.SetStateAction<number>>;
  setSelectedInpaintSelectionTab: React.Dispatch<React.SetStateAction<InpaintSelectionTab>>;
  handleInpaintCollapseToggle: () => void;
  openMarkupModal: (tool?: RailTool) => void;
  clearInpaintSelectionWithHistory: () => void;
  invertInpaintSelectionWithHistory: () => void;
  renderMarkupControlsContent: (scope: "inline" | "modal") => React.ReactNode;
  renderMoveControlsContent: (scope: "inline" | "modal") => React.ReactNode;
  secondaryContent?: React.ReactNode;
};

export function ExpertEditInlinePostStageTools({
  isInpaintCollapsed,
  isInpaintCollapsing,
  collapsedToolsThemeClass,
  selectedRailTool,
  isInpaintToolSelected,
  isVideoToolSelected,
  isMoveToolSelected,
  isInpaintLikeToolSelected,
  selectedInpaintMode,
  inpaintStrokeSize,
  selectedInpaintSelectionTab,
  imageHasInteractiveMask,
  setSelectedRailTool,
  setSelectedInpaintMode,
  setInpaintStrokeSize,
  setSelectedInpaintSelectionTab,
  handleInpaintCollapseToggle,
  openMarkupModal,
  clearInpaintSelectionWithHistory,
  invertInpaintSelectionWithHistory,
  renderMarkupControlsContent,
  renderMoveControlsContent,
  secondaryContent = null,
}: ExpertEditInlinePostStageToolsProps) {
  const activeCollapsedRailTool =
    inpaintRailTools.find((tool) => tool.id === selectedRailTool) ?? inpaintRailTools[0];

  return (
    <div className="edit-expert-column-wrapper edit-expert-column-wrapper--center edit-expert-post-stage-wrapper">
      <div
        className={`edit-expert-inpaint-row ${isInpaintCollapsed ? "is-collapsed" : ""} ${
          isInpaintCollapsing ? "is-collapsing" : ""
        }`.trim()}
      >
        {isInpaintCollapsed ? (
          <button
            type="button"
            className={`edit-expert-inpaint-collapse-btn edit-expert-inpaint-collapse-btn--hidden ${collapsedToolsThemeClass}`}
            aria-label="Expand inpaint controls"
            aria-expanded={!isInpaintCollapsed}
            aria-controls="edit-expert-inpaint-content"
            onClick={handleInpaintCollapseToggle}
          >
            {activeCollapsedRailTool.label}
          </button>
        ) : null}
        {!isInpaintCollapsed ? (
          <div className="edit-expert-inpaint-collapse-control">
            <button
              type="button"
              className={`edit-expert-inpaint-collapse-btn ${collapsedToolsThemeClass}`}
              aria-label="Collapse inpaint controls"
              aria-expanded={!isInpaintCollapsed}
              aria-controls="edit-expert-inpaint-content"
              onClick={handleInpaintCollapseToggle}
            >
              <CaretRight size={20} weight="fill" data-testid="inpaint-collapse-icon-dots" />
            </button>
          </div>
        ) : null}
        {!isInpaintCollapsed ? (
          <div
            className={`edit-expert-inpaint-wrapper ${isInpaintCollapsed ? "is-collapsed" : ""}`}
            role="group"
            aria-label="Inpaint controls group"
          >
            <div
              id="edit-expert-inpaint-content"
              className={`edit-expert-inpaint-content ${isInpaintCollapsing ? "is-collapsing" : ""}`}
            >
              <div className="edit-expert-inpaint-tool-rail" aria-label="Inpaint action tools">
                <p className="edit-expert-inpaint-tool-rail-title">Select tool</p>
                <div className="edit-expert-inpaint-tool-rail-buttons">
                  {inpaintRailTools.map((tool) => {
                    const Icon = tool.icon;
                    const isSelected = selectedRailTool === tool.id;
                    const iconWeight = isSelected ? "bold" : "regular";
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        className={`edit-expert-inpaint-tool-rail-btn ${
                          isSelected ? `is-selected ${tool.selectedClassName}` : ""
                        }`.trim()}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedRailTool(tool.id)}
                      >
                        <Icon size={14} weight={iconWeight} />
                        <span>{tool.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div
                className={`edit-expert-inpaint-controls ${
                  isInpaintToolSelected ? "is-themed-inpaint" : ""
                } ${isVideoToolSelected ? "is-themed-video" : ""} ${
                  isMoveToolSelected ? "is-themed-move" : ""
                }`.trim()}
                role="group"
                aria-label={
                  isInpaintLikeToolSelected
                    ? isVideoToolSelected
                      ? "Markup tools"
                      : "Inpaint tools"
                    : "Move tools"
                }
              >
                {isInpaintToolSelected ? (
                  <div className="edit-expert-inpaint-controls-content">
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
                        className="edit-expert-inpaint-mode-btn edit-expert-inpaint-expand-btn"
                        aria-label="Expand markup tools"
                        onClick={() => openMarkupModal("video")}
                      >
                        <ArrowsOutSimple size={16} weight="regular" />
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
                        value={inpaintStrokeSize}
                        onChange={(event) => setInpaintStrokeSize(Number(event.target.value))}
                        onDoubleClick={() => setInpaintStrokeSize(INPAINT_STROKE_SIZE_DEFAULT)}
                        aria-label="Stroke size"
                      />
                    </div>
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
                        className="edit-expert-inpaint-action-btn edit-expert-inpaint-invert-btn"
                        aria-label="Invert selection"
                        onClick={invertInpaintSelectionWithHistory}
                        disabled={!imageHasInteractiveMask}
                      >
                        <CircleHalf size={18} weight="regular" />
                      </button>
                      <button
                        type="button"
                        className="edit-expert-inpaint-action-btn edit-expert-inpaint-clear-btn"
                        aria-label="Clear selection"
                        onClick={clearInpaintSelectionWithHistory}
                        disabled={!imageHasInteractiveMask}
                      >
                        <TrashSimple size={18} weight="regular" />
                      </button>
                    </div>
                  </div>
                ) : isVideoToolSelected ? (
                  renderMarkupControlsContent("inline")
                ) : (
                  renderMoveControlsContent("inline")
                )}
              </div>
            </div>
          </div>
        ) : null}
        {secondaryContent}
      </div>
    </div>
  );
}
