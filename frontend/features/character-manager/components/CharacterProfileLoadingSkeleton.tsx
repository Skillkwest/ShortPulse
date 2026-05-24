import React from "react";

type CharacterProfileLoadingSkeletonProps = {
  surface: "page" | "panel";
};

const LOADING_TEXT_COLOR = "rgba(201, 205, 214, 0.5)";
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

const WORKSPACE_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  alignItems: "stretch",
  gap: "14px",
  width: "100%",
};

const CARD_BASE_STYLE: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  border: "1px solid rgba(37, 204, 255, 0.32)",
  background: "rgba(28, 32, 37, 0.9)",
  boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.02), 0 6px 14px rgba(0, 0, 0, 0.18)",
  borderRadius: "14px",
  padding: "12px",
  width: "100%",
  boxSizing: "border-box",
};

const SHIMMER_OVERLAY_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "linear-gradient(106deg, rgba(255, 255, 255, 0) 14%, rgba(110, 214, 233, 0.05) 42%, rgba(201, 214, 230, 0.12) 56%, rgba(255, 255, 255, 0) 78%)",
  transform: "translateX(-130%)",
  pointerEvents: "none",
};

const HEADING_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "8px",
  marginBottom: "12px",
};

const LINE_STYLE: React.CSSProperties = {
  display: "block",
  borderRadius: "999px",
  background: "linear-gradient(90deg, rgba(201, 205, 214, 0.22), rgba(201, 205, 214, 0.1))",
};

const TITLE_LINE_STYLE: React.CSSProperties = {
  ...LINE_STYLE,
  width: "min(210px, 70%)",
  height: "16px",
};

const SUBTITLE_LINE_STYLE: React.CSSProperties = {
  ...LINE_STYLE,
  width: "min(380px, 90%)",
  height: "10px",
};

const LIBRARY_LIST_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const LIBRARY_ITEM_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "48px minmax(0, 1fr)",
  alignItems: "center",
  gap: "10px",
  minHeight: "72px",
  borderRadius: "12px",
  border: "1px solid rgba(37, 204, 255, 0.18)",
  background: "rgba(201, 205, 214, 0.05)",
  padding: "10px 12px",
};

const LIBRARY_AVATAR_STYLE: React.CSSProperties = {
  display: "block",
  width: "48px",
  height: "48px",
  borderRadius: "999px",
  border: "1px solid rgba(201, 205, 214, 0.28)",
  background: "linear-gradient(145deg, rgba(201, 205, 214, 0.16), rgba(201, 205, 214, 0.06))",
};

const LIBRARY_COPY_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const PROFILE_ROW_BASE_STYLE: React.CSSProperties = {
  display: "grid",
  alignItems: "center",
  gap: "12px",
  marginBottom: "12px",
};

const PROFILE_AVATAR_BASE_STYLE: React.CSSProperties = {
  display: "block",
  borderRadius: "999px",
  border: "1px solid rgba(201, 205, 214, 0.28)",
  background: "linear-gradient(145deg, rgba(201, 205, 214, 0.16), rgba(201, 205, 214, 0.06))",
};

const PROFILE_NAME_STYLE: React.CSSProperties = {
  display: "block",
  width: "min(420px, 92%)",
  height: "42px",
  borderRadius: "11px",
  border: "1px solid rgba(37, 204, 255, 0.32)",
  background: "rgba(201, 205, 214, 0.07)",
};

const TAB_ROW_STYLE: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "8px",
  marginBottom: "12px",
};

const TAB_STYLE: React.CSSProperties = {
  display: "block",
  minHeight: "40px",
  borderRadius: "11px",
  border: "1px solid rgba(37, 204, 255, 0.32)",
  background: "rgba(201, 205, 214, 0.07)",
};

const TAB_SHORT_STYLE: React.CSSProperties = {
  ...TAB_STYLE,
  maxWidth: "64px",
};

const DESCRIPTION_BLOCK_STYLE: React.CSSProperties = {
  display: "block",
  width: "100%",
  minHeight: "104px",
  borderRadius: "12px",
  border: "1px solid rgba(37, 204, 255, 0.32)",
  background: "rgba(201, 205, 214, 0.07)",
  marginBottom: "12px",
};

