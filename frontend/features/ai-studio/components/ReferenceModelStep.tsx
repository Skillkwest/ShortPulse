/**
 * Frame/model step card for reference-based generation flows.
 */
import React from "react";
import Image from "next/image";
import { AspectDropdown } from "./AspectDropdown";
import { ReferenceStepHeaderActionButton } from "./ReferenceStepHeaderActionButton";
import { stripEditLabel } from "../utils/modelLabels";
import type { AspectOption } from "../types";
import type { ModelModalContext } from "./ModelModal";

type ReferenceModelStepProps = {
  variant: "image" | "video";
  isVideoVariant: boolean;
  isKeyframesMode: boolean;
  beginnerMode: boolean;
  collapsed: boolean;
  modelOrder: number;
  modelId: string | null;
  modelLabel: string;
  modelLogoSrc?: string;
  isModelModalOpen: boolean;
  modelModalAnchor: string | null;
  aspect: string;
  aspectOptionsForModel: AspectOption[];
  onExpand: () => void;
  onToggle: () => void;
  onAspectChange: (value: string) => void;
  onModelPickerOpen: (
    anchorId: string,
    target: HTMLElement,
    context?: ModelModalContext | null
  ) => void;
};

/**
 * Renders the model + aspect configuration step.
 */
export const ReferenceModelStep: React.FC<ReferenceModelStepProps> = ({
  variant,
  isKeyframesMode,
  beginnerMode,
  collapsed,
  modelOrder,
  modelId,
  modelLabel,
  modelLogoSrc,
  isModelModalOpen,
  modelModalAnchor,
  aspect,
  aspectOptionsForModel,
  onExpand,
  onToggle,
  onAspectChange,
  onModelPickerOpen,
}) => {
  return (
    <div
      className={`step-card reference-frame-card ${collapsed ? "is-collapsed" : ""}`}
      onClick={onExpand}
      style={{ order: modelOrder }}
    >
      <div className="step-card-header">
        {beginnerMode && <span className="step-badge">3</span>}
        <div className="step-header-copy">
          <p className="step-title">Choose Frame & Model</p>
          <span className="step-subtitle tiny helper-text">
            Pick the target aspect ratio and AI model before you generate.
          </span>
        </div>
        {!beginnerMode ? (
          <div className="step-header-actions">
            <ReferenceStepHeaderActionButton
              label="Open model options"
              isCollapsed={collapsed}
              onClick={onToggle}
            />
          </div>
        ) : null}
      </div>
      {!collapsed ? (
        <div className="create-controls reference-frame-controls frame-model-controls">
          <div className="control-row compact">
            <label className="input-label">Model</label>
            <button
              type="button"
              className={`model-picker-btn ${!modelId ? "is-empty" : ""} ${isModelModalOpen && modelModalAnchor === "reference-model" ? "is-open" : ""}`}
              data-model-anchor="reference-model"
              onClick={(event) =>
                onModelPickerOpen(
                  "reference-model",
                  event.currentTarget,
                  variant === "image"
                    ? "reference-image"
                    : isKeyframesMode
                      ? "reference-keyframes"
                      : "reference-video"
                )
              }
            >
              <div className="model-picker-row">
                <span className="model-picker-value">
                  {modelLogoSrc ? (
                    <Image
                      className="model-chip-logo-img"
                      src={modelLogoSrc}
                      alt=""
                      aria-hidden
                      width={80}
                      height={20}
                    />
                  ) : null}
                  <span className="model-picker-name">{stripEditLabel(modelLabel)}</span>
                </span>
              </div>
            </button>
          </div>
          <div className="control-row compact">
            <label className="input-label">Aspect ratio</label>
            <AspectDropdown
              aspect={aspect}
              onSelect={onAspectChange}
              options={aspectOptionsForModel}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
