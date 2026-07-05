import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CANVAS_MAX_ATTACHED_VIDEO_ELEMENTS } from "../CanvasPropertiesPanel";
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

const createVideoHeavySessionState = (): CanvasWorkspaceSessionState => ({
  items: Array.from({ length: 12 }, (_, index) => ({
    id: `video-${index}`,
    kind: "video" as const,
    mediaId: `media-video-${index}`,
    outputId: null,
    sourceSurface: null,
    videoUrl: `https://example.com/video-${index}.mp4`,
    posterUrl: `https://example.com/video-${index}.webp`,
    title: `Canvas video ${index}`,
    durationMs: 2_000,
    x: 20 + (index % 4) * 130,
    y: 20 + Math.floor(index / 4) * 90,
    z: index + 1,
    selected: index === 11,
    width: 120,
    height: 70,
  })),
  draftTextEntry: null,
  textEditSession: null,
  draftOwnerInstanceId: null,
  textEditOwnerInstanceId: null,
  mainCamera: CANVAS_DEFAULT_CAMERA,
  railCamera: CANVAS_DEFAULT_CAMERA,
});

describe("Canvas viewport virtualization", () => {
  it("does not mount ordinary scene items before the viewport is measurable", () => {
    render(<SeededCanvasHarness initialSessionState={createSessionState()} />);

    expect(screen.queryByTestId("canvas-item-visible-image")).not.toBeInTheDocument();
    expect(screen.queryByTestId("canvas-item-offscreen-image")).not.toBeInTheDocument();
  });

  it("keeps selected scene items mounted before the viewport is measurable", async () => {
    render(<SeededCanvasHarness initialSessionState={createSessionState(true)} />);

    expect(await screen.findByTestId("canvas-item-offscreen-image")).toBeInTheDocument();
  });

  it("does not mount clearly offscreen scene items when the viewport is measurable", async () => {
    render(<SeededCanvasHarness initialSessionState={createSessionState()} />);
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    const visibleImage = await screen.findByAltText("Visible canvas image");
    expect(visibleImage).toHaveAttribute("loading", "lazy");
    expect(visibleImage).toHaveAttribute("decoding", "async");
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

  it("caps live video source attachment while keeping poster tiles mounted", async () => {
    const { container } = render(
      <SeededCanvasHarness initialSessionState={createVideoHeavySessionState()} />
    );
    const viewport = screen.getByTestId("canvas-viewport");
    mockViewportRect(viewport);

    await waitFor(() => {
      expect(screen.getAllByTestId(/canvas-item-video-/)).toHaveLength(12);
    });

    const videoItems = screen.getAllByTestId(/canvas-item-video-/);
    const attachedItems = videoItems.filter(
      (item) => item.getAttribute("data-video-source-attached") === "true"
    );
    expect(attachedItems).toHaveLength(CANVAS_MAX_ATTACHED_VIDEO_ELEMENTS);
    expect(screen.getByTestId("canvas-item-video-11")).toHaveAttribute(
      "data-video-source-attached",
      "true"
    );
    expect(container.querySelectorAll("video.canvas-scene-item__video")).toHaveLength(
      CANVAS_MAX_ATTACHED_VIDEO_ELEMENTS
    );
    expect(container.querySelectorAll("img.canvas-scene-item__video")).toHaveLength(
      videoItems.length - CANVAS_MAX_ATTACHED_VIDEO_ELEMENTS
    );
  });
});
