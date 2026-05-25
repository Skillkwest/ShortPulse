/**
 * Reference Grid desktop-file drop ownership helpers.
 * Centralizes the boundary rule so shell capture and tests agree on the real All Refs surface.
 */

export const REFERENCE_GRID_FILE_DROP_SURFACE_SELECTOR =
  '[data-reference-grid-drop-surface="all-refs"]';

type ReferenceGridDropOwnershipEvent = {
  target: EventTarget | null;
  clientX: number;
  clientY: number;
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

/**
 * Returns true when a desktop-file drop belongs to the Reference Grid All Refs surface.
 */
export const doesReferenceGridOwnFileDrop = (
  event: ReferenceGridDropOwnershipEvent,
  root: ParentNode | null | undefined
): boolean => {
  const targetElement = getEventTargetElement(event.target);
  const targetSurface = targetElement?.closest(REFERENCE_GRID_FILE_DROP_SURFACE_SELECTOR);
  if (targetSurface) return true;
  if (!root) return false;
  const surfaces = Array.from(root.querySelectorAll(REFERENCE_GRID_FILE_DROP_SURFACE_SELECTOR));
  return surfaces.some((surface) => containsPoint(surface, event.clientX, event.clientY));
};
