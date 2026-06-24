/**
 * Same-tab Media Library synchronization events.
 * Broadcasts durable media/prompt mutations so mounted library surfaces can refresh
 * without remounting or duplicating list authority.
 */

const MEDIA_LIBRARY_CHANGED_EVENT = "shortpulse:media-library-changed";

export type MediaLibraryChangeReason =
  | "ai_studio_output_save"
  | "reference_grid_upload"
  | "folder_membership"
  | "refresh";

export type MediaLibraryChangedPayload = {
  userId: string | null;
  reason: MediaLibraryChangeReason;
  mediaFileIds: string[];
  promptIds: string[];
  folderIds: string[];
  atMs: number;
};

type MediaLibraryChangedOptions = {
  userId?: string | null;
};

const normalizeOptionalString = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeIdList = (values: readonly string[] | null | undefined): string[] =>
  Array.from(
    new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0))
  );

const shouldHandleUserScope = (
  payloadUserId: string | null | undefined,
  options?: MediaLibraryChangedOptions
): boolean => {
  if (!options || !Object.prototype.hasOwnProperty.call(options, "userId")) return true;
  return normalizeOptionalString(payloadUserId) === normalizeOptionalString(options.userId);
};

/**
 * Publishes a same-tab Media Library mutation event.
 */
export const publishMediaLibraryChanged = (payload: {
  userId?: string | null;
  reason: MediaLibraryChangeReason;
  mediaFileIds?: readonly string[] | null;
  promptIds?: readonly string[] | null;
  folderIds?: readonly string[] | null;
  atMs?: number;
}): void => {
  if (typeof window === "undefined") return;
  const detail: MediaLibraryChangedPayload = {
    userId: normalizeOptionalString(payload.userId),
    reason: payload.reason,
    mediaFileIds: normalizeIdList(payload.mediaFileIds),
    promptIds: normalizeIdList(payload.promptIds),
    folderIds: normalizeIdList(payload.folderIds),
    atMs: Number.isFinite(payload.atMs) ? Number(payload.atMs) : Date.now(),
  };
  window.dispatchEvent(
    new CustomEvent<MediaLibraryChangedPayload>(MEDIA_LIBRARY_CHANGED_EVENT, {
      detail,
    })
  );
};

/**
 * Subscribes to same-tab Media Library mutation events.
 */
export const subscribeMediaLibraryChanged = (
  onChange: (payload: MediaLibraryChangedPayload) => void,
  options?: MediaLibraryChangedOptions
): (() => void) => {
  if (typeof window === "undefined") return () => {};
  const handleEvent = (event: Event) => {
    const detail = (event as CustomEvent<MediaLibraryChangedPayload>).detail;
    if (!detail) return;
    if (!shouldHandleUserScope(detail.userId, options)) return;
    onChange(detail);
  };
  window.addEventListener(MEDIA_LIBRARY_CHANGED_EVENT, handleEvent as EventListener);
  return () => {
    window.removeEventListener(MEDIA_LIBRARY_CHANGED_EVENT, handleEvent as EventListener);
  };
};
