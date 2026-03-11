/**
 * DetailModal behavior tests.
 * Verifies character attribution rendering for character-mode generated outputs.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DetailModal } from "../DetailModal";
import type { StudioOutput } from "../../types";

const baseOutput: StudioOutput = {
  id: "out-1",
  prompt: "A cozy cinematic lounge portrait.",
  mode: "image",
  aspect: "9:16",
  model: "Seedream 4.5 Edit",
  modelId: "fal-ai/bytedance/seedream/v4.5/edit",
  status: "ready",
  timestamp: "Submitted",
  previewUrl: "https://cdn.test/image.png",
};

describe("DetailModal", () => {
  it("shows character and style attribution with the actual model used", () => {
    render(
      <DetailModal
        output={{
          ...baseOutput,
          characterContext: {
            applied: true,
            characterId: "char-1",
            characterName: "Taylor",
            characterProfileImageUrl: "https://cdn.test/char.png",
          },
          styleContext: {
            applied: true,
            styleId: "photorealistic",
            styleName: "Photorealistic",
            stylePrompt: "photoreal skin texture and natural daylight contrast",
          },
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("Seedream 4.5")).toBeInTheDocument();
    expect(screen.queryByText("Pulse Character")).not.toBeInTheDocument();
    const characterName = screen.getByText("Taylor");
    const promptLabel = screen.getByText("PROMPT");
    expect(characterName).toBeInTheDocument();
    expect(screen.getByAltText("Taylor profile")).toBeInTheDocument();
    const styleName = screen.getByText("Photorealistic");
    expect(styleName).toBeInTheDocument();
    expect(screen.getByLabelText("Style used for generation")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy Prompt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save prompt" })).not.toBeInTheDocument();
    expect(characterName.compareDocumentPosition(promptLabel)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(styleName.compareDocumentPosition(promptLabel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("shows Save Prompt action in prompt-only mode and saves the edited prompt", () => {
    const onSavePrompt = vi.fn();
    render(
      <DetailModal
        output={{
          ...baseOutput,
          mode: "text",
          previewUrl: undefined,
          prompt: "Original prompt",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onSavePrompt={onSavePrompt}
      />
    );

    const promptTextarea = screen.getByPlaceholderText("Describe your adjustments...");
    fireEvent.change(promptTextarea, { target: { value: "Updated prompt for library" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Prompt" }));
    expect(onSavePrompt).toHaveBeenCalledWith("Updated prompt for library");
    expect(screen.getByRole("button", { name: "Saved" })).toBeInTheDocument();
  });

  it("routes download button clicks through the provided download callback", () => {
    const onDownloadReference = vi.fn();
    render(
      <DetailModal
        output={baseOutput}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
        onDownloadReference={onDownloadReference}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(onDownloadReference).toHaveBeenCalledWith("out-1");
  });

  it("keeps image previews fit-to-screen on open and does not zoom in on double-click", () => {
    const { container } = render(
      <DetailModal
        output={baseOutput}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const vessel = container.querySelector(".art-image-vessel");
    expect(vessel).not.toBeNull();
    if (!vessel) return;

    expect(vessel.classList.contains("is-zoomed")).toBe(false);
    fireEvent.doubleClick(vessel);
    expect(vessel.classList.contains("is-zoomed")).toBe(false);
  });

  it("treats uploaded image blob URLs as images instead of videos", () => {
    const { container } = render(
      <DetailModal
        output={{
          ...baseOutput,
          previewUrl: "blob:https://shortpulse.test/reference-image-1",
          timestamp: "Dropped",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("Image")).toBeInTheDocument();
    const headerPill = container.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("Image");
    expect(container.querySelector("video.art-hero-image")).toBeNull();
    expect(container.querySelector("img.art-hero-image")).not.toBeNull();
  });

  it("shows only media type in the header for non-generated library media", () => {
    const { container } = render(
      <DetailModal
        output={{
          ...baseOutput,
          mediaSource: "library",
          model: "my-uploaded-file.png",
          prompt: "my-uploaded-file.png",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = container.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("Image");
  });

  it("shows only media type in the header for media loaded from library modal even when source media was generated", () => {
    const { container } = render(
      <DetailModal
        output={{
          ...baseOutput,
          id: "library-123",
          mediaSource: "generated",
          model: "my-uploaded-file.png",
          prompt: "my-uploaded-file.png",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const headerPill = container.querySelector(".art-modal-meta-pill");
    expect(headerPill?.textContent?.replace(/\s+/g, " ").trim()).toBe("Image");
  });

  it("keeps image mode previews as images when URL paths contain video-like segments", () => {
    const { container } = render(
      <DetailModal
        output={{
          ...baseOutput,
          mode: "image",
          previewUrl:
            "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/uploads/videos/reference_asset_12345?token=abc123",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(container.querySelector("video.art-hero-image")).toBeNull();
    expect(container.querySelector("img.art-hero-image")).not.toBeNull();
  });

  it("falls back to an alternative result URL when the first image does not match the output aspect", async () => {
    const { container } = render(
      <DetailModal
        output={{
          ...baseOutput,
          aspect: "5:4",
          previewUrl: "https://cdn.test/wrong-portrait.png",
          resultUrls: ["https://cdn.test/wrong-portrait.png", "https://cdn.test/correct-5x4.png"],
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const firstImage = container.querySelector(".art-hero-image") as HTMLImageElement | null;
    expect(firstImage).not.toBeNull();
    if (!firstImage) return;

    Object.defineProperty(firstImage, "naturalWidth", { configurable: true, value: 800 });
    Object.defineProperty(firstImage, "naturalHeight", { configurable: true, value: 1000 });
    fireEvent.load(firstImage);

    await waitFor(() => {
      const nextImage = container.querySelector(".art-hero-image") as HTMLImageElement | null;
      expect(nextImage).not.toBeNull();
      expect(nextImage?.getAttribute("src")).toBe("https://cdn.test/correct-5x4.png");
    });
  });

  it("uses full storage media URL for detail rendering when available", () => {
    const { container } = render(
      <DetailModal
        output={{
          ...baseOutput,
          previewStoragePath: "https://cdn.test/preview-low.jpg",
          fullStoragePath: "https://cdn.test/full-quality.jpg",
          previewUrl: "https://cdn.test/legacy.jpg",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const image = container.querySelector(".art-hero-image") as HTMLImageElement | null;
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe("https://cdn.test/full-quality.jpg");
  });
});
