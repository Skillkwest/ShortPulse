import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentComposerAttachmentImage } from "../AgentComposerAttachmentImage";

const { resolveAgentAttachmentPreviewUrlMock } = vi.hoisted(() => ({
  resolveAgentAttachmentPreviewUrlMock: vi.fn(async () => null),
}));

vi.mock("../../../logic/agentAttachmentImage", () => ({
  buildAgentAttachmentImageCandidates: (attachment: {
    imageUrl?: string | null;
    imageFallbackUrls?: string[] | null;
  }) =>
    [attachment.imageUrl, ...(attachment.imageFallbackUrls ?? [])].filter(
      (value): value is string => Boolean(value)
    ),
  resolveAgentAttachmentPreviewUrl: resolveAgentAttachmentPreviewUrlMock,
}));

describe("AgentComposerAttachmentImage", () => {
  it("does not replace the staged image with an asynchronously resolved fallback url", async () => {
    resolveAgentAttachmentPreviewUrlMock.mockResolvedValueOnce("https://example.com/resolved.png");

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

    await waitFor(() => {
      const img = container.querySelector("img");
      expect(img?.getAttribute("src")).toBe("https://example.com/staged.png");
    });
  });

  it("keeps the active fallback after rerenders with the same attachment data", () => {
    const attachment = {
      id: "att-1",
      kind: "image" as const,
      referenceId: "out-1",
      imageUrl: "https://example.com/broken.png",
      imageFallbackUrls: ["https://example.com/fallback.png"],
      text: null,
      aspect: null,
    };

    const { container, rerender } = render(
      <AgentComposerAttachmentImage attachment={attachment} />
    );

    const firstImg = container.querySelector("img");
    expect(firstImg?.getAttribute("src")).toBe("https://example.com/broken.png");

    fireEvent.error(firstImg as HTMLImageElement);

    const fallbackImg = container.querySelector("img");
    expect(fallbackImg?.getAttribute("src")).toBe("https://example.com/fallback.png");

    rerender(<AgentComposerAttachmentImage attachment={{ ...attachment }} />);

    const rerenderedImg = container.querySelector("img");
    expect(rerenderedImg?.getAttribute("src")).toBe("https://example.com/fallback.png");
  });
});
