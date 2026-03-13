/**
 * Character Manager list synchronization events.
 * Broadcasts in-tab character list mutations so AI Studio pickers can refresh reactively.
 */

const CHARACTER_LIST_CHANGED_EVENT = "shortpulse:character-list-changed";

export type CharacterListChangeReason =
  | "bootstrap"
  | "create"
  | "delete"
  | "rename"
  | "profile_image"
  | "refresh";

export type CharacterListChangePayload = {
  userId: string | null;
  reason: CharacterListChangeReason;
  atMs: number;
};

type CharacterListSyncOptions = {
  userId?: string | null;
};

const normalizeUserId = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

const shouldHandleUserScope = (
  payloadUserId: string | null | undefined,
  options?: CharacterListSyncOptions
): boolean => normalizeUserId(payloadUserId) === normalizeUserId(options?.userId);

/**
 * Publish a character-list mutation event for same-tab subscribers.
 */
export const publishCharacterListChanged = (
  payload: Omit<CharacterListChangePayload, "atMs"> & { atMs?: number }
): void => {
  if (typeof window === "undefined") return;
  const detail: CharacterListChangePayload = {
    userId: normalizeUserId(payload.userId),
    reason: payload.reason,
    atMs: Number.isFinite(payload.atMs) ? Number(payload.atMs) : Date.now(),
  };
  window.dispatchEvent(
    new CustomEvent<CharacterListChangePayload>(CHARACTER_LIST_CHANGED_EVENT, {
      detail,
    })
  );
};

/**
 * Subscribe to character-list mutation events for an optional user scope.
 */
export const subscribeCharacterListChanged = (
  onChange: (payload: CharacterListChangePayload) => void,
  options?: CharacterListSyncOptions
): (() => void) => {
  if (typeof window === "undefined") return () => {};
  const handleEvent = (event: Event) => {
    const detail = (event as CustomEvent<CharacterListChangePayload>).detail;
    if (!detail) return;
    if (!shouldHandleUserScope(detail.userId, options)) return;
    onChange(detail);
  };
  window.addEventListener(CHARACTER_LIST_CHANGED_EVENT, handleEvent as EventListener);
  return () => {
    window.removeEventListener(CHARACTER_LIST_CHANGED_EVENT, handleEvent as EventListener);
  };
};
