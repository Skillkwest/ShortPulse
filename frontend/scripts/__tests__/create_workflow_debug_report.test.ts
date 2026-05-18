import { describe, expect, it } from "vitest";
import {
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
          submissionImageUrl: "blob:submission",
          previewStoragePath: "previews/path",
          fullStoragePath: "full/path",
          referenceUrl: "https://example.com/reference.png",
          referenceRenderUrl: null,
          imageFallbackUrls: ["https://example.com/fallback.png"],
          deliveryStatus: "pending",
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
      ],
    });

    expect(report).toContain("# Create Workflow Debug Report");
    expect(report).toContain("- Attachment count: 1");
    expect(report).toContain("- drop_received: 1");
    expect(report).toContain("- submissionImageUrl: blob:submission");
    expect(report).toContain("attachment_inserted");
  });
});
