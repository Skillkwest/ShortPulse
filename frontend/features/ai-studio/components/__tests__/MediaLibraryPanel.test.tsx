import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MediaLibraryPanel } from "../MediaLibraryPanel";

const listMediaFoldersMock = vi.fn();
const createMediaFolderMock = vi.fn();
const renameMediaFolderMock = vi.fn();
const deleteMediaFolderMock = vi.fn();
const applyMediaFolderMembershipBatchMock = vi.fn();
const uploadMediaFileMock = vi.fn();
const fetchMediaPromptListPageMock = vi.fn();
const fetchMediaListPageMock = vi.fn();
const mediaGridPropsSpy = vi.fn();
const folderCanvasPropsSpy = vi.fn();
const storageDownloadMock = vi.fn();
const deleteMediaFileWithStorageMock = vi.fn();
const deleteMediaPromptByIdMock = vi.fn();
const logMediaEventMock = vi.fn();
const isAdaptiveSurfaceEnabledMock = vi.fn();
const useMediaPreviewSigningControllerMock = vi.fn();

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

vi.mock("../../../../lib/adaptive-media", () => ({
  isAdaptiveSurfaceEnabled: (...args: unknown[]) => isAdaptiveSurfaceEnabledMock(...args),
}));

vi.mock("../MediaLibraryFolderCanvas", () => ({
  MediaLibraryFolderCanvas: ({
    mediaRows,
    promptRows,
    onUnassignItem,
    onAssignDroppedItem,
    onDropFilesToCanvas,
  }: {
    mediaRows: Array<{ id: string }>;
    promptRows: Array<{ id: string }>;
    onUnassignItem: (item: { kind: "media" | "prompt"; id: string }) => Promise<void>;
    onAssignDroppedItem?: (item: { kind: "media" | "prompt"; id: string }) => Promise<boolean>;
    onDropFilesToCanvas?: (files: FileList) => Promise<unknown>;
  }) => {
    folderCanvasPropsSpy({ mediaRows, promptRows });
    const file = new File(["canvas"], "canvas-drop.png", { type: "image/png" });
    const fileList = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
    } as unknown as FileList;
    return (
      <div data-testid="media-library-folder-canvas-mock">
        <button
          type="button"
          onClick={() => {
            void onUnassignItem({ kind: "prompt", id: "prompt-1" });
          }}
        >
          Remove prompt Prompt One
        </button>
        <button
          type="button"
          onClick={() => {
            void onAssignDroppedItem?.({ kind: "media", id: "media-drop-1" });
          }}
        >
          Assign dropped media Media One
        </button>
        <button
          type="button"
          onClick={() => {
            void onDropFilesToCanvas?.(fileList);
          }}
        >
          Drop files on folder canvas
        </button>
      </div>
    );
  },
}));

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: () => ({
    storage: {
      from: () => ({
        download: (...args: unknown[]) => storageDownloadMock(...args),
      }),
    },
  }),
  readSupabaseUserId: async () => "user-1",
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
  useMediaPreviewSigningController: (...args: unknown[]) =>
    useMediaPreviewSigningControllerMock(...args),
}));

vi.mock("../../../media-library/hooks/useMediaPreviewRecoveryController", () => ({
  useMediaPreviewRecoveryController: () => ({
    refreshSignedUrl: async () => "https://cdn.example.com/fallback.png",
    handleMediaPreviewError: () => undefined,
  }),
}));

vi.mock("../../../media-library/logic/mediaLibraryFeatureFlags", async () => {
  const actual = await vi.importActual("../../../media-library/logic/mediaLibraryFeatureFlags");
  return {
    ...actual,
    AI_STUDIO_MEDIA_LIBRARY_GESTURE_V2_ENABLED: true,
  };
});

vi.mock("../../../media-library/logic/mediaLibraryDataEffects", async () => {
  const actual = await vi.importActual("../../../media-library/logic/mediaLibraryDataEffects");
  return {
    ...actual,
    deleteMediaFileWithStorage: (...args: unknown[]) => deleteMediaFileWithStorageMock(...args),
    deleteMediaPromptById: (...args: unknown[]) => deleteMediaPromptByIdMock(...args),
    logMediaEvent: (...args: unknown[]) => logMediaEventMock(...args),
  };
});

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
    uploadMediaFile: (...args: unknown[]) => uploadMediaFileMock(...args),
    fetchMediaPromptListPage: (...args: unknown[]) => fetchMediaPromptListPageMock(...args),
  };
});

