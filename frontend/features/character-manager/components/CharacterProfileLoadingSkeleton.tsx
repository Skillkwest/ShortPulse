import React from "react";
import {
  CHARACTER_PANEL_FIELD_BACKGROUND,
  CHARACTER_PANEL_FIELD_BORDER,
  CHARACTER_PANEL_REFERENCE_SURFACE_BACKGROUND,
  CHARACTER_PANEL_SELECTED_TAB_BACKGROUND,
  CHARACTER_PANEL_SHELL_BACKGROUND,
  CHARACTER_PANEL_TAB_ENTRY_BACKGROUND,
  CHARACTER_PANEL_TWO_COLUMN_GRID_AREAS,
  CHARACTER_PANEL_TWO_COLUMN_GRID_TEMPLATE,
} from "../constants";
import { resolveCharacterPanelResponsiveLayout } from "../logic/characterPanelResponsiveLayout";

type CharacterProfileLoadingSkeletonProps = {
  surface: "page" | "panel";
};

const REFERENCE_SLOT_LABELS = ["Portrait", "Close Up", "Front Shot"] as const;
const LOADING_TEXT_COLOR = "rgba(201, 205, 214, 0.5)";
const SHELL_BACKGROUND = CHARACTER_PANEL_SHELL_BACKGROUND;
const FIELD_BACKGROUND = CHARACTER_PANEL_FIELD_BACKGROUND;
const FIELD_BORDER = CHARACTER_PANEL_FIELD_BORDER;
const PANEL_ACCENT = "rgba(37, 204, 255, 0.32)";
const SHIMMER_KEYFRAMES: Keyframe[] = [
  {
    transform: "translateX(-130%)",
  },
  {
    transform: "translateX(130%)",
  },
];

const SHELL_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "14px",
  width: "100%",
};

const TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  color: "rgba(110, 214, 233, 0.96)",
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  fontSize: "15px",
  fontWeight: 700,
  letterSpacing: "0.01em",
};

const COPY_STYLE: React.CSSProperties = {
  margin: 0,
  color: LOADING_TEXT_COLOR,
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  fontSize: "12px",
  lineHeight: 1.4,
};

const SPINNER_SVG_STYLE: React.CSSProperties = {
  display: "block",
  width: "34px",
  height: "34px",
  overflow: "visible",
  filter: "drop-shadow(0 0 12px rgba(37, 204, 255, 0.14))",
};

const SECTION_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "6px",
  width: "100%",
};

const ACTION_ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  flexWrap: "wrap",
  width: "100%",
  minWidth: 0,
};

const ACTION_PRIMARY_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minWidth: 0,
};

const ACTION_SECONDARY_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "8px",
  flex: "1 1 0",
  minWidth: 0,
  marginLeft: "auto",
};

const EDITOR_WRAPPER_STYLE: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  display: "grid",
  gap: "1px",
  padding: "12px 8px 3px",
  borderRadius: "15px",
  border: "1px solid rgba(30, 35, 43, 0.96)",
  background: SHELL_BACKGROUND,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
};

const SHIMMER_OVERLAY_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(106deg, rgba(255, 255, 255, 0) 14%, rgba(110, 214, 233, 0.05) 42%, rgba(201, 214, 230, 0.12) 56%, rgba(255, 255, 255, 0) 78%)",
  transform: "translateX(-130%)",
  pointerEvents: "none",
};

const INPUT_ROW_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: CHARACTER_PANEL_TWO_COLUMN_GRID_TEMPLATE,
  alignItems: "start",
};

const FIELD_GROUP_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "6px",
  minWidth: 0,
};

const LOOKS_HEADER_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  minWidth: 0,
};

const LOOKS_OVERFLOW_ACTIONS_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  minHeight: "18px",
  flexShrink: 0,
};

const PRESET_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: CHARACTER_PANEL_TWO_COLUMN_GRID_TEMPLATE,
  gridTemplateAreas: CHARACTER_PANEL_TWO_COLUMN_GRID_AREAS,
  alignItems: "start",
};

const DESCRIPTION_COLUMN_STYLE: React.CSSProperties = {
  gridArea: "description",
  display: "grid",
  gap: "4px",
  minWidth: 0,
};

const REFERENCES_COLUMN_STYLE: React.CSSProperties = {
  gridArea: "references",
  display: "grid",
  gap: "6px",
  minWidth: 0,
};

const REFERENCE_GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  alignItems: "start",
};

const LINE_STYLE: React.CSSProperties = {
  display: "block",
  borderRadius: "999px",
  background: "linear-gradient(90deg, rgba(201, 205, 214, 0.22), rgba(201, 205, 214, 0.1))",
};

