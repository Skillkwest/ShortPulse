/**
 * Kling advanced configuration step cards for reference-based generation flows.
 */
import React from "react";
import type { AiStudioKlingElement } from "../logic/klingElements";
import { resolveAiStudioKlingElementToken } from "../logic/klingElements";
import { ReferenceStepHeaderActionButton } from "./ReferenceStepHeaderActionButton";

type KlingShot = { id: string; prompt: string; duration: number };

type KlingElement = AiStudioKlingElement;

type ReferenceKlingAdvancedStepsProps = {
  isKling3Mode: boolean;
  isKieKlingModel: boolean;
  workflowLabel?: string;
  assetReferenceNoun?: string;
  supportsVoiceControls?: boolean;
  supportsNegativePrompt?: boolean;
  supportsCfgScale?: boolean;
  assetsHelperText?: string;
  guidanceHelperText?: string;
  beginnerMode: boolean;
  klingAdvancedOrder?: number;
  klingAdvancedBadge: string;
  klingAssetsOrder?: number;
  klingAssetsBadge: string;
  klingGuidanceOrder?: number;
  klingGuidanceBadge: string;
  collapsedKlingAdvanced: boolean;
  collapsedKlingAssets: boolean;
  collapsedKlingGuidance: boolean;
  klingShotSummary: string;
  klingAssetsSummary: string;
  klingGuidanceSummary: string;
  klingShotType: "customize" | "intelligent";
  klingMultiPrompts: KlingShot[];
  klingElements: KlingElement[];
  klingVoiceIds: [string, string];
  klingCfgScale: number;
  klingNegativePrompt: string;
  onExpandKlingAdvanced: () => void;
  onExpandKlingAssets: () => void;
  onExpandKlingGuidance: () => void;
  onToggleKlingAdvanced: () => void;
  onToggleKlingAssets: () => void;
  onToggleKlingGuidance: () => void;
  onKlingShotTypeChange?: (value: "customize" | "intelligent") => void;
  onKlingVoiceIdChange?: (index: 0 | 1, value: string) => void;
  onKlingCfgScaleChange?: (value: number) => void;
  onKlingNegativePromptChange?: (value: string) => void;
  onInsertKlingElementToken?: (token: string) => void;
  onOpenKlingElementPicker?: (slotIndex: number) => void;
  addKlingShot: () => void;
  removeKlingShot: (id: string) => void;
  updateKlingMultiPrompt: (id: string, key: "prompt" | "duration", value: string | number) => void;
  addKlingElement: () => void;
  removeKlingElement: (id: string) => void;
  updateKlingElement: (
    id: string,
    key: "frontalImageUrl" | "referenceImageUrls" | "videoUrl",
    value: string
  ) => void;
};

const VIDEO_DURATION_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

/**
 * Renders Kling 3.0 advanced cards (shots, assets/voices, and guidance).
 */
