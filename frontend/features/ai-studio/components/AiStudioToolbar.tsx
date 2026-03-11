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
  SpeakerHigh,
  Selection,
  Sliders,
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
  librariesToolList,
  primaryToolList,
  shortcutsToolList,
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
  "media-library": ImageSquare,
  workflows: FlowArrow,
  presets: Sliders,
  styles: Sparkle,
  templates: SquaresFour,
  "my-generations": StackSimple,
  community: Globe,
  text: TextT,
  image: ImageSquare,
  video: VideoCamera,
  sound: SpeakerHigh,
  character: Person,
  kling: VideoCamera,
  edit: Selection,
  canvas: SquaresFour,
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
  const isSoundSelected = selectedTool === "sound";
  const isCharacterSelected = isCharacterWorkflow(selectedTool);
  const isCanvasSelected = selectedTool === "canvas";
  const activePrimary: "create" | "video" | "sound" | "edit" | "canvas" | null = isCreateSelected
    ? "create"
    : isVideoSelected
      ? "video"
      : isSoundSelected
        ? "sound"
        : isEditSelected
          ? "edit"
          : isCanvasSelected
            ? "canvas"
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
              : tool.id === "sound"
                ? isSoundSelected
                : tool.id === "canvas"
                  ? isCanvasSelected
                  : tool.id === "edit"
                    ? isEditSelected
                    : selectedTool === tool.id;
          return (
            <React.Fragment key={tool.id}>
              {tool.id === "canvas" ? <div className="toolbar-divider" aria-hidden="true" /> : null}
              <button
                type="button"
                className={`toolbar-item ${isActive ? "is-active" : ""}`}
                data-tool-id={tool.id}
                onClick={() => {
                  const isToggleablePrimary =
                    tool.id === "video" ||
                    tool.id === "sound" ||
                    tool.id === "edit" ||
                    tool.id === "canvas";
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
            </React.Fragment>
          );
        })}
        <div className="toolbar-divider" aria-hidden="true" />
        <div className="toolbar-lower toolbar-libraries">
          <p className="toolbar-section-label">Libraries</p>
          {librariesToolList.map((tool) => {
            const IconComponent = toolIcons[tool.id];
            const isCharacterShortcut = tool.id === "character";
            const isMediaLibraryTool = tool.id === "media-library";
            const isActive = isCharacterShortcut
              ? isCharacterSelected
              : isMediaLibraryTool
                ? selectedTool === "media-library"
                : selectedTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                className={`toolbar-item toolbar-item-secondary ${isActive ? "is-active" : ""}`}
                onClick={() => {
                  if (isCharacterShortcut && isCharacterSelected) {
                    onToggleCreateTools(false);
                    onSelectTool(null);
                    return;
                  }
                  if (isMediaLibraryTool && isActive) {
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
        </div>
        <div className="toolbar-divider" aria-hidden="true" />
        <div className="toolbar-lower">
          <p className="toolbar-section-label">Shortcuts</p>
          {shortcutsToolList.map((tool) => {
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
