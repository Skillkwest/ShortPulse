import { describe, expect, it } from "vitest";
import {
  analyzeCreateWorkflowSnapshot,
  buildCreateWorkflowCaptureReport,
  parseArgs,
} from "../create_workflow_capture_ingest.mjs";

const snapshot = {
  enabled: true,
  attachments: [
    {
      id: "attachment-1",
      kind: "image",
      imageUrl: "blob:preview",
      submissionImageUrl: "https://storage.example.com/full.png",
      deliveryStatus: "ready",
    },
  ],
  events: [
    {
      type: "drop_received",
      at: "2026-05-16T00:00:00.000Z",
      payload: { transferTypes: ["Files"] },
    },
    {
      type: "preview_resolved_source_changed",
      at: "2026-05-16T00:00:01.000Z",
      payload: { resolvedSrc: "data:image/jpeg;base64,abc" },
    },
    {
      type: "preview_img_error",
      at: "2026-05-16T00:00:02.000Z",
      payload: { resolvedSrc: "data:image/jpeg;base64,abc" },
    },
    {
      type: "agent_send_payload_ready",
      at: "2026-05-16T00:00:04.000Z",
      payload: { imageAttachmentIds: ["attachment-1"] },
    },
    {
      type: "preview_resolved_source_changed",
      at: "2026-05-16T00:00:05.000Z",
      payload: { resolvedSrc: null },
    },
  ],
};

describe("create_workflow_capture_ingest", () => {
  it("parses CLI args", () => {
    expect(parseArgs(["snapshot.json", "--incident-id", "incident-1", "--label", "prod"])).toEqual(
      expect.objectContaining({
        inputPath: "snapshot.json",
        incidentId: "incident-1",
        label: "prod",
      })
    );
  });

  it("analyzes a captured snapshot", () => {
    const analysis = analyzeCreateWorkflowSnapshot(snapshot, "incident-1");

    expect(analysis.incidentId).toBe("incident-1");
    expect(analysis.attachmentCount).toBe(1);
    expect(analysis.imageUrlPresentAtEnd).toBe(true);
    expect(analysis.submissionImageUrlPresentAtEnd).toBe(true);
    expect(analysis.durableSubmissionImageUrlPresentAtEnd).toBe(true);
    expect(analysis.sendPayloadReadyCount).toBe(1);
    expect(analysis.previewErrorCount).toBe(1);
    expect(analysis.previewResolvedToNullCount).toBe(1);
    expect(analysis.likelySignals).toContain("preview_resolved_to_null");
  });

  it("builds a readable capture report", () => {
    const analysis = analyzeCreateWorkflowSnapshot(snapshot, "incident-1");
    const report = buildCreateWorkflowCaptureReport(analysis, snapshot);

    expect(report).toContain("# Create Workflow Capture Analysis");
    expect(report).toContain("- Incident: incident-1");
    expect(report).toContain("- durable submissionImageUrl present at end: yes");
    expect(report).toContain("- Send payload ready events: 1");
    expect(report).toContain("Embedded Debug Report");
  });
});
