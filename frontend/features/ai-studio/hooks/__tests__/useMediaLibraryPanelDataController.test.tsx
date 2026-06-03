import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaLibraryPanelDataController } from "../useMediaLibraryPanelDataController";

const fetchMediaListPageMock = vi.hoisted(() => vi.fn());
const fetchMediaPromptListPageMock = vi.hoisted(() => vi.fn());
const setSignedUrlsMock = vi.hoisted(() => vi.fn());

vi.mock("../../../media-library/logic/mediaListApi", async () => {
  const actual = await vi.importActual<typeof import("../../../media-library/logic/mediaListApi")>(
    "../../../media-library/logic/mediaListApi"
  );

  return {
    ...actual,
    fetchMediaListPage: (...args: unknown[]) => fetchMediaListPageMock(...args),
  };
});

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
      const setSignedUrls = ReactModule.useRef(setSignedUrlsMock).current;

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

  it("applies seeded signed urls returned by the reset page load", async () => {
    const signedById = new Map([["media-1", "https://signed.example/media-1-thumb.png"]]);

    fetchMediaListPageMock.mockResolvedValueOnce({
      rows: [
        {
          id: "media-1",
          storage_path: "user-1/uploads/images/media-1.png",
          file_type: "image/png",
          filename: "media-1.png",
        },
      ],
      nextCursor: null,
      hasMore: false,
      signedById,
      libraryTotalCount: 1,
    });

    renderHook(() =>
      useMediaLibraryPanelDataController({
        projectId: "project-1",
        activeFolderId: "all_items",
        itemType: "all",
        normalizedSearch: "",
        shouldShowMedia: true,
        shouldShowPrompts: false,
        panelBodyRef: { current: null },
      })
    );

    await waitFor(() => {
      expect(setSignedUrlsMock).toHaveBeenCalledWith(signedById);
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

  it("does not reload when transient folder ids change but normalize to the same root scope", async () => {
    const { rerender } = renderHook(
      ({ activeFolderId }) =>
        useMediaLibraryPanelDataController({
          projectId: "project-1",
          activeFolderId,
          itemType: "all",
          normalizedSearch: "",
          shouldShowMedia: true,
          shouldShowPrompts: true,
          panelBodyRef: { current: null },
        }),
      {
        initialProps: {
          activeFolderId: "__pending_new_folder__123",
        },
      }
    );

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
      expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(1);
    });

    fetchMediaListPageMock.mockClear();
    fetchMediaPromptListPageMock.mockClear();

    rerender({ activeFolderId: "__pending_new_folder__456" });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchMediaListPageMock).not.toHaveBeenCalled();
    expect(fetchMediaPromptListPageMock).not.toHaveBeenCalled();
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

  it("loads the root saved-count total on the primary reset request", async () => {
    fetchMediaListPageMock.mockResolvedValueOnce({
      rows: [],
      nextCursor: "cursor-1",
      hasMore: true,
      signedById: new Map(),
      libraryTotalCount: 5,
    });

    const { result } = renderHook(() =>
      useMediaLibraryPanelDataController({
        projectId: "project-1",
        activeFolderId: "all_items",
        itemType: "all",
        normalizedSearch: "",
        shouldShowMedia: true,
        shouldShowPrompts: false,
        panelBodyRef: { current: null },
      })
    );

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          includeLibraryTotalCount: true,
        })
      );
      expect(result.current.libraryTotalCount).toBe(5);
    });

    expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
    expect(fetchMediaListPageMock.mock.calls[0]?.[0]).not.toEqual(
      expect.objectContaining({ countOnly: true })
    );

    fetchMediaListPageMock.mockClear();
    fetchMediaListPageMock.mockResolvedValueOnce({
      rows: [],
      nextCursor: "cursor-2",
      hasMore: true,
      signedById: new Map(),
      libraryTotalCount: 6,
    });

    await act(async () => {
      await result.current.loadMediaPage({ reset: true });
    });

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          includeLibraryTotalCount: true,
        })
      );
    });

    expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
  });

  it("derives library total count from loaded rows when the first page exhausts the scope", async () => {
    fetchMediaListPageMock.mockResolvedValueOnce({
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
      libraryTotalCount: null,
    });

    const { result } = renderHook(() =>
      useMediaLibraryPanelDataController({
        projectId: "project-1",
        activeFolderId: "all_items",
        itemType: "all",
        normalizedSearch: "",
        shouldShowMedia: true,
        shouldShowPrompts: false,
        panelBodyRef: { current: null },
      })
    );

    await waitFor(() => {
      expect(result.current.mediaScopeResolved).toBe(true);
      expect(result.current.libraryTotalCount).toBe(1);
    });

    expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
    expect(fetchMediaListPageMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        countOnly: true,
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

  it("refreshes media and prompts in parallel when both surfaces are active", async () => {
    const refreshMediaDeferred = createDeferred<{
      rows: never[];
      nextCursor: null;
      hasMore: false;
      signedById: Map<string, string>;
      libraryTotalCount: number;
    }>();
    const refreshPromptDeferred = createDeferred<{
      rows: never[];
      nextCursor: null;
      hasMore: false;
    }>();

    fetchMediaListPageMock
      .mockResolvedValueOnce({
        rows: [],
        nextCursor: null,
        hasMore: false,
        signedById: new Map(),
        libraryTotalCount: 0,
      })
      .mockReturnValueOnce(refreshMediaDeferred.promise);
    fetchMediaPromptListPageMock
      .mockResolvedValueOnce({
        rows: [],
        nextCursor: null,
        hasMore: false,
      })
      .mockReturnValueOnce(refreshPromptDeferred.promise);

    const { result } = renderHook(() =>
      useMediaLibraryPanelDataController({
        projectId: "project-1",
        activeFolderId: "all_items",
        itemType: "all",
        normalizedSearch: "",
        shouldShowMedia: true,
        shouldShowPrompts: true,
        panelBodyRef: { current: null },
      })
    );

    await waitFor(() => {
      expect(result.current.mediaScopeResolved).toBe(true);
      expect(result.current.promptScopeResolved).toBe(true);
    });

    fetchMediaListPageMock.mockClear();
    fetchMediaPromptListPageMock.mockClear();

    let refreshPromise: Promise<void> | null = null;
    act(() => {
      refreshPromise = result.current.refreshActiveRows();
    });

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
      expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(1);
    });

    refreshMediaDeferred.resolve({
      rows: [],
      nextCursor: null,
      hasMore: false,
      signedById: new Map(),
      libraryTotalCount: 0,
    });
    refreshPromptDeferred.resolve({
      rows: [],
      nextCursor: null,
      hasMore: false,
    });

    await act(async () => {
      await refreshPromise;
    });
  });

  it("preserves a media load error when prompt refresh succeeds in the same parallel refresh", async () => {
    const refreshPromptDeferred = createDeferred<{
      rows: never[];
      nextCursor: null;
      hasMore: false;
    }>();

    fetchMediaListPageMock
      .mockResolvedValueOnce({
        rows: [],
        nextCursor: null,
        hasMore: false,
        signedById: new Map(),
        libraryTotalCount: 0,
      })
      .mockRejectedValueOnce(new Error("media refresh failed"));
    fetchMediaPromptListPageMock
      .mockResolvedValueOnce({
        rows: [],
        nextCursor: null,
        hasMore: false,
      })
      .mockReturnValueOnce(refreshPromptDeferred.promise);

    const { result } = renderHook(() =>
      useMediaLibraryPanelDataController({
        projectId: "project-1",
        activeFolderId: "all_items",
        itemType: "all",
        normalizedSearch: "",
        shouldShowMedia: true,
        shouldShowPrompts: true,
        panelBodyRef: { current: null },
      })
    );

    await waitFor(() => {
      expect(result.current.mediaScopeResolved).toBe(true);
      expect(result.current.promptScopeResolved).toBe(true);
    });

    let refreshPromise: Promise<void> | null = null;
    act(() => {
      refreshPromise = result.current.refreshActiveRows();
    });

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledTimes(2);
      expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(2);
    });

    refreshPromptDeferred.resolve({
      rows: [],
      nextCursor: null,
      hasMore: false,
    });
    await act(async () => {
      await refreshPromise;
    });

    expect(result.current.error).toBe("media refresh failed");
  });

  it("dedupes overlapping media append requests", async () => {
    const appendDeferred = createDeferred<{
      rows: never[];
      nextCursor: string | null;
      hasMore: boolean;
      signedById: Map<string, string>;
      libraryTotalCount: number;
    }>();

    fetchMediaListPageMock
      .mockResolvedValueOnce({
        rows: [],
        nextCursor: "cursor-1",
        hasMore: true,
        signedById: new Map(),
        libraryTotalCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [],
        nextCursor: null,
        hasMore: false,
        signedById: new Map(),
        libraryTotalCount: 1,
      })
      .mockReturnValueOnce(appendDeferred.promise);

    const { result } = renderHook(() =>
      useMediaLibraryPanelDataController({
        projectId: "project-1",
        activeFolderId: "all_items",
        itemType: "all",
        normalizedSearch: "",
        shouldShowMedia: true,
        shouldShowPrompts: false,
        panelBodyRef: { current: null },
      })
    );

    await waitFor(() => {
      expect(result.current.mediaScopeResolved).toBe(true);
    });

    fetchMediaListPageMock.mockClear();

    let firstAppendPromise: Promise<void> | null = null;
    act(() => {
      firstAppendPromise = result.current.loadMediaPage({ reset: false });
      void result.current.loadMediaPage({ reset: false });
    });

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
    });

    appendDeferred.resolve({
      rows: [],
      nextCursor: null,
      hasMore: false,
      signedById: new Map(),
      libraryTotalCount: 1,
    });

    await act(async () => {
      await firstAppendPromise;
    });
  });

  it("dedupes overlapping prompt append requests", async () => {
    const appendDeferred = createDeferred<{
      rows: never[];
      nextCursor: string | null;
      hasMore: boolean;
    }>();

    fetchMediaPromptListPageMock
      .mockResolvedValueOnce({
        rows: [],
        nextCursor: "cursor-1",
        hasMore: true,
      })
      .mockReturnValueOnce(appendDeferred.promise);

    const { result } = renderHook(() =>
      useMediaLibraryPanelDataController({
        projectId: "project-1",
        activeFolderId: "all_items",
        itemType: "prompts",
        normalizedSearch: "",
        shouldShowMedia: false,
        shouldShowPrompts: true,
        panelBodyRef: { current: null },
      })
    );

    await waitFor(() => {
      expect(result.current.promptScopeResolved).toBe(true);
    });

    fetchMediaPromptListPageMock.mockClear();

    let firstAppendPromise: Promise<void> | null = null;
    act(() => {
      firstAppendPromise = result.current.loadPromptPage({ reset: false });
      void result.current.loadPromptPage({ reset: false });
    });

    await waitFor(() => {
      expect(fetchMediaPromptListPageMock).toHaveBeenCalledTimes(1);
    });

    appendDeferred.resolve({
      rows: [],
      nextCursor: null,
      hasMore: false,
    });

    await act(async () => {
      await firstAppendPromise;
    });
  });

  it("uses the minimal media list profile for images and keeps videos expanded for duration metadata", async () => {
    const { rerender } = renderHook(
      ({ itemType }: { itemType: "images" | "videos" }) =>
        useMediaLibraryPanelDataController({
          projectId: "project-1",
          activeFolderId: "all_items",
          itemType,
          normalizedSearch: "",
          shouldShowMedia: true,
          shouldShowPrompts: false,
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
          profile: "expanded",
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