export const ReferenceKlingAdvancedSteps: React.FC<ReferenceKlingAdvancedStepsProps> = ({
  isKling3Mode,
  isKieKlingModel,
  workflowLabel = "Kling 3.0",
  assetReferenceNoun = "element",
  supportsVoiceControls = !isKieKlingModel,
  supportsNegativePrompt = !isKieKlingModel,
  supportsCfgScale = true,
  assetsHelperText,
  guidanceHelperText,
  beginnerMode,
  klingAdvancedOrder,
  klingAdvancedBadge,
  klingAssetsOrder,
  klingAssetsBadge,
  klingGuidanceOrder,
  klingGuidanceBadge,
  collapsedKlingAdvanced,
  collapsedKlingAssets,
  collapsedKlingGuidance,
  klingShotSummary,
  klingAssetsSummary,
  klingGuidanceSummary,
  klingShotType,
  klingMultiPrompts,
  klingElements,
  klingVoiceIds,
  klingCfgScale,
  klingNegativePrompt,
  onExpandKlingAdvanced,
  onExpandKlingAssets,
  onExpandKlingGuidance,
  onToggleKlingAdvanced,
  onToggleKlingAssets,
  onToggleKlingGuidance,
  onKlingShotTypeChange,
  onKlingVoiceIdChange,
  onKlingCfgScaleChange,
  onKlingNegativePromptChange,
  onInsertKlingElementToken,
  onOpenKlingElementPicker,
  addKlingShot,
  removeKlingShot,
  updateKlingMultiPrompt,
  addKlingElement,
  removeKlingElement,
}) => {
  if (!isKling3Mode) return null;
  const klingAssetsCardOrder = klingAssetsOrder ?? (klingAdvancedOrder ?? 5) + 1;
  const klingGuidanceCardOrder = klingGuidanceOrder ?? klingAssetsCardOrder + 1;
  const firstEmptySlotIndex = [0, 1, 2].find(
    (slotIndex) =>
      !klingElements.some((element, index) => (element.slotIndex ?? index) === slotIndex)
  );

  return (
    <>
      <div
        className={`step-card kling-advanced-card ${collapsedKlingAdvanced ? "is-collapsed" : ""}`}
        onClick={onExpandKlingAdvanced}
        style={{ order: klingAdvancedOrder }}
      >
        <div className="step-card-header">
          {beginnerMode && <span className="step-badge">{klingAdvancedBadge}</span>}
          <div className="step-header-copy">
            <p className="step-title">Shots & Timing</p>
            <span className="step-subtitle tiny helper-text">{klingShotSummary}</span>
          </div>
          {!beginnerMode ? (
            <div className="step-header-actions">
              <ReferenceStepHeaderActionButton
                label={`Toggle ${workflowLabel} shots`}
                isCollapsed={collapsedKlingAdvanced}
                onClick={onToggleKlingAdvanced}
              />
            </div>
          ) : null}
        </div>
        {!collapsedKlingAdvanced ? (
          <div className="create-controls kling-advanced-grid">
            <div className="kling-pill-row">
              <span className="kling-pill">Launch limit: 3 concurrent</span>
              <span className="kling-pill">
                Cost: $0.224s (no audio) · $0.336s (audio) · $0.392s (voice)
              </span>
            </div>
            <div className="control-row compact">
              <label className="input-label">Shot type</label>
              <select
                className="model-select"
                value={klingShotType}
                onChange={(event) =>
                  onKlingShotTypeChange?.(event.target.value as "customize" | "intelligent")
                }
              >
                <option value="customize">Customize (per-shot prompts)</option>
                <option value="intelligent">Intelligent (auto pacing)</option>
              </select>
              <span className="tiny helper-text">
                Use multi-shot for micro-beats; intelligent for automatic pacing.
              </span>
            </div>
            <div className="control-row compact full-span">
              <label className="input-label">Multi-shot prompts</label>
              <div className="kling-multi-shot-list">
                {klingMultiPrompts.length === 0 ? (
                  <p className="tiny helper-text">
                    Add shots to split the video into multiple beats.
                  </p>
                ) : null}
                {klingMultiPrompts.map((shot, index) => (
                  <div className="kling-shot-row" key={shot.id}>
                    <div className="shot-meta">
                      <span className="shot-index">Shot {index + 1}</span>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => removeKlingShot(shot.id)}
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      className="model-select kling-textarea"
                      value={shot.prompt}
                      rows={2}
                      onChange={(event) =>
                        updateKlingMultiPrompt(shot.id, "prompt", event.target.value)
                      }
                      placeholder="Describe this shot..."
                    />
                    <div className="kling-shot-controls">
                      <label className="tiny helper-text">Duration</label>
                      <select
                        className="model-select"
                        value={shot.duration}
                        onChange={(event) =>
                          updateKlingMultiPrompt(shot.id, "duration", Number(event.target.value))
                        }
                      >
                        {VIDEO_DURATION_OPTIONS.map((seconds) => (
                          <option value={seconds} key={`shot-duration-${seconds}`}>
                            {seconds}s
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                <button type="button" className="ghost-btn small" onClick={addKlingShot}>
                  + Add shot
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div
        className={`step-card kling-advanced-card ${collapsedKlingAssets ? "is-collapsed" : ""}`}
        onClick={onExpandKlingAssets}
        style={{ order: klingAssetsCardOrder }}
      >
        <div className="step-card-header">
          {beginnerMode && <span className="step-badge">{klingAssetsBadge}</span>}
          <div className="step-header-copy">
            <p className="step-title">{isKieKlingModel ? "Assets" : "Assets & Voices"}</p>
            <span className="step-subtitle tiny helper-text">{klingAssetsSummary}</span>
          </div>
          {!beginnerMode ? (
            <div className="step-header-actions">
              <ReferenceStepHeaderActionButton
                label={`Toggle ${workflowLabel} assets`}
                isCollapsed={collapsedKlingAssets}
                onClick={onToggleKlingAssets}
              />
            </div>
          ) : null}
        </div>
        {!collapsedKlingAssets ? (
          <div className="create-controls kling-advanced-grid">
            <div className="control-row compact full-span">
              <label className="input-label">Elements (characters/objects)</label>
              <div className="kling-elements-list">
                {klingElements.length === 0 ? (
                  <p className="tiny helper-text">
                    Attach saved Characters or Elements from the {workflowLabel} settings slots
                    above.
                  </p>
                ) : null}
                {klingElements.map((element, index) => {
                  const token = resolveAiStudioKlingElementToken(element, index, klingElements);
                  const referenceCount = [
                    element.frontalImageUrl.trim(),
                    ...element.referenceImageUrls
                      .split(/[,\n]+/)
                      .map((value) => value.trim())
                      .filter(Boolean),
                  ].filter(Boolean).length;
                  return (
                    <div className="kling-element-row kling-element-row--attached" key={element.id}>
                      <div className="kling-element-grid kling-element-grid--summary">
                        <div className="kling-element-summary-copy">
                          <span className="kling-element-summary-name">
                            {element.name?.trim() || `Attached element ${index + 1}`}
                          </span>
                          <span className="tiny helper-text">@{token}</span>
                          {element.description?.trim() ? (
                            <span className="tiny helper-text">{element.description.trim()}</span>
                          ) : null}
                          <span className="tiny helper-text">
                            {element.videoUrl.trim()
                              ? "Video element reference attached"
                              : `${referenceCount} sheet reference${referenceCount === 1 ? "" : "s"} attached`}
                          </span>
                        </div>
                      </div>
                      <div className="kling-element-actions kling-element-actions--summary">
                        <button
                          type="button"
                          className="ghost-btn mini"
                          onClick={() => onInsertKlingElementToken?.(token)}
                          disabled={!token.trim()}
                        >
                          Insert @{token}
                        </button>
                        {onOpenKlingElementPicker ? (
                          <button
                            type="button"
                            className="ghost-btn mini"
                            onClick={() => onOpenKlingElementPicker(element.slotIndex ?? index)}
                          >
                            Replace
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="ghost-btn mini"
                          onClick={() => removeKlingElement(element.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
                {onOpenKlingElementPicker ? (
                  <button
                    type="button"
                    className="ghost-btn small"
                    onClick={() => {
                      if (firstEmptySlotIndex == null) return;
                      onOpenKlingElementPicker(firstEmptySlotIndex);
                    }}
                    disabled={firstEmptySlotIndex == null}
                  >
                    + Add saved entity
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ghost-btn small"
                    onClick={addKlingElement}
                    disabled={klingElements.length >= 3}
                  >
                    + Add element
                  </button>
                )}
              </div>
            </div>
            {supportsVoiceControls ? (
              <div className="control-row compact full-span kling-voice-row">
                <label className="input-label">Voice IDs (optional)</label>
                <div className="kling-voice-inputs">
                  {[0, 1].map((idx) => (
                    <input
                      key={`voice-${idx}`}
                      className="model-select"
                      placeholder={`voice_${idx + 1} ID (from create-voice)`}
                      value={klingVoiceIds[idx]}
                      onChange={(event) => onKlingVoiceIdChange?.(idx as 0 | 1, event.target.value)}
                    />
                  ))}
                </div>
                <span className="tiny helper-text">
                  Reference in prompt as &lt;&lt;&lt;voice_{1}&gt;&gt;&gt; and &lt;&lt;&lt;voice_{2}
                  &gt;&gt;&gt; (max 2).
                </span>
              </div>
            ) : (
              <div className="control-row compact full-span">
                <span className="tiny helper-text">
                  {assetsHelperText ??
                    `Use each saved ${assetReferenceNoun} alias as its prompt token, for example \`@redlantern\`.`}
                </span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div
        className={`step-card kling-advanced-card ${collapsedKlingGuidance ? "is-collapsed" : ""}`}
        onClick={onExpandKlingGuidance}
        style={{ order: klingGuidanceCardOrder }}
      >
        <div className="step-card-header">
          {beginnerMode && <span className="step-badge">{klingGuidanceBadge}</span>}
          <div className="step-header-copy">
            <p className="step-title">Guidance & Safety</p>
            <span className="step-subtitle tiny helper-text">{klingGuidanceSummary}</span>
          </div>
          {!beginnerMode ? (
            <div className="step-header-actions">
              <ReferenceStepHeaderActionButton
                label={`Toggle ${workflowLabel} guidance`}
                isCollapsed={collapsedKlingGuidance}
                onClick={onToggleKlingGuidance}
              />
            </div>
          ) : null}
        </div>
        {!collapsedKlingGuidance ? (
          <div className="create-controls kling-advanced-grid">
            {supportsCfgScale ? (
              <div className="control-row compact">
                <label className="input-label">CFG scale</label>
                <div className="kling-slider-row">
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={klingCfgScale}
                    onChange={(event) => onKlingCfgScaleChange?.(Number(event.target.value))}
                  />
                  <span className="slider-value">{klingCfgScale.toFixed(2)}</span>
                </div>
                <span className="tiny helper-text">
                  Lower = freer motion/visuals, higher = tighter adherence.
                </span>
              </div>
            ) : null}
            {supportsNegativePrompt ? (
              <div className="control-row compact full-span">
                <label className="input-label">Negative prompt</label>
                <textarea
                  className="model-select kling-textarea"
                  value={klingNegativePrompt}
                  rows={2}
                  onChange={(event) => onKlingNegativePromptChange?.(event.target.value)}
                  placeholder="blur, distort, and low quality"
                />
              </div>
            ) : (
              <div className="control-row compact full-span">
                <span className="tiny helper-text">
                  {guidanceHelperText ??
                    "KIE Kling guidance here is CFG-based. Quality mode, sound, and multi-shot setup live in the main video panel."}
                </span>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
};
