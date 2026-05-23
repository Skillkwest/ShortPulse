import React from "react";
import { Plus } from "phosphor-react";
import { MAX_CHARACTER_SHEET_PRESET_TAB_COUNT } from "../logic/characterSheetPresetTabs";
import type { CharacterSheetPresetId } from "../types";
import { getCharacterSheetPresetTabId } from "./CharacterSheetPresetTabs";

const CHARACTER_REFERENCE_SURFACE_BACKGROUND = "var(--color-bg, #0f1115)";
const CHARACTER_PROFILE_WRAPPER_BACKGROUND = "rgba(201, 205, 214, 0.05)";
const TAB_DRAG_SCROLL_ACTIVATION_PX = 6;

type EmbeddedCharacterLooksControlProps = {
  presetIds: readonly CharacterSheetPresetId[];
  activePresetId: CharacterSheetPresetId;
  presetLabels: Record<CharacterSheetPresetId, string>;
  panelId: string;
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
  gap: "8px",
  width: "100%",
};

const CONTROL_ROW_STYLE: React.CSSProperties = {
  display: "block",
  minWidth: 0,
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
  background: CHARACTER_REFERENCE_SURFACE_BACKGROUND,
  backgroundColor: CHARACTER_REFERENCE_SURFACE_BACKGROUND,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
  boxSizing: "border-box",
};

const buildTabStyle = (isActive: boolean): React.CSSProperties => ({
  minHeight: "26px",
  height: "26px",
  width: "100%",
  borderRadius: "12px 12px 0 0",
  border: "none",
  background: isActive ? CHARACTER_PROFILE_WRAPPER_BACKGROUND : "rgba(201, 205, 214, 0.02)",
  backgroundColor: isActive ? CHARACTER_PROFILE_WRAPPER_BACKGROUND : "rgba(201, 205, 214, 0.02)",
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
  background: isActive ? CHARACTER_PROFILE_WRAPPER_BACKGROUND : "transparent",
  backgroundColor: isActive ? CHARACTER_PROFILE_WRAPPER_BACKGROUND : "transparent",
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

export function EmbeddedCharacterLooksControl({
  presetIds,
  activePresetId,
  presetLabels,
  panelId,
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
  onDeletePreset,
}: EmbeddedCharacterLooksControlProps) {
  const canAddPreset =
    Boolean(onAddPreset) && presetIds.length < MAX_CHARACTER_SHEET_PRESET_TAB_COUNT;
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

  return (
    <div style={ROOT_STYLE}>
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
              eventTarget?.closest('[aria-label^="Delete look "]') ||
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
