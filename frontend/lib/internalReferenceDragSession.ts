/**
 * Same-document drag session registry for AI Studio internal reference drags.
 * Avoids depending on browser preservation of rich DataTransfer metadata across surfaces.
 */
import type {
  ComposerImageDropPayload,
  InternalReferenceDragPayload,
} from "./internalReferenceDragPayload";

export const INTERNAL_REFERENCE_DRAG_SESSION_TYPE = "application/x-shortpulse-reference-drag-token";
export const INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE = "text/reference-drag-token";
export const INTERNAL_REFERENCE_DRAG_SESSION_TYPES = [
  INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
] as const;
export const COMPOSER_IMAGE_DROP_SESSION_TYPE =
  "application/x-shortpulse-composer-image-drop-token";
export const COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE = "text/reference-composer-image-drop-token";
export const COMPOSER_IMAGE_DROP_SESSION_TYPES = [
  COMPOSER_IMAGE_DROP_SESSION_TYPE,
  COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE,
] as const;

type InternalReferenceDragSessionPayload = InternalReferenceDragPayload;
type ComposerImageDropSessionPayload = ComposerImageDropPayload;

const dragSessionRegistry = new Map<string, InternalReferenceDragSessionPayload>();
const composerImageDropSessionRegistry = new Map<string, ComposerImageDropSessionPayload>();
const dragSessionCleanupTimers = new Map<string, ReturnType<typeof globalThis.setTimeout>>();
const composerImageDropSessionCleanupTimers = new Map<
  string,
  ReturnType<typeof globalThis.setTimeout>
>();
let dragSessionCounter = 0;
const DRAG_SESSION_CLEANUP_DELAY_MS = 15_000;

const buildNextDragSessionToken = (): string => {
  dragSessionCounter += 1;
  return `ref-drag-${Date.now()}-${dragSessionCounter}`;
};

const clearScheduledTimer = (
  timers: Map<string, ReturnType<typeof globalThis.setTimeout>>,
  token: string
) => {
  const existingTimer = timers.get(token);
  if (!existingTimer) return;
  globalThis.clearTimeout(existingTimer);
  timers.delete(token);
};

const scheduleSessionClear = <TPayload>(
  token: string | null | undefined,
  registry: Map<string, TPayload>,
  timers: Map<string, ReturnType<typeof globalThis.setTimeout>>
) => {
  const normalizedToken = token?.trim() ?? "";
  if (!normalizedToken) return;
  clearScheduledTimer(timers, normalizedToken);
  const timer = globalThis.setTimeout(() => {
    registry.delete(normalizedToken);
    timers.delete(normalizedToken);
  }, DRAG_SESSION_CLEANUP_DELAY_MS);
  timers.set(normalizedToken, timer);
};

/**
 * Registers an internal drag payload in memory and returns the token to place on DataTransfer.
 */
export const registerInternalReferenceDragSession = (
  payload: InternalReferenceDragSessionPayload
): string => {
  const token = buildNextDragSessionToken();
  clearScheduledTimer(dragSessionCleanupTimers, token);
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
  clearScheduledTimer(dragSessionCleanupTimers, normalizedToken);
  dragSessionRegistry.delete(normalizedToken);
};

/**
 * Schedules a previously-registered drag session token for deferred cleanup.
 */
export const scheduleClearInternalReferenceDragSession = (
  token: string | null | undefined
): void => {
  scheduleSessionClear(token, dragSessionRegistry, dragSessionCleanupTimers);
};

/**
 * Registers a composer image-drop payload in memory and returns the token to place on DataTransfer.
 */
export const registerComposerImageDropSession = (
  payload: ComposerImageDropSessionPayload
): string => {
  const token = buildNextDragSessionToken();
  clearScheduledTimer(composerImageDropSessionCleanupTimers, token);
  composerImageDropSessionRegistry.set(token, payload);
  return token;
};

/**
 * Resolves a composer image-drop payload from a session token.
 */
export const resolveComposerImageDropSession = (
  token: string | null | undefined
): ComposerImageDropSessionPayload | null => {
  const normalizedToken = token?.trim() ?? "";
  if (!normalizedToken) return null;
  return composerImageDropSessionRegistry.get(normalizedToken) ?? null;
};

/**
 * Clears a previously-registered composer image-drop session token.
 */
export const clearComposerImageDropSession = (token: string | null | undefined): void => {
  const normalizedToken = token?.trim() ?? "";
  if (!normalizedToken) return;
  clearScheduledTimer(composerImageDropSessionCleanupTimers, normalizedToken);
  composerImageDropSessionRegistry.delete(normalizedToken);
};

/**
 * Schedules a previously-registered composer image-drop session token for deferred cleanup.
 */
export const scheduleClearComposerImageDropSession = (token: string | null | undefined): void => {
  scheduleSessionClear(
    token,
    composerImageDropSessionRegistry,
    composerImageDropSessionCleanupTimers
  );
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

/**
 * Reads a composer image-drop session token from any supported transfer type.
 */
export const getComposerImageDropSessionToken = (
  transfer: Pick<DataTransfer, "getData"> | null | undefined
): string | null => {
  if (!transfer) return null;
  for (const type of COMPOSER_IMAGE_DROP_SESSION_TYPES) {
    const token = transfer.getData(type)?.trim();
    if (token) return token;
  }
  return null;
};
