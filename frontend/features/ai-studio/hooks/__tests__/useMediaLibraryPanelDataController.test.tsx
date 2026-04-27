import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaLibraryPanelDataController } from "../useMediaLibraryPanelDataController";

const fetchMediaListPageMock = vi.hoisted(() => vi.fn());
const fetchMediaPromptListPageMock = vi.hoisted(() => vi.fn());

vi.mock("../../../media-library/logic/mediaListApi", () => ({
  fetchMediaListPage: (...args: unknown[]) => fetchMediaListPageMock(...args),
}));

vi.mock("../../logic/mediaLibraryPanelApi", () => ({
  fetchMediaPromptListPage: (...args: unknown[]) => fetchMediaPromptListPageMock(...args),
}));

vi.mock("../../../media-library/logic/mediaLoadMoreGating", () => ({
  shouldAutoLoadNearBottom: () => false,
}));

vi.mock("../../../media-library/logic/mediaLibraryPageHelpers", () => ({
  mergePageRows: (_existing: unknown[], next: unknown[]) => next,
}));

vi.mock("../../../media-library/runtime", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react");

  return {
    useMediaLibraryPanelRuntime: () => {
      const [error, setError] = ReactModule.useState<string | null>(null);
      const [mediaRows, setMediaRows] = ReactModule.useState<unknown[]>([]);
      const [promptRows, setPromptRows] = ReactModule.useState<unknown[]>([]);
      const [mediaScopeCache, setMediaScopeCache] = ReactModule.useState({
        nextCursor: null,
        hasMore: false,
        loading: false,
        loaded: false,
        error: null,
        loadedAtMs: null,
        resolvedScopeKey: null,
        libraryTotalCount: null,
      });
      const [promptScopeCache, setPromptScopeCache] = ReactModule.useState({
        nextCursor: null,
        hasMore: false,
        loading: false,
        loaded: false,
        error: null,
        loadedAtMs: null,
        resolvedScopeKey: null,
      });
      const setSignedUrls = ReactModule.useRef(vi.fn()).current;

      return {
        error,
        mediaRows,
        mediaScopeCache,
        promptRows,
        promptScopeCache,
        setError,
        setMediaRows,
        setMediaScopeCache,
        setPromptRows,
        setPromptScopeCache,
        setSignedUrls,
      };
    },
  };
});

