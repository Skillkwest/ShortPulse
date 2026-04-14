/**
 * Reference Grid header measurement controller.
 * Owns ResizeObserver wiring for split-header heights so the grid component only consumes measured values.
 */
import { useEffect, useState, type MutableRefObject } from "react";

type UseReferenceGridHeaderMeasurementsParams = {
  isCuratedSplitActive: boolean;
  stylesSplitEnabled: boolean;
  isStylesPanelOpen: boolean;
  curatedHeaderRef: MutableRefObject<HTMLDivElement | null>;
  allRefsHeaderRef: MutableRefObject<HTMLDivElement | null>;
  stylesHeaderRef: MutableRefObject<HTMLDivElement | null>;
};

const MIN_HEADER_HEIGHT_PX = 24;

const useObservedHeaderHeight = ({
  enabled,
  ref,
}: {
  enabled: boolean;
  ref: MutableRefObject<HTMLDivElement | null>;
}) => {
  const [heightPx, setHeightPx] = useState(MIN_HEADER_HEIGHT_PX);

  useEffect(() => {
    if (!enabled) return;

    const updateHeight = () => {
      const node = ref.current;
      if (!node) return;
      const nextHeight = Math.max(MIN_HEADER_HEIGHT_PX, Math.round(node.offsetHeight));
      setHeightPx((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    updateHeight();
    if (typeof ResizeObserver === "undefined") return;
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, ref]);

  return heightPx;
};

/**
 * Returns the measured header heights used by Reference Grid split layouts.
 */
export const useReferenceGridHeaderMeasurements = ({
  isCuratedSplitActive,
  stylesSplitEnabled,
  isStylesPanelOpen,
  curatedHeaderRef,
  allRefsHeaderRef,
  stylesHeaderRef,
}: UseReferenceGridHeaderMeasurementsParams) => {
  const curatedHeaderHeightPx = useObservedHeaderHeight({
    enabled: isCuratedSplitActive,
    ref: curatedHeaderRef,
  });
  const allRefsHeaderHeightPx = useObservedHeaderHeight({
    enabled: stylesSplitEnabled,
    ref: allRefsHeaderRef,
  });
  const stylesHeaderHeightPx = useObservedHeaderHeight({
    enabled: isStylesPanelOpen,
    ref: stylesHeaderRef,
  });

  return {
    curatedHeaderHeightPx,
    allRefsHeaderHeightPx,
    stylesHeaderHeightPx,
  };
};
