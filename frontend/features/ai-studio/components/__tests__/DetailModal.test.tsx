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
  it("shows character attribution and Pulse Character model when character mode was applied", () => {
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
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    expect(screen.getByText("Pulse Character")).toBeInTheDocument();
    const characterName = screen.getByText("Taylor");
    const promptLabel = screen.getByText("PROMPT");
    expect(characterName).toBeInTheDocument();
    expect(screen.getByAltText("Taylor profile")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy Prompt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save prompt" })).not.toBeInTheDocument();
    expect(characterName.compareDocumentPosition(promptLabel)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
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
});
