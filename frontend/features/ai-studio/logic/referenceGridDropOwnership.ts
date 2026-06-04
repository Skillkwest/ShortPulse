/**
 * Right-rail drop ownership helpers.
 * Resolves which shared right-rail surface owns a drop so shell capture can defer to local targets.
 */
import { getMediaLibraryDragTypes } from "./mediaLibraryDragPayload";
import { getDroppedMediaReference } from "../reference-grid/controllers/referenceGridClipboard";
import { getNormalizedTransferTypes } from "../utils/dragDrop";

export type RightRailDropSurface = "canvas" | "quick-slot" | "all-refs";
type RightRailDropMode = "none" | "text" | "media";
type RightRailDropPayloadKind =
  | "none"
  | "internal"
  | "files"
  | "media"
  | "libraryMedia"
  | "libraryPrompt"
  | "text";
type RightRailShellCaptureContext = {
  dropMode?: RightRailDropMode;
  payload?: {
    kind: RightRailDropPayloadKind;
  };
};

const RIGHT_RAIL_DROP_SURFACE_ATTRIBUTE = "data-right-rail-drop-surface";
const RIGHT_RAIL_DROP_SURFACE_SELECTORS: Record<RightRailDropSurface, string> = {
  canvas: `[${RIGHT_RAIL_DROP_SURFACE_ATTRIBUTE}="canvas"]`,
  "quick-slot": `[${RIGHT_RAIL_DROP_SURFACE_ATTRIBUTE}="quick-slot"]`,
  "all-refs": `[${RIGHT_RAIL_DROP_SURFACE_ATTRIBUTE}="all-refs"]`,
};

export const REFERENCE_GRID_FILE_DROP_SURFACE_SELECTOR =
  RIGHT_RAIL_DROP_SURFACE_SELECTORS["all-refs"];
const MEDIA_LIBRARY_DRAG_TYPES_LOWERCASE = getMediaLibraryDragTypes().map((type) =>
  type.toLowerCase()
);

type ReferenceGridDropOwnershipEvent = {
  target: EventTarget | null;
  clientX: number;
  clientY: number;
  dataTransfer?: DataTransfer | null;
};

const getEventTargetElement = (target: EventTarget | null): Element | null => {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
};

const containsPoint = (element: Element, clientX: number, clientY: number): boolean => {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  return (
    clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  );
};

const isDropSurfaceAvailable = (surface: RightRailDropSurface, element: Element): boolean => {
  if (surface !== "canvas") return true;
  if (!(element instanceof HTMLElement)) return true;
  return (
    !element.classList.contains("is-divider-near-collapsed") &&
    !element.classList.contains("is-inventory-expanded")
  );
};

const resolveSurfaceFromTarget = (target: EventTarget | null): RightRailDropSurface | null => {
  const targetElement = getEventTargetElement(target);
  if (!targetElement) return null;
  const canvasSurface = targetElement.closest(RIGHT_RAIL_DROP_SURFACE_SELECTORS.canvas);
  if (canvasSurface && isDropSurfaceAvailable("canvas", canvasSurface)) return "canvas";
  const quickSlotSurface = targetElement.closest(RIGHT_RAIL_DROP_SURFACE_SELECTORS["quick-slot"]);
  if (quickSlotSurface && isDropSurfaceAvailable("quick-slot", quickSlotSurface)) {
    return "quick-slot";
  }
  const allRefsSurface = targetElement.closest(RIGHT_RAIL_DROP_SURFACE_SELECTORS["all-refs"]);
  if (allRefsSurface && isDropSurfaceAvailable("all-refs", allRefsSurface)) return "all-refs";
  return null;
};

/**
 * Resolves the intended right-rail surface from the target element or drop coordinates.
 */
export const resolveRightRailDropSurface = (
  event: ReferenceGridDropOwnershipEvent,
  root: ParentNode | null | undefined
): RightRailDropSurface | null => {
  const targetSurface = resolveSurfaceFromTarget(event.target);
  if (targetSurface) return targetSurface;
  if (!root) return null;
  const surfaces = (Object.keys(RIGHT_RAIL_DROP_SURFACE_SELECTORS) as RightRailDropSurface[]).map(
    (surface) => {
      const elements = Array.from(
        root.querySelectorAll(RIGHT_RAIL_DROP_SURFACE_SELECTORS[surface])
      );
      return {
        surface,
        ownsPoint: elements.some(
          (element) =>
            isDropSurfaceAvailable(surface, element) &&
            containsPoint(element, event.clientX, event.clientY)
        ),
      };
    }
  );
  return surfaces.find((entry) => entry.ownsPoint)?.surface ?? null;
};

/**
 * Returns true when a desktop-file drop belongs to the Reference Grid All Refs surface.
 */
export const doesReferenceGridOwnFileDrop = (
  event: ReferenceGridDropOwnershipEvent,
  root: ParentNode | null | undefined
): boolean => {
  return resolveRightRailDropSurface(event, root) === "all-refs";
};

/**
 * Returns true when shell capture should defer to a local right-rail surface instead.
 */
export const shouldBypassRightRailShellCapture = (
  event: ReferenceGridDropOwnershipEvent,
  root: ParentNode | null | undefined,
  context: RightRailShellCaptureContext
): boolean => {
  const dropSurface = resolveRightRailDropSurface(event, root);
  if (!dropSurface) return false;

  const transfer = event.dataTransfer;
  const transferTypes = getNormalizedTransferTypes(transfer);
  const hasLibraryPayloadHint = MEDIA_LIBRARY_DRAG_TYPES_LOWERCASE.some((type) =>
    transferTypes.includes(type)
  );
  const hasRealFilePayload = (transfer?.files?.length ?? 0) > 0;
  const hasDroppedMediaReference =
    !hasRealFilePayload && Boolean(transfer && getDroppedMediaReference(transfer));
  const payloadKind = context.payload?.kind;
  const isTextDrop = payloadKind === "text" || context.dropMode === "text";
  const isMediaDrop =
    payloadKind === "media" ||
    payloadKind === "libraryMedia" ||
    payloadKind === "libraryPrompt" ||
    (context.dropMode === "media" && !hasRealFilePayload);

  if (dropSurface === "quick-slot") {
    return hasLibraryPayloadHint || hasDroppedMediaReference || isMediaDrop;
  }
  if (dropSurface === "canvas") {
    return hasLibraryPayloadHint || hasDroppedMediaReference || isMediaDrop || isTextDrop;
  }
  return false;
};
