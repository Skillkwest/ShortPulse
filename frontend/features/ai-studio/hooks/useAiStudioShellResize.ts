/**
 * AI Studio shell resize hook.
 * Owns drag + keyboard resizing for the properties/reference split layout, including persistence.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AI_SHELL_DIVIDER_TRACK_PX,
  AI_SHELL_LEFT_WIDTH_STORAGE_KEY,
  AI_SHELL_RIGHT_COMPACT_MIN_PX,
  AI_SHELL_RIGHT_MIN_PX,
  clampAiShellLeftWidth,
  getAiShellLeftWidthBounds,
  getDefaultAiShellLeftWidth,
  isAiShellResizeViewport,
  parseStoredAiShellLeftWidth,
  resolveAiShellLayoutMode,
} from "../logic/shellResize";

type UseAiStudioShellResizeArgs = {
  enabled: boolean;
  minLeftWidthPx?: number;
  maxLeftWidthPx?: number;
  minRightWidthPx?: number;
  defaultLeftRatio?: number;
  minWidthResetKey?: string | null;
  allowLeftCollapse?: boolean;
};

type DragSession = {
  pointerId: number;
  startClientX: number;
  startLeftWidth: number;
  containerWidth: number;
};

const AI_SHELL_RESIZE_STEP_PX = 16;
const AI_SHELL_RESIZE_FAST_STEP_PX = 48;
const AI_SHELL_RESIZE_BODY_CLASS = "ai-shell-resizing";
const AI_SHELL_RIGHT_COLUMN_FADE_START_PX = 310;
const AI_SHELL_RIGHT_COLUMN_FADE_END_PX = 290;
const AI_SHELL_LEFT_COLUMN_FADE_START_RATIO = 0.38;
const AI_SHELL_LEFT_COLUMN_FADE_END_RATIO = 0.24;

/**
 * Returns state and handlers for a resizable AI Studio shell divider.
 * Inputs: feature-enable flag (only active when the properties panel exists).
 * Output: refs, style/class hooks, and divider interaction props.
 */
