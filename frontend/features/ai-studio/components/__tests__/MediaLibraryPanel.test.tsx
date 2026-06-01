import { readFileSync } from "node:fs";
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MEDIA_LIBRARY_PANEL_DENSITY_CONFIG } from "../../../media-library/logic/mediaLibraryRuntimeConfig";
import { ElementsEmbeddedMediaLibraryPanel } from "../ElementsEmbeddedMediaLibraryPanel";
import { MediaLibraryPanel } from "../MediaLibraryPanel";

const listMediaFoldersMock = vi.fn();
const createMediaFolderMock = vi.fn();
const moveMediaFolderMock = vi.fn();
const renameMediaFolderMock = vi.fn();
const deleteMediaFolderMock = vi.fn();
const applyMediaFolderMembershipBatchMock = vi.fn();
const uploadMediaFileMock = vi.fn();
const fetchMediaPromptListPageMock = vi.fn();
const fetchMediaListPageMock = vi.fn();
const mediaGridPropsSpy = vi.fn();
const allItemsGridPropsSpy = vi.fn();
const promptGridPropsSpy = vi.fn();
const storageDownloadMock = vi.fn();
const deleteMediaFileWithStorageMock = vi.fn();
const deleteMediaPromptByIdMock = vi.fn();
const logMediaEventMock = vi.fn();
const isAdaptiveSurfaceEnabledMock = vi.fn();
const useMediaPreviewSigningControllerMock = vi.fn();
const useMediaStorageQuotaSummaryMock = vi.fn();
const requestMediaStorageQuotaSummaryRefreshMock = vi.fn();
const useResolvedProtectedSessionStateMock = vi.fn();
const mediaLibraryPanelStylesheet = readFileSync(
  "styles/ai-studio-media-library-panel.css",
  "utf8"
);

const readCssZIndex = (pattern: RegExp): number => {
  const match = mediaLibraryPanelStylesheet.match(pattern);
  expect(match?.[1]).toBeTruthy();
  return Number(match?.[1]);
};

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const createTransferStore = () => {
  const values = new Map<string, string>();
  const transfer = {
    files: { length: 0, item: () => null } as unknown as FileList,
    types: [] as string[],
    setData(type: string, value: string) {
      values.set(type, value);
      this.types = Array.from(values.keys());
    },
    getData(type: string) {
      return values.get(type) ?? "";
    },
    dropEffect: "none",
    effectAllowed: "none",
  };
  return transfer as unknown as DataTransfer;
};

const createUnreadableTransfer = () =>
  ({
    files: { length: 0, item: () => null } as unknown as FileList,
    types: [] as string[],
    getData: () => "",
    dropEffect: "none",
    effectAllowed: "none",
  }) as unknown as DataTransfer;

vi.mock("../../../../lib/adaptive-media", () => ({
  isAdaptiveSurfaceEnabled: (...args: unknown[]) => isAdaptiveSurfaceEnabledMock(...args),
}));

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: () => ({
    rpc: vi.fn(async () => ({ data: null, error: null })),
    storage: {
      from: () => ({
        download: (...args: unknown[]) => storageDownloadMock(...args),
      }),
    },
  }),
  readSupabaseUserId: async () => "user-1",
  useSupabaseSessionState: () => ({
    user: null,
    session: null,
    loading: false,
  }),
}));

