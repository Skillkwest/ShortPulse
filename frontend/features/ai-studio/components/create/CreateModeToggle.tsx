import React from "react";
import type { CreateMode } from "./createModeTypes";

type CreateModeToggleProps = {
  value: CreateMode;
  onChange?: (value: CreateMode) => void;
};

export function CreateModeToggle({ value, onChange }: CreateModeToggleProps) {
  const createModeTabsStyle = React.useMemo(
    () =>
      ({
        ["--create-composer-mode-index" as string]: value === "pulse" ? 1 : 0,
      }) as React.CSSProperties,
    [value]
  );
  const handleModeSelect = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, nextMode: CreateMode) => {
      event.preventDefault();
      onChange?.(nextMode);
    },
    [onChange]
  );

  return (
    <div className="create-composer-mode-shell">
      <div
        className="create-composer-mode-tabs"
        role="tablist"
        aria-label="Create mode"
        style={createModeTabsStyle}
      >
        <span className="create-composer-mode-indicator" aria-hidden="true" />
        <button
          type="button"
          role="tab"
          aria-selected={value === "standard"}
          className={`create-composer-mode-tab ${value === "standard" ? "is-active" : ""}`}
          onClick={(event) => handleModeSelect(event, "standard")}
        >
          Standard
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={value === "pulse"}
          className={`create-composer-mode-tab ${value === "pulse" ? "is-active" : ""}`}
          onClick={(event) => handleModeSelect(event, "pulse")}
        >
          Pulse
        </button>
      </div>
    </div>
  );
}
