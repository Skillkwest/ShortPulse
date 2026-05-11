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
import { useExpertEditModalStageViewportRuntime } from "./useExpertEditModalStageViewportRuntime";
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
  const [primaryCanvasFrameStackElement, setPrimaryCanvasFrameStackElement] =
    React.useState<HTMLDivElement | null>(null);
  const [markupViewport, setMarkupViewport] = React.useState<MarkupViewportState>(() =>
    createDefaultMarkupViewportState()
  );
  const [inlineStageViewportSize, setInlineStageViewportSize] = React.useState<StageViewportSize>({
    width: 1,
    height: 1,
  });
  const [moveStageZoomSliderValue, setMoveStageZoomSliderValue] = React.useState(() =>
    resolveMoveStageZoomSliderValue(MARKUP_VIEWPORT_DEFAULT_SCALE)
  );
  const handlePrimaryCanvasFrameStackRef = React.useCallback((node: HTMLDivElement | null) => {
    primaryCanvasFrameStackRef.current = node;
    setPrimaryCanvasFrameStackElement((previous) => (previous === node ? previous : node));
  }, []);

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

  const {
    handleMarkupModalControlsRef,
    handleMarkupModalLayersRef,
    handleMarkupModalRef,
    handleMarkupModalStageRef,
    markupModalRef,
    markupModalStageElement,
    markupModalStageRef,
    markupModalStageSize,
    markupModalViewportSize,
    modalStageViewportStyle,
    setMarkupModalViewportSize,
  } = useExpertEditModalStageViewportRuntime({
    isMarkupExpandSelected,
    primaryCompositionSurfaceAspectRatioValue,
    markupViewport,
  });

  const resolveInlineStageRect = React.useCallback(
    (currentTarget?: HTMLDivElement | null): DOMRect | null => {
      return resolveInlineStageRectFromRefs({
        inlineStageWrapperRef,
        primaryCanvasFrameStackRef,
        primaryCompositionSurfaceRef,
        currentTarget,
      });
    },
    [inlineStageWrapperRef, primaryCanvasFrameStackRef, primaryCompositionSurfaceRef]
  );

  const resolveInteractionViewportOffsetPixels = React.useCallback(
    (interactionRect: DOMRect, currentTarget: HTMLDivElement) => {
      return resolveInteractionViewportOffsetPixelsFromRefs({
        refs: {
          inlineStageWrapperRef,
          primaryCanvasFrameStackRef,
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
      primaryCanvasFrameStackRef,
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

  const inlineStageViewportStyle = React.useMemo<React.CSSProperties>(() => {
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
    stageViewport: markupViewport,
    setStageViewport: setMarkupViewport,
    setInlineStageViewportSize,
    markupModalStageSize,
    markupModalViewportSize,
    setMarkupModalViewportSize,
    moveStageZoomSliderValue,
    setMoveStageZoomSliderValue,
    primaryCompositionSurfaceAspectRatio,
    primaryCompositionSurfaceAspectRatioValue,
    inlineStageViewportStyle,
    inlineCompositionSurfaceViewportSize,
    modalStageViewportStyle,
    primaryCanvasFrameBoundsStyle,
    resolveInlineStageRect,
    resolveInteractionViewportOffsetPixels,
    resolveInlineCompositionSurfacePoint,
    resolveInlineCompositionScenePoint,
  };
};
