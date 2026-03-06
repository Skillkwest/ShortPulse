import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasPropertiesPanel } from "../CanvasPropertiesPanel";
import { useAiStudioCanvasWorkspaceState } from "../useAiStudioCanvasWorkspaceState";
import type { ResolveCanvasDropReference } from "../canvasTypes";

const createTransfer = (entries: Record<string, string>) =>
  ({
    types: Object.keys(entries),
    files: { length: 0, item: () => null },
    getData: (type: string) => entries[type] ?? "",
  }) as unknown as DataTransfer;

const resolveCanvasDropReference: ResolveCanvasDropReference = (payload) => {
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
};

function CanvasHarness({ onPinTextReference }: CanvasHarnessProps) {
  const [visible, setVisible] = useState(true);
  const canvasProps = useAiStudioCanvasWorkspaceState({
    resolveCanvasDropReference,
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

  it("creates a text item from an internal prompt drop", () => {
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

    expect(screen.getByText("Prompt reference")).toBeInTheDocument();
    expect(screen.getByTestId(/canvas-item-/)).toHaveAttribute("data-kind", "text");
  });

  it("creates a text item from an external plain-text drop", () => {
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

    expect(screen.getByText("External note")).toBeInTheDocument();
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

  it("edits a text reference in place on double click and saves with Enter", () => {
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

    const item = screen.getByTestId(/canvas-item-/);
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

  it("supports select and deselect interactions", () => {
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

    const item = screen.getByTestId(/canvas-item-/);
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

  it("updates item coordinates while dragging", () => {
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

    const item = screen.getByTestId(/canvas-item-/);
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

  it("preserves scene state when the panel unmounts and remounts within the page session", () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Toggle" }));
    expect(screen.queryByTestId("canvas-viewport")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle" }));
    expect(screen.getByText("Persistent note")).toBeInTheDocument();
  });
});
