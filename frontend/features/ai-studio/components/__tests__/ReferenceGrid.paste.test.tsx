/**
 * Clipboard paste behavior tests for ReferenceGrid.
 * Verifies pasted media files and plain text are converted into reference-grid actions.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReferenceGrid, type ReferenceGridProps } from "../ReferenceGrid";

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
