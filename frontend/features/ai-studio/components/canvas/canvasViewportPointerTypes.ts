import type { CanvasResizeHandle } from "./canvasTypes";

/**
 * Shared pointer interaction primitives for Canvas viewport hooks.
 */
export type CanvasPointerSession =
  | { kind: "none" }
  | {
      kind: "item-ghost-drag";
      pointerId: number;
      itemId: string;
      selectedItemIds: string[];
      startClientX: number;
      startClientY: number;
      deltaX: number;
      deltaY: number;
    }
  | {
      kind: "pan";
      pointerId: number;
      cameraX: number;
      cameraY: number;
      startClientX: number;
      startClientY: number;
      isActive: boolean;
    }
  | {
      kind: "marquee";
      pointerId: number;
      isAdditive: boolean;
      isActive: boolean;
      startClientX: number;
      startClientY: number;
      startLocalX: number;
      startLocalY: number;
      startWorldX: number;
      startWorldY: number;
    }
  | {
      kind: "text-resize";
      pointerId: number;
      itemId: string;
      handle: CanvasResizeHandle;
      startClientX: number;
      startClientY: number;
      startX: number;
      startY: number;
      startWidth: number;
      startHeight: number;
      startRightX: number;
      startBottomY: number;
    };

/**
 * Returns true when pointer-down should enter panning mode.
 */
export const shouldStartCanvasPanFromPointerDown = ({
  button,
  isSpacePanActive,
}: {
  button: number;
  isSpacePanActive: boolean;
}): boolean => button === 1 || (button === 0 && isSpacePanActive);
