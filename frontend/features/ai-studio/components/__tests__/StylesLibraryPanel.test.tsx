/**
 * StylesLibraryPanel tests.
 * Covers delete affordance visibility and confirm-modal delete behavior.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StylesLibraryPanel } from "../StylesLibraryPanel";
import type { ExpertEditStyleTile } from "../edit/expertEditStyles";
import type { ResolvedInternalStyleSource } from "../style-creator/intake";
import { postExtractStyle, type StyleExtractionResult } from "../../logic/styleExtraction";
import { postGenerateStylePreview } from "../../logic/stylePreviewGeneration";
import { reportAppError } from "../../../../lib/appErrorReporter";

vi.mock("../../logic/styleExtraction", () => ({
  postExtractStyle: vi.fn(),
  isStyleExtractionError: vi.fn(() => false),
}));

vi.mock("../../logic/stylePreviewGeneration", () => ({
  postGenerateStylePreview: vi.fn(),
  isStylePreviewGenerationError: vi.fn((error: unknown) =>
    Boolean(error && typeof error === "object" && (error as { code?: unknown }).code)
  ),
}));

vi.mock("../../../../lib/appErrorReporter", () => ({
  reportAppError: vi.fn().mockResolvedValue(undefined),
}));

const createStyles = (): ExpertEditStyleTile[] => [
  {
    id: "cinematic",
    title: "Cinematic",
    previewUrl: "/Styles/Cinematic.png",
    placeholder: false,
  },
  {
    id: "anime",
    title: "Anime",
    previewUrl: "/Styles/Anime.png",
    placeholder: false,
  },
];

const createStylesWithPlaceholder = (): ExpertEditStyleTile[] => [
  ...createStyles(),
  {
    id: "style-placeholder-1",
    title: "Placeholder 1",
    previewUrl: null,
    placeholder: true,
  },
];

const createStyleExtractionResult = (
  overrides: Partial<StyleExtractionResult> = {}
): StyleExtractionResult => ({
  stylePrompt: "cinematic lighting, shallow depth of field, balanced dynamic range",
  styleTitle: "Noir Bloom",
  attemptCount: 1,
  totalMs: 1100,
  probeMs: 120,
  openAiMs: 820,
  modelUsed: "gpt-4.1-mini",
  ...overrides,
});

describe("StylesLibraryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(postExtractStyle).mockResolvedValue(createStyleExtractionResult());
    vi.mocked(postGenerateStylePreview).mockResolvedValue({
      previewImageUrl: "data:image/jpeg;base64,generated-style-preview",
      modelId: "fal-ai/flux-2/klein/9b",
      size: "1024x1024",
      quality: null,
    });
  });

  it("renders delete action only for non-placeholder styles", () => {
    render(<StylesLibraryPanel styles={createStylesWithPlaceholder()} />);

    expect(screen.getByRole("button", { name: "Delete style: Cinematic" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete style: None" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete style: Placeholder 1" })
    ).not.toBeInTheDocument();
  });

  it("pins none as the first immutable style tile", () => {
    render(<StylesLibraryPanel styles={createStyles()} />);

    const styleButtons = screen.getAllByRole("button", { name: /Style tile:/i });
    expect(styleButtons[0]).toHaveAccessibleName("Style tile: None");

    const noneTile = styleButtons[0].closest("article");
    expect(noneTile).toHaveAttribute("draggable", "false");
    expect(screen.queryByRole("button", { name: "Delete style: None" })).not.toBeInTheDocument();

    fireEvent.click(styleButtons[0]);
    expect(screen.queryByRole("dialog", { name: "Edit style" })).not.toBeInTheDocument();
  });

  it("opens create modal with the trailing add style button", () => {
    render(<StylesLibraryPanel styles={createStyles()} />);

    fireEvent.click(screen.getByRole("button", { name: "Add style" }));

    expect(screen.getByRole("dialog", { name: "Add style" })).toBeInTheDocument();
    expect(screen.getByLabelText("Style")).toHaveValue("Custom Style 1");
    expect(
      screen.getByRole("button", { name: "Drop reference image or click to upload" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Style Prompt")).toHaveValue("");
    expect(screen.getByText("0 / 1000")).toBeInTheDocument();
  });

  it("shows a style prompt character counter and enforces the 1000-char input cap", () => {
    render(<StylesLibraryPanel styles={createStyles()} />);
    fireEvent.click(screen.getByRole("button", { name: "Add style" }));

    const stylePromptInput = screen.getByLabelText("Style Prompt");
    fireEvent.change(stylePromptInput, { target: { value: "a".repeat(950) } });
    expect(screen.getByText("950 / 1000")).toHaveClass("is-near-limit");

    fireEvent.change(stylePromptInput, { target: { value: "a".repeat(1100) } });
    expect(stylePromptInput).toHaveValue("a".repeat(1000));
    expect(screen.getByText("1000 / 1000")).toHaveClass("is-limit-reached");
  });

  it("saves a prompt-only new style, then updates it with a generated preview", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    render(<StylesLibraryPanel styles={createStyles()} onSaveStyleDetails={onSaveStyleDetails} />);

    fireEvent.click(screen.getByRole("button", { name: "Add style" }));
    fireEvent.change(screen.getByLabelText("Style"), { target: { value: "Dream Glow" } });
    fireEvent.change(screen.getByLabelText("Style Prompt"), {
      target: { value: "ethereal highlights and dreamy bloom" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save style" }));

    await waitFor(() => {
      expect(onSaveStyleDetails).toHaveBeenCalledTimes(2);
    });
    const [savedStyleId, savedDetails] = onSaveStyleDetails.mock.calls[0] as [
      string,
      {
        style: string;
        title: string;
        referenceImageName: string;
        stylePrompt: string;
        previewImageUrl: string;
      },
    ];
    expect(savedStyleId).toMatch(/^style-library-custom-/);
    expect(savedDetails).toEqual({
      style: "Dream Glow",
      title: "Dream Glow",
      referenceImageName: "Dream Glow",
      stylePrompt: "ethereal highlights and dreamy bloom",
      previewImageUrl: "",
    });
    expect(postGenerateStylePreview).toHaveBeenCalledWith({
      styleId: savedStyleId,
      styleName: "Dream Glow",
      stylePrompt: "ethereal highlights and dreamy bloom",
    });
    expect(onSaveStyleDetails.mock.calls[1]).toEqual([
      savedStyleId,
      {
        style: "Dream Glow",
        title: "Dream Glow",
        referenceImageName: "Dream Glow",
        stylePrompt: "ethereal highlights and dreamy bloom",
        previewImageUrl: "data:image/jpeg;base64,generated-style-preview",
      },
    ]);
  });

  it("shows a pending style preview state while prompt-only preview generation runs", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    let resolvePreview!: (value: {
      previewImageUrl: string;
      modelId: string;
      size: string;
      quality: string | null;
    }) => void;
    vi.mocked(postGenerateStylePreview).mockReturnValue(
      new Promise((resolve) => {
        resolvePreview = resolve;
      })
    );
    const { rerender } = render(
      <StylesLibraryPanel styles={createStyles()} onSaveStyleDetails={onSaveStyleDetails} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add style" }));
    fireEvent.change(screen.getByLabelText("Style"), { target: { value: "Dream Glow" } });
    fireEvent.change(screen.getByLabelText("Style Prompt"), {
      target: { value: "ethereal highlights and dreamy bloom" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save style" }));

    await waitFor(() => {
      expect(onSaveStyleDetails).toHaveBeenCalledTimes(1);
    });
    const [savedStyleId, savedDetails] = onSaveStyleDetails.mock.calls[0] as [
      string,
      {
        style: string;
        title: string;
        referenceImageName: string;
        stylePrompt: string;
        previewImageUrl: string;
      },
    ];
    rerender(
      <StylesLibraryPanel
        styles={[
          ...createStyles(),
          {
            id: savedStyleId,
            title: savedDetails.title,
            style: savedDetails.style,
            stylePrompt: savedDetails.stylePrompt,
            previewUrl: null,
            placeholder: false,
          },
        ]}
        onSaveStyleDetails={onSaveStyleDetails}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Style tile: Dream Glow (generating)",
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Generating...");

    resolvePreview({
      previewImageUrl: "data:image/jpeg;base64,generated-style-preview",
      modelId: "fal-ai/flux-2/klein/9b",
      size: "1024x1024",
      quality: null,
    });
    await waitFor(() => {
      expect(onSaveStyleDetails).toHaveBeenCalledTimes(2);
    });
  });

  it("keeps a prompt-only style saved when generated preview creation fails", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    const error = new Error("Not enough credits to generate the style preview.") as Error & {
      code: string;
      userMessage: string;
    };
    error.code = "STYLE_PREVIEW_GENERATION_CLIENT_ERROR";
    error.userMessage = "Not enough credits to generate the style preview.";
    vi.mocked(postGenerateStylePreview).mockRejectedValue(error);
    render(<StylesLibraryPanel styles={createStyles()} onSaveStyleDetails={onSaveStyleDetails} />);

    fireEvent.click(screen.getByRole("button", { name: "Add style" }));
    fireEvent.change(screen.getByLabelText("Style"), { target: { value: "Dream Glow" } });
    fireEvent.change(screen.getByLabelText("Style Prompt"), {
      target: { value: "ethereal highlights and dreamy bloom" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save style" }));

    await waitFor(() => {
      expect(onSaveStyleDetails).toHaveBeenCalledTimes(1);
    });
    expect(onSaveStyleDetails.mock.calls[0]?.[1]).toEqual({
      style: "Dream Glow",
      title: "Dream Glow",
      referenceImageName: "Dream Glow",
      stylePrompt: "ethereal highlights and dreamy bloom",
      previewImageUrl: "",
    });
    await waitFor(() => {
      expect(
        screen.getByText("Style saved, but not enough credits to generate the style preview.")
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(
      screen.queryByText("Style saved, but not enough credits to generate the style preview.")
    ).not.toBeInTheDocument();
  });

  it("creates a new style when dropping a desktop image onto the styles library", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    const originalImage = globalThis.Image;
    const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
    const originalCanvasToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    class MockImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 1024;
      naturalHeight = 768;
      width = 1024;
      height = 768;
      set src(_value: string) {
        this.onload?.();
      }
    }
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () =>
        ({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high",
          drawImage: () => undefined,
        }) as unknown as CanvasRenderingContext2D,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: function toDataUrlByCanvasSize() {
        return `data:image/jpeg;base64,${this.width}x${this.height}`;
      },
    });
    try {
      render(
        <StylesLibraryPanel styles={createStyles()} onSaveStyleDetails={onSaveStyleDetails} />
      );

      const panel = screen.getByRole("region", { name: "Styles library" });
      const imageFile = new File(["mock-image-bytes"], "desktop-image.png", { type: "image/png" });
      const transfer = {
        files: [imageFile],
        types: ["Files"],
        getData: vi.fn(() => ""),
        dropEffect: "copy",
        effectAllowed: "copy",
      } as unknown as DataTransfer;

      fireEvent.dragEnter(panel, { dataTransfer: transfer });
      fireEvent.dragOver(panel, { dataTransfer: transfer });
      fireEvent.drop(panel, { dataTransfer: transfer });

      await waitFor(() => {
        expect(onSaveStyleDetails).toHaveBeenCalledTimes(1);
      });
      const [savedStyleId, savedDetails] = onSaveStyleDetails.mock.calls[0] as [
        string,
        {
          style: string;
          title: string;
          referenceImageName: string;
          stylePrompt: string;
          previewImageUrl: string;
        },
      ];
      expect(savedStyleId).toMatch(/^style-library-custom-/);
      expect(savedDetails.style).toBe("Noir Bloom");
      expect(savedDetails.title).toBe("Noir Bloom");
      expect(savedDetails.referenceImageName).toBe("Noir Bloom");
      expect(savedDetails.stylePrompt).toBe(
        "cinematic lighting, shallow depth of field, balanced dynamic range"
      );
      expect(savedDetails.previewImageUrl).toBe("data:image/jpeg;base64,512x512");
      expect(postExtractStyle).toHaveBeenCalledWith("data:image/jpeg;base64,1024x768");
      expect(postExtractStyle).not.toHaveBeenCalledWith("data:image/jpeg;base64,512x512");
      await waitFor(() => {
        expect(reportAppError).toHaveBeenCalledWith(
          expect.objectContaining({
            source: "telemetry.ai_studio.style_extraction",
            message: "style_extraction.success",
            metadata: expect.objectContaining({
              outcome: "success",
              flow: "library_drop",
            }),
          })
        );
      });
    } finally {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: originalImage,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        writable: true,
        value: originalCanvasGetContext,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
        configurable: true,
        writable: true,
        value: originalCanvasToDataUrl,
      });
    }
  });

  it("creates a fallback style when drop extraction fails and shows recovery guidance", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    vi.mocked(postExtractStyle).mockRejectedValue(new Error("Style extraction failed."));
    const originalImage = globalThis.Image;
    const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
    const originalCanvasToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    class MockImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 1024;
      naturalHeight = 768;
      width = 1024;
      height = 768;
      set src(_value: string) {
        this.onload?.();
      }
    }
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () =>
        ({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high",
          drawImage: () => undefined,
        }) as unknown as CanvasRenderingContext2D,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: function toDataUrlByCanvasSize() {
        return `data:image/jpeg;base64,${this.width}x${this.height}`;
      },
    });
    try {
      render(
        <StylesLibraryPanel styles={createStyles()} onSaveStyleDetails={onSaveStyleDetails} />
      );

      const panel = screen.getByRole("region", { name: "Styles library" });
      const imageFile = new File(["mock-image-bytes"], "desktop-image.png", { type: "image/png" });
      const transfer = {
        files: [imageFile],
        types: ["Files"],
        getData: vi.fn(() => ""),
        dropEffect: "copy",
        effectAllowed: "copy",
      } as unknown as DataTransfer;

      fireEvent.dragEnter(panel, { dataTransfer: transfer });
      fireEvent.dragOver(panel, { dataTransfer: transfer });
      fireEvent.drop(panel, { dataTransfer: transfer });

      await waitFor(() => {
        expect(onSaveStyleDetails).toHaveBeenCalledTimes(1);
      });
      expect(onSaveStyleDetails).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          style: "Custom Style 1",
          title: "Custom Style 1",
          referenceImageName: "Custom Style 1",
          stylePrompt: "",
        })
      );
      expect(
        screen.getByText("Style extraction failed. Style created anyway; you can edit the prompt.")
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(reportAppError).toHaveBeenCalledWith(
          expect.objectContaining({
            source: "telemetry.ai_studio.style_extraction",
            message: "style_extraction.fallback",
            metadata: expect.objectContaining({
              outcome: "fallback",
              flow: "library_drop",
            }),
          })
        );
      });
    } finally {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: originalImage,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        writable: true,
        value: originalCanvasGetContext,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
        configurable: true,
        writable: true,
        value: originalCanvasToDataUrl,
      });
    }
  });

  it("creates a style from internal reference-grid drops using resolved internal candidates", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    const resolvedInternal: ResolvedInternalStyleSource = {
      kind: "internal",
      sourceKind: "generated_output",
      sourceId: "media-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-123",
        mediaId: "media-1",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "saved_media_lookup",
      },
      outputId: "out-123",
      mediaId: "media-1",
      mediaSource: "generated",
      preview: {
        url: "https://cdn.example.com/stale-reference.png",
        width: 1024,
        height: 768,
      },
      previewStoragePath: "user-1/generations/images/out-123.png",
      fullStoragePath: "user-1/generations/images/out-123.png",
      promptText: "internal prompt",
      loadBlob: async () => new Blob(["internal-drop"], { type: "image/png" }),
    };
    const resolveInternalStyleDrop = vi.fn(async () => resolvedInternal);
    const originalImage = globalThis.Image;
    const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
    const originalCanvasToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    class MockImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 1024;
      naturalHeight = 768;
      width = 1024;
      height = 768;
      set src(_value: string) {
        this.onload?.();
      }
    }
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () =>
        ({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high",
          drawImage: () => undefined,
        }) as unknown as CanvasRenderingContext2D,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: function toDataUrlByCanvasSize() {
        return `data:image/jpeg;base64,${this.width}x${this.height}`;
      },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      render(
        <StylesLibraryPanel
          styles={createStyles()}
          onSaveStyleDetails={onSaveStyleDetails}
          resolveInternalStyleDrop={resolveInternalStyleDrop}
        />
      );

      const panel = screen.getByRole("region", { name: "Styles library" });
      const transfer = {
        files: [],
        types: [
          "text/reference-origin",
          "text/reference-output-id",
          "text/reference-url",
          "text/plain",
        ],
        getData: (type: string) => {
          if (type === "text/reference-origin") return "ai-studio-reference-grid";
          if (type === "text/reference-output-id") return "out-123";
          if (type === "text/reference-url") return "https://cdn.example.com/stale-reference.png";
          if (type === "text/plain") return "portrait prompt";
          return "";
        },
        dropEffect: "copy",
        effectAllowed: "copy",
      } as unknown as DataTransfer;

      fireEvent.dragEnter(panel, { dataTransfer: transfer });
      fireEvent.dragOver(panel, { dataTransfer: transfer });
      fireEvent.drop(panel, { dataTransfer: transfer });

      await waitFor(() => {
        expect(onSaveStyleDetails).toHaveBeenCalledTimes(1);
      });
      expect(resolveInternalStyleDrop).toHaveBeenCalledTimes(1);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: originalImage,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        writable: true,
        value: originalCanvasGetContext,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
        configurable: true,
        writable: true,
        value: originalCanvasToDataUrl,
      });
    }
  });

  it("creates a style from internal drops even when only the internal render identity is present", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    const resolvedInternal: ResolvedInternalStyleSource = {
      kind: "internal",
      sourceKind: "generated_output",
      sourceId: "media-identity",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-identity",
        mediaId: "media-identity",
        imageIndex: 0,
        sourceSurface: null,
        resolutionReason: "payload_reference_url",
      },
      outputId: "out-identity",
      mediaId: "media-identity",
      mediaSource: "generated",
      preview: {
        url: "/_next/image?url=%2Finternal-style.png&w=1080&q=75",
        width: 1024,
        height: 768,
      },
      previewStoragePath: null,
      fullStoragePath: null,
      promptText: "internal prompt",
      loadBlob: async () => new Blob(["internal-identity"], { type: "image/png" }),
    };
    const resolveInternalStyleDrop = vi.fn(async () => resolvedInternal);
    const originalImage = globalThis.Image;
    const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
    const originalCanvasToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    class MockImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 1024;
      naturalHeight = 768;
      width = 1024;
      height = 768;
      set src(_value: string) {
        this.onload?.();
      }
    }
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () =>
        ({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high",
          drawImage: () => undefined,
        }) as unknown as CanvasRenderingContext2D,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: function toDataUrlByCanvasSize() {
        return `data:image/jpeg;base64,${this.width}x${this.height}`;
      },
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      render(
        <StylesLibraryPanel
          styles={createStyles()}
          onSaveStyleDetails={onSaveStyleDetails}
          resolveInternalStyleDrop={resolveInternalStyleDrop}
        />
      );

      const panel = screen.getByRole("region", { name: "Styles library" });
      const transfer = {
        files: [],
        types: ["text/reference-origin", "text/reference-output-id", "text/reference-render-url"],
        getData: (type: string) => {
          if (type === "text/reference-origin") return "ai-studio-reference-grid";
          if (type === "text/reference-output-id") return "out-identity";
          if (type === "text/reference-render-url") {
            return "/_next/image?url=%2Finternal-style.png&w=1080&q=75";
          }
          return "";
        },
        dropEffect: "copy",
        effectAllowed: "copy",
      } as unknown as DataTransfer;

      fireEvent.dragEnter(panel, { dataTransfer: transfer });
      fireEvent.dragOver(panel, { dataTransfer: transfer });
      fireEvent.drop(panel, { dataTransfer: transfer });

      await waitFor(() => {
        expect(onSaveStyleDetails).toHaveBeenCalledTimes(1);
      });
      expect(resolveInternalStyleDrop).toHaveBeenCalledTimes(1);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(onSaveStyleDetails).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          style: "Noir Bloom",
          title: "Noir Bloom",
          referenceImageName: "Noir Bloom",
          previewImageUrl: "data:image/jpeg;base64,512x512",
        })
      );
    } finally {
      vi.unstubAllGlobals();
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: originalImage,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        writable: true,
        value: originalCanvasGetContext,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
        configurable: true,
        writable: true,
        value: originalCanvasToDataUrl,
      });
    }
  });

  it("shows a processing placeholder while creating a style from dropped image", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    let resolveExtraction: ((value: StyleExtractionResult) => void) | null = null;
    vi.mocked(postExtractStyle).mockImplementation(
      () =>
        new Promise<StyleExtractionResult>((resolve) => {
          resolveExtraction = resolve;
        })
    );
    const originalImage = globalThis.Image;
    const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
    const originalCanvasToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    class MockImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 1024;
      naturalHeight = 768;
      width = 1024;
      height = 768;
      set src(_value: string) {
        this.onload?.();
      }
    }
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () =>
        ({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high",
          drawImage: () => undefined,
        }) as unknown as CanvasRenderingContext2D,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: function toDataUrlByCanvasSize() {
        return `data:image/jpeg;base64,${this.width}x${this.height}`;
      },
    });
    try {
      render(
        <StylesLibraryPanel styles={createStyles()} onSaveStyleDetails={onSaveStyleDetails} />
      );

      const panel = screen.getByRole("region", { name: "Styles library" });
      const imageFile = new File(["mock-image-bytes"], "desktop-image.png", { type: "image/png" });
      const transfer = {
        files: [imageFile],
        types: ["Files"],
        getData: vi.fn(() => ""),
        dropEffect: "copy",
        effectAllowed: "copy",
      } as unknown as DataTransfer;

      fireEvent.dragEnter(panel, { dataTransfer: transfer });
      fireEvent.dragOver(panel, { dataTransfer: transfer });
      fireEvent.drop(panel, { dataTransfer: transfer });

      await waitFor(() => {
        expect(screen.getByText("Creating style from image...")).toBeInTheDocument();
      });
      expect(screen.getByText("Processing image")).toBeInTheDocument();
      expect(screen.getByText("Analyzing style...")).toBeInTheDocument();
      expect(onSaveStyleDetails).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(resolveExtraction).toBeTypeOf("function");
      });

      const finishExtraction = resolveExtraction as ((value: StyleExtractionResult) => void) | null;
      if (typeof finishExtraction !== "function") {
        throw new Error("Expected extraction resolver to be initialized.");
      }
      finishExtraction(
        createStyleExtractionResult({
          stylePrompt: "anime style, warm palette, soft diffusion",
          styleTitle: "Warm Anime Diffusion",
        })
      );

      await waitFor(() => {
        expect(onSaveStyleDetails).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(screen.queryByText("Processing image")).not.toBeInTheDocument();
      });
    } finally {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: originalImage,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        writable: true,
        value: originalCanvasGetContext,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
        configurable: true,
        writable: true,
        value: originalCanvasToDataUrl,
      });
    }
  });

  it("ignores filename-like drag payload text when extraction times out", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    vi.mocked(postExtractStyle).mockRejectedValue(
      new Error("Style extraction timed out. Please retry.")
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["mock-image-bytes"], { type: "image/png" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const originalImage = globalThis.Image;
    const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
    const originalCanvasToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    class MockImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 1024;
      naturalHeight = 768;
      width = 1024;
      height = 768;
      set src(_value: string) {
        this.onload?.();
      }
    }
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () =>
        ({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high",
          drawImage: () => undefined,
        }) as unknown as CanvasRenderingContext2D,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: function toDataUrlByCanvasSize() {
        return `data:image/jpeg;base64,${this.width}x${this.height}`;
      },
    });
    try {
      render(
        <StylesLibraryPanel styles={createStyles()} onSaveStyleDetails={onSaveStyleDetails} />
      );

      const panel = screen.getByRole("region", { name: "Styles library" });
      const transfer = {
        files: [],
        types: ["text/reference-url", "text/plain"],
        getData: vi.fn((type: string) => {
          if (type === "text/reference-url") {
            return "https://external.example.com/style.png";
          }
          if (type === "text/plain") {
            return "Screenshot 2026-03-10 at 11.49.19 AM.png";
          }
          return "";
        }),
        dropEffect: "copy",
        effectAllowed: "copy",
      } as unknown as DataTransfer;

      fireEvent.dragEnter(panel, { dataTransfer: transfer });
      fireEvent.dragOver(panel, { dataTransfer: transfer });
      fireEvent.drop(panel, { dataTransfer: transfer });

      await waitFor(() => {
        expect(onSaveStyleDetails).toHaveBeenCalledTimes(1);
      });
      expect(onSaveStyleDetails).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          stylePrompt: "",
        })
      );
      expect(
        screen.getByText(
          "Style extraction timed out. Please retry. Style created anyway; you can edit the prompt."
        )
      ).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: originalImage,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        writable: true,
        value: originalCanvasGetContext,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
        configurable: true,
        writable: true,
        value: originalCanvasToDataUrl,
      });
    }
  });

  it("shows deterministic guidance when external URL drop is blocked by browser fetch", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    try {
      render(
        <StylesLibraryPanel styles={createStyles()} onSaveStyleDetails={onSaveStyleDetails} />
      );

      const panel = screen.getByRole("region", { name: "Styles library" });
      const transfer = {
        files: [],
        types: ["text/reference-url", "text/plain"],
        getData: vi.fn((type: string) => {
          if (type === "text/reference-url" || type === "text/plain") {
            return "https://external.example.com/style.jpg";
          }
          return "";
        }),
        dropEffect: "copy",
        effectAllowed: "copy",
      } as unknown as DataTransfer;

      fireEvent.dragEnter(panel, { dataTransfer: transfer });
      fireEvent.dragOver(panel, { dataTransfer: transfer });
      fireEvent.drop(panel, { dataTransfer: transfer });

      await waitFor(() => {
        expect(
          screen.getByText(
            "This image source blocks browser access. Download the image and drop the file directly."
          )
        ).toBeInTheDocument();
      });
      expect(onSaveStyleDetails).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each([
    { networkMessage: "Load failed" },
    { networkMessage: "Network request failed" },
    { networkMessage: "The operation is insecure." },
  ])(
    "shows deterministic blocked-source guidance when browser reports $networkMessage",
    async ({ networkMessage }) => {
      const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
      const fetchMock = vi.fn().mockRejectedValue(new TypeError(networkMessage));
      vi.stubGlobal("fetch", fetchMock);
      try {
        render(
          <StylesLibraryPanel styles={createStyles()} onSaveStyleDetails={onSaveStyleDetails} />
        );

        const panel = screen.getByRole("region", { name: "Styles library" });
        const transfer = {
          files: [],
          types: ["text/reference-url", "text/plain"],
          getData: vi.fn((type: string) => {
            if (type === "text/reference-url" || type === "text/plain") {
              return "https://external.example.com/style.jpg";
            }
            return "";
          }),
          dropEffect: "copy",
          effectAllowed: "copy",
        } as unknown as DataTransfer;

        fireEvent.dragEnter(panel, { dataTransfer: transfer });
        fireEvent.dragOver(panel, { dataTransfer: transfer });
        fireEvent.drop(panel, { dataTransfer: transfer });

        await waitFor(() => {
          expect(
            screen.getByText(
              "This image source blocks browser access. Download the image and drop the file directly."
            )
          ).toBeInTheDocument();
        });
        expect(onSaveStyleDetails).not.toHaveBeenCalled();
        expect(
          screen.queryByText(
            "Unable to process that dropped image. Re-open or re-add the reference image, then drag again."
          )
        ).not.toBeInTheDocument();
      } finally {
        vi.unstubAllGlobals();
      }
    }
  );

  it("falls back unknown preview-source failures to blocked-source guidance with classifier_reason=unknown", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    const fetchMock = vi.fn().mockRejectedValue(new Error("Unexpected transport failure"));
    vi.stubGlobal("fetch", fetchMock);
    try {
      render(
        <StylesLibraryPanel styles={createStyles()} onSaveStyleDetails={onSaveStyleDetails} />
      );

      const panel = screen.getByRole("region", { name: "Styles library" });
      const transfer = {
        files: [],
        types: ["text/reference-url", "text/plain"],
        getData: vi.fn((type: string) => {
          if (type === "text/reference-url" || type === "text/plain") {
            return "https://external.example.com/style.jpg";
          }
          return "";
        }),
        dropEffect: "copy",
        effectAllowed: "copy",
      } as unknown as DataTransfer;

      fireEvent.dragEnter(panel, { dataTransfer: transfer });
      fireEvent.dragOver(panel, { dataTransfer: transfer });
      fireEvent.drop(panel, { dataTransfer: transfer });

      await waitFor(() => {
        expect(
          screen.getByText(
            "This image source blocks browser access. Download the image and drop the file directly."
          )
        ).toBeInTheDocument();
      });
      expect(onSaveStyleDetails).not.toHaveBeenCalled();
      expect(
        screen.queryByText(
          "Unable to process that dropped image. Re-open or re-add the reference image, then drag again."
        )
      ).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("shows deterministic guidance when dropped reference URLs have expired", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      blob: async () => new Blob([]),
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      render(
        <StylesLibraryPanel styles={createStyles()} onSaveStyleDetails={onSaveStyleDetails} />
      );

      const panel = screen.getByRole("region", { name: "Styles library" });
      const transfer = {
        files: [],
        types: ["text/reference-url", "text/plain"],
        getData: vi.fn((type: string) => {
          if (type === "text/reference-url" || type === "text/plain") {
            return "https://cdn.example.com/expired-reference.png";
          }
          return "";
        }),
        dropEffect: "copy",
        effectAllowed: "copy",
      } as unknown as DataTransfer;

      fireEvent.dragEnter(panel, { dataTransfer: transfer });
      fireEvent.dragOver(panel, { dataTransfer: transfer });
      fireEvent.drop(panel, { dataTransfer: transfer });

      await waitFor(() => {
        expect(
          screen.getByText(
            "That reference image URL expired. Re-open or re-add the image, then drag it again."
          )
        ).toBeInTheDocument();
      });
      expect(onSaveStyleDetails).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(reportAppError).toHaveBeenCalledWith(
          expect.objectContaining({
            source: "telemetry.ai_studio.style_extraction",
            message: "style_extraction.blocked_source",
            metadata: expect.objectContaining({
              outcome: "blocked_source",
              flow: "library_drop",
            }),
          })
        );
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("auto-fills style prompt from extraction after uploading create modal image", async () => {
    const originalImage = globalThis.Image;
    const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
    const originalCanvasToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    class MockImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 1024;
      naturalHeight = 768;
      width = 1024;
      height = 768;
      set src(_value: string) {
        this.onload?.();
      }
    }
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () =>
        ({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high",
          drawImage: () => undefined,
        }) as unknown as CanvasRenderingContext2D,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: function toDataUrlByCanvasSize() {
        return `data:image/jpeg;base64,${this.width}x${this.height}`;
      },
    });
    try {
      render(<StylesLibraryPanel styles={createStyles()} />);
      fireEvent.click(screen.getByRole("button", { name: "Add style" }));
      const dialog = screen.getByRole("dialog", { name: "Add style" });
      const uploadInput = dialog.querySelector(
        ".styles-library-edit-dropzone-input"
      ) as HTMLInputElement | null;
      expect(uploadInput).toBeTruthy();

      const imageFile = new File(["mock-image-bytes"], "style-image.png", { type: "image/png" });
      fireEvent.change(uploadInput as HTMLInputElement, { target: { files: [imageFile] } });

      await waitFor(() => {
        expect(screen.getByLabelText("Style Prompt")).toHaveValue(
          "cinematic lighting, shallow depth of field, balanced dynamic range"
        );
      });
      expect(screen.getByLabelText("Style")).toHaveValue("Noir Bloom");
      expect(postExtractStyle).toHaveBeenCalledWith("data:image/jpeg;base64,1024x768");
      expect(postExtractStyle).not.toHaveBeenCalledWith("data:image/jpeg;base64,512x512");
    } finally {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: originalImage,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        writable: true,
        value: originalCanvasGetContext,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
        configurable: true,
        writable: true,
        value: originalCanvasToDataUrl,
      });
    }
  });

  it("saves extracted create-modal styles without metadata fields", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    const originalImage = globalThis.Image;
    const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
    const originalCanvasToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    class MockImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 1024;
      naturalHeight = 768;
      width = 1024;
      height = 768;
      set src(_value: string) {
        this.onload?.();
      }
    }
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () =>
        ({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high",
          drawImage: () => undefined,
        }) as unknown as CanvasRenderingContext2D,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: function toDataUrlByCanvasSize() {
        return `data:image/jpeg;base64,${this.width}x${this.height}`;
      },
    });
    try {
      render(
        <StylesLibraryPanel styles={createStyles()} onSaveStyleDetails={onSaveStyleDetails} />
      );
      fireEvent.click(screen.getByRole("button", { name: "Add style" }));
      const dialog = screen.getByRole("dialog", { name: "Add style" });
      const uploadInput = dialog.querySelector(
        ".styles-library-edit-dropzone-input"
      ) as HTMLInputElement | null;
      const imageFile = new File(["mock-image-bytes"], "style-image.png", { type: "image/png" });
      fireEvent.change(uploadInput as HTMLInputElement, { target: { files: [imageFile] } });

      await waitFor(() => {
        expect(screen.getByLabelText("Style Prompt")).toHaveValue(
          "cinematic lighting, shallow depth of field, balanced dynamic range"
        );
      });

      fireEvent.click(screen.getByRole("button", { name: "Save style" }));

      await waitFor(() => {
        expect(onSaveStyleDetails).toHaveBeenCalledTimes(1);
      });
      const [, payload] = onSaveStyleDetails.mock.calls[0] as [
        string,
        {
          style: string;
          title: string;
          referenceImageName: string;
          stylePrompt: string;
          previewImageUrl: string;
        },
      ];
      expect(payload).toEqual({
        style: "Noir Bloom",
        title: "Noir Bloom",
        referenceImageName: "Noir Bloom",
        stylePrompt: "cinematic lighting, shallow depth of field, balanced dynamic range",
        previewImageUrl: "data:image/jpeg;base64,512x512",
      });
    } finally {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: originalImage,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        writable: true,
        value: originalCanvasGetContext,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
        configurable: true,
        writable: true,
        value: originalCanvasToDataUrl,
      });
    }
  });

  it("disables create save while style extraction is in-flight", async () => {
    const originalImage = globalThis.Image;
    const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
    const originalCanvasToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    let resolveExtraction: ((value: StyleExtractionResult) => void) | null = null;
    vi.mocked(postExtractStyle).mockImplementation(
      () =>
        new Promise<StyleExtractionResult>((resolve) => {
          resolveExtraction = resolve;
        })
    );
    class MockImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 1024;
      naturalHeight = 768;
      width = 1024;
      height = 768;
      set src(_value: string) {
        this.onload?.();
      }
    }
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () =>
        ({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high",
          drawImage: () => undefined,
        }) as unknown as CanvasRenderingContext2D,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: function toDataUrlByCanvasSize() {
        return `data:image/jpeg;base64,${this.width}x${this.height}`;
      },
    });
    try {
      render(<StylesLibraryPanel styles={createStyles()} />);
      fireEvent.click(screen.getByRole("button", { name: "Add style" }));
      const dialog = screen.getByRole("dialog", { name: "Add style" });
      const uploadInput = dialog.querySelector(
        ".styles-library-edit-dropzone-input"
      ) as HTMLInputElement | null;
      const imageFile = new File(["mock-image-bytes"], "style-image.png", { type: "image/png" });
      fireEvent.change(uploadInput as HTMLInputElement, { target: { files: [imageFile] } });

      await waitFor(() => {
        const saveButton = screen.getByRole("button", { name: "Analyzing style..." });
        expect(saveButton).toBeDisabled();
      });

      const finishExtraction = resolveExtraction as ((value: StyleExtractionResult) => void) | null;
      if (typeof finishExtraction !== "function") {
        throw new Error("Expected extraction resolver to be initialized.");
      }
      finishExtraction(
        createStyleExtractionResult({
          stylePrompt: "clean digital illustration, soft gradient shading, polished finish",
          styleTitle: "Cel Bloom",
        })
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Save style" })).not.toBeDisabled();
      });
    } finally {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: originalImage,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        writable: true,
        value: originalCanvasGetContext,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
        configurable: true,
        writable: true,
        value: originalCanvasToDataUrl,
      });
    }
  });

  it("allows manual prompt save when create extraction fails", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    const originalImage = globalThis.Image;
    const originalCanvasGetContext = HTMLCanvasElement.prototype.getContext;
    const originalCanvasToDataUrl = HTMLCanvasElement.prototype.toDataURL;
    vi.mocked(postExtractStyle).mockRejectedValue(new Error("Style extraction failed."));
    class MockImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      naturalWidth = 1024;
      naturalHeight = 768;
      width = 1024;
      height = 768;
      set src(_value: string) {
        this.onload?.();
      }
    }
    Object.defineProperty(globalThis, "Image", {
      configurable: true,
      writable: true,
      value: MockImage,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () =>
        ({
          imageSmoothingEnabled: true,
          imageSmoothingQuality: "high",
          drawImage: () => undefined,
        }) as unknown as CanvasRenderingContext2D,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: function toDataUrlByCanvasSize() {
        return `data:image/jpeg;base64,${this.width}x${this.height}`;
      },
    });
    try {
      render(
        <StylesLibraryPanel styles={createStyles()} onSaveStyleDetails={onSaveStyleDetails} />
      );
      fireEvent.click(screen.getByRole("button", { name: "Add style" }));
      const dialog = screen.getByRole("dialog", { name: "Add style" });
      const uploadInput = dialog.querySelector(
        ".styles-library-edit-dropzone-input"
      ) as HTMLInputElement | null;
      const imageFile = new File(["mock-image-bytes"], "style-image.png", { type: "image/png" });
      fireEvent.change(uploadInput as HTMLInputElement, { target: { files: [imageFile] } });

      await waitFor(() => {
        expect(screen.getByText("Style extraction failed.")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByLabelText("Style Prompt"), {
        target: { value: "manual fallback style prompt" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Save style" }));

      await waitFor(() => {
        expect(onSaveStyleDetails).toHaveBeenCalledTimes(1);
      });
      const [, payload] = onSaveStyleDetails.mock.calls[0] as [
        string,
        { stylePrompt: string; previewImageUrl: string },
      ];
      expect(payload.stylePrompt).toBe("manual fallback style prompt");
      expect(payload.previewImageUrl).toBe("data:image/jpeg;base64,512x512");
    } finally {
      Object.defineProperty(globalThis, "Image", {
        configurable: true,
        writable: true,
        value: originalImage,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        writable: true,
        value: originalCanvasGetContext,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
        configurable: true,
        writable: true,
        value: originalCanvasToDataUrl,
      });
    }
  });

  it("reorders style cards via drag and drop", () => {
    render(<StylesLibraryPanel styles={createStyles()} />);

    const sourceTile = screen
      .getByRole("button", { name: "Style tile: Cinematic" })
      .closest("article");
    const targetTile = screen.getByRole("button", { name: "Style tile: Anime" }).closest("article");
    expect(sourceTile).toBeTruthy();
    expect(targetTile).toBeTruthy();

    const transfer = {
      setData: vi.fn(),
      getData: vi.fn(() => "cinematic"),
      effectAllowed: "move",
      dropEffect: "move",
    } as unknown as DataTransfer;

    fireEvent.dragStart(sourceTile as HTMLElement, { dataTransfer: transfer });
    fireEvent.dragOver(targetTile as HTMLElement, { dataTransfer: transfer });
    fireEvent.drop(targetTile as HTMLElement, { dataTransfer: transfer });
    fireEvent.dragEnd(sourceTile as HTMLElement, { dataTransfer: transfer });

    const titles = screen
      .getAllByRole("button", { name: /Style tile:/i })
      .map((button) => button.textContent?.trim());
    expect(titles[0]).toContain("None");
    expect(titles[1]).toContain("Anime");
    expect(titles[2]).toContain("Cinematic");
  });

  it("delegates reorder to the shared page callback when provided", () => {
    const onReorderStyle = vi.fn();
    render(<StylesLibraryPanel styles={createStyles()} onReorderStyle={onReorderStyle} />);

    const sourceTile = screen
      .getByRole("button", { name: "Style tile: Cinematic" })
      .closest("article");
    const targetTile = screen.getByRole("button", { name: "Style tile: Anime" }).closest("article");
    expect(sourceTile).toBeTruthy();
    expect(targetTile).toBeTruthy();

    const transfer = {
      setData: vi.fn(),
      getData: vi.fn(() => "cinematic"),
      effectAllowed: "move",
      dropEffect: "move",
    } as unknown as DataTransfer;

    fireEvent.dragStart(sourceTile as HTMLElement, { dataTransfer: transfer });
    fireEvent.dragOver(targetTile as HTMLElement, { dataTransfer: transfer });
    fireEvent.drop(targetTile as HTMLElement, { dataTransfer: transfer });

    expect(onReorderStyle).toHaveBeenCalledWith("cinematic", "anime");
  });

  it("opens and closes the delete confirmation modal", () => {
    render(<StylesLibraryPanel styles={createStyles()} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete style: Cinematic" }));
    expect(screen.getByRole("dialog", { name: "Delete this style?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Delete this style?" })).not.toBeInTheDocument();
  });

  it("confirms delete and calls onDeleteStyle with the selected style id", async () => {
    const onDeleteStyle = vi.fn().mockResolvedValue(true);
    render(<StylesLibraryPanel styles={createStyles()} onDeleteStyle={onDeleteStyle} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete style: Cinematic" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(onDeleteStyle).toHaveBeenCalledWith("cinematic");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Delete this style?" })).not.toBeInTheDocument();
    });
  });

  it("opens edit modal when a style tile is clicked", () => {
    render(<StylesLibraryPanel styles={createStyles()} />);

    fireEvent.click(screen.getByRole("button", { name: "Style tile: Cinematic" }));

    expect(screen.getByRole("dialog", { name: "Edit style" })).toBeInTheDocument();
    expect(screen.getByLabelText("Style")).toHaveValue("Cinematic");
    expect(
      screen.getByRole("button", { name: "Drop reference image or click to upload" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Style Prompt")).toHaveValue("");
  });

  it("saves style details from edit modal", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    render(<StylesLibraryPanel styles={createStyles()} onSaveStyleDetails={onSaveStyleDetails} />);

    fireEvent.click(screen.getByRole("button", { name: "Style tile: Cinematic" }));
    fireEvent.change(screen.getByLabelText("Style"), { target: { value: "Neo Noir" } });
    fireEvent.change(screen.getByLabelText("Style Prompt"), {
      target: { value: "high contrast, cinematic street lighting" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(onSaveStyleDetails).toHaveBeenCalledWith("cinematic", {
        style: "Neo Noir",
        title: "Neo Noir",
        referenceImageName: "Neo Noir",
        stylePrompt: "high contrast, cinematic street lighting",
        previewImageUrl: "/Styles/Cinematic.png",
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit style" })).not.toBeInTheDocument();
    });
  });
});
