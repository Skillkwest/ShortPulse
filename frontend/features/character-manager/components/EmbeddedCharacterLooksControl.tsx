import React from "react";
import { Plus } from "phosphor-react";
import { MAX_CHARACTER_SHEET_PRESET_TAB_COUNT } from "../logic/characterSheetPresetTabs";
import type { CharacterSheetPresetId } from "../types";
import { getCharacterSheetPresetTabId } from "./CharacterSheetPresetTabs";

type EmbeddedCharacterLooksControlProps = {
  presetIds: readonly CharacterSheetPresetId[];
  activePresetId: CharacterSheetPresetId;
  presetLabels: Record<CharacterSheetPresetId, string>;
  panelId: string;
  idBase?: string;
  disabled?: boolean;
  onSelectPreset: (presetId: CharacterSheetPresetId) => void | Promise<void>;
  onAddPreset?: () => void | Promise<void>;
  onRenamePreset?: (presetId: CharacterSheetPresetId, nextLabel: string) => void | Promise<void>;
  onDeletePreset?: (presetId: CharacterSheetPresetId) => void | Promise<void>;
};

const ROOT_STYLE: React.CSSProperties = {
  position: "relative",
  display: "grid",
  gap: "8px",
  width: "100%",
};

const CONTROL_ROW_STYLE: React.CSSProperties = {
  display: "block",
  minWidth: 0,
};

const TAB_RAIL_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "8px",
  alignItems: "end",
  minHeight: "36px",
  width: "100%",
  maxWidth: "100%",
  padding: "3px 6px 0",
  borderRadius: "12px 12px 0 0",
  border: "1px solid rgba(38, 43, 51, 0.95)",
  borderBottom: "none",
  background: "rgba(12, 14, 19, 0.96)",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
  boxSizing: "border-box",
  overflow: "hidden",
};

const buildTabStyle = (isActive: boolean): React.CSSProperties => ({
  minHeight: "26px",
  height: "26px",
  width: "100%",
  borderRadius: "12px 12px 0 0",
  border: "none",
  background: isActive ? "rgba(201, 205, 214, 0.05)" : "rgba(12, 14, 19, 0.96)",
  color: isActive ? "#ecfbff" : "rgba(182, 195, 208, 0.92)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 10px",
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: 1,
  letterSpacing: "0.01em",
  textShadow: "0 1px 0 rgba(0, 0, 0, 0.28)",
  boxShadow: isActive ? "inset 0 0 0 1px rgba(72, 212, 255, 0.18)" : "none",
  transform: "none",
  marginBottom: 0,
  boxSizing: "border-box",
  transition:
    "box-shadow 0.18s ease, border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease",
});

const ACTION_BUTTON_STYLE: React.CSSProperties = {
  width: "26px",
  minWidth: "26px",
  height: "26px",
  borderRadius: 0,
  border: "none",
  background: "transparent",
  color: "rgba(223, 227, 234, 0.9)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  flexShrink: 0,
};

export function EmbeddedCharacterLooksControl({
  presetIds,
  activePresetId,
  presetLabels,
  panelId,
  idBase = "embedded-character-looks",
  disabled = false,
  onSelectPreset,
  onAddPreset,
}: EmbeddedCharacterLooksControlProps) {
  const canAddPreset =
    Boolean(onAddPreset) && presetIds.length < MAX_CHARACTER_SHEET_PRESET_TAB_COUNT;

  const handleArrowNavigation = React.useCallback(
    (direction: 1 | -1) => {
      if (!presetIds.length) return;
      const currentIndex = presetIds.indexOf(activePresetId);
      if (currentIndex === -1) return;
      const nextIndex = (currentIndex + direction + presetIds.length) % presetIds.length;
      const nextPresetId = presetIds[nextIndex];
      if (!nextPresetId) return;
      void onSelectPreset(nextPresetId);
    },
    [activePresetId, onSelectPreset, presetIds]
  );

  return (
    <div style={ROOT_STYLE}>
      <div style={CONTROL_ROW_STYLE}>
        <div
          role="tablist"
          aria-label="Character looks"
          aria-orientation="horizontal"
          style={{
            ...TAB_RAIL_STYLE,
            gridTemplateColumns: canAddPreset
              ? `repeat(${Math.max(presetIds.length, 1)}, minmax(56px, 68px)) auto`
              : `repeat(${Math.max(presetIds.length, 1)}, minmax(56px, 68px))`,
          }}
        >
          {presetIds.map((presetId) => {
            const label = presetLabels[presetId] ?? presetId;
            const isActive = activePresetId === presetId;
            return (
              <button
                key={presetId}
                type="button"
                role="tab"
                id={getCharacterSheetPresetTabId(idBase, presetId)}
                aria-selected={isActive}
                aria-controls={panelId}
                tabIndex={isActive ? 0 : -1}
                style={buildTabStyle(isActive)}
                onClick={() => {
                  void onSelectPreset(presetId);
                }}
                onKeyDown={(event) => {
                  if (disabled || !presetIds.length) return;
                  if (event.key === "ArrowRight") {
                    event.preventDefault();
                    handleArrowNavigation(1);
                    return;
                  }
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    handleArrowNavigation(-1);
                    return;
                  }
                  if (event.key === "Home") {
                    event.preventDefault();
                    void onSelectPreset(presetIds[0] ?? activePresetId);
                    return;
                  }
                  if (event.key === "End") {
                    event.preventDefault();
                    void onSelectPreset(presetIds[presetIds.length - 1] ?? activePresetId);
                  }
                }}
                disabled={disabled}
                title={label}
              >
                {label}
              </button>
            );
          })}
          {canAddPreset ? (
            <button
              type="button"
              aria-label="Add character look"
              style={ACTION_BUTTON_STYLE}
              onClick={() => {
                void onAddPreset?.();
              }}
              disabled={disabled}
            >
              <Plus size={14} weight="bold" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
