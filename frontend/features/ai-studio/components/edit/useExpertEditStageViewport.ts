/**
 * Stage viewport and artboard ownership for Expert Edit.
 * Centralizes stage refs, viewport sizing, modal shell sizing, and client-to-surface mapping.
 */
import React from "react";
import { parseAspectRatioToken } from "../../logic/expertEditLayerCrop";
import { clampNumber } from "./expertEditPanelViewContract";
import { resolveContainedLayerRect } from "./expertEditLayerTransformUtils";
import {
  resolveInlineCompositionScenePointFromRefs,
  resolveInlineCompositionSurfacePointFromRefs,
  resolveInlineStageRectFromRefs,
  resolveInteractionViewportOffsetPixelsFromRefs,
} from "./expertEditStageViewportGeometry";
import {
  MARKUP_VIEWPORT_DEFAULT_SCALE,
  createDefaultMarkupViewportState,
  isResolvedStageViewportSize,
  resolveMarkupViewportOffsetPixels,
  resolveMoveStageZoomSliderValue,
  resolveStageViewportSize,
  type StageViewportSize,
} from "./expertEditViewportUtils";
import type { MarkupViewportState } from "./markupStrokeController";
const EDIT_EXPERT_CENTER_COLUMN_MAX_WIDTH_PX = 860;
const EDIT_EXPERT_PRIMARY_SIZE_MIN_PX = 420;
const EDIT_EXPERT_PRIMARY_SIZE_MAX_PX = 540;
const EDIT_EXPERT_PRIMARY_SIZE_VIEWPORT_FACTOR = 0.355;

const resolvePrimaryCanvasNominalHeightPx = () => {
  if (typeof window === "undefined" || !Number.isFinite(window.innerWidth)) {
    return EDIT_EXPERT_PRIMARY_SIZE_MIN_PX;
  }
  return clampNumber(
    window.innerWidth * EDIT_EXPERT_PRIMARY_SIZE_VIEWPORT_FACTOR,
    EDIT_EXPERT_PRIMARY_SIZE_MIN_PX,
    EDIT_EXPERT_PRIMARY_SIZE_MAX_PX
  );
};

type UseExpertEditStageViewportParams = {
  aspect: string;
  hasPrimaryCompositePreview: boolean;
  isMarkupExpandSelected: boolean;
};

/**
 * Returns the canonical stage viewport/artboard state and geometry helpers for Expert Edit.
 */
