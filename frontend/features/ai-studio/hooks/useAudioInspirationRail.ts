import React from "react";

type AudioInspirationScrollStrategy = "scrollBy" | "scrollTo";
type AudioInspirationScrollDirection = "backward" | "forward";

type UseAudioInspirationRailOptions = {
  disabled?: boolean;
  ignoreNonPrimaryMousePointerDown?: boolean;
  scrollStepPx: number;
  scrollStrategy: AudioInspirationScrollStrategy;
  scrollSyncDelayMs?: number;
  syncKey?: unknown;
};

export function useAudioInspirationRail({
  disabled = false,
  ignoreNonPrimaryMousePointerDown = false,
  scrollStepPx,
  scrollStrategy,
  scrollSyncDelayMs,
  syncKey,
}: UseAudioInspirationRailOptions) {
  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const dragPointerIdRef = React.useRef<number | null>(null);
  const dragStartXRef = React.useRef(0);
  const dragStartScrollLeftRef = React.useRef(0);
  const didDragRef = React.useRef(false);
  const suppressChipClickRef = React.useRef(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [scrollState, setScrollState] = React.useState({
    canScrollBack: false,
    canScrollForward: false,
  });

  const syncScrollState = React.useCallback(() => {
    const node = scrollerRef.current;
    if (!node) {
      setScrollState({
        canScrollBack: false,
        canScrollForward: false,
      });
      return;
    }

    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    setScrollState({
      canScrollBack: node.scrollLeft > 4,
      canScrollForward: node.scrollLeft < maxScrollLeft - 4,
    });
  }, []);

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      syncScrollState();
    });
    const handleResize = () => {
      syncScrollState();
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [syncKey, syncScrollState]);

  const scrollByOffset = React.useCallback(
    (offset: number) => {
      const node = scrollerRef.current;
      if (!node) return;

      if (scrollStrategy === "scrollBy") {
        node.scrollBy({
          left: offset,
          behavior: "smooth",
        });
      } else {
        const nextLeft = node.scrollLeft + offset;
        if (typeof node.scrollTo === "function") {
          node.scrollTo({
            left: nextLeft,
            behavior: "smooth",
          });
        } else {
          node.scrollLeft = nextLeft;
        }
      }

      if (scrollSyncDelayMs != null) {
        window.setTimeout(syncScrollState, scrollSyncDelayMs);
      } else {
        window.requestAnimationFrame(() => {
          syncScrollState();
        });
      }
    },
    [scrollStrategy, scrollSyncDelayMs, syncScrollState]
  );

  const scrollByDirection = React.useCallback(
    (direction: AudioInspirationScrollDirection) => {
      scrollByOffset(direction === "forward" ? scrollStepPx : -scrollStepPx);
    },
    [scrollByOffset, scrollStepPx]
  );

  const consumeSuppressedChipClick = React.useCallback((clearOnConsume = false): boolean => {
    if (!suppressChipClickRef.current) return false;
    if (clearOnConsume) {
      suppressChipClickRef.current = false;
    }
    return true;
  }, []);

  const endDrag = React.useCallback(
    (pointerId?: number) => {
      const node = scrollerRef.current;
      if (node && pointerId != null && node.hasPointerCapture?.(pointerId)) {
        node.releasePointerCapture(pointerId);
      }

      dragPointerIdRef.current = null;
      setIsDragging(false);
      if (didDragRef.current) {
        suppressChipClickRef.current = true;
        window.setTimeout(() => {
          suppressChipClickRef.current = false;
        }, 0);
      }
      didDragRef.current = false;
      syncScrollState();
    },
    [syncScrollState]
  );

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (ignoreNonPrimaryMousePointerDown && event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      const node = scrollerRef.current;
      if (!node) return;

      dragPointerIdRef.current = event.pointerId;
      dragStartXRef.current = event.clientX;
      dragStartScrollLeftRef.current = node.scrollLeft;
      didDragRef.current = false;
      suppressChipClickRef.current = false;
      setIsDragging(false);
      node.setPointerCapture?.(event.pointerId);
    },
    [disabled, ignoreNonPrimaryMousePointerDown]
  );

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      const node = scrollerRef.current;
      if (!node || dragPointerIdRef.current !== event.pointerId) return;

      const deltaX = event.clientX - dragStartXRef.current;
      if (!didDragRef.current && Math.abs(deltaX) > 4) {
        didDragRef.current = true;
        suppressChipClickRef.current = true;
        setIsDragging(true);
      }
      if (!didDragRef.current) return;

      node.scrollLeft = dragStartScrollLeftRef.current - deltaX;
      syncScrollState();
    },
    [disabled, syncScrollState]
  );

  const handlePointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragPointerIdRef.current !== event.pointerId) return;
      endDrag(event.pointerId);
    },
    [endDrag]
  );

  const handleChipPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation();
    },
    []
  );

  return {
    scrollerRef,
    isDragging,
    scrollState,
    syncScrollState,
    scrollByOffset,
    scrollByDirection,
    consumeSuppressedChipClick,
    endDrag,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel: handlePointerUp,
    handleChipPointerDown,
  };
}
