import type { MediaFolder } from "./mediaLibraryPanelApi";

type FolderHierarchyRow = Pick<MediaFolder, "id" | "parentFolderId">;

export type MediaLibraryFolderReparentIntent =
  | { kind: "move" }
  | { kind: "noop"; reason: "same-parent" }
  | { kind: "invalid"; reason: "self" | "descendant" | "missing-folder" | "missing-parent" };

export const collectMediaLibraryFolderDescendantIds = (
  folders: FolderHierarchyRow[],
  rootFolderId: string
): Set<string> => {
  const descendants = new Set<string>();
  const queue = [rootFolderId];
  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) continue;
    for (const folder of folders) {
      if (folder.parentFolderId !== currentId || descendants.has(folder.id)) continue;
      descendants.add(folder.id);
      queue.push(folder.id);
    }
  }
  return descendants;
};

export const resolveMediaLibraryFolderReparentIntent = ({
  folders,
  folderId,
  parentFolderId,
}: {
  folders: FolderHierarchyRow[];
  folderId: string;
  parentFolderId: string | null;
}): MediaLibraryFolderReparentIntent => {
  const movingFolder = folders.find((folder) => folder.id === folderId) ?? null;
  if (!movingFolder) {
    return { kind: "invalid", reason: "missing-folder" };
  }
  if (parentFolderId === movingFolder.id) {
    return { kind: "invalid", reason: "self" };
  }
  if (parentFolderId !== null && !folders.some((folder) => folder.id === parentFolderId)) {
    return { kind: "invalid", reason: "missing-parent" };
  }
  if (movingFolder.parentFolderId === parentFolderId) {
    return { kind: "noop", reason: "same-parent" };
  }
  if (parentFolderId !== null) {
    const descendants = collectMediaLibraryFolderDescendantIds(folders, movingFolder.id);
    if (descendants.has(parentFolderId)) {
      return { kind: "invalid", reason: "descendant" };
    }
  }
  return { kind: "move" };
};
