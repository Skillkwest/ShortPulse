import { readFileSync } from "node:fs";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SharedMediaDetailItemBase } from "../detail-modal/detailModalPlatformTypes";
import { SharedMediaDetailPreviewMedia } from "../detail-modal/SharedMediaDetailPreviewMedia";
import { SharedMediaDetailPreviewModal } from "../detail-modal/SharedMediaDetailPreviewModal";

type MockImageInstance = {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
};

const aiStudioModalStylesheet = readFileSync("styles/ai-studio-modals.css", "utf8");

const extractCssRule = (selector: string): string => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = aiStudioModalStylesheet.match(new RegExp(`${escapedSelector}\\s*{(?<body>[^}]*)}`));
  return match?.groups?.body ?? "";
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

describe("SharedMediaDetailPreviewModal layout contract", () => {
  it("bounds the prompt blade textarea so long prompts scroll inside the side panel", () => {
    const promptBladeRule = extractCssRule(".art-prompt-blade");
    const promptTextareaRule = extractCssRule(".art-blade-textarea");

    expect(promptBladeRule).toContain("overflow: hidden");
    expect(promptTextareaRule).toContain("flex: 1 1 auto");
    expect(promptTextareaRule).toContain("min-height: 0");
    expect(promptTextareaRule).toContain("overflow-y: auto");
    expect(promptTextareaRule).not.toContain("height: 100%");
  });
});

describe("SharedMediaDetailPreviewMedia image stability", () => {
  const originalImage = globalThis.Image;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: originalImage,
    });
  });

  it("keeps the current image visible while the same item promotes to a new image URL", () => {
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

    const previewUrl = "https://cdn.example.com/generated-preview.jpg";
    const fullUrl = "https://cdn.example.com/generated-full.jpg";
    const { rerender } = render(
      <SharedMediaDetailPreviewMedia
        mediaUrl={previewUrl}
        mediaKind="image"
        altText="Generated image"
        imageClassName="art-hero-image"
        imageIdentityKey="out-1"
      />
    );

    expect(screen.getByAltText("Generated image")).toHaveAttribute("src", previewUrl);

    rerender(
      <SharedMediaDetailPreviewMedia
        mediaUrl={fullUrl}
        mediaKind="image"
        altText="Generated image"
        imageClassName="art-hero-image"
        imageIdentityKey="out-1"
      />
    );

    expect(screen.getByAltText("Generated image")).toHaveAttribute("src", previewUrl);
    expect(imageInstances.map((instance) => instance.src)).toContain(fullUrl);

    act(() => {
      imageInstances
        .filter((instance) => instance.src === fullUrl)
        .at(-1)
        ?.onload?.();
    });

    expect(screen.getByAltText("Generated image")).toHaveAttribute("src", fullUrl);
  });

  it("keeps the current image visible when the same item temporarily has no candidate URL", () => {
    const previewUrl = "https://cdn.example.com/generated-preview.jpg";
    const { rerender } = render(
      <SharedMediaDetailPreviewMedia
        mediaUrl={previewUrl}
        mediaKind="image"
        altText="Generated image"
        imageClassName="art-hero-image"
        imageIdentityKey="out-1"
      />
    );

    expect(screen.getByAltText("Generated image")).toHaveAttribute("src", previewUrl);

    rerender(
      <SharedMediaDetailPreviewMedia
        mediaUrl={null}
        mediaKind="image"
        altText="Generated image"
        imageClassName="art-hero-image"
        imageIdentityKey="out-1"
      />
    );

    expect(screen.getByAltText("Generated image")).toHaveAttribute("src", previewUrl);
    expect(screen.queryByText("Preview unavailable.")).not.toBeInTheDocument();
  });

  it("switches immediately when the selected image identity changes", () => {
    const { rerender } = render(
      <SharedMediaDetailPreviewMedia
        mediaUrl="https://cdn.example.com/first.jpg"
        mediaKind="image"
        altText="Generated image"
        imageClassName="art-hero-image"
        imageIdentityKey="out-1"
      />
    );

    rerender(
      <SharedMediaDetailPreviewMedia
        mediaUrl="https://cdn.example.com/second.jpg"
        mediaKind="image"
        altText="Generated image"
        imageClassName="art-hero-image"
        imageIdentityKey="out-2"
      />
    );

    expect(screen.getByAltText("Generated image")).toHaveAttribute(
      "src",
      "https://cdn.example.com/second.jpg"
    );
  });
});
