import React from "react";
import type { ElementAssetType } from "../types";

type ElementTypeSelectorProps = {
  assetType: ElementAssetType;
  onChange: (nextType: ElementAssetType) => void;
};

export function ElementTypeSelector({ assetType, onChange }: ElementTypeSelectorProps) {
  return (
    <div className="elements-type-selector-block">
      <h3 className="elements-profile-section-title">Type</h3>
      <div className="elements-type-toggle" role="group" aria-label="Element type">
        <button
          type="button"
          className={`elements-type-chip ${assetType === "image" ? "is-active" : ""}`}
          aria-pressed={assetType === "image"}
          onClick={() => onChange("image")}
        >
          Image Element
        </button>
        <button
          type="button"
          className={`elements-type-chip ${assetType === "video" ? "is-active" : ""}`}
          aria-pressed={assetType === "video"}
          onClick={() => onChange("video")}
        >
          Video Element
        </button>
      </div>
      <p className="tiny subdued helper-text">
        Choose how this element will be represented later in Kling workflows.
      </p>
    </div>
  );
}
