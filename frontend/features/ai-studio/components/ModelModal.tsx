/**
 * Anchored model picker modal.
 * Positions next to the invoking control and lists available generation models with cost badges.
 */
import React from "react";
import { modelOptions, ModelOption } from "../constants";
import { buildDefaultPricingParams, computeCostForModel } from "../logic/pricing";

type ModelModalProps = {
  isOpen: boolean;
  position: { top: number; left: number } | null;
  onClose: () => void;
  onSelect: (value: string) => void;
  options?: ModelOption[];
};

/**
 * Renders the floating model selection modal.
 */
export function ModelModal({ isOpen, position, onClose, onSelect, options = modelOptions }: ModelModalProps) {
  if (!isOpen) return null;

  const fluxOrder = ["fal/flux-2", "fal/flux-2-pro", "fal/flux-2-max"];
  const fluxOptions = fluxOrder
    .map((value) => options.find((option) => option.value === value))
    .filter((item): item is ModelOption => Boolean(item));
  const googleOrder = ["fal/imagen4/preview/fast", "google/nano-banana", "nano-banana-pro"];
  const googleOptions = googleOrder
    .map((value) => options.find((option) => option.value === value))
    .filter((item): item is ModelOption => Boolean(item));
  const handledValues = new Set([...fluxOrder, ...googleOrder]);
  const otherOptions = options.filter((option) => !handledValues.has(option.value));

  const renderSection = (title: string, subtitle: string, items: ModelOption[]) => {
    if (!items.length) return null;
    return (
      <div className="model-modal-section">
        <div className="model-modal-subheader">
          <p className="model-modal-section-title">{title}</p>
          <p className="model-modal-section-subtitle">{subtitle}</p>
        </div>
        <div className="model-modal-grid">
          {items.map((option) => (
            <button
              key={option.value}
              type="button"
              className="model-chip"
              onClick={() => onSelect(option.value)}
            >
              <div className="model-chip-row">
                <span className="model-chip-title">{option.label}</span>
                <span className="model-chip-pill">
                  <span aria-hidden="true" className="model-chip-icon">✦</span>
                  <span className="model-chip-credits">{formatCredits(option.value)}</span>
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const formatCredits = (modelId: string) => {
    const cost = computeCostForModel(modelId, buildDefaultPricingParams(modelId));
    if (!cost?.credits) return "—";
    return `${cost.credits}`;
  };

  return (
    <div className="model-modal-backdrop" onClick={onClose}>
      <div
        className="model-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        style={position ? { top: `${position.top}px`, left: `${position.left}px` } : undefined}
      >
        <div className="model-modal-header">
          <p className="model-modal-title">Models</p>
          <button type="button" className="ghost-btn mini model-modal-close" onClick={onClose}>
            Close
          </button>
        </div>
        {renderSection("Flux", "Newest FLUX image models", fluxOptions)}
        {renderSection("Google", "Imagen + Nano Banana", googleOptions)}
        {renderSection("Other models", "Video + additional image backends", otherOptions)}
      </div>
    </div>
  );
}