const buildSkeletonButtonStyle = (
  width: number,
  height: number,
  radius: number
): React.CSSProperties => ({
  position: "relative",
  overflow: "hidden",
  width: `${width}px`,
  minWidth: `${width}px`,
  maxWidth: `${width}px`,
  height: `${height}px`,
  minHeight: `${height}px`,
  maxHeight: `${height}px`,
  borderRadius: `${radius}px`,
  border: `1px solid ${PANEL_ACCENT}`,
  background: "rgba(28, 32, 37, 0.94)",
  boxShadow: "0 6px 14px rgba(0, 0, 0, 0.18)",
  flexShrink: 0,
  boxSizing: "border-box",
});

const buildInputStyle = (heightPx: number): React.CSSProperties => ({
  position: "relative",
  overflow: "hidden",
  display: "block",
  width: "100%",
  height: `${heightPx}px`,
  minHeight: `${heightPx}px`,
  borderRadius: "10px",
  border: `1px solid ${FIELD_BORDER}`,
  background: FIELD_BACKGROUND,
  boxSizing: "border-box",
});

const buildLooksRailStyle = (minHeightPx: number): React.CSSProperties => ({
  position: "relative",
  overflow: "hidden",
  display: "grid",
  gap: "8px",
  padding: "3px 6px 0",
  minHeight: `${minHeightPx}px`,
  borderRadius: "12px 12px 0 0",
  border: "1px solid rgba(38, 43, 51, 0.95)",
  borderBottom: "none",
  background: CHARACTER_PANEL_REFERENCE_SURFACE_BACKGROUND,
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
  boxSizing: "border-box",
});

const buildLooksTabStyle = (
  widthPx: number,
  heightPx: number,
  active = false
): React.CSSProperties => ({
  display: "block",
  width: `${widthPx}px`,
  minWidth: `${widthPx}px`,
  height: `${heightPx}px`,
  minHeight: `${heightPx}px`,
  borderRadius: "12px 12px 0 0",
  background: active
    ? CHARACTER_PANEL_SELECTED_TAB_BACKGROUND
    : CHARACTER_PANEL_TAB_ENTRY_BACKGROUND,
});

const buildDescriptionCardStyle = (): React.CSSProperties => ({
  position: "relative",
  overflow: "hidden",
  display: "grid",
  gap: "8px",
  minWidth: 0,
});

const buildDescriptionBoxStyle = (heightPx: number): React.CSSProperties => ({
  position: "relative",
  overflow: "hidden",
  display: "block",
  width: "100%",
  height: `${heightPx}px`,
  minHeight: `${heightPx}px`,
  maxHeight: `${heightPx}px`,
  borderRadius: "12px",
  border: `1px solid ${FIELD_BORDER}`,
  background: FIELD_BACKGROUND,
  boxSizing: "border-box",
});

const buildReferenceCardStyle = (
  maxWidthPx: number,
  hintHeightPx: number
): React.CSSProperties => ({
  position: "relative",
  overflow: "hidden",
  display: "grid",
  width: "100%",
  maxWidth: `${maxWidthPx}px`,
  aspectRatio: "4 / 5",
  gridTemplateRows: `minmax(0, 1fr) ${hintHeightPx}px`,
  borderRadius: "10px",
  border: `1px solid ${FIELD_BORDER}`,
  background: "rgba(12, 14, 19, 0.96)",
  boxShadow: "0 14px 30px rgba(0, 0, 0, 0.28), 0 3px 8px rgba(0, 0, 0, 0.18)",
  justifySelf: "stretch",
  boxSizing: "border-box",
});

const REFERENCE_MEDIA_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 0,
  boxSizing: "border-box",
};

const REFERENCE_HINT_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderTop: "1px dashed rgba(50, 57, 67, 0.9)",
  background: FIELD_BACKGROUND,
  boxSizing: "border-box",
};

const SMALL_ACTION_STYLE: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  width: "18px",
  minWidth: "18px",
  height: "18px",
  borderRadius: "999px",
  border: "1px solid rgba(56, 64, 76, 0.92)",
  background: "rgba(18, 22, 28, 0.92)",
  boxSizing: "border-box",
};

function useShimmerAnimation() {
  const shimmerRefs = React.useRef<HTMLDivElement[]>([]);

  const registerShimmerRef = React.useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    shimmerRefs.current.push(node);
  }, []);

  React.useEffect(() => {
    const animations = shimmerRefs.current
      .map((node) => {
        if (typeof node.animate !== "function") {
          return null;
        }
        return node.animate(SHIMMER_KEYFRAMES, {
          duration: 1350,
          iterations: Number.POSITIVE_INFINITY,
          easing: "ease-in-out",
        });
      })
      .filter((animation): animation is Animation => animation !== null);

    return () => {
      animations.forEach((animation) => animation.cancel());
      shimmerRefs.current = [];
    };
  }, []);

  return registerShimmerRef;
}

