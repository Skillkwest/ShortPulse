import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  CanvasHarness,
  SeededCanvasHarness,
  DualCanvasHarness,
  createTransfer,
  mockViewportRect,
} from "./canvasTestHarness";
import { createCanvasTearOutComposerTargetRegistry } from "../../../hooks/useAiStudioCanvasTearOutTargets";

const canvasWorkspaceCss = readFileSync(
  `${process.cwd()}/styles/ai-studio-canvas-workspace.css`,
  "utf8"
);
const referenceGridSplitCss = readFileSync(
  `${process.cwd()}/styles/ai-studio-reference-grid-split.css`,
  "utf8"
);

const dispatchDropAtPoint = ({
  viewport,
  dataTransfer,
  clientX,
  clientY,
}: {
  viewport: HTMLElement;
  dataTransfer: DataTransfer;
  clientX: number;
  clientY: number;
}) => {
  const event = createEvent.drop(viewport);
  Object.defineProperty(event, "dataTransfer", {
    configurable: true,
    value: dataTransfer,
  });
  Object.defineProperty(event, "clientX", {
    configurable: true,
    value: clientX,
  });
  Object.defineProperty(event, "clientY", {
    configurable: true,
    value: clientY,
  });
  fireEvent(viewport, event);
};

const installCanvasWorkspaceStyles = () => {
  const style = document.createElement("style");
  style.textContent = canvasWorkspaceCss;
  document.head.append(style);
  return () => style.remove();
};

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
  it("keeps Canvas transform work inside isolated paint and layout boundaries", () => {
    expect(referenceGridSplitCss).toMatch(
      /\.reference-rail-canvas-section\s*{[^}]*contain:\s*layout paint style;/s
    );
    expect(referenceGridSplitCss).toMatch(
      /\.reference-rail-canvas-body\s*{[^}]*contain:\s*layout paint style;/s
    );
    expect(canvasWorkspaceCss).toMatch(
      /\.canvas-workspace-viewport\s*{[^}]*contain:\s*layout paint style;/s
    );
    expect(canvasWorkspaceCss).toMatch(
      /\.canvas-workspace-viewport\s*{[^}]*isolation:\s*isolate;/s
    );
    expect(canvasWorkspaceCss).toMatch(
      /\.canvas-workspace-world\s*{[^}]*will-change:\s*transform;/s
    );
    expect(canvasWorkspaceCss).toMatch(
      /\.canvas-camera-zoom-badge\s*{[^}]*min-width:\s*26px;[^}]*font-size:\s*9px;/s
    );
    expect(canvasWorkspaceCss).not.toMatch(
      /\.canvas-camera-zoom-badge\s*{[^}]*position:\s*absolute;/s
    );
    expect(canvasWorkspaceCss).toMatch(
      /\.canvas-scene-item__media-action-row\s*{[^}]*transform:\s*scale\(var\(--canvas-control-scale,\s*1\)\);/s
    );
    expect(canvasWorkspaceCss).toMatch(
      /\.canvas-scene-item__resize-handle\s*{[^}]*transform:\s*scale\(var\(--canvas-control-scale,\s*1\)\);[^}]*transform-origin:\s*center;/s
    );
    expect(canvasWorkspaceCss).toMatch(
      /\.canvas-scene-item__media-action-row--top\s*{[^}]*transform-origin:\s*top right;/s
    );
    expect(canvasWorkspaceCss).toMatch(
      /\.canvas-scene-item__media-action-row--bottom\s*{[^}]*left:\s*6px;[^}]*bottom:\s*6px;[^}]*transform-origin:\s*bottom left;/s
    );
    expect(canvasWorkspaceCss).toMatch(
      /\.canvas-scene-item__media-duration\s*{[^}]*right:\s*8px;[^}]*bottom:\s*8px;/s
    );
    expect(canvasWorkspaceCss).not.toMatch(
      /\.canvas-scene-item\.is-selected\s+\.canvas-scene-item__media-duration\s*{[^}]*left:\s*8px;/s
    );
    expect(canvasWorkspaceCss).toMatch(
      /\.canvas-scene-item--audio\.canvas-scene-item--ghost\s*{[^}]*opacity:\s*1;/s
    );
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

  it("previews item movement with a ghost before committing on release", async () => {
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
    const itemId = item.getAttribute("data-testid")?.replace("canvas-item-", "") ?? "";
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

    const ghost = await screen.findByTestId(`canvas-item-ghost-${itemId}`);
    expect(Number(item.getAttribute("data-x"))).toBe(startX);
    expect(Number(item.getAttribute("data-y"))).toBe(startY);
    expect(Number(ghost.getAttribute("data-x"))).toBeGreaterThan(startX);
    expect(Number(ghost.getAttribute("data-y"))).toBeGreaterThan(startY);

    fireEvent.pointerUp(item, {
      pointerId: 20,
      clientX: 260,
      clientY: 175,
    });

    await waitFor(() => {
      expect(screen.queryByTestId(`canvas-item-ghost-${itemId}`)).not.toBeInTheDocument();
      expect(Number(item.getAttribute("data-x"))).toBeGreaterThan(startX);
      expect(Number(item.getAttribute("data-y"))).toBeGreaterThan(startY);
    });
  });

  it("continues ghost dragging when move and release events land on the viewport", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Viewport fallback drag",
      }),
      clientX: 220,
      clientY: 140,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const itemId = item.getAttribute("data-testid")?.replace("canvas-item-", "") ?? "";
    const startX = Number(item.getAttribute("data-x"));
    const startY = Number(item.getAttribute("data-y"));

    fireEvent.pointerDown(item, {
      button: 0,
      pointerId: 221,
      clientX: 220,
      clientY: 140,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 221,
      clientX: 276,
      clientY: 188,
    });

    const ghost = await screen.findByTestId(`canvas-item-ghost-${itemId}`);
    expect(Number(item.getAttribute("data-x"))).toBe(startX);
    expect(Number(item.getAttribute("data-y"))).toBe(startY);
    expect(Number(ghost.getAttribute("data-x"))).toBe(startX + 56);
    expect(Number(ghost.getAttribute("data-y"))).toBe(startY + 48);

    fireEvent.pointerUp(viewport, {
      button: 0,
      pointerId: 221,
      clientX: 276,
      clientY: 188,
    });

    await waitFor(() => {
      expect(screen.queryByTestId(`canvas-item-ghost-${itemId}`)).not.toBeInTheDocument();
      expect(Number(item.getAttribute("data-x"))).toBe(startX + 56);
      expect(Number(item.getAttribute("data-y"))).toBe(startY + 48);
    });
  });

  it("cancels boundary tear-out when released outside Canvas without a composer target", async () => {
    const registry = createCanvasTearOutComposerTargetRegistry();
    render(<CanvasHarness canvasTearOutTargetRegistry={registry} />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Cancel tear out",
      }),
      clientX: 220,
      clientY: 140,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const itemId = item.getAttribute("data-testid")?.replace("canvas-item-", "") ?? "";
    const startX = Number(item.getAttribute("data-x"));
    const startY = Number(item.getAttribute("data-y"));

    fireEvent.pointerDown(item, {
      button: 0,
      pointerId: 772,
      clientX: 220,
      clientY: 140,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 772,
      clientX: 650,
      clientY: 150,
    });

    const tearOutGhost = await screen.findByTestId(`canvas-item-tear-out-ghost-${itemId}`);
    expect(tearOutGhost).toHaveAttribute("data-phase", "candidate");
    expect(tearOutGhost).toHaveAttribute("data-client-x", "650");
    expect(tearOutGhost.style.getPropertyValue("--canvas-item-x")).toBe("636px");
    expect(tearOutGhost.style.getPropertyValue("--canvas-item-y")).toBe("136px");
    expect(tearOutGhost.parentElement).toBe(document.body);
    expect(screen.queryByTestId(`canvas-item-ghost-${itemId}`)).not.toBeInTheDocument();

    fireEvent.pointerUp(viewport, {
      button: 0,
      pointerId: 772,
      clientX: 650,
      clientY: 150,
    });

    await waitFor(() => {
      expect(screen.queryByTestId(`canvas-item-ghost-${itemId}`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`canvas-item-tear-out-ghost-${itemId}`)).not.toBeInTheDocument();
      expect(Number(item.getAttribute("data-x"))).toBe(startX);
      expect(Number(item.getAttribute("data-y"))).toBe(startY);
    });
  });

  it("copies a text item to a registered composer target without moving the source item", async () => {
    const registry = createCanvasTearOutComposerTargetRegistry();
    const accept = vi.fn();
    const setActive = vi.fn();
    const targetElement = document.createElement("div");
    targetElement.getBoundingClientRect = vi.fn(
      () =>
        ({
          x: 650,
          y: 100,
          left: 650,
          top: 100,
          right: 850,
          bottom: 250,
          width: 200,
          height: 150,
          toJSON: () => ({}),
        }) as DOMRect
    );
    document.body.append(targetElement);
    const unregister = registry.registerTarget({
      id: "test-composer",
      element: targetElement,
      canAccept: (payload) => payload.kind === "text",
      accept,
      setActive,
    });

    try {
      render(<CanvasHarness canvasTearOutTargetRegistry={registry} />);
      const viewport = screen.getByTestId("canvas-viewport");
      mockViewportRect(viewport);

      fireEvent.drop(viewport, {
        dataTransfer: createTransfer({
          "text/plain": "Copy me",
        }),
        clientX: 220,
        clientY: 140,
      });

      const item = await screen.findByTestId(/canvas-item-/);
      const itemId = item.getAttribute("data-testid")?.replace("canvas-item-", "") ?? "";
      const startX = Number(item.getAttribute("data-x"));
      const startY = Number(item.getAttribute("data-y"));

      fireEvent.pointerDown(item, {
        button: 0,
        pointerId: 773,
        clientX: 220,
        clientY: 140,
      });
      fireEvent.pointerMove(viewport, {
        pointerId: 773,
        clientX: 700,
        clientY: 150,
      });
      const tearOutGhost = await screen.findByTestId(`canvas-item-tear-out-ghost-${itemId}`);
      expect(tearOutGhost).toHaveAttribute("data-phase", "active");
      expect(tearOutGhost).toHaveAttribute("data-client-x", "700");
      fireEvent.pointerUp(viewport, {
        button: 0,
        pointerId: 773,
        clientX: 700,
        clientY: 150,
      });

      expect(accept).toHaveBeenCalledTimes(1);
      expect(accept).toHaveBeenCalledWith({
        kind: "text",
        text: "Copy me",
      });
      expect(setActive).toHaveBeenCalledWith(true);
      expect(setActive).toHaveBeenLastCalledWith(false);
      expect(screen.queryByTestId(`canvas-item-tear-out-ghost-${itemId}`)).not.toBeInTheDocument();
      expect(Number(item.getAttribute("data-x"))).toBe(startX);
      expect(Number(item.getAttribute("data-y"))).toBe(startY);
    } finally {
      unregister();
      targetElement.remove();
    }
  });

  it("keeps text items and text ghosts in absolute canvas positioning", async () => {
    const removeCanvasWorkspaceStyles = installCanvasWorkspaceStyles();
    try {
      render(<CanvasHarness />);
      const viewport = screen.getByTestId("canvas-viewport");
      mockViewportRect(viewport);

      fireEvent.drop(viewport, {
        dataTransfer: createTransfer({
          "text/plain": "Positioned text",
        }),
        clientX: 220,
        clientY: 140,
      });

      const item = await screen.findByTestId(/canvas-item-/);
      const itemId = item.getAttribute("data-testid")?.replace("canvas-item-", "") ?? "";

      fireEvent.pointerDown(item, {
        button: 0,
        pointerId: 25,
        clientX: 220,
        clientY: 140,
      });
      fireEvent.pointerMove(item, {
        pointerId: 25,
        clientX: 260,
        clientY: 175,
      });

      const ghost = await screen.findByTestId(`canvas-item-ghost-${itemId}`);
      expect(window.getComputedStyle(item).position).toBe("absolute");
      expect(window.getComputedStyle(ghost).position).toBe("absolute");
      expect(Number(ghost.getAttribute("data-y"))).toBeGreaterThan(
        Number(item.getAttribute("data-y"))
      );

      fireEvent.pointerCancel(item, {
        pointerId: 25,
        clientX: 260,
        clientY: 175,
      });
    } finally {
      removeCanvasWorkspaceStyles();
    }
  });

  it("does not commit stale ghost movement when the pointer returns to the start", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Return home",
      }),
      clientX: 220,
      clientY: 140,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const itemId = item.getAttribute("data-testid")?.replace("canvas-item-", "") ?? "";
    const startX = Number(item.getAttribute("data-x"));
    const startY = Number(item.getAttribute("data-y"));

    fireEvent.pointerDown(item, {
      button: 0,
      pointerId: 24,
      clientX: 220,
      clientY: 140,
    });
    fireEvent.pointerMove(item, {
      pointerId: 24,
      clientX: 260,
      clientY: 175,
    });

    await screen.findByTestId(`canvas-item-ghost-${itemId}`);

    fireEvent.pointerMove(item, {
      pointerId: 24,
      clientX: 220,
      clientY: 140,
    });

    await waitFor(() => {
      expect(screen.queryByTestId(`canvas-item-ghost-${itemId}`)).not.toBeInTheDocument();
    });

    fireEvent.pointerUp(item, {
      pointerId: 24,
      clientX: 220,
      clientY: 140,
    });

    expect(Number(item.getAttribute("data-x"))).toBe(startX);
    expect(Number(item.getAttribute("data-y"))).toBe(startY);
  });

  it("keeps previewing an item when pointer events continue on the viewport", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Drag through viewport",
      }),
      clientX: 220,
      clientY: 140,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const itemId = item.getAttribute("data-testid")?.replace("canvas-item-", "") ?? "";
    const startX = Number(item.getAttribute("data-x"));
    const startY = Number(item.getAttribute("data-y"));

    fireEvent.pointerDown(item, {
      button: 0,
      pointerId: 22,
      clientX: 220,
      clientY: 140,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 22,
      clientX: 300,
      clientY: 210,
    });

    const ghost = await screen.findByTestId(`canvas-item-ghost-${itemId}`);
    expect(Number(item.getAttribute("data-x"))).toBe(startX);
    expect(Number(item.getAttribute("data-y"))).toBe(startY);
    expect(Number(ghost.getAttribute("data-x"))).toBeGreaterThan(startX);
    expect(Number(ghost.getAttribute("data-y"))).toBeGreaterThan(startY);

    fireEvent.pointerUp(viewport, {
      pointerId: 22,
      clientX: 300,
      clientY: 210,
    });

    await waitFor(() => {
      expect(Number(item.getAttribute("data-x"))).toBeGreaterThan(startX);
      expect(Number(item.getAttribute("data-y"))).toBeGreaterThan(startY);
    });
  });

  it("commits pending ghost movement on pointer release before the animation frame runs", async () => {
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
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    window.requestAnimationFrame = vi.fn(
      () => 123
    ) as unknown as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = vi.fn() as unknown as typeof window.cancelAnimationFrame;

    try {
      const startX = Number(item.getAttribute("data-x"));
      const startY = Number(item.getAttribute("data-y"));

      fireEvent.pointerDown(item, {
        button: 0,
        pointerId: 21,
        clientX: 220,
        clientY: 140,
      });
      fireEvent.pointerMove(item, {
        pointerId: 21,
        clientX: 270,
        clientY: 185,
      });

      expect(Number(item.getAttribute("data-x"))).toBe(startX);
      expect(Number(item.getAttribute("data-y"))).toBe(startY);
      expect(screen.queryByTestId(/canvas-item-ghost-/)).not.toBeInTheDocument();

      fireEvent.pointerUp(item, {
        pointerId: 21,
        clientX: 270,
        clientY: 185,
      });

      await waitFor(() => {
        expect(Number(item.getAttribute("data-x"))).toBeGreaterThan(startX);
        expect(Number(item.getAttribute("data-y"))).toBeGreaterThan(startY);
      });
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  });

  it("cancels pending tear-out ghost animation frames on unmount", async () => {
    const registry = createCanvasTearOutComposerTargetRegistry();
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;

    try {
      const { unmount } = render(<CanvasHarness canvasTearOutTargetRegistry={registry} />);
      const viewport = screen.getByTestId("canvas-viewport");
      mockViewportRect(viewport);

      fireEvent.drop(viewport, {
        dataTransfer: createTransfer({
          "text/plain": "Unmount tear out",
        }),
        clientX: 220,
        clientY: 140,
      });

      const item = await screen.findByTestId(/canvas-item-/);
      window.requestAnimationFrame = vi.fn(
        () => 456
      ) as unknown as typeof window.requestAnimationFrame;
      window.cancelAnimationFrame = vi.fn() as unknown as typeof window.cancelAnimationFrame;
      fireEvent.pointerDown(item, {
        button: 0,
        pointerId: 456,
        clientX: 220,
        clientY: 140,
      });
      fireEvent.pointerMove(viewport, {
        pointerId: 456,
        clientX: 650,
        clientY: 150,
      });

      expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1);
      unmount();
      expect(window.cancelAnimationFrame).toHaveBeenCalledWith(456);
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.cancelAnimationFrame = originalCancelAnimationFrame;
    }
  });

  it("cancels ghost movement without moving the source item", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Cancel me",
      }),
      clientX: 220,
      clientY: 140,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const itemId = item.getAttribute("data-testid")?.replace("canvas-item-", "") ?? "";
    const startX = Number(item.getAttribute("data-x"));
    const startY = Number(item.getAttribute("data-y"));

    fireEvent.pointerDown(item, {
      button: 0,
      pointerId: 23,
      clientX: 220,
      clientY: 140,
    });
    fireEvent.pointerMove(item, {
      pointerId: 23,
      clientX: 270,
      clientY: 185,
    });

    await screen.findByTestId(`canvas-item-ghost-${itemId}`);

    fireEvent.pointerCancel(item, {
      pointerId: 23,
      clientX: 270,
      clientY: 185,
    });

    await waitFor(() => {
      expect(screen.queryByTestId(`canvas-item-tear-out-ghost-${itemId}`)).not.toBeInTheDocument();
      expect(Number(item.getAttribute("data-x"))).toBe(startX);
      expect(Number(item.getAttribute("data-y"))).toBe(startY);
    });
  });

  it("keeps audio cards selectable and draggable inside the canvas shell", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-version": "1",
        "text/reference-id": "aud-1",
        "text/reference-output-id": "aud-1",
        "text/reference-source-surface": "all-refs",
      }),
      clientX: 300,
      clientY: 200,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const startX = Number(item.getAttribute("data-x"));
    const startY = Number(item.getAttribute("data-y"));

    expect(item).toHaveAttribute("data-kind", "audio");
    expect(item).toHaveAttribute("data-selected", "true");

    fireEvent.pointerDown(item, {
      button: 0,
      pointerId: 22,
      clientX: 300,
      clientY: 200,
    });
    fireEvent.pointerMove(item, {
      pointerId: 22,
      clientX: 340,
      clientY: 235,
    });
    fireEvent.pointerUp(item, {
      pointerId: 22,
      clientX: 340,
      clientY: 235,
    });

    expect(Number(item.getAttribute("data-x"))).toBeGreaterThan(startX);
    expect(Number(item.getAttribute("data-y"))).toBeGreaterThan(startY);
  });

  it("renders dragged audio ghosts with the same audio reference card UI", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-version": "1",
        "text/reference-id": "aud-1",
        "text/reference-output-id": "aud-1",
        "text/reference-source-surface": "all-refs",
      }),
      clientX: 300,
      clientY: 200,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const itemId = item.getAttribute("data-testid")?.replace("canvas-item-", "") ?? "";

    fireEvent.pointerDown(item, {
      button: 0,
      pointerId: 222,
      clientX: 300,
      clientY: 200,
    });
    fireEvent.pointerMove(item, {
      pointerId: 222,
      clientX: 340,
      clientY: 235,
    });

    const ghost = await screen.findByTestId(`canvas-item-ghost-${itemId}`);
    expect(ghost).toHaveAttribute("data-kind", "audio");
    expect(ghost).toHaveClass("canvas-scene-item--audio");
    expect(ghost.querySelector(".canvas-scene-item__audio-frame")).toBeInTheDocument();
    expect(within(ghost).getByText("Reference audio")).toBeInTheDocument();
    expect(
      within(ghost).getByRole("button", { name: "Play Reference audio", hidden: true })
    ).toBeInTheDocument();

    fireEvent.pointerCancel(item, {
      pointerId: 222,
      clientX: 340,
      clientY: 235,
    });
  });

  it("renders audio tear-out ghosts with the same audio reference card UI", async () => {
    const registry = createCanvasTearOutComposerTargetRegistry();
    render(<CanvasHarness canvasTearOutTargetRegistry={registry} />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-version": "1",
        "text/reference-id": "aud-1",
        "text/reference-output-id": "aud-1",
        "text/reference-source-surface": "all-refs",
      }),
      clientX: 300,
      clientY: 200,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const itemId = item.getAttribute("data-testid")?.replace("canvas-item-", "") ?? "";

    fireEvent.pointerDown(item, {
      button: 0,
      pointerId: 223,
      clientX: 300,
      clientY: 200,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 223,
      clientX: 700,
      clientY: 170,
    });

    const tearOutGhost = await screen.findByTestId(`canvas-item-tear-out-ghost-${itemId}`);
    expect(tearOutGhost).toHaveAttribute("data-kind", "audio");
    expect(tearOutGhost).toHaveClass("canvas-scene-item--audio");
    expect(tearOutGhost.querySelector(".canvas-scene-item__audio-frame")).toBeInTheDocument();
    expect(within(tearOutGhost).getByText("Reference audio")).toBeInTheDocument();
    expect(
      within(tearOutGhost).getByRole("button", { name: "Play Reference audio", hidden: true })
    ).toBeInTheDocument();

    fireEvent.pointerCancel(viewport, {
      pointerId: 223,
      clientX: 700,
      clientY: 170,
    });
  });

  it("opens shared media detail for non-text canvas items on double click", async () => {
    const onOpenMediaDetail = vi.fn();
    render(<CanvasHarness onOpenMediaDetail={onOpenMediaDetail} />);
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
    fireEvent.doubleClick(item);

    expect(onOpenMediaDetail).toHaveBeenCalledTimes(1);
    expect(onOpenMediaDetail.mock.calls[0]?.[0]).toMatchObject({
      kind: "image",
      outputId: "img-1",
    });
    expect(onOpenMediaDetail.mock.calls[0]?.[1]).toBe("main");
  });

  it("keeps text double click in text-edit mode", async () => {
    render(
      <SeededCanvasHarness
        initialSessionState={{
          items: [
            {
              id: "text-1",
              kind: "text",
              text: "Editable note",
              x: 120,
              y: 80,
              z: 1,
              selected: false,
              outputId: null,
              width: 220,
              height: 72,
            },
          ],
          draftTextEntry: null,
          textEditSession: null,
          draftOwnerInstanceId: null,
          textEditOwnerInstanceId: null,
          mainCamera: { x: 0, y: 0, zoom: 1 },
          railCamera: { x: 0, y: 0, zoom: 1 },
        }}
      />
    );

    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);
    const item = await screen.findByTestId("canvas-item-text-1");
    fireEvent.doubleClick(item);

    expect(screen.getByTestId("canvas-text-edit-input")).toBeInTheDocument();
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

  it("does not emit canvas gesture console logs from the raw debug switch alone", () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const windowWithCanvasDebug = window as typeof window & { __shortpulseCanvasDebug?: boolean };
    const previousCanvasDebug = windowWithCanvasDebug.__shortpulseCanvasDebug;
    windowWithCanvasDebug.__shortpulseCanvasDebug = true;

    try {
      render(<CanvasHarness />);
      const viewport = screen.getByTestId("canvas-viewport");
      mockViewportRect(viewport);

      fireEvent.pointerDown(viewport, {
        button: 0,
        detail: 2,
        pointerId: 901,
        clientX: 290,
        clientY: 190,
      });

      expect(consoleLogSpy).not.toHaveBeenCalled();
    } finally {
      windowWithCanvasDebug.__shortpulseCanvasDebug = previousCanvasDebug;
      consoleLogSpy.mockRestore();
    }
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

  it("pans from Space-drag after composer-like textarea focus without blocking text entry", () => {
    const composer = document.createElement("textarea");
    document.body.append(composer);

    try {
      render(<CanvasHarness />);
      const viewport = screen.getByTestId("canvas-viewport");
      mockViewportRect(viewport);

      composer.focus();
      const spaceDown = createEvent.keyDown(composer, {
        code: "Space",
        key: " ",
      });
      fireEvent(composer, spaceDown);

      expect(spaceDown.defaultPrevented).toBe(false);

      fireEvent.pointerDown(viewport, {
        button: 0,
        pointerId: 310,
        clientX: 100,
        clientY: 100,
      });
      fireEvent.pointerMove(viewport, {
        pointerId: 310,
        clientX: 146,
        clientY: 152,
      });
      fireEvent.pointerUp(viewport, {
        button: 0,
        pointerId: 310,
        clientX: 146,
        clientY: 152,
      });
      fireEvent.keyUp(composer, {
        code: "Space",
        key: " ",
      });

      expect(Number(viewport.getAttribute("data-camera-x"))).toBe(46);
      expect(Number(viewport.getAttribute("data-camera-y"))).toBe(52);
    } finally {
      composer.remove();
    }
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

  it("zooms around the pointer location", async () => {
    render(<CanvasHarness />);
    const viewport = screen.getByTestId("canvas-viewport");
    const world = screen.getByTestId("canvas-world");
    mockViewportRect(viewport);

    fireEvent.wheel(viewport, {
      deltaY: -100,
      clientX: 300,
      clientY: 200,
    });

    await waitFor(() => {
      expect(Number(viewport.getAttribute("data-camera-zoom"))).toBeGreaterThan(1);
      expect(Number(world.style.getPropertyValue("--canvas-control-scale"))).toBeLessThan(1);
    });
  });

  it("zooms the camera when wheel starts over unselected scrollable canvas text", async () => {
    render(
      <SeededCanvasHarness
        initialSessionState={{
          items: [
            {
              id: "scrollable-text",
              kind: "text",
              x: 120,
              y: 80,
              z: 1,
              selected: false,
              outputId: null,
              sourceSurface: null,
              text: "Scrollable canvas text reference\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6",
              width: 260,
              height: 120,
            },
          ],
          draftTextEntry: null,
          textEditSession: null,
          draftOwnerInstanceId: null,
          textEditOwnerInstanceId: null,
          mainCamera: { x: 0, y: 0, zoom: 1 },
          railCamera: { x: 0, y: 0, zoom: 1 },
        }}
      />
    );
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);
    const textNode = await screen.findByText(/Scrollable canvas text reference/);
    Object.defineProperty(textNode, "clientHeight", {
      configurable: true,
      value: 80,
    });
    Object.defineProperty(textNode, "scrollHeight", {
      configurable: true,
      value: 240,
    });

    const wheelEvent = new WheelEvent("wheel", {
      deltaY: 100,
      clientX: 260,
      clientY: 170,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      textNode.dispatchEvent(wheelEvent);
    });

    expect(wheelEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(Number(viewport.getAttribute("data-camera-zoom"))).not.toBe(1);
    });
  });

  it("lets selected scrollable canvas text consume wheel without zooming the camera", () => {
    render(
      <SeededCanvasHarness
        initialSessionState={{
          items: [
            {
              id: "selected-scrollable-text",
              kind: "text",
              x: 120,
              y: 80,
              z: 1,
              selected: true,
              outputId: null,
              sourceSurface: null,
              text: "Selected scrollable canvas text reference\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6",
              width: 260,
              height: 120,
            },
          ],
          draftTextEntry: null,
          textEditSession: null,
          draftOwnerInstanceId: null,
          textEditOwnerInstanceId: null,
          mainCamera: { x: 0, y: 0, zoom: 1 },
          railCamera: { x: 0, y: 0, zoom: 1 },
        }}
      />
    );
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);
    const textNode = screen.getByText(/Selected scrollable canvas text reference/);
    Object.defineProperty(textNode, "clientHeight", {
      configurable: true,
      value: 80,
    });
    Object.defineProperty(textNode, "scrollHeight", {
      configurable: true,
      value: 240,
    });

    const wheelEvent = new WheelEvent("wheel", {
      deltaY: 100,
      clientX: 260,
      clientY: 170,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      textNode.dispatchEvent(wheelEvent);
    });

    expect(wheelEvent.defaultPrevented).toBe(false);
    expect(Number(viewport.getAttribute("data-camera-zoom"))).toBe(1);
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
    const itemAId = itemA.getAttribute("data-testid")?.replace("canvas-item-", "") ?? "";
    const itemBId = itemB.getAttribute("data-testid")?.replace("canvas-item-", "") ?? "";

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

    const ghostA = await screen.findByTestId(`canvas-item-ghost-${itemAId}`);
    const ghostB = await screen.findByTestId(`canvas-item-ghost-${itemBId}`);
    expect(Number(itemA.getAttribute("data-x"))).toBe(xAStart);
    expect(Number(itemA.getAttribute("data-y"))).toBe(yAStart);
    expect(Number(itemB.getAttribute("data-x"))).toBe(xBStart);
    expect(Number(itemB.getAttribute("data-y"))).toBe(yBStart);
    expect(Number(ghostA.getAttribute("data-x"))).toBeGreaterThan(xAStart);
    expect(Number(ghostA.getAttribute("data-y"))).toBeGreaterThan(yAStart);
    expect(Number(ghostB.getAttribute("data-x"))).toBeGreaterThan(xBStart);
    expect(Number(ghostB.getAttribute("data-y"))).toBeGreaterThan(yBStart);

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

  it("keeps Shift drag export lane and avoids pointer-move scene drag", async () => {
    const onItemDragStart = vi.fn();
    const onItemDragEnd = vi.fn();
    const onInteractionActiveChange = vi.fn();
    render(
      <CanvasHarness
        isItemDraggable
        onInteractionActiveChange={onInteractionActiveChange}
        onItemDragStart={onItemDragStart}
        onItemDragEnd={onItemDragEnd}
      />
    );
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

    fireEvent.keyDown(window, {
      key: "Shift",
      shiftKey: true,
    });
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
    fireEvent.dragEnd(item, {
      shiftKey: true,
      dataTransfer: createTransfer({}),
    });
    fireEvent.keyUp(window, {
      key: "Shift",
    });

    expect(onItemDragStart).toHaveBeenCalledTimes(1);
    expect(onItemDragEnd).toHaveBeenCalledTimes(1);
    expect(onInteractionActiveChange).toHaveBeenNthCalledWith(1, true);
    expect(onInteractionActiveChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByTestId(/canvas-item-ghost-/)).not.toBeInTheDocument();
    expect(Number(item.getAttribute("data-x"))).toBe(startX);
    expect(Number(item.getAttribute("data-y"))).toBe(startY);
  });

  it("keeps plain item drag on the canvas pointer-move lane when export is available", async () => {
    const onItemDragStart = vi.fn();
    render(<CanvasHarness isItemDraggable onItemDragStart={onItemDragStart} />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/plain": "Drag me locally",
      }),
      clientX: 220,
      clientY: 140,
    });

    const item = await screen.findByTestId(/canvas-item-/);
    const startX = Number(item.getAttribute("data-x"));
    const startY = Number(item.getAttribute("data-y"));

    const plainDragStartEvent = createEvent.dragStart(item);
    Object.defineProperty(plainDragStartEvent, "dataTransfer", {
      configurable: true,
      value: createTransfer({}),
    });
    fireEvent(item, plainDragStartEvent);

    expect(onItemDragStart).not.toHaveBeenCalled();

    fireEvent.pointerDown(item, {
      button: 0,
      pointerId: 908,
      clientX: 220,
      clientY: 140,
    });
    fireEvent.pointerMove(item, {
      pointerId: 908,
      clientX: 280,
      clientY: 195,
    });
    fireEvent.pointerUp(item, {
      pointerId: 908,
      clientX: 280,
      clientY: 195,
    });

    expect(onItemDragStart).not.toHaveBeenCalled();
    expect(Number(item.getAttribute("data-x"))).toBeGreaterThan(startX);
    expect(Number(item.getAttribute("data-y"))).toBeGreaterThan(startY);
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

    dispatchDropAtPoint({
      viewport: mainViewport as HTMLElement,
      dataTransfer: createTransfer({
        "text/plain": "Shared note",
      }),
      clientX: 220,
      clientY: 140,
    });

    await waitFor(() => {
      expect(screen.getAllByText("Shared note")).toHaveLength(2);
    });
    const mainItem = (mainViewport as HTMLElement).querySelector('[data-testid^="canvas-item-"]');
    const railItem = (railViewport as HTMLElement).querySelector('[data-testid^="canvas-item-"]');
    expect(mainItem).toBeTruthy();
    expect(railItem).toBeTruthy();
    expect(mainItem?.getAttribute("data-x")).toBe(railItem?.getAttribute("data-x"));
    expect(mainItem?.getAttribute("data-y")).toBe(railItem?.getAttribute("data-y"));

    fireEvent.wheel(mainViewport as HTMLElement, {
      deltaY: -100,
      clientX: 300,
      clientY: 200,
    });

    await waitFor(() => {
      expect(
        Number((mainViewport as HTMLElement).getAttribute("data-camera-zoom"))
      ).toBeGreaterThan(1);
    });
    expect((railViewport as HTMLElement).getAttribute("data-camera-zoom")).toBe("1");
  });

  it("consumes wheel in the rail viewport so window scroll is not triggered", async () => {
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
      await waitFor(() => {
        expect(
          Number((railViewport as HTMLElement).getAttribute("data-camera-zoom"))
        ).toBeGreaterThan(1);
      });
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
