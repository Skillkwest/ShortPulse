import { describe, expect, it } from "vitest";
import { MEDIA_LIBRARY_ROOT_FOLDER_ID } from "../mediaLibraryPanelApi";
import {
  resolveFolderDropFeedbackMessage,
  resolveFolderDropIntent,
} from "../mediaLibraryFolderDropModel";

describe("mediaLibraryFolderDropModel", () => {
  it("resolves root-to-custom as assign", () => {
    expect(
      resolveFolderDropIntent({
        sourceFolderId: MEDIA_LIBRARY_ROOT_FOLDER_ID,
        targetFolderId: "folder-b",
      })
    ).toEqual({ kind: "assign", targetFolderId: "folder-b" });
  });

  it("resolves custom-to-custom as move", () => {
    expect(
      resolveFolderDropIntent({
        sourceFolderId: "folder-a",
        targetFolderId: "folder-b",
      })
    ).toEqual({
      kind: "move",
      sourceFolderId: "folder-a",
      targetFolderId: "folder-b",
    });
  });

  it("resolves custom-to-root as unassign", () => {
    expect(
      resolveFolderDropIntent({
        sourceFolderId: "folder-a",
        targetFolderId: MEDIA_LIBRARY_ROOT_FOLDER_ID,
      })
    ).toEqual({
      kind: "unassign",
      sourceFolderId: "folder-a",
    });
  });

  it("resolves same-folder drops as noop", () => {
    expect(
      resolveFolderDropIntent({
        sourceFolderId: "folder-a",
        targetFolderId: "folder-a",
      })
    ).toEqual({ kind: "noop" });
  });

  it("maps duplicate assign to deterministic feedback", () => {
    expect(
      resolveFolderDropFeedbackMessage({
        intent: { kind: "assign", targetFolderId: "folder-b" },
        itemKind: "media",
        targetFolderName: "Campaign",
        result: {
          mediaAssigned: 0,
          mediaUnassigned: 0,
          promptsAssigned: 0,
          promptsUnassigned: 0,
          mediaDuplicates: 1,
          promptDuplicates: 0,
        },
      })
    ).toBe("Already exists in Campaign.");
  });

  it("maps duplicate-target move with source removal feedback", () => {
    expect(
      resolveFolderDropFeedbackMessage({
        intent: {
          kind: "move",
          sourceFolderId: "folder-a",
          targetFolderId: "folder-b",
        },
        itemKind: "media",
        sourceFolderName: "Source",
        targetFolderName: "Target",
        result: {
          mediaAssigned: 0,
          mediaUnassigned: 1,
          promptsAssigned: 0,
          promptsUnassigned: 0,
          mediaDuplicates: 1,
          promptDuplicates: 0,
        },
      })
    ).toBe("Already existed in Target and removed from Source.");
  });
});
