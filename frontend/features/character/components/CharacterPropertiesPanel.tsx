/**
 * Properties panel for the Character tool.
 * Covers identity ingest, pose/style controls, and generation CTA.
 */
import React from "react";
import { CloudArrowUp, RocketLaunch, Sparkle, Trash } from "phosphor-react";
import { characterAspectOptions, characterModelOptions, starterPoses } from "../constants";
import type { CharacterEngine, CharacterIdentity, CharacterReference } from "../types";

type CharacterPropertiesPanelProps = {
  identity: CharacterIdentity;
  aspect: string;
  modelId: string;
  engine: CharacterEngine;
  prompt: string;
  poseId: string | null;
  isBuildingIdentity: boolean;
  isGenerating: boolean;
  identityToken?: string | null;
  quality?: { acceptedRefs: number; rejectedRefs: number; variance?: number };
  hasWebGpu?: boolean;
  modelsAvailable?: boolean;
  capabilityMessage?: string;
  canBuildIdentity?: boolean;
  onPromptChange: (value: string) => void;
  onAspectChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onEngineChange: (value: CharacterEngine) => void;
  onPoseChange: (poseId: string) => void;
  onUploadClick: () => void;
  onDropFiles: (files: FileList) => void;
  onRemoveReference: (id: string) => void;
  onBuildIdentity: () => void;
  onGenerate: () => void;
};

const renderReferences = (references: CharacterReference[], onRemove: (id: string) => void) => {
  if (!references.length) {
    return <p className="subdued tiny helper-text">Drop images here or click Upload to start.</p>;
  }
  return (
    <div className="reference-chip-row">
      {references.map((ref) => (
        <div className="reference-chip" key={ref.id}>
          <span className="reference-dot" aria-hidden />
          <span className="reference-name">{ref.name || "Reference"}</span>
          <button type="button" className="icon-btn" aria-label="Remove reference" onClick={() => onRemove(ref.id)}>
            <Trash size={14} weight="bold" />
          </button>
        </div>
      ))}
    </div>
  );
};

