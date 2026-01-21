import React from "react";

import { PromptTemplate } from "./types";

type OrganizePropertiesProps = {
  promptTemplates: PromptTemplate[];
  onUsePreset: (text: string) => void;
};

export function OrganizeProperties({ promptTemplates, onUsePreset }: OrganizePropertiesProps) {
  return (
    <div className="tool-properties">
      <p className="eyebrow">Organize</p>
      <div className="preset-list properties-list">
        {promptTemplates.map((template) => (
          <button key={template.id} type="button" className="preset-card" onClick={() => onUsePreset(template.text)}>
            <span className="preset-label">{template.label}</span>
            <span className="preset-text">{template.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