vi.mock("../../../../lib/protectedRouteSessionContext", () => ({
  useResolvedProtectedSessionState: (...args: unknown[]) =>
    useResolvedProtectedSessionStateMock(...args),
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

vi.mock("../../../billing/useMediaStorageQuotaSummary", () => ({
  useMediaStorageQuotaSummary: (...args: unknown[]) => useMediaStorageQuotaSummaryMock(...args),
  requestMediaStorageQuotaSummaryRefresh: (...args: unknown[]) =>
    requestMediaStorageQuotaSummaryRefreshMock(...args),
}));

vi.mock("../../../media-library/hooks/useMediaPreviewRecoveryController", () => ({
  useMediaPreviewRecoveryController: () => ({
    refreshSignedUrl: async () => "https://cdn.example.com/fallback.png",
    handleMediaPreviewError: () => undefined,
  }),
}));

vi.mock("../../../media-library/logic/mediaLibraryDataEffects", async () => {
  const actual = await vi.importActual("../../../media-library/logic/mediaLibraryDataEffects");
  return {
    ...actual,
    deleteMediaFileWithStorage: (...args: unknown[]) => deleteMediaFileWithStorageMock(...args),
    deleteMediaPromptById: (...args: unknown[]) => deleteMediaPromptByIdMock(...args),
    logMediaEvent: (...args: unknown[]) => logMediaEventMock(...args),
  };
});

vi.mock("../../../media-library/logic/mediaListApi", async () => {
  const actual = await vi.importActual<typeof import("../../../media-library/logic/mediaListApi")>(
    "../../../media-library/logic/mediaListApi"
  );

  return {
    ...actual,
    fetchMediaListPage: (...args: unknown[]) => fetchMediaListPageMock(...args),
  };
});

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
    moveMediaFolder: (...args: unknown[]) => moveMediaFolderMock(...args),
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
    selectedIds: Set<string>;
    onSelectMediaFile: (row: { id: string; filename: string }) => void;
    onToggleMediaSelection?: (row: { id: string; filename: string }) => void;
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
    densityConfig?: unknown;
    fixedVisualAspectRatio?: number | null;
  }) => {
    mediaGridPropsSpy(props);
    return (
      <div data-testid="mock-media-grid">
        {props.activeMedia.map((row) => (
          <React.Fragment key={row.id}>
            <button
              type="button"
              onClick={() =>
                props.onToggleMediaSelection
                  ? props.onToggleMediaSelection(row)
                  : props.onSelectMediaFile(row)
              }
            >
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

vi.mock("../media-library-modal/MediaLibraryAllItemsGrid", () => ({
  MediaLibraryAllItemsGrid: (props: {
    mediaRows: Array<{ id: string; filename: string }>;
    promptRows: Array<{ id: string; title: string | null; prompt_text: string }>;
    selectedIds: Set<string>;
    onSelectMediaFile: (row: { id: string; filename: string }) => void;
    onToggleMediaSelection?: (row: { id: string; filename: string }) => void;
    onSelectPromptCard: (row: { id: string; title: string | null; prompt_text: string }) => void;
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
    showRemoveAction?: boolean;
    onRemoveMediaFromFolder?: (row: {
      id: string;
      filename: string;
      signedUrl?: string | null;
    }) => void;
    onRemovePromptFromFolder?: (row: {
      id: string;
      title: string | null;
      prompt_text: string;
    }) => void;
    showDeleteAction?: boolean;
    onDeleteMediaFromLibrary?: (row: {
      id: string;
      filename: string;
      signedUrl?: string | null;
      storage_path?: string;
    }) => void;
    onDeletePromptFromLibrary?: (row: {
      id: string;
      title: string | null;
      prompt_text: string;
    }) => void;
    onMediaContextMenu?: (
      event: React.MouseEvent<HTMLButtonElement>,
      row: { id: string; filename: string; signedUrl?: string | null }
    ) => void;
    densityConfig?: unknown;
    preferVisualMediaFirst?: boolean;
    visualMediaPriorityCount?: number;
    fixedVisualAspectRatio?: number | null;
  }) => {
    allItemsGridPropsSpy(props);
    return (
      <div data-testid="mock-all-items-grid">
        {props.mediaRows.map((row) => (
          <React.Fragment key={row.id}>
            <button
              type="button"
              onClick={() =>
                props.onToggleMediaSelection
                  ? props.onToggleMediaSelection(row)
                  : props.onSelectMediaFile(row)
              }
            >
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
        {props.promptRows.map((row) => (
          <React.Fragment key={row.id}>
            <button type="button" onClick={() => props.onSelectPromptCard(row)}>
              Select prompt {row.title || row.id}
            </button>
            {props.showRemoveAction && props.onRemovePromptFromFolder ? (
              <button type="button" onClick={() => props.onRemovePromptFromFolder?.(row)}>
                Remove prompt {row.title || row.id}
              </button>
            ) : null}
            {props.showDeleteAction && props.onDeletePromptFromLibrary ? (
              <button type="button" onClick={() => props.onDeletePromptFromLibrary?.(row)}>
                Delete prompt {row.title || row.id}
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
  }) => {
    promptGridPropsSpy(props);
    return (
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
    );
  },
}));

describe("MediaLibraryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: { id: "user-1" } },
      user: { id: "user-1" },
    });
    mediaGridPropsSpy.mockReset();
    allItemsGridPropsSpy.mockReset();
    promptGridPropsSpy.mockReset();
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
    useMediaStorageQuotaSummaryMock.mockReturnValue({
      quotaSummary: null,
      loading: false,
      refreshQuotaSummary: vi.fn(),
    });
    requestMediaStorageQuotaSummaryRefreshMock.mockReset();
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
        parentFolderId: null,
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
    createMediaFolderMock.mockImplementation(
      async (name: string, parentFolderId: string | null) => ({
        id: "folder-created",
        name,
        parentFolderId,
        createdAt: "2026-03-03T00:00:00.000Z",
        updatedAt: "2026-03-03T00:00:00.000Z",
      })
    );
    moveMediaFolderMock.mockImplementation(
      async ({
        folderId,
        parentFolderId,
      }: {
        folderId: string;
        parentFolderId: string | null;
      }) => ({
        id: folderId,
        name: "Child A1",
        parentFolderId,
        createdAt: "2026-03-02T00:00:00.000Z",
        updatedAt: "2026-03-04T00:00:00.000Z",
      })
    );
    renameMediaFolderMock.mockImplementation(
      async ({ folderId, name }: { folderId: string; name: string }) => ({
        id: folderId,
        name,
        parentFolderId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-04T00:00:00.000Z",
      })
    );
    deleteMediaFolderMock.mockResolvedValue(undefined);
    applyMediaFolderMembershipBatchMock.mockImplementation(
      async ({
        action,
        folderId,
        sourceFolderId,
        targetFolderId,
        mediaIds,
        promptIds,
      }: {
        action: "assign" | "unassign" | "move";
        folderId?: string;
        sourceFolderId?: string;
        targetFolderId?: string;
        mediaIds: string[];
        promptIds: string[];
      }) => ({
        action,
        folderId: folderId ?? null,
        sourceFolderId: sourceFolderId ?? null,
        targetFolderId: targetFolderId ?? folderId ?? null,
        mediaIds,
        promptIds,
      })
    );
  });

  it("keeps sticky root chrome above selected card shells in the stylesheet", () => {
    const stickyChromeZIndex = readCssZIndex(
      /\.media-library-panel-root-sticky-chrome\s*{[^}]*z-index:\s*(\d+)/s
    );
    const selectedCardShellZIndex = readCssZIndex(
      /\.media-library-panel-media-card-shell\.is-active,\s*\.media-library-panel-prompt-reference-shell\.is-active\s*{[^}]*z-index:\s*(\d+)/s
    );

    expect(stickyChromeZIndex).toBeGreaterThan(selectedCardShellZIndex);
  });

  it("keeps panel density CSS scoped to packed media-library panel grids", () => {
    expect(mediaLibraryPanelStylesheet).toMatch(
      /\.media-library-panel\s+\.media-library-modal-grid\.media-library-modal-grid-packed\.media-library-panel-density-grid:not/
    );
    expect(mediaLibraryPanelStylesheet).toContain(
      "column-count: var(--media-library-panel-density-max-columns);"
    );
    expect(mediaLibraryPanelStylesheet).toContain(
      "column-width: var(--media-library-modal-preview-width);"
    );
    expect(mediaLibraryPanelStylesheet).toMatch(
      /\.media-library-panel\s+\.media-library-modal-grid\.media-library-modal-grid-packed\.media-library-panel-density-grid\.media-library-modal-grid-virtualized/
    );
    expect(mediaLibraryPanelStylesheet).toContain("column-count: auto;");
  });

  it.skip("loads folders + media data and keeps panel click selection free of ingest side effects", async () => {
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
    expect(onSelectPrompt).not.toHaveBeenCalled();

    const latestPromptGridProps = promptGridPropsSpy.mock.calls.at(-1)?.[0] as
      | { selectedIds: Set<string> }
      | undefined;
    expect(latestPromptGridProps?.selectedIds.has("prompt-1")).toBe(true);
  });

  it.skip("shows saved prompts inside the root All Media view", async () => {
    const onSelectPrompt = vi.fn();
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={onSelectPrompt} />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-all-items-grid")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select prompt Prompt One" })).toBeInTheDocument();
    });

    expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
    expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(1);
    const latestProps = allItemsGridPropsSpy.mock.calls.at(-1)?.[0];
    expect(latestProps?.mediaRows).toHaveLength(2);
    expect(latestProps?.promptRows).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Select prompt Prompt One" }));
    expect(onSelectPrompt).not.toHaveBeenCalled();

    const selectedProps = allItemsGridPropsSpy.mock.calls.at(-1)?.[0] as
      | { selectedIds: Set<string> }
      | undefined;
    expect(selectedProps?.selectedIds.has("prompt-1")).toBe(true);
  });

  it("shows folder prompts and media in the same grid without split section headings", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Campaign folder" }));

    await waitFor(() => {
      expect(screen.getByTestId("media-library-panel-active-folder-dropzone")).toBeInTheDocument();
      expect(screen.getByTestId("mock-all-items-grid")).toBeInTheDocument();
    });

    expect(screen.queryByText(/^Prompts \(/)).toBeNull();
    expect(screen.queryByText(/^Media \(/)).toBeNull();

    const latestProps = allItemsGridPropsSpy.mock.calls.at(-1)?.[0];
    expect(latestProps?.mediaRows).toHaveLength(2);
    expect(latestProps?.promptRows).toHaveLength(1);
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

  it("expands the media library layout from the root count row button", async () => {
    const onExpandMediaLibraryPanel = vi.fn();
    render(
      <MediaLibraryPanel
        onSelectMedia={vi.fn()}
        onSelectPrompt={vi.fn()}
        onExpandMediaLibraryPanel={onExpandMediaLibraryPanel}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Campaign")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Expand media library panel" }));

    expect(onExpandMediaLibraryPanel).toHaveBeenCalledTimes(1);
  });

  it("restores the pre-expand folders split when collapsing the expanded media library layout", async () => {
    const ExpandCollapseHarness = () => {
      const [expanded, setExpanded] = React.useState(false);
      return (
        <MediaLibraryPanel
          onSelectMedia={vi.fn()}
          onSelectPrompt={vi.fn()}
          isMediaLibraryPanelExpanded={expanded}
          onExpandMediaLibraryPanel={() => setExpanded(true)}
          onCollapseMediaLibraryPanel={() => setExpanded(false)}
        />
      );
    };

    const { container } = render(<ExpandCollapseHarness />);

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

    fireEvent.pointerDown(divider, {
      pointerId: 202,
      button: 0,
      clientY: 300,
      pointerType: "mouse",
    });
    fireEvent.pointerMove(window, { pointerId: 202, clientY: 420 });
    fireEvent.pointerUp(window, { pointerId: 202, clientY: 420 });

    const resizedRatio = Number(divider.getAttribute("aria-valuenow"));
    expect(resizedRatio).toBeGreaterThan(40);

    fireEvent.click(screen.getByRole("button", { name: "Expand media library panel" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Collapse media library panel" })
      ).toBeInTheDocument();
    });
    const expandedRatio = Number(divider.getAttribute("aria-valuenow"));
    expect(expandedRatio).toBeLessThan(resizedRatio);

    fireEvent.click(screen.getByRole("button", { name: "Collapse media library panel" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Expand media library panel" })
      ).toBeInTheDocument();
    });
    const restoredRatio = Number(divider.getAttribute("aria-valuenow"));
    expect(restoredRatio).toBeCloseTo(resizedRatio, 1);
  });

  it("hides root tab count labels for Images, Videos, and Prompts views", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Campaign")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Images" }));
      await Promise.resolve();
    });
    expect(screen.queryByText(/^Images \(/)).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Videos" }));
      await Promise.resolve();
    });
    expect(screen.queryByText(/^Videos \(/)).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole("tab", { name: "Prompts" }));
      await Promise.resolve();
    });
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
          previewUrl: "https://cdn.example.com/ref-1.png",
          fullUrl: "https://cdn.example.com/ref-1.png",
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

  it.skip("requires confirmation before deleting root media items", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Delete media ref-1.png" })).toBeInTheDocument();
    });
    expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
    expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Delete media ref-1.png" }));
    expect(deleteMediaFileWithStorageMock).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Delete this media?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteMediaFileWithStorageMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: "media-1" })
      );
    });
    expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
    expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(1);
  });

  it("closes the root media delete confirm immediately after confirmation", async () => {
    const deferredDelete = createDeferred<void>();
    deleteMediaFileWithStorageMock.mockImplementationOnce(async () => {
      await deferredDelete.promise;
      return true;
    });

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Delete media ref-1.png" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete media ref-1.png" }));
    expect(screen.getByRole("dialog", { name: "Delete this media?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Delete this media?" })).toBeNull();
    });

    deferredDelete.resolve();

    await waitFor(() => {
      expect(deleteMediaFileWithStorageMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: "media-1" })
      );
    });
  });

  it("cancels root prompt delete when confirmation is dismissed", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    fireEvent.click(screen.getByRole("tab", { name: "Prompts" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Delete prompt Prompt One" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete prompt Prompt One" }));
    expect(deleteMediaPromptByIdMock).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Delete this prompt?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Delete this prompt?" })).toBeNull();
    });
    expect(deleteMediaPromptByIdMock).not.toHaveBeenCalled();
  });

  it("passes panel-specific preview resolver callback to media grid", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-all-items-grid")).toBeInTheDocument();
    });
    const latestProps = allItemsGridPropsSpy.mock.calls.at(-1)?.[0];
    expect(latestProps).toBeTruthy();
    expect(typeof latestProps.resolveCardPreviewUrl).toBe("function");
    expect(latestProps.visibleMediaIdsRef).toBeTruthy();
    expect(latestProps.visibleMediaIdsRef.current).toBeInstanceOf(Set);
    expect(latestProps.densityConfig).toEqual(MEDIA_LIBRARY_PANEL_DENSITY_CONFIG);
  });

  it("passes visible-card signing scope through the embedded Elements all-media grid", async () => {
    render(<ElementsEmbeddedMediaLibraryPanel />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-all-items-grid")).toBeInTheDocument();
    });
    const latestProps = allItemsGridPropsSpy.mock.calls.at(-1)?.[0];
    expect(latestProps).toBeTruthy();
    expect(latestProps.visibleMediaIdsRef).toBeTruthy();
    expect(latestProps.visibleMediaIdsRef.current).toBeInstanceOf(Set);
    expect(latestProps.surface).toBe("elements-media-panel");
    expect(latestProps.densityConfig).toEqual(MEDIA_LIBRARY_PANEL_DENSITY_CONFIG);
    expect(latestProps.preferVisualMediaFirst).toBe(true);
    expect(latestProps.visualMediaPriorityCount).toBe(
      MEDIA_LIBRARY_PANEL_DENSITY_CONFIG.maxColumnCount
    );
    expect(latestProps.fixedVisualAspectRatio).toBeNull();
    const latestSigningArgs = useMediaPreviewSigningControllerMock.mock.calls.at(-1)?.[0];
    expect(latestSigningArgs?.surface).toBe("elements-media-panel");
  });

  it("keeps the embedded Elements all-media grid on true masonry ratios in assignment mode", async () => {
    render(<ElementsEmbeddedMediaLibraryPanel mediaCardInteractionMode="assignment" />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-all-items-grid")).toBeInTheDocument();
    });

    const latestProps = allItemsGridPropsSpy.mock.calls.at(-1)?.[0];
    expect(latestProps?.surface).toBe("elements-media-panel");
    expect(latestProps?.fixedVisualAspectRatio).toBeNull();
  });

  it("keeps the embedded Elements image grid on true masonry ratios in assignment mode", async () => {
    render(<ElementsEmbeddedMediaLibraryPanel mediaCardInteractionMode="assignment" />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Images" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Images" }));

    await waitFor(() => {
      expect(mediaGridPropsSpy).toHaveBeenCalled();
    });
    const latestProps = mediaGridPropsSpy.mock.calls.at(-1)?.[0];
    expect(latestProps?.surface).toBe("elements-media-panel");
    expect(latestProps?.fixedVisualAspectRatio).toBeNull();
  });

  it("passes an explicit fixed visual ratio through the embedded Elements all-media grid", async () => {
    render(
      <ElementsEmbeddedMediaLibraryPanel
        mediaCardInteractionMode="assignment"
        fixedVisualAspectRatio={4 / 5}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-all-items-grid")).toBeInTheDocument();
    });

    const latestProps = allItemsGridPropsSpy.mock.calls.at(-1)?.[0];
    expect(latestProps?.surface).toBe("elements-media-panel");
    expect(latestProps?.fixedVisualAspectRatio).toBe(4 / 5);
  });

  it("passes panel density config to media-only grids", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Images" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "Images" }));

    await waitFor(() => {
      expect(mediaGridPropsSpy).toHaveBeenCalled();
    });
    const latestProps = mediaGridPropsSpy.mock.calls.at(-1)?.[0];
    expect(latestProps?.densityConfig).toEqual(MEDIA_LIBRARY_PANEL_DENSITY_CONFIG);
  });

  it("downshifts the panel signing budget on the mixed all-media root tab", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(useMediaPreviewSigningControllerMock).toHaveBeenCalled();
    });

    const latestArgs = useMediaPreviewSigningControllerMock.mock.calls.at(-1)?.[0];
    expect(latestArgs).toBeTruthy();
    expect(latestArgs.surface).toBe("media-library-panel");
    expect(latestArgs.signBudget).toEqual({
      initialSignLimit: 2,
      prefetchWindow: 3,
      signBatchSize: 2,
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
        expect(screen.getByTestId("mock-all-items-grid")).toBeInTheDocument();
      });
      const latestProps = allItemsGridPropsSpy.mock.calls.at(-1)?.[0];
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
      expect(screen.getByTestId("mock-all-items-grid")).toBeInTheDocument();
    });
    const latestProps = allItemsGridPropsSpy.mock.calls.at(-1)?.[0];
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
      const latestProps = allItemsGridPropsSpy.mock.calls.at(-1)?.[0];
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
      const latestProps = allItemsGridPropsSpy.mock.calls.at(-1)?.[0];
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

  it("bulk moves selected media into a project folder from All Media", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select media ref-1.png" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Select media ref-1.png" }));

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Bulk media actions for 1 selected item" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Move to folder" }));

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: "Move 1 selected media items" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "All Media > Campaign" }));

    await waitFor(() => {
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "assign",
          folderId: "folder-1",
          mediaIds: ["media-1"],
          promptIds: [],
        }),
        null
      );
    });
  });

  it("bulk deletes selected media from All Media after confirmation", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select media ref-1.png" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Select media ref-1.png" }));

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Bulk media actions for 1 selected item" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete from library" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Delete selected items?" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteMediaFileWithStorageMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: "media-1" })
      );
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

  it.skip("renders one global all-media paginator footer and loads the next media page from it", async () => {
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
            id: "prompt-root-1",
            title: "Root Prompt One",
            prompt_text: "Root prompt text",
            mode: "text",
            source: "manual",
            created_at: "2026-03-02T00:00:00.000Z",
            updated_at: "2026-03-02T00:00:00.000Z",
          },
        ],
        nextCursor: null,
        hasMore: false,
      })
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
        rows: [
          {
            id: "prompt-2",
            title: "Prompt Two",
            prompt_text: "Prompt text two",
            mode: "text",
            source: "manual",
            created_at: "2026-03-01T00:00:00.000Z",
            updated_at: "2026-03-01T00:00:00.000Z",
          },
        ],
        nextCursor: null,
        hasMore: false,
      });

    const { container } = render(
      <MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />
    );

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
      expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("tab", { name: "Prompts" }));
    await waitFor(() => {
      expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(2);
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
      expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(3);
    });
  });

  it.skip("shows remove actions only in custom folders and unassigns dropped items", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Campaign")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Remove prompt Prompt One" })).toBeNull();

    fireEvent.doubleClick(screen.getByRole("button", { name: "Campaign folder" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Remove prompt Prompt One" })).toBeInTheDocument();
    });
    expect(fetchMediaListPageMock).toHaveBeenCalledTimes(2);
    expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Remove prompt Prompt One" }));

    await waitFor(() => {
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith(
        {
          folderId: "folder-1",
          action: "unassign",
          mediaIds: [],
          promptIds: ["prompt-1"],
        },
        null
      );
    });
    expect(fetchMediaListPageMock).toHaveBeenCalledTimes(2);
    expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(2);
  });

  it("renders custom folder contents in the normal browse surface", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Campaign")).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Campaign folder" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Select media ref-1.png" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Select prompt Prompt One" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove media ref-1.png" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove prompt Prompt One" })).toBeInTheDocument();
    });
    expect(screen.queryByText("Loading folder canvas...")).not.toBeInTheDocument();
    expect(screen.queryByRole("tablist", { name: "All Media type tabs" })).not.toBeInTheDocument();
  });

  it("does not open a folder on single click", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Campaign folder" }));

    expect(screen.queryByRole("button", { name: "Go to parent folder" })).not.toBeInTheDocument();
    expect(
      document.querySelector(".media-library-panel-folders-breadcrumb-current")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove prompt Prompt One" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
  });

  it("removes custom-folder prompt membership without forcing a list refresh", async () => {
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
    fetchMediaListPageMock.mockResolvedValue(mediaRowsPayload);

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Campaign folder" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Remove prompt Prompt One" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove prompt Prompt One" }));
    await waitFor(() => {
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith(
        {
          folderId: "folder-1",
          action: "unassign",
          mediaIds: [],
          promptIds: ["prompt-1"],
        },
        null
      );
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Remove prompt Prompt One" })
      ).not.toBeInTheDocument();
    });
    expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
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
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith(
        {
          action: "assign",
          folderId: "folder-1",
          mediaIds: ["uploaded-1"],
          promptIds: [],
        },
        null
      );
    });
  });

  it("uploads desktop audio files dropped on a folder tile and assigns them to that folder", async () => {
    uploadMediaFileMock.mockResolvedValueOnce({
      id: "uploaded-audio-1",
      filename: "desktop-drop.mp3",
      storage_path: "user-1/audio/desktop-drop.mp3",
      preview_storage_path: "user-1/audio/desktop-drop.mp3",
      file_type: "audio/mpeg",
      file_size: 256,
      source: "upload",
      created_at: "2026-03-05T00:00:00.000Z",
      signedUrl: "https://cdn.example.com/desktop-drop.mp3",
    });

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    const file = new File(["desktop-audio"], "desktop-drop.mp3", { type: "audio/mpeg" });
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
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith(
        {
          action: "assign",
          folderId: "folder-1",
          mediaIds: ["uploaded-audio-1"],
          promptIds: [],
        },
        null
      );
    });
  });

  it("uploads desktop files dropped on the All Media grid into the library", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("media-library-panel-root-dropzone")).toBeInTheDocument();
    });

    const file = new File(["desktop"], "root-drop.png", { type: "image/png" });
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

    fireEvent.drop(screen.getByTestId("media-library-panel-root-dropzone"), {
      dataTransfer: transfer,
    });

    await waitFor(() => {
      expect(uploadMediaFileMock).toHaveBeenCalledWith({
        file,
        destinationTab: "uploaded_images",
      });
    });

    expect(applyMediaFolderMembershipBatchMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        folderId: "all_items",
      })
    );
  });

  it("uploads desktop audio files dropped on the All Media grid into the library", async () => {
    uploadMediaFileMock.mockResolvedValueOnce({
      id: "uploaded-audio-1",
      filename: "root-drop.mp3",
      storage_path: "user-1/audio/root-drop.mp3",
      preview_storage_path: "user-1/audio/root-drop.mp3",
      file_type: "audio/mpeg",
      file_size: 256,
      source: "upload",
      created_at: "2026-03-05T00:00:00.000Z",
      signedUrl: "https://cdn.example.com/root-drop.mp3",
    });

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("media-library-panel-root-dropzone")).toBeInTheDocument();
    });

    const file = new File(["desktop-audio"], "root-drop.mp3", { type: "audio/mpeg" });
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

    fireEvent.drop(screen.getByTestId("media-library-panel-root-dropzone"), {
      dataTransfer: transfer,
    });

    await waitFor(() => {
      expect(uploadMediaFileMock).toHaveBeenCalledWith({
        file,
        destinationTab: "uploaded_images",
      });
    });
  });

  it("uploads selected files from the Add files button into All Media", async () => {
    const { container } = render(
      <MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add files" })).toBeInTheDocument();
    });

    const input = container.querySelector(
      '.media-library-panel-file-input[type="file"]'
    ) as HTMLInputElement;
    expect(input).toBeTruthy();

    const file = new File(["desktop"], "picker-upload.png", { type: "image/png" });
    fireEvent.change(input, {
      target: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(uploadMediaFileMock).toHaveBeenCalledWith({
        file,
        destinationTab: "uploaded_images",
      });
    });
  });

  it("uploads selected audio files from the Add files button into All Media", async () => {
    uploadMediaFileMock.mockResolvedValueOnce({
      id: "uploaded-audio-1",
      filename: "picker-upload.mp3",
      storage_path: "user-1/audio/picker-upload.mp3",
      preview_storage_path: "user-1/audio/picker-upload.mp3",
      file_type: "audio/mpeg",
      file_size: 256,
      source: "upload",
      created_at: "2026-03-05T00:00:00.000Z",
      signedUrl: "https://cdn.example.com/picker-upload.mp3",
    });

    const { container } = render(
      <MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add files" })).toBeInTheDocument();
    });

    const input = container.querySelector(
      '.media-library-panel-file-input[type="file"]'
    ) as HTMLInputElement;
    expect(input).toBeTruthy();

    const file = new File(["desktop-audio"], "picker-upload.mp3", { type: "audio/mpeg" });
    fireEvent.change(input, {
      target: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(uploadMediaFileMock).toHaveBeenCalledWith({
        file,
        destinationTab: "uploaded_images",
      });
    });
  });

  it("uploads selected audio files into the active project folder from the Add files button", async () => {
    uploadMediaFileMock.mockResolvedValueOnce({
      id: "uploaded-audio-1",
      filename: "folder-picker-upload.mp3",
      storage_path: "user-1/audio/folder-picker-upload.mp3",
      preview_storage_path: "user-1/audio/folder-picker-upload.mp3",
      file_type: "audio/mpeg",
      file_size: 256,
      source: "upload",
      created_at: "2026-03-05T00:00:00.000Z",
      signedUrl: "https://cdn.example.com/folder-picker-upload.mp3",
    });

    const { container } = render(
      <MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Campaign folder" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Remove media ref-1.png" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Add files" })).toBeInTheDocument();

    const input = container.querySelector(
      '.media-library-panel-file-input[type="file"]'
    ) as HTMLInputElement;
    expect(input).toBeTruthy();

    const file = new File(["desktop-audio"], "folder-picker-upload.mp3", { type: "audio/mpeg" });
    fireEvent.change(input, {
      target: {
        files: [file],
      },
    });

    await waitFor(() => {
      expect(uploadMediaFileMock).toHaveBeenCalledWith({
        file,
        destinationTab: "uploaded_images",
      });
    });
    await waitFor(() => {
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith(
        {
          action: "assign",
          folderId: "folder-1",
          mediaIds: ["uploaded-audio-1"],
          promptIds: [],
        },
        null
      );
    });
  });

  it.skip("prioritizes media-library drag payload over transfer files on folder tile drops", async () => {
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
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith(
        {
          action: "assign",
          folderId: "folder-1",
          mediaIds: ["media-1"],
          promptIds: [],
        },
        null
      );
    });
    expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
    expect(uploadMediaFileMock).not.toHaveBeenCalled();
  });

  it.skip("resolves custom-folder contents without empty-state flicker", async () => {
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
    fetchMediaPromptListPageMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "prompt-root-1",
            title: "Root Prompt",
            prompt_text: "Root prompt text",
            mode: "text",
            source: "manual",
            created_at: "2026-03-02T00:00:00.000Z",
            updated_at: "2026-03-02T00:00:00.000Z",
          },
        ],
        nextCursor: null,
        hasMore: false,
      })
      .mockImplementationOnce(() => deferredFolderPromptPage.promise);

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Campaign")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Select media root-ref.png" })).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Campaign folder" }));

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
      expect(
        screen.getByRole("button", { name: "Select media folder-ref.png" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Select prompt Folder Prompt" })
      ).toBeInTheDocument();
    });
  });

  it.skip("switches All Media root tabs between mixed media, image-only, video-only, and prompts", async () => {
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
        {
          id: "media-3",
          filename: "voice-1.mp3",
          storage_path: "user-1/uploads/voice-1.mp3",
          preview_storage_path: "user-1/uploads/voice-1.mp3",
          file_type: "audio/mpeg",
          source: "upload",
          created_at: "2026-03-03T00:00:00.000Z",
          metadata: null,
          signedUrl: "https://cdn.example.com/voice-1.mp3",
        },
      ],
      nextCursor: null,
      hasMore: false,
      signedById: new Map<string, string>(),
      libraryTotalCount: 3,
    });

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("tablist", { name: "All Media type tabs" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "All Media" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Prompts" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Images" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "Videos" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Select media ref-1.png" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Select media clip-1.mp4" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Select media voice-1.mp3" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Select prompt Prompt One" })).toBeInTheDocument();
    });

    expect(fetchMediaListPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaKind: "all",
        folderId: "all_items",
      })
    );
    const latestAllMediaProps = allItemsGridPropsSpy.mock.calls.at(-1)?.[0];
    expect(latestAllMediaProps?.mediaRows.map((row: { id: string }) => row.id)).toEqual([
      "media-3",
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
    expect(
      screen.queryByRole("button", { name: "Select media voice-1.mp3" })
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
    expect(
      screen.queryByRole("button", { name: "Select media voice-1.mp3" })
    ).not.toBeInTheDocument();

    expect(fetchMediaListPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaKind: "videos",
        folderId: "all_items",
      })
    );

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
    expect(
      screen.queryByRole("button", { name: "Select media voice-1.mp3" })
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
      expect(screen.getByRole("button", { name: "Select prompt Prompt One" })).toBeInTheDocument();
    });
  });

  it.skip("normalizes transient network failures when loading prompts", async () => {
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
      expect(createMediaFolderMock).toHaveBeenCalledWith("New Folder", null);
    });
    expect(screen.getByRole("button", { name: "New Folder folder" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("New Folder")).toBeInTheDocument();
  });

  it("shows direct children for the active folder and uses a real breadcrumb path", async () => {
    listMediaFoldersMock.mockResolvedValueOnce([
      {
        id: "folder-root-a",
        name: "Root A",
        parentFolderId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "folder-child-a1",
        name: "Child A1",
        parentFolderId: "folder-root-a",
        createdAt: "2026-03-02T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      },
      {
        id: "folder-child-a2",
        name: "Child A2",
        parentFolderId: "folder-root-a",
        createdAt: "2026-03-03T00:00:00.000Z",
        updatedAt: "2026-03-03T00:00:00.000Z",
      },
      {
        id: "folder-root-b",
        name: "Root B",
        parentFolderId: null,
        createdAt: "2026-03-04T00:00:00.000Z",
        updatedAt: "2026-03-04T00:00:00.000Z",
      },
    ]);

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Root A folder" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Root B folder" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Child A1 folder" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All Media" })).toBeInTheDocument();

    fireEvent.doubleClick(screen.getByRole("button", { name: "Root A folder" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Child A1 folder" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Child A2 folder" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Root A folder" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Root B folder" })).not.toBeInTheDocument();
    expect(
      document.querySelector(".media-library-panel-folders-breadcrumb-current")
    ).toHaveTextContent("Root A");

    fireEvent.click(screen.getAllByRole("button", { name: "All Media" })[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Root A folder" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Root B folder" })).toBeInTheDocument();
    });
  });

  it("opens a move picker and moves a visible child folder to All Media without navigating into it", async () => {
    listMediaFoldersMock.mockResolvedValueOnce([
      {
        id: "folder-parent",
        name: "Parent",
        parentFolderId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "folder-child",
        name: "Child A1",
        parentFolderId: "folder-parent",
        createdAt: "2026-03-02T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      },
    ]);

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Parent folder" })).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Parent folder" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Child A1 folder" })).toBeInTheDocument();
      expect(
        document.querySelector(".media-library-panel-folders-breadcrumb-current")
      ).toHaveTextContent("Parent");
    });

    const folderButton = screen.getByRole("button", { name: "Child A1 folder" });
    const folderTile = folderButton.closest(
      ".media-library-panel-folder-strip-item"
    ) as HTMLElement;
    fireEvent.contextMenu(folderTile);

    expect(
      document.querySelector(".media-library-panel-folders-breadcrumb-current")
    ).toHaveTextContent("Parent");
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to..." }));
    const moveDialog = screen.getByRole("dialog", { name: "Move Child A1" });
    expect(within(moveDialog).getByText("Current parent")).toBeInTheDocument();
    expect(within(moveDialog).getByText("All Media > Parent")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(moveDialog).getByRole("button", { name: "All Media" }));
    });

    await waitFor(() => {
      expect(moveMediaFolderMock).toHaveBeenCalledWith({
        folderId: "folder-child",
        parentFolderId: null,
      });
    });
    expect(screen.queryByRole("button", { name: "Child A1 folder" })).not.toBeInTheDocument();
    expect(
      document.querySelector(".media-library-panel-folders-breadcrumb-current")
    ).toHaveTextContent("Parent");
  });

  it("reparents a visible root folder by dragging it onto another folder tile", async () => {
    listMediaFoldersMock.mockResolvedValueOnce([
      {
        id: "folder-a",
        name: "Root A",
        parentFolderId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "folder-b",
        name: "Root B",
        parentFolderId: null,
        createdAt: "2026-03-02T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      },
    ]);

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Root A folder" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Root B folder" })).toBeInTheDocument();
    });

    const sourceButton = screen.getByRole("button", { name: "Root A folder" });
    const transfer = createTransferStore();
    fireEvent.dragStart(sourceButton, { dataTransfer: transfer });

    const targetTile = screen
      .getByRole("button", { name: "Root B folder" })
      .closest(".media-library-panel-folder-strip-item") as HTMLElement;

    fireEvent.dragOver(targetTile, { dataTransfer: transfer });
    expect(targetTile.classList.contains("is-drop-hover")).toBe(true);

    fireEvent.drop(targetTile, { dataTransfer: transfer });

    await waitFor(() => {
      expect(moveMediaFolderMock).toHaveBeenCalledWith({
        folderId: "folder-a",
        parentFolderId: "folder-b",
      });
    });
    expect(screen.queryByRole("button", { name: "Root A folder" })).not.toBeInTheDocument();
  });

  it("reparents a visible root folder when dragging from the folder name", async () => {
    listMediaFoldersMock.mockResolvedValueOnce([
      {
        id: "folder-a",
        name: "Root A",
        parentFolderId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "folder-b",
        name: "Root B",
        parentFolderId: null,
        createdAt: "2026-03-02T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      },
    ]);

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Root A name" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Root B folder" })).toBeInTheDocument();
    });

    const sourceButton = screen.getByRole("button", { name: "Root A name" });
    const transfer = createTransferStore();
    fireEvent.dragStart(sourceButton, { dataTransfer: transfer });

    const targetTile = screen
      .getByRole("button", { name: "Root B folder" })
      .closest(".media-library-panel-folder-strip-item") as HTMLElement;

    fireEvent.dragOver(targetTile, { dataTransfer: transfer });
    expect(targetTile.classList.contains("is-drop-hover")).toBe(true);

    fireEvent.drop(targetTile, { dataTransfer: transfer });

    await waitFor(() => {
      expect(moveMediaFolderMock).toHaveBeenCalledWith({
        folderId: "folder-a",
        parentFolderId: "folder-b",
      });
    });
    expect(screen.queryByRole("button", { name: "Root A folder" })).not.toBeInTheDocument();
  });

  it("reparents a visible root folder even when dragover transfer data is unreadable after drag start", async () => {
    listMediaFoldersMock.mockResolvedValueOnce([
      {
        id: "folder-a",
        name: "Root A",
        parentFolderId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "folder-b",
        name: "Root B",
        parentFolderId: null,
        createdAt: "2026-03-02T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      },
    ]);

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Root A folder" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Root B folder" })).toBeInTheDocument();
    });

    const sourceButton = screen.getByRole("button", { name: "Root A folder" });
    fireEvent.dragStart(sourceButton, { dataTransfer: createTransferStore() });

    const degradedTransfer = createUnreadableTransfer();
    const targetTile = screen
      .getByRole("button", { name: "Root B folder" })
      .closest(".media-library-panel-folder-strip-item") as HTMLElement;

    fireEvent.dragOver(targetTile, { dataTransfer: degradedTransfer });
    expect(targetTile.classList.contains("is-drop-hover")).toBe(true);

    fireEvent.drop(targetTile, { dataTransfer: degradedTransfer });

    await waitFor(() => {
      expect(moveMediaFolderMock).toHaveBeenCalledWith({
        folderId: "folder-a",
        parentFolderId: "folder-b",
      });
    });
  });

  it("reparents a visible folder to root by dropping it on the All Media breadcrumb", async () => {
    listMediaFoldersMock.mockResolvedValueOnce([
      {
        id: "folder-parent",
        name: "Parent",
        parentFolderId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "folder-child",
        name: "Child A1",
        parentFolderId: "folder-parent",
        createdAt: "2026-03-02T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      },
    ]);

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Parent folder" })).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Parent folder" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Child A1 folder" })).toBeInTheDocument();
    });

    const transfer = createTransferStore();
    fireEvent.dragStart(screen.getByRole("button", { name: "Child A1 folder" }), {
      dataTransfer: transfer,
    });

    const allMediaButton = screen.getAllByRole("button", { name: "All Media" })[0];
    fireEvent.dragOver(allMediaButton, { dataTransfer: transfer });
    expect(allMediaButton.classList.contains("is-drop-hover")).toBe(true);

    fireEvent.drop(allMediaButton, { dataTransfer: transfer });

    await waitFor(() => {
      expect(moveMediaFolderMock).toHaveBeenCalledWith({
        folderId: "folder-child",
        parentFolderId: null,
      });
    });
  });

  it("shows sorted deep move destinations and excludes the current parent and descendants", async () => {
    listMediaFoldersMock.mockResolvedValueOnce([
      {
        id: "folder-a",
        name: "A",
        parentFolderId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "folder-b",
        name: "B",
        parentFolderId: "folder-a",
        createdAt: "2026-03-02T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      },
      {
        id: "folder-c",
        name: "C",
        parentFolderId: "folder-b",
        createdAt: "2026-03-03T00:00:00.000Z",
        updatedAt: "2026-03-03T00:00:00.000Z",
      },
      {
        id: "folder-d",
        name: "D",
        parentFolderId: null,
        createdAt: "2026-03-04T00:00:00.000Z",
        updatedAt: "2026-03-04T00:00:00.000Z",
      },
    ]);

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "A folder" })).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "A folder" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "B folder" })).toBeInTheDocument();
    });

    const folderButton = screen.getByRole("button", { name: "B folder" });
    const folderTile = folderButton.closest(
      ".media-library-panel-folder-strip-item"
    ) as HTMLElement;
    fireEvent.contextMenu(folderTile);
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to..." }));

    const moveDialog = screen.getByRole("dialog", { name: "Move B" });
    expect(within(moveDialog).getByText("All Media > A")).toBeInTheDocument();
    const moveButtons = within(moveDialog).getAllByRole("button");
    expect(moveButtons[0]).toHaveTextContent("All Media");
    expect(within(moveDialog).getByRole("button", { name: "All Media > D" })).toBeInTheDocument();
    expect(
      within(moveDialog).queryByRole("button", { name: "All Media > A" })
    ).not.toBeInTheDocument();
    expect(
      within(moveDialog).queryByRole("button", { name: "All Media > A > B > C" })
    ).not.toBeInTheDocument();
  });

  it("creates a new folder inside the active folder", async () => {
    listMediaFoldersMock.mockResolvedValueOnce([
      {
        id: "folder-parent",
        name: "Parent",
        parentFolderId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
    ]);

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Parent folder" })).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Parent folder" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Go to parent folder" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Create new folder" }));

    await waitFor(() => {
      expect(createMediaFolderMock).toHaveBeenCalledWith("New Folder", "folder-parent");
    });
    expect(screen.getByDisplayValue("New Folder")).toBeInTheDocument();
    expect(
      document.querySelector(".media-library-panel-folders-breadcrumb-current")
    ).toHaveTextContent("Parent");
    expect(screen.queryByRole("button", { name: "New Folder" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to parent folder" })).toBeInTheDocument();
  });

  it("creates a new subfolder from the folder context menu inside the clicked folder", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    fireEvent.contextMenu(screen.getByRole("button", { name: "Campaign folder" }), {
      clientX: 120,
      clientY: 220,
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "New subfolder" }));
    });

    await waitFor(() => {
      expect(createMediaFolderMock).toHaveBeenCalledWith("New Folder", "folder-1");
    });
    expect(screen.getByDisplayValue("New Folder")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to parent folder" })).toBeInTheDocument();
    const currentCrumb = document.querySelector(".media-library-panel-folders-breadcrumb-current");
    expect(currentCrumb).toHaveTextContent("Campaign");
  });

  it("keeps parent folders hidden when renaming a child folder from its parent view", async () => {
    listMediaFoldersMock.mockResolvedValueOnce([
      {
        id: "folder-parent",
        name: "Parent",
        parentFolderId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "folder-child",
        name: "Child",
        parentFolderId: "folder-parent",
        createdAt: "2026-03-02T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      },
    ]);

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Parent folder" })).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Parent folder" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Child folder" })).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Child name" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Child")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Parent folder" })).not.toBeInTheDocument();
    expect(
      document.querySelector(".media-library-panel-folders-breadcrumb-current")
    ).toHaveTextContent("Parent");
  });

  it("renders the current breadcrumb segment as a non-clickable location indicator", async () => {
    listMediaFoldersMock.mockResolvedValueOnce([
      {
        id: "folder-parent",
        name: "Parent",
        parentFolderId: null,
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-01T00:00:00.000Z",
      },
      {
        id: "folder-child",
        name: "Child",
        parentFolderId: "folder-parent",
        createdAt: "2026-03-02T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      },
    ]);

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Parent folder" })).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Parent folder" }));
    await waitFor(() => {
      expect(
        document.querySelector(".media-library-panel-folders-breadcrumb-current")
      ).toHaveTextContent("Parent");
    });

    expect(screen.getByRole("button", { name: "All Media" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Parent" })).not.toBeInTheDocument();
    const currentCrumb = document.querySelector(".media-library-panel-folders-breadcrumb-current");
    expect(currentCrumb).toHaveAttribute("aria-current", "location");
    expect(currentCrumb).toHaveTextContent("Parent");
  });

  it("shows one actionable empty state when a custom folder has no media or prompts", async () => {
    fetchMediaListPageMock.mockResolvedValue({
      rows: [],
      nextCursor: null,
      hasMore: false,
      signedById: new Map<string, string>(),
      libraryTotalCount: null,
    });
    fetchMediaPromptListPageMock.mockResolvedValue({
      rows: [],
      nextCursor: null,
      hasMore: false,
    });

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Campaign folder" }));

    await waitFor(() => {
      expect(screen.getByText('No media to display in "Campaign."')).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Create subfolder" })).not.toBeInTheDocument();
    expect(screen.queryByText("No prompts found for this folder.")).not.toBeInTheDocument();
    expect(screen.queryByText("No media found for this folder.")).not.toBeInTheDocument();
  });

  it("retries with an incremented folder name when the default collides", async () => {
    createMediaFolderMock
      .mockRejectedValueOnce(new Error("Folder name already exists"))
      .mockImplementationOnce(async (name: string, parentFolderId: string | null) => ({
        id: "folder-created-2",
        name,
        parentFolderId,
        createdAt: "2026-03-03T00:00:00.000Z",
        updatedAt: "2026-03-03T00:00:00.000Z",
      }));

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Create new folder" }));

    await waitFor(() => {
      expect(createMediaFolderMock).toHaveBeenNthCalledWith(1, "New Folder", null);
      expect(createMediaFolderMock).toHaveBeenNthCalledWith(2, "New Folder 2", null);
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
    fireEvent.change(screen.getByPlaceholderText("Campaign"), {
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
    expect(screen.getAllByText("Campaign Assets")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Rename active folder" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete active folder" })).not.toBeInTheDocument();
  });

  it("opens a folder from a single click on the folder name", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign name" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Campaign name" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Go to parent folder" })).toBeInTheDocument();
    });
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

  it("repositions the folder context menu upward when its measured height would overflow the viewport", async () => {
    const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains("media-library-panel-folder-context-menu")) {
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 156,
            bottom: 160,
            width: 156,
            height: 160,
            toJSON: () => ({}),
          } as DOMRect;
        }
        return originalGetBoundingClientRect.call(this);
      });

    try {
      render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.contextMenu(screen.getByRole("button", { name: "Campaign folder" }), {
          clientX: 120,
          clientY: window.innerHeight - 8,
        });
      });

      const menu = screen.getByRole("menu", { name: "Campaign folder actions" });

      await waitFor(() => {
        expect(menu).toHaveStyle({
          top: `${window.innerHeight - 160 - 10}px`,
          left: "120px",
        });
      });
    } finally {
      rectSpy.mockRestore();
    }
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

  it("disables native image dragging on folder artwork while keeping the folder artwork and name draggable", async () => {
    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Campaign name" })).toBeInTheDocument();
    });

    const folderButton = screen.getByRole("button", { name: "Campaign folder" });
    const folderNameButton = screen.getByRole("button", { name: "Campaign name" });
    const folderImage = folderButton.querySelector("img");

    expect(folderButton).toHaveAttribute("draggable", "true");
    expect(folderNameButton).toHaveAttribute("draggable", "true");
    expect(folderImage).toHaveAttribute("draggable", "false");
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
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith(
        {
          action: "assign",
          folderId: "folder-1",
          mediaIds: [],
          promptIds: ["prompt-1"],
        },
        null
      );
    });
  });

  it("assigns dropped internal media references from the reference grid to a folder tile", async () => {
    const resolveInternalDropItem = vi.fn().mockResolvedValue({
      kind: "media",
      id: "media-77",
    });

    render(
      <MediaLibraryPanel
        onSelectMedia={vi.fn()}
        onSelectPrompt={vi.fn()}
        resolveInternalDropItem={resolveInternalDropItem}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    const folderButton = screen.getByRole("button", { name: "Campaign folder" });
    const folderTile = folderButton.closest(
      ".media-library-panel-folder-strip-item"
    ) as HTMLElement;
    expect(folderTile).toBeTruthy();

    const transfer = {
      types: ["text/reference-origin", "text/reference-output-id", "text/reference-source-surface"],
      getData: (type: string) => {
        switch (type) {
          case "text/reference-origin":
            return "ai-studio-reference-grid";
          case "text/reference-output-id":
            return "output-1";
          case "text/reference-source-surface":
            return "all-refs";
          default:
            return "";
        }
      },
      dropEffect: "none",
      effectAllowed: "copy",
    } as unknown as DataTransfer;

    fireEvent.drop(folderTile, { dataTransfer: transfer });

    await waitFor(() => {
      expect(resolveInternalDropItem).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: "ai-studio-reference-grid",
          outputId: "output-1",
          sourceSurface: "all-refs",
        })
      );
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith(
        {
          action: "assign",
          folderId: "folder-1",
          mediaIds: ["media-77"],
          promptIds: [],
        },
        null
      );
    });
  });

  it("saves dropped internal media references from the reference grid into root All Media", async () => {
    const resolveInternalDropItem = vi.fn().mockResolvedValue({
      kind: "media",
      id: "media-88",
    });

    render(
      <MediaLibraryPanel
        onSelectMedia={vi.fn()}
        onSelectPrompt={vi.fn()}
        resolveInternalDropItem={resolveInternalDropItem}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("media-library-panel-root-dropzone")).toBeInTheDocument();
    });

    const callsBeforeDrop = fetchMediaListPageMock.mock.calls.length;
    const transfer = {
      types: ["text/reference-origin", "text/reference-output-id", "text/reference-source-surface"],
      getData: (type: string) => {
        switch (type) {
          case "text/reference-origin":
            return "ai-studio-reference-grid";
          case "text/reference-output-id":
            return "output-audio-1";
          case "text/reference-source-surface":
            return "all-refs";
          default:
            return "";
        }
      },
      dropEffect: "none",
      effectAllowed: "copy",
    } as unknown as DataTransfer;

    fireEvent.drop(screen.getByTestId("media-library-panel-root-dropzone"), {
      dataTransfer: transfer,
    });

    await waitFor(() => {
      expect(resolveInternalDropItem).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: "ai-studio-reference-grid",
          outputId: "output-audio-1",
          sourceSurface: "all-refs",
        })
      );
    });
    await waitFor(() => {
      expect(fetchMediaListPageMock.mock.calls.length).toBeGreaterThan(callsBeforeDrop);
    });
    expect(applyMediaFolderMembershipBatchMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        action: "assign",
      }),
      null
    );
  });

  it("assigns dropped internal prompt references from the reference grid to a folder tile", async () => {
    const resolveInternalDropItem = vi.fn().mockResolvedValue({
      kind: "prompt",
      id: "prompt-77",
    });

    render(
      <MediaLibraryPanel
        onSelectMedia={vi.fn()}
        onSelectPrompt={vi.fn()}
        resolveInternalDropItem={resolveInternalDropItem}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    const folderButton = screen.getByRole("button", { name: "Campaign folder" });
    const folderTile = folderButton.closest(
      ".media-library-panel-folder-strip-item"
    ) as HTMLElement;
    expect(folderTile).toBeTruthy();

    const transfer = {
      types: ["text/reference-origin", "text/reference-output-id", "text/reference-source-surface"],
      getData: (type: string) => {
        switch (type) {
          case "text/reference-origin":
            return "ai-studio-reference-grid";
          case "text/reference-output-id":
            return "output-2";
          case "text/reference-source-surface":
            return "all-refs";
          default:
            return "";
        }
      },
      dropEffect: "none",
      effectAllowed: "copy",
    } as unknown as DataTransfer;

    fireEvent.drop(folderTile, { dataTransfer: transfer });

    await waitFor(() => {
      expect(resolveInternalDropItem).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: "ai-studio-reference-grid",
          outputId: "output-2",
          sourceSurface: "all-refs",
        })
      );
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith(
        {
          action: "assign",
          folderId: "folder-1",
          mediaIds: [],
          promptIds: ["prompt-77"],
        },
        null
      );
    });
  });

  it("shows immediate spinner feedback while a folder drop is resolving", async () => {
    const deferred = createDeferred<{ kind: "media"; id: string } | null>();
    const resolveInternalDropItem = vi.fn().mockReturnValue(deferred.promise);

    render(
      <MediaLibraryPanel
        onSelectMedia={vi.fn()}
        onSelectPrompt={vi.fn()}
        resolveInternalDropItem={resolveInternalDropItem}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    const folderButton = screen.getByRole("button", { name: "Campaign folder" });
    const folderTile = folderButton.closest(
      ".media-library-panel-folder-strip-item"
    ) as HTMLElement;
    expect(folderTile).toBeTruthy();

    const transfer = {
      types: ["text/reference-origin", "text/reference-output-id", "text/reference-source-surface"],
      getData: (type: string) => {
        switch (type) {
          case "text/reference-origin":
            return "ai-studio-reference-grid";
          case "text/reference-output-id":
            return "output-3";
          case "text/reference-source-surface":
            return "all-refs";
          default:
            return "";
        }
      },
      dropEffect: "none",
      effectAllowed: "copy",
    } as unknown as DataTransfer;

    fireEvent.drop(folderTile, { dataTransfer: transfer });

    await waitFor(() => {
      expect(screen.getByText("Adding to Campaign...")).toBeInTheDocument();
      expect(document.querySelector(".media-library-panel-membership-spinner")).toBeTruthy();
    });

    deferred.resolve({ kind: "media", id: "media-88" });

    await waitFor(() => {
      expect(screen.queryByText("Adding to Campaign...")).not.toBeInTheDocument();
      expect(screen.getByText("Added to Campaign.")).toBeInTheDocument();
    });
  });

  it("drops internal references into the active custom folder and refreshes its rows", async () => {
    const resolveInternalDropItem = vi.fn().mockResolvedValue({
      kind: "media",
      id: "media-99",
    });

    render(
      <MediaLibraryPanel
        onSelectMedia={vi.fn()}
        onSelectPrompt={vi.fn()}
        resolveInternalDropItem={resolveInternalDropItem}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Campaign folder" })).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByRole("button", { name: "Campaign folder" }));

    await waitFor(() => {
      expect(screen.getByTestId("media-library-panel-active-folder-dropzone")).toBeInTheDocument();
    });

    const callsBeforeDrop = fetchMediaListPageMock.mock.calls.length;
    const dropzone = screen.getByTestId("media-library-panel-active-folder-dropzone");
    const transfer = {
      types: ["text/reference-origin", "text/reference-output-id", "text/reference-source-surface"],
      getData: (type: string) => {
        switch (type) {
          case "text/reference-origin":
            return "ai-studio-reference-grid";
          case "text/reference-output-id":
            return "output-1";
          case "text/reference-source-surface":
            return "all-refs";
          default:
            return "";
        }
      },
      dropEffect: "none",
      effectAllowed: "copy",
    } as unknown as DataTransfer;

    fireEvent.drop(dropzone, { dataTransfer: transfer });

    await waitFor(() => {
      expect(resolveInternalDropItem).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: "ai-studio-reference-grid",
          outputId: "output-1",
          sourceSurface: "all-refs",
        })
      );
      expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith(
        {
          action: "assign",
          folderId: "folder-1",
          mediaIds: ["media-99"],
          promptIds: [],
        },
        null
      );
      expect(fetchMediaListPageMock.mock.calls.length).toBeGreaterThan(callsBeforeDrop);
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

  it("shows a storage-full banner and disables uploads when quota is already over limit", async () => {
    useMediaStorageQuotaSummaryMock.mockReturnValue({
      quotaSummary: {
        usedBytes: 10,
        baseLimitBytes: 5,
        addonLimitBytes: 0,
        totalLimitBytes: 5,
        remainingBytes: 0,
        isOverLimit: true,
      },
      loading: false,
      refreshQuotaSummary: vi.fn(),
    });

    render(<MediaLibraryPanel onSelectMedia={vi.fn()} onSelectPrompt={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Your media storage is full\./i)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Manage storage" })).toHaveAttribute(
      "href",
      "/profile?section=storage"
    );
    expect(screen.getByRole("button", { name: "Add files" })).toBeDisabled();
  });
});
