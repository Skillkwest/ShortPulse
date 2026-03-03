/**
 * Character Sheet preset tabs component.
 * Renders an accessible preset-tab strip with roving focus and keyboard navigation.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "phosphor-react";
import type { CharacterSheetPresetId } from "../types";
import { MAX_CHARACTER_SHEET_PRESET_TAB_COUNT } from "../logic/characterSheetPresetTabs";

type CharacterSheetPresetTabsProps = {
  presetIds: readonly CharacterSheetPresetId[];
  activePresetId: CharacterSheetPresetId;
  presetLabels: Record<CharacterSheetPresetId, string>;
  onSelectPreset: (presetId: CharacterSheetPresetId) => void | Promise<void>;
  onAddPreset?: () => void | Promise<void>;
  onRenamePreset?: (presetId: CharacterSheetPresetId, nextLabel: string) => void | Promise<void>;
  onDeletePreset?: (presetId: CharacterSheetPresetId) => void | Promise<void>;
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
  presetLabels,
  onSelectPreset,
  onAddPreset,
  onRenamePreset,
  onDeletePreset,
  panelId,
  disabled = false,
  idBase = "character-sheet-preset-tabs",
}: CharacterSheetPresetTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<CharacterSheetPresetId | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const activeEditingPresetId =
    editingPresetId && editingPresetId === activePresetId ? editingPresetId : null;

  const canAddPreset =
    Boolean(onAddPreset) && presetIds.length < MAX_CHARACTER_SHEET_PRESET_TAB_COUNT;
  const isEditing = activeEditingPresetId !== null;

  useEffect(() => {
    if (!activeEditingPresetId) return;
    editInputRef.current?.focus();
    editInputRef.current?.select();
  }, [activeEditingPresetId]);

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

  const commitRename = useCallback(
    (presetId: CharacterSheetPresetId) => {
      if (!onRenamePreset) {
        setEditingPresetId(null);
        setEditingLabel("");
        return;
      }
      void onRenamePreset(presetId, editingLabel);
      setEditingPresetId(null);
      setEditingLabel("");
    },
    [editingLabel, onRenamePreset]
  );

  const cancelRename = useCallback(() => {
    setEditingPresetId(null);
    setEditingLabel("");
  }, []);

  return (
    <div className="character-sheet-preset-tab-rail">
      <div className="character-sheet-preset-tab-row">
        <div className="character-sheet-preset-tab-track">
          <div
            className="character-sheet-preset-tablist"
            role="tablist"
            aria-label="Character sheet style presets"
            aria-orientation="horizontal"
          >
            {presetIds.map((presetId, index) => {
              const isActive = activePresetId === presetId;
              const label = presetLabels[presetId] ?? presetId;
              const isEditingCurrentTab = activeEditingPresetId === presetId;
              const canDeletePreset = Boolean(onDeletePreset) && presetId !== "1";
              return (
                <div
                  key={presetId}
                  className={`character-sheet-preset-tab-shell${isActive ? " is-active" : ""}${
                    canDeletePreset ? " is-deletable" : ""
                  }`}
                >
                  <button
                    ref={(node) => {
                      tabRefs.current[index] = node;
                    }}
                    type="button"
                    role="tab"
                    id={getCharacterSheetPresetTabId(idBase, presetId)}
                    aria-selected={isActive}
                    aria-controls={panelId}
                    tabIndex={isActive ? 0 : -1}
                    className={`character-sheet-preset-tab ${isActive ? "is-active" : ""} ${
                      canDeletePreset ? "is-deletable" : ""
                    }`}
                    onClick={() => {
                      if (isEditingCurrentTab) return;
                      void onSelectPreset(presetId);
                    }}
                    onDoubleClick={() => {
                      if (disabled || !onRenamePreset) return;
                      setEditingPresetId(presetId);
                      setEditingLabel(label);
                    }}
                    onKeyDown={(event) => {
                      if (isEditingCurrentTab) return;
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
                    {isEditingCurrentTab ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        className="character-sheet-preset-tab-input"
                        value={editingLabel}
                        maxLength={24}
                        aria-label={`Rename preset ${presetId}`}
                        onChange={(event) => {
                          setEditingLabel(event.target.value);
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === "Escape") {
                            event.preventDefault();
                            cancelRename();
                            return;
                          }
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitRename(presetId);
                          }
                        }}
                        onBlur={() => {
                          commitRename(presetId);
                        }}
                      />
                    ) : (
                      <span className="character-sheet-preset-tab-label" title={label}>
                        {label}
                      </span>
                    )}
                  </button>
                  {canDeletePreset ? (
                    <button
                      type="button"
                      className="character-sheet-preset-delete-btn"
                      aria-label={`Delete preset ${presetId}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        void onDeletePreset?.(presetId);
                      }}
                      disabled={disabled || isEditing || isEditingCurrentTab}
                    >
                      <X size={10} weight="bold" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          {canAddPreset ? (
            <button
              type="button"
              className="character-sheet-preset-add-btn"
              aria-label="Add character sheet preset tab"
              onClick={() => {
                void onAddPreset?.();
              }}
              disabled={disabled || isEditing}
            >
              <Plus size={12} weight="bold" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
