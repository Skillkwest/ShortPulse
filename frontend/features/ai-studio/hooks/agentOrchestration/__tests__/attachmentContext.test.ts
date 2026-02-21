import { describe, expect, it } from "vitest";
import { mergeAttachmentContext } from "../attachmentContext";

describe("mergeAttachmentContext", () => {
  it("keeps agent-output focus for prompt-only attachments when canonical context exists", () => {
    const context = mergeAttachmentContext({
      baseContext: {
        activePrompt: "A canonical prompt",
        lastAssistantMessage: "A canonical prompt",
        focusedSource: "agent-output",
      },
      attachments: [
        {
          id: "prompt-1",
          kind: "prompt",
          referenceId: "ref-1",
          text: "detail",
          aspect: "1:1",
        },
      ],
      preparedImageUrls: new Map(),
    });

    expect(context.focusedSource).toBe("agent-output");
    expect(context.selectedReferenceIds).toEqual(["ref-1"]);
  });

  it("sets image focus when image attachments are present", () => {
    const context = mergeAttachmentContext({
      baseContext: {
        focusedSource: "agent-output",
      },
      attachments: [
        {
          id: "img-1",
          kind: "image",
          referenceId: "ref-img-1",
          imageUrl: "https://cdn.test/image.png",
          text: "armor concept",
          aspect: "1:1",
        },
      ],
      preparedImageUrls: new Map([["img-1", "https://cdn.test/safe.png"]]),
    });

    expect(context.focusedSource).toBe("image");
    expect(context.media).toEqual([
      {
        id: "ref-img-1",
        kind: "image",
        url: "https://cdn.test/safe.png",
        thumbnailAlt: "armor concept",
      },
    ]);
  });
});
