import React from "react";
import type { CreateMode } from "./createModeTypes";

type CreateModeToggleProps = {
  value: CreateMode;
  onChange?: (value: CreateMode) => void;
};

export function CreateModeToggle({ value, onChange }: CreateModeToggleProps) {
  const standardTabRef = React.useRef<HTMLButtonElement | null>(null);
  const pulseTabRef = React.useRef<HTMLButtonElement | null>(null);
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
  const focusModeTab = React.useCallback((nextMode: CreateMode) => {
    if (nextMode === "pulse") {
      pulseTabRef.current?.focus();
      return;
    }
    standardTabRef.current?.focus();
  }, []);
  const handleModeKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, currentMode: CreateMode) => {
      let nextMode: CreateMode | null = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        nextMode = currentMode === "standard" ? "pulse" : "standard";
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextMode = currentMode === "pulse" ? "standard" : "pulse";
      } else if (event.key === "Home") {
        nextMode = "standard";
      } else if (event.key === "End") {
        nextMode = "pulse";
      }
      if (!nextMode) return;
      event.preventDefault();
      onChange?.(nextMode);
      focusModeTab(nextMode);
    },
    [focusModeTab, onChange]
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
          ref={standardTabRef}
          type="button"
          role="tab"
          aria-selected={value === "standard"}
          tabIndex={value === "standard" ? 0 : -1}
          className={`create-composer-mode-tab ${value === "standard" ? "is-active" : ""}`}
          onClick={(event) => handleModeSelect(event, "standard")}
          onKeyDown={(event) => handleModeKeyDown(event, "standard")}
        >
          Standard
        </button>
        <button
          ref={pulseTabRef}
          type="button"
          role="tab"
          aria-selected={value === "pulse"}
          tabIndex={value === "pulse" ? 0 : -1}
          className={`create-composer-mode-tab ${value === "pulse" ? "is-active" : ""}`}
          onClick={(event) => handleModeSelect(event, "pulse")}
          onKeyDown={(event) => handleModeKeyDown(event, "pulse")}
        >
          Pulse
        </button>
      </div>
    </div>
  );
}
