/**
 * Left-rail mode panel for Move/In-paint/Markup controls in Expert Edit modal.
 */
import React from "react";
import type { RailTool } from "./expertEditPanelViewContract";

type ExpertEditModeRailPanelProps = {
  selectedRailTool: RailTool;
  renderInpaintControlsContent: (scope: "inline" | "modal" | "rail") => React.ReactNode;
  renderMarkupControlsContent: (scope: "inline" | "modal") => React.ReactNode;
  renderMoveControlsContent: (scope: "inline" | "modal") => React.ReactNode;
};

export function ExpertEditModeRailPanel({
  selectedRailTool,
  renderInpaintControlsContent,
  renderMarkupControlsContent,
  renderMoveControlsContent,
}: ExpertEditModeRailPanelProps) {
  const selectedModePanel =
    selectedRailTool === "inpaint"
      ? {
          panelClassName: "inpaint",
          title: "In-paint",
          railLabel: "Left rail in-paint panel",
          body: (
            <div className="edit-expert-markup-modal-controls-compact edit-expert-markup-modal-controls-compact--inpaint edit-expert-mode-rail-panel-body edit-expert-mode-rail-panel-body--inpaint">
              {renderInpaintControlsContent("rail")}
            </div>
          ),
        }
      : selectedRailTool === "markup"
        ? {
            panelClassName: "markup",
            title: "Markup",
            railLabel: "Left rail markup panel",
            body: (
              <div className="edit-expert-markup-modal-controls-compact edit-expert-markup-modal-controls-compact--markup edit-expert-mode-rail-panel-body edit-expert-mode-rail-panel-body--markup">
                {renderMarkupControlsContent("modal")}
              </div>
            ),
          }
        : {
            panelClassName: "move",
            title: "Move",
            railLabel: "Left rail move panel",
            body: (
              <div className="edit-expert-markup-modal-controls-compact edit-expert-markup-modal-controls-compact--move edit-expert-mode-rail-panel-body edit-expert-mode-rail-panel-body--move">
                {renderMoveControlsContent("modal")}
              </div>
            ),
          };

  return (
    <section
      className={`edit-expert-mode-rail-panel edit-expert-mode-rail-panel--${selectedModePanel.panelClassName}`}
      role="group"
      aria-label={selectedModePanel.railLabel}
    >
      <div className="edit-expert-mode-rail-panel-header">
        <p className="edit-expert-mode-rail-panel-title">{selectedModePanel.title}</p>
      </div>
      {selectedModePanel.body}
    </section>
  );
}
