import React from "react";
import { CaretLeft, CaretRight, PencilSimple, Plus, Trash } from "phosphor-react";
import {
  getCharacterSheetPresetTabId,
  MAX_CHARACTER_SHEET_PRESET_TAB_COUNT,
} from "../logic/characterSheetPresetTabs";
import {
  CHARACTER_PANEL_REFERENCE_SURFACE_BACKGROUND,
  CHARACTER_PANEL_SELECTED_TAB_BACKGROUND,
  CHARACTER_PANEL_TAB_ENTRY_BACKGROUND,
} from "../constants";
import type { CharacterSheetPresetId } from "../types";

const TAB_DRAG_SCROLL_ACTIVATION_PX = 6;

type EmbeddedCharacterLooksControlProps = {
  presetIds: readonly CharacterSheetPresetId[];
  activePresetId: CharacterSheetPresetId;
  presetLabels: Record<CharacterSheetPresetId, string>;
  panelId: string;
  headerContent?: React.ReactNode;
  idBase?: string;
  disabled?: boolean;
  viewportMinHeightPx?: number;
  viewportPaddingXpx?: number;
  railMinHeightPx?: number;
  tabMinWidthPx?: number;
  tabHeightPx?: number;
  deleteButtonTopPx?: number;
  deleteButtonRightPx?: number;
  onSelectPreset: (presetId: CharacterSheetPresetId) => void | Promise<void>;
  onAddPreset?: () => void | Promise<void>;
  onRenamePreset?: (presetId: CharacterSheetPresetId, nextLabel: string) => void | Promise<void>;
  onDeletePreset?: (presetId: CharacterSheetPresetId) => void | Promise<void>;
};

const ROOT_STYLE: React.CSSProperties = {
  position: "relative",
  display: "grid",
  gap: "6px",
  width: "100%",
};

const CONTROL_ROW_STYLE: React.CSSProperties = {
  display: "block",
  minWidth: 0,
};

const HEADER_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  minWidth: 0,
};

const OVERFLOW_ACTIONS_STYLE: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "4px",
  minHeight: "18px",
  flexShrink: 0,
};

const MANAGE_ACTIONS_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  minWidth: 0,
};

const OVERFLOW_ACTION_BUTTON_STYLE: React.CSSProperties = {
  width: "18px",
  minWidth: "18px",
  height: "18px",
  borderRadius: "999px",
  border: "1px solid rgba(56, 64, 76, 0.92)",
  background: "rgba(18, 22, 28, 0.92)",
  color: "rgba(183, 194, 208, 0.94)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  flexShrink: 0,
  cursor: "pointer",
};

const MANAGE_ACTION_BUTTON_STYLE: React.CSSProperties = {
  minWidth: "22px",
  height: "20px",
  borderRadius: "999px",
  border: "1px solid rgba(56, 64, 76, 0.92)",
  background: "rgba(18, 22, 28, 0.92)",
  color: "rgba(214, 223, 234, 0.94)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "4px",
  padding: "0 8px",
  flexShrink: 0,
  cursor: "pointer",
  fontSize: "11px",
  fontWeight: 700,
  lineHeight: 1,
};

const TAB_VIEWPORT_STYLE: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  minHeight: "36px",
  overflowX: "auto",
  overflowY: "hidden",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  cursor: "grab",
};

const TAB_RAIL_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "8px",
  alignItems: "end",
  minHeight: "36px",
  width: "fit-content",
  padding: "3px 6px 0",
  borderRadius: "12px 12px 0 0",
  border: "1px solid rgba(38, 43, 51, 0.95)",
  borderBottom: "none",
  background: CHARACTER_PANEL_REFERENCE_SURFACE_BACKGROUND,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
  boxSizing: "border-box",
};