describe("useMediaLibraryPanelDataController", () => {
  const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
      resolve = nextResolve;
    });
    return { promise, resolve };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMediaListPageMock.mockResolvedValue({
      rows: [],
      nextCursor: null,
      hasMore: false,
      signedById: new Map(),
      libraryTotalCount: 0,
    });
    fetchMediaPromptListPageMock.mockResolvedValue({
      rows: [],
      nextCursor: null,
      hasMore: false,
    });
  });

  it("normalizes transient pending folder ids back to the root folder for data loads", async () => {
    renderHook(() =>
      useMediaLibraryPanelDataController({
        projectId: "project-1",
        activeFolderId: "__pending_new_folder__123",
        itemType: "all",
        normalizedSearch: "",
        shouldShowMedia: true,
        shouldShowPrompts: true,
        showFolderCanvas: false,
        panelBodyRef: { current: null },
      })
    );

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalled();
      expect(fetchMediaPromptListPageMock).toHaveBeenCalled();
    });

    expect(fetchMediaListPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        folderId: "all_items",
        projectId: "project-1",
      })
    );
    expect(fetchMediaPromptListPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        folderId: "all_items",
        projectId: "project-1",
      })
    );
  });

  it("treats project switches as a new unresolved media/prompt scope", async () => {
    const projectOneMedia = createDeferred<{
      rows: never[];
      nextCursor: null;
      hasMore: false;
      signedById: Map<string, string>;
      libraryTotalCount: number;
    }>();
    const projectOnePrompts = createDeferred<{
      rows: never[];
      nextCursor: null;
      hasMore: false;
    }>();

    fetchMediaListPageMock.mockReturnValueOnce(projectOneMedia.promise).mockResolvedValueOnce({
      rows: [],
      nextCursor: null,
      hasMore: false,
      signedById: new Map(),
      libraryTotalCount: 0,
    });
    fetchMediaPromptListPageMock
      .mockReturnValueOnce(projectOnePrompts.promise)
      .mockResolvedValueOnce({
        rows: [],
        nextCursor: null,
        hasMore: false,
      });

    const { result, rerender } = renderHook(
      ({ projectId }) =>
        useMediaLibraryPanelDataController({
          projectId,
          activeFolderId: "all_items",
          itemType: "all",
          normalizedSearch: "",
          shouldShowMedia: true,
          shouldShowPrompts: true,
          showFolderCanvas: false,
          panelBodyRef: { current: null },
        }),
      {
        initialProps: {
          projectId: "project-1",
        },
      }
    );

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: "project-1" })
      );
      expect(fetchMediaPromptListPageMock).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: "project-1" })
      );
    });

    rerender({ projectId: "project-2" });

    expect(result.current.mediaScopeResolved).toBe(false);
    expect(result.current.promptScopeResolved).toBe(false);

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: "project-2" })
      );
      expect(fetchMediaPromptListPageMock).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: "project-2" })
      );
    });

    projectOneMedia.resolve({
      rows: [],
      nextCursor: null,
      hasMore: false,
      signedById: new Map(),
      libraryTotalCount: 0,
    });
    projectOnePrompts.resolve({
      rows: [],
      nextCursor: null,
      hasMore: false,
    });

    await waitFor(() => {
      expect(result.current.mediaScopeResolved).toBe(true);
      expect(result.current.promptScopeResolved).toBe(true);
    });
  });

  it("requests library total count only for new media scopes", async () => {
    const { result } = renderHook(() =>
      useMediaLibraryPanelDataController({
        projectId: "project-1",
        activeFolderId: "all_items",
        itemType: "all",
        normalizedSearch: "",
        shouldShowMedia: true,
        shouldShowPrompts: false,
        showFolderCanvas: false,
        panelBodyRef: { current: null },
      })
    );

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          includeLibraryTotalCount: true,
        })
      );
    });

    fetchMediaListPageMock.mockClear();

    await act(async () => {
      await result.current.loadMediaPage({ reset: true });
    });

    expect(fetchMediaListPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        includeLibraryTotalCount: false,
      })
    );
  });

  it("keeps current media rows visible during same-scope refresh", async () => {
    const refreshDeferred = createDeferred<{
      rows: Array<{ id: string; filename: string; file_type: string; created_at: string }>;
      nextCursor: null;
      hasMore: false;
      signedById: Map<string, string>;
      libraryTotalCount: number;
    }>();

    fetchMediaListPageMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "media-1",
            filename: "cat.png",
            file_type: "image/png",
            created_at: "2026-04-27T00:00:00.000Z",
          },
        ],
        nextCursor: null,
        hasMore: false,
        signedById: new Map(),
        libraryTotalCount: 1,
      })
      .mockReturnValueOnce(refreshDeferred.promise);

    const { result } = renderHook(() =>
      useMediaLibraryPanelDataController({
        projectId: "project-1",
        activeFolderId: "all_items",
        itemType: "all",
        normalizedSearch: "",
        shouldShowMedia: true,
        shouldShowPrompts: false,
        showFolderCanvas: false,
        panelBodyRef: { current: null },
      })
    );

    await waitFor(() => {
      expect(result.current.mediaRows).toHaveLength(1);
      expect(result.current.mediaScopeResolved).toBe(true);
    });

    act(() => {
      void result.current.loadMediaPage({ reset: true });
    });

    await waitFor(() => {
      expect(result.current.mediaLoading).toBe(true);
    });

    expect(result.current.mediaRows).toHaveLength(1);
    expect(result.current.mediaRows[0]?.id).toBe("media-1");
    expect(result.current.mediaScopeResolved).toBe(true);

    refreshDeferred.resolve({
      rows: [
        {
          id: "media-1",
          filename: "cat.png",
          file_type: "image/png",
          created_at: "2026-04-27T00:00:00.000Z",
        },
      ],
      nextCursor: null,
      hasMore: false,
      signedById: new Map(),
      libraryTotalCount: 1,
    });

    await waitFor(() => {
      expect(result.current.mediaLoading).toBe(false);
      expect(result.current.mediaScopeResolved).toBe(true);
    });
  });

  it("uses the minimal media list profile for dedicated image and video tabs", async () => {
    const { rerender } = renderHook(
      ({ itemType }: { itemType: "images" | "videos" }) =>
        useMediaLibraryPanelDataController({
          projectId: "project-1",
          activeFolderId: "all_items",
          itemType,
          normalizedSearch: "",
          shouldShowMedia: true,
          shouldShowPrompts: false,
          showFolderCanvas: false,
          panelBodyRef: { current: null },
        }),
      {
        initialProps: {
          itemType: "images" as "images" | "videos",
        },
      }
    );

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: "minimal",
        })
      );
    });

    fetchMediaListPageMock.mockClear();

    rerender({ itemType: "videos" as const });

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: "minimal",
        })
      );
    });
  });

  it("keeps the expanded media list profile for the mixed all-items tab", async () => {
    renderHook(() =>
      useMediaLibraryPanelDataController({
        projectId: "project-1",
        activeFolderId: "all_items",
        itemType: "all",
        normalizedSearch: "",
        shouldShowMedia: true,
        shouldShowPrompts: false,
        showFolderCanvas: false,
        panelBodyRef: { current: null },
      })
    );

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: "expanded",
        })
      );
    });
  });
});
