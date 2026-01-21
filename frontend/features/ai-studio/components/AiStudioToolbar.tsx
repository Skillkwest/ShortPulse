/**
 * Toolbar for AI Studio tools.
 * Handles top-level create/edit selection and exposes edit child actions.
 */
import Link from "next/link";
import React from "react";
import { Activity, ImageSquare, Sparkle, VideoCamera } from "phosphor-react";
import { editChildTools, toolList } from "../constants";
import { ToolId } from "../types";

type AiStudioToolbarProps = {
  selectedTool: ToolId | null;
  showEditTools: boolean;
  onSelectTool: (tool: ToolId) => void;
  onToggleEditTools: (show: boolean) => void;
};

const toolIcons: Record<ToolId, React.ComponentType<any>> = {
  create: Sparkle,
  "edit-parent": Activity,
  "image-to-image": ImageSquare,
  "image-to-video": VideoCamera,
};

/**
 * Renders the AI Studio toolbar with primary and nested edit options.
 */
export function AiStudioToolbar({
  selectedTool,
  showEditTools,
  onSelectTool,
  onToggleEditTools,
}: AiStudioToolbarProps) {
  const isEditChildSelected = selectedTool === "image-to-image" || selectedTool === "image-to-video";

  return (
    <aside className="panel ai-panel ai-toolbar ai-toolbar-floating">
      <div className="toolbar-logo-card">
        <img src="/brand-logo.png" alt="Brand logo" />
      </div>
      <Link href="/dashboard" className="ghost-btn small toolbar-back-link">
        ← Back to dashboard
      </Link>
      <div className="toolbar-brand toolbar-title-only">
        <div>
          <p className="eyebrow">Tools</p>
        </div>
      </div>
      <div className="toolbar-list">
        {toolList.map((tool) => {
          const IconComponent = toolIcons[tool.id];
          const isEditParent = tool.id === "edit-parent";
          const isActive = selectedTool === tool.id || (isEditParent && (showEditTools || isEditChildSelected));
          return (
            <button
              key={tool.id}
              type="button"
              className={`toolbar-item ${isActive ? "is-active" : ""}`}
              onClick={() => {
                if (isEditParent) {
                  onToggleEditTools(true);
                  if (!isEditChildSelected) {
                    onSelectTool("image-to-image");
                  }
                  return;
                }
                onToggleEditTools(false);
                onSelectTool(tool.id);
              }}
            >
              {IconComponent ? <IconComponent size={18} weight="bold" /> : null}
              <div className="toolbar-copy">
                <span className="toolbar-label">{tool.label}</span>
              </div>
            </button>
          );
        })}
        {showEditTools
          ? editChildTools.map((tool) => {
              const IconComponent = toolIcons[tool.id];
              const isActive = selectedTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  className={`toolbar-item toolbar-item-child ${isActive ? "is-active" : ""}`}
                  onClick={() => onSelectTool(tool.id)}
                >
                  {IconComponent ? <IconComponent size={18} weight="bold" /> : null}
                  <div className="toolbar-copy">
                    <span className="toolbar-label">{tool.label}</span>
                  </div>
                </button>
              );
            })
          : null}
      </div>
    </aside>
  );
}
