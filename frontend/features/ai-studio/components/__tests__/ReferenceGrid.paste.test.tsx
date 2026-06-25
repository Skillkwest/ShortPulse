/**
 * Clipboard paste behavior tests for ReferenceGrid.
 * Verifies pasted media files and plain text are converted into reference-grid actions.
 */
import type React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceGrid, type ReferenceGridProps } from "../ReferenceGrid";
import { preparePromptReferenceDrag } from "../../utils/dragDrop";

class MockResizeObserver {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

class MockIntersectionObserver {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

const makeFileList = (files: File[]): FileList =>
  ({
    ...files,
    length: files.length,
    item: (index: number) => files[index] ?? null,
  }) as unknown as FileList;

const makeTransfer = (data: Record<string, string>, files: File[] = []): DataTransfer =>
  ({
    files: makeFileList(files),
    types: [...Object.keys(data), ...(files.length > 0 ? ["Files"] : [])],
    getData: vi.fn((type: string) => data[type] ?? ""),
  }) as unknown as DataTransfer;

const makeMutableTransfer = (): DataTransfer => {
  const data = new Map<string, string>();
  return {
    files: makeFileList([]),
    get types() {
      return Array.from(data.keys());
    },
    getData: vi.fn((type: string) => data.get(type) ?? ""),
    setData: vi.fn((type: string, value: string) => {
      data.set(type, value);
    }),
    effectAllowed: "all",
    setDragImage: vi.fn(),
  } as unknown as DataTransfer;
};

const baseProps: ReferenceGridProps = {
  outputs: [],
  activeOutputId: null,
  onSelectOutput: () => undefined,
  onOpenDetails: () => undefined,
  selectedTool: "create",
};

describe("ReferenceGrid paste handling", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    if (!window.matchMedia) {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes pasted image files through onDropFiles", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const file = new File(["image"], "reference.png", { type: "image/png" });
    const clipboardData = {
      files: makeFileList([file]),
      items: [],
      getData: vi.fn(() => ""),
    } as unknown as DataTransfer;

    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onPasteTextReference={onPasteTextReference}
        onPasteMediaReference={onPasteMediaReference}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();

    fireEvent.paste(panel as HTMLElement, { clipboardData });

    expect(onDropFiles).toHaveBeenCalledTimes(1);
    const pastedFiles = onDropFiles.mock.calls[0]?.[0] as FileList;
    expect(pastedFiles.length).toBe(1);
    expect(pastedFiles.item(0)?.name).toBe("reference.png");
    expect(onPasteTextReference).not.toHaveBeenCalled();
    expect(onPasteMediaReference).not.toHaveBeenCalled();
  });

  it("normalizes pasted PNG files when clipboard file type metadata is missing", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const pngFileWithoutType = new File(["png-bytes"], "copied-image", { type: "" });
    const clipboardData = {
      files: makeFileList([pngFileWithoutType]),
      items: [
        {
          kind: "file",
          type: "image/png",
          getAsFile: () => pngFileWithoutType,
        },
      ],
      getData: vi.fn(() => ""),
    } as unknown as DataTransfer;

    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onPasteTextReference={onPasteTextReference}
        onPasteMediaReference={onPasteMediaReference}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();

    fireEvent.paste(panel as HTMLElement, { clipboardData });

    expect(onDropFiles).toHaveBeenCalledTimes(1);
    const pastedFiles = onDropFiles.mock.calls[0]?.[0] as FileList;
    expect(pastedFiles.length).toBe(1);
    expect(pastedFiles.item(0)?.type).toBe("image/png");
    expect(onPasteTextReference).not.toHaveBeenCalled();
    expect(onPasteMediaReference).not.toHaveBeenCalled();
  });

