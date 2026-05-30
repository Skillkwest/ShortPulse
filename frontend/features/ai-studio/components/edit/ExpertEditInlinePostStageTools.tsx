import React from "react";
import { CaretRight } from "phosphor-react";

import type { RailTool } from "./expertEditPanelViewContract";
import { inpaintRailTools } from "./expertEditPanelViewContract";

type ExpertEditInlinePostStageToolsProps = {
  isAdvancedEditModesEnabled: boolean;
  isInpaintCollapsed: boolean;
  isInpaintCollapsing: boolean;
  collapsedToolsThemeClass: string;
  selectedRailTool: RailTool;
  isInpaintToolSelected: boolean;
  isMarkupToolSelected: boolean;
  isMoveToolSelected: boolean;
  isInpaintLikeToolSelected: boolean;
  setSelectedRailTool: React.Dispatch<React.SetStateAction<RailTool>>;
  handleInpaintCollapseToggle: () => void;
  renderInpaintControlsContent: (scope: "inline" | "modal" | "rail") => React.ReactNode;
  renderMarkupControlsContent: (scope: "inline" | "modal") => React.ReactNode;
  renderMoveControlsContent: (scope: "inline" | "modal") => React.ReactNode;
  secondaryContent?: React.ReactNode;
};

export function ExpertEditInlinePostStageTools({
  isAdvancedEditModesEnabled,
  isInpaintCollapsed,
  isInpaintCollapsing,
  collapsedToolsThemeClass,
  selectedRailTool,
  isInpaintToolSelected,
  isMarkupToolSelected,
  isMoveToolSelected,
  isInpaintLikeToolSelected,
  setSelectedRailTool,
  handleInpaintCollapseToggle,
  renderInpaintControlsContent,
  renderMarkupControlsContent,
  renderMoveControlsContent,
  secondaryContent = null,
}: ExpertEditInlinePostStageToolsProps) {
  const activeCollapsedRailTool =
    inpaintRailTools.find((tool) => tool.id === selectedRailTool) ?? inpaintRailTools[0];

  if (!isAdvancedEditModesEnabled) {
    return (
      <div className="edit-expert-inpaint-row edit-expert-inpaint-row--standard-only">
        <div
          className="edit-expert-inpaint-controls is-themed-move"
          role="group"
          aria-label="Move tools"
        >
          {renderMoveControlsContent("inline")}
        </div>
        {secondaryContent}
      </div>
    );
  }

  return (
    <>
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
                } ${isMarkupToolSelected ? "is-themed-markup" : ""} ${
                  isMoveToolSelected ? "is-themed-move" : ""
                }`.trim()}
                role="group"
                aria-label={
                  isInpaintLikeToolSelected
                    ? isMarkupToolSelected
                      ? "Markup tools"
                      : "Inpaint tools"
                    : "Move tools"
                }
              >
                {isInpaintToolSelected
                  ? renderInpaintControlsContent("inline")
                  : isMarkupToolSelected
                    ? renderMarkupControlsContent("inline")
                    : renderMoveControlsContent("inline")}
              </div>
            </div>
          </div>
        ) : null}
        {secondaryContent}
      </div>
    </>
  );
}
