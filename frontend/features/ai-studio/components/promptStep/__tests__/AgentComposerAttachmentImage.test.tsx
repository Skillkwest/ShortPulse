import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentComposerAttachmentImage } from "../AgentComposerAttachmentImage";

describe("AgentComposerAttachmentImage", () => {
  it("renders the staged image url directly", () => {
    const attachment = {
      id: "att-1",
      kind: "image" as const,
      referenceId: "out-1",
      imageUrl: "https://example.com/staged.png",
      imageFallbackUrls: [],
      text: null,
      aspect: null,
    };

    const { container } = render(<AgentComposerAttachmentImage attachment={attachment} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://example.com/staged.png");
  });

  it("falls back to one legacy compatibility preview when imageUrl is missing", () => {
    const attachment = {
      id: "att-1",
      kind: "image" as const,
      referenceId: "out-1",
      imageUrl: null,
      imageFallbackUrls: [],
      referenceRenderUrl: "https://example.com/fallback.png",
      text: null,
      aspect: null,
    };

    const { container } = render(<AgentComposerAttachmentImage attachment={attachment} />);

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://example.com/fallback.png");
  });
});
