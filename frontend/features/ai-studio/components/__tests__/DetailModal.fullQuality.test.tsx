import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as mediaSignedUrlCacheModule from "../../../../lib/mediaSignedUrlCache";
import * as supabaseClientModule from "../../../../lib/supabaseClient";
import * as referenceDownloadModule from "../../logic/referenceDownload";
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

type MockImageInstance = {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
};

const installDeferredImagePreloadMock = () => {
  const originalImage = globalThis.Image;
  const imageInstances: MockImageInstance[] = [];

  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private nextSrc = "";

    get src() {
      return this.nextSrc;
    }

    set src(value: string) {
      this.nextSrc = value;
      imageInstances.push(this);
    }
  }

  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    writable: true,
    value: MockImage,
  });

  return {
    imageInstances,
    restore: () => {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: originalImage,
      });
    },
  };
};

describe("DetailModal full-quality media policy", () => {
  it("prefers the resolved full URL for the primary image display", () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          previewUrl: "https://signed.test/preview.png",
          previewStoragePath: "https://signed.test/preview.png",
          fullStoragePath: "https://signed.test/full.png",
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const image = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
    expect(image).not.toBeNull();
    expect(image?.getAttribute("src")).toBe("https://signed.test/full.png");
    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
  });

  it("promotes restored generated images to signed canonical media authority", async () => {
    const { imageInstances, restore } = installDeferredImagePreloadMock();
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
        expect(imageInstances.map((instance) => instance.src)).toContain(
          "https://signed.test/generated-output.png"
        );
      });
      const image = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
      expect(image).not.toBeNull();
      expect(image?.getAttribute("src")).toBe("https://provider.test/stale-preview.png");

      act(() => {
        imageInstances
          .filter((instance) => instance.src === "https://signed.test/generated-output.png")
          .at(-1)
          ?.onload?.();
      });

      expect(image?.getAttribute("src")).toBe("https://signed.test/generated-output.png");
      expect(supabaseSpy).toHaveBeenCalled();
      expect(downloadTargetSpy).toHaveBeenCalled();
      expect(signedUrlSpy).toHaveBeenCalledWith({
        bucket: "media_library",
        storagePath: "user-1/generations/images/gen-1/output.png",
        previewProfile: "none",
      });
    } finally {
      restore();
      supabaseSpy.mockRestore();
      downloadTargetSpy.mockRestore();
      signedUrlSpy.mockRestore();
    }
  });

  it("promotes stale provider previews to canonical media by generation id", async () => {
    const { imageInstances, restore } = installDeferredImagePreloadMock();
    const supabaseSpy = vi
      .spyOn(supabaseClientModule, "ensureSupabaseQueryClient")
      .mockReturnValue({} as ReturnType<typeof supabaseClientModule.ensureSupabaseQueryClient>);
    const downloadTargetSpy = vi
      .spyOn(referenceDownloadModule, "resolveReferenceDownloadTarget")
      .mockResolvedValue({
        fileRecord: {
          storagePath: "user-1/generations/images/gen-provider-only/output.png",
          filename: "output.png",
        },
        generationId: "gen-provider-only",
        directUrl: "https://provider.test/stale-preview.png",
      });
    const signedUrlSpy = vi
      .spyOn(mediaSignedUrlCacheModule, "getSignedMediaUrl")
      .mockResolvedValue("https://signed.test/generated-provider-only.png");

    try {
      const { baseElement } = render(
        <DetailModal
          output={{
            ...baseOutput,
            mediaSource: "generated",
            generationId: "gen-provider-only",
            previewUrl: "https://provider.test/stale-preview.png",
            resultUrls: ["https://provider.test/stale-preview.png"],
            previewStoragePath: null,
            fullStoragePath: null,
            savedMediaIds: [],
          }}
          projectId="project-1"
          onClose={vi.fn()}
          onUpdatePrompt={vi.fn()}
          onDeleteOutput={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(imageInstances.map((instance) => instance.src)).toContain(
          "https://signed.test/generated-provider-only.png"
        );
      });
      const image = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
      expect(image).not.toBeNull();
      expect(image?.getAttribute("src")).toBe("https://provider.test/stale-preview.png");

      act(() => {
        imageInstances
          .filter((instance) => instance.src === "https://signed.test/generated-provider-only.png")
          .at(-1)
          ?.onload?.();
      });

      expect(image?.getAttribute("src")).toBe("https://signed.test/generated-provider-only.png");
      expect(downloadTargetSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "project-1",
        })
      );
      expect(signedUrlSpy).toHaveBeenCalledWith({
        bucket: "media_library",
        storagePath: "user-1/generations/images/gen-provider-only/output.png",
        previewProfile: "none",
      });
    } finally {
      restore();
      supabaseSpy.mockRestore();
      downloadTargetSpy.mockRestore();
      signedUrlSpy.mockRestore();
    }
  });

  it("recovers generated detail media when the restored output starts without preview candidates", async () => {
    const supabaseSpy = vi
      .spyOn(supabaseClientModule, "ensureSupabaseQueryClient")
      .mockReturnValue({} as ReturnType<typeof supabaseClientModule.ensureSupabaseQueryClient>);
    const downloadTargetSpy = vi
      .spyOn(referenceDownloadModule, "resolveReferenceDownloadTarget")
      .mockResolvedValue({
        fileRecord: {
          storagePath: "user-1/generations/images/gen-2/output.png",
          filename: "output.png",
        },
        generationId: "gen-2",
        directUrl: null,
      });
    const signedUrlSpy = vi
      .spyOn(mediaSignedUrlCacheModule, "getSignedMediaUrl")
      .mockResolvedValue("https://signed.test/generated-output-2.png");

    try {
      const { baseElement } = render(
        <DetailModal
          output={{
            ...baseOutput,
            mediaSource: "generated",
            generationId: "gen-2",
            previewUrl: undefined,
            resultUrls: [],
            previewStoragePath: null,
            fullStoragePath: null,
            savedMediaIds: [],
          }}
          projectId="project-1"
          onClose={vi.fn()}
          onUpdatePrompt={vi.fn()}
          onDeleteOutput={vi.fn()}
        />
      );

      expect(screen.getByText("Loading media...")).toBeInTheDocument();
      expect(screen.queryByText("Media unavailable.")).not.toBeInTheDocument();

      await waitFor(() => {
        const image = baseElement.querySelector(".art-hero-image") as HTMLImageElement | null;
        expect(image).not.toBeNull();
        expect(image?.getAttribute("src")).toBe("https://signed.test/generated-output-2.png");
      });
      expect(screen.queryByText("Media unavailable.")).not.toBeInTheDocument();
      expect(supabaseSpy).toHaveBeenCalled();
      expect(downloadTargetSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: "project-1",
        })
      );
      expect(signedUrlSpy).toHaveBeenCalledWith({
        bucket: "media_library",
        storagePath: "user-1/generations/images/gen-2/output.png",
        previewProfile: "none",
      });
    } finally {
      supabaseSpy.mockRestore();
      downloadTargetSpy.mockRestore();
      signedUrlSpy.mockRestore();
    }
  });

  it("uses playable video as src and poster media only as the video poster", () => {
    const { baseElement } = render(
      <DetailModal
        output={{
          ...baseOutput,
          id: "video-out-1",
          mode: "video",
          prompt: "A cinematic clip.",
          previewUrl: "https://signed.test/video-poster.webp",
          previewPosterUrl: "https://signed.test/video-poster.webp",
          previewStoragePath: "https://signed.test/video-preview-loop.mp4",
          previewPosterStoragePath: "https://signed.test/video-poster.webp",
          fullStoragePath: "https://signed.test/video-full.mp4",
          resultUrls: ["https://signed.test/video-full.mp4"],
        }}
        onClose={vi.fn()}
        onUpdatePrompt={vi.fn()}
        onDeleteOutput={vi.fn()}
      />
    );

    const video = baseElement.querySelector("video.art-hero-image") as HTMLVideoElement | null;
    expect(video).not.toBeNull();
    expect(video?.getAttribute("src")).toBe("https://signed.test/video-full.mp4");
    expect(video?.getAttribute("poster")).toBe("https://signed.test/video-poster.webp");
    expect(video?.getAttribute("src")).not.toBe(video?.getAttribute("poster"));
  });
});