function SkeletonSurface({
  children,
  registerShimmerRef,
  style,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode;
  registerShimmerRef: (node: HTMLDivElement | null) => void;
  style: React.CSSProperties;
}) {
  return (
    <div {...rest} aria-hidden="true" style={style}>
      <div ref={registerShimmerRef} style={SHIMMER_OVERLAY_STYLE} />
      {children}
    </div>
  );
}

/**
 * Dedicated loading prefab for the Character panel.
 * Mirrors the live compact editor shell without affecting settled-state behavior.
 */
export function CharacterProfileLoadingSkeleton({ surface }: CharacterProfileLoadingSkeletonProps) {
  const registerShimmerRef = useShimmerAnimation();
  const shellRef = React.useRef<HTMLDivElement | null>(null);
  const [measuredWidthPx, setMeasuredWidthPx] = React.useState(surface === "page" ? 760 : 640);

  React.useEffect(() => {
    const node = shellRef.current;
    if (!node || typeof ResizeObserver !== "function") return;

    const syncWidth = () => {
      const nextWidth = Math.round(node.clientWidth || node.getBoundingClientRect().width || 0);
      if (nextWidth <= 0) return;
      setMeasuredWidthPx((current) => (current === nextWidth ? current : nextWidth));
    };

    const observer = new ResizeObserver(syncWidth);
    observer.observe(node);
    syncWidth();

    return () => {
      observer.disconnect();
    };
  }, []);

  const responsiveLayout = React.useMemo(
    () =>
      resolveCharacterPanelResponsiveLayout({
        panelWidthPx: measuredWidthPx,
      }),
    [measuredWidthPx]
  );

  const actionButtonHeightPx = 38;
  const descriptionHeightPx = responsiveLayout.descriptionHeightPx;
  const tabHeightPx = responsiveLayout.looksTabHeightPx;
  const looksTabWidthPx = responsiveLayout.looksTabMinWidthPx;
  const looksRailHeightPx = Math.max(responsiveLayout.looksRailMinHeightPx, tabHeightPx + 8);
  const referenceHintHeightPx = responsiveLayout.referenceHintMinHeightPx;
  const referenceCardMaxWidthPx = responsiveLayout.referenceCardMaxWidthPx;

  return (
    <div ref={shellRef} role="status" aria-live="polite" style={SHELL_STYLE}>
      <svg aria-hidden="true" viewBox="0 0 40 40" style={SPINNER_SVG_STYLE}>
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          stroke="rgba(110, 214, 233, 0.18)"
          strokeWidth="2"
        />
        <path
          d="M20 4 A16 16 0 0 1 36 20"
          fill="none"
          stroke="rgba(110, 214, 233, 0.92)"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            from="0 20 20"
            to="360 20 20"
            dur="0.84s"
            repeatCount="indefinite"
          />
        </path>
        <path
          d="M20 4 A16 16 0 0 1 31.314 8.686"
          fill="none"
          stroke="rgba(37, 204, 255, 0.62)"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            from="0 20 20"
            to="360 20 20"
            dur="0.84s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
      <p style={TITLE_STYLE}>Loading character profile...</p>
      <p style={COPY_STYLE}>Pulling your character sheet and references into view.</p>

      <div style={SECTION_STYLE}>
        <div data-skeleton-row="actions" style={ACTION_ROW_STYLE}>
          <div style={ACTION_PRIMARY_STYLE}>
            <SkeletonSurface
              data-skeleton-button="characters"
              registerShimmerRef={registerShimmerRef}
              style={buildSkeletonButtonStyle(134, actionButtonHeightPx, 11)}
            />
          </div>
          <div style={ACTION_SECONDARY_STYLE}>
            <SkeletonSurface
              data-skeleton-button="save"
              registerShimmerRef={registerShimmerRef}
              style={buildSkeletonButtonStyle(38, actionButtonHeightPx, 12)}
            />
            <SkeletonSurface
              data-skeleton-button="create"
              registerShimmerRef={registerShimmerRef}
              style={buildSkeletonButtonStyle(86, actionButtonHeightPx, 12)}
            />
          </div>
        </div>

        <SkeletonSurface
          data-skeleton-surface="editor"
          registerShimmerRef={registerShimmerRef}
          style={{
            ...EDITOR_WRAPPER_STYLE,
            gap: `${responsiveLayout.editorWrapperGapPx}px`,
            padding: `${Math.max(8, responsiveLayout.editorWrapperPaddingTopPx - 2)}px ${responsiveLayout.editorWrapperPaddingXpx}px ${responsiveLayout.editorWrapperPaddingBottomPx}px`,
          }}
        >
          <div
            data-skeleton-row="profile"
            style={{
              ...INPUT_ROW_STYLE,
              columnGap: `${responsiveLayout.topFieldsColumnGapPx}px`,
              rowGap: `${responsiveLayout.topFieldsRowGapPx}px`,
            }}
          >
            <div style={FIELD_GROUP_STYLE}>
              <span style={{ ...LINE_STYLE, width: "58px", height: "10px" }} />
              <SkeletonSurface
                data-skeleton-field="name"
                registerShimmerRef={registerShimmerRef}
                style={buildInputStyle(responsiveLayout.nameInputHeightPx)}
              />
            </div>

            <div data-skeleton-section="looks" style={FIELD_GROUP_STYLE}>
              <div style={LOOKS_HEADER_STYLE}>
                <span style={{ ...LINE_STYLE, width: "52px", height: "10px" }} />
                <div style={LOOKS_OVERFLOW_ACTIONS_STYLE}>
                  <SkeletonSurface
                    data-skeleton-looks-control="left"
                    registerShimmerRef={registerShimmerRef}
                    style={SMALL_ACTION_STYLE}
                  />
                  <SkeletonSurface
                    data-skeleton-looks-control="right"
                    registerShimmerRef={registerShimmerRef}
                    style={SMALL_ACTION_STYLE}
                  />
                </div>
              </div>

              <SkeletonSurface
                data-skeleton-looks-rail="true"
                registerShimmerRef={registerShimmerRef}
                style={buildLooksRailStyle(looksRailHeightPx)}
              >
                <div
                  data-skeleton-looks-tabs="true"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(4, ${looksTabWidthPx}px) 26px`,
                    gap: "8px",
                    alignItems: "end",
                    width: "fit-content",
                  }}
                >
                  <span style={buildLooksTabStyle(looksTabWidthPx, tabHeightPx, true)} />
                  <span style={buildLooksTabStyle(looksTabWidthPx, tabHeightPx)} />
                  <span style={buildLooksTabStyle(looksTabWidthPx, tabHeightPx)} />
                  <span style={buildLooksTabStyle(looksTabWidthPx, tabHeightPx)} />
                  <span
                    style={{
                      display: "block",
                      width: "26px",
                      minWidth: "26px",
                      height: `${tabHeightPx}px`,
                      minHeight: `${tabHeightPx}px`,
                      borderRadius: "10px 10px 0 0",
                      background: "rgba(21, 22, 26, 0.92)",
                    }}
                  />
                </div>
              </SkeletonSurface>
            </div>
          </div>

          <div
            data-skeleton-row="preset-content"
            style={{
              ...PRESET_GRID_STYLE,
              columnGap: `${responsiveLayout.presetContentColumnGapPx}px`,
              rowGap: `${responsiveLayout.presetContentRowGapPx}px`,
            }}
          >
            <div data-skeleton-section="description" style={DESCRIPTION_COLUMN_STYLE}>
              <div style={buildDescriptionCardStyle()}>
                <span style={{ ...LINE_STYLE, width: "82px", height: "10px" }} />
                <SkeletonSurface
                  data-skeleton-description-box="true"
                  registerShimmerRef={registerShimmerRef}
                  style={buildDescriptionBoxStyle(descriptionHeightPx)}
                />
                <span style={{ ...LINE_STYLE, width: "148px", height: "8px", opacity: 0.7 }} />
              </div>
            </div>

            <div data-skeleton-section="references" style={REFERENCES_COLUMN_STYLE}>
              <span style={{ ...LINE_STYLE, width: "132px", height: "10px" }} />
              <div
                data-skeleton-reference-grid="true"
                style={{
                  ...REFERENCE_GRID_STYLE,
                  gap: `${responsiveLayout.referenceGridGapPx}px`,
                }}
              >
                {REFERENCE_SLOT_LABELS.map((label) => (
                  <div
                    key={label}
                    data-skeleton-reference-card="true"
                    style={buildReferenceCardStyle(referenceCardMaxWidthPx, referenceHintHeightPx)}
                  >
                    <div
                      style={{
                        ...REFERENCE_MEDIA_STYLE,
                        padding: `${responsiveLayout.referenceMediaPaddingTopPx}px ${responsiveLayout.referenceMediaPaddingXpx}px ${responsiveLayout.referenceMediaPaddingBottomPx}px`,
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          width: "70%",
                          height: "68%",
                          borderRadius: "10px",
                          background:
                            "linear-gradient(145deg, rgba(201, 205, 214, 0.12), rgba(201, 205, 214, 0.04))",
                          border: "1px solid rgba(201, 205, 214, 0.12)",
                        }}
                      />
                    </div>
                    <div
                      style={{ ...REFERENCE_HINT_STYLE, minHeight: `${referenceHintHeightPx}px` }}
                    >
                      <span
                        style={{
                          ...LINE_STYLE,
                          width:
                            label === "Portrait" ? "54px" : label === "Close Up" ? "58px" : "68px",
                          height: "8px",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SkeletonSurface>
      </div>
    </div>
  );
}
