/**
 * Shared Media Library tab/source routing and move eligibility logic.
 * Used by both the page UI and server API to keep move behavior consistent.
 */

export type MediaTab =
  | "uploaded_images"
  | "uploaded_videos"
  | "private"
  | "saved_prompts"
  | "ai_generations";

export type MediaDataTab = Exclude<MediaTab, "saved_prompts">;

export type MediaMoveDestination = MediaDataTab | "saved_prompts";

export type MediaMoveSource = "upload" | "private_upload" | "ai_studio";

export type MediaTabOption = {
  tab: MediaMoveDestination;
  label: string;
  disabled: boolean;
  reason?: string;
};

type MediaTabRow = {
  source?: string | null;
  storage_path?: string | null;
  file_type?: string | null;
  filename?: string | null;
};

const PRIVATE_MEDIA_SOURCE = "private_upload";
const PRIVATE_MEDIA_FOLDER = "private";

const MOVE_TAB_ORDER: MediaMoveDestination[] = [
  "uploaded_images",
  "uploaded_videos",
  "saved_prompts",
  "ai_generations",
  "private",
];

const moveTabLabels: Record<MediaMoveDestination, string> = {
  uploaded_images: "Uploaded Images",
  uploaded_videos: "Uploaded Videos",
  saved_prompts: "Saved Prompts",
  ai_generations: "AI Studio Generations",
  private: "Private",
};

const buildMoveId = (): string => {
  const maybeUuid = globalThis.crypto?.randomUUID;
  if (typeof maybeUuid === "function") {
    return maybeUuid.call(globalThis.crypto);
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const sanitizeStorageSegment = (value: string): string =>
  value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .replace(/_+/g, "_")
    .slice(0, 120);

const extractStorageBasename = (storagePath?: string | null): string | null => {
  if (!storagePath) return null;
  const parts = storagePath
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
};

const buildFallbackName = (row: MediaTabRow): string => {
  const filename = sanitizeStorageSegment(row.filename ?? "");
  if (filename) return filename;
  return isVideoFile(row.file_type) ? "video" : "image";
};

/**
 * Returns true when a media row should be treated as a video asset.
 */
export const isVideoFile = (fileType?: string | null): boolean =>
  (fileType ?? "").toLowerCase().startsWith("video");

/**
 * Returns true when a storage path sits in the private media folder namespace.
 */
export const isPrivateStoragePath = (storagePath?: string | null): boolean =>
  (storagePath ?? "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .includes(PRIVATE_MEDIA_FOLDER);

/**
 * Returns true when a media row should be treated as private media.
 */
export const isPrivateMediaFile = (row: Pick<MediaTabRow, "source" | "storage_path">): boolean =>
  (row.source ?? "") === PRIVATE_MEDIA_SOURCE || isPrivateStoragePath(row.storage_path);

/**
 * Resolves which data tab a media row belongs to based on source/path/file-type rules.
 */
export const getMediaDataTabForRow = (row: MediaTabRow): MediaDataTab => {
  if (isPrivateMediaFile(row)) return "private";
  if ((row.source ?? "upload") === "ai_studio") return "ai_generations";
  return isVideoFile(row.file_type) ? "uploaded_videos" : "uploaded_images";
};

/**
 * Returns whether the destination tab is valid for the given media row.
 */
export const validateMoveDestination = (
  row: MediaTabRow,
  destination: MediaMoveDestination
): { allowed: boolean; reason?: string } => {
  const currentTab = getMediaDataTabForRow(row);
  if (destination === currentTab) {
    return { allowed: false, reason: "Current tab" };
  }
  if (destination === "saved_prompts") {
    return { allowed: false, reason: "Text-only tab" };
  }

  const isVideo = isVideoFile(row.file_type);
  if (destination === "uploaded_images" && isVideo) {
    return { allowed: false, reason: "Image-only tab" };
  }
  if (destination === "uploaded_videos" && !isVideo) {
    return { allowed: false, reason: "Video-only tab" };
  }
  if (destination === "private" && isVideo) {
    return { allowed: false, reason: "Private supports images only" };
  }

  return { allowed: true };
};

/**
 * Builds Move dropdown options for all tabs other than the current tab.
 */
export const buildMoveTabOptions = (row: MediaTabRow): MediaTabOption[] => {
  const currentTab = getMediaDataTabForRow(row);
  return MOVE_TAB_ORDER.filter((tab) => tab !== currentTab).map((tab) => {
    const decision = validateMoveDestination(row, tab);
    return {
      tab,
      label: moveTabLabels[tab],
      disabled: !decision.allowed,
      reason: decision.reason,
    };
  });
};

/**
 * Maps a destination data tab to the `media_files.source` value.
 */
export const resolveSourceForDataTab = (destination: MediaDataTab): MediaMoveSource => {
  if (destination === "private") return "private_upload";
  if (destination === "ai_generations") return "ai_studio";
  return "upload";
};

/**
 * Computes a destination storage path for a move operation.
 */
export const buildMovedStoragePath = (
  userId: string,
  row: MediaTabRow,
  destination: MediaDataTab
): string => {
  const isVideo = isVideoFile(row.file_type);
  const tabValidation = validateMoveDestination(row, destination);
  if (!tabValidation.allowed) {
    throw new Error(tabValidation.reason ?? "Invalid move destination");
  }

  const destinationPrefix =
    destination === "private"
      ? `${userId}/private/images/`
      : destination === "ai_generations"
        ? `${userId}/generations/${isVideo ? "videos" : "images"}/`
        : destination === "uploaded_videos"
          ? `${userId}/videos/`
          : `${userId}/images/`;

  const sourceName = extractStorageBasename(row.storage_path) ?? buildFallbackName(row);
  const safeName = sanitizeStorageSegment(sourceName) || buildFallbackName(row);
  return `${destinationPrefix}${buildMoveId()}-${safeName}`;
};

/**
 * Returns a user-facing destination label for UI rendering.
 */
export const getMoveTabLabel = (tab: MediaMoveDestination): string => moveTabLabels[tab];
