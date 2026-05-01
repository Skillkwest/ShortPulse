import React from "react";
import type { ExpertCreateMode } from "./createModeTypes";

type CreateExpertModeToggleProps = {
  value: ExpertCreateMode;
  onChange?: (value: ExpertCreateMode) => void;
};

export function CreateExpertModeToggle({ value, onChange }: CreateExpertModeToggleProps) {
  const createModeTabsStyle = React.useMemo(
    () =>
      ({
        ["--create-expert-mode-index" as string]: value === "pulse" ? 1 : 0,
      }) as React.CSSProperties,
    [value]
  );
  const handleModeSelect = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, nextMode: ExpertCreateMode) => {
      event.preventDefault();
      onChange?.(nextMode);
    },
    [onChange]
  );

  return (
    <div className="create-expert-mode-shell">
      <div
        className="create-expert-mode-tabs"
        role="tablist"
        aria-label="Create mode"
        style={createModeTabsStyle}
      >
        <span className="create-expert-mode-indicator" aria-hidden="true" />
        <button
          type="button"
          role="tab"
          aria-selected={value === "standard"}
          className={`create-expert-mode-tab ${value === "standard" ? "is-active" : ""}`}
          onClick={(event) => handleModeSelect(event, "standard")}
        >
          Standard
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={value === "pulse"}
          className={`create-expert-mode-tab ${value === "pulse" ? "is-active" : ""}`}
          onClick={(event) => handleModeSelect(event, "pulse")}
        >
          Pulse
        </button>
      </div>
    </div>
  );
}
