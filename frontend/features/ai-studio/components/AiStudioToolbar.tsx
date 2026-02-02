/**
 * Toolbar for AI Studio tools.
 * Handles top-level create/edit selection and exposes edit child actions.
 */
import Link from "next/link";
import React from "react";
import {
  Globe,
  FlowArrow,
  Gear,
  Graph,
  House,
  ImageSquare,
  MagicWand,
  Person,
  Selection,
  Sparkle,
  SquaresFour,
  StackSimple,
  TextT,
  UsersThree,
  VideoCamera,
} from "phosphor-react";
import { creationsToolList, editChildTools, editToolList, lowerToolList, primaryToolList } from "../constants";
import { ToolId } from "../types";

type AiStudioToolbarProps = {
  selectedTool: ToolId | null;
  showEditTools: boolean;
  beginnerMode: boolean;
  onSelectTool: (tool: ToolId | null) => void;
  onToggleEditTools: (show: boolean) => void;
  onToggleBeginnerMode: (enabled: boolean) => void;
  showOnboardingSteps?: boolean;
};

const toolIcons: Record<ToolId, React.ComponentType<any>> = {
  create: Sparkle,
  workflows: FlowArrow,
  templates: SquaresFour,
  "my-generations": StackSimple,
  community: Globe,
  "edit-parent": Sparkle,
  text: TextT,
  "image-to-image": ImageSquare,
  "image-to-video": VideoCamera,
  enhance: MagicWand,
  character: Person,
  edit: Selection,
  canvas: Graph,
};

/**
 * Renders the AI Studio toolbar with primary and nested edit options.
 */
export function AiStudioToolbar({
  selectedTool,
  showEditTools,
  beginnerMode,
  onSelectTool,
  onToggleEditTools,
  onToggleBeginnerMode,
  showOnboardingSteps = false,
}: AiStudioToolbarProps) {
  const isEditChildSelected =
    selectedTool === "text" ||
    selectedTool === "image-to-image" ||
    selectedTool === "image-to-video" ||
    selectedTool === "enhance" ||
    selectedTool === "character";

  return (
    <aside className="panel ai-panel ai-toolbar ai-toolbar-floating">
      <div className="toolbar-logo">
        <img src="/brand-logo.png" alt="Brand logo" />
      </div>
      <Link href="/dashboard" className="ghost-btn small toolbar-back-link">
        <House size={16} weight="regular" />
        Back to dashboard
      </Link>
      <div className="toolbar-list">
        {primaryToolList.map((tool, index) => {
          const IconComponent = toolIcons[tool.id];
          const isEditParent = tool.id === "edit-parent";
          const isActive = selectedTool === tool.id || (isEditParent && (showEditTools || isEditChildSelected));
          const handleClick = () => {
            if (isActive) {
              onToggleEditTools(false);
              onSelectTool(null);
              return;
            }
            if (isEditParent) {
              onToggleEditTools(true);
              if (!isEditChildSelected) {
                onSelectTool("text");
              } else {
                onSelectTool(tool.id);
              }
              return;
            }
            onToggleEditTools(false);
            onSelectTool(tool.id);
          };
          return (
            <React.Fragment key={tool.id}>
              <button
                type="button"
                className={`toolbar-item ${isActive ? "is-active" : ""}`}
                data-tool-id={tool.id}
                onClick={handleClick}
              >
                {IconComponent ? <IconComponent size={18} weight="regular" /> : null}
                <div className="toolbar-copy">
                  <span className="toolbar-label">{tool.label}</span>
                </div>
              </button>
            </React.Fragment>
          );
        })}
        {showEditTools ? <div className="toolbar-divider toolbar-divider-children" aria-hidden="true" /> : null}
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
                {IconComponent ? <IconComponent size={18} weight="regular" /> : null}
                <div className="toolbar-copy">
                  <span className="toolbar-label">{tool.label}</span>
                </div>
              </button>
              );
            })
          : null}
        {editToolList.map((tool) => {
          const IconComponent = toolIcons[tool.id];
          const isActive = selectedTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              className={`toolbar-item ${isActive ? "is-active" : ""}`}
              data-tool-id={tool.id}
              onClick={() => {
                onToggleEditTools(false);
                onSelectTool(tool.id);
              }}
            >
              {IconComponent ? <IconComponent size={18} weight="regular" /> : null}
              <div className="toolbar-copy">
                <span className="toolbar-label">{tool.label}</span>
              </div>
            </button>
          );
        })}
        <div className="toolbar-divider" aria-hidden="true" />
        <div className="toolbar-lower">
          <p className="toolbar-section-label">Shortcuts</p>
          {lowerToolList.map((tool) => {
            const IconComponent = toolIcons[tool.id];
            const isActive = selectedTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                className={`toolbar-item toolbar-item-secondary ${isActive ? "is-active" : ""}`}
                onClick={() => {
                  onToggleEditTools(false);
                  onSelectTool(tool.id);
                }}
              >
                {IconComponent ? <IconComponent size={18} weight="regular" /> : null}
                <div className="toolbar-copy">
                  <span className="toolbar-label">{tool.label}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="toolbar-divider" aria-hidden="true" />
        <div className="toolbar-creations">
          <p className="toolbar-section-label">Creations</p>
          {creationsToolList.map((tool) => {
            const IconComponent = toolIcons[tool.id];
            const isActive = selectedTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                className={`toolbar-item toolbar-item-secondary ${isActive ? "is-active" : ""}`}
                onClick={() => {
                  onToggleEditTools(false);
                  onSelectTool(tool.id);
                }}
              >
                {IconComponent ? <IconComponent size={18} weight="regular" /> : null}
                <div className="toolbar-copy">
                  <span className="toolbar-label">{tool.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      <div className="toolbar-divider toolbar-divider-secondary" aria-hidden="true" />
    </div>
    <div className="toolbar-footer">
      <div className="toolbar-beginner-toggle">
        <div className="toolbar-beginner-copy">
          <span className="toolbar-label">Beginner mode</span>
        </div>
        <button
          type="button"
          className={`reference-toggle beginner-toggle ${beginnerMode ? "is-active" : ""}`}
          aria-pressed={beginnerMode}
          aria-label={beginnerMode ? "Disable beginner mode" : "Enable beginner mode"}
          onClick={() => onToggleBeginnerMode(!beginnerMode)}
        >
          <span className="reference-toggle-track" aria-hidden="true">
            <span className="reference-toggle-dot" />
          </span>
        </button>
      </div>
      <Link href="/profile" className="toolbar-profile-link">
        <span className="toolbar-profile-avatar">KI</span>
        <span className="toolbar-profile-name">Kirk</span>
      </Link>
    </div>
    </aside>
  );
}
