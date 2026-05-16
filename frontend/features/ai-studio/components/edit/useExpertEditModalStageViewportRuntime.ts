import React from "react";

import {
  resolveMarkupViewportOffsetPixels,
  resolveStageViewportSize,
  type StageViewportSize,
} from "./expertEditViewportUtils";
import type { MarkupViewportState } from "./markupStrokeController";

type UseExpertEditModalStageViewportRuntimeParams = {
  isMarkupExpandSelected: boolean;
  primaryCompositionSurfaceAspectRatioValue: number;
  markupViewport: MarkupViewportState;
};

export const useExpertEditModalStageViewportRuntime = ({
  isMarkupExpandSelected,
  primaryCompositionSurfaceAspectRatioValue,
  markupViewport,
}: UseExpertEditModalStageViewportRuntimeParams) => {
  const markupModalRef = React.useRef<HTMLDivElement | null>(null);
  const markupModalControlsRef = React.useRef<HTMLDivElement | null>(null);
  const markupModalStageRef = React.useRef<HTMLDivElement | null>(null);
  const markupModalLayersRef = React.useRef<HTMLDivElement | null>(null);
  const [markupModalStageElement, setMarkupModalStageElement] =
    React.useState<HTMLDivElement | null>(null);
  const [markupModalStageSize, setMarkupModalStageSize] = React.useState<StageViewportSize | null>(
    null
  );
  const [markupModalViewportSize, setMarkupModalViewportSize] = React.useState<StageViewportSize>({
    width: 1,
    height: 1,
  });
  const [markupModalDomVersion, setMarkupModalDomVersion] = React.useState(0);

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
    [syncMarkupModalTrackedRef]
  );

  const handleMarkupModalControlsRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      syncMarkupModalTrackedRef(markupModalControlsRef, node);
    },
    [syncMarkupModalTrackedRef]
  );

  const handleMarkupModalStageRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      syncMarkupModalTrackedRef(markupModalStageRef, node);
      setMarkupModalStageElement((previous) => (previous === node ? previous : node));
    },
    [syncMarkupModalTrackedRef]
  );

  const handleMarkupModalLayersRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      syncMarkupModalTrackedRef(markupModalLayersRef, node);
    },
    [syncMarkupModalTrackedRef]
  );

  const modalStageViewportStyle = React.useMemo<React.CSSProperties>(() => {
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
  }, [
    isMarkupExpandSelected,
    markupModalDomVersion,
    markupModalStageElement,
    markupModalStageSize,
  ]);

  return {
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
  };
};
