import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveAgentAttachmentPreviewUrlMock = vi.hoisted(() => vi.fn(async () => null));

vi.mock("../../../logic/agentAttachmentImage", async () => {
  const actual = await vi.importActual<typeof import("../../../logic/agentAttachmentImage")>(
    "../../../logic/agentAttachmentImage"
  );
  return {
    ...actual,
    resolveAgentAttachmentPreviewUrl: resolveAgentAttachmentPreviewUrlMock,
  };
});

import { AgentComposerAttachmentImage } from "../AgentComposerAttachmentImage";

describe("AgentComposerAttachmentImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAgentAttachmentPreviewUrlMock.mockResolvedValue(null);
  });

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

  it("falls back to the next attachment preview candidate when the first image fails", async () => {
    const attachment = {
      id: "att-1",
      kind: "image" as const,
      referenceId: "out-1",
      imageUrl: "https://example.com/stale.png",
      imageFallbackUrls: ["https://example.com/fallback.png"],
      text: null,
      aspect: null,
    };

    const { container } = render(<AgentComposerAttachmentImage attachment={attachment} />);

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://example.com/stale.png");

    fireEvent.error(img as HTMLImageElement);

    await waitFor(() => {
      expect(img?.getAttribute("src")).toBe("https://example.com/fallback.png");
    });
  });

  it("keeps the recovered fallback preview across rerenders with equivalent candidates", async () => {
    const attachment = {
      id: "att-1",
      kind: "image" as const,
      referenceId: "out-1",
      imageUrl: "https://example.com/stale.png",
      imageFallbackUrls: ["https://example.com/fallback.png"],
      text: null,
      aspect: null,
    };

    const { container, rerender } = render(
      <AgentComposerAttachmentImage attachment={attachment} />
    );

    const img = container.querySelector("img");
    fireEvent.error(img as HTMLImageElement);

    await waitFor(() => {
      expect(img?.getAttribute("src")).toBe("https://example.com/fallback.png");
    });

    rerender(
      <AgentComposerAttachmentImage
        attachment={{
          ...attachment,
          imageFallbackUrls: [...attachment.imageFallbackUrls],
        }}
      />
    );

    await waitFor(() => {
      expect(img?.getAttribute("src")).toBe("https://example.com/fallback.png");
    });
  });

  it("repairs the preview from attachment identity when no url candidate survives", async () => {
    resolveAgentAttachmentPreviewUrlMock.mockResolvedValue("https://example.com/repaired.png");

    const attachment = {
      id: "att-1",
      kind: "image" as const,
      referenceId: "out-1",
      imageUrl: "https://example.com/stale.png",
      imageFallbackUrls: [],
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      text: null,
      aspect: null,
    };

    const { container } = render(<AgentComposerAttachmentImage attachment={attachment} />);

    const img = container.querySelector("img");
    fireEvent.error(img as HTMLImageElement);

    await waitFor(() => {
      expect(img?.getAttribute("src")).toBe("https://example.com/repaired.png");
    });

    expect(resolveAgentAttachmentPreviewUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        previewStoragePath: "user-1/generated/preview.png",
        fullStoragePath: "user-1/generated/full.png",
        imageUrl: "https://example.com/stale.png",
      })
    );
  });
});
