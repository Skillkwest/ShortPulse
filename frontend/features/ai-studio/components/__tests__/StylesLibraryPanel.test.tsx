/**
 * StylesLibraryPanel tests.
 * Covers delete affordance visibility and confirm-modal delete behavior.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StylesLibraryPanel } from "../StylesLibraryPanel";
import type { ExpertEditStyleTile } from "../edit/expertEditStyles";
import { postExtractStyle, prepareStyleImageUrl } from "../../logic/styleExtraction";
import { reportAppError } from "../../../../lib/appErrorReporter";

vi.mock("../../logic/styleExtraction", () => ({
  prepareStyleImageUrl: vi.fn(),
  postExtractStyle: vi.fn(),
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

describe("StylesLibraryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prepareStyleImageUrl).mockImplementation(async (url: string) => url);
    vi.mocked(postExtractStyle).mockResolvedValue({
      stylePrompt: "cinematic lighting, shallow depth of field, balanced dynamic range",
      styleTitle: "Noir Bloom",
    });
  });

  it("renders delete action only for non-placeholder styles", () => {
    render(<StylesLibraryPanel styles={createStylesWithPlaceholder()} selectedStyleId={null} />);

    expect(screen.getByRole("button", { name: "Delete style: Cinematic" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete style: Placeholder 1" })
    ).not.toBeInTheDocument();
  });

  it("opens create modal with the trailing add style button", () => {
    render(<StylesLibraryPanel styles={createStyles()} selectedStyleId={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Add style" }));

    expect(screen.getByRole("dialog", { name: "Add style" })).toBeInTheDocument();
    expect(screen.getByLabelText("Style")).toHaveValue("Custom Style 1");
    expect(
      screen.getByRole("button", { name: "Drop reference image or click to upload" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Style Prompt")).toHaveValue("");
  });

  it("saves a new style from the add style modal", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    const onSelectStyle = vi.fn();
    render(
      <StylesLibraryPanel
        styles={createStyles()}
        selectedStyleId={null}
        onSaveStyleDetails={onSaveStyleDetails}
        onSelectStyle={onSelectStyle}
      />
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
    expect(savedStyleId).toMatch(/^style-library-custom-/);
    expect(savedDetails).toEqual({
      style: "Dream Glow",
      title: "Dream Glow",
      referenceImageName: "Dream Glow",
      stylePrompt: "ethereal highlights and dreamy bloom",
      previewImageUrl: "",
    });
    expect(onSelectStyle).toHaveBeenCalledWith(savedStyleId);
  });

  it("creates a new style when dropping a desktop image onto the styles library", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    const onSelectStyle = vi.fn();
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
      value: () => "data:image/jpeg;base64,mock-cropped-style",
    });
    try {
      render(
        <StylesLibraryPanel
          styles={createStyles()}
          selectedStyleId={null}
          onSaveStyleDetails={onSaveStyleDetails}
          onSelectStyle={onSelectStyle}
        />
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
      expect(savedDetails.previewImageUrl).toBe("data:image/jpeg;base64,mock-cropped-style");
      expect(onSelectStyle).toHaveBeenCalledWith(savedStyleId);
      expect(prepareStyleImageUrl).not.toHaveBeenCalledWith(
        "data:image/jpeg;base64,mock-cropped-style"
      );
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
      value: () => "data:image/jpeg;base64,mock-cropped-style",
    });
    try {
      render(
        <StylesLibraryPanel
          styles={createStyles()}
          selectedStyleId={null}
          onSaveStyleDetails={onSaveStyleDetails}
        />
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

  it("shows deterministic guidance when external URL drop is blocked by browser fetch", async () => {
    const onSaveStyleDetails = vi.fn().mockResolvedValue(true);
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    try {
      render(
        <StylesLibraryPanel
          styles={createStyles()}
          selectedStyleId={null}
          onSaveStyleDetails={onSaveStyleDetails}
        />
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
      value: () => "data:image/jpeg;base64,mock-create-preview",
    });
    try {
      render(<StylesLibraryPanel styles={createStyles()} selectedStyleId={null} />);
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
    let resolveExtraction: ((value: { stylePrompt: string; styleTitle: string }) => void) | null =
      null;
    vi.mocked(postExtractStyle).mockImplementation(
      () =>
        new Promise<{ stylePrompt: string; styleTitle: string }>((resolve) => {
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
      value: () => "data:image/jpeg;base64,mock-create-preview",
    });
    try {
      render(<StylesLibraryPanel styles={createStyles()} selectedStyleId={null} />);
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

      const finishExtraction = resolveExtraction as
        | ((value: { stylePrompt: string; styleTitle: string }) => void)
        | null;
      if (typeof finishExtraction !== "function") {
        throw new Error("Expected extraction resolver to be initialized.");
      }
      finishExtraction({
        stylePrompt: "clean digital illustration, soft gradient shading, polished finish",
        styleTitle: "Cel Bloom",
      });

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
      value: () => "data:image/jpeg;base64,mock-create-preview",
    });
    try {
      render(
        <StylesLibraryPanel
          styles={createStyles()}
          selectedStyleId={null}
          onSaveStyleDetails={onSaveStyleDetails}
        />
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
      expect(payload.previewImageUrl).toBe("data:image/jpeg;base64,mock-create-preview");
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
    render(<StylesLibraryPanel styles={createStyles()} selectedStyleId={null} />);

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
    expect(titles[0]).toContain("Anime");
    expect(titles[1]).toContain("Cinematic");
  });

  it("opens and closes the delete confirmation modal", () => {
    render(<StylesLibraryPanel styles={createStyles()} selectedStyleId={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete style: Cinematic" }));
    expect(screen.getByRole("dialog", { name: "Delete style?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(screen.queryByRole("dialog", { name: "Delete style?" })).not.toBeInTheDocument();
  });

  it("confirms delete and calls onDeleteStyle with the selected style id", async () => {
    const onDeleteStyle = vi.fn().mockResolvedValue(true);
    render(
      <StylesLibraryPanel
        styles={createStyles()}
        selectedStyleId={null}
        onDeleteStyle={onDeleteStyle}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete style: Cinematic" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() => {
      expect(onDeleteStyle).toHaveBeenCalledWith("cinematic");
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Delete style?" })).not.toBeInTheDocument();
    });
  });

  it("opens edit modal when a style tile is clicked", () => {
    render(<StylesLibraryPanel styles={createStyles()} selectedStyleId={null} />);

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
    render(
      <StylesLibraryPanel
        styles={createStyles()}
        selectedStyleId={null}
        onSaveStyleDetails={onSaveStyleDetails}
      />
    );

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
