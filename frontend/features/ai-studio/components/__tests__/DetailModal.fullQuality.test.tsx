import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as mediaSignedUrlCacheModule from "../../../../lib/mediaSignedUrlCache";
import * as supabaseClientModule from "../../../../lib/supabaseClient";
import * as referenceDownloadModule from "../../logic/referenceDownload";
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
        authorityTier: "reusable",
        previewQualityBand: "high",
        targetLongEdgePx: 960,
      });

    try {
      const { baseElement } = render(
        <DetailModal
          output={baseOutput}
          onClose={vi.fn()}
          onUpdatePrompt={vi.fn()}
          onDeleteOutput={vi.fn()}
        />
      );

      const image = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
      expect(image).not.toBeNull();
      expect(image?.getAttribute("src")).toBe("https://signed.test/full.png");
      expect(resolveSpy).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
    } finally {
      resolveSpy.mockRestore();
    }
  });

  it("promotes restored generated images to signed canonical media authority", async () => {
    const resolveSpy = vi
      .spyOn(referenceGridMediaModule, "resolveReferenceCardUrls")
      .mockReturnValue({
        previewUrl: "https://provider.test/stale-preview.png",
        fullUrl: null,
        authorityTier: "preview-only",
        previewQualityBand: "high",
        targetLongEdgePx: 960,
      });
    const supabaseSpy = vi
      .spyOn(supabaseClientModule, "ensureSupabaseQueryClient")
      .mockReturnValue({} as ReturnType<typeof supabaseClientModule.ensureSupabaseQueryClient>);
    const downloadTargetSpy = vi
      .spyOn(referenceDownloadModule, "resolveReferenceDownloadTarget")
      .mockResolvedValue({
        fileRecord: {
          storagePath: "user-1/generations/images/gen-1/output.png",
          filename: "output.png",
        },
        generationId: "gen-1",
        directUrl: "https://provider.test/stale-preview.png",
      });
    const signedUrlSpy = vi
      .spyOn(mediaSignedUrlCacheModule, "getSignedMediaUrl")
      .mockResolvedValue("https://signed.test/generated-output.png");

    try {
      const { baseElement } = render(
        <DetailModal
          output={{
            ...baseOutput,
            mediaSource: "generated",
            generationId: "gen-1",
            previewUrl: "https://provider.test/stale-preview.png",
            resultUrls: ["https://provider.test/stale-preview.png"],
            previewStoragePath: "user-1/generations/images/gen-1/output.png",
            fullStoragePath: "user-1/generations/images/gen-1/output.png",
          }}
          onClose={vi.fn()}
          onUpdatePrompt={vi.fn()}
          onDeleteOutput={vi.fn()}
        />
      );

      await waitFor(() => {
        const image = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
        expect(image).not.toBeNull();
        expect(image?.getAttribute("src")).toBe("https://signed.test/generated-output.png");
      });
      expect(resolveSpy).toHaveBeenCalled();
      expect(supabaseSpy).toHaveBeenCalled();
      expect(downloadTargetSpy).toHaveBeenCalled();
      expect(signedUrlSpy).toHaveBeenCalledWith({
        bucket: "media_library",
        storagePath: "user-1/generations/images/gen-1/output.png",
        previewProfile: "none",
      });
    } finally {
      resolveSpy.mockRestore();
      supabaseSpy.mockRestore();
      downloadTargetSpy.mockRestore();
      signedUrlSpy.mockRestore();
    }
  });
});
