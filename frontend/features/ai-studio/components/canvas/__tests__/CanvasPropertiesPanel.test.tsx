import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasPropertiesPanel } from "../CanvasPropertiesPanel";
import {
  useAiStudioCanvasWorkspaceState,
  useAiStudioDualCanvasWorkspaceState,
} from "../useAiStudioCanvasWorkspaceState";
import type { ResolveCanvasDropReference } from "../canvasTypes";

const createTransfer = (entries: Record<string, string>) =>
  ({
    types: Object.keys(entries),
    files: { length: 0, item: () => null },
    getData: (type: string) => entries[type] ?? "",
  }) as unknown as DataTransfer;

const defaultResolveCanvasDropReference: ResolveCanvasDropReference = (payload) => {
  if (payload.outputId === "img-1") {
    return {
      kind: "image",
      outputId: "img-1",
      mediaId: "media-1",
      src: "https://example.com/reference.png",
      alt: "Reference image",
      width: 1280,
      height: 720,
      sourceSurface: payload.sourceSurface ?? null,
    };
  }
  if (payload.outputId === "txt-1") {
    return {
      kind: "text",
      outputId: "txt-1",
      text: "Prompt reference",
      sourceSurface: payload.sourceSurface ?? null,
    };
  }
  return null;
};

type CanvasHarnessProps = {
  onPinTextReference?: (text: string) => void;
  resolveCanvasDropReference?: ResolveCanvasDropReference;
};

function CanvasHarness({ onPinTextReference, resolveCanvasDropReference }: CanvasHarnessProps) {
  const [visible, setVisible] = useState(true);
  const canvasProps = useAiStudioCanvasWorkspaceState({
    resolveCanvasDropReference: resolveCanvasDropReference ?? defaultResolveCanvasDropReference,
    onPinTextReference,
  });

  return (
    <div>
      <button type="button" onClick={() => setVisible((current) => !current)}>
        Toggle
      </button>
      {visible ? <CanvasPropertiesPanel {...canvasProps} /> : null}
    </div>
  );
}

function DualCanvasHarness({ onPinTextReference, resolveCanvasDropReference }: CanvasHarnessProps) {
  const { mainCanvasProps, railCanvasProps } = useAiStudioDualCanvasWorkspaceState({
    resolveCanvasDropReference: resolveCanvasDropReference ?? defaultResolveCanvasDropReference,
    onPinTextReference,
  });

  return (
    <div>
      <CanvasPropertiesPanel {...mainCanvasProps} />
      <CanvasPropertiesPanel {...railCanvasProps} />
    </div>
  );
}

