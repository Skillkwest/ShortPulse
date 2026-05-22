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
  const [hoveredPresetId, setHoveredPresetId] = useState<CharacterSheetPresetId | null>(null);
  const [focusWithinPresetId, setFocusWithinPresetId] = useState<CharacterSheetPresetId | null>(
    null
  );
  const activeEditingPresetId =
    editingPresetId && editingPresetId === activePresetId ? editingPresetId : null;

  const canAddPreset =
    Boolean(onAddPreset) && presetIds.length < MAX_CHARACTER_SHEET_PRESET_TAB_COUNT;
  const isEditing = activeEditingPresetId !== null;
  const compactRailStyle: CSSProperties | undefined = compact
    ? {
        minHeight: "36px",
        width: "100%",
        border: "1px solid rgba(38, 43, 51, 0.95)",
        borderRadius: "12px",
        background: "rgba(11, 13, 18, 0.96)",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
      }
    : undefined;
  const compactRowStyle: CSSProperties | undefined = compact
    ? {
        minHeight: "36px",
        padding: "3px 6px 2px",
        width: "100%",
        boxSizing: "border-box",
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
  const compactTrackStyle: CSSProperties | undefined = compact
    ? {
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        width: "100%",
        overflowX: "auto",
        overflowY: "hidden",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }
    : undefined;
  const compactTablistStyle: CSSProperties | undefined = compact
    ? {
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        flex: "1 1 auto",
        minWidth: 0,
      }
    : undefined;
  const compactTabShellStyle: CSSProperties | undefined = compact
    ? {
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        paddingTop: "1px",
      }
    : undefined;
  const compactTabStyle: CSSProperties | undefined = compact
    ? {
        minHeight: "28px",
        height: "28px",
        minWidth: "74px",
        padding: "0 12px",
        fontSize: "11px",
        borderRadius: "9px 9px 0 0",
        border: "1px solid rgba(38, 43, 51, 0.95)",
        background: "rgba(31, 34, 41, 0.92)",
        color: "rgba(223, 227, 234, 0.9)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        position: "relative",
        boxSizing: "border-box",
        lineHeight: 1,
        boxShadow: "none",
        transition: "none",
      }
    : undefined;
  const compactTabLabelStyle: CSSProperties | undefined = compact
    ? {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 1,
        fontSize: "11px",
        fontWeight: 600,
      }
    : undefined;
  const compactTabInputStyle: CSSProperties | undefined = compact
    ? {
        width: "100%",
        height: "20px",
        border: "1px solid rgba(47, 210, 255, 0.48)",
        borderRadius: "6px",
        background: "rgba(14, 17, 23, 0.98)",
        color: "rgba(243, 247, 255, 0.96)",
        fontSize: "11px",
        fontWeight: 600,
        textAlign: "center",
        outline: "none",
        padding: "0 6px",
        boxSizing: "border-box",
      }
    : undefined;
  const compactDeleteButtonStyle = useCallback(
    (isVisible: boolean): CSSProperties | undefined =>
      compact
        ? {
            position: "absolute",
            top: "5px",
            right: "6px",
            width: "14px",
            height: "14px",
            borderRadius: "999px",
            border: "1px solid rgba(61, 69, 82, 0.92)",
            background: "rgba(23, 26, 31, 0.96)",
            color: "rgba(181, 191, 208, 0.92)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            opacity: isVisible ? 1 : 0,
            pointerEvents: isVisible ? "auto" : "none",
            transition: "opacity 120ms ease",
          }
        : undefined,
    [compact]
  );
  const compactAddButtonStyle: CSSProperties | undefined = compact
    ? {
        width: "28px",
        minWidth: "28px",
        height: "28px",
        borderRadius: "9px 9px 0 0",
        border: "1px solid rgba(38, 43, 51, 0.95)",
        background: "rgba(14, 17, 23, 0.96)",
        color: "rgba(223, 227, 234, 0.9)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        flex: "0 0 auto",
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
          style={{ ...compactTrackStyle, ...shrinkWrapTrackStyle }}
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
            style={{ ...compactTablistStyle, ...shrinkWrapTablistStyle }}
          >
            {presetIds.map((presetId, index) => {
              const isActive = activePresetId === presetId;
              const label = presetLabels[presetId] ?? presetId;
              const isEditingCurrentTab = activeEditingPresetId === presetId;
              const canDeletePreset = Boolean(onDeletePreset) && presetId !== "1";
              const showDeleteButton =
                canDeletePreset &&
                (hoveredPresetId === presetId || focusWithinPresetId === presetId);
              return (
                <div
                  key={presetId}
                  className={`character-sheet-preset-tab-shell${isActive ? " is-active" : ""}${
                    canDeletePreset ? " is-deletable" : ""
                  }`}
                  style={compactTabShellStyle}
                  onMouseEnter={() => {
                    setHoveredPresetId(presetId);
                  }}
                  onMouseLeave={() => {
                    setHoveredPresetId((current) => (current === presetId ? null : current));
                  }}
                  onFocusCapture={() => {
                    setFocusWithinPresetId(presetId);
                  }}
                  onBlurCapture={(event) => {
                    const nextFocusTarget = event.relatedTarget;
                    if (
                      nextFocusTarget instanceof Node &&
                      event.currentTarget.contains(nextFocusTarget)
                    ) {
                      return;
                    }
                    setFocusWithinPresetId((current) => (current === presetId ? null : current));
                  }}
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
                    style={
                      compact
                        ? {
                            ...compactTabStyle,
                            paddingRight: canDeletePreset ? "22px" : compactTabStyle?.padding,
                            borderColor: isActive
                              ? "rgba(50, 168, 230, 0.78)"
                              : "rgba(38, 43, 51, 0.95)",
                            background: isActive
                              ? "rgba(27, 31, 38, 0.98)"
                              : "rgba(31, 34, 41, 0.92)",
                            color: isActive
                              ? "rgba(241, 248, 255, 0.98)"
                              : "rgba(223, 227, 234, 0.9)",
                            boxShadow: isActive
                              ? "inset 0 0 0 1px rgba(79, 194, 255, 0.18)"
                              : "none",
                          }
                        : undefined
                    }
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
                        style={compactTabInputStyle}
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
                      <span
                        className="character-sheet-preset-tab-label"
                        style={compactTabLabelStyle}
                        title={label}
                      >
                        {label}
                      </span>
                    )}
                  </button>
                  {canDeletePreset ? (
                    <button
                      type="button"
                      className="character-sheet-preset-delete-btn"
                      style={compactDeleteButtonStyle(showDeleteButton)}
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
