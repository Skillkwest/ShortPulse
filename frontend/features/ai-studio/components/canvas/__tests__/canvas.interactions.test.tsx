import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CanvasHarness,
  DualCanvasHarness,
  createTransfer,
  mockViewportRect,
} from "./canvasTestHarness";

describe("Canvas interaction behavior", () => {
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

  it("does not create a draft from double-tap fallback when tap travel exceeds threshold", () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.pointerDown(viewport, {
      button: 0,
      pointerId: 71,
      clientX: 220,
      clientY: 140,
    });
    fireEvent.pointerUp(viewport, {
      button: 0,
      pointerId: 71,
      clientX: 260,
      clientY: 180,
    });
    fireEvent.pointerDown(viewport, {
      button: 0,
      pointerId: 72,
      clientX: 262,
      clientY: 182,
    });
    fireEvent.pointerUp(viewport, {
      button: 0,
      pointerId: 72,
      clientX: 262,
      clientY: 182,
    });

    expect(screen.queryByTestId("canvas-draft-text-input")).toBeNull();
  });

  it("does not create a draft from pointer detail fallback while space-pan is active", () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.keyDown(window, {
      code: "Space",
      key: " ",
    });
    fireEvent.pointerDown(viewport, {
      button: 0,
      detail: 2,
      pointerId: 73,
      clientX: 290,
      clientY: 190,
    });
    fireEvent.keyUp(window, {
      code: "Space",
      key: " ",
    });

    expect(screen.queryByTestId("canvas-draft-text-input")).toBeNull();
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

  it("consumes wheel in the rail viewport so window scroll is not triggered", () => {
    const { container } = render(<DualCanvasHarness />);
    const railViewport = container.querySelector(
      '[data-canvas-instance="rail"]'
    ) as HTMLElement | null;
    expect(railViewport).toBeTruthy();
    mockViewportRect(railViewport as HTMLElement);

    const windowWheelSpy = vi.fn();
    window.addEventListener("wheel", windowWheelSpy);
    try {
      const wheelEvent = new WheelEvent("wheel", {
        deltaY: -100,
        clientX: 300,
        clientY: 200,
        bubbles: true,
        cancelable: true,
      });
      let dispatchResult = true;
      act(() => {
        dispatchResult = (railViewport as HTMLElement).dispatchEvent(wheelEvent);
      });

      expect(dispatchResult).toBe(false);
      expect(wheelEvent.defaultPrevented).toBe(true);
      expect(windowWheelSpy).not.toHaveBeenCalled();
      expect(
        Number((railViewport as HTMLElement).getAttribute("data-camera-zoom"))
      ).toBeGreaterThan(1);
    } finally {
      window.removeEventListener("wheel", windowWheelSpy);
    }
  });
});