export const useExpertEditStageViewport = ({
  aspect,
  hasPrimaryCompositePreview,
  isMarkupExpandSelected,
}: UseExpertEditStageViewportParams) => {
  const inlineStageWrapperRef = React.useRef<HTMLDivElement | null>(null);
  const primaryCanvasFrameStackRef = React.useRef<HTMLDivElement | null>(null);
  const primaryCompositionSurfaceRef = React.useRef<HTMLDivElement | null>(null);
  const markupModalRef = React.useRef<HTMLDivElement | null>(null);
  const markupModalControlsRef = React.useRef<HTMLDivElement | null>(null);
  const markupModalStageRef = React.useRef<HTMLDivElement | null>(null);
  const markupModalLayersRef = React.useRef<HTMLDivElement | null>(null);
  const [primaryCanvasFrameStackElement, setPrimaryCanvasFrameStackElement] =
    React.useState<HTMLDivElement | null>(null);
  const [markupModalStageElement, setMarkupModalStageElement] =
    React.useState<HTMLDivElement | null>(null);
  const [markupViewport, setMarkupViewport] = React.useState<MarkupViewportState>(() =>
    createDefaultMarkupViewportState()
  );
  const [inlineStageViewportSize, setInlineStageViewportSize] = React.useState<StageViewportSize>({
    width: 1,
    height: 1,
  });
  const [markupModalStageSize, setMarkupModalStageSize] = React.useState<StageViewportSize | null>(
    null
  );
  const [markupModalViewportSize, setMarkupModalViewportSize] = React.useState<StageViewportSize>({
    width: 1,
    height: 1,
  });
  const [markupModalDomVersion, setMarkupModalDomVersion] = React.useState(0);
  const [moveStageZoomSliderValue, setMoveStageZoomSliderValue] = React.useState(() =>
    resolveMoveStageZoomSliderValue(MARKUP_VIEWPORT_DEFAULT_SCALE)
  );

  const syncMarkupModalTrackedRef = React.useCallback(
    (refObject: React.MutableRefObject<HTMLDivElement | null>, node: HTMLDivElement | null) => {
      if (refObject.current === node) return;
      refObject.current = node;
      setMarkupModalDomVersion((previous) => previous + 1);
    },
    []
  );
  const handleMarkupModalRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      syncMarkupModalTrackedRef(markupModalRef, node);
    },
    [markupModalRef, syncMarkupModalTrackedRef]
  );
  const handlePrimaryCanvasFrameStackRef = React.useCallback((node: HTMLDivElement | null) => {
    primaryCanvasFrameStackRef.current = node;
    setPrimaryCanvasFrameStackElement((previous) => (previous === node ? previous : node));
  }, []);
  const handleMarkupModalControlsRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      syncMarkupModalTrackedRef(markupModalControlsRef, node);
    },
    [markupModalControlsRef, syncMarkupModalTrackedRef]
  );
  const handleMarkupModalStageRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      syncMarkupModalTrackedRef(markupModalStageRef, node);
      setMarkupModalStageElement((previous) => (previous === node ? previous : node));
    },
    [markupModalStageRef, syncMarkupModalTrackedRef]
  );
  const handleMarkupModalLayersRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      syncMarkupModalTrackedRef(markupModalLayersRef, node);
    },
    [markupModalLayersRef, syncMarkupModalTrackedRef]
  );

  const primaryCompositionSurfaceAspectRatio = React.useMemo(() => {
    const parsedAspectRatio = parseAspectRatioToken(aspect);
    if (
      parsedAspectRatio == null ||
      !Number.isFinite(parsedAspectRatio) ||
      parsedAspectRatio <= 0
    ) {
      return "1 / 1";
    }
    return aspect.replace(":", " / ");
  }, [aspect]);
  const primaryCompositionSurfaceAspectRatioValue = React.useMemo(
    () => parseAspectRatioToken(aspect) ?? 1,
    [aspect]
  );

  const resolveInlineStageRect = React.useCallback(
    (currentTarget?: HTMLDivElement | null): DOMRect | null => {
      return resolveInlineStageRectFromRefs({
        inlineStageWrapperRef,
        primaryCompositionSurfaceRef,
        currentTarget,
      });
    },
    [inlineStageWrapperRef, primaryCompositionSurfaceRef]
  );

  const resolveInteractionViewportOffsetPixels = React.useCallback(
    (interactionRect: DOMRect, currentTarget: HTMLDivElement) => {
      return resolveInteractionViewportOffsetPixelsFromRefs({
        refs: {
          inlineStageWrapperRef,
          primaryCompositionSurfaceRef,
          markupModalStageRef,
        },
        hasPrimaryCompositePreview,
        markupModalViewportSize,
        inlineStageViewportSize,
        markupViewport,
        interactionRect,
        currentTarget,
      });
    },
    [
      hasPrimaryCompositePreview,
      inlineStageWrapperRef,
      inlineStageViewportSize,
      markupModalStageRef,
      markupModalViewportSize,
      markupViewport,
      primaryCompositionSurfaceRef,
    ]
  );

  const resolveInlineCompositionSurfacePoint = React.useCallback(
    ({
      clientX,
      clientY,
      clampToBounds,
    }: {
      clientX: number;
      clientY: number;
      clampToBounds: boolean;
    }) =>
      resolveInlineCompositionSurfacePointFromRefs({
        refs: {
          inlineStageWrapperRef,
          primaryCanvasFrameStackRef,
          primaryCompositionSurfaceRef,
        },
        markupViewport,
        clientX,
        clientY,
        clampToBounds,
      }),
    [
      inlineStageWrapperRef,
      markupViewport,
      primaryCanvasFrameStackRef,
      primaryCompositionSurfaceRef,
    ]
  );

  const resolveInlineCompositionScenePoint = React.useCallback(
    ({
      clientX,
      clientY,
      clampToBounds,
    }: {
      clientX: number;
      clientY: number;
      clampToBounds: boolean;
    }) =>
      resolveInlineCompositionScenePointFromRefs({
        refs: {
          inlineStageWrapperRef,
          primaryCanvasFrameStackRef,
          primaryCompositionSurfaceRef,
        },
        markupViewport,
        clientX,
        clientY,
        clampToBounds,
      }),
    [
      inlineStageWrapperRef,
      markupViewport,
      primaryCanvasFrameStackRef,
      primaryCompositionSurfaceRef,
    ]
  );

  const inlineCompositionSurfaceFrameRect = React.useMemo(() => {
    const nominalHeight = resolvePrimaryCanvasNominalHeightPx();
    const availableWidth = isResolvedStageViewportSize(inlineStageViewportSize)
      ? inlineStageViewportSize.width
      : EDIT_EXPERT_CENTER_COLUMN_MAX_WIDTH_PX;
    const availableHeight = isResolvedStageViewportSize(inlineStageViewportSize)
      ? Math.min(inlineStageViewportSize.height, nominalHeight)
      : nominalHeight;
    const containedFrameRect = resolveContainedLayerRect({
      imageAspectRatio: primaryCompositionSurfaceAspectRatioValue,
      viewportWidth: availableWidth,
      viewportHeight: availableHeight,
    });
    return containedFrameRect;
  }, [inlineStageViewportSize, primaryCompositionSurfaceAspectRatioValue]);

  const primaryCanvasFrameBoundsStyle = React.useMemo<React.CSSProperties>(() => {
    return {
      width: `${Math.round(inlineCompositionSurfaceFrameRect.width * 100) / 100}px`,
      height: `${Math.round(inlineCompositionSurfaceFrameRect.height * 100) / 100}px`,
      aspectRatio: primaryCompositionSurfaceAspectRatio,
    };
  }, [
    inlineCompositionSurfaceFrameRect.height,
    inlineCompositionSurfaceFrameRect.width,
    primaryCompositionSurfaceAspectRatio,
  ]);

  const inlineMarkupViewportStyle = React.useMemo<React.CSSProperties>(() => {
    const viewportOffset = resolveMarkupViewportOffsetPixels(
      markupViewport,
      inlineStageViewportSize
    );
    return {
      transform: `translate3d(${Math.round(viewportOffset.offsetX * 100) / 100}px, ${Math.round(viewportOffset.offsetY * 100) / 100}px, 0) scale(${Math.round(markupViewport.scale * 10000) / 10000})`,
      transformOrigin: "center center",
    };
  }, [inlineStageViewportSize, markupViewport]);

  const inlineCompositionSurfaceViewportSize = React.useMemo(
    () => ({
      width: Math.max(1, inlineCompositionSurfaceFrameRect.width),
      height: Math.max(1, inlineCompositionSurfaceFrameRect.height),
    }),
    [inlineCompositionSurfaceFrameRect.height, inlineCompositionSurfaceFrameRect.width]
  );

  const modalMarkupViewportStyle = React.useMemo<React.CSSProperties>(() => {
    const viewportOffset = resolveMarkupViewportOffsetPixels(
      markupViewport,
      markupModalViewportSize
    );
    return {
      transform: `translate3d(${Math.round(viewportOffset.offsetX * 100) / 100}px, ${Math.round(viewportOffset.offsetY * 100) / 100}px, 0) scale(${Math.round(markupViewport.scale * 10000) / 10000})`,
      transformOrigin: "center center",
    };
  }, [markupModalViewportSize, markupViewport]);

  React.useEffect(() => {
    const syncedSliderValue = resolveMoveStageZoomSliderValue(markupViewport.scale);
    setMoveStageZoomSliderValue((previous) =>
      previous === syncedSliderValue ? previous : syncedSliderValue
    );
  }, [markupViewport.scale]);

  React.useEffect(() => {
    if (isMarkupExpandSelected) return;
    const inlineStageElement = inlineStageWrapperRef.current;
    if (!inlineStageElement) return;

    const updateInlineSize = () => {
      const nextViewportSize = resolveStageViewportSize(resolveInlineStageRect(inlineStageElement));
      setInlineStageViewportSize((previous) =>
        previous.width === nextViewportSize.width && previous.height === nextViewportSize.height
          ? previous
          : nextViewportSize
      );
    };

    updateInlineSize();

    if (typeof ResizeObserver === "undefined") {
      if (typeof window === "undefined") return;
      window.addEventListener("resize", updateInlineSize);
      return () => {
        window.removeEventListener("resize", updateInlineSize);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateInlineSize();
    });
    resizeObserver.observe(inlineStageElement);
    return () => {
      resizeObserver.disconnect();
    };
  }, [aspect, isMarkupExpandSelected, resolveInlineStageRect]);

  React.useEffect(() => {
    if (!isMarkupExpandSelected) {
      setMarkupModalStageSize(null);
      return;
    }
    const markupModalElement = markupModalRef.current;
    if (!markupModalElement) return;

    const updateStageSize = () => {
      const modalRect = markupModalElement.getBoundingClientRect();
      const controlsRect = markupModalControlsRef.current?.getBoundingClientRect();
      const layersRect = markupModalLayersRef.current?.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(markupModalElement);
      const horizontalGapRaw = Number.parseFloat(computedStyle.columnGap || computedStyle.gap);
      const horizontalGap = Number.isFinite(horizontalGapRaw) ? horizontalGapRaw : 0;
      const paddingLeft = Number.parseFloat(computedStyle.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(computedStyle.paddingRight) || 0;
      const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0;
      const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0;
      const controlsWidth = controlsRect?.width ?? 0;
      const layersWidth = layersRect?.width ?? 0;
      const availableWidth =
        modalRect.width -
        paddingLeft -
        paddingRight -
        controlsWidth -
        layersWidth -
        horizontalGap * 2;
      const availableHeight = modalRect.height - paddingTop - paddingBottom;
      const safeAspectRatio =
        Number.isFinite(primaryCompositionSurfaceAspectRatioValue) &&
        primaryCompositionSurfaceAspectRatioValue > 0
          ? primaryCompositionSurfaceAspectRatioValue
          : 1;
      if (availableWidth <= 0 || availableHeight <= 0) {
        setMarkupModalStageSize((previous) => (previous == null ? previous : null));
        return;
      }
      let fittedWidth = availableWidth;
      let fittedHeight = fittedWidth / safeAspectRatio;
      if (fittedHeight > availableHeight) {
        fittedHeight = availableHeight;
        fittedWidth = fittedHeight * safeAspectRatio;
      }
      const nextStageSize = {
        width: Math.max(1, Math.floor(fittedWidth)),
        height: Math.max(1, Math.floor(fittedHeight)),
      };
      setMarkupModalStageSize((previous) => {
        if (!previous) {
          return nextStageSize;
        }
        return previous.width === nextStageSize.width && previous.height === nextStageSize.height
          ? previous
          : nextStageSize;
      });
    };

    updateStageSize();

    if (typeof ResizeObserver === "undefined") {
      if (typeof window === "undefined") return;
      window.addEventListener("resize", updateStageSize);
      return () => {
        window.removeEventListener("resize", updateStageSize);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateStageSize();
    });
    resizeObserver.observe(markupModalElement);
    if (markupModalControlsRef.current) {
      resizeObserver.observe(markupModalControlsRef.current);
    }
    if (markupModalLayersRef.current) {
      resizeObserver.observe(markupModalLayersRef.current);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("resize", updateStageSize);
    }

    return () => {
      resizeObserver.disconnect();
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", updateStageSize);
      }
    };
  }, [isMarkupExpandSelected, markupModalDomVersion, primaryCompositionSurfaceAspectRatioValue]);

  React.useEffect(() => {
    if (!isMarkupExpandSelected) return;
    const modalStageElement = markupModalStageRef.current;
    if (!modalStageElement) return;

    const updateModalViewportSize = () => {
      const nextViewportSize = resolveStageViewportSize(
        modalStageElement.getBoundingClientRect() ?? null
      );
      setMarkupModalViewportSize((previous) =>
        previous.width === nextViewportSize.width && previous.height === nextViewportSize.height
          ? previous
          : nextViewportSize
      );
    };

    updateModalViewportSize();

    if (typeof ResizeObserver === "undefined") {
      if (typeof window === "undefined") return;
      window.addEventListener("resize", updateModalViewportSize);
      return () => {
        window.removeEventListener("resize", updateModalViewportSize);
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      updateModalViewportSize();
    });
    resizeObserver.observe(modalStageElement);
    return () => {
      resizeObserver.disconnect();
    };
  }, [isMarkupExpandSelected, markupModalDomVersion, markupModalStageSize]);

  return {
    inlineStageWrapperRef,
    primaryCanvasFrameStackRef,
    primaryCanvasFrameStackElement,
    primaryCompositionSurfaceRef,
    markupModalRef,
    markupModalStageRef,
    markupModalStageElement,
    handleMarkupModalRef,
    handlePrimaryCanvasFrameStackRef,
    handleMarkupModalControlsRef,
    handleMarkupModalStageRef,
    handleMarkupModalLayersRef,
    markupViewport,
    setMarkupViewport,
    setInlineStageViewportSize,
    markupModalStageSize,
    markupModalViewportSize,
    setMarkupModalViewportSize,
    moveStageZoomSliderValue,
    setMoveStageZoomSliderValue,
    primaryCompositionSurfaceAspectRatio,
    primaryCompositionSurfaceAspectRatioValue,
    inlineMarkupViewportStyle,
    inlineCompositionSurfaceViewportSize,
    modalMarkupViewportStyle,
    primaryCanvasFrameBoundsStyle,
    resolveInlineStageRect,
    resolveInteractionViewportOffsetPixels,
    resolveInlineCompositionSurfacePoint,
    resolveInlineCompositionScenePoint,
  };
};
