/**
 * Character Sheet look tabs component.
 * Renders an accessible look-tab strip with roving focus and keyboard navigation.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Plus, X } from "phosphor-react";
import type { CharacterSheetPresetId } from "../types";
import { MAX_CHARACTER_SHEET_PRESET_TAB_COUNT } from "../logic/characterSheetPresetTabs";

const TAB_DRAG_SCROLL_ACTIVATION_PX = 6;

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
  compact?: boolean;
  shrinkWrap?: boolean;
};

/**
 * Builds a stable tab id for a look tab button.
 */
export const getCharacterSheetPresetTabId = (
  idBase: string,
  presetId: CharacterSheetPresetId
): string => `${idBase}-tab-${presetId}`;

/**
 * Renders the Character Sheet look tabs with ARIA-compliant keyboard behavior.
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
  compact = false,
  shrinkWrap = false,
}: CharacterSheetPresetTabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const tabTrackRef = useRef<HTMLDivElement | null>(null);
  const dragScrollStateRef = useRef<{
    pointerId: number;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
  } | null>(null);
  const suppressPointerActivationRef = useRef(false);
  const suppressPointerActivationTimerRef = useRef<number | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<CharacterSheetPresetId | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [isDragScrollingTabs, setIsDragScrollingTabs] = useState(false);
  const activeEditingPresetId =
    editingPresetId && editingPresetId === activePresetId ? editingPresetId : null;

  const canAddPreset =
    Boolean(onAddPreset) && presetIds.length < MAX_CHARACTER_SHEET_PRESET_TAB_COUNT;
  const isEditing = activeEditingPresetId !== null;
  const compactRailStyle: CSSProperties | undefined = compact
    ? {
        minHeight: "32px",
      }
    : undefined;
  const compactRowStyle: CSSProperties | undefined = compact
    ? {
        minHeight: "32px",
        padding: "0 4px",
      }
    : undefined;
  const shrinkWrapTrackStyle: CSSProperties | undefined = shrinkWrap
    ? {
        width: "fit-content",
        maxWidth: "100%",
      }
    : undefined;
  const shrinkWrapTablistStyle: CSSProperties | undefined = shrinkWrap
    ? {
        width: "fit-content",
      }
    : undefined;
  const compactTabStyle: CSSProperties | undefined = compact
    ? {
        minHeight: "32px",
        minWidth: "64px",
        padding: "0 8px",
        fontSize: "11px",
      }
    : undefined;
  const compactAddButtonStyle: CSSProperties | undefined = compact
    ? {
        width: "32px",
        minWidth: "32px",
        height: "32px",
      }
    : undefined;

  useEffect(() => {
    if (!activeEditingPresetId) return;
    editInputRef.current?.focus();
    editInputRef.current?.select();
  }, [activeEditingPresetId]);

  useEffect(
    () => () => {
      if (suppressPointerActivationTimerRef.current !== null) {
        window.clearTimeout(suppressPointerActivationTimerRef.current);
      }
    },
    []
  );

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

  const consumeSuppressedPointerActivation = useCallback(() => {
    if (!suppressPointerActivationRef.current) {
      return false;
    }
    suppressPointerActivationRef.current = false;
    return true;
  }, []);

  const finalizeDragScroll = useCallback((pointerId: number) => {
    const dragState = dragScrollStateRef.current;
    if (!dragState || dragState.pointerId !== pointerId) {
      return;
    }
    const track = tabTrackRef.current;
    if (track && track.hasPointerCapture?.(pointerId)) {
      track.releasePointerCapture(pointerId);
    }
    dragScrollStateRef.current = null;
    setIsDragScrollingTabs(false);
    if (!dragState.moved) {
      return;
    }
    suppressPointerActivationRef.current = true;
    if (suppressPointerActivationTimerRef.current !== null) {
      window.clearTimeout(suppressPointerActivationTimerRef.current);
    }
    suppressPointerActivationTimerRef.current = window.setTimeout(() => {
      suppressPointerActivationRef.current = false;
      suppressPointerActivationTimerRef.current = null;
    }, 120);
  }, []);

  const handleTabTrackPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || isEditing) {
        return;
      }
      const eventTarget =
        event.target instanceof Element ? event.target : (event.target as Element | null);
      if (
        eventTarget?.closest(".character-sheet-preset-tab-input") ||
        eventTarget?.closest(".character-sheet-preset-delete-btn") ||
        eventTarget?.closest(".character-sheet-preset-add-btn")
      ) {
        return;
      }
      const track = tabTrackRef.current;
      if (!track) {
        return;
      }
      suppressPointerActivationRef.current = false;
      if (suppressPointerActivationTimerRef.current !== null) {
        window.clearTimeout(suppressPointerActivationTimerRef.current);
        suppressPointerActivationTimerRef.current = null;
      }
      dragScrollStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startScrollLeft: track.scrollLeft,
        moved: false,
      };
    },
    [isEditing]
  );

  const handleTabTrackPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragScrollStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }
    const track = tabTrackRef.current;
    if (!track) {
      return;
    }
    const deltaX = event.clientX - dragState.startX;
    if (!dragState.moved && Math.abs(deltaX) > TAB_DRAG_SCROLL_ACTIVATION_PX) {
      dragState.moved = true;
      setIsDragScrollingTabs(true);
      if (track.setPointerCapture) {
        track.setPointerCapture(event.pointerId);
      }
    }
    if (!dragState.moved) {
      return;
    }
    track.scrollLeft = dragState.startScrollLeft - deltaX;
  }, []);

  const handleTabTrackPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      finalizeDragScroll(event.pointerId);
    },
    [finalizeDragScroll]
  );

  const handleTabTrackPointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      finalizeDragScroll(event.pointerId);
    },
    [finalizeDragScroll]
  );

  return (
    <div className="character-sheet-preset-tab-rail" style={compactRailStyle}>
      <div className="character-sheet-preset-tab-row" style={compactRowStyle}>
        <div
          ref={tabTrackRef}
          className={`character-sheet-preset-tab-track${isDragScrollingTabs ? " is-drag-scrolling" : ""}`}
          style={shrinkWrapTrackStyle}
          onPointerDown={handleTabTrackPointerDown}
          onPointerMove={handleTabTrackPointerMove}
          onPointerUp={handleTabTrackPointerUp}
          onPointerCancel={handleTabTrackPointerCancel}
        >
          <div
            className="character-sheet-preset-tablist"
            role="tablist"
            aria-label="Character looks"
            aria-orientation="horizontal"
            style={shrinkWrapTablistStyle}
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
                    style={compactTabStyle}
                    onClick={() => {
                      if (consumeSuppressedPointerActivation()) return;
                      if (isEditingCurrentTab) return;
                      void onSelectPreset(presetId);
                    }}
                    onDoubleClick={() => {
                      if (consumeSuppressedPointerActivation()) return;
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
                        aria-label={`Rename look ${presetId}`}
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
                      aria-label={`Delete look ${presetId}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (consumeSuppressedPointerActivation()) return;
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
              style={compactAddButtonStyle}
              aria-label="Add character look"
              onClick={() => {
                if (consumeSuppressedPointerActivation()) return;
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
