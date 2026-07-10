import { describe, expect, it } from "vitest";
import type { AgentAttachment } from "../../../../prefabs/agent";
import { planAgentAttachmentInsertion } from "../agentAttachmentCapacity";

const image = (index: number): AgentAttachment => ({
  id: `image-${index}`,
  kind: "image",
  referenceId: `ref-${index}`,
  imageUrl: `https://example.test/${index}.png`,
});

describe("agentAttachmentCapacity", () => {
  it("accepts ten images and rejects image eleven without eviction", () => {
    let attachments: AgentAttachment[] = [];
    for (let index = 1; index <= 10; index += 1) {
      const result = planAgentAttachmentInsertion({ attachments, attachment: image(index) });
      expect(result.accepted).toBe(true);
      attachments = result.attachments;
    }
    const rejected = planAgentAttachmentInsertion({ attachments, attachment: image(11) });
    expect(rejected.accepted).toBe(false);
    expect(rejected.rejection).toBe("image_limit");
    expect(rejected.attachments.map((attachment) => attachment.id)).toEqual(
      Array.from({ length: 10 }, (_, index) => `image-${index + 1}`)
    );
  });

  it("refreshes a duplicate image in place at capacity", () => {
    const attachments = Array.from({ length: 10 }, (_, index) => image(index + 1));
    const refreshed = planAgentAttachmentInsertion({
      attachments,
      attachment: {
        ...image(1),
        id: "new-id",
        imageUrl: "https://example.test/refreshed.png",
      },
    });
    expect(refreshed.accepted).toBe(true);
    expect(refreshed.attachments).toHaveLength(10);
    expect(refreshed.attachments[0]).toMatchObject({
      id: "image-1",
      imageUrl: "https://example.test/refreshed.png",
    });
  });

  it("preserves ten prompt attachments alongside ten images", () => {
    let attachments: AgentAttachment[] = Array.from({ length: 10 }, (_, index) => image(index + 1));
    for (let index = 1; index <= 10; index += 1) {
      const result = planAgentAttachmentInsertion({
        attachments,
        attachment: {
          id: `prompt-${index}`,
          kind: "prompt",
          referenceId: `prompt-ref-${index}`,
          text: `Prompt ${index}`,
        },
      });
      expect(result.accepted).toBe(true);
      attachments = result.attachments;
    }
    expect(attachments).toHaveLength(20);
  });
});
