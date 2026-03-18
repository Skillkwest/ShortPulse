import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as referenceGridMediaModule from "../../logic/referenceGridMedia";
import { DetailModal } from "../DetailModal";
import type { StudioOutput } from "../../types";

const baseOutput: StudioOutput = {
  id: "out-1",
  prompt: "A cinematic portrait.",
  mode: "image",
  aspect: "9:16",
  model: "Seedream 4.5 Edit",
  modelId: "fal-ai/bytedance/seedream/v4.5/edit",
  status: "ready",
  timestamp: "Submitted",
  previewUrl: "https://cdn.test/preview.png",
  previewStoragePath: "user-1/media/variants/preview.png",
  fullStoragePath: "user-1/media/full.png",
};

describe("DetailModal full-quality media policy", () => {
  it("prefers the resolved full URL for the primary image display", () => {
    const resolveSpy = vi
      .spyOn(referenceGridMediaModule, "resolveReferenceCardUrls")
      .mockReturnValue({
        previewUrl: "https://signed.test/preview.png",
        fullUrl: "https://signed.test/full.png",
        previewQualityBand: "high",
        targetLongEdgePx: 960,
      });

    try {
      const { container } = render(
        <DetailModal
          output={baseOutput}
          onClose={vi.fn()}
          onUpdatePrompt={vi.fn()}
          onDeleteOutput={vi.fn()}
        />
      );

      const image = container.querySelector(".art-hero-image") as HTMLImageElement | null;
      expect(image).not.toBeNull();
      expect(image?.getAttribute("src")).toBe("https://signed.test/full.png");
      expect(resolveSpy).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
    } finally {
      resolveSpy.mockRestore();
    }
  });
});