describe("CanvasPropertiesPanel", () => {
  const mockViewportRect = (element: HTMLElement) => {
    Object.defineProperty(element, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 600,
        bottom: 400,
        width: 600,
        height: 400,
        toJSON: () => ({}),
      }),
    });
  };

  it("creates an image item from an internal reference-grid drop", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-version": "1",
        "text/reference-id": "img-1",
        "text/reference-output-id": "img-1",
        "text/reference-source-surface": "all-refs",
      }),
      clientX: 300,
      clientY: 200,
    });

    expect(await screen.findByAltText("Reference image")).toBeInTheDocument();
    const item = screen.getByTestId(/canvas-item-/);
    expect(item).toHaveAttribute("data-kind", "image");
    expect(Number(item.getAttribute("data-width"))).toBe(220);
    expect(Number(item.getAttribute("data-height"))).toBeCloseTo(123.75, 2);
  });

  it("shows a loading spinner placeholder while an image reference is resolving", async () => {
    const OriginalImage = globalThis.Image;
    let pendingImageOnload: (() => void) | null = null;
    class MockImage {
      naturalWidth = 1920;
      naturalHeight = 1080;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        pendingImageOnload = this.onload;
      }
    }
    (globalThis as { Image: typeof Image }).Image = MockImage as unknown as typeof Image;
    try {
      const slowResolveCanvasDropReference: ResolveCanvasDropReference = (payload) => {
        if (payload.outputId !== "img-slow") return null;
        return {
          kind: "image",
          outputId: "img-slow",
          mediaId: "media-slow",
          src: "https://example.com/slow-reference.png",
          alt: "Slow reference image",
          sourceSurface: payload.sourceSurface ?? null,
        };
      };
      render(<CanvasHarness resolveCanvasDropReference={slowResolveCanvasDropReference} />);
      const viewport = screen.getByTestId("canvas-viewport");
      mockViewportRect(viewport);

      fireEvent.drop(viewport, {
        dataTransfer: createTransfer({
          "text/reference-origin": "ai-studio-reference-grid",
          "text/reference-version": "1",
          "text/reference-id": "img-slow",
          "text/reference-output-id": "img-slow",
          "text/reference-source-surface": "all-refs",
        }),
        clientX: 300,
        clientY: 200,
      });

      expect(screen.getByTestId("canvas-loading-spinner")).toBeInTheDocument();
      await waitFor(() => expect(typeof pendingImageOnload).toBe("function"));
      act(() => {
        pendingImageOnload?.();
      });
      expect(await screen.findByAltText("Slow reference image")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByTestId("canvas-loading-spinner")).not.toBeInTheDocument();
      });
    } finally {
      (globalThis as { Image: typeof Image }).Image = OriginalImage;
    }
  });

  it("shows a loading spinner placeholder while a text reference is resolving", async () => {
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    let pendingFrameCallback: FrameRequestCallback | null = null;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      pendingFrameCallback = callback;
      return 1;
    }) as typeof window.requestAnimationFrame;
    try {
      render(<CanvasHarness />);
      const viewport = screen.getByTestId("canvas-viewport");
      mockViewportRect(viewport);

      fireEvent.drop(viewport, {
        dataTransfer: createTransfer({
          "text/reference-origin": "ai-studio-reference-grid",
          "text/reference-version": "1",
          "text/reference-id": "txt-1",
          "text/reference-output-id": "txt-1",
          "text/reference-source-surface": "all-refs",
        }),
        clientX: 240,
        clientY: 160,
      });

      expect(screen.getByTestId("canvas-loading-spinner")).toBeInTheDocument();
      expect(screen.queryByText("Prompt reference")).not.toBeInTheDocument();
      act(() => {
        pendingFrameCallback?.(16);
      });
      expect(await screen.findByText("Prompt reference")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByTestId("canvas-loading-spinner")).not.toBeInTheDocument();
      });
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });

  it("creates a text item from an internal prompt drop", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-version": "1",
        "text/reference-id": "txt-1",
        "text/reference-output-id": "txt-1",
        "text/reference-source-surface": "all-refs",
      }),
      clientX: 240,
      clientY: 160,
    });

    expect(await screen.findByText("Prompt reference")).toBeInTheDocument();
    expect(await screen.findByTestId(/canvas-item-/)).toHaveAttribute("data-kind", "text");
  });

  it("creates a text item from an external plain-text drop", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "External note",
      }),
      clientX: 220,
      clientY: 140,
    });

    expect(await screen.findByText("External note")).toBeInTheDocument();
  });

  it("pins a text reference to the grid via the pin button", async () => {
    const pinSpy = vi.fn();
    render(<CanvasHarness onPinTextReference={pinSpy} />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.doubleClick(viewport, {
      clientX: 280,
      clientY: 180,
    });

    const input = screen.getByTestId("canvas-draft-text-input");
    fireEvent.change(input, {
      target: { value: "Pin this prompt" },
    });
    fireEvent.keyDown(input, {
      key: "Enter",
    });

    const pinButton = await screen.findByLabelText("Pin text reference to reference grid");
    fireEvent.pointerDown(pinButton, {
      button: 0,
      pointerId: 401,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerUp(pinButton, {
      pointerId: 401,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.click(pinButton);

    expect(pinSpy).toHaveBeenCalledWith("Pin this prompt");
  });

  it("creates a manual text reference on blank-space double click and saves it on Enter", () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.doubleClick(viewport, {
      clientX: 280,
      clientY: 180,
    });

    const input = screen.getByTestId("canvas-draft-text-input");
    fireEvent.change(input, {
      target: { value: "Manual canvas note" },
    });
    fireEvent.keyDown(input, {
      key: "Enter",
    });

    expect(screen.getByText("Manual canvas note")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-draft-text-input")).not.toBeInTheDocument();
  });

  it("edits a text reference in place on double click and saves with Enter", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Original note",
      }),
      clientX: 260,
      clientY: 170,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    fireEvent.doubleClick(item);

    const input = screen.getByTestId("canvas-text-edit-input");
    fireEvent.change(input, {
      target: { value: "Edited note" },
    });
    fireEvent.keyDown(input, {
      key: "Enter",
    });

    expect(screen.getByText("Edited note")).toBeInTheDocument();
    expect(screen.queryByText("Original note")).not.toBeInTheDocument();
    expect(screen.queryByTestId("canvas-text-edit-input")).not.toBeInTheDocument();
  });

  it("supports select and deselect interactions", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Selectable note",
      }),
      clientX: 220,
      clientY: 140,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    expect(item).toHaveAttribute("data-selected", "true");

    fireEvent.pointerDown(viewport, {
      button: 0,
      pointerId: 10,
      clientX: 20,
      clientY: 20,
    });
    expect(item).toHaveAttribute("data-selected", "false");

    fireEvent.pointerDown(item, {
      button: 0,
      pointerId: 11,
      clientX: 240,
      clientY: 170,
    });
    expect(item).toHaveAttribute("data-selected", "true");
  });

  it("deletes the selected reference when Delete is pressed", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-version": "1",
        "text/reference-id": "img-1",
        "text/reference-output-id": "img-1",
        "text/reference-source-surface": "all-refs",
      }),
      clientX: 300,
      clientY: 200,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    expect(item).toHaveAttribute("data-selected", "true");

    fireEvent.keyDown(viewport, {
      key: "Delete",
    });

    await waitFor(() => {
      expect(screen.queryByTestId(/canvas-item-/)).not.toBeInTheDocument();
      expect(screen.queryByAltText("Reference image")).not.toBeInTheDocument();
    });
  });

  it("deletes a reference when right-clicking the canvas item", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Context menu note",
      }),
      clientX: 240,
      clientY: 150,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    fireEvent.contextMenu(item);

    await waitFor(() => {
      expect(screen.queryByTestId(/canvas-item-/)).not.toBeInTheDocument();
      expect(screen.queryByText("Context menu note")).not.toBeInTheDocument();
    });
  });

  it("updates item coordinates while dragging", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Drag me",
      }),
      clientX: 220,
      clientY: 140,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const startX = Number(item.getAttribute("data-x"));
    const startY = Number(item.getAttribute("data-y"));

    fireEvent.pointerDown(item, {
      button: 0,
      pointerId: 20,
      clientX: 220,
      clientY: 140,
    });
    fireEvent.pointerMove(item, {
      pointerId: 20,
      clientX: 260,
      clientY: 175,
    });
    fireEvent.pointerUp(item, {
      pointerId: 20,
      clientX: 260,
      clientY: 175,
    });

    expect(Number(item.getAttribute("data-x"))).toBeGreaterThan(startX);
    expect(Number(item.getAttribute("data-y"))).toBeGreaterThan(startY);
  });

  it("pans instead of dragging when Space is held while dragging over an item", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Pan override",
      }),
      clientX: 220,
      clientY: 140,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const startItemX = Number(item.getAttribute("data-x"));
    const startItemY = Number(item.getAttribute("data-y"));

    fireEvent.keyDown(window, {
      code: "Space",
      key: " ",
    });

    fireEvent.pointerDown(item, {
      button: 0,
      pointerId: 120,
      clientX: 220,
      clientY: 140,
    });
    fireEvent.pointerMove(item, {
      pointerId: 120,
      clientX: 260,
      clientY: 180,
    });
    fireEvent.pointerUp(item, {
      pointerId: 120,
      clientX: 260,
      clientY: 180,
    });

    fireEvent.keyUp(window, {
      code: "Space",
      key: " ",
    });

    expect(Number(item.getAttribute("data-x"))).toBe(startItemX);
    expect(Number(item.getAttribute("data-y"))).toBe(startItemY);
    expect(Number(viewport.getAttribute("data-camera-x"))).toBe(40);
    expect(Number(viewport.getAttribute("data-camera-y"))).toBe(40);
  });

  it("pans instead of dragging when using middle mouse drag over an item", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Middle pan override",
      }),
      clientX: 220,
      clientY: 140,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const startItemX = Number(item.getAttribute("data-x"));
    const startItemY = Number(item.getAttribute("data-y"));

    fireEvent.pointerDown(item, {
      button: 1,
      pointerId: 121,
      clientX: 220,
      clientY: 140,
    });
    fireEvent.pointerMove(item, {
      pointerId: 121,
      clientX: 265,
      clientY: 185,
    });
    fireEvent.pointerUp(item, {
      pointerId: 121,
      clientX: 265,
      clientY: 185,
    });

    expect(Number(item.getAttribute("data-x"))).toBe(startItemX);
    expect(Number(item.getAttribute("data-y"))).toBe(startItemY);
    expect(Number(viewport.getAttribute("data-camera-x"))).toBe(45);
    expect(Number(viewport.getAttribute("data-camera-y"))).toBe(45);
  });

  it("updates camera position while panning the background", () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    expect(viewport).toHaveAttribute("data-camera-x", "0");
    expect(viewport).toHaveAttribute("data-camera-y", "0");

    fireEvent.pointerDown(viewport, {
      button: 0,
      pointerId: 30,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 30,
      clientX: 140,
      clientY: 150,
    });
    fireEvent.pointerUp(viewport, {
      pointerId: 30,
      clientX: 140,
      clientY: 150,
    });

    expect(Number(viewport.getAttribute("data-camera-x"))).toBe(40);
    expect(Number(viewport.getAttribute("data-camera-y"))).toBe(50);
  });

  it("zooms around the pointer location", () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.wheel(viewport, {
      deltaY: -100,
      clientX: 300,
      clientY: 200,
    });

    expect(Number(viewport.getAttribute("data-camera-zoom"))).toBeGreaterThan(1);
  });

  it("preserves scene state when the panel unmounts and remounts within the page session", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Persistent note",
      }),
      clientX: 240,
      clientY: 160,
    });

    expect(await screen.findByText("Persistent note")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle" }));
    expect(screen.queryByTestId("canvas-viewport")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle" }));
    expect(screen.getByText("Persistent note")).toBeInTheDocument();
  });

  it("shares scene state across main/rail instances while keeping camera state separate", async () => {
    const { container } = render(<DualCanvasHarness />);
    const mainViewport = container.querySelector(
      '[data-canvas-instance="main"]'
    ) as HTMLElement | null;
    const railViewport = container.querySelector(
      '[data-canvas-instance="rail"]'
    ) as HTMLElement | null;
    expect(mainViewport).toBeTruthy();
    expect(railViewport).toBeTruthy();
    mockViewportRect(mainViewport as HTMLElement);
    mockViewportRect(railViewport as HTMLElement);

    fireEvent.drop(mainViewport as HTMLElement, {
      dataTransfer: createTransfer({
        "text/plain": "Shared note",
      }),
      clientX: 220,
      clientY: 140,
    });

    await waitFor(() => {
      expect(screen.getAllByText("Shared note")).toHaveLength(2);
    });

    fireEvent.wheel(mainViewport as HTMLElement, {
      deltaY: -100,
      clientX: 300,
      clientY: 200,
    });

    expect(Number((mainViewport as HTMLElement).getAttribute("data-camera-zoom"))).toBeGreaterThan(
      1
    );
    expect((railViewport as HTMLElement).getAttribute("data-camera-zoom")).toBe("1");
  });
});
