/**
 * Character Sheet preset tabs component.
 * Renders an accessible preset-tab strip with roving focus and keyboard navigation.
 */
import React, { useCallback, useRef } from "react";
import type { CharacterSheetPresetId } from "../types";

type CharacterSheetPresetTabsProps = {
  presetIds: readonly CharacterSheetPresetId[];
  activePresetId: CharacterSheetPresetId;
  onSelectPreset: (presetId: CharacterSheetPresetId) => void | Promise<void>;
  panelId: string;
  disabled?: boolean;
  idBase?: string;
};

/**
 * Builds a stable tab id for a preset tab button.
 */
export const getCharacterSheetPresetTabId = (
  idBase: string,
  presetId: CharacterSheetPresetId
): string => `${idBase}-tab-${presetId}`;

/**
 * Renders the Character Sheet preset tabs with ARIA-compliant keyboard behavior.
 */
export function CharacterSheetPresetTabs({
  presetIds,
  activePresetId,
  onSelectPreset,
  panelId,
  disabled = false,
  idBase = "character-sheet-preset-tabs",
}: CharacterSheetPresetTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusByIndex = useCallback((index: number) => {
    const target = tabRefs.current[index];
    target?.focus();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        tabRefs.current[index]?.focus();
      });
    }
  }, []);

  const selectByIndex = useCallback(
    (index: number) => {
      if (!presetIds.length) return;
      const normalized = (index + presetIds.length) % presetIds.length;
      const nextPresetId = presetIds[normalized];
      if (!nextPresetId) return;
      void onSelectPreset(nextPresetId);
      focusByIndex(normalized);
    },
    [focusByIndex, onSelectPreset, presetIds]
  );

  return (
    <div
      className="character-sheet-preset-tab-row"
      role="tablist"
      aria-label="Character sheet style presets"
      aria-orientation="horizontal"
    >
      {presetIds.map((presetId, index) => {
        const isActive = activePresetId === presetId;
        return (
          <button
            key={presetId}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={getCharacterSheetPresetTabId(idBase, presetId)}
            aria-selected={isActive}
            aria-controls={panelId}
            tabIndex={isActive ? 0 : -1}
            className={`character-sheet-preset-tab ${isActive ? "is-active" : ""}`}
            onClick={() => {
              void onSelectPreset(presetId);
            }}
            onKeyDown={(event) => {
              if (disabled || !presetIds.length) return;
              if (event.key === "ArrowRight") {
                event.preventDefault();
                selectByIndex(index + 1);
                return;
              }
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                selectByIndex(index - 1);
                return;
              }
              if (event.key === "Home") {
                event.preventDefault();
                selectByIndex(0);
                return;
              }
              if (event.key === "End") {
                event.preventDefault();
                selectByIndex(presetIds.length - 1);
                return;
              }
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void onSelectPreset(presetId);
              }
            }}
            disabled={disabled}
          >
            <span className="character-sheet-preset-tab-label">{presetId}</span>
          </button>
        );
      })}
    </div>
  );
}
