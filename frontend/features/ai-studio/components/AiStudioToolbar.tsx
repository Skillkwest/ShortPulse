/**
 * Toolbar for AI Studio tools.
 * Handles top-level AI Studio tool selection.
 */
import Image from "next/image";
import React from "react";
import {
  Globe,
  FlowArrow,
  ImageSquare,
  type IconProps,
  Person,
  Selection,
  Sparkle,
  SquaresFour,
  StackSimple,
  TextT,
  VideoCamera,
} from "phosphor-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { DashboardNavPrefab } from "../../../components/DashboardNavPrefab";
import {
  AI_STUDIO_TOOLBAR_LOGO_SRC,
  creationsToolList,
  editToolList,
  lowerToolList,
  primaryToolList,
} from "../constants";
import { ToolId } from "../types";
import {
  isCharacterWorkflow,
  isCreateWorkflow,
  isEditWorkflow,
  isVideoWorkflow,
} from "../logic/workflowIdentity";

type AiStudioToolbarProps = {
  selectedTool: ToolId | null;
  showCreateTools: boolean;
  beginnerMode: boolean;
  showBeginnerModeToggle?: boolean;
  onSelectTool: (tool: ToolId | null) => void;
  onToggleCreateTools: (show: boolean) => void;
  onToggleBeginnerMode: (enabled: boolean) => void;
};

type IconComponent = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

const toolIcons: Record<ToolId, IconComponent> = {
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
  canvas: Person,
};

/**
 * Renders the AI Studio toolbar with primary and nested create options.
 */
function AiStudioToolbarComponent({
  selectedTool,
  beginnerMode,
  showBeginnerModeToggle = true,
  onSelectTool,
  onToggleCreateTools,
  onToggleBeginnerMode,
}: AiStudioToolbarProps) {
  const isCreateSelected = isCreateWorkflow(selectedTool);
  const isEditSelected = isEditWorkflow(selectedTool);
  const isVideoSelected = isVideoWorkflow(selectedTool);
  const isCharacterSelected = isCharacterWorkflow(selectedTool);
  const activePrimary: "create" | "video" | "edit" | "character" | null = isCreateSelected
    ? "create"
    : isVideoSelected
      ? "video"
      : isEditSelected
        ? "edit"
        : isCharacterSelected
          ? "character"
          : null;

  return (
    <aside
      className="panel ai-panel ai-toolbar ai-toolbar-floating"
      data-primary-active={activePrimary || undefined}
    >
      <div className="toolbar-logo">
        <Image
          src={AI_STUDIO_TOOLBAR_LOGO_SRC}
          alt="AI Studio logo"
          width={150}
          height={150}
          priority
        />
      </div>
      <DashboardNavPrefab className="toolbar-back-link" />
      <div className="toolbar-divider" aria-hidden="true" />
      <div className="toolbar-list">
        {primaryToolList.map((tool) => {
          const IconComponent = toolIcons[tool.id];
          const isCreateParent = tool.id === "create";
          const isActive = isCreateParent ? isCreateSelected : selectedTool === tool.id;
          const handleClick = () => {
            if (isCreateParent) {
              if (isActive) {
                onToggleCreateTools(false);
                onSelectTool(null);
                return;
              }
              // Create now behaves exactly like the old Text child action.
              onToggleCreateTools(false);
              onSelectTool("create");
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
        {editToolList.map((tool) => {
          const IconComponent = toolIcons[tool.id];
          const isActive =
            tool.id === "video"
              ? isVideoSelected
              : tool.id === "character"
                ? isCharacterSelected
                : tool.id === "edit"
                  ? isEditSelected
                  : selectedTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              className={`toolbar-item ${isActive ? "is-active" : ""}`}
              data-tool-id={tool.id}
              onClick={() => {
                const isToggleablePrimary =
                  tool.id === "video" || tool.id === "edit" || tool.id === "character";
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
      <div
        className={`toolbar-footer ${showBeginnerModeToggle ? "" : "toolbar-footer--toggle-hidden"}`}
      >
        {showBeginnerModeToggle ? (
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
        ) : null}
      </div>
    </aside>
  );
}

export const AiStudioToolbar = React.memo(AiStudioToolbarComponent);
