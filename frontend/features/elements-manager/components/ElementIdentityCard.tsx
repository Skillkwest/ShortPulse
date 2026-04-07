import React from "react";
import type { ElementDraft } from "../types";

type ElementIdentityCardProps = {
  draft: ElementDraft;
  onFieldChange: <K extends keyof ElementDraft>(field: K, value: ElementDraft[K]) => void;
};

export function ElementIdentityCard({ draft, onFieldChange }: ElementIdentityCardProps) {
  return (
    <section className="elements-profile-section">
      <label className="elements-field">
        <span className="elements-field-label">Name:</span>
        <input
          className="elements-input"
          value={draft.name}
          onChange={(event) => onFieldChange("name", event.target.value)}
          placeholder="Enter element name"
        />
      </label>
    </section>
  );
}