const buildTabStyle = (isActive: boolean): React.CSSProperties => ({
  minHeight: "26px",
  height: "26px",
  width: "100%",
  borderRadius: "12px 12px 0 0",
  border: "none",
  background: isActive
    ? CHARACTER_PANEL_SELECTED_TAB_BACKGROUND
    : CHARACTER_PANEL_TAB_ENTRY_BACKGROUND,
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
  boxShadow: "none",
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

const TAB_SHELL_STYLE: React.CSSProperties = {
  position: "relative",
  minWidth: 0,
  width: "100%",
};

const buildTabShellStyle = (isActive: boolean): React.CSSProperties => ({
  ...TAB_SHELL_STYLE,
  borderRadius: "12px 12px 0 0",
  background: isActive ? CHARACTER_PANEL_SELECTED_TAB_BACKGROUND : "transparent",
});

const buildDeleteButtonStyle = (
  isVisible: boolean,
  topPx: number,
  rightPx: number
): React.CSSProperties => ({
  position: "absolute",
  top: `${topPx}px`,
  right: `${rightPx}px`,
  width: "14px",
  height: "14px",
  border: "1px solid rgba(140, 52, 66, 0.9)",
  borderRadius: "999px",
  background: "linear-gradient(180deg, rgba(74, 23, 31, 0.98) 0%, rgba(54, 16, 24, 0.98) 100%)",
  color: "rgba(255, 176, 188, 0.98)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: 1,
  boxShadow: isVisible
    ? "0 0 0 1px rgba(255, 96, 123, 0.16), 0 3px 8px rgba(0, 0, 0, 0.24)"
    : "none",
  opacity: isVisible ? 1 : 0,
  pointerEvents: isVisible ? "auto" : "none",
  transition: "opacity 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease",
  cursor: "pointer",
});

const TAB_INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  height: "20px",
  border: "1px solid rgba(47, 210, 255, 0.48)",
  borderRadius: "6px",
  background: "rgba(14, 17, 23, 0.98)",
  color: "rgba(243, 247, 255, 0.96)",
  fontSize: "11px",
  fontWeight: 700,
  textAlign: "center",
  outline: "none",
  padding: "0 6px",
  boxSizing: "border-box",
};

export function EmbeddedCharacterLooksControl({
  presetIds,
  activePresetId,
  presetLabels,
  panelId,
  headerContent,
  idBase = "embedded-character-looks",
  disabled = false,
  viewportMinHeightPx = 36,
  viewportPaddingXpx = 6,
  railMinHeightPx = 36,
  tabMinWidthPx = 68,
  tabHeightPx = 26,
  deleteButtonTopPx = 5,
  deleteButtonRightPx = 6,
  onSelectPreset,
  onAddPreset,
  onRenamePreset,
  onDeletePreset,
}: EmbeddedCharacterLooksControlProps) {
  const canAddPreset =
    Boolean(onAddPreset) && presetIds.length < MAX_CHARACTER_SHEET_PRESET_TAB_COUNT;
  const editInputRef = React.useRef<HTMLInputElement | null>(null);
  const [hoveredPresetId, setHoveredPresetId] = React.useState<CharacterSheetPresetId | null>(null);
  const railViewportRef = React.useRef<HTMLDivElement | null>(null);
  const pointerDragStateRef = React.useRef<{
    pointerId: number;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
  } | null>(null);
  const suppressPointerActivationRef = React.useRef(false);
  const suppressPointerActivationTimerRef = React.useRef<number | null>(null);
  const [editingPresetId, setEditingPresetId] = React.useState<CharacterSheetPresetId | null>(null);
  const [editingLabel, setEditingLabel] = React.useState("");
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);
  const activePresetLabel = presetLabels[activePresetId] ?? activePresetId;
  const activeEditingPresetId =
    editingPresetId && editingPresetId === activePresetId ? editingPresetId : null;
  const canRenameActivePreset = Boolean(onRenamePreset);
  const canDeleteActivePreset = Boolean(onDeletePreset) && activePresetId !== "1";

  const commitRename = React.useCallback(
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

  const cancelRename = React.useCallback(() => {
    setEditingPresetId(null);
    setEditingLabel("");
  }, []);

  React.useEffect(() => {
    if (!activeEditingPresetId) return;
    editInputRef.current?.focus();
    editInputRef.current?.select();
  }, [activeEditingPresetId]);

  const syncScrollAffordances = React.useCallback(() => {
    const viewport = railViewportRef.current;
    if (!viewport) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    setCanScrollLeft(viewport.scrollLeft > 2);
    setCanScrollRight(viewport.scrollLeft < maxScrollLeft - 2);
  }, []);

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

  const handleViewportStepScroll = React.useCallback(
    (direction: -1 | 1) => {
      const viewport = railViewportRef.current;
      if (!viewport) return;
      const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const scrollStepPx = Math.max(tabMinWidthPx * 2, Math.round(viewport.clientWidth * 0.6), 72);
      viewport.scrollLeft = Math.max(
        0,
        Math.min(maxScrollLeft, viewport.scrollLeft + direction * scrollStepPx)
      );
      syncScrollAffordances();
    },
    [syncScrollAffordances, tabMinWidthPx]
  );

  const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = railViewportRef.current;
    const dragState = pointerDragStateRef.current;
    if (!viewport || !dragState || dragState.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - dragState.startX;
    if (!dragState.moved && Math.abs(deltaX) > TAB_DRAG_SCROLL_ACTIVATION_PX) {
      dragState.moved = true;
      if (viewport.setPointerCapture) {
        viewport.setPointerCapture(event.pointerId);
      }
    }
    if (!dragState.moved) return;
    viewport.scrollLeft = dragState.startScrollLeft - deltaX;
  }, []);

  const consumeSuppressedPointerActivation = React.useCallback(() => {
    if (!suppressPointerActivationRef.current) return false;
    suppressPointerActivationRef.current = false;
    return true;
  }, []);

  const endPointerDrag = React.useCallback((pointerId?: number) => {
    const viewport = railViewportRef.current;
    const dragState = pointerDragStateRef.current;
    if (!dragState) return;
    if (pointerId != null && dragState.pointerId !== pointerId) return;
    if (viewport) {
      try {
        viewport.releasePointerCapture(dragState.pointerId);
      } catch {
        // Ignore release failures when capture was never established.
      }
    }
    pointerDragStateRef.current = null;
    if (!dragState.moved) return;
    suppressPointerActivationRef.current = true;
    if (suppressPointerActivationTimerRef.current !== null) {
      window.clearTimeout(suppressPointerActivationTimerRef.current);
    }
    suppressPointerActivationTimerRef.current = window.setTimeout(() => {
      suppressPointerActivationRef.current = false;
      suppressPointerActivationTimerRef.current = null;
    }, 120);
  }, []);

  React.useEffect(
    () => () => {
      if (suppressPointerActivationTimerRef.current !== null) {
        window.clearTimeout(suppressPointerActivationTimerRef.current);
      }
    },
    []
  );

  React.useEffect(() => {
    syncScrollAffordances();
    const viewport = railViewportRef.current;
    if (!viewport) return;
    const handleScroll = () => {
      syncScrollAffordances();
    };
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      viewport.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [presetIds, syncScrollAffordances]);

  return (
    <div style={ROOT_STYLE}>
      {headerContent ? (
        <div style={HEADER_ROW_STYLE}>
          <div style={{ minWidth: 0 }}>{headerContent}</div>
          <div style={OVERFLOW_ACTIONS_STYLE}>
            <div style={MANAGE_ACTIONS_STYLE}>
              {canRenameActivePreset ? (
                <button
                  type="button"
                  aria-label={`Rename look ${activePresetLabel}`}
                  style={MANAGE_ACTION_BUTTON_STYLE}
                  onClick={() => {
                    setEditingPresetId(activePresetId);
                    setEditingLabel(activePresetLabel);
                  }}
                  disabled={disabled}
                  title={`Rename look ${activePresetLabel}`}
                >
                  <PencilSimple size={10} weight="bold" aria-hidden />
                  <span>Rename</span>
                </button>
              ) : null}
              {canDeleteActivePreset ? (
                <button
                  type="button"
                  aria-label={`Delete look ${activePresetLabel}`}
                  style={MANAGE_ACTION_BUTTON_STYLE}
                  onClick={() => {
                    void onDeletePreset?.(activePresetId);
                  }}
                  disabled={disabled || activeEditingPresetId !== null}
                  title={`Delete look ${activePresetLabel}`}
                >
                  <Trash size={10} weight="bold" aria-hidden />
                  <span>Delete</span>
                </button>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Scroll looks left"
              style={{
                ...OVERFLOW_ACTION_BUTTON_STYLE,
                opacity: canScrollLeft ? 1 : 0.42,
                cursor: canScrollLeft ? "pointer" : "default",
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onMouseDown={(event) => {
                event.stopPropagation();
              }}
              onClick={() => {
                handleViewportStepScroll(-1);
              }}
              disabled={!canScrollLeft}
            >
              <CaretLeft size={10} weight="bold" />
            </button>
            <button
              type="button"
              aria-label="Scroll looks right"
              style={{
                ...OVERFLOW_ACTION_BUTTON_STYLE,
                opacity: canScrollRight ? 1 : 0.42,
                cursor: canScrollRight ? "pointer" : "default",
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onMouseDown={(event) => {
                event.stopPropagation();
              }}
              onClick={() => {
                handleViewportStepScroll(1);
              }}
              disabled={!canScrollRight}
            >
              <CaretRight size={10} weight="bold" />
            </button>
          </div>
        </div>
      ) : null}
      <div style={CONTROL_ROW_STYLE}>
        <div
          ref={railViewportRef}
          style={{
            ...TAB_VIEWPORT_STYLE,
            minHeight: `${viewportMinHeightPx}px`,
            paddingInline: `${viewportPaddingXpx}px`,
          }}
          onPointerDown={(event) => {
            const viewport = railViewportRef.current;
            if (!viewport || event.pointerType === "touch" || event.button !== 0) return;
            const eventTarget =
              event.target instanceof Element ? event.target : (event.target as Element | null);
            if (
              eventTarget?.closest(".embedded-character-looks-rename-input") ||
              eventTarget?.closest('[aria-label^="Delete look "]') ||
              eventTarget?.closest('[aria-label^="Rename look "]') ||
              eventTarget?.closest('[aria-label="Add character look"]')
            ) {
              return;
            }
            suppressPointerActivationRef.current = false;
            if (suppressPointerActivationTimerRef.current !== null) {
              window.clearTimeout(suppressPointerActivationTimerRef.current);
              suppressPointerActivationTimerRef.current = null;
            }
            pointerDragStateRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startScrollLeft: viewport.scrollLeft,
              moved: false,
            };
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => {
            endPointerDrag(event.pointerId);
          }}
          onPointerCancel={(event) => {
            endPointerDrag(event.pointerId);
          }}
          onPointerLeave={(event) => {
            if ((event.buttons & 1) === 0) {
              endPointerDrag(event.pointerId);
            }
          }}
        >
          <div
            role="tablist"
            aria-label="Character looks"
            aria-orientation="horizontal"
            style={{
              ...TAB_RAIL_STYLE,
              minHeight: `${railMinHeightPx}px`,
              gridTemplateColumns: canAddPreset
                ? `repeat(${Math.max(presetIds.length, 1)}, ${tabMinWidthPx}px) 26px`
                : `repeat(${Math.max(presetIds.length, 1)}, ${tabMinWidthPx}px)`,
            }}
          >
            {presetIds.map((presetId) => {
              const label = presetLabels[presetId] ?? presetId;
              const isActive = activePresetId === presetId;
              const isEditingCurrentTab = activeEditingPresetId === presetId;
              const canDeletePreset = Boolean(onDeletePreset) && presetId !== "1";
              const showDeleteButton = canDeletePreset && hoveredPresetId === presetId;
              return (
                <div
                  key={presetId}
                  style={buildTabShellStyle(isActive)}
                  onMouseEnter={() => {
                    setHoveredPresetId(presetId);
                  }}
                  onMouseLeave={() => {
                    setHoveredPresetId((current) => (current === presetId ? null : current));
                  }}
                >
                  <button
                    type="button"
                    role="tab"
                    id={getCharacterSheetPresetTabId(idBase, presetId)}
                    aria-selected={isActive}
                    aria-controls={panelId}
                    tabIndex={isActive ? 0 : -1}
                    style={{
                      ...buildTabStyle(isActive),
                      minHeight: `${tabHeightPx}px`,
                      height: `${tabHeightPx}px`,
                    }}
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
                      if (disabled || !presetIds.length) return;
                      if (isEditingCurrentTab) return;
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
                        return;
                      }
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void onSelectPreset(presetId);
                      }
                    }}
                    disabled={disabled}
                    title={label}
                  >
                    {isEditingCurrentTab ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        className="embedded-character-looks-rename-input"
                        style={TAB_INPUT_STYLE}
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
                      label
                    )}
                  </button>
                  {canDeletePreset ? (
                    <button
                      type="button"
                      aria-label={`Delete look ${label}`}
                      style={buildDeleteButtonStyle(
                        showDeleteButton,
                        deleteButtonTopPx,
                        deleteButtonRightPx
                      )}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (consumeSuppressedPointerActivation()) return;
                        void onDeletePreset?.(presetId);
                      }}
                      disabled={disabled}
                      title={`Delete look ${label}`}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              );
            })}
            {canAddPreset ? (
              <button
                type="button"
                aria-label="Add character look"
                style={ACTION_BUTTON_STYLE}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={() => {
                  if (consumeSuppressedPointerActivation()) return;
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
    </div>
  );
}