  it("normalizes pasted image files when clipboard filename metadata is missing", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const namelessPngFile = new File(["png-bytes"], "", { type: "image/png" });
    const clipboardData = {
      files: makeFileList([namelessPngFile]),
      items: [],
      getData: vi.fn(() => ""),
    } as unknown as DataTransfer;

    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onPasteTextReference={onPasteTextReference}
        onPasteMediaReference={onPasteMediaReference}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();

    fireEvent.paste(panel as HTMLElement, { clipboardData });

    expect(onDropFiles).toHaveBeenCalledTimes(1);
    const pastedFiles = onDropFiles.mock.calls[0]?.[0] as FileList;
    expect(pastedFiles.length).toBe(1);
    expect(pastedFiles.item(0)?.name).toBe("pasted-media-1.png");
    expect(pastedFiles.item(0)?.type).toBe("image/png");
    expect(onPasteTextReference).not.toHaveBeenCalled();
    expect(onPasteMediaReference).not.toHaveBeenCalled();
  });

  it("routes pasted plain text through onPasteTextReference", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const clipboardData = {
      files: makeFileList([]),
      items: [],
      getData: vi.fn((type: string) => (type === "text/plain" ? "  cinematic portrait  " : "")),
    } as unknown as DataTransfer;

    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onPasteTextReference={onPasteTextReference}
        onPasteMediaReference={onPasteMediaReference}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();

    fireEvent.paste(panel as HTMLElement, { clipboardData });

    expect(onPasteTextReference).toHaveBeenCalledWith("cinematic portrait");
    expect(onDropFiles).not.toHaveBeenCalled();
    expect(onPasteMediaReference).not.toHaveBeenCalled();
  });

  it("routes dropped prompt text through onPasteTextReference", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const dataTransfer = {
      files: makeFileList([]),
      types: ["text/prompt", "text/plain"],
      getData: vi.fn((type: string) => (type === "text/prompt" ? "  dropped prompt text  " : "")),
    } as unknown as DataTransfer;

    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onPasteTextReference={onPasteTextReference}
        onPasteMediaReference={onPasteMediaReference}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();

    fireEvent.drop(panel as HTMLElement, { dataTransfer });

    expect(onPasteTextReference).toHaveBeenCalledWith("dropped prompt text");
    expect(onDropFiles).not.toHaveBeenCalled();
    expect(onPasteMediaReference).not.toHaveBeenCalled();
  });

  it("routes dropped media URLs through onPasteMediaReference", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const dataTransfer = makeTransfer({
      "text/uri-list": "https://cdn.example.com/dropped-image.png",
    });

    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onPasteTextReference={onPasteTextReference}
        onPasteMediaReference={onPasteMediaReference}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();

    fireEvent.drop(panel as HTMLElement, { dataTransfer });

    expect(onPasteMediaReference).toHaveBeenCalledWith({
      url: "https://cdn.example.com/dropped-image.png",
      mimeType: "image/*",
    });
    expect(onDropFiles).not.toHaveBeenCalled();
    expect(onPasteTextReference).not.toHaveBeenCalled();
  });

  it("routes media-library media drops through onAddLibraryMediaReference", () => {
    const onDropFiles = vi.fn();
    const onAddLibraryMediaReference = vi.fn();
    const dataTransfer = makeTransfer({
      "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
      "text/shortpulse-media-library-kind": "libraryMedia",
      "text/shortpulse-media-library-id": "media-drop-1",
      "text/shortpulse-media-library-file-type": "image",
      "text/reference-url": "https://cdn.example.com/library-drop-1.png",
      "text/shortpulse-media-library-filename": "library-drop-1.png",
      "text/prompt": "Library media prompt",
    });

    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onAddLibraryMediaReference={onAddLibraryMediaReference}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();

    fireEvent.drop(panel as HTMLElement, { dataTransfer });

    expect(onAddLibraryMediaReference).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "media-drop-1",
        url: "https://cdn.example.com/library-drop-1.png",
        fileType: "image",
        filename: "library-drop-1.png",
        promptText: "Library media prompt",
      })
    );
    expect(onDropFiles).not.toHaveBeenCalled();
  });

  it("routes media-library prompt drops through onAddLibraryPromptReference", () => {
    const onDropFiles = vi.fn();
    const onAddLibraryPromptReference = vi.fn();
    const dataTransfer = makeTransfer({
      "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
      "text/shortpulse-media-library-kind": "libraryPrompt",
      "text/shortpulse-media-library-id": "prompt-drop-1",
      "text/shortpulse-media-library-title": "Library prompt title",
      "text/prompt": "Library prompt text",
      "text/plain": "Library prompt text",
    });

    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onAddLibraryPromptReference={onAddLibraryPromptReference}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();

    fireEvent.drop(panel as HTMLElement, { dataTransfer });

    expect(onAddLibraryPromptReference).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "prompt-drop-1",
        promptText: "Library prompt text",
        originFolderId: null,
        title: "Library prompt title",
      })
    );
    expect(onDropFiles).not.toHaveBeenCalled();
  });

  it("routes session-backed media-library prompt drops through onAddLibraryPromptReference", () => {
    const onDropFiles = vi.fn();
    const onAddLibraryPromptReference = vi.fn();
    const dataTransfer = makeMutableTransfer();
    const promptText = `Library prompt opening. ${"Detailed direction. ".repeat(80)}Library ending.`;
    dataTransfer.setData("text/shortpulse-media-library-marker", "shortpulse-media-library-v1");
    dataTransfer.setData("text/shortpulse-media-library-kind", "libraryPrompt");
    dataTransfer.setData("text/shortpulse-media-library-id", "prompt-drop-session-1");
    dataTransfer.setData("text/shortpulse-media-library-title", "Library prompt title");
    dataTransfer.setData("text/shortpulse-media-library-prompt", promptText);
    preparePromptReferenceDrag(
      {
        currentTarget: document.createElement("button"),
        dataTransfer,
      } as unknown as React.DragEvent<HTMLElement>,
      {
        referenceId: "prompt-drop-session-1",
        outputId: "prompt-drop-session-1",
        promptText,
        sourceSurface: null,
      }
    );

    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onAddLibraryPromptReference={onAddLibraryPromptReference}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();

    fireEvent.drop(panel as HTMLElement, { dataTransfer });

    expect(onAddLibraryPromptReference).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "prompt-drop-session-1",
        promptText,
        originFolderId: null,
        title: "Library prompt title",
      })
    );
    expect(onDropFiles).not.toHaveBeenCalled();
  });

  it("ignores degraded internal drags even when browsers expose synthetic file payloads", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const syntheticFile = new File(["image"], "dragged-reference.png", { type: "image/png" });
    const dataTransfer = makeTransfer(
      {
        "text/reference-output-id": "out-1",
        "text/reference-source-surface": "all-refs",
      },
      [syntheticFile]
    );

    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onPasteTextReference={onPasteTextReference}
        onPasteMediaReference={onPasteMediaReference}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();

    fireEvent.drop(panel as HTMLElement, { dataTransfer });

    expect(onDropFiles).not.toHaveBeenCalled();
    expect(onPasteTextReference).not.toHaveBeenCalled();
    expect(onPasteMediaReference).not.toHaveBeenCalled();
  });

  it("shows and clears drop-active styling while prompt text is dragged over the panel", () => {
    const dataTransfer = {
      files: makeFileList([]),
      types: ["text/prompt", "text/plain"],
      getData: vi.fn(() => ""),
    } as unknown as DataTransfer;

    const { container } = render(<ReferenceGrid {...baseProps} />);
    const panel = container.querySelector(".reference-canvas-panel") as HTMLElement;
    expect(panel).toBeTruthy();

    fireEvent.dragEnter(panel, { dataTransfer });
    expect(panel.classList.contains("is-drop-active")).toBe(true);
    expect(panel.classList.contains("is-drop-active-text")).toBe(true);
    expect(panel.classList.contains("is-drop-active-files")).toBe(false);

    fireEvent.dragLeave(panel, { dataTransfer });
    expect(panel.classList.contains("is-drop-active")).toBe(false);
    expect(panel.classList.contains("is-drop-active-text")).toBe(false);
  });

  it("marks file drag state separately from text drag state", () => {
    const file = new File(["image"], "drop-image.png", { type: "image/png" });
    const dataTransfer = {
      files: makeFileList([file]),
      types: ["Files"],
      getData: vi.fn(() => ""),
    } as unknown as DataTransfer;

    const { container } = render(<ReferenceGrid {...baseProps} />);
    const panel = container.querySelector(".reference-canvas-panel") as HTMLElement;
    expect(panel).toBeTruthy();

    fireEvent.dragEnter(panel, { dataTransfer });
    expect(panel.classList.contains("is-drop-active")).toBe(true);
    expect(panel.classList.contains("is-drop-active-files")).toBe(true);
    expect(panel.classList.contains("is-drop-active-text")).toBe(false);
  });

  it("routes pasted media URLs through onPasteMediaReference", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const clipboardData = {
      files: makeFileList([]),
      items: [],
      getData: vi.fn((type: string) =>
        type === "text/plain" ? "https://cdn.example.com/ref-image.jpg" : ""
      ),
    } as unknown as DataTransfer;

    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onPasteTextReference={onPasteTextReference}
        onPasteMediaReference={onPasteMediaReference}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();

    fireEvent.paste(panel as HTMLElement, { clipboardData });

    expect(onPasteMediaReference).toHaveBeenCalledWith({
      url: "https://cdn.example.com/ref-image.jpg",
      mimeType: "image/*",
    });
    expect(onPasteTextReference).not.toHaveBeenCalled();
    expect(onDropFiles).not.toHaveBeenCalled();
  });

  it("treats extensionless image urls from html clipboard payloads as media", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const clipboardData = {
      files: makeFileList([]),
      items: [],
      getData: vi.fn((type: string) => {
        if (type === "text/html") {
          return '<img src="https://cdn.example.com/render?id=abc123" />';
        }
        if (type === "text/plain") {
          return "https://cdn.example.com/render?id=abc123";
        }
        return "";
      }),
    } as unknown as DataTransfer;

    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onPasteTextReference={onPasteTextReference}
        onPasteMediaReference={onPasteMediaReference}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();

    fireEvent.paste(panel as HTMLElement, { clipboardData });

    expect(onPasteMediaReference).toHaveBeenCalledWith({
      url: "https://cdn.example.com/render?id=abc123",
      mimeType: "image/*",
    });
    expect(onPasteTextReference).not.toHaveBeenCalled();
    expect(onDropFiles).not.toHaveBeenCalled();
  });

  it("uses file payload priority when clipboard includes both media and text", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const file = new File(["image"], "combined.png", { type: "image/png" });
    const clipboardData = {
      files: makeFileList([file]),
      items: [],
      getData: vi.fn((type: string) => (type === "text/plain" ? "paired prompt" : "")),
    } as unknown as DataTransfer;

    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onPasteTextReference={onPasteTextReference}
        onPasteMediaReference={onPasteMediaReference}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();

    fireEvent.paste(panel as HTMLElement, { clipboardData });

    expect(onDropFiles).toHaveBeenCalledTimes(1);
    expect(onPasteTextReference).not.toHaveBeenCalled();
    expect(onPasteMediaReference).not.toHaveBeenCalled();
  });

  it("supports document-level paste while pointer is over the reference panel", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const clipboardData = {
      files: makeFileList([]),
      items: [],
      getData: vi.fn((type: string) => (type === "text/plain" ? "hover-based paste" : "")),
    } as unknown as DataTransfer;

    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onPasteTextReference={onPasteTextReference}
        onPasteMediaReference={onPasteMediaReference}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();

    fireEvent.pointerEnter(panel as HTMLElement);
    fireEvent.paste(document, { clipboardData });

    expect(onPasteTextReference).toHaveBeenCalledWith("hover-based paste");
    expect(onDropFiles).not.toHaveBeenCalled();
    expect(onPasteMediaReference).not.toHaveBeenCalled();
  });

  it("supports document-level paste when not focused in an editable control", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const clipboardData = {
      files: makeFileList([]),
      items: [],
      getData: vi.fn((type: string) => (type === "text/plain" ? "global paste" : "")),
    } as unknown as DataTransfer;

    render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onPasteTextReference={onPasteTextReference}
        onPasteMediaReference={onPasteMediaReference}
      />
    );

    fireEvent.paste(document, { clipboardData });

    expect(onPasteTextReference).toHaveBeenCalledWith("global paste");
    expect(onDropFiles).not.toHaveBeenCalled();
    expect(onPasteMediaReference).not.toHaveBeenCalled();
  });

  it("does not hijack paste when an external editable element is focused", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const clipboardData = {
      files: makeFileList([]),
      items: [],
      getData: vi.fn((type: string) => (type === "text/plain" ? "input paste" : "")),
    } as unknown as DataTransfer;

    render(
      <>
        <textarea data-testid="outside-editor" />
        <ReferenceGrid
          {...baseProps}
          onDropFiles={onDropFiles}
          onPasteTextReference={onPasteTextReference}
          onPasteMediaReference={onPasteMediaReference}
        />
      </>
    );

    const outsideEditor = screen.getByTestId("outside-editor");
    outsideEditor.focus();
    fireEvent.paste(outsideEditor, { clipboardData });

    expect(onPasteTextReference).not.toHaveBeenCalled();
    expect(onDropFiles).not.toHaveBeenCalled();
    expect(onPasteMediaReference).not.toHaveBeenCalled();
  });

  it("does not hijack paste when a right-rail editable element is focused", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const clipboardData = {
      files: makeFileList([]),
      items: [],
      getData: vi.fn((type: string) => (type === "text/plain" ? "canvas edit paste" : "")),
    } as unknown as DataTransfer;

    const { container } = render(
      <div className="ai-shell-right">
        <div className="reference-column">
          <ReferenceGrid
            {...baseProps}
            onDropFiles={onDropFiles}
            onPasteTextReference={onPasteTextReference}
            onPasteMediaReference={onPasteMediaReference}
          />
        </div>
        <textarea data-testid="canvas-text-editor" />
      </div>
    );

    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();
    fireEvent.pointerDown(panel as HTMLElement, { button: 0 });

    const canvasTextEditor = screen.getByTestId("canvas-text-editor");
    fireEvent.pointerDown(canvasTextEditor, { button: 0 });
    canvasTextEditor.focus();
    fireEvent.paste(canvasTextEditor, { clipboardData });

    expect(onPasteTextReference).not.toHaveBeenCalled();
    expect(onDropFiles).not.toHaveBeenCalled();
    expect(onPasteMediaReference).not.toHaveBeenCalled();
  });

  it("primes paste after clicking anywhere in the reference panel", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const clipboardData = {
      files: makeFileList([]),
      items: [],
      getData: vi.fn((type: string) => (type === "text/plain" ? "primed by click" : "")),
    } as unknown as DataTransfer;

    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onPasteTextReference={onPasteTextReference}
        onPasteMediaReference={onPasteMediaReference}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();

    fireEvent.pointerDown(panel as HTMLElement, { button: 0 });
    fireEvent.paste(document, { clipboardData });

    expect(onPasteTextReference).toHaveBeenCalledWith("primed by click");
    expect(onDropFiles).not.toHaveBeenCalled();
    expect(onPasteMediaReference).not.toHaveBeenCalled();
  });

  it("primes paste after clicking in the reference column surface outside the panel", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const clipboardData = {
      files: makeFileList([]),
      items: [],
      getData: vi.fn((type: string) => (type === "text/plain" ? "column-surface paste" : "")),
    } as unknown as DataTransfer;

    const { container } = render(
      <div className="ai-shell-right">
        <div className="ai-preview-column reference-column">
          <div className="reference-column-sticky">
            <div data-testid="surface-empty-zone" style={{ minHeight: "48px" }} />
            <ReferenceGrid
              {...baseProps}
              onDropFiles={onDropFiles}
              onPasteTextReference={onPasteTextReference}
              onPasteMediaReference={onPasteMediaReference}
            />
          </div>
        </div>
      </div>
    );
    const outsidePanelSurface = screen.getByTestId("surface-empty-zone");
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();

    fireEvent.pointerDown(outsidePanelSurface, { button: 0 });
    fireEvent.paste(document, { clipboardData });

    expect(onPasteTextReference).toHaveBeenCalledWith("column-surface paste");
    expect(onDropFiles).not.toHaveBeenCalled();
    expect(onPasteMediaReference).not.toHaveBeenCalled();
  });

  it("still allows document-level paste after clicking outside the reference panel", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const clipboardData = {
      files: makeFileList([]),
      items: [],
      getData: vi.fn((type: string) => (type === "text/plain" ? "outside click clears prime" : "")),
    } as unknown as DataTransfer;

    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onPasteTextReference={onPasteTextReference}
        onPasteMediaReference={onPasteMediaReference}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();
    fireEvent.pointerDown(panel as HTMLElement, { button: 0 });

    const outsideNode = document.createElement("button");
    outsideNode.textContent = "outside";
    document.body.appendChild(outsideNode);
    fireEvent.pointerDown(outsideNode, { button: 0 });
    fireEvent.paste(document, { clipboardData });
    outsideNode.remove();

    expect(onPasteTextReference).toHaveBeenCalledWith("outside click clears prime");
    expect(onDropFiles).not.toHaveBeenCalled();
    expect(onPasteMediaReference).not.toHaveBeenCalled();
  });

  it("deduplicates immediate duplicate paste events", () => {
    const onDropFiles = vi.fn();
    const onPasteTextReference = vi.fn();
    const onPasteMediaReference = vi.fn();
    const file = new File(["image"], "dup.png", { type: "image/png" });
    const clipboardData = {
      files: makeFileList([file]),
      items: [],
      getData: vi.fn(() => ""),
      types: ["Files"],
    } as unknown as DataTransfer;

    const { container } = render(
      <ReferenceGrid
        {...baseProps}
        onDropFiles={onDropFiles}
        onPasteTextReference={onPasteTextReference}
        onPasteMediaReference={onPasteMediaReference}
      />
    );
    const panel = container.querySelector(".reference-canvas-panel");
    expect(panel).toBeTruthy();

    fireEvent.paste(panel as HTMLElement, { clipboardData });
    fireEvent.paste(panel as HTMLElement, { clipboardData });

    expect(onDropFiles).toHaveBeenCalledTimes(1);
    expect(onPasteTextReference).not.toHaveBeenCalled();
    expect(onPasteMediaReference).not.toHaveBeenCalled();
  });

  it("does not render the deprecated prompt-reference billing note", () => {
    const { container, queryByRole } = render(
      <ReferenceGrid
        {...baseProps}
        activeOutputId="prompt-ref-1"
        outputs={[
          {
            id: "prompt-ref-1",
            prompt: "cinematic portrait",
            mode: "image",
            aspect: "1:1",
            model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
            status: "ready",
            timestamp: "now",
            previewText: "cinematic portrait",
          },
        ]}
      />
    );

    expect(container.querySelector(".reference-prompt-generate-note")).toBeNull();
    expect(queryByRole("button", { name: "Generate" })).toBeNull();
  });
});
