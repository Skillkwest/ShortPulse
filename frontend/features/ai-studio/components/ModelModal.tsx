/**
 * Anchored model picker modal.
 * Positions next to the invoking control and lists available generation models.
 */
import React from "react";
import { modelOptions, ModelOption } from "../constants";

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
        <div className="model-modal-grid">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="model-chip"
              onClick={() => onSelect(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
