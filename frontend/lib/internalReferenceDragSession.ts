/**
 * Same-document drag session registry for AI Studio internal reference drags.
 * Avoids depending on browser preservation of rich DataTransfer metadata across surfaces.
 */
import type { InternalReferenceDragPayload } from "./internalReferenceDragPayload";

export const INTERNAL_REFERENCE_DRAG_SESSION_TYPE = "application/x-shortpulse-reference-drag-token";
export const INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE = "text/reference-drag-token";
export const INTERNAL_REFERENCE_DRAG_SESSION_TYPES = [
  INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
] as const;

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

/**
 * Reads an internal drag session token from any supported transfer type.
 */
export const getInternalReferenceDragSessionToken = (
  transfer: Pick<DataTransfer, "getData"> | null | undefined
): string | null => {
  if (!transfer) return null;
  for (const type of INTERNAL_REFERENCE_DRAG_SESSION_TYPES) {
    const token = transfer.getData(type)?.trim();
    if (token) return token;
  }
  return null;
};
