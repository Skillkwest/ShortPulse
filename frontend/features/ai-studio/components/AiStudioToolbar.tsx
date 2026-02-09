/**
 * Toolbar for AI Studio tools.
 * Handles top-level create selection and exposes create child actions.
 */
import Link from "next/link";
import React from "react";
import {
  Globe,
  FlowArrow,
  Graph,
  House,
  ImageSquare,
  Person,
  Selection,
  Sparkle,
  SquaresFour,
  StackSimple,
  TextT,
  VideoCamera,
  CloudArrowUp,
} from "phosphor-react";
import { createChildTools, creationsToolList, editToolList, lowerToolList, primaryToolList } from "../constants";
import { ToolId } from "../types";

type AiStudioToolbarProps = {
  selectedTool: ToolId | null;
  showCreateTools: boolean;
  beginnerMode: boolean;
  onSelectTool: (tool: ToolId | null) => void;
  onToggleCreateTools: (show: boolean) => void;
  onToggleBeginnerMode: (enabled: boolean) => void;
  showOnboardingSteps?: boolean;
};

const toolIcons: Record<ToolId, React.ComponentType<any>> = {
  create: Sparkle,
  workflows: FlowArrow,
  templates: SquaresFour,
  "my-generations": StackSimple,
  community: Globe,
  text: TextT,
  image: ImageSquare,
  video: VideoCamera,
  character: Person,
  kling: VideoCamera,
  edit: Selection,
  canvas: Graph,
};

/**
 * Renders the AI Studio toolbar with primary and nested create options.
 */
export function AiStudioToolbar({
  selectedTool,
  showCreateTools,
  beginnerMode,
  onSelectTool,
  onToggleCreateTools,
  onToggleBeginnerMode,
  showOnboardingSteps = false,
}: AiStudioToolbarProps) {
  const isCreateChildSelected =
    selectedTool === "text" ||
    selectedTool === "image" ||
    selectedTool === "video" ||
    selectedTool === "character";
  const isCreateButtonActive = selectedTool === "create";
  const isCreateExpanded = showCreateTools || isCreateChildSelected || isCreateButtonActive;
  const activePrimary: "create" | "edit" | "canvas" | null = isCreateExpanded
    ? "create"
    : selectedTool === "edit"
      ? "edit"
      : selectedTool === "canvas"
        ? "canvas"
        : null;

  return (
    <aside
      className={`panel ai-panel ai-toolbar ai-toolbar-floating${isCreateExpanded ? " create-active" : ""}`}
      data-primary-active={activePrimary || undefined}
    >
      <div className="toolbar-logo">
        <img src="/brand-logo.png" alt="Brand logo" />
      </div>
      <Link href="/dashboard" className="ghost-btn small toolbar-back-link">
        <House size={16} weight="regular" />
        Dashboard
      </Link>
      <div className="toolbar-divider" aria-hidden="true" />
      <div className="toolbar-list">
        {primaryToolList.map((tool) => {
          const IconComponent = toolIcons[tool.id];
          const isCreateParent = tool.id === "create";
          const isActive = selectedTool === tool.id || (isCreateParent && (showCreateTools || isCreateChildSelected));
          const handleClick = () => {
            if (isActive) {
              onToggleCreateTools(false);
              onSelectTool(null);
              return;
            }
            if (isCreateParent) {
              onToggleCreateTools(true);
              if (!isCreateChildSelected) {
                onSelectTool("text");
              } else {
                onSelectTool(tool.id);
              }
              return;
            }
            onToggleCreateTools(false);
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
        <div className={`toolbar-create-children ${isCreateExpanded ? "is-open" : ""}`} aria-hidden={!isCreateExpanded}>
          {createChildTools.map((tool) => {
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
        })}
          <div className="toolbar-divider toolbar-divider-children" aria-hidden="true" />
          <div className="toolbar-create-spacer" aria-hidden="true" />
        </div>
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
                const isToggleablePrimary = tool.id === "edit" || tool.id === "canvas";
                if (isToggleablePrimary && isActive) {
                  onToggleCreateTools(false);
                  onSelectTool(null);
                  return;
                }
                onToggleCreateTools(false);
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
                onToggleCreateTools(false);
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
                  onToggleCreateTools(false);
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
          <div className="toolbar-divider toolbar-divider-secondary" aria-hidden="true" />
        </div>
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
    </div>
    </aside>
  );
}
