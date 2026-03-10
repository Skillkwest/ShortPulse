import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MediaLibraryPanel } from "../MediaLibraryPanel";

const listMediaFoldersMock = vi.fn();
const createMediaFolderMock = vi.fn();
const renameMediaFolderMock = vi.fn();
const deleteMediaFolderMock = vi.fn();
const applyMediaFolderMembershipBatchMock = vi.fn();
const fetchMediaPromptListPageMock = vi.fn();
const fetchMediaListPageMock = vi.fn();

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseClient: () => ({
    auth: {
      getSession: async () => ({
        data: {
          session: {
            user: {
              id: "user-1",
            },
          },
        },
      }),
    },
    storage: {
      from: () => ({
        download: async () => ({ data: null, error: new Error("nope") }),
      }),
    },
  }),
}));

vi.mock("../../../../lib/useVisibleErrorTelemetry", () => ({
  useVisibleErrorTelemetry: () => undefined,
}));

vi.mock("../../../../lib/mediaPerfTelemetry", () => ({
  createMediaPerfTimer: () => () => undefined,
}));

vi.mock("../../../media-library/hooks/useMediaAdaptivePressure", () => ({
  useMediaAdaptivePressure: () => ({
    previewPressureLevel: 0,
  }),
}));

vi.mock("../../../media-library/hooks/useMediaPreviewSigningController", () => ({
  useMediaPreviewSigningController: () => undefined,
}));

vi.mock("../../../media-library/hooks/useMediaPreviewRecoveryController", () => ({
  useMediaPreviewRecoveryController: () => ({
    refreshSignedUrl: async () => "https://cdn.example.com/fallback.png",
    handleMediaPreviewError: () => undefined,
  }),
}));

vi.mock("../../../media-library/logic/mediaListApi", () => ({
  fetchMediaListPage: (...args: unknown[]) => fetchMediaListPageMock(...args),
}));

vi.mock("../../../media-library/logic/mediaPreviewResolver", () => ({
  resolveSignedSelectionUrl: async ({ row }: { row: { signedUrl?: string | null } }) =>
    row.signedUrl ?? null,
}));

vi.mock("../../../media-library/logic/mediaPreviewRuntimeShared", () => ({
  signMediaStoragePath: async () => null,
  resolveAndApplySignedPreviewUrlsByRows: async () => new Set<string>(),
  hydrateMediaPreviewViaStorageDownload: async () => null,
}));

vi.mock("../../logic/mediaLibraryPanelApi", async () => {
  const actual = await vi.importActual("../../logic/mediaLibraryPanelApi");
  return {
    ...actual,
    listMediaFolders: (...args: unknown[]) => listMediaFoldersMock(...args),
    createMediaFolder: (...args: unknown[]) => createMediaFolderMock(...args),
    renameMediaFolder: (...args: unknown[]) => renameMediaFolderMock(...args),
    deleteMediaFolder: (...args: unknown[]) => deleteMediaFolderMock(...args),
    applyMediaFolderMembershipBatch: (...args: unknown[]) =>
      applyMediaFolderMembershipBatchMock(...args),
    fetchMediaPromptListPage: (...args: unknown[]) => fetchMediaPromptListPageMock(...args),
  };
});

vi.mock("../media-library-modal/MediaLibraryMediaGrid", () => ({
  MediaLibraryMediaGrid: (props: {
    activeMedia: Array<{ id: string; filename: string }>;
    onSelectMediaFile: (row: { id: string; filename: string }) => void;
    onDownloadMediaFile?: (row: {
      id: string;
      filename: string;
      signedUrl?: string | null;
    }) => void;
    showRemoveAction?: boolean;
    onRemoveMediaFromFolder?: (row: {
      id: string;
      filename: string;
      signedUrl?: string | null;
    }) => void;
  }) => (
    <div data-testid="mock-media-grid">
      {props.activeMedia.map((row) => (
        <React.Fragment key={row.id}>
          <button type="button" onClick={() => props.onSelectMediaFile(row)}>
            Select media {row.filename}
          </button>
          {props.onDownloadMediaFile ? (
            <button type="button" onClick={() => props.onDownloadMediaFile?.(row)}>
              Download media {row.filename}
            </button>
          ) : null}
          {props.showRemoveAction && props.onRemoveMediaFromFolder ? (
            <button type="button" onClick={() => props.onRemoveMediaFromFolder?.(row)}>
              Remove media {row.filename}
            </button>
          ) : null}
        </React.Fragment>
      ))}
    </div>
  ),
}));

