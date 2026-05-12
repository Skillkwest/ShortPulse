import { act, renderHook, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaTabDataController } from "../useMediaTabDataController";
import { fetchMediaListPage } from "../../logic/mediaListApi";
import { resolveMediaSigningStoragePaths } from "../../../../lib/mediaPreviewPath";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../../lib/supabaseClient";
import {
  createMediaTabCacheState,
  createMediaTabRequestState,
} from "../../logic/mediaLibraryPageHelpers";

vi.mock("../../../../lib/mediaPreviewPath", () => ({
  classifyMediaPreviewPath: vi.fn(() => "unknown"),
  resolveMediaSigningStoragePaths: vi.fn(),
  resolvePreferredMediaSigningStoragePath: vi.fn(
    (row: { storage_path?: string | null }) => row.storage_path ?? null
  ),
}));

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: vi.fn(),
  readSupabaseUserId: vi.fn(),
}));

vi.mock("../../logic/mediaListApi", () => ({
  fetchMediaListPage: vi.fn(async () => null),
}));

const fetchMediaListPageMock = vi.mocked(fetchMediaListPage);
const resolveMediaSigningStoragePathsMock = vi.mocked(resolveMediaSigningStoragePaths);
const ensureSupabaseQueryClientMock = vi.mocked(ensureSupabaseQueryClient);
const readSupabaseUserIdMock = vi.mocked(readSupabaseUserId);

type Row = {
  id: string;
  filename: string;
  storage_path: string;
  source?: string | null;
  file_type: string;
  created_at: string;
  signedUrl?: string;
  preview_storage_path?: string;
  metadata?: Record<string, unknown> | null;
};

type Prompt = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode: string;
  source: string;
  created_at: string;
  updated_at: string;
};

const makeRow = (overrides: Partial<Row> = {}): Row => ({
  id: "row-1",
  filename: "asset.png",
  storage_path: "user-1/images/asset.png",
  file_type: "image/png",
  source: "upload",
  created_at: "2026-02-14T00:00:00.000Z",
  ...overrides,
});

