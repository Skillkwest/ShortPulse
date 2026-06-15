import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CANVAS_DEFAULT_CAMERA } from "../canvasGeometry";
import type { CanvasWorkspaceSessionState } from "../canvasWorkspaceContracts";
import { SeededCanvasHarness, mockViewportRect } from "./canvasTestHarness";

const createSessionState = (selectedOffscreen = false): CanvasWorkspaceSessionState => ({
  items: [
    {
      id: "visible-image",
      kind: "image",
      mediaId: "media-visible",
      outputId: null,
      sourceSurface: null,
      src: "https://example.com/visible.png",
      alt: "Visible canvas image",
      x: 40,
      y: 40,
      z: 1,
      selected: false,
      width: 240,
      height: 160,
    },
    {
      id: "offscreen-image",
      kind: "image",
      mediaId: "media-offscreen",
      outputId: null,
      sourceSurface: null,
      src: "https://example.com/offscreen.png",
      alt: "Offscreen canvas image",
      x: 5000,
      y: 5000,
      z: 2,
      selected: selectedOffscreen,
      width: 240,
      height: 160,
    },
  ],
  draftTextEntry: null,
  textEditSession: null,
  draftOwnerInstanceId: null,
  textEditOwnerInstanceId: null,
  mainCamera: CANVAS_DEFAULT_CAMERA,
  railCamera: CANVAS_DEFAULT_CAMERA,
});

describe("Canvas viewport virtualization", () => {
  it("does not mount clearly offscreen scene items when the viewport is measurable", async () => {
    render(<SeededCanvasHarness initialSessionState={createSessionState()} />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(await screen.findByTestId("canvas-item-visible-image")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByTestId("canvas-item-offscreen-image")).not.toBeInTheDocument();
    });
  });

  it("keeps selected offscreen scene items mounted for active editing affordances", async () => {
    render(<SeededCanvasHarness initialSessionState={createSessionState(true)} />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(await screen.findByTestId("canvas-item-visible-image")).toBeInTheDocument();
    expect(await screen.findByTestId("canvas-item-offscreen-image")).toBeInTheDocument();
  });
});