vi.mock("../media-library-modal/MediaLibraryPromptGrid", () => ({
  MediaLibraryPromptGrid: (props: {
    sortedPrompts: Array<{ id: string; title: string | null }>;
    onSelectPromptCard: (row: { id: string; title: string | null; prompt_text: string }) => void;
    showRemoveAction?: boolean;
    onRemovePromptFromFolder?: (row: {
      id: string;
      title: string | null;
      prompt_text: string;
    }) => void;
  }) => (
    <div data-testid="mock-prompt-grid">
      {props.sortedPrompts.map((row) => (
        <React.Fragment key={row.id}>
          <button
            type="button"
            onClick={() =>
              props.onSelectPromptCard({
                id: row.id,
                title: row.title,
                prompt_text: "Prompt text",
              })
            }
          >
            Select prompt {row.title || row.id}
          </button>
          {props.showRemoveAction && props.onRemovePromptFromFolder ? (
            <button
              type="button"
              onClick={() =>
                props.onRemovePromptFromFolder?.({
                  id: row.id,
                  title: row.title,
                  prompt_text: "Prompt text",
                })
              }
            >
              Remove prompt {row.title || row.id}
            </button>
          ) : null}
        </React.Fragment>
      ))}
    </div>
  ),
}));

describe("MediaLibraryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMediaFoldersMock.mockResolvedValue([
      {
        id: "folder-1",
        name: "Campaign",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
    ]);
    fetchMediaListPageMock.mockResolvedValue({
      rows: [
        {
          id: "media-1",
          filename: "ref-1.png",
          storage_path: "user-1/uploads/ref-1.png",
          preview_storage_path: "user-1/uploads/ref-1.png",
          file_type: "image/png",
          source: "upload",
          created_at: "2026-03-02T00:00:00.000Z",
          metadata: null,
          signedUrl: "https://cdn.example.com/ref-1.png",
        },
        {
          id: "media-2",
          filename: "clip-1.mp4",
          storage_path: "user-1/uploads/clip-1.mp4",
          preview_storage_path: "user-1/uploads/clip-1.mp4",
          file_type: "video/mp4",
          source: "upload",
          created_at: "2026-03-01T00:00:00.000Z",
          metadata: null,
          signedUrl: "https://cdn.example.com/clip-1.mp4",
        },
      ],
      nextCursor: null,
      hasMore: false,
      signedById: new Map<string, string>(),
    });
    fetchMediaPromptListPageMock.mockResolvedValue({
      rows: [
        {
          id: "prompt-1",
          title: "Prompt One",
          prompt_text: "Prompt text",
          mode: "text",
          source: "manual",
          created_at: "2026-03-02T00:00:00.000Z",
          updated_at: "2026-03-02T00:00:00.000Z",
        },
      ],
      nextCursor: null,
      hasMore: false,
    });
    createMediaFolderMock.mockImplementation(async (name: string) => ({
      id: "folder-created",
      name,
      createdAt: "2026-03-03T00:00:00.000Z",
      updatedAt: "2026-03-03T00:00:00.000Z",
    }));
    renameMediaFolderMock.mockImplementation(
      async ({ folderId, name }: { folderId: string; name: string }) => ({
        id: folderId,
        name,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-04T00:00:00.000Z",
      })
    );
    deleteMediaFolderMock.mockResolvedValue(undefined);
  });

  it("loads folders + media data and keeps media click as selection-only", async () => {
    const onSelectMedia = vi.fn();
    const onSelectPrompt = vi.fn();
    render(<MediaLibraryPanel onSelectMedia={onSelectMedia} onSelectPrompt={onSelectPrompt} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "All Media folder" })).toBeInTheDocument();
      expect(screen.getByText("Campaign")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("separator", { name: "Resize folders and references sections" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select media ref-1.png" }));
    expect(onSelectMedia).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Select prompt Prompt One" }));
    expect(onSelectPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "prompt-1",
        promptText: "Prompt text",
      })
    );
  });

  it("downloads media from the panel media hover action", async () => {
    const originalCreateElement = document.createElement.bind(document);
    const anchor = originalCreateElement("a");
    const clickSpy = vi.spyOn(anchor, "click").mockImplementation(() => undefined);
    const removeSpy = vi.spyOn(anchor, "remove").mockImplementation(() => undefined);
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation(((
      tagName: string
    ) => {
      if (tagName.toLowerCase() === "a") return anchor;
      return originalCreateElement(tagName as keyof HTMLElementTagNameMap);
    }) as typeof document.createElement);
    try {
      render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Download media ref-1.png" })
        ).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: "Download media ref-1.png" }));

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(removeSpy).toHaveBeenCalledTimes(1);
      expect(anchor.download).toBe("ref-1.png");
    } finally {
      createElementSpy.mockRestore();
      clickSpy.mockRestore();
      removeSpy.mockRestore();
    }
  });

  it("includes private-tab uploads inside All Media", async () => {
    fetchMediaListPageMock.mockResolvedValueOnce({
      rows: [
        {
          id: "media-private-1",
          filename: "private-ref-1.png",
          storage_path: "user-1/private/images/private-ref-1.png",
          preview_storage_path: "user-1/private/images/private-ref-1.png",
          file_type: "image/png",
          source: "private_upload",
          created_at: "2026-03-03T00:00:00.000Z",
          metadata: null,
          signedUrl: "https://cdn.example.com/private-ref-1.png",
        },
      ],
      nextCursor: null,
      hasMore: false,
      signedById: new Map<string, string>(),
    });

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Select media private-ref-1.png" })
      ).toBeInTheDocument();
    });
  });

  it("shows remove actions only in custom folders and unassigns dropped items", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Campaign")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: "Remove prompt Prompt One" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Campaign folder" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Remove prompt Prompt One" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove prompt Prompt One" }));

    await waitFor(() => {
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith({
        folderId: "folder-1",
        action: "unassign",
        mediaIds: [],
        promptIds: ["prompt-1"],
      });
    });
  });

  it("toggles prompts, images, and videos sections from subtitle rows in All Media", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Prompts (1)" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Images (1)" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Videos (1)" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Select prompt Prompt One" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Select media ref-1.png" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Select media clip-1.mp4" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Prompts (1)" }));
    expect(
      screen.queryByRole("button", { name: "Select prompt Prompt One" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Images (1)" }));
    expect(
      screen.queryByRole("button", { name: "Select media ref-1.png" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Videos (1)" }));
    expect(
      screen.queryByRole("button", { name: "Select media clip-1.mp4" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Prompts (1)" }));
    expect(screen.getByRole("button", { name: "Select prompt Prompt One" })).toBeInTheDocument();
  });

  it("creates a new folder button from the folder strip", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Create new folder" }));

    await waitFor(() => {
      expect(createMediaFolderMock).toHaveBeenCalledWith("New Folder");
    });
    expect(screen.getByRole("button", { name: "New Folder folder" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("New Folder")).toBeInTheDocument();
  });

  it("retries with an incremented folder name when the default collides", async () => {
    createMediaFolderMock
      .mockRejectedValueOnce(new Error("Folder name already exists"))
      .mockImplementationOnce(async (name: string) => ({
        id: "folder-created-2",
        name,
        createdAt: "2026-03-03T00:00:00.000Z",
        updatedAt: "2026-03-03T00:00:00.000Z",
      }));

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Create new folder" }));

    await waitFor(() => {
      expect(createMediaFolderMock).toHaveBeenNthCalledWith(1, "New Folder");
      expect(createMediaFolderMock).toHaveBeenNthCalledWith(2, "New Folder 2");
    });
    expect(screen.getByRole("button", { name: "New Folder 2 folder" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("New Folder 2")).toBeInTheDocument();
  });

  it("renders a new folder tile immediately before create resolves", async () => {
    let resolveCreate:
      | ((value: { id: string; name: string; createdAt: string; updatedAt: string }) => void)
      | null = null;
    createMediaFolderMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Create new folder" }));

    expect(screen.getByRole("button", { name: "New Folder folder" })).toBeInTheDocument();

    act(() => {
      resolveCreate?.({
        id: "folder-created-3",
        name: "New Folder",
        createdAt: "2026-03-03T00:00:00.000Z",
        updatedAt: "2026-03-03T00:00:00.000Z",
      });
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "New Folder folder" })).toBeInTheDocument();
    });
  });

  it("renames the active custom folder button", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Campaign name" }));
    fireEvent.change(screen.getByDisplayValue("Campaign"), {
      target: { value: "Campaign Assets" },
    });
    fireEvent.keyDown(screen.getByDisplayValue("Campaign Assets"), {
      key: "Enter",
      code: "Enter",
      charCode: 13,
    });

    await waitFor(() => {
      expect(renameMediaFolderMock).toHaveBeenCalledWith({
        folderId: "folder-1",
        name: "Campaign Assets",
      });
    });
    expect(screen.getByRole("button", { name: "Campaign Assets folder" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rename active folder" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete active folder" })).not.toBeInTheDocument();
  });

  it("opens a right-click folder menu and starts rename from menu action", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select media ref-1.png" })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.contextMenu(screen.getByRole("button", { name: "Campaign folder" }), {
        clientX: 120,
        clientY: 220,
      });
    });

    expect(screen.getByRole("menu", { name: "Campaign folder actions" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "Rename folder" }));
    });

    expect(screen.getByDisplayValue("Campaign")).toBeInTheDocument();
    expect(screen.queryByRole("menu", { name: "Campaign folder actions" })).not.toBeInTheDocument();
  });

  it("deletes a custom folder from the right-click folder menu", async () => {
    const { container } = render(
      <MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select media ref-1.png" })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.contextMenu(screen.getByRole("button", { name: "Campaign folder" }), {
        clientX: 120,
        clientY: 220,
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "Delete folder" }));
    });

    await waitFor(() => {
      expect(deleteMediaFolderMock).toHaveBeenCalledWith("folder-1");
    });
    expect(screen.queryByRole("button", { name: "Campaign folder" })).not.toBeInTheDocument();
    const footer = container.querySelector(".media-library-panel-footer");
    expect(footer?.textContent).toContain("All Media");
  });

  it("shows folder tile drop highlight while a compatible drag is hovering", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    const payload = JSON.stringify({
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-1",
        url: "https://cdn.example.com/ref-1.png",
        fileType: "image",
      },
    });
    const transfer = {
      getData: (type: string) =>
        type === "application/x-shortpulse-media-library-item"
          ? payload
          : type === "text/x-shortpulse-media-library-item"
            ? payload
            : "",
      dropEffect: "none",
      effectAllowed: "copy",
    } as unknown as DataTransfer;

    const folderButton = screen.getByRole("button", { name: "Campaign folder" });
    const folderTile = folderButton.closest(
      ".media-library-panel-folder-strip-item"
    ) as HTMLElement;
    expect(folderTile).toBeTruthy();
    expect(folderTile.classList.contains("is-drop-hover")).toBe(false);

    fireEvent.dragOver(folderTile, { dataTransfer: transfer });
    expect(folderTile.classList.contains("is-drop-hover")).toBe(true);

    fireEvent.dragLeave(folderTile, { dataTransfer: transfer });
    expect(folderTile.classList.contains("is-drop-hover")).toBe(false);
  });

  it("shows folder tile drop highlight when transfer data is unavailable during dragover", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    const transfer = {
      getData: () => "",
      types: ["application/x-shortpulse-media-library-item"],
      dropEffect: "none",
      effectAllowed: "copy",
    } as unknown as DataTransfer;

    const folderButton = screen.getByRole("button", { name: "Campaign folder" });
    const folderTile = folderButton.closest(
      ".media-library-panel-folder-strip-item"
    ) as HTMLElement;
    expect(folderTile).toBeTruthy();
    expect(folderTile.classList.contains("is-drop-hover")).toBe(false);

    fireEvent.dragOver(folderTile, { dataTransfer: transfer });
    expect(folderTile.classList.contains("is-drop-hover")).toBe(true);
  });

  it("assigns dropped prompt references from All Media to a custom folder tile", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    const payload = JSON.stringify({
      kind: "libraryPrompt",
      source: "mediaLibrary",
      payload: {
        id: "prompt-1",
        promptText: "Prompt text",
        originFolderId: "all_items",
        title: "Prompt One",
      },
    });
    const transfer = {
      getData: (type: string) =>
        type === "application/x-shortpulse-media-library-item"
          ? payload
          : type === "text/x-shortpulse-media-library-item"
            ? payload
            : "",
      types: ["application/x-shortpulse-media-library-item"],
      dropEffect: "none",
      effectAllowed: "copy",
    } as unknown as DataTransfer;

    const folderButton = screen.getByRole("button", { name: "Campaign folder" });
    const folderTile = folderButton.closest(
      ".media-library-panel-folder-strip-item"
    ) as HTMLElement;
    expect(folderTile).toBeTruthy();

    fireEvent.drop(folderTile, { dataTransfer: transfer });

    await waitFor(() => {
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith({
        action: "assign",
        folderId: "folder-1",
        mediaIds: [],
        promptIds: ["prompt-1"],
      });
    });
  });

  it("resizes folders/content sections when dragging the horizontal divider", async () => {
    const { container } = render(
      <MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    const divider = screen.getByRole("separator", {
      name: "Resize folders and references sections",
    });
    const splitContainer = container.querySelector(".media-library-panel-split") as HTMLElement;
    expect(splitContainer).toBeTruthy();
    Object.defineProperty(splitContainer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 700,
        height: 900,
        right: 700,
        bottom: 900,
        toJSON: () => ({}),
      }),
    });

    const before = Number(divider.getAttribute("aria-valuenow"));
    expect(Number.isFinite(before)).toBe(true);

    fireEvent.pointerDown(divider, {
      pointerId: 101,
      button: 0,
      clientY: 300,
      pointerType: "mouse",
    });
    fireEvent.pointerMove(window, { pointerId: 101, clientY: 420 });
    fireEvent.pointerUp(window, { pointerId: 101, clientY: 420 });

    const after = Number(divider.getAttribute("aria-valuenow"));
    expect(after).toBeGreaterThan(before);
  });

  it("shows a folder error when folder request times out", async () => {
    vi.useFakeTimers();
    listMediaFoldersMock.mockImplementation(() => new Promise<never>(() => undefined));
    try {
      await act(async () => {
        render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(12_100);
      });
      expect(screen.getByText("Unable to load folders.")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
