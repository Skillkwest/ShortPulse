/**
 * Toolbar for AI Studio tools.
 * Handles top-level AI Studio tool selection.
 */
import Image from "next/image";
import React from "react";
import {
  At,
  Folders,
  Globe,
  FlowArrow,
  ImageSquare,
  type IconProps,
  Palette,
  Person,
  Microphone,
  SpeakerHigh,
  Selection,
  Sliders,
  Sparkle,
  SquaresFour,
  StackSimple,
  TextT,
  MusicNotes,
  VideoCamera,
} from "phosphor-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import { DashboardNavPrefab } from "../../../components/DashboardNavPrefab";
import { AiStudioToolbarAccountMenu } from "./AiStudioToolbarAccountMenu";
import {
  AI_STUDIO_TOOLBAR_LOGO_SRC,
  creationsToolList,
  librariesToolList,
  primaryToolList,
  soundChildTools,
  shortcutsToolList,
  workflowToolList,
} from "../constants";
import { ToolId } from "../types";
import {
  isCharacterWorkflow,
  isCreateWorkflow,
  isEditWorkflow,
  isSoundWorkflow,
  isVideoWorkflow,
} from "../logic/workflowIdentity";

type AiStudioToolbarProps = {
  selectedTool: ToolId | null;
  showCreateTools: boolean;
  onOpenProjects?: () => void;
  onSelectTool: (tool: ToolId | null) => void;
  onToggleCreateTools: (show: boolean) => void;
};

type IconComponent = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

const SoundEffectsWaveformIcon = React.forwardRef<SVGSVGElement, IconProps>(
  function SoundEffectsWaveformIcon(
    { color = "currentColor", size = "1em", mirrored = false, weight, ...restProps },
    ref
  ) {
    void weight;
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 256 256"
        width={size}
        height={size}
        fill="none"
        style={{ transform: mirrored ? "scale(-1, 1)" : undefined }}
        {...restProps}
      >
        <rect x="44" y="92" width="20" height="72" rx="10" fill={color} />
        <rect x="82" y="52" width="20" height="152" rx="10" fill={color} />
        <rect x="120" y="36" width="20" height="184" rx="10" fill={color} />
        <rect x="158" y="64" width="20" height="128" rx="10" fill={color} />
        <rect x="196" y="84" width="20" height="88" rx="10" fill={color} />
      </svg>
    );
  }
);

const toolIcons: Record<ToolId, IconComponent> = {
  create: Sparkle,
  "media-library": ImageSquare,
  elements: At,
  workflows: FlowArrow,
  presets: Sliders,
  styles: Palette,
  templates: SquaresFour,
  "my-generations": StackSimple,
  community: Globe,
  text: TextT,
  image: ImageSquare,
  video: VideoCamera,
  sound: SpeakerHigh,
  voices: Microphone,
  "text-to-speech": TextT,
  "voice-changer": Sliders,
  "sound-effects": SoundEffectsWaveformIcon,
  music: MusicNotes,
  character: Person,
  kling: VideoCamera,
  edit: Selection,
};

/**
 * Renders the AI Studio toolbar with primary and nested create options.
 */
function AiStudioToolbarComponent({
  selectedTool,
  onOpenProjects,
  onSelectTool,
  onToggleCreateTools,
}: AiStudioToolbarProps) {
  const isCreateSelected = isCreateWorkflow(selectedTool);
  const isEditSelected = isEditWorkflow(selectedTool);
  const isVideoSelected = isVideoWorkflow(selectedTool);
  const isSoundSelected = isSoundWorkflow(selectedTool);
  const isCharacterSelected = isCharacterWorkflow(selectedTool);
  const isLibrarySelected = librariesToolList.some((tool) => tool.id === selectedTool);
  const activePrimary: "create" | "video" | "sound" | "edit" | "library" | null = isCreateSelected
    ? "create"
    : isVideoSelected
      ? "video"
      : isSoundSelected
        ? "sound"
        : isEditSelected
          ? "edit"
          : isLibrarySelected
            ? "library"
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
      <DashboardNavPrefab className="toolbar-back-link" navigationMode="assign" />
      <button
        type="button"
        className="ghost-btn small dashboard-nav-prefab dashboard-nav-prefab--rail toolbar-back-link toolbar-back-link-secondary"
        aria-label="Projects"
        onClick={onOpenProjects}
      >
        <Folders size={16} weight="regular" />
        Projects
      </button>
      <div className="toolbar-list">
        <div className="toolbar-divider" aria-hidden="true" />
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
        {workflowToolList.map((tool) => {
          const IconComponent = toolIcons[tool.id];
          const isActive =
            tool.id === "video"
              ? isVideoSelected
              : tool.id === "sound"
                ? isSoundSelected
                : tool.id === "edit"
                  ? isEditSelected
                  : selectedTool === tool.id;
          return (
            <React.Fragment key={tool.id}>
              <button
                type="button"
                className={`toolbar-item ${isActive ? "is-active" : ""}`}
                data-tool-id={tool.id}
                onClick={() => {
                  if (tool.id === "sound") {
                    onToggleCreateTools(false);
                    if (isSoundSelected) {
                      onSelectTool(null);
                      return;
                    }
                    onSelectTool("voices");
                    return;
                  }
                  const isToggleablePrimary = tool.id === "video" || tool.id === "edit";
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
              {tool.id === "sound" ? (
                <div className={`toolbar-create-children ${isSoundSelected ? "is-open" : ""}`}>
                  <div className="toolbar-create-spacer" aria-hidden="true" />
                  {soundChildTools.map((childTool) => {
                    const ChildIconComponent = toolIcons[childTool.id];
                    const isChildActive = selectedTool === childTool.id;
                    return (
                      <button
                        key={childTool.id}
                        type="button"
                        className={`toolbar-item toolbar-item-child ${
                          isChildActive ? "is-active" : ""
                        }`}
                        data-tool-id={childTool.id}
                        onClick={() => {
                          onToggleCreateTools(false);
                          onSelectTool(childTool.id);
                        }}
                      >
                        {ChildIconComponent ? (
                          <ChildIconComponent size={18} weight="regular" />
                        ) : null}
                        <div className="toolbar-copy">
                          <span className="toolbar-label">{childTool.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : null}
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
            const isElementsTool = tool.id === "elements";
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
                  if (isElementsTool && isActive) {
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
      <div className="toolbar-footer toolbar-footer--account">
        <AiStudioToolbarAccountMenu />
      </div>
    </aside>
  );
}

export const AiStudioToolbar = React.memo(AiStudioToolbarComponent);
