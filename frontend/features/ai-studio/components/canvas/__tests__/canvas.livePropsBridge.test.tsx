import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasPropertiesPanel } from "../CanvasPropertiesPanel";
import type { CanvasPropertiesPanelProps } from "../canvasWorkspaceContracts";

const createPanelProps = (
  overrides: Partial<CanvasPropertiesPanelProps> = {}
): CanvasPropertiesPanelProps => ({
  instanceId: "rail",
  camera: { x: 0, y: 0, zoom: 1 },
  items: [],
  pendingItems: [],
  itemDragPreview: null,
  marqueeSelectionBox: null,
  viewportRef: React.createRef<HTMLDivElement>(),
  isDropActive: false,
  draftTextEntry: null,
  editingTextItemId: null,
  editingTextValue: "",
  onViewportKeyDown: vi.fn(),
  onViewportDoubleClick: vi.fn(),
  onViewportClick: vi.fn(),
  onViewportPointerDown: vi.fn(),
  onViewportPointerMove: vi.fn(),
  onViewportPointerUp: vi.fn(),
  onViewportPointerCancel: vi.fn(),
  onViewportDragEnter: vi.fn(),
  onViewportDragOver: vi.fn(),
  onViewportDragLeave: vi.fn(),
  onViewportDrop: vi.fn(),
  onViewportWheel: vi.fn(),
  onItemPointerDown: vi.fn(),
  onItemPointerMove: vi.fn(),
  onItemPointerUp: vi.fn(),
  onItemPointerCancel: vi.fn(),
  onItemContextMenu: vi.fn(),
  onItemDoubleClick: vi.fn(),
  onPinTextItem: vi.fn(),
  onDraftTextChange: vi.fn(),
  onDraftTextPaste: vi.fn(),
  onDraftTextKeyDown: vi.fn(),
  onDraftTextBlur: vi.fn(),
  onTextItemEditChange: vi.fn(),
  onTextItemEditKeyDown: vi.fn(),
  onTextItemEditBlur: vi.fn(),
  ...overrides,
});

const createLivePropsHarness = (initialSnapshot: CanvasPropertiesPanelProps) => {
  const listeners = new Set<() => void>();
  let snapshot = initialSnapshot;
  return {
    props: {
      ...initialSnapshot,
      livePropsStore: {
        getSnapshot: () => snapshot,
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
      },
    },
    publish: (nextSnapshot: CanvasPropertiesPanelProps) => {
      snapshot = nextSnapshot;
      listeners.forEach((listener) => listener());
    },
  };
};

describe("CanvasPropertiesPanel live props bridge", () => {
  it("updates camera data from the live store without parent rerender", () => {
    const viewportRef = React.createRef<HTMLDivElement>();
    const initialSnapshot = createPanelProps({ viewportRef });
    const liveProps = createLivePropsHarness(initialSnapshot);
    render(<CanvasPropertiesPanel {...liveProps.props} />);

    expect(screen.getByTestId("canvas-viewport")).toHaveAttribute("data-camera-zoom", "1");

    act(() => {
      liveProps.publish(
        createPanelProps({
          viewportRef,
          camera: { x: 12, y: 18, zoom: 1.45 },
        })
      );
    });

    expect(screen.getByTestId("canvas-viewport")).toHaveAttribute("data-camera-x", "12");
    expect(screen.getByTestId("canvas-viewport")).toHaveAttribute("data-camera-y", "18");
    expect(screen.getByTestId("canvas-viewport")).toHaveAttribute("data-camera-zoom", "1.45");
  });

  it("routes events to the latest live handlers", () => {
    const viewportRef = React.createRef<HTMLDivElement>();
    const initialWheel = vi.fn();
    const nextWheel = vi.fn();
    const initialSnapshot = createPanelProps({
      viewportRef,
      onViewportWheel: initialWheel,
    });
    const liveProps = createLivePropsHarness(initialSnapshot);
    render(<CanvasPropertiesPanel {...liveProps.props} />);

    act(() => {
      liveProps.publish(
        createPanelProps({
          viewportRef,
          onViewportWheel: nextWheel,
        })
      );
    });

    fireEvent.wheel(screen.getByTestId("canvas-viewport"), {
      deltaY: -100,
      clientX: 40,
      clientY: 40,
    });

    expect(initialWheel).not.toHaveBeenCalled();
    expect(nextWheel).toHaveBeenCalledTimes(1);
  });

  it("preserves wrapper callbacks that are added around the live store", () => {
    const viewportRef = React.createRef<HTMLDivElement>();
    const interactionActiveChange = vi.fn();
    const initialSnapshot = createPanelProps({ viewportRef });
    const liveProps = createLivePropsHarness(initialSnapshot);
    render(
      <CanvasPropertiesPanel
        {...liveProps.props}
        onInteractionActiveChange={interactionActiveChange}
      />
    );

    fireEvent.pointerDown(screen.getByTestId("canvas-viewport"));
    fireEvent.pointerUp(screen.getByTestId("canvas-viewport"));

    expect(interactionActiveChange).toHaveBeenNthCalledWith(1, true);
    expect(interactionActiveChange).toHaveBeenNthCalledWith(2, false);
  });

  it("raises wrapper interaction callbacks for item-origin gestures", () => {
    const viewportRef = React.createRef<HTMLDivElement>();
    const interactionActiveChange = vi.fn();
    const initialSnapshot = createPanelProps({
      viewportRef,
      items: [
        {
          id: "text-1",
          kind: "text",
          text: "Move me",
          x: 0,
          y: 0,
          z: 1,
          width: 120,
          height: 72,
          selected: false,
          outputId: null,
        },
      ],
    });
    const liveProps = createLivePropsHarness(initialSnapshot);
    render(
      <CanvasPropertiesPanel
        {...liveProps.props}
        onInteractionActiveChange={interactionActiveChange}
      />
    );

    fireEvent.pointerDown(screen.getByTestId("canvas-item-text-1"));
    fireEvent.pointerUp(screen.getByTestId("canvas-item-text-1"));

    expect(interactionActiveChange).toHaveBeenNthCalledWith(1, true);
    expect(interactionActiveChange).toHaveBeenNthCalledWith(2, false);
  });
});
