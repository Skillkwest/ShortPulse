import { describe, expect, it } from "vitest";
import {
  collectMediaLibraryFolderDescendantIds,
  resolveMediaLibraryFolderReparentIntent,
} from "../mediaLibraryFolderHierarchy";

const folders = [
  {
    id: "folder-a",
    parentFolderId: null,
  },
  {
    id: "folder-b",
    parentFolderId: "folder-a",
  },
  {
    id: "folder-c",
    parentFolderId: "folder-b",
  },
  {
    id: "folder-d",
    parentFolderId: null,
  },
];

describe("mediaLibraryFolderHierarchy", () => {
  it("collects all descendants for a folder subtree", () => {
    expect(collectMediaLibraryFolderDescendantIds(folders, "folder-a")).toEqual(
      new Set(["folder-b", "folder-c"])
    );
  });

  it("rejects self, descendant, and current-parent drops while allowing valid reparenting", () => {
    expect(
      resolveMediaLibraryFolderReparentIntent({
        folders,
        folderId: "folder-b",
        parentFolderId: "folder-b",
      })
    ).toEqual({ kind: "invalid", reason: "self" });
    expect(
      resolveMediaLibraryFolderReparentIntent({
        folders,
        folderId: "folder-b",
        parentFolderId: "folder-c",
      })
    ).toEqual({ kind: "invalid", reason: "descendant" });
    expect(
      resolveMediaLibraryFolderReparentIntent({
        folders,
        folderId: "folder-b",
        parentFolderId: "folder-a",
      })
    ).toEqual({ kind: "noop", reason: "same-parent" });
    expect(
      resolveMediaLibraryFolderReparentIntent({
        folders,
        folderId: "folder-b",
        parentFolderId: "folder-d",
      })
    ).toEqual({ kind: "move" });
  });
});
