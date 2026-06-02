/**
 * Tests Media Library drag-ghost presentation and lifecycle behavior.
 */
import { describe, expect, it, vi } from "vitest";
import { attachMediaLibraryDragGhost, clearMediaLibraryDragGhost } from "../mediaLibraryDragGhost";
import {
  CANVAS_PROMPT_DRAG_GHOST_HEIGHT_PX,
  CANVAS_PROMPT_DRAG_GHOST_WIDTH_PX,
  CANVAS_PROMPT_DRAG_HOTSPOT_X,
  CANVAS_PROMPT_DRAG_HOTSPOT_Y,
} from "../canvasPromptDragGhost";

const setNodeRect = (node: HTMLElement, width: number, height: number) => {
  Object.defineProperty(node, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON: () => ({}),
      }) as DOMRect,
  });
  Object.defineProperty(node, "offsetWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(node, "offsetHeight", {
    configurable: true,
    value: height,
  });
};

const createDragEvent = (node: HTMLElement, setDragImage: ReturnType<typeof vi.fn>) =>
  ({
    currentTarget: node,
    dataTransfer: {
      setDragImage,
    },
  }) as unknown as React.DragEvent<HTMLElement>;

describe("mediaLibraryDragGhost", () => {
  it("builds an image ghost matching the shared reference ghost visual contract", () => {
    const node = document.createElement("button");
    document.body.appendChild(node);
    setNodeRect(node, 300, 360);
    const setDragImage = vi.fn();
    const event = createDragEvent(node, setDragImage);

    attachMediaLibraryDragGhost(event, {
      label: "Image One",
      detail: "cinematic portrait",
      previewUrl: "https://cdn.example.com/image-1.png",
      previewKind: "image",
    });

    expect(setDragImage).toHaveBeenCalledTimes(1);
    const ghost = setDragImage.mock.calls[0]?.[0] as HTMLElement;
    expect(ghost).toBeInstanceOf(HTMLElement);
    expect(ghost.classList.contains("media-library-drag-ghost")).toBe(true);
    expect(ghost.classList.contains("reference-drag-ghost")).toBe(true);
    expect(ghost.style.aspectRatio).toBe("4 / 5");
    expect(ghost.querySelector("img")?.getAttribute("src")).toBe(
      "https://cdn.example.com/image-1.png"
    );

    clearMediaLibraryDragGhost(node);
    expect(document.body.contains(ghost)).toBe(false);
    node.remove();
  });

  it("builds a video placeholder ghost without image content", () => {
    const node = document.createElement("button");
    document.body.appendChild(node);
    setNodeRect(node, 240, 300);
    const setDragImage = vi.fn();
    const event = createDragEvent(node, setDragImage);

    attachMediaLibraryDragGhost(event, {
      label: "clip-1.mp4",
      previewKind: "video",
    });

    expect(setDragImage).toHaveBeenCalledTimes(1);
    const ghost = setDragImage.mock.calls[0]?.[0] as HTMLElement;
    expect(ghost.querySelector("img")).toBeNull();
    const placeholder = ghost.firstElementChild as HTMLElement | null;
    expect(placeholder).toBeTruthy();
    expect(placeholder?.style.background).toContain("linear-gradient");

    clearMediaLibraryDragGhost(node);
    node.remove();
  });

  it("builds a text ghost from detail content when no media preview is present", () => {
    const node = document.createElement("button");
    document.body.appendChild(node);
    setNodeRect(node, 220, 260);
    const setDragImage = vi.fn();
    const event = createDragEvent(node, setDragImage);

    attachMediaLibraryDragGhost(event, {
      label: "Prompt One",
      detail: "A cinematic, dramatic low-key studio portrait.",
      template: "prompt",
    });

    expect(setDragImage).toHaveBeenCalledTimes(1);
    const ghost = setDragImage.mock.calls[0]?.[0] as HTMLElement;
    expect(ghost.querySelector("img")).toBeNull();
    expect(ghost.style.width).toBe(`${CANVAS_PROMPT_DRAG_GHOST_WIDTH_PX}px`);
    expect(ghost.style.height).toBe(`${CANVAS_PROMPT_DRAG_GHOST_HEIGHT_PX}px`);
    expect(ghost.textContent).toContain("cinematic");
    expect(setDragImage).toHaveBeenCalledWith(
      ghost,
      CANVAS_PROMPT_DRAG_HOTSPOT_X,
      CANVAS_PROMPT_DRAG_HOTSPOT_Y
    );

    clearMediaLibraryDragGhost(node);
    node.remove();
  });

  it("keeps audio ghosts on the shared media-card template instead of the prompt template", () => {
    const node = document.createElement("button");
    document.body.appendChild(node);
    setNodeRect(node, 220, 260);
    const setDragImage = vi.fn();
    const event = createDragEvent(node, setDragImage);

    attachMediaLibraryDragGhost(event, {
      label: "Audio One",
      detail: "Warm analog synth loop",
      previewUrl: "https://cdn.example.com/audio-cover.webp",
      previewKind: "audio",
    });

    expect(setDragImage).toHaveBeenCalledTimes(1);
    const ghost = setDragImage.mock.calls[0]?.[0] as HTMLElement;
    expect(ghost.querySelector("img")?.getAttribute("src")).toBe(
      "https://cdn.example.com/audio-cover.webp"
    );
    expect(ghost.style.width).toBe("96px");
    expect(ghost.style.height).toBe("120px");
    expect(setDragImage).toHaveBeenCalledWith(ghost, 12, 12);

    clearMediaLibraryDragGhost(node);
    node.remove();
  });

  it("builds a folder ghost using the folder artwork and label instead of the reference-card shell", () => {
    const node = document.createElement("button");
    const folderImage = document.createElement("img");
    folderImage.className = "media-library-panel-folder-chip-image";
    folderImage.setAttribute("src", "/Folder 1.png");
    node.appendChild(folderImage);
    document.body.appendChild(node);
    setNodeRect(node, 118, 104);
    const setDragImage = vi.fn();
    const event = createDragEvent(node, setDragImage);

    attachMediaLibraryDragGhost(event, {
      label: "The Witch",
      template: "folder",
    });

    expect(setDragImage).toHaveBeenCalledTimes(1);
    const ghost = setDragImage.mock.calls[0]?.[0] as HTMLElement;
    expect(ghost.classList.contains("media-library-drag-ghost")).toBe(true);
    expect(ghost.classList.contains("reference-drag-ghost")).toBe(false);
    expect(ghost.classList.contains("media-library-drag-ghost--folder")).toBe(true);
    expect(ghost.style.background).toBe("transparent");
    expect(ghost.style.width).toBe("118px");
    expect(ghost.style.height).toBe("104px");
    expect(ghost.querySelector("img")?.getAttribute("src")).toBe("/Folder 1.png");
    expect(ghost.textContent).toContain("The Witch");

    clearMediaLibraryDragGhost(node);
    expect(document.body.contains(ghost)).toBe(false);
    node.remove();
  });

  it("uses a fixed 4:5 ghost size regardless of source card dimensions", () => {
    const node = document.createElement("button");
    document.body.appendChild(node);
    setNodeRect(node, 320, 400);
    const setDragImage = vi.fn();
    const event = createDragEvent(node, setDragImage);

    attachMediaLibraryDragGhost(event, {
      label: "Image One",
      previewUrl: "https://cdn.example.com/image-2.png",
      previewKind: "image",
    });

    expect(setDragImage).toHaveBeenCalledTimes(1);
    const ghost = setDragImage.mock.calls[0]?.[0] as HTMLElement;
    expect(ghost.style.width).toBe("96px");
    expect(ghost.style.height).toBe("120px");
    expect(setDragImage).toHaveBeenCalledWith(ghost, 12, 12);

    clearMediaLibraryDragGhost(node);
    node.remove();
  });
});
