import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  promptText,
}: {
  url: string;
  previewUrl: string | null;
  fullUrl: string | null;
  promptText?: string | null;
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
    promptText,
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
    const promptScrollFrameRule = extractCssRule(".art-blade-scroll-frame");
    const promptTextareaRule = extractCssRule(".art-blade-textarea");
    const textDetailTextareaRule = extractCssRule(".art-text-detail-textarea");

    expect(promptBladeRule).toContain("overflow: hidden");
    expect(promptScrollFrameRule).toContain("flex: 1 1 auto");
    expect(promptScrollFrameRule).toContain("min-height: 0");
    expect(promptScrollFrameRule).toContain("overflow: hidden");
    expect(promptTextareaRule).toContain("flex: 1 1 auto");
    expect(promptTextareaRule).toContain("min-height: 0");
    expect(promptTextareaRule).toContain("max-height: 100%");
    expect(promptTextareaRule).toContain("overflow-y: auto");
    expect(promptTextareaRule).toContain("overscroll-behavior: contain");
    expect(promptTextareaRule).not.toMatch(/(^|\s)height:\s*100%/);
    expect(textDetailTextareaRule).toContain("max-height: 100%");
    expect(textDetailTextareaRule).toContain("overflow-y: auto");
    expect(textDetailTextareaRule).toContain("overscroll-behavior: contain");
  });

  it("renders long prompt text inside a dedicated scroll frame", () => {
    const longPrompt = Array.from(
      { length: 24 },
      (_, index) => `Scene beat ${index + 1}: preserve the cinematic character and motion language.`
    ).join("\n");

    const { baseElement } = render(
      <SharedMediaDetailPreviewModal
        item={createImageItem({
          url: "https://cdn.example.com/preview-city-frame.jpg",
          previewUrl: "https://cdn.example.com/preview-city-frame.jpg",
          fullUrl: null,
          promptText: longPrompt,
        })}
        onClose={vi.fn()}
      />
    );

    const promptBlade = baseElement.querySelector(".art-prompt-blade") as HTMLDivElement | null;
    const promptScrollFrame = baseElement.querySelector(
      ".art-blade-scroll-frame"
    ) as HTMLDivElement | null;
    const promptTextarea = baseElement.querySelector(
      ".art-blade-textarea"
    ) as HTMLTextAreaElement | null;

    expect(promptBlade).toContainElement(promptScrollFrame);
    expect(promptScrollFrame).toContainElement(promptTextarea);
    expect(promptTextarea).not.toBeNull();
    expect(promptTextarea).toHaveValue(longPrompt);
  });

  it("pins prompt text from the shared media prompt blade", () => {
    const onPinPromptReference = vi.fn();

    render(
      <SharedMediaDetailPreviewModal
        item={createImageItem({
          url: "https://cdn.example.com/preview-city-frame.jpg",
          previewUrl: "https://cdn.example.com/preview-city-frame.jpg",
          fullUrl: null,
          promptText: "  Shared modal prompt  ",
        })}
        onClose={vi.fn()}
        onPinPromptReference={onPinPromptReference}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Pin text reference to reference grid" }));

    expect(onPinPromptReference).toHaveBeenCalledWith("Shared modal prompt");
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
    const onDisplayedImageUrlChange = vi.fn();
    const { rerender } = render(
      <SharedMediaDetailPreviewMedia
        mediaUrl={previewUrl}
        mediaKind="image"
        altText="Generated image"
        imageClassName="art-hero-image"
        imageIdentityKey="out-1"
        onDisplayedImageUrlChange={onDisplayedImageUrlChange}
      />
    );

    expect(screen.getByAltText("Generated image")).toHaveAttribute("src", previewUrl);
    expect(onDisplayedImageUrlChange).toHaveBeenLastCalledWith(previewUrl);
    onDisplayedImageUrlChange.mockClear();

    rerender(
      <SharedMediaDetailPreviewMedia
        mediaUrl={fullUrl}
        mediaKind="image"
        altText="Generated image"
        imageClassName="art-hero-image"
        imageIdentityKey="out-1"
        onDisplayedImageUrlChange={onDisplayedImageUrlChange}
      />
    );

    expect(screen.getByAltText("Generated image")).toHaveAttribute("src", previewUrl);
    expect(imageInstances.map((instance) => instance.src)).toContain(fullUrl);
    expect(onDisplayedImageUrlChange).not.toHaveBeenCalledWith(fullUrl);

    act(() => {
      imageInstances
        .filter((instance) => instance.src === fullUrl)
        .at(-1)
        ?.onload?.();
    });

    expect(screen.getByAltText("Generated image")).toHaveAttribute("src", fullUrl);
    expect(onDisplayedImageUrlChange).toHaveBeenLastCalledWith(fullUrl);
  });

  it("keeps the current image visible when the same item temporarily has no candidate URL", () => {
    const previewUrl = "https://cdn.example.com/generated-preview.jpg";
    const onDisplayedImageUrlChange = vi.fn();
    const { rerender } = render(
      <SharedMediaDetailPreviewMedia
        mediaUrl={previewUrl}
        mediaKind="image"
        altText="Generated image"
        imageClassName="art-hero-image"
        imageIdentityKey="out-1"
        onDisplayedImageUrlChange={onDisplayedImageUrlChange}
      />
    );

    expect(screen.getByAltText("Generated image")).toHaveAttribute("src", previewUrl);
    expect(onDisplayedImageUrlChange).toHaveBeenLastCalledWith(previewUrl);
    onDisplayedImageUrlChange.mockClear();

    rerender(
      <SharedMediaDetailPreviewMedia
        mediaUrl={null}
        mediaKind="image"
        altText="Generated image"
        imageClassName="art-hero-image"
        imageIdentityKey="out-1"
        onDisplayedImageUrlChange={onDisplayedImageUrlChange}
      />
    );

    expect(screen.getByAltText("Generated image")).toHaveAttribute("src", previewUrl);
    expect(screen.queryByText("Preview unavailable.")).not.toBeInTheDocument();
    expect(onDisplayedImageUrlChange).not.toHaveBeenCalledWith(null);
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

  it("renders companion art as a shared audio detail background", () => {
    const { baseElement } = render(
      <SharedMediaDetailPreviewMedia
        mediaUrl="https://cdn.example.com/generated-audio.mp3"
        mediaKind="audio"
        altText="Generated audio"
        imageClassName="art-hero-image"
        audioBackgroundImageUrl="https://cdn.example.com/generated-audio-cover.webp"
      />
    );

    const preview = baseElement.querySelector(
      ".detail-modal-audio-preview"
    ) as HTMLDivElement | null;
    expect(preview).not.toBeNull();
    expect(preview).toHaveClass("has-companion-art");
    expect(preview?.style.getPropertyValue("--detail-audio-background-image")).toContain(
      "https://cdn.example.com/generated-audio-cover.webp"
    );
  });

  it("rejects Supabase render-image companion art in shared audio detail backgrounds", () => {
    const { baseElement } = render(
      <SharedMediaDetailPreviewMedia
        mediaUrl="https://cdn.example.com/generated-audio.mp3"
        mediaKind="audio"
        altText="Generated audio"
        imageClassName="art-hero-image"
        audioBackgroundImageUrl="https://jwmcytzyhcvacjwqtynn.supabase.co/storage/v1/render/image/sign/media_library/user-1/audio-cover.webp?token=abc123"
      />
    );

    const preview = baseElement.querySelector(
      ".detail-modal-audio-preview"
    ) as HTMLDivElement | null;
    expect(preview).not.toBeNull();
    expect(preview).not.toHaveClass("has-companion-art");
    expect(preview?.style.getPropertyValue("--detail-audio-background-image")).toBe("");
  });
});
