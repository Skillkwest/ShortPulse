import { beforeEach, describe, expect, it } from "vitest";
import {
  buildCreateWorkflowDiagnosis,
  getCreateWorkflowDebugSnapshot,
  recordCreateWorkflowEvent,
  setCreateWorkflowAttachmentSnapshot,
  summarizeCreateWorkflowUrl,
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

  it("builds a diagnosis for send attempts without observed send payload", () => {
    const diagnosis = buildCreateWorkflowDiagnosis({
      enabled: true,
      attachments: [
        {
          id: "attachment-1",
          kind: "image",
          referenceId: null,
          mediaId: null,
          imageUrl: "blob:preview",
          submissionImageUrl: "https://storage.example.com/full.png",
          previewStoragePath: "previews/path",
          fullStoragePath: "full/path",
          referenceUrl: null,
          referenceRenderUrl: null,
          imageFallbackUrls: [],
          deliveryStatus: "ready",
          deliveryError: null,
        },
      ],
      events: [
        {
          type: "attachment_send_prepare_started",
          at: "2026-05-18T00:00:00.000Z",
          payload: { attachmentId: "attachment-1" },
        },
      ],
    });

    expect(diagnosis.likelyFailureClass).toBe("send_payload_missing_image");
    expect(diagnosis.blockers).toContain("send_payload_not_observed");
    expect(diagnosis.attachments[0]?.submissionImageUrl.kind).toBe("https");
  });

  it("does not require durable submission URLs for ephemeral local image attachments", () => {
    const diagnosis = buildCreateWorkflowDiagnosis({
      enabled: true,
      attachments: [
        {
          id: "attachment-1",
          kind: "image",
          source: "ephemeral_local",
          referenceId: null,
          mediaId: null,
          imageUrl: "data:image/jpeg;base64,preview",
          submissionImageUrl: null,
          previewStoragePath: null,
          fullStoragePath: null,
          referenceUrl: null,
          referenceRenderUrl: null,
          imageFallbackUrls: [],
          deliveryStatus: "ready",
          deliveryError: null,
        },
      ],
      events: [],
    });

    expect(diagnosis.likelyFailureClass).toBe("ready_for_model_send");
    expect(diagnosis.blockers).not.toContain("missing_durable_submission_url");
  });

  it("summarizes URL values without retaining full signed URLs", () => {
    expect(summarizeCreateWorkflowUrl("blob:preview")).toEqual(
      expect.objectContaining({ kind: "blob", host: null })
    );
    expect(summarizeCreateWorkflowUrl("data:image/png;base64,abc")).toEqual(
      expect.objectContaining({ kind: "data", path: "image/png" })
    );
    expect(
      summarizeCreateWorkflowUrl("https://storage.example.com/path/file.png?token=secret")
    ).toEqual(
      expect.objectContaining({
        kind: "https",
        host: "storage.example.com",
        path: "/path/file.png",
      })
    );
  });
});
