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

  it("resolves already-saved internal root drops as already exists", () => {
    expect(
      resolveFolderDropIntent({
        sourceFolderId: null,
        targetFolderId: MEDIA_LIBRARY_ROOT_FOLDER_ID,
        allowRootSave: true,
        alreadyInLibrary: true,
      })
    ).toEqual({ kind: "already_exists" });
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

  it("maps already-saved root media drops to explicit library feedback", () => {
    expect(
      resolveFolderDropFeedbackMessage({
        intent: { kind: "already_exists" },
        itemKind: "media",
        result: null,
      })
    ).toBe("Media already exists in the media library.");
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
