/**
 * Same-document drag session registry for AI Studio internal reference drags.
 * Avoids depending on browser preservation of rich DataTransfer metadata across surfaces.
 */
import type { InternalReferenceDragPayload } from "./internalReferenceDragPayload";

export const INTERNAL_REFERENCE_DRAG_SESSION_TYPE = "application/x-shortpulse-reference-drag-token";

type InternalReferenceDragSessionPayload = InternalReferenceDragPayload;

const dragSessionRegistry = new Map<string, InternalReferenceDragSessionPayload>();
let dragSessionCounter = 0;

const buildNextDragSessionToken = (): string => {
  dragSessionCounter += 1;
  return `ref-drag-${Date.now()}-${dragSessionCounter}`;
};

/**
 * Registers an internal drag payload in memory and returns the token to place on DataTransfer.
 */
export const registerInternalReferenceDragSession = (
  payload: InternalReferenceDragSessionPayload
): string => {
  const token = buildNextDragSessionToken();
  dragSessionRegistry.set(token, payload);
  return token;
};

/**
 * Resolves an internal drag payload from a session token.
 */
export const resolveInternalReferenceDragSession = (
  token: string | null | undefined
): InternalReferenceDragSessionPayload | null => {
  const normalizedToken = token?.trim() ?? "";
  if (!normalizedToken) return null;
  return dragSessionRegistry.get(normalizedToken) ?? null;
};

/**
 * Clears a previously-registered drag session token.
 */
export const clearInternalReferenceDragSession = (token: string | null | undefined): void => {
  const normalizedToken = token?.trim() ?? "";
  if (!normalizedToken) return;
  dragSessionRegistry.delete(normalizedToken);
};
