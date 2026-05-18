/**
 * Focused coverage for splitting durable and ephemeral local agent image attachments before send.
 */
import { describe, expect, it, vi } from "vitest";
import { splitAgentImageAttachmentsForSend } from "../ephemeralAttachmentSend";

vi.mock("../../../logic/createWorkflowDebug", () => ({
  recordCreateWorkflowEvent: vi.fn(),
  summarizeCreateWorkflowUrl: (value: string) => value,
}));

describe("splitAgentImageAttachmentsForSend", () => {
  it("keeps durable images separate while promoting ephemeral local model payloads", () => {
    const result = splitAgentImageAttachmentsForSend([
      {
        id: "durable-1",
        kind: "image",
        referenceUrl: "https://cdn.test/durable.png",
      },
      {
        id: "ephemeral-1",
        kind: "image",
        source: "ephemeral_local",
        imageUrl: "data:image/png;base64,preview",
        modelDataUrl: "data:image/png;base64,model",
      },
    ]);

    expect(result.imageAttachmentIds).toEqual(["durable-1", "ephemeral-1"]);
    expect(result.durableImageAttachmentIds).toEqual(["durable-1"]);
    expect(result.ephemeralImageUrls.get("ephemeral-1")).toBe("data:image/png;base64,model");
    expect(result.failedEphemeralImageIds).toEqual([]);
  });

  it("fails closed when an ephemeral local image lacks a model payload", () => {
    const result = splitAgentImageAttachmentsForSend([
      {
        id: "ephemeral-1",
        kind: "image",
        source: "ephemeral_local",
        imageUrl: "data:image/png;base64,preview",
        modelDataUrl: null,
      },
    ]);

    expect(result.imageAttachmentIds).toEqual(["ephemeral-1"]);
    expect(result.durableImageAttachmentIds).toEqual([]);
    expect(result.ephemeralImageUrls.size).toBe(0);
    expect(result.failedEphemeralImageIds).toEqual(["ephemeral-1"]);
  });
});