export const useAiStudioShellResize = ({
  enabled,
  minLeftWidthPx,
  maxLeftWidthPx,
  minRightWidthPx,
  defaultLeftRatio,
  minWidthResetKey = null,
  allowLeftCollapse = false,
}: UseAiStudioShellResizeArgs) => {
  const shellRef = useRef<HTMLElement | null>(null);
  const leftColumnRef = useRef<HTMLElement | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const detachPointerListenersRef = useRef<(() => void) | null>(null);
  const storedWidthRef = useRef<number | null>(null);
  const appliedMinWidthResetKeyRef = useRef<string | null>(null);

  const [leftWidthPx, setLeftWidthPx] = useState<number | null>(null);
  const [containerWidthPx, setContainerWidthPx] = useState(0);
  const [isResizableViewportState, setIsResizableViewportState] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const resolveContainerWidth = useCallback((): number => {
    const shellNode = shellRef.current;
    if (!shellNode) return 0;
    const shellRect = shellNode.getBoundingClientRect();
    const widthCandidates = [shellRect.width].filter(
      (width) => Number.isFinite(width) && width > 0
    );
    const parentNode = shellNode.parentElement;
    if (parentNode) {
      const parentRect = parentNode.getBoundingClientRect();
      if (Number.isFinite(parentNode.clientWidth) && parentNode.clientWidth > 0) {
        widthCandidates.push(parentNode.clientWidth);
      }
      if (Number.isFinite(parentRect.width) && parentRect.width > 0) {
        widthCandidates.push(parentRect.width);
      }
    }
    if (typeof window !== "undefined" && Number.isFinite(window.innerWidth)) {
      const visibleViewportWidth = Math.max(0, window.innerWidth - Math.max(0, shellRect.left));
      if (visibleViewportWidth > 0) {
        widthCandidates.push(visibleViewportWidth);
      }
    }
    return Math.floor(Math.max(0, Math.min(...widthCandidates)));
  }, []);

  const stopResizing = useCallback(() => {
    if (detachPointerListenersRef.current) {
      detachPointerListenersRef.current();
      detachPointerListenersRef.current = null;
    }
    dragSessionRef.current = null;
    setIsResizing(false);
    if (typeof document !== "undefined") {
      document.body.classList.remove(AI_SHELL_RESIZE_BODY_CLASS);
    }
  }, []);

  useEffect(() => stopResizing, [stopResizing]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    storedWidthRef.current = parseStoredAiShellLeftWidth(
      window.localStorage.getItem(AI_SHELL_LEFT_WIDTH_STORAGE_KEY)
    );
  }, [enabled]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const syncViewportMode = () =>
      setIsResizableViewportState(isAiShellResizeViewport(window.innerWidth));
    syncViewportMode();
    window.addEventListener("resize", syncViewportMode);
    return () => window.removeEventListener("resize", syncViewportMode);
  }, [enabled]);

  const isResizableViewport = enabled && isResizableViewportState;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!enabled) return;
    const syncWidthToContainer = () => {
      const containerWidth = resolveContainerWidth();
      if (!containerWidth) return;
      const roundedContainerWidth = Math.round(containerWidth);
      setContainerWidthPx((prev) =>
        prev === roundedContainerWidth ? prev : roundedContainerWidth
      );
      setLeftWidthPx((prev) => {
        const candidate =
          prev ??
          storedWidthRef.current ??
          getDefaultAiShellLeftWidth(containerWidth, {
            minLeftWidthPx,
            maxLeftWidthPx,
            minRightWidthPx,
            preferredRatio: defaultLeftRatio,
          });
        const next = clampAiShellLeftWidth(candidate, containerWidth, {
          minLeftWidthPx,
          maxLeftWidthPx,
          minRightWidthPx,
          allowLeftCollapse,
        });
        return prev === next ? prev : next;
      });
    };
    syncWidthToContainer();
  }, [
    allowLeftCollapse,
    defaultLeftRatio,
    enabled,
    maxLeftWidthPx,
    minLeftWidthPx,
    minRightWidthPx,
    resolveContainerWidth,
  ]);

  const syncWidthToContainer = useCallback(() => {
    const containerWidth = resolveContainerWidth();
    if (!containerWidth) return;
    const roundedContainerWidth = Math.round(containerWidth);
    setContainerWidthPx((prev) => (prev === roundedContainerWidth ? prev : roundedContainerWidth));
    setLeftWidthPx((prev) => {
      const candidate =
        prev ??
        storedWidthRef.current ??
        getDefaultAiShellLeftWidth(containerWidth, {
          minLeftWidthPx,
          maxLeftWidthPx,
          minRightWidthPx,
          preferredRatio: defaultLeftRatio,
        });
      const next = clampAiShellLeftWidth(candidate, containerWidth, {
        minLeftWidthPx,
        maxLeftWidthPx,
        minRightWidthPx,
        allowLeftCollapse,
      });
      return prev === next ? prev : next;
    });
  }, [
    allowLeftCollapse,
    defaultLeftRatio,
    maxLeftWidthPx,
    minLeftWidthPx,
    minRightWidthPx,
    resolveContainerWidth,
  ]);

  const getLeftColumnFadeThresholds = useCallback(
    (containerWidth: number) => {
      const visibleBounds = getAiShellLeftWidthBounds(containerWidth, {
        minLeftWidthPx,
        maxLeftWidthPx,
        minRightWidthPx,
      });
      const visibleMinWidth = Math.max(0, visibleBounds.min);
      return {
        fadeStartPx: Math.max(
          160,
          Math.round(visibleMinWidth * AI_SHELL_LEFT_COLUMN_FADE_START_RATIO)
        ),
        fadeEndPx: Math.max(96, Math.round(visibleMinWidth * AI_SHELL_LEFT_COLUMN_FADE_END_RATIO)),
      };
    },
    [maxLeftWidthPx, minLeftWidthPx, minRightWidthPx]
  );

  useEffect(() => {
    if (!enabled || !isResizableViewport) return stopResizing;
    const frameId =
      typeof window === "undefined"
        ? null
        : window.requestAnimationFrame(() => {
            syncWidthToContainer();
          });
    if (typeof ResizeObserver === "undefined") {
      return () => {
        if (frameId != null && typeof window !== "undefined") {
          window.cancelAnimationFrame(frameId);
        }
      };
    }
    const shellNode = shellRef.current;
    if (!shellNode) {
      return () => {
        if (frameId != null && typeof window !== "undefined") {
          window.cancelAnimationFrame(frameId);
        }
      };
    }
    const resizeObserver = new ResizeObserver(() => {
      syncWidthToContainer();
    });
    resizeObserver.observe(shellNode);
    return () => {
      if (frameId != null && typeof window !== "undefined") {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
    };
  }, [enabled, isResizableViewport, stopResizing, syncWidthToContainer]);

  useEffect(() => {
    if (!enabled || isResizing || typeof window === "undefined" || leftWidthPx == null) return;
    window.localStorage.setItem(AI_SHELL_LEFT_WIDTH_STORAGE_KEY, String(leftWidthPx));
  }, [enabled, isResizing, leftWidthPx]);

  useEffect(() => {
    if (minWidthResetKey == null) {
      appliedMinWidthResetKeyRef.current = null;
      return;
    }
    if (!enabled || !isResizableViewport) return;
    if (appliedMinWidthResetKeyRef.current === minWidthResetKey) return;
    if (typeof window === "undefined") return;
    const frameId = window.requestAnimationFrame(() => {
      const containerWidth = resolveContainerWidth();
      if (!containerWidth) return;
      const bounds = getAiShellLeftWidthBounds(containerWidth, {
        minLeftWidthPx,
        maxLeftWidthPx,
        minRightWidthPx,
      });
      setLeftWidthPx((prev) => (prev === bounds.min ? prev : bounds.min));
      setContainerWidthPx(Math.round(containerWidth));
      appliedMinWidthResetKeyRef.current = minWidthResetKey;
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    enabled,
    isResizableViewport,
    maxLeftWidthPx,
    minLeftWidthPx,
    minRightWidthPx,
    minWidthResetKey,
    resolveContainerWidth,
  ]);

  const handleWindowPointerMove = useCallback(
    (event: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - session.startClientX;
      const nextWidth = clampAiShellLeftWidth(
        session.startLeftWidth + deltaX,
        session.containerWidth,
        { minLeftWidthPx, maxLeftWidthPx, minRightWidthPx, allowLeftCollapse }
      );
      setLeftWidthPx((prev) => (prev === nextWidth ? prev : nextWidth));
    },
    [allowLeftCollapse, maxLeftWidthPx, minLeftWidthPx, minRightWidthPx]
  );

  const beginPointerResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!enabled || !isResizableViewport || event.button !== 0) return;
      const containerWidth = resolveContainerWidth();
      if (!containerWidth) return;

      const activeLeftWidth =
        leftColumnRef.current?.getBoundingClientRect().width ??
        leftWidthPx ??
        getDefaultAiShellLeftWidth(containerWidth, {
          minLeftWidthPx,
          maxLeftWidthPx,
          minRightWidthPx,
          preferredRatio: defaultLeftRatio,
        });
      const clampedStartWidth = clampAiShellLeftWidth(activeLeftWidth, containerWidth, {
        minLeftWidthPx,
        maxLeftWidthPx,
        minRightWidthPx,
        allowLeftCollapse,
      });
      const clampedWidthWithMin = clampAiShellLeftWidth(clampedStartWidth, containerWidth, {
        minLeftWidthPx,
        maxLeftWidthPx,
        minRightWidthPx,
        allowLeftCollapse,
      });
      setLeftWidthPx((prev) => (prev === clampedWidthWithMin ? prev : clampedWidthWithMin));
      setContainerWidthPx(Math.round(containerWidth));
      setIsResizing(true);
      if (typeof document !== "undefined") {
        document.body.classList.add(AI_SHELL_RESIZE_BODY_CLASS);
      }
      dragSessionRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startLeftWidth: clampedWidthWithMin,
        containerWidth,
      };

      const handlePointerStop = (nativeEvent: PointerEvent) => {
        const session = dragSessionRef.current;
        if (!session || session.pointerId !== nativeEvent.pointerId) return;
        if (allowLeftCollapse) {
          const deltaX = nativeEvent.clientX - session.startClientX;
          const releaseWidth = clampAiShellLeftWidth(
            session.startLeftWidth + deltaX,
            session.containerWidth,
            { minLeftWidthPx, maxLeftWidthPx, minRightWidthPx, allowLeftCollapse }
          );
          const { fadeEndPx } = getLeftColumnFadeThresholds(session.containerWidth);
          if (releaseWidth <= fadeEndPx) {
            setLeftWidthPx(0);
          }
        }
        stopResizing();
      };

      window.addEventListener("pointermove", handleWindowPointerMove);
      window.addEventListener("pointerup", handlePointerStop);
      window.addEventListener("pointercancel", handlePointerStop);
      detachPointerListenersRef.current = () => {
        window.removeEventListener("pointermove", handleWindowPointerMove);
        window.removeEventListener("pointerup", handlePointerStop);
        window.removeEventListener("pointercancel", handlePointerStop);
      };

      event.preventDefault();
    },
    [
      enabled,
      handleWindowPointerMove,
      isResizableViewport,
      leftWidthPx,
      maxLeftWidthPx,
      minLeftWidthPx,
      minRightWidthPx,
      defaultLeftRatio,
      allowLeftCollapse,
      getLeftColumnFadeThresholds,
      resolveContainerWidth,
      stopResizing,
    ]
  );

  const handleDividerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (!enabled || !isResizableViewport) return;
      const containerWidth = resolveContainerWidth();
      if (!containerWidth) return;
      const step = event.shiftKey ? AI_SHELL_RESIZE_FAST_STEP_PX : AI_SHELL_RESIZE_STEP_PX;
      const bounds = getAiShellLeftWidthBounds(containerWidth, {
        minLeftWidthPx,
        maxLeftWidthPx,
        minRightWidthPx,
        allowLeftCollapse,
      });
      const activeLeftWidth =
        leftWidthPx ??
        leftColumnRef.current?.getBoundingClientRect().width ??
        getDefaultAiShellLeftWidth(containerWidth, {
          minLeftWidthPx,
          maxLeftWidthPx,
          minRightWidthPx,
          preferredRatio: defaultLeftRatio,
        });

      if (event.key === "Home") {
        event.preventDefault();
        setLeftWidthPx(bounds.min);
        setContainerWidthPx(Math.round(containerWidth));
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        setLeftWidthPx(bounds.max);
        setContainerWidthPx(Math.round(containerWidth));
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      if (allowLeftCollapse && activeLeftWidth <= 0 && direction > 0) {
        const visibleBounds = getAiShellLeftWidthBounds(containerWidth, {
          minLeftWidthPx,
          maxLeftWidthPx,
          minRightWidthPx,
        });
        setLeftWidthPx((prev) => (prev === visibleBounds.min ? prev : visibleBounds.min));
        setContainerWidthPx(Math.round(containerWidth));
        return;
      }
      const nextWidth = clampAiShellLeftWidth(activeLeftWidth + direction * step, containerWidth, {
        minLeftWidthPx,
        maxLeftWidthPx,
        minRightWidthPx,
        allowLeftCollapse,
      });
      const { fadeEndPx } = getLeftColumnFadeThresholds(containerWidth);
      const resolvedNextWidth = allowLeftCollapse && nextWidth <= fadeEndPx ? 0 : nextWidth;
      setLeftWidthPx((prev) => (prev === resolvedNextWidth ? prev : resolvedNextWidth));
      setContainerWidthPx(Math.round(containerWidth));
    },
    [
      allowLeftCollapse,
      enabled,
      getLeftColumnFadeThresholds,
      isResizableViewport,
      leftWidthPx,
      maxLeftWidthPx,
      minLeftWidthPx,
      minRightWidthPx,
      defaultLeftRatio,
      resolveContainerWidth,
    ]
  );

  const handleDividerDoubleClick = useCallback(() => {
    if (!enabled || !isResizableViewport) return;
    const containerWidth = resolveContainerWidth();
    if (!containerWidth) return;
    const defaultWidth = getDefaultAiShellLeftWidth(containerWidth, {
      minLeftWidthPx,
      maxLeftWidthPx,
      minRightWidthPx,
      preferredRatio: defaultLeftRatio,
    });
    setLeftWidthPx(defaultWidth);
    setContainerWidthPx(Math.round(containerWidth));
  }, [
    enabled,
    isResizableViewport,
    maxLeftWidthPx,
    minLeftWidthPx,
    minRightWidthPx,
    defaultLeftRatio,
    resolveContainerWidth,
  ]);

  const collapseToMin = useCallback(() => {
    if (!enabled || !isResizableViewport) return;
    const containerWidth = resolveContainerWidth();
    if (!containerWidth) return;
    const bounds = getAiShellLeftWidthBounds(containerWidth, {
      minLeftWidthPx,
      maxLeftWidthPx,
      minRightWidthPx,
    });
    setLeftWidthPx((prev) => (prev === bounds.min ? prev : bounds.min));
    setContainerWidthPx(Math.round(containerWidth));
  }, [
    enabled,
    isResizableViewport,
    maxLeftWidthPx,
    minLeftWidthPx,
    minRightWidthPx,
    resolveContainerWidth,
  ]);

  const resetToDefaultWidth = useCallback(() => {
    if (!enabled || !isResizableViewport) return;
    const containerWidth = resolveContainerWidth();
    if (!containerWidth) return;
    const defaultWidth = getDefaultAiShellLeftWidth(containerWidth, {
      minLeftWidthPx,
      maxLeftWidthPx,
      minRightWidthPx,
      preferredRatio: defaultLeftRatio,
    });
    setLeftWidthPx((prev) => (prev === defaultWidth ? prev : defaultWidth));
    setContainerWidthPx(Math.round(containerWidth));
  }, [
    defaultLeftRatio,
    enabled,
    isResizableViewport,
    maxLeftWidthPx,
    minLeftWidthPx,
    minRightWidthPx,
    resolveContainerWidth,
  ]);

  const restoreWidth = useCallback(
    (widthPx: number | null | undefined) => {
      if (!enabled || !isResizableViewport) return;
      const containerWidth = resolveContainerWidth();
      if (!containerWidth) return;
      if (typeof widthPx !== "number" || !Number.isFinite(widthPx)) {
        const defaultWidth = getDefaultAiShellLeftWidth(containerWidth, {
          minLeftWidthPx,
          maxLeftWidthPx,
          minRightWidthPx,
          preferredRatio: defaultLeftRatio,
        });
        setLeftWidthPx((prev) => (prev === defaultWidth ? prev : defaultWidth));
        setContainerWidthPx(Math.round(containerWidth));
        return;
      }
      const nextWidth = clampAiShellLeftWidth(widthPx, containerWidth, {
        minLeftWidthPx,
        maxLeftWidthPx,
        minRightWidthPx,
        allowLeftCollapse,
      });
      setLeftWidthPx((prev) => (prev === nextWidth ? prev : nextWidth));
      setContainerWidthPx(Math.round(containerWidth));
    },
    [
      defaultLeftRatio,
      enabled,
      isResizableViewport,
      maxLeftWidthPx,
      minLeftWidthPx,
      minRightWidthPx,
      allowLeftCollapse,
      resolveContainerWidth,
    ]
  );

  const expandToMax = useCallback(() => {
    if (!enabled || !isResizableViewport) return;
    const containerWidth = resolveContainerWidth();
    if (!containerWidth) return;
    const bounds = getAiShellLeftWidthBounds(containerWidth, {
      minLeftWidthPx,
      maxLeftWidthPx,
      minRightWidthPx,
    });
    setLeftWidthPx((prev) => (prev === bounds.max ? prev : bounds.max));
    setContainerWidthPx(Math.round(containerWidth));
  }, [
    enabled,
    isResizableViewport,
    maxLeftWidthPx,
    minLeftWidthPx,
    minRightWidthPx,
    resolveContainerWidth,
  ]);

  const shellLayoutMode = resolveAiShellLayoutMode(containerWidthPx, {
    enabled,
    isResizableViewport,
    minLeftWidthPx,
    minRightWidthPx,
  });
  const isSplitLayout = shellLayoutMode === "split" || shellLayoutMode === "compact-split";
  const layoutMinRightWidthPx =
    shellLayoutMode === "compact-split" ? AI_SHELL_RIGHT_COMPACT_MIN_PX : minRightWidthPx;
  const hasContainerRoom =
    shellLayoutMode === "split" ||
    (shellLayoutMode === "compact-split" &&
      containerWidthPx >= AI_SHELL_RIGHT_COMPACT_MIN_PX + AI_SHELL_DIVIDER_TRACK_PX + 1);
  const showDivider = enabled && isResizableViewport && isSplitLayout && hasContainerRoom;
  const bounds = getAiShellLeftWidthBounds(Math.max(containerWidthPx, 1), {
    minLeftWidthPx,
    maxLeftWidthPx,
    minRightWidthPx: layoutMinRightWidthPx,
    allowLeftCollapse,
  });
  const ariaNow = clampAiShellLeftWidth(
    leftWidthPx ??
      getDefaultAiShellLeftWidth(Math.max(containerWidthPx, 1), {
        minLeftWidthPx,
        maxLeftWidthPx,
        minRightWidthPx: layoutMinRightWidthPx,
        preferredRatio: defaultLeftRatio,
      }),
    Math.max(containerWidthPx, 1),
    { minLeftWidthPx, maxLeftWidthPx, minRightWidthPx: layoutMinRightWidthPx, allowLeftCollapse }
  );
  const resolvedLeftWidth = clampAiShellLeftWidth(ariaNow, Math.max(containerWidthPx, 1), {
    minLeftWidthPx,
    maxLeftWidthPx,
    minRightWidthPx: layoutMinRightWidthPx,
    allowLeftCollapse,
  });
  const { fadeStartPx: leftFadeStartPx, fadeEndPx: leftFadeEndPx } = getLeftColumnFadeThresholds(
    Math.max(containerWidthPx, 1)
  );
  const leftColumnVisibility =
    !allowLeftCollapse || !isSplitLayout
      ? 1
      : resolvedLeftWidth <= leftFadeEndPx
        ? 0
        : resolvedLeftWidth >= leftFadeStartPx
          ? 1
          : (resolvedLeftWidth - leftFadeEndPx) / (leftFadeStartPx - leftFadeEndPx);
  const leftColumnHidden = leftColumnVisibility <= 0.01;
  const rightColumnWidthPx = Math.max(
    0,
    Math.round(Math.max(containerWidthPx, 0) - resolvedLeftWidth - AI_SHELL_DIVIDER_TRACK_PX)
  );
  const fadeStart = AI_SHELL_RIGHT_COLUMN_FADE_START_PX;
  const fadeEnd = AI_SHELL_RIGHT_COLUMN_FADE_END_PX;
  const rightColumnVisibility =
    shellLayoutMode !== "split"
      ? 1
      : rightColumnWidthPx <= fadeEnd
        ? 0
        : rightColumnWidthPx >= fadeStart
          ? 1
          : (rightColumnWidthPx - fadeEnd) / (fadeStart - fadeEnd);
  const rightColumnHidden = rightColumnVisibility <= 0.01;

  const shellStyle = useMemo<CSSProperties | undefined>(() => {
    if (!showDivider || leftWidthPx == null) return undefined;
    return {
      "--ai-shell-left-width": `${leftWidthPx}px`,
      "--ai-shell-right-min-width": `${Math.max(0, layoutMinRightWidthPx ?? AI_SHELL_RIGHT_MIN_PX)}px`,
      "--ai-shell-left-visibility": `${leftColumnVisibility}`,
      "--ai-shell-right-visibility": `${rightColumnVisibility}`,
    } as CSSProperties;
  }, [
    layoutMinRightWidthPx,
    leftColumnVisibility,
    leftWidthPx,
    rightColumnVisibility,
    showDivider,
  ]);

  const dividerOrientation = "vertical" as const;

  return {
    shellRef,
    leftColumnRef,
    leftWidthPx,
    showDivider,
    isResizing,
    shellStyle,
    shellLayoutMode,
    collapseToMin,
    resetToDefaultWidth,
    restoreWidth,
    expandToMax,
    leftColumnHidden,
    rightColumnHidden,
    dividerProps: {
      role: "separator",
      tabIndex: 0,
      "aria-orientation": dividerOrientation,
      "aria-label": "Resize creative properties and reference grid columns",
      "aria-valuemin": bounds.min,
      "aria-valuemax": bounds.max,
      "aria-valuenow": ariaNow,
      onPointerDown: beginPointerResize,
      onDoubleClick: handleDividerDoubleClick,
      onKeyDown: handleDividerKeyDown,
    },
  };
};
