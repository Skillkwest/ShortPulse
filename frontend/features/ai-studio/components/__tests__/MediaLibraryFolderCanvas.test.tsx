import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("MediaLibraryFolderCanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMediaFolderCanvasStateMock.mockResolvedValue(null);
    saveMediaFolderCanvasStateMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllTimers();
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