const buildReferencesGridStyle = (surface: "page" | "panel"): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns:
    surface === "panel" ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))",
  gap: "8px",
});

const REFERENCE_STYLE: React.CSSProperties = {
  display: "block",
  width: "100%",
  aspectRatio: "4 / 5",
  borderRadius: "12px",
  border: "1px solid rgba(37, 204, 255, 0.32)",
  background: "rgba(201, 205, 214, 0.07)",
};

function useShimmerAnimation() {
  const shimmerRefs = React.useRef<HTMLDivElement[]>([]);

  const registerShimmerRef = React.useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    shimmerRefs.current.push(node);
  }, []);

  React.useEffect(() => {
    const animations = shimmerRefs.current.map((node) =>
      node.animate(SHIMMER_KEYFRAMES, {
        duration: 1350,
        iterations: Number.POSITIVE_INFINITY,
        easing: "ease-in-out",
      })
    );

    return () => {
      animations.forEach((animation) => animation.cancel());
      shimmerRefs.current = [];
    };
  }, []);

  return registerShimmerRef;
}

function LoadingCard({
  children,
  layoutRegion,
  registerShimmerRef,
}: {
  children: React.ReactNode;
  layoutRegion: "library" | "sheet";
  registerShimmerRef: (node: HTMLDivElement | null) => void;
}) {
  return (
    <section data-layout-region={layoutRegion} aria-hidden="true" style={CARD_BASE_STYLE}>
      <div ref={registerShimmerRef} style={SHIMMER_OVERLAY_STYLE} />
      {children}
    </section>
  );
}

/**
 * Dedicated loading prefab for the Character Profile view.
 * Keeps loading-state layout isolated from the live Character library and profile workspace.
 */
export function CharacterProfileLoadingSkeleton({ surface }: CharacterProfileLoadingSkeletonProps) {
  const registerShimmerRef = useShimmerAnimation();

  const profileRowStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...PROFILE_ROW_BASE_STYLE,
      gridTemplateColumns: surface === "panel" ? "150px minmax(0, 1fr)" : "78px minmax(0, 1fr)",
    }),
    [surface]
  );

  const profileAvatarStyle = React.useMemo<React.CSSProperties>(
    () => ({
      ...PROFILE_AVATAR_BASE_STYLE,
      width: surface === "panel" ? "150px" : "78px",
      height: surface === "panel" ? "150px" : "78px",
    }),
    [surface]
  );

  return (
    <div role="status" aria-live="polite" style={SHELL_STYLE}>
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

      <div style={WORKSPACE_STYLE}>
        <LoadingCard layoutRegion="library" registerShimmerRef={registerShimmerRef}>
          <div style={HEADING_STYLE}>
            <span style={TITLE_LINE_STYLE} />
            <span style={SUBTITLE_LINE_STYLE} />
          </div>

          <div style={LIBRARY_LIST_STYLE}>
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={`character-profile-loading-library-item-${index + 1}`}
                style={LIBRARY_ITEM_STYLE}
              >
                <span style={LIBRARY_AVATAR_STYLE} />
                <div style={LIBRARY_COPY_STYLE}>
                  <span style={SUBTITLE_LINE_STYLE} />
                  <span style={TITLE_LINE_STYLE} />
                </div>
              </div>
            ))}
          </div>
        </LoadingCard>

        <LoadingCard layoutRegion="sheet" registerShimmerRef={registerShimmerRef}>
          <div style={HEADING_STYLE}>
            <span style={TITLE_LINE_STYLE} />
            <span style={SUBTITLE_LINE_STYLE} />
          </div>

          <div style={profileRowStyle}>
            <span style={profileAvatarStyle} />
            <span style={PROFILE_NAME_STYLE} />
          </div>

          <div style={TAB_ROW_STYLE}>
            <span style={TAB_STYLE} />
            <span style={TAB_STYLE} />
            <span style={TAB_SHORT_STYLE} />
          </div>

          <span style={DESCRIPTION_BLOCK_STYLE} />

          <div style={buildReferencesGridStyle(surface)}>
            {Array.from({ length: 4 }, (_, index) => (
              <span
                key={`character-profile-loading-reference-${index + 1}`}
                style={REFERENCE_STYLE}
              />
            ))}
          </div>
        </LoadingCard>
      </div>
    </div>
  );
}