const makePrompt = (overrides: Partial<Prompt> = {}): Prompt => ({
  id: "prompt-1",
  title: "Prompt title",
  prompt_text: "Prompt body",
  mode: "reference",
  source: "user",
  created_at: "2026-02-14T00:00:00.000Z",
  updated_at: "2026-02-14T00:00:00.000Z",
  ...overrides,
});

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("useMediaTabDataController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
    fetchMediaListPageMock.mockResolvedValue({
      rows: [],
      nextCursor: null,
      hasMore: false,
      signedById: new Map(),
    });
    resolveMediaSigningStoragePathsMock.mockImplementation(
      (row: { storage_path?: string | null }) => [row.storage_path ?? ""]
    );
  });

  it("syncs active cache rows directly from the visible media rows", () => {
    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([
        makeRow({ id: "cat", filename: "cat.png", storage_path: "user-1/images/cat.png" }),
      ]);
      const [prompts, setPrompts] = useState<Prompt[]>([]);
      const [promptsLoaded, setPromptsLoaded] = useState(true);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);
      const [mediaTabCache, setMediaTabCache] = useState(() => {
        const cache = createMediaTabCacheState<Row>();
        cache.uploaded_images = {
          ...cache.uploaded_images,
          rows: [
            makeRow({ id: "cat", filename: "cat.png", storage_path: "user-1/images/cat.png" }),
          ],
          query: "cat",
          loaded: true,
          loadedAtMs: Date.now(),
        };
        return cache;
      });
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("saved_prompts");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      const tabData = useMediaTabDataController<Row, Prompt>({
        activeMediaCache: mediaTabCache.uploaded_images,
        activeMediaQuery: "cat",
        activeMediaTab: "uploaded_images",
        activeTab: "saved_prompts",
        activeTabRef,
        cacheTtlMs: 30_000,
        surface: "media-library-route",
        currentUserIdRef,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 60,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        error,
        files,
        loading,
        mediaTabCache,
        prompts,
        tabData,
      };
    });

    act(() => {
      result.current.tabData.updateVisibleRows((prev) => [
        ...prev,
        makeRow({ id: "new", filename: "new-cat.png", storage_path: "user-1/images/new-cat.png" }),
      ]);
    });

    expect(result.current.files.map((row) => row.id)).toEqual(["cat", "new"]);
    expect(result.current.mediaTabCache.uploaded_images.rows.map((row) => row.id)).toEqual([
      "cat",
      "new",
    ]);
  });

  it("keeps visible rows and active cache stable when an update returns equivalent rows", () => {
    const seededRows = [
      makeRow({
        id: "cat",
        filename: "cat.png",
        storage_path: "user-1/images/cat.png",
        metadata: { dimensions: { width: 100, height: 100 } },
      }),
    ];

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>(seededRows);
      const [prompts, setPrompts] = useState<Prompt[]>([]);
      const [promptsLoaded, setPromptsLoaded] = useState(true);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);
      const [mediaTabCache, setMediaTabCache] = useState(() => {
        const cache = createMediaTabCacheState<Row>();
        cache.uploaded_images = {
          ...cache.uploaded_images,
          rows: seededRows,
          query: "cat",
          loaded: true,
          loadedAtMs: Date.now(),
        };
        return cache;
      });
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("saved_prompts");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      const tabData = useMediaTabDataController<Row, Prompt>({
        activeMediaCache: mediaTabCache.uploaded_images,
        activeMediaQuery: "cat",
        activeMediaTab: "uploaded_images",
        activeTab: "saved_prompts",
        activeTabRef,
        cacheTtlMs: 30_000,
        surface: "media-library-route",
        currentUserIdRef,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 60,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        files,
        mediaTabCache,
        tabData,
      };
    });

    act(() => {
      result.current.tabData.updateVisibleRows((prev) =>
        prev.map((row) => ({
          ...row,
          metadata: row.metadata ? { ...row.metadata } : row.metadata,
        }))
      );
    });

    expect(result.current.files).toBe(seededRows);
    expect(result.current.mediaTabCache.uploaded_images.rows).toBe(seededRows);
  });

  it("marks non-active tab caches stale", () => {
    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([]);
      const [prompts, setPrompts] = useState<Prompt[]>([]);
      const [promptsLoaded, setPromptsLoaded] = useState(true);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);
      const [mediaTabCache, setMediaTabCache] = useState(() => {
        const cache = createMediaTabCacheState<Row>();
        cache.uploaded_images = {
          ...cache.uploaded_images,
          loadedAtMs: 1,
          loaded: true,
        };
        cache.uploaded_videos = {
          ...cache.uploaded_videos,
          loadedAtMs: 2,
          loaded: true,
        };
        cache.private = {
          ...cache.private,
          loadedAtMs: 3,
          loaded: true,
        };
        cache.ai_generations = {
          ...cache.ai_generations,
          loadedAtMs: 4,
          loaded: true,
        };
        return cache;
      });
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("saved_prompts");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      const tabData = useMediaTabDataController<Row, Prompt>({
        activeMediaCache: mediaTabCache.private,
        activeMediaQuery: "",
        activeMediaTab: "private",
        activeTab: "saved_prompts",
        activeTabRef,
        cacheTtlMs: 30_000,
        surface: "media-library-route",
        currentUserIdRef,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 60,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        error,
        files,
        loading,
        mediaTabCache,
        prompts,
        tabData,
      };
    });

    act(() => {
      result.current.tabData.markInactiveMediaCachesStale("private");
    });

    expect(result.current.mediaTabCache.private.loadedAtMs).toBe(3);
    expect(result.current.mediaTabCache.uploaded_images.loadedAtMs).toBeNull();
    expect(result.current.mediaTabCache.uploaded_videos.loadedAtMs).toBeNull();
    expect(result.current.mediaTabCache.ai_generations.loadedAtMs).toBeNull();
  });

  it("keeps prompt rows stable when a prompt refresh returns identical ordered rows", async () => {
    const seededPrompts = [makePrompt()];
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "media_prompts") {
          throw new Error(`Unexpected table: ${table}`);
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn(async () => ({ data: seededPrompts, error: null })),
              }),
            }),
          })),
        };
      }),
    } as never);

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([]);
      const [prompts, setPrompts] = useState<Prompt[]>(seededPrompts);
      const [promptsLoaded, setPromptsLoaded] = useState(false);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [mediaTabCache, setMediaTabCache] = useState(() => createMediaTabCacheState<Row>());
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("saved_prompts");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      useMediaTabDataController<Row, Prompt>({
        activeMediaCache: null,
        activeMediaQuery: "",
        activeMediaTab: null,
        activeTab: "saved_prompts",
        activeTabRef,
        cacheTtlMs: 30_000,
        surface: "media-library-modal",
        currentUserIdRef,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 60,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        error,
        prompts,
        promptsLoaded,
      };
    });

    await waitFor(() => {
      expect(result.current.promptsLoaded).toBe(true);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.prompts).toBe(seededPrompts);
  });

  it("does not start a second prompt load when fetch is re-enabled mid-request", async () => {
    const promptDeferred = createDeferred<{ data: Prompt[]; error: null }>();
    const promptOrderMock = vi.fn(() => promptDeferred.promise);
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "media_prompts") {
          throw new Error(`Unexpected table: ${table}`);
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: promptOrderMock,
              }),
            }),
          })),
        };
      }),
    } as never);

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([]);
      const [prompts, setPrompts] = useState<Prompt[]>([]);
      const [promptsLoaded, setPromptsLoaded] = useState(false);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [fetchEnabled, setFetchEnabled] = useState(true);
      const [mediaTabCache, setMediaTabCache] = useState(() => createMediaTabCacheState<Row>());
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("saved_prompts");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      useMediaTabDataController<Row, Prompt>({
        activeMediaCache: null,
        activeMediaQuery: "",
        activeMediaTab: null,
        activeTab: "saved_prompts",
        activeTabRef,
        cacheTtlMs: 30_000,
        surface: "media-library-modal",
        currentUserIdRef,
        fetchEnabled,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 60,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        error,
        fetchEnabled,
        loading,
        prompts,
        promptsLoaded,
        setFetchEnabled,
      };
    });

    await waitFor(() => {
      expect(promptOrderMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.setFetchEnabled(false);
    });
    act(() => {
      result.current.setFetchEnabled(true);
    });

    expect(promptOrderMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      promptDeferred.resolve({
        data: [makePrompt({ id: "prompt-reenabled-1" })],
        error: null,
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.promptsLoaded).toBe(true);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.prompts).toHaveLength(1);
  });

  it("keeps active media rows stable when a refresh returns identical expanded rows", async () => {
    const seededRows = [
      makeRow({
        id: "row-stable-1",
        filename: "stable.png",
        storage_path: "user-1/images/stable.png",
        source: "upload",
        metadata: {
          prompt: "Studio portrait",
          dimensions: { width: 1024, height: 1024 },
        },
        signedUrl: "https://signed.example/stable.png",
        preview_storage_path: "user-1/images/stable.png",
      }),
    ];
    fetchMediaListPageMock.mockResolvedValue({
      rows: [
        makeRow({
          id: "row-stable-1",
          filename: "stable.png",
          storage_path: "user-1/images/stable.png",
          source: "upload",
          metadata: {
            prompt: "Studio portrait",
            dimensions: { width: 1024, height: 1024 },
          },
        }),
      ],
      nextCursor: null,
      hasMore: false,
      signedById: new Map(),
    });
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn(),
    } as never);

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>(seededRows);
      const [prompts, setPrompts] = useState<Prompt[]>([]);
      const [promptsLoaded, setPromptsLoaded] = useState(true);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [mediaTabCache, setMediaTabCache] = useState(() => {
        const cache = createMediaTabCacheState<Row>();
        cache.uploaded_images = {
          ...cache.uploaded_images,
          rows: seededRows,
          query: "",
          loaded: true,
          loadedAtMs: Date.now(),
          pagesLoaded: 1,
          hasMore: false,
        };
        return cache;
      });
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      const tabData = useMediaTabDataController<Row, Prompt>({
        activeMediaCache: mediaTabCache.uploaded_images,
        activeMediaQuery: "",
        activeMediaTab: "uploaded_images",
        activeTab: "uploaded_images",
        activeTabRef,
        cacheTtlMs: 30_000,
        surface: "media-library-modal",
        currentUserIdRef,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 60,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        error,
        files,
        mediaTabCache,
        tabData,
      };
    });

    await act(async () => {
      await result.current.tabData.fetchMediaTabPage("uploaded_images", {
        query: "",
        reset: true,
      });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.files).toBe(seededRows);
    expect(result.current.mediaTabCache.uploaded_images.rows).toBe(seededRows);
  });

  it("fetches a media page and normalizes preview fields", async () => {
    fetchMediaListPageMock.mockResolvedValue({
      rows: [
        makeRow({
          id: "row-fetch",
          filename: "fresh.png",
          storage_path: "user-1/images/fresh.png",
          source: undefined,
        }),
      ],
      nextCursor: null,
      hasMore: false,
      signedById: new Map([["row-fetch", "https://signed.example/fresh.png"]]),
    });
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn(),
    } as never);

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([]);
      const [prompts, setPrompts] = useState<Prompt[]>([]);
      const [promptsLoaded, setPromptsLoaded] = useState(true);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<string | null>(null);
      const [mediaTabCache, setMediaTabCache] = useState(() => {
        const cache = createMediaTabCacheState<Row>();
        cache.uploaded_images = {
          ...cache.uploaded_images,
          loaded: true,
          loadedAtMs: Date.now(),
          query: "",
        };
        return cache;
      });
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      const tabData = useMediaTabDataController<Row, Prompt>({
        activeMediaCache: mediaTabCache.uploaded_images,
        activeMediaQuery: "",
        activeMediaTab: "uploaded_images",
        activeTab: "uploaded_images",
        activeTabRef,
        cacheTtlMs: 30_000,
        surface: "media-library-route",
        currentUserIdRef,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 60,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        currentUserIdRef,
        error,
        files,
        loading,
        mediaTabCache,
        prompts,
        tabData,
      };
    });

    await act(async () => {
      await result.current.tabData.fetchMediaTabPage("uploaded_images", {
        query: "",
        reset: true,
      });
    });

    expect(result.current.error).toBeNull();
    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0]).toMatchObject({
      id: "row-fetch",
      preview_storage_path: "user-1/images/fresh.png",
      source: "upload",
      signedUrl: "https://signed.example/fresh.png",
    });
    expect(result.current.currentUserIdRef.current).toBe("user-1");
  });

  it("surfaces an error when the list API cannot fulfill the request", async () => {
    fetchMediaListPageMock.mockResolvedValue(null);

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([]);
      const [prompts, setPrompts] = useState<Prompt[]>([]);
      const [promptsLoaded, setPromptsLoaded] = useState(true);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [mediaTabCache, setMediaTabCache] = useState(() => {
        const cache = createMediaTabCacheState<Row>();
        cache.uploaded_images = {
          ...cache.uploaded_images,
          loaded: true,
          loadedAtMs: Date.now(),
          query: "",
        };
        return cache;
      });
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      const tabData = useMediaTabDataController<Row, Prompt>({
        activeMediaCache: mediaTabCache.uploaded_images,
        activeMediaQuery: "",
        activeMediaTab: "uploaded_images",
        activeTab: "uploaded_images",
        activeTabRef,
        cacheTtlMs: 30_000,
        surface: "media-library-route",
        currentUserIdRef,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 60,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        error,
        files,
        loading,
        mediaTabCache,
        prompts,
        tabData,
      };
    });

    await act(async () => {
      await result.current.tabData.fetchMediaTabPage("uploaded_images", {
        query: "",
        reset: true,
      });
    });

    expect(result.current.error).toBe("Unable to load media.");
    expect(result.current.mediaTabCache.uploaded_images.error).toBe("Unable to load media.");
    expect(result.current.mediaTabCache.uploaded_images.loadedAtMs).toEqual(expect.any(Number));
    expect(result.current.files).toEqual([]);

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMediaListPageMock).toHaveBeenCalledTimes(1);
  });

  it("keeps existing rows visible while stale refresh is unresolved", async () => {
    const existingRow = makeRow({
      id: "row-stale-1",
      filename: "stale.png",
      storage_path: "user-1/images/stale.png",
      created_at: "2026-02-14T00:00:00.000Z",
    });
    const deferred = createDeferred<{
      rows: Row[];
      nextCursor: { createdAt: string; id: string } | null;
      hasMore: boolean;
      signedById: Map<string, string>;
    }>();
    fetchMediaListPageMock.mockImplementation(() => deferred.promise);
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn(),
    } as never);

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([existingRow]);
      const [prompts, setPrompts] = useState<Prompt[]>([]);
      const [promptsLoaded, setPromptsLoaded] = useState(true);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [mediaTabCache, setMediaTabCache] = useState(() => {
        const cache = createMediaTabCacheState<Row>();
        cache.uploaded_images = {
          ...cache.uploaded_images,
          rows: [existingRow],
          query: "",
          loaded: true,
          loadedAtMs: 1,
          hasMore: true,
          nextCursor: {
            createdAt: "2026-02-14T00:00:00.000Z",
            id: existingRow.id,
          },
        };
        return cache;
      });
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      useMediaTabDataController<Row, Prompt>({
        activeMediaCache: mediaTabCache.uploaded_images,
        activeMediaQuery: "",
        activeMediaTab: "uploaded_images",
        activeTab: "uploaded_images",
        activeTabRef,
        cacheTtlMs: 1,
        surface: "media-library-route",
        currentUserIdRef,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 60,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        error,
        files,
        loading,
        mediaTabCache,
        prompts,
      };
    });

    await waitFor(() => {
      expect(result.current.mediaTabCache.uploaded_images.loading).toBe(true);
    });
    expect(result.current.files.map((row) => row.id)).toEqual([existingRow.id]);
    expect(result.current.mediaTabCache.uploaded_images.rows.map((row) => row.id)).toEqual([
      existingRow.id,
    ]);

    deferred.resolve({
      rows: [existingRow],
      nextCursor: {
        createdAt: existingRow.created_at,
        id: existingRow.id,
      },
      hasMore: true,
      signedById: new Map(),
    });
    await waitFor(() => {
      expect(result.current.mediaTabCache.uploaded_images.loading).toBe(false);
    });
  });

  it("appends rows on load-more without clearing existing items", async () => {
    const rowOne = makeRow({
      id: "row-load-more-1",
      filename: "older.png",
      storage_path: "user-1/images/older.png",
      created_at: "2026-02-14T00:00:00.000Z",
    });
    const rowTwo = makeRow({
      id: "row-load-more-2",
      filename: "newer.png",
      storage_path: "user-1/images/newer.png",
      created_at: "2026-02-13T00:00:00.000Z",
    });
    fetchMediaListPageMock.mockResolvedValue({
      rows: [rowTwo],
      nextCursor: {
        createdAt: rowTwo.created_at,
        id: rowTwo.id,
      },
      hasMore: true,
      signedById: new Map(),
    });
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn(),
    } as never);

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([rowOne]);
      const [prompts, setPrompts] = useState<Prompt[]>([]);
      const [promptsLoaded, setPromptsLoaded] = useState(true);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [mediaTabCache, setMediaTabCache] = useState(() => {
        const cache = createMediaTabCacheState<Row>();
        cache.uploaded_images = {
          ...cache.uploaded_images,
          rows: [rowOne],
          query: "",
          loaded: true,
          loadedAtMs: Date.now(),
          pagesLoaded: 1,
          hasMore: true,
          nextCursor: {
            createdAt: rowOne.created_at,
            id: rowOne.id,
          },
        };
        return cache;
      });
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      const tabData = useMediaTabDataController<Row, Prompt>({
        activeMediaCache: mediaTabCache.uploaded_images,
        activeMediaQuery: "",
        activeMediaTab: "uploaded_images",
        activeTab: "uploaded_images",
        activeTabRef,
        cacheTtlMs: 30_000,
        surface: "media-library-route",
        currentUserIdRef,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 1,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        error,
        files,
        loading,
        mediaTabCache,
        prompts,
        tabData,
      };
    });

    await act(async () => {
      await result.current.tabData.fetchMediaTabPage("uploaded_images", {
        query: "",
        reason: "load_more",
      });
    });

    expect(result.current.files.map((row) => row.id)).toEqual([rowOne.id, rowTwo.id]);
    expect(result.current.mediaTabCache.uploaded_images.rows.map((row) => row.id)).toEqual([
      rowOne.id,
      rowTwo.id,
    ]);
    expect(result.current.mediaTabCache.uploaded_images.pagesLoaded).toBe(2);
  });

  it("ignores overlapping same-tab fetch calls while one request is in-flight", async () => {
    const sessionDeferred = createDeferred<{
      data: { session: { user: { id: string } } };
      error: null;
    }>();
    fetchMediaListPageMock.mockResolvedValue({
      rows: [makeRow({ id: "row-overlap-1" })],
      nextCursor: null,
      hasMore: false,
      signedById: new Map(),
    });
    readSupabaseUserIdMock.mockImplementation(() =>
      sessionDeferred.promise.then((value) => value.data.session.user.id)
    );
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn(),
    } as never);

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([]);
      const [prompts, setPrompts] = useState<Prompt[]>([]);
      const [promptsLoaded, setPromptsLoaded] = useState(true);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [mediaTabCache, setMediaTabCache] = useState(() => createMediaTabCacheState<Row>());
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      const tabData = useMediaTabDataController<Row, Prompt>({
        activeMediaCache: mediaTabCache.uploaded_images,
        activeMediaQuery: "",
        activeMediaTab: "uploaded_images",
        activeTab: "uploaded_images",
        activeTabRef,
        cacheTtlMs: 30_000,
        surface: "media-library-route",
        currentUserIdRef,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 60,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        error,
        files,
        loading,
        mediaTabCache,
        prompts,
        tabData,
      };
    });

    await waitFor(() => {
      expect(result.current.mediaTabCache.uploaded_images.loading).toBe(true);
    });

    await act(async () => {
      await result.current.tabData.fetchMediaTabPage("uploaded_images", {
        reason: "load_more",
      });
    });

    expect(readSupabaseUserIdMock).toHaveBeenCalledTimes(1);

    sessionDeferred.resolve({
      data: {
        session: {
          user: { id: "user-1" },
        },
      },
      error: null,
    });

    await waitFor(() => {
      expect(result.current.mediaTabCache.uploaded_images.loading).toBe(false);
    });
  });

  it("requires scroll intent plus sentinel exit before next auto-pagination trigger", async () => {
    type IoCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
    let callback: IoCallback | null = null;
    let scrollHandler: EventListener | null = null;
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();
    const observerRoot = document.createElement("div");
    observerRoot.scrollTop = 0;
    const originalAddEventListener = observerRoot.addEventListener.bind(observerRoot);
    const originalRemoveEventListener = observerRoot.removeEventListener.bind(observerRoot);
    observerRoot.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject
    ) => {
      if (type === "scroll") {
        scrollHandler =
          typeof listener === "function" ? listener : listener.handleEvent.bind(listener);
      }
      originalAddEventListener(type, listener);
    }) as typeof observerRoot.addEventListener;
    observerRoot.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject
    ) => {
      if (
        type === "scroll" &&
        scrollHandler &&
        (listener === scrollHandler ||
          (typeof listener === "object" && listener.handleEvent === scrollHandler))
      ) {
        scrollHandler = null;
      }
      originalRemoveEventListener(type, listener);
    }) as typeof observerRoot.removeEventListener;
    const previousObserver = globalThis.IntersectionObserver;
    vi.stubGlobal(
      "IntersectionObserver",
      class MockIntersectionObserver {
        constructor(nextCallback: IoCallback) {
          callback = nextCallback;
        }
        observe = observeMock;
        unobserve = vi.fn();
        disconnect = disconnectMock;
      }
    );

    try {
      const firstSessionDeferred = createDeferred<{
        data: { session: { user: { id: string } } };
      }>();
      const secondSessionDeferred = createDeferred<{
        data: { session: { user: { id: string } } };
      }>();
      readSupabaseUserIdMock
        .mockImplementationOnce(() =>
          firstSessionDeferred.promise.then((value) => value.data.session.user.id)
        )
        .mockImplementationOnce(() =>
          secondSessionDeferred.promise.then((value) => value.data.session.user.id)
        );
      fetchMediaListPageMock.mockResolvedValue({
        rows: [makeRow({ id: "row-auto-1" })],
        nextCursor: {
          createdAt: "2026-02-14T00:00:00.000Z",
          id: "row-auto-1",
        },
        hasMore: true,
        signedById: new Map(),
      });
      ensureSupabaseQueryClientMock.mockReturnValue({
        from: vi.fn(),
      } as never);

      const { result } = renderHook(() => {
        const [files, setFiles] = useState<Row[]>([]);
        const [prompts, setPrompts] = useState<Prompt[]>([]);
        const [promptsLoaded, setPromptsLoaded] = useState(true);
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const [mediaTabCache, setMediaTabCache] = useState(() => {
          const cache = createMediaTabCacheState<Row>();
          cache.uploaded_images = {
            ...cache.uploaded_images,
            loaded: true,
            loadedAtMs: Date.now(),
            hasMore: true,
            query: "",
          };
          return cache;
        });
        const activeTabRef = useRef<
          "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
        >("uploaded_images");
        const mediaTabRequestRef = useRef(createMediaTabRequestState());
        const currentUserIdRef = useRef<string | null>(null);
        const loadMoreSentinelRef = useRef<HTMLDivElement | null>(document.createElement("div"));
        const loadMoreObserverRootRef = useRef<HTMLElement | null>(observerRoot);

        useMediaTabDataController<Row, Prompt>({
          activeMediaCache: mediaTabCache.uploaded_images,
          activeMediaQuery: "",
          activeMediaTab: "uploaded_images",
          activeTab: "uploaded_images",
          activeTabRef,
          cacheTtlMs: 30_000,
          surface: "media-library-route",
          currentUserIdRef,
          loadMoreSentinelRef,
          loadMoreObserverRootRef,
          mediaTabCache,
          mediaTabRequestRef,
          pageSize: 1,
          promptsLoaded,
          setError,
          setFiles,
          setLoading,
          setMediaTabCache,
          setPrompts,
          setPromptsLoaded,
        });

        return {
          error,
          files,
          loading,
          mediaTabCache,
          prompts,
        };
      });

      await waitFor(() => {
        expect(callback).toBeTruthy();
      });

      await act(async () => {
        callback?.([{ isIntersecting: true }]);
      });
      await act(async () => {
        await Promise.resolve();
      });
      expect(readSupabaseUserIdMock).toHaveBeenCalledTimes(0);

      await act(async () => {
        observerRoot.scrollTop = 80;
        scrollHandler?.(new Event("scroll"));
        callback?.([{ isIntersecting: true }]);
      });
      expect(readSupabaseUserIdMock).toHaveBeenCalledTimes(1);
      expect(result.current.mediaTabCache.uploaded_images.loading).toBe(true);

      await act(async () => {
        callback?.([{ isIntersecting: true }]);
      });
      expect(readSupabaseUserIdMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        callback?.([{ isIntersecting: false }]);
        callback?.([{ isIntersecting: true }]);
      });
      expect(readSupabaseUserIdMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        firstSessionDeferred.resolve({
          data: {
            session: {
              user: { id: "user-1" },
            },
          },
        });
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(result.current.mediaTabCache.uploaded_images.loading).toBe(false);
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        observerRoot.scrollTop = 160;
        scrollHandler?.(new Event("scroll"));
        callback?.([{ isIntersecting: true }]);
      });
      expect(readSupabaseUserIdMock).toHaveBeenCalledTimes(2);
      expect(result.current.mediaTabCache.uploaded_images.loading).toBe(true);

      await act(async () => {
        secondSessionDeferred.resolve({
          data: {
            session: {
              user: { id: "user-1" },
            },
          },
        });
        await Promise.resolve();
      });
      await waitFor(() => {
        expect(result.current.mediaTabCache.uploaded_images.loading).toBe(false);
      });
    } finally {
      if (previousObserver) {
        vi.stubGlobal("IntersectionObserver", previousObserver);
      } else {
        vi.unstubAllGlobals();
      }
    }
  });

  it("clamps hasMore to false after consecutive no-progress load-more pages", async () => {
    const rowOne = makeRow({
      id: "row-no-progress-1",
      filename: "steady.png",
      storage_path: "user-1/images/steady.png",
      created_at: "2026-02-14T00:00:00.000Z",
    });
    fetchMediaListPageMock.mockResolvedValue({
      rows: [rowOne],
      nextCursor: {
        createdAt: rowOne.created_at,
        id: rowOne.id,
      },
      hasMore: true,
      signedById: new Map(),
    });
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn(),
    } as never);

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([rowOne]);
      const [prompts, setPrompts] = useState<Prompt[]>([]);
      const [promptsLoaded, setPromptsLoaded] = useState(true);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [mediaTabCache, setMediaTabCache] = useState(() => {
        const cache = createMediaTabCacheState<Row>();
        cache.uploaded_images = {
          ...cache.uploaded_images,
          rows: [rowOne],
          query: "",
          loaded: true,
          loadedAtMs: Date.now(),
          pagesLoaded: 1,
          hasMore: true,
          nextCursor: {
            createdAt: rowOne.created_at,
            id: rowOne.id,
          },
        };
        return cache;
      });
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      const tabData = useMediaTabDataController<Row, Prompt>({
        activeMediaCache: mediaTabCache.uploaded_images,
        activeMediaQuery: "",
        activeMediaTab: "uploaded_images",
        activeTab: "uploaded_images",
        activeTabRef,
        cacheTtlMs: 30_000,
        surface: "media-library-route",
        currentUserIdRef,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 1,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        error,
        files,
        loading,
        mediaTabCache,
        prompts,
        tabData,
      };
    });

    await act(async () => {
      await result.current.tabData.fetchMediaTabPage("uploaded_images", {
        query: "",
        reason: "load_more",
      });
    });
    expect(result.current.mediaTabCache.uploaded_images.hasMore).toBe(true);

    await act(async () => {
      await result.current.tabData.fetchMediaTabPage("uploaded_images", {
        query: "",
        reason: "load_more",
      });
    });
    expect(result.current.mediaTabCache.uploaded_images.hasMore).toBe(false);
    expect(result.current.mediaTabCache.uploaded_images.nextCursor).toBeNull();
  });

  it("does not fetch when controller is disabled", async () => {
    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([]);
      const [prompts, setPrompts] = useState<Prompt[]>([]);
      const [promptsLoaded, setPromptsLoaded] = useState(true);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [mediaTabCache, setMediaTabCache] = useState(() => createMediaTabCacheState<Row>());
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      const tabData = useMediaTabDataController<Row, Prompt>({
        activeMediaCache: mediaTabCache.uploaded_images,
        activeMediaQuery: "",
        activeMediaTab: "uploaded_images",
        activeTab: "uploaded_images",
        activeTabRef,
        cacheTtlMs: 30_000,
        surface: "media-library-route",
        currentUserIdRef,
        fetchEnabled: false,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 60,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        error,
        files,
        loading,
        mediaTabCache,
        prompts,
        tabData,
      };
    });

    await act(async () => {
      await result.current.tabData.fetchMediaTabPage("uploaded_images", {
        reason: "initial",
      });
    });

    expect(ensureSupabaseQueryClientMock).not.toHaveBeenCalled();
    expect(readSupabaseUserIdMock).not.toHaveBeenCalled();
    expect(result.current.mediaTabCache.uploaded_images.rows).toEqual([]);
  });

  it("unblocks loading and surfaces timeout error when fetch hangs", async () => {
    vi.useFakeTimers();
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn(),
    } as never);
    readSupabaseUserIdMock.mockImplementation(
      () =>
        new Promise(() => {
          // Intentionally unresolved to simulate a hanging request.
        })
    );

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([]);
      const [prompts, setPrompts] = useState<Prompt[]>([]);
      const [promptsLoaded, setPromptsLoaded] = useState(true);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [mediaTabCache, setMediaTabCache] = useState(() => createMediaTabCacheState<Row>());
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      const tabData = useMediaTabDataController<Row, Prompt>({
        activeMediaCache: mediaTabCache.uploaded_images,
        activeMediaQuery: "",
        activeMediaTab: "uploaded_images",
        activeTab: "uploaded_images",
        activeTabRef,
        cacheTtlMs: 30_000,
        surface: "media-library-route",
        currentUserIdRef,
        fetchTimeoutMs: 50,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 60,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        error,
        files,
        loading,
        mediaTabCache,
        prompts,
        tabData,
      };
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.mediaTabCache.uploaded_images.loading).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(result.current.mediaTabCache.uploaded_images.loading).toBe(false);
    expect(result.current.error).toBe("Media refresh timed out. Showing cached media.");
  });

  it("clears in-flight loading state when controller is disabled", async () => {
    const pendingSession = new Promise<string>(() => {
      // Intentionally unresolved to keep the request in-flight.
    });
    ensureSupabaseQueryClientMock.mockReturnValue({
      from: vi.fn(),
    } as never);
    readSupabaseUserIdMock.mockImplementation(() => pendingSession);

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Row[]>([]);
      const [prompts, setPrompts] = useState<Prompt[]>([]);
      const [promptsLoaded, setPromptsLoaded] = useState(true);
      const [loading, setLoading] = useState(false);
      const [error, setError] = useState<string | null>(null);
      const [fetchEnabled, setFetchEnabled] = useState(true);
      const [mediaTabCache, setMediaTabCache] = useState(() => createMediaTabCacheState<Row>());
      const activeTabRef = useRef<
        "uploaded_images" | "uploaded_videos" | "private" | "saved_prompts" | "ai_generations"
      >("uploaded_images");
      const mediaTabRequestRef = useRef(createMediaTabRequestState());
      const currentUserIdRef = useRef<string | null>(null);
      const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

      useMediaTabDataController<Row, Prompt>({
        activeMediaCache: mediaTabCache.uploaded_images,
        activeMediaQuery: "",
        activeMediaTab: "uploaded_images",
        activeTab: "uploaded_images",
        activeTabRef,
        cacheTtlMs: 30_000,
        surface: "media-library-route",
        currentUserIdRef,
        fetchEnabled,
        loadMoreSentinelRef,
        mediaTabCache,
        mediaTabRequestRef,
        pageSize: 60,
        promptsLoaded,
        setError,
        setFiles,
        setLoading,
        setMediaTabCache,
        setPrompts,
        setPromptsLoaded,
      });

      return {
        error,
        fetchEnabled,
        files,
        loading,
        mediaTabCache,
        prompts,
        setFetchEnabled,
      };
    });

    await waitFor(() => {
      expect(result.current.mediaTabCache.uploaded_images.loading).toBe(true);
    });

    act(() => {
      result.current.setFetchEnabled(false);
    });

    expect(result.current.fetchEnabled).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.mediaTabCache.uploaded_images.loading).toBe(false);
  });
});
