import { describe, expect, it } from "vitest";
import {
  buildCreateWorkflowDebugDiagnosis,
  buildCreateWorkflowDebugReport,
  readSnapshotFromText,
} from "../create_workflow_debug_report.mjs";

describe("create_workflow_debug_report", () => {
  it("normalizes raw snapshot JSON", () => {
    const snapshot = readSnapshotFromText(
      JSON.stringify({
        enabled: true,
        attachments: [{ id: "attachment-1", imageUrl: "data:image/jpeg;base64,abc" }],
        events: [{ type: "drop_received", at: "2026-05-16T00:00:00.000Z", payload: {} }],
      })
    );

    expect(snapshot.enabled).toBe(true);
    expect(snapshot.attachments).toHaveLength(1);
    expect(snapshot.events).toHaveLength(1);
  });

  it("builds a readable markdown report", () => {
    const report = buildCreateWorkflowDebugReport({
      enabled: true,
      attachments: [
        {
          id: "attachment-1",
          kind: "image",
          referenceId: "reference-1",
          mediaId: "media-1",
          imageUrl: "data:image/jpeg;base64,preview",
          submissionImageUrl: "https://storage.example.com/full.png?token=secret",
          previewStoragePath: "previews/path",
          fullStoragePath: "full/path",
          referenceUrl: "https://example.com/reference.png",
          referenceRenderUrl: null,
          imageFallbackUrls: ["https://example.com/fallback.png"],
          deliveryStatus: "ready",
          deliveryError: null,
        },
      ],
      events: [
        {
          type: "drop_received",
          at: "2026-05-16T00:00:00.000Z",
          payload: { transferTypes: ["Files"] },
        },
        {
          type: "attachment_inserted",
          at: "2026-05-16T00:00:01.000Z",
          payload: { attachmentId: "attachment-1" },
        },
        {
          type: "agent_send_payload_ready",
          at: "2026-05-16T00:00:02.000Z",
          payload: { imageAttachmentIds: ["attachment-1"] },
        },
      ],
    });

    expect(report).toContain("# Create Workflow Debug Report");
    expect(report).toContain("- Attachment count: 1");
    expect(report).toContain("- drop_received: 1");
    expect(report).toContain("- Likely failure class: ready_for_model_send");
    expect(report).toContain("- submissionImageUrl: https:storage.example.com/full.png");
    expect(report).toContain("attachment_inserted");
  });

  it("diagnoses delivery failures", () => {
    const diagnosis = buildCreateWorkflowDebugDiagnosis({
      enabled: true,
      attachments: [
        {
          id: "attachment-1",
          kind: "image",
          deliveryStatus: "failed",
          deliveryError: "Upload failed.",
          imageUrl: "blob:preview",
          submissionImageUrl: null,
        },
      ],
      events: [],
    });

    expect(diagnosis.likelyFailureClass).toBe("delivery_failed");
    expect(diagnosis.blockers).toContain("delivery_failed");
  });
});