vi.mock("../media-library-modal/MediaLibraryMediaGrid", () => ({
  MediaLibraryMediaGrid: (props: {
    activeMedia: Array<{ id: string; filename: string }>;
    onSelectMediaFile: (row: { id: string; filename: string }) => void;
    onMediaDoubleClick?: (row: { id: string; filename: string }) => void;
    resolveCardPreviewUrl?: (args: {
      signedUrl: string | null | undefined;
      fileType?: string | null;
      pressureLevel: 0 | 1 | 2;
      adaptivePreviewQualityEnabled: boolean;
      shouldBypassAdaptivePreview?: boolean;
      cardLongEdgePx?: number;
      devicePixelRatio?: number;
    }) => string | null;
    onDownloadMediaFile?: (row: {
      id: string;
      filename: string;
      signedUrl?: string | null;
    }) => void;
    onMediaContextMenu?: (
      event: React.MouseEvent<HTMLButtonElement>,
      row: { id: string; filename: string; signedUrl?: string | null }
    ) => void;
    showRemoveAction?: boolean;
    onRemoveMediaFromFolder?: (row: {
      id: string;
      filename: string;
      signedUrl?: string | null;
    }) => void;
    showDeleteAction?: boolean;
    onDeleteMediaFromLibrary?: (row: {
      id: string;
      filename: string;
      signedUrl?: string | null;
      storage_path?: string;
    }) => void;
  }) => {
    mediaGridPropsSpy(props);
    return (
      <div data-testid="mock-media-grid">
        {props.activeMedia.map((row) => (
          <React.Fragment key={row.id}>
            <button type="button" onClick={() => props.onSelectMediaFile(row)}>
              Select media {row.filename}
            </button>
            {props.onMediaDoubleClick ? (
              <button type="button" onDoubleClick={() => props.onMediaDoubleClick?.(row)}>
                Open preview media {row.filename}
              </button>
            ) : null}
            {props.onMediaContextMenu ? (
              <button
                type="button"
                onContextMenu={(event) => props.onMediaContextMenu?.(event, row)}
              >
                Context media {row.filename}
              </button>
            ) : null}
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
            {props.showDeleteAction && props.onDeleteMediaFromLibrary ? (
              <button type="button" onClick={() => props.onDeleteMediaFromLibrary?.(row)}>
                Delete media {row.filename}
              </button>
            ) : null}
          </React.Fragment>
        ))}
      </div>
    );
  },
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
    showDeleteAction?: boolean;
    onDeletePromptFromLibrary?: (row: {
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
          {props.showDeleteAction && props.onDeletePromptFromLibrary ? (
            <button
              type="button"
              onClick={() =>
                props.onDeletePromptFromLibrary?.({
                  id: row.id,
                  title: row.title,
                  prompt_text: "Prompt text",
                })
              }
            >
              Delete prompt {row.title || row.id}
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
    mediaGridPropsSpy.mockReset();
    folderCanvasPropsSpy.mockReset();
    storageDownloadMock.mockResolvedValue({
      data: new Blob(["panel-download"], { type: "image/png" }),
      error: null,
    });
    isAdaptiveSurfaceEnabledMock.mockImplementation(
      (surface: string) => surface === "media-library-modal-grid"
    );
    deleteMediaFileWithStorageMock.mockResolvedValue(undefined);
    deleteMediaPromptByIdMock.mockResolvedValue(undefined);
    logMediaEventMock.mockResolvedValue(undefined);
    useMediaPreviewSigningControllerMock.mockReset();
    uploadMediaFileMock.mockResolvedValue({
      id: "uploaded-1",
      filename: "upload.png",
      storage_path: "user-1/images/upload.png",
      preview_storage_path: "user-1/images/upload.png",
      file_type: "image/png",
      file_size: 128,
      source: "upload",
      created_at: "2026-03-05T00:00:00.000Z",
      signedUrl: "https://cdn.example.com/upload.png",
    });
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
      libraryTotalCount: 2,
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
      expect(screen.getByText("Campaign")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "All Media folder" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("2 saved media items")).toBeInTheDocument();
    expect(
      screen.getByRole("separator", { name: "Resize folders and references sections" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select media ref-1.png" }));
    expect(onSelectMedia).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: "Prompts" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select prompt Prompt One" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Select prompt Prompt One" }));
    expect(onSelectPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "prompt-1",
        promptText: "Prompt text",
      })
    );
  });

  it("renders and commits the project name field", async () => {
    const onProjectNameCommit = vi.fn();
    render(
      <MediaLibraryPanel
        onSelectMedia={vi.fn()}
        onSelectPrompt={vi.fn()}
        projectName="Campaign Alpha"
        onProjectNameCommit={onProjectNameCommit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Campaign")).toBeInTheDocument();
    });

    expect(screen.getAllByText("All Media").length).toBeGreaterThan(0);

    const input = screen.getByRole("textbox", { name: "Project name" });
    expect(input).toHaveValue("Campaign Alpha");

    fireEvent.change(input, { target: { value: "Launch Board" } });
    fireEvent.blur(input);

    expect(onProjectNameCommit).toHaveBeenCalledWith("Launch Board");
  });

  it("hides root tab count labels for Images, Videos, and Prompts views", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Campaign")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Images" }));
    expect(screen.queryByText(/^Images \(/)).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Videos" }));
    expect(screen.queryByText(/^Videos \(/)).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Prompts" }));
    expect(screen.queryByText(/^Prompts \(/)).toBeNull();
  });

  it("routes all-media media right-click to onSelectMedia", async () => {
    const onSelectMedia = vi.fn();
    render(<MediaLibraryPanel onSelectMedia={onSelectMedia} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Context media ref-1.png" })).toBeInTheDocument();
    });

    fireEvent.contextMenu(screen.getByRole("button", { name: "Context media ref-1.png" }));

    await waitFor(() => {
      expect(onSelectMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "media-1",
          url: "https://cdn.example.com/ref-1.png",
          fileType: "image",
        })
      );
    });
  });

  it("opens preview modal on all-media media double-click without ingest side effects", async () => {
    const onSelectMedia = vi.fn();
    render(<MediaLibraryPanel onSelectMedia={onSelectMedia} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Open preview media ref-1.png" })
      ).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Open preview media ref-1.png" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Preview ref-1.png" })).toBeInTheDocument();
    });
    expect(onSelectMedia).not.toHaveBeenCalled();
  });

  it("requires confirmation before deleting root media items", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Delete media ref-1.png" })).toBeInTheDocument();
    });
    expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
    expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(0);

    fireEvent.click(screen.getByRole("button", { name: "Delete media ref-1.png" }));
    expect(deleteMediaFileWithStorageMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Confirm delete from All Media" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() => {
      expect(deleteMediaFileWithStorageMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: "media-1" })
      );
    });
    expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
    expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(0);
  });

  it("cancels root prompt delete when confirmation is dismissed", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Prompts" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Delete prompt Prompt One" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete prompt Prompt One" }));
    expect(deleteMediaPromptByIdMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Confirm delete from All Media" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Confirm delete from All Media" })).toBeNull();
    });
    expect(deleteMediaPromptByIdMock).not.toHaveBeenCalled();
  });

  it("passes panel-specific preview resolver callback to media grid", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByTestId("mock-media-grid").length).toBeGreaterThan(0);
    });
    const latestProps = mediaGridPropsSpy.mock.calls.at(-1)?.[0];
    expect(latestProps).toBeTruthy();
    expect(typeof latestProps.resolveCardPreviewUrl).toBe("function");
  });

  it("uses a panel-specific signing budget instead of the modal budget", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(useMediaPreviewSigningControllerMock).toHaveBeenCalled();
    });

    const latestArgs = useMediaPreviewSigningControllerMock.mock.calls.at(-1)?.[0];
    expect(latestArgs).toBeTruthy();
    expect(latestArgs.surface).toBe("media-library-panel");
    expect(latestArgs.signBudget).toEqual({
      initialSignLimit: 4,
      prefetchWindow: 4,
      signBatchSize: 4,
    });
  });

  it.each(["media-library-panel-grid"] as const)(
    "enables adaptive preview quality when %s is enabled",
    async (enabledSurface) => {
      isAdaptiveSurfaceEnabledMock.mockImplementation(
        (surface: string) => surface === enabledSurface
      );
      render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getAllByTestId("mock-media-grid").length).toBeGreaterThan(0);
      });
      const latestProps = mediaGridPropsSpy.mock.calls.at(-1)?.[0];
      expect(latestProps).toBeTruthy();
      expect(latestProps.adaptivePreviewQualityEnabled).toBe(true);
    }
  );

  it("does not enable adaptive preview quality when only route/modal surfaces are enabled", async () => {
    isAdaptiveSurfaceEnabledMock.mockImplementation(
      (surface: string) =>
        surface === "media-library-grid" || surface === "media-library-modal-grid"
    );
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByTestId("mock-media-grid").length).toBeGreaterThan(0);
    });
    const latestProps = mediaGridPropsSpy.mock.calls.at(-1)?.[0];
    expect(latestProps).toBeTruthy();
    expect(latestProps.adaptivePreviewQualityEnabled).toBe(false);
  });

  it("tracks media selection state inside the panel surface", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select media ref-1.png" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Select media ref-1.png" }));

    await waitFor(() => {
      const latestProps = mediaGridPropsSpy.mock.calls.at(-1)?.[0];
      expect(latestProps?.selectedIds).toBeInstanceOf(Set);
      expect(latestProps?.selectedIds.has("media-1")).toBe(true);
    });
  });

  it("clears panel selection when switching root tabs", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select media ref-1.png" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Select media ref-1.png" }));

    await waitFor(() => {
      const latestProps = mediaGridPropsSpy.mock.calls.at(-1)?.[0];
      expect(latestProps?.selectedIds.has("media-1")).toBe(true);
    });

    fireEvent.click(screen.getByRole("tab", { name: "Prompts" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select prompt Prompt One" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Images" }));

    await waitFor(() => {
      const latestProps = mediaGridPropsSpy.mock.calls.at(-1)?.[0];
      expect(latestProps?.selectedIds).toBeInstanceOf(Set);
      expect(latestProps?.selectedIds.size).toBe(0);
    });
  });

  it("downloads media from the panel media hover action", async () => {
    const originalCreateElement = document.createElement.bind(document);
    const anchor = originalCreateElement("a");
    const clickSpy = vi.spyOn(anchor, "click").mockImplementation(() => undefined);
    const removeSpy = vi.spyOn(anchor, "remove").mockImplementation(() => undefined);
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        writable: true,
        value: () => "blob:shortpulse-test-download",
      });
    }
    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        writable: true,
        value: () => undefined,
      });
    }
    const createObjectUrlSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:shortpulse-test-download");
    const revokeObjectUrlSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
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

      await waitFor(() => {
        expect(clickSpy).toHaveBeenCalledTimes(1);
      });
      expect(removeSpy).toHaveBeenCalledTimes(1);
      expect(storageDownloadMock).toHaveBeenCalledWith("user-1/uploads/ref-1.png");
      expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
      expect(anchor.download).toBe("ref-1.png");
    } finally {
      createElementSpy.mockRestore();
      clickSpy.mockRestore();
      removeSpy.mockRestore();
      createObjectUrlSpy.mockRestore();
      revokeObjectUrlSpy.mockRestore();
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

  it("renders one global all-media paginator footer and loads the next media page from it", async () => {
    fetchMediaListPageMock
      .mockResolvedValueOnce({
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
        ],
        nextCursor: { createdAt: "2026-03-02T00:00:00.000Z", id: "media-1" },
        hasMore: true,
        signedById: new Map<string, string>(),
      })
      .mockResolvedValueOnce({
        rows: [],
        nextCursor: null,
        hasMore: false,
        signedById: new Map<string, string>(),
      });

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("media-library-panel-root-media-paginator")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Load more media" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Load more media" }));

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledTimes(2);
    });
  });

  it("auto-loads the next media page when scrolling near the bottom", async () => {
    fetchMediaListPageMock
      .mockResolvedValueOnce({
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
        ],
        nextCursor: { createdAt: "2026-03-02T00:00:00.000Z", id: "media-1" },
        hasMore: true,
        signedById: new Map<string, string>(),
      })
      .mockResolvedValueOnce({
        rows: [],
        nextCursor: null,
        hasMore: false,
        signedById: new Map<string, string>(),
      });

    const { container } = render(
      <MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />
    );

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
    });

    const scrollContainer = container.querySelector(".media-library-panel-body") as HTMLElement;
    expect(scrollContainer).toBeTruthy();

    Object.defineProperty(scrollContainer, "clientHeight", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(scrollContainer, "scrollHeight", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(scrollContainer, "scrollTop", {
      configurable: true,
      writable: true,
      value: 650,
    });

    fireEvent.scroll(scrollContainer);

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledTimes(2);
    });
  });

  it("auto-loads the next prompt page when scrolling near the bottom on Prompts tab", async () => {
    fetchMediaPromptListPageMock
      .mockResolvedValueOnce({
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
        nextCursor: { createdAt: "2026-03-02T00:00:00.000Z", id: "prompt-1" },
        hasMore: true,
      })
      .mockResolvedValueOnce({
        rows: [],
        nextCursor: null,
        hasMore: false,
      });

    const { container } = render(
      <MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />
    );

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("tab", { name: "Prompts" }));
    await waitFor(() => {
      expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(1);
    });

    const scrollContainer = container.querySelector(".media-library-panel-body") as HTMLElement;
    expect(scrollContainer).toBeTruthy();

    Object.defineProperty(scrollContainer, "clientHeight", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(scrollContainer, "scrollHeight", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(scrollContainer, "scrollTop", {
      configurable: true,
      writable: true,
      value: 650,
    });

    fireEvent.scroll(scrollContainer);

    await waitFor(() => {
      expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(2);
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
    expect(fetchMediaListPageMock).toHaveBeenCalledTimes(2);
    expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Remove prompt Prompt One" }));

    await waitFor(() => {
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith({
        folderId: "folder-1",
        action: "unassign",
        mediaIds: [],
        promptIds: ["prompt-1"],
      });
    });
    expect(fetchMediaListPageMock).toHaveBeenCalledTimes(2);
    expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(1);
  });

  it("assigns internal dropped media ids into the active custom folder canvas", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Campaign")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Campaign folder" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Assign dropped media Media One" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Assign dropped media Media One" }));

    await waitFor(() => {
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith({
        folderId: "folder-1",
        action: "assign",
        mediaIds: ["media-drop-1"],
        promptIds: [],
      });
    });
  });

  it("normalizes transient network failures when assigning dropped media to a folder", async () => {
    applyMediaFolderMembershipBatchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Campaign")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Campaign folder" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Assign dropped media Media One" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Assign dropped media Media One" }));

    await waitFor(() => {
      expect(
        screen.getByText("Network issue while contacting the Media Library. Please retry.")
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument();
  });

  it("preserves panel scroll position after custom-folder refresh flows", async () => {
    const deferredRefresh = createDeferred<{
      rows: Array<{
        id: string;
        filename: string;
        storage_path: string;
        preview_storage_path: string;
        file_type: string;
        source: string;
        created_at: string;
        metadata: null;
        signedUrl: string;
      }>;
      nextCursor: null;
      hasMore: boolean;
      signedById: Map<string, string>;
    }>();
    const mediaRowsPayload = {
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
      ],
      nextCursor: null,
      hasMore: false,
      signedById: new Map<string, string>(),
    };
    fetchMediaListPageMock.mockReset();
    fetchMediaListPageMock
      .mockResolvedValueOnce(mediaRowsPayload)
      .mockResolvedValueOnce(mediaRowsPayload)
      .mockImplementationOnce(async () => deferredRefresh.promise);

    const { container } = render(
      <MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    const scrollContainer = container.querySelector(".media-library-panel-body") as HTMLElement;
    expect(scrollContainer).toBeTruthy();

    let scrollTopValue = 740;
    const scrollHeightValue = 2600;
    Object.defineProperty(scrollContainer, "clientHeight", {
      configurable: true,
      value: 560,
    });
    Object.defineProperty(scrollContainer, "scrollHeight", {
      configurable: true,
      get: () => scrollHeightValue,
    });
    Object.defineProperty(scrollContainer, "scrollTop", {
      configurable: true,
      get: () => scrollTopValue,
      set: (value: number) => {
        scrollTopValue = value;
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Campaign folder" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Assign dropped media Media One" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Assign dropped media Media One" }));
    await waitFor(() => {
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith({
        folderId: "folder-1",
        action: "assign",
        mediaIds: ["media-drop-1"],
        promptIds: [],
      });
    });

    // Simulate the browser snapping to top while rows are being refreshed.
    scrollTopValue = 0;

    await act(async () => {
      deferredRefresh.resolve(mediaRowsPayload);
    });

    await waitFor(() => {
      expect(scrollTopValue).toBe(740);
    });
  });

  it("uploads desktop files dropped on a folder tile and assigns them to that folder", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    const file = new File(["desktop"], "desktop-drop.png", { type: "image/png" });
    const files = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
    } as unknown as FileList;
    const transfer = {
      files,
      types: ["Files"],
      getData: () => "",
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
      expect(uploadMediaFileMock).toHaveBeenCalledWith({
        file,
        destinationTab: "uploaded_images",
      });
    });
    await waitFor(() => {
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith({
        action: "assign",
        folderId: "folder-1",
        mediaIds: ["uploaded-1"],
        promptIds: [],
      });
    });
  });

  it("prioritizes media-library drag payload over transfer files on folder tile drops", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    const file = new File(["desktop"], "desktop-drop.png", { type: "image/png" });
    const files = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
    } as unknown as FileList;
    const payload = JSON.stringify({
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-1",
        url: "https://cdn.example.com/ref-1.png",
        fileType: "image",
        originFolderId: "all_items",
      },
    });
    const transfer = {
      files,
      types: ["Files", "application/x-shortpulse-media-library-item"],
      getData: (type: string) =>
        type === "application/x-shortpulse-media-library-item" ||
        type === "text/x-shortpulse-media-library-item"
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

    fireEvent.drop(folderTile, { dataTransfer: transfer });

    await waitFor(() => {
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith({
        action: "assign",
        folderId: "folder-1",
        mediaIds: ["media-1"],
        promptIds: [],
      });
    });
    expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
    expect(uploadMediaFileMock).not.toHaveBeenCalled();
  });

  it("uploads desktop files dropped on folder canvas and assigns them to the active folder", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Campaign")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Campaign folder" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Drop files on folder canvas" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Drop files on folder canvas" }));

    await waitFor(() => {
      expect(uploadMediaFileMock).toHaveBeenCalledWith({
        file: expect.objectContaining({ name: "canvas-drop.png" }),
        destinationTab: "uploaded_images",
      });
    });
    await waitFor(() => {
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith({
        action: "assign",
        folderId: "folder-1",
        mediaIds: ["uploaded-1"],
        promptIds: [],
      });
    });
  });

  it("defers folder-canvas mount until custom-folder media and prompt scopes resolve", async () => {
    const deferredFolderMediaPage = createDeferred<{
      rows: Array<Record<string, unknown>>;
      nextCursor: null;
      hasMore: boolean;
      signedById: Map<string, string>;
    }>();
    const deferredFolderPromptPage = createDeferred<{
      rows: Array<Record<string, unknown>>;
      nextCursor: null;
      hasMore: boolean;
    }>();

    fetchMediaListPageMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "media-root-1",
            filename: "root-ref.png",
            storage_path: "user-1/uploads/root-ref.png",
            preview_storage_path: "user-1/uploads/root-ref.png",
            file_type: "image/png",
            source: "upload",
            created_at: "2026-03-02T00:00:00.000Z",
            metadata: null,
            signedUrl: "https://cdn.example.com/root-ref.png",
          },
        ],
        nextCursor: null,
        hasMore: false,
        signedById: new Map<string, string>(),
      })
      .mockImplementationOnce(() => deferredFolderMediaPage.promise);
    fetchMediaPromptListPageMock.mockImplementationOnce(() => deferredFolderPromptPage.promise);

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Campaign")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Select media root-ref.png" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Campaign folder" }));

    await waitFor(() => {
      expect(screen.getByText("Loading folder canvas...")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("media-library-folder-canvas-mock")).not.toBeInTheDocument();

    await act(async () => {
      deferredFolderMediaPage.resolve({
        rows: [
          {
            id: "media-folder-1",
            filename: "folder-ref.png",
            storage_path: "user-1/uploads/folder-ref.png",
            preview_storage_path: "user-1/uploads/folder-ref.png",
            file_type: "image/png",
            source: "upload",
            created_at: "2026-03-03T00:00:00.000Z",
            metadata: null,
            signedUrl: "https://cdn.example.com/folder-ref.png",
          },
        ],
        nextCursor: null,
        hasMore: false,
        signedById: new Map<string, string>(),
      });
      deferredFolderPromptPage.resolve({
        rows: [
          {
            id: "prompt-folder-1",
            title: "Folder Prompt",
            prompt_text: "Folder prompt text",
            mode: "text",
            source: "manual",
            created_at: "2026-03-03T00:00:00.000Z",
            updated_at: "2026-03-03T00:00:00.000Z",
          },
        ],
        nextCursor: null,
        hasMore: false,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("media-library-folder-canvas-mock")).toBeInTheDocument();
    });

    const latestCanvasProps = folderCanvasPropsSpy.mock.calls.at(-1)?.[0] as
      | {
          mediaRows: Array<{ id: string }>;
          promptRows: Array<{ id: string }>;
        }
      | undefined;
    expect(latestCanvasProps).toBeTruthy();
    expect(latestCanvasProps?.mediaRows.map((row) => row.id)).toEqual(["media-folder-1"]);
    expect(latestCanvasProps?.promptRows.map((row) => row.id)).toEqual(["prompt-folder-1"]);
  });

  it("switches All Media root tabs between all media, images, videos, audio, and prompts", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("tablist", { name: "All Media type tabs" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "All Media" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Prompts" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Images" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Videos" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Audio" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Select media ref-1.png" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Select media clip-1.mp4" })).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: "Select prompt Prompt One" })
    ).not.toBeInTheDocument();

    expect(fetchMediaListPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaKind: "all",
        folderId: "all_items",
      })
    );
    const latestAllMediaProps = mediaGridPropsSpy.mock.calls.at(-1)?.[0];
    expect(latestAllMediaProps?.activeMedia.map((row: { id: string }) => row.id)).toEqual([
      "media-1",
      "media-2",
    ]);

    fireEvent.click(screen.getByRole("tab", { name: "Images" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select media ref-1.png" })).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Select media clip-1.mp4" })
    ).not.toBeInTheDocument();

    expect(fetchMediaListPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaKind: "images",
        folderId: "all_items",
      })
    );

    fireEvent.click(screen.getByRole("tab", { name: "Videos" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select media clip-1.mp4" })).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Select media ref-1.png" })
    ).not.toBeInTheDocument();

    expect(fetchMediaListPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaKind: "videos",
        folderId: "all_items",
      })
    );

    fireEvent.click(screen.getByRole("tab", { name: "Audio" }));
    await waitFor(() => {
      expect(screen.getByText("Audio browsing is not available yet.")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Select media ref-1.png" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Select media clip-1.mp4" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Select prompt Prompt One" })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Prompts" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select prompt Prompt One" })).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Select media ref-1.png" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Select media clip-1.mp4" })
    ).not.toBeInTheDocument();

    expect(fetchMediaPromptListPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        folderId: "all_items",
      })
    );

    fireEvent.click(screen.getByRole("tab", { name: "All Media" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select media ref-1.png" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Select media clip-1.mp4" })).toBeInTheDocument();
    });
  });

  it("normalizes transient network failures when loading prompts", async () => {
    fetchMediaPromptListPageMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select media ref-1.png" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Prompts" }));

    await waitFor(() => {
      expect(
        screen.getByText("Network issue while contacting the Media Library. Please retry.")
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Failed to fetch")).not.toBeInTheDocument();
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

  it("shows folder tile drop highlight for media drag fallback transfer hints", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    const transfer = {
      getData: () => "",
      types: ["text/reference-url", "text/uri-list"],
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
