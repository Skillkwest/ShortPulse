import { describe, expect, it } from "vitest";
import { buildStandardCreateAgentContext } from "../standardContextBuilder";

describe("buildStandardCreateAgentContext", () => {
  it("omits Pulse context from Standard Create payloads", () => {
    expect(() =>
      buildStandardCreateAgentContext({
        mode: "text",
        pulse: {
          presetId: "custom",
          label: "Custom Pulse",
          instructions: "Never leak.",
        },
      })
    ).toThrow("Standard Create agent context cannot include Pulse context.");
  });

  it("keeps neutral context fields for Standard Create", () => {
    expect(
      buildStandardCreateAgentContext({
        mode: "image",
        activePrompt: "A calm portrait",
        modelId: "model-1",
        media: [
          { id: "image-1", kind: "image", url: "https://cdn.test/image.png" },
          { id: "image-2", kind: "image", url: "data:image/jpeg;base64,YWJjMTIz" },
          { id: "video-1", kind: "video", url: "https://cdn.test/video.mp4" },
        ],
      })
    ).toEqual(
      expect.objectContaining({
        activePrompt: "A calm portrait",
        modelId: "model-1",
        mode: "image",
        media: [
          { id: "image-1", kind: "image", url: "https://cdn.test/image.png" },
          { id: "image-2", kind: "image", url: "data:image/jpeg;base64,YWJjMTIz" },
        ],
      })
    );
  });
});
