import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  appendCursorPageRows: (existing: unknown[], next: unknown[]) => [...existing, ...next],
}));

vi.mock("../../../media-library/runtime", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react");

  return {
    getMediaLibrarySurfaceConfig: () => ({ pageSize: 18 }),
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

  afterEach(() => {
    vi.useRealTimers();
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
    expect(fetchMediaListPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 18,
        surface: "media-library-panel",
      })
    );
  });

  it("normalizes transient pending folder ids back to the root folder for data loads", async () => {
    renderHook(() =>
      useMediaLibraryPanelDataController({
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
      })
    );
    expect(fetchMediaPromptListPageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        folderId: "all_items",
      })
    );
  });

  it("does not reload when transient folder ids change but normalize to the same root scope", async () => {
    const { rerender } = renderHook(
      ({ activeFolderId }) =>
        useMediaLibraryPanelDataController({
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

  it("keeps resolved global media and prompt rows across parent project rerenders", async () => {
    fetchMediaListPageMock.mockResolvedValueOnce({
      rows: [],
      nextCursor: null,
      hasMore: false,
      signedById: new Map(),
      libraryTotalCount: 0,
    });
    fetchMediaPromptListPageMock.mockResolvedValueOnce({
      rows: [],
      nextCursor: null,
      hasMore: false,
    });

    const { result, rerender } = renderHook(
      ({ projectId }: { projectId: string }) => {
        void projectId;
        return useMediaLibraryPanelDataController({
          activeFolderId: "all_items",
          itemType: "all",
          normalizedSearch: "",
          shouldShowMedia: true,
          shouldShowPrompts: true,
          panelBodyRef: { current: null },
        });
      },
      {
        initialProps: {
          projectId: "project-1",
        },
      }
    );

    await waitFor(() => {
      expect(result.current.mediaScopeResolved).toBe(true);
      expect(result.current.promptScopeResolved).toBe(true);
    });

    fetchMediaListPageMock.mockClear();
    fetchMediaPromptListPageMock.mockClear();

    rerender({ projectId: "project-2" });

    expect(result.current.mediaScopeResolved).toBe(true);
    expect(result.current.promptScopeResolved).toBe(true);
    expect(fetchMediaListPageMock).not.toHaveBeenCalled();
    expect(fetchMediaPromptListPageMock).not.toHaveBeenCalled();
  });

  it("defers the root saved-count total until after the primary reset request", async () => {
    const originalRequestIdleCallback = window.requestIdleCallback;
    const originalCancelIdleCallback = window.cancelIdleCallback;
    const requestIdleCallbackMock = vi.fn((callback: IdleRequestCallback) => {
      callback({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    });
    const cancelIdleCallbackMock = vi.fn();
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      writable: true,
      value: requestIdleCallbackMock,
    });
    Object.defineProperty(window, "cancelIdleCallback", {
      configurable: true,
      writable: true,
      value: cancelIdleCallbackMock,
    });

    try {
      fetchMediaListPageMock
        .mockResolvedValueOnce({
          rows: [],
          nextCursor: "cursor-1",
          hasMore: true,
          signedById: new Map(),
          libraryTotalCount: null,
        })
        .mockResolvedValueOnce({
          rows: [],
          nextCursor: null,
          hasMore: false,
          signedById: new Map(),
          libraryTotalCount: 5,
        });

      const { result } = renderHook(() =>
        useMediaLibraryPanelDataController({
          activeFolderId: "all_items",
          itemType: "all",
          normalizedSearch: "",
          shouldShowMedia: true,
          shouldShowPrompts: false,
          panelBodyRef: { current: null },
        })
      );

      await waitFor(() => {
        expect(fetchMediaListPageMock).toHaveBeenCalledTimes(2);
        expect(result.current.libraryTotalCount).toBe(5);
      });

      expect(fetchMediaListPageMock.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          includeLibraryTotalCount: false,
        })
      );
      expect(fetchMediaListPageMock.mock.calls[0]?.[0]).not.toEqual(
        expect.objectContaining({ countOnly: true })
      );
      expect(fetchMediaListPageMock.mock.calls[1]?.[0]).toEqual(
        expect.objectContaining({
          countOnly: true,
          includeLibraryTotalCount: true,
          limit: 1,
        })
      );

      fetchMediaListPageMock.mockClear();
      fetchMediaListPageMock
        .mockResolvedValueOnce({
          rows: [],
          nextCursor: "cursor-2",
          hasMore: true,
          signedById: new Map(),
          libraryTotalCount: null,
        })
        .mockResolvedValueOnce({
          rows: [],
          nextCursor: null,
          hasMore: false,
          signedById: new Map(),
          libraryTotalCount: 6,
        });

      await act(async () => {
        await result.current.loadMediaPage({ reset: true });
      });

      await waitFor(() => {
        expect(fetchMediaListPageMock).toHaveBeenCalledTimes(2);
        expect(result.current.libraryTotalCount).toBe(6);
      });
      expect(fetchMediaListPageMock.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          includeLibraryTotalCount: false,
        })
      );
      expect(fetchMediaListPageMock.mock.calls[1]?.[0]).toEqual(
        expect.objectContaining({
          countOnly: true,
          includeLibraryTotalCount: true,
        })
      );
    } finally {
      Object.defineProperty(window, "requestIdleCallback", {
        configurable: true,
        writable: true,
        value: originalRequestIdleCallback,
      });
      Object.defineProperty(window, "cancelIdleCallback", {
        configurable: true,
        writable: true,
        value: originalCancelIdleCallback,
      });
    }
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

  it("refreshes pending audio companion art rows while the media panel is open", async () => {
    fetchMediaListPageMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "audio-1",
            filename: "tiny-glitch.mp3",
            storage_path: "user-1/generations/audio/audio-1.mp3",
            file_type: "audio/mpeg",
            source: "ai_studio",
            source_ref: "gen-audio-1",
            companion_art_status: "pending",
            companion_art_storage_path: null,
            companion_art_url: null,
            created_at: "2026-06-17T12:00:00.000Z",
          },
        ],
        nextCursor: null,
        hasMore: false,
        signedById: new Map(),
        libraryTotalCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "audio-1",
            filename: "tiny-glitch.mp3",
            storage_path: "user-1/generations/audio/audio-1.mp3",
            file_type: "audio/mpeg",
            source: "ai_studio",
            source_ref: "gen-audio-1",
            companion_art_status: "ready",
            companion_art_storage_path:
              "user-1/generations/audio/gen-audio-1/companion-art/cover.webp",
            companion_art_url: "https://signed.test/gen-audio-1-cover.webp",
            created_at: "2026-06-17T12:00:00.000Z",
          },
        ],
        nextCursor: null,
        hasMore: false,
        signedById: new Map(),
        libraryTotalCount: 1,
      });

    const { result } = renderHook(() =>
      useMediaLibraryPanelDataController({
        activeFolderId: "all_items",
        itemType: "all",
        normalizedSearch: "",
        shouldShowMedia: true,
        shouldShowPrompts: false,
        panelBodyRef: { current: null },
      })
    );

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(result.current.mediaRows[0]?.companion_art_status).toBe("ready");
      expect(result.current.mediaRows[0]?.companion_art_url).toBe(
        "https://signed.test/gen-audio-1-cover.webp"
      );
    });
  });

  it("refreshes ready audio companion art rows that have storage authority but no signed url", async () => {
    fetchMediaListPageMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: "audio-1",
            filename: "energy-boom.mp3",
            storage_path: "user-1/generations/audio/audio-1.mp3",
            file_type: "audio",
            source: "ai_studio",
            source_ref: "gen-audio-1",
            companion_art_status: "ready",
            companion_art_storage_path:
              "user-1/generations/audio/gen-audio-1/companion-art/cover.webp",
            companion_art_url: null,
            created_at: "2026-06-19T22:55:59.000Z",
          },
        ],
        nextCursor: null,
        hasMore: false,
        signedById: new Map(),
        libraryTotalCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "audio-1",
            filename: "energy-boom.mp3",
            storage_path: "user-1/generations/audio/audio-1.mp3",
            file_type: "audio",
            source: "ai_studio",
            source_ref: "gen-audio-1",
            companion_art_status: "ready",
            companion_art_storage_path:
              "user-1/generations/audio/gen-audio-1/companion-art/cover.webp",
            companion_art_url: "https://signed.test/gen-audio-1-cover.webp",
            created_at: "2026-06-19T22:55:59.000Z",
          },
        ],
        nextCursor: null,
        hasMore: false,
        signedById: new Map(),
        libraryTotalCount: 1,
      });

    const { result } = renderHook(() =>
      useMediaLibraryPanelDataController({
        activeFolderId: "all_items",
        itemType: "all",
        normalizedSearch: "",
        shouldShowMedia: true,
        shouldShowPrompts: false,
        panelBodyRef: { current: null },
      })
    );

    await waitFor(() => {
      expect(fetchMediaListPageMock).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(result.current.mediaRows[0]?.companion_art_url).toBe(
        "https://signed.test/gen-audio-1-cover.webp"
      );
    });
  });
});
