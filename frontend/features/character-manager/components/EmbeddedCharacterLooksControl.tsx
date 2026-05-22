import React from "react";
import { Check, DotsThree, PencilSimple, Plus, Trash } from "phosphor-react";
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

const MAX_INLINE_PRESET_BUTTONS = 4;

const ROOT_STYLE: React.CSSProperties = {
  position: "relative",
  display: "grid",
  gap: "8px",
  width: "100%",
};

const CONTROL_ROW_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto auto",
  gap: "8px",
  alignItems: "start",
  minWidth: 0,
};

const TAB_RAIL_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "6px",
  minHeight: "36px",
  width: "100%",
  padding: "4px",
  borderRadius: "14px",
  border: "1px solid rgba(33, 39, 48, 0.96)",
  background: "rgba(11, 13, 18, 0.96)",
  boxSizing: "border-box",
};

const buildTabStyle = (isActive: boolean): React.CSSProperties => ({
  minHeight: "28px",
  height: "28px",
  width: "100%",
  borderRadius: "9px",
  border: `1px solid ${isActive ? "rgba(64, 186, 247, 0.82)" : "rgba(41, 47, 56, 0.96)"}`,
  background: isActive ? "rgba(28, 34, 42, 0.98)" : "rgba(29, 32, 39, 0.9)",
  color: isActive ? "rgba(242, 248, 255, 0.98)" : "rgba(211, 219, 230, 0.88)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 10px",
  fontSize: "11px",
  fontWeight: 700,
  lineHeight: 1,
  boxShadow: isActive ? "inset 0 0 0 1px rgba(79, 194, 255, 0.18)" : "none",
  boxSizing: "border-box",
});

const ACTION_BUTTON_STYLE: React.CSSProperties = {
  width: "36px",
  minWidth: "36px",
  height: "36px",
  borderRadius: "12px",
  border: "1px solid rgba(33, 39, 48, 0.96)",
  background: "rgba(11, 13, 18, 0.96)",
  color: "rgba(223, 227, 234, 0.9)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  flexShrink: 0,
};

const MENU_STYLE: React.CSSProperties = {
  position: "absolute",
  top: "44px",
  right: 0,
  zIndex: 20,
  width: "228px",
  padding: "12px",
  borderRadius: "16px",
  border: "1px solid rgba(35, 42, 52, 0.96)",
  background: "rgba(14, 17, 23, 0.98)",
  boxShadow: "0 16px 32px rgba(0, 0, 0, 0.36)",
  display: "grid",
  gap: "10px",
};

const MENU_SECTION_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "6px",
};

const MENU_SECTION_LABEL_STYLE: React.CSSProperties = {
  margin: 0,
  color: "rgba(138, 198, 224, 0.92)",
  fontSize: "0.76rem",
  fontWeight: 700,
  letterSpacing: "0.01em",
};

const MENU_PICKER_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "6px",
};

const buildMenuPresetButtonStyle = (isActive: boolean): React.CSSProperties => ({
  minHeight: "32px",
  borderRadius: "10px",
  border: `1px solid ${isActive ? "rgba(64, 186, 247, 0.82)" : "rgba(35, 42, 52, 0.96)"}`,
  background: isActive ? "rgba(28, 34, 42, 0.96)" : "rgba(20, 23, 29, 0.96)",
  color: isActive ? "rgba(242, 248, 255, 0.98)" : "rgba(212, 219, 230, 0.88)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  padding: "0 10px",
  fontSize: "0.82rem",
  fontWeight: 700,
});

const MENU_INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  height: "34px",
  borderRadius: "10px",
  border: "1px solid rgba(47, 210, 255, 0.3)",
  background: "rgba(10, 12, 17, 0.98)",
  color: "rgba(241, 246, 254, 0.98)",
  padding: "0 10px",
  fontSize: "0.84rem",
  boxSizing: "border-box",
};

const MENU_ACTION_ROW_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: "8px",
};

const MENU_PRIMARY_ACTION_STYLE: React.CSSProperties = {
  minHeight: "34px",
  borderRadius: "10px",
  border: "1px solid rgba(47, 210, 255, 0.34)",
  background: "rgba(19, 26, 33, 0.96)",
  color: "rgba(148, 224, 239, 0.96)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  padding: "0 10px",
  fontSize: "0.82rem",
  fontWeight: 700,
};

const MENU_DANGER_ACTION_STYLE: React.CSSProperties = {
  ...MENU_PRIMARY_ACTION_STYLE,
  border: "1px solid rgba(192, 97, 109, 0.38)",
  background: "rgba(35, 18, 24, 0.96)",
  color: "rgba(244, 189, 197, 0.96)",
};

