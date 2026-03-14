import { act, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CanvasHarness,
  DualCanvasHarness,
  createTransfer,
  mockViewportRect,
} from "./canvasTestHarness";

const dragMarquee = ({
  viewport,
  startX,
  startY,
  endX,
  endY,
  shiftKey = false,
  pointerId = 900,
}: {
  viewport: HTMLElement;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  shiftKey?: boolean;
  pointerId?: number;
}) => {
  fireEvent.pointerDown(viewport, {
    button: 0,
    pointerId,
    shiftKey,
    clientX: startX,
    clientY: startY,
  });
  fireEvent.pointerMove(viewport, {
    pointerId,
    shiftKey,
    clientX: endX,
    clientY: endY,
  });
  fireEvent.pointerUp(viewport, {
    button: 0,
    pointerId,
    shiftKey,
    clientX: endX,
    clientY: endY,
  });
};

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

  it("does not consume ctrl+primary pointerdown so context-menu intent can proceed", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Context candidate",
      }),
      clientX: 220,
      clientY: 140,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const pointerDown = createEvent.pointerDown(item, {
      button: 0,
      ctrlKey: true,
      pointerId: 122,
      clientX: 220,
      clientY: 140,
    });
    fireEvent(item, pointerDown);

    expect(pointerDown.defaultPrevented).toBe(false);
  });

  it("does not pan the background from plain left drag", async () => {
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
      clientX: 240,
      clientY: 180,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    expect(item).toHaveAttribute("data-selected", "true");
    expect(viewport).toHaveAttribute("data-camera-x", "0");
    expect(viewport).toHaveAttribute("data-camera-y", "0");

    fireEvent.pointerDown(viewport, {
      button: 0,
      pointerId: 30,
      clientX: 20,
      clientY: 20,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 30,
      clientX: 100,
      clientY: 80,
    });
    fireEvent.pointerUp(viewport, {
      button: 0,
      pointerId: 30,
      clientX: 100,
      clientY: 80,
    });

    expect(item).toHaveAttribute("data-selected", "false");
    expect(Number(viewport.getAttribute("data-camera-x"))).toBe(0);
    expect(Number(viewport.getAttribute("data-camera-y"))).toBe(0);
  });

  it("pans the background when Space is held", () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.keyDown(window, {
      code: "Space",
      key: " ",
    });
    fireEvent.pointerDown(viewport, {
      button: 0,
      pointerId: 31,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 31,
      clientX: 140,
      clientY: 150,
    });
    fireEvent.pointerUp(viewport, {
      button: 0,
      pointerId: 31,
      clientX: 140,
      clientY: 150,
    });
    fireEvent.keyUp(window, {
      code: "Space",
      key: " ",
    });

    expect(Number(viewport.getAttribute("data-camera-x"))).toBe(40);
    expect(Number(viewport.getAttribute("data-camera-y"))).toBe(50);
  });

  it("creates a draft from double-tap fallback when slight drag jitter would otherwise trigger pan", () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.pointerDown(viewport, {
      button: 0,
      pointerId: 80,
      clientX: 220,
      clientY: 140,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 80,
      clientX: 228,
      clientY: 148,
    });
    fireEvent.pointerUp(viewport, {
      button: 0,
      pointerId: 80,
      clientX: 228,
      clientY: 148,
    });

    fireEvent.pointerDown(viewport, {
      button: 0,
      pointerId: 81,
      clientX: 232,
      clientY: 152,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 81,
      clientX: 240,
      clientY: 160,
    });
    fireEvent.pointerUp(viewport, {
      button: 0,
      pointerId: 81,
      clientX: 240,
      clientY: 160,
    });

    expect(screen.getByTestId("canvas-draft-text-input")).toBeInTheDocument();
    expect(Number(viewport.getAttribute("data-camera-x"))).toBe(0);
    expect(Number(viewport.getAttribute("data-camera-y"))).toBe(0);
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

  it("supports additive marquee selection with Shift", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    const internalImageTransfer = createTransfer({
      "text/reference-origin": "ai-studio-reference-grid",
      "text/reference-version": "1",
      "text/reference-id": "img-1",
      "text/reference-output-id": "img-1",
      "text/reference-source-surface": "all-refs",
    });
    fireEvent.drop(viewport, {
      dataTransfer: internalImageTransfer,
      clientX: 220,
      clientY: 140,
    });
    fireEvent.drop(viewport, {
      dataTransfer: internalImageTransfer,
      clientX: 560,
      clientY: 300,
    });

    const items = await screen.findAllByTestId(/canvas-item-/);
    expect(items).toHaveLength(2);

    const [itemA, itemB] = items;
    const xA = Number(itemA.getAttribute("data-x"));
    const yA = Number(itemA.getAttribute("data-y"));
    const xB = Number(itemB.getAttribute("data-x"));
    const yB = Number(itemB.getAttribute("data-y"));

    fireEvent.pointerDown(itemA, {
      button: 0,
      pointerId: 901,
      clientX: xA + 20,
      clientY: yA + 20,
    });
    fireEvent.pointerUp(itemA, {
      pointerId: 901,
      clientX: xA + 20,
      clientY: yA + 20,
    });
    expect(itemA).toHaveAttribute("data-selected", "true");
    expect(itemB).toHaveAttribute("data-selected", "false");

    dragMarquee({
      viewport,
      pointerId: 902,
      shiftKey: true,
      startX: xB + 12,
      startY: yB + 12,
      endX: xB + 48,
      endY: yB + 48,
    });
    expect(itemA).toHaveAttribute("data-selected", "true");
    expect(itemB).toHaveAttribute("data-selected", "true");
  });

  it("selects items when marquee touches item edges", async () => {
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
      clientY: 220,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const x = Number(item.getAttribute("data-x"));
    const y = Number(item.getAttribute("data-y"));

    dragMarquee({
      viewport,
      pointerId: 903,
      startX: x - 50,
      startY: y - 40,
      endX: x,
      endY: y + 40,
    });

    expect(item).toHaveAttribute("data-selected", "true");
  });

  it("applies marquee selection to text canvas items", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Text target",
      }),
      clientX: 260,
      clientY: 180,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const x = Number(item.getAttribute("data-x"));
    const y = Number(item.getAttribute("data-y"));
    const width = Number(item.getAttribute("data-width"));

    dragMarquee({
      viewport,
      pointerId: 910,
      startX: x - 12,
      startY: y - 12,
      endX: x + width + 12,
      endY: y + 120 + 12,
    });

    expect(item).toHaveAttribute("data-selected", "true");
  });

  it("moves all selected items when dragging one selected item", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    const internalImageTransfer = createTransfer({
      "text/reference-origin": "ai-studio-reference-grid",
      "text/reference-version": "1",
      "text/reference-id": "img-1",
      "text/reference-output-id": "img-1",
      "text/reference-source-surface": "all-refs",
    });
    fireEvent.drop(viewport, {
      dataTransfer: internalImageTransfer,
      clientX: 220,
      clientY: 140,
    });
    fireEvent.drop(viewport, {
      dataTransfer: internalImageTransfer,
      clientX: 560,
      clientY: 300,
    });

    const items = await screen.findAllByTestId(/canvas-item-/);
    const [itemA, itemB] = items;

    const xAStart = Number(itemA.getAttribute("data-x"));
    const yAStart = Number(itemA.getAttribute("data-y"));
    const xBStart = Number(itemB.getAttribute("data-x"));
    const yBStart = Number(itemB.getAttribute("data-y"));

    dragMarquee({
      viewport,
      pointerId: 904,
      startX: xAStart + 16,
      startY: yAStart + 16,
      endX: xAStart + 52,
      endY: yAStart + 52,
    });
    dragMarquee({
      viewport,
      pointerId: 905,
      shiftKey: true,
      startX: xBStart + 16,
      startY: yBStart + 16,
      endX: xBStart + 52,
      endY: yBStart + 52,
    });

    fireEvent.pointerDown(itemA, {
      button: 0,
      pointerId: 906,
      clientX: xAStart + 20,
      clientY: yAStart + 20,
    });
    fireEvent.pointerMove(itemA, {
      pointerId: 906,
      clientX: xAStart + 60,
      clientY: yAStart + 52,
    });
    fireEvent.pointerUp(itemA, {
      pointerId: 906,
      clientX: xAStart + 60,
      clientY: yAStart + 52,
    });

    expect(Number(itemA.getAttribute("data-x"))).toBeGreaterThan(xAStart);
    expect(Number(itemA.getAttribute("data-y"))).toBeGreaterThan(yAStart);
    expect(Number(itemB.getAttribute("data-x"))).toBeGreaterThan(xBStart);
    expect(Number(itemB.getAttribute("data-y"))).toBeGreaterThan(yBStart);
  });

  it("deletes all selected items after marquee multi-select", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    const internalImageTransfer = createTransfer({
      "text/reference-origin": "ai-studio-reference-grid",
      "text/reference-version": "1",
      "text/reference-id": "img-1",
      "text/reference-output-id": "img-1",
      "text/reference-source-surface": "all-refs",
    });
    fireEvent.drop(viewport, {
      dataTransfer: internalImageTransfer,
      clientX: 220,
      clientY: 140,
    });
    fireEvent.drop(viewport, {
      dataTransfer: internalImageTransfer,
      clientX: 560,
      clientY: 300,
    });

    const items = await screen.findAllByTestId(/canvas-item-/);
    const [itemA, itemB] = items;
    const xA = Number(itemA.getAttribute("data-x"));
    const yA = Number(itemA.getAttribute("data-y"));
    const xB = Number(itemB.getAttribute("data-x"));
    const yB = Number(itemB.getAttribute("data-y"));

    dragMarquee({
      viewport,
      pointerId: 908,
      startX: xA + 14,
      startY: yA + 14,
      endX: xA + 46,
      endY: yA + 46,
    });
    dragMarquee({
      viewport,
      pointerId: 909,
      shiftKey: true,
      startX: xB + 14,
      startY: yB + 14,
      endX: xB + 46,
      endY: yB + 46,
    });

    fireEvent.keyDown(viewport, {
      key: "Delete",
    });

    await waitFor(() => {
      expect(screen.queryByTestId(/canvas-item-/)).toBeNull();
    });
  });

  it("keeps folder-canvas Shift drag export lane and avoids pointer-move scene drag", async () => {
    const onItemDragStart = vi.fn();
    render(<CanvasHarness isItemDraggable onItemDragStart={onItemDragStart} />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Export me",
      }),
      clientX: 220,
      clientY: 140,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const startX = Number(item.getAttribute("data-x"));
    const startY = Number(item.getAttribute("data-y"));

    fireEvent.pointerDown(item, {
      button: 0,
      pointerId: 907,
      shiftKey: true,
      clientX: 220,
      clientY: 140,
    });
    fireEvent.pointerMove(item, {
      pointerId: 907,
      shiftKey: true,
      clientX: 280,
      clientY: 200,
    });
    fireEvent.dragStart(item, {
      shiftKey: true,
      dataTransfer: createTransfer({}),
    });

    expect(onItemDragStart).toHaveBeenCalledTimes(1);
    expect(Number(item.getAttribute("data-x"))).toBe(startX);
    expect(Number(item.getAttribute("data-y"))).toBe(startY);
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

  it("keeps a draft visible after main-canvas double-click when dual canvas is mounted", () => {
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

    fireEvent.doubleClick(mainViewport as HTMLElement, {
      button: 0,
      clientX: 240,
      clientY: 180,
    });

    expect(screen.getByTestId("canvas-draft-text-input")).toBeInTheDocument();
    expect(screen.getAllByTestId("canvas-draft-text-input")).toHaveLength(1);
  });
});