export function CharacterPropertiesPanel({
  identity,
  aspect,
  modelId,
  engine,
  prompt,
  poseId,
  isBuildingIdentity,
  isGenerating,
  identityToken = null,
  quality,
  hasWebGpu = true,
  modelsAvailable = true,
  capabilityMessage,
  canBuildIdentity = true,
  onPromptChange,
  onAspectChange,
  onModelChange,
  onEngineChange,
  onPoseChange,
  onUploadClick,
  onDropFiles,
  onRemoveReference,
  onBuildIdentity,
  onGenerate,
}: CharacterPropertiesPanelProps) {
  const poseButtons = starterPoses.map((pose) => (
    <button
      key={pose.id}
      type="button"
      className={`ghost-btn mini ${poseId === pose.id ? "is-active" : ""}`}
      onClick={() => onPoseChange(pose.id)}
      aria-pressed={poseId === pose.id}
    >
      {pose.label}
    </button>
  ));

  return (
    <div className="tool-properties">
      <div className="tool-header">
        <p className="eyebrow">Character</p>
        <p className="subdued tiny helper-text">Create a persistent identity and generate consistent shots.</p>
      </div>

      <div className="step-card">
        <div className="step-card-header">
          <span className="step-badge">1</span>
          <div className="step-header-copy">
            <p className="step-title">Upload identity references</p>
            <span className="step-subtitle tiny helper-text">Use 5–20 varied angles. Safety is minimised.</span>
          </div>
          {identityToken ? (
            <div className="token-pill" title="Identity token applied to all generations">
              <span className="token-label">Token</span>
              <span className="token-value">{identityToken.slice(0, 8)}</span>
            </div>
          ) : null}
          <div className="step-header-actions">
            <button type="button" className="ghost-btn mini" onClick={onUploadClick}>
              <CloudArrowUp size={14} weight="regular" /> Upload
            </button>
          </div>
        </div>
        <div
          className="reference-dropzone"
          onClick={onUploadClick}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (event.dataTransfer?.files?.length) {
              onDropFiles(event.dataTransfer.files);
            }
          }}
        >
          <p className="subdued tiny helper-text">Drop reference photos here or click Upload.</p>
          <p className="tiny helper-text">Use varied lighting and angles; we minimise safety filtering.</p>
        </div>
        {renderReferences(identity.references, onRemoveReference)}
        <div className="build-identity-row">
          <div className="identity-status">
            <span className={`identity-dot status-${identity.embeddingStatus}`} aria-hidden />
            <span className="tiny">
              {identity.embeddingStatus === "ready"
                ? "Identity ready"
                : identity.embeddingStatus === "building"
                  ? "Building identity…"
                  : "Identity not built"}
            </span>
            {quality ? (
              <span className="tiny subdued quality-chip">
                {quality.acceptedRefs} refs · var {quality.variance ?? 0}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={onBuildIdentity}
            disabled={!canBuildIdentity || isBuildingIdentity || !hasWebGpu || !modelsAvailable}
            title={
              !hasWebGpu
                ? "WebGPU not available in this browser."
                : !modelsAvailable
                  ? "Model weights missing in /public/models/character."
                  : undefined
            }
          >
            {isBuildingIdentity ? "Building…" : "Build identity"}
          </button>
        </div>
        {!hasWebGpu || !modelsAvailable ? (
          <div className="inline-warning tiny">
            {capabilityMessage ||
              (!hasWebGpu
                ? "WebGPU not available. Try a compatible desktop browser."
                : "Model weights missing in /public/models/character.")}
          </div>
        ) : null}
      </div>

      <div className="step-card">
        <div className="step-card-header">
          <span className="step-badge">2</span>
          <div className="step-header-copy">
            <p className="step-title">Frame & model</p>
            <span className="step-subtitle tiny helper-text">Choose aspect, model, and engine.</span>
          </div>
        </div>
        <div className="create-controls dual-controls">
          <div className="control-row compact">
            <label className="input-label">Aspect</label>
            <select className="model-select" value={aspect} onChange={(event) => onAspectChange(event.target.value)}>
              {characterAspectOptions.map((option) => (
                <option value={option} key={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="control-row compact">
            <label className="input-label">Model</label>
            <select className="model-select" value={modelId} onChange={(event) => onModelChange(event.target.value)}>
              {characterModelOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="control-row compact">
            <label className="input-label">Engine</label>
            <select
              className="model-select"
              value={engine}
              onChange={(event) => onEngineChange(event.target.value as CharacterEngine)}
            >
              <option value="fal-edge">Edge (Fal proxy)</option>
              <option value="local-webgpu">Local WebGPU</option>
            </select>
          </div>
        </div>
        <div className="tiny subdued safety-hint helper-text">
          Safety: disabled/minimum on all routes. Uses FLUX 2 Pro/Max with IP-Adapter.
        </div>
      </div>

      <div className="step-card prompt-step">
        <div className="step-card-header">
          <span className="step-badge">3</span>
          <div className="step-header-copy">
            <p className="step-title">Pose & style</p>
            <span className="step-subtitle tiny helper-text">Pick a pose (optional) and describe the look.</span>
          </div>
        </div>
        <div className="style-chip-row">
          <button
            type="button"
            className="style-chip ghost-btn mini"
            onClick={() => onPromptChange("cinematic portrait, rim light, teal/orange grade, shallow depth of field")}
          >
            Cinematic
          </button>
          <button
            type="button"
            className="style-chip ghost-btn mini"
            onClick={() =>
              onPromptChange("studio lit fashion catalog, softbox lighting, neutral backdrop, full body, sharp focus")
            }
          >
            Catalog
          </button>
          <button
            type="button"
            className="style-chip ghost-btn mini"
            onClick={() => onPromptChange("anime key visual, bold line art, saturated palette, dynamic hero pose")}
          >
            Anime
          </button>
          <button
            type="button"
            className="style-chip ghost-btn mini"
            onClick={() => onPromptChange("comic cover, halftone shading, dramatic perspective, action pose")}
          >
            Comic
          </button>
        </div>
        <div className="pose-row">{poseButtons}</div>
        <textarea
          className="prompt-input"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={7}
          placeholder="e.g., cinematic portrait, rim lighting, teal/orange, leather jacket"
        />
        <button
          type="button"
          className="primary-btn primary-btn-wide"
          onClick={onGenerate}
          disabled={isGenerating || isBuildingIdentity}
        >
          {isGenerating ? (
            <>
              <Sparkle size={18} weight="fill" /> <span>Generating…</span>
            </>
          ) : (
            <>
              <RocketLaunch size={18} weight="fill" /> <span>Generate</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
