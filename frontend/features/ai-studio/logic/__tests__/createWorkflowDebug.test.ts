import { beforeEach, describe, expect, it } from "vitest";
import {
  getCreateWorkflowDebugSnapshot,
  recordCreateWorkflowEvent,
  setCreateWorkflowAttachmentSnapshot,
} from "../createWorkflowDebug";

const STORAGE_KEY = "shortpulse.create_workflow.debug";

describe("createWorkflowDebug", () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.history.replaceState({}, "", "/");
    window.__shortpulseCreateWorkflowDebug?.reset();
    window.__shortpulseCreateWorkflowDebug?.setEnabled(false);
  });

  it("stays disabled by default", () => {
    recordCreateWorkflowEvent("drop_received", { transferTypes: ["Files"] });

    const snapshot = getCreateWorkflowDebugSnapshot();

    expect(snapshot?.enabled).toBe(false);
    expect(snapshot?.events).toEqual([]);
    expect(snapshot?.attachments).toEqual([]);
  });

  it("records events and attachments when explicitly enabled", () => {
    window.localStorage.setItem(STORAGE_KEY, "1");

    setCreateWorkflowAttachmentSnapshot([
      {
        id: "attachment-1",
        kind: "image",
        referenceId: "reference-1",
        mediaId: "media-1",
        imageUrl: "data:image/jpeg;base64,preview",
        submissionImageUrl: "blob:submission",
        previewStoragePath: "previews/path",
        fullStoragePath: "full/path",
        referenceUrl: "https://example.com/reference.png",
        referenceRenderUrl: null,
        imageFallbackUrls: ["https://example.com/fallback.png"],
        deliveryStatus: "pending",
        deliveryError: null,
      },
    ]);
    recordCreateWorkflowEvent("attachment_inserted", { attachmentId: "attachment-1" });

    const snapshot = getCreateWorkflowDebugSnapshot();

    expect(snapshot?.enabled).toBe(true);
    expect(snapshot?.attachments).toHaveLength(1);
    expect(snapshot?.attachments[0]?.submissionImageUrl).toBe("blob:submission");
    expect(snapshot?.events.map((event) => event.type)).toEqual(["attachment_inserted"]);
  });
});
