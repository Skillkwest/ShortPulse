/**
 * Pure request helpers for the Media Library panel data controller.
 * Keeps folder normalization, media-list request shape, and scheduling utilities outside the hook.
 */
import type { MediaListProfile } from "../../../lib/mediaListProfile";
import type { MediaListMediaKind } from "../../media-library/logic/mediaListApi";

export type MediaLibraryPanelItemType = "all" | "images" | "videos" | "audio" | "prompts";

const MEDIA_FOLDER_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolves transient or invalid folder ids back to the global root browse scope.
 */
export const normalizeMediaLibraryPanelRequestFolderId = (folderId: string): string => {
  const normalizedFolderId = folderId.trim();
  if (!normalizedFolderId || normalizedFolderId === "all_items") {
    return "all_items";
  }
  return MEDIA_FOLDER_UUID_PATTERN.test(normalizedFolderId) ? normalizedFolderId : "all_items";
};

/**
 * Maps the active panel tab to the server media-kind filter.
 */
export const resolveMediaLibraryPanelMediaKind = (
  itemType: MediaLibraryPanelItemType
): MediaListMediaKind => {
  if (itemType === "images") return "images";
  if (itemType === "videos") return "videos";
  if (itemType === "audio") return "audio";
  return "all";
};

/**
 * Chooses the leanest media-list profile that still preserves visible card metadata.
 */
export const resolveMediaLibraryPanelListProfile = (
  itemType: MediaLibraryPanelItemType
): MediaListProfile => {
  if (itemType === "images") return "minimal";
  return "expanded";
};

/**
 * Waits for the next browser frame when preserving scroll after refresh.
 */
export const waitForMediaLibraryPanelAnimationFrame = async (): Promise<void> => {
  if (typeof window === "undefined") return;
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
};

/**
 * Schedules low-priority library count refreshes without blocking primary grid paint.
 */
export const scheduleMediaLibraryPanelBackgroundCountTask = (
  callback: () => void
): (() => void) => {
  if (typeof window === "undefined") {
    callback();
    return () => {};
  }
  const win = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (typeof win.requestIdleCallback === "function") {
    const handle = win.requestIdleCallback(callback, { timeout: 1500 });
    return () => {
      if (typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(handle);
      }
    };
  }
  const timeoutId = window.setTimeout(callback, 350);
  return () => window.clearTimeout(timeoutId);
};
