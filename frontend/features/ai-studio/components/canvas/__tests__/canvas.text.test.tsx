import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasHarness, createTransfer, mockViewportRect } from "./canvasTestHarness";

describe("Canvas text behavior", () => {
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

  it("creates a manual text reference from viewport pointer double-tap fallback", () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.pointerDown(viewport, {
      button: 0,
      pointerId: 51,
      clientX: 280,
      clientY: 180,
    });
    fireEvent.pointerUp(viewport, {
      button: 0,
      pointerId: 51,
      clientX: 280,
      clientY: 180,
    });
    fireEvent.pointerDown(viewport, {
      button: 0,
      pointerId: 52,
      clientX: 283,
      clientY: 181,
    });
    fireEvent.pointerUp(viewport, {
      button: 0,
      pointerId: 52,
      clientX: 283,
      clientY: 181,
    });

    expect(screen.getByTestId("canvas-draft-text-input")).toBeInTheDocument();
  });

  it("creates a manual text reference from pointer double-click detail fallback", () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.pointerDown(viewport, {
      button: 0,
      detail: 2,
      pointerId: 61,
      clientX: 290,
      clientY: 190,
    });

    expect(screen.getByTestId("canvas-draft-text-input")).toBeInTheDocument();
  });

  it("dedupes detail fallback and native dblclick into a single draft", () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.pointerDown(viewport, {
      button: 0,
      detail: 2,
      pointerId: 62,
      clientX: 292,
      clientY: 192,
    });
    fireEvent.doubleClick(viewport, {
      clientX: 292,
      clientY: 192,
    });

    expect(screen.getAllByTestId("canvas-draft-text-input")).toHaveLength(1);
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
});
