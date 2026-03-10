/**
 * Pure folder-drop intent/feedback model for Media Library folder interactions.
 * Converts source/target context + operation results into deterministic behavior and UX copy.
 */
import { MEDIA_LIBRARY_ROOT_FOLDER_ID } from "./mediaLibraryPanelApi";

export type FolderDropItemKind = "media" | "prompt";

export type FolderDropIntent =
  | { kind: "noop" }
  | {
      kind: "assign";
      targetFolderId: string;
    }
  | {
      kind: "unassign";
      sourceFolderId: string;
    }
  | {
      kind: "move";
      sourceFolderId: string;
      targetFolderId: string;
    };

export type FolderDropFeedbackArgs = {
  intent: FolderDropIntent;
  result?: {
    mediaAssigned: number;
    mediaUnassigned: number;
    promptsAssigned: number;
    promptsUnassigned: number;
    mediaDuplicates: number;
    promptDuplicates: number;
  } | null;
  itemKind: FolderDropItemKind;
  targetFolderName?: string | null;
  sourceFolderName?: string | null;
};

const isRootFolder = (folderId: string | null | undefined): boolean =>
  (folderId ?? "").trim() === MEDIA_LIBRARY_ROOT_FOLDER_ID;

const normalizeFolderId = (folderId: string | null | undefined): string | null => {
  const normalized = (folderId ?? "").trim();
  return normalized || null;
};

/**
 * Resolves folder-drop operation intent for Media Library folder tiles.
 */
export const resolveFolderDropIntent = ({
  sourceFolderId,
  targetFolderId,
}: {
  sourceFolderId?: string | null;
  targetFolderId: string;
}): FolderDropIntent => {
  const source = normalizeFolderId(sourceFolderId);
  const target = normalizeFolderId(targetFolderId);
  if (!target) return { kind: "noop" };
  if (source && source === target) return { kind: "noop" };

  if (isRootFolder(target)) {
    if (!source || isRootFolder(source)) return { kind: "noop" };
    return {
      kind: "unassign",
      sourceFolderId: source,
    };
  }

  if (!source || isRootFolder(source)) {
    return {
      kind: "assign",
      targetFolderId: target,
    };
  }

  return {
    kind: "move",
    sourceFolderId: source,
    targetFolderId: target,
  };
};

/**
 * Maps folder-drop results to deterministic user feedback copy.
 */
export const resolveFolderDropFeedbackMessage = ({
  intent,
  result,
  itemKind,
  sourceFolderName,
  targetFolderName,
}: FolderDropFeedbackArgs): string | null => {
  if (intent.kind === "noop") return null;
  const duplicateCount =
    itemKind === "media" ? (result?.mediaDuplicates ?? 0) : (result?.promptDuplicates ?? 0);
  const assignedCount =
    itemKind === "media" ? (result?.mediaAssigned ?? 0) : (result?.promptsAssigned ?? 0);
  const unassignedCount =
    itemKind === "media" ? (result?.mediaUnassigned ?? 0) : (result?.promptsUnassigned ?? 0);

  if (intent.kind === "assign") {
    if (duplicateCount > 0 && assignedCount === 0) {
      return targetFolderName ? `Already exists in ${targetFolderName}.` : "Item already exists.";
    }
    return targetFolderName ? `Added to ${targetFolderName}.` : "Added to folder.";
  }

  if (intent.kind === "unassign") {
    if (unassignedCount > 0) {
      return sourceFolderName ? `Removed from ${sourceFolderName}.` : "Removed from folder.";
    }
    return "Item is not assigned to that folder.";
  }

  if (duplicateCount > 0 && assignedCount === 0 && unassignedCount > 0) {
    const target = targetFolderName ? ` ${targetFolderName}` : "";
    const source = sourceFolderName ? ` and removed from ${sourceFolderName}` : "";
    return `Already existed in${target}${source}.`;
  }
  if (duplicateCount > 0 && assignedCount === 0 && unassignedCount === 0) {
    return targetFolderName ? `Already exists in ${targetFolderName}.` : "Item already exists.";
  }
  return targetFolderName ? `Moved to ${targetFolderName}.` : "Moved to folder.";
};