const MENU_HELPER_STYLE: React.CSSProperties = {
  margin: 0,
  color: "rgba(168, 177, 191, 0.74)",
  fontSize: "0.74rem",
  lineHeight: 1.35,
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
  onRenamePreset,
  onDeletePreset,
}: EmbeddedCharacterLooksControlProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const renameInputRef = React.useRef<HTMLInputElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [renameValue, setRenameValue] = React.useState(
    presetLabels[activePresetId] ?? activePresetId
  );

  React.useEffect(() => {
    setRenameValue(presetLabels[activePresetId] ?? activePresetId);
  }, [activePresetId, presetLabels]);

  React.useEffect(() => {
    if (!isMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const rootNode = rootRef.current;
      if (!rootNode) return;
      if (event.target instanceof Node && rootNode.contains(event.target)) return;
      setIsMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  React.useEffect(() => {
    if (!isMenuOpen) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [isMenuOpen]);

  const displayPresetIds = React.useMemo(() => {
    if (presetIds.length <= MAX_INLINE_PRESET_BUTTONS) {
      return [...presetIds];
    }
    const defaultVisiblePresetIds = presetIds.slice(0, MAX_INLINE_PRESET_BUTTONS);
    if (defaultVisiblePresetIds.includes(activePresetId)) {
      return defaultVisiblePresetIds;
    }
    return [...defaultVisiblePresetIds.slice(0, MAX_INLINE_PRESET_BUTTONS - 1), activePresetId];
  }, [activePresetId, presetIds]);

  const hiddenPresetIds = React.useMemo(
    () => presetIds.filter((presetId) => !displayPresetIds.includes(presetId)),
    [displayPresetIds, presetIds]
  );

  const canAddPreset =
    Boolean(onAddPreset) && presetIds.length < MAX_CHARACTER_SHEET_PRESET_TAB_COUNT;
  const canDeleteActivePreset = Boolean(onDeletePreset) && activePresetId !== "1";

  const handleRename = React.useCallback(async () => {
    if (!onRenamePreset || disabled) return;
    await onRenamePreset(activePresetId, renameValue);
    setIsMenuOpen(false);
  }, [activePresetId, disabled, onRenamePreset, renameValue]);

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
    <div ref={rootRef} style={ROOT_STYLE}>
      <div style={CONTROL_ROW_STYLE}>
        <div
          role="tablist"
          aria-label="Character looks"
          aria-orientation="horizontal"
          style={{
            ...TAB_RAIL_STYLE,
            gridTemplateColumns: `repeat(${Math.max(displayPresetIds.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {displayPresetIds.map((presetId) => {
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
        </div>

        <button
          type="button"
          aria-label="Manage looks"
          style={ACTION_BUTTON_STYLE}
          onClick={() => {
            setIsMenuOpen((current) => !current);
          }}
          disabled={disabled}
        >
          <DotsThree size={16} weight="bold" />
        </button>

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

      {isMenuOpen ? (
        <div role="dialog" aria-label="Manage looks menu" style={MENU_STYLE}>
          <div style={MENU_SECTION_STYLE}>
            <p style={MENU_SECTION_LABEL_STYLE}>Selected look</p>
            <div style={MENU_PICKER_GRID_STYLE}>
              {presetIds.map((presetId) => {
                const isActive = presetId === activePresetId;
                return (
                  <button
                    key={presetId}
                    type="button"
                    style={buildMenuPresetButtonStyle(isActive)}
                    onClick={() => {
                      setIsMenuOpen(false);
                      void onSelectPreset(presetId);
                    }}
                    disabled={disabled}
                  >
                    {presetLabels[presetId] ?? presetId}
                    {isActive ? <Check size={12} weight="bold" /> : null}
                  </button>
                );
              })}
            </div>
            {hiddenPresetIds.length ? (
              <p style={MENU_HELPER_STYLE}>
                Hidden from the compact rail:{" "}
                {hiddenPresetIds.map((presetId) => presetLabels[presetId] ?? presetId).join(", ")}
              </p>
            ) : null}
          </div>

          {onRenamePreset ? (
            <div style={MENU_SECTION_STYLE}>
              <p style={MENU_SECTION_LABEL_STYLE}>Rename selected look</p>
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                maxLength={24}
                style={MENU_INPUT_STYLE}
                onChange={(event) => {
                  setRenameValue(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleRename();
                  }
                }}
                disabled={disabled}
              />
              <div style={MENU_ACTION_ROW_STYLE}>
                <button
                  type="button"
                  style={MENU_PRIMARY_ACTION_STYLE}
                  onClick={() => {
                    void handleRename();
                  }}
                  disabled={disabled}
                >
                  <PencilSimple size={13} weight="bold" />
                  <span>Save name</span>
                </button>
                {canDeleteActivePreset ? (
                  <button
                    type="button"
                    style={MENU_DANGER_ACTION_STYLE}
                    onClick={() => {
                      setIsMenuOpen(false);
                      void onDeletePreset?.(activePresetId);
                    }}
                    disabled={disabled}
                  >
                    <Trash size={13} weight="bold" />
                    <span>Delete</span>
                  </button>
                ) : (
                  <div />
                )}
              </div>
              {!canDeleteActivePreset ? (
                <p style={MENU_HELPER_STYLE}>Look 1 stays pinned as the fallback look.</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
