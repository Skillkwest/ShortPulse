import React from "react";
import { act, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaLibraryFolderCanvas } from "../MediaLibraryFolderCanvas";

const { getMediaFolderCanvasStateMock, saveMediaFolderCanvasStateMock } = vi.hoisted(() => ({
  getMediaFolderCanvasStateMock: vi.fn(),
  saveMediaFolderCanvasStateMock: vi.fn(),
}));

vi.mock("../../logic/mediaLibraryPanelApi", async () => {
  const actual = await vi.importActual("../../logic/mediaLibraryPanelApi");
  return {
    ...actual,
    getMediaFolderCanvasState: getMediaFolderCanvasStateMock,
    saveMediaFolderCanvasState: saveMediaFolderCanvasStateMock,
  };
});

const createTransfer = (entries: Record<string, string>, files: File[] = []) =>
  ({
    types: files.length > 0 ? ["Files", ...Object.keys(entries)] : Object.keys(entries),
    files: {
      ...files,
      length: files.length,
      item: (index: number) => files[index] ?? null,
    } as unknown as FileList,
    getData: (type: string) => entries[type] ?? "",
    dropEffect: "copy",
    effectAllowed: "copy",
  }) as unknown as DataTransfer;

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

describe("MediaLibraryFolderCanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMediaFolderCanvasStateMock.mockResolvedValue(null);
    saveMediaFolderCanvasStateMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("rejects media-library video drops because folder canvas is image-and-prompt only", async () => {
    const onAssignDroppedItem = vi.fn(async () => true);

    render(
      <MediaLibraryFolderCanvas
        folderId="folder-1"
        mediaRows={[]}
        promptRows={[]}
        onSelectMedia={vi.fn()}
        onSelectPrompt={vi.fn()}
        onUnassignItem={vi.fn(async () => {})}
        onAssignDroppedItem={onAssignDroppedItem}
      />
    );

    const viewport = await screen.findByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
        "text/shortpulse-media-library-kind": "libraryMedia",
        "text/shortpulse-media-library-id": "media-video-1",
        "text/shortpulse-media-library-url": "https://example.com/library-video.mp4",
        "text/shortpulse-media-library-file-type": "video",
        "text/shortpulse-media-library-filename": "Library Video",
      }),
      clientX: 300,
      clientY: 200,
    });

    await waitFor(() => {
      expect(
        screen.getByText("Only images and prompts can be dropped onto this canvas.")
      ).toBeInTheDocument();
    });
    expect(onAssignDroppedItem).not.toHaveBeenCalled();
    expect(screen.queryAllByTestId(/canvas-item-/)).toHaveLength(0);
  });

  it("places folder-canvas prompt drops with the same center-on-release anchor as images", async () => {
    const onAssignDroppedItem = vi.fn(async () => true);

    function FolderPromptDropHarness() {
      const [promptRows, setPromptRows] = React.useState<
        Array<{
          id: string;
          title: string | null;
          prompt_text: string;
          created_at: string | null;
        }>
      >([]);

      return (
        <MediaLibraryFolderCanvas
          folderId="folder-1"
          mediaRows={[]}
          promptRows={promptRows}
          onSelectMedia={vi.fn()}
          onSelectPrompt={vi.fn()}
          onUnassignItem={vi.fn(async () => {})}
          onAssignDroppedItem={async (item) => {
            const assigned = await onAssignDroppedItem(item);
            if (assigned && item.kind === "prompt" && item.id === "prompt-1") {
              setPromptRows([
                {
                  id: "prompt-1",
                  title: "Folder prompt",
                  prompt_text: "Folder prompt text",
                  created_at: null,
                },
              ]);
            }
            return assigned;
          }}
        />
      );
    }

    render(<FolderPromptDropHarness />);

    const viewport = await screen.findByTestId("canvas-viewport");
    mockViewportRect(viewport);

    dispatchDropAtPoint({
      viewport,
      dataTransfer: createTransfer({
        "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
        "text/shortpulse-media-library-kind": "libraryPrompt",
        "text/shortpulse-media-library-id": "prompt-1",
        "text/shortpulse-media-library-prompt": "Folder prompt text",
        "text/shortpulse-media-library-title": "Folder prompt",
      }),
      clientX: 280,
      clientY: 190,
    });

    expect(await screen.findByText("Folder prompt text")).toBeInTheDocument();
    await waitFor(() => {
      const items = screen.getAllByTestId(/canvas-item-/);
      const matchingItem = items.find((item) => item.getAttribute("data-kind") === "text");
      expect(matchingItem).toBeTruthy();
      expect(matchingItem?.getAttribute("data-x")).toBe("150");
      expect(matchingItem?.getAttribute("data-y")).toBe("130");
    });
    expect(onAssignDroppedItem).toHaveBeenCalledWith({ kind: "prompt", id: "prompt-1" });
  });

  it("does not synthesize a prompt item before the dropped prompt resolves", async () => {
    const onAssignDroppedItem = vi.fn(async () => true);
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    let pendingFrameCallback: FrameRequestCallback | null = null;

    function FolderPromptDropHarness() {
      const [promptRows, setPromptRows] = React.useState<
        Array<{
          id: string;
          title: string | null;
          prompt_text: string;
          created_at: string | null;
        }>
      >([]);

      return (
        <MediaLibraryFolderCanvas
          folderId="folder-1"
          mediaRows={[]}
          promptRows={promptRows}
          onSelectMedia={vi.fn()}
          onSelectPrompt={vi.fn()}
          onUnassignItem={vi.fn(async () => {})}
          onAssignDroppedItem={async (item) => {
            const assigned = await onAssignDroppedItem(item);
            if (assigned && item.kind === "prompt" && item.id === "prompt-1") {
              setPromptRows([
                {
                  id: "prompt-1",
                  title: "Folder prompt",
                  prompt_text: "Folder prompt text",
                  created_at: null,
                },
              ]);
            }
            return assigned;
          }}
        />
      );
    }

    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      pendingFrameCallback = callback;
      return 1;
    }) as typeof window.requestAnimationFrame;

    try {
      render(<FolderPromptDropHarness />);

      const viewport = await screen.findByTestId("canvas-viewport");
      mockViewportRect(viewport);

      await act(async () => {
        dispatchDropAtPoint({
          viewport,
          dataTransfer: createTransfer({
            "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
            "text/shortpulse-media-library-kind": "libraryPrompt",
            "text/shortpulse-media-library-id": "prompt-1",
            "text/shortpulse-media-library-prompt": "Folder prompt text",
            "text/shortpulse-media-library-title": "Folder prompt",
          }),
          clientX: 280,
          clientY: 190,
        });
        await Promise.resolve();
      });

      expect(screen.getByTestId("canvas-loading-spinner")).toBeInTheDocument();
      expect(screen.queryAllByText("Folder prompt text")).toHaveLength(0);
      expect(screen.queryAllByTestId(/canvas-item-/)).toHaveLength(0);

      await act(async () => {
        pendingFrameCallback?.(16);
        await Promise.resolve();
      });

      expect(await screen.findByText("Folder prompt text")).toBeInTheDocument();
      const items = screen.getAllByTestId(/canvas-item-/);
      const matchingItem = items.find((item) => item.getAttribute("data-kind") === "text");
      expect(matchingItem).toBeTruthy();
      expect(matchingItem?.getAttribute("data-x")).toBe("150");
      expect(matchingItem?.getAttribute("data-y")).toBe("130");
      expect(items).toHaveLength(1);
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
    }
  });

  it("keeps repeated drops of the same prompt as independent text bubbles", async () => {
    const onAssignDroppedItem = vi.fn(async () => true);

    function FolderPromptDropHarness() {
      const [promptRows, setPromptRows] = React.useState<
        Array<{
          id: string;
          title: string | null;
          prompt_text: string;
          created_at: string | null;
        }>
      >([]);

      return (
        <MediaLibraryFolderCanvas
          folderId="folder-1"
          mediaRows={[]}
          promptRows={promptRows}
          onSelectMedia={vi.fn()}
          onSelectPrompt={vi.fn()}
          onUnassignItem={vi.fn(async () => {})}
          onAssignDroppedItem={async (item) => {
            const assigned = await onAssignDroppedItem(item);
            if (assigned && item.kind === "prompt" && item.id === "prompt-repeat") {
              setPromptRows([
                {
                  id: "prompt-repeat",
                  title: "Repeated prompt",
                  prompt_text: "Repeated prompt text",
                  created_at: null,
                },
              ]);
            }
            return assigned;
          }}
        />
      );
    }

    render(<FolderPromptDropHarness />);

    const viewport = await screen.findByTestId("canvas-viewport");
    mockViewportRect(viewport);

    dispatchDropAtPoint({
      viewport,
      dataTransfer: createTransfer({
        "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
        "text/shortpulse-media-library-kind": "libraryPrompt",
        "text/shortpulse-media-library-id": "prompt-repeat",
        "text/shortpulse-media-library-prompt": "Repeated prompt text",
      }),
      clientX: 280,
      clientY: 190,
    });

    await waitFor(() => {
      const textItems = screen
        .getAllByTestId(/canvas-item-/)
        .filter((item) => item.getAttribute("data-kind") === "text");
      expect(textItems).toHaveLength(1);
      expect(textItems[0]).toHaveAttribute("data-x", "150");
      expect(textItems[0]).toHaveAttribute("data-y", "130");
    });

    dispatchDropAtPoint({
      viewport,
      dataTransfer: createTransfer({
        "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
        "text/shortpulse-media-library-kind": "libraryPrompt",
        "text/shortpulse-media-library-id": "prompt-repeat",
        "text/shortpulse-media-library-prompt": "Repeated prompt text",
      }),
      clientX: 360,
      clientY: 250,
    });

    await waitFor(() => {
      const textItems = screen
        .getAllByTestId(/canvas-item-/)
        .filter((item) => item.getAttribute("data-kind") === "text");
      expect(textItems).toHaveLength(2);
      const positions = textItems.map(
        (item) => `${item.getAttribute("data-x")},${item.getAttribute("data-y")}`
      );
      expect(positions).toContain("150,130");
      expect(positions).toContain("230,190");
    });
  });

  it("restores an existing prompt item when reassignment fails after re-drop", async () => {
    getMediaFolderCanvasStateMock.mockResolvedValue({
      snapshot: {
        schemaVersion: 1,
        camera: { x: 0, y: 0, zoom: 1 },
        items: [
          {
            id: "prompt:prompt-1",
            kind: "text",
            outputId: "prompt:prompt-1",
            text: "Existing prompt text",
            x: 40,
            y: 60,
            z: 1,
            width: 260,
            height: 120,
          },
        ],
      },
    });
    const onAssignDroppedItem = vi.fn(async () => false);

    render(
      <MediaLibraryFolderCanvas
        folderId="folder-1"
        mediaRows={[]}
        promptRows={[
          {
            id: "prompt-1",
            title: "Existing prompt",
            prompt_text: "Existing prompt text",
            created_at: null,
          },
        ]}
        onSelectMedia={vi.fn()}
        onSelectPrompt={vi.fn()}
        onUnassignItem={vi.fn(async () => {})}
        onAssignDroppedItem={onAssignDroppedItem}
      />
    );

    const viewport = await screen.findByTestId("canvas-viewport");
    mockViewportRect(viewport);

    dispatchDropAtPoint({
      viewport,
      dataTransfer: createTransfer({
        "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
        "text/shortpulse-media-library-kind": "libraryPrompt",
        "text/shortpulse-media-library-id": "prompt-1",
        "text/shortpulse-media-library-prompt": "Updated prompt text",
      }),
      clientX: 280,
      clientY: 190,
    });

    await waitFor(() => {
      expect(screen.getByText("Unable to assign dropped item to this folder.")).toBeInTheDocument();
    });
    expect(onAssignDroppedItem).toHaveBeenCalledWith({ kind: "prompt", id: "prompt-1" });

    const item = await screen.findByTestId("canvas-item-prompt:prompt-1");
    expect(item).toHaveAttribute("data-x", "40");
    expect(item).toHaveAttribute("data-y", "60");
    expect(screen.getByText("Existing prompt text")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Updated prompt text")).not.toBeInTheDocument();
    });
  });

  it("does not block save while waiting for prompt rows to refresh after a successful drop", async () => {
    const onAssignDroppedItem = vi.fn(async () => true);

    render(
      <MediaLibraryFolderCanvas
        folderId="folder-1"
        mediaRows={[]}
        promptRows={[]}
        onSelectMedia={vi.fn()}
        onSelectPrompt={vi.fn()}
        onUnassignItem={vi.fn(async () => {})}
        onAssignDroppedItem={onAssignDroppedItem}
      />
    );

    const viewport = await screen.findByTestId("canvas-viewport");
    mockViewportRect(viewport);
    saveMediaFolderCanvasStateMock.mockClear();

    dispatchDropAtPoint({
      viewport,
      dataTransfer: createTransfer({
        "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
        "text/shortpulse-media-library-kind": "libraryPrompt",
        "text/shortpulse-media-library-id": "prompt-pending-save",
        "text/shortpulse-media-library-prompt": "Pending prompt text",
      }),
      clientX: 280,
      clientY: 190,
    });

    expect(await screen.findByText("Pending prompt text")).toBeInTheDocument();
    expect(onAssignDroppedItem).toHaveBeenCalledWith({ kind: "prompt", id: "prompt-pending-save" });

    await waitFor(
      () => {
        expect(saveMediaFolderCanvasStateMock).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 }
    );
  });

  it("does not block save when assignment is optional and the prompt already belongs to the folder", async () => {
    render(
      <MediaLibraryFolderCanvas
        folderId="folder-1"
        mediaRows={[]}
        promptRows={[
          {
            id: "prompt-existing",
            title: "Existing prompt",
            prompt_text: "Existing prompt text",
            created_at: null,
          },
        ]}
        onSelectMedia={vi.fn()}
        onSelectPrompt={vi.fn()}
        onUnassignItem={vi.fn(async () => {})}
      />
    );

    const viewport = await screen.findByTestId("canvas-viewport");
    mockViewportRect(viewport);
    saveMediaFolderCanvasStateMock.mockClear();

    dispatchDropAtPoint({
      viewport,
      dataTransfer: createTransfer({
        "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
        "text/shortpulse-media-library-kind": "libraryPrompt",
        "text/shortpulse-media-library-id": "prompt-existing",
        "text/shortpulse-media-library-prompt": "Existing prompt text",
      }),
      clientX: 280,
      clientY: 190,
    });

    expect(await screen.findByText("Existing prompt text")).toBeInTheDocument();

    await waitFor(
      () => {
        expect(saveMediaFolderCanvasStateMock).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 }
    );
  });

  it("assigns internal prompt drops through the same folder-membership path", async () => {
    const onAssignDroppedItem = vi.fn(async () => true);
    const resolveInternalDropItem = vi.fn(async () => ({
      kind: "prompt" as const,
      id: "prompt-2",
    }));

    function FolderPromptDropHarness() {
      const [promptRows, setPromptRows] = React.useState<
        Array<{
          id: string;
          title: string | null;
          prompt_text: string;
          created_at: string | null;
        }>
      >([]);

      return (
        <MediaLibraryFolderCanvas
          folderId="folder-1"
          mediaRows={[]}
          promptRows={promptRows}
          onSelectMedia={vi.fn()}
          onSelectPrompt={vi.fn()}
          onUnassignItem={vi.fn(async () => {})}
          onAssignDroppedItem={async (item) => {
            const assigned = await onAssignDroppedItem(item);
            if (assigned && item.kind === "prompt" && item.id === "prompt-2") {
              setPromptRows([
                {
                  id: "prompt-2",
                  title: "Internal prompt",
                  prompt_text: "Internal prompt text",
                  created_at: null,
                },
              ]);
            }
            return assigned;
          }}
          resolveInternalDropItem={resolveInternalDropItem}
          resolveCanvasDropReference={(payload) => {
            if (payload.outputId !== "txt-1") return null;
            return {
              kind: "text",
              outputId: "txt-1",
              text: "Internal prompt text",
              sourceSurface: payload.sourceSurface ?? null,
            };
          }}
        />
      );
    }

    render(<FolderPromptDropHarness />);

    const viewport = await screen.findByTestId("canvas-viewport");
    mockViewportRect(viewport);

    dispatchDropAtPoint({
      viewport,
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

    expect(await screen.findByText("Internal prompt text")).toBeInTheDocument();
    expect(resolveInternalDropItem).toHaveBeenCalledTimes(1);
    expect(onAssignDroppedItem).toHaveBeenCalledWith({ kind: "prompt", id: "prompt-2" });
    const items = screen.getAllByTestId(/canvas-item-/);
    const item = items.find(
      (candidate) =>
        candidate.getAttribute("data-kind") === "text" &&
        candidate.textContent?.includes("Internal prompt text")
    );
    expect(item).toBeTruthy();
    expect(item).toHaveAttribute("data-x", "110");
    expect(item).toHaveAttribute("data-y", "100");
  });

  it("does not assign folder membership when a prompt drop is blocked by the canvas item cap", async () => {
    getMediaFolderCanvasStateMock.mockResolvedValue({
      snapshot: {
        schemaVersion: 1,
        camera: { x: 0, y: 0, zoom: 1 },
        items: Array.from({ length: 300 }, (_, index) => ({
          id: `seed-${index}`,
          kind: "text",
          promptId: null,
          text: `Seed ${index}`,
          x: index,
          y: index,
          z: index + 1,
          width: 260,
          height: 120,
        })),
      },
    });
    const onAssignDroppedItem = vi.fn(async () => true);

    render(
      <MediaLibraryFolderCanvas
        folderId="folder-1"
        mediaRows={[]}
        promptRows={[]}
        onSelectMedia={vi.fn()}
        onSelectPrompt={vi.fn()}
        onUnassignItem={vi.fn(async () => {})}
        onAssignDroppedItem={onAssignDroppedItem}
      />
    );

    const viewport = await screen.findByTestId("canvas-viewport");
    mockViewportRect(viewport);

    dispatchDropAtPoint({
      viewport,
      dataTransfer: createTransfer({
        "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
        "text/shortpulse-media-library-kind": "libraryPrompt",
        "text/shortpulse-media-library-id": "prompt-cap",
        "text/shortpulse-media-library-prompt": "Cap prompt text",
      }),
      clientX: 280,
      clientY: 190,
    });

    await waitFor(() => {
      expect(screen.getByText("Canvas item limit reached.")).toBeInTheDocument();
    });
    expect(onAssignDroppedItem).not.toHaveBeenCalled();
    expect(screen.queryByText("Cap prompt text")).not.toBeInTheDocument();
  });

  it("rejects internal video reference drops because folder canvas is image-and-prompt only", async () => {
    render(
      <MediaLibraryFolderCanvas
        folderId="folder-1"
        mediaRows={[]}
        promptRows={[]}
        onSelectMedia={vi.fn()}
        onSelectPrompt={vi.fn()}
        onUnassignItem={vi.fn(async () => {})}
        resolveCanvasDropReference={(payload) => {
          if (payload.outputId !== "video-1") return null;
          return {
            kind: "video",
            outputId: "video-1",
            mediaId: "media-video-1",
            videoUrl: "https://example.com/internal-video.mp4",
            posterUrl: "https://example.com/internal-video-poster.webp",
            title: "Internal video",
            width: 1920,
            height: 1080,
            sourceSurface: payload.sourceSurface ?? null,
          };
        }}
      />
    );

    const viewport = await screen.findByTestId("canvas-viewport");
    mockViewportRect(viewport);

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({
        "text/reference-origin": "ai-studio-reference-grid",
        "text/reference-version": "1",
        "text/reference-id": "video-1",
        "text/reference-output-id": "video-1",
        "text/reference-source-surface": "all-refs",
      }),
      clientX: 300,
      clientY: 200,
    });

    await waitFor(() => {
      expect(
        screen.getByText("Only images and prompts can be dropped onto this canvas.")
      ).toBeInTheDocument();
    });
    expect(screen.queryAllByTestId(/canvas-item-/)).toHaveLength(0);
  });

  it("rejects direct audio file drops because folder canvas only accepts images from disk", async () => {
    const onDropFilesToCanvas = vi.fn(async () => [
      {
        id: "media-audio-1",
        filename: "clip.mp3",
        storage_path: "user-1/uploads/clip.mp3",
        preview_storage_path: "user-1/uploads/clip.mp3",
        file_type: "audio/mpeg",
        signedUrl: "https://example.com/clip.mp3",
      },
    ]);

    render(
      <MediaLibraryFolderCanvas
        folderId="folder-1"
        mediaRows={[]}
        promptRows={[]}
        onSelectMedia={vi.fn()}
        onSelectPrompt={vi.fn()}
        onUnassignItem={vi.fn(async () => {})}
        onDropFilesToCanvas={onDropFilesToCanvas}
      />
    );

    const viewport = await screen.findByTestId("canvas-viewport");
    mockViewportRect(viewport);
    const file = new File(["audio"], "clip.mp3", { type: "audio/mpeg" });

    fireEvent.drop(viewport, {
      dataTransfer: createTransfer({}, [file]),
      clientX: 300,
      clientY: 200,
    });

    await waitFor(() => {
      expect(
        screen.getByText("Only image files can be dropped onto this canvas.")
      ).toBeInTheDocument();
    });
    expect(onDropFilesToCanvas).toHaveBeenCalledTimes(1);
    expect(screen.queryAllByTestId(/canvas-item-/)).toHaveLength(0);
  });
});
