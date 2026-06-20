import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SharedMediaDetailItemBase } from "../detail-modal/detailModalPlatformTypes";
import { SharedMediaDetailPreviewModal } from "../detail-modal/SharedMediaDetailPreviewModal";

type MockImageInstance = {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
};

const createImageItem = ({
  url,
  previewUrl,
  fullUrl,
}: {
  url: string;
  previewUrl: string | null;
  fullUrl: string | null;
}): SharedMediaDetailItemBase => ({
  surface: "media-library-panel",
  selectionTarget: {
    kind: "media-file",
    fileId: "image-1",
    surface: "media-library-panel",
  },
  capabilities: {
    canSaveToLibrary: false,
    canDownload: true,
    canDelete: false,
    canEditPrompt: false,
    canSavePrompt: false,
    canShowCharacterContext: false,
    canShowStyleContext: false,
  },
  media: {
    id: "image-1",
    kind: "image",
    url,
    previewUrl,
    fullUrl,
    filename: "city-frame.png",
    source: "ai_studio",
  },
});

describe("SharedMediaDetailPreviewModal image stability", () => {
  const originalImage = globalThis.Image;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: originalImage,
    });
  });

  it("keeps the rendered preview visible until a promoted full-quality image has loaded", async () => {
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

    const previewUrl = "https://cdn.example.com/preview-city-frame.jpg";
    const fullUrl = "https://cdn.example.com/full-city-frame.jpg";
    const { rerender } = render(
      <SharedMediaDetailPreviewModal
        item={createImageItem({
          url: previewUrl,
          previewUrl,
          fullUrl: null,
        })}
        onClose={vi.fn()}
      />
    );

    const image = await screen.findByAltText("city-frame.png");
    expect(image).toHaveAttribute("src", previewUrl);

    rerender(
      <SharedMediaDetailPreviewModal
        item={createImageItem({
          url: fullUrl,
          previewUrl,
          fullUrl,
        })}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByAltText("city-frame.png")).toHaveAttribute("src", previewUrl);
    await waitFor(() => {
      expect(imageInstances.map((instance) => instance.src)).toContain(fullUrl);
    });

    rerender(
      <SharedMediaDetailPreviewModal
        item={createImageItem({
          url: fullUrl,
          previewUrl,
          fullUrl,
        })}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByAltText("city-frame.png")).toHaveAttribute("src", previewUrl);

    act(() => {
      imageInstances
        .filter((instance) => instance.src === fullUrl)
        .at(-1)
        ?.onload?.();
    });

    expect(screen.getByAltText("city-frame.png")).toHaveAttribute("src", fullUrl);
  });
});
